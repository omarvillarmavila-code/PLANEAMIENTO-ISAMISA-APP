// Adapta registros de Repartición al contrato de las tarjetas compartidas.
export function numberOrNull(value) {
  if (value == null || String(value).trim() === '') return null;
  const text = String(value).trim();
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\d{1,3}(?:,\d{3})+(?:\.\d+)?)$/.test(text)) return null;
  return Number(text.replaceAll(',', ''));
}
const sum = (values) => values.length && values.every((v) => v != null) ? values.reduce((a, b) => a + b, 0) : null;
const pct = (quantity, base) => quantity != null && base > 0 ? quantity * 100 / base : null;
const normalize = (v) => String(v || '').trim().toUpperCase();

export function buildReparticionData(input, farmNames = ['REPARTICIÓN', 'REPARTICION']) {
  const groups = new Map(), seen = new Set();
  for (const row of input) {
    if (!farmNames.includes(normalize(row.Unid_Prod))) continue;
    if (!['HEMBRA', 'MACHO'].includes(normalize(row.Sexo))) continue;
    const business = Object.fromEntries(Object.entries(row).filter(([k]) => !['id', 'created_at'].includes(k)).sort(([a], [b]) => a.localeCompare(b)));
    const fingerprint = JSON.stringify(business);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    const key = JSON.stringify([normalize(row.Linea_Madre) || 'SIN LINEA', normalize(row.Cod_Lote) || 'SIN LOTE']);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const mortality = [], production = [], consumption = [];
  for (const [key, rows] of groups) {
    const [linea, lote] = JSON.parse(key);
    const age = Math.max(...rows.map((r) => numberOrNull(r.Edad_sem)).filter((n) => n != null));
    const common = { linea, lote, edad: Number.isFinite(age) ? age : null, edad_lote: Number.isFinite(age) ? age : null };
    const mort = { ...common }, feed = { ...common };
    for (const sex of ['hembra', 'macho']) {
      const records = rows.filter((r) => normalize(r.Sexo) === sex.toUpperCase());
      const ages = records.map((r) => numberOrNull(r.Edad_sem)).filter((v) => v != null);
      mort[`edad_${sex}`] = feed[`edad_${sex}`] = ages.length ? Math.max(...ages) : null;
      const dates = [...new Set(records.map((r) => r.Fecha))].sort();
      const population = new Map();
      for (const r of records) {
        if (normalize(r.Valido || 'Y') !== 'Y') continue;
        const k = JSON.stringify([r.Fecha, normalize(r.Galpon), normalize(r.Etapa)]);
        if (!population.has(k)) population.set(k, []);
        population.get(k).push(numberOrNull(r.Saldo_Ini));
      }
      const dailyBalances = [...population].map(([key, values]) => {
        const unique = new Set(values);
        return { date: JSON.parse(key)[0], balance: unique.size === 1 && values[0] != null && values[0] >= 0 ? values[0] : null };
      });
      const first = sum(dailyBalances.filter((r) => r.date === dates[0]).map((r) => r.balance));
      const birdDays = dates.length && dates.every((date) => dailyBalances.some((r) => r.date === date)) ? sum(dailyBalances.map((r) => r.balance)) : null;
      // Misma convención que la vista de Lumbra: Mortal vacío significa
      // sin bajas en esa fila. Texto inválido sí invalida la suma.
      const deaths = sum(records.filter((r) => normalize(r.Valido || 'Y') === 'Y').map((r) =>
        r.Mortal == null || String(r.Mortal).trim() === '' ? 0 : numberOrNull(r.Mortal)));
      mort[`saldo_inicial_${sex}`] = first;
      mort[`mortalidad_${sex}`] = deaths;
      mort[`porcentaje_mortalidad_${sex}`] = pct(deaths, first);
      const foods = new Map();
      for (const r of records) {
        const name = normalize(r.Tipo_Alim) || 'SIN ALIMENTO';
        if (!foods.has(name)) foods.set(name, []);
        foods.get(name).push(numberOrNull(r.Cons_Alim));
      }
      feed[`alimentos_${sex}`] = [...foods].map(([alimento, values]) => ({ alimento, kg: sum(values) }));
      feed[`consumo_kg_${sex}`] = sum(records.map((r) => numberOrNull(r.Cons_Alim)));
      feed[`saldo_inicial_${sex}`] = first;
      feed[`suma_saldos_diarios_${sex}`] = birdDays;
      feed[`dias_registrados_${sex}`] = dates.length || null;
    }
    const females = rows.filter((r) => normalize(r.Sexo) === 'HEMBRA' && /^POSTURA.*PAVO$/.test(normalize(r.Etapa)));
    if (females.length) {
      const balance = sum(females.filter((r) => normalize(r.Valido || 'Y') === 'Y').map((r) => numberOrNull(r.Saldo_Final)));
      const hinc = sum(females.map((r) => numberOrNull(r.Prod_HInc)));
      const hcom = sum(females.map((r) => numberOrNull(r.Prod_HCom)));
      production.push({ ...common, edad_hembra: mort.edad_hembra, etapa: 'POSTURA - PAVO', saldo_inicial_hembra: mort.saldo_inicial_hembra,
        prod_hinc: hinc, prod_hcom: hcom, porcentaje_prod_hinc: pct(hinc, balance), porcentaje_prod_hcom: pct(hcom, balance) });
    }
    mortality.push(mort); consumption.push(feed);
  }
  return { mortality, production, consumption };
}
