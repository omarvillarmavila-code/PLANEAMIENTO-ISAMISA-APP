# Carga de CSV Granja

El componente `01 Carga de CSV Granja.jsx` aparece en **Granjas Aves**, encima
de las tablas. Al terminar una importación, ambas tablas se actualizan.

## Activación en Supabase (una vez)

Ejecutar **todo** `sql/configurar_carga_csv_granja.sql` en el SQL Editor del
proyecto, con el propietario de la base. Después, recargar la app.

El SQL crea cinco funciones públicas y dos tablas auxiliares en
`csv_granja_interno`. Ese schema debe permanecer **fuera de los schemas
expuestos por la Data API**. Las funciones son `SECURITY INVOKER`, requieren
sesión y respetan los permisos, RLS, restricciones y triggers existentes de
`public.registro_diario_granja`. El SQL no concede nuevos permisos sobre la
tabla de registros ni modifica sus políticas.

La cuenta que importe necesita los permisos de INSERT y las políticas RLS
correspondientes a sus registros; también acceso a las secuencias si los
defaults de la tabla lo requieren. Si esos permisos no existen, debe
configurarlos el administrador según los roles reales del proyecto.
No se usa ninguna clave `service_role` en el navegador.

## Uso

### Compatibilidad con el reporte original

El esquema compartido contiene 73 campos del reporte, además de `id` y
`created_at`. Para conservar también **Código de Registro**, ejecutar
`sql/agregar_codigo_registro.sql` en Supabase y recargar la app antes de
validar el CSV. Agrega `Codigo_Registro` como texto, sin reemplazar registros
existentes; los anteriores quedan con NULL en ese campo. Si aún no existe
esta columna, la validación bloquea el archivo completo para no perder el código.

Los encabezados de huevos en kilos, HI/HT por gallina y costos por ave
apuntan a `Huevos_Inc_Kg`, `HI_x_Gallina`, `HT_x_Gallina`,
`Costo_Alimento_Ave_Diario` y `Costo_Alimento_Ave_Acum`, respectivamente.
Los tipos se respetan: `Fecha` se envía como fecha ISO y `Prod_HInc` como
texto numérico exacto; las otras fechas almacenadas como texto conservan
su formato original.

### Carga del archivo

1. Exportar el reporte como CSV conservando sus encabezados originales.
   También se aceptan los nombres de columna de la tabla.
2. Arrastrar un CSV a la zona de carga o seleccionarlo con el botón; se acepta
   un archivo a la vez y se bloquean cambios mientras se valida o importa.
   La validación detecta la codificación UTF-8 o Windows-1252, el formato
   numérico y el separador de columnas (coma, punto y coma o tabulación).
   Límite: 20 MB / 100 000 filas.
3. Validar el archivo completo. El procesamiento ocurre en un Web Worker.
4. Revisar las tarjetas de indicadores y el reporte del panel derecho;
   corregir los errores indicados por línea y columna. Se muestran hasta 20 detalles.
   Las tarjetas aparecen desde el inicio con «—» hasta obtener una validación.
5. Al terminar la validación, «Validar archivo» se sustituye por «Confirmar e
   importar» y «Cancelar». La importación se habilita únicamente sin errores y
   con permisos. «Cancelar» limpia el archivo seleccionado y los resultados;
   las tarjetas permanecen visibles. Ambos botones se bloquean durante la importación.
   Pulsar «Confirmar e importar» guarda los registros sin una casilla adicional.
   El archivo se prepara en bloques de 250 registros;
   solo al final se inserta en la tabla de registros, en una transacción.

## Reglas de datos

- Fechas `DD/MM/AAAA`, `DD/MM/AA` o `AAAA-MM-DD`, comprobando que existan.
  Los años de dos dígitos corresponden a 2000–2099. Se envían ISO.
- Vacíos opcionales se convierten en NULL, nunca en cero automáticamente.
- Identidades, columnas generadas y secuencias automáticas se omiten.
- Una columna con default, no esencial y completamente vacía se omite para
  aplicar su default. Si contiene algunos valores y otros vacíos, se valida
  cada fila: no se inventa un default diferente por fila.
- Los encabezados del reporte se traducen a los nombres presentes en el
  esquema real mediante `csv-granja-headers.js`. Se toleran tildes, mayúsculas,
  espacios, saltos de línea, `<br>` y palabras partidas. Las unidades y los
  porcentajes se distinguen con equivalencias explícitas (por ejemplo,
  `Prod HInc (unid)` y `Prod HInc (%)` no son el mismo campo).
  Se bloquean columnas desconocidas, ambiguas y dos encabezados que apunten
  al mismo destino; nunca se asignan campos por posición.
- `Fecha`, `Unid_Prod`, `Cod_Lote`, `Sexo` y `Etapa` son obligatorios, además
  de los requeridos por la estructura real sin default.
- Enteros int2/int4/int8 con rangos exactos; bigint/numeric se envían como
  texto numérico, evitando pérdida de precisión en JavaScript. No se redondean
  valores que excedan la precisión/escala de un numeric restringido.
- Se validan números también en los campos de texto de saldo, mortalidad,
  edad, producción, transferencias, venta y descarte conocidos por la app.
- El formato numérico se detecta a partir de las columnas numéricas del
  archivo. Si no hay decimales explícitos, las columnas enteras y los saldos
  de aves (`Saldo_Ini`, `Saldo_Final`) permiten reconocer miles: `1,077` se
  convierte en `1077`. Los saldos requieren cantidades enteras incluso si
  están almacenados como texto. Los formatos mezclados o valores ambiguos en
  otros campos sin evidencia suficiente bloquean la carga y se incluyen en el reporte.
  En ese caso, exportar con un formato uniforme y sin separadores de miles.
- Sexo: HEMBRA o MACHO. Se limpian espacios y se normalizan sexo, granja,
  etapa y Valido a mayúsculas, con REPARTICIÓN como nombre canónico.
- Los valores negativos se conservan en todos los campos sin generar observaciones
  por su signo. Se advierte sobre granjas fuera del menú y filas idénticas;
  no se eliminan filas automáticamente.
- Las validaciones de PostgreSQL se repiten al preparar los bloques. Las
  restricciones, triggers y RLS se comprueban al insertar: un fallo revierte
  todos los registros de esa carga, conservando los bloques para diagnóstico.

## Reintentos

Una huella del contenido normalizado identifica la carga **por usuario**.
Reenviar el mismo archivo con la misma cuenta reutiliza sus bloques y una
carga completada no vuelve a insertarse, incluso si se perdió la respuesta
de la confirmación. Cambiar el nombre del archivo no crea otra carga.
La huella incluye el orden de las filas y las columnas importadas.

Se puede pausar entre bloques o volver a seleccionar el mismo archivo tras
recargar la página. Una carga parcialmente preparada todavía no modifica la
tabla de registros.

La detección de una carga repetida **no sustituye una clave única de negocio**:
archivos distintos que se solapen, filas reordenadas o cargas realizadas por
otra cuenta pueden repetir registros. No se deduplica por fecha+lote+sexo,
porque pueden existir varios registros legítimos para esa combinación.
Antes de introducir deduplicación entre archivos hay que definir la clave
real del registro con el usuario.

Los bloques pendientes conservan los datos en el schema auxiliar. Se eliminan
automáticamente al completar la carga; las cargas abandonadas requieren una
política de limpieza administrativa si se acumulan. Los registros existentes
nunca se borran ni reemplazan desde este componente.

## Verificación

Desde la carpeta `granjas`:

```powershell
node 'Componentes Tools/tests/csv-granja.test.mjs'
node 'Componentes Tools/tests/report-headers.test.mjs'
```

Para la prueba SQL, instalar `@electric-sql/pglite` en una carpeta temporal
y configurar `CSV_PGLITE_MODULE` con la ruta a su `dist/index.js`:

```powershell
node 'Componentes Tools/tests/carga-sql.test.mjs'
```

La prueba SQL crea una base local aislada; no conecta con Supabase. Comprueba
una carga de 22 500 filas, reintentos, tipos, restricciones, transacciones,
RLS y separación de usuarios. También se verifica la compilación de Vite.
La activación del SQL y la prueba con datos reales en Supabase quedan a cargo
del administrador del proyecto.
