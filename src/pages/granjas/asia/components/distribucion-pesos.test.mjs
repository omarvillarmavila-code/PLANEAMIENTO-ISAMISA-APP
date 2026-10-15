import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWeightDistributions, withDailyIdentity } from './distribucion-pesos.js';
test('el diario no reemplaza la edad calculada del pesaje', () => {
  const chart = { lote: '26RB14', fecha: '2026-10-10', edad: 11 };
  const daily = { Cod_Lote: '26RB14', Fecha: chart.fecha, ano: 2026, semana: 40, Edad_sem: '12' };
  assert.equal(withDailyIdentity([chart], [daily], 2026, 40)[0].edad, 11);
  assert.equal(withDailyIdentity([chart], [], 2026, 40)[0].edad, 11);
});
test('sexo y color provienen del diario, con fecha exacta y sin mezclar lotes o semanas', () => {
  const chart = { lote: '26RB14', fecha: '2026-10-10', sexo: 'INCORRECTO', color: 'INCORRECTO' };
  const daily = { Cod_Lote: '26RB14', Fecha: '2026-10-10', ano: 2026, semana: 40, Sexo: 'MACHO', Variedad: 'BLANCO', Valido: 'Y' };
  const [result] = withDailyIdentity([chart], [daily, { ...daily, Fecha: '2026-10-09', Sexo: 'HEMBRA' }, { ...daily, semana: 39, Variedad: 'NEGRO' }], '2026', '40');
  assert.equal(result.sexo, 'MACHO');
  assert.equal(result.color, 'BLANCO');
  const [missing] = withDailyIdentity([chart], [{ ...daily, Cod_Lote: 'OTRO' }], 2026, 40);
  assert.equal(missing.sexo, null);
  assert.equal(missing.color, null);
});
test('sin fecha exacta usa identidad semanal y expone todos los sexos presentes', () => {
  const daily = { Cod_Lote: '26RB14', Fecha: '2026-10-09', ano: 2026, semana: 40, Sexo: 'MACHO', Variedad: 'BLANCO' };
  const [result] = withDailyIdentity([{ lote: '26RB14', fecha: '2026-10-10' }], [daily, { ...daily, Sexo: 'HEMBRA' }], 2026, 40);
  assert.equal(result.sexo, 'HEMBRA / MACHO');
  assert.equal(result.color, 'BLANCO');
});
const row = (overrides = {}) => ({ fecha: '2026-10-10', lote: '26RB14', tipo_produccion: 'ENGORDE',
  peso_minimo_gr: '100', peso_maximo_gr: '700', clase: 'A', edad_semana: 14,
  color: 'BLANCO', sexo: 'MACHO', saldo_inicial: '1000', estado_cruce: 'OK', ...overrides });
test('seis clases, límites exactos, frecuencia de muestra y saldo no multiplicado', () => {
  const [result] = buildWeightDistributions([row(), row(), row({ clase: 'F' })]);
  assert.equal(result.bins.length, 6);
  assert.equal(result.bins[0].aves, 2);
  assert.ok(Math.abs(result.bins[0].frecuencia - 200 / 3) < 1e-10);
  assert.equal(result.bins[1].aves, 0);
  assert.equal(result.bins[5].max, 700);
  assert.equal(result.saldo, '1000');
  assert.equal(result.total, 3);
});
test('no mezcla fechas, lotes ni categorías; no elimina pesajes iguales', () => {
  const result = buildWeightDistributions([row(), row(), row({ fecha: '2026-10-11' }),
    row({ lote: '26RB18' }), row({ tipo_produccion: 'RECRIA' })]);
  assert.equal(result.length, 4);
  assert.equal(result.find((r) => r.fecha === '2026-10-10' && r.lote === '26RB14' && r.tipo === 'ENGORDE').total, 2);
});
test('preserva datos faltantes y admite pesos iguales', () => {
  const [result] = buildWeightDistributions([row({ peso_maximo_gr: 100, sexo: null, saldo_inicial: null, estado_cruce: 'SIN REGISTRO' })]);
  assert.equal(result.bins[5].min, 100);
  assert.equal(result.sexo, null);
  assert.equal(result.saldo, null);
  assert.equal(result.incomplete, true);
});
