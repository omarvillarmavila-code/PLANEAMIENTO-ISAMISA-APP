import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import LoadingCircle from './LoadingCircle'
import { format, isValid, parseISO } from 'date-fns'

const stages = ['LEVANTE', 'POSTURA', 'MUDA']
const fields = [
  ['saldo_ini', 'Saldo inicial'], ['transf_ing', 'Transferencia de ingreso'],
  ['transf_sal', 'Transferencia de salida'], ['venta_unid', 'Venta'],
  ['mortal', 'Mortalidad'], ['desc_unid', 'Descarte'], ['saldo_final', 'Saldo final'],
]

// Tabla agrupada por fecha/edad y por etapa del lote.
export default function LoteDetailPanel({ sexo = 'HEMBRA', sinFiltro = false, farm = 'lumbra' }) {
  const isReparticion = farm === 'reparticion'
  const schema = isReparticion ? 'reparticion' : 'lumbra'
  const saldoView = isReparticion ? 'vista_saldos_por_lote_reparticion' : 'vista_saldos_por_lote'
  const optionsView = isReparticion ? 'resumen_especie_linea_lote_reparticion' : 'resumen_especie_linea_lote_lumbra'
  const eventName = isReparticion ? 'reparticion-lote-change' : 'lumbra-lote-change'
  const [options, setOptions] = useState([])
  const [selectedLote, setSelectedLote] = useState('')
  const [rows, setRows] = useState([]), [loading, setLoading] = useState(false)

  // Sincroniza el lote elegido entre las tablas de hembras y machos.
  useEffect(() => {
    const sync = (event) => setSelectedLote(event.detail || '')
    window.addEventListener(eventName, sync)
    return () => window.removeEventListener(eventName, sync)
  }, [])

  useEffect(() => {
    supabase.schema(schema).from(optionsView).select('*').order('especie').order('linea').order('cod_lote')
      .then(({ data }) => setOptions(data || []))
  }, [])

  useEffect(() => {
    if (!selectedLote) return setRows([])
    setLoading(true)
    supabase.schema(schema).from(saldoView).select('*').eq('cod_lote', selectedLote).eq('sexo', sexo).order('fecha', { ascending: true })
      .then(async ({ data, error }) => {
        if (!error) { setRows(data || []); setLoading(false); return }
        const fallback = await supabase.from('registro_diario_granja')
          .select('Fecha,Cod_Lote,Sexo,Etapa,Edad_sem,Mortal,Desc_unid,Venta_unid,Transf_Ing,Transf_Sal,Saldo_Ini,Saldo_Final,Valido,Unid_Prod')
          .eq('Cod_Lote', selectedLote).eq('Unid_Prod', isReparticion ? 'REPARTICIÓN' : 'LUMBRA').eq('Sexo', sexo).eq('Valido', 'Y').order('Fecha', { ascending: true })
        setRows((fallback.data || []).map((row) => ({ fecha: row.Fecha, cod_lote: row.Cod_Lote, sexo: row.Sexo, etapa: row.Etapa, edad_sem: row.Edad_sem, mortal: row.Mortal, desc_unid: row.Desc_unid, venta_unid: row.Venta_unid, transf_ing: row.Transf_Ing, transf_sal: row.Transf_Sal, saldo_ini: row.Saldo_Ini, saldo_final: row.Saldo_Final, valido: row.Valido }))); setLoading(false)
      })
  }, [selectedLote, sexo, saldoView, optionsView, eventName, isReparticion])

  const visibleRows = rows
  const grouped = useMemo(() => {
    const map = new Map()
    visibleRows.forEach((row) => {
      const key = `${row.fecha}|${row.edad_sem}`
      if (!map.has(key)) map.set(key, { fecha: row.fecha, edad: row.edad_sem, stages: {} })
      const name = String(row.etapa || '').toUpperCase()
      const stage = stages.find((value) => name.includes(value))
      if (stage) map.get(key).stages[stage] = row
    })
    return [...map.values()].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
  }, [visibleRows])

  // Los ceros se muestran como guion para facilitar la lectura.
  const formatDate = (date) => {
    const parsed = parseISO(String(date || ''))
    return isValid(parsed) ? format(parsed, 'dd/MM/yyyy') : '-'
  }

  const value = (row, field) => {
    const result = row?.[field]
    if (result === null || result === undefined || result === '' || Number(result) === 0) return '-'
    // Formato español: separador decimal coma y dos decimales.
    const numeric = Number(result)
    return Number.isNaN(numeric) ? result : numeric.toLocaleString('es-PE', { maximumFractionDigits: 0 })
  }

  return <div className="panel stage-table lote-table">
    <strong className="stage-pie-title">Saldos por lote{selectedLote ? ` · Lote ${selectedLote} · Sexo ${sexo}` : ''}</strong>
    <div className="table-toolbar lote-filters">
      <select value={selectedLote} onChange={(event) => { setSelectedLote(event.target.value); window.dispatchEvent(new CustomEvent('lumbra-lote-change', { detail: event.target.value })) }}>
        <option value="">Seleccione un lote</option>
        {options.map((option, index) => <option key={index} value={option.cod_lote}>{option.especie} · {option.linea} · {option.cod_lote}</option>)}
      </select>
    </div>
    {selectedLote && (loading ? <LoadingCircle text={`Cargando saldos ${sexo.toLowerCase()}...`} /> : <div className="table-scroll"><table><thead>
      <tr><th rowSpan="2">Fecha</th><th rowSpan="2">Edad</th>{stages.map((stage) => <th key={stage} colSpan={fields.length}>{stage}</th>)}</tr>
      <tr>{stages.flatMap((stage) => fields.map(([field, label]) => <th key={`${stage}-${field}`}>{label}</th>))}</tr>
    </thead><tbody>{grouped.map((group, index) => <tr key={index}>
      <td>{formatDate(group.fecha)}</td><td>{group.edad}</td>
      {stages.flatMap((stage) => fields.map(([field]) => <td key={`${stage}-${field}`}>{value(group.stages[stage], field)}</td>))}
    </tr>)}</tbody></table></div>)}
  </div>
}
