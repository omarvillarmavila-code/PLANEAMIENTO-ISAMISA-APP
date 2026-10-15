import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReparticionHistory } from './historial-reparticion.js';
import { buildWeeklyConsumptionChart } from '../../lumbra/components/03.Detalles por lote/consumo-semanal.js';

const row = (extra = {}) => ({ Unid_Prod: 'REPARTICIÓN', Linea_Madre: 'BUT', Cod_Lote: 'L1',
  Fecha: '2025-12-27', Sexo: 'HEMBRA', Etapa: 'LEVANTE - PAVO', Galpon: '1', Valido: 'Y',
  Edad_sem: '1', Saldo_Ini: '100', Saldo_Final: '99', Mortal: '1', Mortal_Acum: '1',
  Tipo_Alim: 'A', Cons_Alim: '10', Prod_HInc: null, Prod_HCom: null, ...extra });
const calendar = [{ fecha: '2025-12-27', ano: 2025, semana: 52 },
  { fecha: '2026-01-04', ano: 2026, semana: 1 }, { fecha: '2026-01-05', ano: 2026, semana: 1 }];

test('conserva años y etapas, toma acumulado de cierre y separa ambos sexos', () => {
  const data = buildReparticionHistory([row(), row({ Sexo: 'MACHO', Saldo_Ini: '10', Saldo_Final: '10', Mortal_Acum: '0' }),
    row({ Fecha: '2026-01-04', Etapa: 'POSTURA - PAVO', Edad_sem: '30', Mortal_Acum: '5', Saldo_Ini: '96', Saldo_Final: '95', Prod_HInc: '60', Prod_HCom: '4' }),
    row({ Fecha: '2026-01-05', Etapa: 'POSTURA - PAVO', Edad_sem: '30', Mortal_Acum: '6', Saldo_Ini: '95', Saldo_Final: '94', Prod_HInc: '61', Prod_HCom: '3' }),
    row({ Fecha: '2026-01-05', Sexo: 'MACHO', Etapa: 'POSTURA - PAVO', Edad_sem: '30', Mortal_Acum: '2', Saldo_Ini: '9', Saldo_Final: '8' })], calendar);
  assert.equal(data.history.length, 2);
  const last = data.history.at(-1);
  assert.equal(last.ano, 2026);
  assert.equal(last.prod_hinc, 121);
  assert.equal(last.saldo_final_hembra, 189);
  assert.equal(last.porcentaje_mortalidad_acum_hembra, 6);
  assert.equal(last.porcentaje_mortalidad_acum_macho, 20);
  assert.equal(data.saldos.length, 5);
});

test('sin edad 1 o sin acumulado de cierre el porcentaje queda sin dato', () => {
  const missingBase = buildReparticionHistory([row({ Edad_sem: '30' })], calendar);
  assert.equal(missingBase.history[0].porcentaje_mortalidad_acum_hembra, null);
  const missingClose = buildReparticionHistory([row(), row({ Fecha: '2026-01-04', Edad_sem: '30', Mortal_Acum: null })], calendar);
  assert.equal(missingClose.history.at(-1).porcentaje_mortalidad_acum_hembra, null);
});

test('separa etapas simultáneas y no duplica consumo semanal al representarlas', () => {
  const data = buildReparticionHistory([row(),
    row({ Fecha: '2026-01-04', Edad_sem: '29', Etapa: 'LEVANTE - PAVO', Cons_Alim: '12' }),
    row({ Fecha: '2026-01-05', Edad_sem: '30', Etapa: 'POSTURA - PAVO', Cons_Alim: '14' })], calendar);
  assert.equal(data.history.length, 3);
  assert.equal(data.consumption.length, 2);
  const chart = buildWeeklyConsumptionChart(data.consumption, data.history, 'hembra');
  assert.equal(chart.data.at(-1).consumo, 26);
  assert.equal(chart.data.at(-1).etapa, 'POSTURA - PAVO');
});

test('no repite saldos compartidos por alimentos ni copias del mismo registro', () => {
  const data = buildReparticionHistory([row({ id: 1 }), row({ id: 2 }), row({ Tipo_Alim: 'B', Cons_Alim: '5' })], calendar);
  assert.equal(data.saldos[0].saldo_ini, 100);
  assert.equal(data.saldos[0].saldo_final, 99);
  assert.equal(data.history[0].porcentaje_mortalidad_acum_hembra, 1);
  assert.equal(data.consumption[0].consumo_kg_hembra, 15);
});
