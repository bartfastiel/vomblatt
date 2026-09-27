import { expect, test } from '@playwright/test';

test('shows the title and the photo button', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Vomblatt');
  await expect(page.getByText('Notenblatt fotografieren')).toBeVisible();
});
