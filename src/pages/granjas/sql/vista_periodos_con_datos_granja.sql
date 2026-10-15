-- Fechas y períodos disponibles por granja, derivados del registro y calendario.
create or replace view public.periodos_con_datos_granja as
select distinct
  upper(trim(coalesce(r."Unid_Prod", ''))) as granja,
  r."Fecha"::date as fecha,
  c.ano,
  c.semana
from public.registro_diario_granja r
inner join public.calendario c on c.fecha = r."Fecha"::date
where upper(trim(coalesce(r."Unid_Prod", ''))) in ('LUMBRA', 'REPARTICIÓN', 'REPARTICION')
  and r."Fecha" is not null
order by granja, fecha;

grant select on public.periodos_con_datos_granja to anon, authenticated;
