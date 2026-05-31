// ============================================================
//  GAVRIL — One Shift · traffic.js
//  Living traffic: cars drive the road grid, turn at intersections,
//  brake for the player / cars ahead / red lights, and obey one
//  working traffic light on both of its approaches. Plus collision.
// ============================================================

import * as THREE from 'three';
import { PALETTE, TUNING, WORLD, TRAFFIC_LIGHTS } from './config.js';

const C = (hex) => new THREE.Color(hex);
const CAR_COLORS = ['#7da0ff', '#ff8ec8', '#6fd2e6', '#b58cff', '#ffc864', '#8de0b0'];
const LANE_OFF = 2.6;

function gridLines() {
  const lines = [];
  for (let g = -WORLD.half + WORLD.blockSpacing; g < WORLD.half; g += WORLD.blockSpacing) lines.push(g);
  return lines;
}

function makeCar(colorHex) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 4.2),
    new THREE.MeshStandardMaterial({ color: C(colorHex), roughness: .45, metalness: .25 }));
  body.position.y = 0.95; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.8, 2.0),
    new THREE.MeshStandardMaterial({ color: C('#15101f'), roughness: .3, metalness: .4, emissive: C(colorHex), emissiveIntensity: .06 }));
  cabin.position.set(0, 1.65, -0.2); g.add(cabin);
  const headMat = new THREE.MeshStandardMaterial({ color: C('#fff4d6'), emissive: C('#fff0c8'), emissiveIntensity: 1.6 });
  const tailMat = new THREE.MeshStandardMaterial({ color: C(PALETTE.decision), emissive: C(PALETTE.decision), emissiveIntensity: 1.2 });
  for (const x of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.12), headMat); h.position.set(x, 0.95, 2.12); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.12), tailMat); t.position.set(x, 0.95, -2.12); g.add(t);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.4, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: C('#0c0912'), roughness: .95 });
  for (const x of [-1.0, 1.0]) for (const z of [1.4, -1.4]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat); w.rotation.z = Math.PI / 2; w.position.set(x, 0.55, z); g.add(w);
  }
  return g;
}

function makeVan(colorHex) {
  const g = new THREE.Group();
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 2.0),
    new THREE.MeshStandardMaterial({ color: C(colorHex), roughness: .5, metalness: .2 }));
  cab.position.set(0, 1.2, 1.6); cab.castShadow = true; g.add(cab);
  const box = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.2, 3.8),
    new THREE.MeshStandardMaterial({ color: C('#e7e2f0'), roughness: .6, emissive: C(colorHex), emissiveIntensity: .05 }));
  box.position.set(0, 1.55, -1.0); box.castShadow = true; g.add(box);
  const wind = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 0.1), new THREE.MeshStandardMaterial({ color: C('#0c0912'), roughness: .2, metalness: .5 }));
  wind.position.set(0, 1.5, 2.6); g.add(wind);
  const headMat = new THREE.MeshStandardMaterial({ color: C('#fff4d6'), emissive: C('#fff0c8'), emissiveIntensity: 1.6 });
  const tailMat = new THREE.MeshStandardMaterial({ color: C(PALETTE.decision), emissive: C(PALETTE.decision), emissiveIntensity: 1.2 });
  for (const x of [-0.7, 0.7]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.12), headMat); hl.position.set(x, 1.0, 2.66); g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.12), tailMat); tl.position.set(x, 1.4, -2.92); g.add(tl);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.42, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: C('#0c0912'), roughness: .95 });
  for (const x of [-1.05, 1.05]) for (const z of [1.6, -1.8]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat); w.rotation.z = Math.PI / 2; w.position.set(x, 0.6, z); g.add(w);
  }
  return g;
}

function makeBus(colorHex) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.7, 8.6),
    new THREE.MeshStandardMaterial({ color: C(colorHex), roughness: .5, metalness: .25, emissive: C(colorHex), emissiveIntensity: .05 }));
  body.position.y = 1.9; body.castShadow = true; g.add(body);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 8.0), new THREE.MeshStandardMaterial({ color: C('#15101f'), roughness: .7 }));
  roof.position.y = 3.4; g.add(roof);
  // window strips down each side
  const winMat = new THREE.MeshStandardMaterial({ color: C('#0c0912'), roughness: .2, metalness: .5, emissive: C(PALETTE.nav), emissiveIntensity: .18 });
  for (const sx of [-1.37, 1.37]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 7.0), winMat);
    strip.position.set(sx, 2.3, -0.3); g.add(strip);
  }
  const front = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 0.12), winMat); front.position.set(0, 2.3, 4.35); g.add(front);
  const headMat = new THREE.MeshStandardMaterial({ color: C('#fff4d6'), emissive: C('#fff0c8'), emissiveIntensity: 1.6 });
  const tailMat = new THREE.MeshStandardMaterial({ color: C(PALETTE.decision), emissive: C(PALETTE.decision), emissiveIntensity: 1.2 });
  for (const x of [-0.9, 0.9]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.12), headMat); hl.position.set(x, 1.1, 4.36); g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 0.12), tailMat); tl.position.set(x, 1.4, -4.36); g.add(tl);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.45, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: C('#0c0912'), roughness: .95 });
  for (const x of [-1.2, 1.2]) for (const z of [2.6, -2.4]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat); w.rotation.z = Math.PI / 2; w.position.set(x, 0.7, z); g.add(w);
  }
  return g;
}

// A delivery moto (rider on a scooter) that drives the roads like a vehicle.
function makeMoto(colorHex) {
  const g = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 2.0),
    new THREE.MeshStandardMaterial({ color: C(colorHex), roughness: .45, metalness: .3, emissive: C(colorHex), emissiveIntensity: .1 }));
  deck.position.y = 0.6; deck.castShadow = true; g.add(deck);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8), new THREE.MeshStandardMaterial({ color: C('#1b1428') }));
  col.position.set(0, 1.2, 0.9); col.rotation.x = -0.2; g.add(col);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8), new THREE.MeshStandardMaterial({ color: C('#1b1428') }));
  bar.position.set(0, 1.7, 0.85); bar.rotation.z = Math.PI / 2; g.add(bar);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshStandardMaterial({ color: C('#fff0c8'), emissive: C('#fff0c8'), emissiveIntensity: 1.5 }));
  head.position.set(0, 1.45, 1.15); g.add(head);
  const tire = new THREE.MeshStandardMaterial({ color: C('#0c0912'), roughness: .95 });
  for (const z of [0.95, -0.9]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.24, 14), tire); w.rotation.z = Math.PI / 2; w.position.set(0, 0.5, z); g.add(w); }
  const cloth = new THREE.MeshStandardMaterial({ color: C(colorHex), roughness: .7 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.7, 4, 8), cloth); torso.position.set(0, 1.55, -0.1); torso.rotation.x = 0.22; torso.castShadow = true; g.add(torso);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.33, 14, 12), new THREE.MeshStandardMaterial({ color: C('#1b1428'), roughness: .4, metalness: .25 })); helmet.position.set(0, 2.15, 0.05); g.add(helmet);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.75, 0.75), new THREE.MeshStandardMaterial({ color: C(PALETTE.panel2), emissive: C(PALETTE.reward), emissiveIntensity: .55, roughness: .5 })); box.position.set(0, 1.75, -0.85); g.add(box);
  return g;
}

// vehicle types: footprint + behaviour ranges. `weight` biases the mix.
const VEHICLE_TYPES = [
  { kind: 'car', make: makeCar, w: 2.0, l: 4.2, weight: 6, speed: [0.9, 1.2], turn: [0.1, 0.2], yield: 4.2, accel: [0.9, 1.3] },
  { kind: 'van', make: makeVan, w: 2.3, l: 5.8, weight: 3, speed: [0.8, 1.0], turn: [0.06, 0.14], yield: 4.8, accel: [0.8, 1.0] },
  { kind: 'bus', make: makeBus, w: 2.7, l: 8.6, weight: 2, speed: [0.6, 0.8], turn: [0.04, 0.1], yield: 5.6, accel: [0.6, 0.85] },
  { kind: 'moto', make: makeMoto, w: 1.0, l: 2.2, weight: 4, speed: [1.0, 1.3], turn: [0.18, 0.32], yield: 3.2, accel: [1.0, 1.5] },
];
const BUS_COLORS = ['#ffc864', '#6fd2e6', '#ff8ec8'];
function pickType(r) {
  const total = VEHICLE_TYPES.reduce((s, t) => s + t.weight, 0);
  let x = r * total;
  for (const t of VEHICLE_TYPES) { if ((x -= t.weight) <= 0) return t; }
  return VEHICLE_TYPES[0];
}

// world position + heading for a car given its (axis, dir, line, along)
function carWorld(car) {
  if (car.axis === 'z') {
    return { x: car.line + (car.dir > 0 ? -LANE_OFF : LANE_OFF), z: car.along, hvx: 0, hvz: car.dir, rotY: car.dir > 0 ? 0 : Math.PI };
  }
  return { x: car.along, z: car.line + (car.dir > 0 ? LANE_OFF : -LANE_OFF), hvx: car.dir, hvz: 0, rotY: car.dir > 0 ? Math.PI / 2 : -Math.PI / 2 };
}

class TrafficLightCtrl {
  constructor(refs, pos, offset = 0) {
    this.refs = refs || {};
    this.pos = pos;                 // { x, z } intersection it governs
    this.cycle = TUNING.lightCycle;
    // stagger so the lights aren't all synced
    this.phase = offset % 2 === 0 ? 'green' : 'red';
    this.t = (offset * 1.9) % this.cycle[this.phase];
    this._apply();
  }
  // the z-axis road goes on green/yellow; the crossing x-axis road goes on red
  get goAxis() { return this.phase === 'red' ? 'x' : 'z'; }
  _apply() {
    const set = (m, lit) => { if (m) m.emissiveIntensity = lit ? 1.8 : 0.04; };
    set(this.refs.redMat, this.phase === 'red');
    set(this.refs.yellowMat, this.phase === 'yellow');
    set(this.refs.greenMat, this.phase === 'green');
  }
  update(dt) {
    this.t += dt;
    if (this.t >= this.cycle[this.phase]) {
      this.t = 0;
      this.phase = this.phase === 'green' ? 'yellow' : this.phase === 'yellow' ? 'red' : 'green';
      this._apply();
    }
  }
}

export class Traffic {
  constructor(scene, lightRefs) {
    const lines = gridLines();
    // every distinct lane (line × axis × direction) so cars don't spawn stacked
    const lanes = [];
    for (const line of lines) for (const axis of ['z', 'x']) for (const dir of [1, -1]) lanes.push({ line, axis, dir });
    this.cars = [];
    let seed = 1337;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    let i = 0;
    const lerp = (a, b, t) => a + (b - a) * t;
    while (this.cars.length < TUNING.carCount && i < 400) {
      const lane = lanes[i % lanes.length];
      const type = pickType(rnd());
      const color = type.kind === 'bus' ? BUS_COLORS[this.cars.length % BUS_COLORS.length] : CAR_COLORS[this.cars.length % CAR_COLORS.length];
      const car = {
        axis: lane.axis, line: lane.line, dir: lane.dir, along: (rnd() * 2 - 1) * (WORLD.half - 12),
        speed: 0, kind: type.kind, halfW: type.w / 2, halfL: type.l / 2,
        speedFactor: lerp(type.speed[0], type.speed[1], rnd()),
        turnChance: lerp(type.turn[0], type.turn[1], rnd()),
        yieldDist: type.yield + rnd() * 1.2,
        accelF: lerp(type.accel[0], type.accel[1], rnd()),
        _lastTurn: null, mesh: type.make(color),
      };
      // personality: some drivers are fast & pushy
      if (rnd() < TUNING.aggressiveChance) {
        car.aggressive = true;
        car.speedFactor = lerp(TUNING.aggressiveSpeed[0], TUNING.aggressiveSpeed[1], rnd());
        car.yieldDist *= 0.6; car.accelF *= 1.4; car.turnChance *= 0.6;
      }
      // some drivers despise motorcycles and won't yield to the rider
      car.hatesBikes = rnd() < TUNING.bikeHaterChance;
      car._idx = this.cars.length;
      scene.add(car.mesh);
      this.cars.push(car);
      i++;
    }
    // one controller per traffic light, keyed by intersection for fast lookup
    const refsArr = Array.isArray(lightRefs) ? lightRefs : [lightRefs];
    this.lights = TRAFFIC_LIGHTS.map((l, k) => new TrafficLightCtrl(refsArr[k], l.position, k));
    this.lightMap = new Map();
    for (const ctrl of this.lights) this.lightMap.set(ctrl.pos.x + ',' + ctrl.pos.z, ctrl);
    this.light = this.lights[0]; // alias
    this.lines = lines;
    this._place();
    this._bodyVel = new THREE.Vector3(); this._carVel = new THREE.Vector3();
    this._rel = new THREE.Vector3(); this._dir = new THREE.Vector3();
  }

  _place() {
    for (const car of this.cars) {
      const w = carWorld(car);
      car._w = w; car._wx = w.x; car._wz = w.z;
      car.mesh.position.set(w.x, 0, w.z);
      car.mesh.rotation.y = w.rotY;
    }
  }

  // playerPos: THREE.Vector3 (cars yield to the player); playerRiding lets
  // motorcycle-haters refuse to yield (and surge) when you're on the bike.
  update(dt, playerPos, playerRiding) {
    for (const lg of this.lights) lg.update(dt);
    const T = TUNING, half = WORLD.half, step = WORLD.blockSpacing;

    // the next grid intersection ahead of a car + distance to it
    const nextInt = (car) => {
      let m = Math.round(car.along / step) * step;
      if (car.dir > 0 && m < car.along + 0.5) m += step;
      if (car.dir < 0 && m > car.along - 0.5) m -= step;
      return car.axis === 'z'
        ? { ix: car.line, iz: m, dist: (m - car.along) * car.dir }
        : { ix: m, iz: car.line, dist: (m - car.along) * car.dir };
    };

    // cache current world positions for mutual yielding
    for (const car of this.cars) car._w = carWorld(car);

    for (const car of this.cars) {
      const w = car._w;
      let target = T.carSpeed * car.speedFactor;

      // Distance to a point IF it lies ahead of this car within its lane,
      // else -1. Directional + lane-gated so cars never yield to oncoming,
      // crossing, or beside traffic (that mutual-yield was the deadlock).
      const aheadDist = (ox, oz, latMax) => {
        const rx = ox - w.x, rz = oz - w.z;
        const ahead = rx * w.hvx + rz * w.hvz;       // along heading
        if (ahead <= 0) return -1;
        const lat = Math.abs(rx * -w.hvz + rz * w.hvx); // perpendicular
        return lat < latMax ? ahead : -1;
      };

      // yield to the player if they're in the lane ahead — unless this driver
      // despises motorcycles and you're riding, in which case they surge.
      if (playerPos) {
        const d = aheadDist(playerPos.x, playerPos.z, 3.0);
        if (d > 0 && d < car.yieldDist + car.halfL + 2) {
          if (playerRiding && car.hatesBikes) target = T.carSpeed * car.speedFactor * 1.15;
          else target = 0;
        }
      }
      // car-following: ease toward the gap to the nearest car in the SAME lane
      // ahead (same road, axis and direction). Only same-lane — otherwise
      // perpendicular cars at a junction mutually yield and freeze (gridlock).
      if (target > 0) {
        let gap = Infinity;
        for (const o of this.cars) {
          if (o === car || o.axis !== car.axis || o.line !== car.line || o.dir !== car.dir) continue;
          const d = aheadDist(o._w.x, o._w.z, 2.4);
          if (d > 0) { const g = d - car.halfL - o.halfL; if (g < gap) gap = g; }
        }
        if (gap < Infinity) target = Math.min(target, Math.max(0, (gap - 2.2) * 1.7));
      }
      // intersections: obey a traffic light if this junction has one, else
      // give way to a crossing car already in the box (priority by distance,
      // tie-broken by id so exactly one yields — never a mutual deadlock).
      const ni = nextInt(car);
      if (ni.dist > -1 && ni.dist < T.approachDist + car.halfL) {
        const ctrl = this.lightMap.get(ni.ix + ',' + ni.iz);
        if (ctrl) {
          if (car.axis !== ctrl.goAxis) {           // red for this approach
            target = 0;
            if (ni.dist < 1.4) { car.speed = 0; car.along -= car.dir * 0.05; }
          }
        } else {
          for (const o of this.cars) {
            if (o === car || o.axis === car.axis) continue;
            const od = Math.hypot(o._w.x - ni.ix, o._w.z - ni.iz);
            if (od < T.intersectionRadius) {
              if (od < ni.dist - 0.3 || (Math.abs(od - ni.dist) <= 0.3 && o._idx < car._idx)) { target = 0; break; }
            }
          }
        }
      }

      // accelerate / brake toward target
      if (car.speed < target) car.speed = Math.min(target, car.speed + T.carAccel * car.accelF * dt);
      else if (car.speed > target) car.speed = Math.max(target, car.speed - T.carBrake * dt);

      // advance
      car.along += car.dir * car.speed * dt;

      // turn at an intersection (cars + motos). Safe now: distinct lanes, only
      // same-lane following, and give-way means cars keep flowing rather than
      // stacking, so turners don't funnel into a permanent jam.
      const g = Math.round(car.along / step) * step;
      if (Math.abs(g) < half - 1 && Math.abs(car.along - g) < 0.7 && car._lastTurn !== g && car.speed > 1.5) {
        car._lastTurn = g;
        if (Math.random() < car.turnChance) {
          const oldLine = car.line;
          car.axis = car.axis === 'z' ? 'x' : 'z';
          car.line = g;
          car.dir = Math.random() < 0.5 ? 1 : -1;
          car.along = oldLine;
        }
      }

      // wrap around the map edge
      if (car.along > half) { car.along -= 2 * half; car._lastTurn = null; }
      else if (car.along < -half) { car.along += 2 * half; car._lastTurn = null; }
    }

    this._place();
  }

  // Car footprints as AABBs for solid push-out (oriented to each car's axis).
  // Slightly tighter than the model so you don't bounce off thin air.
  solidBoxes() {
    const s = TUNING.carHitboxScale ?? 0.85;
    return this.cars.map(c => c.axis === 'z'
      ? { x: c._wx, z: c._wz, hx: c.halfW * s, hz: c.halfL * s }
      : { x: c._wx, z: c._wz, hx: c.halfL * s, hz: c.halfW * s });
  }

  // Strongest car footprint overlapping the body circle (radius r). Overlap-
  // based, so call it BEFORE solid push-out. Returns { relSpeed, dir } or null.
  collide(body, r = 1.8) {
    let best = null, bestPen = 0;
    const s = TUNING.carHitboxScale ?? 0.85;
    for (const car of this.cars) {
      const hx = (car.axis === 'z' ? car.halfW : car.halfL) * s;
      const hz = (car.axis === 'z' ? car.halfL : car.halfW) * s;
      const dx = body.position.x - car._wx;
      const dz = body.position.z - car._wz;
      const ox = (hx + r) - Math.abs(dx);
      const oz = (hz + r) - Math.abs(dz);
      if (ox > 0 && oz > 0) {
        const pen = Math.min(ox, oz);
        if (pen > bestPen) { bestPen = pen; best = { car, dx, dz }; }
      }
    }
    if (!best) return null;
    this._bodyVel.copy(body.headingVec).multiplyScalar(body.speed || 0);
    if (best.car.axis === 'z') this._carVel.set(0, 0, best.car.dir * best.car.speed);
    else this._carVel.set(best.car.dir * best.car.speed, 0, 0);
    this._rel.copy(this._bodyVel).sub(this._carVel);
    this._dir.set(best.dx, 0, best.dz);
    return { relSpeed: this._rel.length(), dir: this._dir.clone() };
  }
}
