import test from 'node:test';
import assert from 'node:assert/strict';
import { allPages, sharedQuery, queryMessage } from '../components/consulta-granja.js';

test('hembras y machos comparten la petición en curso, sin cachear resultados', async () => {
  let calls = 0;
  let resolve;
  const load = () => { calls++; return new Promise((done) => { resolve = done; }); };
  const first = sharedQuery('same', load);
  const second = sharedQuery('same', load);
  assert.equal(first, second);
  await Promise.resolve();
  resolve([1]);
  assert.deepEqual(await second, [1]);
  assert.equal(calls, 1);
  assert.deepEqual(await sharedQuery('same', async () => [2]), [2]);
});

test('un timeout cancela la petición y permite reintentar sin quedar cargando', async () => {
  let signal;
  await assert.rejects(sharedQuery('timeout', (value) => {
    signal = value;
    return new Promise(() => {});
  }, 10), { code: 'CLIENT_TIMEOUT' });
  assert.equal(signal.aborted, true);
  assert.deepEqual(await sharedQuery('timeout', async () => [3]), [3]);
});

test('errores de Supabase se propagan y una consulta fallida no se conserva', async () => {
  await assert.rejects(sharedQuery('error', async () => { throw { code: '57014' }; }), { code: '57014' });
  assert.match(queryMessage({ code: '57014' }), /Supabase.*tiempo de espera/);
  assert.deepEqual(await sharedQuery('error', async () => []), []);
});

test('carga todas las páginas y rechaza resultados parciales si falla una página', async () => {
  const source = Array.from({ length: 1201 }, (_, id) => ({ id }));
  const ranges = [];
  const makeQuery = () => ({ range(start, end) {
    ranges.push([start, end]);
    return { abortSignal: async () => ({ data: source.slice(start, end + 1), error: null }) };
  } });
  assert.deepEqual(await allPages(makeQuery, new AbortController().signal), source);
  assert.deepEqual(ranges, [[0, 499], [500, 999], [1000, 1499]]);
  await assert.rejects(allPages(() => ({ range(start) {
    return { abortSignal: async () => start ? { error: { code: '57014' } } : { data: source.slice(0, 500) } };
  } }), new AbortController().signal), { code: '57014' });
});
