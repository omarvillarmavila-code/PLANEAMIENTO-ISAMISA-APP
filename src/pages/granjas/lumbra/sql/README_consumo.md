# Consumo semanal de alimento de Lumbra

## Corrección de registros repetidos — 11 de septiembre de 2026

En `24PI17`, desde el 1 de enero de 2025, cada registro diario aparecía
cuatro veces con los mismos datos y diferente `id` o `created_at`. La vista
sumaba las cuatro copias, inflando el consumo de hembras y machos.

El SQL 04 cuenta una sola vez cada registro de negocio idéntico mediante
`SELECT DISTINCT` sobre sus datos, excluyendo únicamente `id` y `created_at`
de la comparación. Conserva registros distintos en cualquier otro campo,
incluidos fecha, sexo, galpón, tipo de alimento y cantidad. No usa
`SUM(DISTINCT Cons_Alim)`, porque una misma cantidad puede consumirse en
varios días o alojamientos. Las filas `Valido=N` se conservan: pueden
corresponder a alimento adicional realmente suministrado.

Validación local con los 3.642 registros reales del lote: 1.452 registros
distintos, 104 semanas y 53 semanas con consumo corregido.

| Edad | Hembras antes → después (kg) | Machos antes → después (kg) |
| --- | --- | --- |
| 17 | 1351 → 1351 | 357 → 357 |
| 18 | 3799 → 1384 | 993 → 363 |
| 19 | 5712 → 1428 | 1484 → 371 |

Se comprobaron ambos totales, sus desgloses por alimento, las cantidades
iguales legítimas, los nulos y la compatibilidad de las columnas existentes.
Esta corrección requiere ejecutar el SQL 04 completo en Supabase. No borra
ni modifica registros de la tabla original. Beneficia a los gráficos de
Detalle por lote y a los demás componentes que consultan esta vista.

## Revisión de carga del 6 de septiembre de 2026

Las consultas de lectura a la API del proyecto reprodujeron estos resultados:

- Semanas disponibles: una consulta devolvió `57014` (timeout) a los 4,5 s;
  otra consulta completa respondió con 401 períodos en 0,9 s.
- Consumo de 2026, semana 25: `57014` a los 4,1 s.
- Consumo anual del lote 25PO03: respondió con 34 filas en 3,1 s.

Son mediciones puntuales con la clave pública de la aplicación; no demuestran
por sí solas el plan ni la carga del servidor. No se modificó la base remota.
El frontend ignoraba el error de períodos y los gráficos por sexo repetían
la misma petición sin protegerse de respuestas atrasadas. Ahora comparten
las peticiones en curso, cargan todas las páginas, descartan respuestas de
filtros anteriores y muestran errores con un botón para reintentar. El límite
de espera del cliente es de 20 segundos y no aumenta el límite de Supabase.

El SQL 04 ahora agrupa saldos y consumos en una sola cadena y combina ambos
sexos antes de unirlos a población, permitiendo aplicar año/semana antes de
agrupar el historial. Añade índices de calendario y unidad/fecha del registro.
La motivación se describe en la documentación de
[optimización de WITH de PostgreSQL](https://www.postgresql.org/docs/17/queries-with.html#QUERIES-WITH-CTE-MATERIALIZATION).
No cambia las fórmulas ni las columnas. Una comparación local con 24.000
registros adicionales dio 338 ms antes y 15 ms después, con los índices
presentes en ambas mediciones y resultados iguales. No es una medición del
rendimiento de Supabase.

**Pendiente:** ejecutar completo el SQL 04 actualizado en Supabase y comprobar
la semana que fallaba. Para diagnosticar si continúa el timeout de períodos,
obtener su definición y el plan con estas consultas de solo lectura en SQL Editor:

```sql
select pg_get_viewdef('public.periodos_disponibles_granja'::regclass, true);
explain (analyze, buffers)
select granja, ano, semana, fecha_inicio_semana, fecha_maxima
from public.periodos_disponibles_granja where granja = 'LUMBRA'
order by ano, semana;
explain (analyze, buffers)
select * from lumbra.vista_consumo_por_lote_semanal
where ano = 2026 and semana = 25 order by semana, linea, lote limit 500;
```

Ejecutar completo `04_vista_Consumo_por_lote_semanal.sql` en el SQL Editor de
Supabase. Crea `lumbra.vista_consumo_por_lote_semanal`. Guardar el archivo en
el proyecto no lo ejecuta en Supabase. Requiere la vista de población existente.

La app muestra dos gráficos en **Lumbra → Datos generales**, debajo de
mortalidad, con filtros de año y semana: hembras y machos. En esta pestaña
compara **g/ave/día**: consumo real registrado en kg × 1000 / **suma de los
saldos iniciales diarios** del sexo. El denominador suma la población de los
días registrados y refleja sus cambios. Por ejemplo, 18 kg consumidos en
dos días con 100 y 80 aves dan `18000 / 180 = 100 g/ave/día`.
No divide nuevamente por siete ni por el número de días.
El estándar usa directamente `consumo_std_g_ave_dia_hembra/macho` y
`alimentos_std_hembra/macho.g_ave_dia`, sin reconvertir sus kg. Si los saldos
diarios están incompletos o su suma no es positiva, el real queda sin dato; el
estándar diario puede seguir disponible. Títulos, ejes y tooltips usan la
misma unidad. **Ejecutar de nuevo el SQL 04 completo** para añadir
`suma_saldos_diarios_hembra/macho` y `dias_registrados_hembra/macho` a la vista.
La aplicación no sustituye estas columnas ausentes por el cálculo anterior.

La pestaña **Consumo de alimento** conserva la comparación en kg semanales.
En ambas pestañas los alimentos reales forman segmentos de una barra
apilada; la barra paralela representa el total estándar en la misma unidad.
Cada alimento tiene un color compartido entre hembras y machos; su estándar
usa ese color aclarado. Alimentos reales y esperados diferentes usan colores
base distintos. La leyenda muestra solo los alimentos reales; los estándares
se identifican en los tooltips.
Los ejes se ajustan a ambos totales, incluidos ajustes negativos. Los tooltips
detallan alimento consumido, alimento esperado, totales y edad. En Datos
generales muestran también la suma de saldos diarios y los días registrados;
en Consumo de alimento conservan el saldo inicial y los kg semanales.

## Datos y cálculos

En **Detalles por lote**, cada sexo tiene un gráfico semanal de barras
apiladas por alimento y una línea gris de estándar semanal por delante de
las barras. Ambas series usan el mismo eje en kg. Se conservan la edad,
semana, año, fondo por etapa y desglose del tooltip. Los colores de alimento
son comunes entre hembras y machos; un estándar ausente deja un hueco en la
línea. Este cambio de presentación no requiere ejecutar SQL adicional.

- Conserva exactamente las nueve columnas y las filas de
  `vista_poblacion_por_lote_y_semana`. Incluye todas sus etapas.
- `Cons_Alim` contiene **kg diarios del lote** y `Tipo_Alim` identifica el
  alimento. Suma por año, semana, línea, lote, sexo y alimento después de
  contar una sola vez las copias idénticas de cada registro diario.
- Para el promedio real en g/ave/día se cuenta una población por fecha,
  línea, lote, sexo, galpón y etapa. Varios alimentos con el mismo saldo no la
  multiplican. Galpones distintos aportan por separado, aunque tengan la
  misma cantidad de aves. Etapas simultáneas dentro del mismo galpón también
  aportan poblaciones separadas. Las filas `Valido=N` aportan su alimento pero no
  su saldo; una marca vacía se trata como registro de población.
  Saldos nulos, negativos o distintos para un mismo galpón/etapa/día dejan la base
  sin dato. El cero es válido, aunque una suma semanal cero impide dividir.
  Días sin ningún registro no se inventan; si existe consumo sin su saldo
  diario, no se calcula una tasa parcial como si fuera completa.
  Todos los alimentos del lote y sexo se dividen por el mismo denominador.
- Los saldos usados para el **estándar en kg semanales** son los **saldos iniciales
  de la primera fecha disponible de la semana por lote/línea/sexo**. Se promedian
  los saldos de los registros distintos disponibles de esa fecha, incluidos
  registros de varios alimentos; no se suman. Los nulos se omiten del promedio,
  pero el cero participa. Si todos los saldos de esa primera fecha faltan,
  permanece sin dato; no se busca una fecha posterior.
- Las nueve columnas originales de población se conservan por compatibilidad;
  sus saldos finales no se usan para calcular el consumo estándar.
- `cons_aabb` contiene **gramos por ave por día**. El estándar semanal del lote
  se convierte con **g/ave/día × saldo inicial del sexo × 7 / 1000**. Tanto las
  barras reales como la barra estándar están en kg semanales. Un saldo inicial
  ausente deja sin dato los kg esperados, aunque se conserva el estándar diario.
- Busca el estándar por `codigo_estandar`, `edad_sem` y `sexo`. Usa el código
  del lote de `Resumen Lotes Cod STD` y la misma `edad_lote` que población.
  Si la edad cambia durante la semana, se utiliza esa edad semanal, no se
  suman estándares correspondientes a varias edades.
- `tipo_aabb` determina el alimento esperado, aunque sea distinto al realmente
  suministrado. Si hay varios alimentos estándar para esa clave, cada cantidad
  corresponde a su alimento y se apilan para formar la barra estándar.
- El estándar corresponde a una semana completa incluso si el consumo real
  contiene menos días. No se aplica prorrateo automático.
- Una fila por lote/línea/semana; los arrays JSON evitan multiplicar población
  o consumos al combinar distintos alimentos de hembras y machos.

## Columnas añadidas

| Columnas | Contenido |
| --- | --- |
| `cod_std` | Código del lote. |
| `consumo_kg_hembra`, `consumo_kg_macho` | Consumo real semanal por sexo. |
| `alimentos_hembra`, `alimentos_macho` | Arrays de `{alimento, kg}` con el consumo real por alimento. |
| `consumo_std_kg_hembra`, `consumo_std_kg_macho` | Total estándar semanal por sexo. |
| `alimentos_std_hembra`, `alimentos_std_macho` | Arrays de `{alimento, g_ave_dia, kg}` con los alimentos esperados. |
| `saldo_inicial_hembra`, `saldo_inicial_macho` | Promedio del saldo inicial de la primera fecha semanal por sexo. |
| `consumo_std_g_ave_dia_hembra`, `consumo_std_g_ave_dia_macho` | Estándar diario por ave, antes de convertirlo a kg semanales del lote. |
| `suma_saldos_diarios_hembra`, `suma_saldos_diarios_macho` | Suma de poblaciones iniciales diarias, una por galpón/etapa/día. Denominador del consumo real en g/ave/día. |
| `dias_registrados_hembra`, `dias_registrados_macho` | Fechas distintas con registros de cada sexo en esa semana. Dato informativo: no se vuelve a dividir por esta cantidad. |

Los nombres de alimento se normalizan con espacios exteriores retirados y
mayúsculas. Cantidades numéricas o texto con decimal punto y miles con coma
(`1234.50`, `1,234.50`) se admiten. Texto vacío o mal formado queda sin dato;
se conserva el cero y el signo negativo. Si falta alguna cantidad de un
alimento, su total y el total del sexo quedan sin dato para evitar presentar
una suma parcial como completa. Una ausencia de estándar tampoco se muestra
como cero.

Los duplicados idénticos de un estándar no se suman repetidamente. Cantidades
contradictorias para el mismo código/edad/sexo/alimento dejan su importe sin
dato. Un lote con varios códigos distintos queda sin estándar hasta resolver
la asignación. No se modifica ninguna de las tablas origen.

La vista consulta la población existente y agrega el consumo por separado.
Caso comprobado: `26PC21`, machos, semana 38/2026 (20–26 de septiembre),
tiene poblaciones simultáneas de Levante y Postura en `S.E.`. Aportan 2072 y
1464 aves-día, respectivamente. Sus 455 kg (280 LPO3 + 175 PPOMA) dan
`455000 / 3536 = 128.68 g/ave/día`, frente a 140 de estándar. Agrupar sin
etapa trataba esas poblaciones como saldos contradictorios y ocultaba el real.
El rendimiento con el volumen real debe comprobarse en Supabase; las pruebas
locales verifican resultados y ejecución, no el rendimiento del servidor real.

## Verificación local

Desde `granjas`:

```powershell
node 'lumbra/tests/consumo-por-lote.test.mjs'
# CSV_PGLITE_MODULE apunta al dist/index.js de una instalación temporal de PGlite.
node 'lumbra/tests/consumo-sql.test.mjs'
```

La prueba SQL crea una base aislada, ejecuta las vistas reales y comprueba
población, alimentos, sexos, períodos, etapas, estándares semanales, nulos,
negativos y duplicados. No se conecta al Supabase del proyecto.
