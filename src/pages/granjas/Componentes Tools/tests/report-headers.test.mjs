import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateCSV, normalizeDate, fingerprint } from '../csv-granja.js';

// Encabezados del archivo del usuario, independientes del catálogo del importador.
const headers = `Periodo<br>|Fecha<br>|Cod<br> Lote|Especie<br>|Línea<br> Padre|Línea<br> Madre|Variedad<br>|Muda<br>|Sexo<br>|Unid<br> \u00a0Prod|Galpon<br>|Fecha<br> Ing|Edad<br> ingreso|Aves Ing<br> (unid)|N° Mortal Tr<br> ansp. (unid)|Fecha<br> Cmb. Etap|Aves Cmb.<br> Etap(unid)|Etapa<br>|Etapa Co<br>|Edad<br> (días)|Edad<br> (sem)|Semana<br> Calendario|Peso Ave<br> (g)|Mortal<br> (unid)|Mortal<br> Acum(unid)|Mortal.<br> (%) Transf|Mortal. (%)<br> Transf Acum|Desc<br> (unid)|Desc<br> (Kg)|Desc Ac<br> um(unid)|Descarte<br> (%) Transf|Descarte (%)<br> Transf Acum|Venta<br> (unid)|Venta Ac<br> um(unid)|Transf<br> Ing.(unid)|Transf. Acum<br> Ing.(unid)|Transf.<br> Sal(unid)|Transf Acum<br> Sal(unid)|Origen<br>|Destino<br>|Uniform<br> (%)|Cons<br> Alim(Kg)|Tipo<br> Alim|Cons Alim Ave<br> (g/ave/d)|Cons Alim Ave<br> Acu (g/ave)|Prod Hue<br> vo(unid)|% Prod<br> Huevo|Prod HInc<br> (unid)|Prod HMer<br> (und)|Prod HInc<br> (%)|Prod HCom<br> (unid)|Huevos<br> Inc.(Kg)|Persisten<br> cia (sem)|HI x Gallina<br> Encaset(unid)|Peso Ven<br> tas (Kg)|Peso Ben<br> eficio (Kg)|Guía de<br> Despacho Aves|Guía de<br> Despacho Huevos|Saldo Ini<br> (unid)|Saldo Final<br> (unid)|Fecha<br> Liquidacion|Estado<br> Lote|Edad<br> Sem Prd|Consumo<br> Estandar|Consumo<br> Acu Estandar|Peso<br> Estandar|% Postur<br> Estandar|% HI<br> Estandar|HT x Gallina<br> Encaset (und)|Costo<br> Alimento|Costo Alimento<br> Por Ave Diario|Costo Alimento<br> Por Ave Acum.|Val<br> ido|Còdigo de   Registro`.split('|');
const names = `Periodo Fecha Cod_Lote Especie Linea_Padre Linea_Madre Variedad Muda Sexo Unid_Prod Galpon Fecha_Ing Edad_ingreso Aves_Ing Mortal_Transp Fecha_Cmb_Etap Aves_Cmb_Etap Etapa Etapa_Co Edad_dias Edad_sem Semana_Calendario Peso_Ave Mortal Mortal_Acum Mortal_Porc_Transf Mortal_Porc_Transf_Acum Desc_unid Desc_Kg Desc_Acum Descarte_Porc_Transf Descarte_Porc_Transf_Acum Venta_unid Venta_Acum Transf_Ing Transf_Acum_Ing Transf_Sal Transf_Acum_Sal Origen Destino Uniform Cons_Alim Tipo_Alim Cons_Alim_Ave Cons_Alim_Ave_Acu Prod_Huevo Porc_Prod_Huevo Prod_HInc Prod_HMer Prod_HInc_Porc Prod_HCom Huevos_Inc Persistencia HI_x_Gallina_Encaset Peso_Ventas Peso_Beneficio Guia_Despacho_Aves Guia_Despacho_Huevos Saldo_Ini Saldo_Final Fecha_Liquidacion Estado_Lote Edad_Sem_Prd Consumo_Estandar Consumo_Acu_Estandar Peso_Estandar Postur_Estandar HI_Estandar HT_x_Gallina_Encaset Costo_Alimento Costo_Alimento_Por_Ave_Diario Costo_Alimento_Por_Ave_Acum Valido Codigo_Registro`.split(' ');
const values = ['ENERO-25', '01/01/25', '23PB18', 'PAVOS', 'BUT', 'BUT', 'BLANCO IMPORTADO RP', 'NO', 'HEMBRA', 'REPARTICIÓN', '5', '11/08/23', '1', '2,380', '', '19/04/24', '2,265', 'POSTURA - PAVO', 'C.C. REPRODUCCION PAVO', '510', '73', '2025-1', '', '3', '381', '0.0012605', '0.001260504', '', '0.0000', '\u00a0', '0', '0', '', '', '', '', '', '30', '', '', '', '550.000', 'PPAHE', '279.330', '121200.74', '665', '0.337735', '660', '5', '0.9924812', '', '0.000', '0.0%', '', '', '', '', '', '1,969', '1,966', '30/09/2025', 'I', 'N', '0.00', '0.00', '0.00', '', '', '0.34', '869.00', '0.441340782', '168.1773', 'Y', 'LIMADSAS000000104016'];
const column = (name) => ({ name, type: name.startsWith('Fecha') ? 'date' : 'text', nullable: true, automatic: false, defaultValue: null });
const schema = { columns: names.map(column) };
const csv = (labels, cells = values, delimiter = ';') => [labels, cells].map(row => row.map(cell => `"${cell.replaceAll('"', '""')}"`).join(delimiter)).join('\r\n');

// Nombres y tipos entregados por el usuario. La consulta compartida no incluye
// defaults ni nulabilidad; la app sigue obteniéndolos del RPC al validar.
const actualSchema = { columns: JSON.parse(readFileSync(new URL('./registro-diario-schema.json', import.meta.url), 'utf8').replace(/^\uFEFF/, '')).map(({ column_name, data_type }) => ({
  ...column(column_name),
  type: ({ bigint: 'int8', 'timestamp with time zone': 'timestamptz' })[data_type] || data_type,
  automatic: column_name === 'id',
  defaultValue: column_name === 'created_at' ? 'now()' : null,
})) };

test('el esquema entregado recibe los 73 campos existentes con sus tipos reales', () => {
  const result = validateCSV(csv(headers.slice(0, -1), values.slice(0, -1)), actualSchema);
  assert.equal(result.errorCount, 0, JSON.stringify(result.errors));
  assert.equal(result.columns.length, 73);
  assert.equal(result.warningCount, 0);
  const row = result.rows[0];
  assert.equal(row.Fecha, '2025-01-01');
  assert.equal(row.Fecha_Ing, '11/08/23');
  assert.equal(row.Fecha_Cmb_Etap, '19/04/24');
  assert.equal(row.Mortal_Transporte, null);
  assert.equal(row.Huevos_Inc_Kg, '0.000');
  assert.equal(row.HI_x_Gallina, null);
  assert.equal(row.HT_x_Gallina, '0.34');
  assert.equal(row.Costo_Alimento_Ave_Diario, '0.441340782');
  assert.equal(row.Costo_Alimento_Ave_Acum, '168.1773');
  assert.equal(row.Prod_HInc, '660');
  assert.equal(row.Prod_HInc_Porc, '0.9924812');
  assert.equal(row.Persistencia, '0.0%');
  assert.equal(row.Saldo_Ini, '1969');
  assert.equal(row.Saldo_Final, '1966');
  assert.equal('id' in row, false);
  assert.equal('created_at' in row, false);
});

test('el reporte completo conserva Código de Registro al agregar su columna', async () => {
  const before = validateCSV(csv(headers), actualSchema);
  assert.equal(before.errorCount, 1);
  assert.equal(before.errors[0].column, 'Còdigo de   Registro');
  assert.equal(before.rows.length, 0);
  const migrated = { columns: [...actualSchema.columns, { ...column('Codigo_Registro'), type: 'text' }] };
  const result = validateCSV(csv(headers), migrated);
  assert.equal(result.errorCount, 0, JSON.stringify(result.errors));
  assert.equal(result.warningCount, 0);
  assert.equal(result.columns.length, 74);
  assert.equal(result.rows[0].Codigo_Registro, 'LIMADSAS000000104016');
  assert.equal(result.rows[0].Costo_Alimento_Ave_Acum, '168.1773');
  const reordered = validateCSV(csv([...headers].reverse(), [...values].reverse()), migrated);
  assert.deepEqual(reordered.rows, result.rows);
  assert.equal(await fingerprint(reordered), await fingerprint(result));
});

test('los 74 encabezados del reporte conservan cada valor y distinguen unidades de porcentajes', () => {
  assert.equal(headers.length, 74);
  assert.equal(names.length, 74);
  assert.equal(values.length, 74);
  const expected = validateCSV(csv(names), schema);
  assert.equal(expected.errorCount, 0);
  for (const delimiter of [';', ',', '\t']) {
    for (const lineBreak of ['<br>', '\r\n', ' ', '<BR />']) {
      const result = validateCSV(csv(headers.map(h => h.replaceAll('<br>', lineBreak)), values, delimiter), schema);
      assert.equal(result.errorCount, 0, JSON.stringify(result.errors));
      assert.deepEqual(result.rows, expected.rows);
      assert.equal(result.rows[0].Prod_HInc, '660');
      assert.equal(result.rows[0].Prod_HInc_Porc, '0.9924812');
      assert.equal(result.rows[0].Fecha, '2025-01-01');
      assert.equal(result.rows[0].Fecha_Ing, '2023-08-11');
      assert.equal(result.rows[0].Saldo_Ini, '1969');
      assert.equal(result.rows[0].Saldo_Final, '1966');
      assert.equal(result.rows[0].Codigo_Registro, 'LIMADSAS000000104016');
    }
  }
});

test('el orden de columnas no altera el destino ni la huella de importación', async () => {
  const original = validateCSV(csv(names), schema);
  const report = validateCSV(csv([...headers].reverse(), [...values].reverse()), schema);
  assert.equal(report.errorCount, 0);
  assert.deepEqual(report.rows, original.rows);
  assert.equal(await fingerprint(report), await fingerprint(original));
});

test('bloquea colisiones entre alias y nombres originales, desconocidos y destinos ambiguos', () => {
  const duplicate = validateCSV(csv([...headers, 'Saldo_Ini'], [...values, '5']), schema);
  assert.ok(duplicate.errors.some(e => /repetido/.test(e.message)));
  assert.equal(duplicate.rows.length, 0);
  const unknown = validateCSV(csv([...headers, 'No existe'], [...values, '5']), schema);
  assert.ok(unknown.errors.some(e => /no reconocido/.test(e.message)));
  const ambiguous = validateCSV(csv(headers), { columns: [...schema.columns, column('Codigo_de_Registro')] });
  assert.ok(ambiguous.errors.some(e => /varias columnas/.test(e.message)));
  assert.equal(ambiguous.rows.length, 0);
  const missing = validateCSV(csv(headers), { columns: schema.columns.filter(c => c.name !== 'Codigo_Registro') });
  assert.ok(missing.errors.some(e => e.column === 'Còdigo de   Registro'));
});

test('años cortos usan el siglo XXI y respetan el calendario', () => {
  assert.equal(normalizeDate('01/01/25'), '2025-01-01');
  assert.equal(normalizeDate('29/02/24'), '2024-02-29');
  assert.equal(normalizeDate('31/12/99'), '2099-12-31');
  assert.throws(() => normalizeDate('29/02/25'), /no existe/);
});
