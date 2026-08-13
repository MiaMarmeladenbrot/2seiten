"""
Downloads book covers from the MVB cover service via the DNB portal.

Free, no API key. Reads the ISBNs collected in data/book_details.json, saves the
images to web/public/covers/<isbn>.jpg and writes web/src/data/covers.json,
which maps "Title|Author" to the file name so the app knows which books have a
cover and which fall back to the generated design.

Books often have several ISBNs (foreign editions, audio books, e-books), already
ordered with German print editions first. The service sometimes answers with a
3D product render — the book at an angle, cut out on white — or with an audio
book cover in CD proportions. Candidates are therefore scored: too wide is
rejected outright, bright corners mean a cut-out render, and among equals the
earlier candidate wins, because that ordering is the better guess at the right
edition.

data/cover_overrides.json pins single books to a chosen ISBN when the automatic
pick is ugly. A pinned ISBN is downloaded as it comes, without any of the
quality gates.

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
OVERRIDES_FILE = ROOT / "data" / "cover_overrides.json"
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
POSITION_PENALTY = 10


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


def cover_penalty(size, corners, position):
    if corners is None:
        return None
    penalty = position * POSITION_PENALTY
    if size and size[1] and size[0] / size[1] > MAX_SENSIBLE_RATIO:
        penalty += 1000
    penalty += sum(1 for value in corners if value >= BRIGHT_CORNER) * 100
    return penalty


def fetch_image(isbn):
    try:
        data, content_type, status = http_get(COVER_URL.format(isbn=isbn))
    except Exception:
        time.sleep(REQUEST_PAUSE)
        return None, None
    time.sleep(REQUEST_PAUSE)
    if status != 200 or "image" not in content_type or not data:
        return None, None
    return data, jpeg_size(data)


def download_pinned_cover(isbn):
    data, size = fetch_image(isbn)
    if data is None:
        return None, None, None
    return isbn, data, size


def download_cover(isbns):
    best = None
    for position, isbn in enumerate(isbns[:MAX_CANDIDATES]):
        data, size = fetch_image(isbn)
        if data is None or len(data) < MIN_BYTES:
            continue
        if size and size[0] < MIN_WIDTH:
            continue
        penalty = cover_penalty(size, corner_brightness(data), position)
        if penalty is None:
            continue
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

    overrides = {}
    if OVERRIDES_FILE.exists():
        overrides = {
            key: value
            for key, value in json.loads(OVERRIDES_FILE.read_text(encoding="utf-8")).items()
            if not key.startswith("_")
        }

    manifest = {}
    if MANIFEST_FILE.exists():
        try:
            manifest = json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            manifest = {}

    unknown_overrides = sorted(set(overrides) - set(details))
    if unknown_overrides:
        print(f"WARNUNG: {len(unknown_overrides)} Override-Schlüssel passen zu keinem Buch:")
        for key in unknown_overrides:
            print(f"  {key}")
        print()

    todo = []
    for key, detail in details.items():
        pinned = overrides.get(key)
        wanted = f"{pinned}.jpg" if pinned else manifest.get(key)
        already_there = (
            wanted is not None
            and manifest.get(key) == wanted
            and (COVER_DIR / wanted).exists()
        )
        if already_there and not args.force:
            continue
        if pinned:
            todo.append((key, [pinned], True))
            continue
        candidates = detail.get("isbn_candidates") or (
            [detail["isbn"]] if detail.get("isbn") else []
        )
        if candidates:
            todo.append((key, candidates, False))

    if args.limit:
        todo = todo[: args.limit]

    print(f"{len(details)} Bücher, {len(manifest)} Cover bereits da")
    print(f"Hole jetzt {len(todo)}\n")

    widths, total_bytes, failures = [], 0, []
    for index, (key, candidates, pinned) in enumerate(todo, start=1):
        if pinned:
            isbn, data, size = download_pinned_cover(candidates[0])
        else:
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
