import React, { useMemo } from 'react';
import { Bar, CartesianGrid, ComposedChart, LabelList, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { lotChartSeries } from './resumen-pesos';
import { foodColor } from '../../lumbra/components/01.Datos_generales/consumo-por-lote';
const fmt = (v, digits = 0) => v == null ? '' : Number(v).toLocaleString('es-PE', { maximumFractionDigits: digits });
const blue = '#176783', orange = '#f97329', gray = '#94a3b8';
const label = <LabelList position="top" formatter={(v) => fmt(v)} fontSize={9} fill="#475569" />;
function ChartCard({ title, data, secondary, percent, children, units }) {
  return <section className="panel asia-history-chart" aria-label={title}>
    <h4>{title}</h4>
    {!data.length ? <p className="muted">Sin registros para este lote.</p> : <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={data} margin={{ top: 22, right: secondary ? 5 : 18, left: 0, bottom: 12 }}>
        <CartesianGrid vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="age" tick={{ fontSize: 10 }} label={{ value: 'Edad (sem)', position: 'insideBottom', offset: -8, fontSize: 10 }} />
        <YAxis yAxisId="main" width={55} tick={{ fontSize: 9 }} tickFormatter={(v) => percent ? `${fmt(v, 1)}%` : fmt(v)} />
        {secondary && <YAxis yAxisId="secondary" orientation="right" width={44} tick={{ fontSize: 9 }} tickFormatter={(v) => fmt(v, 2)} />}
        <Tooltip offset={35} wrapperStyle={{ pointerEvents: 'none' }} labelFormatter={(v) => `Edad: ${v} semanas`} formatter={(v, name, entry) => [v == null ? 'Sin dato' : `${fmt(v, percent || entry?.dataKey === 'ca' || entry?.dataKey === 'standardCA' ? 2 : 1)}${percent ? '%' : units?.[entry?.dataKey] ? ` ${units[entry.dataKey]}` : ''}`, name]} />
        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 12 }} />
        {children}
      </ComposedChart>
    </ResponsiveContainer>}
  </section>;
}
export default function GraficosHistorialLote({ columns, lote }) {
  const { rows, foods } = useMemo(() => lotChartSeries(columns), [columns]);
  return <div className="asia-lot-charts" aria-label={`Gráficos semanales del lote ${lote}`}>
    <ChartCard title="% mortalidad semanal" data={rows} percent>
      <Bar yAxisId="main" dataKey="mortalityPct" name="Mortalidad" fill={blue} maxBarSize={22}><LabelList position="top" formatter={(v) => v == null ? '' : `${fmt(v, 1)}%`} fontSize={9} /></Bar>
    </ChartCard>
    <ChartCard title="Saldo de aves" data={rows} secondary>
      <Bar yAxisId="main" dataKey="existence" name="Saldo inicial (und)" fill={blue} maxBarSize={22}>{label}</Bar>
      <Line yAxisId="secondary" dataKey="accumulatedDeaths" name="Mortalidad acumulada (und)" stroke={orange} strokeWidth={2} dot={false} connectNulls={false} />
    </ChartCard>
    <ChartCard title="Consumo de alimento semanal (kg)" data={rows}>
      {foods.map((food) => <Bar key={food.key} yAxisId="main" dataKey={food.key} name={food.name} stackId="alimentos" fill={foodColor(food.name)} maxBarSize={24} />)}
    </ChartCard>
    <ChartCard title="Peso semanal · Real vs estándar (gr)" data={rows}>
      <ReferenceLine yAxisId="main" y={0} stroke="#94a3b8" />
      <Bar yAxisId="main" dataKey="weight" name="Peso real" fill={blue} maxBarSize={16}>{label}</Bar>
      <Bar yAxisId="main" dataKey="standardWeight" name="Peso estándar" fill="#a9ccea" maxBarSize={16} />
      <Bar yAxisId="main" dataKey="weightDifference" name="Diferencia" fill="#65a30d" maxBarSize={12} />
    </ChartCard>
    <ChartCard title="C.A. real vs estándar · Semanal" data={rows} secondary units={{ weightGain: 'gr' }}>
      <Bar yAxisId="main" dataKey="weightGain" name="Incremento de peso (gr)" fill={blue} maxBarSize={24}>{label}</Bar>
      <Line yAxisId="secondary" dataKey="ca" name="CA real" stroke={orange} strokeWidth={2} dot={false} connectNulls={false} />
      <Line yAxisId="secondary" dataKey="standardCA" name="CA estándar" stroke={gray} strokeDasharray="5 4" strokeWidth={2} dot={false} connectNulls={false} />
    </ChartCard>
    <ChartCard title="Consumo semanal · Real vs estándar (kg)" data={rows}>
      <ReferenceLine yAxisId="main" y={0} stroke="#94a3b8" />
      <Bar yAxisId="main" dataKey="foodKg" name="Consumo real" fill={orange} maxBarSize={18} />
      <Bar yAxisId="main" dataKey="standardFoodKg" name="Consumo estándar" fill={gray} maxBarSize={18} />
      <Bar yAxisId="main" dataKey="foodDifference" name="Diferencia" fill={blue} maxBarSize={14}>{label}</Bar>
    </ChartCard>
  </div>;
}
