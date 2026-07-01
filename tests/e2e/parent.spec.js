import { test, expect } from '@playwright/test';
import { seedApp } from './helpers.js';

test('parent can search for and approve a channel', async ({ page }) => {
  await seedApp(page, { channels: false });
  await page.goto('?mock=1#/parent/channels');

  await expect(page.getByText('No approved channels yet')).toBeVisible();

  await page.getByPlaceholder('Search YouTube channels…').fill('blippi');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Approved ✓' })).toBeVisible();

  // The feed now shows that channel's videos.
  await page.goto('?mock=1#/feed');
  await expect(page.locator('.video-card')).toHaveCount(5);
});

test('removing an approved channel empties the feed', async ({ page }) => {
  await seedApp(page);
  await page.goto('?mock=1#/parent/channels');
  await page.getByRole('button', { name: 'Remove' }).first().click();
  await page.getByRole('button', { name: 'Remove' }).first().click();
  await page.getByRole('button', { name: 'Remove' }).first().click();
  await page.goto('?mock=1#/feed');
  await expect(page.getByText('Nothing to watch right now')).toBeVisible();
});

test('quota-exceeded mode shows the parent banner but kid feed stays calm', async ({ page }) => {
  await seedApp(page);
  await expect(page.locator('.video-card').first()).toBeVisible();

  // Flip the mock into quota-exhausted mode and force a refresh attempt.
  await page.goto('?mock=quota#/parent/channels');
  await page.getByRole('button', { name: 'Refresh all now' }).click();
  await page.reload();
  await expect(page.getByText(/Daily YouTube limit reached/)).toBeVisible();

  // Kid feed still renders from cache with no scary errors.
  await page.goto('#/feed');
  await expect(page.locator('.video-card').first()).toBeVisible();
  await expect(page.getByText(/limit reached/)).toHaveCount(0);
});

test('playback mode toggle persists', async ({ page }) => {
  await seedApp(page);
  await page.goto('?mock=1#/parent/settings');
  await page.locator('select').first().selectOption('youtubeApp');
  await page.reload();
  await expect(page.locator('select').first()).toHaveValue('youtubeApp');
});
