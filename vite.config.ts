import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

// GITHUB_SHA is set by GitHub Actions; a local build has none, hence 'lokal' in the footer's build stamp.
const buildSha = process.env.GITHUB_SHA?.slice(0, 7) ?? 'lokal';

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __BUILD_SHA__: JSON.stringify(buildSha),
  },
  build: { target: 'es2022', outDir: 'dist' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      // src/scan is a stub owned by the in-progress recognition work (see src/scan/recognize.ts); it gets its own
      // tests once real recognition lands there.
      exclude: ['src/ui/**', 'src/main.ts', 'src/scan/**', '**/*.test.ts', 'src/**/*.d.ts', 'src/**/__fixtures__/**'],
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
});
