import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildAppliedPetSprite } from '../src/shared/petSpriteApply.js';

const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-sprite-apply-'));
fs.mkdirSync(path.join(runDir, 'final'), { recursive: true });
const spritesheet = path.join(runDir, 'final', 'spritesheet.webp');
fs.writeFileSync(spritesheet, 'webp');
const outputManifestPath = path.join(runDir, 'final', 'output-manifest.json');

const manifest = {
  pet_name: 'test pet',
  cell_width: 192,
  cell_height: 208
};
const readySummary = {
  ready_for_use: true,
  pet_name: 'summary pet',
  output_manifest: outputManifestPath,
  spritesheet: {
    webp: spritesheet,
    rows: 2,
    columns: 4
  },
  actions: [
    { id: 'idle', expected_frames: 4, actual_frames: 4 },
    { id: 'happy', expected_frames: 3, actual_frames: 3 }
  ]
};
fs.writeFileSync(outputManifestPath, JSON.stringify({
  pet_name: 'output manifest pet',
  cell_width: 192,
  cell_height: 208,
  spritesheet: {
    webp: spritesheet,
    rows: 2,
    columns: 6
  },
  actions: [
    { id: 'idle', row_index: 0, expected_frames: 4, actual_frames: 4, frames: ['0', '1', '2', '3'] },
    { id: 'happy', row_index: 1, expected_frames: 6, actual_frames: 6, frames: ['0', '1', '2', '3', '4', '5'] }
  ]
}), 'utf8');

assert.throws(() => buildAppliedPetSprite({
  runDir,
  manifest,
  summary: { ...readySummary, ready_for_use: false }
}), /还不能用于桌宠/);

const applied = buildAppliedPetSprite({
  runDir,
  manifest,
  summary: readySummary,
  now: '2026-06-13T00:00:00.000Z'
});

assert.equal(applied.petName, 'output manifest pet');
assert.equal(applied.cellWidth, 192);
assert.equal(applied.cellHeight, 208);
assert.equal(applied.columns, 6);
assert.equal(applied.rows, 2);
assert.equal(applied.spritesheetPath, spritesheet);
assert.ok(applied.spritesheetUrl.startsWith('file:///'));
assert.deepEqual(applied.actions, [
  { id: 'idle', rowIndex: 0, frameCount: 4 },
  { id: 'happy', rowIndex: 1, frameCount: 6 }
]);
assert.equal(applied.appliedAt, '2026-06-13T00:00:00.000Z');

console.log('pet sprite apply ok');
