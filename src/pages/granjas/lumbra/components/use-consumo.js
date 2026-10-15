import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { allPages, queryMessage, sharedQuery } from './consulta-granja';

export default function useConsumo({ year, week, linea = '', lote = '', historial = false, enabled = true }) {
  const [state, setState] = useState({ rows: [], loading: false, error: '' });
  const [attempt, setAttempt] = useState(0);
  const valid = enabled && (historial ? Boolean(lote) : year && year !== 'actual' && (week === undefined || (week && week !== 'actual')));
  const key = JSON.stringify(['consumo', historial ? 'historial' : String(year), week === undefined ? null : String(week), linea, lote]);
  useEffect(() => {
    let active = true;
    if (!valid) { setState({ key, rows: [], loading: false, error: '' }); return; }
    setState({ key, rows: [], loading: true, error: '' });
    sharedQuery(key, (signal) => {
      if (!supabase) throw new Error('Supabase no está configurado');
      return allPages(() => {
        let query = supabase.rpc('app_lumbra_consumo', { p_year: historial ? null : Number(year), p_week: week === undefined ? null : Number(week), p_lot: lote || null })
          .select(week === undefined ? 'ano,semana,edad_lote,linea,lote,consumo_kg_hembra,consumo_kg_macho,alimentos_hembra,alimentos_macho,consumo_std_kg_hembra,consumo_std_kg_macho' : '*');
        if (!historial) query = query.eq('ano', year);
        if (week !== undefined) query = query.eq('semana', week);
        if (linea) query = query.eq('linea', linea);
        if (lote) query = query.eq('lote', lote);
        return query.order('ano').order('semana').order('linea').order('lote');
      }, signal);
    }).then((rows) => {
      if (active) setState({ key, rows, loading: false, error: '' });
    }).catch((error) => {
      if (active) {
        console.error('Error cargando consumo:', error);
        setState({ key, rows: [], loading: false, error: queryMessage(error) });
      }
    });
    // Otra tarjeta puede estar esperando la misma consulta. Solo desvincular
    // este consumidor; el límite de tiempo cancela la petición compartida.
    return () => { active = false; };
  }, [key, valid, year, week, linea, lote, historial, attempt]);
  const current = state.key === key ? state : { rows: [], loading: Boolean(valid), error: '' };
  return { ...current, retry: () => setAttempt((value) => value + 1) };
}
