-- Asignaciones confirmadas por el usuario: 23 lotes. Incluye 26PN34.
-- Ejecutar completo en Supabase SQL Editor. No borra registros.
-- Actualiza solo ORIGEN, LINEA y COD STD; inserta los lotes que no existen.
-- Las demas columnas de los registros existentes se conservan.
begin;
create temporary table asignaciones_pavos ("LOTE" text, "ORIGEN" text, "LINEA" text, "COD STD" text) on commit drop;
insert into asignaciones_pavos values
  ('24PB19', 'IMPORTACION', 'BUT', 'BUT IMPORTADO'),
  ('24PB20', 'IMPORTACION', 'BUT', 'BUT IMPORTADO'),
  ('25PB21', 'IMPORTACION', 'BUT', 'BUT IMPORTADO'),
  ('25PB22', 'IMPORTACION', 'BUT', 'BUT IMPORTADO'),
  ('26PB23', 'IMPORTACION', 'BUT', 'BUT IMPORTADO'),
  ('26PB24', 'IMPORTACION', 'BUT', 'BUT IMPORTADO'),
  ('LSEM35.27', 'IMPORTACION', 'BUT', 'BUT IMPORTADO'),
  ('LSEM35.27 - 2', 'IMPORTACION', 'BUT', 'BUT IMPORTADO'),
  ('24PN26', 'LEVANTE', 'NICHOLAS', 'NICHOLAS F1'),
  ('24PN27', 'LEVANTE', 'NICHOLAS', 'NICHOLAS F1'),
  ('25PN28', 'LEVANTE', 'NICHOLAS', 'NICHOLAS F1'),
  ('25PN29', 'IMPORTACION', 'NICHOLAS', 'NICHOLAS IMPORTADO'),
  ('25PN30', 'LEVANTE', 'NICHOLAS', 'NICHOLAS F1'),
  ('25PN31', 'LEVANTE', 'NICHOLAS', 'NICHOLAS F1'),
  ('26PN32', 'LEVANTE', 'NICHOLAS', 'NICHOLAS F1'),
  ('26PN33', 'LEVANTE', 'NICHOLAS', 'NICHOLAS F1'),
  ('26PN34', 'IMPORTACION', 'NICHOLAS', 'NICHOLAS IMPORTADO'),
  ('LSEM40.26PN', 'LEVANTE', 'NICHOLAS', 'NICHOLAS F1'),
  ('LSEM42.26PN', 'LEVANTE', 'NICHOLAS', 'NICHOLAS F1'),
  ('LSEM28.27PN', 'LEVANTE', 'NICHOLAS', 'NICHOLAS F1'),
  ('LSEM32.27PN', 'LEVANTE', 'NICHOLAS', 'NICHOLAS F1'),
  ('LSEM35.27PN', 'LEVANTE', 'NICHOLAS', 'NICHOLAS F1'),
  ('LSEM37.27PN', 'LEVANTE', 'NICHOLAS', 'NICHOLAS F1');
lock table public."Resumen Lotes Cod STD" in share row exclusive mode;
update public."Resumen Lotes Cod STD" t
set "ORIGEN" = a."ORIGEN", "LINEA" = a."LINEA", "COD STD" = a."COD STD"
from asignaciones_pavos a
where regexp_replace(regexp_replace(upper(btrim(t."LOTE")), '[[:space:]]+', ' ', 'g'), '[[:space:]]*-[[:space:]]*', '-', 'g') = regexp_replace(regexp_replace(upper(btrim(a."LOTE")), '[[:space:]]+', ' ', 'g'), '[[:space:]]*-[[:space:]]*', '-', 'g');
insert into public."Resumen Lotes Cod STD" ("LOTE", "ORIGEN", "LINEA", "COD STD")
select a."LOTE", a."ORIGEN", a."LINEA", a."COD STD"
from asignaciones_pavos a
where not exists (select 1 from public."Resumen Lotes Cod STD" t where regexp_replace(regexp_replace(upper(btrim(t."LOTE")), '[[:space:]]+', ' ', 'g'), '[[:space:]]*-[[:space:]]*', '-', 'g') = regexp_replace(regexp_replace(upper(btrim(a."LOTE")), '[[:space:]]+', ' ', 'g'), '[[:space:]]*-[[:space:]]*', '-', 'g'));
select t."LOTE", t."ORIGEN", t."LINEA", t."COD STD"
from public."Resumen Lotes Cod STD" t
join asignaciones_pavos a on regexp_replace(regexp_replace(upper(btrim(t."LOTE")), '[[:space:]]+', ' ', 'g'), '[[:space:]]*-[[:space:]]*', '-', 'g') = regexp_replace(regexp_replace(upper(btrim(a."LOTE")), '[[:space:]]+', ' ', 'g'), '[[:space:]]*-[[:space:]]*', '-', 'g')
order by t."LINEA", t."LOTE";
commit;
