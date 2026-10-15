-- Ejecutar antes de importar pesos_granja_asia.csv.
-- El archivo original trae fecha, semana_cal, lote y peso_gr.
-- No asignar una categoria sin confirmacion del usuario.
begin;
alter table public.pesos_granja_asia
  alter column tipo_produccion drop not null;
comment on column public.pesos_granja_asia.tipo_produccion is
  'ENGORDE o RECRIA cuando se confirme; NULL si la fuente no lo identifica. Trozado, empaque y vivo son destinos comerciales asignados por lote en vista_pesos_granja_asia.';
notify pgrst, 'reload schema';
commit;
