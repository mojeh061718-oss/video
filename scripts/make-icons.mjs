// Generates the PWA icons as PNGs with no dependencies (raw pixels + zlib).
// Design: rounded pink TV with a white play triangle on a warm background.
// Run: node scripts/make-icons.mjs

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const BG = [255, 248, 239]; // --bg
const PINK = [255, 107, 157]; // --primary
const WHITE = [255, 255, 255];
const YELLOW = [255, 209, 102]; // --accent

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256).map((_, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      return c;
    });
  }
  let crc = -1;
  for (const byte of buf) crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixelFn) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixelFn(x, y, size);
      const off = row + 1 + x * 3;
      raw[off] = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function inRoundedRect(x, y, cx, cy, w, h, r) {
  // Standard rounded-box signed distance: inside when <= 0.
  const qx = Math.abs(x - cx) - (w / 2 - r);
  const qy = Math.abs(y - cy) - (h / 2 - r);
  const dx = Math.max(qx, 0);
  const dy = Math.max(qy, 0);
  return Math.hypot(dx, dy) + Math.min(Math.max(qx, qy), 0) <= r;
}

function inTriangle(x, y, cx, cy, s) {
  // Right-pointing play triangle centered at (cx, cy) with height s.
  const left = cx - s * 0.4;
  const t = (x - left) / (s * 0.9);
  if (t < 0 || t > 1) return false;
  return Math.abs(y - cy) <= (s / 2) * (1 - t);
}

function iconPixel(pad) {
  return (x, y, size) => {
    const u = x / size;
    const v = y / size;
    const p = pad; // fraction of padding around the TV
    // TV body
    if (inRoundedRect(u, v, 0.5, 0.55, 1 - 2 * p, 0.72 - p, 0.1)) {
      if (inTriangle(u, v, 0.5, 0.55, 0.3)) return WHITE;
      return PINK;
    }
    // Antennae
    const antenna = (ax) => {
      const t = (0.55 - p / 2 - v) / 0.25;
      if (t < 0 || t > 1) return false;
      const px = 0.5 + (ax - 0.5) * (0.4 + 0.6 * t);
      return Math.abs(u - px) < 0.025;
    };
    if (v < 0.55 && (antenna(0.3) || antenna(0.7))) return YELLOW;
    return BG;
  };
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', png(192, iconPixel(0.1)));
writeFileSync('public/icons/icon-512.png', png(512, iconPixel(0.1)));
// Maskable icons need extra safe-zone padding.
writeFileSync('public/icons/icon-maskable-512.png', png(512, iconPixel(0.2)));
writeFileSync('public/icons/apple-touch-icon.png', png(180, iconPixel(0.12)));
console.log('icons written to public/icons/');
