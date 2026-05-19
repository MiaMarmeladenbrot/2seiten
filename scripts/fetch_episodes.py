"""
Lädt den RSS-Feed von "Zwei Seiten – Der Podcast über Bücher" (WDR)
und speichert alle Folgen als JSON.

Nutzung:
    .venv/bin/python fetch_episodes.py
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import feedparser

FEED_URL = "https://www1.wdr.de/mediathek/audio/wdr/zwei-seiten/zwei-seiten-100.podcast"
PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUT_FILE = PROJECT_ROOT / "data" / "episodes.json"


def clean_html(text: str | None) -> str:
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def pick_audio_url(entry) -> str | None:
    for enc in entry.get("enclosures", []) or []:
        href = enc.get("href") or enc.get("url")
        if href:
            return href
    for link in entry.get("links", []) or []:
        if link.get("rel") == "enclosure" and link.get("href"):
            return link["href"]
    return None


def parse_published(entry) -> str | None:
    if entry.get("published_parsed"):
        return datetime(*entry.published_parsed[:6], tzinfo=timezone.utc).isoformat()
    return entry.get("published")


def main() -> None:
    print(f"Lade Feed: {FEED_URL}")
    feed = feedparser.parse(FEED_URL)

    if feed.bozo and not feed.entries:
        raise SystemExit(f"Feed konnte nicht gelesen werden: {feed.bozo_exception!r}")

    show_title = feed.feed.get("title", "")
    print(f"Sendung: {show_title}")
    print(f"Folgen im Feed: {len(feed.entries)}")

    episodes = []
    for entry in feed.entries:
        # description (HTML) und ggf. itunes:summary parallel ablegen –
        # die Buchnennungen können in beiden auftauchen.
        description_html = entry.get("summary") or entry.get("description") or ""
        itunes_summary = entry.get("itunes_summary") or ""
        content_blocks = [c.get("value", "") for c in entry.get("content", []) or []]
        full_html = "\n".join([description_html, itunes_summary, *content_blocks])

        episodes.append(
            {
                "title": entry.get("title", "").strip(),
                "published": parse_published(entry),
                "duration": entry.get("itunes_duration"),
                "audio_url": pick_audio_url(entry),
                "page_url": entry.get("link"),
                "guid": entry.get("id") or entry.get("guid"),
                "description": clean_html(description_html),
                "description_full_text": clean_html(full_html),
            }
        )

    OUT_FILE.write_text(
        json.dumps(episodes, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Geschrieben: {OUT_FILE} ({len(episodes)} Folgen)")

    if episodes:
        print("\nBeispiel-Folge:")
        first = episodes[0]
        print(f"  Titel:        {first['title']}")
        print(f"  Erschienen:   {first['published']}")
        print(f"  Audio:        {first['audio_url']}")
        snippet = (first["description"] or "")[:300]
        print(f"  Beschreibung: {snippet}{'…' if len(first['description']) > 300 else ''}")


if __name__ == "__main__":
    main()
