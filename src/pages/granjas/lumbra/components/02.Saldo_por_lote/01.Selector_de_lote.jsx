import React from 'react';
import FiltroLineaYLote from '../03.Detalles por lote/01.Filtro_linea_y_lote';

export default function LoteSelector({ value, onChange }) {
  return <FiltroLineaYLote value={value} onChange={onChange} idPrefix="saldo" />;
}
