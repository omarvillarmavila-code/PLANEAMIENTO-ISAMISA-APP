import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import LoadingCircle from './LoadingCircle'
import { format, isValid, parseISO } from 'date-fns'
import { filterWeek } from '../lib/week'
import { useCalendarFilter } from '../lib/calendarFilter'

const number = (value) => Number(value || 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })
const percent = (value) => `${Number(value || 0).toFixed(2)}%`

export default function StagePopulationTable({ view, title, year = 'actual', week = 'actual' }) {
  const calendarFilter = useCalendarFilter()
  year = year === 'actual' ? calendarFilter.ano : year
  week = week === 'actual' ? calendarFilter.semana : week
  const [rows, setRows] = useState([]), [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    const schema = view.includes('reparticion') ? 'reparticion' : 'lumbra'
    supabase.schema(schema).from(view).select('*').order('fecha', { ascending: false }).then(({ data }) => {
      const records = filterWeek(data || [], year, week)
      const latest = records[0] ? String(records[0].fecha || '') : ''
      setRows(latest ? records.filter((row) => String(row.fecha || '') === latest) : records)
      setLoading(false)
    })
  }, [view, year, week])
  if (loading) return <div className="panel stage-table"><h3>{title}</h3><LoadingCircle text="Cargando tabla..." /></div>
  return <div className="panel stage-table"><div className="panel-head"><h3>{title}</h3></div><div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Línea</th><th>Saldo final hembra</th><th>Saldo final macho</th><th>% hembra</th><th>% macho</th><th>Total aves</th><th>% total</th></tr></thead><tbody>{rows.map((row, index) => { const date = parseISO(String(row.fecha || '')); return <tr key={index}><td>{isValid(date) ? format(date, 'dd/MM/yyyy') : '-'}</td><td>{row.linea || '-'}</td><td>{number(row.saldo_final_hembra)}</td><td>{number(row.saldo_final_macho)}</td><td>{percent(row.porcentaje_hembra)}</td><td>{percent(row.porcentaje_macho)}</td><td>{number(row.total_aves)}</td><td>{percent(row.porcentaje_total)}</td></tr> })}</tbody></table></div></div>
}
