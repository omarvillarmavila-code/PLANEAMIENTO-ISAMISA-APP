import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ASIA_STANDARDS } from './estandares-asia-datos.js';
import { lotConsumptionStandard } from './estandares-asia.js';
const row = (extra = {}) => ({ Fecha: '2026-10-04', Cod_Lote: '26RB08', Linea_Madre: 'BUT',
  Variedad: 'BLANCO', Sexo: 'HEMBRA', Edad_sem: '10', Galpon: '1', Etapa: 'ENGORDE', Valido: 'Y', Saldo_Ini: '100', ...extra });
test('conserva las 90 filas y pesos MIXTO vacíos del archivo original', () => {
  assert.equal(ASIA_STANDARDS.length, 90);
  assert.equal(new Set(ASIA_STANDARDS.map((r) => [r.color,r.variedad,r.sexo,r.edad_sem].join('|'))).size, 90);
  assert.equal(ASIA_STANDARDS.filter((r) => r.sexo === 'MIXTO' && r.peso_gr === null).length, 18);
  assert.equal(ASIA_STANDARDS.find((r) => r.sexo === 'MIXTO' && r.edad_sem === 18).consumo_g_ave_semana, '1507');
});
test('compara consumo del lote ponderando la población de cada sexo, no sus promedios', () => {
  // Consumo ponderado por el saldo de cada sexo.
  const female = Number(ASIA_STANDARDS.find((r) => r.variedad === 'BUT' && r.sexo === 'HEMBRA' && r.edad_sem === 10).consumo_g_ave_dia);
  const male = Number(ASIA_STANDARDS.find((r) => r.variedad === 'BUT' && r.sexo === 'MACHO' && r.edad_sem === 10).consumo_g_ave_dia);
  const result = lotConsumptionStandard([row(), row({ Sexo: 'MACHO', Saldo_Ini: '10' })]);
  assert.equal(result.consumoEstandarDiario, (female * 100 + male * 10) / 110);
  assert.equal(result.consumoEstandarKg, (female * 100 + male * 10) / 1000);
});
test('respeta cambios diarios de edad y no duplica saldos por alimento', () => {
  const result = lotConsumptionStandard([row(), row({ Tipo_Alim: 'B' }), row({ Fecha: '2026-10-05', Edad_sem: '11', Saldo_Ini: '90' })]);
  assert.equal(result.consumoEstandarDiario, (298 * 100 + 329 * 90) / 190);
});
test('no extrapola edades ni usa colores o sexos distintos; MIXTO tiene su propia fila', () => {
  assert.equal(lotConsumptionStandard([row({ Edad_sem: '19' })]).consumoEstandarDiario, null);
  assert.equal(lotConsumptionStandard([row({ Variedad: 'OTRO' })]).consumoEstandarDiario, null);
  assert.equal(lotConsumptionStandard([row({ Sexo: 'MIXTO' })]).consumoEstandarDiario, 338);
  assert.equal(lotConsumptionStandard([row({ Variedad: 'NEGRO', Linea_Madre: 'NICHOLAS', Sexo: 'MACHO', Edad_sem: '1' })]).consumoEstandarDiario, 23);
});
