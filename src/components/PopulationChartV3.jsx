import React, { useEffect, useMemo, useState } from 'react'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { supabase } from '../lib/supabase'
import LoadingCircle from './LoadingCircle'
import { filterWeek } from '../lib/week'
import { useCalendarFilter } from '../lib/calendarFilter'

function PopulationTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return <div className="chart-tooltip"><strong>{item.name}</strong><div>Hembras: {item.hembras.toLocaleString('es-PE', { maximumFractionDigits: 0 })} ({item.porcentajeHembras}%)</div><div>Machos: {item.machos.toLocaleString('es-PE', { maximumFractionDigits: 0 })} ({item.porcentajeMachos}%)</div><div>Total: {item.value.toLocaleString('es-PE', { maximumFractionDigits: 0 })} ({item.porcentajeTotal}%)</div></div>
}

export default function PopulationChart({ view, title, colors, year = 'actual', week = 'actual' }) {
  const calendarFilter = useCalendarFilter()
  year = year === 'actual' ? calendarFilter.ano : year
  week = week === 'actual' ? calendarFilter.semana : week
  const [rows, setRows] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('')
  useEffect(() => {
    setLoading(true)
    const schema = view.includes('reparticion') ? 'reparticion' : 'lumbra'
    const table = view
    supabase.schema(schema).from(table).select('*').order('fecha', { ascending: false }).then(({ data, error: queryError }) => {
      // Las tarjetas y la dona usan solamente la fecha más reciente de la vista.
      const records = filterWeek(data || [], year, week)
      const latest = records[0] ? String(records[0].fecha || '') : ''
      setRows(latest ? records.filter((row) => String(row.fecha || '') === latest) : records)
      setError(queryError?.message || '')
      setLoading(false)
    })
  }, [view, year, week])
  const data = useMemo(() => {
    const grouped = {}
    rows.forEach((row) => { const name = row.linea || 'Sin línea'; grouped[name] ||= { h: 0, m: 0 }; grouped[name].h += Number(row.saldo_final_hembra || 0); grouped[name].m += Number(row.saldo_final_macho || 0) })
    const totalGeneral = Object.values(grouped).reduce((sum, item) => sum + item.h + item.m, 0)
    return Object.entries(grouped).filter(([, item]) => item.h !== 0).map(([name, item], index) => { const value = item.h + item.m; return { name, value, hembras: item.h, machos: item.m, porcentajeHembras: value ? (item.h / value * 100).toFixed(2) : '0.00', porcentajeMachos: value ? (item.m / value * 100).toFixed(2) : '0.00', porcentajeTotal: totalGeneral ? (value / totalGeneral * 100).toFixed(2) : '0.00', fill: colors[index % colors.length] } })
  }, [rows, colors])
  const hembras = rows.reduce((sum, row) => sum + Number(row.saldo_final_hembra || 0), 0), machos = rows.reduce((sum, row) => sum + Number(row.saldo_final_macho || 0), 0)
  return <div className="panel population-chart-card"><strong className="stage-pie-title">{title}</strong>{loading ? <LoadingCircle text="Cargando gráfico..." /> : <><div className="stage-summary"><div><small>Hembras</small><strong>{hembras.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</strong></div><div><small>Machos</small><strong>{machos.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</strong></div></div><ResponsiveContainer width="100%" height={330}><PieChart><Legend layout="vertical" align="left" verticalAlign="middle" width={100} /><Pie data={data} dataKey="value" nameKey="name" cx="62%" cy="45%" innerRadius={52} outerRadius={85} label={({ porcentajeTotal }) => `${porcentajeTotal}%`} labelLine={false}>{data.map((item) => <Cell key={item.name} fill={item.fill} />)}</Pie><Tooltip content={<PopulationTooltip />} /></PieChart></ResponsiveContainer></>}</div>
}
