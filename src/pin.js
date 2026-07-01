// 4-digit parent PIN. This is a child deterrent, not real security:
// SHA-256(salt + pin) stored in localStorage, with a 60s lockout after 5 misses.

import { getSettings, updateSettings, getPinAttempts, setPinAttempts } from './store.js';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;

async function hash(salt, pin) {
  const bytes = new TextEncoder().encode(salt + pin);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function hasPin() {
  return Boolean(getSettings().pinHash);
}

export async function setPin(pin) {
  const pinSalt = randomSalt();
  const pinHash = await hash(pinSalt, pin);
  updateSettings({ pinSalt, pinHash });
}

/** Milliseconds until the PIN pad unlocks, or 0 if not locked. */
export function lockedForMs(now = Date.now()) {
  const { lockedUntil } = getPinAttempts();
  return Math.max(0, lockedUntil - now);
}

/**
 * @returns {Promise<{ok: boolean, lockedForMs?: number}>}
 */
export async function verifyPin(pin, now = Date.now()) {
  const attempts = getPinAttempts();
  if (attempts.lockedUntil > now) {
    return { ok: false, lockedForMs: attempts.lockedUntil - now };
  }
  const { pinSalt, pinHash } = getSettings();
  if ((await hash(pinSalt, pin)) === pinHash) {
    setPinAttempts({ count: 0, lockedUntil: 0 });
    return { ok: true };
  }
  const count = attempts.count + 1;
  if (count >= MAX_ATTEMPTS) {
    setPinAttempts({ count: 0, lockedUntil: now + LOCKOUT_MS });
    return { ok: false, lockedForMs: LOCKOUT_MS };
  }
  setPinAttempts({ count, lockedUntil: 0 });
  return { ok: false };
}
