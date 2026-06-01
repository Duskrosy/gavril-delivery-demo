// Multiplayer verification: boot the relay server, open TWO headless browser
// clients pointed at it, drive them apart, and confirm each sees the other
// (remote player present, with a name + color), zero page errors.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml' };
const wait = ms => new Promise(r => setTimeout(r, ms));

const fileSrv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
});

async function run() {
  const MP_PORT = 8123;
  const mp = spawn('node', ['server/server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(MP_PORT) } });
  await new Promise((res) => mp.stdout.on('data', d => { if (String(d).includes('listening')) res(); }));

  await new Promise(r => fileSrv.listen(0, r));
  const port = fileSrv.address().port;
  const url = `http://localhost:${port}/?dev=1&server=ws://localhost:${MP_PORT}`;

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
      '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'],
    defaultViewport: { width: 900, height: 600 } });
  const errors = [];
  const open = async (x, z) => {
    const pg = await browser.newPage();
    pg.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    await pg.goto(url, { waitUntil: 'load' });
    await pg.waitForFunction(() => !!window.__demo).catch(() => {});
    await pg.evaluate(() => document.getElementById('start-btn')?.click());
    await pg.evaluate((px, pz) => { const b = window.__demo.bike; b.mesh.position.set(px, 0, pz); }, x, z);
    return pg;
  };

  const p1 = await open(20, 20);
  const p2 = await open(-20, -20);
  await wait(2500); // let them connect, exchange names, send state
  await p1.bringToFront(); await wait(1200); // foreground p1 so its render loop ticks & builds the remote mesh

  const R = {};
  R.p1name = await p1.evaluate(() => window.__demo.net.name);
  R.p2name = await p2.evaluate(() => window.__demo.net.name);
  R.p1connected = await p1.evaluate(() => window.__demo.net.connected);
  R.p1online = await p1.evaluate(() => window.__demo.net.online);
  R.p1remotes = await p1.evaluate(() => window.__demo.net.remotes().length);
  R.p2remotes = await p2.evaluate(() => window.__demo.net.remotes().length);
  R.p1meshes = await p1.evaluate(() => window.__demo.remotePlayers.count);
  R.remoteHasColor = await p1.evaluate(() => { const r = window.__demo.net.remotes()[0]; return !!(r && r.color && r.name); });
  await p1.screenshot({ path: path.join(__dirname, 'mp-view.png') });

  // chat: p1 says something → own bubble locally, and p2 sees a bubble on p1
  await p2.bringToFront(); await wait(1100); // p2 ticks → builds p1's remote mesh
  await p1.evaluate(() => { const ci = document.getElementById('chat-input'); ci.value = 'hi there!'; ci.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', bubbles: true })); });
  await wait(700);
  R.p1ownBubble = await p1.evaluate(() => !!window.__demo.localBubble);
  R.p2SeesBubble = await p2.evaluate(() => [...window.__demo.remotePlayers.map.values()].some(e => !!e.bubble));

  // when p1 rides, p2 should render a motorcycle (bike group visible, not walk).
  // send directly (p1 is a background tab, so its rAF send loop is throttled).
  await p1.evaluate(() => { const d = window.__demo; d.mount.mount();
    d.net.send({ x: d.bike.position.x, z: d.bike.position.z, yaw: d.bike.yaw, riding: true, carrying: 'none' }); });
  await wait(700);
  R.p2SeesBike = await p2.evaluate(() => [...window.__demo.remotePlayers.map.values()].some(e => e.bike && e.bike.visible && !e.walk.visible));

  // NPC sync: both clients render the SAME server-owned world
  R.p1HasWorld = await p1.evaluate(() => window.__demo.net.hasWorld);
  R.p2HasWorld = await p2.evaluate(() => window.__demo.net.hasWorld);
  R.p1Cars = await p1.evaluate(() => window.__demo.traffic.cars.length);
  const k1 = await p1.evaluate(() => window.__demo.net.vkinds);
  const k2 = await p2.evaluate(() => window.__demo.net.vkinds);
  R.vkindsMatch = JSON.stringify(k1) === JSON.stringify(k2);
  const v1 = await p1.evaluate(() => window.__demo.net.veh.slice(0, 5));
  const v2 = await p2.evaluate(() => window.__demo.net.veh.slice(0, 5));
  R.vehSynced = v1.every((c, i) => c[0] === v2[i][0] && c[1] === v2[i][1] && c[2] === v2[i][2] && Math.abs(c[3] - v2[i][3]) < 6);
  const pd1 = await p1.evaluate(() => window.__demo.net.ped[0]);
  const pd2 = await p2.evaluate(() => window.__demo.net.ped[0]);
  R.pedSynced = Math.hypot(pd1[0] - pd2[0], pd1[1] - pd2[1]) < 4;
  await p1.bringToFront();
  await p1.evaluate(() => { window.__demo.bike.mesh.position.set(0, 0, 20); window.__demo.setFreeze(true); window.__demo.camera.position.set(0, 70, 70); window.__demo.camera.lookAt(0, 0, 0); });
  await wait(600);
  await p1.screenshot({ path: path.join(__dirname, 'mp-npc.png') });
  await p2.evaluate(() => { const r = [...window.__demo.remotePlayers.map.values()][0]; if (r) window.__demo.camera.position.set(r.group.position.x + 14, 10, r.group.position.z + 14), window.__demo.camera.lookAt(r.group.position); window.__demo.setFreeze(true); });
  await wait(200);
  await p2.screenshot({ path: path.join(__dirname, 'mp-chat.png') });

  await browser.close();
  await new Promise(r => fileSrv.close(r));
  mp.kill();

  console.log('--- MULTIPLAYER RESULTS ---');
  for (const [k, v] of Object.entries(R)) console.log(k.padEnd(16), ':', v);
  console.log('page errors'.padEnd(16), ':', errors.length ? errors : 'none');
  const ok = R.p1connected === true && !!R.p1name && !!R.p2name && R.p1name !== R.p2name &&
    R.p1online === 2 && R.p1remotes === 1 && R.p2remotes === 1 && R.p1meshes === 1 &&
    R.remoteHasColor === true && R.p1ownBubble === true && R.p2SeesBubble === true && R.p2SeesBike === true &&
    R.p1HasWorld === true && R.p2HasWorld === true && R.p1Cars === 26 && R.vkindsMatch === true &&
    R.vehSynced === true && R.pedSynced === true && errors.length === 0;
  console.log('ALL CHECKS PASS'.padEnd(16), ':', ok);
  if (!ok) process.exit(1);
}
run().catch(e => { console.error(e); process.exit(1); });
