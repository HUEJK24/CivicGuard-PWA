import indexedDbManager from '../db/indexedDbManager.js';
import swRegistrationManager from '../core/swRegistrationManager.js';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ||
  (import.meta.env.DEV ? 'http://localhost:3000' : location.origin);
const BUTTON_ID = 'enable-push';
const STATUS_ID = 'push-status';

function decodeApplicationServerKey(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value.replace(/-/g, '+').replace(/_/g, '/')}${padding}`;
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

async function requestJson(path, options) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.error?.message ?? `Error HTTP ${response.status}`);
  }
  return result.data;
}

function setStatus(message, tone = '') {
  const status = document.getElementById(STATUS_ID);
  if (!status) return;
  status.textContent = message;
  if (tone) status.dataset.tone = tone;
  else delete status.dataset.tone;
}

async function enablePush(button) {
  button.disabled = true;
  try {
    if (Notification.permission === 'denied') {
      throw new Error('Las notificaciones están bloqueadas en los ajustes del navegador.');
    }

    const permission =
      Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
    if (permission !== 'granted') {
      setStatus('No se concedió permiso para enviar notificaciones.');
      return;
    }

    const registration = swRegistrationManager.registration;
    if (!registration) {
      throw new Error('El Service Worker no está activo. Prueba la versión publicada o la vista previa.');
    }

    const { publicKey } = await requestJson('/api/vapid-public-key');
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeApplicationServerKey(publicKey),
      });
    }

    const deviceId = await indexedDbManager.getOrCreateDeviceId();
    await requestJson('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, subscription: subscription.toJSON() }),
    });

    setStatus('Notificaciones activadas. Te avisaremos cuando cambie el estado de tus reportes.', 'ok');
  } catch (error) {
    console.error('[CivicGuard] No se pudieron activar las notificaciones push:', error);
    setStatus(error.message || 'No se pudieron activar las notificaciones.', 'error');
  } finally {
    button.disabled = false;
  }
}

export function mountPushNotifications() {
  const button = document.getElementById(BUTTON_ID);
  if (!button) return;

  if (
    !globalThis.isSecureContext ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in globalThis) ||
    !('Notification' in globalThis)
  ) {
    button.hidden = true;
    setStatus('Este navegador o contexto no admite notificaciones push.');
    return;
  }

  if (Notification.permission === 'granted') {
    setStatus('Puedes activar las notificaciones para este dispositivo.');
  } else if (Notification.permission === 'denied') {
    setStatus('Las notificaciones están bloqueadas en los ajustes del navegador.');
  }

  button.addEventListener('click', () => enablePush(button));
}

export default { mountPushNotifications };
