export function esPosturaPollo(etapa) {
  return String(etapa ?? '').trim().toUpperCase().replace(/\s*-\s*/g, '-') === 'POSTURA-POLLO';
}
