/**
 * Contexto seguro (window.isSecureContext).
 *
 * Requisito del PDF: GPS, cámara, Service Worker y Push solo funcionan en un
 * contexto seguro: HTTPS o http://localhost. Al probar desde el celular por la
 * IP de la LAN (http://192.168.x.x) el navegador bloquea esas APIs; para eso se
 * usa ngrok (HTTPS).
 */
export function isSecureContextAvailable() {
  return globalThis.isSecureContext === true;
}

/** Motivo por el que el contexto no es seguro (para mostrar en consola). */
export function insecureContextReason() {
  const { protocol, hostname } = globalThis.location;
  if (protocol === 'https:') return null;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return null;
  return `${protocol}//${hostname} no es un contexto seguro: usa HTTPS (ngrok) o localhost.`;
}

/** Registra el estado del entorno en consola y devuelve el resumen. */
export function reportEnvironment() {
  const summary = {
    secureContext: isSecureContextAvailable(),
    serviceWorkerSupported: 'serviceWorker' in navigator,
    indexedDbSupported: 'indexedDB' in globalThis,
    geolocationSupported: 'geolocation' in navigator,
    mediaDevicesSupported: Boolean(navigator.mediaDevices?.getUserMedia),
    pushSupported: 'PushManager' in globalThis,
  };

  console.info('[CivicGuard] entorno', summary);

  const reason = insecureContextReason();
  if (reason) {
    console.warn(`[CivicGuard] ${reason}`);
  }

  return summary;
}

export default { isSecureContextAvailable, insecureContextReason, reportEnvironment };
