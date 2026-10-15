export async function functionErrorMessage(issue) {
  const response = issue?.context;
  if (typeof response?.clone === 'function') {
    const status = response.status;
    let detail = '';
    try {
      const body = await response.clone().json();
      detail = body.error || body.message || body.msg || '';
    } catch { /* El servidor puede devolver una respuesta sin JSON. */ }
    if (detail) return `No se pudo crear el usuario (${status}): ${detail}`;
    if (status === 404) return 'No se encontró la función admin-users en este proyecto de Supabase (404).';
    if (status === 401) return 'La función rechazó la sesión (401). Cierra sesión y vuelve a ingresar; si persiste, revisa la verificación JWT de admin-users.';
    return `No se pudo crear el usuario. La función respondió HTTP ${status}. Revisa sus registros en Supabase.`;
  }
  return `No se pudo conectar con admin-users. Revisa el despliegue y los registros de la función. ${issue?.message || ''}`.trim();
}
