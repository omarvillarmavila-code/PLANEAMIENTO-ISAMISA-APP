import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeCSV, parseCSV, normalizeDate, normalizeNumber, validateCSV, exportCSV, fingerprint } from '../csv-granja.js';
const col = (name, type = 'text', nullable = true, extra = {}) => ({ name, type, nullable, automatic: false, defaultValue: null, ...extra });
const schema = { columns: [col('id', 'int8', false, { automatic: true }), col('Fecha', 'date', false), col('Unid_Prod'), col('Cod_Lote'), col('Sexo'), col('Etapa'), col('Saldo_Ini', 'int8'), col('Mortal'), col('Notas')] };
const header = 'Fecha;Unid_Prod;Cod_Lote;Sexo;Etapa;Saldo_Ini;Mortal;Notas';

test('conserva valores negativos sin observaciones y mantiene las demás validaciones', () => {
  const extended = { columns: [...schema.columns, col('Saldo_Final')] };
  const r = validateCSV(`${header};Saldo_Final\n13/01/2026;LUMBRA;L1;HEMBRA;POSTURA;-10;0;;-12`, extended);
  assert.equal(r.errorCount, 0); assert.equal(r.warningCount, 0);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.rows[0].Saldo_Ini, '-10'); assert.equal(r.rows[0].Saldo_Final, '-12');
  const other = validateCSV(`${header};Saldo_Final\n13/01/2026;LUMBRA;L1;HEMBRA;POSTURA;-10;-1;;-12`, extended);
  assert.equal(other.errorCount, 0); assert.equal(other.warningCount, 0);
  assert.equal(other.rows[0].Mortal, '-1');
  const invalid = validateCSV(`${header};Saldo_Final\n13/01/2026;LUMBRA;L1;HEMBRA;POSTURA;-10;0;;-abc`, extended);
  assert.equal(invalid.invalidRows, 1); assert.equal(invalid.errors[0].column, 'Saldo_Final');
});

test('ninguna métrica negativa genera observaciones ni pierde su signo', () => {
  const names = ['Edad_sem', 'Saldo_Final', 'Prod_HInc', 'Prod_HCom', 'Desc_unid', 'Venta_unid', 'Transf_Ing', 'Transf_Sal'];
  const extended = { columns: [...schema.columns, ...names.map((name) => col(name))] };
  const text = `${header};${names.join(';')}\n13/01/2026;LUMBRA;L1;HEMBRA;POSTURA;-10;-1;;${names.map(() => '-2').join(';')}`;
  const r = validateCSV(text, extended);
  assert.equal(r.errorCount, 0); assert.equal(r.warningCount, 0); assert.deepEqual(r.warnings, []);
  for (const name of names) assert.equal(r.rows[0][name], '-2');
});

test('detecta UTF-8 y Windows-1252 conservando tildes; rechaza texto dañado', () => {
  const utf8 = decodeCSV(new TextEncoder().encode('REPARTICIÓN;Ñ'));
  assert.equal(utf8.encoding, 'utf-8'); assert.equal(utf8.text, 'REPARTICIÓN;Ñ');
  const windows = decodeCSV(Uint8Array.from([0x4e, 0x69, 0xf1, 0x6f]));
  assert.equal(windows.encoding, 'windows-1252'); assert.equal(windows.text, 'Niño');
  assert.throws(() => decodeCSV(Uint8Array.from([0xef, 0xbb, 0xbf, 0xf1])), /dañado/);
  assert.throws(() => decodeCSV(Uint8Array.from([0x41, 0, 0x42])), /no válidos/);
});

test('detecta separadores y decimales sin opciones y normaliza miles con evidencia', () => {
  for (const [delimiter, balance, mortality] of [[';', '1.234', '0,5'], [',', '1,234', '0.5'], ['\t', '1.234', '0,5']]) {
    const text = [header.split(';'), ['13/01/2026', 'LUMBRA', 'L1', 'HEMBRA', 'POSTURA', balance, mortality, '']]
      .map((row) => row.map((cell) => `"${cell}"`).join(delimiter)).join('\n');
    const r = validateCSV(text, schema);
    assert.equal(r.errorCount, 0); assert.equal(r.delimiter, delimiter);
    assert.equal(r.rows[0].Saldo_Ini, '1234'); assert.equal(r.rows[0].Mortal, '0.5');
  }
});

test('bloquea números ambiguos en campos que admiten decimales', () => {
  for (const number of ['1,234', '1.234', '0,005']) {
    const r = validateCSV(`${header}\n13/01/2026;LUMBRA;L1;HEMBRA;POSTURA;10;${number};`, schema);
    assert.equal(r.invalidRows, 1); assert.match(r.errors[0].message, /ambiguo/);
    assert.equal(r.errors[0].line, 2); assert.equal(r.errors[0].column, 'Mortal');
  }
});

test('detecta formatos mezclados en todo el archivo y no usa texto ni ids como evidencia', () => {
  const mixed = validateCSV(`${header}\n13/01/2026;LUMBRA;L1;HEMBRA;POSTURA;10;0,5;\n14/01/2026;LUMBRA;L2;HEMBRA;POSTURA;10;0.5;`, schema);
  assert.equal(mixed.rows.length, 0); assert.match(mixed.errors[0].message, /mezcla/);
  const ambiguous = validateCSV(`id;${header}\n0,5;13/01/2026;LUMBRA;L1;HEMBRA;POSTURA;10;1,234;0,5`, schema);
  assert.match(ambiguous.errors[0].message, /ambiguo/);
  const evidenceLast = validateCSV(`${header}\n13/01/2026;LUMBRA;L1;HEMBRA;POSTURA;1.234;0;\n14/01/2026;LUMBRA;L2;HEMBRA;POSTURA;10;0,5;`, schema);
  assert.equal(evidenceLast.errorCount, 0); assert.equal(evidenceLast.rows[0].Saldo_Ini, '1234');
});

test('reconoce miles en saldos de aves almacenados como texto y en enteros', () => {
  const balances = { columns: schema.columns.map((c) => c.name === 'Saldo_Ini' ? col(c.name) : c).concat(col('Saldo_Final')) };
  for (const [initial, final, expected] of [['1,077', '1,076', '1077'], ['1.077', '1.076', '1077'], ['1,000', '1,000', '1000']]) {
    const r = validateCSV(`${header};Saldo_Final\n13/01/2026;LUMBRA;L1;HEMBRA;POSTURA;${initial};1;;${final}`, balances);
    assert.equal(r.errorCount, 0); assert.equal(r.rows[0].Saldo_Ini, expected);
    assert.equal(r.rows[0].Saldo_Final, final.replace(/[,.]/g, ''));
  }
  const exact = validateCSV(`${header}\n13/01/2026;LUMBRA;L1;HEMBRA;POSTURA;9,223,372,036,854,775,807;1;`, schema);
  assert.equal(exact.errorCount, 0); assert.equal(exact.rows[0].Saldo_Ini, '9223372036854775807');
  const fractional = validateCSV(`${header};Saldo_Final\n13/01/2026;LUMBRA;L1;HEMBRA;POSTURA;1,077;0,5;;1,077`, balances);
  assert.equal(fractional.invalidRows, 1); assert.match(fractional.errors[0].message, /entero/);
  const malformed = validateCSV(`${header};Saldo_Final\n13/01/2026;LUMBRA;L1;HEMBRA;POSTURA;1,07,7;0;;1`, balances);
  assert.equal(malformed.invalidRows, 1);
});

test('valida 22500 registros con los saldos agrupados reportados por el usuario', () => {
  const balances = { columns: schema.columns.map((c) => c.name === 'Saldo_Ini' ? col(c.name) : c).concat(col('Saldo_Final')) };
  const rows = Array.from({ length: 22500 }, (_, i) => `13/01/2026;LUMBRA;L${i};HEMBRA;POSTURA;1,077;1;;1,076`);
  const result = validateCSV([`${header};Saldo_Final`, ...rows].join('\n'), balances);
  assert.equal(result.errorCount, 0); assert.equal(result.rows.length, 22500);
  assert.equal(result.rows[22499].Saldo_Ini, '1077'); assert.equal(result.rows[22499].Saldo_Final, '1076');
});

test('CSV de Excel: BOM, sep, CRLF, campo multilinea y comillas escapadas', () => {
  const parsed = parseCSV('\uFEFFsep=;\r\nA;B\r\n"a; b";"dos\r\nlíneas ""citadas"""\r\n');
  assert.equal(parsed.delimiter, ';');
  assert.equal(parsed.records[0].line, 3);
  assert.deepEqual(parsed.records[0].cells, ['a; b', 'dos\nlíneas "citadas"']);
});
test('rechaza CSV con comillas incompletas o caracteres despues de comillas', () => {
  assert.throws(() => parseCSV('A,B\n"sin cierre,2'), /cerrar/);
  assert.throws(() => parseCSV('A,B\n"a"b,2'), /cierre/);
});
test('fechas DMY y calendario real; no intercambia dias con meses', () => {
  assert.equal(normalizeDate('13/01/2026'), '2026-01-13');
  assert.equal(normalizeDate('03/04/2026'), '2026-04-03');
  assert.equal(normalizeDate('29/02/2024'), '2024-02-29');
  assert.throws(() => normalizeDate('29/02/2026'), /no existe/);
  assert.throws(() => normalizeDate('31/04/2026'), /no existe/);
});
test('formato decimal explicito y agrupacion de miles valida', () => {
  assert.equal(normalizeNumber('1.234,50', ','), '1234.5');
  assert.equal(normalizeNumber('1,234.50', '.'), '1234.5');
  assert.equal(normalizeNumber('0,005', ','), '0.005');
  assert.throws(() => normalizeNumber('12,34.50', '.'), /inválido/);
  assert.throws(() => normalizeNumber('-', '.'), /inválido/);
});
test('bigint vacio -> null, precision exacta, codigo de lote conserva ceros', () => {
  const r = validateCSV(`${header}\n13/01/2026;lumbra;001;hembra;postura;;0;\n14/01/2026;LUMBRA;002;MACHO;POSTURA;9223372036854775807;1;`, schema);
  assert.equal(r.errorCount, 0);
  assert.equal(r.rows[0].Saldo_Ini, null);
  assert.equal(r.rows[0].Cod_Lote, '001');
  assert.equal(r.rows[1].Saldo_Ini, '9223372036854775807');
  assert.equal(r.rows[0].Fecha, '2026-01-13');
  assert.equal(r.rows[0].Sexo, 'HEMBRA');
});
test('bloquea enteros fuera de rango, fracciones y filas mal alineadas', () => {
  for (const n of ['9223372036854775808', '1.5']) {
    assert.equal(validateCSV(`${header}\n2026-01-13;LUMBRA;L1;HEMBRA;POSTURA;${n};1;`, schema).invalidRows, 1);
  }
  assert.equal(validateCSV(`${header}\n2026-01-13;LUMBRA;L1`, schema).invalidRows, 1);
});
test('columnas desconocidas/repetidas/faltantes y campos obligatorios vacios', () => {
  assert.ok(validateCSV('Fecha;Fecha\n2026-01-13;2026-01-13', schema).errorCount > 0);
  assert.ok(validateCSV(`${header};Inventada\n2026-01-13;LUMBRA;L1;HEMBRA;POSTURA;1;0;;a`, schema).errorCount > 0);
  assert.ok(validateCSV(`${header}\n2026-01-13;;L1;HEMBRA;POSTURA;1;0;`, schema).errorCount > 0);
});
test('ignora id automatico, conserva filas repetidas y las reporta', () => {
  const r = validateCSV(`id;${header}\n1;2026-01-13;LUMBRA;L1;HEMBRA;POSTURA;10;1;\n2;2026-01-13;LUMBRA;L1;HEMBRA;POSTURA;10;1;`, schema);
  assert.equal(r.errorCount, 0); assert.equal(r.duplicateCount, 1);
  assert.equal(r.rows.length, 2); assert.deepEqual(r.ignored, ['id']);
  assert.equal('id' in r.rows[0], false);
});
test('no suma ni descarta registros de mismo lote/fecha/sexo con distintos datos', () => {
  const r = validateCSV(`${header}\n2026-01-13;LUMBRA;L1;HEMBRA;POSTURA;10;1;\n2026-01-13;LUMBRA;L1;HEMBRA;POSTURA;20;2;`, schema);
  assert.equal(r.rows.length, 2); assert.equal(r.duplicateCount, 0);
});
test('huella estable entre delimitadores y fechas equivalentes', async () => {
  const a = validateCSV(`${header}\n13/01/2026;LUMBRA;L1;HEMBRA;POSTURA;10;1;`, schema);
  const b = validateCSV(`${header.replaceAll(';', ',')}\n2026-01-13,LUMBRA,L1,HEMBRA,POSTURA,10,1,`, schema);
  assert.equal(await fingerprint(a), await fingerprint(b));
});
test('reporte protege celdas con formulas y escapa comillas', () => {
  const exported = exportCSV(['Valor'], [['=HYPERLINK("x")'], ['texto normal']]);
  assert.ok(exported.includes("'=HYPERLINK"));
  assert.ok(exported.includes('""x""'));
});
test('valida 22500 filas completas', () => {
  const lines = Array.from({ length: 22500 }, (_, i) => `13/01/2026;LUMBRA;L${i};HEMBRA;POSTURA;100;1;`);
  const r = validateCSV([header, ...lines].join('\n'), schema);
  assert.equal(r.rows.length, 22500); assert.equal(r.errorCount, 0);
});
test('omite columna con default si esta completamente vacia; no inventa default por fila', () => {
  const extended = { columns: [...schema.columns, col('creado', 'timestamp', false, { defaultValue: 'now()' })] };
  const r = validateCSV(`${header};creado\n2026-01-13;LUMBRA;L1;HEMBRA;POSTURA;1;0;;`, extended);
  assert.equal(r.errorCount, 0); assert.deepEqual(r.defaulted, ['creado']);
  assert.equal('creado' in r.rows[0], false);
  const mixed = validateCSV(`${header};creado\n2026-01-13;LUMBRA;L1;HEMBRA;POSTURA;1;0;;\n2026-01-13;LUMBRA;L2;HEMBRA;POSTURA;1;0;;2026-01-13T12:00:00`, extended);
  assert.equal(mixed.invalidRows, 1);
});
