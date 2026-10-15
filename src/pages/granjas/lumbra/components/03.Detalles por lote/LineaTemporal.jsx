import React, { useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import FondoEtapas, { LeyendaEtapas } from './FondoEtapas';

export function PeriodoTick({ x, y, payload, data, chartWidth }) {
  const index = data.findIndex((item) => item.periodo === payload.value);
  const row = data[index];
  if (!row) return null;
  const spacing = Math.max(1, (chartWidth - 60) / Math.max(1, data.length - 1));
  const vertical = spacing < 22;
  const stagger = spacing < 9;
  const calendarInterval = Math.max(1, Math.ceil(58 / spacing));
  const showCalendar = index % calendarInterval === 0 && index <= data.length - 1 - calendarInterval / 2
    || index === data.length - 1;
  const ageY = vertical ? 3 + (stagger ? index % 2 * 24 : 0) : 12;
  const calendarY = stagger ? 63 : vertical ? 39 : 29;
  return <g transform={`translate(${x},${y})`}>
    <text textAnchor={vertical ? 'end' : 'middle'} fill="#475569"
      transform={`translate(0,${ageY})${vertical ? ' rotate(-90)' : ''}`}>
      <tspan fontSize={8} fontWeight={700}>{row.edad}</tspan>
    </text>
    {showCalendar && <text textAnchor="middle" fill="#64748b">
      <tspan x={0} y={calendarY} fontSize={8}>Sem {row.semana}</tspan>
      <tspan x={0} dy={12} fontSize={8}>{row.ano}</tspan>
    </text>}
  </g>;
}

export default function LineaTemporal({ data, series, unit = '%', connectNulls = false,
  showMissingAgeWarning = true, stageBackground = false,
  emptyMessage = 'No hay registros con edad de vida para este lote.' }) {
  const [chartWidth, setChartWidth] = useState(500);
  const lifeData = data.filter((row) => Number(row.edadMin) >= 1);
  if (!lifeData.length) return <p className="muted">{emptyMessage}</p>;
  const firstAge = Number(lifeData[0].edadMin);
  return <>
    {showMissingAgeWarning && firstAge > 1 && <p className="muted">El primer registro disponible es de la edad {firstAge}. Faltan los registros desde la edad 1.</p>}
    {stageBackground && <LeyendaEtapas data={lifeData} />}
    <div style={{ width: '100%', minWidth: 0 }}>
    <ResponsiveContainer width="100%" minWidth={0} height={300} onResize={(width) => setChartWidth(width)}>
    <LineChart data={lifeData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
      {stageBackground && <FondoEtapas data={lifeData} />}
      <CartesianGrid vertical={false} />
      <XAxis dataKey="periodo" height={82} interval={0} tickSize={3}
        tick={(props) => <PeriodoTick {...props} data={lifeData} chartWidth={chartWidth} />} />
      <YAxis width={48} unit={unit === '%' ? '%' : ' kg'} />
      <Tooltip labelFormatter={(value) => {
        const row = data.find((item) => item.periodo === value);
        return row ? `Edad ${row.edad} · Semana ${row.semana} · ${row.ano}${row.etapa ? ` · ${row.etapa}` : ''}` : value;
      }} formatter={(value) => unit === '%' ? `${Number(value).toFixed(1)}%` : `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })} kg`} />
      <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
      {series.map((serie) => <Line key={serie.key} type="linear" dataKey={serie.key}
        name={serie.name} stroke={serie.color} strokeWidth={2} connectNulls={connectNulls}
        dot={{ r: 2, fill: serie.color, stroke: serie.color }}
        activeDot={{ r: 4, fill: serie.color, stroke: serie.color }} isAnimationActive={false} />)}
    </LineChart>
  </ResponsiveContainer></div></>;
}
