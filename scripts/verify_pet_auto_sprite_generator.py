import json
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
PIPELINE = ROOT / "scripts" / "pet_action_pipeline.py"
AUTO = ROOT / "scripts" / "pet_auto_sprite_generator.py"
RUN_ROOT = ROOT / "tmp" / "verify-pet-auto-sprite"


def run_command(args):
    completed = subprocess.run(args, cwd=ROOT, text=True, capture_output=True, check=True)
    return json.loads(completed.stdout)


def make_reference(path):
    image = Image.new("RGBA", (320, 320), (0, 255, 0, 255))
    draw = ImageDraw.Draw(image)
    draw.ellipse((95, 55, 225, 185), fill=(245, 245, 245, 255), outline=(30, 30, 30, 255), width=4)
    draw.ellipse((130, 100, 145, 115), fill=(20, 20, 20, 255))
    draw.ellipse((175, 100, 190, 115), fill=(20, 20, 20, 255))
    draw.arc((135, 115, 185, 155), 20, 160, fill=(20, 20, 20, 255), width=3)
    draw.rectangle((130, 180, 190, 265), fill=(245, 245, 245, 255), outline=(30, 30, 30, 255), width=4)
    image.save(path)


def assert_path(path):
    if not Path(path).exists():
        raise AssertionError(f"missing expected path: {path}")


def main():
    if RUN_ROOT.exists():
        shutil.rmtree(RUN_ROOT)
    RUN_ROOT.mkdir(parents=True)
    reference = RUN_ROOT / "reference.png"
    actions = RUN_ROOT / "actions.json"
    run_dir = RUN_ROOT / "run"
    make_reference(reference)
    actions.write_text(json.dumps([
        {
            "id": "idle",
            "frame_count": 6,
            "description": "calm breathing loop",
            "avoid": "text, symbols, props"
        },
        {
            "id": "happy",
            "frame_count": 6,
            "description": "happy bounce in place",
            "avoid": "text, symbols, props"
        }
    ]), encoding="utf-8")

    run_command([
        sys.executable, str(PIPELINE), "init",
        "--reference-image", str(reference),
        "--pet-name", "auto-test",
        "--actions", str(actions),
        "--output-dir", str(run_dir),
        "--chroma-key", "#00FF00"
    ])
    generated = run_command([sys.executable, str(AUTO), "--run-dir", str(run_dir)])
    if generated["mode"] != "local-motion" or len(generated["actions"]) != 2:
        raise AssertionError(f"unexpected auto result: {generated}")

    processed = run_command([sys.executable, str(PIPELINE), "process", "--run-dir", str(run_dir)])
    if not processed["ok"]:
        raise AssertionError(f"auto generated run should process cleanly: {json.dumps(processed, ensure_ascii=False, indent=2)}")
    assert_path(run_dir / "decoded" / "canonical-base.png")
    assert_path(run_dir / "decoded" / "happy.png")
    assert_path(run_dir / "qa" / "previews" / "happy.gif")
    assert_path(run_dir / "final" / "spritesheet.webp")
    print("pet auto sprite generator ok")


if __name__ == "__main__":
    main()
