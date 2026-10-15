import React, { useMemo } from "react";
import useHistorialLote from "./use-historial-lote";
import LoadingCircle from "./00.LoadingCircle";
import LineaTemporal from "./LineaTemporal";
import { serieMortalidadAcumulada } from "./mortalidad-acumulada";

export default function GraficaMortalidadPorSexo({ linea = "", lote = "", sexo = "hembra" }) {
  const { rows, loading, error, retry } = useHistorialLote({ linea, lote });

  const data = useMemo(() => serieMortalidadAcumulada(rows, sexo), [rows, sexo]);
  const missingColumns = rows.length > 0 && rows.some((row) =>
    !Object.hasOwn(row, `porcentaje_mortalidad_acum_${sexo}`)
    || !Object.hasOwn(row, `porcentaje_mortalidad_std_acum_${sexo}`));
  const missingReal = !missingColumns && data.length > 0 && data.every((row) => row.porcentaje == null);
  const missingStandard = !missingColumns && data.length > 0 && data.every((row) => row.estandar == null);

  const label = sexo === "hembra" ? "Hembras" : "Machos";
  const color = sexo === "hembra" ? "#dc2626" : "#2563eb";
  return <div className="panel lote-chart">
    <strong className="stage-pie-title">% mortalidad acumulada de {label.toLowerCase()}</strong>
    {loading ? <LoadingCircle text="Cargando mortalidad acumulada..." />
      : error ? <div role="alert"><p>{error}</p><button type="button" onClick={retry}>Reintentar</button></div>
      : missingColumns ? <p role="status" className="muted">La mortalidad acumulada aún no está disponible.</p>
      : <>
        {missingReal && <p className="muted">Faltan datos de mortalidad acumulada o de población en la edad 1 para calcular el porcentaje real.</p>}
        {missingStandard && <p className="muted">No hay estándar de mortalidad acumulada disponible para este lote.</p>}
        <LineaTemporal data={data} stageBackground series={[
          { key: "porcentaje", name: "Real acumulada", color },
          { key: "estandar", name: "Estándar acumulada", color: "#6b7280" },
        ]} />
      </>}
  </div>;
}
