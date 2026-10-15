import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { BATCH_SIZE, MAX_BYTES } from './csv-granja';
import './carga-csv-granja.css';

const count = (value) => Number(value || 0).toLocaleString('es-PE');
function errorMessage(error) {
  if (error.code === 'PGRST202' || error.code === '42883') return 'La carga de archivos aún no está habilitada. Contacta al administrador.';
  if (error.code === '42501') return 'Tu cuenta no tiene permiso para importar estos registros. Contacta al administrador.';
  if (error.code === '23505') return 'La base detectó una clave duplicada. No se guardó esta importación. Revisa el archivo y los registros existentes.';
  if (error.code === '57014') return 'La operación superó el tiempo permitido. La carga sigue disponible para reintentar.';
  return error.message || 'No se pudo completar la operación. Comprueba la conexión y vuelve a intentarlo.';
}

export default function CargaCSVGranja({ onImported }) {
  const { session } = useAuth();
  const [schema, setSchema] = useState(null);
  const [setupLoading, setSetupLoading] = useState(true);
  const [connectionMessage, setConnectionMessage] = useState('');
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [outcome, setOutcome] = useState(null);
  const [dragging, setDragging] = useState(false);
  const workerRef = useRef(null);
  const aliveRef = useRef(true);
  const pauseRef = useRef(false);
  const busyRef = useRef(false);
  const inputRef = useRef(null);
  const requestRef = useRef(0);
  const dragDepthRef = useRef(0);
  const busy = ['validating', 'uploading', 'finalizing'].includes(phase);
  const importing = ['uploading', 'finalizing'].includes(phase);
  const validationFinished = Boolean(result) || phase === 'error';

  useEffect(() => {
    if (busy) { dragDepthRef.current = 0; setDragging(false); }
  }, [busy]);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; pauseRef.current = true; workerRef.current?.terminate(); requestRef.current++; };
  }, []);

  const loadSchema = useCallback(async () => {
    setSetupLoading(true); setConnectionMessage(''); setSchema(null);
    try {
      if (!supabase || !session) throw new Error('Inicia sesión para cargar registros.');
      const { data, error } = await supabase.rpc('granja_csv_esquema');
      if (error) throw error;
      if (!data?.columns?.length) throw new Error('No se pudo leer la estructura de registros.');
      if (aliveRef.current) setSchema(data);
    } catch (error) { if (aliveRef.current) setConnectionMessage(errorMessage(error)); }
    finally { if (aliveRef.current) setSetupLoading(false); }
  }, [session]);

  useEffect(() => { loadSchema(); }, [loadSchema]);

  function resetValidation() {
    requestRef.current++;
    workerRef.current?.terminate(); workerRef.current = null;
    setResult(null); setOutcome(null); setProgress(0); setPhase('idle'); setMessage('');
  }

  function cancelFile() {
    if (busy || busyRef.current) return;
    resetValidation(); setFile(null);
    dragDepthRef.current = 0; setDragging(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  function chooseFile(selected) {
    if (busyRef.current || busy) return;
    resetValidation(); setFile(null);
    if (!selected) return;
    if (!/\.csv$/i.test(selected.name)) { setMessage('Selecciona un archivo con extensión .csv.'); return; }
    if (!selected.size || selected.size > MAX_BYTES) { setMessage('El archivo debe tener contenido y pesar como máximo 20 MB.'); return; }
    setFile(selected);
  }

  function dragEnter(event) {
    if (!Array.from(event.dataTransfer.types).includes('Files')) return;
    event.preventDefault(); event.stopPropagation();
    if (busy || busyRef.current) return;
    dragDepthRef.current++;
    setDragging(true);
  }

  function dragOver(event) {
    if (!Array.from(event.dataTransfer.types).includes('Files')) return;
    event.preventDefault(); event.stopPropagation();
    event.dataTransfer.dropEffect = busy || busyRef.current ? 'none' : 'copy';
  }

  function dragLeave(event) {
    event.preventDefault(); event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (!dragDepthRef.current) setDragging(false);
  }

  function dropFile(event) {
    event.preventDefault(); event.stopPropagation();
    dragDepthRef.current = 0; setDragging(false);
    if (busy || busyRef.current) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length !== 1) {
      setMessage('Arrastra un solo archivo CSV a la vez.');
      return;
    }
    if (inputRef.current) inputRef.current.value = '';
    chooseFile(files[0]);
  }

  async function validate() {
    if (!file || !schema || busyRef.current) return;
    resetValidation(); setPhase('validating');
    const token = requestRef.current;
    try {
      const buffer = await file.arrayBuffer();
      if (!aliveRef.current || token !== requestRef.current) return;
      const worker = new Worker(new URL('./csv-granja.worker.js', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      worker.onmessage = ({ data }) => {
        if (!aliveRef.current || token !== requestRef.current) return;
        worker.terminate(); workerRef.current = null;
        if (data.error) { setMessage(data.error); setPhase('error'); return; }
        setResult(data.result); setPhase(data.result.errorCount ? 'invalid' : 'ready');
      };
      worker.onerror = () => {
        if (aliveRef.current && token === requestRef.current) { setMessage('No se pudo validar el archivo. Vuelve a intentarlo.'); setPhase('error'); }
        worker.terminate(); workerRef.current = null;
      };
      worker.postMessage({ buffer, schema }, [buffer]);
    } catch (error) {
      if (aliveRef.current && token === requestRef.current) { setMessage(errorMessage(error)); setPhase('error'); }
    }
  }

  async function importFile() {
    if (!result || result.errorCount || !schema?.canInsert || busy || busyRef.current || phase === 'complete') return;
    busyRef.current = true; pauseRef.current = false;
    setPhase('uploading'); setMessage(''); setOutcome(null);
    try {
      const { data: upload, error: startError } = await supabase.rpc('granja_csv_iniciar', {
        p_huella: result.fingerprint, p_archivo: file.name, p_total: result.rows.length,
        p_columnas: result.columns, p_firma: schema.signature,
      });
      if (startError) throw startError;
      if (upload.estado === 'completada') {
        if (aliveRef.current) { setOutcome({ count: upload.importadas, repeated: true }); setProgress(result.rows.length); setPhase('complete'); }
        return;
      }
      const staged = new Set(upload.bloques);
      let sent = [...staged].reduce((sum, index) => sum + Math.min(BATCH_SIZE, result.rows.length - index * BATCH_SIZE), 0);
      if (aliveRef.current) setProgress(sent);
      for (let offset = 0; offset < result.rows.length; offset += BATCH_SIZE) {
        if (pauseRef.current || !aliveRef.current) {
          if (aliveRef.current) { setPhase('paused'); setMessage('Carga pausada. Puedes reanudarla con este mismo archivo.'); }
          return;
        }
        const index = offset / BATCH_SIZE;
        if (staged.has(index)) continue;
        const { error } = await supabase.rpc('granja_csv_guardar_bloque', {
          p_carga: upload.id, p_indice: index, p_filas: result.rows.slice(offset, offset + BATCH_SIZE),
        });
        if (error) {
          const match = /Registro (\d+)/i.exec(error.message || '');
          if (match) error.message += ` (Línea ${result.sourceLines[Number(match[1]) - 1]} del CSV).`;
          throw error;
        }
        sent += Math.min(BATCH_SIZE, result.rows.length - offset);
        if (aliveRef.current) setProgress(sent);
      }
      if (pauseRef.current || !aliveRef.current) { if (aliveRef.current) setPhase('paused'); return; }
      setPhase('finalizing');
      const { data, error } = await supabase.rpc('granja_csv_finalizar', { p_carga: upload.id });
      if (error) throw error;
      if (aliveRef.current) { setOutcome({ count: data.importadas, repeated: data.yaCompletada }); setPhase('complete'); }
      if (!data.yaCompletada && aliveRef.current) onImported?.();
    } catch (error) {
      if (aliveRef.current) { setMessage(`${errorMessage(error)} Puedes reintentar con el mismo archivo; se comprobará lo ya recibido.`); setPhase('error'); }
    } finally {
      busyRef.current = false;
    }
  }


  return (
    <section aria-labelledby="csv-granja-section-title">
    <h2 id="csv-granja-section-title" className="csv-granja-section-title">Registro granja Aves Reproductoras</h2>
    <div className="csv-granja-layout">
    <section className="panel csv-granja" aria-labelledby="csv-granja-title">
      <div className="csv-granja-heading">
        <div><h3 id="csv-granja-title"><FileSpreadsheet size={18} /> Carga de CSV Granja</h3><p>Carga tu reporte con sus encabezados originales, sin renombrar las columnas.</p></div>
      </div>
      {setupLoading && <p role="status">Consultando configuración de carga… Puedes seleccionar tu archivo mientras tanto.</p>}
      {!setupLoading && !schema && (
        <div className="csv-granja-notice" role="alert"><p>{connectionMessage}</p><p>Puedes seleccionar tu CSV. La validación estará disponible cuando se restablezca la conexión.</p><button type="button" className="secondary-button" onClick={loadSchema}><RefreshCw size={15} /> Reintentar conexión</button></div>
      )}
        {schema && !schema.canInsert && <p className="csv-granja-notice" role="alert">Puedes validar archivos, pero tu cuenta no tiene permiso para importarlos.</p>}
        <div
          className={`csv-granja-file${dragging ? ' csv-granja-file-dragging' : ''}${busy ? ' csv-granja-file-busy' : ''}`}
          role="group"
          aria-label="Seleccionar o arrastrar un archivo CSV"
          aria-disabled={busy}
          onDragEnter={dragEnter}
          onDragOver={dragOver}
          onDragLeave={dragLeave}
          onDrop={dropFile}
        >
          <Upload size={22} aria-hidden="true" />
          <div className="csv-granja-file-choice">
            <strong>{dragging ? 'Suelta aquí tu archivo CSV' : 'Arrastra tu archivo CSV aquí'}</strong>
            <span role="status">{file ? `${file.name} · ${(file.size / 1024).toFixed(1)} KB` : 'Un CSV a la vez · Máximo 20 MB · Hasta 100 000 registros'}</span>
          </div>
          <button type="button" className="secondary-button" disabled={busy} onClick={() => inputRef.current?.click()}>Seleccionar CSV</button>
          <input ref={inputRef} type="file" aria-label="Archivo CSV" accept=".csv,text/csv" hidden disabled={busy} onClick={(e) => { e.currentTarget.value = ''; }} onChange={(e) => chooseFile(e.target.files?.[0])} />
        </div>
        <div className="csv-granja-actions">
          {validationFinished ? <>
            <button type="button" className="primary-button csv-granja-import-button" disabled={!result || result.errorCount > 0 || busy || !schema?.canInsert || phase === 'complete'} onClick={importFile}><Upload size={16} /> {phase === 'complete' ? 'Importación completada' : importing ? 'Importando…' : phase === 'paused' || (phase === 'error' && result) ? 'Reanudar / reintentar carga' : 'Confirmar e importar'}</button>
            <button type="button" className="secondary-button" disabled={busy} onClick={cancelFile}>Cancelar</button>
          </> : <button type="button" className={`primary-button${file ? ' csv-granja-validate-ready' : ''}`} disabled={!file || !schema || setupLoading || busy} onClick={validate}>{phase === 'validating' ? 'Validando archivo…' : 'Validar archivo'}</button>}
        </div>
        {message && <p className="csv-granja-notice" role="alert">{message}</p>}
        {result && <>
          {(importing || phase === 'paused') && <div className="csv-granja-progress" role="status" aria-live="polite"><progress max={result.rows.length} value={phase === 'finalizing' ? result.rows.length : progress} /><p>{phase === 'finalizing' ? 'Guardando todos los registros y comprobando las reglas de la base…' : `${count(progress)} de ${count(result.rows.length)} registros preparados. Se guardarán juntos al finalizar.`}</p>{phase === 'uploading' && <button type="button" className="secondary-button" onClick={() => { pauseRef.current = true; }}>Pausar después del bloque actual</button>}</div>}
        </>}
        {outcome && <div className="csv-granja-success" role="status"><CheckCircle2 size={23} /><div><strong>{outcome.repeated ? 'Esta carga ya estaba completada' : 'Importación completada'}</strong><p>{count(outcome.count)} registros {outcome.repeated ? 'ya registrados. No se volvieron a insertar.' : 'guardados correctamente.'}</p></div></div>}
    </section>
    <section className="panel csv-granja csv-granja-report" aria-labelledby="csv-granja-report-title">
          <h3 id="csv-granja-report-title"><FileSpreadsheet size={18} /> Reporte de validación</h3>
          <div className="csv-granja-summary">
            <div><span>Registros</span><strong>{result ? count(result.total) : '—'}</strong></div>
            <div><span>Con errores</span><strong>{result ? count(result.invalidRows) : '—'}</strong></div>
            <div><span>Observaciones</span><strong>{result ? count(result.warningCount) : '—'}</strong></div>
            <div><span>Período</span><strong className="csv-granja-period">{result?.from || '—'}<br />{result?.to || '—'}</strong></div>
          </div>
          <div className="csv-granja-validation">
            {result ? <>
            <div className="csv-granja-heading"><h4>{result.errorCount || result.warningCount ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />} {result.errorCount ? `${count(result.errorCount)} errores por corregir` : result.warningCount ? 'Revisa estas observaciones' : 'Sin errores ni observaciones'}</h4></div>
            {(result.errorCount > 0 || result.warningCount > 0) && <>
              <p>Se muestran hasta 20 detalles.</p>
              <div className="csv-granja-scroll"><table><thead><tr><th>Línea CSV</th><th>Columna</th><th>Detalle</th></tr></thead><tbody>{[...result.errors, ...result.warnings].slice(0, 20).map((error, i) => <tr key={i}><td>{error.line}</td><td>{error.column}</td><td>{error.message}</td></tr>)}</tbody></table></div>
            </>}
            </> : <p role="status">{phase === 'validating' ? 'Validando archivo…' : 'Pendiente de validación'}</p>}
          </div>
    </section>
    </div>
    </section>
  );
}
