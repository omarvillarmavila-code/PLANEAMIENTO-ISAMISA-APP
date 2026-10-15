-- Fecha, año y semana más recientes disponibles por granja.
create or replace view public.fecha_actual_granja as
select
  upper(trim(coalesce(r."Unid_Prod", ''))) as granja,
  max(r."Fecha")::date as fecha_actual,
  c.ano,
  c.semana
from public.registro_diario_granja r
left join public.calendario c on c.fecha = r."Fecha"::date
where upper(trim(coalesce(r."Unid_Prod", ''))) in ('LUMBRA', 'REPARTICIÓN', 'REPARTICION')
group by upper(trim(coalesce(r."Unid_Prod", ''))), c.ano, c.semana;

grant select on public.fecha_actual_granja to anon, authenticated;
