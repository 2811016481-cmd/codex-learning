// Separable Gaussian blur followed by thresholded unsharp masking.
// Preserve alpha and skip transparent samples to avoid dark halos at cutout edges.
export function enhancePixels(source, width, height, strength = 45, denoise = true) {
  if (source.length !== width * height * 4) throw new Error('像素尺寸不匹配');
  const horizontal = new Uint8ClampedArray(source.length);
  const blurred = new Uint8ClampedArray(source.length);
  const weights = [1, 4, 6, 4, 1];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      let total = 0, r = 0, g = 0, b = 0;
      for (let k = -2; k <= 2; k++) {
        const q = (y * width + Math.max(0, Math.min(width - 1, x + k))) * 4;
        const w = weights[k + 2] * source[q + 3] / 255;
        total += w; r += source[q] * w; g += source[q + 1] * w; b += source[q + 2] * w;
      }
      horizontal[p] = total ? r / total : source[p]; horizontal[p + 1] = total ? g / total : source[p + 1]; horizontal[p + 2] = total ? b / total : source[p + 2]; horizontal[p + 3] = source[p + 3];
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      let total = 0, r = 0, g = 0, b = 0;
      for (let k = -2; k <= 2; k++) {
        const q = (Math.max(0, Math.min(height - 1, y + k)) * width + x) * 4;
        const w = weights[k + 2] * horizontal[q + 3] / 255;
        total += w; r += horizontal[q] * w; g += horizontal[q + 1] * w; b += horizontal[q + 2] * w;
      }
      blurred[p] = total ? r / total : source[p]; blurred[p + 1] = total ? g / total : source[p + 1]; blurred[p + 2] = total ? b / total : source[p + 2];
    }
  }
  const output = new Uint8ClampedArray(source.length);
  const amount = Math.max(0, Math.min(100, strength)) / 100 * 2.5;
  for (let p = 0; p < source.length; p += 4) {
    for (let c = 0; c < 3; c++) {
      const detail = source[p + c] - blurred[p + c];
      // Suppress small fluctuations while sharpening meaningful edges.
      const base = denoise && Math.abs(detail) < 12 ? source[p + c] - detail * .25 : source[p + c];
      output[p + c] = base + (Math.abs(detail) > 3 ? amount * detail : 0);
    }
    output[p + 3] = source[p + 3];
  }
  return output;
}
export function outputSize(width, height, scale, maxPixels = 12_000_000) {
  if (!(width > 0 && height > 0) || ![1, 2].includes(scale)) throw new Error('无效的图片尺寸');
  const ratio = Math.min(scale, Math.sqrt(maxPixels / (width * height)), 6000 / Math.max(width, height));
  return { width: Math.max(1, Math.floor(width * ratio)), height: Math.max(1, Math.floor(height * ratio)), limited: ratio < scale };
}
