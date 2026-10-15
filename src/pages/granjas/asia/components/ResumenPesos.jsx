import React from 'react';
const fmt = (v, digits = 0) => v == null || Number(v) === 0 ? '-' : Number(v).toLocaleString('es-PE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (v) => v == null || Number(v) === 0 ? '-' : `${fmt(v, 1)}%`;
export default function ResumenPesos({ lote, columns }) {
  const tableColumns = columns.filter((column) => column.sample != null || column.hasDaily);
  const descriptive = [
    ['Descriptiva', 'Promedio (gr)', (c) => fmt(c.sample?.mean)], ['', 'Mediana (gr)', (c) => fmt(c.sample?.median)],
    ['', 'Desviación típica (gr)', (c) => fmt(c.sample?.sd)], ['', 'CV (%)', (c) => pct(c.sample?.cv)],
    ['', 'Uniformidad (%)', (c) => pct(c.sample?.uniformity)], ['Muestra', 'Existencia (und)', (c) => fmt(c.sampleExistence)],
    ['', 'Muestra semanal', (c) => fmt(c.sample?.n)], ['', '% muestra', (c) => pct(c.samplePct)],
    ['', 'Límite superior (gr)', (c) => fmt(c.sample?.max)], ['', 'Límite inferior (gr)', (c) => fmt(c.sample?.min)],
  ];
  const production = [
    ['Saldos', 'Saldo inicial (und)', (c) => fmt(c.existence)], ['', 'Mortalidad (und)', (c) => fmt(c.mortality)], ['', 'Venta y Transf. Sal. (und)', (c) => fmt(c.sales)],
    ['Consumos', 'Peso ave (gr)', (c) => fmt(c.dailyWeight)], ['', 'Peso estándar (gr)', (c) => fmt(c.standardWeight)],
    ['', 'Consumo (gr/ave/día)', (c) => fmt(c.consumption, 1)], ['', 'Consumo estándar (gr/ave/día)', (c) => fmt(c.standardConsumption, 1)],
    ['', 'Consumo alimento (kg)', (c) => fmt(c.foodKg)], ['', 'Consumo estándar (kg)', (c) => fmt(c.standardFoodKg)],
    ['', 'CA', (c) => fmt(c.ca, 2)], ['', 'CA estándar', (c) => fmt(c.standardCA, 2)],
  ];
  return <div className="asia-history-tables">{[descriptive, production].map((rows, index) => {
    return <div className="panel" key={index}>
    <h4>{index === 0 ? 'Estadística de pesos' : 'Saldos y consumos'} · {lote}</h4>
    <div className="table-scroll"><table style={{ '--asia-table-columns': tableColumns.length + 2, width: '100%', maxWidth: '100%' }} aria-label={`${index === 0 ? 'Estadística' : 'Producción'} por edad del lote ${lote}`}>
      <colgroup><col className="asia-history-group-column" /><col className="asia-history-values-column" />{tableColumns.map((c) => <col key={c.age} />)}</colgroup>
      <thead><tr><th rowSpan={2}>Grupo</th><th rowSpan={2}>Valores</th><th colSpan={Math.max(1, tableColumns.length)}>Edad (sem)</th></tr>
        <tr>{tableColumns.length ? tableColumns.map((c) => <th key={c.age}>{c.age ?? '-'}</th>) : <th>-</th>}</tr>
        {index === 1 && <tr><th /><th>Tipo de alimento</th>{tableColumns.map((c) => <th key={c.age} className="asia-food-cell">{c.foods ? c.foods.split(' / ').map((food) => <span key={food}>{food}</span>) : '-'}</th>)}</tr>}
      </thead><tbody>{rows.map(([group, label, value], rowIndex) => {
        const nextGroup = rows.findIndex((row, i) => i > rowIndex && row[0]);
        const span = (nextGroup < 0 ? rows.length : nextGroup) - rowIndex;
        return <tr key={label} className={group ? 'asia-history-group-start' : undefined}>
          {group && <th scope="rowgroup" rowSpan={span} className="asia-history-group">{group}</th>}
          <th scope="row" className="asia-history-value">{label}</th>{tableColumns.map((c) => <td key={c.age}>{index === 1 && !c.hasDaily ? '-' : value(c)}</td>)}
        </tr>;
      })}</tbody>
    </table></div>
  </div>; })}</div>;
}
