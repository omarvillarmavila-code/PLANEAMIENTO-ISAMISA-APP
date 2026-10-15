-- Ejecutar despues de crear pesos_granja_asia y cargar ambos registros.
-- Requiere los encabezados simples de registro_diario_engorde_recria.
-- Cruce EXACTO por fecha/lote y filas de poblacion Valido=Y.
-- ASIA o lotes confirmados de sus campanas bajo TERCEROS - PAVOS.
-- Color corresponde a Variedad del registro diario, sin reinterpretarlo.
begin;

create or replace function public.asia_fecha_registro(valor text)
returns date language plpgsql immutable strict
set search_path = '' as $$
declare partes text[]; anio integer;
begin
  if btrim(valor) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return btrim(valor)::date;
  end if;
  partes := regexp_match(btrim(valor), '^([0-9]{1,2})/([0-9]{1,2})/([0-9]{4}|[0-9]{2})$');
  if partes is null then return null; end if;
  anio := partes[3]::integer;
  if length(partes[3]) = 2 then anio := 2000 + anio; end if;
  return make_date(anio, partes[2]::integer, partes[1]::integer);
exception when datetime_field_overflow or invalid_datetime_format or invalid_text_representation then
  return null;
end;
$$;

create or replace view public.vista_pesos_granja_asia
with (security_invoker = true) as
with destinos(lote, destino_comercial) as (
  values
    ('26RB04', 'TROZADO'),
    ('26RB07', 'TROZADO'),
    ('26RB08', 'TROZADO'),
    ('26RB14', 'TROZADO'),
    ('26RB18', 'TROZADO'),
    ('26RB09', 'EMPACADO'),
    ('26RB10', 'EMPACADO'),
    ('26RB11', 'EMPACADO'),
    ('26RB13', 'EMPACADO'),
    ('26RB15', 'EMPACADO'),
    ('26RB16', 'EMPACADO'),
    ('26RB17', 'EMPACADO'),
    ('26RN08', 'EMPACADO'),
    ('26RN09', 'EMPACADO'),
    ('26RB19', 'CAMPAÑA VIVO'),
    ('26RB20', 'CAMPAÑA VIVO'),
    ('26RB21', 'CAMPAÑA VIVO'),
    ('26RB22', 'CAMPAÑA VIVO'),
    ('26RN10', 'CAMPAÑA VIVO'),
    ('26RN11', 'CAMPAÑA VIVO'),
    ('26RB24', 'CAMPAÑA VIVO'),
    ('26RN12', 'CAMPAÑA VIVO'),
    ('26RB23', 'CAMPAÑA VIVO')
), diario as (
  select
    public.asia_fecha_registro(r."Fecha") as fecha,
    upper(btrim(r."Cod_Lote")) as lote,
    nullif(upper(btrim(r."Sexo")), '') as sexo,
    nullif(upper(btrim(r."Variedad")), '') as color,
    coalesce(nullif(upper(btrim(r."Galpon")), ''), 'SIN GALPON') as galpon,
    coalesce(nullif(upper(btrim(r."Etapa")), ''), 'SIN ETAPA') as etapa,
    case when btrim(r."Edad_sem") ~ '^[0-9]+([.][0-9]+)?$'
      then btrim(r."Edad_sem")::numeric end as edad_semana,
    case when btrim(r."Saldo_Ini") ~ '^[0-9]+([.][0-9]+)?$'
      then btrim(r."Saldo_Ini")::numeric
      when btrim(r."Saldo_Ini") ~ '^[0-9]{1,3}(,[0-9]{3})+([.][0-9]+)?$'
      then replace(btrim(r."Saldo_Ini"), ',', '')::numeric end as saldo_inicial
  from public.registro_diario_engorde_recria r
  where (upper(btrim(coalesce(r."Unid_Prod", ''))) = 'ASIA'
    or (upper(btrim(coalesce(r."Unid_Prod", ''))) = 'TERCEROS - PAVOS'
      and upper(btrim(r."Cod_Lote")) in (select lote from destinos)))
    and upper(btrim(coalesce(nullif(r."Valido", ''), 'Y'))) = 'Y'
), alojamientos as (
  -- Distintos alimentos pueden repetir el saldo del mismo alojamiento.
  -- No multiplicarlo. Si hay valores contradictorios, dejarlo sin dato.
  select fecha, lote, sexo, color, galpon, etapa,
    case when count(saldo_inicial) = count(*) and min(saldo_inicial) = max(saldo_inicial)
      then min(saldo_inicial) end as saldo_inicial,
    case when count(edad_semana) = count(*) and min(edad_semana) = max(edad_semana)
      then min(edad_semana) end as edad_semana
  from diario
  where fecha is not null and lote is not null
  group by fecha, lote, sexo, color, galpon, etapa
), ficha as (
  select fecha, lote,
    case when count(sexo) = count(*) and count(distinct sexo) = 1 then min(sexo) end as sexo,
    case when count(color) = count(*) and count(distinct color) = 1 then min(color) end as color,
    case when count(edad_semana) = count(*) and min(edad_semana) = max(edad_semana)
      then min(edad_semana) end as edad_semana,
    case when count(sexo) = count(*) and count(distinct sexo) = 1
      and count(color) = count(*) and count(distinct color) = 1
      and count(saldo_inicial) = count(*) then sum(saldo_inicial) end as saldo_inicial,
    count(distinct sexo) as cantidad_sexos,
    count(distinct color) as cantidad_colores
  from alojamientos
  group by fecha, lote
), muestra as (
  select p.*,
    min(peso_gr) over grupo as peso_minimo_gr,
    max(peso_gr) over grupo as peso_maximo_gr,
    count(*) over grupo as cantidad_pesajes
  from public.pesos_granja_asia p
  window grupo as (partition by fecha, upper(btrim(lote)), tipo_produccion)
), amplitudes as (
  select m.*, peso_maximo_gr - peso_minimo_gr as amplitud_total_gr,
    (peso_maximo_gr - peso_minimo_gr) / 6::numeric as rango_gr
  from muestra m
), clases as (
  select a.*, case when rango_gr = 0 then 1
    else least(6, greatest(1, floor((peso_gr - peso_minimo_gr) / rango_gr)::integer + 1))
    end as numero_clase
  from amplitudes a
), limites as (
  select c.*, peso_minimo_gr + (numero_clase - 1) * rango_gr as intervalo_min_gr,
    case when numero_clase = 6 then peso_maximo_gr
      else peso_minimo_gr + numero_clase * rango_gr end as intervalo_max_gr
  from clases c
)
select p.id, p.fecha, p.semana_cal, p.lote, p.tipo_produccion,
  f.edad_semana, f.color, f.sexo, p.peso_gr,
  p.peso_maximo_gr, p.peso_minimo_gr, p.amplitud_total_gr, p.rango_gr,
  chr(64 + p.numero_clase) as clase,
  p.intervalo_min_gr, p.intervalo_max_gr,
  round(p.intervalo_min_gr, 6)::text || ' a ' || round(p.intervalo_max_gr, 6)::text as intervalo,
  f.saldo_inicial, p.cantidad_pesajes,
  case when f.fecha is null then 'SIN REGISTRO DIARIO EN ESA FECHA'
    when f.cantidad_sexos > 1 then 'LOTE CON VARIOS SEXOS: FALTA SEXO EN EL PESAJE'
    when f.cantidad_colores > 1 then 'LOTE CON VARIOS COLORES: FALTA COLOR EN EL PESAJE'
    when f.sexo is null or f.color is null or f.edad_semana is null or f.saldo_inicial is null
      then 'DATOS DIARIOS INCOMPLETOS O CONTRADICTORIOS'
    else 'OK' end as estado_cruce,
  d.destino_comercial
from limites p
left join ficha f on f.fecha = p.fecha and f.lote = upper(btrim(p.lote))
left join destinos d on d.lote = upper(btrim(p.lote));

comment on view public.vista_pesos_granja_asia is
  'Una fila por pesaje. Clases A-F por fecha/lote/tipo. Rango=(max-min)/6. Intervalos [min,max), excepto F incluye max. Si todos pesan igual, clase A y rango cero. Saldo inicial se repite por pesaje: no sumarlo entre aves muestreadas.';
grant select on public.vista_pesos_granja_asia to authenticated;
comment on column public.vista_pesos_granja_asia.destino_comercial is
  'Destino confirmado por lote: TROZADO, EMPACADO o CAMPAÑA VIVO. Los lotes no asignados permanecen NULL. Independiente de ENGORDE/RECRIA.';
notify pgrst, 'reload schema';
commit;

-- Verificar despues de ejecutar:
-- select * from public.vista_pesos_granja_asia order by fecha, lote, peso_gr limit 30;
-- select estado_cruce, count(*) from public.vista_pesos_granja_asia group by estado_cruce;
