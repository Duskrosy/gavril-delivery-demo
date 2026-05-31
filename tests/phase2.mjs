// Headless integration test (phase 2 + 3): on-foot start, mount, clock-in
// gating, pickup, forced crash -> destroyed -> remake, refuel, eat, solid
// collision push-out, day/night phase change, and a full shift to summary.
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
const server = http.createServer((req,res)=>{ let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/')p='/index.html';
  fs.readFile(path.join(ROOT,p),(e,d)=>{ if(e){res.writeHead(404);res.end();return;} res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'});res.end(d);});});
const shot = (page,name)=>page.screenshot({ path: path.join(__dirname, name) });
const tp = (page, kind) => page.evaluate((k)=>{ const {bike,world}=window.__demo;
  const t = k==='hub'?world.clockInPos : k==='rest'?world.restaurantPos : world.gasStations[0].position3;
  bike.mesh.position.set(t.x,0,t.z); bike.speed=0; }, kind);

async function run(){
  await new Promise(r=>server.listen(0,r)); const port=server.address().port;
  const browser=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'],defaultViewport:{width:1280,height:800}});
  const page=await browser.newPage();
  const errors=[]; page.on('pageerror',e=>errors.push('PAGEERROR: '+e.message));
  await page.goto(`http://localhost:${port}/?dev=1`,{waitUntil:'load'});
  await page.waitForSelector('#start-btn'); await page.waitForFunction(()=>!document.getElementById('start-btn').disabled).catch(()=>{});
  await page.click('#start-btn'); await wait(400);
  const R={};
  R.startMode = await page.$eval('#mode-text',el=>el.textContent);
  R.startOffShift = await page.evaluate(()=>window.__demo.game.state);
  await shot(page,'p2-foot.png');

  // mount
  await page.evaluate(()=>{ const {avatar,bike}=window.__demo; avatar.mesh.position.set(bike.position.x,0,bike.position.z); });
  await page.keyboard.press('f'); await wait(250);
  R.riding = await page.evaluate(()=>window.__demo.mount.isRiding);

  // out-of-gas: can still push (crawl) and the rider dismounts to push
  await page.evaluate(()=>window.__demo.needs.setGas(0)); await wait(200);
  R.canPushEmpty = await page.evaluate(()=>{ const d=window.__demo; return d.needs.engineCut && d.needs.bikeSpeedMult>0; });
  R.pushVisual = await page.evaluate(()=>window.__demo.avatar.mesh.visible===true);
  await shot(page,'p4-push.png');
  await page.evaluate(()=>window.__demo.needs.setGas(100)); await wait(100);

  // traffic sanity + vehicle variety
  R.carCount = await page.evaluate(()=>window.__demo.traffic.cars.length);
  R.lightAxis = await page.evaluate(()=>typeof window.__demo.traffic.light.goAxis);
  R.vehicleKinds = await page.evaluate(()=>[...new Set(window.__demo.traffic.cars.map(c=>c.kind))].sort());
  R.lightCount = await page.evaluate(()=>window.__demo.traffic.lights.length);
  // anti-deadlock: park the player far away (so cars don't yield to it), then
  // count cars that travel over a window long enough that the light cycles
  // green for every approach. Uses world position (robust to turns/wraps).
  R.carsMoving = await page.evaluate(async ()=>{ const {traffic,bike}=window.__demo; const cars=traffic.cars;
    bike.mesh.position.set(108,0,108);
    const before=cars.map(c=>({x:c._wx,z:c._wz}));
    await new Promise(r=>setTimeout(r,8000));
    return cars.filter((c,i)=>Math.hypot(c._wx-before[i].x, c._wz-before[i].z) > 8).length; });

  // orbit camera responds to look + zoom
  R.orbitCam = await page.evaluate(()=>{ const c=window.__demo.orbitCam;
    const y0=c.yaw; c.addLook(120,40); const looked=Math.abs(c.yaw-y0)>0.1 && c.pitch!==undefined;
    const d0=c.targetDist; c.zoom(5); return looked && c.targetDist!==d0; });
  // driver personalities + NPC agents present
  R.aggrCount = await page.evaluate(()=>window.__demo.traffic.cars.filter(c=>c.aggressive).length);
  R.haterCount = await page.evaluate(()=>window.__demo.traffic.cars.filter(c=>c.hatesBikes).length);
  R.agentCount = await page.evaluate(()=>window.__demo.world.agentSolids().length);
  // pedestrian/agent collision pushes the player out
  R.pedPush = await page.evaluate(async ()=>{ const {bike,world}=window.__demo; const a=world.agentSolids()[0];
    bike.mesh.position.set(a.x,0,a.z); await new Promise(r=>setTimeout(r,200));
    return Math.hypot(bike.position.x-a.x, bike.position.z-a.z) > 1; });

  // clock in at the hub
  await tp(page,'hub'); await wait(200);
  await page.keyboard.press('e'); await wait(250);
  R.clockedIn = await page.evaluate(()=>window.__demo.game.onShift);
  R.stateAfterClockIn = await page.evaluate(()=>window.__demo.game.state);

  // accept + pickup
  await page.evaluate(()=>document.getElementById('oc-accept').click()); await wait(150);
  await tp(page,'rest'); await wait(300);
  R.carryingAfterPickup = await page.evaluate(()=>window.__demo.game.foodState);

  // forced crash — retry against fresh (moving) car positions until it lands
  R.foodAfterCrash = await page.evaluate(async ()=>{ const {bike,traffic,game}=window.__demo;
    for (let k=0; k<25 && game.foodState!=='destroyed'; k++){
      const c = traffic.cars[k % traffic.cars.length];
      bike.mesh.position.set(c._wx, 0, c._wz); bike.speed = 26;
      bike.headingVec.set(c.axis==='z' ? 0 : (c.dir>0?-1:1), 0, c.axis==='z' ? (c.dir>0?-1:1) : 0);
      await new Promise(r=>setTimeout(r,90));
    }
    return game.foodState; });
  await shot(page,'p2-crash.png');
  // remake
  await tp(page,'rest'); await wait(300);
  R.foodAfterRemake = await page.evaluate(()=>window.__demo.game.foodState);

  // refuel
  R.gasRose = await page.evaluate(async ()=>{ const {needs,world,bike}=window.__demo; needs.setGas(10); const b=needs.gas;
    bike.mesh.position.set(world.gasStations[0].position3.x,0,world.gasStations[0].position3.z); await new Promise(r=>setTimeout(r,600)); return needs.gas>b; });
  // eat
  await page.evaluate(()=>{ const {needs,world,bike}=window.__demo; needs.setHunger(20); bike.mesh.position.set(world.restaurantPos.x,0,world.restaurantPos.z); });
  await page.keyboard.press('e'); await wait(150);
  R.hungerAfterEat = await page.evaluate(()=>window.__demo.needs.hunger);

  // solid collision: drop the bike inside a building and confirm it's pushed out
  R.pushedOut = await page.evaluate(async ()=>{ const {bike,world}=window.__demo; const s=world.solids[0];
    bike.mesh.position.set(s.x,0,s.z); await new Promise(r=>setTimeout(r,200));
    return Math.hypot(bike.position.x-s.x, bike.position.z-s.z) > 1; });

  // day/night: force midday for a daytime screenshot, confirm phase changes
  const nightPhase = await page.evaluate(()=>window.__demo.dayNight.phase);
  await page.evaluate(()=>{ const {dayNight}=window.__demo; dayNight.t=0.3; dayNight.apply(0); });
  await wait(120); await shot(page,'p3-day.png');
  const dayPhase = await page.evaluate(()=>window.__demo.dayNight.phase);
  R.dayNightChanges = nightPhase !== dayPhase;
  // back to dusk for the rest
  await page.evaluate(()=>{ const {dayNight}=window.__demo; dayNight.t=0.78; dayNight.apply(0); });

  // finish the shift
  R.summaryReached = await page.evaluate(async ()=>{ const {game,bike,world,STATES}=window.__demo; const w=ms=>new Promise(r=>setTimeout(r,ms));
    let guard=0;
    while(game.state!==STATES.SHIFT_DONE && guard++<30){
      if(game.state===STATES.OFFER){ document.getElementById('oc-accept').click(); await w(60); }
      if(game.state===STATES.TO_RESTAURANT){ bike.mesh.position.set(world.restaurantPos.x,0,world.restaurantPos.z); await w(120); }
      else if(game.state===STATES.TO_HOUSE){
        if(game.needsRemake){ bike.mesh.position.set(world.restaurantPos.x,0,world.restaurantPos.z); await w(120); }
        else { const h=world.houses[game.current.houseId]; bike.mesh.position.set(h.position3.x,0,h.position3.z); await w(200);
          const b=document.querySelector('#vg-choices .choice-btn'); if(b) b.click(); await w(150);
          const c=document.getElementById('po-continue'); if(c) c.click(); await w(150); }
      }
    }
    return game.state===STATES.SHIFT_DONE; });
  await wait(300); await shot(page,'p2-summary.png');

  await browser.close(); await new Promise(r=>server.close(r));
  console.log('--- PHASE 2+3 RESULTS ---');
  for(const [k,v] of Object.entries(R)) console.log(k.padEnd(20),':',v);
  console.log('page errors'.padEnd(20),':', errors.length?errors:'none');
  const ok = R.startMode==='ON FOOT' && R.startOffShift==='OFF_SHIFT' && R.riding===true &&
    R.canPushEmpty===true && R.pushVisual===true && R.carCount===36 && R.lightAxis==='string' &&
    R.vehicleKinds.includes('moto') && R.vehicleKinds.length>=4 && R.lightCount===6 && R.carsMoving>=24 &&
    R.orbitCam===true && R.aggrCount>=1 && R.haterCount>=1 && R.agentCount>=38 && R.pedPush===true &&
    R.clockedIn===true && R.stateAfterClockIn==='OFFER' && R.carryingAfterPickup==='fresh' &&
    R.foodAfterCrash==='destroyed' && R.foodAfterRemake==='fresh' && R.gasRose===true &&
    R.hungerAfterEat>95 && R.pushedOut===true && R.dayNightChanges===true &&
    R.summaryReached===true && errors.length===0;
  console.log('ALL CHECKS PASS'.padEnd(20),':',ok);
  if(!ok) process.exit(1);
}
run().catch(e=>{console.error(e);process.exit(1);});
