"""Run with: python -m unittest discover -s tests -v (no dependencies)."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
from update_standings import parse_espn, json_to_js, load_json

ROOT=Path(__file__).resolve().parents[1]
CONFIG=load_json(ROOT/'data/league.json')
HISTORY=load_json(ROOT/'data/history.json')


def fixture(records=None):
    records=records or {t['id']:(0,0) for t in CONFIG['teams']}
    byabbr={'NYK':'NY','GSW':'GS','SAS':'SA','NOP':'NO','WAS':'WSH','PHX':'PHO'}
    entries=[]
    for t in CONFIG['teams']:
        w,l=records[t['id']]
        entries.append({'team':{'abbreviation':byabbr.get(t['id'],t['id']),'displayName':t['name']},
                        'stats':[{'name':'wins','value':w},{'name':'losses','value':l}]})
    return {'season':{'year':2027},'children':[{'standings':{'entries':entries[:15]}},
                                            {'standings':{'entries':entries[15:]}}]}

class LeagueIntegrity(unittest.TestCase):
    def test_30_unique_teams_and_six_picks_per_player(self):
        self.assertEqual(len(CONFIG['teams']),30)
        self.assertEqual(len(CONFIG['picks']),30)
        self.assertEqual(len(set(p['team'] for p in CONFIG['picks'])),30)
        self.assertEqual({p['name'] for p in CONFIG['players']},{p['player'] for p in CONFIG['picks']})
        for player in CONFIG['players']:
            self.assertEqual(sum(p['player']==player['name'] for p in CONFIG['picks']),6)
        self.assertTrue(all(p['side'] in ('OVER','UNDER') and isinstance(p['line'],float) for p in CONFIG['picks']))
    def test_player_colours_and_mascots(self):
        expected={'Blake':'#278fff','Coz':'#bc60ff','Mark':'#17e3a2','Coby':'#ff3d67','Andy':'#ffbd38'}
        self.assertEqual({p['name']:p['color'] for p in CONFIG['players']},expected)
        for name in expected:
            self.assertTrue((ROOT/'assets'/'mascots'/(name.lower()+'.webp')).is_file())
    def test_snapshots_are_real_and_well_formed(self):
        archive=load_json(ROOT/'data'/'snapshots.json')
        self.assertEqual(archive['season'],2027)
        self.assertIsInstance(archive['snapshots'],list)
        dates=[]
        player_names={p['name'] for p in CONFIG['players']}
        for snapshot in archive['snapshots']:
            self.assertEqual(len(snapshot['date']),10)
            self.assertTrue(snapshot['date'].startswith(('2026-','2027-')))
            self.assertEqual(set(snapshot['scores']),player_names)
            self.assertTrue(all(s is None or (isinstance(s,(int,float)) and not isinstance(s,bool)) for s in snapshot['scores'].values()))
            dates.append(snapshot['date'])
        self.assertEqual(dates,sorted(set(dates)))
    def test_corrected_bets(self):
        lookup={p['team']:p for p in CONFIG['picks']}
        self.assertEqual((lookup['PHX']['player'],lookup['PHX']['side'],lookup['PHX']['line']),('Blake','OVER',40.5))
        self.assertEqual((lookup['LAL']['player'],lookup['LAL']['side'],lookup['LAL']['line']),('Andy','UNDER',46.5))
    def test_history_has_previous_champion_and_picks(self):
        old=HISTORY['seasons'][0]
        self.assertEqual((old['champion'],old['score'],old['hits']),('Andrew',34.5,4))
        self.assertEqual(len(old['picks']),30)
        self.assertEqual(len(old['standings']),6)
        self.assertIsNone(HISTORY['seasons'][1]['champion'])
    def test_fixture_parser_all_teams(self):
        parsed=parse_espn(fixture(),CONFIG)
        self.assertEqual(len(parsed),30)
        self.assertEqual(parsed['NYK'],{'wins':0,'losses':0})
    def test_reject_incomplete_and_invalid_season(self):
        item=fixture()
        item['children'][0]['standings']['entries'].pop()
        with self.assertRaises(ValueError):parse_espn(item,CONFIG)
        item=fixture()
        item['season']['year']=2026
        with self.assertRaises(ValueError):parse_espn(item,CONFIG)
    def test_reject_impossible_result(self):
        r={t['id']:(0,0) for t in CONFIG['teams']}
        r['PHX']=(60,50)
        with self.assertRaises(ValueError):parse_espn(fixture(r),CONFIG)
    def test_points_direction_consistency(self):
        picks={p['team']:p for p in CONFIG['picks']}
        over=picks['PHX']; under=picks['LAL']
        self.assertEqual(45-over['line'],4.5)
        self.assertEqual(under['line']-45,1.5)

if __name__=='__main__':unittest.main()
