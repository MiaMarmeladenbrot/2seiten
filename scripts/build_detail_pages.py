"""
Builds web/src/data/details.json, the data behind a book's detail page.

Reads data/book_details.json (DNB) and keeps only what the page shows: publisher,
place and year, pages, setting, original title and language, translators and a
link to the book at its publisher. Everything is phrased the way the page prints
it, so the app does not need to know about MARC codes or Thema labels.

PUBLISHER_URLS pins a publisher link by hand where the DNB has none or a wrong one.

Books from collection episodes (three or more books) also get the colours of
their spine, for the shelf that shows the other books of such an episode: the
cover's dominant colour as the spine, and a colour from the same cover that stays
readable on it for the title, falling back to the app's ink or cream. Only those
books ever stand on a shelf, so the others carry no colours.

Usage:
    .venv/bin/python scripts/build_detail_pages.py
"""

from __future__ import annotations

import colorsys
import json
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DETAILS_FILE = ROOT / "data" / "book_details.json"
BOOKS_FILE = ROOT / "data" / "books.json"
SHELF_FROM_BOOKS = 3
COVER_MANIFEST = ROOT / "web" / "src" / "data" / "covers.json"
COVER_DIR = ROOT / "web" / "public" / "covers"
OUT_FILE = ROOT / "web" / "src" / "data" / "details.json"

INK = (0x2B, 0x1F, 0x1C)
CREAM = (0xFA, 0xF4, 0xED)
READABLE_CONTRAST = 4.5
TITLE_COLOR_MIN_SHARE = 0.05

PUBLISHER_URLS: dict[str, str] = {}

LANGUAGES = {
    "ara": "Arabischen",
    "chi": "Chinesischen",
    "cze": "Tschechischen",
    "dan": "Dänischen",
    "dut": "Niederländischen",
    "eng": "Englischen",
    "fin": "Finnischen",
    "fre": "Französischen",
    "gre": "Griechischen",
    "heb": "Hebräischen",
    "hun": "Ungarischen",
    "ice": "Isländischen",
    "ita": "Italienischen",
    "jpn": "Japanischen",
    "kor": "Koreanischen",
    "nor": "Norwegischen",
    "pol": "Polnischen",
    "por": "Portugiesischen",
    "rus": "Russischen",
    "spa": "Spanischen",
    "swe": "Schwedischen",
    "tur": "Türkischen",
}

PLACE_NAMES = {
    "Vereinigte Staaten von Amerika, USA": "USA",
    "Vereinigtes Königreich, Großbritannien": "Großbritannien",
    "France": "Frankreich",
    "Ostdeutschland, DDR": "DDR",
}


def setting_of(thema: list[dict]) -> str:
    places = [entry for entry in thema if entry["code"].startswith("1")]
    if not places:
        return ""
    label = max(places, key=lambda entry: len(entry["code"]))["label"]
    region, _, local = label.partition(":")
    if local:
        country = region.split()[0]
        label = f"{local.strip()}, {country}"
    label = re.sub(r"\s*\((City|Region|Stadt)\)$", "", label).strip()
    label = label.split(" / ")[0].replace("-am-", " am ")
    return PLACE_NAMES.get(label, label)


def person_name(inverted: str) -> str:
    surname, _, first = inverted.partition(",")
    return f"{first.strip()} {surname.strip()}".strip() if first else inverted.strip()


def joined(names: list[str]) -> str:
    if len(names) <= 1:
        return "".join(names)
    return f"{', '.join(names[:-1])} und {names[-1]}"


def catalogue_text(value: str) -> str:
    return re.sub(r"[\x98\x9c]", "", value or "").strip()


def luminance(rgb: tuple[int, int, int]) -> float:
    def channel(c: int) -> float:
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (channel(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def saturation(rgb: tuple[int, int, int]) -> float:
    return colorsys.rgb_to_hls(*(c / 255 for c in rgb))[2]


def hex_of(rgb: tuple[int, int, int]) -> str:
    return "#{:02X}{:02X}{:02X}".format(*rgb)


def spine_of(cover: Path) -> dict | None:
    if not cover.exists():
        return None
    image = Image.open(cover).convert("RGB").resize((60, 95))
    quantized = image.quantize(colors=6, method=Image.Quantize.MEDIANCUT)
    palette = quantized.getpalette()
    total = 60 * 95
    colours = [
        (count / total, tuple(palette[index * 3 : index * 3 + 3]))
        for count, index in sorted(quantized.getcolors(), reverse=True)
    ]

    def weight(share: float, rgb: tuple[int, int, int]) -> float:
        lightness = colorsys.rgb_to_hls(*(c / 255 for c in rgb))[1]
        extreme = lightness > 0.92 or lightness < 0.06
        return share * (0.35 + saturation(rgb)) * (0.4 if extreme else 1)

    background = max(colours, key=lambda c: weight(*c))[1]
    readable = [
        rgb
        for share, rgb in colours
        if share >= TITLE_COLOR_MIN_SHARE and contrast(rgb, background) >= READABLE_CONTRAST
    ]
    title = max(readable, key=saturation) if readable else max((INK, CREAM), key=lambda c: contrast(c, background))
    return {"bg": hex_of(background), "fg": hex_of(title)}


def same_title(a: str, b: str) -> bool:
    return re.sub(r"\W", "", a).lower() == re.sub(r"\W", "", b).lower()


def page_of(title: str, detail: dict) -> dict:
    translators = [person_name(t) for t in detail.get("translators", []) if not t.startswith("(")]
    original_title = catalogue_text(detail.get("original_title", ""))
    return {
        "publisher": detail.get("publisher", ""),
        "place": detail.get("place", ""),
        "year": detail.get("published_year", ""),
        "pages": detail.get("pages"),
        "setting": setting_of(detail.get("thema", [])),
        "original_title": "" if same_title(original_title, title) else original_title,
        "translated_from": LANGUAGES.get(detail.get("original_language", ""), ""),
        "translators": joined(translators),
        "publisher_url": detail.get("publisher_url", ""),
    }


def main() -> None:
    details = json.loads(DETAILS_FILE.read_text(encoding="utf-8"))["books"]
    covers = json.loads(COVER_MANIFEST.read_text(encoding="utf-8"))
    episodes = json.loads(BOOKS_FILE.read_text(encoding="utf-8"))["episodes"]
    on_shelf = {
        f"{book['title']}|{book['author']}"
        for episode in episodes
        if len(episode["books"]) >= SHELF_FROM_BOOKS
        for book in episode["books"]
    }
    pages = {}
    for key, detail in details.items():
        page = page_of(key.split("|")[0], detail)
        page["publisher_url"] = PUBLISHER_URLS.get(key, page["publisher_url"])
        spine = spine_of(COVER_DIR / covers[key]) if key in on_shelf and key in covers else None
        if spine:
            page["spine"] = spine
        pages[key] = page

    OUT_FILE.write_text(json.dumps(pages, ensure_ascii=False, indent=1), encoding="utf-8")

    def count(field: str) -> int:
        return sum(1 for p in pages.values() if p[field])

    print(f"Written: {OUT_FILE}")
    print(f"  books:            {len(pages)}")
    print(f"  setting:          {count('setting')}")
    print(f"  translated from:  {count('translated_from')}")
    print(f"  translators:      {count('translators')}")
    print(f"  publisher link:   {count('publisher_url')}")
    print(f"  spine colours:    {sum(1 for p in pages.values() if 'spine' in p)} (books on a shelf: {len(on_shelf)})")
    unknown = {d.get('original_language') for d in details.values()} - set(LANGUAGES) - {"", None, "ger"}
    if unknown:
        print(f"  languages without a German name: {sorted(unknown)}")


if __name__ == "__main__":
    main()
