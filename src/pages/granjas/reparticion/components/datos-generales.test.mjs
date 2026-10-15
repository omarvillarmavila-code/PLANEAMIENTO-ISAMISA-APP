import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReparticionData, numberOrNull } from './datos-generales.js';
import { buildConsumptionChart } from '../../lumbra/components/01.Datos_generales/consumo-por-lote.js';

const row = (extra = {}) => ({ Unid_Prod: 'REPARTICIÓN', Linea_Madre: 'BUT', Cod_Lote: 'L1',
  Fecha: '2026-10-04', Sexo: 'HEMBRA', Etapa: 'POSTURA - PAVO', Galpon: '1', Valido: 'Y',
  Edad_sem: '40', Saldo_Ini: '100', Saldo_Final: '98', Mortal: '2',
  Tipo_Alim: 'A', Cons_Alim: '10', Prod_HInc: '70', Prod_HCom: '7', ...extra });

test('separa granjas y sexos; postura y mortalidad usan las bases correspondientes', () => {
  const data = buildReparticionData([row(), row({ Fecha: '2026-10-05', Saldo_Ini: '98', Saldo_Final: '98', Mortal: '0' }),
    row({ Sexo: 'MACHO', Saldo_Ini: '10', Saldo_Final: '9', Mortal: '1', Cons_Alim: '2' }), row({ Unid_Prod: 'LUMBRA' })]);
  assert.equal(data.production.length, 1);
  assert.equal(data.production[0].porcentaje_prod_hinc, 140 * 100 / 196);
  assert.equal(data.mortality[0].porcentaje_mortalidad_hembra, 2);
  assert.equal(data.mortality[0].porcentaje_mortalidad_macho, 10);
  assert.equal(data.consumption[0].consumo_kg_hembra, 20);
  assert.equal(data.consumption[0].consumo_kg_macho, 2);
  const h = buildConsumptionChart(data.consumption, 'hembra', 'g_ave_dia').data[0];
  assert.equal(h.total, 20000 / 198);
  assert.equal(h.recordedDays, 2);
  assert.equal(buildConsumptionChart(data.consumption, 'macho', 'g_ave_dia').data[0].total, 200);
});

test('alimentos comparten población y etapas simultáneas suman sus saldos', () => {
  const data = buildReparticionData([row(), row({ Tipo_Alim: 'B', Cons_Alim: '5' }),
    row({ Etapa: 'LEVANTE - PAVO', Saldo_Ini: '20', Saldo_Final: '20', Cons_Alim: '2' }),
    row({ Valido: 'N', Tipo_Alim: 'C', Cons_Alim: '3', Saldo_Ini: null })]);
  assert.equal(data.consumption[0].suma_saldos_diarios_hembra, 120);
  assert.equal(data.consumption[0].consumo_kg_hembra, 20);
  assert.equal(data.consumption[0].dias_registrados_hembra, 1);
});

test('copias de importación no duplican consumos y faltantes no se inventan', () => {
  const data = buildReparticionData([row({ id: 1 }), row({ id: 2 }), row({ Fecha: '2026-10-05', Cons_Alim: null, Prod_HInc: null, Saldo_Ini: null })]);
  assert.equal(data.consumption[0].consumo_kg_hembra, null);
  assert.equal(data.consumption[0].suma_saldos_diarios_hembra, null);
  assert.equal(data.production[0].porcentaje_prod_hinc, null);
  assert.equal(data.mortality[0].mortalidad_hembra, 4);
  assert.equal(data.mortality[0].porcentaje_mortalidad_macho, null);
  assert.equal(buildConsumptionChart(data.consumption, 'hembra').data[0].standardTotal, null);
  assert.equal(buildReparticionData([row({ id: 1 }), row({ id: 2 })]).consumption[0].consumo_kg_hembra, 10);
});

test('acepta miles, cero y ajustes; saldos contradictorios impiden un promedio falso', () => {
  assert.equal(numberOrNull('1,184'), 1184);
  assert.equal(numberOrNull('0'), 0);
  assert.equal(numberOrNull('-1.5'), -1.5);
  assert.equal(numberOrNull('abc'), null);
  const data = buildReparticionData([row(), row({ Tipo_Alim: 'B', Saldo_Ini: '90' })]);
  assert.equal(data.consumption[0].suma_saldos_diarios_hembra, null);
  assert.equal(buildConsumptionChart(data.consumption, 'hembra', 'g_ave_dia').data[0].total, null);
});

test('mortalidad aplica la convención de Lumbra para días sin bajas', () => {
  const data = buildReparticionData([row(), row({ Fecha: '2026-10-05', Mortal: null })]);
  assert.equal(data.mortality[0].mortalidad_hembra, 2);
  assert.equal(data.mortality[0].porcentaje_mortalidad_hembra, 2);
  assert.equal(data.mortality[0].mortalidad_macho, null);
});
