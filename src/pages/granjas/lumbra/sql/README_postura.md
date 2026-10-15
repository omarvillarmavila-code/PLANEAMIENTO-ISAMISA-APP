# Aplicar y comprobar la optimizacion de postura

Estos archivos se ejecutan manualmente en el SQL Editor del proyecto Supabase.
Guardar el archivo local no actualiza Supabase.

1. Guardar la definicion actual como respaldo, ejecutando:

   ```sql
   select pg_get_viewdef('lumbra.vista_postura_por_lote_y_semana'::regclass, true);
   ```

2. Ejecutar el contenido completo de `03_vista_postura_por_lote_y_semana.sql`.
   Usa `CREATE OR REPLACE VIEW`, sin eliminar la vista ni sus dependencias.
3. Abrir la vista en Table Editor y comprobar una semana conocida en la app.
   Para medir el tiempo real, ejecutar este bloque por separado:

   ```sql
   begin;
   set local statement_timeout = '20s';
   explain (analyze, buffers, summary)
   select * from lumbra.vista_postura_por_lote_y_semana limit 100;
   rollback;
   ```

   `EXPLAIN ANALYZE` ejecuta la consulta. Si se cancela por timeout y la
   sesion queda en una transaccion abortada, ejecutar `ROLLBACK;` por separado.
   Conservar el resultado completo o el error. Se espera una sola rama que
   lea `registro_diario_granja`. Un recorrido secuencial no es por si solo un
   error: comparar `Execution Time`, filas reales, estimaciones y buffers.
   Esta medicion no incluye otras consultas que pueda realizar Table Editor.

## Si sigue lenta

Revisar primero los indices de la tabla y su estado:

```sql
select ci.relname as indice, i.indisvalid, i.indisready,
       pg_get_indexdef(i.indexrelid) as definicion
from pg_index i
join pg_class ci on ci.oid = i.indexrelid
where i.indrelid = 'public.registro_diario_granja'::regclass;
```

Evaluar cualquier indice adicional segun las mediciones y los indices
existentes. Si la vista responde bien, no hace falta agregarlo.

## Alcance del cambio

- Una sola lectura de registros obtiene saldo, produccion y mortalidad.
  Agrupaciones y ventanas calculan los resultados de ambos sexos.
- `Prod_HInc`, de tipo numeric segun la definicion instalada, se suma
  directamente. Las columnas de texto conservan su conversion anterior.
- Linea y lote se agrupan despues de quitar espacios y aplicar los valores
  `SIN LINEA` / `SIN LOTE`. Si varias claves originales se vuelven iguales,
  ahora forman un solo grupo. Antes podian multiplicarse al unir poblacion
  y produccion. En esos casos los resultados cambian deliberadamente.
- Se conservan las 22 columnas anteriores, sus porcentajes semanales y etapa.
  Las ocho columnas de mortalidad acumulada se agregan al final (30 total).
- La edad usa el maximo numerico de los valores validos y conserva tipo texto.
  Esto evita que la edad 9 aparezca despues de la edad 10 en una misma semana.
- Los estandares de ambos sexos se buscan usando `cod_std` y la columna
  `edad` de la fila de postura. Duplicados por codigo, edad y sexo,
  o varios codigos por lote, requieren una revision de datos independiente.

## Columnas nuevas de mortalidad

| Columna | Calculo |
| --- | --- |
| `saldo_inicial_hembra` | Promedio de `Saldo_Ini` de hembras en su primera fecha disponible de la semana. |
| `saldo_inicial_macho` | Promedio de `Saldo_Ini` de machos en su primera fecha disponible de la semana. |
| `mortalidad_macho` | Suma semanal de `Mortal` de machos. |
| `mortalidad_hembra` | Suma semanal de `Mortal` de hembras. |
| `porcentaje_mortalidad_hembra` | Mortalidad de hembras / saldo inicial de hembras x 100, con dos decimales. |
| `porcentaje_mortalidad_macho` | Mortalidad de machos / saldo inicial de machos x 100, con dos decimales. |
| `porcentaje_mortalidad_std_sem_hembra` | `estandares_pollos.mort_sem` convertido a porcentaje, para codigo, edad y sexo HEMBRA. |
| `porcentaje_mortalidad_std_sem_macho` | `estandares_pollos.mort_sem` convertido a porcentaje, para codigo, edad y sexo MACHO. |

Los saldos iniciales y mortalidades se agrupan por ano, semana, lote, etapa y sexo,
dentro de Lumbra, en todas las etapas. Si un lote aparece en varias lineas, esas
medidas por lote se repiten en sus filas; no deben sumarse otra vez entre
lineas. La produccion conserva su agrupacion anterior por linea y lote.

Cada etapa y sexo pueden tener una primera fecha distinta. Si hay varios saldos ese
dia, se promedian todos los valores disponibles, sin promediar promedios.
Los saldos nulos o vacios se omiten del promedio; el cero si participa.
Si todos los saldos de esa fecha faltan, no se busca una fecha posterior.
Un saldo inicial nulo o cero produce un porcentaje de mortalidad NULL.
Sin registros de un sexo, su mortalidad es cero y su saldo inicial es NULL.
Un estandar ausente permanece NULL. `mort_sem = 0.005` se muestra como `0.5`.
La vista conserva las filas con registros de hembras de cualquier etapa; no agrega filas de lotes
que solo tienen machos.

## Validacion y restauracion

### Mortalidad acumulada en Detalle por lote

La curva real usa `registro_diario_granja.Mortal_Acum`, que ya contiene una
cantidad acumulada. No se suman los acumulados de diferentes dias ni se usa
el maximo historico: se toma la ultima fecha disponible de cada semana,
etapa y sexo. Una correccion puede reducir el valor y debe conservarse.
En esa fecha se suman los registros de poblacion del lote, contando una sola
vez los saldos/acumulados identicos de la misma fecha, linea, lote, etapa,
sexo, galpon y edad. Las filas `Valido=N` no aportan al acumulado ni a la base
de edad 1. Para registros antiguos sin marca se conserva su participacion.
Galpones diferentes conservan sus contribuciones aunque tengan las mismas
cantidades. Las medidas se repiten entre lineas y el componente no vuelve
a sumarlas. Esta correccion se aplica a las columnas acumuladas; no cambia
las formulas de produccion ni las columnas semanales anteriores.

Caso comprobado: en `24PI17`, semana 52 de 2025, los registros diarios de
390 muertes de hembras y 271 de machos tenian cuatro copias identicas.
Sumarlas producia 1560 y 1084, y luego una falsa caida al desaparecer las
copias. Con base 3044/557, los porcentajes correctos de ese cierre son
12.81 % y 48.65 %. Tambien habia filas de alimento `Valido=N` con el mismo
acumulado que la fila de poblacion.

La poblacion base es la suma de `Saldo_Ini` del primer dia registrado con
`Edad_sem = 1` para ese lote y sexo. Se conserva durante toda su vida,
sin reiniciarla al cambiar de etapa o de ano. No se promedian los saldos de
la semana ni se reemplaza una edad 1 ausente con una edad posterior.

| Columna agregada | Contenido |
| --- | --- |
| `poblacion_edad_1_hembra` | Poblacion inicial de hembras en la edad 1. |
| `poblacion_edad_1_macho` | Poblacion inicial de machos en la edad 1. |
| `mortalidad_acum_hembra` | Cantidad acumulada de muertes de hembras al cierre. |
| `mortalidad_acum_macho` | Cantidad acumulada de muertes de machos al cierre. |
| `porcentaje_mortalidad_acum_hembra` | Muertes acumuladas / poblacion de edad 1 de hembras x 100. |
| `porcentaje_mortalidad_acum_macho` | Muertes acumuladas / poblacion de edad 1 de machos x 100. |
| `porcentaje_mortalidad_std_acum_hembra` | Estandar acumulado de `mort_acum` para codigo, edad de cierre y sexo HEMBRA. |
| `porcentaje_mortalidad_std_acum_macho` | Estandar acumulado de `mort_acum` para codigo, edad de cierre y sexo MACHO. |

Si falta la poblacion de edad 1, es cero o negativa, el porcentaje real es
NULL. Si alguna fila de la fecha inicial tiene saldo ausente, la base queda
NULL. Si falta `Mortal_Acum` en alguna fila del cierre, el acumulado queda
NULL; no se inventa un cero ni se arrastra el dato de otro dia. Un cero
registrado explicitamente si se grafica. Los estandares ausentes tambien
permanecen NULL y no se reconstruyen sumando `mort_sem`.

`mort_acum` admite una proporcion o un porcentaje con simbolo:
`0.02` y `2%` se muestran como `2 %`, igual que la conversion de `mort_sem`.
En los datos de ISAMISA IMPORTADO del lote 24PI17, a edad 69, el valor
`0.179306440810877` corresponde a `17.9306440810877 %`. El componente recibe
ese porcentaje sin volver a multiplicarlo. El acumulado estandar se busca con el codigo
del lote y la edad del registro de cierre de cada sexo por separado.

### Escala de los estándares importados

Ejecutar completo `03_vista_postura_por_lote_y_semana.sql` en Supabase y
recargar la aplicación. El archivo crea `lumbra.estandar_a_porcentaje(text)`
y actualiza la vista sin borrar datos ni cambiar las fórmulas reales.
Se aplica a `prod_hinc`, `prod_hcom`, `mort_sem` y `mort_acum`:

- Sin símbolo, el número es una proporción: `0.85` → `85`, `0.005` → `0.5`.
- Con `%`, ya es un porcentaje: `85%` → `85`, `2.36%` → `2.36`.
- Admite punto o coma decimal y espacios alrededor del valor/símbolo.
- Un vacío, guion o texto inválido produce NULL, nunca un cero inventado.
- No se adivina la escala según el tamaño: `0.5` → `50`, `0.5%` → `0.5`.

La muestra BARRADO F1 tenía `2.36%` en la semana 1. La limpieza anterior
eliminaba `%` y multiplicaba por 100, produciendo `236`. Ahora se conserva
`2.36`. La aplicación agrega el símbolo al mostrar el valor, sin otra conversión.

El componente solo grafica los porcentajes de la vista. Hasta ejecutar
el SQL actualizado en Supabase muestra que el acumulado no esta disponible,
sin presentar los porcentajes semanales como si fueran acumulados.

Pruebas locales adicionales:

```powershell
node 'src/pages/granjas/lumbra/tests/mortalidad-acumulada.test.mjs'
# CSV_PGLITE_MODULE debe apuntar al modulo index.js de PGlite instalado.
node 'src/pages/granjas/lumbra/tests/mortalidad-acumulada-sql.test.mjs'
node 'src/pages/granjas/lumbra/tests/historial-lote-sql.test.mjs'
```

### Comprobaciones de compatibilidad

La ampliacion se probo con PostgreSQL local (PGlite) y datos de ejemplo:
compatibilidad de las 13 columnas anteriores y vistas dependientes,
promedios con varias filas en la primera fecha, separacion por sexo/ano/semana,
lotes en varias lineas, porcentajes, estandares, nulos y saldos cero.
El plan de prueba conserva una sola lectura de `registro_diario_granja`.
El rendimiento con los datos reales debe medirse en Supabase.

Si se restaura un respaldo de 13 columnas despues de aplicar esta ampliacion,
`CREATE OR REPLACE VIEW` no permite quitar las ocho columnas agregadas.
Para conservar dependencias, la consulta restaurada debe mantener tambien
esas columnas al final, con sus nombres y tipo numeric (por ejemplo, usando
NULL::numeric para cada una mientras se restaura la logica anterior).

## Historial desde el inicio de vida

El SQL 03 elimina el filtro de etapa POSTURA. Cada etapa conserva su propia
fila por ano/semana/linea/lote. LEVANTE y POSTURA en la misma semana tienen
saldos, primera fecha por sexo, produccion y mortalidad independientes.
La columna `etapa` contiene una sola etapa; no concatena ni suma etapas.
Las graficas de mortalidad del detalle conservan esos puntos separados y
muestran la etapa en el tooltip. Las graficas de huevo incubable y comercial
solo incluyen POSTURA - POLLO, tanto en las curvas como en el eje.
El cambio afecta a todos los componentes que consultan esta vista.

Detalle por lote consulta un lote seleccionado, sin restriccion de ano.
Las graficas incluyen anos anteriores y comparten las consultas en curso.
La primera edad disponible se muestra tal como esta registrada; si faltan
registros desde edad 1, se indica en la grafica sin inventar valores.
Para activar las etapas anteriores en Supabase, ejecutar completo el SQL 03
actualizado. Guardar los cambios locales no modifica la base remota.
