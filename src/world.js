// ============================================================
//  GAVRIL — One Shift · world.js
//  Builds the stylized low-poly night city: ground + roads, blocks
//  of buildings, four landmarks, the restaurant hub, customer houses,
//  streetlight glow, fog and lighting. Returns handles + an update().
// ============================================================

import * as THREE from 'three';
import { PALETTE, WORLD, LANDMARKS, HOUSES, TUNING,
  GAS_STATIONS, FOOD_STANDS, TRAFFIC_LIGHT, SPEED_BUMPS, SPAWN } from './config.js';

const C = (hex) => new THREE.Color(hex);

// --- deterministic pseudo-random (so the city looks the same each load) ---
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// --- ground texture: dark asphalt with a faint road grid ---
function makeGroundTexture() {
  const N = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = N;
  const ctx = canvas.getContext('2d');

  // dark block base
  ctx.fillStyle = '#0d0916';
  ctx.fillRect(0, 0, N, N);

  const half = WORLD.half;
  const toPx = (w) => ((w + half) / (2 * half)) * N;
  const roadW = ((WORLD.roadWidth ?? 9) / (2 * half)) * N;

  // road network on the block grid — lighter than the blocks so streets read
  ctx.fillStyle = '#241c38';
  for (let g = -half; g <= half; g += WORLD.blockSpacing) {
    const p = toPx(g);
    ctx.fillRect(p - roadW / 2, 0, roadW, N);   // vertical road
    ctx.fillRect(0, p - roadW / 2, N, roadW);   // horizontal road
  }

  // sidewalk borders — a lighter strip just outside each road edge
  ctx.fillStyle = '#322a48';
  const swW = (1.6 / (2 * half)) * N;
  for (let g = -half; g <= half; g += WORLD.blockSpacing) {
    const p = toPx(g);
    for (const e of [-roadW / 2 - swW, roadW / 2]) {
      ctx.fillRect(p + e, 0, swW, N);
      ctx.fillRect(0, p + e, N, swW);
    }
  }

  // dashed centre lines (brighter cyan)
  ctx.strokeStyle = 'rgba(111,210,230,0.34)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([16, 18]);
  for (let g = -half; g <= half; g += WORLD.blockSpacing) {
    const p = toPx(g);
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, N); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(N, p); ctx.stroke();
  }
  ctx.setLineDash([]);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// little emissive "lit windows" sprinkled on a building face
function addWindows(group, w, h, d, rng) {
  const litMat = new THREE.MeshStandardMaterial({
    color: C(PALETTE.reward), emissive: C(PALETTE.reward),
    emissiveIntensity: .72, roughness: .5,
  });
  const dimMat = new THREE.MeshStandardMaterial({
    color: C('#2a2440'), emissive: C(PALETTE.system),
    emissiveIntensity: .12, roughness: .8,
  });
  const cols = Math.max(2, Math.floor(w / 2.4));
  const rows = Math.max(2, Math.floor(h / 3.2));
  const geo = new THREE.PlaneGeometry(1.1, 1.6);
  for (const sign of [1, -1]) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rng() > 0.62) continue;
        const m = new THREE.Mesh(geo, rng() > 0.55 ? litMat : dimMat);
        const x = -w / 2 + 1.2 + c * (w - 2.4) / Math.max(1, cols - 1);
        const y = 2 + r * (h - 3) / Math.max(1, rows - 1);
        m.position.set(x, y, sign * (d / 2 + 0.02));
        if (sign < 0) m.rotation.y = Math.PI;
        group.add(m);
      }
    }
  }
}

function makeBuilding(w, h, d, baseHex, rng) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: C(baseHex), roughness: .9, metalness: .05,
    emissive: C(PALETTE.system), emissiveIntensity: .07 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  body.position.y = h / 2;
  body.castShadow = true; body.receiveShadow = true;
  group.add(body);
  // a slightly inset roof cap for a low-poly read
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.86, h * 0.06, d * 0.86),
    new THREE.MeshStandardMaterial({ color: C(PALETTE.panel2), roughness: .9 })
  );
  cap.position.y = h + h * 0.03; cap.castShadow = true;
  group.add(cap);
  addWindows(group, w, h, d, rng);
  return group;
}

// --- landmarks -------------------------------------------------------------
function makeClockTower(color) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.BoxGeometry(7, 30, 7),
    new THREE.MeshStandardMaterial({ color: C(PALETTE.panel2), roughness: .85 })
  );
  shaft.position.y = 15; shaft.castShadow = true; g.add(shaft);
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 24),
    new THREE.MeshStandardMaterial({ color: C('#efe9ff'), emissive: C(color), emissiveIntensity: 1.2 })
  );
  face.position.set(0, 26, 3.55); g.add(face);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(5.6, 6, 4),
    new THREE.MeshStandardMaterial({ color: C(color), emissive: C(color), emissiveIntensity: .5, roughness: .6 })
  );
  roof.position.y = 33; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof);
  return g;
}
function makeFountain(color) {
  const g = new THREE.Group();
  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 7.6, 1.6, 28),
    new THREE.MeshStandardMaterial({ color: C(PALETTE.panel2), roughness: .8 })
  );
  basin.position.y = .8; basin.receiveShadow = true; g.add(basin);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6, .4, 28),
    new THREE.MeshStandardMaterial({ color: C(color), emissive: C(color), emissiveIntensity: .8, roughness: .2 })
  );
  water.position.y = 1.5; g.add(water);
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(.6, .9, 5, 12),
    new THREE.MeshStandardMaterial({ color: C('#d9d2ec'), emissive: C(color), emissiveIntensity: .3 })
  );
  stem.position.y = 4; g.add(stem);
  const top = new THREE.Mesh(
    new THREE.SphereGeometry(1.2, 16, 12),
    new THREE.MeshStandardMaterial({ color: C(color), emissive: C(color), emissiveIntensity: 1.1 })
  );
  top.position.y = 6.6; g.add(top);
  return g;
}
function makeNeonSign(color) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 20, 1.2),
    new THREE.MeshStandardMaterial({ color: C(PALETTE.panel2), roughness: .8 })
  );
  pole.position.y = 10; pole.castShadow = true; g.add(pole);
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(14, 8, 1),
    new THREE.MeshStandardMaterial({ color: C(PALETTE.panel), emissive: C(color), emissiveIntensity: 1.3, roughness: .4 })
  );
  panel.position.y = 20; g.add(panel);
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(14.6, 8.6, .6),
    new THREE.MeshStandardMaterial({ color: C(color), emissive: C(color), emissiveIntensity: .7 })
  );
  frame.position.set(0, 20, -.4); g.add(frame);
  return g;
}
function makePark(color) {
  const g = new THREE.Group();
  const lawn = new THREE.Mesh(
    new THREE.CylinderGeometry(11, 11, .5, 6),
    new THREE.MeshStandardMaterial({ color: C('#1c3326'), emissive: C(color), emissiveIntensity: .08, roughness: .95 })
  );
  lawn.position.y = .25; lawn.receiveShadow = true; g.add(lawn);
  const rng = makeRng(99);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const r = 3 + rng() * 5;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(.4, .5, 3, 6),
      new THREE.MeshStandardMaterial({ color: C('#3a2b22'), roughness: 1 })
    );
    trunk.position.set(Math.cos(a) * r, 1.5, Math.sin(a) * r); g.add(trunk);
    const foliage = new THREE.Mesh(
      new THREE.ConeGeometry(2.2, 4.5, 7),
      new THREE.MeshStandardMaterial({ color: C('#2f6b46'), emissive: C(color), emissiveIntensity: .12, roughness: .9 })
    );
    foliage.position.set(Math.cos(a) * r, 5, Math.sin(a) * r); foliage.castShadow = true; g.add(foliage);
  }
  return g;
}

const LANDMARK_BUILDERS = { clock: makeClockTower, fountain: makeFountain, neon: makeNeonSign, park: makePark };

// --- restaurant ------------------------------------------------------------
function makeRestaurant() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(14, 9, 12),
    new THREE.MeshStandardMaterial({ color: C(PALETTE.panel2), roughness: .7,
      emissive: C(PALETTE.action), emissiveIntensity: .18 })
  );
  body.position.y = 4.5; body.castShadow = true; body.receiveShadow = true; g.add(body);
  // glowing awning
  const awn = new THREE.Mesh(
    new THREE.BoxGeometry(15, 1, 4),
    new THREE.MeshStandardMaterial({ color: C(PALETTE.action), emissive: C(PALETTE.action), emissiveIntensity: 1.0 })
  );
  awn.position.set(0, 7.2, 6.6); g.add(awn);
  // floating sign
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(9, 3, .6),
    new THREE.MeshStandardMaterial({ color: C(PALETTE.panel), emissive: C(PALETTE.action), emissiveIntensity: 1.5, roughness: .4 })
  );
  sign.position.set(0, 12.5, 0); g.add(sign);
  // beacon beam
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(.5, 2.4, 26, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: C(PALETTE.action), transparent: true, opacity: .12,
      side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.y = 19; g.add(beam);
  // local light pop
  const pt = new THREE.PointLight(C(PALETTE.action), 30, 55, 2);
  pt.position.set(0, 11, 0); g.add(pt);
  g.userData.beam = beam;
  return g;
}

// --- house -----------------------------------------------------------------
function makeHouse(accentHex) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(9, 7, 9),
    new THREE.MeshStandardMaterial({ color: C(PALETTE.panel), roughness: .9 })
  );
  body.position.y = 3.5; body.castShadow = true; body.receiveShadow = true; g.add(body);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(7.2, 3.6, 4),
    new THREE.MeshStandardMaterial({ color: C(PALETTE.panel2), roughness: .85 })
  );
  roof.position.y = 8.8; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof);
  // accent door (matches the landmark colour — the visual "address")
  const doorMat = new THREE.MeshStandardMaterial({
    color: C(accentHex), emissive: C(accentHex), emissiveIntensity: .6, roughness: .5,
  });
  const door = new THREE.Mesh(new THREE.BoxGeometry(2, 3.4, .3), doorMat);
  door.position.set(0, 1.7, 4.6); g.add(door);
  // porch lamp
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(.5, 12, 10),
    new THREE.MeshStandardMaterial({ color: C(PALETTE.reward), emissive: C(PALETTE.reward), emissiveIntensity: 1.4 })
  );
  lamp.position.set(1.6, 4.4, 4.7); g.add(lamp);
  g.userData.doorMat = doorMat;
  g.userData.accent = accentHex;
  return g;
}

// --- streetlight (emissive only; glow comes from bloom) --------------------
function makeStreetlight() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(.18, .24, 7, 8),
    new THREE.MeshStandardMaterial({ color: C('#2a2438'), roughness: .7 })
  );
  post.position.y = 3.5; g.add(post);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(.42, 14, 12),
    new THREE.MeshStandardMaterial({ color: C(PALETTE.reward), emissive: C(PALETTE.reward), emissiveIntensity: 1.15 })
  );
  head.position.y = 7.1; g.add(head);
  // small shade so the source reads as a lamp, tightening the bloom halo
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(.55, .5, 10),
    new THREE.MeshStandardMaterial({ color: C('#2a2438'), roughness: .8 })
  );
  shade.position.y = 7.55; g.add(shade);
  return g;
}

// --- waypoint marker (driven by main.js) -----------------------------------
function makeMarker() {
  const g = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({ color: C(PALETTE.nav), transparent: true, opacity: .9, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.32, 8, 40), ringMat);
  ring.rotation.x = Math.PI / 2; ring.position.y = .4; g.add(ring);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(.6, .6, 40, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: C(PALETTE.nav), transparent: true, opacity: .14, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.y = 20; g.add(beam);
  g.userData.ring = ring; g.userData.ringMat = ringMat; g.userData.beam = beam;
  g.visible = false;
  return g;
}

// --- gas station -----------------------------------------------------------
function makeGasStation() {
  const g = new THREE.Group();
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(12, 0.3, 12),
    new THREE.MeshStandardMaterial({ color: C('#1a1530'), roughness: .8, emissive: C(PALETTE.nav), emissiveIntensity: .05 })
  );
  pad.position.y = 0.15; pad.receiveShadow = true; g.add(pad);
  // canopy
  for (const [x, z] of [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.25, .25, 6, 8), new THREE.MeshStandardMaterial({ color: C('#2a2438'), roughness: .7 }));
    post.position.set(x, 3, z); g.add(post);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(12, 0.6, 12),
    new THREE.MeshStandardMaterial({ color: C(PALETTE.panel2), roughness: .6, emissive: C(PALETTE.nav), emissiveIntensity: .35 }));
  roof.position.y = 6.2; roof.castShadow = true; g.add(roof);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.4, 12.4),
    new THREE.MeshStandardMaterial({ color: C(PALETTE.nav), emissive: C(PALETTE.nav), emissiveIntensity: 1.1 }));
  trim.position.y = 5.9; g.add(trim);
  // pumps
  for (const x of [-2.4, 2.4]) {
    const pump = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1.2), new THREE.MeshStandardMaterial({ color: C('#241d39'), roughness: .6 }));
    pump.position.set(x, 1.2, 0); pump.castShadow = true; g.add(pump);
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.5), new THREE.MeshStandardMaterial({ color: C(PALETTE.nav), emissive: C(PALETTE.nav), emissiveIntensity: 1.2 }));
    disp.position.set(x, 1.7, 0.62); g.add(disp);
  }
  // floating sign
  const sign = new THREE.Mesh(new THREE.BoxGeometry(4, 1.4, .4),
    new THREE.MeshStandardMaterial({ color: C(PALETTE.panel), emissive: C(PALETTE.nav), emissiveIntensity: 1.4, roughness: .4 }));
  sign.position.set(0, 8.2, 0); g.add(sign);
  return g;
}

// --- food stand ------------------------------------------------------------
function makeFoodStand() {
  const g = new THREE.Group();
  const cart = new THREE.Mesh(new THREE.BoxGeometry(4, 2.2, 2.4),
    new THREE.MeshStandardMaterial({ color: C(PALETTE.panel2), roughness: .7, emissive: C(PALETTE.reward), emissiveIntensity: .15 }));
  cart.position.y = 1.3; cart.castShadow = true; g.add(cart);
  const awning = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.3, 3),
    new THREE.MeshStandardMaterial({ color: C(PALETTE.reward), emissive: C(PALETTE.reward), emissiveIntensity: .8 }));
  awning.position.set(0, 2.8, 0.3); awning.rotation.x = -0.12; g.add(awning);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1, .3),
    new THREE.MeshStandardMaterial({ color: C(PALETTE.panel), emissive: C(PALETTE.reward), emissiveIntensity: 1.3, roughness: .4 }));
  sign.position.set(0, 4.2, 0); g.add(sign);
  return g;
}

// --- traffic light (returns lamp materials for the controller) -------------
function makeTrafficLight() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.3, .35, 10, 10), new THREE.MeshStandardMaterial({ color: C('#2a2438'), roughness: .7 }));
  pole.position.y = 5; pole.castShadow = true; g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(.3, .3, 5), new THREE.MeshStandardMaterial({ color: C('#2a2438'), roughness: .7 }));
  arm.position.set(0, 9.5, 2.5); g.add(arm);
  const housing = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.2, 1.2), new THREE.MeshStandardMaterial({ color: C('#15101f'), roughness: .6 }));
  housing.position.set(0, 8.6, 5); g.add(housing);
  const mk = (color, y) => {
    const m = new THREE.MeshStandardMaterial({ color: C(color), emissive: C(color), emissiveIntensity: .04 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(.42, 14, 12), m);
    lamp.position.set(0, y, 5.62); g.add(lamp);
    return m;
  };
  const redMat = mk('#ff5a6e', 9.6);
  const yellowMat = mk('#ffc864', 8.6);
  const greenMat = mk('#8de0b0', 7.6);
  return { group: g, redMat, yellowMat, greenMat };
}

// --- speed bump ------------------------------------------------------------
function makeSpeedBump(axis) {
  const g = new THREE.Group();
  const long = (WORLD.roadWidth ?? 9) - 1, narrow = 1.8;
  const w = axis === 'z' ? long : narrow;   // spans perpendicular to travel
  const d = axis === 'z' ? narrow : long;
  const hump = new THREE.Mesh(new THREE.BoxGeometry(w, 0.45, d),
    new THREE.MeshStandardMaterial({ color: C('#15101f'), roughness: .8 }));
  hump.position.y = 0.22; hump.receiveShadow = true; g.add(hump);
  // warning stripes
  const stripeMat = new THREE.MeshStandardMaterial({ color: C(PALETTE.reward), emissive: C(PALETTE.reward), emissiveIntensity: .5, roughness: .6 });
  const n = 4;
  for (let i = 0; i < n; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(axis === 'z' ? long / (n * 2) : narrow + .1, 0.48, axis === 'z' ? narrow + .1 : long / (n * 2)), stripeMat);
    const off = (i - (n - 1) / 2) * (axis === 'z' ? long / n : long / n);
    s.position.set(axis === 'z' ? off : 0, 0.24, axis === 'z' ? 0 : off);
    g.add(s);
  }
  return g;
}

// --- pedestrian (decorative) -----------------------------------------------
function makePedestrian(colorHex) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.5, 0.6),
    new THREE.MeshStandardMaterial({ color: C(colorHex), roughness: .8 }));
  body.position.y = 1.4; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshStandardMaterial({ color: C('#d7b0ec'), roughness: .8 }));
  head.position.y = 2.45; g.add(head);
  g.scale.setScalar(0.8);
  return g;
}

// --- NPC delivery couriers --------------------------------------------------
// A rider on a little scooter (roaming the city).
function makeCourier(colorHex) {
  const g = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 1.8),
    new THREE.MeshStandardMaterial({ color: C(colorHex), roughness: .5, metalness: .2 }));
  deck.position.y = 0.55; deck.castShadow = true; g.add(deck);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8), new THREE.MeshStandardMaterial({ color: C('#221a30') }));
  col.position.set(0, 1.1, 0.8); col.rotation.x = -0.2; g.add(col);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8), new THREE.MeshStandardMaterial({ color: C('#221a30') }));
  bar.position.set(0, 1.6, 0.75); bar.rotation.z = Math.PI / 2; g.add(bar);
  const tire = new THREE.MeshStandardMaterial({ color: C('#0c0912'), roughness: .95 });
  for (const z of [0.8, -0.8]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.22, 14), tire); w.rotation.z = Math.PI / 2; w.position.set(0, 0.45, z); g.add(w); }
  const cloth = new THREE.MeshStandardMaterial({ color: C(colorHex), roughness: .7, emissive: C(colorHex), emissiveIntensity: .08 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.6, 4, 8), cloth); torso.position.set(0, 1.5, -0.1); torso.rotation.x = 0.2; torso.castShadow = true; g.add(torso);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12), new THREE.MeshStandardMaterial({ color: C('#1b1428'), roughness: .4, metalness: .2 })); helmet.position.set(0, 2.05, 0.05); g.add(helmet);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.MeshStandardMaterial({ color: C(PALETTE.panel2), emissive: C(PALETTE.reward), emissiveIntensity: .5, roughness: .5 })); box.position.set(0, 1.7, -0.7); g.add(box);
  g.scale.setScalar(0.85);
  return g;
}

// A courier standing/eating at a spot (with a delivery box on their back).
function makeHangoutNPC(colorHex) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.5, 0.6), new THREE.MeshStandardMaterial({ color: C(colorHex), roughness: .8 }));
  body.position.y = 1.4; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshStandardMaterial({ color: C('#d7b0ec'), roughness: .8 }));
  head.position.y = 2.45; g.add(head);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.5), new THREE.MeshStandardMaterial({ color: C(PALETTE.panel2), emissive: C(PALETTE.reward), emissiveIntensity: .4 }));
  box.position.set(0, 1.5, -0.45); g.add(box);
  g.scale.setScalar(0.9);
  return g;
}

// ===========================================================================
export function buildWorld(scene) {
  scene.background = C(PALETTE.bg);
  scene.fog = new THREE.Fog(C(PALETTE.bg), 60, 165);

  // lighting refs are returned so the day/night controller can drive them.
  const hemi = new THREE.HemisphereLight(C('#6a5fa0'), C('#1a1428'), 1.05);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(C('#b3a8e6'), 1.45);
  key.position.set(40, 80, 30);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const s = WORLD.half + 30;
  key.shadow.camera.left = -s; key.shadow.camera.right = s;
  key.shadow.camera.top = s; key.shadow.camera.bottom = -s;
  key.shadow.camera.near = 1; key.shadow.camera.far = 360;
  key.shadow.bias = -0.0004;
  scene.add(key);
  const fill = new THREE.DirectionalLight(C('#ffce8a'), 0.35);
  fill.position.set(-50, 24, -40);
  scene.add(fill);
  const ambient = new THREE.AmbientLight(C(PALETTE.system), 0.42);
  scene.add(ambient);

  // solids: AABB footprints the player cannot drive through
  const solids = [];
  const addSolid = (x, z, hx, hz) => solids.push({ x, z, hx, hz });

  // ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half * 2, WORLD.half * 2),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 1, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // reserved positions where buildings must not spawn
  const reserved = [
    { x: WORLD.restaurant.position.x, z: WORLD.restaurant.position.z, r: 14 },
    ...LANDMARKS.map(l => ({ x: l.position.x, z: l.position.z, r: 16 })),
    ...HOUSES.map(h => ({ x: h.position.x, z: h.position.z, r: 12 })),
    ...GAS_STATIONS.map(s => ({ x: s.position.x, z: s.position.z, r: 13 })),
    ...FOOD_STANDS.map(s => ({ x: s.position.x, z: s.position.z, r: 9 })),
    { x: TRAFFIC_LIGHT.position.x, z: TRAFFIC_LIGHT.position.z, r: 10 },
    { x: SPAWN.foot.x, z: SPAWN.foot.z, r: 8 },
    { x: SPAWN.bike.x, z: SPAWN.bike.z, r: 8 },
  ];
  const clear = (x, z) => reserved.every(p => Math.hypot(p.x - x, p.z - z) > p.r);

  // buildings: one per block-interior cell, jittered, skipping roads/reserved
  const rng = makeRng(20260601);
  const baseHexes = ['#2a2342', '#332a4f', '#241d39', '#3b3160'];
  const step = WORLD.blockSpacing;
  // one building per block, centred with small jitter and sized to stay clear
  // of the surrounding roads (block interior half-width ≈ (step-roadWidth)/2).
  const maxHalf = (step - WORLD.roadWidth) / 2 - 1.5; // ~ 6.75 for 30/12
  for (let bx = -WORLD.half + step / 2; bx < WORLD.half; bx += step) {
    for (let bz = -WORLD.half + step / 2; bz < WORLD.half; bz += step) {
      const x = bx + (rng() - .5) * 3;
      const z = bz + (rng() - .5) * 3;
      if (!clear(x, z)) continue;
      const half = 3 + rng() * (maxHalf - 3);
      const w = half * 2, d = (3 + rng() * (maxHalf - 3)) * 2, h = 9 + rng() * 26;
      const b = makeBuilding(w, h, d, baseHexes[(rng() * baseHexes.length) | 0], rng);
      b.position.set(x, 0, z);
      const rot = Math.floor(rng() * 4);
      b.rotation.y = rot * Math.PI / 2;
      scene.add(b);
      const swap = rot % 2 === 1;
      addSolid(x, z, (swap ? d : w) / 2 + 0.4, (swap ? w : d) / 2 + 0.4);
    }
  }

  // streetlights at road-intersection corners (just inside the block)
  const lampOff = WORLD.roadWidth / 2 + 2;
  for (let g = -WORLD.half + step; g < WORLD.half; g += step) {
    for (let h = -WORLD.half + step; h < WORLD.half; h += step) {
      if (rng() > .45) continue;
      const sl = makeStreetlight();
      sl.position.set(g + lampOff, 0, h + lampOff);
      scene.add(sl);
    }
  }

  // landmarks
  const landmarkObjs = {};
  for (const l of LANDMARKS) {
    const obj = (LANDMARK_BUILDERS[l.id] || makeNeonSign)(PALETTE[l.colorKey]);
    obj.position.set(l.position.x, 0, l.position.z);
    scene.add(obj);
    landmarkObjs[l.id] = { ...l, object: obj };
    addSolid(l.position.x, l.position.z, 6, 6);
  }

  // restaurant (also the clock-in hub)
  const restaurant = makeRestaurant();
  restaurant.position.set(WORLD.restaurant.position.x, 0, WORLD.restaurant.position.z);
  scene.add(restaurant);
  addSolid(WORLD.restaurant.position.x, WORLD.restaurant.position.z, 7.5, 6.5);

  // glowing clock-in pad in front of the restaurant
  const padMat = new THREE.MeshBasicMaterial({ color: C(PALETTE.action), transparent: true, opacity: .35, side: THREE.DoubleSide });
  const clockPad = new THREE.Mesh(new THREE.RingGeometry(4.4, 5.6, 36), padMat);
  clockPad.rotation.x = -Math.PI / 2;
  clockPad.position.set(WORLD.restaurant.position.x, 0.08, WORLD.restaurant.position.z + 11);
  scene.add(clockPad);
  const clockInPos = new THREE.Vector3(WORLD.restaurant.position.x, 0, WORLD.restaurant.position.z + 11);

  // houses (accent door colour follows the adjacent landmark)
  const houses = {};
  for (const h of HOUSES) {
    const lm = LANDMARKS.find(l => l.id === h.landmarkId);
    const accent = PALETTE[lm ? lm.colorKey : 'nav'];
    const obj = makeHouse(accent);
    obj.position.set(h.position.x, 0, h.position.z);
    // face the house toward the centre of the map
    obj.rotation.y = Math.atan2(-h.position.x, -h.position.z);
    scene.add(obj);
    houses[h.id] = { ...h, object: obj, position3: new THREE.Vector3(h.position.x, 0, h.position.z) };
    addSolid(h.position.x, h.position.z, 5, 5);
  }

  // gas stations
  const gasStations = GAS_STATIONS.map(stn => {
    const obj = makeGasStation();
    obj.position.set(stn.position.x, 0, stn.position.z);
    scene.add(obj);
    return { ...stn, object: obj, position3: new THREE.Vector3(stn.position.x, 0, stn.position.z) };
  });

  // food stands (eat at any of them, or at the restaurant)
  const foodStands = FOOD_STANDS.map(st => {
    const obj = makeFoodStand();
    obj.position.set(st.position.x, 0, st.position.z);
    obj.rotation.y = Math.atan2(-st.position.x, -st.position.z);
    scene.add(obj);
    return { ...st, object: obj, position3: new THREE.Vector3(st.position.x, 0, st.position.z) };
  });

  // traffic light
  const tl = makeTrafficLight();
  tl.group.position.set(TRAFFIC_LIGHT.position.x - 4, 0, TRAFFIC_LIGHT.position.z);
  tl.group.rotation.y = -Math.PI / 2; // arm reaches over the road
  scene.add(tl.group);
  const trafficLight = { redMat: tl.redMat, yellowMat: tl.yellowMat, greenMat: tl.greenMat,
    position: TRAFFIC_LIGHT.position };

  // speed bumps
  for (const b of SPEED_BUMPS) {
    const obj = makeSpeedBump(b.axis);
    obj.position.set(b.position.x, 0, b.position.z);
    scene.add(obj);
  }

  // pedestrians — free wanderers that stroll, turn, and roam the whole city
  const pedColors = ['#7da0ff', '#ff8ec8', '#8de0b0', '#ffc864', '#b58cff'];
  const peds = [];
  const [pedMin, pedMax] = TUNING.pedTurnEvery ?? [2.5, 6];
  for (let i = 0; i < (TUNING.pedCount ?? 12); i++) {
    const ped = makePedestrian(pedColors[i % pedColors.length]);
    const x = (Math.random() * 2 - 1) * (WORLD.half - 12);
    const z = (Math.random() * 2 - 1) * (WORLD.half - 12);
    const yaw = Math.random() * Math.PI * 2;
    ped.position.set(x, 0, z);
    ped.rotation.y = yaw;
    scene.add(ped);
    peds.push({ ped, yaw, speed: (TUNING.pedSpeed ?? 3) * (0.7 + Math.random() * 0.6),
      turnIn: 1 + Math.random() * (pedMax - pedMin), phase: Math.random() * 10 });
  }
  const PED_LIM = WORLD.half - 6;

  // roaming NPC delivery couriers (scooters weaving the city)
  const courierColors = ['#ff8ec8', '#6fd2e6', '#ffc864', '#b58cff', '#8de0b0'];
  const couriers = [];
  for (let i = 0; i < (TUNING.courierRoam ?? 4); i++) {
    const obj = makeCourier(courierColors[i % courierColors.length]);
    const x = (Math.random() * 2 - 1) * (WORLD.half - 14);
    const z = (Math.random() * 2 - 1) * (WORLD.half - 14);
    const yaw = Math.random() * Math.PI * 2;
    obj.position.set(x, 0, z); obj.rotation.y = yaw; scene.add(obj);
    couriers.push({ obj, yaw, speed: (TUNING.courierSpeed ?? 6) * (0.8 + Math.random() * 0.4), turnIn: 1 + Math.random() * 4 });
  }

  // couriers idling / eating at spots (food stands + the restaurant)
  const hangouts = [];
  const hangSpots = [...foodStands.map(s => s.position3), new THREE.Vector3(WORLD.restaurant.position.x, 0, WORLD.restaurant.position.z)];
  const perSpot = Math.ceil((TUNING.courierHang ?? 6) / hangSpots.length);
  for (const spot of hangSpots) {
    for (let k = 0; k < perSpot && hangouts.length < (TUNING.courierHang ?? 6); k++) {
      const obj = makeHangoutNPC(courierColors[hangouts.length % courierColors.length]);
      const a = Math.random() * Math.PI * 2, rr = 5 + Math.random() * 3;
      obj.position.set(spot.x + Math.cos(a) * rr, 0, spot.z + Math.sin(a) * rr);
      obj.rotation.y = Math.random() * Math.PI * 2;
      scene.add(obj);
      hangouts.push({ obj, phase: Math.random() * 10 });
    }
  }

  // waypoint marker
  const marker = makeMarker();
  scene.add(marker);

  let t = 0;
  function update(dt) {
    t += dt;
    if (marker.visible) {
      const r = marker.userData.ring;
      r.rotation.z += dt * 1.5;
      const pulse = 0.85 + Math.sin(t * 4) * 0.15;
      marker.userData.ringMat.opacity = pulse;
      r.scale.setScalar(0.92 + Math.sin(t * 4) * 0.08);
    }
    restaurant.userData.beam.material.opacity = 0.10 + Math.sin(t * 2) * 0.03;
    padMat.opacity = 0.28 + Math.sin(t * 3) * 0.14;
    clockPad.scale.setScalar(1 + Math.sin(t * 3) * 0.04);

    // pedestrians wander: walk forward, turn now and then, reflect at bounds
    for (const p of peds) {
      p.turnIn -= dt;
      if (p.turnIn <= 0) {
        p.yaw += (Math.random() - 0.5) * Math.PI * 0.9;
        p.turnIn = pedMin + Math.random() * (pedMax - pedMin);
      }
      const hx = Math.sin(p.yaw), hz = Math.cos(p.yaw);
      p.ped.position.x += hx * p.speed * dt;
      p.ped.position.z += hz * p.speed * dt;
      if (Math.abs(p.ped.position.x) > PED_LIM || Math.abs(p.ped.position.z) > PED_LIM) {
        p.yaw += Math.PI;
        p.ped.position.x = Math.max(-PED_LIM, Math.min(PED_LIM, p.ped.position.x));
        p.ped.position.z = Math.max(-PED_LIM, Math.min(PED_LIM, p.ped.position.z));
      }
      p.ped.rotation.y = p.yaw;
      p.ped.position.y = Math.abs(Math.sin((t + p.phase) * 6)) * 0.13; // walk bob
    }

    // roaming couriers wander faster, like peds on scooters
    for (const c of couriers) {
      c.turnIn -= dt;
      if (c.turnIn <= 0) { c.yaw += (Math.random() - 0.5) * Math.PI * 0.7; c.turnIn = 2 + Math.random() * 4; }
      const hx = Math.sin(c.yaw), hz = Math.cos(c.yaw);
      c.obj.position.x += hx * c.speed * dt;
      c.obj.position.z += hz * c.speed * dt;
      if (Math.abs(c.obj.position.x) > PED_LIM || Math.abs(c.obj.position.z) > PED_LIM) {
        c.yaw += Math.PI;
        c.obj.position.x = Math.max(-PED_LIM, Math.min(PED_LIM, c.obj.position.x));
        c.obj.position.z = Math.max(-PED_LIM, Math.min(PED_LIM, c.obj.position.z));
      }
      c.obj.rotation.y = c.yaw;
    }

    // idling couriers sway/bob in place
    for (const h of hangouts) {
      h.obj.position.y = Math.abs(Math.sin((t + h.phase) * 2)) * 0.06;
      h.obj.rotation.y += Math.sin((t + h.phase) * 0.5) * dt * 0.3;
    }
  }

  return {
    restaurant,
    restaurantPos: new THREE.Vector3(WORLD.restaurant.position.x, 0, WORLD.restaurant.position.z),
    clockInPos,
    houses,
    landmarks: landmarkObjs,
    gasStations,
    foodStands,
    trafficLight,
    marker,
    solids,
    // moving NPCs (peds + couriers) as small circular solids for collision
    agentSolids: () => {
      const R = TUNING.pedRadius ?? 0.85;
      const out = [];
      for (const p of peds) out.push({ x: p.ped.position.x, z: p.ped.position.z, hx: R, hz: R });
      for (const c of couriers) out.push({ x: c.obj.position.x, z: c.obj.position.z, hx: 1.1, hz: 1.1 });
      for (const h of hangouts) out.push({ x: h.obj.position.x, z: h.obj.position.z, hx: 0.9, hz: 0.9 });
      return out;
    },
    lights: { hemi, key, fill, ambient },
    update,
  };
}
