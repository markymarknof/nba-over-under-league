#!/usr/bin/env python3
"""At season-end, archive every result without removing past champions.

Only run after ALL 30 teams have each played 82 games. A tie requires an agreed
external tiebreaker; this script deliberately refuses to pick one arbitrarily.
"""
import json
from pathlib import Path
from update_standings import ROOT, load_json


def main():
    league=load_json(ROOT/'data'/'league.json')
    standings=load_json(ROOT/'data'/'standings.json')
    history=load_json(ROOT/'data'/'history.json')
    year=league['season']
    current=next((s for s in history['seasons'] if s['season']==year),None)
    if current and current.get('champion'):
        raise SystemExit(f'{year} is already archived. No changes made.')
    records=standings['teams']
    if set(records)!={t['id'] for t in league['teams']} or any(r['wins']+r['losses'] != 82 for r in records.values()):
        raise SystemExit('All 30 NBA teams must have exactly 82 games. No changes made.')
    names={t['id']:t['name'] for t in league['teams']}
    picks=[]
    for p in league['picks']:
        r=records[p['team']]
        margin=(r['wins']-p['line']) if p['side']=='OVER' else (p['line']-r['wins'])
        picks.append({'player':p['player'],'team':names[p['team']],'side':p['side'],'line':p['line'],
                      'wins':r['wins'],'losses':r['losses'],'projected':float(r['wins']),'margin':round(margin,2)})
    ranking=[]
    for player in league['players']:
        sub=[p for p in picks if p['player']==player['name']]
        ranking.append({'player':player['name'],'points':round(sum(p['margin'] for p in sub),2),
                        'hits':sum(p['margin']>0 for p in sub),'bets':len(sub)})
    ranking.sort(key=lambda x:-x['points'])
    if ranking[0]['points']==ranking[1]['points']:
        raise SystemExit('Tie at the top. Agree a tiebreaker before archiving a champion.')
    winner=ranking[0]
    archived={'season':year,'champion':winner['player'],'score':winner['points'],'hits':winner['hits'],
              'bets':winner['bets'],'standings':ranking,'picks':picks}
    if current:
        history['seasons']=[archived if s['season']==year else s for s in history['seasons']]
    else:
        history['seasons'].append(archived)
    (ROOT/'data'/'history.json').write_text(json.dumps(history,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    (ROOT/'data'/'history.js').write_text('window.LEAGUE_HISTORY = '+json.dumps(history,separators=(',',':'),ensure_ascii=False)+';\n',encoding='utf-8')
    print(f'Archived {year} champion: {winner["player"]} ({winner["points"]:+.1f} points). Existing seasons retained.')

if __name__=='__main__':
    main()
