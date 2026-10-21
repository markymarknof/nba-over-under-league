#!/usr/bin/env python3
"""NBA Nightly Monsters: latest finalized regular-season box-score stat leaders.

No backend, keys, analytics, Node or database. ESPN's unofficial NBA endpoint
is queried on GitHub Actions, never by site visitors. Existing valid data are
kept if the provider fails. Dates are in US Eastern (NBA game-date convention).
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError
from zoneinfo import ZoneInfo
import json
import re

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba"
MAX_GAMES = 16
DATE_LOOKBACK = 4
MAX_DISPLAY_AGE_DAYS = 5
TEAM_ALIASES = {"NY": "NYK", "SA": "SAS", "GS": "GSW", "NO": "NOP", "PHO": "PHX"}


def get_json(url):
    req = Request(url, headers={
        "User-Agent": "OULeague/1.0 personal NBA scoreboard",
        "Accept": "application/json",
    })
    with urlopen(req, timeout=13) as resp:
        return json.load(resp)


def final_regular_season_events(payload):
    if not isinstance(payload, dict) or not isinstance(payload.get("events"), list):
        raise ValueError("ESPN scoreboard missing events")
    events = []
    for e in payload["events"]:
        if not isinstance(e, dict) or not str(e.get("id", "")).isdigit():
            continue
        season = e.get("season") or {}
        season_type = season.get("type") if isinstance(season, dict) else None
        if season_type is not None and str(season_type) != "2":
            continue
        state = ((e.get("status") or {}).get("type") or {})
        competitions = e.get("competitions") or []
        competition_state = ((competitions[0].get("status") or {}).get("type") or {}) if competitions else {}
        final = state.get("completed") is True or competition_state.get("completed") is True
        if not final and (state.get("state") != "post" and competition_state.get("state") != "post"):
            continue
        events.append(str(e["id"]))
    return list(dict.fromkeys(events))[:MAX_GAMES]


def stat_int(value):
    if isinstance(value, bool) or value is None:
        return None
    raw = str(value).strip()
    if not re.fullmatch(r"\d+(?:\.0+)?", raw):
        return None
    return int(float(raw))


def parse_summary(summary, game_id):
    """Return legitimate individual player lines; no team aggregates or DNP."""
    boxscore = summary.get("boxscore") if isinstance(summary, dict) else None
    groups = (boxscore or {}).get("players") if isinstance(boxscore, dict) else None
    if not isinstance(groups, list):
        return []
    athletes = {}
    field_aliases = {
        "points": ("PTS", "POINTS"),
        "rebounds": ("REB", "REBOUNDS", "TOTREB"),
        "assists": ("AST", "ASSISTS"),
        "steals": ("STL", "STEALS"),
        "blocks": ("BLK", "BLOCKS"),
    }
    for team_group in groups:
        if not isinstance(team_group, dict):
            continue
        team = team_group.get("team") or {}
        raw_code = str(team.get("abbreviation") or "").upper()
        team_code = TEAM_ALIASES.get(raw_code, raw_code)
        for category in team_group.get("statistics") or []:
            keys = category.get("names") or category.get("labels") or []
            if not isinstance(keys, list):
                continue
            for row in category.get("athletes") or []:
                if not isinstance(row, dict) or row.get("didNotPlay") is True:
                    continue
                athlete = row.get("athlete") or {}
                name = str(athlete.get("displayName") or athlete.get("fullName") or "").strip()
                aid = str(athlete.get("id") or "")
                values = row.get("stats")
                if not name or not isinstance(values, list) or len(values) != len(keys):
                    continue
                stats = {str(k).strip().upper(): v for k, v in zip(keys, values)}
                totals = {}
                for field, aliases in field_aliases.items():
                    raw = next((stats[a] for a in aliases if a in stats), None)
                    totals[field] = stat_int(raw)
                if any(totals[f] is None for f in ("points", "rebounds", "assists")):
                    continue
                if not (0 <= totals["points"] <= 110 and 0 <= totals["rebounds"] <= 60
                        and 0 <= totals["assists"] <= 45):
                    continue
                totals["steals"] = totals["steals"] or 0
                totals["blocks"] = totals["blocks"] or 0
                if not (totals["steals"] <= 25 and totals["blocks"] <= 25):
                    continue
                if not team_code:
                    continue
                line = {
                    "name": name[:80], "team": team_code[:5],
                    "gameId": str(game_id), **totals,
                }
                key = (str(game_id), aid or name.casefold())
                athletes[key] = line
    return list(athletes.values())


def player_sort_key(p):
    # Show outrageous lines, not simply the night's top scorer.
    triple = sum(p[k] >= 10 for k in ("points", "rebounds", "assists", "steals", "blocks")) >= 3
    score = (p["points"] + 1.1*p["rebounds"] + 1.4*p["assists"]
             + 3*p["steals"] + 3*p["blocks"]
             + (10 if p["points"] >= 40 else 0)
             + (8 if p["rebounds"] >= 20 else 0)
             + (8 if p["assists"] >= 15 else 0)
             + (12 if triple else 0))
    return (score, p["points"], p["assists"], p["rebounds"])


def build_digest(game_date, game_ids, lines, now=None):
    now = now or datetime.now(timezone.utc)
    if not isinstance(game_date, str) or not re.fullmatch(r"20\d\d-\d\d-\d\d", game_date):
        raise ValueError("Invalid game date")
    if not game_ids or not lines:
        raise ValueError("No finalized box scores")
    unique = {}
    for line in lines:
        key = (line["gameId"], line["name"], line["team"])
        unique[key] = line
    candidates = list(unique.values())
    def top(stat):
        return max(candidates, key=lambda p:(p[stat],player_sort_key(p)))
    performers = sorted(candidates, key=player_sort_key, reverse=True)[:4]
    return {
        "updatedAt": now.isoformat(timespec="seconds").replace("+00:00", "Z"),
        "gameDate": game_date,
        "gameCount": len(set(game_ids)),
        "source": "ESPN NBA box scores (unofficial)",
        "leaders": {k: top(k) for k in ("points", "rebounds", "assists")},
        "performers": performers,
    }


def write_digest(payload, root=ROOT):
    directory = root / "data"
    (directory / "boxscores.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (directory / "boxscores.js").write_text(
        "window.LEAGUE_BOXSCORES = "
        + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        + ";\n", encoding="utf-8")


def main():
    today = datetime.now(ZoneInfo("America/New_York")).date()
    selected_date, ids = None, None
    for days_ago in range(DATE_LOOKBACK + 1):
        d = today - timedelta(days=days_ago)
        date_key = d.strftime("%Y%m%d")
        try:
            payload = get_json(f"{BASE}/scoreboard?dates={date_key}&limit=30")
            completed = final_regular_season_events(payload)
            if completed:
                selected_date, ids = d.isoformat(), completed
                break
        except (HTTPError, URLError, TimeoutError, ValueError, OSError) as err:
            print(f"Scoreboard unavailable for {date_key}: {err}")
    if not ids:
        print("No recent finished NBA regular-season games; existing stats retained.")
        return

    lines, succeeded = [], 0
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {
            pool.submit(get_json, f"{BASE}/summary?event={game_id}"): game_id
            for game_id in ids
        }
        for future in as_completed(futures):
            game_id = futures[future]
            try:
                parsed = parse_summary(future.result(), game_id)
                if parsed:
                    succeeded += 1
                    lines.extend(parsed)
                else:
                    print(f"No box-score lines available for game {game_id}")
            except (HTTPError, URLError, TimeoutError, OSError, ValueError, KeyError) as err:
                print(f"Game {game_id} box score failed: {err}")
    if not lines:
        print("No usable player box scores; existing data retained.")
        return
    # Don't claim coverage of more games than actually parsed.
    covered_ids = {p["gameId"] for p in lines}
    digest = build_digest(selected_date, list(covered_ids), lines)
    old_path = ROOT / "data" / "boxscores.json"
    try:
        old = json.loads(old_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        old = {}
    if (old.get("gameDate") or "") > selected_date:
        print("Refusing to overwrite newer results with an older game date.")
        return
    # Avoid publishing a partial scrape over a complete digest from the same date.
    if old.get("gameDate") == selected_date and old.get("gameCount", 0) > digest["gameCount"]:
        print("Keeping more complete box-score digest from this NBA date.")
        return
    without_timestamp = ("gameDate", "gameCount", "leaders", "performers")
    if all(old.get(k) == digest.get(k) for k in without_timestamp):
        print("NBA player leaders unchanged.")
        return
    write_digest(digest)
    print(f"NBA player leaders: {selected_date}, {succeeded}/{len(ids)} completed games parsed, {len(lines)} athletes")


if __name__ == "__main__":
    main()
