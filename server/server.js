// ============================================================
//  GAVRIL — One Shift · multiplayer relay server
//  A single shared room. Assigns each player a random name + color,
//  relays position/state snapshots to everyone ~15x/sec. No build step.
//  Run:  node server.js   (PORT env respected; defaults to 8080)
// ============================================================

const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;

const ADJ = ['Swift', 'Neon', 'Midnight', 'Turbo', 'Lunar', 'Crimson', 'Volt', 'Mellow',
  'Rapid', 'Pixel', 'Cosmic', 'Drift', 'Hazy', 'Ember', 'Frost', 'Jade', 'Solar', 'Onyx'];
const NOUN = ['Rider', 'Fox', 'Moth', 'Comet', 'Noodle', 'Falcon', 'Otter', 'Vapor', 'Ramen',
  'Sprocket', 'Koi', 'Jet', 'Maple', 'Cyclone', 'Dumpling', 'Heron', 'Pylon', 'Mochi'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const randomName = () => pick(ADJ) + pick(NOUN) + (Math.random() < 0.5 ? '' : Math.floor(Math.random() * 90 + 10));

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (x) => Math.round(255 * x).toString(16).padStart(2, '0');
  return '#' + to(f(0)) + to(f(8)) + to(f(4));
}
const randomColor = () => hslToHex(Math.floor(Math.random() * 360), 68, 64);

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Gavril: One Shift — multiplayer server is up. ' + players.size + ' online.');
});
const wss = new WebSocketServer({ server });
const players = new Map(); // ws -> player
let nextId = 1;

wss.on('connection', (ws) => {
  const p = { id: 'p' + (nextId++), name: randomName(), color: randomColor(),
    x: 0, z: 30, yaw: Math.PI, riding: false, carrying: 'none' };
  players.set(ws, p);
  ws.send(JSON.stringify({ t: 'welcome', id: p.id, name: p.name, color: p.color }));

  ws.on('message', (data) => {
    try {
      const m = JSON.parse(data);
      if (m.t === 'state') {
        p.x = +m.x || 0; p.z = +m.z || 0; p.yaw = +m.yaw || 0;
        p.riding = !!m.riding; p.carrying = m.carrying || 'none';
      } else if (m.t === 'chat') {
        const text = String(m.text || '').replace(/\s+/g, ' ').trim().slice(0, 80);
        if (!text) return;
        const out = JSON.stringify({ t: 'chat', id: p.id, name: p.name, text });
        for (const other of players.keys()) if (other !== ws && other.readyState === 1) other.send(out);
      }
    } catch { /* ignore bad frames */ }
  });
  ws.on('close', () => players.delete(ws));
  ws.on('error', () => players.delete(ws));
});

// broadcast a full snapshot ~15x/sec
setInterval(() => {
  if (players.size === 0) return;
  const arr = [];
  for (const p of players.values()) arr.push({ id: p.id, name: p.name, color: p.color,
    x: p.x, z: p.z, yaw: p.yaw, riding: p.riding, carrying: p.carrying });
  const msg = JSON.stringify({ t: 'players', players: arr });
  for (const ws of players.keys()) if (ws.readyState === 1) ws.send(msg);
}, 66);

server.listen(PORT, () => console.log('Gavril MP server listening on :' + PORT));
