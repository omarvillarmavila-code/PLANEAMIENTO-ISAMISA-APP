-- Ejecutar como postgres despues de las migraciones 001 y 002.
begin;
create or replace function public.app_allowed_modules(requested_action text)
returns text[] language sql stable security definer set search_path='' as $$
 select coalesce(array_agg(m.id),array[]::text[])
 from public.app_users u cross join public.app_modules m
 where u.id=(select auth.uid()) and u.active
 and requested_action in ('read','edit')
 and (u.is_admin or exists (
   select 1 from public.app_module_permissions p
   where p.user_id=u.id and p.module_id=m.id
   and (p.level='edit' or (requested_action='read' and p.level='read'))
 ));
$$;
revoke all on function public.app_allowed_modules(text) from public;
grant execute on function public.app_allowed_modules(text) to authenticated;
do $$
declare target record; read_expr text; write_expr text;
begin
 for target in select * from (values
  ('registro_diario_granja','farm'),('registro_diario_engorde_recria','farm'),
  ('pesos_granja_asia','asia'),('estandares_pavos_asia','asia'),
  ('estandares_pavos','reparticion'),('Resumen Lotes Cod STD','master')
 ) as resources(table_name,module_key)
 loop
  if to_regclass(format('public.%I',target.table_name)) is null then continue; end if;
  if target.module_key='farm' then
   read_expr := '(select public.app_allowed_modules(''read'')) && array[''granjas''] or public.app_farm_module("Unid_Prod"::text,"Cod_Lote"::text) = any ((select public.app_allowed_modules(''read''))::text[])';
   write_expr := '(select public.app_allowed_modules(''edit'')) && array[''granjas''] or public.app_farm_module("Unid_Prod"::text,"Cod_Lote"::text) = any ((select public.app_allowed_modules(''edit''))::text[])';
  elsif target.module_key='master' then
   read_expr := '(select public.app_allowed_modules(''read'')) && array[''granjas'',''lumbra'',''reparticion'',''asia'',''carabayllo'']';
   write_expr := '(select public.app_allowed_modules(''edit'')) && array[''lumbra'']';
  else
   read_expr := format('(select public.app_allowed_modules(''read'')) && array[%L]',target.module_key);
   write_expr := format('(select public.app_allowed_modules(''edit'')) && array[%L]',target.module_key);
  end if;
  execute format('alter policy app_module_read on public.%I using(%s)',target.table_name,read_expr);
  execute format('alter policy app_module_insert on public.%I with check(%s)',target.table_name,write_expr);
  execute format('alter policy app_module_update on public.%I using(%s) with check(%s)',target.table_name,write_expr,write_expr);
  execute format('alter policy app_module_delete on public.%I using(%s)',target.table_name,write_expr);
 end loop;
end;
$$;
commit;
