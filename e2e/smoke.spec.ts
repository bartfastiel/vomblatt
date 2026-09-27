import { expect, test } from '@playwright/test';

test('shows the title and the photo button', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Vomblatt');
  await expect(page.getByText('Notenblatt fotografieren')).toBeVisible();
});

test('shows the build stamp in the footer', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.build-info')).toContainText('Stand');
});

test('"Beispiel anhören" shows the score with voice buttons and plays without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  // Playwright's WebKit build on Windows ships without Web Audio at all (a test-runner gap, not a browser one –
  // real Safari has full support); a minimal fake keeps this test meaningful there too. No-op where the real
  // API already exists.
  await page.addInitScript(() => {
    const existing = window.AudioContext as typeof AudioContext | undefined;
    if (existing !== undefined) return;
    class FakeParam {
      value: number;
      constructor(value: number) {
        this.value = value;
      }
      setValueAtTime(value: number) {
        this.value = value;
      }
      exponentialRampToValueAtTime(value: number) {
        this.value = value;
      }
    }
    class FakeNode {
      connect(target: unknown) {
        return target;
      }
      disconnect() {
        /* no-op */
      }
    }
    class FakeGainNode extends FakeNode {
      gain = new FakeParam(1);
    }
    class FakeOscillatorNode extends FakeNode {
      type = 'sine';
      frequency = new FakeParam(440);
      start() {
        /* no-op */
      }
      stop() {
        /* no-op */
      }
    }
    class FakeAudioContext {
      state = 'suspended';
      destination = new FakeNode();
      private readonly startedAt = Date.now();
      get currentTime() {
        return (Date.now() - this.startedAt) / 1000;
      }
      resume() {
        this.state = 'running';
        return Promise.resolve();
      }
      createGain() {
        return new FakeGainNode();
      }
      createOscillator() {
        return new FakeOscillatorNode();
      }
    }
    // @ts-expect-error -- a deliberately partial stand-in for the browsers that lack one at all
    window.AudioContext = FakeAudioContext;
  });

  await page.goto('/');
  await page.getByText('Beispiel anhören').click();

  const score = page.locator('.score-container svg');
  await expect(score).toBeVisible();
  for (const voice of ['Sopran', 'Alt', 'Tenor', 'Bass']) {
    await expect(page.getByRole('button', { name: voice })).toBeVisible();
  }

  await page.getByRole('button', { name: 'Abspielen' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await expect(score.locator('.cursor')).toHaveAttribute('visibility', 'visible');
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('button', { name: 'Abspielen' })).toBeVisible();

  expect(errors).toEqual([]);
});
