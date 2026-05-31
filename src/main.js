// ============================================================
//  GAVRIL — One Shift · main.js
//  Bootstrap + render loop + input. On foot by default; walk to the
//  bike and press F to ride. Clock in at the restaurant to receive
//  orders. Day/night cycles continuously; cars, a traffic light,
//  speed bumps, and solid collision make the city feel alive.
// ============================================================

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { ORDERS, CUSTOMERS, TUNING, SPAWN, WORLD, PALETTE, SPEED_BUMPS, CAMERA, MULTIPLAYER, customerById } from './config.js';
import { GameState, STATES } from './game.js';
import { FOOD } from './rules.js';
import { Needs } from './needs.js';
import { resolveSolids } from './collision.js';
import { loadImages } from './assets.js';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { Avatar } from './avatar.js';
import { Mount } from './mount.js';
import { Traffic } from './traffic.js';
import { DayNight } from './daynight.js';
import { OrbitCam } from './camera.js';
import { Net } from './net.js';
import { RemotePlayers } from './remote.js';
import { HUD } from './ui.js';

const joinedOrders = ORDERS.map(o => ({ ...o, customer: customerById(o.customerId) }));
const FOOD_COLOR = { [FOOD.FRESH]: PALETTE.action, [FOOD.DAMAGED]: PALETTE.reward, [FOOD.DESTROYED]: PALETTE.decision };
const FOOT_R = 1.3, BIKE_R = 1.9;
const ROAD_HALF = (WORLD.roadWidth ?? 12) / 2;

// --- renderer / scene / camera ---------------------------------------------
const canvas = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 600);
camera.position.set(0, 9, 48);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.62, 0.45, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// --- systems ---------------------------------------------------------------
const world = buildWorld(scene);
const avatar = new Avatar(scene, SPAWN.foot);
const bike = new Player(scene, SPAWN.bike);
const followCam = new OrbitCam(camera);
const mount = new Mount(avatar, bike, followCam);
const traffic = new Traffic(scene, world.trafficLights);
const dayNight = new DayNight({ scene, ...world.lights });
const needs = new Needs(TUNING);
const game = new GameState(joinedOrders, TUNING);
const hud = new HUD();

// multiplayer (optional): ?server=wss://… overrides config; empty = single-player
const serverUrl = new URLSearchParams(location.search).get('server') || MULTIPLAYER.url;
const net = new Net(serverUrl);
const remotePlayers = new RemotePlayers(scene);
net.connect(
  (w) => { hud.setMultiplayer(w.name, net.online); hud.toast(`Online · you're ${w.name}`); },
  (reason) => hud.soloToast(reason),
);
let netT = 0, mpStatusT = 0;

let assets = {};
let handoffOpen = false;
let started = false;
let collideCd = 0;
let bumpCd = 0;
let lastPhase = '';
let pushing = false;
let lastPushing = false;
let freezeCam = false; // dev/aerial capture only
let rmb = false;          // right mouse held (orbit)
let lockMode = false;     // Ctrl shift-lock (pointer locked)
let pointerLocked = false;
let camLastRiding = false;
const mobile = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window);

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

// --- Roblox camera input: right-drag orbit, Ctrl shift-lock, wheel zoom ----
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => { if (e.button === 2) rmb = true; });
addEventListener('mouseup', (e) => { if (e.button === 2) rmb = false; });
addEventListener('mousemove', (e) => {
  if (rmb || pointerLocked) followCam.addLook(e.movementX || 0, e.movementY || 0);
});
canvas.addEventListener('wheel', (e) => { followCam.zoom(Math.sign(e.deltaY) * CAMERA.zoomStep); e.preventDefault(); }, { passive: false });
addEventListener('keydown', (e) => {
  if ((e.code === 'ControlLeft' || e.code === 'ControlRight') && !e.repeat) {
    lockMode = !lockMode;
    try { if (lockMode) canvas.requestPointerLock?.(); else document.exitPointerLock?.(); } catch {}
    e.preventDefault();
  }
});
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
  if (!pointerLocked) lockMode = false;
});

// --- touch controls (mobile / tablet) --------------------------------------
if (mobile) {
  document.getElementById('touch').classList.remove('hidden');
  const stick = document.getElementById('stick');
  const knob = document.getElementById('knob');
  let stickId = null;
  const setStick = (e) => {
    const r = stick.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
    knob.style.transform = `translate(${dx * 36}px, ${dy * 36}px)`;
    input.forward = dy < -0.35; input.back = dy > 0.35;
    input.left = dx < -0.35; input.right = dx > 0.35;
  };
  const clearStick = () => { input.forward = input.back = input.left = input.right = false; knob.style.transform = 'translate(0,0)'; stickId = null; };
  stick.addEventListener('pointerdown', (e) => { stickId = e.pointerId; try { stick.setPointerCapture(e.pointerId); } catch { /* synthetic */ } setStick(e); e.preventDefault(); });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) setStick(e); });
  stick.addEventListener('pointerup', (e) => { if (e.pointerId === stickId) clearStick(); });
  stick.addEventListener('pointercancel', (e) => { if (e.pointerId === stickId) clearStick(); });

  const bind = (id, fn) => document.getElementById(id).addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); });
  bind('btn-ride', tryMount);
  bind('btn-act', tryAction);

  // camera orbit: one-finger drag on the canvas (empty area)
  let camId = null, ltx = 0, lty = 0;
  canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') { camId = e.pointerId; ltx = e.clientX; lty = e.clientY; } });
  canvas.addEventListener('pointermove', (e) => { if (e.pointerType === 'touch' && e.pointerId === camId) { followCam.addLook(e.clientX - ltx, e.clientY - lty); ltx = e.clientX; lty = e.clientY; } });
  const endCam = (e) => { if (e.pointerId === camId) camId = null; };
  canvas.addEventListener('pointerup', endCam);
  canvas.addEventListener('pointercancel', endCam);
}

const noInput = { forward: false, back: false, left: false, right: false };
const dist2 = (a, p) => Math.hypot(a.x - p.x, a.z - p.z);
const nearClockIn = (body) => dist2(body.position, world.clockInPos) < TUNING.clockInRadius
  || dist2(body.position, world.restaurantPos) < TUNING.clockInRadius;
const nearEat = (body) => dist2(body.position, world.restaurantPos) < TUNING.eatRadius
  || world.foodStands.some(s => dist2(body.position, s.position3) < TUNING.eatRadius);
const onGasPad = (body) => world.gasStations.some(s => dist2(body.position, s.position3) < TUNING.refuelRadius);

// --- order / shift ----------------------------------------------------------
function presentOrder() {
  const order = game.current;
  if (!order) return;
  hud.showOrder(order, assets[order.food], tryAccept);
  hud.setObjective(`New order from <b>${order.customer.name}</b> — accept to start`);
}

function tryAccept() {
  if (!started || game.state !== STATES.OFFER) return;
  game.accept();
  hud.hideOrderCard();
  hud.setObjective('Head to the <b>glowing restaurant</b> to grab the order');
}

function clockIn() {
  game.clockIn();
  hud.toast('Clocked in — first order!');
  presentOrder();
}

// E: clock in (off shift @ hub) · accept an offer · or eat by a food source
function tryAction() {
  if (!started) return;
  const body = mount.body;
  if (game.state === STATES.OFF_SHIFT) { if (nearClockIn(body)) clockIn(); return; }
  if (game.state === STATES.OFFER) { tryAccept(); return; }
  if (nearEat(body) && needs.hunger < TUNING.hungerMax - 1) { needs.eat(); hud.toast('Fed — back to full'); }
}

function tryMount() {
  if (!started) return;
  const r = mount.toggle();
  if (r === 'mounted') { hud.setMode(true); hud.toast('Engine on'); }
  else if (r === 'dismounted') { hud.setMode(false); hud.toast('Hopped off'); }
}

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
  hud.setObjective('Back on the clock? Head to the <b>restaurant</b> and press <kbd>E</kbd> to clock in');
}

// --- collisions & hazards ---------------------------------------------------
// Car impact runs BEFORE solid push-out (it needs the overlap to still exist).
function handleCarImpact(dt, r) {
  collideCd = Math.max(0, collideCd - dt);
  if (collideCd > 0) return;
  const body = mount.body;
  const hit = traffic.collide(body, r);
  if (!hit || hit.relSpeed < TUNING.impactMinor) return;
  collideCd = TUNING.collisionCooldown;
  body.applyKnockback(hit.dir, TUNING.knockback);
  followCam.addShake(hit.relSpeed >= TUNING.impactCrash ? 0.9 : 0.4);
  if (game.carrying) {
    const impact = hit.relSpeed >= TUNING.impactCrash ? 'crash' : 'minor';
    const state = game.damageFood(impact);
    if (state === FOOD.DESTROYED) {
      hud.toast('Food destroyed!');
      hud.setObjective('Order ruined — ride back to the <b>restaurant</b> for a remake');
    } else hud.toast('Careful! Order shaken');
  } else hud.toast('Crash!');
}

// Speed bumps — road-band detection (perpendicular distance to the bump line).
function handleBumps(dt) {
  bumpCd = Math.max(0, bumpCd - dt);
  const body = mount.body;
  if (bumpCd > 0 || Math.abs(body.speed) <= 3) return;
  for (const b of SPEED_BUMPS) {
    const perp = b.axis === 'z' ? Math.abs(body.position.z - b.position.z) : Math.abs(body.position.x - b.position.x);
    const along = b.axis === 'z' ? Math.abs(body.position.x - b.position.x) : Math.abs(body.position.z - b.position.z);
    if (perp < TUNING.bumpBand && along < ROAD_HALF) {
      body.speed *= TUNING.bumpSlowMult;
      followCam.addShake(TUNING.bumpBounce);
      bumpCd = TUNING.bumpCooldown;
      break;
    }
  }
}

// --- waypoint target --------------------------------------------------------
function targetForState() {
  if (game.state === STATES.OFF_SHIFT) return world.clockInPos;
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

function updatePrompt() {
  const body = mount.body;
  if (pushing && !onGasPad(body)) { hud.setPrompt('Out of gas — push to a <span class="nav-ink">gas station</span>'); return; }
  if (game.state === STATES.OFF_SHIFT && nearClockIn(body)) { hud.setPrompt('Press <kbd>E</kbd> to clock in'); return; }
  if (!mount.isRiding && mount.canMount()) { hud.setPrompt('Press <kbd>F</kbd> to ride'); return; }
  if (mount.isRiding && onGasPad(body) && needs.gas < TUNING.gasMax - 1) { hud.setPrompt('Refueling…'); return; }
  if (nearEat(body) && needs.hunger < TUNING.hungerMax - 1) { hud.setPrompt('Press <kbd>E</kbd> to eat'); return; }
  hud.setPrompt('');
}

// Out of gas: the rider hops off and drags the bike on foot (walk anim).
function updatePushVisual(dt) {
  const rider = bike.mesh.userData.rider;
  if (pushing !== lastPushing) {
    lastPushing = pushing;
    if (pushing) {
      rider.visible = false; avatar.mesh.visible = true;
      hud.setMode(true, 'PUSHING'); hud.toast('Out of gas — push it!');
    } else if (mount.isRiding) {
      rider.visible = true; avatar.mesh.visible = false;
      hud.setMode(true, 'RIDING');
    }
  }
  if (pushing) {
    // stand alongside the bike (to its right), facing the same way, hands on it
    const side = 1.7;
    const rx = bike.headingVec.z, rz = -bike.headingVec.x; // right of heading
    avatar.mesh.position.set(bike.position.x + rx * side, 0, bike.position.z + rz * side);
    avatar.yaw = bike.yaw; avatar.mesh.rotation.y = bike.yaw;
    avatar.animateWalk(dt, Math.min(1, Math.abs(bike.speed) / 4 + 0.3));
  }
}

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

  // advance the living world first so collision uses current car positions
  dayNight.update(dt);
  bloom.strength = dayNight.bloom;
  world.update(dt);
  traffic.update(dt, mount.body.position, mount.isRiding);

  pushing = mount.isRiding && needs.engineCut;
  const ctrl = active ? input : noInput;
  // on foot, move camera-relative (character faces the camera) while shift-lock
  // is on, right-click is held, or on touch devices — Roblox-style.
  const camRelative = lockMode || rmb || mobile;
  if (mount.isRiding) {
    body.update(dt, ctrl, { speedMult: needs.bikeSpeedMult, engineCut: needs.engineCut, push: pushing });
  } else if (camRelative) {
    body.updateLocked(dt, ctrl, followCam.yaw, { speedMult: needs.moveSpeedMult });
  } else {
    body.update(dt, ctrl, { speedMult: needs.moveSpeedMult });
  }
  updatePushVisual(dt);

  const r = mount.isRiding ? BIKE_R : FOOT_R;

  if (active) {
    const moving = Math.abs(body.speed) > 1;
    needs.update(dt, { riding: mount.isRiding, moving });
    if (mount.isRiding && onGasPad(body)) needs.refuel(dt);
    handleCarImpact(dt, r);              // detect overlaps BEFORE push-out
  }

  // solid push-out: cannot pass through buildings, cars, or people
  resolveSolids(body.position, r, world.solids);
  resolveSolids(body.position, r, traffic.solidBoxes());
  resolveSolids(body.position, r, world.agentSolids());

  if (active) {
    handleBumps(dt);
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

  // camera: zoom base follows mode (foot vs bike), orbit handles the rest
  if (mount.isRiding !== camLastRiding) {
    followCam.setBaseDist(mount.isRiding ? CAMERA.distBike : CAMERA.distFoot);
    camLastRiding = mount.isRiding;
  }
  followCam.manual = rmb || pointerLocked;
  if (!freezeCam) followCam.update(body.position, body.yaw, dt, Math.abs(body.speed) > 1);

  // HUD reflections
  hud.setNeeds({ gasPct: needs.gasPct, hungerPct: needs.hungerPct, lowGas: needs.lowGas, lowHunger: needs.lowHunger });
  if (dayNight.phase !== lastPhase) { hud.setStats({ clock: dayNight.phase }); lastPhase = dayNight.phase; }
  updateCarryVisual();
  updateWaypoint();

  // multiplayer: throttled state send + interpolate remote players
  if (net.url) {
    netT += dt;
    if (netT >= 0.066) { netT = 0; net.send({ x: body.position.x, z: body.position.z, yaw: body.yaw, riding: mount.isRiding, carrying: game.foodState }); }
    remotePlayers.sync(net.remotes(), dt);
    mpStatusT += dt;
    if (mpStatusT >= 0.5) { mpStatusT = 0; if (net.connected) hud.setMultiplayer(net.name, net.online); }
  }

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
  hud.setStats({ cash: 0, avgRating: 5, served: 0, total: game.ordersPerShift, clock: dayNight.phase });
  hud.setObjective('Walk or ride to the <b>restaurant</b> and press <kbd>E</kbd> to clock in');
});

if (new URLSearchParams(location.search).get('dev')) {
  window.__demo = { game, avatar, bike, mount, needs, traffic, dayNight, world, hud, camera, orbitCam: followCam,
    net, remotePlayers, STATES, FOOD, TUNING, setFreeze: (v) => { freezeCam = v; }, setLock: (v) => { lockMode = v; }, get input() { return input; } };
}

boot();
