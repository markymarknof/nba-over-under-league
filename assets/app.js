/* The O/U League — static, no cookies, no database, no third-party JavaScript. */
(() => {
  'use strict';
  const config = window.LEAGUE_CONFIG;
  const history = window.LEAGUE_HISTORY;
  const standings = window.LEAGUE_STANDINGS;
  const content = document.getElementById('content');
  if (!config || !history || !standings || !content) {
    document.getElementById('content').textContent = 'League data could not be loaded. Check that all website files were uploaded together.';
    return;
  }
  const players = config.players;
  const teamById = Object.fromEntries(config.teams.map(t => [t.id, t]));
  const leagueHasScores = Boolean(standings.updatedAt) && Object.values(standings.teams || {}).some(t => Number(t.wins) + Number(t.losses) > 0);
  const firstSeason = history.seasons.find(s => s.champion);
  const frac = n => Number(n).toFixed(1);
  const signed = n => (n > 0 ? '+' : '') + frac(n);
  const html = s => String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const formatDate = s => { if (!s) return 'Awaiting first update'; const dt = new Date(s); return Number.isNaN(dt.getTime()) ? 'Unknown' : new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Sydney',day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(dt); };
  const results = config.picks.map(p => {
    const team = teamById[p.team];
    const record = standings.teams[p.team] || {wins:0,losses:0};
    const wins = Number(record.wins) || 0, losses = Number(record.losses) || 0;
    const gp = wins + losses;
    const proj = gp > 0 ? config.gamesPerTeam * wins / gp : null;
    const margin = proj === null ? null : (p.side === 'OVER' ? proj - p.line : p.line - proj);
    const clinched = gp >= config.gamesPerTeam ? (margin > 0 ? 'WON' : 'LOST') : null;
    return { ...p, teamInfo:team, wins, losses, gp, proj, margin, clinched };
  });
  const playerResult = players.map(player => {
    const picks = results.filter(p => p.player === player.name);
    const scored = picks.filter(p => p.margin !== null);
    const score = scored.length ? scored.reduce((total,p) => total + p.margin,0) : null;
    const hits = scored.filter(p => p.margin > 0).length;
    return {...player,picks,score,hits,scored:scored.length,completed:picks.filter(p=>p.clinched!==null).length};
  });
  const sorted = [...playerResult].sort((a,b) => (b.score ?? -Infinity)-(a.score ?? -Infinity) || players.findIndex(x=>x.name===a.name)-players.findIndex(x=>x.name===b.name));
  const totalGames = config.teams.reduce((n,t)=>n+(Number(standings.teams[t.id]?.wins)||0)+(Number(standings.teams[t.id]?.losses)||0),0);
  const numGames = Math.round(totalGames/2);
  const syncPill = document.getElementById('header-sync');
  syncPill.classList.toggle('active',Boolean(standings.updatedAt));
  syncPill.innerHTML = `<i class="pulse-dot"></i> ${standings.updatedAt ? 'UPDATED ' + html(formatDate(standings.updatedAt).split(',')[0]) : 'AWAITING SYNC'}`;
  const el = (selector,context=document)=>context.querySelector(selector);
  const emblem = (p,large=false)=> `<span class="animal ${large?'large':''}" style="--player:${p.color}" aria-hidden="true">${p.emblem}</span>`;
  const mark = (t,mini=false)=>`<span class="team-mark ${mini?'mini-team':''}" style="--team-primary:${t.primary};--team-secondary:${t.secondary}" aria-hidden="true">${html(t.id)}</span>`;
  const label = p => `<span class="bet-pick ${p.side.toLowerCase()}">${p.side}<b>${frac(p.line)}</b></span>`;
  const scoreClass = n => n === null ? 'neutral' : n>0?'positive':n<0?'negative':'neutral';
  const scoreText = n => n===null ? '—' : signed(n);
  const pageHead = (eyebrow,title,description) => `<div class="page-header"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="text-muted small">${description}</p></div></div>`;
  const note = message => `<div class="league-note">${message}</div>`;
  const progress = (n,d=82) => `<span class="progress-track"><span class="progress-fill" style="display:block;width:${Math.min(100,Math.max(0,100*n/d)).toFixed(1)}%"></span></span>`;

  function board() {
    const lead = sorted[0];
    return `<div class="board panel" role="table" aria-label="Competition leaderboard">
      <div class="board-head" role="row"><span>#</span><span>Player</span><span>On pace</span><span>Games*</span><span style="text-align:right">Projected pts</span></div>
      ${sorted.map((p,i)=>`<div class="board-row" role="row" style="--player:${p.color}">
        <span class="place ${leagueHasScores && p.score!==null && p.name===lead.name?'first':''}">${leagueHasScores ? i+1 : '—'}</span>
        <span class="player-cell">${emblem(p)}<span><span class="player-name" style="color:${p.color}">${html(p.name)}</span><span class="player-under">6 picks · ${p.completed} final</span></span></span>
        <span class="metric">${p.scored ? p.hits+'/6' : '—'}<small>winning</small></span>
        <span class="metric">${p.scored ? Math.round(p.picks.reduce((sum,r)=>sum+r.gp,0)/6) : '0'}<small>avg /82</small></span>
        <span class="score ${scoreClass(p.score)}">${scoreText(p.score)}</span>
      </div>`).join('')}
    </div>`;
  }
  function dashboard() {
    const winner = firstSeason || {};
    const leading = leagueHasScores && sorted[0].score!==null ? sorted[0].name : 'TBD';
    return `<section class="hero">
      <div class="hero-copy"><p class="eyebrow">2026–27 SEASON · FIVE PLAYERS · 30 TEAMS</p><h1>Every win.<br><em>Every point.</em></h1><p>Six teams each. Over or under the line. One champion when the final buzzer sounds.</p><div class="hero-bottom"><span class="season-year">SEASON 02</span><span>${leagueHasScores?'Standings refreshed':'Awaiting 2026–27 results'}</span><span>🏆 Defending champ: ${html(winner.champion)}</span></div></div>
      <div class="hero-ball" aria-hidden="true"><svg viewBox="0 0 200 200" fill="none" stroke="#563326" stroke-width="6"><circle cx="100" cy="100" r="86"/><path d="M100 14v172M14 100h172M34 45c65 35 65 75 0 110M166 45c-65 35-65 75 0 110"/></svg></div>
    </section>
    <div class="stats-grid">
      ${[['Current leader',leading,leagueHasScores?'Based on projected points':'Nobody leads before tip-off'],['Recorded games',numGames+'',`${Math.min(1230,numGames)} of 1,230 regular-season games`],['Teams drafted','30 / 30','Every team claimed'],['Historical titles',history.seasons.filter(s=>s.champion).length+'','Annual champions preserved']].map(([k,v,sub])=>`<div class="stat-card"><div class="stat-label">${k}</div><div class="stat-value">${html(v)}</div><div class="stat-hint">${sub}</div></div>`).join('')}
    </div>
    <div class="section-heading"><h2><span class="heading-marker"></span>League standings</h2><p>82-game projected scoring · live when records are available</p></div>
    <div class="dashboard-grid"><div>${board()}</div><div class="stack-col">
      <section class="champ-card panel"><div class="champ-top"><span>★ HALL OF CHAMPIONS</span><span class="laurel">🏆</span></div><div class="champ-name">${html(winner.champion)}</div><div class="champ-score"><strong>${signed(winner.score)}</strong> pts · 2025–26 CHAMPION</div><div class="champ-footer"><span>${winner.hits} / ${winner.bets} picks hit</span><span>Defending title</span></div></section>
      <section class="rules-card panel"><div class="rules-title">How scoring works</div><p class="rules-copy">Each team’s current win percentage is projected across 82 games. For Over picks you earn the difference above the line; Under picks gain the difference below. The score can swing sharply early in the season.</p><div class="rules-formula">OVER → projected wins − line<br>UNDER → line − projected wins</div><p class="rules-copy">All six bet margins are added for each player. Positive points are good. The final score is settled after 82 games.</p><a class="action-link" href="#guide">See scoring details →</a></section>
    </div></div>
    ${note(`${leagueHasScores?'Current data from':'Automatic updates will use'} <strong>${html(standings.source||'NBA records')}</strong>. Last check: <strong>${html(formatDate(standings.updatedAt))}</strong>. ${leagueHasScores?'Projections are not guaranteed outcomes.':'No live NBA records have been loaded yet, so all scores display as unranked.'}`)}
    `;
  }
  let draftFilter='All';
  function draft() {
    const current = draftFilter;
    return `${pageHead('The 2026–27 draft','The Draft','Every pick from draft night. Six bets per player, with the same line used for the whole season.')}
      <div class="filters" role="group" aria-label="Filter draft by player">${['All',...players.map(p=>p.name)].map(n=>`<button type="button" class="filter-button ${current===n?'active':''}" data-draft-filter="${n}">${n==='All'?'All players':n}</button>`).join('')}</div>
      <div class="draft-grid">${playerResult.filter(p=>current==='All'||p.name===current).map(p=>`<section class="draft-card" style="--player:${p.color}">
        <div class="draft-top"><div class="draft-heading">${emblem(p,true)}<div><h2 class="draft-name">${html(p.name)}</h2><div class="draft-summary">${p.picks.filter(x=>x.side==='OVER').length} Over · ${p.picks.filter(x=>x.side==='UNDER').length} Under · 6 picks</div></div></div><div class="draft-total ${scoreClass(p.score)}">${scoreText(p.score)}<span class="draft-total-label">PROJECTED PTS</span></div></div>
        <div class="bet-list">${p.picks.map(pick=>`<div class="bet-row">${mark(pick.teamInfo)}<div><div class="team-title">${html(pick.teamInfo.name)}</div><div class="team-detail">${pick.gp>0?`${pick.wins}–${pick.losses} · Projected ${frac(pick.proj)} wins`:'No results yet'}</div></div><div>${label(pick)}${pick.margin!==null?`<div class="mini ${scoreClass(pick.margin)}" style="text-align:center;padding-top:5px">${scoreText(pick.margin)} pts</div>`:''}</div></div>`).join('')}</div>
        <div class="draft-foot"><span>${p.scored?p.hits+' on pace':'Awaiting games'}</span><span>${p.completed} / 6 settled</span></div>
      </section>`).join('')}</div>
      ${note('Bets are locked from the original draft: <strong>Blake — Phoenix Suns OVER 40.5</strong>, and <strong>Andy — Los Angeles Lakers UNDER 46.5</strong>. Player names remain plain, with animal emblems as decoration.')}`;
  }
  let teamFilter = 'All', teamSearch = '';
  function teams() {
    const filtered = [...config.teams].filter(t => (teamFilter==='All'||t.conf===teamFilter)&&(`${t.name} ${t.id}`.toLowerCase().includes(teamSearch.toLowerCase())));
    return `${pageHead('All thirty franchises','Team Records','The results driving every bet. Updated automatically from the standings source.')}
      <div class="filters"><button class="filter-button ${teamFilter==='All'?'active':''}" data-team-filter="All">All</button><button class="filter-button ${teamFilter==='East'?'active':''}" data-team-filter="East">Eastern Conference</button><button class="filter-button ${teamFilter==='West'?'active':''}" data-team-filter="West">Western Conference</button><span class="filter-spacer"></span><input class="search" id="team-search" type="search" placeholder="Find a team…" value="${html(teamSearch)}" aria-label="Search teams"></div>
      <div id="team-results"></div>
      ${note(`<strong>Last updated:</strong> ${html(formatDate(standings.updatedAt))}. The site does not track visitors or write data when the page is opened. The scheduled updater prepares the records in advance.`)}`;
  }
  function teamTable() {
    const filtered = results.filter(r=>(teamFilter==='All'||r.teamInfo.conf===teamFilter)&&(`${r.teamInfo.name} ${r.teamInfo.id}`.toLowerCase().includes(teamSearch.toLowerCase())));
    return `<div class="wide-table-wrap"><table class="wide-table"><thead><tr><th>Team</th><th>Owner</th><th>Pick</th><th class="numeric">W–L</th><th class="numeric">Games</th><th class="numeric">Proj. wins</th><th class="numeric">Bet margin</th></tr></thead><tbody>
      ${filtered.map(r=>`<tr><td><span class="table-team">${mark(r.teamInfo,true)} ${html(r.teamInfo.name)}</span></td><td class="table-muted">${html(r.player)}</td><td><span class="${r.side==='OVER'?'over-text':'under-text'}"><strong>${r.side}</strong> ${frac(r.line)}</span></td><td class="numeric">${r.wins}–${r.losses}</td><td class="numeric">${r.gp}/82</td><td class="numeric">${r.proj===null?'—':frac(r.proj)}</td><td class="numeric ${scoreClass(r.margin)}">${scoreText(r.margin)}</td></tr>`).join('')}
      </tbody></table>${filtered.length?'':'<div class="empty-state">No matching teams.</div>'}</div>`;
  }
  function hall() {
    const past=history.seasons.filter(s=>s.champion);
    const winner=past[0];
    return `${pageHead('The league legacy','Hall of Champions','Every championship is preserved here, including the previous season’s final standings and individual bets.')}
      <section class="history-hero"><div><p class="eyebrow">INAUGURAL CHAMPION · 2025–26</p><h2>🏆 ${html(winner.champion)}</h2><p class="stat-line">${signed(winner.score)} POINTS · ${winner.hits}/${winner.bets} PICKS CORRECT</p><p class="tip">First name on the trophy. The new season is still up for grabs.</p></div><div class="hero-crown" aria-hidden="true">🏆</div></section>
      <div class="section-heading"><h2><span class="heading-marker"></span>Championship ledger</h2><p>One permanent record per season</p></div>
      <div class="history-list">${history.seasons.map(s=>`<div class="history-entry"><div><div class="history-year">${html(s.season)}</div><div class="history-stats">${s.champion?`${s.hits}/${s.bets} correct · ${signed(s.score)} points`:html(s.status||'In progress')}</div></div><div class="history-champion">${s.champion?'🏆 '+html(s.champion):'To be crowned'}</div></div>`).join('')}</div>
      ${past.map(s=>`<details class="archive-details" ${s===winner?'open':''}><summary>${html(s.season)} · Complete archived results</summary><div class="archive-inner">
        <h3>Final standings</h3><div class="wide-table-wrap" style="margin-top:14px"><table class="wide-table" style="min-width:450px"><thead><tr><th>Place</th><th>Player</th><th class="numeric">Correct</th><th class="numeric">Final points</th></tr></thead><tbody>${s.standings.map((r,i)=>`<tr><td>${i+1}</td><td><strong>${html(r.player)}</strong></td><td class="numeric">${r.hits}/${r.bets}</td><td class="numeric ${scoreClass(r.points)}">${signed(r.points)}</td></tr>`).join('')}</tbody></table></div>
        <h3 style="margin-top:27px">Every pick</h3><div class="archive-grid">${s.standings.map(r=>`<div class="archive-card"><h3>${html(r.player)} <span class="mini gold-text">${signed(r.points)}</span></h3>${s.picks.filter(p=>p.player===r.player).map(p=>`<div class="archive-bet"><span>${html(p.team)}</span><span class="${p.side==='OVER'?'over-text':'under-text'}">${html(p.side)} ${frac(p.line)}</span><span class="${scoreClass(p.margin)}">${signed(p.margin)}</span></div>`).join('')}</div>`).join('')}</div>
      </div></details>`).join('')}
      ${note('Historical 2025–26 results are taken from the original competition spreadsheet, including its original participant names. To preserve each future champion, use the included end-of-season archive script once all teams finish 82 games.')}`;
  }
  function guide() {
    return `${pageHead('Rules & methodology','How It Works','Simple rules. Automatic standings. Every point can be checked against a win total.')}
      <div class="guide-grid">${[
        ['01','Draft night','Five players each select six different NBA teams. Every selection is Over or Under that team’s fixed pre-season win-total line.'],
        ['02','NBA standings','A scheduled GitHub Action fetches each franchise’s wins and losses. Nothing runs in the visitor’s browser apart from displaying the result.'],
        ['03','Projected wins','Projected wins = (wins ÷ games played) × 82. For example, 25 wins in 50 games projects to 41 wins for the full season.'],
        ['04','Bet points','For OVER, points = projected wins − betting line. For UNDER, points = betting line − projected wins. Six margins are added for the player’s score.'],
        ['05','Season champion','When every team finishes its 82 regular-season games, the final projected wins equal actual wins. Highest total point score wins. Ties are shown as ties until a tiebreak is agreed.'],
        ['06','Hall of Champions','Previous winners and their full bets are saved permanently in the site’s history data. A new season can be added without wiping earlier champions.']
      ].map(([n,title,desc])=>`<section class="guide-card panel"><div class="guide-number">${n} / THE RULES</div><h3>${title}</h3><p>${desc}</p></section>`).join('')}</div>
      ${note('<strong>Important:</strong> A team that starts 1–0 projects to 82 wins under the raw pace formula. Early-season scores can be very volatile, so treat the leaderboard as an indication rather than a prediction. The Hall of Champions only crowns a winner after the full season.')}
      <div class="section-heading" style="margin-top:35px"><h2><span class="heading-marker"></span>Website status</h2></div>
      <div class="wide-table-wrap"><table class="wide-table" style="min-width:450px"><tbody><tr><td>Hosting</td><td>GitHub Pages (static files)</td></tr><tr><td>Database / Blob</td><td>None</td></tr><tr><td>Scheduled sync</td><td>GitHub Actions</td></tr><tr><td>Score source</td><td>${html(standings.source||'Pending NBA data')}</td></tr><tr><td>Last successful update</td><td>${html(formatDate(standings.updatedAt))}</td></tr><tr><td>Personal accounts needed to view</td><td>None</td></tr></tbody></table></div>`;
  }
  const views={dashboard, draft, teams, history:hall, guide};
  function activate() {
    const hash=(location.hash||'#dashboard').replace('#','');
    const view=views[hash] ? hash : 'dashboard';
    document.querySelectorAll('[data-nav]').forEach(a=>{const active=a.dataset.nav===view;a.classList.toggle('active',active);a.setAttribute('aria-current',active?'page':'false');});
    content.innerHTML=views[view]();
    if (view==='teams') renderTeamResults();
    content.querySelectorAll('[data-draft-filter]').forEach(b=>b.addEventListener('click',()=>{draftFilter=b.dataset.draftFilter;activate();}));
    content.querySelectorAll('[data-team-filter]').forEach(b=>b.addEventListener('click',()=>{teamFilter=b.dataset.teamFilter;content.querySelectorAll('[data-team-filter]').forEach(x=>x.classList.toggle('active',x.dataset.teamFilter===teamFilter));renderTeamResults();}));
    const search=el('#team-search',content);
    if(search) search.addEventListener('input',e=>{teamSearch=e.target.value;renderTeamResults();});
  }
  function renderTeamResults(){const target=el('#team-results',content);if(target)target.innerHTML=teamTable();}
  window.addEventListener('hashchange',activate);
  activate();
})();
