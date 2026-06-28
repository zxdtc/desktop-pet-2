import argparse
import json
import math
import shutil
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw


CELL_WIDTH = 192
CELL_HEIGHT = 208
DEFAULT_CHROMA = "#00FF00"


def ensure_dir(path):
    Path(path).mkdir(parents=True, exist_ok=True)


def parse_hex_color(value):
    value = value.strip().lstrip("#")
    if len(value) != 6:
        raise ValueError(f"Invalid chroma key: {value}")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def sanitize_action_id(value):
    allowed = []
    for char in str(value).strip():
        if char.isalnum() or char in ("-", "_"):
            allowed.append(char)
    return "".join(allowed)


def load_manifest(run_dir):
    manifest_path = Path(run_dir) / "manifest.json"
    return json.loads(manifest_path.read_text(encoding="utf-8-sig"))


def write_json(path, payload):
    Path(path).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def status_path(run_dir):
    return Path(run_dir) / "generation-status.json"


def load_generation_status(run_dir, manifest=None):
    path = status_path(run_dir)
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    if manifest is None:
        manifest = load_manifest(run_dir)
    return generation_status(manifest)


def find_job(status, job_id):
    for job in status.get("jobs", []):
        if job.get("id") == job_id:
            return job
    return None


def action_prompt(manifest, action):
    style_notes = manifest.get("style_notes") or "Preserve the reference image style."
    avoid = action.get("avoid") or "none"
    chroma_key = manifest.get("chroma_key", DEFAULT_CHROMA)
    return f"""Use the provided reference image and decoded/canonical-base.png as identity references for the same desktop pet character.

Generate one horizontal sprite strip for action: "{action["id"]}".

Character identity:
Preserve the same character from the reference image: same face, body proportions, colors, markings, materials, silhouette, expression style, and any signature features. Do not redesign the character.
Use decoded/canonical-base.png as the canonical identity lock. The action strip must keep the same character identity as canonical-base.png and must not drift in species, outfit, material, palette, silhouette, or signature props.

Action:
{action.get("description", "")}

Frame requirements:
Create exactly {action["frame_count"]} coherent full-body frames in one horizontal row, ordered left to right.
Treat the strip as {action["frame_count"]} equal fixed cells, each {manifest["cell_width"]}x{manifest["cell_height"]}.
Keep the character centered inside every cell with the same visual scale, camera distance, and bottom-center anchor.
Keep the full character visible in every frame with generous padding.
No clipping, no overlap between frames, no body parts crossing frame boundaries.
The motion should progress naturally across all {action["frame_count"]} frames and loop cleanly if appropriate.
Avoid jump cuts: adjacent frames should change pose smoothly, not teleport or resize.
The expression and gesture must match the action semantics, not only move the original picture.

Style:
{style_notes}
The character should be readable at small desktop-pet size, with clear silhouette and stable visual identity.

Background:
Use a perfectly flat solid {chroma_key} chroma-key background across the whole strip.
No gradients, no anti-aliased background, no shadows, no floor, no scenery, no texture.
Do not use the chroma-key color or close colors inside the character.

Avoid:
No text, labels, frame numbers, borders, guide marks, UI, speech bubbles, thought bubbles, icons, detached effects, shadows, glows, dust, speed lines, motion trails, white background, checkerboard transparency.
Also avoid: {avoid}

After generation:
- Save the selected image as decoded/{action["id"]}.png
- Record source path and status
- If generation fails or violates the action, regenerate only this action.
"""


def generation_status(manifest):
    jobs = [{
        "id": "canonical-base",
        "kind": "base",
        "prompt_path": "prompts/canonical-base.md",
        "output_path": "decoded/canonical-base.png",
        "input_images": ["reference.png"],
        "status": "pending",
        "source_path": "",
        "qa_note": ""
    }]
    for action in manifest["actions"]:
        jobs.append({
            "id": action["id"],
            "kind": "action-strip",
            "prompt_path": f"prompts/{action['id']}.md",
            "output_path": f"decoded/{action['id']}.png",
            "input_images": ["reference.png", "decoded/canonical-base.png"],
            "frame_count": action["frame_count"],
            "status": "pending",
            "source_path": "",
            "qa_note": ""
        })
    return {"jobs": jobs}


def base_prompt(manifest):
    style_notes = manifest.get("style_notes") or "Preserve the reference image style."
    chroma_key = manifest.get("chroma_key", DEFAULT_CHROMA)
    return f"""Use the provided reference image as the identity reference for the same desktop pet character.

Generate canonical-base.png for desktop pet action generation.

Requirements:
- Single complete full-body character.
- Same face, body proportions, colors, markings, materials, silhouette, expression style, and signature features as the reference image.
- Centered in one fixed {manifest["cell_width"]}x{manifest["cell_height"]} cell, bottom-center anchored, generous padding, no clipping.
- Readable at {manifest["cell_width"]}x{manifest["cell_height"]} desktop-pet size.
- Perfectly flat solid {chroma_key} chroma-key background with no gradient or texture.
- No text, labels, borders, UI, speech bubbles, icons, detached effects, shadows, floor, scene, white background, or checkerboard.

Style:
{style_notes}

After generation:
- Save selected image as decoded/canonical-base.png
"""


def workflow_doc(manifest):
    lines = [
        f"# {manifest.get('pet_name', 'desktop pet')} action generation workflow",
        "",
        "## 1. Generate canonical-base",
        "- Open prompts/canonical-base.md.",
        "- Use reference.png as the identity reference.",
        "- Save the selected full-body result to decoded/canonical-base.png.",
        "",
        "## 2. Generate action strips",
        "For each action, use both reference.png and decoded/canonical-base.png as identity references.",
        "Generate one coherent horizontal 12-frame strip unless the manifest explicitly says another frame count.",
        "Each frame must be one fixed cell with a pure solid chroma-key background, centered character, stable scale, and smooth adjacent-frame motion.",
        "Save each selected horizontal strip to the listed decoded path.",
        ""
    ]
    for action in manifest.get("actions", []):
        action_id = sanitize_action_id(action.get("id", ""))
        lines.extend([
            f"### {action_id}",
            f"- prompt: prompts/{action_id}.md",
            f"- output: decoded/{action_id}.png",
            f"- frames: {action.get('frame_count')}",
            f"- description: {action.get('description', '')}",
            f"- avoid: {action.get('avoid', '') or 'none'}",
            ""
        ])
    lines.extend([
        "## 3. Import and record",
        "- In the control panel, select the matching Job ID.",
        "- Use `选择图片并导入 decoded` after selecting the generated image.",
        "- Use `登记生成结果` only when you need to manually record a status/source.",
        "",
        "## 4. Process",
        "- Click `处理 decoded 动作条`.",
        "- The pipeline cuts frames, removes chroma key, writes final strips, creates GIF previews, contact sheet, validation, and run summary.",
        "- If desktop-pet atlas output is requested, it also creates final/spritesheet.png and final/spritesheet.webp.",
        "",
        "## 5. Visual QA",
        "- Review qa/contact-sheet.png and qa/previews/*.gif.",
        "- Check identity, expression semantics, fixed-cell centering, stable scale, and adjacent-frame jump cuts.",
        "- If one action fails, mark that action as needing repair and generate a repair prompt.",
        "- Do not regenerate all actions when only one action failed.",
        "- Click `视觉 QA 通过` only after identity, action semantics, avoid list, and automated validation all pass.",
        "",
        "## 6. Apply",
        "- Click `应用到桌宠形象` only when a spritesheet was generated and the final summary says the run is ready for use.",
        "- For action-materials-only runs, use frames/{action_id}/*.png and qa/previews/{action_id}.gif without applying a spritesheet.",
        ""
    ])
    return "\n".join(lines)


def init_run(args):
    actions = json.loads(Path(args.actions).read_text(encoding="utf-8-sig")) if args.actions else []
    actions = actions.get("actions", actions) if isinstance(actions, dict) else actions
    if not isinstance(actions, list) or len(actions) < 1:
        raise ValueError("at least one action is required")
    normalized_actions = []
    seen_action_ids = set()
    for action in actions:
        action_id = sanitize_action_id(action.get("id"))
        if not action_id:
            raise ValueError("action id is required and must contain letters, numbers, underscore, or hyphen")
        if action_id in seen_action_ids:
            raise ValueError(f"duplicate action id: {action_id}")
        seen_action_ids.add(action_id)
        frame_count = int(action.get("frame_count", 12))
        if frame_count < 1:
            raise ValueError(f"frame_count must be positive for {action_id}")
        description = str(action.get("description", "")).strip()
        if not description:
            raise ValueError(f"description is required for {action_id}")
        normalized_actions.append({
            "id": action_id,
            "frame_count": frame_count,
            "description": description,
            "avoid": str(action.get("avoid", "")).strip()
        })

    run_dir = Path(args.output_dir)
    ensure_dir(run_dir)
    for name in ("prompts", "decoded", "frames", "final", "qa", "qa/previews"):
        ensure_dir(run_dir / name)

    reference_path = Path(args.reference_image).resolve()
    if not reference_path.exists():
        raise FileNotFoundError(reference_path)
    try:
        with Image.open(reference_path) as reference_image:
            reference_image.verify()
    except Exception as exc:
        raise ValueError(f"reference_image must be a readable image: {reference_path}") from exc
    shutil.copyfile(reference_path, run_dir / "reference.png")

    manifest = {
        "pet_name": args.pet_name,
        "cell_width": CELL_WIDTH,
        "cell_height": CELL_HEIGHT,
        "chroma_key": args.chroma_key,
        "style_notes": args.style_notes or "",
        "actions": normalized_actions
    }
    write_json(run_dir / "manifest.json", manifest)
    (run_dir / "prompts" / "canonical-base.md").write_text(base_prompt(manifest), encoding="utf-8")
    for action in normalized_actions:
        (run_dir / "prompts" / f"{action['id']}.md").write_text(action_prompt(manifest, action), encoding="utf-8")
    (run_dir / "workflow.md").write_text(workflow_doc(manifest), encoding="utf-8")
    write_json(run_dir / "generation-status.json", generation_status(manifest))

    write_json(run_dir / "qa" / "validation.json", {
        "ok": False,
        "status": "initialized",
        "message": "Run initialized. Generate decoded/canonical-base.png and decoded/{action_id}.png before processing.",
        "run_dir": str(run_dir)
    })
    return {"ok": True, "run_dir": str(run_dir), "actions": normalized_actions}


def mark_job(args):
    run_dir = Path(args.run_dir)
    manifest = load_manifest(run_dir)
    status = load_generation_status(run_dir, manifest)
    job = find_job(status, args.job_id)
    if not job:
        raise ValueError(f"Unknown generation job: {args.job_id}")
    if args.status:
        job["status"] = args.status
    if args.source_path is not None:
        job["source_path"] = args.source_path
    if args.qa_note is not None:
        job["qa_note"] = args.qa_note
    if args.output_path is not None:
        job["output_path"] = args.output_path
    job["updated_at"] = args.updated_at or ""
    write_json(status_path(run_dir), status)
    return {"ok": True, "run_dir": str(run_dir), "job": job}


def import_job_image(args):
    run_dir = Path(args.run_dir)
    manifest = load_manifest(run_dir)
    status = load_generation_status(run_dir, manifest)
    job = find_job(status, args.job_id)
    if not job:
        raise ValueError(f"Unknown generation job: {args.job_id}")

    source_path = Path(args.source_path).resolve()
    if not source_path.exists():
        raise FileNotFoundError(source_path)
    try:
        with Image.open(source_path) as image:
            image.verify()
    except Exception as exc:
        raise ValueError(f"Imported source is not a readable image: {source_path}") from exc

    output_path = run_dir / job["output_path"]
    ensure_dir(output_path.parent)
    shutil.copyfile(source_path, output_path)
    job["status"] = args.status
    job["source_path"] = str(source_path)
    job["output_path"] = str(job["output_path"])
    job["qa_note"] = args.qa_note or "imported into decoded output"
    job["updated_at"] = args.updated_at or ""
    write_json(status_path(run_dir), status)
    return {
        "ok": True,
        "run_dir": str(run_dir),
        "job": job,
        "decoded_path": str(output_path)
    }


def repair_prompt(manifest, action, reason, validation_notes):
    base = action_prompt(manifest, action)
    notes = "\n".join(f"- {note}" for note in validation_notes) if validation_notes else "- No automated validation notes."
    return f"""Repair only action: "{action["id"]}".

Do not regenerate canonical-base or any other action.
Use reference.png and decoded/canonical-base.png as the identity references.
Save the selected replacement image as decoded/{action["id"]}.png.

Repair reason:
{reason or "The action needs targeted repair."}

Validation notes:
{notes}

Original action prompt:

{base}
"""


def visual_review_notes_for_action(validation, action_id):
    notes = []
    visual_review = validation.get("visual_review") or {}
    failed_jobs = set(visual_review.get("failed_jobs") or [])
    if action_id not in failed_jobs:
        return notes
    note = str(visual_review.get("note") or "").strip()
    if note:
        notes.append(f"visual QA note: {note}")
    checklist = visual_review.get("checklist") or {}
    failed_labels = {
        "identity_stable": "identity drift or character mismatch",
        "action_matches_description": "action does not match the description",
        "avoid_list_respected": "action-specific avoid list was violated",
        "full_character_visible": "one or more frames do not show the full character",
        "no_banned_elements": "banned text, UI, bubbles, effects, shadows, floor, or scenery appeared",
        "loop_readable": "motion loop is not readable or natural at desktop-pet size"
    }
    for item in checklist.get("actions", []):
        if item.get("id") != action_id:
            continue
        for key, label in failed_labels.items():
            if item.get(key) is False:
                notes.append(f"visual QA failed: {label}")
        description = str(item.get("description") or "").strip()
        avoid = str(item.get("avoid") or "").strip()
        if description:
            notes.append(f"action description reviewed: {description}")
        if avoid and avoid != "none":
            notes.append(f"action avoid reviewed: {avoid}")
        break
    return notes


def repair_job(args):
    run_dir = Path(args.run_dir)
    manifest = load_manifest(run_dir)
    status = load_generation_status(run_dir, manifest)
    job = find_job(status, args.job_id)
    if not job:
        raise ValueError(f"Unknown generation job: {args.job_id}")
    if args.job_id == "canonical-base":
        action = {
            "id": "canonical-base",
            "frame_count": 1,
            "description": "repair canonical-base as a single complete full-body identity reference",
            "avoid": "text, UI, shadow, floor, scenery, white background, checkerboard"
        }
        prompt_text = f"""Repair only canonical-base.

Do not regenerate any action strip.
Use reference.png as the identity reference.
Save the selected replacement image as decoded/canonical-base.png.

Repair reason:
{args.reason or "The canonical base needs targeted repair."}

Original canonical-base prompt:

{base_prompt(manifest)}
"""
    else:
        action = next((item for item in manifest.get("actions", []) if sanitize_action_id(item["id"]) == args.job_id), None)
        if not action:
            raise ValueError(f"Unknown action in manifest: {args.job_id}")
        validation_notes = []
        validation_path = run_dir / "qa" / "validation.json"
        if validation_path.exists():
            validation = json.loads(validation_path.read_text(encoding="utf-8"))
            for item in validation.get("actions", []):
                if item.get("id") == args.job_id:
                    validation_notes.extend(item.get("errors", []))
                    validation_notes.extend(item.get("warnings", []))
            validation_notes.extend(visual_review_notes_for_action(validation, args.job_id))
        prompt_text = repair_prompt(manifest, action, args.reason, validation_notes)

    repairs_dir = run_dir / "prompts" / "repairs"
    ensure_dir(repairs_dir)
    repair_path = repairs_dir / f"{args.job_id}.md"
    repair_path.write_text(prompt_text, encoding="utf-8")
    job["status"] = "repair-prompted"
    job["repair_prompt_path"] = str(repair_path.relative_to(run_dir))
    job["qa_note"] = args.reason or job.get("qa_note", "")
    job["updated_at"] = args.updated_at or ""
    write_json(status_path(run_dir), status)
    return {
        "ok": True,
        "run_dir": str(run_dir),
        "job": job,
        "repair_prompt_path": str(repair_path)
    }


def is_chroma_pixel(pixel, chroma, tolerance):
    r, g, b, _a = pixel
    if abs(r - chroma[0]) <= tolerance and abs(g - chroma[1]) <= tolerance and abs(b - chroma[2]) <= tolerance:
        return True
    if chroma == (0, 255, 0):
        return g >= 80 and g - r >= 18 and g - b >= 18 and g > max(r, b) * 1.08
    if chroma == (0, 0, 255):
        return b >= 80 and b - r >= 18 and b - g >= 18 and b > max(r, g) * 1.08
    return False


def despill_chroma_pixel(pixel, chroma):
    r, g, b, a = pixel
    if a == 0:
        return pixel
    if chroma == (0, 255, 0) and g > max(r, b):
        return (r, max(r, b), b, a)
    if chroma == (0, 0, 255) and b > max(r, g):
        return (r, g, max(r, g), a)
    return pixel


def chroma_to_alpha(image, chroma, tolerance):
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    for y in range(height):
        for x in range(width):
            if is_chroma_pixel(pixels[x, y], chroma, tolerance):
                pixels[x, y] = (0, 0, 0, 0)
            else:
                pixels[x, y] = despill_chroma_pixel(pixels[x, y], chroma)
    return rgba


def split_strip(strip, frame_count, cell_width, cell_height, chroma, tolerance):
    frames = []
    source_width, source_height = strip.size
    for index in range(frame_count):
        left = round(index * source_width / frame_count)
        right = round((index + 1) * source_width / frame_count)
        frame = strip.crop((left, 0, right, source_height))
        frame.thumbnail((cell_width, cell_height), Image.Resampling.LANCZOS)
        cell = Image.new("RGBA", (cell_width, cell_height), (0, 0, 0, 0))
        x = (cell_width - frame.width) // 2
        y = (cell_height - frame.height) // 2
        cell.alpha_composite(frame.convert("RGBA"), (x, y))
        frames.append(chroma_to_alpha(cell, chroma, tolerance))
    return frames


def normalize_single_frame(image, cell_width, cell_height, chroma, tolerance):
    frame = chroma_to_alpha(image, chroma, tolerance)
    frame.thumbnail((cell_width, cell_height), Image.Resampling.LANCZOS)
    cell = Image.new("RGBA", (cell_width, cell_height), (0, 0, 0, 0))
    x = (cell_width - frame.width) // 2
    y = (cell_height - frame.height) // 2
    cell.alpha_composite(frame.convert("RGBA"), (x, y))
    return cell


def bbox_alpha(image):
    return image.getchannel("A").getbbox()


def frame_nonempty(image):
    return bbox_alpha(image) is not None


def frame_touches_edge(image, margin=2):
    bbox = bbox_alpha(image)
    if not bbox:
        return False
    left, top, right, bottom = bbox
    return left <= margin or top <= margin or right >= image.width - margin or bottom >= image.height - margin


def alpha_bbox_metrics(image, margin=2):
    bbox = bbox_alpha(image)
    if not bbox:
        return {
            "bbox": None,
            "margins": None,
            "touches_edge": False
        }
    left, top, right, bottom = bbox
    margins = {
        "left": left,
        "top": top,
        "right": image.width - right,
        "bottom": image.height - bottom
    }
    return {
        "bbox": {"left": left, "top": top, "right": right, "bottom": bottom},
        "margins": margins,
        "touches_edge": any(value <= margin for value in margins.values())
    }


def alpha_stats(image):
    pixels = list(image.convert("RGBA").getdata())
    transparent = sum(1 for pixel in pixels if pixel[3] == 0)
    opaque = sum(1 for pixel in pixels if pixel[3] > 0)
    return {
        "transparent_pixels": transparent,
        "opaque_pixels": opaque,
        "total_pixels": len(pixels)
    }


def motion_metrics(frames):
    if len(frames) < 2:
        return {
            "frame_count": len(frames),
            "bbox_shift_total": 0,
            "changed_pixel_ratios": [],
            "near_duplicate_pairs": 0
        }
    centers = []
    for frame in frames:
        bbox = bbox_alpha(frame)
        if not bbox:
            centers.append(None)
            continue
        left, top, right, bottom = bbox
        centers.append(((left + right) / 2, (top + bottom) / 2))
    bbox_shift_total = 0
    for previous, current in zip(centers, centers[1:]):
        if previous and current:
            bbox_shift_total += abs(current[0] - previous[0]) + abs(current[1] - previous[1])

    changed_pixel_ratios = []
    near_duplicate_pairs = 0
    total_pixels = frames[0].width * frames[0].height
    for previous, current in zip(frames, frames[1:]):
        diff = ImageChops.difference(previous.convert("RGBA"), current.convert("RGBA"))
        changed = sum(1 for pixel in diff.getdata() if pixel != (0, 0, 0, 0))
        ratio = changed / total_pixels if total_pixels else 0
        changed_pixel_ratios.append(round(ratio, 4))
        if ratio < 0.005:
            near_duplicate_pairs += 1
    return {
        "frame_count": len(frames),
        "bbox_shift_total": round(bbox_shift_total, 2),
        "changed_pixel_ratios": changed_pixel_ratios,
        "near_duplicate_pairs": near_duplicate_pairs
    }


def alignment_metrics(frames):
    metrics = {
        "frame_count": len(frames),
        "centers": [],
        "sizes": [],
        "bottom_centers": [],
        "center_x_range": 0,
        "center_y_range": 0,
        "bottom_y_range": 0,
        "width_delta_ratio": 0,
        "height_delta_ratio": 0,
        "max_size_delta_ratio": 0,
        "max_adjacent_center_shift": 0,
        "max_adjacent_size_delta_ratio": 0,
        "jump_pairs": []
    }
    if not frames:
        return metrics

    for frame in frames:
        bbox = bbox_alpha(frame)
        if not bbox:
            metrics["centers"].append(None)
            metrics["sizes"].append(None)
            metrics["bottom_centers"].append(None)
            continue
        left, top, right, bottom = bbox
        width = right - left
        height = bottom - top
        center = ((left + right) / 2, (top + bottom) / 2)
        bottom_center = ((left + right) / 2, bottom)
        metrics["centers"].append([round(center[0], 2), round(center[1], 2)])
        metrics["sizes"].append([width, height])
        metrics["bottom_centers"].append([round(bottom_center[0], 2), round(bottom_center[1], 2)])

    centers = [item for item in metrics["centers"] if item]
    sizes = [item for item in metrics["sizes"] if item]
    bottom_centers = [item for item in metrics["bottom_centers"] if item]
    if centers:
        xs = [item[0] for item in centers]
        ys = [item[1] for item in centers]
        metrics["center_x_range"] = round(max(xs) - min(xs), 2)
        metrics["center_y_range"] = round(max(ys) - min(ys), 2)
    if bottom_centers:
        bottoms = [item[1] for item in bottom_centers]
        metrics["bottom_y_range"] = round(max(bottoms) - min(bottoms), 2)
    if sizes:
        widths = [item[0] for item in sizes]
        heights = [item[1] for item in sizes]
        metrics["width_delta_ratio"] = round((max(widths) - min(widths)) / max(widths), 4) if max(widths) else 0
        metrics["height_delta_ratio"] = round((max(heights) - min(heights)) / max(heights), 4) if max(heights) else 0
        metrics["max_size_delta_ratio"] = max(metrics["width_delta_ratio"], metrics["height_delta_ratio"])

    for index, (previous_center, current_center, previous_size, current_size) in enumerate(zip(
        metrics["centers"],
        metrics["centers"][1:],
        metrics["sizes"],
        metrics["sizes"][1:]
    )):
        if not previous_center or not current_center or not previous_size or not current_size:
            continue
        center_shift = math.sqrt(
            (current_center[0] - previous_center[0]) ** 2 +
            (current_center[1] - previous_center[1]) ** 2
        )
        width_delta = abs(current_size[0] - previous_size[0]) / max(previous_size[0], current_size[0], 1)
        height_delta = abs(current_size[1] - previous_size[1]) / max(previous_size[1], current_size[1], 1)
        size_delta = max(width_delta, height_delta)
        metrics["max_adjacent_center_shift"] = max(metrics["max_adjacent_center_shift"], round(center_shift, 2))
        metrics["max_adjacent_size_delta_ratio"] = max(metrics["max_adjacent_size_delta_ratio"], round(size_delta, 4))
        if center_shift > 44 or size_delta > 0.22:
            metrics["jump_pairs"].append({
                "from": index,
                "to": index + 1,
                "center_shift": round(center_shift, 2),
                "size_delta_ratio": round(size_delta, 4)
            })
    return metrics


def strip_size_compatible(actual_size, expected_size, tolerance=0.08):
    actual_width, actual_height = actual_size
    expected_width, expected_height = expected_size
    if actual_width <= 0 or actual_height <= 0 or expected_width <= 0 or expected_height <= 0:
        return False
    actual_ratio = actual_width / actual_height
    expected_ratio = expected_width / expected_height
    return abs(actual_ratio - expected_ratio) / expected_ratio <= tolerance


def compose_strip(frames):
    strip = Image.new("RGBA", (frames[0].width * len(frames), frames[0].height), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * frame.width, 0))
    return strip


def make_contact_sheet(rows, max_frames, cell_width, cell_height):
    label_width = 160
    sheet = Image.new("RGBA", (label_width + max_frames * cell_width, len(rows) * cell_height), (255, 255, 255, 255))
    draw = ImageDraw.Draw(sheet)
    for row_index, (action_id, frames) in enumerate(rows):
        y = row_index * cell_height
        draw.text((10, y + 10), action_id, fill=(20, 20, 20, 255))
        for frame_index, frame in enumerate(frames):
            sheet.alpha_composite(frame, (label_width + frame_index * cell_width, y))
    return sheet


def write_manual_review(run_dir, manifest, validations):
    lines = [
        f"# Manual visual QA for {manifest.get('pet_name', 'desktop pet')}",
        "",
        "Use qa/contact-sheet.png and qa/previews/*.gif for review.",
        "Check these items before accepting the generated desktop pet assets.",
        "",
        "## canonical-base",
        "- [ ] full body is visible, centered, and not clipped",
        "- [ ] identity matches reference image: face, body proportions, colors, markings, material, silhouette, and signature props",
        "- [ ] flat chroma-key background only; no text, labels, UI, shadow, floor, scenery, or checkerboard",
        "- [ ] readable at 192x208 desktop-pet size",
        ""
    ]
    for action in manifest.get("actions", []):
        action_id = sanitize_action_id(action["id"])
        lines.extend([
            f"## {action_id}",
            f"Description: {action.get('description', '')}",
            f"Avoid: {action.get('avoid', '') or 'none'}",
            "- [ ] identity stays the same as reference.png and decoded/canonical-base.png",
            "- [ ] action matches description using body posture, not detached effects",
            "- [ ] all frames stay in a fixed cell with stable center, scale, and no sudden jump cuts",
            "- [ ] avoid list is respected",
            "- [ ] every frame shows the full character with no clipping or body parts crossing cell boundaries",
            "- [ ] no text, labels, frame numbers, borders, guide marks, UI, bubbles, detached icons, shadow, floor, scenery, white background, or checkerboard",
            "- [ ] loop reads naturally at small desktop-pet size",
            ""
        ])
    lines.extend([
        "## Automated checks already recorded",
        f"- ok: {validations.get('ok')}",
        f"- validation: qa/validation.json",
        f"- contact sheet: {validations.get('contact_sheet', 'qa/contact-sheet.png')}",
        ""
    ])
    review_path = Path(run_dir) / "qa" / "manual-review.md"
    review_path.write_text("\n".join(lines), encoding="utf-8")
    return review_path


def write_run_summary(run_dir, manifest, validations, review_record=None):
    run_dir = Path(run_dir)
    qa_dir = run_dir / "qa"
    spritesheet = validations.get("spritesheet") or {}
    manual_review = validations.get("manual_review") or {}
    visual_review = validations.get("visual_review") or review_record or {}
    materials_ready = bool(validations.get("ok")) and visual_review.get("status") == "accepted"
    has_spritesheet = bool(spritesheet.get("webp") or spritesheet.get("png"))
    ready_for_use = materials_ready and has_spritesheet
    if ready_for_use:
        ready_reason = "automated validation passed, visual QA accepted, and spritesheet is available"
    elif materials_ready:
        ready_reason = "action frames and previews are ready; generate a spritesheet before applying to the desktop pet"
    else:
        ready_reason = "requires passing automated validation and accepted visual QA"
    summary = {
        "ok": bool(validations.get("ok")),
        "materials_ready": materials_ready,
        "ready_for_use": ready_for_use,
        "ready_reason": ready_reason,
        "pet_name": manifest.get("pet_name", ""),
        "run_dir": str(run_dir),
        "manifest": str(run_dir / "manifest.json"),
        "reference": str(run_dir / "reference.png"),
        "spritesheet": {
            "requested": bool(validations.get("spritesheet_requested", True)),
            "webp": spritesheet.get("webp", ""),
            "png": spritesheet.get("png", ""),
            "width": spritesheet.get("width"),
            "height": spritesheet.get("height"),
            "rows": spritesheet.get("rows"),
            "columns": spritesheet.get("columns")
        },
        "canonical_base": str(run_dir / "final" / "canonical-base.png"),
        "output_manifest": str(run_dir / "final" / "output-manifest.json"),
        "provenance": validations.get("provenance", str(qa_dir / "provenance.json")),
        "frames_dir": str(run_dir / "frames"),
        "final_dir": str(run_dir / "final"),
        "qa": {
            "validation": str(qa_dir / "validation.json"),
            "contact_sheet": validations.get("contact_sheet", str(qa_dir / "contact-sheet.png")),
            "preview_dir": str(qa_dir / "previews"),
            "manual_review": manual_review,
            "visual_review": visual_review,
            "acceptance": str(qa_dir / "acceptance.json")
        },
        "actions": [
            {
                "id": action.get("id"),
                "expected_frames": action.get("expected_frames"),
                "actual_frames": action.get("actual_frames"),
                "transparent_strip": action.get("transparent_strip", str(run_dir / "final" / f"{action.get('id')}.png")),
                "frames_dir": str(run_dir / "frames" / str(action.get("id"))),
                "preview": str(qa_dir / "previews" / f"{action.get('id')}.gif"),
                "alignment": action.get("alignment") or {},
                "errors": action.get("errors", []),
                "warnings": action.get("warnings", [])
            }
            for action in validations.get("actions", [])
        ]
    }
    write_json(qa_dir / "run-summary.json", summary)
    return summary


def write_output_manifest(run_dir, manifest, validations):
    run_dir = Path(run_dir)
    final_dir = run_dir / "final"
    canonical_ok = not (validations.get("canonical_base") or {}).get("errors")
    spritesheet_requested = bool(validations.get("spritesheet_requested", True))
    playable_actions = [
        action for action in validations.get("actions", [])
        if canonical_ok and action.get("actual_frames") and not action.get("errors")
    ]
    output = {
        "pet_name": manifest.get("pet_name", ""),
        "cell_width": manifest.get("cell_width", CELL_WIDTH),
        "cell_height": manifest.get("cell_height", CELL_HEIGHT),
        "chroma_key": manifest.get("chroma_key", DEFAULT_CHROMA),
        "style_notes": manifest.get("style_notes", ""),
        "reference": str(run_dir / "reference.png"),
        "canonical_base": str(final_dir / "canonical-base.png"),
        "provenance": validations.get("provenance", str(run_dir / "qa" / "provenance.json")),
        "spritesheet": validations.get("spritesheet") or {},
        "actions": [
            {
                "id": action.get("id"),
                "expected_frames": action.get("expected_frames"),
                "actual_frames": action.get("actual_frames"),
                "row_index": index if spritesheet_requested and validations.get("spritesheet") else None,
                "transparent_strip": action.get("transparent_strip", str(final_dir / f"{action.get('id')}.png")),
                "frames": [
                    str(run_dir / "frames" / str(action.get("id")) / f"{frame.get('index', frame_index):02d}.png")
                    for frame_index, frame in enumerate(action.get("frames", []))
                ],
                "preview": str(run_dir / "qa" / "previews" / f"{action.get('id')}.gif"),
                "motion": action.get("motion") or {},
                "alignment": action.get("alignment") or {}
            }
            for index, action in enumerate(playable_actions)
        ]
    }
    write_json(final_dir / "output-manifest.json", output)
    return output


def write_provenance(run_dir, manifest, status, validations):
    run_dir = Path(run_dir)
    qa_dir = run_dir / "qa"
    jobs = {job.get("id"): job for job in status.get("jobs", [])}
    provenance = {
        "reference": {
            "path": str(run_dir / "reference.png"),
            "used_for_prompting": True,
            "identity_lock": "reference.png plus decoded/canonical-base.png"
        },
        "canonical_base": {
            "prompt_path": str(run_dir / "prompts" / "canonical-base.md"),
            "decoded_path": str(run_dir / "decoded" / "canonical-base.png"),
            "final_path": str(run_dir / "final" / "canonical-base.png"),
            "source_path": str(jobs.get("canonical-base", {}).get("source_path") or ""),
            "status": str(jobs.get("canonical-base", {}).get("status") or ""),
            "errors": (validations.get("canonical_base") or {}).get("errors", []),
            "warnings": (validations.get("canonical_base") or {}).get("warnings", [])
        },
        "actions": []
    }
    for action in validations.get("actions", []):
        action_id = action.get("id")
        job = jobs.get(action_id, {})
        provenance["actions"].append({
            "id": action_id,
            "prompt_path": str(run_dir / "prompts" / f"{action_id}.md"),
            "decoded_path": str(run_dir / "decoded" / f"{action_id}.png"),
            "source_path": str(job.get("source_path") or ""),
            "status": str(job.get("status") or ""),
            "transparent_strip": action.get("transparent_strip", ""),
            "frames_dir": str(run_dir / "frames" / str(action_id)),
            "preview": str(qa_dir / "previews" / f"{action_id}.gif"),
            "errors": action.get("errors", []),
            "warnings": action.get("warnings", []),
            "motion": action.get("motion") or {},
            "alignment": action.get("alignment") or {}
        })
    write_json(qa_dir / "provenance.json", provenance)
    validations["provenance"] = str(qa_dir / "provenance.json")
    return provenance


def default_visual_checklist(manifest, status_value, failed_jobs):
    accepted = status_value == "accepted"
    failed_set = set(failed_jobs)
    return {
        "canonical_base": {
            "full_body_visible": accepted,
            "identity_matches_reference": accepted,
            "flat_chroma_background": accepted,
            "readable_at_cell_size": accepted
        },
        "actions": [
            {
                "id": sanitize_action_id(action["id"]),
                "identity_stable": accepted and sanitize_action_id(action["id"]) not in failed_set,
                "action_matches_description": accepted and sanitize_action_id(action["id"]) not in failed_set,
                "avoid_list_respected": accepted and sanitize_action_id(action["id"]) not in failed_set,
                "full_character_visible": accepted and sanitize_action_id(action["id"]) not in failed_set,
                "no_banned_elements": accepted and sanitize_action_id(action["id"]) not in failed_set,
                "loop_readable": accepted and sanitize_action_id(action["id"]) not in failed_set,
                "description": action.get("description", ""),
                "avoid": action.get("avoid", "") or "none"
            }
            for action in manifest.get("actions", [])
        ]
    }


def load_visual_checklist(raw_value, manifest, status_value, failed_jobs):
    if not raw_value:
        return default_visual_checklist(manifest, status_value, failed_jobs)
    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError as exc:
        raise ValueError(f"invalid checklist json: {exc}") from exc
    if not isinstance(parsed, dict):
        raise ValueError("checklist json must be an object")
    return parsed


def process_run(args):
    run_dir = Path(args.run_dir)
    manifest = load_manifest(run_dir)
    status = load_generation_status(run_dir, manifest)
    chroma = parse_hex_color(manifest.get("chroma_key", DEFAULT_CHROMA))
    cell_width = int(manifest.get("cell_width", CELL_WIDTH))
    cell_height = int(manifest.get("cell_height", CELL_HEIGHT))
    decoded_dir = run_dir / "decoded"
    frames_root = run_dir / "frames"
    final_dir = run_dir / "final"
    qa_dir = run_dir / "qa"
    preview_dir = qa_dir / "previews"
    for name in (frames_root, final_dir, qa_dir, preview_dir):
        ensure_dir(name)

    validations = {
        "ok": True,
        "spritesheet_requested": not args.skip_spritesheet,
        "cell_width": cell_width,
        "cell_height": cell_height,
        "chroma_key": manifest.get("chroma_key", DEFAULT_CHROMA),
        "canonical_base": {
            "path": str(decoded_dir / "canonical-base.png"),
            "exists": (decoded_dir / "canonical-base.png").exists(),
            "errors": [],
            "warnings": []
        },
        "actions": []
    }
    canonical_path = decoded_dir / "canonical-base.png"
    if not canonical_path.exists():
        validations["ok"] = False
        validations["canonical_base"]["errors"].append("missing decoded/canonical-base.png")
        job = find_job(status, "canonical-base")
        if job:
            job["status"] = "needs-repair"
            job["qa_note"] = "missing decoded/canonical-base.png"
    else:
        canonical_source = Image.open(canonical_path).convert("RGBA")
        canonical = normalize_single_frame(canonical_source, cell_width, cell_height, chroma, args.tolerance)
        stats = alpha_stats(canonical)
        validations["canonical_base"]["source_size"] = {"width": canonical_source.width, "height": canonical_source.height}
        validations["canonical_base"]["final_size"] = {"width": canonical.width, "height": canonical.height}
        validations["canonical_base"].update(alpha_bbox_metrics(canonical))
        validations["canonical_base"].update(stats)
        if stats["opaque_pixels"] == 0:
            validations["ok"] = False
            validations["canonical_base"]["errors"].append("canonical-base is empty after chroma key removal")
        if stats["transparent_pixels"] == 0:
            validations["ok"] = False
            validations["canonical_base"]["errors"].append("canonical-base has no transparent background")
        if frame_touches_edge(canonical):
            validations["ok"] = False
            validations["canonical_base"]["errors"].append("canonical-base content touches cell edge")
        canonical.save(final_dir / "canonical-base.png")
        job = find_job(status, "canonical-base")
        if job:
            job["status"] = "processed" if not validations["canonical_base"]["errors"] else "needs-repair"
            job["source_path"] = job.get("source_path") or str(canonical_path)
            job["qa_note"] = "; ".join(validations["canonical_base"]["errors"] + validations["canonical_base"]["warnings"])
    qa_rows = []
    playable_rows = []
    max_frames = max([int(action["frame_count"]) for action in manifest.get("actions", [])] or [1])

    for action in manifest.get("actions", []):
        action_id = sanitize_action_id(action["id"])
        frame_count = int(action["frame_count"])
        decoded_path = decoded_dir / f"{action_id}.png"
        action_result = {
            "id": action_id,
            "expected_frames": frame_count,
            "decoded_path": str(decoded_path),
            "errors": [],
            "warnings": []
        }
        if not decoded_path.exists():
            action_result["errors"].append("missing decoded action strip")
            validations["ok"] = False
            validations["actions"].append(action_result)
            job = find_job(status, action_id)
            if job:
                job["status"] = "needs-repair"
                job["qa_note"] = "missing decoded action strip"
            continue

        strip = Image.open(decoded_path).convert("RGBA")
        expected_size = (cell_width * frame_count, cell_height)
        action_result["source_size"] = {"width": strip.width, "height": strip.height}
        action_result["expected_source_size"] = {"width": expected_size[0], "height": expected_size[1]}
        if strip.size != expected_size:
            message = f"decoded strip is {strip.width}x{strip.height}; expected {expected_size[0]}x{expected_size[1]}"
            if strip_size_compatible(strip.size, expected_size):
                action_result["warnings"].append(f"{message}; normalized frames to {cell_width}x{cell_height}")
            else:
                action_result["errors"].append(message)
        frames = split_strip(strip, frame_count, cell_width, cell_height, chroma, args.tolerance)
        action_frames_dir = frames_root / action_id
        ensure_dir(action_frames_dir)
        frame_results = []
        for index, frame in enumerate(frames):
            frame.save(action_frames_dir / f"{index:02d}.png")
            frame_result = {"index": index, **alpha_stats(frame), **alpha_bbox_metrics(frame)}
            if not frame_nonempty(frame):
                action_result["errors"].append(f"frame {index:02d} is empty")
            if frame_touches_edge(frame):
                action_result["errors"].append(f"frame {index:02d} content touches cell edge")
            if frame_result["transparent_pixels"] == 0:
                action_result["errors"].append(f"frame {index:02d} has no transparent background")
            frame_results.append(frame_result)

        action_result["actual_frames"] = len(frames)
        action_result["frames"] = frame_results
        action_result["transparent_strip"] = str(final_dir / f"{action_id}.png")
        action_result["motion"] = motion_metrics(frames)
        action_result["alignment"] = alignment_metrics(frames)
        if frame_count > 1 and action_result["motion"]["near_duplicate_pairs"] >= frame_count - 1:
            action_result["warnings"].append("motion appears nearly static across generated frames")
        alignment = action_result["alignment"]
        if alignment["center_x_range"] > 60:
            action_result["errors"].append("character horizontal center drifts too much across frames")
        elif alignment["center_x_range"] > 36:
            action_result["warnings"].append("character horizontal center varies; inspect fixed-cell centering")
        if alignment["max_size_delta_ratio"] > 0.4:
            action_result["errors"].append("character scale changes too much across frames")
        elif alignment["max_size_delta_ratio"] > 0.22:
            action_result["warnings"].append("character size varies; inspect scale consistency")
        if alignment["max_adjacent_center_shift"] > 80:
            action_result["errors"].append("adjacent frames jump too far; regenerate smoother motion")
        elif alignment["jump_pairs"]:
            action_result["warnings"].append("possible adjacent-frame jump detected; inspect GIF preview")
        if action_result["errors"]:
            validations["ok"] = False
        transparent_strip = compose_strip(frames)
        transparent_strip.save(final_dir / f"{action_id}.png")
        qa_rows.append((action_id, frames))
        if not validations["canonical_base"]["errors"] and not action_result["errors"]:
            playable_rows.append((action_id, frames))
        job = find_job(status, action_id)
        if job:
            job["status"] = "needs-repair" if action_result["errors"] else "processed"
            job["source_path"] = job.get("source_path") or str(decoded_path)
            job["qa_note"] = "; ".join(action_result["errors"] + action_result["warnings"])
        validations["actions"].append(action_result)

        frames[0].save(
            preview_dir / f"{action_id}.gif",
            save_all=True,
            append_images=frames[1:],
            duration=args.gif_duration,
            loop=0,
            disposal=2
        )

    if playable_rows and not args.skip_spritesheet:
        spritesheet = Image.new("RGBA", (max_frames * cell_width, len(playable_rows) * cell_height), (0, 0, 0, 0))
        for row_index, (_action_id, frames) in enumerate(playable_rows):
            for frame_index, frame in enumerate(frames):
                spritesheet.alpha_composite(frame, (frame_index * cell_width, row_index * cell_height))
        spritesheet.save(final_dir / "spritesheet.png")
        spritesheet.save(final_dir / "spritesheet.webp", lossless=True)
        validations["spritesheet"] = {
            "png": str(final_dir / "spritesheet.png"),
            "webp": str(final_dir / "spritesheet.webp"),
            "width": spritesheet.width,
            "height": spritesheet.height,
            "rows": len(playable_rows),
            "columns": max_frames
        }
    if qa_rows:
        contact_sheet = make_contact_sheet(qa_rows, max_frames, cell_width, cell_height)
        contact_sheet.save(qa_dir / "contact-sheet.png")
        validations["contact_sheet"] = str(qa_dir / "contact-sheet.png")

    write_provenance(run_dir, manifest, status, validations)
    write_output_manifest(run_dir, manifest, validations)
    review_path = write_manual_review(run_dir, manifest, validations)
    validations["manual_review"] = {
        "status": "required",
        "path": str(review_path),
        "reason": "identity consistency, action semantics, avoid-list compliance, and text/scene detection require visual review"
    }
    write_json(qa_dir / "validation.json", validations)
    write_run_summary(run_dir, manifest, validations)
    write_json(status_path(run_dir), status)
    return validations


def review_run(args):
    run_dir = Path(args.run_dir)
    manifest = load_manifest(run_dir)
    validation_path = run_dir / "qa" / "validation.json"
    if not validation_path.exists():
        raise FileNotFoundError(f"missing validation file: {validation_path}")

    status_value = args.status.strip().lower()
    if status_value not in {"accepted", "failed"}:
        raise ValueError("review status must be accepted or failed")

    validation = json.loads(validation_path.read_text(encoding="utf-8"))
    reviewed_at = args.updated_at or datetime.utcnow().isoformat() + "Z"
    failed_jobs = [sanitize_action_id(item) for item in (args.failed_job or []) if sanitize_action_id(item)]
    note = args.note.strip()
    if status_value == "accepted" and not validation.get("ok"):
        raise ValueError("cannot accept visual QA while automated validation has errors")
    if status_value == "accepted" and failed_jobs:
        raise ValueError("accepted visual QA cannot include failed jobs")
    if status_value == "failed" and not failed_jobs:
        raise ValueError("failed visual QA must include at least one failed job")
    checklist = load_visual_checklist(args.checklist_json, manifest, status_value, failed_jobs)
    review_record = {
        "status": status_value,
        "reviewed_at": reviewed_at,
        "note": note,
        "failed_jobs": failed_jobs,
        "checklist_path": str(run_dir / "qa" / "manual-review.md"),
        "contact_sheet": str(run_dir / "qa" / "contact-sheet.png"),
        "preview_dir": str(run_dir / "qa" / "previews"),
        "checklist": checklist
    }
    validation["manual_review"] = {
        "status": status_value,
        "path": str(run_dir / "qa" / "manual-review.md"),
        "reason": note or ("manual visual QA accepted" if status_value == "accepted" else "manual visual QA failed"),
        "reviewed_at": reviewed_at,
        "failed_jobs": failed_jobs,
        "checklist": checklist
    }
    validation["visual_review"] = review_record
    if status_value == "failed":
        validation["ok"] = False

    status = load_generation_status(run_dir, manifest)
    for job_id in failed_jobs:
        job = find_job(status, job_id)
        if job:
            job["status"] = "needs-repair"
            job["qa_note"] = note or "manual visual QA failed"
            job["updated_at"] = reviewed_at

    write_json(validation_path, validation)
    write_json(run_dir / "qa" / "acceptance.json", review_record)
    write_run_summary(run_dir, manifest, validation, review_record)
    write_json(status_path(run_dir), status)
    return review_record


def main():
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    init_parser = subparsers.add_parser("init")
    init_parser.add_argument("--reference-image", required=True)
    init_parser.add_argument("--pet-name", required=True)
    init_parser.add_argument("--style-notes", default="")
    init_parser.add_argument("--actions", required=True)
    init_parser.add_argument("--output-dir", required=True)
    init_parser.add_argument("--chroma-key", default=DEFAULT_CHROMA)

    process_parser = subparsers.add_parser("process")
    process_parser.add_argument("--run-dir", required=True)
    process_parser.add_argument("--tolerance", type=int, default=80)
    process_parser.add_argument("--gif-duration", type=int, default=80)
    process_parser.add_argument("--skip-spritesheet", action="store_true")

    mark_parser = subparsers.add_parser("mark")
    mark_parser.add_argument("--run-dir", required=True)
    mark_parser.add_argument("--job-id", required=True)
    mark_parser.add_argument("--status", required=True)
    mark_parser.add_argument("--source-path", default=None)
    mark_parser.add_argument("--output-path", default=None)
    mark_parser.add_argument("--qa-note", default=None)
    mark_parser.add_argument("--updated-at", default="")

    import_parser = subparsers.add_parser("import")
    import_parser.add_argument("--run-dir", required=True)
    import_parser.add_argument("--job-id", required=True)
    import_parser.add_argument("--source-path", required=True)
    import_parser.add_argument("--status", default="imported")
    import_parser.add_argument("--qa-note", default="")
    import_parser.add_argument("--updated-at", default="")

    repair_parser = subparsers.add_parser("repair")
    repair_parser.add_argument("--run-dir", required=True)
    repair_parser.add_argument("--job-id", required=True)
    repair_parser.add_argument("--reason", default="")
    repair_parser.add_argument("--updated-at", default="")

    review_parser = subparsers.add_parser("review")
    review_parser.add_argument("--run-dir", required=True)
    review_parser.add_argument("--status", required=True, choices=["accepted", "failed"])
    review_parser.add_argument("--note", default="")
    review_parser.add_argument("--failed-job", action="append", default=[])
    review_parser.add_argument("--checklist-json", default="")
    review_parser.add_argument("--updated-at", default="")

    args = parser.parse_args()
    if args.command == "init":
        result = init_run(args)
    elif args.command == "process":
        result = process_run(args)
    elif args.command == "import":
        result = import_job_image(args)
    elif args.command == "repair":
        result = repair_job(args)
    elif args.command == "review":
        result = review_run(args)
    else:
        result = mark_job(args)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
