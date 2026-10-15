import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../../lib/supabase";
import LoadingCircle from "./00.LoadingCircle";
import { loteBarProps, loteTickProps } from '../seleccion-lote';
import { esPosturaPollo } from '../etapas';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
const ORDER = ["CRIOLLO", "ISAMISA", "FRANCES", "BARRADO", "DEKALB"],
  fmt = (n) => n == null ? "Sin dato" : Number(n).toLocaleString("en-US"),
  fmtPercent = (n) => `${fmt(n)}%`,
  fmtPercentLabel = (n) => n == null ? "Sin dato" :
    `${Number(n).toLocaleString("en-US", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}%`;
function LoteTooltip({ active, payload, quantity, quantityLabel }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <strong style={{ fontWeight: 900 }}>
        {d.linea} - {d.lote}
      </strong>
      <span>Cod std: {d.codStd || "-"}</span>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          marginTop: 6,
          paddingTop: 6,
          borderTop: "1px solid #dbe1e3",
        }}
      >
        <span>
          {quantityLabel}: {fmt(d[quantity])}
        </span>
        <span>
          Saldo inicial hembra:{" "}
          {d.saldoInicialHembra == null
            ? "Sin dato"
            : fmt(d.saldoInicialHembra)}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          marginTop: 6,
          paddingTop: 6,
          borderTop: "1px solid #dbe1e3",
        }}
      >
        {payload
          .filter((item) => item.dataKey !== "referencia")
          .map((item) => (
            <span key={item.dataKey} style={{ fontWeight: 700 }}>
              {item.name}: {fmtPercentLabel(item.value)}
            </span>
          ))}
      </div>
      <small style={{ fontWeight: 900 }}>Edad: {d.edad}</small>
    </div>
  );
}
function Tick({ x, y, index, data, onSelectLote }) {
  const d = data[index],
    p = data[index - 1];
  return (
    <g transform={`translate(${x},${y})`} {...loteTickProps(d, onSelectLote)}>
      <text textAnchor="middle" dy={12} fontSize={10}>
        {d?.lote}
      </text>
      {(!p || p.linea !== d?.linea) && (
        <text textAnchor="middle" dy={28} fontSize={9} fontWeight="700">
          {d?.linea}
        </text>
      )}
    </g>
  );
}
function AgeLabel({ x, y, value }) {
  return (
    <g transform={`translate(${x},${y - 10})`}>
      <rect x={-12} y={-11} width={24} height={17} rx={3} fill="#4b5563" />
      <text
        x={0}
        y={1}
        textAnchor="middle"
        fontSize={10}
        fontWeight="700"
        fill="#f9fafb"
      >
        {value}
      </text>
    </g>
  );
}
export default function PosturaPorLoteChart({
  year = "actual",
  week = "actual",
  linea = "",
  lote = "",
  onSelectLote,
  dataRows,
  farmLabel = "Lumbra",
  showCommercial = true,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (dataRows !== undefined) { setRows(dataRows); setLoading(false); return; }
    setLoading(true);
    setRows([]);
    if (year === "actual" || week === "actual" || !year || !week) {
      setLoading(false);
      return;
    }
    let query = supabase
      .rpc('app_lumbra_postura', { p_year: Number(year), p_week: Number(week), p_lot: lote || null })
      .select("*")
      .ilike("etapa", "POSTURA%POLLO");
    if (year !== "actual") query = query.eq("ano", year);
    if (week !== "actual") query = query.eq("semana", week);
    if (linea) query = query.eq("linea", linea);
    if (lote) query = query.eq("lote", lote);
    query.then(({ data, error }) => {
      if (error) {
        console.error("Error cargando postura por lote:", error);
        setRows([]);
        setLoading(false);
        return;
      }
      const nextRows = (data || []).filter((row) => esPosturaPollo(row.etapa));
      setRows(nextRows);
      setLoading(false);
    });
  }, [year, week, linea, lote, dataRows]);
  const data = useMemo(() => {
    const g = {};
    rows.forEach((r) => {
      const linea = String(r.linea || "Sin linea").trim(),
        lote = String(r.lote || "Sin lote").trim(),
        key = `${linea}|${lote}`;
      g[key] ??= {
        linea,
        lote,
        codStd: r.cod_std || "-",
        edad: r.edad || "-",
        saldoInicialHembra: r.saldo_inicial_hembra ?? null,
        prodHinc: 0,
        prodHcom: 0,
        cantidadHinc: 0,
        cantidadHcom: 0,
        prodHincStd: 0,
        prodHcomStd: 0,
        referencia: 100,
      };
      g[key].prodHinc = r.porcentaje_prod_hinc == null && dataRows !== undefined ? null : (g[key].prodHinc ?? 0) + Number(r.porcentaje_prod_hinc || 0);
      g[key].prodHcom = r.porcentaje_prod_hcom == null && dataRows !== undefined ? null : (g[key].prodHcom ?? 0) + Number(r.porcentaje_prod_hcom || 0);
      g[key].cantidadHinc = r.prod_hinc == null && dataRows !== undefined ? null : (g[key].cantidadHinc ?? 0) + Number(r.prod_hinc || 0);
      g[key].cantidadHcom = r.prod_hcom == null && dataRows !== undefined ? null : (g[key].cantidadHcom ?? 0) + Number(r.prod_hcom || 0);
      g[key].prodHincStd = r.prod_hinc_std == null && dataRows !== undefined ? null : Number(r.prod_hinc_std || 0);
      g[key].prodHcomStd = r.prod_hcom_std == null && dataRows !== undefined ? null : Number(r.prod_hcom_std || 0);
    });
    return Object.values(g).sort(
      (a, b) =>
        (ORDER.indexOf(a.linea.toUpperCase()) < 0
          ? 99
          : ORDER.indexOf(a.linea.toUpperCase())) -
          (ORDER.indexOf(b.linea.toUpperCase()) < 0
            ? 99
            : ORDER.indexOf(b.linea.toUpperCase())) ||
        a.lote.localeCompare(b.lote, undefined, { numeric: true }),
    );
  }, [rows, dataRows]);
  return (
    <div className="panel lote-chart">
      <strong className="stage-pie-title">Postura por lote. {farmLabel}</strong>
      {loading ? (
        <LoadingCircle text="Cargando postura por lote..." />
      ) : (
        <div
          className="lote-chart-stack"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "16px",
          }}
        >
          <div>
            <strong className="stage-pie-title">% Huevo incubable</strong>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data}
                barGap={1}
                barCategoryGap="18%"
                margin={{ top: 20, right: 20, left: 5, bottom: 20 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="lote"
                  interval={0}
                  tick={(p) => <Tick {...p} data={data} onSelectLote={onSelectLote} />}
                  height={55}
                />
                <YAxis
                  domain={[0, 110]}
                  allowDataOverflow
                  tickFormatter={fmtPercent}
                />
                <YAxis yAxisId="edad" domain={[0, 100]} hide />
                <Tooltip
                  content={
                    <LoteTooltip
                      quantity="cantidadHinc"
                      quantityLabel="Huevos incubables"
                    />
                  }
                />
                <Legend />
                <Bar
                  {...loteBarProps(onSelectLote)}
                  dataKey="prodHinc"
                  name="% HInc"
                  fill="#16a34a"
                  barSize={10}
                  radius={[3, 3, 0, 0]}
                >
                  <LabelList
                    dataKey="prodHinc"
                    position="top"
                    formatter={(value) => value == null ? "" : fmtPercentLabel(value)}
                    fill="#374151"
                  />
                </Bar>
                <Bar
                  {...loteBarProps(onSelectLote)}
                  dataKey="prodHincStd"
                  name="Std HInc"
                  fill="#9ca3af"
                  barSize={10}
                  radius={[3, 3, 0, 0]}
                />
                <Line
                  yAxisId="edad"
                  dataKey="referencia"
                  name="Edad"
                  stroke="#cbd5e1"
                  strokeWidth={2}
                  dot={false}
                >
                  <LabelList dataKey="edad" content={<AgeLabel />} />
                </Line>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {showCommercial && <div>
            <strong className="stage-pie-title">% Huevo comercial</strong>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data}
                barGap={1}
                barCategoryGap="18%"
                margin={{ top: 20, right: 20, left: 5, bottom: 20 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="lote"
                  interval={0}
                  tick={(p) => <Tick {...p} data={data} onSelectLote={onSelectLote} />}
                  height={55}
                />
                <YAxis
                  domain={[0, (dataMax) => Math.max(1, dataMax * 1.2)]}
                  tickFormatter={fmtPercent}
                />
                <YAxis yAxisId="edad" domain={[0, 100]} hide />
                <Tooltip
                  content={
                    <LoteTooltip
                      quantity="cantidadHcom"
                      quantityLabel="Huevos comerciales"
                    />
                  }
                />
                <Legend />
                <Bar
                  {...loteBarProps(onSelectLote)}
                  dataKey="prodHcom"
                  name="% HCom"
                  fill="#f97316"
                  barSize={10}
                  radius={[3, 3, 0, 0]}
                >
                  <LabelList
                    dataKey="prodHcom"
                    position="top"
                    formatter={(value) => value == null ? "" : fmtPercentLabel(value)}
                    fill="#374151"
                  />
                </Bar>
                <Bar
                  {...loteBarProps(onSelectLote)}
                  dataKey="prodHcomStd"
                  name="Std HCom"
                  fill="#9ca3af"
                  barSize={10}
                  radius={[3, 3, 0, 0]}
                />
                <Line
                  yAxisId="edad"
                  dataKey="referencia"
                  name="Edad"
                  stroke="#cbd5e1"
                  strokeWidth={2}
                  dot={false}
                >
                  <LabelList dataKey="edad" content={<AgeLabel />} />
                </Line>
              </BarChart>
            </ResponsiveContainer>
          </div>}
        </div>
      )}
    </div>
  );
}
