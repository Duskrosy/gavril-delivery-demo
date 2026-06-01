// ============================================================
//  GAVRIL — One Shift · server-side NPC world
//  The server owns all NPCs (vehicles, pedestrians, couriers, traffic
//  lights) so every connected player sees them in the same place.
//  Plain numbers only — clients render from the broadcast snapshot.
//  Constants mirror web-demo/src/config.js.
// ============================================================

const HALF = 120, STEP = 30, LANE_OFF = 2.6;
const CAR_SPEED = 10, CAR_COUNT = 26;
const PED_COUNT = 30, PED_SPEED = 3.2, PED_TURN = [2.5, 6];
const COURIER_ROAM = 2, COURIER_SPEED = 6.5, COURIER_HANG = 6;
const PED_LIM = HALF - 6;
const LIGHTS = [[0, 0], [0, -30], [60, 60], [-60, -60], [60, -60], [-60, 60]];
const LIGHT_CYCLE = { green: 6.5, yellow: 1.8, red: 6.5 };
const FOOD_STANDS = [[-15, -45], [15, 75]];
const RESTAURANT = [15, 15];

const VTYPES = [
  { kind: 'car', l: 4.2, weight: 6, speed: [0.9, 1.2] },
  { kind: 'van', l: 5.8, weight: 3, speed: [0.8, 1.0] },
  { kind: 'bus', l: 8.6, weight: 2, speed: [0.6, 0.8] },
  { kind: 'moto', l: 2.2, weight: 4, speed: [1.0, 1.3] },
];

function gridLines() { const a = []; for (let g = -HALF + STEP; g < HALF; g += STEP) a.push(g); return a; }
function nextPhase(p) { return p === 'green' ? 'yellow' : p === 'yellow' ? 'red' : 'green'; }
function carWorld(v) {
  if (v.axis === 'z') return { x: v.line + (v.dir > 0 ? -LANE_OFF : LANE_OFF), z: v.along, hvx: 0, hvz: v.dir };
  return { x: v.along, z: v.line + (v.dir > 0 ? LANE_OFF : -LANE_OFF), hvx: v.dir, hvz: 0 };
}

class World {
  constructor() {
    let seed = 1337;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const lerp = (a, b, t) => a + (b - a) * t;
    const pickType = (r) => { const tot = VTYPES.reduce((s, t) => s + t.weight, 0); let x = r * tot; for (const t of VTYPES) if ((x -= t.weight) <= 0) return t; return VTYPES[0]; };

    // lanes
    const lines = gridLines(), lanes = [];
    for (const line of lines) for (const axis of ['z', 'x']) for (const dir of [1, -1]) lanes.push({ line, axis, dir });

    // vehicles
    this.veh = [];
    for (let i = 0; i < CAR_COUNT; i++) {
      const lane = lanes[i % lanes.length];
      const t = pickType(rnd());
      this.veh.push({ kind: t.kind, halfL: t.l / 2, axis: lane.axis, line: lane.line, dir: lane.dir,
        along: (rnd() * 2 - 1) * (HALF - 12), speed: 0, base: CAR_SPEED * lerp(t.speed[0], t.speed[1], rnd()) });
    }

    // lights (staggered)
    this.lights = LIGHTS.map((p, i) => ({ x: p[0], z: p[1], phase: i % 2 === 0 ? 'green' : 'red', t: (i * 1.9) % LIGHT_CYCLE[i % 2 === 0 ? 'green' : 'red'] }));
    this.lightMap = new Map(this.lights.map(l => [l.x + ',' + l.z, l]));

    // pedestrians + roaming couriers
    const wanderer = (speed) => ({ x: (Math.random() * 2 - 1) * PED_LIM, z: (Math.random() * 2 - 1) * PED_LIM,
      yaw: Math.random() * Math.PI * 2, speed: speed * (0.7 + Math.random() * 0.6), turnIn: 1 + Math.random() * 4 });
    this.ped = []; for (let i = 0; i < PED_COUNT; i++) this.ped.push(wanderer(PED_SPEED));
    this.cou = []; for (let i = 0; i < COURIER_ROAM; i++) this.cou.push(wanderer(COURIER_SPEED));

    // static hangouts around stands + restaurant
    this.hang = [];
    const spots = [...FOOD_STANDS, RESTAURANT];
    const per = Math.ceil(COURIER_HANG / spots.length);
    for (const [sx, sz] of spots) for (let k = 0; k < per && this.hang.length < COURIER_HANG; k++) {
      const a = Math.random() * Math.PI * 2, rr = 5 + Math.random() * 3;
      this.hang.push([+(sx + Math.cos(a) * rr).toFixed(1), +(sz + Math.sin(a) * rr).toFixed(1)]);
    }
  }

  // descriptors (sent once on welcome)
  descriptors() { return { vkinds: this.veh.map(v => v.kind), hang: this.hang }; }

  step(dt, playersArr) {
    // lights
    for (const lg of this.lights) { lg.t += dt; if (lg.t >= LIGHT_CYCLE[lg.phase]) { lg.t = 0; lg.phase = nextPhase(lg.phase); } }

    // cache vehicle world positions
    for (const v of this.veh) v._w = carWorld(v);

    for (const v of this.veh) {
      const w = v._w;
      const aheadDist = (ox, oz, latMax) => {
        const rx = ox - w.x, rz = oz - w.z, ah = rx * w.hvx + rz * w.hvz;
        if (ah <= 0) return -1;
        return Math.abs(rx * -w.hvz + rz * w.hvx) < latMax ? ah : -1;
      };
      let target = v.base;
      // same-lane following
      for (const o of this.veh) {
        if (o === v || o.axis !== v.axis || o.line !== v.line || o.dir !== v.dir) continue;
        const d = aheadDist(o._w.x, o._w.z, 2.4);
        if (d > 0) { const gap = d - v.halfL - o.halfL; if (gap < 6) target = Math.min(target, Math.max(0, (gap - 2.2) * 1.7)); }
      }
      // yield to nearest player ahead in lane
      for (const p of playersArr) { const d = aheadDist(p.x, p.z, 3); if (d > 0 && d < 6) { target = 0; break; } }
      // traffic light
      let m = Math.round(v.along / STEP) * STEP;
      if (v.dir > 0 && m < v.along + 0.5) m += STEP;
      if (v.dir < 0 && m > v.along - 0.5) m -= STEP;
      const ix = v.axis === 'z' ? v.line : m, iz = v.axis === 'z' ? m : v.line;
      const dist = (m - v.along) * v.dir;
      if (dist > -1 && dist < 11) {
        const lg = this.lightMap.get(ix + ',' + iz);
        if (lg) { const go = lg.phase === 'red' ? 'x' : 'z'; if (v.axis !== go) { target = 0; if (dist < 1.4) v.speed = 0; } }
      }
      // accel / brake
      if (v.speed < target) v.speed = Math.min(target, v.speed + 9 * dt);
      else if (v.speed > target) v.speed = Math.max(target, v.speed - 22 * dt);
      v.along += v.dir * v.speed * dt;
      if (v.along > HALF) v.along -= 2 * HALF; else if (v.along < -HALF) v.along += 2 * HALF;
    }

    // wanderers
    const wander = (a) => {
      a.turnIn -= dt;
      if (a.turnIn <= 0) { a.yaw += (Math.random() - 0.5) * Math.PI * 0.8; a.turnIn = PED_TURN[0] + Math.random() * (PED_TURN[1] - PED_TURN[0]); }
      a.x += Math.sin(a.yaw) * a.speed * dt; a.z += Math.cos(a.yaw) * a.speed * dt;
      if (Math.abs(a.x) > PED_LIM || Math.abs(a.z) > PED_LIM) { a.yaw += Math.PI; a.x = Math.max(-PED_LIM, Math.min(PED_LIM, a.x)); a.z = Math.max(-PED_LIM, Math.min(PED_LIM, a.z)); }
    };
    for (const a of this.ped) wander(a);
    for (const a of this.cou) wander(a);
  }

  // compact per-tick snapshot
  snapshot() {
    const r1 = (n) => Math.round(n * 10) / 10;
    return {
      veh: this.veh.map(v => [v.axis === 'z' ? 0 : 1, v.line, v.dir, r1(v.along)]),
      ped: this.ped.map(a => [r1(a.x), r1(a.z), r1(a.yaw)]),
      cou: this.cou.map(a => [r1(a.x), r1(a.z), r1(a.yaw)]),
      lit: this.lights.map(l => l.phase === 'green' ? 0 : l.phase === 'yellow' ? 1 : 2),
    };
  }
}

module.exports = { World };
