#!/usr/bin/env python3
"""Download one Objaverse GLB by Sketchfab UID from the public mirror."""

from __future__ import annotations

import argparse
import concurrent.futures
import pathlib
import urllib.error
import urllib.request


BASE_URL = "https://huggingface.co/datasets/allenai/objaverse/resolve/main/glbs"


def probe(index: int, uid: str) -> str | None:
    url = f"{BASE_URL}/000-{index:03d}/{uid}.glb"
    request = urllib.request.Request(
        url,
        headers={"Range": "bytes=0-3", "User-Agent": "wx-earth-source-model-fetch/1.0"},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            magic = response.read(4)
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError):
        return None
    return url if magic == b"glTF" else None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("uid")
    parser.add_argument("output", type=pathlib.Path)
    parser.add_argument("--max-chunk", type=int, default=300)
    args = parser.parse_args()

    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as executor:
        futures = [
            executor.submit(probe, index, args.uid)
            for index in range(args.max_chunk + 1)
        ]
        matches = [future.result() for future in concurrent.futures.as_completed(futures)]

    urls = [url for url in matches if url]
    if len(urls) != 1:
        raise SystemExit(f"expected one mirror file, found {len(urls)}: {urls}")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(
        urls[0],
        headers={"User-Agent": "wx-earth-source-model-fetch/1.0"},
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        args.output.write_bytes(response.read())

    if args.output.read_bytes()[:4] != b"glTF":
        raise SystemExit("downloaded file is not a GLB")
    print(urls[0])
    print(args.output)
    print(args.output.stat().st_size)


if __name__ == "__main__":
    main()
