-- Organización funcional de objetos para Supabase/PostgREST.
create schema if not exists lumbra;
create schema if not exists reparticion;

-- Lumbra
create or replace view lumbra.aves_por_lote as select * from public.aves_por_lote_lumbra;
create or replace view lumbra.resumen_especie_linea_lote as select * from public.resumen_especie_linea_lote_lumbra;
create or replace view lumbra.resumen_prod_hinc as select * from public.resumen_prod_hinc_lumbra;
create or replace view lumbra.vista_saldos_por_lote as select * from public.vista_saldos_por_lote;
create or replace view lumbra.poblacion_por_linea_levante as select * from public.poblacion_por_linea_levante;
create or replace view lumbra.poblacion_por_linea_postura as select * from public.poblacion_por_linea_postura;
create or replace view lumbra.poblacion_por_linea_muda as select * from public.poblacion_por_linea_muda;
grant usage on schema lumbra to authenticated, anon;
grant select on all tables in schema lumbra to authenticated, anon;

-- Repartición
create or replace view reparticion.aves_por_lote as select * from public.aves_por_lote_reparticion;
create or replace view reparticion.resumen_especie_linea_lote as select * from public.resumen_especie_linea_lote_reparticion;
create or replace view reparticion.vista_saldos_por_lote as select * from public.vista_saldos_por_lote_reparticion;
create or replace view reparticion.poblacion_por_linea_levante as select * from public.poblacion_por_linea_reparticion_levante;
create or replace view reparticion.poblacion_por_linea_postura as select * from public.poblacion_por_linea_reparticion_postura;
create or replace view reparticion.poblacion_por_linea_muda as select * from public.poblacion_por_linea_reparticion_muda;
grant usage on schema reparticion to authenticated, anon;
grant select on all tables in schema reparticion to authenticated, anon;
