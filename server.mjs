import http from 'node:http';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('./', import.meta.url);
const files = new Map([['/', ['index.html', 'text/html']], ['/app.js', ['app.js', 'text/javascript']], ['/processor.js', ['processor.js', 'text/javascript']], ['/worker.js', ['worker.js', 'text/javascript']], ['/image-engine.js', ['image-engine.js', 'text/javascript']], ['/style.css', ['style.css', 'text/css']]]);
const server = http.createServer(async (req, res) => {
  const route = files.get(new URL(req.url, 'http://localhost').pathname);
  if (!route || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const data = await readFile(fileURLToPath(new URL(route[0], root)));
    const hashTags = tag => [...data.toString().matchAll(/<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/g)]
      .filter(match => match[1] === tag)
      .map(match => "'sha256-" + createHash('sha256').update(match[2]).digest('base64') + "'").join(' ');
    const policy = `default-src 'self'; img-src 'self' blob: data:; style-src 'self' ${hashTags('style')}; script-src 'self' ${hashTags('script')}; worker-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`;
    res.writeHead(200, { 'Content-Type': `${route[1]}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': policy });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(500); res.end('Unable to read file'); }
});
server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log(`Qingxi listening on port ${server.address().port}`));
