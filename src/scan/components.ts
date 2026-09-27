// Ported from wumble (src/scan, MIT, same author).
// Connected components of the ink (8-neighbourhood, so a noisy ring does not fall apart): box, pixel count, centroid.
import type { BinaryImage } from './binarize';
import { numberAt } from './raster';

export interface Component {
  readonly id: number; // label in the label map, from 1
  readonly x0: number;
  readonly y0: number;
  readonly x1: number; // inclusive
  readonly y1: number; // inclusive
  readonly size: number; // ink pixels
  readonly cx: number; // centroid
  readonly cy: number;
}

export interface Labeled {
  readonly components: readonly Component[];
  readonly labels: Int32Array; // component id per pixel, 0 = paper
}

interface Accumulator {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  size: number;
  sumX: number;
  sumY: number;
}

const flood = (image: BinaryImage, labels: Int32Array, start: number, id: number): Accumulator => {
  const { width, height, data } = image;
  const box: Accumulator = { x0: width, y0: height, x1: 0, y1: 0, size: 0, sumX: 0, sumY: 0 };
  const stack = [start];
  labels[start] = id;
  while (stack.length > 0) {
    const index = numberAt(stack, stack.length - 1);
    stack.pop();
    const x = index % width;
    const y = (index - x) / width;
    box.size++;
    box.sumX += x;
    box.sumY += y;
    box.x0 = Math.min(box.x0, x);
    box.x1 = Math.max(box.x1, x);
    box.y0 = Math.min(box.y0, y);
    box.y1 = Math.max(box.y1, y);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        const neighbour = yy * width + xx;
        if (xx < 0 || xx >= width || yy < 0 || yy >= height || data[neighbour] !== 1 || labels[neighbour] !== 0)
          continue;
        labels[neighbour] = id;
        stack.push(neighbour);
      }
    }
  }
  return box;
};

export const connectedComponents = (image: BinaryImage): Labeled => {
  const labels = new Int32Array(image.width * image.height);
  const components: Component[] = [];
  for (let i = 0; i < labels.length; i++) {
    if (image.data[i] !== 1 || labels[i] !== 0) continue;
    const id = components.length + 1;
    const { sumX, sumY, ...box } = flood(image, labels, i, id);
    components.push({ id, ...box, cx: sumX / box.size, cy: sumY / box.size });
  }
  return { components, labels };
};
