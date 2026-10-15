import { ASIA_STANDARDS } from './estandares-asia-datos.js';
import { numberOrNull } from '../../reparticion/components/datos-generales.js';
const norm = (v) => String(v ?? '').trim().toUpperCase().replace(/\s+/g, ' ');

export function lotConsumptionStandard(rows, standards = ASIA_STANDARDS) {
  const index = new Map();
  for (const r of standards) {
    const key = JSON.stringify([norm(r.color), norm(r.variedad), norm(r.sexo), Number(r.edad_sem)]);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(numberOrNull(r.consumo_g_ave_dia));
  }
  const groups = new Map();
  for (const r of rows.filter((r) => norm(r.Valido || 'Y') === 'Y')) {
    const key = JSON.stringify([r.Fecha, norm(r.Galpon), norm(r.Etapa), norm(r.Sexo), norm(r.Variedad)]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  if (!groups.size) return { consumoEstandarDiario: null, consumoEstandarKg: null };
  let birdDays = 0, grams = 0;
  const dates = new Set();
  for (const entries of groups.values()) {
    const balances = entries.map((r) => numberOrNull(r.Saldo_Ini));
    if (balances.some((n) => n == null || n < 0) || new Set(balances).size !== 1) return { consumoEstandarDiario: null, consumoEstandarKg: null };
    const keys = new Set(entries.map((r) => JSON.stringify([norm(r.Variedad), norm(r.Linea_Madre), norm(r.Sexo), Number(r.Edad_sem)])));
    if (keys.size !== 1) return { consumoEstandarDiario: null, consumoEstandarKg: null };
    const expected = index.get([...keys][0]) ?? [];
    if (!expected.length || expected.some((n) => n == null) || new Set(expected).size !== 1) return { consumoEstandarDiario: null, consumoEstandarKg: null };
    birdDays += balances[0]; grams += balances[0] * expected[0]; dates.add(entries[0].Fecha);
  }
  if (new Set(rows.map((r) => r.Fecha)).size !== dates.size || !(birdDays > 0)) return { consumoEstandarDiario: null, consumoEstandarKg: null };
  return { consumoEstandarDiario: grams / birdDays, consumoEstandarKg: grams / 1000 };
}
