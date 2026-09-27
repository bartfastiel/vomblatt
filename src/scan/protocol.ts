// What the page and the recognition worker say to each other, and what becomes of it: the pure part of the worker
// glue, so that it is tested without a browser.
import type { Score } from '../score/score';
import { NoStaffError, recognizeGray } from './pipeline';
import { grayscale, type RgbaImage } from './raster';

export const MAX_SIDE = 2400; // the photo is scaled down to this before recognition – plenty for a few systems

export const MESSAGES = {
  noStaff: 'Keine Notenlinien gefunden – bitte näher ran und gerade halten.',
  failed: 'Die Erkennung ist fehlgeschlagen – bitte noch einmal versuchen.',
} as const;

export type Failure = keyof typeof MESSAGES;

export type WorkerResponse =
  { readonly ok: true; readonly score: Score } | { readonly ok: false; readonly failure: Failure };

// Size to draw the photo at: the long side at most MAX_SIDE, never enlarged
export const workingSize = (width: number, height: number): { width: number; height: number } => {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
};

export const respond = (image: RgbaImage, read: typeof recognizeGray = recognizeGray): WorkerResponse => {
  try {
    return { ok: true, score: read(grayscale(image)).score };
  } catch (error) {
    return { ok: false, failure: error instanceof NoStaffError ? 'noStaff' : 'failed' };
  }
};

// The worker's answer as the promise's outcome: the Score, or an Error with a German message for the user
export const scoreOf = (response: WorkerResponse): Score => {
  if (response.ok) return response.score;
  throw new Error(MESSAGES[response.failure]);
};
