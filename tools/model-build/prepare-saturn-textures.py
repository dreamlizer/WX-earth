"""Prepare the preview subpackage from the retained, attributed source maps."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[2]
source = root / "source-models/saturn-preview"
output = root / "miniprogram/saturn-assets"
output.mkdir(parents=True, exist_ok=True)
surface = Image.open(source / "8k_saturn.jpg").convert("RGB")
surface.save(output / "saturn.jpg", quality=91, optimize=True)
ring = Image.open(source / "8k_saturn_ring_alpha.png").convert("RGBA")
middle = ring.height // 2
ring.crop((0, middle, ring.width, middle + 1)).resize(
    (2048, 1), Image.Resampling.LANCZOS
).save(output / "saturn-ring.png")
for filename in ("saturn.jpg", "saturn-ring.png"):
    file = output / filename
    print(filename, Image.open(file).size, file.stat().st_size, "bytes")
