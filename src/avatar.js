// ============================================================
//  GAVRIL — One Shift · avatar.js
//  Blocky Roblox-style character with a simple walk cycle and
//  on-foot movement. Shares the body interface with Player:
//  { mesh, position, headingVec, yaw, update(dt,input,opts), reset() }.
// ============================================================

import * as THREE from 'three';
import { PALETTE, TUNING } from './config.js';

const C = (hex) => new THREE.Color(hex);

function mat(hex, opts = {}) {
  return new THREE.MeshStandardMaterial({ color: C(hex), roughness: .75, ...opts });
}

function buildCharacter() {
  const g = new THREE.Group();

  const skin = mat('#d7b0ec');
  const shirt = mat(PALETTE.action, { emissive: C(PALETTE.action), emissiveIntensity: .12 });
  const pants = mat('#2a2440');
  const shoe = mat('#15101f');

  // torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.7, 0.8), shirt);
  torso.position.y = 3.0; torso.castShadow = true; g.add(torso);

  // head (classic big-ish Roblox head) + simple face cue
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.1, 1.05), skin);
  head.position.y = 4.45; head.castShadow = true; g.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.45, 1.12), mat('#2a2440'));
  hair.position.y = 5.0; g.add(hair);

  // arms (pivot at shoulder so they swing nicely)
  function limb(w, h, d, m) {
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.y = -h / 2; mesh.castShadow = true;
    pivot.add(mesh);
    return pivot;
  }
  const armL = limb(0.5, 1.6, 0.5, skin); armL.position.set(-1.0, 3.75, 0); g.add(armL);
  const armR = limb(0.5, 1.6, 0.5, skin); armR.position.set(1.0, 3.75, 0); g.add(armR);
  const legL = limb(0.6, 1.7, 0.6, pants); legL.position.set(-0.42, 2.1, 0); g.add(legL);
  const legR = limb(0.6, 1.7, 0.6, pants); legR.position.set(0.42, 2.1, 0); g.add(legR);
  // shoes
  for (const [leg, x] of [[legL, -0.42], [legR, 0.42]]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.3, 0.85), shoe);
    s.position.set(x, 0.5, 0.1); g.add(s);
    leg.userData.shoe = s;
  }

  // a small carried order box (hidden unless carrying)
  const boxMat = new THREE.MeshStandardMaterial({ color: C(PALETTE.panel2), emissive: C(PALETTE.action), emissiveIntensity: .6, roughness: .5 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 1.0), boxMat);
  box.position.set(0, 3.1, 0.95); box.visible = false; box.castShadow = true; g.add(box);

  g.scale.setScalar(0.62); // tune overall size to the world
  return { group: g, armL, armR, legL, legR, box, boxMat };
}

export class Avatar {
  constructor(scene, start = { x: 0, z: 30, yaw: Math.PI }) {
    const parts = buildCharacter();
    this.mesh = parts.group;
    this.parts = parts;
    this.mesh.position.set(start.x, 0, start.z);
    scene.add(this.mesh);

    this.yaw = start.yaw;
    this.speed = 0;
    this.position = this.mesh.position;
    this.headingVec = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this._t = 0;
    this._tmp = new THREE.Vector3();
  }

  reset(start = { x: 0, z: 30, yaw: Math.PI }) {
    this.mesh.position.set(start.x, 0, start.z);
    this.yaw = start.yaw; this.speed = 0;
  }

  setCarrying(visible) { this.parts.box.visible = !!visible; }
  setFoodColor(hex) { this.parts.boxMat.color.set(hex); this.parts.boxMat.emissive.set(hex); }

  applyKnockback(dirVec, magnitude) {
    this._tmp.copy(dirVec).setY(0).normalize().multiplyScalar(magnitude * 0.1);
    this.mesh.position.add(this._tmp);
    this.speed = 0;
  }

  // Shift-lock movement: face the camera, move camera-relative (W/S forward,
  // A/D strafe). camYaw is the camera's yaw; opts.speedMult scales speed.
  updateLocked(dt, input, camYaw, opts = {}) {
    const T = TUNING;
    const top = T.footSpeed * (opts.speedMult ?? 1);
    this.yaw = camYaw;
    const fwd = { x: Math.sin(camYaw), z: Math.cos(camYaw) };
    const rgt = { x: Math.cos(camYaw), z: -Math.sin(camYaw) };
    let mx = 0, mz = 0;
    if (input.forward) { mx += fwd.x; mz += fwd.z; }
    if (input.back) { mx -= fwd.x; mz -= fwd.z; }
    if (input.right) { mx += rgt.x; mz += rgt.z; }
    if (input.left) { mx -= rgt.x; mz -= rgt.z; }
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len; mz /= len;
      this.speed = Math.min(top, this.speed + T.footAccel * dt);
      this.mesh.position.x += mx * this.speed * dt;
      this.mesh.position.z += mz * this.speed * dt;
    } else {
      this.speed = Math.max(0, this.speed - T.footFriction * dt);
    }
    this.headingVec.set(fwd.x, 0, fwd.z);
    this.mesh.rotation.y = this.yaw;
    const sp = Math.min(1, this.speed / T.footSpeed);
    this._t += dt * (6 + sp * 6);
    const sw = Math.sin(this._t) * 0.5 * sp;
    this.parts.legL.rotation.x = sw; this.parts.legR.rotation.x = -sw;
    this.parts.armL.rotation.x = -sw; this.parts.armR.rotation.x = sw;
    this.mesh.position.y = Math.abs(Math.sin(this._t)) * 0.12 * sp;
  }

  // Drive the walk cycle without moving (used when pushing the bike on foot).
  animateWalk(dt, intensity = 1) {
    this._t += dt * (6 + intensity * 6);
    const swing = Math.sin(this._t) * 0.5 * intensity;
    this.parts.legL.rotation.x = swing;
    this.parts.legR.rotation.x = -swing;
    // hands forward as if gripping the bike
    this.parts.armL.rotation.x = -1.1;
    this.parts.armR.rotation.x = -1.1;
    this.mesh.position.y = Math.abs(Math.sin(this._t)) * 0.1 * intensity;
  }

  // input: { forward, back, left, right }; opts: { speedMult }
  update(dt, input, opts = {}) {
    const T = TUNING;
    const mult = opts.speedMult ?? 1;
    const top = T.footSpeed * mult;

    // turn in place (foot is nimble)
    let steer = 0;
    if (input.left) steer += 1;
    if (input.right) steer -= 1;
    this.yaw += steer * T.footTurn * dt;
    this.headingVec.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));

    // accelerate forward/back along facing
    let drive = 0;
    if (input.forward) drive += 1;
    if (input.back) drive -= 1;
    if (drive !== 0) this.speed += drive * T.footAccel * dt;
    else {
      const f = T.footFriction * dt;
      this.speed = Math.abs(this.speed) <= f ? 0 : this.speed - Math.sign(this.speed) * f;
    }
    this.speed = Math.max(-top * 0.5, Math.min(top, this.speed));

    this._tmp.copy(this.headingVec).multiplyScalar(this.speed * dt);
    this.mesh.position.add(this._tmp);
    this.mesh.rotation.y = this.yaw;

    // walk cycle — swing legs/arms proportional to speed
    const sp = Math.abs(this.speed) / Math.max(1, T.footSpeed);
    this._t += dt * (6 + sp * 6);
    const swing = Math.sin(this._t) * 0.5 * sp;
    this.parts.legL.rotation.x = swing;
    this.parts.legR.rotation.x = -swing;
    this.parts.armL.rotation.x = -swing;
    this.parts.armR.rotation.x = swing;
    // tiny bob
    this.mesh.position.y = Math.abs(Math.sin(this._t)) * 0.12 * sp;
  }
}
