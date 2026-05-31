// ============================================================
//  GAVRIL — One Shift · main.js
//  Bootstrap + render loop + input, wiring GameState (logic),
//  world/avatar/bike/traffic (3D), needs (pace governors), and the
//  HUD (DOM). On foot by default; walk to the bike and press F to ride.
// ============================================================

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { ORDERS, CUSTOMERS, TUNING, SPAWN, PALETTE, SPEED_BUMPS, customerById } from './config.js';
import { GameState, STATES } from './game.js';
import { FOOD } from './rules.js';
import { Needs } from './needs.js';
import { loadImages } from './assets.js';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { Avatar } from './avatar.js';
import { Mount } from './mount.js';
import { Traffic } from './traffic.js';
import { FollowCam } from './camera.js';
import { HUD } from './ui.js';

const joinedOrders = ORDERS.map(o => ({ ...o, customer: customerById(o.customerId) }));
const SHIFT_CLOCKS = ['Evening', 'Dinner rush', 'Late-night'];
const FOOD_COLOR = { [FOOD.FRESH]: PALETTE.action, [FOOD.DAMAGED]: PALETTE.reward, [FOOD.DESTROYED]: PALETTE.decision };
const CAM = {
  foot: { dist: TUNING.footCamDist, height: TUNING.footCamHeight, look: TUNING.footCamLook, lerp: TUNING.footCamLerp },
  bike: { dist: TUNING.camDist, height: TUNING.camHeight, look: TUNING.camLook, lerp: TUNING.camLerp },
};

// --- renderer / scene / camera ---------------------------------------------
const canvas = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 9, 44);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.62, 0.4, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// --- systems ---------------------------------------------------------------
const world = buildWorld(scene);
const avatar = new Avatar(scene, SPAWN.foot);
const bike = new Player(scene, SPAWN.bike);
const followCam = new FollowCam(camera);
const mount = new Mount(avatar, bike, followCam);
const traffic = new Traffic(scene, world.trafficLight);
const needs = new Needs(TUNING);
const game = new GameState(joinedOrders, TUNING);
const hud = new HUD();

let assets = {};
let handoffOpen = false;
let started = false;
let collideCd = 0;
let bumpCd = 0;
const _kb = new THREE.Vector3();

// --- input ------------------------------------------------------------------
const input = { forward: false, back: false, left: false, right: false };
const KEYMAP = {
  KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
};
addEventListener('keydown', (e) => {
  if (KEYMAP[e.code]) { input[KEYMAP[e.code]] = true; e.preventDefault(); }
  if (e.code === 'KeyF') tryMount();
  if (e.code === 'KeyE') tryAction();
});
addEventListener('keyup', (e) => { if (KEYMAP[e.code]) { input[KEYMAP[e.code]] = false; e.preventDefault(); } });

const noInput = { forward: false, back: false, left: false, right: false };
const dist2 = (a, p) => Math.hypot(a.x - p.x, a.z - p.z);
const SPEED_BUMP_POS = SPEED_BUMPS.map(b => b.position);

// --- order presentation -----------------------------------------------------
function presentOrder() {
  const order = game.current;
  if (!order) return;
  hud.showOrder(order, assets[order.food], tryAccept);
  hud.setObjective(`New order from <b>${order.customer.name}</b> — accept to start`);
  hud.setStats({ clock: SHIFT_CLOCKS[Math.min(game.served, SHIFT_CLOCKS.length - 1)] });
}

function tryAccept() {
  if (!started || game.state !== STATES.OFFER) return;
  game.accept();
  hud.hideOrderCard();
  hud.setObjective('Head to the <b>glowing restaurant</b> to grab the order');
}

// E: accept an offer, or eat if next to a food source
function tryAction() {
  if (!started) return;
  if (game.state === STATES.OFFER) { tryAccept(); return; }
  const body = mount.body;
  const nearEat = dist2(body.position, world.restaurantPos) < TUNING.eatRadius
    || dist2(body.position, world.foodStand.position3) < TUNING.eatRadius;
  if (nearEat && needs.hunger < TUNING.hungerMax - 1) {
    needs.eat();
    hud.toast('Fed — back to full');
  }
}

function tryMount() {
  if (!started) return;
  const r = mount.toggle();
  if (r === 'mounted') { hud.setMode(true); hud.toast('Engine on'); }
  else if (r === 'dismounted') { hud.setMode(false); hud.toast('Hopped off'); }
}

// --- loop beats -------------------------------------------------------------
function reachRestaurant() {
  game.arriveRestaurant();
  const order = game.current;
  hud.toast('Order picked up');
  hud.setObjective(`Deliver to <b>${order.customer.name}</b> — ${order.addressHint}`);
}

function doRemake() {
  game.remakePickup();
  const order = game.current;
  hud.toast('Fresh remake — go!');
  hud.setObjective(`Deliver to <b>${order.customer.name}</b> — ${order.addressHint}`);
}

function reachHouse() {
  game.arriveHouse();
  handoffOpen = true;
  hud.setWaypoint({ visible: false });
  world.marker.visible = false;
  const order = game.current;
  hud.openVignette(order, assets[order.customer.portrait], (choice) => {
    const result = game.resolveHandoff(choice);
    hud.closeVignette();
    handoffOpen = false;
    const isLast = game.served + 1 >= game.ordersPerShift;
    hud.setStats({ cash: game.cash, avgRating: game.summary.avgRating || result.rating, served: game.served + 1, total: game.ordersPerShift });
    hud.showPayout(result, () => {
      hud.hidePayout();
      game.next();
      if (game.state === STATES.SHIFT_DONE) { hud.setObjective(''); hud.showSummary(game.summary, replay); }
      else presentOrder();
    }, isLast);
  });
}

function replay() {
  hud.hideSummary();
  game.reset();
  needs.reset();
  mount.reset();
  hud.setMode(false);
  hud.setStats({ cash: 0, avgRating: 5, served: 0, total: game.ordersPerShift });
  hud.el.hud.classList.remove('hidden');
  presentOrder();
}

// --- collisions & hazards ---------------------------------------------------
function handleCollisions(dt) {
  collideCd = Math.max(0, collideCd - dt);
  bumpCd = Math.max(0, bumpCd - dt);
  const body = mount.body;

  // cars
  if (collideCd === 0) {
    const hit = traffic.collide(body);
    if (hit && hit.relSpeed >= TUNING.impactMinor) {
      collideCd = TUNING.collisionCooldown;
      body.applyKnockback(hit.dir, TUNING.knockback);
      followCam.addShake(hit.relSpeed >= TUNING.impactCrash ? 0.9 : 0.4);
      if (game.carrying) {
        const impact = hit.relSpeed >= TUNING.impactCrash ? 'crash' : 'minor';
        const state = game.damageFood(impact);
        if (state === FOOD.DESTROYED) {
          hud.toast('Food destroyed!');
          hud.setObjective('Order ruined — ride back to the <b>restaurant</b> for a remake');
        } else {
          hud.toast('Careful! Order shaken');
        }
      } else {
        hud.toast('Crash!');
      }
    }
  }

  // speed bumps — slow + jolt when crossing
  if (bumpCd === 0 && Math.abs(body.speed) > 4) {
    for (const b of SPEED_BUMP_POS) {
      if (dist2(body.position, b) < 2.2) {
        body.speed *= TUNING.bumpSlowMult;
        followCam.addShake(0.25);
        bumpCd = TUNING.bumpCooldown;
        break;
      }
    }
  }
}

// --- waypoint target --------------------------------------------------------
function targetForState() {
  const order = game.current;
  if (!order) return null;
  if (game.state === STATES.TO_RESTAURANT) return world.restaurantPos;
  if (game.state === STATES.TO_HOUSE) {
    if (game.needsRemake) return world.restaurantPos;
    const h = world.houses[order.houseId];
    return h ? h.position3 : null;
  }
  return null;
}

const _v = new THREE.Vector3();
function updateWaypoint() {
  const body = mount.body;
  const target = targetForState();
  if (!target || handoffOpen) { hud.setWaypoint({ visible: false }); world.marker.visible = false; return; }

  world.marker.visible = true;
  world.marker.position.set(target.x, 0, target.z);
  const dist = dist2(body.position, target);

  _v.set(target.x, 3, target.z).project(camera);
  const W = window.innerWidth, H = window.innerHeight;
  const behind = _v.z > 1;
  let nx = _v.x, ny = _v.y;
  if (behind) { nx = -nx; ny = -ny; }
  let px = (nx * 0.5 + 0.5) * W, py = (-ny * 0.5 + 0.5) * H;
  const cx = W / 2, cy = H / 2;
  let dx = px - cx, dy = py - cy;
  const onScreen = !behind && Math.abs(nx) <= 1 && Math.abs(ny) <= 1;
  const margin = 90;
  if (!onScreen) {
    const scale = Math.min((W / 2 - margin) / Math.max(1, Math.abs(dx)), (H / 2 - margin) / Math.max(1, Math.abs(dy)));
    px = cx + dx * scale; py = cy + dy * scale; dx = px - cx; dy = py - cy;
  } else { py -= 56; }
  hud.setWaypoint({ visible: true, x: px, y: py, angle: Math.atan2(dy, dx) + Math.PI / 2, dist });
}

// --- contextual prompt ------------------------------------------------------
function updatePrompt() {
  const body = mount.body;
  if (!mount.isRiding && mount.canMount()) { hud.setPrompt('Press <kbd>F</kbd> to ride'); return; }
  const onPad = mount.isRiding && world.gasStations.some(s => dist2(body.position, s.position3) < TUNING.refuelRadius);
  if (onPad && needs.gas < TUNING.gasMax - 1) { hud.setPrompt('Refueling…'); return; }
  const nearEat = (dist2(body.position, world.restaurantPos) < TUNING.eatRadius
    || dist2(body.position, world.foodStand.position3) < TUNING.eatRadius) && needs.hunger < TUNING.hungerMax - 1;
  if (nearEat) { hud.setPrompt('Press <kbd>E</kbd> to eat'); return; }
  hud.setPrompt('');
}

// --- food indicator on the active body -------------------------------------
function updateCarryVisual() {
  const fs = game.foodState;
  const carrying = fs !== FOOD.NONE;
  for (const b of [avatar, bike]) {
    b.setCarrying(carrying);
    if (carrying) b.setFoodColor(FOOD_COLOR[fs] || PALETTE.action);
  }
  hud.setCarry(fs);
}

// --- main loop --------------------------------------------------------------
const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const body = mount.body;
  const active = started && !handoffOpen;

  // movement with pace-governor multipliers
  const ctrl = active ? input : noInput;
  if (mount.isRiding) {
    body.update(dt, ctrl, { speedMult: needs.bikeSpeedMult, engineCut: needs.engineCut });
  } else {
    body.update(dt, ctrl, { speedMult: needs.moveSpeedMult });
  }
  followCam.follow(body.position, body.headingVec, dt, mount.isRiding ? CAM.bike : CAM.foot);

  world.update(dt);
  traffic.update(dt);

  if (active) {
    const moving = Math.abs(body.speed) > 1;
    needs.update(dt, { riding: mount.isRiding, moving });

    // auto-refuel on a gas pad
    if (mount.isRiding && world.gasStations.some(s => dist2(body.position, s.position3) < TUNING.refuelRadius)) {
      needs.refuel(dt);
    }

    handleCollisions(dt);

    // proximity beats
    if (game.state === STATES.TO_RESTAURANT && dist2(body.position, world.restaurantPos) < TUNING.pickupRadius) {
      reachRestaurant();
    } else if (game.state === STATES.TO_HOUSE) {
      if (game.needsRemake) {
        if (dist2(body.position, world.restaurantPos) < TUNING.pickupRadius) doRemake();
      } else {
        const h = world.houses[game.current.houseId];
        if (h && dist2(body.position, h.position3) < TUNING.handoffRadius) reachHouse();
      }
    }

    updatePrompt();
  } else {
    hud.setPrompt('');
  }

  // HUD reflections
  hud.setNeeds({ gasPct: needs.gasPct, hungerPct: needs.hungerPct, lowGas: needs.lowGas, lowHunger: needs.lowHunger });
  updateCarryVisual();
  updateWaypoint();

  composer.render();
}

addEventListener('resize', () => {
  const W = window.innerWidth, H = window.innerHeight;
  camera.aspect = W / H; camera.updateProjectionMatrix();
  renderer.setSize(W, H); composer.setSize(W, H); bloom.setSize(W, H);
});

// --- boot -------------------------------------------------------------------
async function boot() {
  tick();
  const specs = [
    ...ORDERS.map(o => ({ name: o.food, label: o.foodName })),
    ...CUSTOMERS.map(c => ({ name: c.portrait, label: c.name })),
  ];
  assets = await loadImages(specs);
  hud.setReady();
}

hud.onStart(() => {
  started = true;
  hud.beginPlay();
  hud.setMode(false);
  hud.setStats({ cash: 0, avgRating: 5, served: 0, total: game.ordersPerShift });
  presentOrder();
});

if (new URLSearchParams(location.search).get('dev')) {
  window.__demo = { game, avatar, bike, mount, needs, traffic, world, hud, STATES, FOOD, TUNING, get input() { return input; } };
}

boot();
