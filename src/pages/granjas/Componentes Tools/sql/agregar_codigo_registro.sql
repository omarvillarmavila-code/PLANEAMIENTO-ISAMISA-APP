-- Ejecutar una vez en el SQL Editor de Supabase.
-- Conserva el encabezado «Código de Registro» del reporte de granja.
-- Los registros anteriores quedan con NULL en esta nueva columna.
begin;

alter table public.registro_diario_granja
  add column if not exists "Codigo_Registro" text;

notify pgrst, 'reload schema';

commit;
