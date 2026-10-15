import { foodColors, toConsumptionNumber } from '../01.Datos_generales/consumo-por-lote.js';
import { agruparPeriodos } from './periodos-detalle.js';

function sumar(values) {
  const numbers = values.map(toConsumptionNumber);
  return numbers.length && numbers.every((value) => value != null)
    ? numbers.reduce((sum, value) => sum + value, 0) : null;
}

function alimentos(row, sexo) {
  const items = row[`alimentos_${sexo}`];
  if (Array.isArray(items) && items.length) return items.map((item) => ({
    alimento: String(item.alimento || 'SIN ALIMENTO'), kg: toConsumptionNumber(item.kg),
  }));
  const total = toConsumptionNumber(row[`consumo_kg_${sexo}`]);
  return total == null ? [] : [{ alimento: 'SIN DESGLOSE', kg: total }];
}

export function buildWeeklyConsumptionChart(rows, history, sexo) {
  const ages = new Map();
  const stages = new Map();
  const weekKey = (row) => JSON.stringify([Number(row.ano), Number(row.semana), row.linea, row.lote]);
  for (const row of history) {
    const age = toConsumptionNumber(row.edad);
    if (age == null) continue;
    const key = weekKey(row);
    ages.set(key, Math.max(ages.get(key) ?? -Infinity, age));
    const etapa = String(row.etapa ?? '').trim().toUpperCase();
    if (etapa) {
      if (!stages.has(key)) stages.set(key, []);
      stages.get(key).push({ edad: age, etapa });
    }
  }
  const timeline = rows.map((row) => ({
    ...row,
    // El consumo es semanal completo, incluso al cambiar de etapa.
    etapa: '',
    edad: ages.get(weekKey(row)) ?? row.edad_lote,
    alimentos_hembra: alimentos(row, 'hembra'),
    alimentos_macho: alimentos(row, 'macho'),
  }));
  const palette = foodColors(timeline);
  const names = [...new Set(timeline.flatMap((row) => row[`alimentos_${sexo}`].map((food) => food.alimento)))].sort();
  // Los nombres de alimento pueden contener puntos y corchetes.
  const series = names.map((name, index) => ({ name, key: `alimento_${index}`, color: palette.get(name) }));
  const data = agruparPeriodos(timeline).map(({ rows: entries, ...period }) => {
    const amounts = new Map();
    for (const row of entries) for (const food of row[`alimentos_${sexo}`]) {
      const previous = amounts.get(food.alimento);
      amounts.set(food.alimento, previous === undefined ? food.kg : sumar([previous, food.kg]));
    }
    const actual = [...amounts].map(([alimento, kg]) => ({ alimento, kg, color: palette.get(alimento) }));
    // El fondo usa la etapa de la ultima edad de la semana, sin dividir
    // ni duplicar el total semanal cuando hay un cambio de etapa.
    const cierre = entries.flatMap((row) => stages.get(weekKey(row)) ?? [])
      .sort((a, b) => b.edad - a.edad || b.etapa.localeCompare(a.etapa))[0];
    return {
      ...period,
      etapa: cierre?.etapa ?? '',
      actual,
      consumo: sumar(entries.map((row) => row[`consumo_kg_${sexo}`])),
      // La vista entrega kg semanales; no volver a convertir ni acumular.
      estandar: sumar(entries.map((row) => row[`consumo_std_kg_${sexo}`])),
      ...Object.fromEntries(series.map(({ key, name }) =>
        [key, amounts.has(name) ? amounts.get(name) : actual.length ? 0 : null])),
    };
  });
  return { data, series };
}
