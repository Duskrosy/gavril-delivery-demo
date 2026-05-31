// Headless smoke test: serve web-demo, load it in Chrome (software WebGL),
// click Clock in, drive forward into the restaurant, capture console
// errors + screenshots. Verifies boot, render, and the pickup transition.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME_PATH ||
  'C:/Program Files/Google/Chrome/Application/chrome.exe';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

async function run() {
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const url = `http://localhost:${port}/`;

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle',
      '--use-angle=swiftshader', '--window-size=1280,800'],
    defaultViewport: { width: 1280, height: 800 },
  });
  const page = await browser.newPage();

  const errors = [];
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('requestfailed', r => {
    // missing assets/*.png are expected (placeholder fallback)
    if (!/\/assets\//.test(r.url())) errors.push('REQFAIL: ' + r.url() + ' ' + r.failure()?.errorText);
  });

  await page.goto(url, { waitUntil: 'load', timeout: 20000 });
  await page.waitForSelector('#start-btn', { timeout: 10000 });
  // wait for assets preload to enable the button
  await page.waitForFunction(() => !document.getElementById('start-btn').disabled, { timeout: 10000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(__dirname, 'shot-start.png') });

  await page.click('#start-btn');
  await new Promise(r => setTimeout(r, 600));
  const hudVisible = await page.$eval('#hud', el => !el.classList.contains('hidden'));
  const orderShown = await page.$eval('#order-card', el => !el.classList.contains('hidden'));

  // accept the order
  await page.keyboard.press('e');
  await new Promise(r => setTimeout(r, 300));
  const objAfterAccept = await page.$eval('#objective', el => el.textContent);

  // drive forward — player starts facing -Z, restaurant is straight ahead
  await page.keyboard.down('w');
  await new Promise(r => setTimeout(r, 4500));
  await page.keyboard.up('w');
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(__dirname, 'shot-drive.png') });

  const objAfterDrive = await page.$eval('#objective', el => el.textContent);

  await browser.close();
  await new Promise(r => server.close(r));

  console.log('--- SMOKE RESULTS ---');
  console.log('hud visible after start :', hudVisible);
  console.log('order card shown        :', orderShown);
  console.log('objective after accept  :', JSON.stringify(objAfterAccept));
  console.log('objective after driving :', JSON.stringify(objAfterDrive));
  console.log('pickup reached          :', /Deliver to/.test(objAfterDrive));
  console.log('page errors             :', errors.length ? errors : 'none');
  const interestingLogs = logs.filter(l => !l.startsWith('[log]'));
  console.log('warnings/errors in console:', interestingLogs.length ? interestingLogs.slice(0, 12) : 'none');

  if (errors.length) process.exit(1);
}
run().catch(e => { console.error(e); process.exit(1); });
