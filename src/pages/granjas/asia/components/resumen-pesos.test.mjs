import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleStatistics, buildLotHistory, lotChartSeries } from './resumen-pesos.js';
test('historial completo sin corte conserva todas las edades independientemente de la distribucion seleccionada', () => {
  const weights = [
    { lote: 'L1', fecha: '2026-10-01', edad_pesaje_sem: 1, peso_gr: 100 },
    { lote: 'L1', fecha: '2026-10-08', edad_pesaje_sem: 2, peso_gr: 200 },
  ];
  const result = buildLotHistory('L1', undefined, weights, []);
  assert.deepEqual(result.filter((r) => r.sample).map((r) => r.age), [1, 2]);
  assert.equal(result[1].sample.mean, 200);
});
test('venta semanal usa transferencias de salida solo si no hubo ventas', () => {
  const base = { Cod_Lote: 'L1', Fecha: '2026-10-01', Edad_sem: '12', Venta_unid: '', Transf_Sal: '1,000', Valido: 'Y' };
  const sale = (rows) => buildLotHistory('L1', base.Fecha, [], rows).find((r) => r.age === 12).sales;
  assert.equal(sale([base, { ...base, Fecha: '2026-10-02', Venta_unid: '0', Transf_Sal: '200' }]), 1200);
  assert.equal(sale([base, { ...base, Fecha: '2026-10-02', Venta_unid: '50', Transf_Sal: '200' }]), 50);
  assert.equal(sale([base, { ...base, Valido: 'N', Transf_Sal: '9,000' }]), 1000);
  assert.equal(sale([{ ...base, Transf_Sal: '' }]), 0);
  assert.equal(sale([{ ...base, Venta_unid: 'dato invalido' }]), null);
  assert.equal(sale([base, { ...base, Edad_sem: '13', Venta_unid: '50' }]), 1000);
});
test('edad cero usa existencia de semana1 y su saldo inicial mas antiguo', () => {
  const daily = [{ Cod_Lote: 'L1', Fecha: '2026-10-01', Edad_sem: '1', Saldo_Ini: '200', Mortal: '0', Cons_Alim: '1', Valido: 'Y' },
    { Cod_Lote: 'L1', Fecha: '2026-10-02', Edad_sem: '1', Saldo_Ini: '190', Mortal: '0', Cons_Alim: '1', Valido: 'Y' }];
  const weights = [100, 110].map((peso_gr) => ({ lote: 'L1', fecha: '2026-10-01', edad_pesaje_sem: 0, peso_gr }));
  const age = buildLotHistory('L1', '2026-10-01', weights, daily).find((r) => r.age === 0);
  assert.equal(age.sampleExistence, 200);
  assert.equal(age.samplePct, 1);
});
test('existencia descriptiva usa saldo inicial mas antiguo de la misma edad y actualiza porcentaje muestra', () => {
  const base = { Cod_Lote: 'L1', Fecha: '2026-10-01', Edad_sem: '5', Saldo_Ini: '200', Saldo_Final: '195', Mortal: '5', Cons_Alim: '10', Valido: 'Y', Tipo_Alim: 'A' };
  const daily = [base, { ...base, Tipo_Alim: 'B' }, { ...base, Fecha: '2026-10-03', Saldo_Ini: '190' },
    { ...base, Fecha: '2026-09-30', Edad_sem: '4', Saldo_Ini: '300' }];
  const weights = [1000, 1100].map((peso_gr) => ({ lote: 'L1', fecha: '2026-10-03', edad_pesaje_sem: 5, peso_gr }));
  const age = buildLotHistory('L1', '2026-10-03', weights, daily).find((r) => r.age === 5);
  assert.equal(age.sampleExistence, 200);
  assert.equal(age.sampleExistence, age.existence);
  assert.equal(age.samplePct, 1);
});
test('CA=max consumo acumulado / max peso del registro diario dentro de la misma edad', () => {
  const base = { Cod_Lote: 'L1', Fecha: '2026-10-01', Edad_sem: '12', Peso_Ave: '9,000', Cons_Alim_Ave_Acu: '12,000', Valido: 'Y' };
  const result = buildLotHistory('L1', '2026-10-01', [], [base,
    { ...base, Fecha: '2026-10-02', Peso_Ave: '8,000', Cons_Alim_Ave_Acu: '18,000' },
    { ...base, Fecha: '2026-10-03', Peso_Ave: '', Cons_Alim_Ave_Acu: '' },
    { ...base, Valido: 'N', Peso_Ave: '99,000', Cons_Alim_Ave_Acu: '99,000' },
    { ...base, Edad_sem: '13', Peso_Ave: '20,000', Cons_Alim_Ave_Acu: '60,000' }]);
  const row = result.find((r) => r.age === 12);
  assert.equal(row.dailyWeight, 9000);
  assert.equal(row.maximumCumulative, 18000);
  assert.equal(row.ca, 2);
  assert.equal(result.find((r) => r.age === 13).ca, 3);
  assert.equal(buildLotHistory('L1', base.Fecha, [], [{ ...base, Peso_Ave: '0' }])[0].ca, null);
});
test('RN09 conserva peso registrado en edad12 aunque sea posterior al último pesaje individual', () => {
  const daily = [{ Cod_Lote: '26RN09', Fecha: '2026-10-03', Edad_sem: '12', Peso_Ave: '', Saldo_Ini: '371', Mortal: '0', Cons_Alim: '10', Valido: 'Y' },
    { Cod_Lote: '26RN09', Fecha: '2026-10-08', Edad_sem: '12', Peso_Ave: '8,960', Saldo_Ini: '371', Mortal: '0', Cons_Alim: '20', Valido: 'Y' }];
  const weights = [{ lote: '26RN09', fecha: '2026-10-03', peso_gr: 6400, edad_pesaje_sem: 11 }];
  const result = buildLotHistory('26RN09', '2026-10-03', weights, daily);
  assert.equal(result.find((r) => r.age === 12).dailyWeight, 8960);
  assert.equal(result.find((r) => r.age === 12).foodKg, 30);
  assert.equal(result.find((r) => r.age === 11).sample.mean, 6400);
  assert.equal(result.find((r) => r.age === 12).sample, null);
});
test('series por edad: diferencias reales, alimentos separados y sin inventar incrementos', () => {
  const { rows, foods } = lotChartSeries([
    { age: 1, weight: 170, standardWeight: 160, foodKg: 10, standardFoodKg: 12, foodDetails: [{ alimento: 'A', kg: 10 }] },
    { age: 2, weight: 350, standardWeight: 360, foodKg: 20, standardFoodKg: 18, foodDetails: [{ alimento: 'B', kg: 20 }] },
    { age: 4, weight: 800, standardWeight: null, foodKg: null, standardFoodKg: null, foodDetails: [] },
  ]);
  assert.equal(rows[0].weightGain, null);
  assert.equal(rows[1].weightGain, 180);
  assert.equal(rows[2].weightGain, null);
  assert.equal(rows[0].foodDifference, -2);
  assert.equal(rows[1].weightDifference, -10);
  assert.equal(rows[2].weightDifference, null);
  assert.deepEqual(foods.map((f) => f.name), ['A', 'B']);
  assert.equal(rows[0].food_0, 10);
  assert.equal(rows[0].food_1, 0);
  assert.equal(rows[2].food_0, null);
});
test('estadística muestral, mediana par, CV y uniformidad del ejemplo', () => {
  const result = sampleStatistics([100, 200, 300]);
  assert.equal(result.mean, 200);
  assert.equal(result.median, 200);
  assert.equal(result.sd, 100);
  assert.equal(result.cv, 50);
  assert.equal(result.uniformity, 50);
  assert.equal(sampleStatistics([100, 200]).median, 150);
  assert.equal(sampleStatistics([100]).sd, null);
  assert.equal(sampleStatistics([]), null);
});
test('historial por edad, último pesaje semanal, corte temporal y estándares Asia', () => {
  const daily = { Fecha: '2026-10-01', Cod_Lote: 'L1', Edad_sem: '1', Saldo_Ini: '100', Mortal: '1', Venta_unid: '2',
    Cons_Alim: '2.2', Peso_Ave: '999', Cons_Alim_Ave_Acu: '154', Tipo_Alim: 'A', Sexo: 'MACHO', Variedad: 'BLANCO', Linea_Madre: 'BUT', Valido: 'Y' };
  const weights = [{ fecha: daily.Fecha, lote: 'L1', peso_gr: 160, edad_pesaje_sem: 1 }, { fecha: daily.Fecha, lote: 'L1', peso_gr: 180, edad_pesaje_sem: 1 },
    { fecha: '2026-10-02', lote: 'L1', peso_gr: 999, edad_semana: 1 }, { fecha: daily.Fecha, lote: 'OTRO', peso_gr: 999 }];
  const [result] = buildLotHistory('L1', daily.Fecha, weights, [daily, { ...daily, Fecha: '2026-10-02', Edad_sem: '2' }]);
  assert.equal(result.age, 1);
  assert.equal(result.sample.mean, 170);
  assert.equal(result.weight, 170, 'El peso real siempre viene de los pesajes, nunca de Peso_Ave diario');
  assert.equal(result.dailyWeight, 999, 'Peso ave de saldos y consumos conserva Peso_Ave del registro diario');
  assert.equal(result.sample.n, 2);
  assert.equal(result.existence, 100);
  assert.equal(result.samplePct, 2);
  assert.equal(result.mortality, 1);
  assert.equal(result.sales, 2);
  assert.equal(result.standardWeight, 170);
  assert.equal(result.standardConsumption, 22);
  assert.ok(Math.abs(result.standardFoodKg - 2.2) < 1e-10);
  assert.ok(Math.abs(result.ca - 154 / 999) < 1e-10, 'CA usa el peso del registro diario, no el promedio de las muestras');
});
