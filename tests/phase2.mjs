// Phase-2 headless verification: on-foot start, mount/dismount, pickup,
// forced crash -> food destroyed -> remake, refuel, eat, and a full 3-order
// shift to the summary. Captures screenshots and asserts no page errors.
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

const server = http.createServer((req,res)=>{
  let p = decodeURIComponent(req.url.split('?')[0]); if(p==='/')p='/index.html';
  fs.readFile(path.join(ROOT,p),(e,d)=>{ if(e){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'});res.end(d);});
});
const shot = (page,name)=>page.screenshot({ path: path.join(__dirname, name) });

async function run(){
  await new Promise(r=>server.listen(0,r));
  const port = server.address().port;
  const browser = await puppeteer.launch({ executablePath:CHROME, headless:'new',
    args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'],
    defaultViewport:{width:1280,height:800} });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await page.goto(`http://localhost:${port}/?dev=1`, { waitUntil:'load' });
  await page.waitForSelector('#start-btn');
  await page.waitForFunction(()=>!document.getElementById('start-btn').disabled).catch(()=>{});
  await page.click('#start-btn');
  await wait(400);

  const results = {};
  results.startMode = await page.$eval('#mode-text', el => el.textContent);
  await shot(page, 'p2-foot.png');

  // walk avatar to the bike, press F to ride
  await page.evaluate(() => {
    const { avatar, bike } = window.__demo;
    avatar.mesh.position.set(bike.position.x, 0, bike.position.z);
  });
  await page.keyboard.press('f');
  await wait(300);
  results.riding = await page.evaluate(() => window.__demo.mount.isRiding);
  results.modeAfterMount = await page.$eval('#mode-text', el => el.textContent);
  await shot(page, 'p2-riding.png');

  // accept + teleport to restaurant for pickup
  await page.keyboard.press('e');
  await wait(150);
  await page.evaluate(() => { const {bike,world}=window.__demo; bike.mesh.position.set(world.restaurantPos.x,0,world.restaurantPos.z); });
  await wait(300);
  results.carryingAfterPickup = await page.evaluate(() => window.__demo.game.foodState);

  // force a crash: drop the bike onto a car at high speed
  await page.evaluate(() => {
    const { bike, traffic } = window.__demo;
    const car = traffic.cars[0];
    bike.mesh.position.set(car._wx, 0, car._wz);
    bike.speed = 26;
    bike.headingVec.set(0, 0, car.dir > 0 ? -1 : 1); // head into the car
  });
  await wait(250);
  results.foodAfterCrash = await page.evaluate(() => window.__demo.game.foodState);
  results.needsRemake = await page.evaluate(() => window.__demo.game.needsRemake);
  await shot(page, 'p2-crash.png');

  // remake: back to restaurant
  await page.evaluate(() => { const {bike,world}=window.__demo; bike.mesh.position.set(world.restaurantPos.x,0,world.restaurantPos.z); bike.speed=0; });
  await wait(300);
  results.foodAfterRemake = await page.evaluate(() => window.__demo.game.foodState);

  // refuel check: drain gas, sit on a pad, confirm it rises
  results.gasRose = await page.evaluate(async () => {
    const { needs, world, bike, TUNING } = window.__demo;
    needs.setGas(10);
    const before = needs.gas;
    bike.mesh.position.set(world.gasStations[0].position3.x, 0, world.gasStations[0].position3.z);
    await new Promise(r => setTimeout(r, 600));
    return needs.gas > before;
  });

  // eat check: drain hunger, stand at restaurant, press E
  await page.evaluate(() => { const {needs,world,bike}=window.__demo; needs.setHunger(20); bike.mesh.position.set(world.restaurantPos.x,0,world.restaurantPos.z); });
  await page.keyboard.press('e');
  await wait(150);
  results.hungerAfterEat = await page.evaluate(() => window.__demo.needs.hunger);

  // finish the shift: deliver current + remaining orders via teleport
  results.summaryReached = await page.evaluate(async () => {
    const { game, bike, world, STATES } = window.__demo;
    const wait2 = ms => new Promise(r => setTimeout(r, ms));
    let guard = 0;
    while (game.state !== STATES.SHIFT_DONE && guard++ < 30) {
      const order = game.current;
      if (game.state === STATES.OFFER) { document.getElementById('oc-accept').click(); await wait2(60); }
      if (game.state === STATES.TO_RESTAURANT) { bike.mesh.position.set(world.restaurantPos.x,0,world.restaurantPos.z); await wait2(120); }
      else if (game.state === STATES.TO_HOUSE) {
        if (game.needsRemake) { bike.mesh.position.set(world.restaurantPos.x,0,world.restaurantPos.z); await wait2(120); }
        else { const h = world.houses[game.current.houseId]; bike.mesh.position.set(h.position3.x,0,h.position3.z); await wait2(200);
          const btn = document.querySelector('#vg-choices .choice-btn'); if (btn) btn.click(); await wait2(150);
          const cont = document.getElementById('po-continue'); if (cont) cont.click(); await wait2(150);
        }
      }
    }
    return game.state === STATES.SHIFT_DONE;
  });
  await wait(300);
  results.summaryVisible = await page.$eval('#summary', el => !el.classList.contains('hidden'));
  await shot(page, 'p2-summary.png');

  await browser.close(); await new Promise(r=>server.close(r));

  console.log('--- PHASE 2 RESULTS ---');
  for (const [k,v] of Object.entries(results)) console.log(k.padEnd(20), ':', v);
  console.log('page errors'.padEnd(20), ':', errors.length ? errors : 'none');

  const ok = results.startMode === 'ON FOOT' && results.riding === true &&
    results.carryingAfterPickup === 'fresh' && results.foodAfterCrash === 'destroyed' &&
    results.foodAfterRemake === 'fresh' && results.gasRose === true &&
    results.hungerAfterEat > 95 && results.summaryReached === true && errors.length === 0;
  console.log('ALL CHECKS PASS'.padEnd(20), ':', ok);
  if (!ok) process.exit(1);
}
run().catch(e=>{console.error(e);process.exit(1);});
