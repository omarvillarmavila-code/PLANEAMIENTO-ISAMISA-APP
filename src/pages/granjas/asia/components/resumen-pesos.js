import { numberOrNull as num } from '../../reparticion/components/datos-generales.js';
import { buildAsiaLotMetrics } from './metricas-lote.js';
import { ASIA_STANDARDS } from './estandares-asia-datos.js';
const norm = (v) => String(v ?? '').trim().toUpperCase();
const sum = (values) => values.length && values.every((v) => v != null) ? values.reduce((a, b) => a + b, 0) : null;
export function sampleStatistics(values) {
  const sorted = values.map(num).filter((v) => v != null && v > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const n = sorted.length, mean = sorted.reduce((a, b) => a + b, 0) / n;
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const sd = n > 1 ? Math.sqrt(sorted.reduce((total, value) => total + (value - mean) ** 2, 0) / (n - 1)) : null;
  const cv = sd == null ? null : sd / mean * 100;
  return { mean, median, sd, cv, uniformity: cv == null ? null : 100 - cv, n, min: sorted[0], max: sorted.at(-1) };
}
function closingValues(rows, standards) {
  const last = rows.map((r) => r.Fecha).sort().at(-1);
  const groups = new Map();
  for (const r of rows.filter((r) => r.Fecha === last && norm(r.Valido || 'Y') === 'Y')) {
    const key = JSON.stringify([r.Galpon, r.Etapa, r.Sexo, r.Variedad]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const weighted = (get) => {
    let total = 0, birds = 0;
    for (const group of groups.values()) {
      const balances = group.map((r) => num(r.Saldo_Ini)), values = group.map(get);
      if (balances.some((v) => v == null || v < 0) || new Set(balances).size !== 1 || values.some((v) => v == null) || new Set(values).size !== 1) return null;
      total += balances[0] * values[0]; birds += balances[0];
    }
    return birds > 0 ? total / birds : null;
  };
  const standard = (r, field) => {
    const matches = standards.filter((s) => norm(s.color) === norm(r.Variedad) && norm(s.variedad) === norm(r.Linea_Madre) && norm(s.sexo) === norm(r.Sexo) && +s.edad_sem === num(r.Edad_sem));
    return matches.length === 1 ? num(matches[0][field]) : null;
  };
  const accumulatedDeaths = sum([...groups.values()].map((group) => {
    const values = group.map((r) => num(r.Mortal_Acum));
    return values.every((v) => v != null) && new Set(values).size === 1 ? values[0] : null;
  }));
  return { weight: weighted((r) => num(r.Peso_Ave)), cumulative: weighted((r) => num(r.Cons_Alim_Ave_Acu)),
    accumulatedDeaths, standardWeight: weighted((r) => standard(r, 'peso_gr')), standardCA: weighted((r) => standard(r, 'conversion_alimenticia')) };
}
export function buildLotHistory(lote, cutoff, weights, dailyRows, standards = ASIA_STANDARDS) {
  // El corte del pesaje solo aplica a muestras. El registro diario tiene su
  // propio historial por Edad_sem, que puede incluir pesos posteriores.
  const daily = dailyRows.filter((r) => norm(r.Cod_Lote) === norm(lote));
  const ages = new Map();
  const ageEntry = (age) => { if (!ages.has(age)) ages.set(age, { age, daily: [], samples: [] }); return ages.get(age); };
  for (const row of daily) { const age = num(row.Edad_sem); if (age != null) ageEntry(age).daily.push(row); }
  for (const row of weights.filter((r) => norm(r.lote) === norm(lote) && (!cutoff || r.fecha <= cutoff))) {
    const age = num(row.edad_pesaje_sem);
    ageEntry(age).samples.push(row);
  }
  return [...ages.values()].sort((a, b) => (a.age ?? Infinity) - (b.age ?? Infinity)).map((entry) => {
    const latest = entry.samples.map((r) => r.fecha).sort().at(-1);
    const sample = sampleStatistics(entry.samples.filter((r) => r.fecha === latest).map((r) => r.peso_gr));
    const metrics = buildAsiaLotMetrics(entry.daily, standards)[0];
    const sampleExistence = entry.age === 0
      ? buildAsiaLotMetrics(daily.filter((r) => num(r.Edad_sem) === 1), standards)[0]?.saldoInicial ?? null
      : metrics?.saldoInicial ?? null;
    const closing = closingValues(entry.daily, standards);
    const valid = entry.daily.filter((r) => norm(r.Valido || 'Y') === 'Y');
    const maximum = (field) => {
      const values = valid.map((r) => num(r[field])).filter((value) => value != null && value >= 0);
      return values.length ? Math.max(...values) : null;
    };
    const maximumWeight = maximum('Peso_Ave');
    const maximumCumulative = maximum('Cons_Alim_Ave_Acu');
    const totalMovement = (field) => sum(valid.map((r) => String(r[field] ?? '').trim() === '' ? 0 : num(r[field])));
    const sales = totalMovement('Venta_unid');
    const transfersOut = totalMovement('Transf_Sal');
    const weight = sample?.mean ?? null;
    return { age: entry.age, sample, hasDaily: entry.daily.length > 0, sampleExistence, existence: metrics?.saldoInicial ?? null,
      samplePct: sample && sampleExistence > 0 ? sample.n / sampleExistence * 100 : null,
      mortality: metrics?.muertes ?? null, mortalityPct: metrics?.mortalidad ?? null,
      accumulatedDeaths: closing.accumulatedDeaths, foodDetails: metrics?.alimentos ?? [],
      sales: sales === 0 ? transfersOut : sales,
      foods: [...new Set(entry.daily.map((r) => norm(r.Tipo_Alim)).filter(Boolean))].join(' / '), weight, dailyWeight: maximumWeight,
      standardWeight: closing.standardWeight, consumption: metrics?.consumoDiario ?? null,
      standardConsumption: metrics?.consumoEstandarDiario ?? null, foodKg: metrics?.consumoKg ?? null,
      standardFoodKg: metrics?.consumoEstandarKg ?? null,
      maximumCumulative,
      ca: maximumWeight > 0 && maximumCumulative != null ? maximumCumulative / maximumWeight : null, standardCA: closing.standardCA };
  });
}
export function lotChartSeries(input) {
  const columns = input.filter((column) => column.age != null);
  const names = [...new Set(columns.flatMap((c) => c.foodDetails.map((food) => food.alimento)))].sort();
  const foods = names.map((name, index) => ({ name, key: `food_${index}` }));
  const difference = (a, b) => a != null && b != null ? a - b : null;
  const rows = columns.map((column, index) => ({ ...column,
    weightDifference: difference(column.weight, column.standardWeight),
    foodDifference: difference(column.foodKg, column.standardFoodKg),
    weightGain: index > 0 && column.age === columns[index - 1].age + 1 ? difference(column.weight, columns[index - 1].weight) : null,
    ...Object.fromEntries(foods.map((food) => [food.key, column.foodDetails.find((f) => f.alimento === food.name)?.kg ?? (column.foodKg == null ? null : 0)])),
  }));
  return { rows, foods };
}
