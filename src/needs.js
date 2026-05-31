// ============================================================
//  GAVRIL — One Shift · needs.js
//  Pace-governor needs (no THREE, no DOM). Gas + hunger are never
//  fail states — they only scale speed and (for gas) cut the engine.
// ============================================================

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class Needs {
  constructor(tuning) {
    this.t = tuning;
    this.gas = tuning.gasMax;
    this.hunger = tuning.hungerMax;
  }

  // ctx: { riding:boolean, moving:boolean }
  update(dt, ctx = {}) {
    if (ctx.riding && ctx.moving) {
      this.gas = clamp(this.gas - this.t.gasDrainPerSec * dt, 0, this.t.gasMax);
    }
    this.hunger = clamp(this.hunger - this.t.hungerDrainPerSec * dt, 0, this.t.hungerMax);
  }

  refuel(dt) { this.gas = clamp(this.gas + this.t.refuelPerSec * dt, 0, this.t.gasMax); }
  eat() { this.hunger = this.t.hungerMax; }

  setGas(v) { this.gas = clamp(v, 0, this.t.gasMax); }
  setHunger(v) { this.hunger = clamp(v, 0, this.t.hungerMax); }

  reset() { this.gas = this.t.gasMax; this.hunger = this.t.hungerMax; }

  get engineCut() { return this.gas <= 0; }
  get gasPct() { return this.gas / this.t.gasMax; }
  get hungerPct() { return this.hunger / this.t.hungerMax; }
  get lowGas() { return this.gas < this.t.gasLow; }
  get lowHunger() { return this.hunger < this.t.hungerLow; }

  // Bike speed multiplier: a slow "push" crawl if empty (you drag it on foot),
  // eased off when low, else full.
  get bikeSpeedMult() {
    if (this.gas <= 0) return this.t.gasPushMult ?? 0.2;
    if (this.gas < this.t.gasLow) return this.t.gasLowSpeedMult;
    return 1;
  }

  // Foot/general move multiplier from hunger: full until the low threshold,
  // then ramps down linearly to hungerMinMult at empty.
  get moveSpeedMult() {
    if (this.hunger >= this.t.hungerLow) return 1;
    const f = this.hunger / this.t.hungerLow; // 0..1 within the low band
    return this.t.hungerMinMult + (1 - this.t.hungerMinMult) * f;
  }
}
