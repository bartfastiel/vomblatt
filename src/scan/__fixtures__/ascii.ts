// Tiny rasters for unit tests, drawn as text: '#' is ink, everything else paper.
import type { BinaryImage } from '../binarize';
import type { GrayImage } from '../raster';

export const binaryFromAscii = (rows: readonly string[]): BinaryImage => {
  const height = rows.length;
  const width = Math.max(...rows.map((row) => row.length));
  const data = new Uint8Array(width * height);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row.charAt(x) === '#') data[y * width + x] = 1;
  });
  return { width, height, data };
};

export const asciiFromBinary = (image: BinaryImage): string[] => {
  const rows: string[] = [];
  for (let y = 0; y < image.height; y++) {
    let row = '';
    for (let x = 0; x < image.width; x++) row += image.data[y * image.width + x] === 1 ? '#' : '.';
    rows.push(row);
  }
  return rows;
};

// Ink black (0), paper white (255)
export const grayFromAscii = (rows: readonly string[]): GrayImage => {
  const binary = binaryFromAscii(rows);
  return { width: binary.width, height: binary.height, data: binary.data.map((ink) => (ink === 1 ? 0 : 255)) };
};
