import React, { useEffect, useRef, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { usePermissions } from '../../context/PermissionsContext';
import { supabase } from '../../lib/supabase';
import { GROUPS, FIELDS, TABLE_FIELDS, dateDetails, PAGE_SIZE, fieldType, formValues, validateForm, displayValue, crudError, fetchPage, fetchOptions, saveRecord, deleteRecord } from './resumen-lotes-cod-std';
import './ResumenLotesCodStd.css';

export default function ResumenLotesCodStd({ onChange }) {
  const { can } = usePermissions();
  const canEdit = can('lumbra', 'edit');
  const [filters, setFilters] = useState({ linea: '', codigo: '', search: '' });
  const [sort, setSort] = useState({ column: 'LOTE', ascending: true });
  const [page, setPage] = useState(0), [revision, setRevision] = useState(0);
  const [result, setResult] = useState({ rows: [], count: 0 });
  const [options, setOptions] = useState({ lineas: [], codigos: [] });
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [optionError, setOptionError] = useState('');
  const [editor, setEditor] = useState(null), [values, setValues] = useState(formValues);
  const [errors, setErrors] = useState({}), [mutationError, setMutationError] = useState('');
  const [removing, setRemoving] = useState(null), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false), editorRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    fetchPage(supabase, filters, page, controller.signal, sort).then(data => {
      if (controller.signal.aborted) return;
      const lastPage = Math.max(0, Math.ceil(data.count / PAGE_SIZE) - 1);
      if (page > lastPage) { setPage(lastPage); return; }
      setResult(data);
    }).catch(err => { if (!controller.signal.aborted) setError(crudError(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filters, page, revision, sort]);

  useEffect(() => {
    const controller = new AbortController();
    setOptionError('');
    fetchOptions(supabase, controller.signal).then(data => {
      if (!controller.signal.aborted) setOptions(data);
    }).catch(err => { if (!controller.signal.aborted) setOptionError(crudError(err)); });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => { if (editor) editorRef.current?.focus(); }, [editor]);

  function openEditor(row) {
    if (!canEdit) return;
    setEditor({ original: row }); setValues(formValues(row || {}));
    setErrors({}); setMutationError(''); setRemoving(null); setMessage('');
  }
  function changed(text) {
    setMessage(text); setRevision(value => value + 1);
  }
  async function submit(event) {
    if (!canEdit) { event.preventDefault(); return; }
    event.preventDefault();
    if (lock.current) return;
    const validated = validateForm(values);
    setErrors(validated.errors);
    if (Object.keys(validated.errors).length) return;
    lock.current = true; setBusy(true); setMutationError('');
    let success = false;
    try {
      await saveRecord(supabase, editor.original, validated.payload);
      setEditor(null); changed('Registro guardado.'); success = true;
    } catch (err) { setMutationError(crudError(err)); }
    finally { lock.current = false; setBusy(false); }
    if (success) onChange?.();
  }
  async function remove() {
    if (!canEdit) return;
    if (lock.current) return;
    lock.current = true; setBusy(true); setMutationError('');
    let success = false;
    try {
      await deleteRecord(supabase, removing);
      setRemoving(null); changed('Registro eliminado.'); success = true;
    } catch (err) { setMutationError(crudError(err)); }
    finally { lock.current = false; setBusy(false); }
    if (success) onChange?.();
  }
  function filter(name, value) { setFilters(previous => ({ ...previous, [name]: value })); setPage(0); }

  return <section className="panel resumen-lotes">
    <div className="resumen-lotes-toolbar">
      <h3>Resumen Lotes Cod STD</h3>
      <button className="primary-button" disabled={!canEdit || busy || !!editor} onClick={() => openEditor(null)}>Nuevo registro</button>
    </div>
    <div className="resumen-lotes-toolbar">
      <label>Línea<select value={filters.linea} onChange={event => filter('linea', event.target.value)}>
        <option value="">Todas las líneas</option>
        {[...new Set([...options.lineas, filters.linea].filter(Boolean))].map(value => <option key={value} value={value}>{value}</option>)}
      </select></label>
      <label>COD STD<select value={filters.codigo} onChange={event => filter('codigo', event.target.value)}>
        <option value="">Todos los códigos</option>
        {[...new Set([...options.codigos, filters.codigo].filter(Boolean))].map(value => <option key={value} value={value}>{value}</option>)}
      </select></label>
      <label>Buscar<input type="search" placeholder="Lote, línea o COD STD" value={filters.search} onChange={event => filter('search', event.target.value)} /></label>
      <button className="secondary-button" disabled={loading || busy} onClick={() => setRevision(value => value + 1)}>Actualizar</button>
    </div>
    {message && <p role="status">{message}</p>}
    {optionError && <p role="alert">No se pudieron cargar los filtros: {optionError}</p>}
    {editor && <form onSubmit={submit} className="resumen-lotes-editor">
      <h4 ref={editorRef} tabIndex={-1}>{editor.original ? `Editar lote ${editor.original.LOTE}` : 'Nuevo registro'}</h4>
      {GROUPS.map(([title, names]) => <fieldset key={title} disabled={busy}>
        <legend>{title}</legend><div className="resumen-lotes-fields">
          {names.map(name => <label key={name}>{name}{name === 'LOTE' ? ' *' : ''}
            {name === 'OBS' ? <textarea value={values[name]} onChange={event => setValues(current => ({ ...current, [name]: event.target.value }))} /> :
              <input type={fieldType(name) === 'date' ? 'date' : 'text'} required={name === 'LOTE'}
                inputMode={fieldType(name) === 'integer' ? 'numeric' : fieldType(name) === 'decimal' ? 'decimal' : undefined}
                value={values[name]} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `resumen-error-${FIELDS.indexOf(name)}` : undefined}
                onChange={event => setValues(current => ({ ...current, [name]: event.target.value }))} />}
            {errors[name] && <span className="resumen-lotes-error" id={`resumen-error-${FIELDS.indexOf(name)}`}>{errors[name]}</span>}
          </label>)}
        </div>
      </fieldset>)}
      {mutationError && <p role="alert">{mutationError}</p>}
      <div className="resumen-lotes-toolbar">
        <button type="submit" className="primary-button" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        <button type="button" className="secondary-button" disabled={busy} onClick={() => setEditor(null)}>Cancelar</button>
      </div>
    </form>}
    {removing && <div className="resumen-lotes-confirm" role="alert">
      <p>¿Eliminar el registro del lote <strong>{removing.LOTE}</strong> (Línea: {removing.LINEA || '—'}, COD STD: {removing['COD STD'] || '—'})?</p>
      {mutationError && <p>{mutationError}</p>}
      <div className="resumen-lotes-toolbar">
        <button disabled={busy} className="secondary-button" onClick={remove}>{busy ? 'Eliminando…' : 'Confirmar eliminación'}</button>
        <button disabled={busy} className="secondary-button" onClick={() => setRemoving(null)}>Cancelar</button>
      </div>
    </div>}
    {loading ? <p role="status">Cargando registros…</p> : error ? <p role="alert">{error}</p> : <>
      <p className="muted">{result.count} registros</p>
      <div className="resumen-lotes-scroll" tabIndex={0} role="region" aria-label="Registros de resumen de lotes">
        <table><thead><tr>{TABLE_FIELDS.map(name => <th scope="col" key={name} aria-sort={sort.column === name ? (sort.ascending ? 'ascending' : 'descending') : 'none'}>
          <button type="button" className="resumen-lotes-sort" title={`Ordenar por ${name}`} onClick={() => {
            setSort(current => ({ column: name, ascending: current.column === name ? !current.ascending : true }));
            setPage(0);
          }}>{name}<span aria-hidden="true">{sort.column === name ? (sort.ascending ? ' ↑' : ' ↓') : ' ↕'}</span></button>
        </th>)}<th scope="col">Acciones</th></tr></thead>
          <tbody>{result.rows.map(row => <tr key={row.crud_id}>
            {TABLE_FIELDS.map(name => <td key={name} title={dateDetails(name, row)}>{displayValue(name, row[name])}</td>)}
            <td><div className="resumen-lotes-actions">
              <button className="secondary-button resumen-lotes-icon-button resumen-lotes-edit" disabled={!canEdit || busy || !!editor || !row.crud_id} onClick={() => openEditor(row)} aria-label={`Editar lote ${row.LOTE}`} title="Editar"><Pencil size={18} aria-hidden="true" /></button>
              <button className="secondary-button resumen-lotes-icon-button resumen-lotes-delete" disabled={!canEdit || busy || !!editor || !row.crud_id} onClick={() => { setRemoving(row); setMutationError(''); setMessage(''); }} aria-label={`Eliminar lote ${row.LOTE}`} title="Eliminar"><Trash2 size={18} aria-hidden="true" /></button>
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>
      {!result.rows.length && <p>No hay registros para los filtros seleccionados.</p>}
      <div className="resumen-lotes-toolbar resumen-lotes-pagination">
        <button className="secondary-button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Anterior</button>
        <span>Página {page + 1} de {Math.max(1, Math.ceil(result.count / PAGE_SIZE))}</span>
        <button className="secondary-button" disabled={(page + 1) * PAGE_SIZE >= result.count} onClick={() => setPage(value => value + 1)}>Siguiente</button>
      </div>
    </>}
  </section>;
}
