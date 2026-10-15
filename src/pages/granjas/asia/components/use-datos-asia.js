import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { allPages, sharedQuery, queryMessage } from '../../lumbra/components/consulta-granja';
import { asiaDate, prepareAsiaRecords, CAMPAIGNS } from './datos-asia';
import { ASIA_STANDARDS } from './estandares-asia-datos';

export default function useDatosAsia() {
  const [state, setState] = useState({ loading: true });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ loading: true });
    sharedQuery('asia-registro-diario', async (signal) => {
      if (!supabase) throw new Error('Supabase no está configurado');
      const lots = CAMPAIGNS.flatMap((r) => r.lots);
      const [namedAsia, confirmedLots] = await Promise.all([
        allPages(() => supabase.from('registro_diario_engorde_recria').select('*')
          .eq('Unid_Prod', 'ASIA').order('id'), signal),
        allPages(() => supabase.from('registro_diario_engorde_recria').select('*')
          .eq('Unid_Prod', 'TERCEROS - PAVOS').in('Cod_Lote', lots).order('id'), signal),
      ]);
      const rows = [...namedAsia, ...confirmedLots];
      const dates = rows.map((r) => asiaDate(r.Fecha)).filter(Boolean).sort();
      if (!dates.length) return prepareAsiaRecords(rows, []);
      const calendar = await allPages(() => supabase.from('calendario').select('fecha,ano,semana')
        .gte('fecha', dates[0]).lte('fecha', dates.at(-1)).order('fecha'), signal);
      let standards = ASIA_STANDARDS;
      try {
        const saved = await allPages(() => supabase.from('estandares_pavos_asia').select('*')
          .order('color').order('variedad').order('sexo').order('edad_sem'), signal);
        if (saved.length) standards = saved;
      } catch (error) {
        // Los datos entregados por el usuario permiten comparar antes de la
        // carga de la tabla. No se reemplazan por estándares de reproducción.
        console.warn('Se usa el estándar de Asia suministrado por el usuario:', error.code);
      }
      return { ...prepareAsiaRecords(rows, calendar), standards };
    }, 45000).then((data) => { if (active) setState({ data, loading: false }); })
      .catch((error) => { if (active) setState({ error: queryMessage(error), loading: false }); });
    return () => { active = false; };
  }, [attempt]);
  return { ...state, retry: () => setAttempt((v) => v + 1) };
}
