// ============================================================
//  GAVRIL — One Shift · rules.js
//  Pure gameplay rules (no THREE, no DOM). Unit-testable.
//  Collision impact classification + carried-food state + the
//  delivery modifiers a damaged order incurs.
// ============================================================

export const FOOD = Object.freeze({
  NONE: 'none',         // not carrying
  FRESH: 'fresh',
  DAMAGED: 'damaged',
  DESTROYED: 'destroyed',
});

// Classify a collision by relative impact speed.
export function classifyImpact(relSpeed, tuning) {
  if (relSpeed >= tuning.impactCrash) return 'crash';
  if (relSpeed >= tuning.impactMinor) return 'minor';
  return 'none';
}

// Advance the carried-food state given an impact. Damage never heals,
// destroyed is terminal, and a minor hit on damaged food stays damaged.
export function nextFoodState(state, impact) {
  if (state === FOOD.DESTROYED || impact === 'none') return state;
  if (impact === 'crash') return FOOD.DESTROYED;
  // impact === 'minor'
  if (state === FOOD.FRESH) return FOOD.DAMAGED;
  return state; // already damaged
}

// What a given food condition does to the payout at hand-off.
export function deliveryModifiers(state) {
  switch (state) {
    case FOOD.DAMAGED: return { tipMult: 0.4, ratingCap: 3, note: 'a bit shaken up' };
    case FOOD.DESTROYED: return { tipMult: 0, ratingCap: 2, note: 'ruined' };
    default: return { tipMult: 1, ratingCap: 5, note: null };
  }
}
