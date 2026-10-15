import { useEffect, useState } from 'react';
import { supabase } from '../../../../../lib/supabase';
import { allPages, queryMessage, sharedQuery } from '../consulta-granja';

export default function useHistorialLote({ linea = '', lote = '' }) {
  const [state, setState] = useState({ rows: [], loading: false, error: '' });
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify(['historial-lote', linea, lote]);
  useEffect(() => {
    let active = true;
    if (!lote) { setState({ key, rows: [], loading: false, error: '' }); return; }
    setState({ key, rows: [], loading: true, error: '' });
    sharedQuery(key, (signal) => {
      if (!supabase) throw new Error('Supabase no está configurado');
      return allPages(() => {
        let query = supabase.rpc('app_lumbra_postura', { p_lot: lote })
          .select('*').eq('lote', lote);
        if (linea) query = query.eq('linea', linea);
        return query.order('ano').order('semana').order('linea').order('lote').order('etapa');
      }, signal);
    }).then((rows) => {
      if (active) setState({ key, rows, loading: false, error: '' });
    }).catch((error) => {
      if (active) setState({ key, rows: [], loading: false, error:
        ['PGRST205', '42P01'].includes(error.code)
          ? 'Falta habilitar la vista de postura por lote en Supabase (SQL 03).'
          : queryMessage(error) });
    });
    return () => { active = false; };
  }, [key, linea, lote, attempt]);
  return { ...(state.key === key ? state : { rows: [], loading: Boolean(lote), error: '' }), retry: () => setAttempt((value) => value + 1) };
}
