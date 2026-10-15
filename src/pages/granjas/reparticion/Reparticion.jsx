import React, { useCallback, useState } from "react";
import ReparticionPopulationChart from "./components/ReparticionPopulationChart";
import ReparticionStagePopulationTable from "./components/ReparticionStagePopulationTable";
import AvesPorLoteChart from "./components/AvesPorLoteChartReparticionV2";
import FiltroLineaYLote from '../lumbra/components/03.Detalles por lote/01.Filtro_linea_y_lote';
import LoteContenido from './components/LoteContenido';

import FiltroSemana from '../lumbra/components/01.Datos_generales/01.Filtro_Semana_Granja';
import DatosGeneralesProduccion from './components/DatosGeneralesProduccion';

export default function Reparticion() {
  const [tab, setTab] = useState("linea");
  const [tabla, setTabla] = useState({});
  const [saldoFilter, setSaldoFilter] = useState({ linea: '', lote: '' });
  const [detalleFilter, setDetalleFilter] = useState({ linea: '', lote: '' });
  const [period, setPeriod] = useState({ year: '2026', week: 'actual' });
  const changePeriod = useCallback((next) => setPeriod(next), []);
  const etapas = [
    [
      "Levante",
      "poblacion_por_linea_reparticion_levante",
      ["#f97316", "#fb923c", "#fdba74", "#ea580c", "#c2410c"],
    ],
    [
      "Postura",
      "poblacion_por_linea_reparticion_postura",
      ["#0ea5e9", "#38bdf8", "#7dd3fc", "#0284c7", "#0369a1"],
    ],
    [
      "Muda",
      "poblacion_por_linea_reparticion_muda",
      ["#7f1d1d", "#991b1b", "#b91c1c", "#be123c", "#881337"],
    ],
  ];
  return (
    <section className="page">
      <div className="page-heading">
        <h2>Granja Repartición</h2>
      </div>
      <nav className="lumbra-tabs">
        <button
          className={tab === "linea" ? "active" : ""}
          onClick={() => setTab("linea")}
        >
          Datos generales
        </button>
        <button
          className={tab === "lote" ? "active" : ""}
          onClick={() => setTab("lote")}
        >
          Saldos por lote
        </button>
        <button
          className={tab === "postura" ? "active" : ""}
          onClick={() => setTab("postura")}
        >
          Detalle por lote
        </button>
        <button
          className={tab === "consumo" ? "active" : ""}
          onClick={() => setTab("consumo")}
        >
          Consumo de alimento
        </button>
      </nav>
      {tab === "linea" && (
        <>
          <FiltroSemana {...period} onChange={changePeriod} farm="REPARTICIÓN" farmLabel="Repartición" />
          <div className="stage-columns">
            {etapas.map(([nombre, vista, colores]) => (
              <div className="stage-column" key={vista}>
                <div className="stage-view">
                  {tabla[vista] ? (
                    <ReparticionStagePopulationTable view={vista} title={nombre} />
                  ) : (
                    <ReparticionPopulationChart
                      view={vista}
                      title={`Población por línea · ${nombre}`}
                      colors={colores}
                    />
                  )}
                  <label className="view-switch">
                    <span>Gráfico</span>
                    <input
                      type="checkbox"
                      checked={tabla[vista] || false}
                      onChange={() =>
                        setTabla((x) => ({ ...x, [vista]: !x[vista] }))
                      }
                    />
                    <span className="switch-track">
                      <i />
                    </span>
                    <span>Tabla</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
          <AvesPorLoteChart />
          <strong className="stage-pie-title">Producción semanal por lote</strong>
          <DatosGeneralesProduccion {...period} />
        </>
      )}
      {tab === "lote" && (
        <>
          <FiltroLineaYLote farm="reparticion" idPrefix="reparticion-saldo" value={saldoFilter} onChange={setSaldoFilter} />
          <LoteContenido {...saldoFilter} mode="saldos" />
        </>
      )}
      {tab === "postura" && <>
        <FiltroLineaYLote farm="reparticion" idPrefix="reparticion-detalle" value={detalleFilter} onChange={setDetalleFilter} />
        <LoteContenido {...detalleFilter} />
      </>}
      {tab === "consumo" && (
        <div className="panel empty-section">
          <strong>
            {tab === "postura" ? "Postura" : "Consumo de alimento"}
          </strong>
          <p className="muted">Esta sección se desarrollará próximamente.</p>
        </div>
      )}
    </section>
  );
}
