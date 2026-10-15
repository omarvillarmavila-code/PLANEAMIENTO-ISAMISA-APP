import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../../lib/supabase";
import LoadingCircle from "./00.LoadingCircle";
import { loteBarProps, loteTickProps } from '../seleccion-lote';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const ORDER = ["CRIOLLO", "ISAMISA", "FRANCES", "BARRADO", "DEKALB"];
const CHARTS = [
  { sexo: "Hembras", actual: "mortalidadHembra", standard: "stdHembra", quantity: "muertesHembra", balance: "saldoInicialHembra", color: "#6366f1" },
  { sexo: "Machos", actual: "mortalidadMacho", standard: "stdMacho", quantity: "muertesMacho", balance: "saldoInicialMacho", color: "#818cf8" },
];
const toPercent = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const fmtPercent = (value) =>
  value === null || value === undefined
    ? "Sin dato"
    : `${Number(value).toLocaleString("en-US", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}%`;

function LoteTooltip({ active, payload, actual, standard, quantity, balance, showStandard }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <strong style={{ fontWeight: 900 }}>{d.linea} - {d.lote}</strong>
      <span>Cod std: {d.codStd}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6, paddingTop: 6, borderTop: "1px solid #dbe1e3" }}>
        <span>Muertes: {d[quantity] == null ? "Sin dato" : Number(d[quantity]).toLocaleString("en-US")}</span>
        <span>{balance === "saldoInicialHembra" ? "Saldo inicial hembra" : "Saldo inicial macho"}: {d[balance] == null ? "Sin dato" : Number(d[balance]).toLocaleString("en-US")}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6, paddingTop: 6, borderTop: "1px solid #dbe1e3" }}>
        <span style={{ fontWeight: 700 }}>% Mortalidad: {fmtPercent(d[actual])}</span>
        {showStandard && <span style={{ fontWeight: 700 }}>Std Mortalidad: {fmtPercent(d[standard])}</span>}
      </div>
      <small style={{ fontWeight: 900 }}>Edad: {d.edad}</small>
    </div>
  );
}

function Tick({ x, y, index, data, onSelectLote }) {
  const d = data[index], previous = data[index - 1];
  return (
    <g transform={`translate(${x},${y})`} {...loteTickProps(d, onSelectLote)}>
      <text textAnchor="middle" dy={12} fontSize={10}>{d?.lote}</text>
      {(!previous || previous.linea !== d?.linea) && (
        <text textAnchor="middle" dy={28} fontSize={9} fontWeight="700">
          {d?.linea}
        </text>
      )}
    </g>
  );
}

function AgeTick({ x, y, payload }) {
  const width = Math.max(24, String(payload.value).length * 7 + 8);
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-width / 2} y={-18} width={width} height={18} rx={3} fill="#4b5563" />
      <text textAnchor="middle" y={-5} fontSize={10} fontWeight="700" fill="#f9fafb">
        {payload.value}
      </text>
    </g>
  );
}

export default function MortalidadPorLoteChart({ year = "actual", week = "actual", onSelectLote, dataRows, farmLabel = "Lumbra", showStandard = true }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (dataRows !== undefined) { setRows(dataRows); setLoading(false); setError(false); return; }
    let cancelled = false;
    setRows([]);
    setError(false);
    if (year === "actual" || week === "actual" || !year || !week) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    async function loadRows() {
      try {
        const { data, error: queryError } = await supabase
          .rpc('app_lumbra_postura', { p_year: Number(year), p_week: Number(week) })
          .select("linea,lote,edad,cod_std,saldo_inicial_hembra,saldo_inicial_macho,mortalidad_hembra,mortalidad_macho,porcentaje_mortalidad_hembra,porcentaje_mortalidad_macho,porcentaje_mortalidad_std_sem_hembra,porcentaje_mortalidad_std_sem_macho")
          .eq("ano", year)
          .eq("semana", week)
          .abortSignal(controller.signal);
        if (queryError) throw queryError;
        if (!cancelled) setRows(data || []);
      } catch (queryError) {
        if (!cancelled) {
          console.error("Error cargando mortalidad por lote:", queryError);
          setError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadRows();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [year, week, dataRows]);

  const data = useMemo(() => {
    const grouped = new Map();
    rows.forEach((r) => {
      const linea = String(r.linea || "Sin linea").trim();
      const lote = String(r.lote || "Sin lote").trim();
      const key = JSON.stringify([linea, lote]);
      // Son porcentajes semanales ya calculados: no se suman entre filas.
      if (!grouped.has(key)) grouped.set(key, {
        linea, lote,
        codStd: r.cod_std || "-",
        edad: r.edad ?? "-",
        saldoInicialHembra: r.saldo_inicial_hembra ?? null,
        saldoInicialMacho: r.saldo_inicial_macho ?? null,
        mortalidadHembra: toPercent(r.porcentaje_mortalidad_hembra),
        mortalidadMacho: toPercent(r.porcentaje_mortalidad_macho),
        muertesHembra: r.mortalidad_hembra ?? null,
        muertesMacho: r.mortalidad_macho ?? null,
        stdHembra: toPercent(r.porcentaje_mortalidad_std_sem_hembra),
        stdMacho: toPercent(r.porcentaje_mortalidad_std_sem_macho),
      });
    });
    const rank = (linea) => {
      const index = ORDER.indexOf(linea.toUpperCase());
      return index < 0 ? ORDER.length : index;
    };
    return [...grouped.values()].sort((a, b) =>
      rank(a.linea) - rank(b.linea)
      || a.linea.localeCompare(b.linea, undefined, { sensitivity: "base" })
      || a.lote.localeCompare(b.lote, undefined, { numeric: true }),
    );
  }, [rows]);

  return (
    <div className="panel lote-chart">
      <strong className="stage-pie-title">Mortalidad por lote. {farmLabel}</strong>
      {loading ? (
        <LoadingCircle text="Cargando mortalidad por lote..." />
      ) : error ? (
        <p role="alert">No se pudo cargar la mortalidad por lote. Intenta nuevamente.</p>
      ) : !data.length ? (
        <p className="muted">No hay datos de mortalidad para el período seleccionado.</p>
      ) : (
        <div className="lote-chart-stack" style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
          {CHARTS.map(({ sexo, actual, standard, quantity, balance, color }) => (
            <div key={sexo}>
              <strong className="stage-pie-title">% Mortalidad semanal · {sexo}</strong>
              {showStandard && dataRows !== undefined && data.some((row) => row[standard] == null && row[balance] != null) && <p role="status" className="muted">
                Sin estándar de mortalidad para: {data.filter((row) => row[standard] == null && row[balance] != null).map((row) => row.lote).join(', ')}.
              </p>}
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data} barGap={1} barCategoryGap="18%" margin={{ top: 20, right: 20, left: 5, bottom: 20 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="lote" interval={0} tick={(props) => <Tick {...props} data={data} onSelectLote={onSelectLote} />} height={55} />
                  <XAxis xAxisId="edad" dataKey="edad" orientation="top" interval={0} height={25} axisLine={false} tickLine={false} tick={<AgeTick />} />
                  <YAxis domain={[0, (dataMax) => Math.max(1, dataMax * 1.2)]} tickFormatter={fmtPercent} />
                  <Tooltip filterNull={false} content={<LoteTooltip actual={actual} standard={standard} quantity={quantity} balance={balance} showStandard={showStandard} />} />
                  <Legend />
                  <Bar {...loteBarProps(onSelectLote)} dataKey={actual} name="% Mortalidad" fill={color} barSize={10} radius={[3, 3, 0, 0]}>
                    <LabelList dataKey={actual} position="top" formatter={(value) => value == null ? "" : fmtPercent(value)} fill="#374151" />
                  </Bar>
                  {showStandard && <Bar {...loteBarProps(onSelectLote)} dataKey={standard} name="Std Mortalidad" fill="#6b7280" barSize={10} minPointSize={(value) => value > 0 ? 3 : 0} radius={[3, 3, 0, 0]}>
                    <LabelList dataKey={standard} position="top" formatter={(value) => value == null ? '' : fmtPercent(value)} fill="#4b5563" />
                  </Bar>}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
