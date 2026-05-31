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
    this.cars = [];
    let seed = 1337;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    let i = 0;
    while (this.cars.length < TUNING.carCount && i < 400) {
      const line = lines[i % lines.length];
      const axis = (i % 2 === 0) ? 'z' : 'x';
      const car = { axis, line, dir: rnd() > 0.5 ? 1 : -1, along: (rnd() * 2 - 1) * (WORLD.half - 12),
        speed: TUNING.carSpeed, _lastTurn: null, mesh: makeCar(CAR_COLORS[this.cars.length % CAR_COLORS.length]) };
      scene.add(car.mesh);
      this.cars.push(car);
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

  // playerPos: THREE.Vector3 (cars yield to the player)
  update(dt, playerPos) {
    this.light.update(dt);
    const T = TUNING, half = WORLD.half, step = WORLD.blockSpacing;

    // cache current world positions for mutual yielding
    for (const car of this.cars) car._w = carWorld(car);

    for (const car of this.cars) {
      const w = car._w;
      const px = w.x + w.hvx * T.carLookAhead;
      const pz = w.z + w.hvz * T.carLookAhead;
      let target = T.carSpeed;

      // yield to the player ahead
      if (playerPos && Math.hypot(playerPos.x - px, playerPos.z - pz) < T.carYieldDist + 1.5) target = 0;
      // yield to a car ahead
      if (target > 0) {
        for (const o of this.cars) {
          if (o === car) continue;
          if (Math.hypot(o._w.x - px, o._w.z - pz) < T.carYieldDist) { target = 0; break; }
        }
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
      if (car.speed < target) car.speed = Math.min(target, car.speed + T.carAccel * dt);
      else if (car.speed > target) car.speed = Math.max(target, car.speed - T.carBrake * dt);

      // advance
      car.along += car.dir * car.speed * dt;

      // turn at intersections (keeps traffic from being static)
      const g = Math.round(car.along / step) * step;
      if (Math.abs(g) < half - 1 && Math.abs(car.along - g) < 1.0 && car._lastTurn !== g && car.speed > 1) {
        car._lastTurn = g;
        if (Math.random() < T.carTurnChance) {
          const oldLine = car.line;
          car.axis = car.axis === 'z' ? 'x' : 'z';
          car.line = g;
          car.dir = Math.random() < 0.5 ? 1 : -1;
          car.along = oldLine;
        }
      }

      // wrap at the map edge
      if (car.along > half) { car.along -= 2 * half; car._lastTurn = null; }
      else if (car.along < -half) { car.along += 2 * half; car._lastTurn = null; }
    }

    this._place();
  }

  // Car footprints as AABBs for solid push-out (oriented to each car's axis).
  solidBoxes() {
    return this.cars.map(c => c.axis === 'z'
      ? { x: c._wx, z: c._wz, hx: 1.3, hz: 2.3 }
      : { x: c._wx, z: c._wz, hx: 2.3, hz: 1.3 });
  }

  // Strongest car footprint overlapping the body circle (radius r). Overlap-
  // based, so call it BEFORE solid push-out. Returns { relSpeed, dir } or null.
  collide(body, r = 1.8) {
    let best = null, bestPen = 0;
    for (const car of this.cars) {
      const hx = car.axis === 'z' ? 1.3 : 2.3;
      const hz = car.axis === 'z' ? 2.3 : 1.3;
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
