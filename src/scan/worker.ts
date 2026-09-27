// The recognition worker: receives the decoded photo, draws it at working size, answers with a WorkerResponse.
// DOM glue only – the logic is in protocol.ts and below.
import { respond, type WorkerResponse, workingSize } from './protocol';

// The project compiles against the DOM library; of the worker scope only these two members are used
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ImageBitmap>) => void) | null;
  postMessage: (response: WorkerResponse) => void;
};

scope.onmessage = (event) => {
  const bitmap = event.data;
  const { width, height } = workingSize(bitmap.width, bitmap.height);
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context === null) {
    scope.postMessage({ ok: false, failure: 'failed' });
    return;
  }
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const { data } = context.getImageData(0, 0, width, height);
  scope.postMessage(respond({ width, height, data }));
};
