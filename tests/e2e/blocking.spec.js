import { test, expect } from '@playwright/test';
import { seedApp, enterPin } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await seedApp(page);
  await expect(page.locator('.video-card').first()).toBeVisible();
});

async function openParent(page, tab) {
  await page.goto(`?mock=1#/parent/${tab}`);
}

test('adding keyword "elmo" hides matching videos from feed and favorites', async ({ page }) => {
  // Favorite an Elmo video first.
  const elmoCard = page.locator('.video-card', { hasText: 'Elmo Sings the Alphabet' });
  await elmoCard.locator('.card-heart').click();

  // Add the keyword in the parent blocklist tab.
  await openParent(page, 'blocklist');
  await page.getByPlaceholder(/e\.g\. whining, crying/).fill('Elmo');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('.chip', { hasText: 'elmo' })).toBeVisible();

  // Every Elmo video is gone from the feed (channel name matches too).
  await page.goto('?mock=1#/feed');
  await expect(page.locator('.video-card')).toHaveCount(10);
  await expect(page.getByText('Elmo Sings the Alphabet')).toHaveCount(0);

  // And from favorites, even though it was hearted.
  await page.goto('?mock=1#/favorites');
  await expect(page.getByText('No favorites yet')).toBeVisible();
});

test('keyword matches video titles from other channels ("whining")', async ({ page }) => {
  await openParent(page, 'blocklist');
  await page.getByPlaceholder(/e\.g\. whining, crying/).fill('whining');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  await page.goto('?mock=1#/feed');
  await expect(page.getByText('Whining Kids Compilation')).toHaveCount(0);
  await expect(page.getByText('Tractors and Trucks for Kids')).toBeVisible();
});

test('quick-block via the card ⋯ button blocks a channel after PIN', async ({ page }) => {
  const card = page.locator('.video-card', { hasText: 'Exploring the Fire Station' });
  await card.locator('.card-more').click();

  await enterPin(page, '1234');
  await page.getByRole('button', { name: 'Block channel: Blippi Mock' }).click();

  // All 5 Blippi videos vanish immediately.
  await expect(page.locator('.video-card')).toHaveCount(8);
  await expect(page.getByText('Exploring the Fire Station')).toHaveCount(0);

  // The channel shows up in the parent blocklist and can be unblocked.
  await openParent(page, 'blocklist');
  await expect(page.getByText('Blippi Mock')).toBeVisible();
  await page.getByRole('button', { name: 'Unblock' }).first().click();
  await page.goto('?mock=1#/feed');
  await expect(page.locator('.video-card')).toHaveCount(13);
});

test('quick-block a single video removes just that video', async ({ page }) => {
  const card = page.locator('.video-card', { hasText: 'Whining Kids Compilation' });
  await card.locator('.card-more').click();
  await enterPin(page, '1234');
  await page.getByRole('button', { name: 'Block this video' }).click();

  await expect(page.locator('.video-card')).toHaveCount(12);
  await expect(page.getByText('Whining Kids Compilation')).toHaveCount(0);
});

test('parent can unblock a keyword and videos reappear', async ({ page }) => {
  await openParent(page, 'blocklist');
  await page.getByPlaceholder(/e\.g\. whining, crying/).fill('elmo');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.locator('.chip', { hasText: 'elmo' }).locator('.chip-x').click();
  await expect(page.locator('.chip')).toHaveCount(0);

  await page.goto('?mock=1#/feed');
  await expect(page.locator('.video-card')).toHaveCount(13);
});

test('blocklist tab shows hidden-video counts', async ({ page }) => {
  await openParent(page, 'blocklist');
  await expect(page.getByText('13 videos from approved channels, 0 hidden')).toBeVisible();
  await page.getByPlaceholder(/e\.g\. whining, crying/).fill('elmo');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('13 videos from approved channels, 3 hidden')).toBeVisible();
});
