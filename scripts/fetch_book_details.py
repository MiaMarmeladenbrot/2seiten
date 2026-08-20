"""
Fetches per-book details from the Deutsche Nationalbibliothek (SRU, MARC21).

Free, no API key, no registration. For every book in data/books.json it looks up
the DNB record of the German print edition and writes data/book_details.json:
blurb, publisher keywords, Thema classification, genre, ISBN, publisher, real
publication year, pages, original title, translators, series.

Results are cached — a second run only fetches books that are still missing.

Usage:
    .venv/bin/python scripts/fetch_book_details.py            # only missing ones
    .venv/bin/python scripts/fetch_book_details.py --force    # fetch everything again
    .venv/bin/python scripts/fetch_book_details.py --limit 10 # try a few first
    .venv/bin/python scripts/fetch_book_details.py --only Wunder --only Frankie

Query syntax matters: tit="<title>" and atr=<surname>. Quoting the full author
name returns zero records, and WOE= does not work at all.

The title search matches prefixes, because DNB spells some titles differently
("Dreimeterdreissig", "Das Eis-Schloss"). That also drags in sequels, companion
volumes and box sets, so records whose title is the searched one are preferred
and only fall back to prefix hits when no such record exists.
"""

import argparse
import json
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOOKS_FILE = ROOT / "data" / "books.json"
OUT_FILE = ROOT / "data" / "book_details.json"

SRU_ENDPOINT = "https://services.dnb.de/sru/dnb"
MARC = "{http://www.loc.gov/MARC21/slim}"
USER_AGENT = "2seiten-fanproject/0.1 (private hobby project; podcast book index)"

MAX_RECORDS = 40
AUTHOR_ONLY_RECORDS = 60
DISTINCTIVE_WORD_ATTEMPTS = 3
REQUEST_PAUSE = 0.4
BLURB_MIN_CHARS = 150
BLURB_MAX_CHARS = 6000
MAX_BLURB_LINKS = 4

AUDIO_MARKERS = ("hörbuch", "gesprochen", "ungekürzte lesung", "mp3", "audio-cd")

STUDY_TITLE_MARKERS = (
    "textanalyse",
    "interpretation",
    "lektüreschlüssel",
    "königs erläuterung",
    "unterrichtsmodell",
    "erläuterungen",
    "inhaltsangabe",
    "charakterisierung",
    "arbeitsheft",
    "lehrerband",
    "lesetagebuch",
    "kopiervorlagen",
    "handreichung",
    "unterrichtsmaterial",
    "abiturwissen",
    "prüfungsaufgaben",
    "lektürehilfe",
    "text und material",
    "mit materialien",
)

STUDY_PUBLISHERS = (
    "klett sprachen",
    "klett lerntraining",
    "bange",
    "schöningh",
    "cornelsen",
    "stark verlag",
    "pons",
    "hueber",
    "verlag an der ruhr",
    "persen",
    "auer verlag",
    "buchner",
    "krapp",
    "friedrich verlag",
)

STUDY_KEYWORD_MARKERS = (
    "deutsch als fremdsprache",
    "sekundarstufe",
    "lektüreschlüssel",
    "unterrichtsmaterial",
    "schullektüre",
    "klassenlektüre",
    "abiturprüfung",
)

SIDE_EDITION_TITLE_MARKERS = (
    "leseprobe",
    "alle bände",
    "alle fünf bände",
    "alle vier bände",
    "alle drei bände",
    "sämtliche",
    "gesamtausgabe",
    "sammelband",
    "sammelausgabe",
    "die box",
    "band 1-",
    "teil 1-",
    "bände 1-",
    "romane in einem band",
    "in einem band",
)

KEYWORD_BLOCKLIST = {
    "novels",
    "fiction",
    "domestic fiction",
    "german fiction",
    "belletristik",
    "roman",
    "romane",
    "hardcover",
    "paperback",
    "taschenbuch",
    "ebook",
    "e-book",
}


def http_get(url, timeout=25):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        text = response.read().decode("utf-8", "replace")
    return unicodedata.normalize("NFC", text)


def surname_of(author):
    first_author = re.split(r"\s*[&/]\s*|\s+und\s+", author)[0].strip()
    parts = [p for p in first_author.split() if p]
    return parts[-1] if parts else first_author


def normalize_title(value):
    value = value.lower().replace("ß", "ss")
    decomposed = unicodedata.normalize("NFKD", value)
    without_accents = "".join(c for c in decomposed if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", without_accents)).strip()


def compact_title(value):
    return normalize_title(value).replace(" ", "")


def subfields_of(datafield):
    result = []
    for subfield in datafield.iter(f"{MARC}subfield"):
        result.append((subfield.get("code"), (subfield.text or "").strip()))
    return result


def first_value(pairs, code):
    for c, value in pairs:
        if c == code and value:
            return value
    return ""


def looks_like_identifier(value):
    return (
        value.startswith(("(DE-", "http", "https"))
        or re.fullmatch(r"\d+([.,]\d+)*\\?[a-z]?", value) is not None
        or re.fullmatch(r"[a-z\-]{2,12}", value) is not None
        or not re.search(r"[A-Za-zÄÖÜäöü]{3}", value)
    )


def parse_record(record):
    parsed = {
        "title": "",
        "subtitle": "",
        "isbns": [],
        "keywords": [],
        "thema": [],
        "genre": [],
        "publisher": "",
        "place": "",
        "year": "",
        "pages": None,
        "original_title": "",
        "translators": [],
        "people": [],
        "series": "",
        "blurb_links": [],
        "is_audio": False,
    }

    for datafield in record.iter(f"{MARC}datafield"):
        tag = datafield.get("tag")
        pairs = subfields_of(datafield)
        values = [v for _, v in pairs if v]
        blob = " ".join(values).lower()

        if tag == "245":
            parsed["title"] = first_value(pairs, "a")
            parsed["subtitle"] = first_value(pairs, "b")
        elif tag == "020":
            raw = first_value(pairs, "a")
            digits = re.sub(r"[^0-9Xx]", "", raw.split()[0]) if raw else ""
            if len(digits) == 13:
                parsed["isbns"].append(digits)
        elif tag == "653":
            for value in values:
                parsed["keywords"].append(value)
        elif tag == "926":
            label = values[-1] if values else ""
            code = values[0] if values else ""
            if label and not looks_like_identifier(label) and label != code:
                parsed["thema"].append({"code": code, "label": label})
        elif tag == "655":
            for value in values:
                if value and not looks_like_identifier(value):
                    parsed["genre"].append(value)
        elif tag == "264":
            parsed["place"] = parsed["place"] or first_value(pairs, "a")
            parsed["publisher"] = parsed["publisher"] or first_value(pairs, "b")
            year_match = re.search(r"\d{4}", first_value(pairs, "c"))
            if year_match and not parsed["year"]:
                parsed["year"] = year_match.group(0)
        elif tag == "300":
            pages_match = re.search(r"(\d+)\s*Seiten", first_value(pairs, "a"))
            if pages_match:
                parsed["pages"] = int(pages_match.group(1))
        elif tag == "240":
            parsed["original_title"] = parsed["original_title"] or first_value(pairs, "a")
        elif tag in ("100", "700"):
            is_translator = any(
                "trl" in v.lower() or "übersetz" in v.lower() for _, v in pairs
            )
            name = next(
                (v for _, v in pairs if v and not looks_like_identifier(v)), ""
            )
            if name:
                parsed["people"].append(name)
                if is_translator and tag == "700":
                    parsed["translators"].append(name)
        elif tag in ("490", "830"):
            name = first_value(pairs, "a")
            if name and not parsed["series"]:
                parsed["series"] = name
        elif tag == "856":
            if "Inhaltstext" in first_value(pairs, "3"):
                url = first_value(pairs, "u")
                if url:
                    parsed["blurb_links"].append(url)

        if any(marker in blob for marker in AUDIO_MARKERS):
            parsed["is_audio"] = True

    parsed["study_edition_score"] = study_edition_score(parsed)
    parsed["is_side_edition"] = is_side_edition(parsed)
    return parsed


def is_side_edition(parsed):
    title_and_subtitle = f"{parsed['title']} {parsed['subtitle']}".lower()
    return any(marker in title_and_subtitle for marker in SIDE_EDITION_TITLE_MARKERS)


def study_edition_score(parsed):
    score = 0
    title_and_subtitle = f"{parsed['title']} {parsed['subtitle']}".lower()
    publisher = parsed["publisher"].lower()
    keywords = " ".join(parsed["keywords"]).lower()
    if any(marker in title_and_subtitle for marker in STUDY_TITLE_MARKERS):
        score += 3
    if any(marker in publisher for marker in STUDY_PUBLISHERS):
        score += 2
    if any(marker in keywords for marker in STUDY_KEYWORD_MARKERS):
        score += 1
    return score


def title_matches(searched, found):
    a, b = normalize_title(searched), normalize_title(found)
    if not a or not b:
        return False
    if a == b or b.startswith(a) or a.startswith(b):
        return True
    ca, cb = compact_title(searched), compact_title(found)
    return bool(ca) and bool(cb) and (ca == cb or cb.startswith(ca) or ca.startswith(cb))


def titles_are_same_work(searched, found):
    a, b = normalize_title(searched), normalize_title(found)
    if not a or not b:
        return False
    return a == b or compact_title(searched) == compact_title(found)


def run_query(query, max_records=MAX_RECORDS):
    url = (
        f"{SRU_ENDPOINT}?version=1.1&operation=searchRetrieve"
        f"&query={urllib.parse.quote(query)}"
        f"&recordSchema=MARC21-xml&maximumRecords={max_records}"
    )
    xml = http_get(url)
    count_match = re.search(r"<numberOfRecords>(\d+)", xml)
    if not count_match or count_match.group(1) == "0":
        return []
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return []
    return [parse_record(rec) for rec in root.iter(f"{MARC}record")]


def fetch_records(title, author):
    return run_query(f'tit="{title}" and atr={surname_of(author)}')


def find_matching_records(title, author):
    name = surname_of(author)
    punctuation_free = re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", title)).strip()

    attempts = [(f'tit="{title}" and atr={name}', False, MAX_RECORDS)]
    if punctuation_free and punctuation_free != title:
        attempts.append((f'tit="{punctuation_free}" and atr={name}', False, MAX_RECORDS))
    attempts.append((f'tit="{title}"', True, MAX_RECORDS))

    words = punctuation_free.split()
    distinctive_words = sorted(
        (w for w in words if len(w) >= 4), key=len, reverse=True
    ) or words[:1]
    for word in distinctive_words[:DISTINCTIVE_WORD_ATTEMPTS]:
        attempts.append((f"tit={word} and atr={name}", False, MAX_RECORDS))

    attempts.append((f"atr={name}", False, AUTHOR_ONLY_RECORDS))

    for query, require_author, limit in attempts:
        try:
            records = run_query(query, limit)
        except Exception:
            continue
        matching = [r for r in records if title_matches(title, r["title"])]
        if require_author:
            matching = [
                r
                for r in matching
                if any(name.lower() in person.lower() for person in r["people"])
            ]
        if matching:
            return matching, len(records)
        time.sleep(REQUEST_PAUSE)
    return [], 0


def record_rank(parsed):
    german_print = any(i.startswith("9783") for i in parsed["isbns"])
    return (
        parsed["study_edition_score"],
        0 if not parsed["is_side_edition"] else 1,
        0 if german_print else 1,
        0 if not parsed["is_audio"] else 1,
        0 if parsed["blurb_links"] else 1,
        0 if parsed["keywords"] else 1,
    )


def clean_keywords(values):
    cleaned, seen = [], set()
    for value in values:
        value = value.strip()
        if not value or value.startswith("("):
            continue
        if len(value) > 60 or value.lower() in KEYWORD_BLOCKLIST:
            continue
        if re.fullmatch(r"\d+", value):
            continue
        key = value.lower()
        if key not in seen:
            seen.add(key)
            cleaned.append(value)
    return cleaned


def fetch_blurb(links):
    ordered = sorted(links, key=lambda u: 0 if "deposit.dnb.de" in u else 1)
    for link in ordered[:MAX_BLURB_LINKS]:
        try:
            html = http_get(link)
        except Exception:
            continue
        html = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", html)
        text = re.sub(r"<[^>]+>", " ", html)
        text = re.sub(r"\s+", " ", text).strip()
        if BLURB_MIN_CHARS <= len(text) <= BLURB_MAX_CHARS:
            return text
    return ""


def build_detail(title, author):
    matching, records_seen = find_matching_records(title, author)
    if not matching:
        return None, "kein passender Datensatz"

    records = matching
    usable = [r for r in matching if titles_are_same_work(title, r["title"])] or matching
    usable = [r for r in usable if not r["is_side_edition"]] or usable
    usable = [r for r in usable if not r["is_audio"]] or usable
    usable = [r for r in usable if r["study_edition_score"] == 0] or usable
    usable.sort(key=record_rank)
    best = usable[0]

    isbns, seen_isbn = [], set()
    for record in usable:
        for isbn in record["isbns"]:
            if isbn not in seen_isbn:
                seen_isbn.add(isbn)
                isbns.append(isbn)
    isbns.sort(key=lambda i: 0 if i.startswith("9783") else 1)

    keywords, thema, genre, blurb_links = [], [], [], []
    seen_thema, seen_genre = set(), set()
    for record in usable:
        keywords.extend(record["keywords"])
        blurb_links.extend(record["blurb_links"])
        for entry in record["thema"]:
            if entry["label"] not in seen_thema:
                seen_thema.add(entry["label"])
                thema.append(entry)
        for value in record["genre"]:
            if value not in seen_genre:
                seen_genre.add(value)
                genre.append(value)

    detail = {
        "dnb_title": best["title"],
        "subtitle": best["subtitle"],
        "isbn": isbns[0] if isbns else "",
        "isbn_candidates": isbns[:6],
        "blurb": fetch_blurb(blurb_links),
        "keywords": clean_keywords(keywords),
        "thema": thema,
        "genre": genre,
        "publisher": best["publisher"],
        "place": best["place"],
        "published_year": best["year"],
        "pages": best["pages"],
        "original_title": best["original_title"],
        "translators": sorted({t for r in usable for t in r["translators"]}),
        "series": best["series"],
        "record_count": len(records),
        "fetched_at": date.today().isoformat(),
    }
    return detail, "ok"


def load_existing():
    if not OUT_FILE.exists():
        return {}
    try:
        return json.loads(OUT_FILE.read_text(encoding="utf-8")).get("books", {})
    except (json.JSONDecodeError, OSError):
        return {}


def write_output(books):
    payload = {
        "metadata": {
            "source": "Deutsche Nationalbibliothek, SRU-Schnittstelle (MARC21)",
            "endpoint": SRU_ENDPOINT,
            "note": (
                "Klappentexte sind geschützte Verlagstexte — nur zum Bau des "
                "Suchindex verwenden, nicht anzeigen."
            ),
            "total": len(books),
            "with_blurb": sum(1 for b in books.values() if b.get("blurb")),
            "with_keywords": sum(1 for b in books.values() if b.get("keywords")),
            "with_isbn": sum(1 for b in books.values() if b.get("isbn")),
        },
        "books": books,
    }
    OUT_FILE.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--only", action="append", default=[], metavar="TITEL")
    args = parser.parse_args()

    data = json.loads(BOOKS_FILE.read_text(encoding="utf-8"))
    all_books = [
        (f"{b['title']}|{b['author']}", b["title"], b["author"])
        for ep in data["episodes"]
        for b in ep["books"]
    ]

    details = {} if args.force else load_existing()

    known_keys = {key for key, _, _ in all_books}
    orphaned = sorted(set(details) - known_keys)
    for key in orphaned:
        del details[key]
    if orphaned:
        print(f"{len(orphaned)} Einträge zu nicht mehr vorhandenen Büchern entfernt:")
        for key in orphaned:
            print(f"  {key}")
        print()

    if args.only:
        wanted = [needle.lower() for needle in args.only]
        todo = [
            entry
            for entry in all_books
            if any(needle in entry[1].lower() for needle in wanted)
        ]
    else:
        todo = [entry for entry in all_books if entry[0] not in details]
    if args.limit:
        todo = todo[: args.limit]

    print(f"{len(all_books)} Bücher insgesamt, {len(details)} bereits im Cache")
    print(f"Hole jetzt {len(todo)}\n")

    failures = []
    for index, (key, title, author) in enumerate(todo, start=1):
        try:
            detail, note = build_detail(title, author)
        except Exception as error:
            detail, note = None, f"Fehler {type(error).__name__}"

        if detail:
            details[key] = detail
            marks = "".join(
                [
                    "K" if detail["blurb"] else "·",
                    "S" if detail["keywords"] else "·",
                    "T" if detail["thema"] else "·",
                    "I" if detail["isbn"] else "·",
                ]
            )
            print(f"  [{index:>3}/{len(todo)}] {marks}  {title[:52]}")
        else:
            failures.append((title, author, note))
            print(f"  [{index:>3}/{len(todo)}] ----  {title[:52]}  → {note}")

        sys.stdout.flush()
        time.sleep(REQUEST_PAUSE)

        if index % 25 == 0:
            write_output(details)

    write_output(details)

    total = len(details)
    print(f"\nGeschrieben: {OUT_FILE}")
    print(f"  Bücher mit Daten:      {total}/{len(all_books)}")
    print(f"  davon Klappentext:     {sum(1 for b in details.values() if b['blurb'])}")
    print(f"  davon Schlagwörter:    {sum(1 for b in details.values() if b['keywords'])}")
    print(f"  davon Thema-Kategorien:{sum(1 for b in details.values() if b['thema'])}")
    print(f"  davon ISBN:            {sum(1 for b in details.values() if b['isbn'])}")

    if failures:
        print(f"\nOhne Daten ({len(failures)}) — von Hand nachtragbar:")
        for title, author, note in failures:
            print(f"  {title} — {author}: {note}")


if __name__ == "__main__":
    main()
