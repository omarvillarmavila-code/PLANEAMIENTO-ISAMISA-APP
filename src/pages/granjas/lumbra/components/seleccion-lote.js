// Usar siempre la fila de la barra/etiqueta pulsada, no el tooltip activo.
// Un mismo código de lote puede aparecer en más de una línea.
export function seleccionarLote(row, onSelectLote) {
  const lote = String(row?.lote ?? '').trim();
  if (!lote || !onSelectLote) return;
  onSelectLote({ linea: String(row.linea ?? '').trim(), lote });
}

export function loteBarProps(onSelectLote) {
  return onSelectLote ? {
    cursor: 'pointer',
    onClick: (entry) => seleccionarLote(entry?.payload, onSelectLote),
  } : {};
}

export function loteTickProps(row, onSelectLote) {
  if (!row?.lote || !onSelectLote) return {};
  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': `Ver detalle del lote ${row.lote}, línea ${row.linea}`,
    style: { cursor: 'pointer' },
    onClick: () => seleccionarLote(row, onSelectLote),
    onKeyDown: (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        seleccionarLote(row, onSelectLote);
      }
    },
  };
}
