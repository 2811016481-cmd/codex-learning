import { enhancePixels, outputSize } from './processor.js';

export async function loadImage(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file); } catch { /* Try the image decoder too. */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('图片无法读取')); image.src = url; });
    return { width: image.naturalWidth, height: image.naturalHeight, image, close() {} };
  } finally { URL.revokeObjectURL(url); }
}

export function enhanceImage(file, options, signal) {
  if (signal.aborted) return Promise.reject(new DOMException('Cancelled', 'AbortError'));
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') return enhanceOnPage(file, options, signal);
  return new Promise((resolve, reject) => {
    let worker;
    let settled = false;
    const onAbort = () => { if (!settled) { settled = true; cleanup(); reject(new DOMException('Cancelled', 'AbortError')); } };
    const cleanup = () => { worker?.terminate(); signal.removeEventListener('abort', onAbort); };
    const fallback = () => { if (!settled) { settled = true; cleanup(); enhanceOnPage(file, options, signal).then(resolve, reject); } };
    try {
      worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
      signal.addEventListener('abort', onAbort, { once: true });
      worker.onmessage = ({ data }) => {
        if (settled) return;
        if (data.error) { fallback(); return; }
        settled = true; cleanup(); resolve(data);
      };
      worker.onerror = event => { event.preventDefault(); fallback(); };
      worker.postMessage({ file, ...options });
    } catch { fallback(); }
  });
}

async function enhanceOnPage(file, options, signal) {
  const bitmap = await loadImage(file);
  let canvas;
  try {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    // Limit the fallback's memory consumption on older phones.
    const size = outputSize(bitmap.width, bitmap.height, options.scale, Math.min(options.maxPixels, 3_000_000));
    canvas = document.createElement('canvas'); canvas.width = size.width; canvas.height = size.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('浏览器无法处理图片');
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap.image || bitmap, 0, 0, size.width, size.height);
    // Paint the processing message before running the CPU fallback.
    await new Promise(resolve => setTimeout(resolve, 30));
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    const pixels = ctx.getImageData(0, 0, size.width, size.height);
    pixels.data.set(enhancePixels(pixels.data, size.width, size.height, options.strength, options.denoise));
    ctx.putImageData(pixels, 0, 0);
    const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('无法保存图片')), 'image/png'));
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    return { blob, ...size };
  } finally { bitmap.close(); if (canvas) { canvas.width = 1; canvas.height = 1; } }
}
