#!/usr/bin/env node
// Size budget: all dist/assets/*.js together at most BUDGET_KB kilobytes (gzip). Exit code 1 when exceeded.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 60;
const dir = 'dist/assets';
if (!existsSync(dir)) {
  console.error(`${dir} missing – run \`npm run build\` first`);
  process.exit(2);
}

let total = 0;
for (const name of readdirSync(dir)
  .filter((file) => file.endsWith('.js'))
  .sort()) {
  const size = gzipSync(readFileSync(join(dir, name))).length;
  total += size;
  console.log(`${name.padEnd(40)} ${(size / 1024).toFixed(1).padStart(7)} kB gzip`);
}
const kb = total / 1024;
console.log(`${'Total'.padEnd(40)} ${kb.toFixed(1).padStart(7)} kB gzip (budget ${BUDGET_KB} kB)`);
if (kb > BUDGET_KB) {
  console.error(`Budget exceeded: ${kb.toFixed(1)} kB > ${BUDGET_KB} kB`);
  process.exit(1);
}
