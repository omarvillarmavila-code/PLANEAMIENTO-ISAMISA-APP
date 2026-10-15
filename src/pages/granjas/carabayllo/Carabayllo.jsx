import React, { useEffect, useMemo, useState } from 'react';
import useDatosCarabayllo from './use-datos-carabayllo';
import { buildCarabaylloWeek, carabaylloLotMetrics } from './datos-carabayllo';
import TarjetaCampana, { dateText } from '../asia/components/TarjetaCampana';
import TablaCampana from '../asia/components/TablaCampana';
import AvesPorLote from '../asia/components/AvesPorLote';
import MetricasPorLote from '../asia/components/MetricasPorLote';
import LoadingCircle from '../lumbra/components/01.Datos_generales/00.LoadingCircle';
export default function Carabayllo() {
  const { data, loading, error, retry } = useDatosCarabayllo();
  const [period, setPeriod] = useState({ year: '', week: '' });
  const [group, setGroup] = useState('TODAS');
  const periods = data?.periods ?? [];
  useEffect(() => {
    if (!data?.periods.length) return;
    setPeriod((previous) => data.periods.some((r) => r.year === previous.year && r.week === previous.week) ? previous : data.periods.at(-1));
  }, [data]);
  const weekly = useMemo(() => buildCarabaylloWeek(data?.rows ?? [], period.year, period.week), [data, period.year, period.week]);
  const years = [...new Set(periods.map((r) => r.year))];
  const weeks = periods.filter((r) => r.year === period.year);
  const selected = weeks.find((r) => r.week === period.week);
  const selectedGroups = weekly.campaigns.filter((r) => group === 'TODAS' || group === r.key);
  const metrics = useMemo(() => carabaylloLotMetrics(weekly.rows, group), [weekly, group]);
  useEffect(() => { if (group !== 'TODAS' && !weekly.campaigns.some((r) => r.key === group)) setGroup('TODAS'); }, [weekly, group]);
  return <section className="page">
    <div className="page-heading"><h2>Granja Carabayllo</h2></div>
    <nav className="lumbra-tabs" aria-label="Secciones de Granja Carabayllo"><button type="button" className="active" aria-current="page">Datos generales</button></nav>
    {loading ? <LoadingCircle text="Cargando datos de Granja Carabayllo..." />
      : error ? <div className="panel" role="alert"><p>{error}</p><button type="button" onClick={retry}>Reintentar</button></div>
        : <>
          <div className="weekly-filter panel">
            <label>Año<select value={period.year} disabled={!years.length} onChange={(e) => {
              const next = periods.filter((r) => r.year === e.target.value).at(-1); if (next) setPeriod(next);
            }}><option value="">Seleccione</option>{years.map((year) => <option key={year}>{year}</option>)}</select></label>
            <label>Semana<select value={period.week} disabled={!weeks.length} onChange={(e) => setPeriod({ year: period.year, week: e.target.value })}><option value="">Seleccione</option>{weeks.map((r) => <option key={r.week} value={r.week}>Sem {r.week}</option>)}</select></label>
            {selected && <div className="week-range"><span>Inicio: <strong>{dateText(selected.first)}</strong></span><span>Fin: <strong>{dateText(selected.last)}</strong></span></div>}
          </div>
          {!!data?.invalidDates && <p className="muted" role="status">Hay {data.invalidDates} registros con fechas inválidas.</p>}
          {!!data?.missingCalendar && <p className="muted" role="status">Hay {data.missingCalendar} fechas sin correspondencia en el calendario.</p>}
          {!periods.length ? <div className="panel"><p className="muted">No hay registros de Carabayllo con fechas y semanas disponibles en el registro diario de engorde y recría.</p></div> : <>
            <div className="asia-campaign-columns carabayllo-stage-columns">{weekly.campaigns.map((r) => <div key={r.key} className="asia-campaign-column"><TarjetaCampana data={r} /><TablaCampana data={r} /></div>)}</div>
            {weekly.unknownSex > 0 && <p className="muted" role="status">Hay {weekly.unknownSex} registros sin sexo HEMBRA o MACHO; no se distribuyen entre los gráficos por sexo.</p>}
            <div className="weekly-filter panel"><label>Etapa de los gráficos por lote<select value={group} onChange={(e) => setGroup(e.target.value)}><option value="TODAS">Todas las etapas</option>{weekly.campaigns.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</select></label></div>
            <AvesPorLote farmName="Carabayllo" data={selectedGroups.flatMap((r) => r.population)} />
            <MetricasPorLote farmName="Carabayllo" showStandard={false} rows={metrics} />
          </>}
        </>}
  </section>;
}
