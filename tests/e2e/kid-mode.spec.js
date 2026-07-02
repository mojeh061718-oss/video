import { test, expect } from '@playwright/test';
import { seedApp, enterPin } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await seedApp(page);
});

test('feed renders videos from all approved channels', async ({ page }) => {
  await expect(page.locator('.video-card')).toHaveCount(13);
  await expect(page.getByText('Learning Colors with Ms Rachel')).toBeVisible();
  await expect(page.getByText('Exploring the Fire Station')).toBeVisible();
  // "Private video" placeholders from uploads playlists must never render.
  await expect(page.getByText('Private video')).toHaveCount(0);
});

test('favoriting adds a video to the favorites tab and persists across reload', async ({ page }) => {
  const card = page.locator('.video-card', { hasText: 'Learning Colors with Ms Rachel' });
  await card.locator('.card-heart').click();

  await page.getByRole('button', { name: 'Favorites' }).click();
  await expect(page.locator('.video-card')).toHaveCount(1);
  await expect(page.getByText('Learning Colors with Ms Rachel')).toBeVisible();

  await page.reload();
  await expect(page.locator('.video-card')).toHaveCount(1);

  // Un-heart removes it.
  await page.locator('.card-heart').click();
  await expect(page.getByText('No favorites yet')).toBeVisible();
});

test('tapping a card opens the watch screen with a back button', async ({ page }) => {
  await page.locator('.video-card').first().click();
  await expect(page).toHaveURL(/#\/watch\//);
  await expect(page.locator('.watch-back')).toBeVisible();
  await page.locator('.watch-back').click();
  await expect(page).toHaveURL(/#\/feed/);
});

test('gear requires long-press and PIN to reach parent mode', async ({ page }) => {
  // A quick tap does nothing.
  await page.locator('.gear').click();
  await expect(page.locator('.pin-panel')).toHaveCount(0);

  // A 3s hold opens the PIN pad.
  const gear = page.locator('.gear');
  const box = await gear.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(3300);
  await page.mouse.up();
  await expect(page.locator('.pin-panel')).toBeVisible();

  // Wrong PIN shakes, right PIN enters.
  await enterPin(page, '0000');
  await expect(page.getByText('Oops, wrong PIN')).toBeVisible();
  await enterPin(page, '1234');
  await expect(page).toHaveURL(/#\/parent/);
  await expect(page.getByRole('heading', { name: 'Parent dashboard' })).toBeVisible();
});
