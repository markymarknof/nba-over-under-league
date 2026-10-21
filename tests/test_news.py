"""Checks that the headlines feed rejects unsafe links and stale stories."""
import json
from datetime import datetime, timezone
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from update_news import parse_news

NOW = datetime(2026,10,21,4,0,0,tzinfo=timezone.utc)
def entry(headline, url, published="2026-10-21T03:00:00Z"):
    return {"headline":headline,"links":{"web":{"href":url}},"published":published}

class HeadlineSafety(unittest.TestCase):
    def test_valid_recent_espn_headline(self):
        feed={"articles":[entry("Sixers win a close opening game","https://www.espn.com/nba/story/_/id/123/test")]}
        self.assertEqual(len(parse_news(feed,NOW)),1)

    def test_reject_untrusted_or_stale(self):
        feed={"articles":[
            entry("javascript payload injected", "javascript:alert(1)"),
            entry("External website link", "https://evil.example/steal"),
            entry("Article from last season", "https://www.espn.com/nba/story/1", "2026-01-01T03:00:00Z"),
        ]}
        self.assertEqual(parse_news(feed,NOW),[])

    def test_feed_must_have_articles(self):
        with self.assertRaises(ValueError):
            parse_news({},NOW)

if __name__=="__main__":
    unittest.main()
