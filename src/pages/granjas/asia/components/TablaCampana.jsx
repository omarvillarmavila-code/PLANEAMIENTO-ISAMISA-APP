import React from 'react';
import { fmt, dateText } from './TarjetaCampana';
export default function TablaCampana({ data }) {
  const total = data.details.length && data.details.every((r) => r.saldo != null)
    ? data.details.reduce((sum, r) => sum + r.saldo, 0) : null;
  return <section className="panel asia-campaign-detail">
    <h3>{data.label}</h3>
    {data.lastDate && <p className="muted">Saldo al {dateText(data.lastDate)}</p>}
    <div className="table-scroll"><table aria-label={`Lotes, edad, color, sexo y saldo de ${data.label}`}>
      <thead><tr><th scope="col">Lote</th><th scope="col">Edad (sem)</th><th scope="col">Color</th><th scope="col">Sexo</th><th scope="col">Saldo</th></tr></thead>
      <tbody>{data.details.length ? data.details.map((row) => <tr key={JSON.stringify([row.lote, row.color, row.sexo])}>
        <td>{row.lote}</td><td>{fmt(row.edad)}</td><td>{row.color === 'SIN COLOR' ? 'Sin dato' : row.color}</td><td>{row.sexo === 'HEMBRA' ? 'Hembra' : row.sexo === 'MACHO' ? 'Macho' : row.sexo}</td><td>{fmt(row.saldo)}</td>
      </tr>) : <tr><td colSpan={5}>No hay saldos para esta campaña en la semana seleccionada.</td></tr>}</tbody>
      {data.details.length > 0 && <tfoot><tr><th scope="row" colSpan={4}>Total campaña</th><td>{fmt(total)}</td></tr></tfoot>}
    </table></div>
  </section>;
}
