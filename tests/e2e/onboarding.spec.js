import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('?mock=1#/feed');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('kidtube:mock', '1');
  });
});

test('first run redirects to onboarding and completes the wizard', async ({ page }) => {
  await page.goto('?mock=1#/feed');
  await expect(page).toHaveURL(/#\/onboarding/);
  await expect(page.getByRole('heading', { name: 'Welcome to KidTube' })).toBeVisible();

  await page.getByRole('button', { name: 'Get started' }).click();

  // PIN step — mismatch first, then match.
  await page.getByPlaceholder('Choose a 4-digit PIN').fill('1234');
  await page.getByPlaceholder('Type it again').fill('9999');
  await page.getByRole('button', { name: 'Set PIN' }).click();
  await expect(page.getByText('Those don’t match — try again.')).toBeVisible();

  await page.getByPlaceholder('Type it again').fill('1234');
  await page.getByRole('button', { name: 'Set PIN' }).click();

  // API key step (mock accepts anything).
  await page.getByPlaceholder('Paste your API key here').fill('any-key');
  await page.getByRole('button', { name: 'Validate & continue' }).click();

  // Channel step: search and approve one.
  await page.getByPlaceholder(/Try “Ms Rachel”/).fill('rachel');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: 'Approve', exact: true }).first().click();
  await expect(page.getByText('1 channel approved')).toBeVisible();

  await page.getByRole('button', { name: 'Finish setup' }).click();
  await page.getByRole('button', { name: 'Go to her feed' }).click();

  await expect(page).toHaveURL(/#\/feed/);
  await expect(page.locator('.video-card').first()).toBeVisible();
});

test('skipping the API key still lands in a friendly empty feed', async ({ page }) => {
  await page.goto('?mock=1#/onboarding');
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByPlaceholder('Choose a 4-digit PIN').fill('1234');
  await page.getByPlaceholder('Type it again').fill('1234');
  await page.getByRole('button', { name: 'Set PIN' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Go to her feed' }).click();
  await expect(page.getByText('Nothing to watch right now')).toBeVisible();
});
