// ============================================================
//  GAVRIL — One Shift · camera.js
//  Roblox-style third-person orbit camera. Right-drag (or Ctrl
//  shift-lock / pointer-lock) rotates it around the character;
//  the wheel zooms; it eases behind you as you move.
// ============================================================

import * as THREE from 'three';
import { CAMERA } from './config.js';

export class OrbitCam {
  constructor(camera) {
    this.camera = camera;
    this.yaw = Math.PI;          // start behind a character facing -z (spawn)
    this.pitch = CAMERA.pitch0;
    this.dist = CAMERA.distFoot;
    this.targetDist = CAMERA.distFoot;
    this.manual = false;         // true while right-dragging or pointer-locked
    this._shake = 0;
    this._look = new THREE.Vector3();
  }

  addLook(dx, dy) {
    this.yaw -= dx * CAMERA.sens;
    const s = CAMERA.invertY ? -1 : 1;
    this.pitch = Math.min(CAMERA.pitchMax, Math.max(CAMERA.pitchMin, this.pitch + dy * CAMERA.sens * s));
  }
  zoom(d) { this.targetDist = Math.min(CAMERA.distMax, Math.max(CAMERA.distMin, this.targetDist + d)); }
  setBaseDist(d) { this.targetDist = d; }
  addShake(a) { this._shake = Math.min(1.2, this._shake + a); }
  snap() { /* orbit state persists across mode swaps */ }

  // ground-plane forward / right for camera-relative (shift-lock) movement
  forward() { return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) }; }
  right() { return { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) }; }

  // target: THREE.Vector3; headingYaw: body yaw; moving: bool
  update(target, headingYaw, dt, moving) {
    // ease the camera behind your heading while moving, unless you're steering it
    if (moving && !this.manual) {
      let d = headingYaw - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * CAMERA.trail);
    }
    this.dist += (this.targetDist - this.dist) * Math.min(1, dt * 6);

    const horiz = this.dist * Math.cos(this.pitch);
    let cx = target.x - Math.sin(this.yaw) * horiz;
    let cz = target.z - Math.cos(this.yaw) * horiz;
    let cy = target.y + this.dist * Math.sin(this.pitch) + 1.0;

    if (this._shake > 0.0001) {
      cx += Math.sin(this._shake * 90) * this._shake;
      cy += Math.cos(this._shake * 120) * this._shake * 0.6;
      this._shake = Math.max(0, this._shake - dt * 2.2);
    }
    this.camera.position.set(cx, cy, cz);
    this._look.set(target.x, target.y + CAMERA.lookY, target.z);
    this.camera.lookAt(this._look);
  }
}
