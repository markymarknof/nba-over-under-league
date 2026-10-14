# THE O/U LEAGUE — NBA 2026–27

A stand-alone basketball win-total draft competition for **Blake, Coz, Mark, Coby and Andy**. All 30 teams, six selections each, projected-margin scoring, a responsive scoreboard and every season's Hall of Champions.

**No Vercel, Vercel Blob, database, paid API key, running server, or work-related accounts.** This is a static website running from public GitHub Pages. Its updater runs on GitHub Actions, not on visitors' devices.

## Open and inspect it first

Open `index.html` in a normal browser, or run `python -m http.server 8000` from this folder and open `http://localhost:8000`. The site works locally without Node. The 2026–27 team records start blank/zero until the first successful standings update; historical 2025–26 results are already populated.

## Publish on a separate **personal** GitHub account

1. Create a **new public repository** in your personal GitHub account, e.g. `nba-over-under-league`. Do **not** use the work account, work GitHub organisation, Vercel account or any work credentials.
2. Put all the extracted project files in the repository root, keeping `assets/`, `data/`, `scripts/`, `tests/` and `.github/workflows/site.yml` in their folders. GitHub Desktop is a convenient way to upload whole folders, including the hidden `.github` folder.
3. Open **Settings → Pages** in GitHub. Under **Build and deployment**, set **Source: GitHub Actions**.
4. Open **Actions → Publish and update the O/U League → Run workflow**. The site is automatically published; GitHub will show its URL in the Pages/Actions area.
5. Share the URL with the boys. The scheduled job will attempt an NBA records update every **six hours**. It publishes the existing last-known-good records even when ESPN is unavailable.

**The files are built and tested, but the public site is not deployed until you upload the repository and enable Pages.** GitHub Actions scheduled tasks can be delayed and may turn off for long-inactive public repositories; you can run the workflow manually. The ESPN endpoint is unofficial, and future changes could require fixing the updater.

## Scoring (identical in principle to your Excel competition)

For each NBA team: `projected wins = (wins / (wins + losses)) × 82`.

- **Over:** points = projected wins − O/U line.
- **Under:** points = O/U line − projected wins.
- Sum all six margins for a player's running score; early-season pace scores can swing wildly.
- At game 82, projected wins equal actual wins and the points are final. Teams with no regular-season games show a dash rather than invented projected points.

## How the updates work

The single `.github/workflows/site.yml` workflow has **three triggers**: a commit to the `main` branch, a scheduled run every six hours, or a manual Run workflow action. A successful automated check:

1. Queries ESPN's unofficial **2026–27 regular-season** standings endpoint from a GitHub machine.
2. Checks that all 30 NBA franchises have plausible scores, with no backward-moving records or season mismatch.
3. Updates the static `data/standings.json` and `data/standings.js` files if any scores changed.
4. Publishes fresh site files directly in the **same workflow run**. This avoids GitHub's special behaviour where bot-created commits do not trigger a separate publish workflow.

Visitors never call the sports API, write to storage or interact with a backend. The site does not collect personal details or have analytics.

## Manual correction (if needed)

GitHub Actions → **Publish and update the O/U League** → **Run workflow** → select **manual**, enter the NBA team code and its wins/losses, and run. The new site and persisted data will update. The next automatic ESPN update may overwrite the manual correction if it sees new valid data, though safeguards reject regressions.

For local manual correction: `python scripts/manual_update.py --team PHX --wins 12 --losses 9` then commit/push the changed `data/standings.*` files.

## Preserve future champions

All 30 previous-season original bets and final standings are already in `data/history.json` / `data/history.js`. The inaugural champion was Andrew, **+34.5 points, 4/5 bets correct**.

At the **end** of the 2026–27 regular season, once all 30 teams have **82 games**, run `python scripts/close_season.py`, then commit/push the updated `data/history.json` and `data/history.js`. This appends the completed season and safeguards all previous champions. It refuses to silently choose a champion when first place is tied. At the start of the next season, update the separate current draft data/season in `data/league.json` and `data/league.js` without altering the historical archive.

## Tests

Run `python -m unittest discover -s tests -v` — no extra Python packages necessary.

## Important limits

- The site is **public**; anyone with the link can view it. Never commit passwords, keys or sensitive information.
- For an ordinary hobby website on a personal public repository, GitHub Pages and light Actions usage are available within GitHub Free's limits; usage caps and policies may change.
- ESPN is an **unofficial public data provider**, not a guaranteed service; the last successful update remains visible if ESPN fails.
- The site is not affiliated with the NBA, ESPN or its teams.

## New arena redesign (2026–27)

The refreshed site adds illustrated player identities, live colour-coded picks,
individual player profiles, projected power rankings, head-to-head comparisons,
a championship race chart, and the original Hall of Champions.

**All stats are genuine:** cards deliberately remain unranked before the first
NBA results are loaded. There are no simulated box scores, dates, standings,
or historic rivalries on the public website.

The `data/snapshots.json` and matching `.js` file store one daily projected
score snapshot after standings change, allowing the Race page to draw actual
historical movement over time. They are stored in GitHub with the rest of the
static site, not in Blob or a database. Future seasons should archive their
snapshots separately before resetting the season.

Artwork under `assets/mascots/` is original AI-generated art created for this
friends' competition; mascot cards aren't official NBA brands.
