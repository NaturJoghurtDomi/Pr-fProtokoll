import { deflateSync, crc32 } from "node:zlib";
import { writeFileSync } from "node:fs";

const ANTHRAZIT = [0x21, 0x25, 0x29];
const GELB = [0xff, 0xcc, 0x00];
// links, rechts, oben, unten als Anteil der Kantenlänge
const BALKEN = [[0.22, 0.78, 0.30, 0.38], [0.22, 0.56, 0.46, 0.54], [0.22, 0.66, 0.62, 0.70]];

function farbe(x, y, n) {
  const fx = x / n;
  const fy = y / n;
  for (const [x1, x2, y1, y2] of BALKEN) {
    if (fx >= x1 && fx <= x2 && fy >= y1 && fy <= y2) return GELB;
  }
  return ANTHRAZIT;
}

function png(n) {
  const roh = Buffer.alloc(n * (1 + n * 3));
  let p = 0;
  for (let y = 0; y < n; y++) {
    roh[p++] = 0;
    for (let x = 0; x < n; x++) {
      const c = farbe(x, y, n);
      roh[p++] = c[0]; roh[p++] = c[1]; roh[p++] = c[2];
    }
  }
  const stueck = (typ, daten) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(daten.length);
    const td = Buffer.concat([Buffer.from(typ, "ascii"), daten]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0);
  ihdr.writeUInt32BE(n, 4);
  ihdr[8] = 8;   // Bittiefe
  ihdr[9] = 2;   // Farbtyp RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    stueck("IHDR", ihdr),
    stueck("IDAT", deflateSync(roh, { level: 9 })),
    stueck("IEND", Buffer.alloc(0))
  ]);
}

for (const n of [192, 512]) {
  writeFileSync(new URL(`./icon-${n}.png`, import.meta.url), png(n));
  console.log(`icon-${n}.png geschrieben`);
}
