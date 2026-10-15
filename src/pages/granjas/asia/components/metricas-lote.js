import { numberOrNull } from '../../reparticion/components/datos-generales.js';
import { lotConsumptionStandard } from './estandares-asia.js';
const norm = (value) => String(value ?? '').trim().toUpperCase();
const sum = (values) => values.length && values.every((n) => n != null) ? values.reduce((a, b) => a + b, 0) : null;

export function buildAsiaLotMetrics(input, standards) {
  const groups = new Map(), seen = new Set();
  for (const row of input) {
    const business = JSON.stringify(Object.fromEntries(Object.entries(row).filter(([k]) => !['id', 'created_at'].includes(k)).sort(([a], [b]) => a.localeCompare(b))));
    if (seen.has(business)) continue;
    seen.add(business);
    const lot = norm(row.Cod_Lote) || 'SIN LOTE';
    if (!groups.has(lot)) groups.set(lot, []);
    groups.get(lot).push(row);
  }
  return [...groups].map(([lote, rows]) => {
    const dates = [...new Set(rows.map((r) => r.Fecha))].sort();
    const housing = new Map(), food = new Map();
    const population = rows.filter((r) => norm(r.Valido || 'Y') === 'Y');
    for (const r of population) {
      const key = JSON.stringify([r.Fecha, norm(r.Galpon), norm(r.Etapa), norm(r.Sexo), norm(r.Variedad)]);
      if (!housing.has(key)) housing.set(key, []);
      housing.get(key).push(numberOrNull(r.Saldo_Ini));
    }
    const balances = [...housing].map(([key, values]) => ({ date: JSON.parse(key)[0],
      value: values.every((n) => n != null && n >= 0) && new Set(values).size === 1 ? values[0] : null }));
    const saldoInicial = sum(balances.filter((r) => r.date === dates[0]).map((r) => r.value));
    const birdDays = dates.every((date) => balances.some((r) => r.date === date)) ? sum(balances.map((r) => r.value)) : null;
    const muertes = sum(population.map((r) => r.Mortal == null || String(r.Mortal).trim() === '' ? 0 : numberOrNull(r.Mortal)));
    const consumoKg = sum(rows.map((r) => numberOrNull(r.Cons_Alim)));
    const daily = (kg) => kg != null && birdDays > 0 ? kg * 1000 / birdDays : null;
    for (const r of rows) {
      const name = norm(r.Tipo_Alim) || 'SIN ALIMENTO';
      if (!food.has(name)) food.set(name, []);
      food.get(name).push(numberOrNull(r.Cons_Alim));
    }
    const ages = rows.map((r) => numberOrNull(r.Edad_sem)).filter((n) => n != null);
    return { lote, linea: [...new Set(rows.map((r) => norm(r.Linea_Madre)).filter(Boolean))].join(' / ') || 'SIN LÍNEA',
      edad: ages.length ? Math.max(...ages) : null, saldoInicial, muertes,
      mortalidad: muertes != null && saldoInicial > 0 ? muertes * 100 / saldoInicial : null,
      consumoKg, birdDays, dias: dates.length, consumoDiario: daily(consumoKg),
      alimentos: [...food].map(([alimento, values]) => { const kg = sum(values); return { alimento, kg, diario: daily(kg) }; }),
      ...lotConsumptionStandard(rows, standards),
    };
  }).sort((a, b) => a.lote.localeCompare(b.lote, undefined, { numeric: true }));
}
