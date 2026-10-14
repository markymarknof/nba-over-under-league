#!/usr/bin/env python3
"""Automatically append the season champion when every NBA team has 82 games."""
from update_standings import ROOT, load_json
from close_season import main as close_season

def main():
    league = load_json(ROOT/'data'/'league.json')
    records = load_json(ROOT/'data'/'standings.json')['teams']
    season = next((s for s in load_json(ROOT/'data'/'history.json')['seasons'] if s['season']==league['season']),None)
    if season and season.get('champion'):
        print('Championship already archived. Nothing to do.')
        return
    if len(records)==30 and all(r['wins']+r['losses']==82 for r in records.values()):
        close_season()  # Can fail if there is a first-place tie: needs manual tiebreaker.
    else:
        print('Regular season not finished. Hall of Champions unchanged.')

if __name__=='__main__':
    main()
