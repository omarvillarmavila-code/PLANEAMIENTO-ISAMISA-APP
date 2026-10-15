import React, { useMemo } from 'react';
import { buildLotHistory } from './resumen-pesos';
import ResumenPesos from './ResumenPesos';
import GraficosHistorialLote from './GraficosHistorialLote';
export default function InformeLote({ lote, weights, dailyRows, standards, children }) {
  const columns = useMemo(() => buildLotHistory(lote, undefined, weights, dailyRows, standards), [lote, weights, dailyRows, standards]);
  return <div className="asia-lot-visuals">
    {children && <div className="asia-lot-primary">
      {children}
    </div>}
    <GraficosHistorialLote columns={columns} lote={lote} />
    <ResumenPesos columns={columns} lote={lote} />
  </div>;
}
