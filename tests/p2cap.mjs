import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json' };
const wait = ms => new Promise(r => setTimeout(r, ms));
const server = http.createServer((req,res)=>{ let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/')p='/index.html';
  fs.readFile(path.join(ROOT,p),(e,d)=>{ if(e){res.writeHead(404);res.end();return;} res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'});res.end(d);});});
async function hold(page,keys,ms){ for(const k of keys) await page.keyboard.down(k); await wait(ms); for(const k of keys) await page.keyboard.up(k); }
async function run(){
  await new Promise(r=>server.listen(0,r)); const port=server.address().port;
  const browser=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'],defaultViewport:{width:1280,height:800}});
  const page=await browser.newPage();
  await page.goto(`http://localhost:${port}/?dev=1`,{waitUntil:'load'});
  await page.waitForSelector('#start-btn'); await page.waitForFunction(()=>!document.getElementById('start-btn').disabled).catch(()=>{});
  await page.click('#start-btn'); await wait(300);
  await page.keyboard.press('e'); // accept (so order card hides)
  await wait(150);
  // place avatar on a clear road spot, then walk a moment on foot
  await page.evaluate(()=>{ const {avatar}=window.__demo; avatar.mesh.position.set(12,0,30); avatar.yaw=Math.PI; });
  await hold(page,['w'],700);
  await page.screenshot({path:path.join(__dirname,'p2-walk.png')});
  // mount the bike on an open road stretch (x=-24, heading -z) then cruise
  await page.evaluate(()=>{ const {avatar,bike}=window.__demo; bike.mesh.position.set(-24,0,44); bike.yaw=Math.PI; avatar.mesh.position.set(-24,0,44); });
  await page.keyboard.press('f'); await wait(200);
  const vis = await page.evaluate(()=>{ const {avatar,bike}=window.__demo; return { avatarVisible: avatar.mesh.visible, riderVisible: bike.mesh.userData.rider.visible }; });
  await hold(page,['w'],900);
  await page.screenshot({path:path.join(__dirname,'p2-drive.png')});
  await browser.close(); await new Promise(r=>server.close(r));
  console.log('avatar hidden while riding:', vis.avatarVisible===false);
  console.log('bike rider visible       :', vis.riderVisible===true);
}
run().catch(e=>{console.error(e);process.exit(1);});
