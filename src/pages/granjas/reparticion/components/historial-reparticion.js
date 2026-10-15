import { buildReparticionData, numberOrNull } from './datos-generales.js';
const norm = (v) => String(v ?? '').trim().toUpperCase();
const sum = (values) => values.length && values.every((v) => v != null) ? values.reduce((a, b) => a + b, 0) : null;
const percent = (value, base) => value != null && base > 0 ? value * 100 / base : null;
const valid = (r) => norm(r.Valido || 'Y') === 'Y';
const group = (rows, key) => {
  const result = new Map();
  for (const row of rows) { const k = key(row); if (!result.has(k)) result.set(k, []); result.get(k).push(row); }
  return result;
};

// Un saldo compartido por varias filas de alimento aporta una sola vez por
// fecha, etapa y galpón. Valores contradictorios permanecen sin dato.
function balances(rows, field) {
  return sum([...group(rows.filter(valid), (r) => JSON.stringify([r.Fecha, norm(r.Etapa), norm(r.Galpon)]))]
    .map(([, entries]) => {
      const values = [...new Set(entries.map((r) => numberOrNull(r[field])))];
      return values.length === 1 ? values[0] : null;
    }));
}

export function buildReparticionHistory(input, calendar) {
  const seen = new Set();
  const rows = input.filter((r) => {
    if (!['REPARTICIÓN', 'REPARTICION'].includes(norm(r.Unid_Prod)) || !['HEMBRA', 'MACHO'].includes(norm(r.Sexo))) return false;
    const key = JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k]) => !['id', 'created_at'].includes(k)).sort(([a], [b]) => a.localeCompare(b))));
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).sort((a, b) => a.Fecha.localeCompare(b.Fecha));
  const dates = new Map(calendar.map((r) => [r.fecha, r]));
  const weeks = group(rows.filter((r) => dates.has(r.Fecha)), (r) => JSON.stringify([dates.get(r.Fecha).ano, dates.get(r.Fecha).semana, norm(r.Linea_Madre), norm(r.Cod_Lote)]));
  const base = {};
  for (const sex of ['hembra', 'macho']) {
    const ageOne = rows.filter((r) => norm(r.Sexo) === sex.toUpperCase() && numberOrNull(r.Edad_sem) === 1 && valid(r));
    const first = ageOne[0]?.Fecha;
    base[sex] = balances(ageOne.filter((r) => r.Fecha === first), 'Saldo_Ini');
  }
  const history = [], consumption = [], saldos = [];
  for (const [key, weekly] of weeks) {
    const [ano, semana] = JSON.parse(key);
    consumption.push(...buildReparticionData(weekly).consumption.map((r) => ({ ...r, ano, semana })));
    for (const [etapa, stageRows] of group(weekly, (r) => norm(r.Etapa))) {
      const result = buildReparticionData(stageRows);
      const row = { ...result.mortality[0], ...result.production[0], ano, semana, etapa };
      const females = stageRows.filter((r) => norm(r.Sexo) === 'HEMBRA');
      row.saldo_final_hembra = balances(females, 'Saldo_Final');
      for (const sex of ['hembra', 'macho']) {
        const records = stageRows.filter((r) => norm(r.Sexo) === sex.toUpperCase() && valid(r));
        const last = records.at(-1)?.Fecha;
        const closingAges = records.filter((r) => r.Fecha === last).map((r) => numberOrNull(r.Edad_sem)).filter((v) => v != null);
        row[`edad_cierre_${sex}`] = closingAges.length ? Math.max(...closingAges) : null;
        const accumulated = balances(records.filter((r) => r.Fecha === last), 'Mortal_Acum');
        row[`mortalidad_acum_${sex}`] = accumulated;
        row[`porcentaje_mortalidad_acum_${sex}`] = percent(accumulated, base[sex]);
        row[`porcentaje_mortalidad_std_acum_${sex}`] = null;
      }
      history.push(row);
    }
  }
  for (const [, entries] of group(rows.filter(valid), (r) => JSON.stringify([r.Fecha, norm(r.Sexo), norm(r.Etapa)]))) {
    const first = entries[0];
    const metric = (field) => sum(entries.map((r) => r[field] == null || String(r[field]).trim() === '' ? 0 : numberOrNull(r[field])));
    saldos.push({ fecha: first.Fecha, cod_lote: first.Cod_Lote, sexo: norm(first.Sexo), etapa: norm(first.Etapa),
      edad_sem: Math.max(...entries.map((r) => numberOrNull(r.Edad_sem)).filter((v) => v != null)) || null,
      saldo_ini: balances(entries, 'Saldo_Ini'), saldo_final: balances(entries, 'Saldo_Final'),
      mortal: metric('Mortal'), desc_unid: metric('Desc_unid'), venta_unid: metric('Venta_unid') });
  }
  history.sort((a, b) => a.ano - b.ano || a.semana - b.semana || a.etapa.localeCompare(b.etapa));
  return { history, consumption, saldos };
}
