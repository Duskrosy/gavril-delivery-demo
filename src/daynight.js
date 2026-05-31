// ============================================================
//  GAVRIL — One Shift · daynight.js
//  Drives a continuous time-of-day cycle (Morning → Midday → Dinner
//  → Late-night → …) by lerping sky / fog / lights / bloom between the
//  DAYNIGHT keyframes. Exposes the current phase label + a bloom target.
// ============================================================

import * as THREE from 'three';
import { DAYNIGHT, TUNING } from './config.js';

const col = (hex) => new THREE.Color(hex);

export class DayNight {
  // refs: { scene, hemi, key, fill, ambient }
  constructor(refs) {
    this.refs = refs;
    this.t = TUNING.dayStart ?? 0;
    this.cycle = TUNING.dayCycleSeconds ?? 200;
    this.phase = DAYNIGHT[0].name;
    this.bloom = DAYNIGHT[0].bloom;

    // precompute Color objects per keyframe
    this.kf = DAYNIGHT.map(k => ({
      ...k,
      _sky: col(k.sky), _fog: col(k.fog),
      _hemiSky: col(k.hemiSky), _hemiGround: col(k.hemiGround), _key: col(k.keyColor),
    }));

    // scratch colors
    this._c1 = new THREE.Color();
    this._c2 = new THREE.Color();
    this.apply(0);
  }

  // find the [from,to] keyframe pair and blend factor for cycle pos p∈[0,1)
  _segment(p) {
    const n = this.kf.length;
    for (let i = 0; i < n; i++) {
      const a = this.kf[i];
      const b = this.kf[(i + 1) % n];
      const t0 = a.t;
      const t1 = (i + 1 === n) ? a.t + (1 - a.t) + this.kf[0].t : b.t;
      // handle wrap segment (last -> first crossing 1.0)
      if (i + 1 === n) {
        // segment spans [a.t, 1) ∪ [0, kf[0].t)
        if (p >= a.t || p < this.kf[0].t) {
          const span = (1 - a.t) + this.kf[0].t;
          const along = (p >= a.t) ? (p - a.t) : (p + (1 - a.t));
          return { a, b, f: span > 0 ? along / span : 0 };
        }
      } else if (p >= t0 && p < t1) {
        return { a, b, f: (p - t0) / (t1 - t0) };
      }
    }
    return { a: this.kf[0], b: this.kf[1], f: 0 };
  }

  apply(dt) {
    this.t = (this.t + dt / this.cycle) % 1;
    const { a, b, f } = this._segment(this.t);
    const { scene, hemi, key, ambient } = this.refs;

    if (scene.background && scene.background.isColor) scene.background.lerpColors(a._sky, b._sky, f);
    else scene.background = this._c1.lerpColors(a._sky, b._sky, f).clone();
    if (scene.fog) {
      scene.fog.color.lerpColors(a._fog, b._fog, f);
      scene.fog.near = a.fogNear + (b.fogNear - a.fogNear) * f;
      scene.fog.far = a.fogFar + (b.fogFar - a.fogFar) * f;
    }
    if (hemi) {
      hemi.color.lerpColors(a._hemiSky, b._hemiSky, f);
      hemi.groundColor.lerpColors(a._hemiGround, b._hemiGround, f);
      hemi.intensity = a.hemiInt + (b.hemiInt - a.hemiInt) * f;
    }
    if (key) {
      key.color.lerpColors(a._key, b._key, f);
      key.intensity = a.keyInt + (b.keyInt - a.keyInt) * f;
      key.position.set(
        a.sun[0] + (b.sun[0] - a.sun[0]) * f,
        a.sun[1] + (b.sun[1] - a.sun[1]) * f,
        a.sun[2] + (b.sun[2] - a.sun[2]) * f
      );
    }
    if (ambient) ambient.intensity = a.ambInt + (b.ambInt - a.ambInt) * f;

    this.bloom = a.bloom + (b.bloom - a.bloom) * f;
    this.phase = f < 0.5 ? a.name : b.name;
  }

  update(dt) { this.apply(dt); }
}
