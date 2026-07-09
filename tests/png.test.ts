import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { encodePNG } from "../src/png.ts";

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function readChunks(png: Buffer): Array<{ type: string; data: Buffer }> {
  const chunks: Array<{ type: string; data: Buffer }> = [];
  let off = 8;
  while (off < png.length) {
    const len = png.readUInt32BE(off);
    const type = png.toString("latin1", off + 4, off + 8);
    const data = png.subarray(off + 8, off + 8 + len);
    chunks.push({ type, data });
    off += 12 + len;
  }
  return chunks;
}

test("encodePNG emits a valid signature and chunk order", () => {
  const rgba = new Uint8Array(2 * 2 * 4).fill(255);
  const png = encodePNG(2, 2, rgba);
  assert.ok(png.subarray(0, 8).equals(SIGNATURE));

  const chunks = readChunks(png);
  assert.equal(chunks[0].type, "IHDR");
  assert.equal(chunks[chunks.length - 1].type, "IEND");
  assert.ok(chunks.some((c) => c.type === "IDAT"));
});

test("IHDR encodes correct dimensions and RGBA format", () => {
  const png = encodePNG(4, 3, new Uint8Array(4 * 3 * 4));
  const ihdr = readChunks(png).find((c) => c.type === "IHDR")!.data;
  assert.equal(ihdr.readUInt32BE(0), 4);
  assert.equal(ihdr.readUInt32BE(4), 3);
  assert.equal(ihdr[8], 8); // bit depth
  assert.equal(ihdr[9], 6); // color type RGBA
});

test("pixel data round-trips through inflate", () => {
  const width = 3;
  const height = 2;
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < rgba.length; i++) rgba[i] = (i * 7) & 0xff;

  const png = encodePNG(width, height, rgba);
  const idat = Buffer.concat(
    readChunks(png)
      .filter((c) => c.type === "IDAT")
      .map((c) => c.data),
  );
  const raw = inflateSync(idat);

  // Each scanline: 1 filter byte + width*4 pixel bytes.
  const stride = width * 4;
  for (let y = 0; y < height; y++) {
    assert.equal(raw[y * (stride + 1)], 0, "filter byte should be 0");
    for (let x = 0; x < stride; x++) {
      assert.equal(raw[y * (stride + 1) + 1 + x], rgba[y * stride + x]);
    }
  }
});

test("encodePNG rejects mismatched buffer sizes", () => {
  assert.throws(() => encodePNG(2, 2, new Uint8Array(3)));
});
