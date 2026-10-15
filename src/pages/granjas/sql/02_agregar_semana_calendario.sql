-- Agrega año y semana oficiales del calendario a las vistas de consulta.
-- Ejecutar después de 01_mover_vistas_a_schemas.sql.

alter view lumbra.poblacion_por_linea_levante rename to poblacion_por_linea_levante_base;
alter view lumbra.poblacion_por_linea_postura rename to poblacion_por_linea_postura_base;
alter view lumbra.poblacion_por_linea_muda rename to poblacion_por_linea_muda_base;

create view lumbra.poblacion_por_linea_levante as
select c.ano, c.semana, v.* from lumbra.poblacion_por_linea_levante_base v
left join public.calendario c on c.fecha = v.fecha;
create view lumbra.poblacion_por_linea_postura as
select c.ano, c.semana, v.* from lumbra.poblacion_por_linea_postura_base v
left join public.calendario c on c.fecha = v.fecha;
create view lumbra.poblacion_por_linea_muda as
select c.ano, c.semana, v.* from lumbra.poblacion_por_linea_muda_base v
left join public.calendario c on c.fecha = v.fecha;

grant select on lumbra.poblacion_por_linea_levante, lumbra.poblacion_por_linea_postura, lumbra.poblacion_por_linea_muda to anon, authenticated;
notify pgrst, 'reload schema';
