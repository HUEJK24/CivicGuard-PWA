/**
 * Cliente HTTP del frontend.
 *
 * En Vercel no existe el proxy `/api/*`: la PWA debe hablar directamente con
 * Render. El valor de `vercel.json` tiene prioridad; este archivo conserva un
 * fallback de producción para builds que no inyecten la variable.
 */

const PRODUCTION_API_URL = 'https://civicguard-pwa.onrender.com';
const REQUEST_TIMEOUT_MS = 12_000;

const configuredApiUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const apiBaseUrl = (
  configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:3000' : PRODUCTION_API_URL)
).replace(/\/+$/, '');

function friendlyMessage(path, error) {
  if (error.name === 'AbortError') {
    return 'El servidor tardó demasiado en responder. Inténtalo de nuevo.';
  }
  if (error instanceof TypeError) {
    return 'No pudimos conectar con el servidor. Revisa tu conexión.';
  }
  if (path === '/api/vapid-public-key' && error.code === 'PUSH_NOT_CONFIGURED') {
    return 'Los avisos aún no están listos en el servidor. Puedes seguir reportando sin problema.';
  }
  return error.message || 'Ocurrió un problema. Inténtalo de nuevo.';
}

export async function apiRequest(path, options = {}) {
  if (!apiBaseUrl) {
    throw new Error('Falta la URL de la API. Configura VITE_API_BASE_URL.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      signal: options.signal ?? controller.signal,
    });

    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error(`El servidor devolvió una respuesta inesperada (HTTP ${response.status}).`);
    }

    if (!response.ok || !result?.ok) {
      const error = new Error(
        result?.error?.message ?? `El servidor respondió con el estado ${response.status}.`,
      );
      error.code = result?.error?.code ?? null;
      error.status = response.status;
      throw error;
    }

    return result.data;
  } catch (error) {
    console.error('[CivicGuard API] Falló una solicitud.', {
      url: `${apiBaseUrl}${path}`,
      browserOnline: navigator.onLine,
      status: error.status ?? null,
      code: error.code ?? null,
      reason: error.message,
    });
    const message = friendlyMessage(path, error);
    const wrapped = new Error(message, { cause: error });
    wrapped.code = error.code ?? null;
    wrapped.status = error.status ?? null;
    throw wrapped;
  } finally {
    clearTimeout(timeoutId);
  }
}

export default { apiBaseUrl, apiRequest };
