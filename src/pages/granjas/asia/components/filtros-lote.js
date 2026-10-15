const norm = (value) => String(value ?? '').trim().toUpperCase();
export function filterDailyIdentity(rows, sexo = '', color = '') {
  return rows.filter((r) => (!sexo || norm(r.Sexo) === sexo) && (!color || norm(r.Variedad) === color));
}
export function filterWeightIdentity(weights, dailyRows, sexo = '', color = '') {
  if (!sexo && !color) return weights;
  const cache = new Map();
  return weights.filter((weight) => {
    const key = JSON.stringify([weight.lote, weight.fecha, weight.semana_cal]);
    if (!cache.has(key)) {
      const sameLot = dailyRows.filter((r) => norm(r.Cod_Lote) === norm(weight.lote) && norm(r.Valido || 'Y') === 'Y');
      const exact = sameLot.filter((r) => r.Fecha === weight.fecha);
      const source = exact.length ? exact : sameLot.filter((r) => String(r.ano) === String(weight.fecha).slice(0, 4) && Number(r.semana) === Number(weight.semana_cal));
      const matches = (field, selected) => !selected || source.length > 0 && source.every((r) => norm(r[field]) === selected);
      // Un pesaje sin sexo/color individual no se reparte entre poblaciones mixtas.
      cache.set(key, matches('Sexo', sexo) && matches('Variedad', color));
    }
    return cache.get(key);
  });
}
