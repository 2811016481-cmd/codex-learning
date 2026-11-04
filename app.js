import { loadImage, enhanceImage } from './image-engine.js';
const $ = id => document.getElementById(id);
let file, originalUrl, resultUrl, resultBlob, controller, scale = 1, revision = 0, pending = false;
function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
function revoke(url) { if (url) URL.revokeObjectURL(url); }
function setBusy(value) {
  pending = value; $('busy').hidden = !value; $('enhance').disabled = value || !file; $('download').disabled = value || !resultBlob;
  $('save-help').hidden = value || !resultBlob; $('strength').disabled = value; $('denoise').disabled = value;
  document.querySelectorAll('[data-scale]').forEach(el => el.disabled = value);
}
function invalidate() { resultBlob = null; $('download').disabled = true; $('save-help').hidden = true; status('设置已更新，点击「重新增强」应用'); }
$('choose').onclick = $('replace').onclick = () => $('file').click();
$('file').onchange = () => { const selected = $('file').files[0]; $('file').value = ''; if (selected) load(selected); };
const dropzone = $('dropzone');
for (const event of ['dragenter', 'dragover']) dropzone.addEventListener(event, e => { e.preventDefault(); dropzone.classList.add('dragging'); });
for (const event of ['dragleave', 'drop']) dropzone.addEventListener(event, e => { e.preventDefault(); dropzone.classList.remove('dragging'); });
dropzone.addEventListener('drop', e => { if (e.dataTransfer.files[0]) load(e.dataTransfer.files[0]); });
window.addEventListener('dragover', e => e.preventDefault()); window.addEventListener('drop', e => e.preventDefault());
async function load(selected) {
  const supported = ['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) || (!selected.type && /\.(jpe?g|png|webp)$/i.test(selected.name));
  if (!supported) { status('请选择 JPG、PNG 或 WebP 图片。苹果 HEIC 照片请先转换成 JPG。', true); return; }
  if (selected.size > 20 * 1024 * 1024) { status('这张照片太大了（超过 20 MB），请换一张小一点的照片。', true); return; }
  const ticket = ++revision;
  controller?.abort(); setBusy(true); status('正在读取照片…');
  let bitmap;
  try {
    bitmap = await loadImage(selected);
    if (ticket !== revision) return;
    if (bitmap.width * bitmap.height > 40_000_000 || Math.max(bitmap.width, bitmap.height) > 16000) throw new Error('图片尺寸过大，请换一张小一点的照片。');
    file = selected; revoke(originalUrl); revoke(resultUrl); resultUrl = null; resultBlob = null;
    originalUrl = URL.createObjectURL(file); $('before').src = $('after').src = originalUrl;
    $('filename').textContent = file.name; $('dimensions').textContent = `原图 ${bitmap.width} × ${bitmap.height}`;
    $('editor').hidden = false; $('dropzone').hidden = true;
    $('compare').value = 50; updateCompare(); run();
  } catch (error) {
    if (ticket === revision) { setBusy(false); status(error.message.startsWith('图片尺寸') ? error.message : '这张照片打不开，请换一张 JPG、PNG 或 WebP 照片。', true); }
  } finally { bitmap?.close(); }
}
async function run() {
  if (!file) return;
  controller?.abort(); const task = controller = new AbortController();
  resultBlob = null; setBusy(true); status('正在让照片更清楚，请稍等…');
  try {
    const maxPixels = matchMedia('(pointer: coarse)').matches ? 3_000_000 : 8_000_000;
    const data = await enhanceImage(file, { scale, strength: Number($('strength').value), denoise: $('denoise').checked, maxPixels }, task.signal);
    if (task.signal.aborted) return;
    revoke(resultUrl); resultBlob = data.blob; resultUrl = URL.createObjectURL(resultBlob);
    $('after').src = resultUrl; $('save-image').src = resultUrl;
    $('dimensions').textContent = `输出 ${data.width} × ${data.height}`; setBusy(false);
    status(data.limited ? '已完成！为避免设备卡顿，大图已适当缩小。可以保存图片了。' : '已完成！点击「保存清晰图片」就可以了。');
  } catch (error) {
    if (error.name === 'AbortError') return;
    setBusy(false); status('这次没有处理成功，请换一张小一点的图片，或用 Chrome、Edge、Safari 浏览器打开。', true);
  }
}
$('enhance').onclick = run;
$('strength').oninput = () => { const value = Number($('strength').value); $('strength-value').textContent = value < 30 ? '轻柔' : value < 70 ? '自然' : '强力'; if (file) invalidate(); };
$('denoise').onchange = () => { if (file) invalidate(); };
document.querySelectorAll('[data-scale]').forEach(button => button.onclick = () => {
  scale = Number(button.dataset.scale); document.querySelectorAll('[data-scale]').forEach(el => el.setAttribute('aria-pressed', String(el === button))); if (file) invalidate();
});
function updateCompare() { const value = $('compare').value; $('before-wrap').style.clipPath = `inset(0 ${100 - value}% 0 0)`; $('divider').style.left = `${value}%`; }
$('compare').oninput = updateCompare;
function showSaveImage() {
  const dialog = $('save-dialog');
  if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
}
$('save-help').onclick = showSaveImage;
$('close-save').onclick = () => { const dialog = $('save-dialog'); if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open'); };
$('download').onclick = async () => {
  if (!resultBlob || pending) return;
  const name = `${file.name.replace(/\.[^.]+$/, '')}-清晰.png`;
  const saved = new File([resultBlob], name, { type: 'image/png' });
  // On supported phones the share sheet includes Save Image / Save to Files.
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [saved] })) {
    try { await navigator.share({ files: [saved] }); return; }
    catch (error) { if (error.name === 'AbortError') return; }
  }
  const link = document.createElement('a'); link.href = resultUrl; link.download = name;
  document.body.append(link); link.click(); link.remove();
  status('已开始保存。如果手机没有保存成功，点下方「长按保存图片」。');
};
window.addEventListener('pagehide', event => { if (event.persisted) return; controller?.abort(); revoke(originalUrl); revoke(resultUrl); });
$('boot-warning')?.remove();
