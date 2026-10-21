/* The O/U League — static, no cookies, no database, no third-party JavaScript. */
(() => {
  'use strict';
  const config = window.LEAGUE_CONFIG;
  const history = window.LEAGUE_HISTORY;
  const standings = window.LEAGUE_STANDINGS;
  const snapshots = window.LEAGUE_SNAPSHOTS || {snapshots:[]};
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
  const emblem = (p,large=false)=> `<span class="animal ${large?'large':''}" style="--player:${p.color}" aria-hidden="true"><img src="assets/mascots/${p.name.toLowerCase()}.webp" alt="" loading="lazy"></span>`;
  const mark = (t,mini=false)=>`<span class="team-mark ${mini?'mini-team':''}" style="--team-primary:${t.primary};--team-secondary:${t.secondary}" aria-hidden="true">${html(t.id)}</span>`;
  const label = p => `<span class="bet-pick ${p.side.toLowerCase()}">${p.side}<b>${frac(p.line)}</b></span>`;
  const scoreClass = n => n === null ? 'neutral' : n>0?'positive':n<0?'negative':'neutral';
  const scoreText = n => n===null ? '—' : signed(n);
  const pageHead = (eyebrow,title,description) => `<div class="page-header"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="text-muted small">${description}</p></div></div>`;
  const note = message => `<div class="league-note">${message}</div>`;
  const progress = (n,d=82) => `<span class="progress-track"><span class="progress-fill" style="display:block;width:${Math.min(100,Math.max(0,100*n/d)).toFixed(1)}%"></span></span>`;


  // League Pulse: only verified NBA results and saved daily league snapshots.
  const boxscores = window.LEAGUE_BOXSCORES || {performers:[],leaders:{}};
  const boxDate = boxscores.gameDate && /^\d{4}-\d{2}-\d{2}$/.test(boxscores.gameDate) ? boxscores.gameDate : null;
  const isRecentBoxDate = boxDate && Number.isFinite(Date.parse(boxDate+'T12:00:00Z'))
    && Date.now()-Date.parse(boxDate+'T12:00:00Z') < 5*86400000;
  const verifiedBoxLines = (isRecentBoxDate && Array.isArray(boxscores.performers) ? boxscores.performers : []).filter(line =>
    line && typeof line.name==='string' && typeof line.team==='string' &&
    Number.isFinite(line.points) && Number.isFinite(line.rebounds) && Number.isFinite(line.assists) &&
    /^\d+$/.test(String(line.gameId || ''))
  );
  function nightlyMonsters(){
    const boxUrl = line => 'https://www.espn.com/nba/boxscore/_/gameId/'+encodeURIComponent(line.gameId);
    const displayDate = boxDate ? new Intl.DateTimeFormat('en-AU',{timeZone:'UTC',month:'short',day:'numeric'})
      .format(new Date(boxDate+'T12:00:00Z')) : '';
    if (!verifiedBoxLines.length) return '<div class="monster-empty"><strong>WAITING FOR THE NEXT NBA SLATE</strong>'
      + '<p>Crazy stat lines and tonight’s PTS, REB and AST leaders appear once the latest box scores are final.</p></div>';
    const lines=verifiedBoxLines.slice(0,3).map((p,i)=>{
      const extras = [p.steals>=3?p.steals+' STL':null,p.blocks>=3?p.blocks+' BLK':null].filter(Boolean);
      return '<a class="monster-line" href="'+boxUrl(p)+'" target="_blank" rel="noopener noreferrer" aria-label="View ESPN box score for '+html(p.name)+'">'
        +'<span class="monster-rank">'+(i+1)+'</span><span class="monster-person"><strong>'+html(p.name)+'</strong><small>'+html(p.team)+' · '+p.points+' PTS · '+p.rebounds+' REB · '+p.assists+' AST'
        +(extras.length?' · '+extras.join(' · '):'')+'</small></span><span class="monster-boxscore">↗</span></a>';
    }).join('');
    const leaders=boxscores.leaders||{};
    const stats=[['POINTS','points','PTS'],['REBOUNDS','rebounds','REB'],['ASSISTS','assists','AST']];
    const leadersHtml=stats.map(([label,key,abbr])=>{
      const p=leaders[key];
      if(!p||!Number.isFinite(p[key])||!p.name||!p.gameId||!/^\d+$/.test(String(p.gameId)))return '';
      return '<a class="monster-leader" href="'+boxUrl(p)+'" target="_blank" rel="noopener noreferrer"><small>'+label+'</small>'
        +'<strong>'+p[key]+' <span>'+abbr+'</span></strong><span>'+html(p.name)+'</span></a>';
    }).join('');
    return '<div class="monster-slatedate">'+displayDate+' ET · '+Number(boxscores.gameCount||0)+' completed '+(boxscores.gameCount===1?'game':'games')+'</div>'
      +'<div class="monster-lines">'+lines+'</div><div class="monster-leaders">'+leadersHtml+'</div>'
      +'<small class="pulse-source">Latest completed NBA game date · ESPN box scores · Stat leaders among those games</small>';
  }
  function leaguePulse(){
    const active = playerResult.filter(p=>p.scored>0).sort((a,b)=>b.score-a.score);
    const leader = active[0] || null;
    const firstScore = active.length < playerResult.length;
    const totalPlayedTeams = results.filter(p=>p.gp>0).length;
    const saved = Array.isArray(snapshots.snapshots)?snapshots.snapshots:[];
    const valid = saved.filter(s=>s && s.scores && typeof s.scores==='object');
    const previous = valid.length>=2 ? valid[valid.length-2] : null;
    const changes = previous ? playerResult.map(p=>{
      const before = previous.scores[p.name];
      return Number.isFinite(before) && Number.isFinite(p.score)
        ? {name:p.name,color:p.color,delta:p.score-before}
        : null;
    }).filter(Boolean) : [];
    const biggestGain = changes.filter(p=>p.delta>0.004).sort((a,b)=>b.delta-a.delta)[0] || null;
    const leaderHtml = leader
      ? '<div class="pulse-person" style="--player:'+html(leader.color)+'">'+emblem(leader)+'<strong>'+html(leader.name)+'</strong></div><div class="pulse-metric">'+scoreText(leader.score)+' <small>projected pts</small></div><p>'+totalPlayedTeams+'/30 teams have played. '+(firstScore?'Only '+active.length+'/5 contenders have scoring data so far.':'Scores are still early-season projections.')+'</p>'
      : '<strong class="pulse-empty">AWAITING TIP-OFF</strong><p>The leader appears as soon as regular-season records arrive.</p>';
    const moverHtml = biggestGain
      ? '<div class="pulse-person" style="--player:'+html(biggestGain.color)+'">'+emblem(biggestGain)+'<strong>'+html(biggestGain.name)+'</strong></div><div class="pulse-metric positive">▲ '+signed(biggestGain.delta)+' <small>pts gained</small></div><p>Compared with the previous daily snapshot. <a href="#race">View the race ↗</a></p>'
      : '<strong class="pulse-empty">NOT ENOUGH HISTORY</strong><p>'+(valid.length<2?'After two separate daily snapshots, we can name the biggest riser.':'No positive movers since the previous snapshot.')+'</p>';
    return '<section class="league-pulse" aria-label="League standings pulse and standout NBA box scores">'
      + '<a class="pulse-card pulse-leader" href="#rankings"><div class="pulse-label"><span>♛</span> '+(firstScore?'EARLY PACE LEADER':'CURRENT LEADER')+'</div>'+leaderHtml+'</a>'
      + '<div class="pulse-card pulse-mover"><div class="pulse-label"><span>↗</span> BIGGEST JUMP</div>'+moverHtml+'</div>'
      + '<div class="pulse-card pulse-news pulse-monsters"><div class="pulse-label"><span>✦</span> NIGHTLY MONSTERS <a href="https://www.espn.com/nba/scoreboard" target="_blank" rel="noopener noreferrer">GAMES ↗</a></div>'+nightlyMonsters()+'</div>'
      + '</section>';
  }

  const playerImage = (p,extra='') => `<img class="${extra}" src="assets/mascots/${p.name.toLowerCase()}.webp" alt="Illustrated ${html(p.name)} basketball mascot" loading="lazy">`;
  const mascotCard = (p,i,compact=false) => `<a class="mascot-card ${compact?'compact':''}" href="#profile/${encodeURIComponent(p.name)}" style="--player:${p.color};--player-dark:${p.dark}" aria-label="Open ${html(p.name)}'s player profile">
    <div class="mascot-art">${playerImage(p)}<span class="mascot-rank">${leagueHasScores&&p.score!==null?('#'+(i+1)):'SEASON 02'}</span></div>
    <div class="mascot-name">${html(p.name)}</div>
    <div class="mascot-bottom"><span><strong>${p.scored?p.hits+'/6':'6'}</strong><small>${p.scored?'PICKS ON PACE':'DRAFT PICKS'}</small></span><span><strong class="${scoreClass(p.score)}">${scoreText(p.score)}</strong><small>PROJECTED PTS</small></span></div>
    <span class="mascot-open">VIEW PLAYER <span aria-hidden="true">↗</span></span>
  </a>`;
  function board() {
    const lead = sorted[0];
    return `<div class="board panel neon-board" role="table" aria-label="Competition leaderboard">
      <div class="board-head" role="row"><span>#</span><span>Player</span><span>On pace</span><span>Games*</span><span style="text-align:right">Projected pts</span></div>
      ${sorted.map((p,i)=>`<a class="board-row" role="row" href="#profile/${encodeURIComponent(p.name)}" style="--player:${p.color}">
        <span class="place ${leagueHasScores&&p.score!==null&&p.name===lead.name?'first':''}">${leagueHasScores ? i+1 : '—'}</span>
        <span class="player-cell">${emblem(p)}<span><span class="player-name">${html(p.name)}</span><span class="player-under">6 picks · ${p.completed} final</span></span></span>
        <span class="metric">${p.scored?p.hits+'/6':'—'}<small>winning</small></span>
        <span class="metric">${p.scored?Math.round(p.picks.reduce((sum,r)=>sum+r.gp,0)/6):'0'}<small>avg /82</small></span>
        <span class="score ${scoreClass(p.score)}">${scoreText(p.score)}</span>
      </a>`).join('')}
    </div>`;
  }
  const playerByName = name => playerResult.find(p=>p.name.toLowerCase()===String(name).toLowerCase());
  const performanceRow = (p,mini=false) => `<div class="pick-performance ${mini?'mini-performance':''}">
      <div class="performance-team">${mark(p.teamInfo,true)}<span><strong>${html(p.teamInfo.name)}</strong><small>${html(p.side)} ${frac(p.line)} · ${p.gp?p.wins+'–'+p.losses:'Awaiting games'}</small></span></div>
      <div class="performance-bar"><div class="performance-track"><span class="performance-fill ${p.margin===null?'unscored':scoreClass(p.margin)}" style="width:${p.proj===null?'0':(100*p.proj/82).toFixed(1)}%"></span><i class="performance-line" style="left:${(100*p.line/82).toFixed(1)}%"></i></div><span class="performance-legend">${p.proj===null?'NO PROJECTION':frac(p.proj)+' PROJECTED WINS'}</span></div>
      <span class="performance-score ${scoreClass(p.margin)}">${scoreText(p.margin)}</span>
    </div>`;
  function dashboard(){
    const winner=firstSeason||{};
    const livePicks=results.filter(r=>r.margin!==null);
    const lead=leagueHasScores&&sorted[0].score!==null?sorted[0]:null;
    const topPicks=livePicks.length? [...livePicks].sort((a,b)=>b.margin-a.margin).slice(0,4):results.filter((_,i)=>i%7===0).slice(0,4);
    return `<section class="arena-hero">
      <div class="arena-lights" aria-hidden="true"></div>
      <div class="arena-copy"><p class="eyebrow">NBA 2026–27 · SEASON TWO</p><h1>THE <em>O/U</em> LEAGUE</h1><p>Six picks each. Thirty teams. One champion. <strong>Every win counts.</strong></p><span class="arena-chip">${leagueHasScores?'THE RACE IS ON':'DRAFT LOCKED · AWAITING TIP-OFF'}</span></div>
      <div class="arena-trophy" aria-hidden="true"><span class="trophy-light">★</span><svg viewBox="0 0 200 240" fill="none"><path d="M48 28h104v55c0 52-27 74-52 77-25-3-52-25-52-77V28Z" fill="#d19b3c" stroke="#ffe49a" stroke-width="5"/><path d="M48 49H22v34c0 31 22 45 54 46M152 49h26v34c0 31-22 45-54 46" stroke="#f8cc74" stroke-width="9" stroke-linecap="round"/><path d="M70 178h60M100 157v38M66 202h68l13 20H53l13-20Z" stroke="#ffe09b" stroke-width="9"/><path d="M75 64l25-14 25 14-5 30-20 15-20-15-5-30Z" stroke="#fff2bd" stroke-width="4"/></svg></div>
    </section>
    <div class="arena-stats"><div><span class="stat-icon">◈</span><strong>30</strong><small>TEAMS DRAFTED</small></div><div><span class="stat-icon">◎</span><strong>82</strong><small>GAMES PER TEAM</small></div><div><span class="stat-icon">♟</span><strong>5</strong><small>PLAYERS</small></div><div><span class="stat-icon">★</span><strong>${history.seasons.filter(s=>s.champion).length}</strong><small>CHAMPION CROWNED</small></div></div>
    ${leaguePulse()}
    <div class="section-heading neon-section-heading"><h2><span class="heading-marker"></span>THE CONTENDERS</h2><p>${lead?'CURRENT LEADER: '+html(lead.name.toUpperCase()):'FIVE CONTENDERS · ZERO FAKE STANDINGS'}</p></div>
    <div class="mascot-grid">${sorted.map((p,i)=>mascotCard(p,i)).join('')}</div>
    <div class="arena-main-grid">
      <section class="arena-section"><div class="arena-panel-title"><h2>LEAGUE STANDINGS</h2><a href="#rankings">POWER RANKINGS ↗</a></div>${board()}</section>
      <section class="arena-section"><div class="arena-panel-title"><h2>BET HEAT CHECK</h2><a href="#draft">ALL 30 PICKS ↗</a></div><div class="performance-panel panel">${topPicks.map(p=>performanceRow(p,true)).join('')}<p class="data-explainer">${leagueHasScores?'Bar = projected wins · White line = preseason O/U.':'The bars fill automatically after the NBA season begins.'}</p></div></section>
      <section class="arena-section"><div class="arena-panel-title"><h2>DEFENDING CHAMPION</h2><a href="#history">HALL OF CHAMPIONS ↗</a></div><a class="defending-champ panel" href="#history"><span class="champstar">★</span><div><span class="subheading">2025–26 CHAMPION</span><strong>${html(winner.champion)}</strong><span class="champ-score">${signed(winner.score)} POINTS · ${winner.hits}/${winner.bets} CORRECT</span></div><span class="trophy-emoji" aria-hidden="true">🏆</span></a><div class="arena-shortcuts"><a href="#race">CHAMPIONSHIP RACE <span>↗</span></a><a href="#rivalry">HEAD-TO-HEAD <span>↗</span></a></div></section>
    </div>
    ${note(`${leagueHasScores?'Current NBA records from':'Scheduled results will use'} <strong>${html(standings.source||'NBA standings')}</strong>. Last successful update: <strong>${html(formatDate(standings.updatedAt))}</strong>. ${leagueHasScores?'These are 82-game pace projections, not final results.':'No 2026–27 results loaded yet; current standings are intentionally unranked.'}`)}
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
  function profilesList() {
    return `${pageHead('Meet the contenders','THE PLAYERS','Five colours. Five mascots. Thirty picks. Tap a card to scout the competition.')}
      <div class="mascot-grid profiles-grid">${sorted.map((p,i)=>mascotCard(p,i)).join('')}</div>
      ${note('Player artwork is decorative. All scores are driven exclusively by the same official draft lines and imported NBA records.')}`;
  }
  function profile() {
    const name = decodeURIComponent((location.hash||'').split('/').slice(1).join('/'));
    const p = playerByName(name);
    if(!p)return `${pageHead('The league','Player not found','Pick a profile from the Players menu.')}<p><a class="action-link" href="#profiles">← ALL PLAYERS</a></p>`;
    const valid = p.picks.filter(pick=>pick.margin!==null);
    const best = valid.length ? [...valid].sort((a,b)=>b.margin-a.margin)[0] : null;
    const worst = valid.length ? [...valid].sort((a,b)=>a.margin-b.margin)[0] : null;
    const rank = leagueHasScores?sorted.findIndex(item=>item.name===p.name)+1:null;
    return `<a class="back-link" href="#profiles">← ALL PLAYERS</a>
      <section class="profile-hero" style="--player:${p.color};--player-dark:${p.dark}">
        <div class="profile-art">${playerImage(p)}</div><div class="profile-info"><span class="eyebrow">THE O/U LEAGUE · PLAYER PROFILE</span><h1>${html(p.name.toUpperCase())}</h1><p>${p.picks.filter(x=>x.side==='OVER').length} OVERS · ${p.picks.filter(x=>x.side==='UNDER').length} UNDERS · SIX LOCKED PICKS</p><div class="profile-stats"><span><strong>${p.scored?p.hits+'/6':'—'}</strong><small>ON PACE</small></span><span><strong class="${scoreClass(p.score)}">${scoreText(p.score)}</strong><small>PROJECTED PTS</small></span><span><strong>${rank?'#'+rank:'—'}</strong><small>LEAGUE RANK</small></span></div></div>
      </section>
      <div class="section-heading neon-section-heading"><h2><span class="heading-marker"></span>SEASON PICKS</h2><p>THE WHITE MARKER IS THE PRESEASON O/U LINE</p></div>
      <div class="player-picks panel">${p.picks.map(pick=>performanceRow(pick)).join('')}</div>
      <div class="profile-insights"><div class="insight-card"><small>BEST PICK</small><strong>${best?html(best.teamInfo.name):'TBD'}</strong><span class="positive">${best?scoreText(best.margin)+' PTS':'Awaiting results'}</span></div><div class="insight-card"><small>TOUGHEST PICK</small><strong>${worst?html(worst.teamInfo.name):'TBD'}</strong><span class="${worst?scoreClass(worst.margin):'neutral'}">${worst?scoreText(worst.margin)+' PTS':'Awaiting results'}</span></div><div class="insight-card"><small>COMPLETED BETS</small><strong>${p.completed} / 6</strong><span>82 regular-season games per team</span></div></div>
      <p class="data-explainer">Projected wins = (wins / games played) × 82. Scores can swing sharply at the start of the season.</p>`;
  }
  const allSnapshots = Array.isArray(snapshots.snapshots)?snapshots.snapshots:[];
  const previousScore = name => {
    if(allSnapshots.length<2)return null;
    const previous = allSnapshots[Math.max(0,allSnapshots.length-2)];
    return Number.isFinite(previous.scores?.[name])?previous.scores[name]:null;
  };
  function rankings() {
    return `${pageHead('The weekly pecking order','POWER RANKINGS','Who is leading the league—and which draft picks are doing the damage?')}
      ${!leagueHasScores?note('The 2026–27 regular season has not produced verified records yet. No one is first or last until the scores exist.'):''}
      <div class="power-table">${sorted.map((p,i)=>{const prev=previousScore(p.name),delta=prev===null||p.score===null?null:p.score-prev;return `<a class="power-row" href="#profile/${p.name}" style="--player:${p.color}"><span class="power-position">${leagueHasScores?String(i+1).padStart(2,'0'):'—'}</span>${emblem(p,true)}<span class="power-name"><strong>${html(p.name.toUpperCase())}</strong><small>${p.scored?p.hits+'/6 on pace':'Awaiting tip-off'}</small></span><span class="power-points ${scoreClass(p.score)}">${scoreText(p.score)}<small>PTS</small></span><span class="power-movement ${scoreClass(delta)}">${delta===null?'—':delta>0?'▲ '+signed(delta):delta<0?'▼ '+signed(delta):'—'}<small>LAST SNAPSHOT</small></span></a>`}).join('')}</div>
      <div class="ranking-bonus-grid"><div class="insight-card"><small>THE PACE SETTER</small><strong>${leagueHasScores?html(sorted[0].name):'TO BE DECIDED'}</strong><span>${leagueHasScores?'Highest total projected points':'First tip-off decides nothing yet'}</span></div><div class="insight-card"><small>WOODEN SPOON WATCH</small><strong>${leagueHasScores?html(sorted[sorted.length-1].name):'TO BE DECIDED'}</strong><span>${leagueHasScores?'Lowest total projected points':'Nobody gets the spoon before games'}</span></div><div class="insight-card"><small>THE REAL MVP</small><strong>EVERY POINT</strong><span>Six margins decide the champion</span></div></div>`;
  }
  function race() {
    const actual=allSnapshots.filter(x=>x.scores && Object.values(x.scores).some(Number.isFinite));
    const usable=actual.slice(-120);
    let visual='';
    if(usable.length>=2){
      const values=usable.flatMap(x=>players.map(p=>x.scores[p.name]).filter(Number.isFinite));
      const min=Math.min(0,...values),max=Math.max(0,...values),range=Math.max(10,max-min);
      const xx=i=>55+i*720/(usable.length-1),yy=v=>300-(v-min)/range*260;
      const lines=Array.from({length:5},(_,i)=>`<line x1="55" y1="${40+i*65}" x2="775" y2="${40+i*65}" stroke="#ffffff17" stroke-dasharray="3 6"/>`).join('');
      visual=`<svg class="race-svg" viewBox="0 0 820 340" role="img" aria-label="Time series of the five players' projected scoring margins"><g>${lines}</g>${players.map(p=>{const points=usable.map((sn,i)=>({x:xx(i),y:Number.isFinite(sn.scores[p.name])?yy(sn.scores[p.name]):null})).filter(v=>v.y!==null);return `<polyline fill="none" stroke="${p.color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" points="${points.map(x=>x.x+','+x.y).join(' ')}"/>`;}).join('')}</svg><div class="race-dates"><span>${html(usable[0].date)}</span><span>${html(usable[usable.length-1].date)}</span></div>`;
    } else {visual=`<div class="race-empty"><div class="race-empty-icon">⌁</div><strong>THE RACE BEGINS AT TIP-OFF</strong><span>We’ll chart each player's projected score as real results are added. No imaginary graph data.</span></div>`;}
    return `${pageHead('One trophy. Five contenders.','CHAMPIONSHIP RACE','The full-season story, built from actual recorded snapshots—not invented numbers.')}
      <div class="race-card panel"><div class="race-legend">${players.map(p=>`<span style="--player:${p.color}"><i></i>${html(p.name)}</span>`).join('')}</div>${visual}</div>
      <div class="ranking-bonus-grid"><div class="insight-card"><small>LEADER</small><strong>${leagueHasScores?html(sorted[0].name):'TBD'}</strong><span>${leagueHasScores?scoreText(sorted[0].score)+' projected points':'Awaiting results'}</span></div><div class="insight-card"><small>SNAPSHOTS SAVED</small><strong>${usable.length}</strong><span>New records create future data points</span></div><div class="insight-card"><small>SEASON STATUS</small><strong>${leagueHasScores?'UNDERWAY':'AWAITING RESULTS'}</strong><span>Historical champions stay archived separately</span></div></div>`;
  }
  let versusA='Blake',versusB='Mark';
  function rivalry(){
    const a=playerByName(versusA),b=playerByName(versusB);
    const choose=(id,current)=>`<select id="${id}" class="rival-select" aria-label="Select a rival">${players.map(p=>`<option value="${p.name}" ${p.name===current?'selected':''}>${html(p.name)}</option>`).join('')}</select>`;
    const match=(va,vb,fn=(v)=>v)=>`<div class="rival-stat"><strong>${html(fn(va))}</strong><span></span><strong>${html(fn(vb))}</strong></div>`;
    const hasComparison=a.score!==null && b.score!==null;
    return `${pageHead('Pick a rivalry','HEAD-TO-HEAD','Settle the argument using real picks and projected margins—not simulated matchups.')}
      <div class="rivalry-chooser"><label>LEFT CONTENDER ${choose('rival-a',versusA)}</label><span class="rival-versus">VS</span><label>RIGHT CONTENDER ${choose('rival-b',versusB)}</label></div>
      <div class="rivalry-match"><a href="#profile/${a.name}" class="rival-person" style="--player:${a.color}">${playerImage(a)}<strong>${html(a.name.toUpperCase())}</strong></a><div class="rival-center"><div class="rival-big-vs">VS</div><small>PROJECTED MARGINS</small><strong>${hasComparison?(a.score>b.score?html(a.name)+' LEADS':b.score>a.score?html(b.name)+' LEADS':'TIED'):'AWAITING RESULTS'}</strong></div><a href="#profile/${b.name}" class="rival-person" style="--player:${b.color}">${playerImage(b)}<strong>${html(b.name.toUpperCase())}</strong></a></div>
      <div class="rival-stats panel"><div class="rival-stat-heading"><span>${html(a.name)}</span><span>THE NUMBERS</span><span>${html(b.name)}</span></div>${match(a.score,b.score,scoreText)}<div class="rival-stats-caption">PROJECTED POINTS</div>${match(a.scored?a.hits+'/6':'—',b.scored?b.hits+'/6':'—')}<div class="rival-stats-caption">PICKS ON PACE</div>${match(a.picks.filter(x=>x.side==='OVER').length,b.picks.filter(x=>x.side==='OVER').length)}<div class="rival-stats-caption">OVERS DRAFTED</div>${match(a.completed,b.completed)}<div class="rival-stats-caption">BETS SETTLED</div></div>
      ${note('Head-to-head is a current-season statistical comparison. It does not claim historic head-to-head wins; those have not been recorded.')}`;
  }
  const views={dashboard,draft,teams,history:hall,guide,profiles:profilesList,profile,rankings,race,rivalry};

  function activate() {
    const hash=(location.hash||'#dashboard').replace('#','');
    const view=hash.startsWith('profile/')?'profile':(views[hash] ? hash : 'dashboard');
    document.querySelectorAll('[data-nav]').forEach(a=>{const active=a.dataset.nav===(view==='profile'?'profiles':view);a.classList.toggle('active',active);a.setAttribute('aria-current',active?'page':'false');});
    content.innerHTML=views[view]();
    if (view==='teams') renderTeamResults();
    content.querySelectorAll('[data-draft-filter]').forEach(b=>b.addEventListener('click',()=>{draftFilter=b.dataset.draftFilter;activate();}));
    content.querySelectorAll('[data-team-filter]').forEach(b=>b.addEventListener('click',()=>{teamFilter=b.dataset.teamFilter;content.querySelectorAll('[data-team-filter]').forEach(x=>x.classList.toggle('active',x.dataset.teamFilter===teamFilter));renderTeamResults();}));
    const search=el('#team-search',content);
    if(search) search.addEventListener('input',e=>{teamSearch=e.target.value;renderTeamResults();});
    ['rival-a','rival-b'].forEach(id=>{const select=el('#'+id,content);if(select)select.addEventListener('change',e=>{if(id==='rival-a')versusA=e.target.value;else versusB=e.target.value;if(versusA===versusB){if(id==='rival-a')versusB=players.find(p=>p.name!==versusA).name;else versusA=players.find(p=>p.name!==versusB).name;}activate();});});
  }
  function renderTeamResults(){const target=el('#team-results',content);if(target)target.innerHTML=teamTable();}
  window.addEventListener('hashchange',activate);
  activate();
})();
