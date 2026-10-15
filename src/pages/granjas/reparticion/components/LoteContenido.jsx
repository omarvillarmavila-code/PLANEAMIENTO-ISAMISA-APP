import React, { useMemo } from 'react';
import useLoteReparticion from './use-lote-reparticion';
import TablaSaldos from '../../lumbra/components/02.Saldo_por_lote/02.Detalle_de_saldos_por_lote';
import LineaTemporal from '../../lumbra/components/03.Detalles por lote/LineaTemporal';
import LineasConsumoSemanal from '../../lumbra/components/03.Detalles por lote/LineasConsumoSemanal';
import { buildWeeklyConsumptionChart } from '../../lumbra/components/03.Detalles por lote/consumo-semanal';
import { serieMortalidadAcumulada } from '../../lumbra/components/03.Detalles por lote/mortalidad-acumulada';
import { agruparPeriodos } from '../../lumbra/components/03.Detalles por lote/periodos-detalle';
import LoadingCircle from '../../lumbra/components/01.Datos_generales/00.LoadingCircle';
import './lote-contenido.css';

function Postura({ history, field, label, color }) {
  const data = useMemo(() => agruparPeriodos(history.filter((r) => /^POSTURA\s*-\s*PAVO$/.test(r.etapa))).map(({ rows, ...period }) => {
    const available = rows.every((r) => r[field] != null && r.saldo_final_hembra != null);
    const base = rows.reduce((s, r) => s + (r.saldo_final_hembra || 0), 0);
    const standards = rows.map((r) => r[`${field}_std`]).filter((v) => v != null);
    return { ...period, porcentaje: available && base > 0 ? rows.reduce((s, r) => s + r[field], 0) * 100 / base : null,
      estandar: standards.length ? standards.reduce((a, b) => a + b, 0) / standards.length : null };
  }), [history, field]);
  return <div className="panel lote-chart"><strong className="stage-pie-title">% postura de huevo {label} por semana</strong>
    <LineaTemporal data={data} showMissingAgeWarning={false} series={[{ key: 'porcentaje', name: label === 'incubable' ? '%Hinc' : '%HCom', color }, { key: 'estandar', name: 'Estándar', color: '#6b7280' }]} />
  </div>;
}

function Mortalidad({ history, sexo }) {
  const data = useMemo(() => serieMortalidadAcumulada(history, sexo), [history, sexo]);
  return <div className="panel lote-chart"><strong className="stage-pie-title">% mortalidad acumulada de {sexo === 'hembra' ? 'hembras' : 'machos'}</strong>
    {data.length > 0 && data.every((r) => r.porcentaje == null) && <p className="muted">Faltan datos de mortalidad acumulada o población de la edad 1 para calcular el porcentaje real.</p>}
    <LineaTemporal data={data} stageBackground series={[{ key: 'porcentaje', name: 'Real acumulada', color: sexo === 'hembra' ? '#dc2626' : '#2563eb' }, { key: 'estandar', name: 'Estándar acumulada', color: '#6b7280' }]} />
  </div>;
}

function Consumo({ consumption, history, sexo }) {
  const { data, series } = useMemo(() => buildWeeklyConsumptionChart(consumption, history, sexo), [consumption, history, sexo]);
  return <div className="panel lote-chart"><strong className="stage-pie-title">Consumo de alimento de {sexo === 'hembra' ? 'hembras' : 'machos'} por semana</strong>
    <LineasConsumoSemanal data={data} series={series} />
  </div>;
}

export default function LoteContenido({ linea, lote, mode = 'detalle' }) {
  const { data, loading, error, retry } = useLoteReparticion({ linea, lote });
  const saldosHembra = useMemo(() => data?.saldos.filter((r) => r.sexo === 'HEMBRA') ?? [], [data]);
  const saldosMacho = useMemo(() => data?.saldos.filter((r) => r.sexo === 'MACHO') ?? [], [data]);
  if (!lote) return <p className="panel muted">Selecciona un lote para ver {mode === 'saldos' ? 'sus saldos' : 'su historial de vida'}.</p>;
  if (loading) return <LoadingCircle text="Cargando historial del lote..." />;
  if (error) return <div className="panel" role="alert"><p>{error}</p><button type="button" onClick={retry}>Reintentar</button></div>;
  if (!data) return null;
  if (mode === 'saldos') return <div className="lote-sexos lote-saldos-lumbra">
    <TablaSaldos lote={lote} sexo="HEMBRA" dataRows={saldosHembra} />
    <TablaSaldos lote={lote} sexo="MACHO" dataRows={saldosMacho} />
  </div>;
  if (!data.history.length) return <p className="panel muted">No hay datos de historial para este lote.</p>;
  return <>
    <p className="muted">Historial completo del lote y comparación con estándares de pavos por código, edad y sexo.</p>
    <div className="lote-chart-stack reparticion-lote-charts">
      <Postura history={data.history} field="prod_hinc" label="incubable" color="#16a34a" />
      <Mortalidad history={data.history} sexo="hembra" /><Mortalidad history={data.history} sexo="macho" />
      <Consumo {...data} sexo="hembra" /><Consumo {...data} sexo="macho" />
    </div>
  </>;
}
