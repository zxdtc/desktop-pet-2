import json
import shutil
import subprocess
import sys
from pathlib import Path

from verify_pet_action_pipeline import PIPELINE, ROOT, RUN_ROOT, make_reference, make_strip, run_command


E2E_ROOT = RUN_ROOT.parent / "pet-sprite-e2e"


def run_node_apply_check(run_dir):
    script = f"""
import assert from 'node:assert/strict';
import {{ buildAppliedPetSprite, readPetSpriteManifest, readPetSpriteRunSummary }} from './src/shared/petSpriteApply.js';
import {{ selectSpriteAction, spriteFrameStyle }} from './src/shared/petSpritePlayback.js';

const runDir = {json.dumps(str(run_dir))};
const manifest = readPetSpriteManifest(runDir);
const summary = readPetSpriteRunSummary(runDir);
assert.equal(summary.ready_for_use, true);
const applied = buildAppliedPetSprite({{
  runDir,
  manifest,
  summary,
  now: '2026-06-13T00:00:00.000Z'
}});
assert.equal(applied.petName, 'e2e pet');
assert.equal(applied.cellWidth, 192);
assert.equal(applied.cellHeight, 208);
assert.deepEqual(applied.actions.map((action) => [action.id, action.rowIndex, action.frameCount]), [
  ['idle', 0, 4],
  ['happy', 1, 3]
]);
assert.ok(applied.spritesheetUrl.startsWith('file:///'));
const happy = selectSpriteAction(applied, 'happy');
assert.equal(happy.rowIndex, 1);
assert.equal(spriteFrameStyle(applied, happy, 2).backgroundPosition, '66.66666666666666% 100%');
"""
    subprocess.run(["node", "--input-type=module", "-e", script], cwd=ROOT, text=True, capture_output=True, check=True)


def main():
    if E2E_ROOT.exists():
        shutil.rmtree(E2E_ROOT)
    E2E_ROOT.mkdir(parents=True)

    reference = E2E_ROOT / "reference-input.png"
    actions = E2E_ROOT / "actions.json"
    run_dir = E2E_ROOT / "run"
    generated_dir = E2E_ROOT / "generated"
    generated_dir.mkdir()
    make_reference(reference)
    make_reference(generated_dir / "canonical-base.png")
    make_strip(generated_dir / "idle.png", 4, "idle")
    make_strip(generated_dir / "happy.png", 3, "happy")
    actions.write_text(json.dumps([
        {
            "id": "idle",
            "frame_count": 4,
            "description": "calm breathing, tiny blink, slight head bob",
            "avoid": "walking, waving"
        },
        {
            "id": "happy",
            "frame_count": 3,
            "description": "small cheerful bounce using body posture only",
            "avoid": "floating hearts, detached effects"
        }
    ]), encoding="utf-8")

    run_command([
        sys.executable, str(PIPELINE), "init",
        "--reference-image", str(reference),
        "--pet-name", "e2e pet",
        "--style-notes", "rounded sticker desktop pet",
        "--actions", str(actions),
        "--output-dir", str(run_dir),
        "--chroma-key", "#0000FF"
    ])
    for job_id in ("canonical-base", "idle", "happy"):
        run_command([
            sys.executable, str(PIPELINE), "import",
            "--run-dir", str(run_dir),
            "--job-id", job_id,
            "--source-path", str(generated_dir / f"{job_id}.png"),
            "--qa-note", f"{job_id} selected for e2e"
        ])

    process_result = run_command([sys.executable, str(PIPELINE), "process", "--run-dir", str(run_dir)])
    if not process_result["ok"]:
        raise AssertionError(json.dumps(process_result, ensure_ascii=False, indent=2))

    run_command([
        sys.executable, str(PIPELINE), "review",
        "--run-dir", str(run_dir),
        "--status", "accepted",
        "--note", "synthetic e2e contact-sheet and GIF review passed"
    ])

    summary = json.loads((run_dir / "qa" / "run-summary.json").read_text(encoding="utf-8"))
    if not summary.get("ready_for_use"):
        raise AssertionError("e2e run should be ready for use")
    for required in (
        run_dir / "reference.png",
        run_dir / "manifest.json",
        run_dir / "decoded" / "canonical-base.png",
        run_dir / "decoded" / "idle.png",
        run_dir / "decoded" / "happy.png",
        run_dir / "frames" / "idle" / "00.png",
        run_dir / "final" / "spritesheet.webp",
        run_dir / "qa" / "contact-sheet.png",
        run_dir / "qa" / "previews" / "idle.gif",
        run_dir / "qa" / "validation.json",
        run_dir / "qa" / "run-summary.json"
    ):
        if not required.exists():
            raise AssertionError(f"missing e2e artifact: {required}")

    run_node_apply_check(run_dir)
    print("pet sprite e2e ok")


if __name__ == "__main__":
    main()
