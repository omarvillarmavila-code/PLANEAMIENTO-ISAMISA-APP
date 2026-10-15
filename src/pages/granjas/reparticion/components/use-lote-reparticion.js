import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { allPages, sharedQuery, queryMessage } from '../../lumbra/components/consulta-granja';
import { buildReparticionHistory } from './historial-reparticion';
import { loadTurkeyStandards } from './estandares-pavos';

export default function useLoteReparticion({ linea = '', lote = '' }) {
  const key = JSON.stringify(['historial-reparticion', linea, lote]);
  const [state, setState] = useState({});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    if (!lote) return;
    setState({ key, loading: true });
    sharedQuery(key, async (signal) => {
      if (!supabase) throw new Error('Supabase no está configurado');
      const rows = await allPages(() => {
        let query = supabase.from('registro_diario_granja').select('*')
          .in('Unid_Prod', ['REPARTICIÓN', 'REPARTICION']).eq('Cod_Lote', lote);
        if (linea) query = query.eq('Linea_Madre', linea);
        return query.order('Fecha', { ascending: false }).order('id');
      }, signal);
      if (!rows.length) return { history: [], consumption: [], saldos: [] };
      const dates = rows.map((r) => r.Fecha).filter(Boolean).sort();
      const calendar = await allPages(() => supabase.from('calendario').select('fecha,ano,semana')
        .gte('fecha', dates[0]).lte('fecha', dates.at(-1)).order('fecha'), signal);
      return loadTurkeyStandards(supabase, buildReparticionHistory(rows, calendar), signal);
    }, 45000).then((data) => { if (active) setState({ key, data }); })
      .catch((error) => { if (active) setState({ key, error: queryMessage(error) }); });
    return () => { active = false; };
  }, [key, linea, lote, attempt]);
  return { ...(state.key === key ? state : { loading: Boolean(lote) }), retry: () => setAttempt((v) => v + 1) };
}
