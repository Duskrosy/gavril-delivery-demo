// ============================================================
//  GAVRIL — One Shift · player.js
//  Low-poly motorcycle + rider with arcade driving physics.
//  Shares the body interface with Avatar (no camera here — the
//  shared FollowCam handles that). Gas gates the top speed.
// ============================================================

import * as THREE from 'three';
import { PALETTE, TUNING } from './config.js';

const C = (hex) => new THREE.Color(hex);

function buildMotorcycle() {
  const g = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: C(PALETTE.action), roughness: .4, metalness: .35,
    emissive: C(PALETTE.action), emissiveIntensity: .12 });
  const darkMat = new THREE.MeshStandardMaterial({ color: C('#1b1428'), roughness: .7 });
  const tireMat = new THREE.MeshStandardMaterial({ color: C('#0c0912'), roughness: .95 });
  const chrome = new THREE.MeshStandardMaterial({ color: C('#cfc6e8'), roughness: .25, metalness: .7 });
  const headMat = new THREE.MeshStandardMaterial({ color: C(PALETTE.reward), emissive: C(PALETTE.reward), emissiveIntensity: 1.6 });
  const tailMat = new THREE.MeshStandardMaterial({ color: C(PALETTE.decision), emissive: C(PALETTE.decision), emissiveIntensity: 1.3 });

  // main frame / fuel tank
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.85, 2.4), bodyMat);
  tank.position.set(0, 1.35, 0.1); tank.castShadow = true; g.add(tank);
  const belly = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 1.6), darkMat);
  belly.position.set(0, 0.85, 0.2); g.add(belly);

  // seat
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.34, 1.3), darkMat);
  seat.position.set(0, 1.55, -0.85); seat.castShadow = true; g.add(seat);

  // front forks + handlebars
  const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.8, 8), chrome);
  fork.position.set(0, 1.4, 1.5); fork.rotation.x = -0.35; g.add(fork);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 8), darkMat);
  bar.position.set(0, 2.1, 1.25); bar.rotation.z = Math.PI / 2; g.add(bar);

  // headlight + taillight
  const headlight = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), headMat);
  headlight.position.set(0, 1.7, 2.05); g.add(headlight);
  const taillight = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.12), tailMat);
  taillight.position.set(0, 1.5, -1.55); g.add(taillight);

  // wheels (bigger than the scooter's)
  const wheelGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.34, 18);
  for (const z of [1.85, -1.55]) {
    const w = new THREE.Mesh(wheelGeo, tireMat);
    w.rotation.z = Math.PI / 2; w.position.set(0, 0.85, z); w.castShadow = true; g.add(w);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.36, 10), chrome);
    hub.rotation.z = Math.PI / 2; hub.position.set(0, 0.85, z); g.add(hub);
  }

  // delivery top-box (glows by food state when carrying)
  const boxMat = new THREE.MeshStandardMaterial({ color: C(PALETTE.panel2), emissive: C(PALETTE.action),
    emissiveIntensity: .25, roughness: .5 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 1.0), boxMat);
  box.position.set(0, 2.15, -1.0); box.castShadow = true; g.add(box);

  // rider
  const rider = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: C('#caa6e6'), roughness: .8 });
  const cloth = new THREE.MeshStandardMaterial({ color: C(PALETTE.decision), roughness: .7, emissive: C(PALETTE.decision), emissiveIntensity: .08 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.8, 4, 10), cloth);
  torso.position.set(0, 2.25, -0.5); torso.rotation.x = 0.28; torso.castShadow = true; rider.add(torso);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 14),
    new THREE.MeshStandardMaterial({ color: C(PALETTE.action), roughness: .35, metalness: .25 }));
  helmet.position.set(0, 2.95, -0.2); rider.add(helmet);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.12), new THREE.MeshStandardMaterial({ color: C('#0c0912'), roughness: .2, metalness: .6 }));
  visor.position.set(0, 2.95, 0.12); rider.add(visor);
  g.add(rider);

  g.userData.box = box; g.userData.boxMat = boxMat; g.userData.rider = rider;
  return { group: g };
}

export class Player {
  constructor(scene, start = { x: 0, z: 26, yaw: Math.PI }) {
    const { group } = buildMotorcycle();
    this.mesh = group;
    this.mesh.position.set(start.x, 0, start.z);
    scene.add(this.mesh);

    this.yaw = start.yaw;
    this.speed = 0;
    this.position = this.mesh.position;
    this.headingVec = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this._roll = 0;
    this._tmp = new THREE.Vector3();
  }

  reset(start = { x: 0, z: 26, yaw: Math.PI }) {
    this.mesh.position.set(start.x, 0, start.z);
    this.yaw = start.yaw; this.speed = 0; this._roll = 0;
  }

  setCarrying(visible) {
    this.mesh.userData.boxMat.emissiveIntensity = visible ? 0.85 : 0.25;
  }
  setFoodColor(hex) {
    this.mesh.userData.boxMat.emissive.set(hex);
  }

  // External knockback (collision). v: THREE.Vector3 world velocity-ish.
  applyKnockback(dirVec, magnitude) {
    this._tmp.copy(dirVec).setY(0).normalize().multiplyScalar(magnitude * 0.12);
    this.mesh.position.add(this._tmp);
    this.speed *= -0.2; // jolt
  }

  // input: { forward, back, left, right }; opts: { speedMult, engineCut, push }
  // push=true means out of gas: the rider drags the bike on foot — throttle
  // still works (you provide the force) but speedMult crawls it.
  update(dt, input, opts = {}) {
    const T = TUNING;
    const mult = opts.speedMult ?? 1;
    const top = T.maxSpeed * mult;
    const cut = !!opts.engineCut && !opts.push; // pushing lets you still move

    if (!cut && input.forward) this.speed += T.accel * dt;
    else if (input.back) this.speed -= T.reverseAccel * dt;
    else {
      const f = T.friction * dt;
      if (this.speed > f) this.speed -= f;
      else if (this.speed < -f) this.speed += f;
      else this.speed = 0;
    }
    if (input.back && this.speed > 0) this.speed -= T.brakeFriction * dt;
    this.speed = Math.max(-T.maxSpeed * 0.45, Math.min(top, this.speed));

    const speedFactor = Math.min(1, Math.abs(this.speed) / 6);
    const dir = this.speed >= 0 ? 1 : -1;
    let steer = 0;
    if (input.left) steer += 1;
    if (input.right) steer -= 1;
    this.yaw += steer * T.turnRate * speedFactor * dir * dt;

    this.headingVec.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this._tmp.copy(this.headingVec).multiplyScalar(this.speed * dt);
    this.mesh.position.add(this._tmp);

    this.mesh.rotation.y = this.yaw;
    const targetRoll = -steer * T.lean * speedFactor;
    this._roll += (targetRoll - this._roll) * Math.min(1, dt * 8);
    this.mesh.rotation.z = this._roll;
  }
}
