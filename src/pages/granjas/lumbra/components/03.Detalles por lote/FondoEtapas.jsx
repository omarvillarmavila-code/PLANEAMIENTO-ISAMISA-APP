import React from 'react';
import { usePlotArea, useXAxisScale, ZIndexLayer } from 'recharts';

const ETAPAS = {
  LEVANTE: { label: 'Levante', fill: '#ffead6', border: '#e6b78c' },
  POSTURA: { label: 'Postura', fill: '#e0f2fe', border: '#9ecae3' },
};

function etapaDelPeriodo(row) {
  const etapa = String(row.etapa ?? '').trim().toUpperCase().split('-')[0].trim();
  return Object.hasOwn(ETAPAS, etapa) ? etapa : null;
}

export function LeyendaEtapas({ data }) {
  const presentes = new Set(data.map(etapaDelPeriodo));
  return <div aria-label="Etapas indicadas por el fondo" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px', fontSize: '11px', color: '#475569' }}>
    {Object.entries(ETAPAS).filter(([key]) => presentes.has(key)).map(([key, etapa]) =>
      <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
        <span aria-hidden="true" style={{ width: '12px', height: '10px', borderRadius: '2px', background: etapa.fill, border: `1px solid ${etapa.border}` }} />
        {etapa.label}
      </span>
    )}
  </div>;
}

export default function FondoEtapas({ data }) {
  const plot = usePlotArea();
  const xScale = useXAxisScale();
  if (!plot || !xScale || !data.length) return null;

  const tramos = [];
  data.forEach((row, index) => {
    const etapa = etapaDelPeriodo(row);
    const anterior = tramos.at(-1);
    if (anterior?.etapa === etapa) anterior.fin = index;
    else tramos.push({ etapa, inicio: index, fin: index });
  });

  // El cambio de fondo queda a mitad de camino entre dos puntos semanales.
  // Las etapas de una misma semana conservan sus puntos separados.
  const limite = (index) => index === 0 ? plot.x
    : index === data.length ? plot.x + plot.width
      : (xScale(data[index - 1].periodo) + xScale(data[index].periodo)) / 2;

  return <ZIndexLayer zIndex={-200}>
    <g aria-hidden="true" pointerEvents="none">
      {tramos.filter((tramo) => tramo.etapa).map(({ etapa, inicio, fin }) => {
        const left = limite(inicio);
        const right = limite(fin + 1);
        if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
        return <rect key={data[inicio].periodo} x={left} y={plot.y}
          width={Math.max(0, right - left)} height={plot.height}
          fill={ETAPAS[etapa].fill} />;
      })}
    </g>
  </ZIndexLayer>;
}
