import assert from 'node:assert/strict';

import { choosePetRenderSource, selectSpriteAction, spriteFrameStyle } from '../src/shared/petSpritePlayback.js';

const sprite = {
  columns: 4,
  rows: 2,
  actions: [
    { id: 'idle', rowIndex: 0, frameCount: 4 },
    { id: 'happy', rowIndex: 1, frameCount: 3 }
  ]
};

assert.equal(selectSpriteAction(sprite, 'happy').rowIndex, 1);
assert.equal(selectSpriteAction(sprite, 'missing').id, 'idle');
assert.equal(spriteFrameStyle(sprite, selectSpriteAction(sprite, 'happy'), 2).backgroundPosition, '66.66666666666666% 100%');
assert.equal(spriteFrameStyle({ ...sprite, columns: 1, rows: 1 }, { id: 'idle', rowIndex: 0, frameCount: 1 }, 0).backgroundPosition, '0% 0%');
assert.equal(choosePetRenderSource(sprite, { assetUrl: 'file:///old.gif' }), 'applied-spritesheet');
assert.equal(choosePetRenderSource(null, { assetUrl: 'file:///old.gif' }), 'asset-slot');
assert.equal(choosePetRenderSource(null, null), 'fallback-illustration');

console.log('pet sprite playback ok');
