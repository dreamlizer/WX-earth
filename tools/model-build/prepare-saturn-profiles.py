"""Bake Bjoern Jonsson's five ring profiles into a small WebGL 1 atlas.

RGB encodes sqrt(effective scattering strength / 8); alpha encodes tau / 6.
The inversion uses a representative elevation of 0.35, not a fitted calibration
of the original Voyager exposures. This is a visual adaptation of the slab
model in I,Voyager, not a calibrated scientific photometry implementation.
"""
from pathlib import Path
import math
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "source-models/saturn-preview/bjoern-rings"
OUTPUT = ROOT / "miniprogram/saturn-assets/ring-profiles.png"
values = {}
for name in ("backscattered", "forwardscattered", "unlitside", "transparency", "sat_rings_color"):
    rows = [tuple(map(float, line.split())) for line in (SOURCE / (name + ".txt")).read_text().splitlines() if line.strip()]
    assert len(rows) == 13177, (name, len(rows))
    assert all(0 <= x <= 1 for row in rows for x in row), name
    values[name] = rows

# Four repeated rows per band keep bilinear filtering away from adjacent profiles.
# PNG rows are flipped by Three's TextureLoader: back at v=.875, forward .625,
# unlit .375, spare .125. Resize each band separately to avoid vertical mixing.
atlas = Image.new("RGBA", (4096, 16))
for band, name in enumerate(("backscattered", "forwardscattered", "unlitside")):
    strip = Image.new("RGBA", (13177, 1))
    pixels = []
    for i, row in enumerate(values[name]):
        tau = min(6.0, -math.log(max(values["transparency"][i][0], .0025)))
        geometry = .5 * (1 - math.exp(-2 * tau / .35)) if band < 2 else tau / .35 * math.exp(-tau / .35)
        strength = row[0] / max(geometry, .04) if tau > .0001 else 0
        color = values["sat_rings_color"][i] if band < 2 else (1.0, .97075, .952)
        rgb = tuple(round(255 * math.sqrt(min(8, strength * c ** 2.2) / 8)) for c in color)
        pixels.append((*rgb, round(255 * tau / 6)))
    strip.putdata(pixels)
    # Alpha stores optical depth, not coverage; never premultiply the encoded RGB.
    strip = Image.merge("RGBA", [channel.resize((4096, 1), Image.Resampling.LANCZOS) for channel in strip.split()])
    for y in range(band * 4, band * 4 + 4):
        atlas.paste(strip, (0, y))
atlas.save(OUTPUT, optimize=True)
print(OUTPUT.relative_to(ROOT), atlas.size, OUTPUT.stat().st_size, "bytes")
