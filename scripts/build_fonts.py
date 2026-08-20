"""
Builds the web fonts in web/public/fonts from the variable TTF originals in fonts/.

Nothing is ever fetched from Google at runtime: the originals live in this repo
under fonts/, and the site serves the generated WOFF2 files from its own domain.
Embedding fonts from a Google URL would send every visitor's IP address to
Google, which is exactly what this avoids.

The TTF originals stay out of web/public on purpose — everything in public/ is
copied into the deployed site, and no browser ever requests them.

WOFF2 alone roughly halves the files. The subset is what makes Inter small: the
original carries Cyrillic and Greek, which this site never renders. The kept
range is deliberately far wider than the current book data needs (15 non-ASCII
characters, all Latin-1 plus ć and š), so new episodes with foreign author names
do not silently fall back to a system font.

General punctuation is required, not optional: the UI uses „ " … – and →.

The OFL allows subsetting, but the licence has to travel with the files, so both
licence texts sit next to the WOFF2 files in web/public/fonts — one copy that is
both committed and deployed.

Usage:
    .venv/bin/python scripts/build_fonts.py
"""

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "fonts"
OUT_DIR = ROOT / "web" / "public" / "fonts"

FACES = [
    "Fraunces-VariableFont",
    "Fraunces-Italic-VariableFont",
    "Inter-VariableFont",
]

UNICODE_RANGES = ",".join(
    [
        "U+0000-00FF",
        "U+0100-017F",
        "U+0180-024F",
        "U+2000-206F",
        "U+20A0-20BF",
        "U+2122",
        "U+2190-2193",
        "U+2212",
        "U+25A0-25FF",
    ]
)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=SOURCE_DIR)
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    missing = [f for f in FACES if not (args.source / f"{f}.ttf").exists()]
    if missing:
        print(f"Fehlende TTF-Dateien in {args.source}:")
        for name in missing:
            print(f"  {name}.ttf")
        return 1

    for name in FACES:
        source = args.source / f"{name}.ttf"
        target = OUT_DIR / f"{name}.woff2"
        subprocess.run(
            [
                sys.executable,
                "-m",
                "fontTools.subset",
                str(source),
                f"--unicodes={UNICODE_RANGES}",
                "--flavor=woff2",
                f"--output-file={target}",
            ],
            check=True,
        )
        before = source.stat().st_size // 1024
        after = target.stat().st_size // 1024
        print(f"  {name}: {before} KB TTF → {after} KB WOFF2")

    total = sum((OUT_DIR / f"{n}.woff2").stat().st_size for n in FACES) // 1024
    print(f"\nGeschrieben: {OUT_DIR}  ({total} KB gesamt)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
