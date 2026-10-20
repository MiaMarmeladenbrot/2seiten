"""
Fetches the RSS feed of "Zwei Seiten – Der Podcast über Bücher" (WDR)
and stores all episodes as JSON.

Usage:
    .venv/bin/python fetch_episodes.py
"""

from __future__ import annotations

import json
import re
import unicodedata
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import feedparser

FEED_URL = "https://www1.wdr.de/mediathek/audio/wdr/zwei-seiten/zwei-seiten-100.podcast"
ARD_PROGRAM_SET_URL = "https://api.ardaudiothek.de/programsets/14045781?limit=500"
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


def title_key(title: str) -> str:
    return unicodedata.normalize("NFC", title).strip()


def fetch_ard_links() -> dict[str, str]:
    print(f"Fetching ARD Sounds links: {ARD_PROGRAM_SET_URL}")
    with urllib.request.urlopen(ARD_PROGRAM_SET_URL, timeout=30) as response:
        data = json.load(response)
    items = data["data"]["programSet"]["items"]["nodes"]
    return {title_key(item["title"]): item["sharingUrl"] for item in items if item.get("sharingUrl")}


def main() -> None:
    ard_links = fetch_ard_links()
    print(f"Fetching feed: {FEED_URL}")
    feed = feedparser.parse(FEED_URL)

    if feed.bozo and not feed.entries:
        raise SystemExit(f"Could not read feed: {feed.bozo_exception!r}")

    show_title = feed.feed.get("title", "")
    print(f"Show: {show_title}")
    print(f"Episodes in feed: {len(feed.entries)}")

    episodes = []
    for entry in feed.entries:
        # Keep description (HTML) and itunes:summary side by side —
        # book mentions can appear in either one.
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
                "ard_url": ard_links.get(title_key(entry.get("title", ""))),
                "guid": entry.get("id") or entry.get("guid"),
                "description": clean_html(description_html),
                "description_full_text": clean_html(full_html),
            }
        )

    OUT_FILE.write_text(
        json.dumps(episodes, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Written: {OUT_FILE} ({len(episodes)} episodes)")
    without_ard = [e["title"] for e in episodes if not e["ard_url"]]
    print(f"ARD Sounds link: {len(episodes) - len(without_ard)}/{len(episodes)}")
    for title in without_ard:
        print(f"  without ARD link: {title}")

    if episodes:
        print("\nSample episode:")
        first = episodes[0]
        print(f"  Title:        {first['title']}")
        print(f"  Published:    {first['published']}")
        print(f"  Audio:        {first['audio_url']}")
        snippet = (first["description"] or "")[:300]
        print(f"  Description:  {snippet}{'…' if len(first['description']) > 300 else ''}")


if __name__ == "__main__":
    main()
