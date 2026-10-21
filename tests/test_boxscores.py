"""Box score endpoint shape, game-date selection and honest stat-leader testing."""
from datetime import datetime, timezone
from pathlib import Path
import sys
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1] / "scripts"))
from update_boxscores import (
    final_regular_season_events, parse_summary, player_sort_key,
    build_digest, stat_int
)

class PlayerBoxScores(unittest.TestCase):
    def setUp(self):
        self.box={
            "boxscore":{"players":[
                {"team":{"abbreviation":"PHI"},
                 "statistics":[{"names":["MIN","FG","REB","AST","STL","BLK","PTS"],
                 "athletes":[
                  {"athlete":{"id":"101","displayName":"A. Superstar"},"stats":["36","14-25","12","10","3","2","44"]},
                  {"athlete":{"id":"102","displayName":"B. Wing"},"stats":["33","9-18","4","2","1","0","26"]},
                  {"athlete":{"id":"103","displayName":"Not Playing"},"didNotPlay":True,"stats":["--","--","--","--","--","--","--"]}
                 ]}]},
                {"team":{"abbreviation":"NYK"},
                 "statistics":[{"labels":["MIN","REB","AST","PTS"],
                 "athletes":[{"athlete":{"id":"104","displayName":"C. Rebounder"},"stats":["37","21","6","25"]}]}]}
            ]}
        }

    def test_filter_only_completed_regular_season_games(self):
        games={"events":[
            {"id":"111","season":{"type":1},"status":{"type":{"completed":True}}},
            {"id":"222","season":{"type":2},"status":{"type":{"completed":True}}},
            {"id":"333","season":{"type":2},"status":{"type":{"completed":False}}},
        ]}
        self.assertEqual(final_regular_season_events(games),["222"])

    def test_stats_ignore_dnp_and_parse_full_lines(self):
        found=parse_summary(self.box,"222")
        self.assertEqual(len(found),3)
        self.assertEqual(found[0]["points"],44)
        self.assertEqual(found[0]["assists"],10)
        self.assertEqual(found[0]["rebounds"],12)
        self.assertEqual(found[2]["rebounds"],21)
        self.assertEqual(found[2]["steals"],0)

    def test_leaders_and_exciting_players(self):
        players=parse_summary(self.box,"222")
        dig=build_digest("2026-10-20",["222"],players,datetime(2026,10,21,tzinfo=timezone.utc))
        self.assertEqual(dig["gameDate"],"2026-10-20")
        self.assertEqual(dig["leaders"]["points"]["name"],"A. Superstar")
        self.assertEqual(dig["leaders"]["rebounds"]["name"],"C. Rebounder")
        self.assertEqual(dig["leaders"]["assists"]["name"],"A. Superstar")
        self.assertEqual(len(dig["performers"]),3)
        self.assertGreater(player_sort_key(players[0]),player_sort_key(players[1]))

    def test_no_made_up_stats(self):
        self.assertIsNone(stat_int("DNP"))
        self.assertIsNone(stat_int("10-20"))
        with self.assertRaises(ValueError):
            build_digest("2026-10-20",[],[])

if __name__=="__main__":
    unittest.main()
