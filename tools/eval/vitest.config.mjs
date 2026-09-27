// Dev only: local evaluation runs (not part of `npm test`, not in CI) – npx vitest run --config tools/eval/vitest.config.mjs
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tools/eval/**/*.eval.ts'],
    testTimeout: 600_000,
  },
});
