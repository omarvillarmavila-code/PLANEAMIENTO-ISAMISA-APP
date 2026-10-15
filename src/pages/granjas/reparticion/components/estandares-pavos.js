import { allPages } from '../../lumbra/components/consulta-granja.js';
import { TURKEY_LOT_ASSIGNMENTS } from './asignaciones-estandar.js';
const norm = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
const lotKey = (value) => norm(value).replace(/\s*-\s*/g, '-');
export function standardNumber(value) {
  if (value == null || String(value).trim() === '') return null;
  const text = String(value).trim().replace(',', '.');
  return /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text) ? Number(text) : null;
}
export function standardPercent(value) {
  if (value == null) return null;
  const text = String(value).trim();
  const number = standardNumber(text.replace(/%$/, '').trim());
  return number == null ? null : number * (text.endsWith('%') ? 1 : 100);
}
const uniqueValue = (rows, field, parse) => {
  if (!rows.length) return null;
  const values = rows.map((r) => parse(r[field]));
  const unique = new Set(values);
  return unique.size === 1 && values[0] != null ? values[0] : null;
};

export function applyTurkeyStandards(data, mappings, standards) {
  const codes = new Map();
  for (const mapping of mappings) {
    const lote = lotKey(mapping.LOTE), code = norm(mapping['COD STD']);
    if (!codes.has(lote)) codes.set(lote, new Set());
    if (code) codes.get(lote).add(code);
  }
  for (const mapping of TURKEY_LOT_ASSIGNMENTS) {
    const lote = lotKey(mapping.LOTE);
    if (!codes.get(lote)?.size) codes.set(lote, new Set([mapping['COD STD']]));
  }
  const index = new Map();
  const lineCodes = new Map();
  for (const row of standards) {
    const line = norm(row.linea), code = norm(row.codigo_estandar);
    if (line && code) {
      if (!lineCodes.has(line)) lineCodes.set(line, new Set());
      lineCodes.get(line).add(code);
    }
    const age = standardNumber(row.edad_sem);
    if (age == null) continue;
    const key = JSON.stringify([norm(row.codigo_estandar), age, norm(row.sexo)]);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(row);
  }
  const enrich = (row) => {
    const options = codes.get(lotKey(row.lote));
    const candidates = options?.size ? options : lineCodes.get(norm(row.linea));
    const code = candidates?.size === 1 ? [...candidates][0] : null;
    const result = { ...row, cod_std: code };
    for (const sex of ['hembra', 'macho']) {
      const age = standardNumber(Object.hasOwn(row, `edad_${sex}`) ? row[`edad_${sex}`] : row.edad ?? row.edad_lote);
      const matches = code && age != null ? index.get(JSON.stringify([code, age, sex.toUpperCase()])) ?? [] : [];
      result[`porcentaje_mortalidad_std_sem_${sex}`] = uniqueValue(matches, 'mort_sem', standardPercent);
      const closingAge = standardNumber(Object.hasOwn(row, `edad_cierre_${sex}`) ? row[`edad_cierre_${sex}`] : age);
      const closing = code && closingAge != null ? index.get(JSON.stringify([code, closingAge, sex.toUpperCase()])) ?? [] : [];
      result[`porcentaje_mortalidad_std_acum_${sex}`] = uniqueValue(closing, 'mort_acum', standardPercent);
      if (sex === 'hembra') {
        result.prod_hinc_std = uniqueValue(matches, 'prod_hinc', standardPercent);
        result.prod_hcom_std = uniqueValue(matches, 'prod_hcom', standardPercent);
      }
      const foods = new Map();
      for (const standard of matches) {
        const name = norm(standard.tipo_aabb) || 'SIN ALIMENTO';
        if (!foods.has(name)) foods.set(name, []);
        foods.get(name).push(standard);
      }
      const balance = standardNumber(row[`saldo_inicial_${sex}`]);
      result[`alimentos_std_${sex}`] = [...foods].map(([alimento, entries]) => {
        const daily = uniqueValue(entries, 'cons_aabb', standardNumber);
        return { alimento, g_ave_dia: daily, kg: daily != null && balance != null && balance >= 0 ? daily * balance * 7 / 1000 : null };
      });
      const amounts = result[`alimentos_std_${sex}`].map((food) => food.g_ave_dia);
      const daily = amounts.length && amounts.every((n) => n != null) ? amounts.reduce((a, b) => a + b, 0) : null;
      result[`consumo_std_g_ave_dia_${sex}`] = daily;
      result[`consumo_std_kg_${sex}`] = daily != null && balance != null && balance >= 0 ? daily * balance * 7 / 1000 : null;
      result[`standard_status_${sex}`] = !code
        ? candidates?.size > 1
          ? `Asigna el código estándar del lote: la línea tiene varias opciones (${[...candidates].join(', ')}).`
          : 'No hay código asignado al lote ni un estándar único disponible para su línea. Comprueba la lectura de estandares_pavos.'
        : age == null ? 'No hay edad registrada para este sexo.'
        : !matches.length ? `Sin coincidencia para código ${code}, edad ${age} y ${sex}.`
        : [result[`porcentaje_mortalidad_std_sem_${sex}`] == null ? 'Mortalidad estándar vacía o contradictoria.' : '',
          daily == null ? 'Consumo estándar vacío o contradictorio.' : ''].filter(Boolean).join(' ');
    }
    return result;
  };
  return Object.fromEntries(Object.entries(data).map(([key, rows]) => [key,
    ['history', 'mortality', 'production', 'consumption'].includes(key) ? rows.map(enrich) : rows]));
}

export async function loadTurkeyStandards(client, data, signal) {
  const lots = [...new Set(Object.values(data).flatMap((rows) => rows.map((r) => lotKey(r.lote))).filter(Boolean))];
  if (!lots.length) return data;
  // Filtrar después de normalizar: un .in() exacto descartaba códigos/lotes
  // válidos con espacios o diferencias de mayúsculas antes del cruce.
  const allMappings = await allPages(() => client.from('Resumen Lotes Cod STD').select('LOTE,"COD STD"')
    .order('LOTE'), signal);
  const mappings = allMappings.filter((r) => lots.includes(lotKey(r.LOTE)));
  // También se consulta sin asignaciones: una línea con una sola curva puede
  // compararse directamente; varias curvas requieren el COD STD explícito.
  const standards = await allPages(() => client.from('estandares_pavos')
    .select('codigo_estandar,linea,edad_sem,sexo,prod_hinc,prod_hcom,mort_sem,mort_acum,tipo_aabb,cons_aabb')
    .order('codigo_estandar').order('edad_sem').order('sexo').order('tipo_aabb'), signal);
  return applyTurkeyStandards(data, mappings, standards);
}
