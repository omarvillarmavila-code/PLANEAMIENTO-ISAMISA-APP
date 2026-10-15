-- Ejecutar en Supabase SQL Editor. Solo lectura, no modifica permisos ni datos.
select 'tabla_pesos' as origen, count(*) as filas from public.pesos_granja_asia
union all
select 'vista_pesos', count(*) from public.vista_pesos_granja_asia;

select upper(btrim(lote)) as lote, extract(year from fecha)::int as anio,
  semana_cal, min(fecha) as fecha_min, max(fecha) as fecha_max,
  count(*) as pesajes, count(distinct clase) as clases
from public.vista_pesos_granja_asia
group by upper(btrim(lote)), extract(year from fecha), semana_cal
order by anio desc, semana_cal desc, lote;

select schemaname, tablename, policyname, roles, cmd, qual
from pg_policies
where schemaname = 'public' and tablename in ('pesos_granja_asia', 'registro_diario_engorde_recria');

select has_table_privilege('authenticated', 'public.pesos_granja_asia', 'SELECT') as lectura_tabla,
  has_table_privilege('authenticated', 'public.vista_pesos_granja_asia', 'SELECT') as lectura_vista,
  has_table_privilege('authenticated', 'public.registro_diario_engorde_recria', 'SELECT') as lectura_diario;

-- Simula lectura de authenticated sin JWT particular: las politicas basadas
-- en auth.uid() requieren adicionalmente comprobar la sesion real de la web.
begin;
set local role authenticated;
select 'tabla_authenticated' as origen, count(*) as filas from public.pesos_granja_asia
union all
select 'vista_authenticated', count(*) from public.vista_pesos_granja_asia;
rollback;
