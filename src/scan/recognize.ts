// Entry point for the UI: photo in, Score out. The photo is decoded and scaled down here (the browser respects its
// orientation; a plain canvas works in every browser, OffscreenCanvas in a worker does not), recognition runs in a
// worker so that the page stays responsive; the worker's code is loaded only on the first call.
// Rejects with an Error whose message is German and meant for the user.
import type { Score } from '../score/score';
import { MESSAGES, scoreOf, type WorkerResponse, workingSize } from './protocol';
import type { RgbaImage } from './raster';

const decode = async (photo: Blob): Promise<RgbaImage> => {
  const bitmap = await createImageBitmap(photo, { imageOrientation: 'from-image' });
  const { width, height } = workingSize(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context === null) throw new Error(MESSAGES.failed);
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return { width, height, data: context.getImageData(0, 0, width, height).data };
};

export const recognize = async (photo: Blob): Promise<Score> => {
  const image = await decode(photo);
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  try {
    const response = await new Promise<WorkerResponse>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        resolve(event.data);
      };
      worker.onerror = () => {
        reject(new Error(MESSAGES.failed));
      };
      worker.postMessage(image, [image.data.buffer]);
    });
    return scoreOf(response);
  } finally {
    worker.terminate();
  }
};
