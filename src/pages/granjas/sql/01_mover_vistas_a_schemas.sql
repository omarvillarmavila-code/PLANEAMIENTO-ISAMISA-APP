-- Ejecutar solo después de haber creado y verificado las vistas base.
-- Elimina las copias wrapper y mueve los objetos originales.
drop schema if exists lumbra cascade;
drop schema if exists reparticion cascade;
create schema lumbra;
create schema reparticion;

alter view public.aves_por_lote_lumbra set schema lumbra;
alter view public.resumen_especie_linea_lote_lumbra set schema lumbra;
alter view public.resumen_prod_hinc_lumbra set schema lumbra;
alter view public.vista_saldos_por_lote set schema lumbra;
alter view public.poblacion_por_linea_levante set schema lumbra;
alter view public.poblacion_por_linea_postura set schema lumbra;
alter view public.poblacion_por_linea_muda set schema lumbra;
alter function public.vista_poblacion_lumbra_etapa(text) set schema lumbra;

alter view public.aves_por_lote_reparticion set schema reparticion;
alter view public.resumen_especie_linea_lote_reparticion set schema reparticion;
alter view public.vista_saldos_por_lote_reparticion set schema reparticion;
alter view public.poblacion_por_linea_reparticion_levante set schema reparticion;
alter view public.poblacion_por_linea_reparticion_postura set schema reparticion;
alter view public.poblacion_por_linea_reparticion_muda set schema reparticion;
alter function public.vista_poblacion_reparticion_etapa(text) set schema reparticion;

grant usage on schema lumbra, reparticion to anon, authenticated;
grant select on all tables in schema lumbra, reparticion to anon, authenticated;
grant execute on all routines in schema lumbra, reparticion to anon, authenticated;
