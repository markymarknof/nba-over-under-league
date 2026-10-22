/* Offline DOM-lite smoke test without npm packages or a browser. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const base = path.resolve(__dirname, '..');
const league=JSON.parse(fs.readFileSync(path.join(base,'data/league.json')));
const history=JSON.parse(fs.readFileSync(path.join(base,'data/history.json')));
const standings=JSON.parse(fs.readFileSync(path.join(base,'data/standings.json')));
function smoke(route, data=standings) {
 const main={innerHTML:'',querySelectorAll(){return []},querySelector(){return null}};
 const sync={classList:{toggle(){}},innerHTML:''};
 const doc={getElementById(id){return id==='content'?main:sync;},querySelectorAll(){return []}};
 const context={window:{LEAGUE_CONFIG:league,LEAGUE_HISTORY:history,LEAGUE_STANDINGS:data,addEventListener(){}},document:doc,location:{hash:'#'+route},Date,Intl,Number,Math,Boolean,Object,Array,String};
 vm.runInNewContext(fs.readFileSync(path.join(base,'assets/app.js'),'utf8'),context,{timeout:3000});
 if(!main.innerHTML || main.innerHTML.length<100) throw Error('Nothing rendered for '+route);
 return main.innerHTML;
}
const dashboard=smoke('dashboard');
if(!dashboard.includes('Andrew')||!dashboard.includes('mascot-grid')||!dashboard.includes('dashboard-intro')) throw Error('Homepage missing contenders or defending champion');
if(dashboard.includes('class="arena-hero"')||dashboard.includes('class="arena-stats"')) throw Error('Old empty hero / static stat boxes still on homepage');
if(!(dashboard.indexOf('class="dashboard-intro"')<dashboard.indexOf('class="mascot-grid"') &&
     dashboard.indexOf('class="mascot-grid"')<dashboard.indexOf('class="league-pulse"') &&
     dashboard.indexOf('class="league-pulse"')<dashboard.indexOf('class="arena-main-grid"')))
  throw Error('Homepage is not mascots-first with live pulse immediately underneath');
if((dashboard.match(/class="mascot-card /g)||[]).length!==5) throw Error('Five mascot cards not rendered');
if(!dashboard.includes('NIGHTLY MONSTERS')) throw Error('NBA box-score panel missing');
if(dashboard.includes('SIX PICKS EACH')||dashboard.includes('DRAFT PICKS')||dashboard.includes('ALL 30 PICKS')) throw Error('Cluttered promotional copy remains on homepage');
if(dashboard.includes('Current NBA records from')||dashboard.includes('Every win counts')) throw Error('Redundant homepage explainer remains');
if(!dashboard.includes('PACE PTS')||!dashboard.includes('NIGHTLY MONSTERS')) throw Error('Live competitive information missing');
if(dashboard.includes('5 CONTENDERS')||dashboard.includes('30 TEAMS DRAFTED')) throw Error('Static counts returned to first screen');
const draft=smoke('draft');
if((draft.match(/class="draft-card"/g)||[]).length !== 5) throw Error('Draft cards != 5');
if((draft.match(/class="bet-row"/g)||[]).length !== 30) throw Error('Bet rows != 30');
if(!draft.includes('PHOENIX') && !draft.includes('Phoenix Suns')) throw Error('Phoenix missing');
if(draft.includes('Bets are locked from the original')||draft.includes('class="draft-summary"')||draft.includes('class="draft-foot"')) throw Error('Draft page has repetitive copy');
const teams=smoke('teams');
if(!teams.includes('team-results')) throw Error('Teams view missing');
const archived=smoke('history');
if((archived.match(/class="archive-bet"/g)||[]).length!==30) throw Error('Historical archive incomplete');
if(!smoke('guide').includes('Projected wins')) throw Error('Guide did not render');
if(smoke('guide').includes('Website status')||smoke('guide').includes('Database / Blob')) throw Error('Hosting boilerplate is visible on rules page');
const withResults=JSON.parse(JSON.stringify(standings));
withResults.updatedAt='2026-11-01T13:00:00Z';
withResults.source='Test fixture';
for(const r of Object.values(withResults.teams)){r.wins=10;r.losses=5;}
if(!smoke('dashboard',withResults).includes('CURRENT LEADER'))throw Error('Live leaderboard failed');
for (const route of ['profiles','profile/Blake','profile/Coz','profile/Mark','profile/Coby','profile/Andy','rankings','race','rivalry']) {const rendered=smoke(route);if(!rendered || !rendered.includes('O/U') && !rendered.includes('Blake') && !rendered.includes('Blake'.toUpperCase()))throw Error('Route broken: '+route)}
console.log('PASS 14 views + profiles, 30 picks, historical archive, pre-season and live scoring');
