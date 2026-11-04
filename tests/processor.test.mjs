import test from 'node:test';
import assert from 'node:assert/strict';
import { enhancePixels, outputSize } from '../processor.js';
test('flat colors and alpha remain intact', () => {
  const pixels = new Uint8ClampedArray(4 * 9).fill(128);
  assert.deepEqual(enhancePixels(pixels, 3, 3), pixels);
});
test('increases contrast at a soft edge without changing alpha', () => {
  const pixels = new Uint8ClampedArray([60,60,60,255, 80,80,80,255, 160,160,160,255, 180,180,180,255]);
  const result = enhancePixels(pixels, 4, 1, 80, false);
  assert.ok(result[4] < 80); assert.ok(result[8] > 160);
  for (let i = 3; i < pixels.length; i += 4) assert.equal(result[i], pixels[i]);
});
test('zero strength without denoise leaves original pixels intact', () => {
  const pixels = new Uint8ClampedArray([80,30,90,0, 125,70,160,255]);
  assert.deepEqual(enhancePixels(pixels, 2, 1, 0, false), pixels);
});
test('transparent pixels do not darken adjacent colors', () => {
  const pixels = new Uint8ClampedArray([0,0,0,0, 200,150,100,255]);
  const result = enhancePixels(pixels, 2, 1, 80, true);
  assert.deepEqual(result.slice(4), pixels.slice(4));
});
test('2x output and resource bounds are respected', () => {
  assert.deepEqual(outputSize(400, 300, 2), { width:800, height:600, limited:false });
  const capped = outputSize(8000, 6000, 2);
  assert.ok(capped.width * capped.height <= 12_000_000);
  assert.equal(capped.limited, true);
  assert.equal(outputSize(16000, 10, 1).width, 6000);
});

test('mobile output respects smaller memory budget', () => {
  const capped = outputSize(4000, 3000, 2, 3_000_000);
  assert.ok(capped.width * capped.height <= 3_000_000);
  assert.equal(capped.limited, true);
});
