import React, { useMemo } from "react";
import useConsumo from "../use-consumo";
import useHistorialLote from "./use-historial-lote";
import LoadingCircle from "./00.LoadingCircle";
import LineasConsumoSemanal from "./LineasConsumoSemanal";
import { buildWeeklyConsumptionChart } from "./consumo-semanal";

export default function GraficaConsumoPorSexo({ linea = "", lote = "", sexo = "hembra" }) {
  const consumption = useConsumo({ linea, lote, historial: true });
  const history = useHistorialLote({ linea, lote });
  const { rows } = consumption;
  const loading = consumption.loading || history.loading;
  const error = consumption.error || history.error;
  const retry = () => {
    if (consumption.error) consumption.retry();
    if (history.error) history.retry();
  };

  const { data, series } = useMemo(() => buildWeeklyConsumptionChart(rows, history.rows, sexo), [rows, history.rows, sexo]);

  const label = sexo === "hembra" ? "Hembras" : "Machos";
  return <div className="panel lote-chart">
    <strong className="stage-pie-title">Consumo de alimento de {label.toLowerCase()} por semana</strong>
    {loading ? <LoadingCircle text="Cargando consumo de alimento..." />
      : error ? <div role="alert"><p>{error}</p><button type="button" onClick={retry}>Reintentar</button></div>
        : !data.length ? <p className="muted">No hay datos de consumo para el lote seleccionado.</p>
          : <LineasConsumoSemanal data={data} series={series} />}
  </div>;
}
