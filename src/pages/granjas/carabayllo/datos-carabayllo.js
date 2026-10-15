import { prepareAsiaRecords, buildAsiaWeek } from '../asia/components/datos-asia.js';
import { buildAsiaLotMetrics } from '../asia/components/metricas-lote.js';
const norm = (value) => String(value ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
export const isCarabaylloRecord = (r) => norm(r.Unid_Prod) === 'CARABAYLLO';
const stage = (r) => norm(r.Etapa) || 'SIN ETAPA';
export function prepareCarabaylloRecords(rows, calendar) {
  return prepareAsiaRecords(rows, calendar, { isRecord: isCarabaylloRecord, groupForRecord: stage });
}
export function buildCarabaylloWeek(rows, year, week) {
  const own = rows.filter(isCarabaylloRecord);
  const weekly = own.filter((r) => String(r.ano) === String(year) && String(r.semana) === String(week));
  const stages = [...new Set(weekly.map(stage))].sort();
  const palette = [
    ['#f97316', '#fb923c', '#fdba74', '#ea580c'],
    ['#0ea5e9', '#38bdf8', '#7dd3fc', '#0284c7'],
    ['#16a34a', '#4ade80', '#86efac', '#15803d'],
  ];
  const groups = stages.map((key, i) => ({ key, label: key === 'SIN ETAPA' ? 'Sin etapa' : key,
    colors: palette[i % palette.length], lots: [] }));
  const stockDate = weekly.filter((r) => norm(r.Valido || 'Y') === 'Y' && ['HEMBRA', 'MACHO'].includes(norm(r.Sexo))).map((r) => r.Fecha).sort().at(-1);
  return { ...buildAsiaWeek(own, year, week, [], { groups, farmNames: ['CARABAYLLO'], stockDate }), rows: weekly };
}
export const carabaylloLotMetrics = (rows, group = 'TODAS') => buildAsiaLotMetrics(rows.filter((r) => group === 'TODAS' || r.campaign === group), []);
