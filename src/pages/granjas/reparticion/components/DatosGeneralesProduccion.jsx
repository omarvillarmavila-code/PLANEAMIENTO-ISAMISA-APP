import React, { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { allPages, sharedQuery, queryMessage } from '../../lumbra/components/consulta-granja';
import Postura from '../../lumbra/components/01.Datos_generales/04.Tarjeta_postura_por_lote';
import Mortalidad from '../../lumbra/components/01.Datos_generales/05.Tarjeta_mortalidad_por_lote';
import Consumo from '../../lumbra/components/01.Datos_generales/06.Tarjeta_consumo_por_lote';
import LoadingCircle from '../../lumbra/components/01.Datos_generales/00.LoadingCircle';
import { buildReparticionData } from './datos-generales';
import { loadTurkeyStandards } from './estandares-pavos';

export default function DatosGeneralesProduccion({ year, week }) {
  const key = JSON.stringify(['reparticion-produccion', year, week]);
  const [state, setState] = useState({});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    if (!year || !week || year === 'actual' || week === 'actual') return;
    setState({ key, loading: true });
    sharedQuery(key, async (signal) => {
      if (!supabase) throw new Error('Supabase no está configurado');
      const { data: calendar, error } = await supabase.from('calendario').select('fecha').eq('ano', year).eq('semana', week).abortSignal(signal);
      if (error) throw error;
      if (!calendar.length) return buildReparticionData([]);
      const rows = await allPages(() => supabase.from('registro_diario_granja').select('*')
        .in('Unid_Prod', ['REPARTICIÓN', 'REPARTICION']).in('Fecha', calendar.map((r) => r.fecha)).order('id'), signal);
      return loadTurkeyStandards(supabase, buildReparticionData(rows), signal);
    }).then((data) => { if (active) setState({ key, data }); })
      .catch((error) => { if (active) setState({ key, error: queryMessage(error) }); });
    return () => { active = false; };
  }, [key, year, week, attempt]);
  if (!year || !week || year === 'actual' || week === 'actual') return null;
  if (state.key !== key || state.loading) return <LoadingCircle text="Cargando producción de Repartición..." />;
  if (state.error) return <div className="panel" role="alert"><p>{state.error}</p><button type="button" onClick={() => setAttempt((v) => v + 1)}>Reintentar</button></div>;
  if (!state.data?.consumption.length) return <p className="panel muted">No hay registros de Repartición para el período seleccionado.</p>;
  const missingStandards = state.data.consumption.flatMap((row) => ['hembra', 'macho'].flatMap((sex) =>
    row[`dias_registrados_${sex}`] > 0 && row[`standard_status_${sex}`]
      ? [{ lote: row.lote, sex, reason: row[`standard_status_${sex}`] }] : []));
  return <>
    <p className="muted">Comparación con estándares de pavos por código, edad y sexo. Los valores sin coincidencia se muestran sin dato.</p>
    {missingStandards.length > 0 && <details className="panel">
      <summary style={{ cursor: 'pointer' }}>Revisar comparativos sin estándar ({missingStandards.length})</summary>
      <ul>{missingStandards.map((item) => <li key={`${item.lote}-${item.sex}`}><strong>{item.lote} · {item.sex === 'hembra' ? 'Hembras' : 'Machos'}:</strong> {item.reason}</li>)}</ul>
    </details>}
    {state.data.production.length ? <Postura dataRows={state.data.production} farmLabel="Repartición" showCommercial={false} /> : <p className="panel muted">No hay registros de postura para el período seleccionado.</p>}
    <Mortalidad dataRows={state.data.mortality} farmLabel="Repartición" />
    <Consumo dataRows={state.data.consumption} farmLabel="Repartición" unit="g_ave_dia" />
  </>;
}
