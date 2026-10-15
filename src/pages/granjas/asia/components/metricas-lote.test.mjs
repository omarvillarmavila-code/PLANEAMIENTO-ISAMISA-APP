import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAsiaLotMetrics } from './metricas-lote.js';
const row = (extra = {}) => ({ Fecha: '2026-10-04', Cod_Lote: '26RB08', Linea_Madre: 'BUT',
  Galpon: '1', Etapa: 'ENGORDE', Variedad: 'BLANCO', Sexo: 'HEMBRA', Valido: 'Y',
  Saldo_Ini: '100', Mortal: '1', Cons_Alim: '10', Tipo_Alim: 'A', Edad_sem: '10', ...extra });
test('unifica los sexos por lote sin sumar sus porcentajes ni sus promedios diarios', () => {
  const result = buildAsiaLotMetrics([row(), row({ Sexo: 'MACHO', Saldo_Ini: '10', Cons_Alim: '2' })]);
  assert.equal(result.length, 1);
  assert.equal(result[0].saldoInicial, 110);
  assert.equal(result[0].muertes, 2);
  assert.equal(result[0].mortalidad, 2 * 100 / 110);
  assert.equal(result[0].consumoKg, 12);
  assert.equal(result[0].consumoDiario, 12000 / 110);
});
test('semanas parciales y cambios de población usan los saldos de cada día', () => {
  const result = buildAsiaLotMetrics([row(), row({ Sexo: 'MACHO', Saldo_Ini: '10', Cons_Alim: '2' }),
    row({ Fecha: '2026-10-05', Saldo_Ini: '90', Cons_Alim: '9', Mortal: '2' }),
    row({ Fecha: '2026-10-05', Sexo: 'MACHO', Saldo_Ini: '10', Cons_Alim: '2', Mortal: '0' })])[0];
  assert.equal(result.dias, 2);
  assert.equal(result.birdDays, 210);
  assert.equal(result.consumoDiario, 23000 / 210);
  assert.equal(result.mortalidad, 400 / 110);
});
test('alimentos y copias no multiplican el saldo y N aporta solo alimento', () => {
  const result = buildAsiaLotMetrics([row({ id: 1 }), row({ id: 2 }),
    row({ Tipo_Alim: 'B', Cons_Alim: '5', Mortal: '0' }),
    row({ Valido: 'N', Tipo_Alim: 'C', Saldo_Ini: null, Cons_Alim: '3', Mortal: '99' })])[0];
  assert.equal(result.saldoInicial, 100);
  assert.equal(result.muertes, 1);
  assert.equal(result.consumoKg, 18);
  assert.equal(result.birdDays, 100);
});
test('no separa un lote por línea; conserva lotes distintos y datos ausentes', () => {
  const results = buildAsiaLotMetrics([row(), row({ Linea_Madre: 'NICHOLAS', Galpon: '2', Saldo_Ini: '50', Cons_Alim: '5' }),
    row({ Cod_Lote: '26RB14', Saldo_Ini: null, Cons_Alim: null })]);
  assert.equal(results.length, 2);
  assert.equal(results[0].saldoInicial, 150);
  assert.equal(results[1].mortalidad, null);
  assert.equal(results[1].consumoKg, null);
  assert.equal(results[1].consumoDiario, null);
});
