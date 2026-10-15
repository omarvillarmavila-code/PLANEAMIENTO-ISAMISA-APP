import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { allPages, sharedQuery, queryMessage } from '../../lumbra/components/consulta-granja';
import { withSampleAges } from './edad-pesaje';
import { excludeKnownWeightErrors } from './validacion-pesos';
export function weightPeriods(rows) {
  const periods = new Map();
  for (const row of rows) {
    const fecha = String(row.fecha ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !(+row.semana_cal >= 1 && +row.semana_cal <= 53)) continue;
    const year = fecha.slice(0, 4), week = String(Number(row.semana_cal)), key = `${year}-${week}`;
    const period = periods.get(key) ?? { year, week, first: fecha, last: fecha };
    if (fecha < period.first) period.first = fecha;
    if (fecha > period.last) period.last = fecha;
    periods.set(key, period);
  }
  return [...periods.values()].sort((a, b) => +a.year - +b.year || +a.week - +b.week);
}
export default function usePesosAsia(enabled) {
  const [state, setState] = useState({ loading: true });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setState({ loading: true });
    sharedQuery('asia-pesajes-con-ingreso', async (signal) => {
      if (!supabase) throw new Error('Supabase no está configurado');
      const weights = await allPages(() => supabase.from('vista_pesos_granja_asia').select('*').order('id'), signal);
      const lots = [...new Set(weights.map((row) => String(row.lote ?? '').trim().toUpperCase()).filter(Boolean))];
      if (!lots.length) return [];
      const daily = await allPages(() => supabase.from('registro_diario_engorde_recria').select('id,Cod_Lote,Fecha_Ing')
        .in('Unid_Prod', ['ASIA', 'TERCEROS - PAVOS']).in('Cod_Lote', lots).order('id'), signal);
      return excludeKnownWeightErrors(withSampleAges(weights, daily));
    }, 45000).then((rows) => { if (active) setState({ loading: false, data: { rows: rows.map((row) => ({
      ...row, lote: String(row.lote ?? '').trim().toUpperCase(),
    })) } }); })
      .catch((error) => { if (active) setState({ loading: false, error: ['42P01', 'PGRST205'].includes(error.code)
        ? 'Falta crear la vista vista_pesos_granja_asia en Supabase.' : error.code === '42501'
          ? 'Tu sesión no tiene permiso para consultar los pesajes de Asia.' : queryMessage(error) }); });
    return () => { active = false; };
  }, [enabled, attempt]);
  return { ...state, retry: () => setAttempt((v) => v + 1) };
}
