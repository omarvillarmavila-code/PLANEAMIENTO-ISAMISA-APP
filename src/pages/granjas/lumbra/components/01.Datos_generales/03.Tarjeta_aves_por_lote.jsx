import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../../lib/supabase";
import LoadingCircle from "./00.LoadingCircle";
import { loteBarProps, loteTickProps } from '../seleccion-lote';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
const ORDER = ["CRIOLLO", "ISAMISA", "FRANCES", "BARRADO", "DEKALB"],
  fmt = (n) => Number(n || 0).toLocaleString("en-US");
function LoteTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload,
    total = d.hembras + d.machos;
  return (
    <div className="chart-tooltip">
      <strong style={{ fontWeight: 900 }}>
        {d.linea} - {d.lote}
      </strong>
      <span>
        Hembras: {fmt(d.hembras)} (
        {total ? ((d.hembras / total) * 100).toFixed(2) : "0.00"}%)
      </span>
      <span>
        Machos: {fmt(d.machos)} (
        {total ? ((d.machos / total) * 100).toFixed(2) : "0.00"}%)
      </span>
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
export default function AvesPorLoteChart({ year = "actual", week = "actual", onSelectLote }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    if (year === "actual" || week === "actual" || !year || !week) return;
    let query = supabase
      .rpc('app_lumbra_poblacion_lote', { p_year: Number(year), p_week: Number(week) })
      .select("*");
    if (year !== "actual") query = query.eq("ano", year);
    if (week !== "actual") query = query.eq("semana", week);
    query.then(({ data, error }) => {
      if (error) {
        console.error("Error cargando aves por lote:", error);
        setLoading(false);
        return;
      }
      const nextRows = (data || []).flatMap((row) => [
        { ...row, sexo: "HEMBRA", saldo_final: row.saldo_final_hembras },
        { ...row, sexo: "MACHO", saldo_final: row.saldo_final_machos },
      ]);
      if (nextRows.length > 0) setRows(nextRows);
      setLoading(false);
    });
  }, [year, week]);
  const data = useMemo(() => {
    const g = {};
    rows.forEach((r) => {
      const linea = String(r.linea || "Sin linea").trim(),
        lote = String(r.lote || "Sin lote").trim(),
        key = `${linea}|${lote}`;
      g[key] ??= {
        linea,
        lote,
        hembras: 0,
        machos: 0,
        edad: r.edad_lote || "-",
        referencia: 100,
      };
      const n = Math.max(0, Number(r.saldo_final || 0));
      if (String(r.sexo).toUpperCase() === "HEMBRA") g[key].hembras += n;
      if (String(r.sexo).toUpperCase() === "MACHO") g[key].machos += n;
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
  }, [rows]);
  return (
    <div className="panel lote-chart">
      <strong className="stage-pie-title">Aves por lote. Lumbra</strong>
      {loading ? (
        <LoadingCircle text="Cargando aves por lote..." />
      ) : (
        <ResponsiveContainer width="100%" height={380}>
          <BarChart
            data={data}
            barGap={6}
            barCategoryGap="28%"
            margin={{ top: 45, right: 20, left: 5, bottom: 20 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="lote"
              interval={0}
              tick={(p) => <Tick {...p} data={data} onSelectLote={onSelectLote} />}
              height={55}
            />
            <YAxis yAxisId="aves" domain={[0, "auto"]} tickFormatter={fmt} />
            <YAxis yAxisId="referencia" domain={[0, 100]} hide />
            <Tooltip content={<LoteTooltip />} />
            <Legend />
            <Bar
              {...loteBarProps(onSelectLote)}
              yAxisId="aves"
              dataKey="hembras"
              name="Hembras"
              fill="#2563eb"
              barSize={10}
              radius={[3, 3, 0, 0]}
            />
            <Bar
              {...loteBarProps(onSelectLote)}
              yAxisId="aves"
              dataKey="machos"
              name="Machos"
              fill="#dc2626"
              barSize={10}
              radius={[3, 3, 0, 0]}
            />
            <Line
              yAxisId="referencia"
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
      )}
    </div>
  );
}
