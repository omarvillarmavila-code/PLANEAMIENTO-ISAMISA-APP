export function isoWeek(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = utc.getUTCDay() || 7
  utc.setUTCDate(utc.getUTCDate() + 4 - day)
  const year = utc.getUTCFullYear()
  const start = new Date(Date.UTC(year, 0, 1))
  return { year, week: Math.ceil((((utc - start) / 86400000) + 1) / 7) }
}
export function filterWeek(rows, year, week) {
  if (year === 'actual' || week === 'actual') return rows
  return rows.filter((row) => {
    if (row.ano !== undefined && row.semana !== undefined) return String(row.ano) === String(year) && String(row.semana) === String(week)
    const value = isoWeek(row.fecha)
    return value && String(value.year) === String(year) && String(value.week) === String(week)
  })
}
