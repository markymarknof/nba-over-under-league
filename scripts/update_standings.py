#!/usr/bin/env python3
"""Refresh the league's static records from ESPN's unofficial standings JSON.

No third-party Python libraries, persistent services, API keys or Blob storage.
Existing data are left unchanged if the provider fails or data look incomplete.
The standalone site never directly calls ESPN from visitors' browsers.
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import time
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

ROOT = Path(__file__).resolve().parents[1]
ESPN_URL = 'https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?season={}&seasontype=2'
ESPN_ALIASES = {
    'NY': 'NYK', 'NYK': 'NYK', 'GS': 'GSW', 'GSW': 'GSW',
    'SA': 'SAS', 'SAS': 'SAS', 'NO': 'NOP', 'NOP': 'NOP',
    'UTAH': 'UTA', 'UT': 'UTA', 'UTA': 'UTA', 'WSH': 'WAS', 'WAS': 'WAS',
    'BKN': 'BKN', 'BRK': 'BKN', 'PHO': 'PHX', 'PHX': 'PHX',
}


def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def json_to_js(payload):
    return 'window.LEAGUE_STANDINGS = ' + json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + ';\n'


def write_payload(payload, root=ROOT):
    """Write both representations. GitHub workflow commits them together."""
    (root / 'data' / 'standings.json').write_text(json.dumps(payload, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    (root / 'data' / 'standings.js').write_text(json_to_js(payload), encoding='utf-8')


def entry_nodes(obj):
    """Find all team/stats entry nodes, no matter the surrounding ESPN groups."""
    if isinstance(obj, dict):
        if isinstance(obj.get('team'), dict) and isinstance(obj.get('stats'), list):
            yield obj
        for child in obj.values():
            yield from entry_nodes(child)
    elif isinstance(obj, list):
        for child in obj:
            yield from entry_nodes(child)


def number_of_stat(stats, wanted):
    for stat in stats:
        if not isinstance(stat, dict):
            continue
        names = [str(stat.get(k, '')).strip().lower() for k in ('name', 'displayName', 'shortDisplayName', 'abbreviation', 'type')]
        matches = {'wins', 'win', 'w'} if wanted == 'wins' else {'losses', 'loss', 'l'}
        if not any(n in matches for n in names):
            continue
        for key in ('value', 'displayValue'):
            value = stat.get(key)
            try:
                result = float(value)
            except (ValueError, TypeError):
                continue
            if not result.is_integer():
                raise ValueError(f'Nonintegral {wanted} statistic: {value}')
            return int(result)
    return None


def normalize_code(team, known_names):
    code = str(team.get('abbreviation', '')).upper().strip()
    if code in ESPN_ALIASES:
        return ESPN_ALIASES[code]
    if code in known_names.values():
        return code
    raw = str(team.get('displayName', team.get('name', ''))).strip().lower()
    return known_names.get(raw)


def parse_espn(payload, league):
    """Strictly accept exactly 30 known NBA teams with reasonable records."""
    name_map = {t['name'].lower(): t['id'] for t in league['teams']}
    seen = {}
    for node in entry_nodes(payload):
        team = node['team']
        code = normalize_code(team, name_map)
        if not code or code not in set(name_map.values()):
            raise ValueError(f'Unrecognised team from ESPN: {team}')
        wins = number_of_stat(node['stats'], 'wins')
        losses = number_of_stat(node['stats'], 'losses')
        # Some provider versions include 'overall' as W-L if the numeric fields change.
        if wins is None or losses is None:
            overall = next((s for s in node['stats'] if str(s.get('name','')).lower() == 'overall'), None)
            match = re.match(r'^(\d+)-(\d+)$', str((overall or {}).get('displayValue', '')))
            if match:
                wins, losses = map(int, match.groups())
        if wins is None or losses is None or min(wins,losses)<0 or wins+losses>league['gamesPerTeam']:
            raise ValueError(f'Implausible wins/losses for {code}: {wins}, {losses}')
        if code in seen and seen[code] != {'wins': wins, 'losses': losses}:
            raise ValueError(f'Conflicting entries for {code}')
        seen[code] = {'wins': wins, 'losses': losses}
    expected = {t['id'] for t in league['teams']}
    if set(seen) != expected:
        raise ValueError(f'Expected 30 teams, got {len(seen)}. Missing {sorted(expected-set(seen))}, extra {sorted(set(seen)-expected)}')
    season = payload.get('season')
    if isinstance(season, dict) and isinstance(season.get('year'), int):
        if season['year'] != league['seasonYear']:
            raise ValueError(f'Unexpected season {season["year"]}, expected {league["seasonYear"]}')
    return {id: seen[id] for id in sorted(expected)}


def ensure_not_regressed(incoming, old):
    """Prevent provider rollbacks in which an individual team's record decreases."""
    for team, previous in old.get('teams', {}).items():
        if team not in incoming:
            continue
        latest = incoming[team]
        if latest['wins'] < previous['wins'] or latest['losses'] < previous['losses']:
            raise ValueError(f'{team} record regressed from {previous} to {latest}')


def fetch_json(url):
    request = Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; OULeague/1.0)', 'Accept':'application/json'})
    with urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode('utf-8'))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--fixture', type=Path, help='Test using a saved ESPN-like response; no network used')
    parser.add_argument('--dry-run', action='store_true', help='Validate without changing files')
    args = parser.parse_args()
    league = load_json(ROOT/'data'/'league.json')
    old = load_json(ROOT/'data'/'standings.json')
    url = ESPN_URL.format(league['seasonYear'])
    if args.fixture:
        data = load_json(args.fixture)
    else:
        last = None
        for attempt in range(3):
            try:
                data = fetch_json(url)
                break
            except (URLError, HTTPError, TimeoutError, ValueError, OSError) as exc:
                last = exc
                if attempt < 2:
                    time.sleep((attempt + 1) * 3)
        else:
            raise SystemExit(f'ESPN fetch failed; old results left untouched: {last}')
    incoming = parse_espn(data, league)
    # A transient provider error should not replace established season scores with zero.
    ensure_not_regressed(incoming, old)
    old_games = sum(t['wins']+t['losses'] for t in old['teams'].values())
    new_games = sum(t['wins']+t['losses'] for t in incoming.values())
    if new_games < old_games:
        raise SystemExit(f'Provider returned fewer total games ({new_games} vs {old_games}); old scores preserved')
    # Every individual team's record must progress monotonically, not merely the total.
    for team_id, fresh in incoming.items():
        previous = old['teams'].get(team_id) or {'wins':0, 'losses':0}
        if fresh['wins'] < previous['wins'] or fresh['losses'] < previous['losses']:
            raise SystemExit(f'Record for {team_id} went backwards; old scores preserved')
    if new_games == old_games and incoming == old['teams']:
        print('No changes in NBA standings; keeping existing last-updated timestamp')
        return
    payload = {'season': league['seasonYear'],
               'updatedAt': datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00','Z'),
               'source': 'ESPN standings (unofficial; see README)',
               'teams': incoming}
    if args.dry_run:
        print(f'Validated all {len(incoming)} teams, {new_games//2} games. Dry-run; no files changed.')
    else:
        write_payload(payload)
        # Preserve a daily championship-race snapshot of the actual projected margins.
        if new_games > 0:
            archive = load_json(ROOT/'data'/'snapshots.json')
            picks = league['picks']
            scores = {}
            for player in league['players']:
                margins = []
                for pick in picks:
                    if pick['player'] != player['name']:
                        continue
                    team_record = incoming[pick['team']]
                    games = team_record['wins'] + team_record['losses']
                    if games:
                        projected = team_record['wins'] / games * league['gamesPerTeam']
                        margins.append(projected - pick['line'] if pick['side']=='OVER' else pick['line'] - projected)
                scores[player['name']] = round(sum(margins), 2) if margins else None
            day = payload['updatedAt'][:10]
            archive['snapshots'] = [x for x in archive['snapshots'] if x['date'] != day]
            archive['snapshots'].append({'date': day, 'scores': scores})
            archive['snapshots'] = sorted(archive['snapshots'], key=lambda x:x['date'])
            (ROOT/'data'/'snapshots.json').write_text(json.dumps(archive, indent=2)+'\n', encoding='utf-8')
            (ROOT/'data'/'snapshots.js').write_text('window.LEAGUE_SNAPSHOTS = '+json.dumps(archive, separators=(',',':'))+';\n', encoding='utf-8')
        print(f'Updated {len(incoming)} teams, {new_games//2} games at {payload["updatedAt"]}')


if __name__ == '__main__':
    main()
