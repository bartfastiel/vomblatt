// Entry point for the UI: photo in, Score out. Decoding happens here (the browser respects the photo's orientation),
// recognition in a worker so that the page stays responsive; the worker's code is loaded only on the first call.
// Rejects with an Error whose message is German and meant for the user.
import type { Score } from '../score/score';
import { MESSAGES, scoreOf, type WorkerResponse } from './protocol';

export const recognize = async (photo: Blob): Promise<Score> => {
  const bitmap = await createImageBitmap(photo, { imageOrientation: 'from-image' });
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  try {
    const response = await new Promise<WorkerResponse>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        resolve(event.data);
      };
      worker.onerror = () => {
        reject(new Error(MESSAGES.failed));
      };
      worker.postMessage(bitmap, [bitmap]);
    });
    return scoreOf(response);
  } finally {
    worker.terminate();
  }
};
