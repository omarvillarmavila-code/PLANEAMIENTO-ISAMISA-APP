import React, { useEffect, useMemo, useState } from 'react';
import useDatosAsia from './components/use-datos-asia';
import { buildAsiaWeek, CAMPAIGNS } from './components/datos-asia';
import TarjetaCampana, { dateText } from './components/TarjetaCampana';
import TablaCampana from './components/TablaCampana';
import AvesPorLote from './components/AvesPorLote';
import MetricasPorLote from './components/MetricasPorLote';
import DistribucionPesos from './components/DistribucionPesos';
import usePesosAsia, { weightPeriods } from './components/use-pesos-asia';
import LoadingCircle from '../lumbra/components/01.Datos_generales/00.LoadingCircle';
import { filterDailyIdentity, filterWeightIdentity } from './components/filtros-lote';

export default function Asia() {
  const { data, loading, error, retry } = useDatosAsia();
  const [period, setPeriod] = useState({ year: '', week: '' });
  const [campaign, setCampaign] = useState('TODAS');
  const [tab, setTab] = useState('GENERAL');
  const [lotSearch, setLotSearch] = useState('');
  const [sexFilter, setSexFilter] = useState('');
  const [colorFilter, setColorFilter] = useState('');
  const [ageFilter, setAgeFilter] = useState('');
  const searchedLot = lotSearch.trim().toUpperCase();
  const searchedCampaign = CAMPAIGNS.find((item) => item.lots.includes(searchedLot));
  const weights = usePesosAsia(tab !== 'GENERAL');
  const lotRows = useMemo(() => (data?.rows ?? []).filter((r) => r.Cod_Lote === searchedLot), [data, searchedLot]);
  const sexes = [...new Set(lotRows.map((r) => String(r.Sexo ?? '').trim().toUpperCase()).filter(Boolean))].sort();
  const colors = [...new Set(lotRows.map((r) => String(r.Variedad ?? '').trim().toUpperCase()).filter(Boolean))].sort();
  const searchDaily = useMemo(() => filterDailyIdentity(data?.rows ?? [], sexFilter, colorFilter), [data, sexFilter, colorFilter]);
  const searchWeights = useMemo(() => weights.data ? { rows: filterWeightIdentity(weights.data.rows, data?.rows ?? [], sexFilter, colorFilter) } : undefined, [weights.data, data, sexFilter, colorFilter]);
  const ages = useMemo(() => [...new Set((searchWeights?.rows ?? []).filter((r) => r.lote === searchedLot && r.edad_pesaje_sem != null).map((r) => Number(r.edad_pesaje_sem)))].sort((a, b) => a - b), [searchWeights, searchedLot]);
  useEffect(() => { if (ageFilter !== '' && !ages.includes(Number(ageFilter))) setAgeFilter(''); }, [ages, ageFilter]);
  const periods = useMemo(() => {
    if (tab === 'GENERAL') return data?.periods ?? [];
    const lots = tab === 'BUSCAR_LOTE' ? searchedCampaign ? [searchedLot] : [] : CAMPAIGNS.find((item) => item.key === tab)?.lots ?? [];
    return weightPeriods((weights.data?.rows ?? []).filter((row) => lots.includes(row.lote)
      && (tab !== 'BUSCAR_LOTE' || ageFilter === '' || row.edad_pesaje_sem != null && Number(row.edad_pesaje_sem) === Number(ageFilter))));
  }, [tab, data, weights.data, searchedLot, searchedCampaign, ageFilter]);
  const tabs = [
    { key: 'GENERAL', label: 'Datos generales' },
    { key: 'BUSCAR_LOTE', label: 'Buscar por lote' },
    { key: 'TROZADO', label: 'Campaña Trozado' },
    { key: 'EMPACADO', label: 'Campaña Empacado' },
    { key: 'CAMPAÑA VIVO', label: 'Campaña vivo' },
  ];
  useEffect(() => {
    if (!periods.length) return;
    setPeriod((previous) => periods.some((r) => r.year === previous.year && r.week === previous.week)
      ? previous : periods.at(-1));
  }, [periods]);
  const years = [...new Set(periods.map((r) => r.year))];
  const weeks = periods.filter((r) => r.year === period.year);
  const selected = weeks.find((r) => r.week === period.week);
  const weekly = useMemo(() => buildAsiaWeek(data?.rows ?? [], period.year, period.week, data?.standards), [data, period.year, period.week]);
  const filter = tab === 'GENERAL' ? campaign : tab;
  const visibleCampaigns = weekly.campaigns.filter((r) => tab === 'GENERAL' || r.key === tab);
  const selectedCampaigns = weekly.campaigns.filter((r) => filter === 'TODAS' || r.key === filter);
  const lotMetrics = useMemo(() => selectedCampaigns.flatMap((r) => r.lotMetrics), [weekly, filter]);
  const changeYear = (event) => { const year = event.target.value; const next = periods.filter((r) => r.year === year).at(-1); if (next) setPeriod(next); };
  return <section className="page">
    <div className="page-heading"><h2>Granja Asia</h2></div>
    <nav className="lumbra-tabs" aria-label="Secciones de Granja Asia">{tabs.map((item) =>
      <button key={item.key} type="button" className={tab === item.key ? 'active' : ''} aria-current={tab === item.key ? 'page' : undefined} onClick={() => setTab(item.key)}>{item.label}</button>
    )}</nav>
    {tab === 'GENERAL' && loading ? <LoadingCircle text="Cargando datos de Granja Asia..." />
      : tab === 'GENERAL' && error ? <div className="panel" role="alert"><p>{error}</p><button type="button" onClick={retry}>Reintentar</button></div>
        : <>
          <div className={`weekly-filter panel${tab === 'BUSCAR_LOTE' ? ' asia-search-filters' : ''}`}>
            <label>Año<select disabled={!years.length} value={period.year} onChange={changeYear}><option value="">Seleccione</option>{years.map((y) => <option key={y}>{y}</option>)}</select></label>
            <label>Semana<select disabled={!weeks.length} value={period.week} onChange={(e) => setPeriod({ year: period.year, week: e.target.value })}><option value="">Seleccione</option>{weeks.map((r) => <option key={r.week} value={r.week}>Sem {r.week}</option>)}</select></label>
            {tab === 'BUSCAR_LOTE' && <>
              <label>Lote<select value={lotSearch} onChange={(e) => { setLotSearch(e.target.value); setSexFilter(''); setColorFilter(''); setAgeFilter(''); }}><option value="">Seleccione lote</option>{CAMPAIGNS.map((item) => <optgroup key={item.key} label={item.label}>{item.lots.map((lot) => <option key={lot} value={lot}>{lot}</option>)}</optgroup>)}</select></label>
              <label>Sexo<select value={sexFilter} disabled={!searchedCampaign || loading} onChange={(e) => setSexFilter(e.target.value)}><option value="">Todos</option>{sexes.map((sex) => <option key={sex} value={sex}>{sex}</option>)}</select></label>
              <label>Color<select value={colorFilter} disabled={!searchedCampaign || loading} onChange={(e) => setColorFilter(e.target.value)}><option value="">Todos</option>{colors.map((color) => <option key={color} value={color}>{color}</option>)}</select></label>
              <label>Edad (sem)<select value={ageFilter} disabled={!searchedCampaign || weights.loading || !ages.length} onChange={(e) => setAgeFilter(e.target.value)}><option value="">Todas</option>{ages.map((age) => <option key={age} value={age}>{age}</option>)}</select></label>
            </>}
            {selected && <div className="week-range"><span>Inicio: <strong>{dateText(selected.first)}</strong></span><span>Fin: <strong>{dateText(selected.last)}</strong></span></div>}
          </div>
          {!!data?.invalidDates && <p role="status" className="muted">Hay {data.invalidDates} registros con fecha inválida.</p>}
          {!!data?.missingCalendar && <p role="status" className="muted">Hay {data.missingCalendar} fechas sin correspondencia en el calendario.</p>}
          {tab === 'BUSCAR_LOTE' ? searchedCampaign
            ? <DistribucionPesos campaign={searchedCampaign.key} selectedLot={searchedLot} selectedAge={ageFilter} year={period.year} week={period.week} standards={data?.standards} {...weights} data={searchWeights} dailyRows={searchDaily} />
            : <p className="panel muted">{lotSearch ? 'Selecciona un lote de la lista de campañas para consultar su reporte.' : 'Escribe o selecciona el lote que deseas consultar.'}</p>
            : tab !== 'GENERAL' ? <DistribucionPesos campaign={tab} year={period.year} week={period.week} dailyRows={data?.rows} standards={data?.standards} {...weights} /> : !periods.length ? <p className="panel muted">No hay registros de Asia con fechas y semanas disponibles en registro_diario_engorde_recria.</p> : <>
            {tab === 'GENERAL' && <>
            <div className="asia-campaign-columns">{visibleCampaigns.map((r) => <div key={r.key} className="asia-campaign-column"><TarjetaCampana data={r} /><TablaCampana data={r} /></div>)}</div>
            {tab === 'GENERAL' && weekly.unassigned.length > 0 && <details className="panel"><summary>Lotes sin campaña asignada ({weekly.unassigned.length})</summary><p>{weekly.unassigned.join(', ')}</p><p className="muted">Estos lotes quedan pendientes de clasificación y no se suman a las tres campañas.</p></details>}
            {weekly.unknownSex > 0 && <p role="status" className="muted">Hay {weekly.unknownSex} filas sin sexo HEMBRA o MACHO; no se distribuyen entre los gráficos por sexo.</p>}
            {tab === 'GENERAL' && <div className="weekly-filter panel"><label>Campaña de los gráficos por lote<select value={campaign} onChange={(e) => setCampaign(e.target.value)}><option value="TODAS">Todas las campañas</option>{CAMPAIGNS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</select></label></div>}
            <AvesPorLote data={selectedCampaigns.flatMap((r) => r.population)} />
            <MetricasPorLote rows={lotMetrics} />
            </>}
          </>}
        </>}
  </section>;
}
