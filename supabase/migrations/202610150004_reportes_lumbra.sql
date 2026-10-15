-- Ejecutar como postgres. Conserva RLS de las tablas y vistas existentes.
-- Solo expone reportes de Lumbra, con permiso comprobado antes del calculo.
begin;
do $migration$
declare item record;
begin
 for item in select * from (values
  ('app_lumbra_poblacion_etapa','vista_poblacion_por_linea_y_etapa',true),
  ('app_lumbra_poblacion_lote','vista_poblacion_por_lote_y_semana',false),
  ('app_lumbra_postura','vista_postura_por_lote_y_semana',true),
  ('app_lumbra_consumo','vista_consumo_por_lote_semanal',false)
 ) as reports(function_name,view_name,has_stage)
 loop
  execute format($definition$
   create or replace function public.%I(
     p_year integer default null,p_week integer default null,
     p_lot text default null,p_stage text default null)
   returns setof lumbra.%I
   language plpgsql stable security definer set search_path='' as $body$
   begin
    if not (public.app_has_access('lumbra') or public.app_has_access('granjas')) then
      raise exception 'Sin permiso para consultar Lumbra' using errcode='42501';
    end if;
    return query execute %L using p_year,p_week,p_lot,p_stage;
   end;
   $body$;
  $definition$,item.function_name,item.view_name,
   format('select * from lumbra.%I where ($1 is null or ano=$1) and ($2 is null or semana=$2)%s%s',
     item.view_name,
     case when item.has_stage then ' and ($4 is null or etapa=$4)' else '' end,
     case when item.view_name='vista_poblacion_por_linea_y_etapa' then '' else ' and ($3 is null or lote=$3)' end));
  execute format('revoke all on function public.%I(integer,integer,text,text) from public,anon',item.function_name);
  execute format('grant execute on function public.%I(integer,integer,text,text) to authenticated',item.function_name);
 end loop;
end;
$migration$;

create or replace function public.app_periodos_granja(p_farm text)
returns setof public.periodos_disponibles_granja
language plpgsql stable security definer set search_path='' as $$
declare farm text := upper(btrim(p_farm)); module_key text;
begin
 module_key := case farm when 'LUMBRA' then 'lumbra'
   when 'REPARTICIÓN' then 'reparticion' when 'REPARTICION' then 'reparticion' end;
 if module_key is null or not (public.app_has_access(module_key) or public.app_has_access('granjas')) then
   raise exception 'Sin permiso para consultar esta granja' using errcode='42501';
 end if;
 return query select * from public.periodos_disponibles_granja where granja=farm;
end;
$$;
revoke all on function public.app_periodos_granja(text) from public,anon;
grant execute on function public.app_periodos_granja(text) to authenticated;
notify pgrst,'reload schema';
commit;
