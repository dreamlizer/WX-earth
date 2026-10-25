"""Build the accepted lunar tail's mobile assets without changing source trials."""
from pathlib import Path
import hashlib
import json
import shutil
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
TRIAL = ROOT / 'source-models/moon-terrain-trial'
OUT = TRIAL / 'miniapp-assets-v1'
OUT.mkdir(exist_ok=True)
items = []

def add(name, source, quality=None, size=None, gray=False, role='linear'):
    src = TRIAL / source
    dst = OUT / name
    if quality is None:
        shutil.copyfile(src, dst)
    else:
        with Image.open(src) as image:
            image = image.convert('RGB' if role == 'srgb' or 'normal' in name else 'L')
            if gray:
                rgb = np.asarray(image.convert('RGB'), dtype=np.float32) / 255
                linear = np.where(rgb <= .04045, rgb / 12.92, ((rgb + .055) / 1.055) ** 2.4).mean(axis=2)
                encoded = np.where(linear <= .0031308, linear * 12.92, 1.055 * linear ** (1 / 2.4) - .055)
                image = Image.fromarray(np.uint8(np.clip(encoded * 255 + .5, 0, 255)))
            if size:
                image = image.resize(size, Image.Resampling.LANCZOS)
            image.save(dst, quality=quality, subsampling=0, optimize=True)
    row = dict(name=name, source=str(src.relative_to(ROOT)), sourceSHA256=hashlib.sha256(src.read_bytes()).hexdigest(), bytes=dst.stat().st_size, sha256=hashlib.sha256(dst.read_bytes()).hexdigest(), md5=hashlib.md5(dst.read_bytes()).hexdigest(), role=role, quality=quality)
    if dst.suffix == '.jpg':
        with Image.open(dst) as image:
            row.update(width=image.width, height=image.height)
    items.append(row)

add('terrain.glb', 'preview/assets/terrain.glb')
add('base-color.jpg', 'preview/assets/albedo.jpg', 92, role='srgb')
add('base-normal.jpg', 'airborne-comparison/assets/normal-object.jpg', 90)
add('base-rough.jpg', 'preview/assets/roughness.jpg', 92)
add('base-ao.jpg', 'preview/assets/ao.jpg', 95)
add('near-color.jpg', 'ending-detail-frame/assets/albedo.jpg', 97, role='srgb')
add('near-normal.jpg', 'ending-detail-frame/assets/normal-object.jpg', 98)
add('near-rough.jpg', 'ending-detail-frame/assets/roughness.jpg', 97)
add('near-ao.jpg', 'ending-detail-frame/assets/ao.jpg', 97)
add('grain.jpg', 'ending-detail-frame/assets/regolith-detail-generated.png', 94, (2048, 2048), True, 'srgb')
version = hashlib.sha256(''.join(row['sha256'] for row in items).encode()).hexdigest()[:16]
manifest = dict(version=version, files=items, totalBytes=sum(row['bytes'] for row in items), sourceBytes=13065006, terrainUnchanged=True, nearCropUnchanged=True)
(OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(dict(version=version, bytes=manifest['totalBytes'], MiB=manifest['totalBytes']/1048576), indent=2))
