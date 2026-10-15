import React, { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, LabelList, Rectangle, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import useConsumo from '../use-consumo';
import LoadingCircle from './00.LoadingCircle';
import { buildConsumptionChart, consumptionBarRadius } from './consumo-por-lote';
import { loteBarProps, loteTickProps } from '../seleccion-lote';

const CHARTS = [{ sexo: 'hembra', label: 'Hembras' }, { sexo: 'macho', label: 'Machos' }];
const blockStyle = { display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6, paddingTop: 6, borderTop: '1px solid #dbe1e3' };
const fmt = (value) => value == null ? 'Sin dato' : Number(value).toLocaleString('en-US');
const fmtKg = (value) => value == null ? 'Sin dato' : Number(value).toLocaleString('es-PE', { maximumFractionDigits: 2 });
const fmtDaily = (value) => value == null ? 'Sin dato' : Number(value).toLocaleString('es-PE', { maximumFractionDigits: 2 });

function RoundedStackSegment({ series, foodKey, ...props }) {
  const { y, height, payload } = props;
  if (!Number.isFinite(y) || !Number.isFinite(height) || !height) return null;
  return <Rectangle {...props} y={Math.min(y, y + height)} height={Math.abs(height)} radius={consumptionBarRadius(payload, series, foodKey)} />;
}

function LoteTooltip({ active, payload, sexo, unit, showStandard }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const format = (value) => value == null ? 'Sin dato' : unit === 'g_ave_dia'
    ? `${fmtDaily(value)} g/ave/día` : `${fmtKg(value)} kg`;
  return <div className="chart-tooltip">
    <strong style={{ fontWeight: 900 }}>{row.linea} - {row.lote}</strong>
    <span>Cod std: {row.codStd}</span>
    <div style={blockStyle}>
      <span style={{ fontWeight: 700 }}>Alimento consumido</span>
      {row.actual.length ? row.actual.map((food) => <span key={food.alimento}>
        <i aria-hidden="true" style={{ display: 'inline-block', width: 8, height: 8, marginRight: 5, background: food.color }} />
        {food.alimento}: {format(food.value)}{unit === 'g_ave_dia' && ` (${fmtKg(food.kg)} kg en el período)`}
      </span>) : <span>Sin datos de consumo</span>}
      <strong>Total consumido: {format(row.total)}</strong>
      {unit === 'g_ave_dia' ? <>
        <span>Total real del período: {fmtKg(row.totalKg)} kg</span>
        <span>Suma de saldos iniciales diarios: {fmt(row.birdDays)}</span>
        <span>Días registrados: {fmt(row.recordedDays)}</span>
      </> : <span>Saldo inicial {sexo}: {fmt(row.saldo)}</span>}
    </div>
    {showStandard && <div style={blockStyle}>
      <span style={{ fontWeight: 700 }}>Alimento estándar esperado</span>
      {row.standard.length ? row.standard.map((food) => <span key={food.alimento}>
        <i aria-hidden="true" style={{ display: 'inline-block', width: 8, height: 8, marginRight: 5, background: food.color }} />
        {food.alimento} STD: {format(food.value)}
      </span>) : <span>Sin estándar para esta edad y sexo</span>}
      <strong>Total estándar: {format(row.standardTotal)}</strong>
    </div>}
    <small style={{ fontWeight: 900 }}>Edad: {row.edad}</small>
  </div>;
}

function LoteTick({ x, y, index, data, onSelectLote }) {
  const row = data[index], previous = data[index - 1];
  return <g transform={`translate(${x},${y})`} {...loteTickProps(row, onSelectLote)}>
    <text textAnchor="middle" dy={12} fontSize={10}>{row?.lote}</text>
    {(!previous || previous.linea !== row?.linea) && <text textAnchor="middle" dy={28} fontSize={9} fontWeight="700">{row?.linea}</text>}
  </g>;
}

function AgeTick({ x, y, payload }) {
  const width = Math.max(24, String(payload.value).length * 7 + 8);
  return <g transform={`translate(${x},${y})`}>
    <rect x={-width / 2} y={-18} width={width} height={18} rx={3} fill="#4b5563" />
    <text textAnchor="middle" y={-5} fontSize={10} fontWeight="700" fill="#f9fafb">{payload.value}</text>
  </g>;
}

function RealConsumptionLabel({ x, y, width, height, index, data, series, foodKey, unit }) {
  const row = data[index];
  if (row?.total == null || ![x, y, width, height].every(Number.isFinite)) return null;
  const positive = row.total >= 0;
  const outer = series.filter((food) => positive ? row[food.key] > 0 : row[food.key] < 0).at(-1);
  if (foodKey !== (outer?.key ?? series.at(-1)?.key)) return null;
  const labelY = positive ? Math.min(y, y + height) - 7 : Math.max(y, y + height) + 12;
  return <text x={x + width / 2} y={labelY} textAnchor="middle" fontSize={10} fontWeight={700} fill="#374151" pointerEvents="none">
    {unit === 'g_ave_dia' ? fmtDaily(row.total) : fmtKg(row.total)}
  </text>;
}

export default function ConsumoPorLoteChart({ year = 'actual', week = 'actual', unit = 'kg', onSelectLote, dataRows, farmLabel = 'Lumbra', showStandard = true }) {
  const remote = useConsumo({ year, week, enabled: dataRows === undefined });
  const { rows, loading, error, retry } = dataRows === undefined ? remote : { rows: dataRows, loading: false, error: '', retry: remote.retry };

  const perBirdDay = unit === 'g_ave_dia';
  const charts = useMemo(() => CHARTS.map((chart) => ({ ...chart, ...buildConsumptionChart(rows, chart.sexo, unit) })), [rows, unit]);
  return <div className="panel lote-chart">
    <strong className="stage-pie-title">Consumo de alimento por lote. {farmLabel}</strong>
    {perBirdDay && rows.length > 0 && !Object.hasOwn(rows[0], 'suma_saldos_diarios_hembra') && <p role="status" className="muted">El cálculo con saldos diarios aún no está habilitado.</p>}
    {loading ? <LoadingCircle text="Cargando consumo por lote..." />
      : error ? <div role="alert"><p>{error}</p><button type="button" onClick={retry}>Reintentar</button></div>
        : !rows.length ? <p className="muted">No hay datos para el período seleccionado.</p>
          : <div className="lote-chart-stack" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
            {charts.map(({ sexo, label, data, series, standardSeries }) => <div key={sexo}>
              <strong className="stage-pie-title">{perBirdDay ? 'Consumo diario promedio' : 'Consumo semanal'} · {label} ({perBirdDay ? 'g/ave/día' : 'kg'})</strong>
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={data} stackOffset="sign" barGap={3} barCategoryGap="18%" margin={{ top: 20, right: 20, left: 15, bottom: 20 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="lote" interval={0} tick={(props) => <LoteTick {...props} data={data} onSelectLote={onSelectLote} />} height={55} />
                  <XAxis xAxisId="edad" dataKey="edad" orientation="top" interval={0} height={25} axisLine={false} tickLine={false} tick={<AgeTick />} />
                  <YAxis domain={[(min) => Math.min(0, min * 1.15), (max) => Math.max(1, max * 1.2)]} tickFormatter={perBirdDay ? fmtDaily : fmtKg} width={65} />
                  <Tooltip filterNull={false} content={<LoteTooltip sexo={sexo} unit={unit} showStandard={showStandard} />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {series.map((food) => <Bar {...loteBarProps(onSelectLote)} key={food.key} dataKey={food.key} name={food.name} stackId="consumo" fill={food.color} barSize={10} shape={(props) => <RoundedStackSegment {...props} series={series} foodKey={food.key} />}>
                    <LabelList dataKey="total" content={(props) => <RealConsumptionLabel {...props} data={data} series={series} foodKey={food.key} unit={unit} />} />
                  </Bar>)}
                  {showStandard && standardSeries.map((food) => <Bar {...loteBarProps(onSelectLote)} key={food.key} dataKey={food.key} name={`Std ${food.name}`} legendType="none" stackId="estandar" fill={food.color} barSize={10} shape={(props) => <RoundedStackSegment {...props} series={standardSeries} foodKey={food.key} />} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>)}
          </div>}
  </div>;
}
