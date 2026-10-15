import React from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dateText, fmt } from './TarjetaCampana';
function LotTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return <div className="chart-tooltip"><strong>{r.linea} · {r.lote}</strong><span>{r.campaign}</span><span>Cierre: {dateText(r.fecha)} · Edad: {r.edad ?? 'Sin dato'} semanas</span><span>Hembras: {fmt(r.hembras)}</span><span>Machos: {fmt(r.machos)}</span></div>;
}
export default function AvesPorLote({ data, farmName = 'Asia' }) {
  return <div className="panel lote-chart"><strong className="stage-pie-title">Aves por lote · {farmName}</strong>
    {!data.length ? <p className="muted">No hay población para la campaña seleccionada.</p> : <ResponsiveContainer width="100%" height={340}>
      <BarChart data={data} margin={{ top: 28, right: 20, left: 10, bottom: 25 }} barGap={3}>
        <CartesianGrid vertical={false} /><XAxis dataKey="lote" interval={0} tick={{ fontSize: 10 }} height={55} /><YAxis tickFormatter={fmt} domain={[0, (max) => Math.max(1, max * 1.2)]} width={70} />
        <Tooltip content={<LotTooltip />} /><Legend />
        <Bar dataKey="hembras" name="Hembras" fill="#2563eb" maxBarSize={18} radius={[3,3,0,0]}><LabelList dataKey="hembras" position="top" formatter={(v) => v == null ? '' : fmt(v)} fontSize={10} /></Bar>
        <Bar dataKey="machos" name="Machos" fill="#dc2626" maxBarSize={18} radius={[3,3,0,0]}><LabelList dataKey="machos" position="top" formatter={(v) => v == null ? '' : fmt(v)} fontSize={10} /></Bar>
      </BarChart>
    </ResponsiveContainer>}
  </div>;
}
