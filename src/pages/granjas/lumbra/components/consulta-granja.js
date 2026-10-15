// Comparte solo consultas en curso; no conserva datos de cargas anteriores.
const pending = new Map();

export function sharedQuery(key, fetchRows, timeoutMs = 20000) {
  if (pending.has(key)) return pending.get(key);
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error('La consulta tardó demasiado. Vuelve a intentarlo.');
      error.code = 'CLIENT_TIMEOUT';
      reject(error);
      controller.abort();
    }, timeoutMs);
  });
  const request = Promise.race([Promise.resolve().then(() => fetchRows(controller.signal)), timeout])
    .finally(() => {
      clearTimeout(timer);
      if (pending.get(key) === request) pending.delete(key);
    });
  pending.set(key, request);
  return request;
}

export async function allPages(makeQuery, signal, pageSize = 500) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    signal.throwIfAborted();
    const { data, error } = await makeQuery().range(offset, offset + pageSize - 1).abortSignal(signal);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}

export function queryMessage(error) {
  if (error?.code === '57014') return 'Supabase canceló la consulta por tiempo de espera. Vuelve a intentarlo.';
  if (error?.code === 'CLIENT_TIMEOUT') return error.message;
  return 'No se pudieron cargar los datos. Comprueba la conexión y vuelve a intentarlo.';
}
