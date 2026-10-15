import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildConsumptionChart, foodColor, standardFoodColor, consumptionBarRadius } from '../components/01.Datos_generales/consumo-por-lote.js';

test('redondea el extremo exterior sin huecos entre alimentos ni depender de series vacías', () => {
  const series = ['a', 'b', 'c'].map((key) => ({ key }));
  assert.deepEqual(consumptionBarRadius({ a: 10, b: 20, c: 0 }, series, 'a'), [0, 0, 0, 0]);
  assert.deepEqual(consumptionBarRadius({ a: 10, b: 20, c: 0 }, series, 'b'), [3, 3, 0, 0]);
  assert.deepEqual(consumptionBarRadius({ a: 10, b: null, c: 0 }, series, 'a'), [3, 3, 0, 0]);
  assert.deepEqual(consumptionBarRadius({ a: -10, b: 20, c: -5 }, series, 'a'), [0, 0, 0, 0]);
  assert.deepEqual(consumptionBarRadius({ a: -10, b: 20, c: -5 }, series, 'b'), [3, 3, 0, 0]);
  assert.deepEqual(consumptionBarRadius({ a: -10, b: 20, c: -5 }, series, 'c'), [0, 0, 3, 3]);
});

test('separa alimentos y sexos; muestra el saldo inicial y los kg estándar calculados por SQL', () => {
  const row = {
    linea: 'CRIOLLO', lote: 'L1', edad_lote: '30', cod_std: 'STD',
    saldo_final_hembras: '1000', saldo_final_machos: '100',
    saldo_inicial_hembra: '1100', saldo_inicial_macho: '105',
    alimentos_hembra: [{ alimento: 'A.1', kg: 20 }, { alimento: 'B[2]', kg: 40 }],
    alimentos_macho: [{ alimento: 'C', kg: 12 }],
    alimentos_std_hembra: [{ alimento: 'D', kg: 924, g_ave_dia: 120 }],
    alimentos_std_macho: [{ alimento: 'E', kg: 29.4, g_ave_dia: 40 }],
    consumo_kg_hembra: '60', consumo_kg_macho: '12',
    consumo_std_kg_hembra: '924', consumo_std_kg_macho: '29.4',
  };
  const h = buildConsumptionChart([row], 'hembra'), m = buildConsumptionChart([row], 'macho');
  assert.deepEqual(h.series.map((s) => s.name), ['A.1', 'B[2]']);
  assert.equal(h.data[0].alimento_0, 20); assert.equal(h.data[0].alimento_1, 40);
  assert.equal(h.data[0].saldo, 1100); assert.equal(h.data[0].standardTotal, 924);
  assert.equal(h.data[0].standard[0].g_ave_dia, 120);
  assert.equal(h.data[0].standard[0].alimento, 'D');
  assert.deepEqual(m.series.map((s) => s.name), ['C']);
  assert.equal(m.data[0].alimento_0, 12); assert.equal(m.data[0].saldo, 105);
  assert.equal(m.data[0].standardTotal, 29.4); assert.equal(m.data[0].standard[0].alimento, 'E');
  assert.equal(m.data[0].actual[0].color, m.series[0].color);
  assert.equal(h.standardSeries[0].name, 'D');
  assert.equal(h.standardSeries[0].color, h.data[0].standard[0].color);
  assert.equal(h.data[0].estandar_0, 924);
  assert.equal(m.data[0].estandar_0, 29.4);
});

test('distingue alimentos que coincidían en la paleta y comparte colores entre sexos', () => {
  assert.equal(foodColor('A'), foodColor('I'));
  const rows = [{
    alimentos_hembra: [{ alimento: 'A', kg: 10 }],
    alimentos_macho: [{ alimento: 'I', kg: 20 }],
    alimentos_std_hembra: [{ alimento: 'I', kg: 30 }], consumo_std_kg_hembra: 30,
    alimentos_std_macho: [{ alimento: 'A', kg: 15 }], consumo_std_kg_macho: 15,
  }];
  const h = buildConsumptionChart(rows, 'hembra'), m = buildConsumptionChart(rows, 'macho');
  assert.notEqual(h.series[0].color, m.series[0].color);
  assert.equal(h.standardSeries[0].color, standardFoodColor('I', m.series[0].color));
  assert.equal(m.standardSeries[0].color, standardFoodColor('A', h.series[0].color));
});

test('apila los estándares por alimento sin duplicar el total y usa tonos más claros', () => {
  const { data, standardSeries } = buildConsumptionChart([
    { linea: 'CRIOLLO', lote: 'L1', consumo_std_kg_hembra: 100, alimentos_std_hembra: [{ alimento: 'A', kg: 70 }, { alimento: 'B', kg: 30 }] },
    { linea: 'CRIOLLO', lote: 'L2', consumo_std_kg_hembra: null, alimentos_std_hembra: [{ alimento: 'A', kg: 70 }, { alimento: 'B', kg: null }] },
  ], 'hembra');
  assert.equal(data[0].estandar_0 + data[0].estandar_1, data[0].standardTotal);
  assert.equal(data[1].estandar_0, null); assert.equal(data[1].estandar_1, null);
  for (const { name, color } of standardSeries) {
    const original = foodColor(name).slice(1).match(/../g).map((channel) => parseInt(channel, 16));
    const light = color.slice(1).match(/../g).map((channel) => parseInt(channel, 16));
    assert.ok(light.every((value, i) => value >= original[i]));
    assert.notEqual(color, foodColor(name));
  }
});

test('ordena por línea y lote; distingue cero, datos ausentes y ajustes negativos', () => {
  const rows = [
    { linea: 'ISAMISA', lote: 'L2', alimentos_hembra: [{ alimento: 'A', kg: -2 }], consumo_kg_hembra: -2 },
    { linea: 'CRIOLLO', lote: 'L10', alimentos_hembra: [{ alimento: 'A', kg: null }], consumo_std_kg_hembra: 0 },
    { linea: 'CRIOLLO', lote: 'L2', alimentos_hembra: [] },
  ];
  const { data } = buildConsumptionChart(rows, 'hembra');
  assert.deepEqual(data.map((r) => r.lote), ['L2', 'L10', 'L2']);
  assert.equal(data[0].alimento_0, null); assert.equal(data[0].standardTotal, null);
  assert.equal(data[1].alimento_0, null); assert.equal(data[1].standardTotal, 0);
  assert.equal(data[2].alimento_0, -2); assert.equal(data[2].total, -2);
});

test('Datos generales compara g/ave/día por alimento y sexo sin alterar los kg semanales', () => {
  const row = {
    linea: 'CRIOLLO', lote: 'L1',
    saldo_inicial_hembra: '1000', saldo_inicial_macho: '100',
    suma_saldos_diarios_hembra: '7000', suma_saldos_diarios_macho: '700',
    dias_registrados_hembra: 7, dias_registrados_macho: 7,
    // El saldo final no se usa como denominador de esta comparación.
    saldo_final_hembras: '900', saldo_final_machos: '90',
    consumo_kg_hembra: '700', consumo_kg_macho: '35',
    alimentos_hembra: [{ alimento: 'A', kg: 420 }, { alimento: 'B', kg: 280 }],
    alimentos_macho: [{ alimento: 'C', kg: 35 }],
    consumo_std_kg_hembra: 840, consumo_std_kg_macho: 42,
    consumo_std_g_ave_dia_hembra: '120', consumo_std_g_ave_dia_macho: '60',
    alimentos_std_hembra: [{ alimento: 'A', kg: 560, g_ave_dia: 80 }, { alimento: 'B', kg: 280, g_ave_dia: 40 }],
    alimentos_std_macho: [{ alimento: 'C', kg: 42, g_ave_dia: 60 }],
  };
  const h = buildConsumptionChart([row], 'hembra', 'g_ave_dia').data[0];
  const m = buildConsumptionChart([row], 'macho', 'g_ave_dia').data[0];
  assert.deepEqual([h.alimento_0, h.alimento_1, h.total], [60, 40, 100]);
  assert.deepEqual([h.estandar_0, h.estandar_1, h.standardTotal], [80, 40, 120]);
  assert.deepEqual(h.actual.map(food => food.value), [60, 40]);
  assert.deepEqual(h.standard.map(food => food.value), [80, 40]);
  assert.deepEqual([m.alimento_0, m.total, m.estandar_0, m.standardTotal], [50, 50, 60, 60]);
  const weekly = buildConsumptionChart([row], 'hembra').data[0];
  assert.deepEqual([weekly.alimento_0, weekly.alimento_1, weekly.total, weekly.standardTotal], [420, 280, 700, 840]);
  assert.equal(weekly.actual[0].value, 420);
});

test('g/ave/día no inventa cero con saldos diarios ausentes ni pierde el estándar diario', () => {
  for (const saldo of [null, undefined, 0, -1]) {
    const row = {
      saldo_inicial_hembra: 100, suma_saldos_diarios_hembra: saldo, consumo_kg_hembra: 700,
      alimentos_hembra: [{ alimento: 'A', kg: 700 }],
      consumo_std_g_ave_dia_hembra: 120, consumo_std_kg_hembra: null,
      alimentos_std_hembra: [{ alimento: 'B', g_ave_dia: 120, kg: null }],
    };
    const daily = buildConsumptionChart([row], 'hembra', 'g_ave_dia').data[0];
    assert.equal(daily.total, null);
    assert.equal(daily.alimento_0, null);
    assert.equal(daily.actual[0].value, null);
    assert.equal(daily.standardTotal, 120);
    assert.equal(daily.estandar_0, 120);
  }
});

test('g/ave/día conserva cero y negativos; datos incompletos permanecen sin dato', () => {
  const rows = [0, -7, null].map((kg, i) => ({
    lote: `L${i}`, saldo_inicial_hembra: 100, consumo_kg_hembra: kg,
    suma_saldos_diarios_hembra: 700,
    alimentos_hembra: [{ alimento: 'A', kg }],
    consumo_std_g_ave_dia_hembra: i === 2 ? null : 0,
    alimentos_std_hembra: [{ alimento: 'A', g_ave_dia: i === 2 ? null : 0 }],
  }));
  const { data } = buildConsumptionChart(rows, 'hembra', 'g_ave_dia');
  assert.deepEqual(data.map(row => row.total), [0, -10, null]);
  assert.deepEqual(data.map(row => row.alimento_0), [0, -10, null]);
  assert.deepEqual(data.map(row => row.standardTotal), [0, 0, null]);
  assert.deepEqual(data.map(row => row.estandar_0), [0, 0, null]);
});

test('semana parcial: divide por la suma diaria variable, sin siete días ni saldo inicial fijo', () => {
  const row = {
    saldo_inicial_hembra: 1000, suma_saldos_diarios_hembra: 1800, dias_registrados_hembra: 2,
    consumo_kg_hembra: 180,
    alimentos_hembra: [{ alimento: 'A', kg: 108 }, { alimento: 'B', kg: 72 }],
    saldo_inicial_macho: 100, suma_saldos_diarios_macho: 100, dias_registrados_macho: 1,
    consumo_kg_macho: 5, alimentos_macho: [{ alimento: 'A', kg: 5 }],
  };
  const h = buildConsumptionChart([row], 'hembra', 'g_ave_dia').data[0];
  const m = buildConsumptionChart([row], 'macho', 'g_ave_dia').data[0];
  assert.deepEqual([h.total, h.alimento_0, h.alimento_1], [100, 60, 40]);
  assert.equal(h.birdDays, 1800); assert.equal(h.recordedDays, 2);
  assert.equal(m.total, 50); assert.equal(m.recordedDays, 1);
  // Una vista antigua sin la nueva columna no debe volver a dividir entre 7.
  delete row.suma_saldos_diarios_hembra;
  assert.equal(buildConsumptionChart([row], 'hembra', 'g_ave_dia').data[0].total, null);
});
