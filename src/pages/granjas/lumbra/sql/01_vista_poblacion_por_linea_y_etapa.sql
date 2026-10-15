-- Vista fija de población de Lumbra por año, semana, etapa y línea.
-- Se actualiza automáticamente al consultar cuando se agregan registros nuevos.

create or replace view lumbra.vista_poblacion_por_linea_y_etapa as
with base as (
  select
    'LUMBRA'::text as granja,
    case
      when upper(coalesce(r."Etapa", '')) like '%LEVANTE%' then 'LEVANTE'
      when upper(coalesce(r."Etapa", '')) like '%POSTURA%' then 'POSTURA'
      when upper(coalesce(r."Etapa", '')) like '%MUDA%' then 'MUDA'
    end::text as etapa,
    c.ano,
    c.semana,
    r."Fecha"::date as fecha,
    coalesce(nullif(trim(r."Linea_Madre"::text), ''), 'SIN LINEA')::text as linea,
    coalesce(r."Cod_Lote", 'SIN LOTE')::text as lote,
    upper(trim(coalesce(r."Sexo", ''))) as sexo,
    coalesce(nullif(regexp_replace(coalesce(r."Saldo_Final", '0')::text, '[^0-9.-]', '', 'g'), ''), '0')::numeric as saldo
  from public.registro_diario_granja r
  left join public.calendario c on c.fecha = r."Fecha"::date
  where upper(trim(coalesce(r."Unid_Prod", ''))) = 'LUMBRA'
    and upper(trim(coalesce(r."Sexo", ''))) in ('HEMBRA', 'MACHO')
), promedios as (
  select granja, etapa, ano, semana, fecha, linea, sexo, avg(saldo)::numeric as saldo
  from base
  where etapa is not null and ano is not null and semana is not null
  group by granja, etapa, ano, semana, fecha, linea, lote, sexo
), fechas as (
  select *, max(fecha) over (partition by granja, etapa, ano, semana, linea) as fecha_mas_actual
  from promedios
), resumen as (
  select granja, etapa, ano, semana, fecha_mas_actual as fecha, linea,
    coalesce(sum(saldo) filter (where sexo = 'HEMBRA'), 0)::numeric as saldo_final_hembra,
    coalesce(sum(saldo) filter (where sexo = 'MACHO'), 0)::numeric as saldo_final_macho
  from fechas
  where fecha = fecha_mas_actual
  group by granja, etapa, ano, semana, fecha_mas_actual, linea
), totales as (
  select *, saldo_final_hembra + saldo_final_macho as total_aves,
    sum(saldo_final_hembra + saldo_final_macho) over (partition by granja, etapa, ano, semana) as total_etapa
  from resumen
)
select granja, etapa, ano, semana, fecha, linea,
  saldo_final_hembra, saldo_final_macho,
  round(saldo_final_hembra * 100 / nullif(total_aves, 0), 2) as porcentaje_hembras,
  round(saldo_final_macho * 100 / nullif(total_aves, 0), 2) as porcentaje_machos,
  total_aves,
  round(total_aves * 100 / nullif(total_etapa, 0), 2) as porcentaje_total_linea
from totales;

grant select on lumbra.vista_poblacion_por_linea_y_etapa to anon, authenticated;
notify pgrst, 'reload schema';
