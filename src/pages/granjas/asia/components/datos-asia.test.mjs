import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asiaDate, prepareAsiaRecords, buildAsiaWeek, campaignForLot, CAMPAIGNS } from './datos-asia.js';
const calendar = [{ fecha: '2026-10-04', ano: 2026, semana: 40 }, { fecha: '2026-10-05', ano: 2026, semana: 40 }, { fecha: '2026-09-27', ano: 2026, semana: 39 }];
const row = (changes = {}) => ({ Fecha: '4/10/2026', Cod_Lote: '26RB08', Unid_Prod: 'ASIA', Linea_Madre: 'BUT', Sexo: 'HEMBRA', Etapa: 'ENGORDE', Galpon: '1', Valido: 'Y', Saldo_Ini: '100', Saldo_Final: '99', Mortal: '1', Edad_sem: '10', Tipo_Alim: 'A', Cons_Alim: '10', ...changes });
test('integra las 23 asignaciones confirmadas sin repetir lotes ni convertir campaña en etapa', () => {
  const lots = CAMPAIGNS.flatMap((r) => r.lots);
  assert.equal(lots.length, 23);
  assert.equal(new Set(lots).size, 23);
  for (const lot of ['26RB04', '26RB07', '26RB08', '26RB14', '26RB18']) assert.equal(campaignForLot(lot), 'TROZADO');
  for (const lot of ['26RB09', '26RB10', '26RB11', '26RB13', '26RB15', '26RB16', '26RB17', '26RN08', '26RN09']) assert.equal(campaignForLot(lot), 'EMPACADO');
  for (const lot of ['26RB19', '26RB20', '26RB21', '26RB22', '26RB23', '26RN10', '26RN11', '26RB24', '26RN12']) assert.equal(campaignForLot(lot), 'CAMPAÑA VIVO');
  assert.equal(campaignForLot(' 26rb14 '), 'TROZADO');
  assert.equal(campaignForLot('26RB17'), 'EMPACADO');
  assert.equal(campaignForLot('26RN12'), 'CAMPAÑA VIVO');
  assert.equal(campaignForLot('OTRO'), null);
});
test('fechas válidas y calendario oficial; no aplica semana ISO como reemplazo', () => {
  assert.equal(asiaDate('1/01/26'), '2026-01-01');
  assert.equal(asiaDate('2026-10-04'), '2026-10-04');
  assert.equal(asiaDate('31/02/2026'), null);
  const data = prepareAsiaRecords([row(), row({ Fecha: '31/02/2026' }), row({ Fecha: '1/01/2026' }), row({ Unid_Prod: 'LUMBRA' })], calendar);
  assert.equal(data.rows.length, 1);
  assert.equal(data.rows[0].semana, 40);
  assert.equal(data.invalidDates, 1);
  assert.equal(data.missingCalendar, 1);
});
test('cierre de campaña no suma días y mantiene población exclusivamente macho', () => {
  const data = prepareAsiaRecords([row({ Sexo: 'MACHO', Saldo_Final: '200' }), row({ Sexo: 'MACHO', Fecha: '5/10/2026', Saldo_Final: '190' }), row({ Sexo: 'MACHO', Fecha: '27/09/2026', Saldo_Final: '900' })], calendar);
  const result = buildAsiaWeek(data.rows, 2026, 40).campaigns[0];
  assert.equal(result.lastDate, '2026-10-05');
  assert.equal(result.summary.machos, 190);
  assert.equal(result.summary.hembras, 0);
  assert.equal(result.lines[0].value, 190);
});
test('no multiplica saldo entre alimentos; suma galpones y etapas diferentes', () => {
  const records = [row(), row({ Tipo_Alim: 'B', Cons_Alim: '5' }), row({ Galpon: '2', Saldo_Final: '30' }), row({ Etapa: 'RECRIA', Saldo_Final: '10' }), row({ Valido: 'N', Saldo_Final: '9000' })];
  const result = buildAsiaWeek(prepareAsiaRecords(records, calendar).rows, 2026, 40).campaigns[0];
  assert.equal(result.summary.hembras, 139);
  assert.equal(result.consumption[0].consumo_kg_hembra, 45);
});
test('las campañas separan lotes y los no clasificados quedan expuestos', () => {
  const result = buildAsiaWeek(prepareAsiaRecords([row(), row({ Cod_Lote: '26RB17', Saldo_Final: '50' }), row({ Cod_Lote: '26RN10', Saldo_Final: '75' }), row({ Cod_Lote: 'NO_ASIGNADO', Saldo_Final: '999' })], calendar).rows, 2026, 40);
  assert.deepEqual(result.campaigns.map((r) => r.summary.hembras), [99, 50, 75]);
  assert.deepEqual(result.unassigned, ['NO_ASIGNADO']);
  assert.equal(result.campaigns[0].mortality[0].porcentaje_mortalidad_hembra, 1);
});
test('saldos contradictorios o vacíos permanecen sin dato', () => {
  const records = [row(), row({ Tipo_Alim: 'B', Saldo_Final: '90' })];
  const result = buildAsiaWeek(prepareAsiaRecords(records, calendar).rows, 2026, 40).campaigns[0];
  assert.equal(result.summary.hembras, null);
  assert.equal(result.lines[0].value, null);
});

test('incluye lotes confirmados de Asia bajo TERCEROS - PAVOS, excluye otras granjas y lotes', () => {
  const data = prepareAsiaRecords([row({ Unid_Prod: 'TERCEROS - PAVOS' }),
    row({ Unid_Prod: 'TERCEROS - PAVOS', Cod_Lote: 'OTRA_GRANJA' }),
    row({ Unid_Prod: 'TINAJAS 1 - PAVOS' }), row({ Unid_Prod: 'LUMBRA' })], calendar);
  assert.equal(data.rows.length, 1);
  const result = buildAsiaWeek(data.rows, 2026, 40).campaigns[0];
  assert.equal(result.summary.hembras, 99);
  assert.equal(result.mortality[0].mortalidad_hembra, 1);
  assert.equal(result.consumption[0].consumo_kg_hembra, 10);
});

test('detalle por campaña separa lote, color y sexo y concilia con el saldo de la dona', () => {
  const records = [row({ Variedad: 'BLANCO' }), row({ Variedad: 'BLANCO', Tipo_Alim: 'B' }),
    row({ Variedad: 'BLANCO', Galpon: '2', Saldo_Final: '20' }),
    row({ Variedad: 'BARRADO', Sexo: 'MACHO', Saldo_Final: '15' }),
    row({ Cod_Lote: '26RB17', Variedad: 'BLANCO', Saldo_Final: '40' })];
  const result = buildAsiaWeek(prepareAsiaRecords(records, calendar).rows, 2026, 40);
  const trozado = result.campaigns[0];
  assert.deepEqual(trozado.details, [
    { lote: '26RB08', color: 'BARRADO', sexo: 'MACHO', saldo: 15, edad: 10 },
    { lote: '26RB08', color: 'BLANCO', sexo: 'HEMBRA', saldo: 119, edad: 10 },
  ]);
  assert.equal(trozado.details.reduce((sum, r) => sum + r.saldo, 0), trozado.summary.hembras + trozado.summary.machos);
  assert.deepEqual(result.campaigns[1].details, [{ lote: '26RB17', color: 'BLANCO', sexo: 'HEMBRA', saldo: 40, edad: 10 }]);
});
