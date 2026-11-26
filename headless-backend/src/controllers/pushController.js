import pushService from '../services/pushService.js';
import { sendOk } from '../utils/response.js';

export function getVapidPublicKey(_req, res, next) {
  try {
    return sendOk(res, { publicKey: pushService.publicKey });
  } catch (error) {
    return next(error);
  }
}

export async function subscribePush(req, res, next) {
  try {
    await pushService.subscribe(req.validated.deviceId, req.validated.subscription);
    return sendOk(res, { subscribed: true }, 201);
  } catch (error) {
    return next(error);
  }
}

export default { getVapidPublicKey, subscribePush };
