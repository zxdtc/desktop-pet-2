import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function countItems(items) {
  return Array.isArray(items) ? items.length : 0;
}

function summarizeStatus(errorCount, warningCount, ok = null) {
  if (errorCount > 0 || ok === false) return '需要修复';
  if (warningCount > 0) return '有提醒';
  return '通过';
}

function safeArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function readRunSummary(runDir) {
  const summaryPath = path.join(runDir, 'qa', 'run-summary.json');
  if (!fs.existsSync(summaryPath)) return null;
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  return {
    path: summaryPath,
    ok: Boolean(summary.ok),
    materialsReady: Boolean(summary.materials_ready),
    readyForUse: Boolean(summary.ready_for_use),
    readyReason: String(summary.ready_reason || ''),
    petName: String(summary.pet_name || ''),
    runDir: String(summary.run_dir || ''),
    manifest: String(summary.manifest || ''),
    reference: String(summary.reference || ''),
    canonicalBase: String(summary.canonical_base || ''),
    outputManifest: String(summary.output_manifest || ''),
    provenance: String(summary.provenance || ''),
    framesDir: String(summary.frames_dir || ''),
    finalDir: String(summary.final_dir || ''),
    spritesheet: summary.spritesheet || null,
    qa: summary.qa || null,
    actions: Array.isArray(summary.actions) ? summary.actions.map((action) => ({
      id: String(action.id || ''),
      expectedFrames: action.expected_frames || null,
      actualFrames: action.actual_frames || null,
      transparentStrip: String(action.transparent_strip || ''),
      framesDir: String(action.frames_dir || ''),
      preview: String(action.preview || ''),
      errors: safeArray(action.errors),
      warnings: safeArray(action.warnings)
    })) : []
  };
}

export function readPetSpriteValidationSummary(runDir) {
  const validationPath = path.join(runDir, 'qa', 'validation.json');
  if (!fs.existsSync(validationPath)) {
    return {
      exists: false,
      ok: false,
      status: '未校验',
      validationPath,
      errorCount: 0,
      warningCount: 0,
      canonicalBase: null,
      actions: [],
      spritesheet: null,
      contactSheetPath: '',
      manualReview: null,
      visualReview: null,
      runSummary: readRunSummary(runDir)
    };
  }

  const validation = JSON.parse(fs.readFileSync(validationPath, 'utf8'));
  const canonicalErrors = safeArray(validation.canonical_base?.errors);
  const canonicalWarnings = safeArray(validation.canonical_base?.warnings);
  const canonicalBase = {
    status: summarizeStatus(canonicalErrors.length, canonicalWarnings.length),
    errors: canonicalErrors,
    warnings: canonicalWarnings,
    errorCount: canonicalErrors.length,
    warningCount: canonicalWarnings.length
  };
  const actions = (validation.actions || []).map((action) => {
    const errors = safeArray(action.errors);
    const warnings = safeArray(action.warnings);
    return {
      id: String(action.id || ''),
      status: summarizeStatus(errors.length, warnings.length),
      expectedFrames: action.expected_frames || null,
      actualFrames: action.actual_frames || null,
      errors,
      warnings,
      errorCount: errors.length,
      warningCount: warnings.length,
      transparentStrip: String(action.transparent_strip || '')
    };
  });
  const errorCount = canonicalBase.errorCount + actions.reduce((total, action) => total + countItems(action.errors), 0);
  const warningCount = canonicalBase.warningCount + actions.reduce((total, action) => total + countItems(action.warnings), 0);

  return {
    exists: true,
    ok: Boolean(validation.ok),
    status: summarizeStatus(errorCount, warningCount, Boolean(validation.ok)),
    validationPath,
    errorCount,
    warningCount,
    canonicalBase,
    actions,
    spritesheet: validation.spritesheet || null,
    contactSheetPath: String(validation.contact_sheet || ''),
    manualReview: validation.manual_review ? {
      status: String(validation.manual_review.status || ''),
      path: String(validation.manual_review.path || ''),
      reason: String(validation.manual_review.reason || ''),
      reviewedAt: String(validation.manual_review.reviewed_at || ''),
      failedJobs: safeArray(validation.manual_review.failed_jobs),
      checklist: safeObject(validation.manual_review.checklist)
    } : null,
    visualReview: validation.visual_review ? {
      status: String(validation.visual_review.status || ''),
      reviewedAt: String(validation.visual_review.reviewed_at || ''),
      note: String(validation.visual_review.note || ''),
      failedJobs: safeArray(validation.visual_review.failed_jobs),
      checklistPath: String(validation.visual_review.checklist_path || ''),
      contactSheet: String(validation.visual_review.contact_sheet || ''),
      previewDir: String(validation.visual_review.preview_dir || ''),
      checklist: safeObject(validation.visual_review.checklist)
    } : null,
    runSummary: readRunSummary(runDir)
  };
}

function mediaEntry(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return {
    path: filePath,
    url: pathToFileURL(filePath).toString()
  };
}

export function readPetSpritePreviewMedia(runDir) {
  const canonicalBase = mediaEntry(path.join(runDir, 'final', 'canonical-base.png'));
  const contactSheet = mediaEntry(path.join(runDir, 'qa', 'contact-sheet.png'));
  const spritesheet = mediaEntry(path.join(runDir, 'final', 'spritesheet.webp'))
    || mediaEntry(path.join(runDir, 'final', 'spritesheet.png'));
  const previewDir = path.join(runDir, 'qa', 'previews');
  const previews = fs.existsSync(previewDir)
    ? fs.readdirSync(previewDir)
      .filter((name) => name.toLowerCase().endsWith('.gif'))
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({
        id: path.basename(name, path.extname(name)),
        ...mediaEntry(path.join(previewDir, name))
      }))
      .filter((item) => item.url)
    : [];
  return {
    canonicalBase,
    contactSheet,
    spritesheet,
    previews
  };
}
