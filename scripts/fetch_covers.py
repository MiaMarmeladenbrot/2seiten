"""
Downloads book covers from the MVB cover service via the DNB portal.

Free, no API key. Reads the ISBNs collected in data/book_details.json, saves the
images to web/public/covers/<isbn>.jpg and writes web/src/data/covers.json,
which maps "Title|Author" to the file name so the app knows which books have a
cover and which fall back to the generated design.

Books often have several ISBNs (foreign editions, audio books, e-books). The
candidates are already ordered with German print editions first, so the first
one that returns an image usually is the right edition.

Usage:
    .venv/bin/python scripts/fetch_covers.py           # only missing ones
    .venv/bin/python scripts/fetch_covers.py --force   # download everything again
"""

import argparse
import io
import json
import struct
import sys
import time
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DETAILS_FILE = ROOT / "data" / "book_details.json"
COVER_DIR = ROOT / "web" / "public" / "covers"
MANIFEST_FILE = ROOT / "web" / "src" / "data" / "covers.json"

COVER_URL = "https://portal.dnb.de/opac/mvb/cover?isbn={isbn}"
USER_AGENT = "2seiten-fanproject/0.1 (private hobby project; podcast book index)"

REQUEST_PAUSE = 0.3
MAX_CANDIDATES = 4
MIN_BYTES = 2000
MIN_WIDTH = 200

MAX_SENSIBLE_RATIO = 0.80
CORNER_BOX = 12
BRIGHT_CORNER = 240


def http_get(url, timeout=25):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read(), response.headers.get("Content-Type", ""), response.status


def jpeg_size(data):
    if data[:2] != b"\xff\xd8":
        return None
    offset = 2
    while offset < len(data) - 9:
        if data[offset] != 0xFF:
            offset += 1
            continue
        marker = data[offset + 1]
        if marker in (0xC0, 0xC1, 0xC2, 0xC3):
            height, width = struct.unpack(">HH", data[offset + 5 : offset + 9])
            return width, height
        if marker in (0xD8, 0xD9):
            offset += 2
            continue
        length = struct.unpack(">H", data[offset + 2 : offset + 4])[0]
        offset += 2 + length
    return None


def corner_brightness(data):
    try:
        image = Image.open(io.BytesIO(data)).convert("L")
    except Exception:
        return None
    width, height = image.size
    spots = [
        (0, 0),
        (width - CORNER_BOX, 0),
        (0, height - CORNER_BOX),
        (width - CORNER_BOX, height - CORNER_BOX),
    ]
    values = []
    for x, y in spots:
        patch = image.crop((x, y, x + CORNER_BOX, y + CORNER_BOX))
        values.append(sum(patch.getdata()) / (CORNER_BOX * CORNER_BOX))
    return values


def cover_penalty(size, corners):
    penalty = 0.0
    if size and size[1] and size[0] / size[1] > MAX_SENSIBLE_RATIO:
        penalty += 1000
    if corners:
        penalty += sum(1 for value in corners if value >= BRIGHT_CORNER) * 100
        penalty += sum(corners) / len(corners)
    return penalty


def download_cover(isbns):
    best = None
    for isbn in isbns[:MAX_CANDIDATES]:
        try:
            data, content_type, status = http_get(COVER_URL.format(isbn=isbn))
        except Exception:
            time.sleep(REQUEST_PAUSE)
            continue
        time.sleep(REQUEST_PAUSE)
        if status != 200 or "image" not in content_type or len(data) < MIN_BYTES:
            continue
        size = jpeg_size(data)
        if size and size[0] < MIN_WIDTH:
            continue
        penalty = cover_penalty(size, corner_brightness(data))
        if best is None or penalty < best[0]:
            best = (penalty, isbn, data, size)
        if penalty < 100:
            break
    if best is None:
        return None, None, None
    return best[1], best[2], best[3]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    COVER_DIR.mkdir(parents=True, exist_ok=True)
    details = json.loads(DETAILS_FILE.read_text(encoding="utf-8"))["books"]

    manifest = {}
    if MANIFEST_FILE.exists() and not args.force:
        try:
            manifest = json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            manifest = {}

    todo = []
    for key, detail in details.items():
        if key in manifest and (COVER_DIR / manifest[key]).exists():
            continue
        candidates = detail.get("isbn_candidates") or (
            [detail["isbn"]] if detail.get("isbn") else []
        )
        if candidates:
            todo.append((key, candidates))

    if args.limit:
        todo = todo[: args.limit]

    print(f"{len(details)} Bücher, {len(manifest)} Cover bereits da")
    print(f"Hole jetzt {len(todo)}\n")

    widths, total_bytes, failures = [], 0, []
    for index, (key, candidates) in enumerate(todo, start=1):
        isbn, data, size = download_cover(candidates)
        if not data:
            failures.append(key)
            print(f"  [{index:>3}/{len(todo)}] ----  {key.split('|')[0][:52]}")
            sys.stdout.flush()
            continue
        filename = f"{isbn}.jpg"
        (COVER_DIR / filename).write_bytes(data)
        manifest[key] = filename
        total_bytes += len(data)
        if size:
            widths.append(size[0])
        dimensions = f"{size[0]}x{size[1]}" if size else "?"
        print(
            f"  [{index:>3}/{len(todo)}] ok    {key.split('|')[0][:40]:<42}"
            f"{dimensions:>10}{len(data) // 1024:>5} KB"
        )
        sys.stdout.flush()

        if index % 25 == 0:
            MANIFEST_FILE.write_text(
                json.dumps(dict(sorted(manifest.items())), ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

    MANIFEST_FILE.write_text(
        json.dumps(dict(sorted(manifest.items())), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    on_disk = sum(f.stat().st_size for f in COVER_DIR.glob("*.jpg"))
    print(f"\nGeschrieben: {COVER_DIR}")
    print(f"  Cover insgesamt:   {len(manifest)}/{len(details)}")
    print(f"  Ordnergröße:       {on_disk / 1_048_576:.1f} MB")
    if widths:
        widths.sort()
        print(f"  Breite:            min {widths[0]}, median {widths[len(widths) // 2]}, max {widths[-1]}")
    print(f"  Manifest:          {MANIFEST_FILE}")

    if failures:
        print(f"\nOhne Cover ({len(failures)}):")
        for key in failures:
            print(f"  {key.split('|')[0]} — {key.split('|')[1]}")


if __name__ == "__main__":
    main()
