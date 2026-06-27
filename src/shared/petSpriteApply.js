import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function readOutputManifest(runDir, summary) {
  const manifestPath = summary?.output_manifest || path.join(runDir, 'final', 'output-manifest.json');
  if (!manifestPath || !fs.existsSync(manifestPath)) return null;
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function firstExistingPath(...items) {
  return items.find((item) => item && fs.existsSync(item)) || '';
}

export function buildAppliedPetSprite({ runDir, manifest, summary, now = new Date().toISOString() }) {
  if (!summary?.ready_for_use) {
    throw new Error('这套动作还不能用于桌宠，请先通过自动检查和视觉 QA。');
  }
  const outputManifest = readOutputManifest(runDir, summary);
  const spritesheetPath = firstExistingPath(
    outputManifest?.spritesheet?.webp,
    outputManifest?.spritesheet?.png,
    summary.spritesheet?.webp,
    summary.spritesheet?.png
  );
  if (!spritesheetPath || !fs.existsSync(spritesheetPath)) {
    throw new Error('缺少可应用的 spritesheet 文件。');
  }
  const outputActions = Array.isArray(outputManifest?.actions) && outputManifest.actions.length
    ? outputManifest.actions.map((action, rowIndex) => ({
      id: String(action.id || ''),
      rowIndex: Number.isInteger(Number(action.row_index)) ? Number(action.row_index) : rowIndex,
      frameCount: Number(action.actual_frames || action.expected_frames || action.frames?.length || 1)
    }))
    : null;
  const actions = (outputActions || (summary.actions || []).map((action, rowIndex) => ({
    id: String(action.id || ''),
    rowIndex,
    frameCount: Number(action.actual_frames || action.expected_frames || 1)
  }))).filter((action) => action.id && action.frameCount > 0);
  if (!actions.length) throw new Error('运行摘要里没有可播放的动作。');

  return {
    runDir,
    petName: String(outputManifest?.pet_name || summary.pet_name || manifest.pet_name || ''),
    spritesheetPath,
    spritesheetUrl: pathToFileURL(spritesheetPath).toString(),
    cellWidth: Number(outputManifest?.cell_width || manifest.cell_width || 192),
    cellHeight: Number(outputManifest?.cell_height || manifest.cell_height || 208),
    columns: Number(outputManifest?.spritesheet?.columns || summary.spritesheet?.columns || Math.max(...actions.map((action) => action.frameCount))),
    rows: Number(outputManifest?.spritesheet?.rows || summary.spritesheet?.rows || actions.length),
    actions,
    appliedAt: now
  };
}

export function readPetSpriteManifest(runDir) {
  return JSON.parse(fs.readFileSync(path.join(runDir, 'manifest.json'), 'utf8'));
}

export function readPetSpriteRunSummary(runDir) {
  const summaryPath = path.join(runDir, 'qa', 'run-summary.json');
  if (!fs.existsSync(summaryPath)) throw new Error('缺少运行摘要，请先处理动作并完成视觉 QA。');
  return JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
}
