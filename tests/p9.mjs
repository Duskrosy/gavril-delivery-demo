// P9 verification: (A) multiplayer fallback toast when the server is
// unreachable, and (B) mobile touch controls (joystick moves the avatar,
// ride button mounts) on an emulated touch device.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml' };
const wait = ms => new Promise(r => setTimeout(r, ms));
const srv = http.createServer((q, s) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
  fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); s.end(d); }); });

async function run() {
  await new Promise(r => srv.listen(0, r));
  const port = srv.address().port;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const R = {}; const errors = [];

  // (A) fallback toast: point at a refused server
  const a = await browser.newPage();
  a.setViewport({ width: 1000, height: 700 });
  a.on('pageerror', e => errors.push('A: ' + e.message));
  await a.goto(`http://localhost:${port}/?dev=1&server=ws://127.0.0.1:9`, { waitUntil: 'load' });
  await a.waitForFunction(() => !!window.__demo).catch(() => {});
  await wait(1500);
  R.soloToast = await a.$eval('#toast', el => el.textContent || '');
  await a.close();

  // (B) mobile touch (emulated): joystick + ride button
  const b = await browser.newPage();
  b.on('pageerror', e => errors.push('B: ' + e.message));
  await b.emulate({ viewport: { width: 414, height: 760, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605 Mobile/15E148' });
  await b.goto(`http://localhost:${port}/?dev=1&server=ws://127.0.0.1:9`, { waitUntil: 'load' });
  await b.waitForFunction(() => !!window.__demo).catch(() => {});
  await b.evaluate(() => document.getElementById('start-btn').click());
  await wait(300);
  R.touchVisible = await b.$eval('#touch', el => !el.classList.contains('hidden'));
  // drag the joystick "up" → camera-relative forward, avatar should move
  R.dbg = await b.evaluate(async () => {
    const stick = document.getElementById('stick');
    const r = stick.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const fire = (type, x, y) => stick.dispatchEvent(new PointerEvent(type, { pointerId: 1, clientX: x, clientY: y, bubbles: true }));
    const before = window.__demo.avatar.mesh.position.clone();
    fire('pointerdown', cx, cy); fire('pointermove', cx, cy - 55);
    const forwardDuring = window.__demo.input.forward;
    await new Promise(r => setTimeout(r, 900));
    const d = window.__demo;
    const spd = d.avatar.speed;
    const after = d.avatar.mesh.position;
    const moved = Math.hypot(after.x - before.x, after.z - before.z);
    fire('pointerup', cx, cy - 55);
    const near = d.world.solids.filter(s => Math.hypot(s.x - after.x, s.z - after.z) < 9)
      .map(s => ({ x: +s.x.toFixed(0), z: +s.z.toFixed(0), hx: +s.hx.toFixed(1), hz: +s.hz.toFixed(1) }));
    const agents = d.world.agentSolids().filter(s => Math.hypot(s.x - after.x, s.z - after.z) < 4).length;
    return { forwardDuring, spd: +spd.toFixed(2), moved: +moved.toFixed(2),
      riding: d.mount.isRiding, camYaw: +d.orbitCam.yaw.toFixed(2),
      from: [+before.x.toFixed(0), +before.z.toFixed(0)], to: [+after.x.toFixed(0), +after.z.toFixed(0)],
      nearSolids: near, agentsNear: agents };
  });
  // moved in the camera-forward direction (−z) at speed; tolerant of slow sw-render fps
  R.avatarMoved = R.dbg.moved > 1 && R.dbg.to[1] < R.dbg.from[1] && R.dbg.spd > 2;
  await b.screenshot({ path: path.join(__dirname, 'p9-mobile.png') });
  await b.close();

  await browser.close();
  await new Promise(r => srv.close(r));

  console.log('--- P9 RESULTS ---');
  for (const [k, v] of Object.entries(R)) console.log(k.padEnd(16), ':', v);
  console.log('page errors'.padEnd(16), ':', errors.length ? errors : 'none');
  const ok = /singleplayer/i.test(R.soloToast) && R.touchVisible === true && R.avatarMoved === true && errors.length === 0;
  console.log('ALL CHECKS PASS'.padEnd(16), ':', ok);
  if (!ok) process.exit(1);
}
run().catch(e => { console.error(e); process.exit(1); });
