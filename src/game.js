// ============================================================
//  GAVRIL — One Shift · game.js
//  Pure-logic state machine. Single source of truth for the loop.
//  No Three.js, no DOM — fully unit-testable in Node.
// ============================================================

import { FOOD, nextFoodState, deliveryModifiers } from './rules.js';

export const STATES = Object.freeze({
  OFFER: 'OFFER',
  TO_RESTAURANT: 'TO_RESTAURANT',
  PICKED_UP: 'PICKED_UP',
  TO_HOUSE: 'TO_HOUSE',
  HANDOFF: 'HANDOFF',
  PAID: 'PAID',
  SHIFT_DONE: 'SHIFT_DONE',
});

// Valid "read the customer" choices.
export const CHOICES = Object.freeze(['friendly', 'quick', 'polite']);

export class GameState {
  #state;
  #orders;
  #ordersPerShift;
  #index;        // index into #orders for the current order
  #served;       // count of completed orders this shift
  #cash;
  #ratings;      // array of per-order ratings
  #lastResult;   // last resolveHandoff result
  #carried;      // FOOD state of the order in hand

  constructor(orders, tuning = {}) {
    if (!Array.isArray(orders) || orders.length === 0) {
      throw new Error('GameState requires a non-empty orders array');
    }
    this.#orders = orders;
    this.#ordersPerShift = Math.min(tuning.ordersPerShift ?? 3, orders.length);
    this.#index = 0;
    this.#served = 0;
    this.#cash = 0;
    this.#ratings = [];
    this.#lastResult = null;
    this.#carried = FOOD.NONE;
    this.#state = STATES.OFFER;
  }

  // --- queries -------------------------------------------------------------
  get state() { return this.#state; }
  get cash() { return this.#cash; }
  get served() { return this.#served; }
  get ordersPerShift() { return this.#ordersPerShift; }
  get lastResult() { return this.#lastResult; }
  get foodState() { return this.#carried; }
  get carrying() { return this.#carried === FOOD.FRESH || this.#carried === FOOD.DAMAGED; }
  get needsRemake() { return this.#carried === FOOD.DESTROYED; }

  get current() {
    if (this.#state === STATES.SHIFT_DONE) return null;
    return this.#orders[this.#index];
  }

  get summary() {
    const totalCash = this.#cash;
    const avgRating = this.#ratings.length
      ? this.#ratings.reduce((s, r) => s + r, 0) / this.#ratings.length
      : 0;
    return { totalCash, avgRating, ordersDone: this.#served };
  }

  // --- transition guard ----------------------------------------------------
  #expect(...allowed) {
    if (!allowed.includes(this.#state)) {
      throw new Error(
        `Illegal transition from ${this.#state}; expected one of ${allowed.join(', ')}`
      );
    }
  }

  // --- transitions ---------------------------------------------------------
  accept() {
    this.#expect(STATES.OFFER);
    this.#state = STATES.TO_RESTAURANT;
    return this.#state;
  }

  // Pickup is an instantaneous beat: we surface PICKED_UP as the return value
  // but settle into TO_HOUSE so callers can show a quick "Picked up" pulse.
  arriveRestaurant() {
    this.#expect(STATES.TO_RESTAURANT);
    this.#carried = FOOD.FRESH;
    this.#state = STATES.TO_HOUSE;
    return STATES.PICKED_UP;
  }

  // Apply a collision impact to the food in hand. Returns the new FOOD state.
  damageFood(impact) {
    this.#carried = nextFoodState(this.#carried, impact);
    return this.#carried;
  }

  // After a crash destroys the order, the player rides back to the restaurant
  // for a free remake — this restocks a fresh order.
  remakePickup() {
    this.#expect(STATES.TO_HOUSE);
    if (this.#carried !== FOOD.DESTROYED) return this.#carried;
    this.#carried = FOOD.FRESH;
    return this.#carried;
  }

  arriveHouse() {
    this.#expect(STATES.TO_HOUSE);
    if (this.#carried === FOOD.DESTROYED) {
      throw new Error('cannot hand off destroyed food; remake required');
    }
    this.#state = STATES.HANDOFF;
    return this.#state;
  }

  // choice ∈ CHOICES. Matching the customer's preference earns a higher
  // rating and a bigger tip.
  resolveHandoff(choice) {
    this.#expect(STATES.HANDOFF);
    const order = this.#orders[this.#index];
    const prefers = order.customer?.prefers;
    const match = choice === prefers;

    const mods = deliveryModifiers(this.#carried);
    const pay = order.basePay;
    const tip = Math.round(pay * (match ? 0.25 : 0.1) * mods.tipMult);
    const total = pay + tip;
    const rating = Math.min(match ? 5 : 4, mods.ratingCap);

    this.#cash += total;
    this.#ratings.push(rating);
    this.#lastResult = { pay, tip, total, rating, match, choice, prefers,
      foodState: this.#carried, foodNote: mods.note };
    this.#carried = FOOD.NONE;
    this.#state = STATES.PAID;
    return this.#lastResult;
  }

  next() {
    this.#expect(STATES.PAID);
    this.#served += 1;
    if (this.#served >= this.#ordersPerShift) {
      this.#state = STATES.SHIFT_DONE;
      return this.#state;
    }
    this.#index = (this.#index + 1) % this.#orders.length;
    this.#state = STATES.OFFER;
    return this.#state;
  }

  // Restart a fresh shift (replay button). Reuses the same order table.
  reset() {
    this.#index = 0;
    this.#served = 0;
    this.#cash = 0;
    this.#ratings = [];
    this.#lastResult = null;
    this.#carried = FOOD.NONE;
    this.#state = STATES.OFFER;
    return this.#state;
  }
}
