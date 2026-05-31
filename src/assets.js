// ============================================================
//  GAVRIL — One Shift · assets.js
//  Loads Codex hero images from assets/ with a generated vector
//  placeholder fallback, so the demo is fully playable before any
//  art exists and upgrades automatically once PNGs are dropped in.
// ============================================================

import { PALETTE } from './config.js';

const BASE = 'assets/';

// Deterministic placeholder styling derived from a label. Pure — testable
// without a canvas. Picks an accent tint per first letter for variety.
const TINTS = [PALETTE.action, PALETTE.system, PALETTE.decision, PALETTE.reward, PALETTE.nav];

export function placeholderDataParams(label) {
  const s = (label ?? '').trim();
  const initial = s ? s[0].toUpperCase() : '?';
  const code = initial.charCodeAt(0) || 0;
  const fg = TINTS[code % TINTS.length];
  return { initial, bg: PALETTE.panel2, bg2: PALETTE.panel, fg };
}

// Draws the placeholder onto a canvas. No-ops gracefully if there is no DOM.
export function makePlaceholder(label, size = 256) {
  if (typeof document === 'undefined') return null;
  const { initial, bg, bg2, fg } = placeholderDataParams(label);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, bg2);
  grad.addColorStop(1, bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // soft accent disc behind the initial
  ctx.fillStyle = fg + '22';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.32, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = fg;
  ctx.font = `300 ${Math.floor(size * 0.42)}px Spectral, Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initial, size / 2, size / 2 + size * 0.02);

  canvas.__isPlaceholder = true;
  return canvas;
}

// Returns a Promise resolving to an <img> (real asset) or a placeholder
// canvas. Never rejects — a missing asset is an expected, handled path.
export function loadImage(name, { label, size = 256 } = {}) {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve(makePlaceholder(label, size));
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(makePlaceholder(label ?? name, size));
    img.src = BASE + name;
  });
}

// Convenience: load many at once into a name->element map.
export async function loadImages(specs) {
  const entries = await Promise.all(
    specs.map(async ({ name, label, size }) => [name, await loadImage(name, { label, size })])
  );
  return Object.fromEntries(entries);
}
