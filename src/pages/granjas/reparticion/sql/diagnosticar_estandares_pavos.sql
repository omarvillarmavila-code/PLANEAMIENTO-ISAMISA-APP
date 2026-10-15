-- Solo lectura. Ejecutar en el SQL Editor del mismo proyecto Supabase.
-- Devuelve una sola fila que puede copiarse para revisar el cruce.
select jsonb_build_object(
  'cantidad_estandares', (select count(*) from public.estandares_pavos),
  'ejemplos_estandares', coalesce((
    select jsonb_agg(to_jsonb(s)) from (
      select codigo_estandar, linea, edad_sem, sexo, prod_hinc, prod_hcom,
             mort_sem, mort_acum, tipo_aabb, cons_aabb
      from public.estandares_pavos
      order by codigo_estandar, edad_sem, sexo
      limit 12
    ) s
  ), '[]'::jsonb),
  'asignaciones_pavos', coalesce((
    select jsonb_agg(to_jsonb(l)) from (
      select "LOTE", "LINEA", "COD STD"
      from public."Resumen Lotes Cod STD"
      where upper(trim(coalesce("LINEA", ''))) in ('BUT', 'NICHOLAS', 'BLANCO')
         or "LOTE" in ('24PB19', '24PB20', '26PN32')
      order by "LOTE"
      limit 30
    ) l
  ), '[]'::jsonb),
  'politicas_lectura', coalesce((
    select jsonb_agg(to_jsonb(p)) from (
      select tablename, policyname, roles, cmd, qual
      from pg_policies
      where schemaname = 'public'
        and tablename in ('estandares_pavos', 'Resumen Lotes Cod STD')
        and cmd in ('SELECT', 'ALL')
    ) p
  ), '[]'::jsonb)
) as diagnostico;
