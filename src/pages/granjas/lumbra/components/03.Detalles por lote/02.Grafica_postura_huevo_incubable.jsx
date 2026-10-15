import React, { useMemo } from "react";
import useHistorialLote from "./use-historial-lote";
import LoadingCircle from "./00.LoadingCircle";
import LineaTemporal from "./LineaTemporal";
import { agruparPeriodos } from "./periodos-detalle";
import { esPosturaPollo } from '../etapas';

export default function GraficaPosturaHuevoIncubable({ linea = "", lote = "" }) {
  const { rows, loading, error, retry } = useHistorialLote({ linea, lote });

  const data = useMemo(() => {
    return agruparPeriodos(rows.filter((row) => esPosturaPollo(row.etapa))).map(({ rows: entries, ...period }) => {
      const saldo = entries.reduce((sum, row) => sum + Number(row.saldo_final_hembra || 0), 0);
      const huevos = entries.reduce((sum, row) => sum + Number(row.prod_hinc || 0), 0);
      const standards = entries.filter((row) => row.prod_hinc_std != null).map((row) => Number(row.prod_hinc_std));
      return {
        ...period,
        porcentaje: saldo ? huevos * 100 / saldo : null,
        estandar: standards.length ? standards.reduce((sum, value) => sum + value, 0) / standards.length : null,
      };
    });
  }, [rows]);

  return <div className="panel lote-chart">
    <strong className="stage-pie-title">% postura de huevo incubable por semana</strong>
    {loading ? <LoadingCircle text="Cargando postura incubable..." /> : error ? <div role="alert"><p>{error}</p><button type="button" onClick={retry}>Reintentar</button></div> : <LineaTemporal data={data} connectNulls showMissingAgeWarning={false} emptyMessage="No hay registros de postura con edad de vida para este lote." series={[
      { key: "porcentaje", name: "%Hinc", color: "#16a34a" },
      { key: "estandar", name: "Est\u00e1ndar", color: "#6b7280" },
    ]} />}
  </div>;
}
