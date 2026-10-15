import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { allPages, sharedQuery, queryMessage } from '../lumbra/components/consulta-granja';
import { asiaDate } from '../asia/components/datos-asia';
import { prepareCarabaylloRecords } from './datos-carabayllo';
export default function useDatosCarabayllo() {
  const [state, setState] = useState({ loading: true });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ loading: true });
    sharedQuery('carabayllo-registro-diario', async (signal) => {
      if (!supabase) throw new Error('Supabase no está configurado');
      const rows = await allPages(() => supabase.from('registro_diario_engorde_recria').select('*')
        .ilike('Unid_Prod', '%CARABAYLLO%').order('id'), signal);
      const dates = rows.map((r) => asiaDate(r.Fecha)).filter(Boolean).sort();
      if (!dates.length) return prepareCarabaylloRecords(rows, []);
      const calendar = await allPages(() => supabase.from('calendario').select('fecha,ano,semana')
        .gte('fecha', dates[0]).lte('fecha', dates.at(-1)).order('fecha'), signal);
      return prepareCarabaylloRecords(rows, calendar);
    }, 45000).then((data) => { if (active) setState({ data, loading: false }); })
      .catch((error) => { if (active) setState({ error: queryMessage(error), loading: false }); });
    return () => { active = false; };
  }, [attempt]);
  return { ...state, retry: () => setAttempt((v) => v + 1) };
}
