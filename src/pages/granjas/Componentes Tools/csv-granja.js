import { createHeaderResolver } from './csv-granja-headers.js';

export const MAX_ROWS = 100000;
export const MAX_BYTES = 20 * 1024 * 1024;
export const BATCH_SIZE = 250;
const REQUIRED = ['Fecha', 'Unid_Prod', 'Cod_Lote', 'Sexo', 'Etapa'];
const METRICS = new Set(['Edad_sem', 'Saldo_Ini', 'Saldo_Final', 'Mortal', 'Prod_HInc', 'Prod_HCom', 'Desc_unid', 'Venta_unid', 'Transf_Ing', 'Transf_Sal']);
const INTEGER_TYPES = { int2: [-32768n, 32767n], int4: [-2147483648n, 2147483647n], int8: [-9223372036854775808n, 9223372036854775807n] };
// Estos saldos representan aves, aunque la base los almacene como texto.
const requiresInteger = (column) => Object.hasOwn(INTEGER_TYPES, column.type)
  || ['Saldo_Ini', 'Saldo_Final'].includes(column.name);
const NUMBER_PATTERNS = {
  ',': /^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/,
  '.': /^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/,
};
const isNumeric = (column) => Object.hasOwn(INTEGER_TYPES, column.type)
  || ['numeric', 'float4', 'float8'].includes(column.type) || METRICS.has(column.name);

export function decodeCSV(buffer) {
  const bytes = new Uint8Array(buffer);
  const utf8BOM = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  let text, encoding = 'utf-8';
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch {
    if (utf8BOM) throw new Error('El archivo contiene texto UTF-8 dañado. Vuelve a exportarlo como CSV UTF-8.');
    encoding = 'windows-1252';
    text = new TextDecoder(encoding).decode(bytes);
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\ufffd]/.test(text)) {
    throw new Error('El archivo contiene caracteres no válidos. Vuelve a exportarlo como CSV UTF-8.');
  }
  return { text, encoding };
}

// Inferir un formato consistente usando solo columnas numéricas importables.
// Si no hay decimales explícitos, los saldos de aves y columnas enteras
// permiten reconocer agrupaciones de miles sin asumirlo para otros campos.
function detectDecimal(parsed, columns, metadata, indexes) {
  const formats = new Set(), integerFormats = new Set();
  for (const record of parsed.records) {
    if (record.cells.length !== parsed.headers.length) continue;
    for (const name of columns) {
      if (!isNumeric(metadata.get(name))) continue;
      const value = record.cells[indexes.get(name)].trim();
      const dot = NUMBER_PATTERNS['.'].test(value), comma = NUMBER_PATTERNS[','].test(value);
      if (dot !== comma) formats.add(dot ? '.' : ',');
      if (dot && comma && requiresInteger(metadata.get(name))) {
        if (/^[+-]?[1-9]\d{0,2}(?:,\d{3})+$/.test(value)) integerFormats.add('.');
        if (/^[+-]?[1-9]\d{0,2}(?:\.\d{3})+$/.test(value)) integerFormats.add(',');
      }
      if (formats.size > 1) return 'mixed';
    }
  }
  if (formats.size) return formats.values().next().value;
  if (integerFormats.size > 1) return 'mixed';
  return integerFormats.values().next().value || 'auto';
}

// CSV con comillas escapadas, saltos dentro de campos y numero de linea original.
export function parseCSV(input, requestedDelimiter = 'auto') {
  let text = input.replace(/^\uFEFF/, '');
  let initialLine = 1;
  const sep = text.match(/^sep=([;,\t])\r?\n/i);
  if (sep) { text = text.slice(sep[0].length); initialLine++; }
  let delimiter = requestedDelimiter === 'tab' ? '\t' : requestedDelimiter;
  if (delimiter === 'auto') {
    if (sep) delimiter = sep[1];
    else {
      const counts = { ',': 0, ';': 0, '\t': 0 };
      let quoted = false;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"') {
          if (quoted && text[i + 1] === '"') { i++; continue; }
          quoted = !quoted;
        } else if (!quoted) {
          if (ch === '\n' || ch === '\r') break;
          if (Object.hasOwn(counts, ch)) counts[ch]++;
        }
      }
      delimiter = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    }
  }
  const records = [];
  let cells = [], field = '', quoted = false, closed = false, line = initialLine, start = initialLine;
  const pushField = () => { cells.push(field); field = ''; closed = false; };
  const pushRow = () => {
    pushField();
    if (cells.some((cell) => cell.trim() !== '')) records.push({ cells, line: start });
    cells = [];
    if (records.length > MAX_ROWS + 1) throw new Error(`El archivo supera ${MAX_ROWS.toLocaleString('es-PE')} registros.`);
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closed = true; }
      } else {
        if (ch === '\r') {
          if (text[i + 1] === '\n') i++;
          field += '\n'; line++;
        } else { field += ch; if (ch === '\n') line++; }
      }
    } else if (ch === delimiter) pushField();
    else if (ch === '\n' || ch === '\r') {
      pushRow();
      if (ch === '\r' && text[i + 1] === '\n') i++;
      line++; start = line;
    } else if (ch === '"') {
      if (field !== '' || closed) throw new Error(`Línea ${line}: comillas fuera de un campo CSV válido.`);
      quoted = true;
    } else if (closed) {
      if (!/[ \t]/.test(ch)) throw new Error(`Línea ${line}: contenido después del cierre de comillas.`);
    } else field += ch;
  }
  if (quoted) throw new Error(`Línea ${start}: falta cerrar las comillas.`);
  if (cells.length || field !== '' || closed) pushRow();
  if (records.length < 2) throw new Error('El CSV debe contener encabezados y al menos un registro.');
  return { delimiter, headers: records[0].cells.map((v) => v.trim()), records: records.slice(1) };
}

export function normalizeDate(value) {
  let year, month, day;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})$/.exec(value);
  if (iso) [, year, month, day] = iso;
  else if (local) [, day, month, year] = local;
  else throw new Error('Usa DD/MM/AAAA, DD/MM/AA o AAAA-MM-DD.');
  // El reporte de granja abrevia los años del siglo XXI.
  if (year.length === 2) year = `20${year}`;
  const y = Number(year), m = Number(month), d = Number(day);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (y < 1 || m < 1 || m > 12 || d < 1 || d > days[m - 1]) throw new Error('La fecha no existe.');
  return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function normalizeNumber(value, decimal = '.') {
  if (decimal === 'auto') {
    const candidates = ['.', ','].filter((format) => NUMBER_PATTERNS[format].test(value));
    if (!candidates.length) throw new Error('Número inválido. Revisa sus separadores y caracteres.');
    if (candidates.length === 2 && normalizeNumber(value, '.') !== normalizeNumber(value, ',')) {
      throw new Error(`El número «${value}» es ambiguo: no se puede distinguir miles de decimales. Exporta los números sin separadores de miles y con un formato decimal uniforme.`);
    }
    return normalizeNumber(value, candidates[0]);
  }
  if (!NUMBER_PATTERNS[decimal].test(value)) throw new Error(`Número inválido. Se esperaba el separador decimal «${decimal}».`);
  let result = decimal === ',' ? value.replaceAll('.', '').replace(',', '.') : value.replaceAll(',', '');
  result = result.replace(/^\+/, '').replace(/^(-?)0+(?=\d)/, '$1');
  if (result.includes('.')) result = result.replace(/0+$/, '').replace(/\.$/, '');
  if (/^-0$/.test(result)) result = '0';
  return result;
}

function convert(value, column, decimal) {
  if (!value.trim()) {
    if (!column.nullable || REQUIRED.includes(column.name)) throw new Error('Este campo es obligatorio.');
    return null;
  }
  const text = value.trim();
  if (column.type === 'date' || column.name === 'Fecha') return normalizeDate(text);
  if (column.enumValues?.length) {
    if (!column.enumValues.includes(text)) throw new Error(`Valores permitidos: ${column.enumValues.join(', ')}.`);
    return text;
  }
  if (isNumeric(column)) {
    const numeric = normalizeNumber(text, decimal);
    if (requiresInteger(column) && numeric.includes('.')) throw new Error('Se requiere un número entero.');
    if (Object.hasOwn(INTEGER_TYPES, column.type)) {
      const n = BigInt(numeric), [min, max] = INTEGER_TYPES[column.type];
      if (n < min || n > max) throw new Error('El entero supera el rango permitido por la columna.');
    }
    if (column.type === 'numeric' && column.precision && column.scale !== null && column.scale >= 0) {
      const [whole, fraction = ''] = numeric.replace('-', '').split('.');
      if (whole.replace(/^0+/, '').length > column.precision - column.scale || fraction.length > column.scale) {
        throw new Error(`Máximo ${column.precision - column.scale} dígitos enteros y ${column.scale} decimales; no se redondeará el dato.`);
      }
    }
    if (['float4', 'float8'].includes(column.type) && !Number.isFinite(Number(numeric))) throw new Error('Número fuera de rango.');
    // Enviar enteros y decimales como texto conserva la precision de bigint/numeric.
    return numeric;
  }
  if (column.type === 'bool') {
    if (/^(true|t|1|yes|y|si|sí)$/i.test(text)) return true;
    if (/^(false|f|0|no|n)$/i.test(text)) return false;
    throw new Error('Usa verdadero/falso como true/false, sí/no o 1/0.');
  }
  if (column.type === 'uuid') {
    if (!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(text)) throw new Error('Identificador UUID inválido.');
    return text.toLowerCase();
  }
  if (column.type === 'json' || column.type === 'jsonb') {
    try { return JSON.parse(text); } catch { throw new Error('JSON inválido.'); }
  }
  if (column.type === 'timestamp' || column.type === 'timestamptz') {
    const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2}):(\d{2})(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})?$/.exec(text);
    if (!match || +match[2] > 23 || +match[3] > 59 || +match[4] > 59 || (column.type === 'timestamptz' && !match[6])) throw new Error('Usa fecha y hora ISO; incluye zona horaria si corresponde.');
    normalizeDate(match[1]);
    return text;
  }
  if (!['text', 'varchar', 'bpchar', 'citext'].includes(column.type)) throw new Error(`El tipo ${column.type} necesita una regla de importación específica.`);
  if (column.maxLength && [...text].length > column.maxLength) throw new Error(`Máximo ${column.maxLength} caracteres.`);
  if (column.name === 'Sexo') {
    const sexo = text.toUpperCase();
    if (!['HEMBRA', 'MACHO'].includes(sexo)) throw new Error('Usa HEMBRA o MACHO.');
    return sexo;
  }
  if (column.name === 'Unid_Prod') {
    const farm = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    return farm === 'REPARTICION' ? 'REPARTICIÓN' : text.toUpperCase();
  }
  if (column.name === 'Etapa' || column.name === 'Valido') return text.toUpperCase();
  return text;
}

export function validateCSV(text, schema, options = {}) {
  const parsed = parseCSV(text, options.delimiter || 'auto');
  const metadata = new Map(schema.columns.map((c) => [c.name, c]));
  const errors = [], warnings = [], ignored = [], used = new Set();
  let errorCount = 0, warningCount = 0, duplicateCount = 0;
  const issue = (kind, line, column, value, message) => {
    if (kind === 'error') errorCount++; else warningCount++;
    const list = kind === 'error' ? errors : warnings;
    if (list.length < 10000) list.push({ line, column, value: String(value ?? ''), message });
  };
  const resolveHeader = createHeaderResolver(schema.columns);
  parsed.headers = parsed.headers.map((header) => {
    const { name, candidates } = resolveHeader(header);
    if (!header) issue('error', 1, '(vacío)', '', 'Encabezado vacío.');
    else if (!name) issue('error', 1, header, '', candidates.length
      ? `El encabezado coincide con varias columnas: ${candidates.join(', ')}.`
      : 'Encabezado no reconocido en la tabla de registros diarios.');
    else if (used.has(name)) issue('error', 1, header, '', `Encabezado repetido: corresponde a ${name}, que ya está incluido.`);
    else if (metadata.get(name).automatic) ignored.push(name);
    if (name) used.add(name);
    return name || header;
  });
  schema.columns.forEach((column) => {
    if (!column.automatic && ((!column.nullable && column.defaultValue === null) || REQUIRED.includes(column.name)) && !used.has(column.name)) {
      issue('error', 1, column.name, '', 'Falta este encabezado obligatorio.');
    }
  });
  const indexes = new Map(parsed.headers.map((name, index) => [name, index]));
  const defaulted = parsed.headers.filter((name) => {
    const column = metadata.get(name);
    return column && !column.automatic && column.defaultValue !== null
      && !REQUIRED.includes(name)
      && parsed.records.every((record) => !record.cells[indexes.get(name)]?.trim());
  });
  const columns = parsed.headers.filter((name) => metadata.has(name) && !metadata.get(name).automatic && !defaulted.includes(name)).sort();
  const rows = [], sourceLines = [], seen = new Map(), farms = new Set(), years = new Set();
  let from = null, to = null, invalidRows = 0;
  if (errorCount) return { rows, columns, sourceLines, errors, errorCount, warnings, warningCount, duplicateCount, ignored, defaulted, total: parsed.records.length, invalidRows: parsed.records.length, delimiter: parsed.delimiter };
  const decimal = options.decimal && options.decimal !== 'auto'
    ? options.decimal : detectDecimal(parsed, columns, metadata, indexes);
  if (decimal === 'mixed') {
    issue('error', 1, '(formato numérico)', '', 'El archivo mezcla formatos decimales de punto y coma. Exporta todas las columnas numéricas con el mismo formato y vuelve a validar.');
    return { rows, columns, sourceLines, errors, errorCount, warnings, warningCount, duplicateCount, ignored, defaulted, total: parsed.records.length, invalidRows: parsed.records.length, delimiter: parsed.delimiter };
  }
  for (const record of parsed.records) {
    const before = errorCount;
    if (record.cells.length !== parsed.headers.length) {
      issue('error', record.line, '(fila)', '', `Tiene ${record.cells.length} campos; se esperaban ${parsed.headers.length}. Revisa el separador y las comillas.`);
      invalidRows++; continue;
    }
    const row = {};
    for (const name of columns) {
      const value = record.cells[indexes.get(name)];
      try {
        row[name] = convert(value, metadata.get(name), decimal);
      } catch (error) { issue('error', record.line, name, value, error.message); }
    }
    if (before !== errorCount) { invalidRows++; continue; }
    const serialized = JSON.stringify(row);
    if (seen.has(serialized)) {
      duplicateCount++;
      issue('warning', record.line, '(fila)', '', `Fila idéntica a la línea ${seen.get(serialized)}. Se conservarán ambas si confirmas.`);
    } else seen.set(serialized, record.line);
    if (!['LUMBRA', 'REPARTICIÓN', 'ASIA', 'CARABAYLLO'].includes(row.Unid_Prod)) issue('warning', record.line, 'Unid_Prod', row.Unid_Prod, 'Unidad no incluida en el menú actual: comprueba el nombre.');
    rows.push(row); sourceLines.push(record.line); farms.add(row.Unid_Prod); years.add(row.Fecha.slice(0, 4));
    if (!from || row.Fecha < from) from = row.Fecha;
    if (!to || row.Fecha > to) to = row.Fecha;
  }
  return { rows, columns, sourceLines, errors, errorCount, warnings, warningCount, duplicateCount, ignored, defaulted, total: parsed.records.length, invalidRows, farms: [...farms].sort(), years: [...years].sort(), from, to, delimiter: parsed.delimiter };
}

export function exportCSV(headers, rows) {
  const escape = (value) => {
    let text = String(value ?? '');
    // Los reportes pueden contener texto del archivo: evitar formulas al abrir Excel.
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return '\uFEFF' + [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');
}

export async function fingerprint(result) {
  const bytes = new TextEncoder().encode(JSON.stringify({ version: 1, columns: result.columns, rows: result.rows }));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
