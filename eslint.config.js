// @ts-check
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import sonarjs from 'eslint-plugin-sonarjs';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['.claude/**', 'dist/**', 'coverage/**', 'playwright-report/**', 'test-results/**'] },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  sonarjs.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  { files: ['**/*.js', '**/*.mjs'], extends: [tseslint.configs.disableTypeChecked] },
  // The tools are Node scripts without a tsconfig; some run code in Playwright's browser page
  {
    files: ['tools/**/*.mjs'],
    languageOptions: {
      globals: {
        Buffer: 'readonly',
        console: 'readonly',
        process: 'readonly',
        btoa: 'readonly',
        createImageBitmap: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        Image: 'readonly',
        OffscreenCanvas: 'readonly',
      },
    },
  },
  // The service worker is hand-written plain JS, run in its own (ServiceWorker) global scope
  {
    files: ['public/sw.js'],
    languageOptions: {
      globals: { self: 'readonly', caches: 'readonly', fetch: 'readonly', URL: 'readonly' },
    },
  },
  prettier,
);
