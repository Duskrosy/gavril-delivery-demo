import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Needs } from '../src/needs.js';

const T = {
  gasMax: 100, gasDrainPerSec: 5, gasLow: 25, gasLowSpeedMult: 0.55, gasPushMult: 0.2, refuelPerSec: 70,
  hungerMax: 100, hungerDrainPerSec: 2, hungerLow: 35, hungerMinMult: 0.5,
};

test('gas only drains while riding & moving', () => {
  const n = new Needs(T);
  n.update(1, { riding: true, moving: true });
  assert.equal(n.gas, 95);
  n.update(1, { riding: true, moving: false }); // idling, no drain
  assert.equal(n.gas, 95);
  n.update(1, { riding: false, moving: true });  // on foot, no gas use
  assert.equal(n.gas, 95);
});

test('hunger drains always and clamps at zero', () => {
  const n = new Needs(T);
  n.update(10, { riding: false, moving: false });
  assert.equal(n.hunger, 80);
  n.update(1000, {});
  assert.equal(n.hunger, 0);
});

test('engine cuts at empty gas but you can still push (crawl); refuel restores', () => {
  const n = new Needs({ ...T, gasMax: 10 });
  n.update(3, { riding: true, moving: true }); // 10 - 15 -> 0
  assert.equal(n.gas, 0);
  assert.equal(n.engineCut, true);
  assert.equal(n.bikeSpeedMult, T.gasPushMult); // can still crawl/push
  n.refuel(1); // +70 capped to 10
  assert.equal(n.gas, 10);
  assert.equal(n.engineCut, false);
});

test('bike speed is capped when low on gas', () => {
  const n = new Needs(T);
  n.setGas(20); // below gasLow=25
  assert.equal(n.bikeSpeedMult, 0.55);
  n.setGas(60);
  assert.equal(n.bikeSpeedMult, 1);
});

test('low hunger scales move speed down to a floor', () => {
  const n = new Needs(T);
  n.setHunger(100);
  assert.equal(n.moveSpeedMult, 1);
  n.setHunger(0);
  assert.equal(n.moveSpeedMult, 0.5);
  n.setHunger(T.hungerLow); // exactly at threshold -> still full
  assert.equal(n.moveSpeedMult, 1);
  n.eat();
  assert.equal(n.hunger, 100);
});
