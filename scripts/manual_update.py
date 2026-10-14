#!/usr/bin/env python3
"""Emergency manual records update; useful via GitHub Actions workflow_dispatch.

Example: python scripts/manual_update.py --team PHX --wins 12 --losses 9
"""
import argparse
from datetime import datetime, timezone
from pathlib import Path
import sys
from update_standings import ROOT, load_json, write_payload

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--team',required=True,help='NBA team code, e.g. PHX or BOS')
    parser.add_argument('--wins',type=int,required=True)
    parser.add_argument('--losses',type=int,required=True)
    args=parser.parse_args()
    league=load_json(ROOT/'data'/'league.json')
    valid={t['id'] for t in league['teams']}
    team=args.team.strip().upper()
    if team not in valid:
        parser.error(f'Unknown NBA code {team}; choose among {sorted(valid)}')
    if min(args.wins,args.losses)<0 or args.wins+args.losses>league['gamesPerTeam']:
        parser.error('Wins/losses must be nonnegative integers and sum to at most 82')
    payload=load_json(ROOT/'data'/'standings.json')
    payload['teams'][team]={'wins':args.wins,'losses':args.losses}
    payload['updatedAt']=datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00','Z')
    payload['source']='Manual admin correction (next ESPN sync may replace this)'
    write_payload(payload)
    print(f'Updated {team} to {args.wins}-{args.losses}')

if __name__=='__main__':
    main()
