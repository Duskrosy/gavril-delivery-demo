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

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.7, 0.8), shirt);
  torso.position.y = 3.0; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.1, 1.05), skin);
  head.position.y = 4.45; head.castShadow = true; g.add(head);
  for (const x of [-0.42, 0.42]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.7, 0.6), dark);
    leg.position.set(x, 1.55, 0); g.add(leg);
  }
  // cargo box (shown when carrying)
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 1.0),
    new THREE.MeshStandardMaterial({ color: C('#1c1429'), emissive: C('#ffc864'), emissiveIntensity: .5, roughness: .5 }));
  box.position.set(0, 3.1, 0.95); box.visible = false; g.add(box);

  // simple scooter (shown when riding)
  const scooter = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 2.0), shirt); deck.position.y = 0.55; scooter.add(deck);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8), dark); bar.position.set(0, 1.6, 0.85); bar.rotation.z = Math.PI / 2; scooter.add(bar);
  const tire = new THREE.MeshStandardMaterial({ color: C('#0c0912'), roughness: .95 });
  for (const z of [0.9, -0.85]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.22, 12), tire); w.rotation.z = Math.PI / 2; w.position.set(0, 0.5, z); scooter.add(w); }
  scooter.visible = false; g.add(scooter);

  g.add(makeNameSprite(name, colorHex));
  g.scale.setScalar(0.62);
  return { group: g, box, scooter };
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
      e.scooter.visible = !!r.riding;
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
