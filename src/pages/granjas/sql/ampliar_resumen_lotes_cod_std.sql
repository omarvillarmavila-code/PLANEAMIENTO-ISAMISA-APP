-- Ejecutar completo en el SQL Editor de Supabase.
-- Agrega columnas faltantes; no genera copias ni borra datos.
-- Las columnas existentes conservan su tipo y sus dependencias.
begin;

alter table public."Resumen Lotes Cod STD"
  add column if not exists "LOTE" text,
  add column if not exists "ORIGEN" text,
  add column if not exists "LINEA" text,
  add column if not exists "COD STD" text,
  add column if not exists "MOTIVO" text,
  add column if not exists "AREA SOLICITANTE" text,
  add column if not exists "DIA DE CARGA" text,
  add column if not exists "FECHA CARGA" date,
  add column if not exists "SEM CARGA" integer,
  add column if not exists "AÑO CARGA" integer,
  add column if not exists "DIA NAC" text,
  add column if not exists "FECHA NAC" date,
  add column if not exists "SEM NAC" integer,
  add column if not exists "AÑO NAC" integer,
  add column if not exists "P. PROM HI" text,
  add column if not exists "CANT PROY (HEMBRA)" integer,
  add column if not exists "CANT REAL (HEMBRA)" integer,
  add column if not exists "CANT PROY (MACHO)" integer,
  add column if not exists "CANT REAL (MACHO)" integer,
  add column if not exists "DIA PROD" text,
  add column if not exists "EDAD INIC PRODUC" numeric,
  add column if not exists "FECHA INIC PRODUC" date,
  add column if not exists "SEM INIC PRODUC" integer,
  add column if not exists "AÑO INIC PRODUC" integer,
  add column if not exists "DIA MUDA" text,
  add column if not exists "EDAD INIC MUDA" numeric,
  add column if not exists "FECHA INIC MUDA" date,
  add column if not exists "SEM INIC MUDA" integer,
  add column if not exists "AÑO INIC MUDA" integer,
  add column if not exists "EDAD FIN MUDA" numeric,
  add column if not exists "FECHA FIN MUDA" date,
  add column if not exists "SEM FIN MUDA" integer,
  add column if not exists "AÑO FIN MUDA" integer,
  add column if not exists "DIA LIQ" text,
  add column if not exists "EDAD LIQUID" numeric,
  add column if not exists "FECHA LIQUID" date,
  add column if not exists "SEM LIQUID" integer,
  add column if not exists "AÑO LIQUID" integer,
  add column if not exists "GALPON POLLO BB" text,
  add column if not exists "GALPON ADULTO" text,
  add column if not exists "GALPON ADULTO 2" text,
  add column if not exists "OBS" text;

-- Identificador interno: permite editar un registro aunque se repita el lote.
alter table public."Resumen Lotes Cod STD"
  add column if not exists crud_id uuid not null default gen_random_uuid();
create unique index if not exists resumen_lotes_cod_std_crud_id_key
  on public."Resumen Lotes Cod STD" (crud_id);

-- Conserva las políticas RLS existentes y sus restricciones por usuario.
grant select, insert, update, delete on public."Resumen Lotes Cod STD" to authenticated;

notify pgrst, 'reload schema';
commit;
