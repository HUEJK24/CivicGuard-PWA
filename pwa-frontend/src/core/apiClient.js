const configuredApiUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const apiBaseUrl = (
  configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:3000' : '')
).replace(/\/+$/, '');

export async function apiRequest(path, options) {
  if (!apiBaseUrl) {
    throw new Error('Configura VITE_API_BASE_URL con la URL pública de la API.');
  }

  const response = await fetch(`${apiBaseUrl}${path}`, options);
  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(`La API devolvió una respuesta inválida (HTTP ${response.status}).`);
  }

  if (!response.ok || !result?.ok) {
    throw new Error(result.error?.message ?? `Error HTTP ${response.status}`);
  }

  return result.data;
}

export default { apiBaseUrl, apiRequest };
