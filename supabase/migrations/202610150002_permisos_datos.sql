-- Aplicar despues de administracion. Protege los datos que consulta la web.
begin;
create or replace function public.app_farm_module(unit_name text, lot text default '') returns text
language sql immutable set search_path='' as $$
 select case translate(upper(btrim(coalesce(unit_name,''))),'Ó','O')
 when 'LUMBRA' then 'lumbra' when 'REPARTICION' then 'reparticion'
 when 'ASIA' then 'asia' when 'CARABAYLLO' then 'carabayllo'
 when 'TERCEROS - PAVOS' then case when upper(btrim(lot)) in
 ('26RB04','26RB07','26RB08','26RB09','26RB10','26RB11','26RB13','26RB14','26RB15','26RB16','26RB17','26RB18',
  '26RB19','26RB20','26RB21','26RB22','26RB23','26RB24','26RN08','26RN09','26RN10','26RN11','26RN12') then 'asia' else 'granjas' end
 else 'granjas' end;
$$;
revoke all on function public.app_farm_module(text,text) from public;
grant execute on function public.app_farm_module(text,text) to authenticated;
do $$
declare target record; read_expr text; write_expr text; view_item record; legacy_function record;
begin
 for target in select * from (values
  ('registro_diario_granja','farm'),('registro_diario_engorde_recria','farm'),
  ('pesos_granja_asia','asia'),('estandares_pavos_asia','asia'),
  ('estandares_pavos','reparticion'),('Resumen Lotes Cod STD','master')
 ) as resources(table_name,module_key)
 loop
  if to_regclass(format('public.%I',target.table_name)) is null then continue; end if;
  if target.module_key='farm' then
   read_expr := 'public.app_has_access(''granjas'') or public.app_has_access(public.app_farm_module("Unid_Prod"::text,"Cod_Lote"::text))';
   write_expr := 'public.app_has_access(''granjas'',''edit'') or public.app_has_access(public.app_farm_module("Unid_Prod"::text,"Cod_Lote"::text),''edit'')';
  elsif target.module_key='master' then
   read_expr := 'public.app_has_access(''granjas'') or public.app_has_access(''lumbra'') or public.app_has_access(''reparticion'') or public.app_has_access(''asia'') or public.app_has_access(''carabayllo'')';
   write_expr := 'public.app_has_access(''lumbra'',''edit'')';
  else
   read_expr := format('public.app_has_access(%L)',target.module_key);
   write_expr := format('public.app_has_access(%L,''edit'')',target.module_key);
  end if;
  execute format('alter table public.%I enable row level security',target.table_name);
  execute format('revoke all on public.%I from public,anon',target.table_name);
  execute format('grant select,insert,update,delete on public.%I to authenticated',target.table_name);
  execute format('drop policy if exists app_module_base on public.%I',target.table_name);
  execute format('create policy app_module_base on public.%I as permissive for all to authenticated using(true) with check(true)',target.table_name);
  execute format('drop policy if exists app_module_read on public.%I',target.table_name);
  execute format('create policy app_module_read on public.%I as restrictive for select to authenticated using(%s)',target.table_name,read_expr);
  execute format('drop policy if exists app_module_insert on public.%I',target.table_name);
  execute format('create policy app_module_insert on public.%I as restrictive for insert to authenticated with check(%s)',target.table_name,write_expr);
  execute format('drop policy if exists app_module_update on public.%I',target.table_name);
  execute format('create policy app_module_update on public.%I as restrictive for update to authenticated using(%s) with check(%s)',target.table_name,write_expr,write_expr);
  execute format('drop policy if exists app_module_delete on public.%I',target.table_name);
  execute format('create policy app_module_delete on public.%I as restrictive for delete to authenticated using(%s)',target.table_name,write_expr);
 end loop;
 -- Todas las vistas dependientes de las tablas protegidas respetan RLS.
 for view_item in
  with recursive dependencies(oid) as (
   select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname in ('registro_diario_granja','registro_diario_engorde_recria','pesos_granja_asia','estandares_pavos_asia','estandares_pavos','Resumen Lotes Cod STD')
   union
   select r.ev_class from dependencies s join pg_depend d on d.refobjid=s.oid
   join pg_rewrite r on d.classid='pg_rewrite'::regclass and d.objid=r.oid
   join pg_class v on v.oid=r.ev_class where v.relkind='v'
  ) select distinct n.nspname,c.relname from dependencies d join pg_class c on c.oid=d.oid
    join pg_namespace n on n.oid=c.relnamespace where c.relkind='v'
 loop
  execute format('alter view %I.%I set (security_invoker=true)',view_item.nspname,view_item.relname);
  execute format('revoke all on %I.%I from public,anon',view_item.nspname,view_item.relname);
  execute format('grant select on %I.%I to authenticated',view_item.nspname,view_item.relname);
 end loop;
 for legacy_function in select p.oid::regprocedure as signature
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname in ('public','lumbra','reparticion')
     and p.proname in ('vista_poblacion_lumbra_etapa','vista_poblacion_reparticion_etapa')
 loop
  execute format('alter function %s security invoker',legacy_function.signature);
  execute format('revoke all on function %s from public,anon',legacy_function.signature);
  execute format('grant execute on function %s to authenticated',legacy_function.signature);
 end loop;
end;
$$;
notify pgrst,'reload schema';
commit;
