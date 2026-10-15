const ORDER = ['CRIOLLO', 'ISAMISA', 'FRANCES', 'BARRADO', 'DEKALB'];
const COLORS = ['#2563eb', '#f97316', '#16a34a', '#9333ea', '#0891b2', '#e11d48', '#ca8a04', '#4f46e5'];

export function toConsumptionNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function consumptionBarRadius(row, series, key) {
  const value = row?.[key];
  if (value == null || value === 0) return [0, 0, 0, 0];
  const index = series.findIndex((food) => food.key === key);
  const hasOuterSegment = series.slice(index + 1).some((food) => value > 0 ? row[food.key] > 0 : row[food.key] < 0);
  if (hasOuterSegment) return [0, 0, 0, 0];
  return value > 0 ? [3, 3, 0, 0] : [0, 0, 3, 3];
}

export function foodColor(name) {
  let hash = 0;
  for (const character of name) hash = (hash * 31 + character.codePointAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}

export function standardFoodColor(name, baseColor = foodColor(name)) {
  const channels = baseColor.slice(1).match(/../g);
  return '#' + channels.map((channel) => {
    const value = parseInt(channel, 16);
    return Math.round(value + (255 - value) * 0.5).toString(16).padStart(2, '0');
  }).join('');
}

export function foodColors(rows) {
  const fields = ['alimentos_hembra', 'alimentos_macho', 'alimentos_std_hembra', 'alimentos_std_macho'];
  const names = [...new Set(rows.flatMap((row) => fields.flatMap((field) => foods(row[field]).map((food) => food.alimento))))].sort();
  const palette = new Map(), used = new Set();
  for (const name of names) {
    let color = foodColor(name);
    if (used.has(color)) color = COLORS.find((candidate) => !used.has(candidate));
    if (!color) {
      // Ampliar la paleta sin repetir colores cuando aparecen muchos alimentos.
      let value = 0x254f73;
      do {
        value = (value + 0x293a47) & 0xffffff;
        color = '#' + value.toString(16).padStart(6, '0');
      } while (used.has(color));
    }
    palette.set(name, color); used.add(color);
  }
  return palette;
}

function foods(value) {
  return Array.isArray(value) ? value.map((item) => ({
    alimento: String(item.alimento || 'SIN ALIMENTO'),
    kg: toConsumptionNumber(item.kg),
    g_ave_dia: toConsumptionNumber(item.g_ave_dia),
  })) : [];
}

export function buildConsumptionChart(rows, sexo, unit = 'kg') {
  const perBirdDay = unit === 'g_ave_dia';
  // Una paleta compartida por ambos sexos y por alimentos reales/esperados.
  const palette = foodColors(rows);
  const names = [...new Set(rows.flatMap((row) => foods(row[`alimentos_${sexo}`]).map((food) => food.alimento)))].sort();
  // Claves internas: los nombres de alimento pueden contener puntos o corchetes.
  const series = names.map((name, index) => ({ name, key: `alimento_${index}`, color: palette.get(name) }));
  const standardNames = [...new Set(rows.flatMap((row) => foods(row[`alimentos_std_${sexo}`]).map((food) => food.alimento)))].sort();
  const standardSeries = standardNames.map((name, index) => ({ name, key: `estandar_${index}`, color: standardFoodColor(name, palette.get(name)) }));
  const rank = (linea) => { const index = ORDER.indexOf(linea.toUpperCase()); return index < 0 ? ORDER.length : index; };
  const data = rows.map((row) => {
    const saldo = toConsumptionNumber(row[`saldo_inicial_${sexo}`]);
    const birdDays = toConsumptionNumber(row[`suma_saldos_diarios_${sexo}`]);
    const recordedDays = toConsumptionNumber(row[`dias_registrados_${sexo}`]);
    // La suma diaria incorpora los cambios de población y semanas parciales.
    // Todos los alimentos comparten el denominador del lote y sexo.
    const daily = (kg) => kg != null && birdDays > 0 ? kg * 1000 / birdDays : null;
    const actual = foods(row[`alimentos_${sexo}`]).map((food) => ({
      ...food, value: perBirdDay ? daily(food.kg) : food.kg, color: palette.get(food.alimento),
    }));
    const standard = foods(row[`alimentos_std_${sexo}`]).map((food) => ({
      ...food, value: perBirdDay ? food.g_ave_dia : food.kg,
      color: standardFoodColor(food.alimento, palette.get(food.alimento)),
    }));
    const amounts = new Map(actual.map((food) => [food.alimento, food.value]));
    const standardAmounts = new Map(standard.map((food) => [food.alimento, food.value]));
    // El estándar diario ya viene en g/ave/día; no volver a convertirlo.
    const standardTotal = toConsumptionNumber(row[`consumo_std_${perBirdDay ? 'g_ave_dia' : 'kg'}_${sexo}`]);
    const totalKg = toConsumptionNumber(row[`consumo_kg_${sexo}`]);
    return {
      linea: row.linea || 'SIN LINEA', lote: row.lote || 'SIN LOTE',
      edad: row.edad_lote ?? '—', codStd: row.cod_std || 'Sin estándar',
      saldo,
      birdDays, recordedDays,
      totalKg,
      total: perBirdDay ? daily(totalKg) : totalKg,
      standardTotal,
      actual, standard,
      ...Object.fromEntries(series.map(({ key, name }) => [key, perBirdDay && !(birdDays > 0) ? null : amounts.has(name) ? amounts.get(name) : actual.length ? 0 : null])),
      ...Object.fromEntries(standardSeries.map(({ key, name }) => [key, standardTotal == null ? null : standardAmounts.has(name) ? standardAmounts.get(name) : 0])),
    };
  }).sort((a, b) => rank(a.linea) - rank(b.linea)
    || a.linea.localeCompare(b.linea, undefined, { sensitivity: 'base' })
    || a.lote.localeCompare(b.lote, undefined, { numeric: true }));
  return { data, series, standardSeries };
}
