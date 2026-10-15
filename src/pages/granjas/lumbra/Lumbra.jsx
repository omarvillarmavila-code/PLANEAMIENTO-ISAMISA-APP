import React, { useCallback, useRef, useState } from "react";
import ResumenLotesCodStd from "../ResumenLotesCodStd";
import LumbraFiltroSemanaGranja from "./components/01.Datos_generales/01.Filtro_Semana_Granja";
import LumbraTarjetaPoblacionPorEtapa from "./components/01.Datos_generales/02.Tarjeta_poblacion_por_etapa";
import LumbraAvesPorLoteChart from "./components/01.Datos_generales/03.Tarjeta_aves_por_lote";
import LumbraPosturaPorLoteChart from "./components/01.Datos_generales/04.Tarjeta_postura_por_lote";
import LumbraMortalidadPorLoteChart from "./components/01.Datos_generales/05.Tarjeta_mortalidad_por_lote";
import LumbraConsumoPorLoteChart from "./components/01.Datos_generales/06.Tarjeta_consumo_por_lote";
import LumbraLoteSelector from "./components/02.Saldo_por_lote/01.Selector_de_lote";
import LumbraLoteDetailPanel from "./components/02.Saldo_por_lote/02.Detalle_de_saldos_por_lote";
import FiltroLineaYLote from "./components/03.Detalles por lote/01.Filtro_linea_y_lote";
import GraficaPosturaHuevoIncubable from "./components/03.Detalles por lote/02.Grafica_postura_huevo_incubable";
import GraficaPosturaHuevoComercial from "./components/03.Detalles por lote/03.Grafica_postura_huevo_comercial";
import GraficaMortalidadPorSexo from "./components/03.Detalles por lote/04.Grafica_mortalidad_por_sexo";
import GraficaConsumoPorSexo from "./components/03.Detalles por lote/05.Grafica_consumo_por_sexo";

// Etapas productivas, vistas y colores de cada tarjeta.
const stages = [
  ["Levante", ["#f97316", "#fb923c", "#fdba74", "#ea580c", "#c2410c"]],
  ["Postura", ["#0ea5e9", "#38bdf8", "#7dd3fc", "#0284c7", "#0369a1"]],
  ["Muda", ["#7f1d1d", "#991b1b", "#b91b1b", "#be123c", "#881337"]],
];
// Formato de fechas del periodo seleccionado.
const formatDate = (value) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "-";

export default function Lumbra() {
  const tabsRef = useRef(null);
  const detalleTabRef = useRef(null);
  const [dataRevision, setDataRevision] = useState(0);
  // Estados de pestaña y filtros.
  const [tab, setTab] = useState("linea"),
    [visitedTabs, setVisitedTabs] = useState({ linea: true }),
    [year, setYear] = useState("2026"),
    [week, setWeek] = useState("actual"),
    [saldoFilter, setSaldoFilter] = useState({ linea: "", lote: "" }),
    [posturaFilter, setPosturaFilter] = useState({ linea: "", lote: "" });

  const selectTab = (nextTab) => {
    setVisitedTabs((visited) => visited[nextTab] ? visited : { ...visited, [nextTab]: true });
    setTab(nextTab);
  };
  const openLoteDetail = ({ linea, lote }) => {
    if (!lote) return;
    setPosturaFilter({ linea, lote });
    selectTab("postura");
    detalleTabRef.current?.focus({ preventScroll: true });
    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const changePeriod = useCallback(({ year: selectedYear, week: selectedWeek }) => {
    setYear(selectedYear);
    setWeek(selectedWeek);
  }, []);

  return (
    <section className="page">
      {/* Sección: encabezado de la granja. */}
      <div className="page-heading">
        <h2>Granja Lumbra</h2>
      </div>
      {/* Sección: pestañas principales. */}
      <nav className="lumbra-tabs" ref={tabsRef}>
        <button
          className={tab === "linea" ? "active" : ""}
          onClick={() => selectTab("linea")}
        >
          Datos generales
        </button>
        <button
          className={tab === "lote" ? "active" : ""}
          onClick={() => selectTab("lote")}
        >
          Saldos por lote
        </button>
        <button
          ref={detalleTabRef}
          className={tab === "postura" ? "active" : ""}
          onClick={() => selectTab("postura")}
        >
          Detalle por lote
        </button>
        <button
          className={tab === "consumo" ? "active" : ""}
          onClick={() => selectTab("consumo")}
        >
          Consumo de alimento
        </button>
        <button className={tab === "resumen" ? "active" : ""} onClick={() => selectTab("resumen")}>
          Resumen de lotes
        </button>
      </nav>
      {visitedTabs.resumen && <div style={{ display: tab === "resumen" ? "contents" : "none" }}>
        <ResumenLotesCodStd onChange={() => setDataRevision(value => value + 1)} />
      </div>}
      {/* Pestaña: Datos generales. */}
      {/* Cada panel se monta en su primera visita y conserva su estado al ocultarse. */}
      {visitedTabs.linea && (
        <div key={`linea-${dataRevision}`} style={{ display: tab === "linea" ? "contents" : "none" }}>
          {/* Sección: tarjeta de filtros de año, semana y fechas. */}
          <LumbraFiltroSemanaGranja
            year={year}
            week={week}
            onChange={changePeriod}
          />
          {/* Sección: una tarjeta única para cada etapa usando la vista consolidada. */}
          <div className="stage-columns">
            {stages.map(([etapa, colores]) => (
              <LumbraTarjetaPoblacionPorEtapa
                key={etapa}
                etapa={etapa}
                colores={colores}
                year={year}
                week={week}
              />
            ))}
          </div>
          {/* Tarjeta: aves por lote. */}
          <LumbraAvesPorLoteChart year={year} week={week} onSelectLote={openLoteDetail} />
          {/* Tarjeta: postura por lote. */}
          <LumbraPosturaPorLoteChart year={year} week={week} onSelectLote={openLoteDetail} />
          {/* Tarjeta: mortalidad semanal por lote. */}
          <LumbraMortalidadPorLoteChart year={year} week={week} onSelectLote={openLoteDetail} />
          {/* Tarjeta: consumo semanal por lote. */}
          <LumbraConsumoPorLoteChart year={year} week={week} unit="g_ave_dia" onSelectLote={openLoteDetail} />
        </div>
      )}
      {/* Pestaña: Saldos por lote. */}
      {visitedTabs.lote && (
        <div key={`lote-${dataRevision}`} style={{ display: tab === "lote" ? "contents" : "none" }}>
          <LumbraLoteSelector value={saldoFilter} onChange={setSaldoFilter} />
          <div className="lote-sexos lote-saldos-lumbra">
            <LumbraLoteDetailPanel sexo="HEMBRA" lote={saldoFilter.lote} />
            <LumbraLoteDetailPanel sexo="MACHO" lote={saldoFilter.lote} />
          </div>
        </div>
      )}
      {visitedTabs.consumo && (
        <div key={`consumo-${dataRevision}`} style={{ display: tab === "consumo" ? "contents" : "none" }}>
          <LumbraFiltroSemanaGranja
            year={year}
            week={week}
            onChange={changePeriod}
          />
          <LumbraConsumoPorLoteChart year={year} week={week} onSelectLote={openLoteDetail} />
        </div>
      )}
      {/* Pestaña: Detalle por lote. */}
      {visitedTabs.postura && (
        <div key={`postura-${dataRevision}`} style={{ display: tab === "postura" ? "contents" : "none" }}>
          <FiltroLineaYLote value={posturaFilter} onChange={setPosturaFilter} />
          <div className="lote-chart-stack" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "16px" }}>
            {posturaFilter.lote ? <>
            <GraficaPosturaHuevoIncubable {...posturaFilter} />
            <GraficaPosturaHuevoComercial {...posturaFilter} />
            <GraficaMortalidadPorSexo sexo="hembra" {...posturaFilter} />
            <GraficaMortalidadPorSexo sexo="macho" {...posturaFilter} />
            <GraficaConsumoPorSexo sexo="hembra" {...posturaFilter} />
            <GraficaConsumoPorSexo sexo="macho" {...posturaFilter} />
            </> : <p className="muted">Selecciona un lote para ver su historial de vida.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
