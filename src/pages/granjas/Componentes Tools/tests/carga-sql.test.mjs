import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const modulePath = process.env.CSV_PGLITE_MODULE;
const { PGlite } = await import(modulePath ? pathToFileURL(modulePath).href : '@electric-sql/pglite');
const db = new PGlite();
await db.exec(`
create role anon; create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated;
create table public.registro_diario_granja (
 id bigint generated always as identity primary key,
 "Fecha" date not null, "Unid_Prod" text not null,
 "Cod_Lote" text not null, "Sexo" text not null, "Etapa" text not null,
 "Saldo_Ini" bigint, "Mortal" text check ("Mortal"::numeric >= 0)
);
grant select,insert on public.registro_diario_granja to authenticated;
grant usage on all sequences in schema public to authenticated;
alter table public.registro_diario_granja enable row level security;
create policy test_farm on public.registro_diario_granja to authenticated
 using ("Unid_Prod"='LUMBRA') with check ("Unid_Prod"='LUMBRA');
`);
const setup = readFileSync(new URL('../sql/configurar_carga_csv_granja.sql', import.meta.url), 'utf8');
await db.exec(setup);
await db.exec(setup);
await db.exec("set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false)");
const rpc = async (name, args = []) => (await db.query(`select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) as result`, args)).rows[0].result;
const schema = await rpc('granja_csv_esquema');
assert.equal(schema.canInsert, true);
assert.equal(schema.columns.find(c => c.name === 'id').automatic, true);
const columns = ['Cod_Lote', 'Etapa', 'Fecha', 'Mortal', 'Saldo_Ini', 'Sexo', 'Unid_Prod'];
const row = (n, override = {}) => ({ Cod_Lote: 'L' + n, Etapa: 'POSTURA', Fecha: '2026-01-13', Mortal: '1', Saldo_Ini: '9223372036854775807', Sexo: 'HEMBRA', Unid_Prod: 'LUMBRA', ...override });
let hashIndex = 0;
const start = (total) => rpc('granja_csv_iniciar', [(++hashIndex).toString(16).padStart(64, '0'), 'ejemplo.csv', total, columns, schema.signature]);
const stage = (id, index, rows) => rpc('granja_csv_guardar_bloque', [id, index, JSON.stringify(rows)]);
const total = async () => Number((await db.query('select count(*) as n from public.registro_diario_granja')).rows[0].n);

const first = await start(251);
const block = Array.from({ length: 250 }, (_, i) => row(i));
await stage(first.id, 0, block);
assert.equal(await total(), 0, 'preparar bloques no modifica registros');
await assert.rejects(rpc('granja_csv_finalizar', [first.id]), /Faltan bloques/);
await stage(first.id, 0, block);
await assert.rejects(stage(first.id, 0, block.map((r, i) => i ? r : row(999))), /otros datos/);
await assert.rejects(stage(first.id, 1, [row(250, { Fecha: '2026-02-30' })]), /Registro 251/);
await assert.rejects(stage(first.id, 1, [row(250, { Saldo_Ini: '' })]), /Registro 251/);
await stage(first.id, 1, [row(250, { Saldo_Ini: null })]);
const resumed = await rpc('granja_csv_iniciar', [hashIndex.toString(16).padStart(64, '0'), 'renombrado.csv', 251, columns, schema.signature]);
assert.deepEqual(resumed.bloques, [0, 1]);
const finalized = await rpc('granja_csv_finalizar', [first.id]);
assert.equal(finalized.importadas, 251);
assert.equal(await total(), 251);
assert.equal((await rpc('granja_csv_finalizar', [first.id])).yaCompletada, true);
assert.equal(await total(), 251);
assert.equal((await db.query('select "Saldo_Ini"::text as saldo from registro_diario_granja where "Cod_Lote"=\'L0\'')).rows[0].saldo, '9223372036854775807');

const failing = await start(2);
await stage(failing.id, 0, [row(300), row(301, { Mortal: '-1' })]);
await assert.rejects(rpc('granja_csv_finalizar', [failing.id]), /check constraint/);
assert.equal(await total(), 251, 'una restriccion fallida revierte todas las filas de la carga');
const rls = await start(2);
await stage(rls.id, 0, [row(400), row(401, { Unid_Prod: 'OTRA' })]);
await assert.rejects(rpc('granja_csv_finalizar', [rls.id]), /row-level security/);
assert.equal(await total(), 251, 'la funcion no evita las politicas de la tabla');

await db.exec("select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false)");
await assert.rejects(rpc('granja_csv_finalizar', [first.id]), /no encontrada/);
assert.equal((await rpc('granja_csv_historial')).length, 0);
await db.exec('reset role; set role anon');
await assert.rejects(rpc('granja_csv_esquema'), /permission denied/);
await db.exec('reset role; revoke insert on registro_diario_granja from authenticated; set role authenticated');
assert.equal((await rpc('granja_csv_esquema')).canInsert, false);
await assert.rejects(start(1), /permiso/);
await db.exec('reset role; grant insert on registro_diario_granja to authenticated; set role authenticated');
await assert.rejects(rpc('granja_csv_iniciar', ['a'.repeat(64), 'a.csv', 1, columns, 'firma-obsoleta']), /estructura/);

// Volumen del caso real: 22500 filas, 90 bloques, una sola confirmacion.
const bulk = await start(22500);
for (let index = 0; index < 90; index++) await stage(bulk.id, index, Array.from({ length: 250 }, (_, i) => row(index * 250 + i + 1000)));
assert.equal(await total(), 251);
assert.equal((await rpc('granja_csv_finalizar', [bulk.id])).importadas, 22500);
assert.equal(await total(), 22751);
console.log('PASS SQL: instalación repetible; esquema real; validación bigint/fecha; bloques reanudables; confirmación idempotente; transacción completa ante CHECK/RLS; aislamiento entre usuarios; sin acceso anónimo; permisos de INSERT; firma de esquema; carga de 22500 registros.');
await db.close();
