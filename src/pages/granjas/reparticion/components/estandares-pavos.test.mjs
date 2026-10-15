import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyTurkeyStandards, standardPercent, loadTurkeyStandards } from './estandares-pavos.js';
import { buildConsumptionChart } from '../../lumbra/components/01.Datos_generales/consumo-por-lote.js';
import { buildWeeklyConsumptionChart } from '../../lumbra/components/03.Detalles por lote/consumo-semanal.js';
import { TURKEY_LOT_ASSIGNMENTS } from './asignaciones-estandar.js';

const mapping = [{ LOTE: 'L1', 'COD STD': 'PAVO-BUT' }];
const row = { lote: 'L1', linea: 'BUT', edad: 40, edad_lote: 40, edad_hembra: 40, edad_macho: 41,
  edad_cierre_hembra: 40, edad_cierre_macho: 41,
  saldo_inicial_hembra: 1000, saldo_inicial_macho: 100, ano: 2026, semana: 40 };
const female = { codigo_estandar: 'PAVO-BUT', edad_sem: '40', sexo: 'HEMBRA', prod_hinc: '0.7', prod_hcom: '5%', mort_sem: '0.005', mort_acum: '2.36%', tipo_aabb: 'A', cons_aabb: '200' };
const male = { codigo_estandar: 'PAVO-BUT', edad_sem: 41, sexo: 'MACHO', mort_sem: '0.01', mort_acum: '0.03', tipo_aabb: 'B', cons_aabb: '300' };

test('cruza código, edad y sexo y alimenta comparativos de las tres tarjetas', () => {
  const result = applyTurkeyStandards({ production: [row], mortality: [row], consumption: [row] }, mapping, [female, male,
    { ...female, codigo_estandar: 'OTRO', prod_hinc: '0.99' }, { ...female, edad_sem: 39, prod_hinc: '0.4' }]);
  assert.equal(result.production[0].prod_hinc_std, 70);
  assert.equal(result.production[0].prod_hcom_std, 5);
  assert.equal(result.mortality[0].porcentaje_mortalidad_std_sem_hembra, 0.5);
  assert.equal(result.mortality[0].porcentaje_mortalidad_std_sem_macho, 1);
  assert.equal(result.mortality[0].porcentaje_mortalidad_std_acum_hembra, 2.36);
  assert.equal(result.mortality[0].porcentaje_mortalidad_std_acum_macho, 3);
  assert.equal(buildConsumptionChart(result.consumption, 'hembra', 'g_ave_dia').data[0].standardTotal, 200);
  assert.equal(buildConsumptionChart(result.consumption, 'macho').data[0].standardTotal, 210);
  assert.equal(result.consumption[0].alimentos_std_hembra[0].kg, 1400);
  assert.equal(buildWeeklyConsumptionChart(result.consumption, [], 'hembra').data[0].estandar, 1400);
});

test('no duplica estándares repetidos y separa alimentos esperados', () => {
  const result = applyTurkeyStandards({ consumption: [row] }, mapping, [female, { ...female }, { ...female, tipo_aabb: 'C', cons_aabb: '20' }]);
  assert.equal(result.consumption[0].consumo_std_g_ave_dia_hembra, 220);
  assert.equal(result.consumption[0].alimentos_std_hembra.length, 2);
  assert.equal(result.consumption[0].prod_hinc_std, 70);
});

test('sin código, edad o coincidencia deja datos ausentes y conserva ceros', () => {
  const result = applyTurkeyStandards({ history: [row, { ...row, lote: 'SIN MAPA' }, { ...row, edad_hembra: null, edad_cierre_hembra: null }] }, mapping, [{ ...female, mort_sem: '0', prod_hinc: '0' }]);
  assert.equal(result.history[0].prod_hinc_std, 0);
  assert.equal(result.history[0].porcentaje_mortalidad_std_sem_hembra, 0);
  assert.equal(result.history[1].prod_hinc_std, null);
  assert.equal(result.history[2].prod_hinc_std, null);
  assert.equal(result.history[2].porcentaje_mortalidad_std_acum_hembra, null);
});

test('códigos múltiples y valores contradictorios no eligen un estándar arbitrario', () => {
  const conflict = applyTurkeyStandards({ history: [row] }, mapping, [female, { ...female, cons_aabb: '250', prod_hinc: '0.8' }]);
  assert.equal(conflict.history[0].prod_hinc_std, null);
  assert.equal(conflict.history[0].consumo_std_kg_hembra, null);
  const codes = applyTurkeyStandards({ history: [row] }, [...mapping, { LOTE: 'L1', 'COD STD': 'OTRO' }], [female]);
  assert.equal(codes.history[0].cod_std, null);
  assert.equal(codes.history[0].prod_hinc_std, null);
});

test('porcentajes explícitos no se multiplican de nuevo y acumulados usan edad de cierre', () => {
  assert.equal(standardPercent('0.5%'), 0.5);
  assert.equal(standardPercent('0,5'), 50);
  assert.equal(standardPercent('-'), null);
  const result = applyTurkeyStandards({ history: [{ ...row, edad_cierre_hembra: 39 }] }, mapping, [female, { ...female, edad_sem: 39, mort_acum: '1%' }]);
  assert.equal(result.history[0].porcentaje_mortalidad_std_acum_hembra, 1);
  assert.equal(result.history[0].prod_hinc_std, 70);
});

test('la consulta conserva coincidencias con espacios y diferencias de mayúsculas', async () => {
  const client = { from(table) {
    const query = { select() { return query; }, order() { return query; },
      range() { return query; }, async abortSignal() { return { data: table === 'Resumen Lotes Cod STD'
        ? [{ LOTE: ' l1 ', 'COD STD': ' pavo-but ' }]
        : [{ ...female, codigo_estandar: ' Pavo-But ', sexo: ' hembra ' }], error: null }; } };
    return query;
  } };
  const result = await loadTurkeyStandards(client, { consumption: [row] }, new AbortController().signal);
  assert.equal(result.consumption[0].consumo_std_g_ave_dia_hembra, 200);
  assert.equal(result.consumption[0].porcentaje_mortalidad_std_sem_hembra, 0.5);
  assert.equal(result.consumption[0].standard_status_hembra, '');
});

test('consulta estándares aunque no haya asignaciones y usa una sola curva de la línea', async () => {
  const tables = [];
  const client = { from(table) {
    tables.push(table);
    const query = { select() { return query; }, order() { return query; }, range() { return query; },
      async abortSignal() { return { data: table === 'Resumen Lotes Cod STD' ? [] : [{ ...female, linea: 'BUT' }], error: null }; } };
    return query;
  } };
  const result = await loadTurkeyStandards(client, { consumption: [row] }, new AbortController().signal);
  assert.ok(tables.includes('estandares_pavos'));
  assert.equal(result.consumption[0].cod_std, 'PAVO-BUT');
  assert.equal(result.consumption[0].porcentaje_mortalidad_std_sem_hembra, 0.5);
  assert.equal(result.consumption[0].consumo_std_g_ave_dia_hembra, 200);
});

test('no adivina curva si una línea tiene varios códigos; prioriza asignación explícita', () => {
  const standards = [{ ...female, linea: 'BUT' }, { ...female, linea: 'BUT', codigo_estandar: 'BUT NACIONAL', mort_sem: '0.01' }];
  const missing = applyTurkeyStandards({ history: [row] }, [], standards).history[0];
  assert.equal(missing.porcentaje_mortalidad_std_sem_hembra, null);
  assert.match(missing.standard_status_hembra, /varias opciones/);
  const assigned = applyTurkeyStandards({ history: [row] }, mapping, standards).history[0];
  assert.equal(assigned.porcentaje_mortalidad_std_sem_hembra, 0.5);
});

test('las 23 asignaciones del usuario distinguen F1 e importados en ambas pestañas', () => {
  assert.equal(TURKEY_LOT_ASSIGNMENTS.length, 23);
  const standards = [
    { ...female, linea: 'BUT', codigo_estandar: 'BUT IMPORTADO', mort_sem: '0.005' },
    { ...female, linea: 'NICHOLAS', codigo_estandar: 'NICHOLAS F1', mort_sem: '0.006', cons_aabb: '180' },
    { ...female, linea: 'NICHOLAS', codigo_estandar: 'NICHOLAS IMPORTADO', mort_sem: '0.007', cons_aabb: '220' },
  ];
  const records = TURKEY_LOT_ASSIGNMENTS.map((r) => ({ ...row, lote: r.LOTE, linea: r.LINEA }));
  const result = applyTurkeyStandards({ mortality: records, consumption: records, history: records }, [], standards);
  for (const key of ['mortality', 'consumption', 'history']) {
    for (const r of result[key]) {
      const assignment = TURKEY_LOT_ASSIGNMENTS.find((a) => a.LOTE === r.lote);
      assert.equal(r.cod_std, assignment['COD STD']);
      assert.notEqual(r.porcentaje_mortalidad_std_sem_hembra, null);
      assert.notEqual(r.consumo_std_g_ave_dia_hembra, null);
    }
  }
  assert.equal(result.mortality.find((r) => r.lote === '25PN29').cod_std, 'NICHOLAS IMPORTADO');
  assert.equal(result.mortality.find((r) => r.lote === '26PN32').cod_std, 'NICHOLAS F1');
  assert.equal(result.mortality.find((r) => r.lote === '26PN34').cod_std, 'NICHOLAS IMPORTADO');
});

test('normaliza espacios del lote y del código y permite futuras asignaciones en Supabase', () => {
  const standards = [{ ...female, codigo_estandar: 'BUT IMPORTADO', linea: 'BUT' },
    { ...female, codigo_estandar: 'NICHOLAS IMPORTADO', linea: 'NICHOLAS' }];
  const data = applyTurkeyStandards({ history: [{ ...row, lote: 'LSEM35.27   - 2' }, { ...row, lote: '26PN32', linea: 'NICHOLAS' }] },
    [{ LOTE: 'LSEM35.27-2', 'COD STD': 'BUT   IMPORTADO' }, { LOTE: '26PN32', 'COD STD': 'NICHOLAS IMPORTADO' }], standards);
  assert.equal(data.history[0].prod_hinc_std, 70);
  assert.equal(data.history[1].cod_std, 'NICHOLAS IMPORTADO');
});
