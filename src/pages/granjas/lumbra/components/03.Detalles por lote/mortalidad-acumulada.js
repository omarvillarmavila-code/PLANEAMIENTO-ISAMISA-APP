import { agruparPeriodos } from './periodos-detalle.js';

function porcentaje(value) {
  if (value == null || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function serieMortalidadAcumulada(rows, sexo) {
  return agruparPeriodos(rows).map(({ rows: entries, ...period }) => {
    // La vista repite las medidas del lote en cada linea: no volver a sumarlas.
    const row = entries[0];
    return {
      ...period,
      porcentaje: porcentaje(row[`porcentaje_mortalidad_acum_${sexo}`]),
      estandar: porcentaje(row[`porcentaje_mortalidad_std_acum_${sexo}`]),
    };
  });
}
