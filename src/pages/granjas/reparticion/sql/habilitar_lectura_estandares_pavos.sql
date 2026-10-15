-- Ejecutar en el SQL Editor de Supabase.
-- Autoriza solo SELECT a usuarios autenticados de la aplicación.
-- No concede acceso anónimo ni modifica registros ni políticas existentes.
begin;
grant select on public.estandares_pavos to authenticated;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'estandares_pavos'
      and policyname = 'estandares_pavos_select_authenticated'
  ) then
    create policy estandares_pavos_select_authenticated
      on public.estandares_pavos for select to authenticated using (true);
  end if;
end;
$$;
commit;

-- Identifica líneas que aún necesitan asignar un COD STD por lote.
select linea, array_agg(distinct codigo_estandar order by codigo_estandar) as codigos_disponibles
from public.estandares_pavos
group by linea
order by linea;
