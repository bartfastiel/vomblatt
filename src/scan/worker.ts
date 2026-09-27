// The recognition worker: receives the decoded photo as RGBA pixels, answers with a WorkerResponse.
// Glue only – the logic is in protocol.ts and below.
import { respond, type WorkerResponse } from './protocol';
import type { RgbaImage } from './raster';

// The project compiles against the DOM library; of the worker scope only these two members are used
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<RgbaImage>) => void) | null;
  postMessage: (response: WorkerResponse) => void;
};

scope.onmessage = (event) => {
  scope.postMessage(respond(event.data));
};
