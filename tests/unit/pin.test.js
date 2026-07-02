import { describe, it, expect, beforeEach } from 'vitest';
import { setPin, verifyPin, hasPin, lockedForMs } from '../../src/pin.js';

beforeEach(() => localStorage.clear());

describe('pin', () => {
  it('roundtrips: set then verify', async () => {
    expect(hasPin()).toBe(false);
    await setPin('1234');
    expect(hasPin()).toBe(true);
    expect((await verifyPin('1234')).ok).toBe(true);
    expect((await verifyPin('0000')).ok).toBe(false);
  });

  it('stores a hash, not the PIN itself', async () => {
    await setPin('1234');
    const raw = localStorage.getItem('kidtube:settings');
    expect(raw).not.toContain('1234');
  });

  it('locks out after 5 wrong attempts and unlocks after the window', async () => {
    await setPin('1234');
    const t0 = 1_000_000;
    for (let i = 0; i < 4; i++) {
      expect((await verifyPin('0000', t0)).lockedForMs).toBeUndefined();
    }
    const fifth = await verifyPin('0000', t0);
    expect(fifth.lockedForMs).toBe(60_000);

    // Even the right PIN is rejected while locked.
    const during = await verifyPin('1234', t0 + 30_000);
    expect(during.ok).toBe(false);
    expect(during.lockedForMs).toBe(30_000);
    expect(lockedForMs(t0 + 30_000)).toBe(30_000);

    // After the lockout expires, the right PIN works again.
    expect((await verifyPin('1234', t0 + 61_000)).ok).toBe(true);
    expect(lockedForMs(t0 + 61_000)).toBe(0);
  });

  it('successful entry resets the attempt counter', async () => {
    await setPin('1234');
    await verifyPin('0000');
    await verifyPin('0000');
    expect((await verifyPin('1234')).ok).toBe(true);
    // 4 more misses shouldn't lock (counter was reset).
    for (let i = 0; i < 4; i++) {
      expect((await verifyPin('0000')).lockedForMs).toBeUndefined();
    }
  });
});
