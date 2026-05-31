// Multi-shot capture to judge the streetscape from several angles.
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

async function hold(page, keys, ms){ for(const k of keys) await page.keyboard.down(k); await wait(ms); for(const k of keys) await page.keyboard.up(k); }

async function run(){
  await new Promise(r=>server.listen(0,r));
  const port = server.address().port;
  const browser = await puppeteer.launch({ executablePath:CHROME, headless:'new',
    args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'],
    defaultViewport:{width:1280,height:800} });
  const page = await browser.newPage();
  await page.goto(`http://localhost:${port}/`, { waitUntil:'load' });
  await page.waitForSelector('#start-btn');
  await page.waitForFunction(()=>!document.getElementById('start-btn').disabled).catch(()=>{});
  await page.click('#start-btn');
  await wait(500);
  await page.keyboard.press('e'); // accept
  await wait(300);

  await hold(page, ['w'], 1100);
  await wait(200);
  await page.screenshot({ path: path.join(__dirname,'cap-1-street.png') });

  await hold(page, ['a','w'], 1400); // turn + go
  await wait(200);
  await page.screenshot({ path: path.join(__dirname,'cap-2-turn.png') });

  await hold(page, ['d'], 700);
  await hold(page, ['w'], 600);
  await page.screenshot({ path: path.join(__dirname,'cap-3.png') });

  await browser.close(); await new Promise(r=>server.close(r));
  console.log('captured');
}
run().catch(e=>{console.error(e);process.exit(1);});
