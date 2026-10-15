# Activar Administración

El código de la pantalla está integrado. La base y la función de creación de
cuentas deben instalarse en el mismo proyecto Supabase de `.env.local`.

## Pasos

1. Ejecutar en SQL Editor como `postgres`:
   `migrations/202610150001_administracion.sql`.
2. En `activar_administrador.sql`, reemplazar `CAMBIA_POR_TU_CORREO` por el correo
   de un usuario ya registrado y ejecutar el archivo. Esto designa al primer
   administrador; ningún usuario puede asignarse ese rol desde el navegador.
3. Ejecutar `migrations/202610150002_permisos_datos.sql`. Impone controles por
   módulo en las tablas existentes y hace que sus vistas respeten RLS.
4. Desplegar la Edge Function `admin-users`. Desde una CLI autenticada y enlazada
   al proyecto: `supabase functions deploy admin-users`. También puede crearse
   desde el panel de Edge Functions pegando `functions/admin-users/index.ts`.
   La función usa los secretos de servidor `SUPABASE_URL`,
   `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` que proporciona Supabase.
   Nunca colocar la clave de servicio en variables `VITE_*` ni en el frontend.
5. Recargar la web e iniciar sesión con el administrador. Abrir Administración.

Editar usuarios existentes y sus permisos requiere las migraciones; crear
cuentas nuevas requiere además la Edge Function. El editor permite cambiar
nombre, acceso activo, rol administrador y permisos. El correo identifica la
cuenta existente y no se modifica desde este editor. No se envían invitaciones
ni correos automáticamente: el administrador establece la contraseña inicial
al crear una cuenta.

## Comportamiento

- Niveles por módulo: sin acceso, lectura y edición.
- El administrador general puede gestionar todos los módulos y usuarios.
- Desactivar acceso lo bloquea en las políticas de datos incluso con un JWT
  emitido anteriormente. La actualización visual ocurre al volver a la ventana
  o, como máximo, en la siguiente consulta de permisos cada 60 segundos.
- Un usuario nuevo recibe solo Inicio hasta que el administrador lo configure.
  Los usuarios existentes reciben lectura al instalar por primera vez; ejecutar
  otra vez la migración no restaura permisos retirados.
- El módulo Granjas y carga de registros da acceso al registro general completo.
  Para restringir a una granja específica, dejar ese módulo sin acceso y otorgar
  exclusivamente la granja correspondiente. Edición en Granjas habilita la carga
  CSV y edición del registro general; los demás módulos habilitan edición de sus
  recursos existentes. Los informes sin formularios continúan siendo informes.
- El maestro de lotes es compartido por granjas; se consulta desde todas las
  granjas y su edición requiere permiso de edición en Lumbra.
- No es posible retirar el rol ni desactivar al propio administrador desde su
  sesión. Los cambios se registran en `app_access_audit`, sin contraseñas.
- Antes de instalar el backend, el módulo muestra Activación inicial pendiente;
  el acceso anterior de lectura se conserva y los controles de edición quedan
  deshabilitados. No se presentan permisos como activos antes de instalar SQL.

## Verificación local

`node src/security/modules.test.mjs`

`node outputs/sql_validation_asia/verificar_administracion.mjs`

La verificación SQL usa PGlite y usuarios ficticios. Comprueba bloqueo de edición
en lectura, aislamiento por granja, vistas anidadas, desactivación, rechazo del
autoescalado de permisos y migraciones repetibles. No sustituye probar la Edge
Function desplegada con una sesión real: requiere el proyecto remoto.
