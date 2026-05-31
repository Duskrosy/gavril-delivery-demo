// ============================================================
//  GAVRIL — One Shift · traffic.js
//  Looping low-poly cars on the road grid, one working traffic light
//  that the central road obeys, and player↔car collision detection
//  with impact-speed classification.
// ============================================================

import * as THREE from 'three';
import { PALETTE, TUNING, WORLD, TRAFFIC_LIGHT } from './config.js';

const C = (hex) => new THREE.Color(hex);
const CAR_COLORS = ['#7da0ff', '#ff8ec8', '#6fd2e6', '#b58cff', '#ffc864', '#8de0b0'];

function makeCar(colorHex) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 4.2),
    new THREE.MeshStandardMaterial({ color: C(colorHex), roughness: .45, metalness: .25 }));
  body.position.y = 0.95; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.8, 2.0),
    new THREE.MeshStandardMaterial({ color: C('#15101f'), roughness: .3, metalness: .4,
      emissive: C(colorHex), emissiveIntensity: .06 }));
  cabin.position.set(0, 1.65, -0.2); g.add(cabin);
  // lights (+z is forward)
  const headMat = new THREE.MeshStandardMaterial({ color: C('#fff4d6'), emissive: C('#fff0c8'), emissiveIntensity: 1.6 });
  const tailMat = new THREE.MeshStandardMaterial({ color: C(PALETTE.decision), emissive: C(PALETTE.decision), emissiveIntensity: 1.2 });
  for (const x of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.12), headMat);
    h.position.set(x, 0.95, 2.12); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.12), tailMat);
    t.position.set(x, 0.95, -2.12); g.add(t);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.4, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: C('#0c0912'), roughness: .95 });
  for (const x of [-1.0, 1.0]) for (const z of [1.4, -1.4]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.55, z); g.add(w);
  }
  return g;
}

// Cars are defined by the road line they ride and a travel axis.
function carLanes() {
  return [
    { axis: 'z', line: 0,   dir: 1,  start: -40 },
    { axis: 'z', line: 0,   dir: -1, start: 30 },
    { axis: 'z', line: 24,  dir: 1,  start: 10 },
    { axis: 'z', line: -24, dir: -1, start: -20 },
    { axis: 'x', line: 0,   dir: 1,  start: -30 },
    { axis: 'x', line: 24,  dir: -1, start: 20 },
    { axis: 'x', line: -24, dir: 1,  start: 0 },
  ];
}

class TrafficLightCtrl {
  // refs: { redMat, yellowMat, greenMat }
  constructor(refs) {
    this.refs = refs;
    this.cycle = TUNING.lightCycle;
    this.phase = 'green';
    this.t = 0;
    this._apply();
  }
  // central road (axis 'z', line 0) stops on red.
  get stopZ() { return this.phase === 'red'; }
  _apply() {
    const on = (m, lit, base) => { if (m) m.emissiveIntensity = lit ? 1.8 : 0.04; };
    on(this.refs.redMat, this.phase === 'red');
    on(this.refs.yellowMat, this.phase === 'yellow');
    on(this.refs.greenMat, this.phase === 'green');
  }
  update(dt) {
    this.t += dt;
    const dur = this.cycle[this.phase];
    if (this.t >= dur) {
      this.t = 0;
      this.phase = this.phase === 'green' ? 'yellow' : this.phase === 'yellow' ? 'red' : 'green';
      this._apply();
    }
  }
}

export class Traffic {
  constructor(scene, lightRefs) {
    this.cars = [];
    for (const lane of carLanes()) {
      const mesh = makeCar(CAR_COLORS[this.cars.length % CAR_COLORS.length]);
      scene.add(mesh);
      this.cars.push({ ...lane, pos: lane.start, speed: TUNING.carSpeed, mesh });
    }
    this.light = new TrafficLightCtrl(lightRefs || {});
    this._place();
    this._bodyVel = new THREE.Vector3();
    this._carVel = new THREE.Vector3();
    this._rel = new THREE.Vector3();
    this._dir = new THREE.Vector3();
  }

  _carWorld(car) {
    // returns {x,z} world position including the lane offset
    if (car.axis === 'z') return { x: car.line + car.dir * 2.2, z: car.pos };
    return { x: car.pos, z: car.line - car.dir * 2.2 };
  }

  _place() {
    const half = WORLD.half;
    for (const car of this.cars) {
      const w = this._carWorld(car);
      car.mesh.position.set(w.x, 0, w.z);
      car.mesh.rotation.y = car.axis === 'z'
        ? (car.dir > 0 ? 0 : Math.PI)
        : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      car._wx = w.x; car._wz = w.z;
    }
    this._half = half;
  }

  update(dt) {
    this.light.update(dt);
    const half = WORLD.half;
    const stopGap = 6;
    for (const car of this.cars) {
      const obeysLight = car.axis === 'z' && car.line === 0;
      let next = car.pos + car.dir * car.speed * dt;

      if (obeysLight && this.light.stopZ) {
        const gapNext = (TRAFFIC_LIGHT.position.z - next) * car.dir;   // dist ahead to light
        const gapNow = (TRAFFIC_LIGHT.position.z - car.pos) * car.dir;
        if (gapNow > 0 && gapNext < stopGap) {
          next = TRAFFIC_LIGHT.position.z - car.dir * stopGap;        // hold at stop line
        }
      }
      // wrap
      if (next > half) next -= 2 * half;
      else if (next < -half) next += 2 * half;
      car.pos = next;
    }
    this._place();
  }

  // Nearest car overlapping `body`. Returns {relSpeed, dir} or null.
  collide(body) {
    const R = 3.4; // combined collision radius (car + bike)
    let best = null, bestD = R;
    for (const car of this.cars) {
      const dx = body.position.x - car._wx;
      const dz = body.position.z - car._wz;
      const d = Math.hypot(dx, dz);
      if (d < bestD) { bestD = d; best = { car, dx, dz, d }; }
    }
    if (!best) return null;

    // relative speed of approach
    this._bodyVel.copy(body.headingVec).multiplyScalar(body.speed || 0);
    if (best.car.axis === 'z') this._carVel.set(0, 0, best.car.dir * best.car.speed);
    else this._carVel.set(best.car.dir * best.car.speed, 0, 0);
    this._rel.copy(this._bodyVel).sub(this._carVel);
    const relSpeed = this._rel.length();
    this._dir.set(best.dx, 0, best.dz); // push body away from car
    return { relSpeed, dir: this._dir.clone() };
  }
}
