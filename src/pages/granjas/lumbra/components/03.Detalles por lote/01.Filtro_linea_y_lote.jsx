import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../../lib/supabase";
import LoadingCircle from "./00.LoadingCircle";
import { allPages, queryMessage, sharedQuery } from '../consulta-granja';

const ORDER = ["CRIOLLO", "ISAMISA", "FRANCES", "BARRADO", "DEKALB"];

export default function FiltroLineaYLote({
  value = { linea: "", lote: "" },
  onChange,
  idPrefix = "postura",
  farm = 'lumbra',
}) {
  const [rows, setRows] = useState([]);
  const { linea, lote } = value;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    sharedQuery(`catalogo-historial-${farm}`, (signal) => {
      if (!supabase) throw new Error('Supabase no está configurado');
      return allPages(() => supabase.schema(farm).from(`resumen_especie_linea_lote_${farm}`)
        .select('linea,cod_lote').order('linea').order('cod_lote'), signal);
    }).then((data) => {
        if (!active) return;
        setRows(data.map((row) => ({ linea: row.linea, lote: row.cod_lote })));
      }).catch((error) => { if (active) setError(queryMessage(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt, farm]);

  const lineas = useMemo(() => {
    const values = [
      ...new Set(
        rows.map((row) => String(row.linea || "").trim()).filter(Boolean),
      ),
    ];
    return values.sort((a, b) => {
      const aIndex = ORDER.indexOf(a.toUpperCase());
      const bIndex = ORDER.indexOf(b.toUpperCase());
      return (
        (aIndex < 0 ? 99 : aIndex) - (bIndex < 0 ? 99 : bIndex) ||
        a.localeCompare(b)
      );
    });
  }, [rows]);

  const lotes = useMemo(
    () =>
      [
        ...new Set(
          rows
            .filter((row) => !linea || String(row.linea).trim() === linea)
            .map((row) => String(row.lote || "").trim())
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [rows, linea],
  );

  if (loading)
    return (
      <div className="lote-selector panel">
        <LoadingCircle text="Cargando líneas y lotes..." />
      </div>
    );

  const changeLinea = (event) => {
    const value = event.target.value;
    onChange?.({ linea: value, lote: "" });
  };

  const changeLote = (event) => {
    const value = event.target.value;
    onChange?.({ linea, lote: value });
  };

  return (
    <div className="lote-selector panel">
      {error && <div role="alert"><span>{error}</span> <button type="button" onClick={() => setAttempt((value) => value + 1)}>Reintentar</button></div>}
      <label htmlFor={`${idPrefix}-linea`}>
        Línea
        <select id={`${idPrefix}-linea`} value={linea} onChange={changeLinea}>
          <option value="">Todas</option>
          {linea && !lineas.includes(linea) && <option value={linea}>{linea}</option>}
          {lineas.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor={`${idPrefix}-lote`}>
        Lote
        <select id={`${idPrefix}-lote`} value={lote} onChange={changeLote}>
          <option value="">Seleccione un lote</option>
          {lote && !lotes.includes(lote) && <option value={lote}>{lote}</option>}
          {lotes.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
