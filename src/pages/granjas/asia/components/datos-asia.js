import { buildReparticionData, numberOrNull } from '../../reparticion/components/datos-generales.js';
import { buildAsiaLotMetrics } from './metricas-lote.js';

export const CAMPAIGNS = [
  { key: 'TROZADO', label: 'Campaña trozado', colors: ['#f97316', '#fb923c', '#fdba74', '#ea580c'], lots: ['26RB04', '26RB07', '26RB08', '26RB14', '26RB18'] },
  { key: 'EMPACADO', label: 'Campaña Empacado', colors: ['#0ea5e9', '#38bdf8', '#7dd3fc', '#0284c7'], lots: ['26RB09', '26RB10', '26RB11', '26RB13', '26RB15', '26RB16', '26RB17', '26RN08', '26RN09'] },
  { key: 'CAMPAÑA VIVO', label: 'Campaña vivo', colors: ['#16a34a', '#4ade80', '#86efac', '#15803d'], lots: ['26RB19', '26RB20', '26RB21', '26RB22', '26RN10', '26RN11', '26RB24', '26RN12', '26RB23'] },
];
const norm = (v) => String(v ?? '').trim().toUpperCase();
const destination = new Map(CAMPAIGNS.flatMap((c) => c.lots.map((lot) => [lot, c.key])));
const completeSum = (values) => values.every((v) => v != null) ? values.reduce((a, b) => a + b, 0) : null;
export const campaignForLot = (lot) => destination.get(norm(lot)) ?? null;
export const isAsiaRecord = (row) => norm(row.Unid_Prod) === 'ASIA'
  || (norm(row.Unid_Prod) === 'TERCEROS - PAVOS' && campaignForLot(row.Cod_Lote) != null);

export function asiaDate(value) {
  const text = String(value ?? '').trim();
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  let y, m, d;
  if (match) [, y, m, d] = match.map(Number);
  else {
    match = /^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})$/.exec(text);
    if (!match) return null;
    [, d, m, y] = match.map(Number);
    if (match[3].length === 2) y += 2000;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
    ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
}

export function prepareAsiaRecords(input, calendar, options = {}) {
  const dates = new Map(calendar.map((r) => [r.fecha, r]));
  const rows = [], periods = new Map(), invalidDates = [], missingCalendar = [];
  for (const r of input) {
    if (!(options.isRecord ?? isAsiaRecord)(r)) continue;
    const fecha = asiaDate(r.Fecha);
    if (!fecha) { invalidDates.push(r.id); continue; }
    const day = dates.get(fecha);
    if (!day || day.ano == null || day.semana == null) { missingCalendar.push(fecha); continue; }
    const key = `${day.ano}-${day.semana}`;
    const period = periods.get(key) ?? { year: String(day.ano), week: String(day.semana), first: fecha, last: fecha };
    if (fecha < period.first) period.first = fecha;
    if (fecha > period.last) period.last = fecha;
    periods.set(key, period);
    rows.push({ ...r, Fecha: fecha, Cod_Lote: norm(r.Cod_Lote), Sexo: norm(r.Sexo), ano: day.ano, semana: day.semana, campaign: options.groupForRecord ? options.groupForRecord(r) : campaignForLot(r.Cod_Lote) });
  }
  return { rows, periods: [...periods.values()].sort((a, b) => +a.year - +b.year || +a.week - +b.week),
    invalidDates: invalidDates.length, missingCalendar: new Set(missingCalendar).size };
}

export function buildAsiaWeek(input, year, week, standards, options = {}) {
  const weekly = input.filter((r) => String(r.ano) === String(year) && String(r.semana) === String(week));
  const unassigned = [...new Set(weekly.filter((r) => !r.campaign).map((r) => r.Cod_Lote || 'SIN LOTE'))].sort();
  const campaigns = (options.groups ?? CAMPAIGNS).map((campaign) => {
    const rows = weekly.filter((r) => r.campaign === campaign.key);
    const stockRows = rows.filter((r) => norm(r.Valido || 'Y') === 'Y' && ['HEMBRA', 'MACHO'].includes(norm(r.Sexo))
      && (!options.stockDate || r.Fecha === options.stockDate));
    const lastDate = stockRows.map((r) => r.Fecha).sort().at(-1) ?? null;
    const lodgings = new Map();
    for (const r of stockRows.filter((r) => r.Fecha === lastDate)) {
      const key = JSON.stringify([norm(r.Linea_Madre) || 'SIN LÍNEA', r.Cod_Lote, r.Sexo, norm(r.Variedad), norm(r.Galpon), norm(r.Etapa)]);
      if (!lodgings.has(key)) lodgings.set(key, []);
      lodgings.get(key).push(r);
    }
    const lots = new Map(), detailGroups = new Map();
    for (const entries of lodgings.values()) {
      const r = entries[0], line = norm(r.Linea_Madre) || 'SIN LÍNEA';
      const key = JSON.stringify([line, r.Cod_Lote]);
      if (!lots.has(key)) lots.set(key, { linea: line, lote: r.Cod_Lote, hembras: [], machos: [], ages: [] });
      const lot = lots.get(key);
      const balances = [...new Set(entries.map((entry) => numberOrNull(entry.Saldo_Final)))];
      const balance = balances.length === 1 ? balances[0] : null;
      const color = norm(r.Variedad) || 'SIN COLOR';
      const detailKey = JSON.stringify([r.Cod_Lote, color, r.Sexo]);
      if (!detailGroups.has(detailKey)) detailGroups.set(detailKey, { lote: r.Cod_Lote, color, sexo: r.Sexo, balances: [], ages: [] });
      detailGroups.get(detailKey).balances.push(balance);
      detailGroups.get(detailKey).ages.push(...entries.map((entry) => numberOrNull(entry.Edad_sem)));
      lot[r.Sexo === 'HEMBRA' ? 'hembras' : 'machos'].push(balance);
      lot.ages.push(...entries.map((entry) => numberOrNull(entry.Edad_sem)).filter((n) => n != null));
    }
    const population = [...lots.values()].map((r) => ({ linea: r.linea, lote: r.lote,
      hembras: completeSum(r.hembras), machos: completeSum(r.machos),
      edad: r.ages.length ? Math.max(...r.ages) : null, fecha: lastDate, campaign: campaign.key,
    })).sort((a, b) => a.linea.localeCompare(b.linea) || a.lote.localeCompare(b.lote, undefined, { numeric: true }));
    const summary = { hembras: completeSum(population.map((r) => r.hembras)), machos: completeSum(population.map((r) => r.machos)) };
    const grouped = new Map();
    for (const r of population) {
      if (!grouped.has(r.linea)) grouped.set(r.linea, []);
      grouped.get(r.linea).push(r);
    }
    const lines = [...grouped].map(([name, entries], index) => {
      const hembras = completeSum(entries.map((r) => r.hembras)), machos = completeSum(entries.map((r) => r.machos));
      return { name, hembras, machos, value: hembras == null || machos == null ? null : hembras + machos, fill: campaign.colors[index % campaign.colors.length] };
    });
    const details = [...detailGroups.values()].map(({ balances, ages, ...r }) => ({ ...r, saldo: completeSum(balances),
      edad: ages.length && ages.every((age) => age != null) && new Set(ages).size === 1 ? ages[0] : null }))
      .sort((a, b) => a.lote.localeCompare(b.lote, undefined, { numeric: true }) || a.color.localeCompare(b.color) || a.sexo.localeCompare(b.sexo));
    const metrics = buildReparticionData(rows, options.farmNames ?? ['ASIA', 'TERCEROS - PAVOS']);
    return { ...campaign, population, summary, lines, details, lastDate, lotMetrics: buildAsiaLotMetrics(rows, standards),
      mortality: metrics.mortality, consumption: metrics.consumption, records: rows.length };
  });
  return { campaigns, unassigned, records: weekly.length,
    unknownSex: weekly.filter((r) => !['HEMBRA', 'MACHO'].includes(r.Sexo)).length };
}
