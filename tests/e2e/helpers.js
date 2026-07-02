// Shared e2e setup: seed localStorage so tests can skip onboarding.
// PIN 1234 hashed with salt '00000000...' — computed with the app's own scheme.

export const PIN = '1234';

export async function seedApp(page, { channels = true, extra = {} } = {}) {
  await page.goto('?mock=1#/feed');
  await page.evaluate(
    async ({ withChannels, extraSettings }) => {
      const enc = new TextEncoder().encode('testsalt' + '1234');
      const digest = await crypto.subtle.digest('SHA-256', enc);
      const pinHash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(
        'kidtube:settings',
        JSON.stringify({ apiKey: 'test-key', pinSalt: 'testsalt', pinHash, onboarded: true, ...extraSettings })
      );
      if (withChannels) {
        localStorage.setItem(
          'kidtube:channels',
          JSON.stringify([
            { id: 'UCmockrachel00000000000', title: 'Ms Rachel Mock', uploadsPlaylistId: 'UUmockrachel00000000000', thumb: '' },
            { id: 'UCmockblippi00000000000', title: 'Blippi Mock', uploadsPlaylistId: 'UUmockblippi00000000000', thumb: '' },
            { id: 'UCmockelmo0000000000000', title: 'Elmo World Mock', uploadsPlaylistId: 'UUmockelmo0000000000000', thumb: '' },
          ])
        );
      }
      // Clear the IndexedDB cache so each test starts fresh.
      await new Promise((resolve) => {
        const req = indexedDB.deleteDatabase('kidtube');
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      });
    },
    { withChannels: channels, extraSettings: extra }
  );
  await page.goto('?mock=1#/feed');
}

export async function enterPin(page, pin = PIN) {
  for (const digit of pin) {
    await page.locator('.pin-key', { hasText: digit }).click();
  }
}
