// ============================================================
//  GAVRIL — One Shift · mount.js
//  Mode controller: the player is on foot by default and rides the
//  parked motorcycle by walking up to it and pressing F (F to hop off).
//  Owns which body is active and hands the camera over on each swap.
// ============================================================

import * as THREE from 'three';
import { TUNING, SPAWN } from './config.js';

export class Mount {
  constructor(avatar, bike, followCam) {
    this.avatar = avatar;
    this.bike = bike;
    this.cam = followCam;
    this.mode = 'foot';
    this._side = new THREE.Vector3();
    this._applyVisibility();
  }

  get body() { return this.mode === 'foot' ? this.avatar : this.bike; }
  get isRiding() { return this.mode === 'bike'; }

  distanceToBike() {
    return Math.hypot(
      this.avatar.position.x - this.bike.position.x,
      this.avatar.position.z - this.bike.position.z
    );
  }
  canMount() { return this.mode === 'foot' && this.distanceToBike() < TUNING.mountRadius; }

  _applyVisibility() {
    const riding = this.mode === 'bike';
    this.avatar.mesh.visible = !riding;
    if (this.bike.mesh.userData.rider) this.bike.mesh.userData.rider.visible = riding;
  }

  toggle() {
    if (this.mode === 'foot') { if (this.canMount()) { this.mount(); return 'mounted'; } return null; }
    this.dismount(); return 'dismounted';
  }

  mount() {
    this.mode = 'bike';
    this.bike.speed = 0;
    this._applyVisibility();
    this.cam.snap();
  }

  dismount() {
    this.mode = 'foot';
    // step off to the left of the bike, facing the bike's heading
    this._side.set(Math.cos(this.bike.yaw), 0, -Math.sin(this.bike.yaw)).multiplyScalar(2.4);
    this.avatar.mesh.position.set(
      this.bike.position.x + this._side.x, 0, this.bike.position.z + this._side.z
    );
    this.avatar.yaw = this.bike.yaw;
    this.avatar.speed = 0;
    this.bike.speed = 0;
    this._applyVisibility();
    this.cam.snap();
  }

  reset() {
    this.mode = 'foot';
    this.avatar.reset(SPAWN.foot);
    this.bike.reset(SPAWN.bike);
    this._applyVisibility();
    this.cam.snap();
  }
}
