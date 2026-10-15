// Cada grupo une el encabezado del reporte con sus nombres de columna.
// Solo se eligen nombres presentes en el esquema recibido de la base.
const HEADER_GROUPS = [
  ['Periodo'], ['Fecha'], ['Cod Lote', 'Cod_Lote'], ['Especie'],
  ['Línea Padre', 'Linea_Padre'], ['Línea Madre', 'Linea_Madre'],
  ['Variedad'], ['Muda'], ['Sexo'], ['Unid Prod', 'Unid_Prod'], ['Galpon'],
  ['Fecha Ing', 'Fecha_Ing'], ['Edad ingreso', 'Edad_ingreso', 'Edad_Ing'],
  ['Aves Ing (unid)', 'Aves_Ing'],
  ['N° Mortal Tr ansp. (unid)', 'Mortal_Transp', 'N_Mortal_Transp', 'Mortal_Transporte'],
  ['Fecha Cmb. Etap', 'Fecha_Cmb_Etap'],
  ['Aves Cmb. Etap(unid)', 'Aves_Cmb_Etap'],
  ['Etapa'], ['Etapa Co', 'Etapa_Co'],
  ['Edad (días)', 'Edad_dias'], ['Edad (sem)', 'Edad_sem'],
  ['Semana Calendario', 'Semana_Calendario'], ['Peso Ave (g)', 'Peso_Ave'],
  ['Mortal (unid)', 'Mortal'], ['Mortal Acum(unid)', 'Mortal_Acum'],
  ['Mortal. (%) Transf', 'Mortal_Porc_Transf', 'Mortal_Pct_Transf', 'Mortal_Porcentaje_Transf'],
  ['Mortal. (%) Transf Acum', 'Mortal_Porc_Transf_Acum', 'Mortal_Pct_Transf_Acum', 'Mortal_Porcentaje_Transf_Acum'],
  ['Desc (unid)', 'Desc_unid'], ['Desc (Kg)', 'Desc_Kg'],
  ['Desc Ac um(unid)', 'Desc_Acum', 'Desc_Acum_unid'],
  ['Descarte (%) Transf', 'Descarte_Porc_Transf', 'Descarte_Pct_Transf', 'Descarte_Porcentaje_Transf'],
  ['Descarte (%) Transf Acum', 'Descarte_Porc_Transf_Acum', 'Descarte_Pct_Transf_Acum', 'Descarte_Porcentaje_Transf_Acum'],
  ['Venta (unid)', 'Venta_unid'], ['Venta Ac um(unid)', 'Venta_Acum', 'Venta_Acum_unid'],
  ['Transf Ing.(unid)', 'Transf_Ing'], ['Transf. Acum Ing.(unid)', 'Transf_Acum_Ing'],
  ['Transf. Sal(unid)', 'Transf_Sal'], ['Transf Acum Sal(unid)', 'Transf_Acum_Sal'],
  ['Origen'], ['Destino'], ['Uniform (%)', 'Uniform', 'Uniform_Porc', 'Uniform_Pct'],
  ['Cons Alim(Kg)', 'Cons_Alim'], ['Tipo Alim', 'Tipo_Alim'],
  ['Cons Alim Ave (g/ave/d)', 'Cons_Alim_Ave'],
  ['Cons Alim Ave Acu (g/ave)', 'Cons_Alim_Ave_Acu', 'Cons_Alim_Ave_Acum'],
  ['Prod Hue vo(unid)', 'Prod_Huevo'],
  ['% Prod Huevo', 'Porc_Prod_Huevo', 'Pct_Prod_Huevo', 'Prod_Huevo_Porc', 'Prod_Huevo_Pct'],
  ['Prod HInc (unid)', 'Prod_HInc'], ['Prod HMer (und)', 'Prod_HMer'],
  ['Prod HInc (%)', 'Prod_HInc_Porc', 'Prod_HInc_Pct', 'Porc_Prod_HInc', 'Pct_Prod_HInc'],
  ['Prod HCom (unid)', 'Prod_HCom'], ['Huevos Inc.(Kg)', 'Huevos_Inc_Kg', 'Huevos_Inc'],
  ['Persisten cia (sem)', 'Persistencia'],
  ['HI x Gallina Encaset(unid)', 'HI_x_Gallina', 'HI_x_Gallina_Encaset'],
  ['Peso Ven tas (Kg)', 'Peso_Ventas'], ['Peso Ben eficio (Kg)', 'Peso_Beneficio'],
  ['Guía de Despacho Aves', 'Guia_de_Despacho_Aves', 'Guia_Despacho_Aves'],
  ['Guía de Despacho Huevos', 'Guia_de_Despacho_Huevos', 'Guia_Despacho_Huevos'],
  ['Saldo Ini (unid)', 'Saldo_Ini'], ['Saldo Final (unid)', 'Saldo_Final'],
  ['Fecha Liquidacion', 'Fecha_Liquidacion'], ['Estado Lote', 'Estado_Lote'],
  ['Edad Sem Prd', 'Edad_Sem_Prd'], ['Consumo Estandar', 'Consumo_Estandar'],
  ['Consumo Acu Estandar', 'Consumo_Acu_Estandar'], ['Peso Estandar', 'Peso_Estandar'],
  ['% Postur Estandar', 'Porc_Postur_Estandar', 'Pct_Postur_Estandar', 'Postur_Estandar'],
  ['% HI Estandar', 'Porc_HI_Estandar', 'Pct_HI_Estandar', 'HI_Estandar'],
  ['HT x Gallina Encaset (und)', 'HT_x_Gallina', 'HT_x_Gallina_Encaset'],
  ['Costo Alimento', 'Costo_Alimento'],
  ['Costo Alimento Por Ave Diario', 'Costo_Alimento_Ave_Diario', 'Costo_Alimento_Por_Ave_Diario'],
  ['Costo Alimento Por Ave Acum.', 'Costo_Alimento_Ave_Acum', 'Costo_Alimento_Por_Ave_Acum'],
  ['Val ido', 'Valido'], ['Còdigo de Registro', 'Codigo_de_Registro', 'Codigo_Registro'],
];

function key(value) {
  return value.replace(/<br\s*\/?\s*>/gi, '').replace(/&nbsp;|&#160;/gi, '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/%/g, 'pct').replace(/[^a-z0-9]/g, '');
}

export function createHeaderResolver(columns) {
  const exact = new Set(columns.map((column) => column.name));
  const matches = new Map();
  const add = (alias, name) => {
    const normalized = key(alias);
    if (!matches.has(normalized)) matches.set(normalized, new Set());
    matches.get(normalized).add(name);
  };
  for (const { name } of columns) add(name, name);
  for (const group of HEADER_GROUPS) {
    const keys = new Set(group.map(key));
    const targets = columns.filter(({ name }) => keys.has(key(name)));
    for (const alias of group) for (const { name } of targets) add(alias, name);
  }
  return (header) => {
    if (exact.has(header)) return { name: header };
    const candidates = [...(matches.get(key(header)) || [])];
    if (candidates.length === 1) return { name: candidates[0] };
    return { name: null, candidates };
  };
}
