import { enhancePixels, outputSize } from './processor.js';
self.onmessage = async ({ data }) => {
  try {
    const bitmap = await createImageBitmap(data.file);
    const size = outputSize(bitmap.width, bitmap.height, data.scale, data.maxPixels);
    const canvas = new OffscreenCanvas(size.width, size.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, size.width, size.height); bitmap.close();
    const pixels = ctx.getImageData(0, 0, size.width, size.height);
    pixels.data.set(enhancePixels(pixels.data, size.width, size.height, data.strength, data.denoise));
    ctx.putImageData(pixels, 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    self.postMessage({ blob, ...size });
  } catch (error) { self.postMessage({ error: '无法处理这张图片，请尝试其他 JPG、PNG 或 WebP 图片。' }); }
};
