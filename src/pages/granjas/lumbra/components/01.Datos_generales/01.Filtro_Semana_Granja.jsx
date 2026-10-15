import React, { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../../../../lib/supabase'
import { allPages, queryMessage, sharedQuery } from '../consulta-granja'

// Formatea el inicio y fin del periodo seleccionado.
const formatDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'

// Tarjeta de filtros de año y semana para la granja Lumbra.
export default function LumbraFiltroSemanaGranja({ onChange, year: selectedYear, week: selectedWeek, farm = "LUMBRA", farmLabel = "Lumbra" }) {
  // Estados de periodos, año y semana seleccionados.
  const [periods, setPeriods] = useState([])
  const [year, setYear] = useState(selectedYear || '')
  const [week, setWeek] = useState(selectedWeek || '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const current = useRef({ onChange, selectedYear, selectedWeek })
  current.current = { onChange, selectedYear, selectedWeek }

  // Mantiene ambos selectores de periodo sincronizados entre las pestañas abiertas.
  useEffect(() => {
    if (selectedYear !== undefined) setYear(selectedYear)
    if (selectedWeek !== undefined) setWeek(selectedWeek)
  }, [selectedYear, selectedWeek])

  // Consulta únicamente los periodos con datos de Lumbra en la vista pública.
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    sharedQuery(`periodos:${farm}`, (signal) => {
      if (!supabase) throw new Error('Supabase no está configurado')
      return allPages(() => supabase.rpc('app_periodos_granja', { p_farm: farm })
        .select('granja,ano,semana,fecha_inicio_semana,fecha_maxima').eq('granja', farm)
        .order('ano').order('semana'), signal)
    }).then((rows) => {
      if (!active) return
      const { onChange: notify, selectedYear: previousYear, selectedWeek: previousWeek } = current.current
      const latestYear = rows.reduce((max, row) => Math.max(max, Number(row.ano)), 0)
      const nextYear = rows.some((row) => String(row.ano) === String(previousYear)) ? String(previousYear) : String(latestYear || 'actual')
      const yearRows = rows.filter((row) => String(row.ano) === nextYear)
      const latestWeek = Math.max(...yearRows.map((row) => Number(row.semana)), 0)
      const nextWeek = yearRows.some((row) => String(row.semana) === String(previousWeek)) ? String(previousWeek) : String(latestWeek || 'actual')
      setPeriods(rows)
      setYear(nextYear)
      setWeek(nextWeek)
      notify?.({ year: nextYear, week: nextWeek })
    }).catch((error) => {
      if (active) {
        console.error('Error cargando semanas de Lumbra:', error)
        setError(queryMessage(error))
      }
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [attempt, farm])

  // Años que tienen información para Lumbra.
  const years = useMemo(() => [...new Set(periods.map((row) => String(row.ano)))].sort((a, b) => Number(a) - Number(b)), [periods])
  // Semanas disponibles dentro del año seleccionado.
  const weeks = useMemo(() => periods.filter((row) => String(row.ano) === String(year)).filter((row, index, rows) => rows.findIndex((item) => Number(item.semana) === Number(row.semana)) === index).sort((a, b) => Number(a.semana) - Number(b.semana)), [periods, year])
  const selectedPeriod = weeks.find((row) => String(row.semana) === String(week))

  // Cambia el año y selecciona su semana más reciente.
  const changeYear = (event) => {
    const value = event.target.value
    const latest = Math.max(...periods.filter((row) => String(row.ano) === value).map((row) => Number(row.semana)), 0)
    const nextWeek = latest ? String(latest) : 'actual'
    setYear(value)
    setWeek(nextWeek)
    onChange?.({ year: value, week: nextWeek })
  }

  // Cambia la semana seleccionada y notifica los filtros a la página.
  const changeWeek = (event) => {
    const value = event.target.value
    setWeek(value)
    onChange?.({ year, week: value })
  }

  return <div className="weekly-filter panel">
    {loading && <span role="status">Cargando semanas disponibles...</span>}
    {error && <div role="alert"><span>{error}</span> <button type="button" onClick={() => setAttempt((value) => value + 1)}>Reintentar</button></div>}
    {!loading && !error && !periods.length && <span>No hay semanas disponibles para {farmLabel}.</span>}
    {/* Selector de año con los años que tienen datos. */}
    <label>Año<select disabled={loading || !periods.length} value={year} onChange={changeYear}><option value="">Seleccione</option>{years.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
    {/* Selector de semana dependiente del año elegido. */}
    <label>Semana<select disabled={loading || !periods.length} value={week} onChange={changeWeek}><option value="">Seleccione</option>{weeks.map((row) => <option key={row.semana} value={row.semana}>Sem {row.semana}</option>)}</select></label>
    {/* Rango de fechas de la semana seleccionada. */}
    {selectedPeriod && <div className="week-range"><span>Inicio: <strong>{formatDate(selectedPeriod.fecha_inicio_semana)}</strong></span><span>Fin: <strong>{formatDate(selectedPeriod.fecha_maxima)}</strong></span></div>}
  </div>
}
