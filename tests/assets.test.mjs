import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeholderDataParams, loadImage } from '../src/assets.js';

test('placeholderDataParams derives the initial from the label', () => {
  const p = placeholderDataParams('Mika');
  assert.equal(p.initial, 'M');
  assert.ok(p.bg && p.fg, 'has bg and fg colors');
});

test('placeholderDataParams handles empty/odd labels', () => {
  assert.equal(placeholderDataParams('').initial, '?');
  assert.equal(placeholderDataParams('  ramen').initial, 'R');
  assert.equal(placeholderDataParams(undefined).initial, '?');
});

test('loadImage falls back to a placeholder when the image errors', async () => {
  // Mock a minimal browser environment where Image always errors and
  // document.createElement returns a stub canvas.
  const prevImage = globalThis.Image;
  const prevDoc = globalThis.document;

  globalThis.Image = class {
    set src(_v) { setTimeout(() => this.onerror && this.onerror(new Error('404')), 0); }
  };
  globalThis.document = {
    createElement(tag) {
      if (tag !== 'canvas') throw new Error('unexpected tag ' + tag);
      return {
        width: 0, height: 0,
        getContext() {
          return {
            fillStyle: '', font: '', textAlign: '', textBaseline: '',
            createLinearGradient() { return { addColorStop() {} }; },
            fillRect() {}, fillText() {}, beginPath() {}, arc() {}, fill() {},
          };
        },
        __isPlaceholder: true,
      };
    },
  };

  try {
    const img = await loadImage('does-not-exist.png', { label: 'Test' });
    assert.equal(img.__isPlaceholder, true, 'returns the placeholder canvas');
  } finally {
    globalThis.Image = prevImage;
    globalThis.document = prevDoc;
  }
});
