import test from 'node:test';
import assert from 'node:assert/strict';
import { excludeKnownWeightErrors } from './validacion-pesos.js';
import { buildWeightDistributions } from './distribucion-pesos.js';
import { sampleStatistics } from './resumen-pesos.js';
const sample = (peso, changes = {}) => ({ lote: '26RN09', edad_pesaje_sem: 5, fecha: '2026-08-21', peso_gr: peso,
  clase: 'F', peso_minimo_gr: 1000, peso_maximo_gr: 7350, ...changes });
test('excluye solo mayores a 6000 del RN09 edad5; conserva el limite y otros lotes/edades', () => {
  const rows = [sample(6000), sample(6001), sample(7350), sample(7000, { edad_pesaje_sem: 6 }), sample(7000, { lote: 'OTRO' })];
  assert.deepEqual(excludeKnownWeightErrors(rows).map((r) => r.peso_gr), [6000, 7000, 7000]);
  assert.equal(rows.length, 5);
});
test('recalcula limites, clases, frecuencias y descriptiva con los pesos restantes', () => {
  const valid = excludeKnownWeightErrors([sample(1000), sample(2000), sample(7350)]);
  const [chart] = buildWeightDistributions(valid);
  assert.equal(chart.total, 2);
  assert.equal(chart.bins[0].min, 1000);
  assert.equal(chart.bins[5].max, 2000);
  assert.equal(chart.bins[0].aves, 1);
  assert.equal(chart.bins[5].aves, 1);
  assert.equal(chart.bins[0].frecuencia, 50);
  assert.equal(sampleStatistics(valid.map((r) => r.peso_gr)).mean, 1500);
});
