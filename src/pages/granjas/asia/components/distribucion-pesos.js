const classes = ['A', 'B', 'C', 'D', 'E', 'F'];
const numeric = (v) => v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null;
export function withDailyIdentity(charts, dailyRows, year, week) {
  const norm = (v) => String(v ?? '').trim().toUpperCase();
  return charts.map((chart) => {
    const weekly = dailyRows.filter((r) => norm(r.Cod_Lote) === norm(chart.lote)
      && String(r.ano) === String(year) && Number(r.semana) === Number(week)
      && norm(r.Valido || 'Y') === 'Y');
    const exact = weekly.filter((r) => r.Fecha === chart.fecha);
    const source = exact.length ? exact : weekly;
    const identity = (field) => {
      if (!source.length || source.some((r) => !norm(r[field]))) return null;
      return [...new Set(source.map((r) => norm(r[field])))].sort().join(' / ');
    };
    return { ...chart, sexo: identity('Sexo'), color: identity('Variedad'),
      identitySource: exact.length ? 'Registro diario de la fecha del pesaje' : source.length ? 'Registro diario de la semana seleccionada' : 'Sin registro diario para este lote y semana' };
  });
}
export function buildWeightDistributions(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = JSON.stringify([row.fecha, row.lote, row.tipo_produccion]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([key, sample]) => {
    const first = sample[0];
    const weights = sample.map((row) => numeric(row.peso_gr));
    const recalculate = weights.every((value) => value != null && value > 0);
    const min = recalculate ? Math.min(...weights) : numeric(first.peso_minimo_gr);
    const max = recalculate ? Math.max(...weights) : numeric(first.peso_maximo_gr);
    const range = min == null || max == null ? null : (max - min) / 6;
    const bins = classes.map((clase, i) => ({ clase, aves: 0,
      min: range == null ? null : min + i * range,
      max: range == null ? null : i === 5 ? max : min + (i + 1) * range }));
    for (const row of sample) {
      const index = recalculate ? range === 0 ? 0 : Math.min(5, Math.max(0, Math.floor((numeric(row.peso_gr) - min) / range))) : -1;
      const bin = recalculate ? bins[index] : bins.find((b) => b.clase === row.clase);
      if (bin) bin.aves++;
    }
    const total = bins.reduce((sum, b) => sum + b.aves, 0);
    const unique = (field) => {
      const values = [...new Set(sample.map((r) => r[field]))];
      return values.length === 1 ? values[0] : null;
    };
    return { key, fecha: first.fecha, lote: first.lote, tipo: first.tipo_produccion,
      edad: unique('edad_pesaje_sem') ?? null, sexo: unique('sexo'), color: unique('color'),
      saldo: unique('saldo_inicial'), total,
      incomplete: sample.some((r) => r.estado_cruce !== 'OK'),
      bins: bins.map((b) => ({ ...b, frecuencia: total ? b.aves / total * 100 : 0 })) };
  }).sort((a, b) => a.lote.localeCompare(b.lote) || a.fecha.localeCompare(b.fecha) || String(a.tipo ?? '').localeCompare(String(b.tipo ?? '')));
}
