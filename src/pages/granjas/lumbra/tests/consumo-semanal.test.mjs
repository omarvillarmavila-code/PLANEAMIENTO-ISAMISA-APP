import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWeeklyConsumptionChart } from '../components/03.Detalles por lote/consumo-semanal.js';

test('ordena semanas entre años y compara kg semanales sin acumular ni convertir el estándar', () => {
  const rows = [
    { ano: 2026, semana: 1, lote: 'L1', linea: 'A', edad_lote: 2,
      consumo_kg_hembra: '60', consumo_std_kg_hembra: '55',
      alimentos_hembra: [{ alimento: 'A.1', kg: 20 }, { alimento: 'B[2]', kg: 40 }] },
    { ano: 2025, semana: 52, lote: 'L1', linea: 'A', edad_lote: 1,
      consumo_kg_hembra: '30', consumo_std_kg_hembra: '35',
      alimentos_hembra: [{ alimento: 'A.1', kg: 30 }] },
  ];
  const { data, series } = buildWeeklyConsumptionChart(rows, [], 'hembra');
  assert.deepEqual(data.map((row) => [row.ano, row.semana, row.consumo, row.estandar]),
    [[2025, 52, 30, 35], [2026, 1, 60, 55]]);
  assert.deepEqual(series.map((food) => food.name), ['A.1', 'B[2]']);
  assert.deepEqual(data.map((row) => [row.alimento_0, row.alimento_1]), [[30, 0], [20, 40]]);
});

test('conserva un punto semanal al cambiar de etapa y usa su etapa de cierre para el fondo', () => {
  const rows = ['A', 'B'].map((linea) => ({ ano: 2026, semana: 10, lote: 'L1', linea,
    edad_lote: 9, consumo_kg_hembra: 10, consumo_std_kg_hembra: 12,
    alimentos_hembra: [{ alimento: 'ALIMENTO', kg: 10 }] }));
  const history = [
    { ...rows[0], edad: '10', etapa: 'POSTURA - POLLO' },
    { ...rows[0], edad: '9', etapa: 'LEVANTE - POLLO' },
    { ...rows[1], edad: '10', etapa: 'POSTURA - POLLO' },
  ];
  const { data } = buildWeeklyConsumptionChart(rows, history, 'hembra');
  assert.equal(data.length, 1);
  assert.equal(data[0].edad, '10');
  assert.equal(data[0].etapa, 'POSTURA - POLLO');
  assert.equal(data[0].consumo, 20);
  assert.equal(data[0].estandar, 24);
  assert.equal(data[0].alimento_0, 20);
});

test('mantiene colores comunes entre sexos sin mezclar consumos reales ni estándares', () => {
  const rows = [{ ano: 2026, semana: 1, edad_lote: 1,
    consumo_kg_hembra: 10, consumo_std_kg_hembra: 11,
    consumo_kg_macho: 5, consumo_std_kg_macho: 6,
    alimentos_hembra: [{ alimento: 'A', kg: 10 }],
    alimentos_macho: [{ alimento: 'A', kg: 3 }, { alimento: 'I', kg: 2 }],
  }];
  const h = buildWeeklyConsumptionChart(rows, [], 'hembra');
  const m = buildWeeklyConsumptionChart(rows, [], 'macho');
  assert.equal(h.series[0].color, m.series[0].color);
  assert.notEqual(m.series[0].color, m.series[1].color);
  assert.deepEqual([h.data[0].consumo, h.data[0].estandar, m.data[0].consumo, m.data[0].estandar], [10, 11, 5, 6]);
});

test('distingue ceros, datos ausentes, ajustes negativos y consumo sin desglose', () => {
  const rows = [
    { ano: 2026, semana: 1, edad_lote: 1, consumo_kg_hembra: 0, consumo_std_kg_hembra: 0, alimentos_hembra: [{ alimento: 'A', kg: 0 }] },
    { ano: 2026, semana: 2, edad_lote: 2, consumo_kg_hembra: null, consumo_std_kg_hembra: null, alimentos_hembra: [{ alimento: 'A', kg: null }] },
    { ano: 2026, semana: 3, edad_lote: 3, consumo_kg_hembra: -2, consumo_std_kg_hembra: 8, alimentos_hembra: [{ alimento: 'A', kg: -2 }] },
    { ano: 2026, semana: 4, edad_lote: 4, consumo_kg_hembra: 20, consumo_std_kg_hembra: 22 },
  ];
  const { data, series } = buildWeeklyConsumptionChart(rows, [], 'hembra');
  assert.deepEqual(data.map((row) => row.estandar), [0, null, 8, 22]);
  assert.deepEqual(data.map((row) => row.consumo), [0, null, -2, 20]);
  assert.deepEqual(data.slice(0, 3).map((row) => row.alimento_0), [0, null, -2]);
  const fallback = series.find((food) => food.name === 'SIN DESGLOSE');
  assert.equal(data[3][fallback.key], 20);
  assert.deepEqual(buildWeeklyConsumptionChart([], [], 'hembra').data, []);
});
