import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const { PGlite } = await import(pathToFileURL(process.env.CSV_PGLITE_MODULE));
const db = new PGlite();
try {
  await db.exec(`
    create role authenticated;
    create role anon;
    create table public."Resumen Lotes Cod STD" ("LOTE" text);
    insert into public."Resumen Lotes Cod STD" select 'LOTE-' || n from generate_series(1, 82) n;
    alter table public."Resumen Lotes Cod STD" enable row level security;
    grant select on public."Resumen Lotes Cod STD" to authenticated, anon;
    set role authenticated;
  `);
  const count = async () => Number((await db.query('select count(*) as total from public."Resumen Lotes Cod STD"')).rows[0].total);
  assert.equal(await count(), 0, 'Sin políticas RLS no hay filas visibles');
  await db.exec('reset role');
  const sql = readFileSync(new URL('../sql/habilitar_crud_resumen_lotes_cod_std.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  await db.exec(sql);
  await db.exec('set role authenticated');
  assert.equal(await count(), 82);
  await db.exec(`insert into public."Resumen Lotes Cod STD" values ('PRUEBA');
    update public."Resumen Lotes Cod STD" set "LOTE" = 'EDITADO' where "LOTE" = 'PRUEBA';`);
  assert.equal((await db.query(`delete from public."Resumen Lotes Cod STD" where "LOTE" = 'EDITADO' returning "LOTE"`)).rows.length, 1);
  assert.equal(await count(), 82);
  await db.exec('reset role; set role anon');
  assert.equal(await count(), 0, 'La política no habilita lectura anónima');
  console.log('OK: 82 filas visibles para authenticated; CRUD permitido; anon sin filas; SQL repetible.');
} finally { await db.close(); }
