import test from 'node:test';
import assert from 'node:assert/strict';
import { filterDailyIdentity, filterWeightIdentity } from './filtros-lote.js';
const daily = { Cod_Lote: 'L1', Fecha: '2026-10-09', ano: 2026, semana: 40, Sexo: 'MACHO', Variedad: 'BLANCO', Valido: 'Y' };
const weight = { lote: 'L1', fecha: '2026-10-09', semana_cal: 40 };
test('filtros independientes, combinados y opcion todos', () => {
  const rows = [daily, { ...daily, Sexo: 'HEMBRA' }, { ...daily, Variedad: 'NEGRO' }];
  assert.equal(filterDailyIdentity(rows).length, 3);
  assert.equal(filterDailyIdentity(rows, 'MACHO').length, 2);
  assert.equal(filterDailyIdentity(rows, '', 'BLANCO').length, 2);
  assert.equal(filterDailyIdentity(rows, 'MACHO', 'BLANCO').length, 1);
  assert.equal(filterWeightIdentity([weight], [daily], 'MACHO', 'BLANCO').length, 1);
  assert.equal(filterWeightIdentity([weight], [daily], 'HEMBRA').length, 0);
});
test('no atribuye pesajes sin sexo individual a un sexo de lote mixto ni usa otro lote', () => {
  const mixed = [daily, { ...daily, Sexo: 'HEMBRA' }];
  assert.equal(filterWeightIdentity([weight], mixed, 'MACHO').length, 0);
  assert.equal(filterWeightIdentity([weight], mixed, '', 'BLANCO').length, 1);
  assert.equal(filterWeightIdentity([weight], [{ ...daily, Cod_Lote: 'L2' }], 'MACHO').length, 0);
  assert.equal(filterWeightIdentity([weight], mixed).length, 1);
});
test('prefiere fecha exacta, permite identidad semanal consistente y excluye otra semana', () => {
  assert.equal(filterWeightIdentity([weight], [daily, { ...daily, Fecha: '2026-10-08', Sexo: 'HEMBRA' }], 'MACHO').length, 1);
  assert.equal(filterWeightIdentity([weight], [{ ...daily, Fecha: '2026-10-08' }], 'MACHO').length, 1);
  assert.equal(filterWeightIdentity([weight], [{ ...daily, Fecha: '2026-10-08', semana: 39 }], 'MACHO').length, 0);
});
