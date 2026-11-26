import indexedDbManager from '../db/indexedDbManager.js';
import swRegistrationManager from '../core/swRegistrationManager.js';
import { apiRequest } from '../core/apiClient.js';

const BUTTON_ID = 'enable-push';
const STATUS_ID = 'push-status';

function decodeApplicationServerKey(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value.replace(/-/g, '+').replace(/_/g, '/')}${padding}`;
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
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
      setStatus('No diste permiso para los avisos. Puedes activarlos cuando quieras.', 'error');
      return;
    }

    const registration = swRegistrationManager.registration;
    if (!registration) {
      throw new Error('Los avisos necesitan la versión publicada de la página.');
    }

    const { publicKey } = await apiRequest('/api/vapid-public-key');
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeApplicationServerKey(publicKey),
      });
    }

    const deviceId = await indexedDbManager.getOrCreateDeviceId();
    await apiRequest('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, subscription: subscription.toJSON() }),
    });

    setStatus('Avisos activados. Te avisaremos cuando cambie un reporte.', 'ok');
  } catch (error) {
    console.error('[CivicGuard] No se pudieron activar los avisos:', error);
    setStatus(error.message || 'No pudimos activar los avisos. Puedes reportar igual.', 'error');
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
    setStatus('Este navegador no admite avisos. Puedes reportar sin problema.');
    return;
  }

  if (Notification.permission === 'granted') {
    setStatus('Puedes activar los avisos para este dispositivo.');
  } else if (Notification.permission === 'denied') {
    setStatus('Los avisos están bloqueados en el navegador. Puedes reportar igual.', 'error');
  }

  button.addEventListener('click', () => enablePush(button));
}

export default { mountPushNotifications };
