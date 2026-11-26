import webpush from 'web-push';
import { env } from '../config/env.js';
import pushSubscriptionRepository from '../repositories/pushSubscriptionRepository.js';
import { HttpError } from '../utils/httpError.js';

const isConfigured = Boolean(env.vapidPublicKey && env.vapidPrivateKey);

if (isConfigured) {
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
}

export const pushService = {
  get publicKey() {
    if (!isConfigured) {
      throw new HttpError(
        503,
        'PUSH_NOT_CONFIGURED',
        'Las notificaciones push no están configuradas en el servidor.',
      );
    }
    return env.vapidPublicKey;
  },

  /** @param {string} deviceId @param {{ endpoint: string, keys: { p256dh: string, auth: string } }} subscription */
  async subscribe(deviceId, subscription) {
    this.publicKey;
    return pushSubscriptionRepository.upsert(deviceId, subscription);
  },

  /**
   * Los errores de entrega no deben deshacer un cambio de estado ya guardado.
   * Las suscripciones revocadas o vencidas se eliminan para no reintentarlas.
   * @param {string} deviceId
   * @param {object} notification
   */
  async notifyDevice(deviceId, notification) {
    if (!isConfigured) {
      console.warn('[CivicGuard API] Push omitido: VAPID no está configurado.');
      return;
    }

    let subscriptions;
    try {
      subscriptions = await pushSubscriptionRepository.findByDeviceId(deviceId);
    } catch (error) {
      console.error('[CivicGuard API] No se pudieron consultar las suscripciones push:', error);
      return;
    }

    await Promise.all(
      subscriptions.map(async ({ endpoint, keys }) => {
        try {
          await webpush.sendNotification(
            { endpoint, keys },
            JSON.stringify(notification),
          );
        } catch (error) {
          if (error.statusCode === 404 || error.statusCode === 410) {
            try {
              await pushSubscriptionRepository.deleteByEndpoint(endpoint);
            } catch (cleanupError) {
              console.error(
                '[CivicGuard API] No se pudo eliminar una suscripción push vencida:',
                cleanupError,
              );
            }
            return;
          }
          console.error('[CivicGuard API] No se pudo enviar una notificación push:', error);
        }
      }),
    );
  },
};

export default pushService;
