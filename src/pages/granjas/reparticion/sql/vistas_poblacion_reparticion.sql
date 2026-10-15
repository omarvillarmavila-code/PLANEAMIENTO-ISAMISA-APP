-- Poblacion por linea de Reparticion.
-- Promedio por fecha, linea, lote y sexo; luego ultima fecha por linea y sexo.
create or replace function public.vista_poblacion_reparticion_etapa(etapa_filtro text)
returns table(fecha date,linea text,saldo_final_hembra numeric,saldo_final_macho numeric,porcentaje_hembra numeric,porcentaje_macho numeric,total_aves numeric,porcentaje_total numeric)
language sql stable security definer set search_path = public as $$
with fecha_actual as (
  select max("Fecha"::date) as fecha
  from public.registro_diario_granja
  where upper(trim(coalesce("Unid_Prod",''))) like 'REPARTIC%'
), base as (
  select "Fecha"::date fecha, coalesce("Linea_Madre",'SIN LINEA')::text linea, coalesce("Cod_Lote",'SIN LOTE')::text lote,
    upper(trim(coalesce("Sexo",''))) sexo,
    coalesce(nullif(regexp_replace(coalesce("Saldo_Final",'0')::text,'[^0-9.-]','','g'),''),'0')::numeric saldo,
    upper(coalesce("Etapa",'')) as etapa
  from public.registro_diario_granja
  cross join fecha_actual f
  where upper(trim(coalesce("Unid_Prod",''))) like 'REPARTIC%'
    and "Fecha"::date = f.fecha
    and upper(trim(coalesce("Sexo",''))) in ('HEMBRA','MACHO')
), datos_etapa as (
  select b.*
  from base b
  cross join fecha_actual f
  where b.fecha = f.fecha
    and upper(b.etapa) like '%' || upper(etapa_filtro) || '%'
), promedios_lote as (
  select fecha,linea,lote,sexo,avg(saldo)::numeric saldo from datos_etapa group by fecha,linea,lote,sexo
), ultimas as (
  select max(fecha) fecha from promedios_lote
), resumen as (
  select p.linea,max(p.fecha) fecha,
    coalesce(sum(case when p.sexo='HEMBRA' then p.saldo else 0 end),0)::numeric saldo_final_hembra,
    coalesce(sum(case when p.sexo='MACHO' then p.saldo else 0 end),0)::numeric saldo_final_macho
  from promedios_lote p join ultimas u on u.fecha=p.fecha
  group by p.linea
  having coalesce(sum(case when p.sexo='HEMBRA' then p.saldo else 0 end),0) <> 0
), calculos as (
  select *,saldo_final_hembra+saldo_final_macho total_aves,sum(saldo_final_hembra+saldo_final_macho) over() total_general from resumen
)
select fecha,linea,saldo_final_hembra,saldo_final_macho,
  round(saldo_final_hembra*100/nullif(total_aves,0),2),round(saldo_final_macho*100/nullif(total_aves,0),2),total_aves,
  round(total_aves*100/nullif(total_general,0),2) from calculos;
$$;
create or replace view public.poblacion_por_linea_reparticion_levante as select * from public.vista_poblacion_reparticion_etapa('LEVANTE');
create or replace view public.poblacion_por_linea_reparticion_postura as select * from public.vista_poblacion_reparticion_etapa('POSTURA');
create or replace view public.poblacion_por_linea_reparticion_muda as select * from public.vista_poblacion_reparticion_etapa('MUDA');
grant execute on function public.vista_poblacion_reparticion_etapa(text) to authenticated;
grant select on public.poblacion_por_linea_reparticion_levante,public.poblacion_por_linea_reparticion_postura,public.poblacion_por_linea_reparticion_muda to authenticated,anon;
notify pgrst,'reload schema';
