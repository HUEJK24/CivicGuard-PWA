const configuredApiUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const apiBaseUrl = (
  configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:3000' : '')
).replace(/\/+$/, '');

export async function apiRequest(path, options) {
  if (!apiBaseUrl) {
    throw new Error('Configura VITE_API_BASE_URL con la URL pública de la API.');
  }

  let response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, options);
  } catch (error) {
    const hint = globalThis.navigator?.onLine
      ? 'Revisa la URL de la API y ALLOWED_ORIGINS/CORS en Render.'
      : 'El navegador informa que no hay conexión a internet.';
    throw new Error(
      `No se pudo contactar ${apiBaseUrl}${path}: ${error.message}. ${hint}`,
      { cause: error },
    );
  }

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(
      `${apiBaseUrl}${path} devolvió una respuesta que no es JSON (HTTP ${response.status}).`,
    );
  }

  if (!response.ok || !result?.ok) {
    const code = result?.error?.code ? ` ${result.error.code}` : '';
    const message = result?.error?.message ?? 'La API rechazó la solicitud.';
    throw new Error(`${path} respondió HTTP ${response.status}${code}: ${message}`);
  }

  return result.data;
}

export default { apiBaseUrl, apiRequest };
