function dateDay(value) {
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
  const stamp = Date.UTC(y, m - 1, d), date = new Date(stamp);
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? stamp / 86400000 : null;
}
export function completedWeeks(birth, sample) {
  const start = dateDay(birth), end = dateDay(sample);
  return start == null || end == null || end < start ? null : Math.floor((end - start) / 7);
}
export function withSampleAges(weights, dailyRows) {
  const starts = new Map();
  for (const row of dailyRows) {
    const key = String(row.Cod_Lote ?? '').trim().toUpperCase();
    if (!String(row.Fecha_Ing ?? '').trim()) continue;
    if (!starts.has(key)) starts.set(key, []);
    starts.get(key).push(dateDay(row.Fecha_Ing));
  }
  return weights.map((row) => {
    const values = starts.get(String(row.lote ?? '').trim().toUpperCase()) ?? [];
    const day = values.length && values.every((v) => v != null) && new Set(values).size === 1 ? values[0] : null;
    const start = day == null ? null : new Date(day * 86400000).toISOString().slice(0, 10);
    return { ...row, fecha_inicio: start, edad_pesaje_sem: completedWeeks(start, row.fecha) };
  });
}
