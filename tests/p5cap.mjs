// Capture an aerial alignment shot + a street shot with mixed traffic.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import puppeteer from 'puppeteer-core';
const __dirname = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.resolve(__dirname, '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml' };
const wait = ms => new Promise(r => setTimeout(r, ms));
const srv = http.createServer((q,s)=>{ let p=decodeURIComponent(q.url.split('?')[0]); if(p==='/')p='/index.html';
  fs.readFile(path.join(ROOT,p),(e,d)=>{ if(e){s.writeHead(404);s.end();return;} s.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'});s.end(d);});});
async function hold(page,keys,ms){ for(const k of keys) await page.keyboard.down(k); await wait(ms); for(const k of keys) await page.keyboard.up(k); }
async function run(){
  await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'],defaultViewport:{width:1280,height:800}});
  const pg=await b.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(`http://localhost:${port}/?dev=1`,{waitUntil:'load'});
  await pg.waitForSelector('#start-btn'); await pg.waitForFunction(()=>!document.getElementById('start-btn').disabled).catch(()=>{});
  await pg.click('#start-btn'); await wait(300);
  // midday for clarity + let traffic spread out
  await pg.evaluate(()=>{ const d=window.__demo; d.dayNight.t=0.3; d.dayNight.apply(0); });
  await wait(2500);
  // aerial top-down
  await pg.evaluate(()=>{ const d=window.__demo; d.setFreeze(true); const c=d.camera; c.position.set(0,230,40); c.up.set(0,0,-1); c.lookAt(0,0,0); });
  await wait(400);
  await pg.screenshot({path:path.join(__dirname,'p5-aerial.png')});
  // back to gameplay cam, drive a bit for a street shot with traffic
  await pg.evaluate(()=>{ const d=window.__demo; const c=d.camera; c.up.set(0,1,0); d.setFreeze(false);
    d.avatar.mesh.position.set(d.bike.position.x,0,d.bike.position.z); });
  await pg.keyboard.press('f'); await wait(200);
  await hold(pg,['w'],1400);
  await pg.screenshot({path:path.join(__dirname,'p5-street.png')});
  await b.close(); await new Promise(r=>srv.close(r));
  console.log('captured; errors:', errs.length?errs:'none');
}
run().catch(e=>{console.error(e);process.exit(1);});
