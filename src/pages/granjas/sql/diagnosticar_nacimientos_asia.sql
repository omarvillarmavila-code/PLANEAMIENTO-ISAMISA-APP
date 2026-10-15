-- Solo lectura. Usa asia_fecha_registro, creada con la vista de pesos.
with nacimientos as (
  select upper(btrim("LOTE")) as lote,
    nullif(btrim("FECHA NAC"::text), '') as valor_original,
    public.asia_fecha_registro(nullif(btrim("FECHA NAC"::text), '')) as fecha_nacimiento
  from public."Resumen Lotes Cod STD"
)
select p.lote, count(distinct p.id) as pesajes,
  min(p.fecha) as primera_muestra, max(p.fecha) as ultima_muestra,
  array_agg(distinct m.valor_original) filter (where m.valor_original is not null) as nacimientos_originales,
  array_agg(distinct m.fecha_nacimiento) filter (where m.fecha_nacimiento is not null) as nacimientos_registrados,
  case when count(distinct m.fecha_nacimiento) = 1
    and count(*) filter (where m.valor_original is not null and m.fecha_nacimiento is null) = 0
    and max(p.fecha) >= min(m.fecha_nacimiento)
    then floor((max(p.fecha) - min(m.fecha_nacimiento)) / 7.0)::integer end as edad_ultima_muestra_sem,
  case when count(*) filter (where m.valor_original is not null and m.fecha_nacimiento is null) > 0 then 'FECHA DE NACIMIENTO CON FORMATO INVALIDO'
    when count(distinct m.fecha_nacimiento) = 0 then 'FALTA FECHA DE NACIMIENTO'
    when count(distinct m.fecha_nacimiento) > 1 then 'NACIMIENTOS CONTRADICTORIOS'
    when max(p.fecha) < min(m.fecha_nacimiento) then 'MUESTRA ANTERIOR AL NACIMIENTO'
    else 'OK' end as estado
from public.pesos_granja_asia p
left join nacimientos m on m.lote = upper(btrim(p.lote))
group by p.lote
order by p.lote;
