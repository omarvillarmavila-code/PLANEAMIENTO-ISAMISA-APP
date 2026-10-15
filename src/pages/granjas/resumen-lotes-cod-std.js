export const TABLE = 'Resumen Lotes Cod STD';
export const PAGE_SIZE = 20;
export const GROUPS = [
  ['Identificación', ['LOTE', 'ORIGEN', 'LINEA', 'COD STD', 'MOTIVO', 'AREA SOLICITANTE']],
  ['Carga', ['DIA DE CARGA', 'FECHA CARGA', 'SEM CARGA', 'AÑO CARGA']],
  ['Nacimiento', ['DIA NAC', 'FECHA NAC', 'SEM NAC', 'AÑO NAC', 'P. PROM HI', 'CANT PROY (HEMBRA)', 'CANT REAL (HEMBRA)', 'CANT PROY (MACHO)', 'CANT REAL (MACHO)']],
  ['Inicio de producción', ['DIA PROD', 'EDAD INIC PRODUC', 'FECHA INIC PRODUC', 'SEM INIC PRODUC', 'AÑO INIC PRODUC']],
  ['Muda', ['DIA MUDA', 'EDAD INIC MUDA', 'FECHA INIC MUDA', 'SEM INIC MUDA', 'AÑO INIC MUDA', 'EDAD FIN MUDA', 'FECHA FIN MUDA', 'SEM FIN MUDA', 'AÑO FIN MUDA']],
  ['Liquidación', ['DIA LIQ', 'EDAD LIQUID', 'FECHA LIQUID', 'SEM LIQUID', 'AÑO LIQUID']],
  ['Alojamiento y observaciones', ['GALPON POLLO BB', 'GALPON ADULTO', 'GALPON ADULTO 2', 'OBS']],
];
export const FIELDS = GROUPS.flatMap(([, names]) => names);
export const TABLE_FIELDS = FIELDS.filter(name => name !== 'P. PROM HI' && !/^(DIA |SEM |AÑO |CANT PROY |GALPON )/.test(name));

export function dateDetails(name, row) {
  if (!name.startsWith('FECHA ') || !row[name]) return undefined;
  const suffix = name.slice(6);
  const value = inputDate(row[name]);
  const date = new Date(`${value}T00:00:00Z`);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime());
  const day = valid ? date.toLocaleDateString('es-PE', { weekday: 'long', timeZone: 'UTC' }) : '—';
  const week = row[`SEM ${suffix}`];
  const year = row[`AÑO ${suffix}`] ?? (valid ? date.getUTCFullYear() : '—');
  return `Día: ${day}\nSemana: ${week == null || week === '' ? 'Sin registrar' : week}\nAño: ${year}`;
}
export function fieldType(name) {
  if (name.startsWith('FECHA ')) return 'date';
  if (/^(SEM |AÑO |CANT )/.test(name)) return 'integer';
  if (name.startsWith('EDAD ')) return 'decimal';
  return 'text';
}

function inputDate(value) {
  const text = String(value ?? '').trim();
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : text;
}

export function formValues(row = {}) {
  return Object.fromEntries(FIELDS.map(name => [name, fieldType(name) === 'date' ? inputDate(row[name]) : String(row[name] ?? '')]));
}

export function validateForm(values) {
  const payload = {}, errors = {};
  for (const name of FIELDS) {
    const value = String(values[name] ?? '').trim();
    if (!value) {
      payload[name] = null;
      if (name === 'LOTE') errors[name] = 'Escribe el código del lote.';
      continue;
    }
    const type = fieldType(name);
    payload[name] = value;
    if (type === 'integer') {
      if (!/^\d+$/.test(value) || Number(value) > 2147483647) errors[name] = 'Usa un entero entre 0 y 2147483647.';
      else if (name.startsWith('SEM ') && (+value < 1 || +value > 53)) errors[name] = 'Usa una semana entre 1 y 53.';
      else if (name.startsWith('AÑO ') && (+value < 1 || +value > 9999)) errors[name] = 'Usa un año entre 1 y 9999.';
      else payload[name] = Number(value);
    } else if (type === 'decimal') {
      if (!/^\d+(?:[.,]\d+)?$/.test(value)) errors[name] = 'Usa una edad positiva o cero, con punto o coma decimal.';
      else payload[name] = value.replace(',', '.');
    } else if (type === 'date') {
      const date = new Date(`${value}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        errors[name] = 'Escribe una fecha válida.';
      }
    }
  }
  return { payload, errors };
}

export function displayValue(name, value) {
  if (value == null || value === '') return '—';
  if (fieldType(name) === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }
  return String(value);
}

export function crudError(error) {
  if (['42703', 'PGRST204', '42P01', 'PGRST205'].includes(error?.code)) return 'Falta actualizar la estructura de Resumen Lotes Cod STD en Supabase.';
  if (['42501', 'PGRST301'].includes(error?.code)) return 'Tu cuenta no tiene permiso para esta operación. Revisa la sesión y los permisos de la tabla.';
  if (error?.code === '23505') return 'Ya existe un registro con una clave que debe ser única. Revisa el lote.';
  if (error?.code === '23503') return 'No se puede completar la operación porque hay registros relacionados.';
  if (error?.code === '57014') return 'La consulta tardó demasiado. Intenta nuevamente.';
  return error?.message || 'No se pudo completar la operación.';
}

export async function fetchPage(client, filters, page, signal, sort = { column: 'LOTE', ascending: true }) {
  let query = client.schema('public').from(TABLE).select('*', { count: 'exact' });
  if (filters.linea) query = query.eq('LINEA', filters.linea);
  if (filters.codigo) query = query.eq('COD STD', filters.codigo);
  const search = filters.search?.trim();
  if (search) {
    const pattern = JSON.stringify(`%${search.replace(/[\\%_]/g, '\\$&')}%`);
    query = query.or(['LOTE', 'LINEA', 'COD STD'].map(name => `"${name}".ilike.${pattern}`).join(','));
  }
  const column = TABLE_FIELDS.includes(sort.column) ? sort.column : 'LOTE';
  const { data, count, error } = await query.order(column, { ascending: sort.ascending !== false, nullsFirst: false }).order('crud_id')
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1).abortSignal(signal);
  if (error) throw error;
  return { rows: data || [], count: count ?? 0 };
}

export async function fetchOptions(client, signal) {
  const values = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.schema('public').from(TABLE).select('"LINEA","COD STD"')
      .order('crud_id').range(offset, offset + 499).abortSignal(signal);
    if (error) throw error;
    values.push(...(data || []));
    if (!data || data.length < 500) break;
  }
  const options = name => [...new Set(values.map(row => row[name]).filter(value => value != null && String(value).trim()))]
    .sort((a, b) => String(a).localeCompare(String(b), 'es', { numeric: true }));
  return { lineas: options('LINEA'), codigos: options('COD STD') };
}

export async function saveRecord(client, original, payload) {
  const table = client.schema('public').from(TABLE);
  if (original && !original.crud_id) throw new Error('Este registro no tiene identificador. Actualiza la estructura de la tabla.');
  const query = original ? table.update(payload).eq('crud_id', original.crud_id) : table.insert(payload);
  const { data, error } = await query.select('crud_id').single();
  if (error) throw error;
  if (!data?.crud_id) throw new Error('No se confirmó el guardado. Revisa los permisos y vuelve a cargar los registros.');
  return data;
}

export async function deleteRecord(client, row) {
  if (!row.crud_id) throw new Error('Este registro no tiene identificador. Actualiza la estructura de la tabla.');
  const { data, error } = await client.schema('public').from(TABLE).delete().eq('crud_id', row.crud_id).select('crud_id').single();
  if (error) throw error;
  if (!data?.crud_id) throw new Error('No se confirmó la eliminación. Actualiza la lista y revisa tus permisos.');
}
