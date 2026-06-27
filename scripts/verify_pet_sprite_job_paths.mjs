import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function resolveJobPath(runDir, job, field) {
  const rawPath = String(job[field] || '').trim();
  if (!rawPath) throw new Error('missing job path');
  const targetPath = path.isAbsolute(rawPath) ? rawPath : path.join(runDir, rawPath);
  const resolvedRunDir = path.resolve(runDir);
  const resolvedTarget = path.resolve(targetPath);
  if (resolvedTarget !== resolvedRunDir && !resolvedTarget.startsWith(`${resolvedRunDir}${path.sep}`)) {
    throw new Error('job path escapes run dir');
  }
  return resolvedTarget;
}

const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-sprite-job-paths-'));
fs.mkdirSync(path.join(runDir, 'prompts'), { recursive: true });
fs.mkdirSync(path.join(runDir, 'decoded'), { recursive: true });
fs.writeFileSync(path.join(runDir, 'prompts', 'idle.md'), 'prompt');
fs.writeFileSync(path.join(runDir, 'decoded', 'idle.png'), 'image');

const job = {
  id: 'idle',
  promptPath: 'prompts/idle.md',
  outputPath: 'decoded/idle.png'
};

assert.equal(resolveJobPath(runDir, job, 'promptPath'), path.join(runDir, 'prompts', 'idle.md'));
assert.equal(resolveJobPath(runDir, job, 'outputPath'), path.join(runDir, 'decoded', 'idle.png'));
assert.throws(() => resolveJobPath(runDir, { promptPath: path.join(os.tmpdir(), 'outside.md') }, 'promptPath'), /escapes/);

console.log('pet sprite job paths ok');
