import React, { useState } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
export const fmt = (value) => value == null ? 'Sin dato' : Number(value).toLocaleString('es-PE', { maximumFractionDigits: 0 });
export const dateText = (value) => value ? value.split('-').reverse().join('/') : '—';
const pct = (value, total) => total > 0 && value != null ? `${(value * 100 / total).toFixed(1)}%` : '—';
function PopulationTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return <div className="chart-tooltip"><strong>{row.name}</strong><span>Hembras: {fmt(row.hembras)}</span><span>Machos: {fmt(row.machos)}</span><strong>Total: {fmt(row.value)}</strong></div>;
}
export default function TarjetaCampana({ data }) {
  const [showTable, setShowTable] = useState(false);
  const complete = data.lines.every((r) => r.value != null && r.value >= 0);
  const total = data.summary.hembras == null || data.summary.machos == null ? null : data.summary.hembras + data.summary.machos;
  return <div className={showTable ? 'panel stage-table' : 'panel population-chart-card'}>
    <div className="panel-head"><strong className="stage-pie-title">{data.label}</strong>
      <label className="population-view-switch"><span>Gráfico</span><input aria-label={`Mostrar tabla de ${data.label}`} type="checkbox" checked={showTable} onChange={(e) => setShowTable(e.target.checked)} /><i /><span>Tabla</span></label>
    </div>
    {!data.population.length ? <p className="muted">No hay población registrada para esta campaña en la semana seleccionada.</p> : <>
      <p className="muted">Cierre: {dateText(data.lastDate)}</p>
      <div className="population-summary-cards"><div className="population-summary-card"><span>Saldo de hembras</span><strong>{fmt(data.summary.hembras)}</strong></div><div className="population-summary-card"><span>Saldo de machos</span><strong>{fmt(data.summary.machos)}</strong></div></div>
      {showTable ? <div className="table-scroll"><table><thead><tr><th>Línea</th><th>Hembras</th><th>Machos</th><th>Total</th><th>% total</th></tr></thead>
        <tbody>{data.lines.map((row) => <tr key={row.name}><td>{row.name}</td><td>{fmt(row.hembras)}</td><td>{fmt(row.machos)}</td><td>{fmt(row.value)}</td><td>{pct(row.value, total)}</td></tr>)}</tbody>
      </table></div> : !complete ? <p role="status" className="muted">Hay saldos ausentes o contradictorios. Revisa la tabla y el registro diario.</p>
        : !(total > 0) ? <p className="muted">La campaña tiene saldo cero al cierre.</p>
          : <ResponsiveContainer width="100%" height={330}><PieChart><Legend layout="vertical" align="left" verticalAlign="middle" width={100} />
            <Pie data={data.lines.filter((r) => r.value > 0)} dataKey="value" nameKey="name" cx="62%" cy="45%" innerRadius={52} outerRadius={85} label={({ value }) => pct(value, total)} labelLine={false}>
              {data.lines.filter((r) => r.value > 0).map((r) => <Cell key={r.name} fill={r.fill} />)}
            </Pie><Tooltip content={<PopulationTooltip />} />
          </PieChart></ResponsiveContainer>}
    </>}
  </div>;
}
