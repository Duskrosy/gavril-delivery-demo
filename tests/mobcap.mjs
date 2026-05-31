// Capture mobile landscape (HUD layout) + portrait (rotate prompt).
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import puppeteer from 'puppeteer-core';
const __dirname = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.resolve(__dirname, '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml' };
const wait = ms => new Promise(r => setTimeout(r, ms));
const srv = http.createServer((q, s) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
  fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); s.end(d); }); });
async function run() {
  await new Promise(r => srv.listen(0, r)); const port = srv.address().port;
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'] });
  // landscape phone
  const L = await b.newPage();
  await L.emulate({ viewport: { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 1, isLandscape: true }, userAgent: 'Mozilla/5.0 (iPhone) Mobile' });
  await L.goto(`http://localhost:${port}/?server=ws://127.0.0.1:9`, { waitUntil: 'load' });
  await L.evaluate(() => document.getElementById('start-btn')?.click());
  await wait(700);
  await L.screenshot({ path: path.join(__dirname, 'mob-landscape.png') });
  await L.close();
  // portrait phone → rotate prompt
  const P = await b.newPage();
  await P.emulate({ viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }, userAgent: 'Mozilla/5.0 (iPhone) Mobile' });
  await P.goto(`http://localhost:${port}/?server=ws://127.0.0.1:9`, { waitUntil: 'load' });
  await wait(400);
  const rotateShown = await P.evaluate(() => getComputedStyle(document.getElementById('rotate')).display !== 'none');
  await P.screenshot({ path: path.join(__dirname, 'mob-portrait.png') });
  await P.close();
  await b.close(); await new Promise(r => srv.close(r));
  console.log('rotate prompt shown in portrait:', rotateShown);
}
run().catch(e => { console.error(e); process.exit(1); });
