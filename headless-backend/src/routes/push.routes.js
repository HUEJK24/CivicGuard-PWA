import { Router } from 'express';
import { getVapidPublicKey, subscribePush } from '../controllers/pushController.js';
import { HttpError } from '../utils/httpError.js';
import { validate } from '../middlewares/validate.js';

const router = Router();
const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function validateSubscription(req, _res, next) {
  const { subscription } = req.body ?? {};
  const validEndpoint =
    typeof subscription?.endpoint === 'string' &&
    subscription.endpoint.length <= 2048 &&
    URL.canParse(subscription.endpoint, 'https:') &&
    new URL(subscription.endpoint).protocol === 'https:';
  const validKeys =
    typeof subscription?.keys?.p256dh === 'string' &&
    subscription.keys.p256dh.length > 0 &&
    subscription.keys.p256dh.length <= 256 &&
    typeof subscription.keys?.auth === 'string' &&
    subscription.keys.auth.length > 0 &&
    subscription.keys.auth.length <= 256;

  if (!validEndpoint || !validKeys) {
    return next(
      new HttpError(
        400,
        'VALIDATION_ERROR',
        'La suscripción push tiene un endpoint o claves inválidos.',
      ),
    );
  }

  req.validated.subscription = {
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
  };
  return next();
}

router.get('/vapid-public-key', getVapidPublicKey);
router.post(
  '/subscribe',
  validate({ deviceId: { type: 'string', required: true, pattern: UUID_PATTERN } }),
  validateSubscription,
  subscribePush,
);

export default router;
