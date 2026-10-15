import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Metodo no permitido' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL')!, anon = Deno.env.get('SUPABASE_ANON_KEY')!, service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authorization = request.headers.get('Authorization') ?? '';
    const actor = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: identity, error: authError } = await actor.auth.getUser();
    if (authError || !identity.user) return json({ error: 'Sesion invalida' }, 401);
    const { data: isAdmin, error: permissionError } = await actor.rpc('app_is_admin');
    if (permissionError || isAdmin !== true) return json({ error: 'Solo administradores' }, 403);
    const body = await request.json();
    if (body.action !== 'create') return json({ error: 'Accion no permitida' }, 400);
    const email = String(body.email ?? '').trim();
    const password = String(body.password ?? '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10 || password.length > 256) return json({ error: 'Correo valido y contrasena de al menos 10 caracteres requeridos' }, 400);
    if (typeof body.active !== 'boolean' || typeof body.is_admin !== 'boolean' || !body.permissions || typeof body.permissions !== 'object' || Array.isArray(body.permissions)) return json({ error: 'Permisos invalidos' }, 400);
    const server = createClient(url, service, { auth: { persistSession: false } });
    const { data: created, error: createError } = await server.auth.admin.createUser({ email, password, email_confirm: true,
      user_metadata: { display_name: String(body.display_name ?? '').trim().slice(0,160) } });
    if (createError || !created.user) return json({ error: createError?.message ?? 'No se pudo crear el usuario' }, 400);
    const { error: saveError } = await actor.rpc('app_admin_save_user', { target_id: created.user.id, new_name: String(body.display_name ?? ''),
      new_active: body.active, new_admin: body.is_admin, new_permissions: body.permissions });
    if (saveError) {
      const { error: rollback } = await server.auth.admin.deleteUser(created.user.id);
      return json({ error: rollback ? 'Cuenta creada sin permisos de modulos. Revisa la cuenta en Administracion antes de reintentar.' : saveError.message }, 400);
    }
    return json({ id: created.user.id });
  } catch {
    return json({ error: 'No se pudo procesar la solicitud' }, 500);
  }
});
