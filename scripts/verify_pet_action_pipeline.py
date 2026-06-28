import json
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
RUN_ROOT = ROOT / "tmp" / "pet-action-pipeline-verify"
PIPELINE = ROOT / "scripts" / "pet_action_pipeline.py"
CELL_WIDTH = 192
CELL_HEIGHT = 208
CHROMA = (0, 0, 255, 255)


def run_command(args):
    result = subprocess.run(args, cwd=ROOT, text=True, capture_output=True, check=True)
    return json.loads(result.stdout)


def run_command_fails(args, expected_text):
    result = subprocess.run(args, cwd=ROOT, text=True, capture_output=True)
    if result.returncode == 0:
        raise AssertionError("command unexpectedly succeeded")
    combined = f"{result.stdout}\n{result.stderr}"
    if expected_text not in combined:
        raise AssertionError(f"expected failure text missing: {expected_text}\n{combined}")


def draw_character(draw, x_offset, y_offset, mood="idle"):
    body_color = (255, 230, 238, 255)
    outline = (40, 40, 40, 255)
    bow = (80, 170, 220, 255)
    eye = (30, 30, 30, 255)
    draw.ellipse((x_offset + 54, y_offset + 46, x_offset + 138, y_offset + 150), fill=body_color, outline=outline, width=4)
    draw.polygon([(x_offset + 72, y_offset + 52), (x_offset + 84, y_offset + 22), (x_offset + 96, y_offset + 58)], fill=body_color, outline=outline)
    draw.polygon([(x_offset + 112, y_offset + 58), (x_offset + 126, y_offset + 22), (x_offset + 136, y_offset + 54)], fill=body_color, outline=outline)
    draw.ellipse((x_offset + 76, y_offset + 92, x_offset + 86, y_offset + 104), fill=eye)
    draw.ellipse((x_offset + 108, y_offset + 92, x_offset + 118, y_offset + 104), fill=eye)
    if mood == "happy":
        draw.arc((x_offset + 88, y_offset + 104, x_offset + 108, y_offset + 122), 0, 180, fill=outline, width=3)
    else:
        draw.line((x_offset + 88, y_offset + 114, x_offset + 108, y_offset + 114), fill=outline, width=3)
    draw.ellipse((x_offset + 83, y_offset + 28, x_offset + 108, y_offset + 50), fill=bow, outline=outline, width=2)


def make_reference(path):
    image = Image.new("RGBA", (CELL_WIDTH, CELL_HEIGHT), CHROMA)
    draw = ImageDraw.Draw(image)
    draw_character(draw, 0, 18)
    image.save(path)


def make_large_reference(path):
    image = Image.new("RGBA", (CELL_WIDTH * 2, CELL_HEIGHT * 2), CHROMA)
    draw = ImageDraw.Draw(image)
    draw_character(draw, CELL_WIDTH // 2, CELL_HEIGHT // 2 + 18)
    image.save(path)


def make_strip(path, frames, mood="idle"):
    strip = Image.new("RGBA", (CELL_WIDTH * frames, CELL_HEIGHT), CHROMA)
    for index in range(frames):
        cell = Image.new("RGBA", (CELL_WIDTH, CELL_HEIGHT), CHROMA)
        draw = ImageDraw.Draw(cell)
        bob = 4 if index % 2 else 0
        draw_character(draw, 0, 18 - bob, mood=mood)
        strip.alpha_composite(cell, (index * CELL_WIDTH, 0))
    strip.save(path)


def make_edge_touching_image(path):
    image = Image.new("RGBA", (CELL_WIDTH, CELL_HEIGHT), CHROMA)
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 60, 96, 150), fill=(255, 230, 238, 255), outline=(40, 40, 40, 255), width=3)
    image.save(path)


def make_edge_touching_strip(path, frames):
    strip = Image.new("RGBA", (CELL_WIDTH * frames, CELL_HEIGHT), CHROMA)
    for index in range(frames):
        cell = Image.new("RGBA", (CELL_WIDTH, CELL_HEIGHT), CHROMA)
        draw = ImageDraw.Draw(cell)
        draw.rectangle((0, 60, 96, 150), fill=(255, 230, 238, 255), outline=(40, 40, 40, 255), width=3)
        strip.alpha_composite(cell, (index * CELL_WIDTH, 0))
    strip.save(path)


def make_static_strip(path, frames):
    strip = Image.new("RGBA", (CELL_WIDTH * frames, CELL_HEIGHT), CHROMA)
    cell = Image.new("RGBA", (CELL_WIDTH, CELL_HEIGHT), CHROMA)
    draw = ImageDraw.Draw(cell)
    draw_character(draw, 0, 18, mood="idle")
    for index in range(frames):
        strip.alpha_composite(cell, (index * CELL_WIDTH, 0))
    strip.save(path)


def make_chroma_inside_character(path):
    image = Image.new("RGBA", (CELL_WIDTH, CELL_HEIGHT), CHROMA)
    draw = ImageDraw.Draw(image)
    draw_character(draw, 0, 18, mood="idle")
    draw.rectangle((90, 120, 102, 132), fill=CHROMA)
    image.save(path)


def assert_path(path):
    if not Path(path).exists():
        raise AssertionError(f"Missing expected file: {path}")


def main():
    if RUN_ROOT.exists():
        shutil.rmtree(RUN_ROOT)
    RUN_ROOT.mkdir(parents=True)

    reference = RUN_ROOT / "reference-input.png"
    actions = RUN_ROOT / "actions.json"
    run_dir = RUN_ROOT / "run"
    make_reference(reference)
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

    init_result = run_command([
        sys.executable, str(PIPELINE), "init",
        "--reference-image", str(reference),
        "--pet-name", "测试团子",
        "--style-notes", "rounded sticker desktop pet",
        "--actions", str(actions),
        "--output-dir", str(run_dir),
        "--chroma-key", "#0000FF"
    ])
    if not init_result["ok"]:
        raise AssertionError("init did not report ok")

    status_path = run_dir / "generation-status.json"
    status = json.loads(status_path.read_text(encoding="utf-8"))
    if [job["id"] for job in status["jobs"]] != ["canonical-base", "idle", "happy"]:
        raise AssertionError("generation-status jobs are incomplete")
    assert_path(run_dir / "workflow.md")
    workflow_text = (run_dir / "workflow.md").read_text(encoding="utf-8")
    for expected in ("prompts/canonical-base.md", "prompts/idle.md", "decoded/idle.png", "prompts/happy.md", "Do not regenerate all actions"):
        if expected not in workflow_text:
            raise AssertionError(f"workflow missing: {expected}")
    base_prompt_text = (run_dir / "prompts" / "canonical-base.md").read_text(encoding="utf-8")
    for expected in (
        "Use the provided reference image as the identity reference",
        "Single complete full-body character",
        "Centered in one fixed 192x208 cell, bottom-center anchored",
        "Readable at 192x208 desktop-pet size",
        "Perfectly flat solid #0000FF chroma-key background",
        "Save selected image as decoded/canonical-base.png"
    ):
        if expected not in base_prompt_text:
            raise AssertionError(f"canonical-base prompt missing: {expected}")
    action_prompt_text = (run_dir / "prompts" / "happy.md").read_text(encoding="utf-8")
    for expected in (
        'Generate one horizontal sprite strip for action: "happy"',
        "Preserve the same character from the reference image",
        "Create exactly 3 coherent full-body frames in one horizontal row",
        "Treat the strip as 3 equal fixed cells, each 192x208",
        "Avoid jump cuts",
        "Use a perfectly flat solid #0000FF chroma-key background",
        "No text, labels, frame numbers, borders, guide marks, UI",
        "Also avoid: floating hearts, detached effects",
        "regenerate only this action"
    ):
        if expected not in action_prompt_text:
            raise AssertionError(f"action prompt missing: {expected}")

    generated_dir = RUN_ROOT / "generated"
    generated_dir.mkdir()
    make_large_reference(generated_dir / "canonical-base.png")
    make_strip(generated_dir / "idle.png", 4, "idle")
    make_strip(generated_dir / "happy.png", 3, "happy")

    imported = run_command([
        sys.executable, str(PIPELINE), "import",
        "--run-dir", str(run_dir),
        "--job-id", "canonical-base",
        "--source-path", str(generated_dir / "canonical-base.png"),
        "--qa-note", "base identity selected"
    ])
    if not Path(imported["decoded_path"]).exists():
        raise AssertionError("import command did not copy canonical-base into decoded")

    for job_id in ("idle", "happy"):
        imported = run_command([
            sys.executable, str(PIPELINE), "import",
            "--run-dir", str(run_dir),
            "--job-id", job_id,
            "--source-path", str(generated_dir / f"{job_id}.png"),
            "--qa-note", f"{job_id} strip selected"
        ])
        if imported["job"]["status"] != "imported":
            raise AssertionError("import command did not update job status")

    marked = run_command([
        sys.executable, str(PIPELINE), "mark",
        "--run-dir", str(run_dir),
        "--job-id", "idle",
        "--status", "generated",
        "--source-path", str(run_dir / "decoded" / "idle.png"),
        "--qa-note", "verified generated strip"
    ])
    if marked["job"]["status"] != "generated":
        raise AssertionError("mark command did not update job status")

    process_result = run_command([sys.executable, str(PIPELINE), "process", "--run-dir", str(run_dir)])
    if not process_result["ok"]:
        raise AssertionError(json.dumps(process_result, ensure_ascii=False, indent=2))

    assert_path(run_dir / "final" / "canonical-base.png")
    assert_path(run_dir / "final" / "idle.png")
    assert_path(run_dir / "final" / "happy.png")
    assert_path(run_dir / "final" / "output-manifest.json")
    assert_path(run_dir / "final" / "spritesheet.png")
    assert_path(run_dir / "final" / "spritesheet.webp")
    assert_path(run_dir / "qa" / "contact-sheet.png")
    assert_path(run_dir / "qa" / "manual-review.md")
    assert_path(run_dir / "qa" / "provenance.json")
    assert_path(run_dir / "qa" / "run-summary.json")
    assert_path(run_dir / "qa" / "previews" / "idle.gif")
    assert_path(run_dir / "qa" / "previews" / "happy.gif")

    validation = json.loads((run_dir / "qa" / "validation.json").read_text(encoding="utf-8"))
    run_summary = json.loads((run_dir / "qa" / "run-summary.json").read_text(encoding="utf-8"))
    if run_summary["ready_for_use"]:
        raise AssertionError("processed run should not be ready before visual QA acceptance")
    if run_summary["spritesheet"]["webp"] != str(run_dir / "final" / "spritesheet.webp"):
        raise AssertionError("run summary spritesheet path is wrong")
    if run_summary["output_manifest"] != str(run_dir / "final" / "output-manifest.json"):
        raise AssertionError("run summary output manifest path is wrong")
    if run_summary["provenance"] != str(run_dir / "qa" / "provenance.json"):
        raise AssertionError("run summary provenance path is wrong")
    if [action["id"] for action in run_summary["actions"]] != ["idle", "happy"]:
        raise AssertionError("run summary actions are wrong")
    output_manifest = json.loads((run_dir / "final" / "output-manifest.json").read_text(encoding="utf-8"))
    if output_manifest["canonical_base"] != str(run_dir / "final" / "canonical-base.png"):
        raise AssertionError("output manifest canonical-base path is wrong")
    if output_manifest["provenance"] != str(run_dir / "qa" / "provenance.json"):
        raise AssertionError("output manifest provenance path is wrong")
    if output_manifest["spritesheet"]["webp"] != str(run_dir / "final" / "spritesheet.webp"):
        raise AssertionError("output manifest spritesheet path is wrong")
    if [(action["id"], action["row_index"], len(action["frames"])) for action in output_manifest["actions"]] != [
        ("idle", 0, 4),
        ("happy", 1, 3)
    ]:
        raise AssertionError("output manifest action rows or frames are wrong")
    for action in output_manifest["actions"]:
        for frame_path in action["frames"]:
            assert_path(frame_path)
    if validation.get("manual_review", {}).get("status") != "required":
        raise AssertionError("manual visual review status is missing")
    with Image.open(run_dir / "final" / "canonical-base.png") as final_canonical:
        if final_canonical.size != (CELL_WIDTH, CELL_HEIGHT):
            raise AssertionError(f"final canonical-base size is wrong: {final_canonical.size}")
    if validation["canonical_base"].get("source_size") != {"width": CELL_WIDTH * 2, "height": CELL_HEIGHT * 2}:
        raise AssertionError("canonical-base source size was not recorded")
    if validation["canonical_base"].get("final_size") != {"width": CELL_WIDTH, "height": CELL_HEIGHT}:
        raise AssertionError("canonical-base final size was not recorded")
    canonical_bbox = validation["canonical_base"].get("bbox")
    canonical_margins = validation["canonical_base"].get("margins")
    if not canonical_bbox or not canonical_margins:
        raise AssertionError("canonical-base bbox metrics are missing")
    if validation["canonical_base"].get("touches_edge"):
        raise AssertionError("valid canonical-base should not touch cell edge")
    review_text = (run_dir / "qa" / "manual-review.md").read_text(encoding="utf-8")
    for expected in ("canonical-base", "idle", "happy", "identity stays the same", "action matches description", "avoid list is respected"):
        if expected not in review_text:
            raise AssertionError(f"manual review checklist missing: {expected}")
    idle = next(action for action in validation["actions"] if action["id"] == "idle")
    happy = next(action for action in validation["actions"] if action["id"] == "happy")
    if idle["actual_frames"] != 4 or happy["actual_frames"] != 3:
        raise AssertionError("actual frame counts are wrong")
    if idle.get("motion", {}).get("frame_count") != 4 or not idle.get("motion", {}).get("changed_pixel_ratios"):
        raise AssertionError("motion QA metrics are missing")
    provenance = json.loads((run_dir / "qa" / "provenance.json").read_text(encoding="utf-8"))
    if provenance["reference"]["path"] != str(run_dir / "reference.png"):
        raise AssertionError("provenance reference path is wrong")
    if [item["id"] for item in provenance["actions"]] != ["idle", "happy"]:
        raise AssertionError("provenance actions are incomplete")
    if provenance["actions"][0]["motion"]["frame_count"] != 4:
        raise AssertionError("provenance motion metrics are missing")
    if validation["spritesheet"]["width"] != CELL_WIDTH * 4 or validation["spritesheet"]["height"] != CELL_HEIGHT * 2:
        raise AssertionError("spritesheet dimensions are wrong")
    if any(frame["transparent_pixels"] == 0 or frame["opaque_pixels"] == 0 for action in validation["actions"] for frame in action["frames"]):
        raise AssertionError("frame alpha stats are invalid")
    for action in validation["actions"]:
        for frame in action["frames"]:
            if not frame.get("bbox") or not frame.get("margins"):
                raise AssertionError("frame bbox metrics are missing")
            if frame.get("touches_edge"):
                raise AssertionError("valid frame should not touch cell edge")

    final_status = json.loads(status_path.read_text(encoding="utf-8"))
    job_statuses = {job["id"]: job["status"] for job in final_status["jobs"]}
    if job_statuses != {"canonical-base": "processed", "idle": "processed", "happy": "processed"}:
        raise AssertionError(f"unexpected job statuses: {job_statuses}")

    accepted_checklist_payload = {
        "source": "test-control-panel",
        "canonical_base": {
            "full_body_visible": True,
            "identity_matches_reference": True,
            "flat_chroma_background": True,
            "readable_at_cell_size": True
        },
        "actions": [
            {
                "id": "idle",
                "identity_stable": True,
                "action_matches_description": True,
                "avoid_list_respected": True,
                "full_character_visible": True,
                "no_banned_elements": True,
                "loop_readable": True
            },
            {
                "id": "happy",
                "identity_stable": True,
                "action_matches_description": True,
                "avoid_list_respected": True,
                "full_character_visible": True,
                "no_banned_elements": True,
                "loop_readable": True
            }
        ]
    }
    accepted_review = run_command([
        sys.executable, str(PIPELINE), "review",
        "--run-dir", str(run_dir),
        "--status", "accepted",
        "--note", "manual contact-sheet and GIF review passed",
        "--checklist-json", json.dumps(accepted_checklist_payload)
    ])
    if accepted_review["status"] != "accepted":
        raise AssertionError("accepted visual review was not recorded")
    acceptance = json.loads((run_dir / "qa" / "acceptance.json").read_text(encoding="utf-8"))
    if acceptance["status"] != "accepted" or acceptance["failed_jobs"] != []:
        raise AssertionError("acceptance record is wrong")
    accepted_validation = json.loads((run_dir / "qa" / "validation.json").read_text(encoding="utf-8"))
    if accepted_validation.get("manual_review", {}).get("status") != "accepted":
        raise AssertionError("validation manual review should be accepted")
    accepted_checklist = accepted_validation.get("visual_review", {}).get("checklist", {})
    if accepted_checklist.get("source") != "test-control-panel":
        raise AssertionError("accepted visual review should preserve supplied checklist")
    if not accepted_checklist.get("canonical_base", {}).get("identity_matches_reference"):
        raise AssertionError("accepted visual review should record canonical identity check")
    accepted_action_checks = accepted_checklist.get("actions", [])
    if [item.get("id") for item in accepted_action_checks] != ["idle", "happy"]:
        raise AssertionError("accepted visual review should record every action checklist")
    if not all(item.get("identity_stable") and item.get("action_matches_description") and item.get("avoid_list_respected") for item in accepted_action_checks):
        raise AssertionError("accepted visual review should record identity/action/avoid checks")
    accepted_summary = json.loads((run_dir / "qa" / "run-summary.json").read_text(encoding="utf-8"))
    if accepted_summary["qa"]["visual_review"]["status"] != "accepted":
        raise AssertionError("run summary visual review should be accepted")
    if not accepted_summary["ready_for_use"]:
        raise AssertionError("accepted run should be ready for use")

    failed_checklist_payload = {
        "source": "test-control-panel",
        "canonical_base": {
            "full_body_visible": True,
            "identity_matches_reference": True,
            "flat_chroma_background": True,
            "readable_at_cell_size": True
        },
        "actions": [
            {
                "id": "idle",
                "identity_stable": True,
                "action_matches_description": True,
                "avoid_list_respected": True,
                "full_character_visible": True,
                "no_banned_elements": True,
                "loop_readable": True,
                "description": "calm breathing, tiny blink, slight head bob",
                "avoid": "walking, waving"
            },
            {
                "id": "happy",
                "identity_stable": False,
                "action_matches_description": False,
                "avoid_list_respected": False,
                "full_character_visible": True,
                "no_banned_elements": False,
                "loop_readable": True,
                "description": "small cheerful bounce using body posture only",
                "avoid": "floating hearts, detached effects"
            }
        ]
    }
    failed_review = run_command([
        sys.executable, str(PIPELINE), "review",
        "--run-dir", str(run_dir),
        "--status", "failed",
        "--failed-job", "happy",
        "--note", "manual QA found expression drift",
        "--checklist-json", json.dumps(failed_checklist_payload)
    ])
    if failed_review["failed_jobs"] != ["happy"]:
        raise AssertionError("failed visual review did not preserve failed job")
    failed_status = json.loads(status_path.read_text(encoding="utf-8"))
    failed_jobs = {job["id"]: job["status"] for job in failed_status["jobs"]}
    if failed_jobs["happy"] != "needs-repair" or failed_jobs["idle"] != "processed":
        raise AssertionError(f"failed visual QA updated wrong jobs: {failed_jobs}")
    failed_summary = json.loads((run_dir / "qa" / "run-summary.json").read_text(encoding="utf-8"))
    if failed_summary["qa"]["visual_review"]["failed_jobs"] != ["happy"]:
        raise AssertionError("run summary failed jobs are wrong")
    failed_checklist = failed_summary["qa"]["visual_review"].get("checklist", {})
    failed_action_checks = {item.get("id"): item for item in failed_checklist.get("actions", [])}
    if failed_action_checks.get("happy", {}).get("identity_stable"):
        raise AssertionError("failed visual review should not mark failed action identity as passed")
    if failed_summary["ready_for_use"]:
        raise AssertionError("failed visual QA should not be ready for use")

    repaired_from_visual = run_command([
        sys.executable, str(PIPELINE), "repair",
        "--run-dir", str(run_dir),
        "--job-id", "happy"
    ])
    visual_repair_text = Path(repaired_from_visual["repair_prompt_path"]).read_text(encoding="utf-8")
    for expected in (
        "visual QA note: manual QA found expression drift",
        "visual QA failed: identity drift or character mismatch",
        "visual QA failed: action does not match the description",
        "visual QA failed: action-specific avoid list was violated",
        "visual QA failed: banned text, UI, bubbles, effects, shadows, floor, or scenery appeared"
    ):
        if expected not in visual_repair_text:
            raise AssertionError(f"visual QA repair prompt missing: {expected}")

    repaired = run_command([
        sys.executable, str(PIPELINE), "repair",
        "--run-dir", str(run_dir),
        "--job-id", "happy",
        "--reason", "manual QA found expression drift; regenerate only this action"
    ])
    repair_prompt = Path(repaired["repair_prompt_path"])
    if not repair_prompt.exists():
        raise AssertionError("repair prompt was not created")
    repair_text = repair_prompt.read_text(encoding="utf-8")
    for expected in ("happy", "regenerate only this action", "reference.png", "decoded/canonical-base.png", "manual QA found expression drift"):
        if expected not in repair_text:
            raise AssertionError(f"repair prompt missing: {expected}")
    repaired_status = json.loads(status_path.read_text(encoding="utf-8"))
    repaired_jobs = {job["id"]: job["status"] for job in repaired_status["jobs"]}
    if repaired_jobs["happy"] != "repair-prompted" or repaired_jobs["idle"] != "processed":
        raise AssertionError(f"repair command updated wrong jobs: {repaired_jobs}")

    bad_run_dir = RUN_ROOT / "bad-size-run"
    bad_actions = RUN_ROOT / "bad-actions.json"
    bad_actions.write_text(json.dumps([{
        "id": "idle",
        "frame_count": 4,
        "description": "calm breathing",
        "avoid": "walking"
    }]), encoding="utf-8")
    run_command([
        sys.executable, str(PIPELINE), "init",
        "--reference-image", str(reference),
        "--pet-name", "bad-size",
        "--style-notes", "rounded sticker desktop pet",
        "--actions", str(bad_actions),
        "--output-dir", str(bad_run_dir),
        "--chroma-key", "#0000FF"
    ])
    make_reference(bad_run_dir / "decoded" / "canonical-base.png")
    make_strip(bad_run_dir / "decoded" / "idle.png", 3, "idle")
    bad_result = run_command([sys.executable, str(PIPELINE), "process", "--run-dir", str(bad_run_dir)])
    if bad_result["ok"]:
        raise AssertionError("bad decoded strip dimensions should fail validation")
    bad_idle = next(action for action in bad_result["actions"] if action["id"] == "idle")
    if not any("expected" in error and "decoded strip" in error for error in bad_idle["errors"]):
        raise AssertionError("bad decoded strip size error is missing")
    bad_status = json.loads((bad_run_dir / "generation-status.json").read_text(encoding="utf-8"))
    bad_idle_job = next(job for job in bad_status["jobs"] if job["id"] == "idle")
    if bad_idle_job["status"] != "needs-repair":
        raise AssertionError("bad decoded strip job should be marked needs-repair")
    run_command_fails([
        sys.executable, str(PIPELINE), "review",
        "--run-dir", str(bad_run_dir),
        "--status", "accepted",
        "--note", "should not accept bad automated validation"
    ], "cannot accept visual QA while automated validation has errors")

    green_run_dir = RUN_ROOT / "green-chroma-run"
    green_actions = RUN_ROOT / "green-actions.json"
    green_actions.write_text(json.dumps([{
        "id": "idle",
        "frame_count": 2,
        "description": "calm breathing on green chroma background",
        "avoid": "blue background only"
    }]), encoding="utf-8")
    run_command([
        sys.executable, str(PIPELINE), "init",
        "--reference-image", str(reference),
        "--pet-name", "green",
        "--style-notes", "rounded sticker desktop pet",
        "--actions", str(green_actions),
        "--output-dir", str(green_run_dir),
        "--chroma-key", "#00FF00"
    ])
    green = (0, 255, 0, 255)
    make_reference(green_run_dir / "decoded" / "canonical-base.png")
    with Image.open(green_run_dir / "decoded" / "canonical-base.png").convert("RGBA") as image:
        pixels = image.load()
        for x in range(image.width):
            for y in range(image.height):
                if pixels[x, y] == CHROMA:
                    pixels[x, y] = green
        image.save(green_run_dir / "decoded" / "canonical-base.png")
    green_strip = Image.new("RGBA", (CELL_WIDTH * 2, CELL_HEIGHT), green)
    for index in range(2):
        cell = Image.new("RGBA", (CELL_WIDTH, CELL_HEIGHT), green)
        draw = ImageDraw.Draw(cell)
        draw_character(draw, 0, 18 - (4 if index else 0), mood="idle")
        green_strip.alpha_composite(cell, (index * CELL_WIDTH, 0))
    green_strip.save(green_run_dir / "decoded" / "idle.png")
    green_result = run_command([sys.executable, str(PIPELINE), "process", "--run-dir", str(green_run_dir)])
    if not green_result["ok"]:
        raise AssertionError(f"green chroma run should pass: {json.dumps(green_result, ensure_ascii=False, indent=2)}")
    green_idle = next(action for action in green_result["actions"] if action["id"] == "idle")
    if any(frame["transparent_pixels"] == 0 for frame in green_idle["frames"]):
        raise AssertionError("green chroma frames should have transparent pixels after keying")

    scaled_run_dir = RUN_ROOT / "scaled-strip-run"
    scaled_actions = RUN_ROOT / "scaled-actions.json"
    scaled_actions.write_text(json.dumps([{
        "id": "idle",
        "frame_count": 4,
        "description": "calm breathing from a larger generated strip",
        "avoid": "rejecting compatible high resolution output"
    }]), encoding="utf-8")
    run_command([
        sys.executable, str(PIPELINE), "init",
        "--reference-image", str(reference),
        "--pet-name", "scaled",
        "--style-notes", "rounded sticker desktop pet",
        "--actions", str(scaled_actions),
        "--output-dir", str(scaled_run_dir),
        "--chroma-key", "#0000FF"
    ])
    make_large_reference(scaled_run_dir / "decoded" / "canonical-base.png")
    scaled_source = RUN_ROOT / "scaled-source.png"
    make_strip(scaled_source, 4, "idle")
    with Image.open(scaled_source).convert("RGBA") as image:
        image.resize((CELL_WIDTH * 8, CELL_HEIGHT * 2), Image.Resampling.NEAREST).save(scaled_run_dir / "decoded" / "idle.png")
    scaled_result = run_command([sys.executable, str(PIPELINE), "process", "--run-dir", str(scaled_run_dir)])
    if not scaled_result["ok"]:
        raise AssertionError(f"compatible scaled strip should pass: {json.dumps(scaled_result, ensure_ascii=False, indent=2)}")
    scaled_idle = next(action for action in scaled_result["actions"] if action["id"] == "idle")
    if not any("normalized frames" in warning for warning in scaled_idle["warnings"]):
        raise AssertionError("compatible scaled strip should record a normalization warning")
    with Image.open(scaled_run_dir / "frames" / "idle" / "00.png") as frame:
        if frame.size != (CELL_WIDTH, CELL_HEIGHT):
            raise AssertionError(f"scaled frame should be normalized to cell size: {frame.size}")

    material_run_dir = RUN_ROOT / "action-materials-run"
    material_actions = RUN_ROOT / "material-actions.json"
    material_actions.write_text(json.dumps([{
        "id": "idle",
        "frame_count": 2,
        "description": "calm breathing action materials only",
        "avoid": "spritesheet requirement"
    }]), encoding="utf-8")
    run_command([
        sys.executable, str(PIPELINE), "init",
        "--reference-image", str(reference),
        "--pet-name", "materials-only",
        "--style-notes", "rounded sticker desktop pet",
        "--actions", str(material_actions),
        "--output-dir", str(material_run_dir),
        "--chroma-key", "#0000FF"
    ])
    make_reference(material_run_dir / "decoded" / "canonical-base.png")
    make_strip(material_run_dir / "decoded" / "idle.png", 2, "idle")
    material_result = run_command([
        sys.executable, str(PIPELINE), "process",
        "--run-dir", str(material_run_dir),
        "--skip-spritesheet"
    ])
    if not material_result["ok"]:
        raise AssertionError(f"action materials run should pass without spritesheet: {json.dumps(material_result, ensure_ascii=False, indent=2)}")
    if material_result.get("spritesheet"):
        raise AssertionError("spritesheet should be optional and omitted when skipped")
    assert_path(material_run_dir / "frames" / "idle" / "00.png")
    assert_path(material_run_dir / "qa" / "previews" / "idle.gif")
    assert_path(material_run_dir / "qa" / "contact-sheet.png")
    if (material_run_dir / "final" / "spritesheet.webp").exists():
        raise AssertionError("spritesheet.webp should not be created for action-materials-only runs")
    material_output = json.loads((material_run_dir / "final" / "output-manifest.json").read_text(encoding="utf-8"))
    if [(action["id"], action["row_index"], len(action["frames"])) for action in material_output["actions"]] != [("idle", None, 2)]:
        raise AssertionError("action-materials output manifest should expose frames without a spritesheet row")
    run_command([
        sys.executable, str(PIPELINE), "review",
        "--run-dir", str(material_run_dir),
        "--status", "accepted",
        "--note", "action frames and GIF preview passed"
    ])
    material_summary = json.loads((material_run_dir / "qa" / "run-summary.json").read_text(encoding="utf-8"))
    if not material_summary["materials_ready"] or material_summary["ready_for_use"]:
        raise AssertionError("materials-only run should be material-ready but not applicable as a desktop-pet spritesheet")

    static_run_dir = RUN_ROOT / "static-motion-run"
    static_actions = RUN_ROOT / "static-actions.json"
    static_actions.write_text(json.dumps([{
        "id": "idle",
        "frame_count": 3,
        "description": "intentionally static frames for motion QA warning",
        "avoid": "motionless loop"
    }]), encoding="utf-8")
    run_command([
        sys.executable, str(PIPELINE), "init",
        "--reference-image", str(reference),
        "--pet-name", "static",
        "--style-notes", "rounded sticker desktop pet",
        "--actions", str(static_actions),
        "--output-dir", str(static_run_dir),
        "--chroma-key", "#0000FF"
    ])
    make_reference(static_run_dir / "decoded" / "canonical-base.png")
    make_static_strip(static_run_dir / "decoded" / "idle.png", 3)
    static_result = run_command([sys.executable, str(PIPELINE), "process", "--run-dir", str(static_run_dir)])
    if not static_result["ok"]:
        raise AssertionError(f"static motion warning should not fail geometry validation: {json.dumps(static_result, ensure_ascii=False, indent=2)}")
    static_idle = next(action for action in static_result["actions"] if action["id"] == "idle")
    if static_idle.get("motion", {}).get("near_duplicate_pairs") != 2:
        raise AssertionError("static motion near-duplicate count is wrong")
    if not any("motion appears nearly static" in warning for warning in static_idle["warnings"]):
        raise AssertionError("static motion warning is missing")

    inner_chroma_run_dir = RUN_ROOT / "inner-chroma-run"
    inner_chroma_actions = RUN_ROOT / "inner-chroma-actions.json"
    inner_chroma_actions.write_text(json.dumps([{
        "id": "idle",
        "frame_count": 1,
        "description": "single frame with internal chroma-colored detail removed globally",
        "avoid": "edge-only chroma cleanup"
    }]), encoding="utf-8")
    run_command([
        sys.executable, str(PIPELINE), "init",
        "--reference-image", str(reference),
        "--pet-name", "inner-chroma",
        "--style-notes", "rounded sticker desktop pet",
        "--actions", str(inner_chroma_actions),
        "--output-dir", str(inner_chroma_run_dir),
        "--chroma-key", "#0000FF"
    ])
    make_chroma_inside_character(inner_chroma_run_dir / "decoded" / "canonical-base.png")
    make_chroma_inside_character(inner_chroma_run_dir / "decoded" / "idle.png")
    inner_chroma_result = run_command([sys.executable, str(PIPELINE), "process", "--run-dir", str(inner_chroma_run_dir)])
    if not inner_chroma_result["ok"]:
        raise AssertionError(f"global chroma cleanup should still pass geometry validation: {json.dumps(inner_chroma_result, ensure_ascii=False, indent=2)}")
    with Image.open(inner_chroma_run_dir / "frames" / "idle" / "00.png").convert("RGBA") as frame:
        if frame.getpixel((96, 126))[3] != 0:
            raise AssertionError("internal chroma-colored detail should be removed by global chroma deletion")

    partial_run_dir = RUN_ROOT / "partial-run"
    partial_actions = RUN_ROOT / "partial-actions.json"
    partial_actions.write_text(json.dumps([
        {
            "id": "missing",
            "frame_count": 2,
            "description": "missing decoded strip should not become playable",
            "avoid": "silently adding empty rows"
        },
        {
            "id": "ready",
            "frame_count": 3,
            "description": "valid cheerful idle loop",
            "avoid": "wrong row index"
        }
    ]), encoding="utf-8")
    run_command([
        sys.executable, str(PIPELINE), "init",
        "--reference-image", str(reference),
        "--pet-name", "partial",
        "--style-notes", "rounded sticker desktop pet",
        "--actions", str(partial_actions),
        "--output-dir", str(partial_run_dir),
        "--chroma-key", "#0000FF"
    ])
    make_reference(partial_run_dir / "decoded" / "canonical-base.png")
    make_strip(partial_run_dir / "decoded" / "ready.png", 3, "happy")
    partial_result = run_command([sys.executable, str(PIPELINE), "process", "--run-dir", str(partial_run_dir)])
    if partial_result["ok"]:
        raise AssertionError("partial run with one missing action should fail validation")
    if partial_result["spritesheet"]["rows"] != 1:
        raise AssertionError("partial run spritesheet should include only the valid action row")
    partial_output = json.loads((partial_run_dir / "final" / "output-manifest.json").read_text(encoding="utf-8"))
    partial_rows = [(action["id"], action["row_index"], len(action["frames"])) for action in partial_output["actions"]]
    if partial_rows != [("ready", 0, 3)]:
        raise AssertionError(f"partial output manifest should compact playable rows: {partial_rows}")

    bad_base_run_dir = RUN_ROOT / "bad-base-valid-action-run"
    bad_base_actions = RUN_ROOT / "bad-base-actions.json"
    bad_base_actions.write_text(json.dumps([{
        "id": "ready",
        "frame_count": 3,
        "description": "valid action should be held back when canonical-base fails",
        "avoid": "using actions without a valid identity lock"
    }]), encoding="utf-8")
    run_command([
        sys.executable, str(PIPELINE), "init",
        "--reference-image", str(reference),
        "--pet-name", "bad-base",
        "--style-notes", "rounded sticker desktop pet",
        "--actions", str(bad_base_actions),
        "--output-dir", str(bad_base_run_dir),
        "--chroma-key", "#0000FF"
    ])
    make_edge_touching_image(bad_base_run_dir / "decoded" / "canonical-base.png")
    make_strip(bad_base_run_dir / "decoded" / "ready.png", 3, "happy")
    bad_base_result = run_command([sys.executable, str(PIPELINE), "process", "--run-dir", str(bad_base_run_dir)])
    if bad_base_result["ok"]:
        raise AssertionError("run with invalid canonical-base should fail validation")
    if "spritesheet" in bad_base_result:
        raise AssertionError("final playable spritesheet should not be created when canonical-base fails")
    bad_base_output = json.loads((bad_base_run_dir / "final" / "output-manifest.json").read_text(encoding="utf-8"))
    if bad_base_output["actions"]:
        raise AssertionError("output manifest should not expose playable actions when canonical-base fails")
    with Image.open(bad_base_run_dir / "qa" / "contact-sheet.png") as contact_sheet:
        if contact_sheet.height != CELL_HEIGHT:
            raise AssertionError("contact sheet should still show valid action frames for QA")
    if (bad_base_run_dir / "final" / "spritesheet.png").exists():
        raise AssertionError("spritesheet.png should not exist when canonical-base fails")

    mixed_run_dir = RUN_ROOT / "mixed-validity-run"
    mixed_actions = RUN_ROOT / "mixed-actions.json"
    mixed_actions.write_text(json.dumps([
        {
            "id": "cropped",
            "frame_count": 2,
            "description": "this action is intentionally cropped and should not enter final spritesheet",
            "avoid": "playable row pollution"
        },
        {
            "id": "ready",
            "frame_count": 3,
            "description": "valid cheerful idle loop after a failed processed action",
            "avoid": "wrong row index"
        }
    ]), encoding="utf-8")
    run_command([
        sys.executable, str(PIPELINE), "init",
        "--reference-image", str(reference),
        "--pet-name", "mixed",
        "--style-notes", "rounded sticker desktop pet",
        "--actions", str(mixed_actions),
        "--output-dir", str(mixed_run_dir),
        "--chroma-key", "#0000FF"
    ])
    make_reference(mixed_run_dir / "decoded" / "canonical-base.png")
    make_edge_touching_strip(mixed_run_dir / "decoded" / "cropped.png", 2)
    make_strip(mixed_run_dir / "decoded" / "ready.png", 3, "happy")
    mixed_result = run_command([sys.executable, str(PIPELINE), "process", "--run-dir", str(mixed_run_dir)])
    if mixed_result["ok"]:
        raise AssertionError("mixed run with one cropped action should fail validation")
    if mixed_result["spritesheet"]["rows"] != 1:
        raise AssertionError("final spritesheet should include only automatically valid actions")
    mixed_cropped = next(action for action in mixed_result["actions"] if action["id"] == "cropped")
    if not mixed_cropped.get("actual_frames") or not mixed_cropped.get("errors"):
        raise AssertionError("cropped action should be processed for QA but excluded from playable spritesheet")
    mixed_output = json.loads((mixed_run_dir / "final" / "output-manifest.json").read_text(encoding="utf-8"))
    mixed_rows = [(action["id"], action["row_index"], len(action["frames"])) for action in mixed_output["actions"]]
    if mixed_rows != [("ready", 0, 3)]:
        raise AssertionError(f"mixed output manifest should match playable spritesheet rows: {mixed_rows}")
    with Image.open(mixed_run_dir / "qa" / "contact-sheet.png") as contact_sheet:
        if contact_sheet.height != CELL_HEIGHT * 2:
            raise AssertionError("contact sheet should still show both processed actions for QA")
    with Image.open(mixed_run_dir / "final" / "spritesheet.png") as final_sheet:
        if final_sheet.height != CELL_HEIGHT:
            raise AssertionError("final spritesheet should exclude failed processed action rows")

    edge_run_dir = RUN_ROOT / "edge-run"
    edge_actions = RUN_ROOT / "edge-actions.json"
    edge_actions.write_text(json.dumps([{
        "id": "idle",
        "frame_count": 2,
        "description": "calm breathing with full body visible",
        "avoid": "cropping"
    }]), encoding="utf-8")
    run_command([
        sys.executable, str(PIPELINE), "init",
        "--reference-image", str(reference),
        "--pet-name", "edge",
        "--style-notes", "rounded sticker desktop pet",
        "--actions", str(edge_actions),
        "--output-dir", str(edge_run_dir),
        "--chroma-key", "#0000FF"
    ])
    make_edge_touching_image(edge_run_dir / "decoded" / "canonical-base.png")
    make_edge_touching_strip(edge_run_dir / "decoded" / "idle.png", 2)
    edge_result = run_command([sys.executable, str(PIPELINE), "process", "--run-dir", str(edge_run_dir)])
    if edge_result["ok"]:
        raise AssertionError("edge-touching canonical or action frames should fail validation")
    if "canonical-base content touches cell edge" not in edge_result["canonical_base"]["errors"]:
        raise AssertionError("canonical edge-touching error is missing")
    if not edge_result["canonical_base"].get("touches_edge"):
        raise AssertionError("canonical edge-touching metric is missing")
    edge_idle = next(action for action in edge_result["actions"] if action["id"] == "idle")
    if not any("content touches cell edge" in error for error in edge_idle["errors"]):
        raise AssertionError("action edge-touching frame error is missing")
    if not any(frame.get("touches_edge") for frame in edge_idle["frames"]):
        raise AssertionError("action edge-touching metric is missing")
    edge_status = json.loads((edge_run_dir / "generation-status.json").read_text(encoding="utf-8"))
    edge_jobs = {job["id"]: job["status"] for job in edge_status["jobs"]}
    if edge_jobs["canonical-base"] != "needs-repair" or edge_jobs["idle"] != "needs-repair":
        raise AssertionError(f"edge-touching jobs should need repair: {edge_jobs}")
    run_command_fails([
        sys.executable, str(PIPELINE), "review",
        "--run-dir", str(edge_run_dir),
        "--status", "accepted",
        "--note", "should not accept cropped frames"
    ], "cannot accept visual QA while automated validation has errors")

    empty_actions = RUN_ROOT / "empty-actions.json"
    empty_actions.write_text(json.dumps([]), encoding="utf-8")
    run_command_fails([
        sys.executable, str(PIPELINE), "init",
        "--reference-image", str(reference),
        "--pet-name", "empty",
        "--actions", str(empty_actions),
        "--output-dir", str(RUN_ROOT / "empty-run")
    ], "at least one action is required")

    invalid_actions = RUN_ROOT / "invalid-actions.json"
    invalid_run_dir = RUN_ROOT / "invalid-run"
    invalid_actions.write_text(json.dumps([{
        "id": "!!!",
        "frame_count": 4,
        "description": "invalid id"
    }]), encoding="utf-8")
    run_command_fails([
        sys.executable, str(PIPELINE), "init",
        "--reference-image", str(reference),
        "--pet-name", "invalid",
        "--actions", str(invalid_actions),
        "--output-dir", str(invalid_run_dir)
    ], "action id is required")

    duplicate_actions = RUN_ROOT / "duplicate-actions.json"
    duplicate_actions.write_text(json.dumps([
        {"id": "idle", "frame_count": 4, "description": "calm breathing"},
        {"id": "idle", "frame_count": 3, "description": "duplicate idle"}
    ]), encoding="utf-8")
    run_command_fails([
        sys.executable, str(PIPELINE), "init",
        "--reference-image", str(reference),
        "--pet-name", "duplicate",
        "--actions", str(duplicate_actions),
        "--output-dir", str(invalid_run_dir)
    ], "duplicate action id: idle")

    missing_description = RUN_ROOT / "missing-description-actions.json"
    missing_description.write_text(json.dumps([{
        "id": "idle",
        "frame_count": 4,
        "description": ""
    }]), encoding="utf-8")
    run_command_fails([
        sys.executable, str(PIPELINE), "init",
        "--reference-image", str(reference),
        "--pet-name", "missing-description",
        "--actions", str(missing_description),
        "--output-dir", str(invalid_run_dir)
    ], "description is required for idle")

    bad_reference = RUN_ROOT / "not-an-image.png"
    bad_reference.write_text("not an image", encoding="utf-8")
    run_command_fails([
        sys.executable, str(PIPELINE), "init",
        "--reference-image", str(bad_reference),
        "--pet-name", "bad-reference",
        "--actions", str(actions),
        "--output-dir", str(invalid_run_dir)
    ], "reference_image must be a readable image")

    print("pet action pipeline ok")


if __name__ == "__main__":
    main()
