-- Ejecutar en el SQL Editor de Supabase después del SQL de estructura.
-- Autoriza el CRUD a todos los usuarios autenticados de la aplicación.
-- No cambia los registros ni crea copias.
begin;

alter table public."Resumen Lotes Cod STD" enable row level security;
grant select, insert, update, delete
  on public."Resumen Lotes Cod STD" to authenticated;

drop policy if exists resumen_lotes_crud_authenticated
  on public."Resumen Lotes Cod STD";
create policy resumen_lotes_crud_authenticated
  on public."Resumen Lotes Cod STD"
  for all
  to authenticated
  using (true)
  with check (true);

notify pgrst, 'reload schema';
commit;
