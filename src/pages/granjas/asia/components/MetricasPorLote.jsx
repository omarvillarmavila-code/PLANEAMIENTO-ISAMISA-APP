import React, { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { foodColor } from '../../lumbra/components/01.Datos_generales/consumo-por-lote';
const fmt = (n) => n == null ? 'Sin dato' : Number(n).toLocaleString('es-PE', { maximumFractionDigits: 2 });
function LotTooltip({ active, payload, consumption, showStandard = true }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return <div className="chart-tooltip"><strong>{row.linea} · {row.lote}</strong><span>Edad: {fmt(row.edad)} semanas</span>
    {consumption ? <><strong>Consumo real: {fmt(row.consumoDiario)} g/ave/día</strong>{showStandard && <span>Consumo estándar: {fmt(row.consumoEstandarDiario)} g/ave/día</span>}<span>Total del período: {fmt(row.consumoKg)} kg</span>{showStandard && <span>Total estándar del período: {fmt(row.consumoEstandarKg)} kg</span>}
      {row.alimentos.map((food) => <span key={food.alimento}>{food.alimento}: {fmt(food.diario)} g/ave/día · {fmt(food.kg)} kg</span>)}
      <span>Suma de saldos iniciales diarios del lote: {fmt(row.birdDays)}</span><span>Días registrados: {row.dias}</span></>
      : <><strong>Mortalidad del lote: {row.mortalidad == null ? 'Sin dato' : `${fmt(row.mortalidad)} %`}</strong><span>Muertes: {fmt(row.muertes)}</span><span>Saldo inicial del lote: {fmt(row.saldoInicial)}</span></>}
  </div>;
}
function ConsumptionLabel({ x, y, width, height, index, data, series, foodKey }) {
  const row = data[index];
  if (row?.consumoDiario == null || ![x, y, width, height].every(Number.isFinite)) return null;
  const positive = row.consumoDiario >= 0;
  const outer = series.filter((food) => positive ? row[food.key] > 0 : row[food.key] < 0).at(-1);
  if (foodKey !== (outer?.key ?? series.at(-1)?.key)) return null;
  return <text x={x + width / 2} y={positive ? Math.min(y, y + height) - 7 : Math.max(y, y + height) + 12} textAnchor="middle" fontSize={10} fontWeight={700} fill="#374151">{fmt(row.consumoDiario)}</text>;
}
export default function MetricasPorLote({ rows, farmName = 'Asia', showStandard = true }) {
  const { data, series } = useMemo(() => {
    const names = [...new Set(rows.flatMap((r) => r.alimentos.map((f) => f.alimento)))].sort();
    const series = names.map((name, index) => ({ key: `alimento_${index}`, name, color: foodColor(name) }));
    const data = rows.map((row) => ({ ...row, ...Object.fromEntries(series.map((food) => {
      const item = row.alimentos.find((f) => f.alimento === food.name);
      return [food.key, item ? item.diario : row.consumoDiario == null ? null : 0];
    })) }));
    return { data, series };
  }, [rows]);
  const xAxis = <XAxis dataKey="lote" interval={0} height={55} tick={{ fontSize: 10 }} />;
  return <>
    <div className="panel lote-chart"><strong className="stage-pie-title">% mortalidad semanal por lote · {farmName}</strong>
      {!data.length ? <p className="muted">No hay datos para los lotes de la campaña seleccionada.</p> : <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 28, right: 20, left: 10, bottom: 20 }}><CartesianGrid vertical={false} />{xAxis}
          <YAxis width={65} domain={[0, (max) => Math.max(1, max * 1.2)]} tickFormatter={(v) => `${fmt(v)}%`} />
          <Tooltip offset={35} wrapperStyle={{ pointerEvents: 'none' }} filterNull={false} content={<LotTooltip />} /><Legend />
          <Bar dataKey="mortalidad" name="Mortalidad del lote" fill="#6366f1" maxBarSize={22} radius={[3,3,0,0]}>
            <LabelList dataKey="mortalidad" position="top" formatter={(v) => v == null ? '' : `${fmt(v)}%`} fontSize={10} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>}
    </div>
    <div className="panel lote-chart"><strong className="stage-pie-title">Consumo de alimento por lote · {farmName} (g/ave/día)</strong>
      {showStandard && data.some((r) => r.consumoEstandarDiario == null) && <p className="muted">Sin estándar de consumo para: {data.filter((r) => r.consumoEstandarDiario == null).map((r) => r.lote).join(', ')}. Revisa color, variedad, sexo y edad; la referencia disponible cubre las semanas 1 a 18.</p>}
      {!data.length ? <p className="muted">No hay datos para los lotes de la campaña seleccionada.</p> : <ResponsiveContainer width="100%" height={340}>
        <BarChart data={data} stackOffset="sign" margin={{ top: 28, right: 20, left: 10, bottom: 20 }}><CartesianGrid vertical={false} />{xAxis}
          <YAxis width={65} domain={[(min) => Math.min(0, min * 1.15), (max) => Math.max(1, max * 1.2)]} tickFormatter={fmt} />
          <Tooltip offset={35} wrapperStyle={{ pointerEvents: 'none' }} filterNull={false} content={<LotTooltip consumption showStandard={showStandard} />} /><Legend />
          {series.map((food) => <Bar key={food.key} dataKey={food.key} name={food.name} fill={food.color} stackId="consumo" maxBarSize={22}>
            <LabelList dataKey="consumoDiario" content={(props) => <ConsumptionLabel {...props} data={data} series={series} foodKey={food.key} />} />
          </Bar>)}
          {showStandard && <Bar dataKey="consumoEstandarDiario" name="Consumo estándar" fill="#6b7280" stackId="estandar" maxBarSize={22} radius={[3,3,0,0]}>
            <LabelList dataKey="consumoEstandarDiario" position="top" formatter={(v) => v == null ? '' : fmt(v)} fontSize={10} />
          </Bar>}
        </BarChart>
      </ResponsiveContainer>}
    </div>
  </>;
}
