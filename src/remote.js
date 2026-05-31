// ============================================================
//  GAVRIL — One Shift · remote.js
//  Renders other players: a colored blocky avatar (with a scooter when
//  they're riding and a cargo box when carrying) and a floating name
//  tag. Positions are interpolated toward the latest server snapshot.
// ============================================================

import * as THREE from 'three';

const C = (hex) => new THREE.Color(hex);

function makeNameSprite(name, colorHex) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.font = '600 30px "Hanken Grotesk", system-ui, sans-serif';
  const w = Math.min(248, ctx.measureText(name).width + 28);
  const x = (256 - w) / 2;
  ctx.fillStyle = 'rgba(11,8,18,0.78)';
  ctx.beginPath(); ctx.roundRect(x, 12, w, 40, 12); ctx.fill();
  ctx.strokeStyle = colorHex; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#ece8f6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(name, 128, 33);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  spr.scale.set(5.2, 1.3, 1);
  spr.position.y = 5.6;
  spr.renderOrder = 999;
  return spr;
}

// A short-lived speech bubble sprite (Roblox-style). Caller fades + removes it.
export function makeChatSprite(text) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.font = '600 34px "Hanken Grotesk", system-ui, sans-serif';
  const w = Math.min(496, ctx.measureText(text).width + 40);
  const x = (512 - w) / 2;
  ctx.fillStyle = 'rgba(236,232,246,0.96)';
  ctx.beginPath(); ctx.roundRect(x, 8, w, 70, 18); ctx.fill();
  ctx.beginPath(); ctx.moveTo(256 - 12, 76); ctx.lineTo(256 + 12, 76); ctx.lineTo(256, 98); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1a1326'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 44);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(9.2, 2.3, 1);
  spr.position.y = 7.4;
  spr.renderOrder = 1000;
  return spr;
}

function makeRemoteMesh(colorHex, name) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: C(colorHex), roughness: .7, emissive: C(colorHex), emissiveIntensity: .12 });
  const skin = new THREE.MeshStandardMaterial({ color: C('#d7b0ec'), roughness: .8 });
  const dark = new THREE.MeshStandardMaterial({ color: C('#2a2440'), roughness: .8 });
  const tire = new THREE.MeshStandardMaterial({ color: C('#0c0912'), roughness: .95 });

  // --- on-foot figure ---
  const walk = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.7, 0.8), shirt); torso.position.y = 3.0; torso.castShadow = true; walk.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.1, 1.05), skin); head.position.y = 4.45; head.castShadow = true; walk.add(head);
  for (const x of [-0.42, 0.42]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.7, 0.6), dark); leg.position.set(x, 1.55, 0); walk.add(leg); }
  g.add(walk);

  // --- motorcycle + seated rider (shown when riding) ---
  const bike = new THREE.Group();
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.85, 2.4), shirt); tank.position.set(0, 1.35, 0.1); tank.castShadow = true; bike.add(tank);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.34, 1.3), dark); seat.position.set(0, 1.55, -0.85); bike.add(seat);
  const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.8, 8), dark); fork.position.set(0, 1.4, 1.5); fork.rotation.x = -0.35; bike.add(fork);
  const hbar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 8), dark); hbar.position.set(0, 2.1, 1.25); hbar.rotation.z = Math.PI / 2; bike.add(hbar);
  const hl = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshStandardMaterial({ color: C('#fff0c8'), emissive: C('#fff0c8'), emissiveIntensity: 1.4 })); hl.position.set(0, 1.7, 2.0); bike.add(hl);
  for (const z of [1.85, -1.55]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.34, 16), tire); w.rotation.z = Math.PI / 2; w.position.set(0, 0.85, z); w.castShadow = true; bike.add(w); }
  const rtorso = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.4, 0.8), shirt); rtorso.position.set(0, 2.4, -0.3); rtorso.rotation.x = 0.2; rtorso.castShadow = true; bike.add(rtorso);
  const rhead = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 1.0), skin); rhead.position.set(0, 3.3, -0.1); bike.add(rhead);
  bike.visible = false; g.add(bike);

  // cargo box (shown when carrying) — sits on the back of whichever is active
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 1.0),
    new THREE.MeshStandardMaterial({ color: C('#1c1429'), emissive: C('#ffc864'), emissiveIntensity: .5, roughness: .5 }));
  box.position.set(0, 2.7, -1.1); box.visible = false; g.add(box);

  g.add(makeNameSprite(name, colorHex));
  g.scale.setScalar(0.62);
  return { group: g, box, walk, bike };
}

export class RemotePlayers {
  constructor(scene) { this.scene = scene; this.map = new Map(); }

  // show a chat bubble above a remote player (if we know them)
  say(id, text) {
    const e = this.map.get(id);
    if (!e) return;
    if (e.bubble) e.group.remove(e.bubble);
    e.bubble = makeChatSprite(text);
    e.bubbleTTL = 6;
    e.group.add(e.bubble);
  }

  sync(remotes, dt) {
    const seen = new Set();
    for (const r of remotes) {
      seen.add(r.id);
      let e = this.map.get(r.id);
      if (!e) {
        const m = makeRemoteMesh(r.color || '#b58cff', r.name || '?');
        m.group.position.set(r.x, 0, r.z);
        m.yaw = r.yaw || 0; m.target = new THREE.Vector3(r.x, 0, r.z); m.targetYaw = r.yaw || 0;
        this.scene.add(m.group);
        this.map.set(r.id, m);
        e = m;
      }
      e.target.set(r.x, 0, r.z);
      e.targetYaw = r.yaw || 0;
      e.walk.visible = !r.riding;
      e.bike.visible = !!r.riding;
      e.box.visible = r.carrying && r.carrying !== 'none';
    }
    const k = Math.min(1, dt * 9);
    for (const [id, e] of this.map) {
      if (!seen.has(id)) { this.scene.remove(e.group); this.map.delete(id); continue; }
      e.group.position.lerp(e.target, k);
      let d = e.targetYaw - e.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      e.yaw += d * k; e.group.rotation.y = e.yaw;
      if (e.bubble) {
        e.bubbleTTL -= dt;
        if (e.bubbleTTL <= 0) { e.group.remove(e.bubble); e.bubble = null; }
        else e.bubble.material.opacity = Math.min(1, e.bubbleTTL); // fade out the last second
      }
    }
  }

  get count() { return this.map.size; }
}
