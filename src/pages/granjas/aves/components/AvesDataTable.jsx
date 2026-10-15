import React, { useEffect, useMemo, useState } from 'react'
import { flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import { ArrowDownUp, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { supabase } from '../../../../lib/supabase'
import LoadingCircle from '../../../../components/LoadingCircle'

// Tabla reutilizable con búsqueda, ordenación y paginación.
export default function AvesDataTable({ title, tipo }) {
  const [rows, setRows] = useState([]), [loading, setLoading] = useState(true), [filter, setFilter] = useState(''), [sorting, setSorting] = useState([])
  useEffect(() => {
    setLoading(true)
    supabase.from('registro_diario_granja').select('Fecha,Unid_Prod,Linea_Madre,Cod_Lote,Sexo,Etapa,Edad_sem,Saldo_Final').order('Fecha', { ascending: false })
      .then(({ data }) => { const result = (data || []).filter((row) => tipo === 'reproductoras' ? /POSTURA|LEVANTE/i.test(row.Etapa || '') : /ENGORDE/i.test(row.Etapa || '')); setRows(result); setLoading(false) })
  }, [tipo])
  const columns = useMemo(() => [
    { accessorKey: 'Fecha', header: 'Fecha' }, { accessorKey: 'Unid_Prod', header: 'Unidad' }, { accessorKey: 'Linea_Madre', header: 'Línea' },
    { accessorKey: 'Cod_Lote', header: 'Lote' }, { accessorKey: 'Sexo', header: 'Sexo' }, { accessorKey: 'Etapa', header: 'Etapa' },
    { accessorKey: 'Edad_sem', header: 'Edad' }, { accessorKey: 'Saldo_Final', header: 'Saldo final', cell: (info) => Number(info.getValue() || 0).toLocaleString('es-PE', { maximumFractionDigits: 0 }) },
  ], [])
  const table = useReactTable({ data: rows, columns, state: { globalFilter: filter, sorting }, onGlobalFilterChange: setFilter, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(), initialState: { pagination: { pageSize: 10 } } })
  return <div className="panel stage-table farm-data-table"><div className="panel-head"><h3>{title}</h3><span className="muted">{table.getFilteredRowModel().rows.length} registros</span></div><div className="table-toolbar"><label className="table-search"><Search size={15} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Buscar..." /></label></div>{loading ? <LoadingCircle text="Cargando datos..." /> : <><div className="table-scroll"><table><thead><tr>{table.getHeaderGroups()[0].headers.map((header) => <th key={header.id}><button className="sort-button" onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}<ArrowDownUp size={12} /></button></th>)}</tr></thead><tbody>{table.getRowModel().rows.map((row) => <tr key={row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell || ((info) => info.getValue() || '-'), cell.getContext())}</td>)}</tr>)}</tbody></table></div><div className="table-footer"><span>Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount() || 1}</span><div className="pagination"><button disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}><ChevronLeft size={15} /></button><button disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}><ChevronRight size={15} /></button></div></div></>}</div>
}
