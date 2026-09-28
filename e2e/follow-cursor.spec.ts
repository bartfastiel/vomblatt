import { expect, test } from '@playwright/test';

// Playwright's WebKit build on Windows ships without Web Audio at all (a test-runner gap, not a browser one –
// real Safari has full support); a minimal fake keeps this test meaningful there too. No-op where the real API
// already exists. Mirrors the stub in e2e/smoke.spec.ts (kept local here so this file stands on its own).
const stubAudioContext = (): void => {
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
};

test('the score view follows the playback cursor, keeping it centred, on a narrow screen', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.setViewportSize({ width: 320, height: 640 });
  await page.addInitScript(stubAudioContext);
  await page.goto('/');
  await page.getByText('Beispiel anhören').click();

  const container = page.locator('#score-container');
  await expect(container.locator('svg')).toBeVisible();
  await page.getByRole('button', { name: 'Abspielen' }).click();

  // The demo score is far wider than a 320px viewport, so once the cursor has moved a little way in, the view
  // must have scrolled to keep it centred. Poll generously instead of a fixed wait – CI machines vary in speed –
  // and check both conditions in one browser round trip so there is no race between reading scrollLeft and
  // reading the cursor's position.
  await expect
    .poll(
      async () =>
        container.evaluate((el) => {
          const cursor = el.querySelector('svg .cursor');
          if (cursor === null) return false;
          const containerRect = el.getBoundingClientRect();
          const cursorRect = cursor.getBoundingClientRect();
          const cursorX = (cursorRect.left + cursorRect.right) / 2;
          const offCentre = Math.abs(cursorX - (containerRect.left + containerRect.width / 2));
          return el.scrollLeft > 0 && offCentre <= 20;
        }),
      { timeout: 20_000 },
    )
    .toBe(true);

  expect(errors).toEqual([]);
});

test('the view does not scroll by itself before playback starts', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.addInitScript(stubAudioContext);
  await page.goto('/');
  await page.getByText('Beispiel anhören').click();

  const container = page.locator('#score-container');
  await expect(container.locator('svg')).toBeVisible();
  // Rendering the score, laying out its voice picker and tempo control etc. all happen before this point, so an
  // unwanted auto-scroll on load or render would already show up here without needing a fixed wait.
  await expect(container).toHaveJSProperty('scrollLeft', 0);
});
