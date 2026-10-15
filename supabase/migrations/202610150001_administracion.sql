begin;
create table if not exists public.app_modules (
  id text primary key, name text not null
);
insert into public.app_modules values
 ('inicio','Inicio'),('granjas','Granjas y carga de registros'),('lumbra','Granja Lumbra'),
 ('reparticion','Granja Reparticion'),('asia','Granja Asia'),('carabayllo','Granja Carabayllo'),
 ('incubacion','Incubacion'),('ate','Planta Ate'),('carapongo','Planta Carapongo'),('planeamiento','Planeamiento')
on conflict(id) do update set name=excluded.name;
create table if not exists public.app_users (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '', active boolean not null default true,
 is_admin boolean not null default false, updated_at timestamptz not null default now()
);
create table if not exists public.app_module_permissions (
 user_id uuid not null references public.app_users(id) on delete cascade,
 module_id text not null references public.app_modules(id),
 level text not null check(level in ('read','edit')), primary key(user_id,module_id)
);
create table if not exists public.app_access_audit (
 id bigint generated always as identity primary key,
 actor_id uuid, target_id uuid, action text not null, detail jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.app_users enable row level security;
alter table public.app_modules enable row level security;
alter table public.app_module_permissions enable row level security;
alter table public.app_access_audit enable row level security;
revoke all on public.app_users,public.app_modules,public.app_module_permissions,public.app_access_audit from anon,authenticated;
grant select on public.app_users,public.app_modules,public.app_module_permissions to authenticated;

create or replace function public.app_is_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.app_users where id=auth.uid() and active and is_admin);
$$;
create or replace function public.app_has_access(module_key text, requested_action text default 'read') returns boolean
language sql stable security definer set search_path='' as $$
 select requested_action in ('read','edit') and exists(select 1 from public.app_users u where u.id=auth.uid() and u.active
   and (u.is_admin or exists(select 1 from public.app_module_permissions p where p.user_id=u.id
      and p.module_id=module_key and (p.level='edit' or (requested_action='read' and p.level='read')))));
$$;
revoke all on function public.app_is_admin() from public;
revoke all on function public.app_has_access(text,text) from public;
grant execute on function public.app_is_admin(),public.app_has_access(text,text) to authenticated;
drop policy if exists app_users_read on public.app_users;
create policy app_users_read on public.app_users for select to authenticated using(id=auth.uid() or public.app_is_admin());
drop policy if exists app_permissions_read on public.app_module_permissions;
create policy app_permissions_read on public.app_module_permissions for select to authenticated using(user_id=auth.uid() or public.app_is_admin());
drop policy if exists app_modules_read on public.app_modules;
create policy app_modules_read on public.app_modules for select to authenticated using(true);

create or replace function public.app_register_user() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.app_users(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'display_name','')) on conflict do nothing;
 insert into public.app_module_permissions(user_id,module_id,level) values(new.id,'inicio','read') on conflict do nothing;
 return new;
end;
$$;
revoke all on function public.app_register_user() from public;
drop trigger if exists app_register_user on auth.users;
create trigger app_register_user after insert on auth.users for each row execute function public.app_register_user();
-- Usuarios existentes: lectura inicial; el administrador asigna edicion o retira accesos.
with added as (
 insert into public.app_users(id,display_name)
 select id,coalesce(raw_user_meta_data->>'display_name','') from auth.users on conflict do nothing returning id
)
insert into public.app_module_permissions(user_id,module_id,level)
 select u.id,m.id,'read' from added u cross join public.app_modules m on conflict do nothing;

create or replace function public.app_my_access() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_build_object('active',u.active,'is_admin',u.is_admin,'display_name',u.display_name,
  'permissions',coalesce((select jsonb_object_agg(p.module_id,p.level) from public.app_module_permissions p where p.user_id=u.id),'{}'::jsonb))
 from public.app_users u where u.id=auth.uid()),jsonb_build_object('active',false,'is_admin',false,'permissions','{}'::jsonb));
$$;
create or replace function public.app_admin_list_users() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.app_is_admin() then raise exception 'Solo administradores' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'email',a.email,'display_name',u.display_name,
   'active',u.active,'is_admin',u.is_admin,'last_sign_in_at',a.last_sign_in_at,
   'permissions',coalesce((select jsonb_object_agg(p.module_id,p.level) from public.app_module_permissions p where p.user_id=u.id),'{}'::jsonb)) order by a.email)
 from public.app_users u join auth.users a on a.id=u.id),'[]'::jsonb);
end;
$$;
create or replace function public.app_admin_save_user(target_id uuid, new_name text, new_active boolean, new_admin boolean, new_permissions jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare before_state jsonb;
begin
 -- Serializa cambios administrativos para impedir eliminar el ultimo administrador.
 perform pg_advisory_xact_lock(726319004);
 if not public.app_is_admin() then raise exception 'Solo administradores' using errcode='42501'; end if;
 if new_active is null or new_admin is null or new_permissions is null or jsonb_typeof(new_permissions)<>'object' then raise exception 'Datos de permisos invalidos'; end if;
 if length(coalesce(new_name,''))>160 then raise exception 'Nombre demasiado largo'; end if;
 if exists(select 1 from jsonb_each_text(new_permissions) x where not exists(select 1 from public.app_modules m where m.id=x.key) or x.value is null or x.value not in ('none','read','edit')) then raise exception 'Modulo o nivel de permiso invalido'; end if;
 select to_jsonb(u) into before_state from public.app_users u where u.id=target_id for update;
 if before_state is null then raise exception 'Usuario no encontrado'; end if;
 if target_id=auth.uid() and (not new_active or not new_admin) then raise exception 'No puedes desactivar ni retirar tu propio rol administrador'; end if;
 if (not new_active or not new_admin) and (before_state->>'is_admin')::boolean and (before_state->>'active')::boolean
   and not exists(select 1 from public.app_users where id<>target_id and active and is_admin) then raise exception 'Debe existir un administrador activo'; end if;
 update public.app_users set display_name=btrim(coalesce(new_name,'')),active=new_active,is_admin=new_admin,updated_at=now() where id=target_id;
 delete from public.app_module_permissions where user_id=target_id;
 insert into public.app_module_permissions(user_id,module_id,level)
   select target_id,key,value from jsonb_each_text(new_permissions) where value in ('read','edit');
 insert into public.app_access_audit(actor_id,target_id,action,detail)
 values(auth.uid(),target_id,'update_access',jsonb_build_object('before',before_state,'active',new_active,'is_admin',new_admin,'permissions',new_permissions));
end;
$$;
revoke all on function public.app_my_access(), public.app_admin_list_users(), public.app_admin_save_user(uuid,text,boolean,boolean,jsonb) from public;
grant execute on function public.app_my_access(),public.app_admin_list_users(),public.app_admin_save_user(uuid,text,boolean,boolean,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
