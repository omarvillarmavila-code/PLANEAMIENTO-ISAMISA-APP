import React, { useMemo } from "react";
import useHistorialLote from "./use-historial-lote";
import LoadingCircle from "./00.LoadingCircle";
import LineaTemporal from "./LineaTemporal";
import { agruparPeriodos } from "./periodos-detalle";
import { esPosturaPollo } from '../etapas';

export default function GraficaPosturaHuevoComercial({ linea = "", lote = "" }) {
  const { rows, loading, error, retry } = useHistorialLote({ linea, lote });

  const data = useMemo(() => {
    return agruparPeriodos(rows.filter((row) => esPosturaPollo(row.etapa))).map(({ rows: entries, ...period }) => {
      const saldo = entries.reduce((sum, row) => sum + Number(row.saldo_final_hembra || 0), 0);
      const huevos = entries.reduce((sum, row) => sum + Number(row.prod_hcom || 0), 0);
      const standards = entries.filter((row) => row.prod_hcom_std != null).map((row) => Number(row.prod_hcom_std));
      return {
        ...period,
        porcentaje: saldo ? huevos * 100 / saldo : null,
        estandar: standards.length ? standards.reduce((sum, value) => sum + value, 0) / standards.length : null,
      };
    });
  }, [rows]);

  return <div className="panel lote-chart">
    <strong className="stage-pie-title">% postura de huevo comercial por semana</strong>
    {loading ? <LoadingCircle text="Cargando postura comercial..." /> : error ? <div role="alert"><p>{error}</p><button type="button" onClick={retry}>Reintentar</button></div> : <LineaTemporal data={data} connectNulls showMissingAgeWarning={false} emptyMessage="No hay registros de postura con edad de vida para este lote." series={[
      { key: "porcentaje", name: "%HCom", color: "#f97316" },
      { key: "estandar", name: "Est\u00e1ndar", color: "#6b7280" },
    ]} />}
  </div>;
}
