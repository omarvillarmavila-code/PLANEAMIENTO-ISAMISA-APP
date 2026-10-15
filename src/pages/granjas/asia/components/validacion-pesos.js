// Correccion confirmada por el usuario: no modifica registros en Supabase.
export function excludeKnownWeightErrors(rows) {
  return rows.filter((row) => !(String(row.lote ?? '').trim().toUpperCase() === '26RN09'
    && Number(row.edad_pesaje_sem) === 5 && Number(row.peso_gr) > 6000));
}
