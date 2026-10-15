import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareCarabaylloRecords, buildCarabaylloWeek, carabaylloLotMetrics } from './datos-carabayllo.js';
const calendar = [{ fecha: '2026-10-09', ano: 2026, semana: 40 }, { fecha: '2026-10-10', ano: 2026, semana: 40 }];
const base = { Fecha: '09/10/2026', Unid_Prod: 'CARABAYLLO', Cod_Lote: 'C1', Etapa: 'RECRIA', Sexo: 'HEMBRA', Variedad: 'BLANCO', Linea_Madre: 'BUT', Galpon: '1', Saldo_Ini: '100', Saldo_Final: '99', Edad_sem: '2', Mortal: '1', Cons_Alim: '2', Tipo_Alim: 'A', Valido: 'Y' };
test('solo Carabayllo, calendario oficial y etapas propias sin campañas de Asia', () => {
  const data = prepareCarabaylloRecords([base, { ...base, Unid_Prod: 'ASIA' }, { ...base, Unid_Prod: 'TERCEROS - PAVOS' }], calendar);
  assert.equal(data.rows.length, 1);
  assert.equal(data.periods[0].week, '40');
  const result = buildCarabaylloWeek(data.rows, 2026, 40);
  assert.deepEqual(result.campaigns.map((r) => r.key), ['RECRIA']);
  assert.equal(result.campaigns[0].details[0].saldo, 99);
  assert.equal(result.campaigns[0].details[0].edad, 2);
  assert.equal(result.campaigns[0].lotMetrics[0].consumoEstandarDiario, null);
});
test('alimentos no duplican saldos, galpones suman, sexo/color separados', () => {
  const data = prepareCarabaylloRecords([base, { ...base, Tipo_Alim: 'B' },
    { ...base, Galpon: '2', Sexo: 'MACHO', Saldo_Final: '50', Saldo_Ini: '50', Mortal: '0' }], calendar);
  const result = buildCarabaylloWeek(data.rows, 2026, 40).campaigns[0];
  assert.equal(result.summary.hembras, 99);
  assert.equal(result.summary.machos, 50);
  assert.equal(result.details.length, 2);
  assert.equal(result.details.reduce((sum, r) => sum + r.saldo, 0), 149);
});
test('cambio de etapa no duplica población ni lote en mortalidad y consumo', () => {
  const data = prepareCarabaylloRecords([base, { ...base, Fecha: '10/10/2026', Etapa: 'ENGORDE', Saldo_Final: '98', Saldo_Ini: '99' }], calendar);
  const result = buildCarabaylloWeek(data.rows, 2026, 40);
  assert.equal(result.campaigns.flatMap((r) => r.population).length, 1);
  assert.equal(result.campaigns.find((r) => r.key === 'ENGORDE').summary.hembras, 98);
  const metrics = carabaylloLotMetrics(result.rows);
  assert.equal(metrics.length, 1);
  assert.equal(metrics[0].muertes, 2);
  assert.equal(metrics[0].consumoKg, 4);
  assert.equal(carabaylloLotMetrics(result.rows, 'ENGORDE')[0].consumoKg, 2);
});
test('ausencia de registros y datos incompletos quedan visibles sin valores ficticios', () => {
  assert.equal(buildCarabaylloWeek([], 2026, 40).campaigns.length, 0);
  const data = prepareCarabaylloRecords([{ ...base, Saldo_Final: '', Edad_sem: '' }], calendar);
  const detail = buildCarabaylloWeek(data.rows, 2026, 40).campaigns[0].details[0];
  assert.equal(detail.saldo, null);
  assert.equal(detail.edad, null);
});
