#!/usr/bin/env python3
"""Fetch a small, link-only NBA headline digest for the static O/U League site.

Uses ESPN's unofficial NBA news feed. Missing/broken requests preserve the previous
valid digest; headlines are attributed and linked back to their original articles.
No server, API key, database, or third-party JavaScript is required.
"""
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

ROOT = Path(__file__).resolve().parents[1]
URL = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=15"

def parse_news(feed, now=None):
    now = now or datetime.now(timezone.utc)
    if not isinstance(feed, dict) or not isinstance(feed.get("articles"), list):
        raise ValueError("NBA news response is missing the articles list")
    picked, seen = [], set()
    for item in feed["articles"]:
        if not isinstance(item, dict):
            continue
        headline = str(item.get("headline") or "").strip()
        published = str(item.get("published") or "").strip()
        url = ((item.get("links") or {}).get("web") or {}).get("href", "")
        parsed = urlparse(url)
        if not (headline and len(headline) >= 8 and len(headline) <= 220):
            continue
        if parsed.scheme != "https" or parsed.hostname not in {"espn.com", "www.espn.com"}:
            continue
        try:
            pub = datetime.fromisoformat(published.replace("Z", "+00:00"))
            if pub.tzinfo is None:
                continue
            age = now - pub
            if age < timedelta(hours=-2) or age > timedelta(days=4):
                continue
        except ValueError:
            continue
        if url in seen:
            continue
        seen.add(url)
        picked.append({"headline": headline, "url": url, "published": published})
    picked.sort(key=lambda r:r["published"], reverse=True)
    return picked[:5]

def main():
    path = ROOT / "data" / "news.json"
    old = json.loads(path.read_text(encoding="utf-8"))
    request = Request(URL, headers={"User-Agent":"OULeague/1.0 (personal NBA hobby scoreboard)", "Accept":"application/json"})
    try:
        with urlopen(request, timeout=12) as response:
            feed = json.load(response)
        stories = parse_news(feed)
        if not stories:
            print("NBA headlines unavailable or stale; preserving the previous digest.")
            return
        if old.get("articles") == stories:
            print("NBA headlines unchanged.")
            return
        payload = {
            "updatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00","Z"),
            "source": "ESPN NBA News",
            "articles": stories,
        }
        path.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        (ROOT/"data"/"news.js").write_text(
            "window.LEAGUE_NEWS = "+json.dumps(payload,ensure_ascii=False,separators=(",",":"))+";\n",
            encoding="utf-8"
        )
        print(f"Saved {len(stories)} NBA headlines.")
    except (URLError, HTTPError, TimeoutError, OSError, ValueError, json.JSONDecodeError) as error:
        print(f"NBA news fetch unavailable; retaining existing digest: {error}")

if __name__ == "__main__":
    main()
