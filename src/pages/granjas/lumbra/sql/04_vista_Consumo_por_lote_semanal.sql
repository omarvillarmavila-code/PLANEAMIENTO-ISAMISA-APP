-- Ejecutar completo en el SQL Editor de Supabase.
-- Cons_Alim: kg diarios del lote. cons_aabb: gramos por ave por dia.
-- Estandar semanal kg = cons_aabb * saldo inicial semanal * 7 / 1000.
-- Real g/ave/dia = kg registrados * 1000 / suma de saldos iniciales diarios.
-- Incluye las mismas etapas y las nueve columnas de la vista de poblacion.
-- Una fila por ano/semana/linea/lote; los alimentos se conservan en arrays JSON.
begin;

-- Apoyan la seleccion de fechas y granja sin cambiar datos de las tablas.
create index if not exists idx_calendario_ano_semana_fecha
  on public.calendario (ano, semana, fecha);
create index if not exists idx_registro_granja_unidad_fecha
  on public.registro_diario_granja (upper(trim(coalesce("Unid_Prod", ''))), "Fecha");

create or replace view lumbra.vista_consumo_por_lote_semanal as
-- Permite aplicar los filtros de ano/semana antes de agrupar el historial.
with consumo_base as (
  -- Las cargas repetidas pueden diferir solo en id/created_at.
  -- Comparar todo el registro de negocio conserva dias, galpones, alimentos
  -- y movimientos distintos, aunque tengan la misma cantidad de kg.
  select distinct
    c.ano, c.semana, d."Fecha"::date as fecha,
    to_jsonb(d) - array['id', 'created_at'] as registro_origen,
    coalesce(nullif(trim(d."Linea_Madre"::text), ''), 'SIN LINEA') as linea,
    coalesce(nullif(trim(d."Cod_Lote"::text), ''), 'SIN LOTE') as lote,
    upper(trim(coalesce(d."Sexo", ''))) as sexo,
    coalesce(nullif(upper(trim(d."Etapa"::text)), ''), 'SIN ETAPA') as etapa,
    coalesce(nullif(upper(trim(to_jsonb(d)->>'Galpon')), ''), 'SIN GALPON') as galpon,
    coalesce(nullif(upper(trim(to_jsonb(d)->>'Valido')), ''), 'Y') = 'Y' as registro_poblacion,
    coalesce(nullif(upper(trim(d."Tipo_Alim"::text)), ''), 'SIN ALIMENTO') as alimento,
    nullif(trim(d."Cons_Alim"::text), '') as consumo_texto,
    nullif(trim(d."Saldo_Ini"::text), '') as saldo_inicial_texto
  from public.registro_diario_granja d
  join public.calendario c on c.fecha = d."Fecha"::date
  where upper(trim(coalesce(d."Unid_Prod", ''))) = 'LUMBRA'
    and upper(trim(coalesce(d."Sexo", ''))) in ('HEMBRA', 'MACHO')
    and c.ano is not null and c.semana is not null
), consumo_numerico as (
  select b.*,
    min(fecha) over (partition by ano, semana, linea, lote, sexo) as primera_fecha,
    -- Decimal punto; tambien se admiten miles con coma (1,234.50).
    -- Un dato vacio o mal formado queda NULL, no se convierte en cero.
    case
      when consumo_texto ~ '^[+-]?[0-9]+([.][0-9]+)?$'
        then consumo_texto::numeric
      when consumo_texto ~ '^[+-]?[0-9]{1,3}(,[0-9]{3})+([.][0-9]+)?$'
        then replace(consumo_texto, ',', '')::numeric
    end as consumo_kg,
    case
      when saldo_inicial_texto ~ '^[+-]?[0-9]+([.][0-9]+)?$'
        then saldo_inicial_texto::numeric
      when saldo_inicial_texto ~ '^[+-]?[0-9]{1,3}(,[0-9]{3})+([.][0-9]+)?$'
        then replace(saldo_inicial_texto, ',', '')::numeric
    end as saldo_inicial
  from consumo_base b
), consumo_diario as (
  select n.*,
    -- Los distintos alimentos de un alojamiento/etapa comparten su poblacion.
    -- Etapas simultaneas del lote son poblaciones distintas, aun en el mismo
    -- galpon (p. ej. machos en Levante y Postura); sus saldos se suman.
    -- N aporta alimento, pero no poblacion. Saldos nulos, negativos o
    -- contradictorios en las filas de poblacion dejan la base sin dato.
    case when count(saldo_inicial) filter (where registro_poblacion) over alojamiento
        = count(*) filter (where registro_poblacion) over alojamiento
      and min(saldo_inicial) filter (where registro_poblacion) over alojamiento >= 0
      and min(saldo_inicial) filter (where registro_poblacion) over alojamiento
        = max(saldo_inicial) filter (where registro_poblacion) over alojamiento
      then min(saldo_inicial) filter (where registro_poblacion) over alojamiento
    end as saldo_diario_galpon,
    row_number() over alojamiento = 1 as aporta_saldo_diario,
    row_number() over (partition by ano, semana, linea, lote, sexo, fecha) = 1 as aporta_dia
  from consumo_numerico n
  window alojamiento as (partition by ano, semana, linea, lote, sexo, fecha, galpon, etapa)
), consumo_alimento as (
  select ano, semana, linea, lote, sexo, alimento,
    sum(saldo_inicial) filter (where fecha = primera_fecha) as saldo_suma,
    count(saldo_inicial) filter (where fecha = primera_fecha) as saldo_cantidad,
    sum(saldo_diario_galpon) filter (where aporta_saldo_diario) as suma_saldos_diarios,
    count(*) filter (where aporta_saldo_diario and saldo_diario_galpon is null) as saldos_diarios_faltantes,
    count(*) filter (where aporta_dia) as dias_registrados,
    case when count(consumo_kg) = count(*) then sum(consumo_kg) end as kg
  from consumo_diario
  group by ano, semana, linea, lote, sexo, alimento
), consumo_sexo as (
  select ano, semana, linea, lote, sexo,
    -- Promedio de TODAS las filas de la primera fecha, no promedio de promedios.
    sum(saldo_suma) / nullif(sum(saldo_cantidad), 0) as saldo_inicial,
    case when sum(saldos_diarios_faltantes) = 0 then sum(suma_saldos_diarios) end as suma_saldos_diarios,
    sum(dias_registrados) as dias_registrados,
    case when count(kg) = count(*) then sum(kg) end as consumo_kg,
    jsonb_agg(jsonb_build_object('alimento', alimento, 'kg', kg) order by alimento) as alimentos
  from consumo_alimento
  group by ano, semana, linea, lote, sexo
), consumo_lote as (
  select ano, semana, linea, lote,
    max(saldo_inicial) filter (where sexo = 'HEMBRA') as saldo_inicial_hembra,
    max(saldo_inicial) filter (where sexo = 'MACHO') as saldo_inicial_macho,
    max(suma_saldos_diarios) filter (where sexo = 'HEMBRA') as suma_saldos_diarios_hembra,
    max(suma_saldos_diarios) filter (where sexo = 'MACHO') as suma_saldos_diarios_macho,
    max(dias_registrados) filter (where sexo = 'HEMBRA') as dias_registrados_hembra,
    max(dias_registrados) filter (where sexo = 'MACHO') as dias_registrados_macho,
    max(consumo_kg) filter (where sexo = 'HEMBRA') as consumo_kg_hembra,
    max(consumo_kg) filter (where sexo = 'MACHO') as consumo_kg_macho,
    (jsonb_agg(alimentos) filter (where sexo = 'HEMBRA'))->0 as alimentos_hembra,
    (jsonb_agg(alimentos) filter (where sexo = 'MACHO'))->0 as alimentos_macho
  from consumo_sexo
  group by ano, semana, linea, lote
), lotes as (
  -- No elegir un codigo arbitrario si un lote tiene asignaciones distintas.
  select upper(trim("LOTE"::text)) as lote,
    case when count(distinct nullif(trim("COD STD"::text), '')) = 1
      then min(nullif(trim("COD STD"::text), '')) end as cod_std
  from public."Resumen Lotes Cod STD"
  group by upper(trim("LOTE"::text))
), estandar_base as (
  select
    trim(codigo_estandar::text) as cod_std,
    trim(edad_sem::text) as edad,
    upper(trim(sexo::text)) as sexo,
    coalesce(nullif(upper(trim(tipo_aabb::text)), ''), 'SIN ALIMENTO') as alimento,
    nullif(trim(cons_aabb::text), '') as consumo_texto
  from public.estandares_pollos
  where upper(trim(sexo::text)) in ('HEMBRA', 'MACHO')
), estandar_numerico as (
  select b.*,
    case
      when consumo_texto ~ '^[+-]?[0-9]+([.][0-9]+)?$'
        then consumo_texto::numeric
      when consumo_texto ~ '^[+-]?[0-9]{1,3}(,[0-9]{3})+([.][0-9]+)?$'
        then replace(consumo_texto, ',', '')::numeric
    end as g_ave_dia
  from estandar_base b
), estandar_alimento as (
  -- Duplicados iguales no multiplican el estandar. Valores contradictorios
  -- para el mismo codigo/edad/sexo/alimento quedan sin dato hasta corregirse.
  select cod_std, edad, sexo, alimento,
    case when count(g_ave_dia) = count(*) and count(distinct g_ave_dia) = 1
      then min(g_ave_dia) end as g_ave_dia
  from estandar_numerico
  group by cod_std, edad, sexo, alimento
), estandar_sexo as (
  select cod_std, edad, sexo,
    case when count(g_ave_dia) = count(*) then sum(g_ave_dia) end as g_ave_dia,
    jsonb_agg(jsonb_build_object('alimento', alimento, 'g_ave_dia', g_ave_dia) order by alimento) as alimentos
  from estandar_alimento
  group by cod_std, edad, sexo
)
select
  p.ano, p.semana, p.fecha, p.linea, p.lote,
  p.saldo_final_hembras, p.saldo_final_machos, p.total_aves, p.edad_lote,
  l.cod_std,
  r.consumo_kg_hembra as consumo_kg_hembra,
  r.consumo_kg_macho as consumo_kg_macho,
  coalesce(r.alimentos_hembra, '[]'::jsonb) as alimentos_hembra,
  coalesce(r.alimentos_macho, '[]'::jsonb) as alimentos_macho,
  eh.g_ave_dia * r.saldo_inicial_hembra * 7 / 1000 as consumo_std_kg_hembra,
  em.g_ave_dia * r.saldo_inicial_macho * 7 / 1000 as consumo_std_kg_macho,
  coalesce((select jsonb_agg(item || jsonb_build_object('kg', (item->>'g_ave_dia')::numeric * r.saldo_inicial_hembra * 7 / 1000) order by item->>'alimento')
    from jsonb_array_elements(eh.alimentos) item), '[]'::jsonb) as alimentos_std_hembra,
  coalesce((select jsonb_agg(item || jsonb_build_object('kg', (item->>'g_ave_dia')::numeric * r.saldo_inicial_macho * 7 / 1000) order by item->>'alimento')
    from jsonb_array_elements(em.alimentos) item), '[]'::jsonb) as alimentos_std_macho,
  r.saldo_inicial_hembra as saldo_inicial_hembra,
  r.saldo_inicial_macho as saldo_inicial_macho,
  eh.g_ave_dia as consumo_std_g_ave_dia_hembra,
  em.g_ave_dia as consumo_std_g_ave_dia_macho,
  r.suma_saldos_diarios_hembra,
  r.suma_saldos_diarios_macho,
  r.dias_registrados_hembra,
  r.dias_registrados_macho
from lumbra.vista_poblacion_por_lote_y_semana p
left join lotes l on l.lote = upper(trim(p.lote))
left join consumo_lote r
  on r.ano = p.ano and r.semana = p.semana and r.linea = p.linea and r.lote = p.lote
-- El estandar semanal usa la misma edad_lote que muestra poblacion.
-- Se busca el alimento esperado independientemente del realmente suministrado.
left join estandar_sexo eh
  on eh.cod_std = l.cod_std and eh.edad = trim(p.edad_lote::text) and eh.sexo = 'HEMBRA'
left join estandar_sexo em
  on em.cod_std = l.cod_std and em.edad = trim(p.edad_lote::text) and em.sexo = 'MACHO';

grant select on lumbra.vista_consumo_por_lote_semanal to anon, authenticated;
notify pgrst, 'reload schema';
commit;
