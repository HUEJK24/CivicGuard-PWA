import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidPushSubscription } from '../src/routes/push.routes.js';

const validSubscription = {
  endpoint: 'https://push.example.test/send/subscription-id',
  keys: { p256dh: 'public-key', auth: 'auth-key' },
};

test('accepts valid HTTPS push subscriptions', () => {
  assert.equal(isValidPushSubscription(validSubscription), true);
});

test('rejects non-HTTPS and relative endpoints', () => {
  assert.equal(
    isValidPushSubscription({ ...validSubscription, endpoint: 'http://push.example.test/send/id' }),
    false,
  );
  assert.equal(
    isValidPushSubscription({ ...validSubscription, endpoint: '/send/subscription-id' }),
    false,
  );
});

test('rejects missing push keys', () => {
  assert.equal(isValidPushSubscription({ ...validSubscription, keys: {} }), false);
});
