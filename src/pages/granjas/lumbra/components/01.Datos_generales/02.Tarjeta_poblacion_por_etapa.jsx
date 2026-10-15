import React,{useEffect,useMemo,useState}from'react'
import{format,isValid,parseISO}from'date-fns'
import{Cell,Legend,Pie,PieChart,ResponsiveContainer,Tooltip}from'recharts'
import{supabase}from'../../../../../lib/supabase'
import LoadingCircle from'./00.LoadingCircle'
import { queryMessage } from '../consulta-granja'

const number=x=>Number(x||0).toLocaleString('es-PE',{maximumFractionDigits:0})
const percent=x=>`${Number(x||0).toFixed(1)}%`
const lineOrder=['CRIOLLO','ISAMISA','FRANCES','BARRADO','DEKALB']

// Tarjeta completa de población por etapa: indicadores, gráfico, tabla y switch.
export default function LumbraTarjetaPoblacionPorEtapa({etapa,colores,year='actual',week='actual'}){
  // Estados locales del componente.
  const[rows,setRows]=useState([]),[loading,setLoading]=useState(true),[showTable,setShowTable]=useState(false)
  const [error,setError]=useState('')

  // Consulta la vista consolidada y toma la fecha más reciente del filtro.
  useEffect(()=>{
    setRows([]);setError('');setLoading(true)
    if(!year||!week||year==='actual'||week==='actual')return
    let active=true
    const controller=new AbortController()
    supabase.rpc('app_lumbra_poblacion_etapa',{
      p_year:Number(year),p_week:Number(week),p_stage:etapa.toUpperCase()
    }).select('*').order('fecha',{ascending:false}).abortSignal(controller.signal)
      .then(({data,error:issue})=>{
        if(!active)return
        if(issue){setError(queryMessage(issue));return}
        const latest=data?.[0]?.fecha
        setRows(latest?data.filter(row=>String(row.fecha)===String(latest)):data||[])
      }).catch(issue=>{if(active)setError(queryMessage(issue))})
      .finally(()=>{if(active)setLoading(false)})
    return()=>{active=false;controller.abort()}
  },[etapa,year,week])


  // Agrupa la población por línea para construir la dona y su leyenda.
  const chartData=useMemo(()=>{const grouped={};rows.forEach(row=>{const line=row.linea||'Sin línea';grouped[line]??={females:0,males:0};grouped[line].females+=Number(row.saldo_final_hembra||row.saldo_final_hembras||0);grouped[line].males+=Number(row.saldo_final_macho||row.saldo_final_machos||0)});const total=Object.values(grouped).reduce((sum,value)=>sum+value.females+value.males,0);return Object.entries(grouped).filter(([,value])=>value.females!==0).sort(([a],[b])=>{const ai=lineOrder.indexOf(a.trim().toUpperCase()),bi=lineOrder.indexOf(b.trim().toUpperCase());return(ai<0?99:ai)-(bi<0?99:bi)}).map(([name,value],index)=>({name,value:value.females+value.males,hembras:value.females,machos:value.males,porcentajeHembras:value.females/(value.females+value.males)*100,porcentajeMachos:value.males/(value.females+value.males)*100,porcentajeTotal:(value.females+value.males)/total*100,fill:colores[index%colores.length]}))},[rows,colores])

  // Totales para las tarjetas de hembras y machos.
  const totals=useMemo(()=>rows.reduce((sum,row)=>({females:sum.females+Number(row.saldo_final_hembra||row.saldo_final_hembras||0),males:sum.males+Number(row.saldo_final_macho||row.saldo_final_machos||0)}),{females:0,males:0}),[rows])

  // Tabla compacta ordenada por línea.
  const renderTable=()=> <div className="table-scroll"><table><thead><tr><th>Línea</th><th>Saldo hembras</th><th>Saldo machos</th><th>% hembras</th><th>% machos</th><th>Total aves</th><th>% total</th></tr></thead><tbody>{chartData.map((row)=><tr key={row.name}><td>{row.name}</td><td>{number(row.hembras)}</td><td>{number(row.machos)}</td><td>{percent(row.porcentajeHembras)}</td><td>{percent(row.porcentajeMachos)}</td><td>{number(row.value)}</td><td>{percent(row.porcentajeTotal)}</td></tr>)}</tbody></table></div>

  // Tooltip con cantidades y porcentajes separados.
  const renderTooltip=({active,payload})=>{if(!active||!payload?.length)return null;const row=payload[0].payload;return <div className="custom-tooltip"><strong>{row.name}</strong><div>Hembras: {number(row.hembras)} ({percent(row.porcentajeHembras)})</div><div>Machos: {number(row.machos)} ({percent(row.porcentajeMachos)})</div><div>Total: {number(row.value)} ({percent(row.porcentajeTotal)})</div></div>}

  // Render principal de la tarjeta y su switch gráfico/tabla.
  if(error)return <div className="panel" role="alert"><strong>{etapa}</strong><p>{error}</p></div>
  return <div className={showTable?'panel stage-table':'panel population-chart-card'}><div className="panel-head"><strong className="stage-pie-title">{etapa}</strong><label className="population-view-switch"><span>Grafico</span><input type="checkbox" checked={showTable} onChange={event=>setShowTable(event.target.checked)}/><i/><span>Tabla</span></label></div>{!loading&&<div className="population-summary-cards"><div className="population-summary-card"><span>Saldo de hembras</span><strong>{number(totals.females)}</strong></div><div className="population-summary-card"><span>Saldo de machos</span><strong>{number(totals.males)}</strong></div></div>}{loading?<LoadingCircle text={`Cargando ${etapa.toLowerCase()}...`}/>:showTable?renderTable():<ResponsiveContainer width="100%" height={330}><PieChart><Legend layout="vertical" align="left" verticalAlign="middle" width={100}/><Pie data={chartData} dataKey="value" nameKey="name" cx="62%" cy="45%" innerRadius={52} outerRadius={85} label={({porcentajeTotal})=>percent(porcentajeTotal)} labelLine={false}>{chartData.map(row=><Cell key={row.name} fill={row.fill}/>)}</Pie><Tooltip content={renderTooltip}/></PieChart></ResponsiveContainer>}</div>
}
