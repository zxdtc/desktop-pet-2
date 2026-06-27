import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { readPetSpritePreviewMedia, readPetSpriteValidationSummary } from '../src/shared/petSpriteState.js';

const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-sprite-state-'));
fs.mkdirSync(path.join(runDir, 'qa'), { recursive: true });
fs.mkdirSync(path.join(runDir, 'qa', 'previews'), { recursive: true });
fs.mkdirSync(path.join(runDir, 'final'), { recursive: true });
for (const file of [
  path.join(runDir, 'qa', 'contact-sheet.png'),
  path.join(runDir, 'qa', 'previews', 'idle.gif'),
  path.join(runDir, 'final', 'canonical-base.png'),
  path.join(runDir, 'final', 'spritesheet.webp')
]) {
  fs.writeFileSync(file, 'media');
}
fs.writeFileSync(path.join(runDir, 'qa', 'validation.json'), JSON.stringify({
  ok: false,
  canonical_base: {
    errors: ['canonical-base is empty after chroma key removal'],
    warnings: ['canonical-base has no transparent pixels after chroma key removal']
  },
  actions: [
    {
      id: 'idle',
      expected_frames: 4,
      actual_frames: 4,
      errors: [],
      warnings: ['frame 00 content touches cell edge']
    },
    {
      id: 'happy',
      expected_frames: 3,
      errors: ['missing decoded action strip'],
      warnings: []
    }
  ],
  spritesheet: {
    width: 768,
    height: 416,
    rows: 2,
    columns: 4
  },
  contact_sheet: path.join(runDir, 'qa', 'contact-sheet.png')
  ,
  manual_review: {
    status: 'failed',
    path: path.join(runDir, 'qa', 'manual-review.md'),
    reason: 'identity drift',
    reviewed_at: '2026-06-13T00:00:00.000Z',
    failed_jobs: ['happy']
  },
  visual_review: {
    status: 'failed',
    reviewed_at: '2026-06-13T00:00:00.000Z',
    note: 'identity drift',
    failed_jobs: ['happy'],
    checklist_path: path.join(runDir, 'qa', 'manual-review.md'),
    contact_sheet: path.join(runDir, 'qa', 'contact-sheet.png'),
    preview_dir: path.join(runDir, 'qa', 'previews'),
    checklist: {
      canonical_base: { identity_matches_reference: true },
      actions: [
        { id: 'idle', identity_stable: true, action_matches_description: true, avoid_list_respected: true },
        { id: 'happy', identity_stable: false, action_matches_description: false, avoid_list_respected: false }
      ]
    }
  }
}), 'utf8');
fs.writeFileSync(path.join(runDir, 'qa', 'run-summary.json'), JSON.stringify({
  ok: false,
  materials_ready: true,
  ready_for_use: false,
  ready_reason: 'requires passing automated validation and accepted visual QA',
  pet_name: 'test pet',
  run_dir: runDir,
  manifest: path.join(runDir, 'manifest.json'),
  reference: path.join(runDir, 'reference.png'),
  canonical_base: path.join(runDir, 'final', 'canonical-base.png'),
  output_manifest: path.join(runDir, 'final', 'output-manifest.json'),
  provenance: path.join(runDir, 'qa', 'provenance.json'),
  frames_dir: path.join(runDir, 'frames'),
  final_dir: path.join(runDir, 'final'),
  spritesheet: {
    webp: path.join(runDir, 'final', 'spritesheet.webp'),
    width: 768,
    height: 416
  },
  qa: {
    validation: path.join(runDir, 'qa', 'validation.json'),
    contact_sheet: path.join(runDir, 'qa', 'contact-sheet.png'),
    preview_dir: path.join(runDir, 'qa', 'previews'),
    visual_review: { status: 'failed', failed_jobs: ['happy'] }
  },
  actions: [
    {
      id: 'idle',
      expected_frames: 4,
      actual_frames: 4,
      transparent_strip: path.join(runDir, 'final', 'idle.png'),
      frames_dir: path.join(runDir, 'frames', 'idle'),
      preview: path.join(runDir, 'qa', 'previews', 'idle.gif')
    }
  ]
}), 'utf8');

const summary = readPetSpriteValidationSummary(runDir);
assert.equal(summary.ok, false);
assert.equal(summary.status, '需要修复');
assert.equal(summary.canonicalBase.errorCount, 1);
assert.equal(summary.canonicalBase.warningCount, 1);
assert.equal(summary.actions.length, 2);
assert.deepEqual(summary.actions.map((action) => [action.id, action.status]), [
  ['idle', '有提醒'],
  ['happy', '需要修复']
]);
assert.equal(summary.errorCount, 2);
assert.equal(summary.warningCount, 2);
assert.equal(summary.spritesheet.width, 768);
assert.equal(summary.contactSheetPath, path.join(runDir, 'qa', 'contact-sheet.png'));
assert.equal(summary.manualReview.status, 'failed');
assert.equal(summary.manualReview.path, path.join(runDir, 'qa', 'manual-review.md'));
assert.equal(summary.manualReview.reviewedAt, '2026-06-13T00:00:00.000Z');
assert.deepEqual(summary.manualReview.failedJobs, ['happy']);
assert.equal(summary.visualReview.status, 'failed');
assert.equal(summary.visualReview.note, 'identity drift');
assert.deepEqual(summary.visualReview.failedJobs, ['happy']);
assert.equal(summary.visualReview.checklist.canonical_base.identity_matches_reference, true);
assert.equal(summary.visualReview.checklist.actions[1].identity_stable, false);
assert.equal(summary.runSummary.petName, 'test pet');
assert.equal(summary.runSummary.materialsReady, true);
assert.equal(summary.runSummary.readyForUse, false);
assert.equal(summary.runSummary.readyReason, 'requires passing automated validation and accepted visual QA');
assert.equal(summary.runSummary.spritesheet.webp, path.join(runDir, 'final', 'spritesheet.webp'));
assert.equal(summary.runSummary.outputManifest, path.join(runDir, 'final', 'output-manifest.json'));
assert.equal(summary.runSummary.provenance, path.join(runDir, 'qa', 'provenance.json'));
assert.deepEqual(summary.runSummary.actions.map((action) => action.id), ['idle']);

const media = readPetSpritePreviewMedia(runDir);
assert.ok(media.contactSheet.url.startsWith('file:///'));
assert.ok(media.spritesheet.url.startsWith('file:///'));
assert.ok(media.canonicalBase.url.startsWith('file:///'));
assert.deepEqual(media.previews.map((preview) => preview.id), ['idle']);
assert.ok(media.previews[0].url.startsWith('file:///'));

console.log('pet sprite state ok');
