// Offline after the first load. Registered only for a production build (see src/main.ts) – during `npm run dev`
// a stale cached bundle would be more confusing than helpful. A relative path keeps it working under the PR
// preview's sub-path (base './', see vite.config.ts).
export const registerServiceWorker = (): void => {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // offline support is a bonus, not a requirement – a failed registration must not break the app
    });
  });
};
