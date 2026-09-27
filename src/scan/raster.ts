// Ported from wumble (src/scan, MIT, same author).
// Images as plain arrays: RGBA as the canvas hands it over, grayscale for the pipeline, and the integral image that
// makes window means cheap. No DOM here – everything runs in Node as well.

export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray; // 4 bytes per pixel, row by row
}

export interface GrayImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array; // 0 = black, 255 = white
}

// Element access without the `undefined` of unchecked indexes: the pipeline never reads outside its arrays. One
// accessor per array type, because a shared one sees every type and V8 then reads every element the slow way.
export const byteAt = (values: Uint8Array, index: number): number => values[index] ?? 0;
export const wordAt = (values: Uint32Array, index: number): number => values[index] ?? 0;
export const intAt = (values: Int32Array, index: number): number => values[index] ?? 0;
export const floatAt = (values: Float32Array, index: number): number => values[index] ?? 0;
export const doubleAt = (values: Float64Array, index: number): number => values[index] ?? 0;
export const shortAt = (values: Uint16Array, index: number): number => values[index] ?? 0;
export const numberAt = (values: readonly number[], index: number): number => values[index] ?? 0;

export const grayscale = (image: RgbaImage): GrayImage => {
  const { width, height } = image;
  const data = new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.length);
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = (byteAt(data, 4 * i) * 77 + byteAt(data, 4 * i + 1) * 151 + byteAt(data, 4 * i + 2) * 28) >> 8;
  }
  return { width, height, data: gray };
};

export const toRgba = (image: GrayImage): RgbaImage => {
  const data = new Uint8ClampedArray(image.width * image.height * 4);
  image.data.forEach((value, i) => {
    data[4 * i] = value;
    data[4 * i + 1] = value;
    data[4 * i + 2] = value;
    data[4 * i + 3] = 255;
  });
  return { width: image.width, height: image.height, data };
};

// Value between the four neighbouring pixels; coordinates outside the image are clamped to the border
export const sampleBilinear = (image: GrayImage, x: number, y: number): number => {
  const { width, height, data } = image;
  const x0 = Math.min(width - 1, Math.max(0, Math.floor(x)));
  const y0 = Math.min(height - 1, Math.max(0, Math.floor(y)));
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const fx = Math.min(1, Math.max(0, x - x0));
  const fy = Math.min(1, Math.max(0, y - y0));
  const top = byteAt(data, y0 * width + x0) * (1 - fx) + byteAt(data, y0 * width + x1) * fx;
  const bottom = byteAt(data, y1 * width + x0) * (1 - fx) + byteAt(data, y1 * width + x1) * fx;
  return top * (1 - fy) + bottom * fy;
};

export const resize = (image: GrayImage, width: number, height: number): GrayImage => {
  const data = new Uint8Array(width * height);
  const scaleX = image.width / width;
  const scaleY = image.height / height;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data[y * width + x] = Math.round(sampleBilinear(image, (x + 0.5) * scaleX - 0.5, (y + 0.5) * scaleY - 0.5));
    }
  }
  return { width, height, data };
};

// Shrinks by averaging every source pixel that falls into an output pixel (no aliasing, unlike bilinear sampling);
// enlarging falls back to bilinear
export const resizeArea = (image: GrayImage, width: number, height: number): GrayImage => {
  if (width >= image.width || height >= image.height) return resize(image, width, height);
  const data = new Uint8Array(width * height);
  const integral = new IntegralImage(image);
  const scaleX = image.width / width;
  const scaleY = image.height / height;
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor(y * scaleY);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * scaleY));
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x * scaleX);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * scaleX));
      data[y * width + x] = Math.round(integral.mean(x0, y0, x1, y1));
    }
  }
  return { width, height, data };
};

// Summed-area table: the sum over any rectangle costs four lookups
export class IntegralImage {
  private readonly stride: number;
  private readonly sums: Uint32Array;

  constructor(image: GrayImage) {
    const { width, height, data } = image;
    this.stride = width + 1;
    this.sums = new Uint32Array((width + 1) * (height + 1));
    for (let y = 0; y < height; y++) {
      let rowSum = 0;
      for (let x = 0; x < width; x++) {
        rowSum += byteAt(data, y * width + x);
        this.sums[(y + 1) * this.stride + x + 1] = wordAt(this.sums, y * this.stride + x + 1) + rowSum;
      }
    }
  }

  // Sum of the pixels in [x0, x1) × [y0, y1)
  sum(x0: number, y0: number, x1: number, y1: number): number {
    const s = this.sums;
    const w = this.stride;
    return wordAt(s, y1 * w + x1) - wordAt(s, y0 * w + x1) - wordAt(s, y1 * w + x0) + wordAt(s, y0 * w + x0);
  }

  mean(x0: number, y0: number, x1: number, y1: number): number {
    return this.sum(x0, y0, x1, y1) / ((x1 - x0) * (y1 - y0));
  }
}
