import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { FIELDS, formValues, validateForm, saveRecord, deleteRecord, fetchPage } from '../resumen-lotes-cod-std.js';

assert.equal(FIELDS.length, 42);
const valid = validateForm({ ...formValues(), LOTE: '24PC11', 'EDAD INIC PRODUC': '28,4', 'FECHA NAC': '2024-06-20', 'CANT REAL (HEMBRA)': '13000' });
assert.deepEqual(valid.errors, {});
assert.equal(valid.payload['EDAD INIC PRODUC'], '28.4');
assert.equal(valid.payload['CANT REAL (HEMBRA)'], 13000);
assert.equal(valid.payload.OBS, null);
assert.equal(Object.keys(validateForm({ LOTE: '', 'SEM NAC': '54', 'FECHA NAC': '2025-02-30', 'CANT REAL (MACHO)': '-1' }).errors).length, 4);

let rows = [{ crud_id: 'a', LOTE: 'DUP', LINEA: 'CRIOLLO', 'COD STD': 'F1' }, { crud_id: 'b', LOTE: 'DUP', LINEA: 'CRIOLLO', 'COD STD': 'F2' }];
let denied = false;
const calls = [];
const client = { schema() { return this; }, from() {
  let operation = 'select', payload, filters = [], orders = [], start = 0, end = Infinity, single = false;
  const query = {
    select() { return this; }, order(name, options) { orders.push([name, options]); return this; }, abortSignal() { return this; },
    eq(name, value) { filters.push([name, value]); return this; },
    or(value) { calls.push({ search: value }); return this; },
    range(a, b) { start = a; end = b; return this; },
    insert(value) { operation = 'insert'; payload = value; return this; },
    update(value) { operation = 'update'; payload = value; return this; },
    delete() { operation = 'delete'; return this; }, single() { single = true; return this; },
    then(resolve, reject) {
      calls.push({ operation, filters, orders, start, end });
      if (denied && operation !== 'select') return Promise.resolve({ error: { code: '42501' } }).then(resolve, reject);
      let selected = rows.filter(row => filters.every(([key, value]) => row[key] === value));
      if (operation === 'insert') { selected = [{ ...payload, crud_id: 'new' }]; rows.push(...selected); }
      if (operation === 'update') selected.forEach(row => Object.assign(row, payload));
      if (operation === 'delete') rows = rows.filter(row => !selected.includes(row));
      return Promise.resolve({ data: single ? selected[0] : selected.slice(start, end + 1), count: selected.length }).then(resolve, reject);
    },
  }; return query;
} };
await saveRecord(client, rows[1], { OBS: 'second only' });
assert.equal(rows[0].OBS, undefined); assert.equal(rows[1].OBS, 'second only');
assert.deepEqual(calls.at(-1).filters, [['crud_id', 'b']]);
assert.equal((await fetchPage(client, { linea: 'CRIOLLO', codigo: 'F1' }, 0)).count, 1);
await assert.rejects(deleteRecord(client, { LOTE: 'DUP' }), /identificador/);
await assert.rejects(saveRecord(client, { crud_id: 'missing' }, { OBS: 'none' }), /confirm/);

globalThis.__resumenTestClient = client;
const require = createRequire(import.meta.url);
const output = await build({
  stdin: { contents: "export { default } from './src/pages/granjas/ResumenLotesCodStd.jsx'; export { act, create } from 'react-test-renderer';", resolveDir: process.cwd() }, bundle: true, write: false,
  platform: 'node', format: 'cjs', loader: { '.css': 'empty' },
  plugins: [{ name: 'test-client', setup(build) {
    build.onResolve({ filter: /^react$/ }, () => ({ path: require.resolve('react'), external: true }));
    build.onResolve({ filter: /^react-test-renderer$/ }, () => ({ path: process.env.GRANJA_REACT_RENDERER_MODULE }));
    build.onResolve({ filter: /lib\/supabase$/ }, () => ({ path: 'client', namespace: 'mock' }));
    build.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const supabase = globalThis.__resumenTestClient;' }));
  } }],
});
const module = { exports: {} };
new Function('require', 'module', 'exports', output.outputFiles[0].text)(require, module, module.exports);
const React = require('react');
const { act, create } = module.exports;
let tree, changes = 0;
await act(async () => { tree = create(React.createElement(module.exports.default, { onChange: () => changes++ })); });
const button = text => tree.root.findAllByType('button').find(node => node.children.join('') === text);
await act(async () => tree.root.findByProps({ title: 'Ordenar por FECHA NAC' }).props.onClick());
assert.deepEqual(calls.at(-1).orders, [['FECHA NAC', { ascending: true, nullsFirst: false }], ['crud_id', undefined]]);
assert.equal(tree.root.findByProps({ title: 'Ordenar por FECHA NAC' }).parent.props['aria-sort'], 'ascending');
await act(async () => tree.root.findByProps({ title: 'Ordenar por FECHA NAC' }).props.onClick());
assert.equal(calls.at(-1).orders[0][1].ascending, false);
assert.equal(tree.root.findByProps({ title: 'Ordenar por FECHA NAC' }).parent.props['aria-sort'], 'descending');
await fetchPage(client, { linea: 'CRIOLLO', codigo: 'F1' }, 2, undefined, { column: 'CANT REAL (HEMBRA)', ascending: false });
assert.equal(calls.at(-1).start, 40);
assert.equal(calls.at(-1).orders[0][0], 'CANT REAL (HEMBRA)');
assert.deepEqual(calls.at(-1).filters, [['LINEA', 'CRIOLLO'], ['COD STD', 'F1']]);
await act(async () => button('Nuevo registro').props.onClick());
assert.equal(tree.root.findByType('form').findAllByType('input').length, 41);
await act(async () => tree.root.findByType('form').findAllByType('input')[0].props.onChange({ target: { value: '26PC21' } }));
await act(async () => tree.root.findByType('form').props.onSubmit({ preventDefault() {} }));
assert.equal(rows.at(-1).LOTE, '26PC21'); assert.equal(changes, 1);
await act(async () => tree.root.findAllByType('select')[1].props.onChange({ target: { value: 'F2' } }));
assert.equal(tree.root.findAllByType('tbody')[0].findAllByType('tr').length, 1);
await act(async () => tree.root.findByProps({ 'aria-label': 'Eliminar lote DUP' }).props.onClick());
await act(async () => button('Cancelar').props.onClick());
assert.equal(rows.length, 3);
await act(async () => tree.root.findByProps({ 'aria-label': 'Eliminar lote DUP' }).props.onClick());
denied = true;
await act(async () => button('Confirmar eliminación').props.onClick());
assert.equal(rows.length, 3); assert.equal(changes, 1);
assert.ok(JSON.stringify(tree.toJSON()).includes('no tiene permiso'));
denied = false;
await act(async () => button('Confirmar eliminación').props.onClick());
assert.equal(rows.length, 2); assert.ok(rows.some(row => row.crud_id === 'a')); assert.equal(changes, 2);
await act(async () => tree.unmount());

const { PGlite } = await import(pathToFileURL(process.env.CSV_PGLITE_MODULE));
const db = new PGlite();
await db.exec('create role authenticated; create table public."Resumen Lotes Cod STD" ("LOTE" text, "COD STD" text); insert into public."Resumen Lotes Cod STD" values (\'DUP\', \'F1\'), (\'DUP\', \'F2\');');
const sql = readFileSync(new URL('../sql/ampliar_resumen_lotes_cod_std.sql', import.meta.url), 'utf8');
await db.exec(sql); await db.exec(sql);
const schema = await db.query("select column_name from information_schema.columns where table_name = 'Resumen Lotes Cod STD'");
assert.equal(schema.rows.length, 43);
const ids = await db.query('select crud_id from public."Resumen Lotes Cod STD"');
assert.equal(new Set(ids.rows.map(row => row.crud_id)).size, 2);
await db.close();
console.log('OK: validación, filtros, CRUD con lotes repetidos, rechazo de permisos, formulario y SQL idempotente (43 columnas).');
