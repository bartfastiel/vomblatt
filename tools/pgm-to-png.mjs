#!/usr/bin/env node
// Dev only: converts a grayscale PGM (optionally gzipped) to PNG to look at a fixture: node tools/pgm-to-png.mjs in out
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, gunzipSync } from 'node:zlib';

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (bytes) => {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};

export const encodePng = (width, height, gray) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 0; // grayscale
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) gray.copy(raw, y * (width + 1) + 1, y * width, (y + 1) * width);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

export const decodePgm = (bytes) => {
  const plain = bytes[0] === 0x1f ? gunzipSync(bytes) : bytes;
  const header = /^P5\s+(\d+)\s+(\d+)\s+255\s/.exec(plain.subarray(0, 40).toString('latin1'));
  if (header === null) throw new Error('not an 8-bit binary PGM');
  const width = Number(header[1]);
  const height = Number(header[2]);
  return { width, height, data: plain.subarray(header[0].length, header[0].length + width * height) };
};

if (process.argv[1]?.endsWith('pgm-to-png.mjs')) {
  const [input, output] = process.argv.slice(2);
  const { width, height, data } = decodePgm(readFileSync(input));
  writeFileSync(output, encodePng(width, height, Buffer.from(data)));
}
