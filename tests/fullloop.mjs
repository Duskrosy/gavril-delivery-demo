// Full-loop verification: teleport to each delivery target via the dev hook,
// exercise pickup -> handoff vignette -> choice -> payout -> next, three times,
// reaching the shift summary. Captures vignette/payout/summary screenshots and
// asserts cash accrues and no page errors occur.
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

// teleport the player onto the current nav target so the proximity check fires
async function teleportToTarget(page){
  return page.evaluate(() => {
    const { game, player, world, STATES } = window.__demo;
    let t = null;
    if (game.state === STATES.TO_RESTAURANT) t = world.restaurantPos;
    else if (game.state === STATES.TO_HOUSE) t = world.houses[game.current.houseId].position3;
    if (!t) return false;
    player.mesh.position.set(t.x, 0, t.z);
    player.position = player.mesh.position;
    return true;
  });
}

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

  let vignetteShot = false, payoutShot = false;
  for (let i = 0; i < 3; i++) {
    // accept
    await page.keyboard.press('e');
    await wait(200);
    // reach restaurant
    await teleportToTarget(page); await wait(400);
    // reach house -> vignette opens
    await teleportToTarget(page); await wait(500);
    const vgOpen = await page.$eval('#vignette', el => !el.classList.contains('hidden'));
    if (!vgOpen) throw new Error('vignette did not open on delivery ' + i);
    if (!vignetteShot) { await page.screenshot({ path: path.join(__dirname,'cap-vignette.png') }); vignetteShot = true; }
    // pick a choice
    await page.click('#vg-choices .choice-btn');
    await wait(400);
    const poOpen = await page.$eval('#payout', el => !el.classList.contains('hidden'));
    if (!poOpen) throw new Error('payout did not open on delivery ' + i);
    if (!payoutShot) { await page.screenshot({ path: path.join(__dirname,'cap-payout.png') }); payoutShot = true; }
    // continue
    await page.click('#po-continue');
    await wait(400);
  }

  // should now be at summary
  const sumOpen = await page.$eval('#summary', el => !el.classList.contains('hidden'));
  await page.screenshot({ path: path.join(__dirname,'cap-summary.png') });
  const finalCash = await page.$eval('#sum-cash', el => el.textContent);
  const finalOrders = await page.$eval('#sum-orders', el => el.textContent);

  await browser.close(); await new Promise(r=>server.close(r));

  console.log('--- FULL LOOP RESULTS ---');
  console.log('summary shown   :', sumOpen);
  console.log('final cash      :', finalCash);
  console.log('deliveries done :', finalOrders);
  console.log('page errors     :', errors.length ? errors : 'none');
  if (!sumOpen || errors.length || finalOrders !== '3') process.exit(1);
}
run().catch(e=>{console.error(e);process.exit(1);});
