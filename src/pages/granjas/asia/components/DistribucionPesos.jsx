import React, { useMemo, useState } from 'react';
import { Bar, ComposedChart, CartesianGrid, LabelList, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CAMPAIGNS } from './datos-asia';
import { buildWeightDistributions, withDailyIdentity } from './distribucion-pesos';
import InformeLote from './InformeLote';
import { dateText } from './TarjetaCampana';
const fmt = (v) => v == null ? 'Sin dato' : Number(v).toLocaleString('es-PE', { maximumFractionDigits: 2 });
const kg = (v) => v == null ? 'Sin dato' : (Number(v) / 1000).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function IntervalTick({ x, y, payload, bins }) {
  const bin = bins.find((b) => b.clase === payload.value);
  return <g transform={`translate(${x},${y})`}><text textAnchor="middle" fill="#64748b" fontSize={10}>
    <tspan x="0" dy="13">{kg(bin?.min)}</tspan><tspan x="0" dy="14">a {kg(bin?.max)} kg</tspan><tspan x="0" dy="17" fontWeight={700} fill="#245773">{payload.value}</tspan>
  </text></g>;
}
export default function DistribucionPesos({ campaign, year, week, data, loading, error, retry, dailyRows = [], standards, selectedLot, selectedAge = '' }) {
  const [selectedSamples, setSelectedSamples] = useState({});
  const lots = (CAMPAIGNS.find((r) => r.key === campaign)?.lots ?? []).filter((lot) => !selectedLot || lot === selectedLot);
  const lotKey = lots.join(',');
  const charts = useMemo(() => withDailyIdentity(buildWeightDistributions((data?.rows ?? []).filter((r) =>
    lots.includes(String(r.lote).trim().toUpperCase()) && String(r.fecha).slice(0, 4) === String(year) && Number(r.semana_cal) === Number(week)
    && (selectedAge === '' || r.edad_pesaje_sem != null && Number(r.edad_pesaje_sem) === Number(selectedAge)))), dailyRows, year, week), [data, dailyRows, year, week, lotKey, selectedAge]);
  return <section aria-label="Distribución de pesos por lote">
    <h3>Distribución de pesos por lote</h3>
    {!loading && !error && !data?.rows?.length && <div className="panel" role="status"><p>La vista de pesos devolvió cero registros para tu sesión, incluso sin filtros de lote o semana. Falta comprobar la carga de la tabla y sus permisos de lectura en Supabase.</p><button type="button" onClick={retry}>Volver a consultar pesajes</button></div>}
    {loading ? <p className="panel muted">Cargando pesajes...</p>
      : error ? <div className="panel" role="alert"><p>{error}</p><button onClick={retry}>Reintentar</button></div>
        : !lotKey ? <p className="panel muted">Los gráficos estarán disponibles al asignar los lotes de esta campaña.</p>
          : lots.map((lote) => {
            const samples = charts.filter((r) => r.lote.trim().toUpperCase() === lote).sort((a, b) => b.fecha.localeCompare(a.fecha) || String(a.tipo ?? '').localeCompare(String(b.tipo ?? '')));
            const chart = samples.find((r) => r.key === selectedSamples[lote]) ?? samples[0];
            if (!chart) {
              const hasHistory = (data?.rows ?? []).some((r) => r.lote === lote) || dailyRows.some((r) => r.Cod_Lote === lote);
              return hasHistory ? <article key={lote} className="asia-lot-distribution">
                <h3 style={{ textAlign: 'center' }}>{lote} · {CAMPAIGNS.find((c) => c.key === campaign)?.label}</h3>
                <InformeLote lote={lote} weights={data?.rows ?? []} dailyRows={dailyRows} standards={standards} />
              </article> : null;
            }
            const countMax = Math.max(1, Math.ceil(Math.max(...chart.bins.map((bin) => bin.aves)) * 1.15));
            const frequencyMax = chart.total > 0 ? countMax / chart.total * 100 : 100;
            const countTicks = [...new Set(Array.from({ length: 5 }, (_, i) => Math.round(countMax * i / 4)))];
            const frequencyTicks = countTicks.map((value) => value / countMax * frequencyMax);
            return <article key={lote} className="asia-lot-distribution">
              <h3 style={{ textAlign: 'center' }}>{chart.lote} · {CAMPAIGNS.find((c) => c.key === campaign)?.label} · {chart.sexo || 'Sexo sin dato'} · {chart.color || 'Color sin dato'}</h3>
              {samples.length > 1 && <label className="weekly-filter">Pesaje de {lote}<select value={chart.key} onChange={(e) => setSelectedSamples((previous) => ({ ...previous, [lote]: e.target.value }))}>{samples.map((sample) => <option key={sample.key} value={sample.key}>{sample.fecha} · {sample.tipo || 'Tipo pendiente'}</option>)}</select></label>}
              <InformeLote lote={lote} weights={data?.rows ?? []} dailyRows={dailyRows} standards={standards}>
              <div className="asia-class-layout">
              <div className="panel asia-class-table"><p className="asia-sample-date">Fecha de toma de muestra: <strong>{dateText(chart.fecha)}</strong></p><div className="table-scroll">
                <table aria-label={`Distribución por clase del lote ${chart.lote}`}>
                  <thead><tr><th scope="col">Edad (sem)</th><th scope="col">Clase</th><th scope="col">Intervalo (kg)</th><th scope="col">Promedio (kg)</th><th scope="col">Aves por clase</th><th scope="col">Frecuencia</th></tr></thead>
                  <tbody>{chart.bins.map((bin, index) => <tr key={bin.clase}>
                    {index === 0 && <td rowSpan={chart.bins.length} style={{ verticalAlign: 'middle', textAlign: 'center', fontWeight: 700 }}>{chart.edad ?? '-'}</td>}
                    <th scope="row">{bin.clase}</th>
                    <td>{kg(bin.min)} a {kg(bin.max)}</td>
                    <td>{bin.min == null || bin.max == null ? '-' : kg((bin.min + bin.max) / 2)}</td>
                    <td style={{ textAlign: 'center' }}>{bin.aves ? fmt(bin.aves) : '-'}</td>
                    <td style={{ textAlign: 'center' }}>{bin.frecuencia ? `${bin.frecuencia.toFixed(1)}%` : '-'}</td>
                  </tr>)}</tbody>
                  <tfoot><tr><th scope="row" colSpan={4}>Total general</th><td style={{ textAlign: 'center', fontWeight: 700 }}>{fmt(chart.total)}</td><td style={{ textAlign: 'center', fontWeight: 700 }}>{chart.total > 0 ? '100.0%' : '0.0%'}</td></tr></tfoot>
                </table>
              </div></div>
              <div className="panel lote-chart"><div style={{ width: '100%', height: '100%', minWidth: 0 }}><ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart.bins} margin={{ top: 35, right: 30, left: 10, bottom: 15 }}>
                  <CartesianGrid vertical={false} stroke="#d1d5db" />
                  <XAxis dataKey="clase" interval={0} height={75} tick={<IntervalTick bins={chart.bins} />} />
                  <YAxis yAxisId="aves" allowDecimals={false} domain={[0, countMax]} ticks={countTicks} />
                  <YAxis yAxisId="frecuencia" orientation="right" width={70} domain={[0, frequencyMax]} ticks={frequencyTicks} tickFormatter={(v) => `${fmt(v)}%`} />
                  <Tooltip labelFormatter={(v) => `Clase ${v}`} formatter={(v, name) => [name === 'Frecuencia' ? `${fmt(v)}%` : fmt(v), name]} /><Legend />
                  <Bar yAxisId="aves" dataKey="aves" name="Aves por clase (muestra)" fill="#176783" maxBarSize={70}>
                    <LabelList dataKey="aves" position="insideBottom" formatter={(value) => Number(value) > 0 ? fmt(value) : ''} fill="#fff" fontSize={12} fontWeight={700} offset={6} />
                  </Bar>
                  <Line yAxisId="frecuencia" dataKey="frecuencia" name="Frecuencia" type="monotone" stroke="#f97329" strokeWidth={3} dot={{ r: 3 }}>
                    <LabelList dataKey="frecuencia" position="top" formatter={(v) => `${Number(v).toFixed(1)}%`} fill="#c2410c" fontSize={12} offset={12} />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer></div></div>
              </div>
              </InformeLote>
            </article>;
          })}
  </section>;
}
