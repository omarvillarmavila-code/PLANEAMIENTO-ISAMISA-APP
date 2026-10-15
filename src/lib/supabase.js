import { createClient } from "@supabase/supabase-js";

// Estas variables se leen desde .env.local. Nunca pongas aquí la service_role key.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Permite que la app arranque aunque todavía no se hayan configurado las variables.
const rawSupabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

// Compatibilidad durante la migración: las consultas antiguas se enrutan al esquema funcional.
const routes = {
  aves_por_lote_lumbra: ["lumbra", "aves_por_lote_lumbra"],
  resumen_especie_linea_lote_lumbra: [
    "lumbra",
    "resumen_especie_linea_lote_lumbra",
  ],
  resumen_prod_hinc_lumbra: ["lumbra", "resumen_prod_hinc_lumbra"],
  vista_saldos_por_lote: ["lumbra", "vista_saldos_por_lote"],
  aves_por_lote_reparticion: ["reparticion", "aves_por_lote_reparticion"],
  resumen_especie_linea_lote_reparticion: [
    "reparticion",
    "resumen_especie_linea_lote_reparticion",
  ],
  vista_saldos_por_lote_reparticion: [
    "reparticion",
    "vista_saldos_por_lote_reparticion",
  ],
  poblacion_por_linea_levante: ["lumbra", "poblacion_por_linea_levante"],
  poblacion_por_linea_postura: ["lumbra", "poblacion_por_linea_postura"],
  poblacion_por_linea_muda: ["lumbra", "poblacion_por_linea_muda"],
  poblacion_por_linea_reparticion_levante: [
    "reparticion",
    "poblacion_por_linea_levante",
  ],
  poblacion_por_linea_reparticion_postura: [
    "reparticion",
    "poblacion_por_linea_postura",
  ],
  poblacion_por_linea_reparticion_muda: [
    "reparticion",
    "poblacion_por_linea_muda",
  ],
};

export const supabase =
  rawSupabase &&
  new Proxy(rawSupabase, {
    get(target, property) {
      if (property === "from")
        return (name) => {
          const route = routes[name];
          return route
            ? target.schema(route[0]).from(route[1])
            : target.from(name);
        };
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
