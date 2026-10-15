import React, { useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import FondoEtapas, { LeyendaEtapas } from './FondoEtapas';

const STANDARD = { key: 'estandar', name: 'Estándar semanal', color: '#6b7280' };
const formatKg = (value) => value == null ? 'Sin dato'
  : `${Number(value).toLocaleString('es-PE', { maximumFractionDigits: 1 })} kg`;

function ConsumoTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return <div className="chart-tooltip">
    <strong>Edad {row.edad} · Semana {row.semana} · {row.ano}</strong>
    {row.etapa && <span>Etapa al cierre semanal: {row.etapa}</span>}
    <span style={{ fontWeight: 700 }}>Consumo por tipo de alimento</span>
    {row.actual.map((food) => <span key={food.alimento}>
      <i aria-hidden="true" style={{ display: 'inline-block', width: 8, height: 8, marginRight: 5, background: food.color }} />
      {food.alimento}: {formatKg(food.kg)}
    </span>)}
    <strong>Total consumido: {formatKg(row.consumo)}</strong>
    <span>Estándar semanal: {formatKg(row.estandar)}</span>
  </div>;
}

function SemanaTick({ x, y, payload, data }) {
  const row = data.find((item) => item.periodo === payload.value);
  if (!row) return null;
  return <g transform={`translate(${x},${y})`}>
    <text textAnchor="middle" fill="#475569">
      <tspan x={0} y={12} fontSize={9} fontWeight={700}>Edad {row.edad}</tspan>
      <tspan x={0} y={27} fontSize={8}>Sem {row.semana}</tspan>
      <tspan x={0} y={39} fontSize={8}>{row.ano}</tspan>
    </text>
  </g>;
}

export default function LineasConsumoSemanal({ data, series }) {
  const [chartWidth, setChartWidth] = useState(500);
  if (!data.length) return <p className="muted">No hay datos de consumo para el lote seleccionado.</p>;
  // Todas las semanas conservan sus barras; solo se espacian las etiquetas.
  const tickCount = Math.min(data.length, Math.max(2, Math.floor((chartWidth - 90) / 56)));
  const ticks = Array.from({ length: tickCount }, (_, index) =>
    data[tickCount === 1 ? 0 : Math.round(index * (data.length - 1) / (tickCount - 1))].periodo);
  return <>
    <LeyendaEtapas data={data} />
    <div aria-label="Leyenda por tipo de alimento y estándar semanal" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px', margin: '10px 0', color: '#475569', fontSize: 11 }}>
      {[...series, STANDARD].map((item) => <span key={item.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <span aria-hidden="true" style={{ width: item.key === STANDARD.key ? 18 : 10, height: item.key === STANDARD.key ? 3 : 10, background: item.color }} />
        {item.name}
      </span>)}
    </div>
    {data.some((row) => row.estandar == null) && <p className="muted">Las semanas sin estándar disponible quedan sin punto en la línea gris.</p>}
    <div role="region" aria-label="Consumo semanal por alimento y estándar" style={{ width: '100%', minWidth: 0, maxWidth: '100%' }}>
        <ResponsiveContainer width="100%" minWidth={0} height={320} onResize={(width) => setChartWidth(width)}>
          <ComposedChart data={data} stackOffset="sign" barCategoryGap="20%"
            margin={{ top: 12, right: 24, left: 0, bottom: 4 }}>
            <FondoEtapas data={data} />
            <CartesianGrid vertical={false} />
            <XAxis dataKey="periodo" height={55} ticks={ticks} interval={0} tickSize={3}
              tick={(props) => <SemanaTick {...props} data={data} />} />
            <YAxis width={65} tickFormatter={(value) => Number(value).toLocaleString('es-PE', { maximumFractionDigits: 0 })}
              label={{ value: 'kg', position: 'insideTopLeft', offset: 0, fill: '#64748b', fontSize: 10 }} />
            <Tooltip filterNull={false} content={<ConsumoTooltip />} />
            {series.map((food) => <Bar key={food.key} dataKey={food.key} name={food.name}
              stackId="consumo" fill={food.color} maxBarSize={32} zIndex={300}
              activeBar={false} isAnimationActive={false} />)}
            <Line dataKey="estandar" name={STANDARD.name} type="linear" stroke={STANDARD.color} strokeWidth={3} zIndex={400}
              dot={{ r: data.length > 60 ? 1.5 : 2, fill: STANDARD.color }} activeDot={{ r: 4 }}
              connectNulls={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
    </div>
  </>;
}
