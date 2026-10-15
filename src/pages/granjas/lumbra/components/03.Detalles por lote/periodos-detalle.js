export function agruparPeriodos(rows, year) {
  const periods = new Map();
  for (const row of rows) {
    const ano = Number(row.ano ?? year);
    const semana = Number(row.semana);
    const etapa = row.etapa == null ? '' : String(row.etapa);
    const periodo = `${ano}-${semana}${etapa ? `-${etapa}` : ''}`;
    if (!periods.has(periodo)) periods.set(periodo, { periodo, ano, semana, etapa, rows: [], edades: new Set() });
    const group = periods.get(periodo);
    group.rows.push(row);
    const rawAge = row.edad ?? row.edad_lote;
    if (rawAge != null && String(rawAge).trim() !== '' && Number.isFinite(Number(rawAge))) {
      group.edades.add(Number(rawAge));
    }
  }
  return [...periods.values()].map(({ edades, ...group }) => {
    const sorted = [...edades].sort((a, b) => a - b);
    const edad = !sorted.length ? '—' : sorted.length === 1 ? String(sorted[0]) : `${sorted[0]}–${sorted.at(-1)}`;
    return { ...group, edad, edadMin: sorted[0] ?? null };
  }).sort((a, b) => a.ano - b.ano || a.semana - b.semana
    || (a.edadMin ?? Infinity) - (b.edadMin ?? Infinity) || a.etapa.localeCompare(b.etapa));
}
