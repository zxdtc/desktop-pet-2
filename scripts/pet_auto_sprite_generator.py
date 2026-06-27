import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance


DEFAULT_CHROMA = "#0000FF"


def parse_hex_color(value):
    value = str(value or DEFAULT_CHROMA).strip().lstrip("#")
    if len(value) != 6:
        raise ValueError(f"Invalid chroma key: {value}")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def write_json(path, payload):
    Path(path).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def is_chroma_pixel(pixel, chroma, tolerance):
    r, g, b = pixel[:3]
    return math.sqrt((r - chroma[0]) ** 2 + (g - chroma[1]) ** 2 + (b - chroma[2]) ** 2) <= tolerance


def remove_chroma(image, chroma, tolerance):
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            if is_chroma_pixel(pixels[x, y], chroma, tolerance):
                pixels[x, y] = (0, 0, 0, 0)
    return rgba


def remove_edge_background(image, tolerance):
    rgba = image.convert("RGBA")
    if rgba.getchannel("A").getextrema()[0] < 255:
        return rgba
    corner_colors = [
        rgba.getpixel((0, 0)),
        rgba.getpixel((rgba.width - 1, 0)),
        rgba.getpixel((0, rgba.height - 1)),
        rgba.getpixel((rgba.width - 1, rgba.height - 1))
    ]
    background = max(corner_colors, key=corner_colors.count)
    pixels = rgba.load()
    visited = set()
    stack = []
    for x in range(rgba.width):
        stack.append((x, 0))
        stack.append((x, rgba.height - 1))
    for y in range(rgba.height):
        stack.append((0, y))
        stack.append((rgba.width - 1, y))

    while stack:
        x, y = stack.pop()
        if (x, y) in visited or x < 0 or y < 0 or x >= rgba.width or y >= rgba.height:
            continue
        visited.add((x, y))
        if not is_chroma_pixel(pixels[x, y], background, tolerance):
            continue
        pixels[x, y] = (0, 0, 0, 0)
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return rgba


def fit_subject(image, cell_width, cell_height, padding=24):
    subject = image.convert("RGBA")
    bbox = subject.getchannel("A").getbbox()
    if bbox:
        subject = subject.crop(bbox)
    max_w = max(1, cell_width - padding * 2)
    max_h = max(1, cell_height - padding * 2)
    subject.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
    return subject


def paste_center(cell, subject, dx=0, dy=0, scale=1.0, squash=1.0, brightness=1.0):
    if brightness != 1.0:
        subject = ImageEnhance.Brightness(subject).enhance(brightness)
    width = max(1, int(subject.width * scale))
    height = max(1, int(subject.height * scale * squash))
    sprite = subject.resize((width, height), Image.Resampling.LANCZOS)
    x = (cell.width - sprite.width) // 2 + dx
    y = (cell.height - sprite.height) // 2 + dy
    cell.alpha_composite(sprite, (x, y))


def transform_for_action(action_id, index, count):
    phase = 0 if count <= 1 else index / (count - 1)
    wave = math.sin(phase * math.tau)
    bounce = math.sin(phase * math.pi)
    action = action_id.lower()
    if action in ("idle", "working", "waiting", "focus-working"):
        return {"dy": round(-2 * wave), "scale": 1 + 0.015 * wave}
    if action in ("happy", "celebrate", "focus-complete"):
        return {"dy": round(-6 * bounce), "dx": round(3 * wave), "scale": 1 + 0.025 * bounce, "brightness": 1.05}
    if action in ("sad", "failed"):
        return {"dy": round(7 * bounce), "scale": 0.98, "squash": 1 - 0.04 * bounce, "brightness": 0.9}
    if action == "sleep":
        return {"dy": 12, "scale": 1.02, "squash": 0.82 + 0.02 * wave, "brightness": 0.92}
    if action in ("remind", "attention", "pop-out"):
        return {"dx": round(7 * wave), "dy": round(-3 * bounce), "scale": 1 + 0.03 * bounce}
    if action in ("peek-left", "peek-right"):
        direction = -1 if action.endswith("left") else 1
        return {"dx": direction * round(18 + 8 * wave), "dy": round(-2 * bounce), "scale": 0.98}
    if action in ("rainy", "hot", "cold", "night"):
        return {"dy": round(2 * wave), "scale": 1, "brightness": 0.95 if action == "night" else 1}
    if action in ("push-window", "drag-note", "follow-mouse"):
        return {"dx": round(10 * wave), "dy": round(-4 * bounce), "scale": 1.02}
    return {"dy": round(-4 * bounce), "dx": round(2 * wave), "scale": 1 + 0.02 * bounce}


def make_strip(subject, action, cell_width, cell_height, chroma):
    frame_count = int(action.get("frame_count", 6))
    frames = []
    for index in range(frame_count):
        cell = Image.new("RGBA", (cell_width, cell_height), (*chroma, 255))
        transform = transform_for_action(str(action.get("id", "")), index, frame_count)
        paste_center(
            cell,
            subject,
            dx=transform.get("dx", 0),
            dy=transform.get("dy", 0),
            scale=transform.get("scale", 1.0),
            squash=transform.get("squash", 1.0),
            brightness=transform.get("brightness", 1.0)
        )
        frames.append(cell)
    strip = Image.new("RGBA", (cell_width * frame_count, cell_height), (*chroma, 255))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * cell_width, 0))
    return strip


def update_status(run_dir, action_ids, note):
    status_path = run_dir / "generation-status.json"
    status = load_json(status_path)
    for job in status.get("jobs", []):
        if job.get("id") == "canonical-base" or job.get("id") in action_ids:
            job["status"] = "generated"
            job["source_path"] = job.get("output_path", "")
            job["qa_note"] = note
    write_json(status_path, status)
    return status


def generate(args):
    run_dir = Path(args.run_dir)
    manifest = load_json(run_dir / "manifest.json")
    chroma = parse_hex_color(manifest.get("chroma_key", DEFAULT_CHROMA))
    cell_width = int(manifest.get("cell_width", 192))
    cell_height = int(manifest.get("cell_height", 208))
    decoded_dir = run_dir / "decoded"
    decoded_dir.mkdir(parents=True, exist_ok=True)

    source_path = run_dir / "reference.png"
    if not source_path.exists():
        raise FileNotFoundError(source_path)
    source_image = Image.open(source_path)
    subject = fit_subject(remove_chroma(source_image, chroma, args.tolerance), cell_width, cell_height)
    if subject.getchannel("A").getbbox() == (0, 0, subject.width, subject.height):
        subject = fit_subject(remove_edge_background(source_image, args.background_tolerance), cell_width, cell_height)
    if not subject.getchannel("A").getbbox():
        subject = fit_subject(source_image.convert("RGBA"), cell_width, cell_height)

    canonical = Image.new("RGBA", (cell_width, cell_height), (*chroma, 255))
    paste_center(canonical, subject)
    canonical.save(decoded_dir / "canonical-base.png")

    action_ids = []
    for action in manifest.get("actions", []):
        action_id = str(action.get("id", "")).strip()
        if not action_id:
            continue
        make_strip(subject, action, cell_width, cell_height, chroma).save(decoded_dir / f"{action_id}.png")
        action_ids.append(action_id)

    status = update_status(run_dir, action_ids, "auto-generated from one reference image by local motion generator")
    result = {
        "ok": True,
        "mode": "local-motion",
        "run_dir": str(run_dir),
        "canonical_base": str(decoded_dir / "canonical-base.png"),
        "actions": [{"id": action_id, "decoded_path": str(decoded_dir / f"{action_id}.png")} for action_id in action_ids],
        "generation_status": str(run_dir / "generation-status.json"),
        "jobs": status.get("jobs", [])
    }
    write_json(run_dir / "auto-generation.json", result)
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-dir", required=True)
    parser.add_argument("--tolerance", type=int, default=80)
    parser.add_argument("--background-tolerance", type=int, default=12)
    args = parser.parse_args()
    print(json.dumps(generate(args), ensure_ascii=False))


if __name__ == "__main__":
    main()
