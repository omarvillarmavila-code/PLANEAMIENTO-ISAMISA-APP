import React, { useEffect, useState } from 'react';
import { supabase } from '../../../../../lib/supabase';
import LumbraLoadingCircle from '../01.Datos_generales/00.LoadingCircle';
import { allPages, queryMessage, sharedQuery } from '../consulta-granja';

const formatValue = (value) => value == null || value === '' ? '—'
  : Number(value).toLocaleString('es-PE', { maximumFractionDigits: 0 });
const formatDate = (value) => value ? String(value).split('T')[0].split('-').reverse().join('/') : '—';

export default function LumbraLoteDetailPanel({ sexo = 'HEMBRA', lote = '', dataRows }) {
  const key = JSON.stringify(['saldos-lumbra', lote, sexo]);
  const [state, setState] = useState({ key: '', rows: [], loading: false, error: '' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (dataRows !== undefined) { setState({ key, rows: dataRows, loading: false, error: '' }); return; }
    let active = true;
    if (!lote) {
      setState({ key, rows: [], loading: false, error: '' });
      return;
    }
    setState({ key, rows: [], loading: true, error: '' });
    sharedQuery(key, (signal) => {
      if (!supabase) throw new Error('Supabase no está configurado');
      return allPages(() => supabase.schema('lumbra').from('vista_saldos_por_lote')
        .select('*').eq('cod_lote', lote).eq('sexo', sexo)
        .order('fecha').order('etapa').order('edad_sem'), signal);
    }).then((rows) => {
      if (active) setState({ key, rows, loading: false, error: '' });
    }).catch((error) => {
      if (active) setState({ key, rows: [], loading: false, error: queryMessage(error) });
    });
    return () => { active = false; };
  }, [key, lote, sexo, attempt, dataRows]);
  // No mostrar las filas del lote anterior mientras se carga la nueva selección.
  const { rows, loading, error } = state.key === key ? state
    : { rows: [], loading: Boolean(lote), error: '' };

  return <div className="panel stage-table lote-table">
    <strong className="stage-pie-title">Saldos por lote · {sexo}{lote ? ` · ${lote}` : ''}</strong>
    {!lote ? <p className="muted">Selecciona un lote para ver sus saldos.</p>
      : loading ? <LumbraLoadingCircle text={`Cargando saldos de ${sexo.toLowerCase()}...`} />
        : error ? <div role="alert"><p>{error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)}>Reintentar</button></div>
          : !rows.length ? <p className="muted">No hay saldos de {sexo.toLowerCase()} para el lote {lote}.</p>
            : <div className="table-scroll">
              <table>
                <thead><tr>
                  <th>Fecha</th><th>Etapa</th><th>Edad</th><th>Saldo inicial</th>
                  <th>Saldo final</th><th>Mortalidad</th><th>Descarte</th><th>Venta</th>
                </tr></thead>
                <tbody>{rows.map((row, index) => <tr key={`${row.fecha}-${row.etapa}-${index}`}>
                  <td>{formatDate(row.fecha)}</td><td>{row.etapa || '—'}</td>
                  <td>{row.edad_sem ?? '—'}</td><td>{formatValue(row.saldo_ini)}</td>
                  <td>{formatValue(row.saldo_final)}</td><td>{formatValue(row.mortal)}</td>
                  <td>{formatValue(row.desc_unid)}</td><td>{formatValue(row.venta_unid)}</td>
                </tr>)}</tbody>
              </table>
            </div>}
  </div>;
}
