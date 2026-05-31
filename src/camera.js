// ============================================================
//  GAVRIL — One Shift · camera.js
//  Shared smoothed third-person follow camera used by both the
//  on-foot avatar and the motorcycle. Supports a transient shake.
// ============================================================

import * as THREE from 'three';

export class FollowCam {
  constructor(camera) {
    this.camera = camera;
    this._init = false;
    this._desired = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._shake = 0;
  }

  // p: { dist, height, look, lerp }
  follow(pos, headingVec, dt, p) {
    this._desired.copy(headingVec).multiplyScalar(-p.dist).add(pos);
    this._desired.y = p.height;

    if (!this._init) { this.camera.position.copy(this._desired); this._init = true; }
    else this.camera.position.lerp(this._desired, Math.min(1, dt * p.lerp));

    // decaying positional shake
    if (this._shake > 0.0001) {
      const s = this._shake;
      this.camera.position.x += (Math.sin(pos.x * 13 + s * 90) * s);
      this.camera.position.y += (Math.cos(s * 120) * s * 0.6);
      this._shake = Math.max(0, this._shake - dt * 2.2);
    }

    this._look.copy(pos); this._look.y += p.look;
    this.camera.lookAt(this._look);
  }

  // Force the camera to the ideal pose immediately (used on mode swap).
  snap() { this._init = false; }

  addShake(amount) { this._shake = Math.min(1.2, this._shake + amount); }
}
