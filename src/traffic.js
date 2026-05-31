// ============================================================
//  GAVRIL — One Shift · traffic.js
//  Living traffic: cars drive the road grid, turn at intersections,
//  brake for the player / cars ahead / red lights, and obey one
//  working traffic light on both of its approaches. Plus collision.
// ============================================================

import * as THREE from 'three';
import { PALETTE, TUNING, WORLD, TRAFFIC_LIGHT } from './config.js';

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

// vehicle types: footprint + behaviour ranges. `weight` biases the mix.
const VEHICLE_TYPES = [
  { kind: 'car', make: makeCar, w: 2.0, l: 4.2, weight: 6, speed: [0.9, 1.2], turn: [0.3, 0.5], yield: 4.2, accel: [0.9, 1.3] },
  { kind: 'van', make: makeVan, w: 2.3, l: 5.8, weight: 3, speed: [0.8, 1.0], turn: [0.2, 0.4], yield: 4.8, accel: [0.8, 1.0] },
  { kind: 'bus', make: makeBus, w: 2.7, l: 8.6, weight: 2, speed: [0.6, 0.8], turn: [0.08, 0.18], yield: 5.6, accel: [0.6, 0.85] },
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
  constructor(refs) {
    this.refs = refs || {};
    this.cycle = TUNING.lightCycle;
    this.phase = 'green';
    this.t = 0;
    this._apply();
  }
  // the z-axis road (x≈0) goes on green/yellow; the x-axis road (z≈light.z) goes on red
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
      scene.add(car.mesh);
      this.cars.push(car);
      i++;
    }
    this.light = new TrafficLightCtrl(lightRefs);
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
    this.light.update(dt);
    const T = TUNING, half = WORLD.half, step = WORLD.blockSpacing;

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
      // obey the one traffic light on both its approaches
      const ctrlZ = car.axis === 'z' && car.line === 0;
      const ctrlX = car.axis === 'x' && car.line === TRAFFIC_LIGHT.position.z;
      if (ctrlZ || ctrlX) {
        const mustStop = car.axis !== this.light.goAxis;
        const stopAlong = car.axis === 'z' ? TRAFFIC_LIGHT.position.z : TRAFFIC_LIGHT.position.x;
        const gap = (stopAlong - car.along) * car.dir; // distance ahead to the stop line
        if (mustStop && gap > -1 && gap < T.carLookAhead) {
          target = 0;
          if (gap < 1.2) { car.speed = 0; car.along = stopAlong - car.dir * 1.2; } // hold at the line
        }
      }

      // accelerate / brake toward target
      if (car.speed < target) car.speed = Math.min(target, car.speed + T.carAccel * car.accelF * dt);
      else if (car.speed > target) car.speed = Math.max(target, car.speed - T.carBrake * dt);

      // advance
      car.along += car.dir * car.speed * dt;

      // wrap around the map edge (cars loop their road — no turning, which
      // otherwise funnels and traps cars into a permanent jam)
      if (car.along > half) car.along -= 2 * half;
      else if (car.along < -half) car.along += 2 * half;
    }

    this._place();
  }

  // Car footprints as AABBs for solid push-out (oriented to each car's axis).
  solidBoxes() {
    return this.cars.map(c => c.axis === 'z'
      ? { x: c._wx, z: c._wz, hx: c.halfW, hz: c.halfL }
      : { x: c._wx, z: c._wz, hx: c.halfL, hz: c.halfW });
  }

  // Strongest car footprint overlapping the body circle (radius r). Overlap-
  // based, so call it BEFORE solid push-out. Returns { relSpeed, dir } or null.
  collide(body, r = 1.8) {
    let best = null, bestPen = 0;
    for (const car of this.cars) {
      const hx = car.axis === 'z' ? car.halfW : car.halfL;
      const hz = car.axis === 'z' ? car.halfL : car.halfW;
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
