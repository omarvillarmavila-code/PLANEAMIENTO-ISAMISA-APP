-- Produccion y mortalidad por lote, semana y etapa para Lumbra.
-- Mortalidad acumulada: cierre registrado / poblacion del primer dia de edad 1.
-- Los estandares admiten proporciones (0.02) o porcentajes explicitos (2 %).
-- Las columnas prod_hinc_std y prod_hcom_std corresponden a los valores
-- esperados de la tabla estandares_pollos para cada lote, edad y sexo.
-- Una sola lectura de registro_diario_granja para ambos sexos.
-- CREATE OR REPLACE conserva la vista y sus dependencias.
-- Edad semanal: maximo numerico (10 es mayor que 9), conservando tipo text.
-- No inferir la escala por la magnitud: 0.5% y 0.5 representan 0.5% y 50%.
create or replace function lumbra.estandar_a_porcentaje(p_valor text)
returns numeric
language sql immutable strict parallel safe
set search_path = ''
as $$
  with texto as (
    select btrim(replace(p_valor, chr(160), ' ')) as valor
  ), numero as (
    select replace(btrim(regexp_replace(valor, '%$', '')), ',', '.') as valor,
      right(valor, 1) = '%' as es_porcentaje
    from texto
  )
  select case
    when valor ~ '^[+-]?([0-9]+([.][0-9]+)?|[.][0-9]+)([eE][+-]?[0-9]+)?$'
      then valor::numeric * case when es_porcentaje then 1 else 100 end
    -- Ausentes, guiones y texto invalido no deben convertirse en cero.
  end
  from numero;
$$;

create or replace view lumbra.vista_postura_por_lote_y_semana as
with base as (
  select
    c.ano,
    c.semana,
    d."Fecha"::date as fecha,
    coalesce(nullif(trim(d."Linea_Madre"::text), ''), 'SIN LINEA') as linea,
    coalesce(nullif(trim(d."Cod_Lote"::text), ''), 'SIN LOTE') as lote,
    coalesce(nullif(upper(trim(d."Galpon"::text)), ''), 'SIN GALPON') as galpon,
    coalesce(nullif(upper(trim(d."Valido"::text)), ''), 'Y') = 'Y' as registro_poblacion,
    upper(trim(coalesce(d."Sexo", ''))) as sexo,
    coalesce(nullif(upper(trim(d."Etapa"::text)), ''), 'SIN ETAPA') as etapa,
    d."Edad_sem"::text as edad,
    case when trim(d."Edad_sem"::text) ~ '^[0-9]+([.][0-9]+)?$'
      then trim(d."Edad_sem"::text)::numeric end as edad_num,
    -- Un saldo inicial ausente no participa en el promedio; cero si participa.
    nullif(regexp_replace(d."Saldo_Ini"::text, '[^0-9.-]', '', 'g'), '')::numeric as saldo_inicial,
    coalesce(nullif(regexp_replace(d."Mortal"::text, '[^0-9.-]', '', 'g'), '')::numeric, 0) as mortalidad,
    nullif(regexp_replace(d."Mortal_Acum"::text, '[^0-9.-]', '', 'g'), '')::numeric as mortalidad_acum,
    case when upper(trim(coalesce(d."Sexo", ''))) = 'HEMBRA' then
      coalesce(nullif(regexp_replace(coalesce(d."Saldo_Final", '0')::text, '[^0-9.-]', '', 'g'), ''), '0')::numeric
    else 0::numeric end as saldo_final_hembra,
    case when upper(trim(coalesce(d."Sexo", ''))) = 'HEMBRA' then
      coalesce(d."Prod_HInc", 0)
    else 0::numeric end as prod_hinc,
    case when upper(trim(coalesce(d."Sexo", ''))) = 'HEMBRA' then
      coalesce(nullif(regexp_replace(coalesce(d."Prod_HCom", '0')::text, '[^0-9.-]', '', 'g'), ''), '0')::numeric
    else 0::numeric end as prod_hcom
  from public.registro_diario_granja d
  join public.calendario c on c.fecha = d."Fecha"::date
  where upper(trim(coalesce(d."Unid_Prod", ''))) = 'LUMBRA'
    and upper(trim(coalesce(d."Sexo", ''))) in ('HEMBRA', 'MACHO')
    and c.ano is not null
    and c.semana is not null
), registros_acumulados as (
  select b.*,
    -- Una sola contribucion por saldo/acumulado identico del mismo alojamiento.
    -- Evita multiplicar el dato por copias importadas o por detalles de alimento.
    -- Valido=N identifica filas sin poblacion: no aportan al acumulado ni a su base.
    registro_poblacion and row_number() over (
      partition by fecha, linea, lote, etapa, sexo, galpon, edad_num,
        saldo_inicial, mortalidad_acum, registro_poblacion
      order by fecha
    ) = 1 as aporta_acumulado
  from base b
), fechas as (
  select b.*,
    min(fecha) over (partition by ano, semana, lote, etapa, sexo) as primera_fecha,
    max(fecha) filter (where aporta_acumulado) over (partition by ano, semana, lote, etapa, sexo) as ultima_fecha,
    min(fecha) filter (where edad_num = 1 and aporta_acumulado) over (partition by lote, sexo) as fecha_edad_1
  from registros_acumulados b
), poblacion_origen as (
  select f.*,
    -- Base fija de toda la vida del lote: primer dia registrado con edad 1.
    -- Suma las filas de ese dia, nunca los saldos de los siete dias.
    case when count(*) filter (where fecha = fecha_edad_1 and edad_num = 1 and aporta_acumulado
      and saldo_inicial is null) over w = 0 then
      sum(saldo_inicial) filter (where fecha = fecha_edad_1 and edad_num = 1 and aporta_acumulado) over w
    end as poblacion_edad_1
  from fechas f
  window w as (partition by lote, sexo)
), semanal_sexo as (
  select
    ano, semana, linea, lote, etapa, sexo,
    max(case when trim(edad) ~ '^[0-9]+([.][0-9]+)?$' then trim(edad)::numeric end)::text as edad,
    sum(saldo_final_hembra) as saldo_final_hembra,
    sum(prod_hinc) as prod_hinc,
    sum(prod_hcom) as prod_hcom,
    sum(mortalidad) as mortalidad,
    -- Mortal_Acum ya es acumulado: solo se toma el cierre de semana/etapa.
    -- Un cierre incompleto conserva NULL; no se sustituye por cero ni por MAX.
    sum(mortalidad_acum) filter (where fecha = ultima_fecha and aporta_acumulado) as mortalidad_acum_cierre,
    count(*) filter (where fecha = ultima_fecha and aporta_acumulado and mortalidad_acum is null) as cierres_sin_acum,
    max(edad_num) filter (where fecha = ultima_fecha and aporta_acumulado) as edad_cierre,
    max(poblacion_edad_1) as poblacion_edad_1,
    sum(saldo_inicial) filter (where fecha = primera_fecha) as suma_inicial,
    count(saldo_inicial) filter (where fecha = primera_fecha) as registros_iniciales
  from poblacion_origen
  group by ano, semana, linea, lote, etapa, sexo
), resumen as (
  select s.*,
    -- Las medidas son por lote y etapa, incluso si aparece en varias lineas.
    -- Sumar importes y conteos evita promediar promedios de distinto tamano.
    sum(suma_inicial) filter (where sexo = 'HEMBRA') over w
      / nullif(sum(registros_iniciales) filter (where sexo = 'HEMBRA') over w, 0)
      as saldo_inicial_hembra,
    sum(suma_inicial) filter (where sexo = 'MACHO') over w
      / nullif(sum(registros_iniciales) filter (where sexo = 'MACHO') over w, 0)
      as saldo_inicial_macho,
    coalesce(sum(mortalidad) filter (where sexo = 'HEMBRA') over w, 0) as mortalidad_hembra,
    coalesce(sum(mortalidad) filter (where sexo = 'MACHO') over w, 0) as mortalidad_macho,
    max(poblacion_edad_1) filter (where sexo = 'HEMBRA') over w as poblacion_edad_1_hembra,
    max(poblacion_edad_1) filter (where sexo = 'MACHO') over w as poblacion_edad_1_macho,
    case when sum(cierres_sin_acum) filter (where sexo = 'HEMBRA') over w = 0
      then sum(mortalidad_acum_cierre) filter (where sexo = 'HEMBRA') over w end as mortalidad_acum_hembra,
    case when sum(cierres_sin_acum) filter (where sexo = 'MACHO') over w = 0
      then sum(mortalidad_acum_cierre) filter (where sexo = 'MACHO') over w end as mortalidad_acum_macho,
    max(edad_cierre) filter (where sexo = 'HEMBRA') over w as edad_cierre_hembra,
    max(edad_cierre) filter (where sexo = 'MACHO') over w as edad_cierre_macho
  from semanal_sexo s
  window w as (partition by ano, semana, lote, etapa)
), lotes as (
  select distinct on (upper(trim(coalesce("LOTE"::text, ''))))
    upper(trim(coalesce("LOTE"::text, ''))) as lote,
    "COD STD"::text as cod_std
  from public."Resumen Lotes Cod STD"
  order by upper(trim(coalesce("LOTE"::text, '')))
), estandares as (
  select
    codigo_estandar::text as cod_std,
    edad_sem::text as edad,
    case when trim(edad_sem::text) ~ '^[0-9]+([.][0-9]+)?$'
      then trim(edad_sem::text)::numeric end as edad_num,
    upper(trim(coalesce(sexo, ''))) as sexo,
    lumbra.estandar_a_porcentaje(prod_hinc::text) as prod_hinc_std,
    lumbra.estandar_a_porcentaje(prod_hcom::text) as prod_hcom_std,
    lumbra.estandar_a_porcentaje(mort_sem::text) as mortalidad_std_sem,
    lumbra.estandar_a_porcentaje(mort_acum::text) as mortalidad_std_acum
  from public.estandares_pollos
)
select
  p.ano,
  p.semana,
  p.linea,
  p.lote,
  p.edad,
  p.saldo_final_hembra,
  p.prod_hinc,
  p.prod_hcom,
  round(p.prod_hinc * 100 / nullif(p.saldo_final_hembra, 0), 2) as porcentaje_prod_hinc,
  round(p.prod_hcom * 100 / nullif(p.saldo_final_hembra, 0), 2) as porcentaje_prod_hcom,
  l.cod_std,
  e.prod_hinc_std,
  e.prod_hcom_std,
  p.saldo_inicial_hembra,
  p.saldo_inicial_macho,
  p.mortalidad_macho,
  p.mortalidad_hembra,
  round(p.mortalidad_hembra * 100 / nullif(p.saldo_inicial_hembra, 0), 2) as porcentaje_mortalidad_hembra,
  round(p.mortalidad_macho * 100 / nullif(p.saldo_inicial_macho, 0), 2) as porcentaje_mortalidad_macho,
  e.mortalidad_std_sem as porcentaje_mortalidad_std_sem_hembra,
  em.mortalidad_std_sem as porcentaje_mortalidad_std_sem_macho,
  p.etapa,
  p.poblacion_edad_1_hembra,
  p.poblacion_edad_1_macho,
  p.mortalidad_acum_hembra,
  p.mortalidad_acum_macho,
  case when p.poblacion_edad_1_hembra > 0 then
    round(p.mortalidad_acum_hembra * 100 / p.poblacion_edad_1_hembra, 2)
  end as porcentaje_mortalidad_acum_hembra,
  case when p.poblacion_edad_1_macho > 0 then
    round(p.mortalidad_acum_macho * 100 / p.poblacion_edad_1_macho, 2)
  end as porcentaje_mortalidad_acum_macho,
  ea.mortalidad_std_acum as porcentaje_mortalidad_std_acum_hembra,
  ema.mortalidad_std_acum as porcentaje_mortalidad_std_acum_macho
from resumen p
left join lotes l
  on l.lote = upper(trim(p.lote))
left join estandares e
  on e.cod_std = l.cod_std
 and e.edad = p.edad
 and e.sexo = 'HEMBRA'
left join estandares em
  on em.cod_std = l.cod_std
 and em.edad = p.edad
 and em.sexo = 'MACHO'
left join estandares ea
  on ea.cod_std = l.cod_std
 and ea.edad_num = p.edad_cierre_hembra
 and ea.sexo = 'HEMBRA'
left join estandares ema
  on ema.cod_std = l.cod_std
 and ema.edad_num = p.edad_cierre_macho
 and ema.sexo = 'MACHO'
-- Mantener una fila por lote/linea/semana/etapa con registros de hembras.
-- Este filtro debe aplicarse despues de calcular las ventanas de ambos sexos.
where p.sexo = 'HEMBRA';

grant select on lumbra.vista_postura_por_lote_y_semana to anon, authenticated;
notify pgrst, 'reload schema';
