declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string; // ISO timestamp, set at build time (see vite.config.ts)
declare const __BUILD_SHA__: string; // short commit sha, or 'lokal' outside CI

interface Window {
  // Some WebKit builds (including older Safari) only expose the vendor-prefixed constructor.
  readonly webkitAudioContext?: typeof AudioContext;
}
