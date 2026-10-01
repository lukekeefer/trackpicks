const BUILD_VERSION = '2.5.4.11.1';
let deployedVersion = BUILD_VERSION;

function versionStamp(){ return `V${BUILD_VERSION}`; }

function versionParts(v){
  return String(v||'').trim().split('.').map(x=>{
    const n=Number(x);
    return Number.isFinite(n)?n:0;
  });
}
function compareVersions(a,b){
  const aa=versionParts(a),bb=versionParts(b),len=Math.max(aa.length,bb.length);
  for(let i=0;i<len;i++){
    const av=aa[i]||0,bv=bb[i]||0;
    if(av>bv)return 1;
    if(av<bv)return -1;
  }
  return 0;
}
function removeUpdateBanner(){
  document.getElementById('trackpicks-update-banner')?.remove();
}
async function refreshCanonicalApp(latestVersion){
  const canonicalUrl=new URL(window.location.origin+window.location.pathname);
  canonicalUrl.search='';

  try{
    if('caches' in window){
      const keys=await caches.keys();
      await Promise.all(keys.map(k=>caches.delete(k)));
    }
  }catch(_){/* Best effort only. */}

  try{
    if('serviceWorker' in navigator){
      const reg=await navigator.serviceWorker.getRegistration();
      if(reg)await reg.update();
    }
  }catch(_){/* Best effort only. */}

  // Force a network navigation. The TrackPicks service worker also intercepts
  // navigation requests with cache:no-store so future PWA cold starts do not
  // resurrect a stale index.html.
  canonicalUrl.searchParams.set('__tpv',String(latestVersion||BUILD_VERSION));
  canonicalUrl.searchParams.set('__tpr',String(Date.now()));
  window.location.replace(canonicalUrl.toString());
}

function showUpdateBanner(latestVersion){
  if(document.getElementById('trackpicks-update-banner')) return;
  const banner=document.createElement('div');
  banner.id='trackpicks-update-banner';
  banner.className='update-banner';
  banner.innerHTML=`<div><strong>TrackPicks update available</strong><span>Reload to use the newest version.</span></div><button type="button">Reload</button>`;
  banner.querySelector('button').onclick=async()=>{
    const btn=banner.querySelector('button');
    if(btn){btn.disabled=true;btn.textContent='Reloading…';}
    await refreshCanonicalApp(latestVersion);
  };
  document.body.appendChild(banner);
}

async function ensureFreshPwaController(){
  try{
    if(!('serviceWorker' in navigator))return;
    const reg=await navigator.serviceWorker.register(`./sw.js?v=${BUILD_VERSION}`,{
      scope:'./',
      updateViaCache:'none'
    });
    try{await reg.update();}catch(_){}
  }catch(_){/* Never block app startup. */}
}

let lastLifecycleUpdateCheck=0;
function checkForUpdateOnLifecycle(){
  const now=Date.now();
  if(now-lastLifecycleUpdateCheck<1500)return;
  lastLifecycleUpdateCheck=now;
  checkForAppUpdate();
}
window.addEventListener('pageshow',checkForUpdateOnLifecycle);
window.addEventListener('focus',checkForUpdateOnLifecycle);
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible')checkForUpdateOnLifecycle();
});

async function checkForAppUpdate(){
  try{
    const res=await fetch(`version.json?t=${Date.now()}`,{
      cache:'no-store',
      headers:{'cache-control':'no-cache'}
    });
    if(!res.ok)return;
    const data=await res.json();
    const latest=String(data?.version||'').trim();
    if(!latest)return;

    deployedVersion=latest;
    const comparison=compareVersions(latest,BUILD_VERSION);

    // Prompt only when the deployed version is actually NEWER.
    // If version.json is stale/older than the running app, remove the banner.
    if(comparison>0) showUpdateBanner(latest);
    else removeUpdateBanner();
  }catch(_){/* Update checks must never interrupt the app. */}
}

const STORAGE = {
  apiKey: 'cfb-odds-api-key-v3',
  apiUsage: 'trackpicks-odds-api-usage',
  supabaseUrl: 'cfb-supabase-url-v3',
  supabaseKey: 'cfb-supabase-key-v3'
};

const WEEK_WINDOWS = {};
(function buildWeekWindows(){
  const week4Start = new Date('2026-09-21T05:00:00Z');
  for (let w = 0; w <= 12; w++) {
    const start = new Date(week4Start.getTime() + (w - 4) * 7 * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1000);
    WEEK_WINDOWS[w] = { start: start.toISOString().replace('.000Z','Z'), end: end.toISOString().replace('.000Z','Z') };
  }
})();

const state = {
  displayName: '',
  pickerNames: [],
  activePickerSelector: false,
  activeAddName: false,
  isAdmin: false,
  view: 'weeks', selectedWeek: 4, activeGameId: null, editWagerId: null,
  saving: false, loadingWeek: false, syncing: false, showSettings: false,
  showImportManager: false, importBatches: [], importManagerLoading: false, deletingImportBatchId: null,
  importMessage: '', authMessage: '', authMode: 'signin',
  apiKey: localStorage.getItem(STORAGE.apiKey) || '',
  apiUsage: JSON.parse(localStorage.getItem(STORAGE.apiUsage) || 'null'),
  supabaseUrl: 'https://doatdvdaggmuycgxkwhh.supabase.co',
  supabaseKey: 'sb_publishable_sxuPFdJVj5xQF7iIPs2FzQ_k1alR7Zy',
  sb: null, session: null, user: null,
  authReady: false,
  weeks: Array.from({ length: 12 }, (_, i) => ({ week: i + 1, enabled: i + 1 >= 4 })),
  games: [], wagers: [], cautionGameIds: [], oddsHistory: [],
  cfbTeams: [], cfbAliases: [], cfbRankings: [], lastOddsPullAt: null,
  slateDivision: 'FBS', slateConference: 'All', slateSearch: '',
  parlays: [], parlayLegs: [], slipTab: 'straight',
  parlayDraft: {id:null,legs:[],who:'',units:1,odds:'',isTeaser:false,teaserPoints:6,result:'Pending'},
  parlaySaving: false,
  pushingResults: false, pushResultsMessage: '',
  gradingReviews: {straight:{},parlays:{}},
  pickerOptions: ['Keef','Wilson','Both','Tail'],
  historyChartKind: null,
  historyPointIndex: null,
  activeTeamId: null, activeTeamName: '', teamScreenGames: [], teamScreenLoading: false, teamScreenError: '',
  gameTeamStats: {}, gameTeamStatsLoading: false,
  standardUnitSize: null,
  showScreenshotImporter: false, screenshotImportFiles: [], screenshotImportMessage: '', screenshotImportProcessing: false, screenshotImportWeek: null
};
let tempKind='', tempSelection=null, tempWho=null, tempLine='', tempPayout='-110', tempUnits=1;

function signed(n){ return Number(n)>0?`+${Number(n)}`:`${Number(n)}`; }

function captureWagerDraft(){
  const line=document.getElementById('lineInput');
  const payout=document.getElementById('payoutInput');
  const units=document.getElementById('unitsInput');
  const who=document.getElementById('whoInput');
  if(line) tempLine=line.value;
  if(payout) tempPayout=payout.value;
  if(units) tempUnits=units.value;
  if(who && who.value) tempWho=who.value;
}
function resetWagerDraft(){
  tempKind='';
  tempSelection=null;
  tempLine='';
  tempPayout='-110';
  tempUnits=1;
}

function escapeAttr(s){ return String(s??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function gameById(id){ return state.games.find(g=>g.id===id); }
function wagersForGame(id){ return state.wagers.filter(w=>w.gameId===id); }
function fmtSpread(g,team){ if(g.spread==null||!g.spreadTeam)return null; return team===g.spreadTeam?g.spread:-g.spread; }
function marketLineFor(g,kind,selection){
  if(kind==='Spread')return fmtSpread(g,selection);
  if(kind==='Total')return g.total;
  if(kind==='Moneyline')return selection===g.away?g.awayMoneyline:selection===g.home?g.homeMoneyline:null;
  return null;
}
function marketOddsFor(g,kind,selection){
  if(kind==='Spread')return selection===g.away?g.awaySpreadOdds:selection===g.home?g.homeSpreadOdds:null;
  if(kind==='Total')return selection==='Over'?g.overOdds:selection==='Under'?g.underOdds:null;
  if(kind==='Moneyline')return selection===g.away?g.awayMoneyline:selection===g.home?g.homeMoneyline:null;
  return null;
}
function weekGames(week){ return state.games.filter(g=>g.week===week).sort((a,b)=>new Date(a.commenceTime)-new Date(b.commenceTime)); }
function weekWagers(week){ return state.wagers.filter(w=>gameById(w.gameId)?.week===week); }
function weekParlays(week){ return state.parlays.filter(p=>Number(p.week)===Number(week)); }

const POWER4_CONFERENCES=['SEC','Big Ten','Big 12','ACC'];
const G6_CONFERENCES=['American','Conference USA','Mid-American','Mountain West','Pac-12','Sun Belt'];
function normalizeTeamName(name){ return String(name||'').trim().toLowerCase(); }
function resolveEspnTeamName(name){
  const key=normalizeTeamName(name);
  const alias=state.cfbAliases.find(a=>normalizeTeamName(a.alias)===key);
  if(alias)return alias.espnName;
  const direct=state.cfbTeams.find(t=>normalizeTeamName(t.espnName)===key);
  return direct?.espnName||null;
}
function conferenceForTeam(name){
  const espnName=resolveEspnTeamName(name);
  if(!espnName)return null;
  return state.cfbTeams.find(t=>t.espnName===espnName)?.conference||null;
}
function teamMetaFor(name){
  const espnName=resolveEspnTeamName(name);
  if(!espnName)return null;
  return state.cfbTeams.find(t=>t.espnName===espnName)||null;
}
function rankingForTeam(name,week=state.selectedWeek){
  const meta=teamMetaFor(name);
  const teamId=String(meta?.espnTeamId||meta?.espn_team_id||'').trim();
  if(!teamId)return null;
  const rows=(state.cfbRankings||[]).filter(r=>Number(r.week)===Number(week) && String(r.teamId)===teamId);
  if(!rows.length)return null;
  return rows.find(r=>r.pollType==='cfp')||rows.find(r=>r.pollType==='ap')||rows[0];
}
function teamMonogram(name){
  const words=String(name||'').replace(/\([^)]*\)/g,'').trim().split(/\s+/).filter(Boolean);
  if(!words.length)return'TP';
  return words.slice(0,2).map(w=>w[0]).join('').toUpperCase();
}
function renderTeamLogo(name){
  const meta=teamMetaFor(name);
  if(meta?.logoUrl){
    return `<img class="matchup-logo" src="${escapeAttr(meta.logoUrl)}" alt="${escapeAttr(name)} logo" loading="lazy">`;
  }
  return `<div class="matchup-logo matchup-logo-fallback" aria-hidden="true">${escapeAttr(meta?.abbreviation||teamMonogram(name))}</div>`;
}
function renderMiniTeamLogo(name){
  const meta=teamMetaFor(name);
  if(meta?.logoUrl){
    return `<img class="wager-team-logo" src="${escapeAttr(meta.logoUrl)}" alt="" loading="lazy">`;
  }
  return `<div class="wager-team-logo wager-team-logo-fallback" aria-hidden="true">${escapeAttr(meta?.abbreviation||teamMonogram(name))}</div>`;
}
function metaIcon(type){
  if(type==='calendar')return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2v3M17 2v3M3.5 9h17M5 4.5h14a2 2 0 0 1 2 2V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2Z"/></svg>`;
  if(type==='tv')return `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="13" rx="2"/><path d="M8 22h8M12 18v4"/></svg>`;
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.2 7-13A7 7 0 1 0 5 9c0 6.8 7 13 7 13Z"/><circle cx="12" cy="9" r="2.2"/></svg>`;
}

function normalizedTvNetwork(tv){
  return String(tv||'').trim().toUpperCase().replace(/\s+/g,' ');
}
function tvNetworkLogoKey(tv){
  const n=normalizedTvNetwork(tv);
  if(!n)return null;
  if(n==='ESPN' || n.includes('ESPN HD'))return 'espn';
  if(n.includes('ESPN2'))return 'espn2';
  if(n.includes('ESPNU'))return 'espnu';
  if(n.includes('ESPN+'))return 'espnplus';
  if(n==='ABC' || n.startsWith('ABC '))return 'abc';
  if(n==='FOX' || n.startsWith('FOX '))return 'fox';
  if(n==='FS1' || n.includes('FOX SPORTS 1'))return 'fs1';
  if(n==='FS2' || n.includes('FOX SPORTS 2'))return 'fs2';
  if(n==='CBS')return 'cbs';
  if(n==='CBSSN' || n.includes('CBS SPORTS NETWORK'))return 'cbssn';
  if(n==='NBC')return 'nbc';
  if(n.includes('PEACOCK'))return 'peacock';
  if(n==='CW' || n==='THE CW' || n.includes('CW NETWORK'))return 'cw';
  if(n==='ACCN' || n.includes('ACC NETWORK'))return 'accn';
  if(n==='SECN' || n.includes('SEC NETWORK'))return 'secn';
  return null;
}
const TV_NETWORK_LOGO_URLS={
    espn: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/ESPN_wordmark.svg',
    espn2: 'https://upload.wikimedia.org/wikipedia/commons/b/bf/ESPN2_logo.svg',
    espnu: 'tv-espnu.png',
    espnplus: 'https://upload.wikimedia.org/wikipedia/commons/8/80/ESPN_Plus.svg',
    abc: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/ABC-2021-LOGO.svg',
    fox: 'https://upload.wikimedia.org/wikipedia/commons/c/c0/Fox_Broadcasting_Company_logo_%282019%29.svg',
    fs1: 'https://upload.wikimedia.org/wikipedia/commons/3/37/2015_Fox_Sports_1_logo.svg',
    fs2: 'https://upload.wikimedia.org/wikipedia/commons/3/38/FS2_logo_2015.svg',
    cbs: 'https://upload.wikimedia.org/wikipedia/commons/4/4e/CBS_logo.svg',
    cbssn: 'https://upload.wikimedia.org/wikipedia/commons/0/04/CBS_Sports_Network_2021.svg',
    nbc: 'https://upload.wikimedia.org/wikipedia/commons/0/0b/NBC_logo_2022.svg',
    peacock: 'https://upload.wikimedia.org/wikipedia/commons/2/20/NBCUniversal_Peacock_Logo_%282026%29.svg',
    cw: 'https://upload.wikimedia.org/wikipedia/commons/b/b1/The_CW_2024.svg',
    accn: 'https://upload.wikimedia.org/wikipedia/commons/8/89/ACC_Network_logo_1c_black.svg',
    secn: 'https://upload.wikimedia.org/wikipedia/commons/b/b9/SEC_Network_logo.svg'
};
function renderTvNetworkLogo(tv){
  const key=tvNetworkLogoKey(tv);
  const url=key?TV_NETWORK_LOGO_URLS[key]:null;
  if(!url)return `<span class="tv-network-fallback">${escapeAttr(tv||'TBD')}</span>`;
  return `<img class="tv-network-logo-img tv-network-${key}" src="${url}" alt="${escapeAttr(tv)}" loading="eager" decoding="async">`;
}


function gameVenueText(g){
  const cityState=[g.venueCity,g.venueState].filter(Boolean).join(', ');
  if(g.venueName&&cityState)return `${g.venueName} · ${cityState}`;
  return g.venueName||cityState||g.location||'Location TBD';
}
function gameConferences(g){
  return [...new Set([conferenceForTeam(g.away),conferenceForTeam(g.home)].filter(Boolean))];
}
function gameMatchesConference(g,filter){
  if(filter==='All')return true;
  const confs=gameConferences(g);
  if(filter==='G6')return confs.some(c=>G6_CONFERENCES.includes(c));
  return confs.includes(filter);
}
function baseFilteredSlateGames(){
  const games=weekGames(state.selectedWeek);
  if(state.slateDivision==='FCS') return games.filter(g=>g.sourceSportKey==='americanfootball_ncaaf_fcs');
  return games.filter(g=>g.sourceSportKey==='americanfootball_ncaaf').filter(g=>gameMatchesConference(g,state.slateConference));
}
function gameMatchesSlateSearch(g,query=state.slateSearch){
  const q=normalizeTeamName(query);
  if(!q)return true;
  return [g.away,g.home].some(name=>{
    const meta=teamMetaFor(name);
    const haystack=[
      name,
      resolveEspnTeamName(name),
      meta?.espnName,
      meta?.abbreviation,
      meta?.shortDisplayName,
      meta?.shortNickname
    ].filter(Boolean).map(normalizeTeamName);
    return haystack.some(v=>v.includes(q));
  });
}
function filteredSlateGames(){ return baseFilteredSlateGames().filter(g=>gameMatchesSlateSearch(g)); }
function renderSlateFilters(){
  const division=`<div class="slate-filter-primary"><button class="slate-filter-btn primary-filter ${state.slateDivision==='FBS'?'active':''}" data-slate-division="FBS">FBS</button><button class="slate-filter-btn primary-filter ${state.slateDivision==='FCS'?'active':''}" data-slate-division="FCS">FCS</button></div>`;
  const sub=state.slateDivision==='FBS'?`<div class="slate-filter-sub">${['All','SEC','Big Ten','Big 12','ACC','G6'].map(f=>`<button class="slate-filter-btn ${state.slateConference===f?'active':''}" data-slate-conference="${f}">${f}</button>`).join('')}</div>`:'';
  return `<div class="slate-controls"><div class="slate-search-wrap"><input class="slate-search-input" data-slate-search type="search" inputmode="search" autocomplete="off" spellcheck="false" placeholder="Search teams" value="${escapeAttr(state.slateSearch||'')}" aria-label="Search teams"></div><div class="slate-filter-bar">${division}<div class="slate-filter-divider"></div>${sub}</div></div>`;
}
function legsForParlay(parlayId){ return state.parlayLegs.filter(l=>l.parlayId===parlayId).sort((a,b)=>a.legOrder-b.legOrder); }
function americanToDecimalOdds(odds){
  const o=Number(odds);
  if(!Number.isFinite(o)||o===0)return null;
  return o>0?1+(o/100):1+(100/Math.abs(o));
}
function combinedParlayAmericanOdds(legs){
  if(!Array.isArray(legs)||legs.length<2)return '';
  let decimal=1;
  for(const leg of legs){
    const d=americanToDecimalOdds(leg.odds);
    if(d==null)return '';
    decimal*=d;
  }
  const american=decimal>=2?Math.round((decimal-1)*100):Math.round(-100/(decimal-1));
  return american>0?`+${american}`:`${american}`;
}
function syncParlayEstimate(){
  if(state.parlayDraft.isTeaser){state.parlayDraft.odds='';return;}
  state.parlayDraft.odds=combinedParlayAmericanOdds(state.parlayDraft.legs);
}
function resetParlayDraft(){ state.parlayDraft={id:null,legs:[],who:state.displayName||'',units:1,odds:'',isTeaser:false,teaserPoints:6,result:'Pending'}; }
function teasedLineFor(leg,points){ const base=Number(leg.sourceLine); const pts=Number(points)||0; if(leg.betType==='Moneyline')return base; if(leg.betType==='Spread')return base+pts; return leg.selection==='Over'?base-pts:base+pts; }
function effectiveParlayLegLine(leg,draft=state.parlayDraft){ if(leg.betType==='Moneyline')return null; return draft.isTeaser?teasedLineFor(leg,draft.teaserPoints):Number(leg.sourceLine); }
function americanProfitUnits(units,odds){ const u=Number(units),o=Number(odds); if(!Number.isFinite(u)||u<=0||!Number.isFinite(o)||o===0)return null; return o>0?u*o/100:u*100/Math.abs(o); }
function formatAmericanOdds(odds){ const n=Number(odds); if(!Number.isFinite(n)||n===0)return '—'; return n>0?`+${Math.round(n)}`:`${Math.round(n)}`; }

function isCautioned(gameId){ return state.cautionGameIds.includes(gameId); }
function isGradedResult(result){ return ['Win','Loss','Push','DDL'].includes(result); }
function normalizedResult(result){ return result==='DDL'?'Loss':result; }
function isDDLResult(result){ return result==='DDL'; }

function ticketNetUnits(ticket){
  const result=normalizedResult(ticket?.result||'Pending');
  const units=Number(ticket?.units);
  const odds=Number(ticket?.payoutOdds ?? ticket?.odds);
  if(!Number.isFinite(units)||units<=0)return 0;
  if(result==='Win'){
    const profit=americanProfitUnits(units,odds);
    return profit==null?0:profit;
  }
  if(result==='Loss')return -units;
  return 0;
}
function dashboardTickets(){
  const straight=state.wagers.map(w=>({
    id:w.id,week:gameById(w.gameId)?.week??null,who:w.who||'Unknown',
    type:w.betType,result:w.result||'Pending',units:Number(w.units)||0,
    payoutOdds:Number(w.payoutOdds)||-110
  }));
  const parlays=state.parlays.map(p=>({
    id:p.id,week:Number(p.week),who:p.who||'Unknown',
    type:p.isTeaser?'Teaser':'Parlay',result:p.result||'Pending',units:Number(p.units)||0,
    odds:Number(p.odds)||0
  }));
  return straight.concat(parlays);
}
function dashboardSummary(tickets){
  const graded=(tickets||[]).filter(t=>isGradedResult(t.result));
  let wins=0,losses=0,pushes=0,units=0,risked=0;
  graded.forEach(t=>{
    const r=normalizedResult(t.result);
    if(r==='Win')wins++;
    else if(r==='Loss')losses++;
    else if(r==='Push')pushes++;
    units+=ticketNetUnits(t);
    risked+=Number(t.units)||0;
  });
  const decisions=wins+losses;
  return {
    wins,losses,pushes,total:graded.length,
    winPct:decisions?wins/decisions*100:null,
    units,roi:risked?units/risked*100:null,risked
  };
}
function dashboardTargetWeek(now=new Date()){
  const start=Date.parse(WEEK_WINDOWS[4]?.start||'2026-09-21T05:00:00Z');
  const n=Math.floor((now.getTime()-start)/(7*24*60*60*1000))+4;
  if(n<4||n>12)return null;
  const weekday=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',weekday:'short'}).format(now);
  return weekday==='Sun'&&n<12?n+1:n;
}
function dashboardLastWeek(){
  const gradedWeeks=[...new Set(
    dashboardTickets()
      .filter(t=>isGradedResult(t.result)&&Number.isFinite(Number(t.week)))
      .map(t=>Number(t.week))
  )];
  const current=dashboardTargetWeek();
  if(current!=null&&gradedWeeks.includes(current-1))return current-1;
  const prior=current==null?gradedWeeks:gradedWeeks.filter(w=>w<current);
  return prior.length?Math.max(...prior):null;
}
function fmtPct(v){return v==null?'—':`${v.toFixed(1)}%`;}
function fmtUnits(v){
  const n=Number(v)||0;
  return `${n>0?'+':''}${n.toFixed(1)}u`;
}
function dashboardBreakdown(tickets,keyFn){
  const map=new Map();
  (tickets||[]).forEach(t=>{
    if(!isGradedResult(t.result))return;
    const key=keyFn(t)||'Unknown';
    const arr=map.get(key)||[];
    arr.push(t); map.set(key,arr);
  });
  return [...map.entries()].map(([name,rows])=>({name,...dashboardSummary(rows)}))
    .sort((a,b)=>b.units-a.units||b.total-a.total);
}

function dashboardWeeklyRows(){
  const tickets=dashboardTickets().filter(t=>isGradedResult(t.result)&&Number.isFinite(Number(t.week)));
  const byWeek=new Map();
  tickets.forEach(t=>{
    const week=Number(t.week);
    const arr=byWeek.get(week)||[];
    arr.push(t); byWeek.set(week,arr);
  });
  let cumulative=0;
  return [...byWeek.keys()].sort((a,b)=>a-b).map(week=>{
    const summary=dashboardSummary(byWeek.get(week));
    cumulative+=summary.units;
    return {week,...summary,cumulative};
  });
}
function dashboardStraightWagers(){
  return state.wagers.filter(w=>isGradedResult(w.result));
}
function dashboardSpreadProfileRows(){
  const buckets=new Map([
    ['Home Favorite',[]],['Home Dog',[]],['Road Favorite',[]],['Road Dog',[]]
  ]);
  dashboardStraightWagers().forEach(w=>{
    if(w.betType!=='Spread')return;
    const g=gameById(w.gameId);
    if(!g)return;
    const selected=w.selection;
    const side=selected===g.home?'Home':selected===g.away?'Road':null;
    const line=Number(w.line);
    if(!side||!Number.isFinite(line)||line===0)return;
    const role=line<0?'Favorite':'Dog';
    const key=`${side} ${role}`;
    if(buckets.has(key))buckets.get(key).push({
      result:w.result,units:Number(w.units)||0,payoutOdds:Number(w.payoutOdds)||-110
    });
  });
  return [...buckets.entries()].map(([name,rows])=>({name,...dashboardSummary(rows)}));
}
function dashboardTotalsRows(){
  const buckets=new Map([['Over',[]],['Under',[]]]);
  dashboardStraightWagers().forEach(w=>{
    if(w.betType!=='Total')return;
    const key=String(w.selection||'').toLowerCase()==='over'?'Over':
      String(w.selection||'').toLowerCase()==='under'?'Under':null;
    if(!key)return;
    buckets.get(key).push({
      result:w.result,units:Number(w.units)||0,payoutOdds:Number(w.payoutOdds)||-110
    });
  });
  return [...buckets.entries()].map(([name,rows])=>({name,...dashboardSummary(rows)}));
}
function renderDashboardAnalyticsRows(rows,{empty='No graded data yet.'}={}){
  const hasData=rows.some(r=>r.total>0);
  if(!hasData)return `<div class="dashboard-empty">${empty}</div>`;
  return rows.map(r=>`<div class="dashboard-analytics-row">
    <div class="dashboard-analytics-name">
      <strong>${escapeAttr(r.name)}</strong>
      <span>${r.total?`${r.wins}-${r.losses}-${r.pushes}`:'—'}</span>
    </div>
    <div>
      <strong>${r.total?fmtPct(r.winPct):'—'}</strong>
      <span>Win %</span>
    </div>
    <div class="${r.units>0?'positive':r.units<0?'negative':''}">
      <strong>${r.total?fmtUnits(r.units):'—'}</strong>
      <span>Units</span>
    </div>
    <div class="${r.roi>0?'positive':r.roi<0?'negative':''}">
      <strong>${r.total?fmtPct(r.roi):'—'}</strong>
      <span>ROI</span>
    </div>
  </div>`).join('');
}
function renderWeeklyPerformance(){
  const rows=dashboardWeeklyRows();
  if(!rows.length)return `<div class="dashboard-empty">No graded weekly data yet.</div>`;
  const maxAbs=Math.max(1,...rows.map(r=>Math.abs(r.units)));
  return `<div class="weekly-performance-card">
    ${rows.map(r=>{
      const width=Math.max(4,Math.round(Math.abs(r.units)/maxAbs*100));
      const cls=r.units>0?'positive':r.units<0?'negative':'neutral';
      return `<div class="weekly-performance-row">
        <div class="weekly-performance-head">
          <strong>Week ${r.week}</strong>
          <span>${r.wins}-${r.losses}-${r.pushes} · ${fmtPct(r.winPct)}</span>
        </div>
        <div class="weekly-performance-bar-track">
          <div class="weekly-performance-bar ${cls}" style="width:${width}%"></div>
        </div>
        <div class="weekly-performance-foot">
          <span class="${r.units>0?'positive':r.units<0?'negative':''}">${fmtUnits(r.units)}</span>
          <span>Cumulative ${fmtUnits(r.cumulative)}</span>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function dashboardParlayTicketRows(){
  const makeRow=(label,isTeaser)=>{
    const tickets=state.parlays.filter(p=>p.isTeaser===isTeaser&&isGradedResult(p.result));
    const summary=dashboardSummary(tickets.map(p=>({
      result:p.result,
      units:Number(p.units)||0,
      odds:Number(p.odds)||0
    })));
    const legCounts=tickets.map(p=>legsForParlay(p.id).length).filter(n=>n>0);
    const avgLegs=legCounts.length?legCounts.reduce((a,b)=>a+b,0)/legCounts.length:null;

    const losing=tickets.filter(p=>normalizedResult(p.result)==='Loss');
    const missCounts=losing.map(p=>{
      const legs=legsForParlay(p.id);
      return legs.filter(l=>['Loss','DDL'].includes(l.result)).length;
    }).filter(n=>n>0);

    const avgMiss=missCounts.length?missCounts.reduce((a,b)=>a+b,0)/missCounts.length:null;

    const dist=new Map();
    missCounts.forEach(n=>dist.set(n,(dist.get(n)||0)+1));

    return {
      name:label,
      ...summary,
      avgLegs,
      avgMiss,
      missDistribution:[...dist.entries()].sort((a,b)=>a[0]-b[0]),
      losingTickets:losing.length
    };
  };

  return [
    makeRow('Parlay',false),
    makeRow('Teaser',true)
  ];
}

function renderParlayTicketTable(){
  const rows=dashboardParlayTicketRows();
  const hasData=rows.some(r=>r.total>0);
  if(!hasData)return `<div class="dashboard-empty">No graded parlays or teasers yet.</div>`;

  return `<div class="dashboard-card parlay-ticket-card">
    ${rows.map(r=>`<div class="parlay-ticket-row">
      <div class="parlay-ticket-main">
        <strong>${r.name}</strong>
        <span>${r.total?`${r.wins}-${r.losses}-${r.pushes}`:'—'}</span>
      </div>
      <div>
        <strong>${r.total?fmtPct(r.winPct):'—'}</strong>
        <span>Win %</span>
      </div>
      <div>
        <strong>${r.avgLegs==null?'—':r.avgLegs.toFixed(1)}</strong>
        <span>Avg Legs</span>
      </div>
      <div>
        <strong>${r.avgMiss==null?'—':r.avgMiss.toFixed(1)}</strong>
        <span>Avg Missed</span>
      </div>
      <div class="${r.units>0?'positive':r.units<0?'negative':''}">
        <strong>${r.total?fmtUnits(r.units):'—'}</strong>
        <span>Units</span>
      </div>
    </div>`).join('')}
  </div>`;
}

function renderMissedLegsBreakdown(){
  const rows=dashboardParlayTicketRows();
  const withLosses=rows.filter(r=>r.losingTickets>0);

  if(!withLosses.length)return `<div class="dashboard-empty">No losing parlay/teaser tickets to analyze yet.</div>`;

  return `<div class="missed-legs-grid">
    ${withLosses.map(r=>`<div class="missed-legs-card">
      <div class="missed-legs-head">
        <strong>${r.name}</strong>
        <span>${r.losingTickets} losing ticket${r.losingTickets===1?'':'s'}</span>
      </div>
      <div class="missed-legs-list">
        ${r.missDistribution.map(([legs,count])=>`<div class="missed-legs-item">
          <span>Missed by ${legs} leg${legs===1?'':'s'}</span>
          <strong>${count}</strong>
        </div>`).join('')}
      </div>
    </div>`).join('')}
  </div>`;
}

function renderDashboardMetric(label,value,sub=''){
  return `<div class="dashboard-metric"><div class="dashboard-metric-label">${label}</div><div class="dashboard-metric-value">${value}</div>${sub?`<div class="dashboard-metric-sub">${sub}</div>`:''}</div>`;
}
function renderDashboardBreakdownRows(rows){
  if(!rows.length)return `<div class="dashboard-empty">No graded data yet.</div>`;
  return rows.map(r=>`<div class="dashboard-breakdown-row">
    <div><strong>${escapeAttr(r.name)}</strong><span>${r.wins}-${r.losses}-${r.pushes}</span></div>
    <div><strong>${fmtPct(r.winPct)}</strong><span>Win %</span></div>
    <div class="${r.units>0?'positive':r.units<0?'negative':''}"><strong>${fmtUnits(r.units)}</strong><span>Units</span></div>
  </div>`).join('');
}
function renderDashboard(){
  const tickets=dashboardTickets();
  const season=dashboardSummary(tickets);
  const lastWeek=dashboardLastWeek();
  const lastWeekTickets=lastWeek==null?[]:tickets.filter(t=>Number(t.week)===lastWeek);
  const last=dashboardSummary(lastWeekTickets);
  const byPicker=dashboardBreakdown(tickets,t=>t.who);
  const byType=dashboardBreakdown(tickets,t=>t.type);

  return `<div class="dashboard-screen">
    <section class="dashboard-section">
      <div class="dashboard-section-head">
        <div>
          <div class="section-title">Season Snapshot</div>
          <div class="dashboard-section-copy">Your graded TrackPicks tickets for the 2026 season.</div>
        </div>
      </div>
      <div class="dashboard-hero-grid">
        ${renderDashboardMetric('Record',`${season.wins}-${season.losses}-${season.pushes}`,`${season.total} graded`)}
        ${renderDashboardMetric('Win %',fmtPct(season.winPct),'Pushes excluded')}
        ${renderDashboardMetric('Units',fmtUnits(season.units),`${season.risked.toFixed(1)}u risked`)}
        ${renderDashboardMetric('ROI',fmtPct(season.roi),'Net units ÷ units risked')}
      </div>
    </section>

    <section class="dashboard-section">
      <div class="dashboard-section-head">
        <div>
          <div class="section-title">Last Week</div>
          <div class="dashboard-section-copy">${lastWeek==null?'No prior graded week yet.':`Week ${lastWeek}`}</div>
        </div>
      </div>
      ${lastWeek==null?`<div class="dashboard-empty">Once a prior week has graded picks, its snapshot will appear here.</div>`:
      `<div class="dashboard-mini-grid">
        ${renderDashboardMetric('Record',`${last.wins}-${last.losses}-${last.pushes}`)}
        ${renderDashboardMetric('Win %',fmtPct(last.winPct))}
        ${renderDashboardMetric('Units',fmtUnits(last.units))}
        ${renderDashboardMetric('ROI',fmtPct(last.roi))}
      </div>`}
    </section>

    <section class="dashboard-section">
      <div class="dashboard-section-head">
        <div>
          <div class="section-title">Historical Data</div>
          <div class="dashboard-section-copy">Import prior picks or download the TrackPicks entry template.</div>
        </div>
      </div>
      <div class="dashboard-import-card">
        <div class="dashboard-import-actions">
          <button type="button" class="primary" data-import-history>Import Data</button>
          <button type="button" class="secondary" data-download-import-template>Download Blank Template</button>
          <button type="button" class="secondary dashboard-manage-imports" data-manage-imports>Manage Imports</button>
        </div>
        <input type="file" data-history-file accept=".csv,.xlsx" hidden>
        <div class="dashboard-import-note">Accepts TrackPicks CSV or XLSX files. Line fields may be numeric (-8.5) or Pick-style (TCU -8.5). The full file is validated before any rows are written.</div>
        ${state.importMessage?`<div class="notice dashboard-import-message">${escapeAttr(state.importMessage)}</div>`:''}
      </div>
    </section>

    <section class="dashboard-section">
      <div class="dashboard-section-head">
        <div>
          <div class="section-title">Weekly Performance</div>
          <div class="dashboard-section-copy">Ticket-level record and units by week.</div>
        </div>
      </div>
      ${renderWeeklyPerformance()}
    </section>

    <section class="dashboard-section dashboard-split-section">
      <div>
        <div class="dashboard-section-head">
          <div>
            <div class="section-title">Spread Profile</div>
            <div class="dashboard-section-copy">Graded straight spread bets.</div>
          </div>
        </div>
        <div class="dashboard-card dashboard-analytics-card">
          ${renderDashboardAnalyticsRows(dashboardSpreadProfileRows(),{empty:'No graded spread bets yet.'})}
        </div>
      </div>

      <div>
        <div class="dashboard-section-head">
          <div>
            <div class="section-title">Totals Breakdown</div>
            <div class="dashboard-section-copy">Graded straight totals bets.</div>
          </div>
        </div>
        <div class="dashboard-card dashboard-analytics-card">
          ${renderDashboardAnalyticsRows(dashboardTotalsRows(),{empty:'No graded totals bets yet.'})}
        </div>
      </div>
    </section>

    <section class="dashboard-section">
      <div class="dashboard-section-head">
        <div>
          <div class="section-title">Parlays & Teasers</div>
          <div class="dashboard-section-copy">Ticket-level performance and average number of losing legs.</div>
        </div>
      </div>
      ${renderParlayTicketTable()}
    </section>

    <section class="dashboard-section">
      <div class="dashboard-section-head">
        <div>
          <div class="section-title">How Many Legs Did You Miss By?</div>
          <div class="dashboard-section-copy">Counts only losing tickets with graded individual legs.</div>
        </div>
      </div>
      ${renderMissedLegsBreakdown()}
    </section>

    <section class="dashboard-section">
      <div class="section-title">Performance by Picker</div>
      <div class="dashboard-card">${renderDashboardBreakdownRows(byPicker)}</div>
    </section>

    <section class="dashboard-section">
      <div class="section-title">Performance by Bet Type</div>
      <div class="dashboard-card">${renderDashboardBreakdownRows(byType)}</div>
    </section>

    <div class="dashboard-coming-soon">
      <strong>Next dashboard layers</strong>
      <span>Spread-size buckets, conference/team analytics, deeper leg breakdowns, DDL and caution.</span>
    </div>
  </div>`;
}
function gradedWagers(){ return state.wagers.filter(w=>isGradedResult(w.result)); }
function reportMonths(){
  const map=new Map();
  gradedWagers().forEach(w=>{
    const g=gameById(w.gameId);
    if(!g?.commenceTime)return;
    const d=new Date(g.commenceTime);
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if(!map.has(key))map.set(key,new Intl.DateTimeFormat(undefined,{month:'long',year:'numeric'}).format(d));
  });
  return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
}
function wagersForReport(scope,value){
  return gradedWagers().filter(w=>{
    const g=gameById(w.gameId);
    if(!g)return false;
    if(scope==='week')return g.week===Number(value);
    if(scope==='month'){
      if(!g.commenceTime)return false;
      const d=new Date(g.commenceTime);
      const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      return key===value;
    }
    return true;
  }).sort((a,b)=>{
    const ga=gameById(a.gameId),gb=gameById(b.gameId);
    return (ga?.week||0)-(gb?.week||0)||new Date(ga?.commenceTime||0)-new Date(gb?.commenceTime||0);
  });
}

function hasSpread(g){ return g?.spread!=null && !!g.spreadTeam; }
function hasTotal(g){ return g?.total!=null; }
function formatKickoff(iso){ if(!iso)return{date:'Time TBD',time:''}; const d=new Date(iso); return {date:new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric'}).format(d),time:new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(d)}; }
function formatWeekRange(week){ const win=WEEK_WINDOWS[week]; if(!win)return''; const a=new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(new Date(win.start)); const b=new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(new Date(win.end)); return `${a}–${b}`; }
function marketSummary(g){ const s=hasSpread(g)?`${g.spreadTeam} ${signed(g.spread)}`:'Spread unavailable'; const t=hasTotal(g)?`O/U ${g.total}`:'O/U unavailable'; return `${s} · ${t}`; }

function latestOddsPullTimestamp(){
  if(state.lastOddsPullAt)return state.lastOddsPullAt;
  const timestamps=(state.oddsHistory||[])
    .map(h=>h?.capturedAt)
    .filter(Boolean)
    .map(value=>new Date(value))
    .filter(d=>!Number.isNaN(d.getTime()));
  if(!timestamps.length)return null;
  return new Date(Math.max(...timestamps.map(d=>d.getTime()))).toISOString();
}

function formatAdminTimestamp(iso){
  if(!iso)return 'No successful pull recorded yet';
  const d=new Date(iso);
  if(Number.isNaN(d.getTime()))return 'No successful pull recorded yet';
  return new Intl.DateTimeFormat('en-US',{
    timeZone:'America/Chicago',
    month:'short',day:'numeric',year:'numeric',
    hour:'numeric',minute:'2-digit',timeZoneName:'short'
  }).format(d);
}

function apiUsageSummary(){
  const u=state.apiUsage;
  if(!u || !Number.isFinite(u.used) || !Number.isFinite(u.remaining)) return 'Usage will appear after the next Load Week.';
  const total=u.used+u.remaining;
  const cost=Number.isFinite(u.lastPullCost)?u.lastPullCost:null;
  return `${u.used} / ${total} credits used · ${u.remaining} remaining${cost!=null?` · Last Load Week: ${cost} credits`:''}`;
}

function cloudConfigured(){ return true; }

async function initCloud(){
  if(!cloudConfigured()){ state.authReady=true; render(); return; }
  try{
    state.sb=window.supabase.createClient(state.supabaseUrl,state.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const {data,error}=await state.sb.auth.getSession();
    if(error) throw error;
    state.session=data.session; state.user=data.session?.user||null;
    await refreshAdminStatus();
    if(state.user) await loadUserProfile();
    state.sb.auth.onAuthStateChange(async (_event,session)=>{
      state.session=session; state.user=session?.user||null;
      await refreshAdminStatus();
      if(state.user) await loadUserProfile();
      if(state.user) await syncFromCloud();
      else {state.isAdmin=false;state.games=[];state.wagers=[];state.cautionGameIds=[];state.oddsHistory=[];state.cfbTeams=[];state.cfbAliases=[];state.cfbRankings=[];state.lastOddsPullAt=null;}
      render();
    });
    if(state.user) await syncFromCloud();
  }catch(err){ state.authMessage=`Cloud setup error: ${err.message||err}`; }
  state.authReady=true; render();
}

async function syncFromCloud(){
  if(!state.sb||!state.user)return;
  state.syncing=true; render();
  try{
    const [gamesRes,wagersRes,flagsRes,teamsRes,aliasesRes,rankingsRes]=await Promise.all([
      state.sb.from('games').select('*').eq('season',2026).gte('week',0).lte('week',12),
      state.sb.from('wagers').select('*').eq('user_id',state.user.id),
      state.sb.from('user_game_flags').select('game_id,caution').eq('user_id',state.user.id).eq('caution',true),
      state.sb.from('cfb_teams').select('espn_name,espn_team_id,conference,subdivision,season,abbreviation,logo_url,short_display_name,short_nickname,smaller_font,smaller_nickname_font,extra_small_nickname_font').eq('season',2026),
      state.sb.from('cfb_team_aliases').select('provider,alias,espn_name'),
      state.sb.from('cfb_rankings').select('season,week,poll_type,poll_name,rank,team_id,published_at').eq('season',2026).gte('week',0).lte('week',20)
    ]);
    if(gamesRes.error)throw gamesRes.error;
    if(wagersRes.error)throw wagersRes.error;
    if(flagsRes.error)throw flagsRes.error;
    if(teamsRes.error)throw teamsRes.error;
    if(aliasesRes.error)throw aliasesRes.error;
    if(rankingsRes.error)throw rankingsRes.error;
    state.games=(gamesRes.data||[]).map(fromDbGame);
    state.wagers=(wagersRes.data||[]).map(fromDbWager);
    state.cautionGameIds=(flagsRes.data||[]).map(r=>r.game_id);
    state.cfbTeams=(teamsRes.data||[]).map(r=>({espnName:r.espn_name,espnTeamId:r.espn_team_id||'',conference:r.conference,subdivision:r.subdivision,season:r.season,abbreviation:r.abbreviation||'',logoUrl:r.logo_url||'',shortDisplayName:r.short_display_name||'',shortNickname:r.short_nickname||'',smallerFont:!!r.smaller_font,smallerNicknameFont:!!r.smaller_nickname_font,extraSmallNicknameFont:!!r.extra_small_nickname_font}));
    state.cfbAliases=(aliasesRes.data||[]).map(r=>({provider:r.provider,alias:r.alias,espnName:r.espn_name}));
    state.cfbRankings=(rankingsRes.data||[]).map(r=>({season:Number(r.season),week:Number(r.week),pollType:r.poll_type,pollName:r.poll_name,rank:Number(r.rank),teamId:String(r.team_id),publishedAt:r.published_at||null}));
    const historyRes=await fetchAllOddsHistory();
    state.oddsHistory=historyRes.error?[]:(historyRes.data||[]).map(fromDbOddsSnapshot);
    const [parlaysRes,parlayLegsRes]=await Promise.all([
      state.sb.from('parlays').select('*').eq('user_id',state.user.id).eq('season',2026).gte('week',0).lte('week',12).order('created_at',{ascending:true}),
      state.sb.from('parlay_legs').select('*').eq('user_id',state.user.id).order('leg_order',{ascending:true})
    ]);
    state.parlays=parlaysRes.error?[]:(parlaysRes.data||[]).map(fromDbParlay);
    state.parlayLegs=parlayLegsRes.error?[]:(parlayLegsRes.data||[]).map(fromDbParlayLeg);
  }catch(err){ state.importMessage=`Sync failed: ${err.message||err}`; }
  finally{ state.syncing=false; }
}

async function fetchAllOddsHistory(){
  const pageSize=1000;
  let from=0;
  const rows=[];
  while(true){
    const res=await state.sb.from('game_odds_history')
      .select('*')
      .eq('season',2026)
      .gte('week',0)
      .lte('week',12)
      .order('captured_at',{ascending:true})
      .range(from,from+pageSize-1);
    if(res.error)return {data:rows,error:res.error};
    const page=res.data||[];
    rows.push(...page);
    if(page.length<pageSize)break;
    from+=pageSize;
  }
  return {data:rows,error:null};
}

function fromDbGame(r){ return {id:r.id,sourceEventId:r.source_event_id,sourceSportKey:r.source_sport_key,week:r.week,away:r.away,home:r.home,spreadTeam:r.spread_team,spread:r.spread==null?null:Number(r.spread),total:r.total==null?null:Number(r.total),awaySpreadOdds:r.away_spread_odds==null?null:Number(r.away_spread_odds),homeSpreadOdds:r.home_spread_odds==null?null:Number(r.home_spread_odds),overOdds:r.over_odds==null?null:Number(r.over_odds),underOdds:r.under_odds==null?null:Number(r.under_odds),awayMoneyline:r.away_moneyline==null?null:Number(r.away_moneyline),homeMoneyline:r.home_moneyline==null?null:Number(r.home_moneyline),commenceTime:r.commence_time,marketUpdatedAt:r.market_updated_at,tv:r.tv_network||r.tv||'',location:r.location||'',espnEventId:r.espn_event_id||'',venueName:r.venue_name||'',venueCity:r.venue_city||'',venueState:r.venue_state||'',awayScore:r.away_score==null?null:Number(r.away_score),homeScore:r.home_score==null?null:Number(r.home_score),gameCompleted:!!r.game_completed,gameStatus:r.game_status||'',resultsUpdatedAt:r.espn_results_updated_at||null}; }
function toDbGame(g){ return {id:g.id,source_event_id:g.sourceEventId||null,source_sport_key:g.sourceSportKey||null,season:2026,week:g.week,away:g.away,home:g.home,spread_team:g.spreadTeam||null,spread:g.spread,total:g.total,commence_time:g.commenceTime,market_updated_at:g.marketUpdatedAt||null,tv:g.tv||'',location:g.location||'',updated_at:new Date().toISOString()}; }
function fromDbOddsSnapshot(r){ return {id:r.id,gameId:r.game_id,week:r.week,spreadTeam:r.spread_team,spread:r.spread==null?null:Number(r.spread),total:r.total==null?null:Number(r.total),marketUpdatedAt:r.market_updated_at,capturedAt:r.captured_at}; }
function toDbOddsSnapshot(g,capturedAt){ return {game_id:g.id,season:2026,week:g.week,spread_team:g.spreadTeam||null,spread:g.spread,total:g.total,market_updated_at:g.marketUpdatedAt||null,captured_at:capturedAt}; }
function relatedGameIdsForHistory(gameOrId){
  const g=typeof gameOrId==='object'&&gameOrId?gameOrId:gameById(gameOrId);
  const seedId=typeof gameOrId==='string'?gameOrId:g?.id;
  const ids=new Set(seedId?[seedId]:[]);
  if(!g)return ids;
  for(const candidate of state.games||[]){
    const sameEspn=g.espnEventId&&candidate.espnEventId&&String(candidate.espnEventId)===String(g.espnEventId);
    const sameMatchup=Number(candidate.week)===Number(g.week)&&candidate.away===g.away&&candidate.home===g.home;
    if(sameEspn||sameMatchup)ids.add(candidate.id);
  }
  return ids;
}
function oddsHistoryForGame(gameOrId){
  const ids=relatedGameIdsForHistory(gameOrId);
  return state.oddsHistory.filter(h=>ids.has(h.gameId)).sort((a,b)=>new Date(a.capturedAt)-new Date(b.capturedAt));
}
function spreadForTeamFromSnapshot(h,team){ if(h?.spread==null||!h.spreadTeam)return null; return h.spreadTeam===team?h.spread:-h.spread; }

function spreadMovementSignal(previous,current){
  const prev=Number(previous);
  const cur=Number(current);
  if(!Number.isFinite(prev)||!Number.isFinite(cur)||Math.abs(prev-cur)<0.001)return null;

  // TrackPicks bettor semantics:
  // +14 -> +13 = stronger = green up
  //  +5 ->  +6 = weaker   = red down
  // -11 -> -13 = stronger = green up
  //  -5 ->  -4 = weaker   = red down
  return cur<prev?'up':'down';
}
function totalMovementSignal(previous,current){
  const prev=Number(previous);
  const cur=Number(current);
  if(!Number.isFinite(prev)||!Number.isFinite(cur)||Math.abs(prev-cur)<0.001)return null;
  return cur>prev?'up':'down';
}
function cardSpreadTeam(g){
  // Keep the card tied to the team represented by the current market.
  // If no spread-team label exists, default to the home side.
  return g.spreadTeam||g.home;
}
function cardSpreadValue(g){
  const team=cardSpreadTeam(g);
  return fmtSpread(g,team);
}
function cardMovementSignals(g){
  const history=oddsHistoryForGame(g);
  if(!history.length)return {spread:null,total:null};

  const first=history[0];
  const team=cardSpreadTeam(g);
  const firstSpread=spreadForTeamFromSnapshot(first,team);
  const currentSpread=cardSpreadValue(g);

  return {
    spread:spreadMovementSignal(firstSpread,currentSpread),
    total:totalMovementSignal(first.total,g.total)
  };
}
function cardTeamAbbreviation(name){
  const meta=teamMetaFor(name);
  return meta?.abbreviation||teamMonogram(name);
}
function cardTeamLogo(name){
  return teamMetaFor(name)?.logoUrl||'';
}



const MULTIWORD_MASCOT_SUFFIXES=[
  '49ers','Aggies','Aztecs','Badgers','Bearcats','Bears','Beavers','Black Bears',
  'Blue Devils','Blue Hens','Blue Raiders','Bobcats','Boilermakers','Broncos',
  'Bruins','Buccaneers','Buffaloes','Bulldogs','Cardinals','Chanticleers',
  'Chippewas','Commodores','Cornhuskers','Cougars','Cowboys','Crimson Tide',
  'Cyclones','Demon Deacons','Dukes','Eagles','Falcons','Fighting Illini',
  'Flames','Flyers','Gamecocks','Golden Bears','Golden Eagles','Golden Flashes',
  'Golden Gophers','Golden Hurricane','Governors','Green Wave','Hawkeyes',
  'Hilltoppers','Hoosiers','Horned Frogs','Huskies','Jaguars','Jayhawks',
  'Kangaroos','Keydets','Knights','Lancers','Leopards','Lions','Lobos',
  'Mean Green','Midshipmen','Miners','Monarchs','Mountaineers','Mustangs',
  'Nittany Lions','Owls','Paladins','Panthers','Pirates','Ragin Cajuns',
  'Rainbow Warriors','Rams','Rebels','Red Foxes','Red Raiders','Red Wolves',
  'Rockets','Scarlet Knights','Seminoles','Sooners','Spartans','Sun Devils',
  'Sycamores','Tar Heels','Terrapins','Thundering Herd','Tigers','Titans',
  'Trojans','Utes','Vandals','Vikings','Volunteers','Warhawks','Warriors',
  'Wildcats','Wolf Pack','Wolfpack','Wolverines','Yellow Jackets','Zips'
].sort((a,b)=>b.length-a.length);

function splitSlateTeamName(fullName){
  const full=String(fullName||'').trim();
  if(!full)return {school:'',mascot:''};
  const lower=full.toLowerCase();
  for(const mascot of MULTIWORD_MASCOT_SUFFIXES){
    const suffix=' '+mascot.toLowerCase();
    if(lower.endsWith(suffix)){
      return {
        school:full.slice(0,full.length-suffix.length).trim(),
        mascot
      };
    }
  }
  const parts=full.split(/\s+/);
  if(parts.length<2)return {school:full,mascot:''};
  return {school:parts.slice(0,-1).join(' '),mascot:parts.at(-1)};
}

function renderSlateTeamHero(name,side){
  const meta=teamMetaFor(name);
  const abbr=meta?.abbreviation||teamMonogram(name);
  const parts=splitSlateTeamName(name);
  const shortName=(meta?.shortDisplayName||meta?.short_display_name||'').trim();
  const nicknameOverride=(meta?.shortNickname||meta?.short_nickname||'').trim();
  const school=shortName||parts.school;
  const mascot=nicknameOverride||parts.mascot;
  const ranking=rankingForTeam(name,state.selectedWeek);
  const rankHtml=ranking?`<span class="slate-rank" title="${escapeAttr(ranking.pollName||ranking.pollType?.toUpperCase()||'Ranking')}">#${ranking.rank}</span>`:'';
  const smallerSchool=!!(meta?.smallerFont||meta?.smaller_font);
  const smallerMascot=!!(meta?.smallerNicknameFont||meta?.smaller_nickname_font);
  const extraSmallMascot=!!(meta?.extraSmallNicknameFont||meta?.extra_small_nickname_font);
  const logo=meta?.logoUrl
    ? `<img class="slate-team-logo" src="${escapeAttr(meta.logoUrl)}" alt="" loading="lazy">`
    : `<div class="slate-team-logo slate-team-logo-fallback" aria-hidden="true">${escapeAttr(abbr)}</div>`;
  return `<div class="slate-team slate-team-${side}${smallerSchool?' slate-team-smaller-font':''}${smallerMascot?' slate-team-smaller-nickname':''}${extraSmallMascot?' slate-team-extra-small-nickname':''}" data-team-name="${escapeAttr(name)}" data-short-name="${escapeAttr(shortName)}">
    ${logo}
    <div class="slate-team-copy">
      <div class="slate-school-name" data-school-name="${escapeAttr(parts.school)}">${rankHtml}${escapeAttr(school)}</div>
      ${mascot?`<div class="slate-mascot-name">${escapeAttr(mascot)}</div>`:''}
      ${state.isAdmin&&!shortName?`<div class="short-name-flag" data-short-name-flag="${escapeAttr(name)}" hidden>Needs short display name</div>`:''}
    </div>
  </div>`;
}

function renderMovementArrow(signal,label){
  if(signal==='up')return `<span class="market-move market-move-up" aria-label="${escapeAttr(label)} strengthening">↑</span>`;
  if(signal==='down')return `<span class="market-move market-move-down" aria-label="${escapeAttr(label)} weakening">↓</span>`;
  return '';
}
function renderSlateSpreadBlock(g,signals){
  if(!hasSpread(g))return `<div class="slate-market-box slate-market-missing">
    <span class="slate-market-label">Spread</span>
    <strong>Unavailable</strong>
  </div>`;
  const team=cardSpreadTeam(g);
  const line=cardSpreadValue(g);
  const meta=teamMetaFor(team);
  const abbr=meta?.abbreviation||teamMonogram(team);
  const logo=meta?.logoUrl
    ? `<img class="slate-market-logo" src="${escapeAttr(meta.logoUrl)}" alt="" loading="lazy">`
    : `<span class="slate-market-logo slate-market-logo-fallback">${escapeAttr(abbr)}</span>`;
  return `<div class="slate-market-box slate-spread-box">
    <span class="slate-market-value">${logo}<span class="slate-market-abbr">${escapeAttr(abbr)}</span><strong>${signed(line)}</strong>${renderMovementArrow(signals.spread,team)}</span>
  </div>`;
}
function renderSlateTotalBlock(g,signals){
  if(!hasTotal(g))return `<div class="slate-market-box slate-market-missing">
    <span class="slate-market-label">O/U</span>
    <strong>Unavailable</strong>
  </div>`;
  return `<div class="slate-market-box slate-total-box">
    <span class="slate-market-value slate-total-value"><strong class="slate-ou-label">O/U</strong><strong>${escapeAttr(String(g.total))}</strong>${signals.total==='up'
      ? `<span class="market-move market-move-up" aria-label="Total rising">↑</span>`
      : signals.total==='down'
        ? `<span class="market-move market-move-down" aria-label="Total falling">↓</span>`
        : ''}</span>
  </div>`;
}
function renderSlateStatus(saved,caution,missing){
  const bits=[];
  if(saved)bits.push(`<span class="slate-status slate-status-saved">${saved} saved</span>`);
  if(caution)bits.push(`<span class="slate-status slate-status-caution">⚠ Caution</span>`);
  if(missing)bits.push(`<span class="slate-status slate-status-missing">Missing market</span>`);
  return bits.length?`<div class="slate-status-row">${bits.join('')}</div>`:'';
}
function detectSlateShortNameNeeds(){
  if(!state.isAdmin)return;
  requestAnimationFrame(()=>{
    document.querySelectorAll('.slate-team').forEach(teamEl=>{
      const nameEl=teamEl.querySelector('.slate-school-name');
      const flag=teamEl.querySelector('.short-name-flag');
      if(!nameEl||!flag)return;
      const hasShort=(teamEl.dataset.shortName||'').trim().length>0;
      if(hasShort){ flag.hidden=true; return; }
      const wrapped=(nameEl.scrollHeight-nameEl.clientHeight)>1;
      flag.hidden=!wrapped;
    });
  });
}


function movementForGame(g){
  const history=oddsHistoryForGame(g);
  if(!history.length)return null;
  const first=history[0];
  const firstHome=spreadForTeamFromSnapshot(first,g.home), currentHome=fmtSpread(g,g.home);
  const spreadMove=firstHome!=null&&currentHome!=null?currentHome-firstHome:null;
  const totalMove=first.total!=null&&g.total!=null?g.total-first.total:null;
  if((spreadMove==null||Math.abs(spreadMove)<0.001)&&(totalMove==null||Math.abs(totalMove)<0.001))return {history,first,spreadMove,totalMove,moved:false};
  return {history,first,spreadMove,totalMove,moved:true};
}
function movementSummary(g){
  const m=movementForGame(g);
  if(!m?.moved)return'';
  const bits=[];
  if(m.spreadMove!=null&&Math.abs(m.spreadMove)>=0.001){
    const firstHome=spreadForTeamFromSnapshot(m.first,g.home), currentHome=fmtSpread(g,g.home);
    bits.push(`${g.home} ${signed(firstHome)} → ${signed(currentHome)}`);
  }
  if(m.totalMove!=null&&Math.abs(m.totalMove)>=0.001) bits.push(`O/U ${m.first.total} → ${g.total}`);
  return bits.join(' · ');
}
function compactOddsHistory(g){
  const rows=oddsHistoryForGame(g);
  const compact=[];
  rows.forEach(h=>{
    const homeSpread=spreadForTeamFromSnapshot(h,g.home);
    const key=`${homeSpread??''}|${h.total??''}`;
    if(!compact.length||compact[compact.length-1].key!==key) compact.push({...h,homeSpread,key});
  });
  const currentHome=fmtSpread(g,g.home), currentKey=`${currentHome??''}|${g.total??''}`;
  if(!compact.length||compact[compact.length-1].key!==currentKey) compact.push({capturedAt:g.marketUpdatedAt||new Date().toISOString(),homeSpread:currentHome,total:g.total,key:currentKey});
  return compact;
}
function renderMovementOverview(g){
  const rows=oddsHistoryForGame(g);
  if(!rows.length)return '<div class="movement-empty">No line movement captured yet.</div>';
  const first=rows[0];
  const currentSpreadTeam=g.spreadTeam||first.spreadTeam||g.home;
  const currentSpread=g.spread==null?null:Number(g.spread);
  const firstFromCurrentTeam=currentSpreadTeam?spreadForTeamFromSnapshot(first,currentSpreadTeam):null;
  const spreadDelta=firstFromCurrentTeam!=null&&currentSpread!=null?Number((currentSpread-firstFromCurrentTeam).toFixed(1)):null;
  const currentSpreadSchool=currentSpreadTeam?splitSlateTeamName(currentSpreadTeam).school:'';
  const openingSpreadSchool=first.spreadTeam?splitSlateTeamName(first.spreadTeam).school:'';
  const currentSpreadLabel=currentSpreadSchool&&currentSpread!=null?`${currentSpreadSchool} ${signed(currentSpread)}`:'—';
  const openingSpreadLabel=openingSpreadSchool&&first.spread!=null?`${openingSpreadSchool} ${signed(Number(first.spread))}`:'—';
  let spreadMove='No net move';
  if(spreadDelta!=null&&Math.abs(spreadDelta)>=0.001){
    spreadMove=spreadDelta<0?`${Math.abs(spreadDelta)} pts toward ${currentSpreadTeam}`:`${Math.abs(spreadDelta)} pts away from ${currentSpreadTeam}`;
  }
  const currentTotal=g.total==null?null:Number(g.total);
  const openingTotal=first.total==null?null:Number(first.total);
  const totalDelta=currentTotal!=null&&openingTotal!=null?Number((currentTotal-openingTotal).toFixed(1)):null;
  let totalMove='No net move';
  if(totalDelta!=null&&Math.abs(totalDelta)>=0.001) totalMove=`${totalDelta>0?'↑':'↓'} ${Math.abs(totalDelta)} pt${Math.abs(totalDelta)===1?'':'s'}`;
  return `<div class="movement-overview">
    <div class="movement-market-block">
      <span class="movement-market-label">Spread</span>
      <strong class="movement-current">${escapeAttr(currentSpreadLabel)}</strong>
      <span class="movement-opened">Opened* ${escapeAttr(openingSpreadLabel)}</span>
      <span class="movement-net">${escapeAttr(spreadMove)}</span>
    </div>
    <div class="movement-market-block">
      <span class="movement-market-label">Total</span>
      <strong class="movement-current">${currentTotal==null?'—':currentTotal}</strong>
      <span class="movement-opened">Opened* ${openingTotal==null?'—':openingTotal}</span>
      <span class="movement-net">${escapeAttr(totalMove)}</span>
    </div>
  </div><div class="movement-opener-note">*TrackPicks first captured DraftKings line.</div>`;
}

function historyChartPoints(g,kind){
  const rows=oddsHistoryForGame(g);
  return rows.map(h=>({
    capturedAt:h.capturedAt,
    value:kind==='Spread'?spreadForTeamFromSnapshot(h,g.home):h.total
  })).filter(p=>p.value!=null&&p.capturedAt).sort((a,b)=>new Date(a.capturedAt)-new Date(b.capturedAt));
}
function renderHistorySvg(points,kind,g){
  if(points.length<2)return '<div class="chart-empty">Not enough snapshots to graph yet.</div>';
  const W=620,H=270,L=54,R=18,T=20,B=42,STEP=.5;
  const times=points.map(p=>new Date(p.capturedAt).getTime()), vals=points.map(p=>Number(p.value));
  let minT=Math.min(...times),maxT=Math.max(...times);if(maxT===minT)maxT=minT+1;
  let dataMin=Math.min(...vals),dataMax=Math.max(...vals);
  let minV=Math.floor(dataMin/STEP)*STEP,maxV=Math.ceil(dataMax/STEP)*STEP;
  if(maxV===minV){minV-=STEP;maxV+=STEP;}else{minV-=STEP;maxV+=STEP;}
  minV=Number(minV.toFixed(1));maxV=Number(maxV.toFixed(1));
  const x=t=>L+((t-minT)/(maxT-minT))*(W-L-R), y=v=>T+(1-(v-minV)/(maxV-minV))*(H-T-B);
  const coords=points.map((p,i)=>({x:x(times[i]),y:y(vals[i]),p,i}));
  const path=coords.map((c,i)=>`${i?'L':'M'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const ticks=[];for(let v=maxV;v>=minV-0.001;v-=STEP)ticks.push(Number(v.toFixed(1)));
  const grid=ticks.map(v=>{const yy=y(v);return `<line x1="${L}" y1="${yy.toFixed(1)}" x2="${W-R}" y2="${yy.toFixed(1)}" class="chart-grid-line"/><text x="${L-8}" y="${(yy+4).toFixed(1)}" text-anchor="end" class="chart-axis-text">${kind==='Spread'?signed(v):v}</text>`;}).join('');
  const selectedIndex=Number.isInteger(state.historyPointIndex)?state.historyPointIndex:null;
  const dots=coords.map(c=>`<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${selectedIndex===c.i?7:5}" class="chart-dot ${selectedIndex===c.i?'selected':''}" data-history-point="${c.i}" tabindex="0" role="button" aria-label="View snapshot details"></circle>`).join('');
  let tooltip='';
  if(selectedIndex!=null&&coords[selectedIndex]){
    const c=coords[selectedIndex],when=formatKickoff(c.p.capturedAt);
    const lineLabel=kind==='Spread'?`${g.home} ${signed(c.p.value)}`:`O/U ${c.p.value}`;
    const boxW=214,boxH=58;
    let boxX=Math.max(L,Math.min(W-R-boxW,c.x-boxW/2));
    let boxY=c.y-boxH-14;if(boxY<T)boxY=c.y+14;
    tooltip=`<g class="chart-tooltip" transform="translate(${boxX.toFixed(1)} ${boxY.toFixed(1)})"><rect width="${boxW}" height="${boxH}" rx="10"></rect><text x="12" y="22" class="chart-tooltip-time">${escapeAttr(`${when.date} · ${when.time}`)}</text><text x="12" y="43" class="chart-tooltip-line">${escapeAttr(lineLabel)}</text></g>`;
  }
  const first=formatKickoff(points[0].capturedAt),last=formatKickoff(points[points.length-1].capturedAt);
  return `<svg class="history-chart" data-history-chart viewBox="0 0 ${W} ${H}" role="img" aria-label="${kind} line history">${grid}<path d="${path}" class="chart-line"/>${dots}${tooltip}<text x="${L}" y="${H-12}" class="chart-axis-text">${first.date} ${first.time}</text><text x="${W-R}" y="${H-12}" text-anchor="end" class="chart-axis-text">${last.date} ${last.time}</text></svg>`;
}

function renderHistoryChart(){
  const g=gameById(state.activeGameId);if(!g)return'';
  const kind=state.historyChartKind,points=historyChartPoints(g,kind);
  const first=points[0]?.value,current=points[points.length-1]?.value,delta=first!=null&&current!=null?Number(current)-Number(first):null;
  const firstLabel=first==null?'—':(kind==='Spread'?`${g.home} ${signed(first)}`:`O/U ${first}`);
  const currentLabel=current==null?'—':(kind==='Spread'?`${g.home} ${signed(current)}`:`O/U ${current}`);
  const moveLabel=delta==null?'—':`${delta>0?'+':''}${Number(delta.toFixed(1))} pts`;
  return `<div class="overlay history-overlay"><section class="history-sheet"><div class="sheet-handle"></div><div class="close-row"><div><h2 style="margin:0">${kind} History</h2><div class="detail-meta">${g.away} @ ${g.home} · DraftKings</div></div><button class="icon-btn" data-close-history>✕</button></div><div class="chart-summary"><div><span>First captured</span><strong>${firstLabel}</strong></div><div><span>Current</span><strong>${currentLabel}</strong></div><div><span>Net move</span><strong>${moveLabel}</strong></div></div>${renderHistorySvg(points,kind,g)}<div class="chart-note">${points.length} captured snapshot${points.length===1?'':'s'} · TrackPicks first-captured line, not an official sportsbook opener.</div></section></div>`;
}
function fromDbWager(r){ return {id:r.id,gameId:r.game_id,betType:r.bet_type,selection:r.selection,line:Number(r.line),payoutOdds:r.payout_odds==null?-110:Number(r.payout_odds),units:Number(r.units),who:r.who,pick:r.pick,result:r.result||'Pending',marketSpread:r.market_spread==null?null:Number(r.market_spread),marketTotal:r.market_total==null?null:Number(r.market_total),marketMoneyline:r.market_moneyline==null?null:Number(r.market_moneyline),importBatchId:r.import_batch_id||null}; }
function toDbWager(w){ return {id:w.id,user_id:state.user.id,game_id:w.gameId,bet_type:w.betType,selection:w.selection,line:w.line,payout_odds:w.payoutOdds,units:w.units,who:w.who,pick:w.pick,result:w.result||'Pending',market_spread:w.marketSpread,market_total:w.marketTotal,market_moneyline:w.marketMoneyline,import_batch_id:w.importBatchId||null,updated_at:new Date().toISOString()}; }
function fromDbParlay(r){ return {id:r.id,week:Number(r.week),who:r.who,units:Number(r.units),odds:Number(r.odds),isTeaser:!!r.is_teaser,teaserPoints:r.teaser_points==null?null:Number(r.teaser_points),result:r.result||'Pending',createdAt:r.created_at,importBatchId:r.import_batch_id||null}; }
function toDbParlay(p){ return {id:p.id,user_id:state.user.id,season:2026,week:p.week,who:p.who,units:p.units,odds:p.odds,is_teaser:p.isTeaser,teaser_points:p.isTeaser?p.teaserPoints:null,result:p.result||'Pending',import_batch_id:p.importBatchId||null,updated_at:new Date().toISOString()}; }
function fromDbParlayLeg(r){ return {id:r.id,parlayId:r.parlay_id,gameId:r.game_id,legOrder:Number(r.leg_order),betType:r.bet_type,selection:r.selection,sourceLine:r.source_line==null?null:Number(r.source_line),line:r.line==null?null:Number(r.line),odds:r.odds==null?null:Number(r.odds),pick:r.pick,result:r.result||'Pending'}; }
function toDbParlayLeg(leg,parlayId,legOrder,finalLine,result='Pending'){
  const pick=leg.betType==='Spread'?`${leg.selection} ${signed(finalLine)}`:leg.betType==='Moneyline'?`${leg.selection} ${formatAmericanOdds(finalLine)}`:`${leg.selection} ${finalLine}`;
  return {id:leg.id||crypto.randomUUID(),parlay_id:parlayId,user_id:state.user.id,game_id:leg.gameId,leg_order:legOrder,bet_type:leg.betType,selection:leg.selection,source_line:leg.sourceLine==null?null:Number(leg.sourceLine),line:finalLine==null?null:Number(finalLine),odds:leg.odds==null?null:Number(leg.odds),pick,result:result||'Pending'};
}


async function refreshAdminStatus(){
  try{
    if(!state.sb || !state.user){
      state.isAdmin = false;
      return;
    }
    const { data, error } = await state.sb
      .from('profiles')
      .select('is_admin')
      .eq('user_id', state.user.id)
      .single();
    state.isAdmin = !error && !!data?.is_admin;
    if(state.isAdmin){
      const {data:latestRows,error:latestError}=await state.sb
        .from('game_odds_history')
        .select('captured_at')
        .order('captured_at',{ascending:false})
        .limit(1);
      state.lastOddsPullAt=!latestError && latestRows?.[0]?.captured_at ? latestRows[0].captured_at : null;
    }else{
      state.lastOddsPullAt=null;
    }
  }catch(e){
    state.isAdmin = false;
    state.lastOddsPullAt=null;
  }
}


async function loadUserProfile(){
  if(!state.sb || !state.user){
    state.displayName='';
    state.pickerNames=[];
    return;
  }
  const {data,error}=await state.sb
    .from('profiles')
    .select('display_name,picker_names,is_admin,standard_unit_size')
    .eq('user_id',state.user.id)
    .single();

  if(error){
    console.error('Profile load error', error);
    state.displayName='';
    state.pickerNames=[];
    return;
  }

  state.displayName=(data?.display_name||'').trim();
  state.pickerNames=Array.isArray(data?.picker_names) ? data.picker_names.filter(Boolean) : [];
  state.isAdmin=!!data?.is_admin;
  state.standardUnitSize=data?.standard_unit_size==null?null:Number(data.standard_unit_size);
}

async function saveStandardUnitSize(value){
  const amount=Number(value);
  if(!Number.isFinite(amount)||amount<=0) return {ok:false,message:'Enter a valid unit size greater than $0.'};
  const rounded=Math.round(amount*100)/100;
  const {error}=await state.sb.from('profiles').update({standard_unit_size:rounded,updated_at:new Date().toISOString()}).eq('user_id',state.user.id);
  if(error) return {ok:false,message:error.message};
  state.standardUnitSize=rounded;
  return {ok:true};
}

function formatUsd(value){
  const n=Number(value);
  if(!Number.isFinite(n))return '—';
  return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
}

function fileToDataUrl(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||''));
    reader.onerror=()=>reject(reader.error||new Error('Unable to read image.'));
    reader.readAsDataURL(file);
  });
}

async function queueScreenshotFiles(fileList){
  const incoming=[...(fileList||[])].filter(f=>f&&/^image\//i.test(f.type));
  if(!incoming.length){state.screenshotImportMessage='Choose one or more image screenshots.';render();return;}
  if(!state.screenshotImportFiles.length) state.screenshotImportWeek=Number(state.selectedWeek);
  const importWeek=Number(state.screenshotImportWeek ?? state.selectedWeek);
  if(Number(state.selectedWeek)!==importWeek){
    // 2.5.4.11.1: importing from a historical Slip starts a fresh batch for that Slip.
    // The Slip week remains the hard destination boundary; wagers from other weeks
    // may be diagnosed, but can never be imported into this batch.
    state.screenshotImportFiles=[];
    state.screenshotImportWeek=Number(state.selectedWeek);
    state.screenshotImportMessage='';
  }
  const created=[];
  for(const file of incoming){
    try{
      const preview=await fileToDataUrl(file);
      created.push({id:crypto.randomUUID(),fileName:file.name||'Screenshot',size:file.size||0,type:file.type||'image/*',preview,status:'Queued'});
    }catch(e){
      created.push({id:crypto.randomUUID(),fileName:file.name||'Screenshot',size:file.size||0,type:file.type||'image/*',preview:'',status:'Read error'});
    }
  }
  state.screenshotImportFiles=[...state.screenshotImportFiles,...created];
  state.screenshotImportMessage='';
  state.showScreenshotImporter=true;
  render();
}


let screenshotOcrLoader=null;
function ensureScreenshotOcr(){
  if(window.Tesseract) return Promise.resolve(window.Tesseract);
  if(screenshotOcrLoader) return screenshotOcrLoader;
  screenshotOcrLoader=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    script.async=true;
    script.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(new Error('OCR library did not initialize.'));
    script.onerror=()=>reject(new Error('Unable to load the screenshot parser. Check your connection and try again.'));
    document.head.appendChild(script);
  }).catch(err=>{screenshotOcrLoader=null;throw err;});
  return screenshotOcrLoader;
}

function prepareScreenshotForOcr(dataUrl){
  return new Promise((resolve)=>{
    const img=new Image();
    img.onload=()=>{
      try{
        const ratio=img.width/Math.max(1,img.height);
        const compact=img.height<240||ratio>4.25;
        if(!compact){resolve({source:dataUrl,layoutHint:'card',sourceWidth:img.width,sourceHeight:img.height,preparedWidth:img.width,preparedHeight:img.height,scale:1,ratio});return;}
        const targetHeight=Math.max(320,img.height*4);
        const scale=Math.min(6,Math.max(3,targetHeight/Math.max(1,img.height)));
        const canvas=document.createElement('canvas');
        canvas.width=Math.round(img.width*scale);
        canvas.height=Math.round(img.height*scale);
        const ctx=canvas.getContext('2d',{alpha:false});
        ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.imageSmoothingEnabled=false;
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        resolve({source:canvas.toDataURL('image/png'),layoutHint:'compact',sourceWidth:img.width,sourceHeight:img.height,preparedWidth:canvas.width,preparedHeight:canvas.height,scale,ratio});
      }catch(_e){resolve({source:dataUrl,layoutHint:'card',prepareError:String(_e?.message||_e||'prepare failed')});}
    };
    img.onerror=()=>resolve({source:dataUrl,layoutHint:'card',prepareError:'Image load failed during OCR preparation'});
    img.src=dataUrl;
  });
}

function normalizeOcrBetText(text){
  let t=String(text||'')
    .replace(/[−–—]/g,'-')
    .replace(/[＋]/g,'+')
    .replace(/\u00a0/g,' ')
    // OCR commonly collapses 6 1/2 into 61⁄2. Treat that sportsbook fraction form as 6.5.
    .replace(/([+-]?\d{1,2})1[⁄/]2\b/g,(_,n)=>`${n}.5`)
    .replace(/([+-]?\d{1,2})1½/g,(_,n)=>`${n}.5`)
    .replace(/(\d+)\s*[⁄/]\s*2\b/g,(_,n)=>`${n}.5`)
    .replace(/(\d+)½/g,(_,n)=>`${n}.5`)
    .replace(/\b(\d+)\s+1\/2\b/g,(_,n)=>`${n}.5`);
  return t.split(/\r?\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean).join('\n');
}

function detectScreenshotSportsbook(text){
  const t=String(text||'');
  if(/Fanatics Sportsbook/i.test(t)) return 'Fanatics';
  if(/FanDuel/i.test(t)) return 'FanDuel';
  if(/Bet ID:\s*DK/i.test(t)||/DraftKings/i.test(t)) return 'DraftKings';
  // 2.5.4.10: some cropped sportsbook screens omit the brand name entirely.
  // Infer the UI grammar from stable labels, never from a team-specific token.
  if(/\bMy Activity\b/i.test(t)&&/\bTo Pay:\b|\bBonus Bet\b/i.test(t)) return 'DraftKings';
  if(/\bTOTAL WAGER\b/i.test(t)&&/\b(?:TOTAL PAYOUT|RETURNED|WON ON FANDUEL)\b/i.test(t)) return 'FanDuel';
  if(/BetMGM/i.test(t)) return 'BetMGM';
  if(/Caesars Sportsbook|Caesars/i.test(t)) return 'Caesars';
  return 'Sportsbook';
}

function parseMoneyToken(value){
  const m=String(value||'').match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  if(!m)return null;
  const n=Number(m[1].replace(/,/g,''));
  return Number.isFinite(n)?n:null;
}

function cleanSelectionName(value){
  return String(value||'')
    .replace(/^[^A-Za-z0-9]+\s*/,'')
    .replace(/^(?:so|go|at|vs)\s+(?=[A-Z])/i,'')
    .replace(/\s+(SPREAD|TOTAL|MONEYLINE|ML)$/i,'')
    .replace(/\s+/g,' ')
    .trim();
}

function normalizeLineNumber(raw){
  const cleaned=String(raw||'').replace(/[|Il]/g,'').replace(/\s+/g,'');
  const m=cleaned.match(/[+-]?\d+(?:\.\d+)?/);
  if(!m)return null;
  const n=Number(m[0]);
  return Number.isFinite(n)?n:null;
}

function inferCandidateType(selection, nearby, typeHint=''){
  const hint=String(typeHint||'').trim();
  const n=String(nearby||'');
  if(/^TOTAL$/i.test(hint)||/^\s*(Over|Under)\b/i.test(selection)||/(?:^|\n)\s*(?:TOTAL|OVER|UNDER)\s*(?:$|\n)/im.test(n))return 'Total';
  if(/^(?:MONEYLINE|ML)$/i.test(hint)||/(?:^|\n)\s*(?:MONEYLINE|MONEY LINE|ML)\s*(?:$|\n)/im.test(n))return 'Moneyline';
  // Do not let labels such as "TOTAL WAGER" turn an ordinary spread into a total.
  return 'Spread';
}

function normalizeParsedSpreadLine(value,layoutHint='card'){
  let n=normalizeLineNumber(value);
  if(n==null)return null;
  // Compact sportsbook exports often OCR 6½ as 62/65. A side spread this large is not plausible.
  if(layoutHint==='compact'&&Math.abs(n)>=40&&Math.abs(n)<100){
    const sign=n<0?-1:1, abs=Math.abs(Math.trunc(n));
    const tens=Math.floor(abs/10), ones=abs%10;
    if(ones===2||ones===5)n=sign*(tens+0.5);
  }
  return n;
}

function canonicalizeParsedSelection(value){
  const cleaned=cleanSelectionName(value);
  if(/^\s*(Over|Under)\b/i.test(cleaned))return cleaned;
  try{
    const clues=extractImportTeamClues(cleaned);
    if(clues.length&&clues[0].score>=88&&(clues.length===1||clues[0].score-clues[1].score>=4))return clues[0].team;
  }catch(_e){}
  return cleaned;
}

function isUnsupportedSportsContext(text){
  const t=String(text||'');
  if(/\bNCAAF\b|college football/i.test(t))return false;
  return /\b(?:WNBA|NBA|NFL|NHL|MLB|MLS|NWSL|UFC|PGA|ATP|WTA|NCAAB|WNCAAB)\b/i.test(t);
}

function parseCompactScreenshotCandidates(rawText,standardUnitSize){
  const text=normalizeOcrBetText(rawText);
  const detected=detectScreenshotSportsbook(text);
  const sportsbook=detected==='Sportsbook'?'Compact row':detected;
  // 2.5.4.7: a compact export is a database-style row. Candidate creation is
  // structural and intentionally happens BEFORE team/game validation. OCR noise
  // from a logo or half-point glyph must never erase an otherwise obvious row.
  const flat=text.replace(/\n+/g,' ').replace(/\s+/g,' ').trim();
  const stampSource='(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s+\\d{1,2},\\s*\\d{4}\\s+\\d{1,2}:\\d{2}(?::\\d{2})?\\s*(?:AM|PM)?';
  const stampRe=new RegExp(stampSource,'ig');
  const stamps=[...flat.matchAll(stampRe)];
  const rows=[];
  if(stamps.length){
    for(let i=0;i<stamps.length;i++) rows.push(flat.slice(stamps[i].index, stamps[i+1]?.index??flat.length).trim());
  }else if(flat) rows.push(flat);

  const out=[];
  for(const row of rows){
    const oddsMatches=[...row.matchAll(/(?:^|\s)([+-]\d{3,4})(?=\s|\[|\$|$)/g)];
    const moneyMatches=[...row.matchAll(/\$\s*([\d,]+(?:\.\d{1,2})?)/g)];
    // Timestamp + American odds + money column(s) are the compact-row anchors.
    // Do not require a known team before allowing the row to exist as a candidate.
    if(!oddsMatches.length||!moneyMatches.length)continue;
    const oddsMatch=oddsMatches[0];
    const odds=Number(oddsMatch[1]);
    const beforeOdds=row.slice(0,oddsMatch.index+1).trim();
    const dateMatch=beforeOdds.match(new RegExp(stampSource,'i'));
    let selectionZone=dateMatch?beforeOdds.slice((dateMatch.index||0)+dateMatch[0].length).trim():beforeOdds;
    // 2.5.4.10: compact exports place a team logo immediately after the timestamp.
    // OCR may turn that logo into a tiny junk token (e.g. "Ge"). It is not part
    // of the team name, so discard exactly the first post-timestamp token when
    // there is still a plausible selection behind it.
    if(dateMatch){
      const logoSplit=selectionZone.match(/^\S+\s+(.+)$/);
      if(logoSplit && /[A-Za-z]/.test(logoSplit[1])) selectionZone=logoSplit[1].trim();
    }

    let betType=/\b(?:MONEYLINE|MONEY LINE|ML)\b/i.test(row)?'Moneyline':(/\b(?:OVER|UNDER|TOTAL)\b/i.test(selectionZone)?'Total':'Spread');
    let line=null;
    let rawSelection=selectionZone;
    if(betType!=='Moneyline'){
      const signed=[...selectionZone.matchAll(/([+-]\s*\d{1,2}(?:\.\d+)?|[+-]\s*\d{1,2}\s*(?:½|1\/2))/g)];
      if(signed.length){
        const lm=signed[signed.length-1];
        line=normalizeParsedSpreadLine(lm[1].replace(/\s+/g,''),'compact');
        rawSelection=selectionZone.slice(0,lm.index).trim();
      }
    }
    if(betType==='Moneyline') rawSelection=selectionZone.trim();
    // Logo OCR commonly leaves a tiny junk prefix (e.g. "Ge Temple"). Keep the
    // raw text as a fallback, but prefer a known-team clue when one is available.
    const clues=extractImportTeamClues(rawSelection);
    const selection=clues.length&&clues[0].score>=88?clues[0].team:rawSelection;
    if(!selection)continue;

    const afterOdds=row.slice((oddsMatch.index||0)+oddsMatch[0].length);
    const monies=[...afterOdds.matchAll(/\$\s*([\d,]+(?:\.\d{1,2})?)/g)].map(m=>Number(m[1].replace(/,/g,''))).filter(Number.isFinite);
    const stake=monies.length?monies[0]:null;
    const winnings=monies.length>1?monies[1]:null;
    const units=(stake!=null&&Number(standardUnitSize)>0)?Math.round((stake/Number(standardUnitSize))*100)/100:null;
    out.push({id:crypto.randomUUID(),sportsbook,selection:canonicalizeParsedSelection(selection),rawSelection,betType,line,odds:Number.isFinite(odds)?odds:null,stakeUsd:stake,possibleWinningsUsd:winnings,units,stakeConfidence:stake!=null?'high':'missing',status:'',eventText:'',contextText:row,layoutType:'compact',placedAt:dateMatch?dateMatch[0]:'',sourceBetId:'',reviewState:'Needs game match'});
  }
  return out;
}

function findCandidateStake(lines,start,end,layoutHint='card'){
  const stop=Math.min(lines.length,end??start+14);
  for(let i=start;i<stop;i++){
    if(/\bWager\b/i.test(lines[i])){
      const same=parseMoneyToken(lines[i]);
      if(same!=null)return {value:same,confidence:'high',possibleWinnings:null};
      for(let j=i+1;j<Math.min(stop,i+4);j++){
        const n=parseMoneyToken(lines[j]);
        if(n!=null)return {value:n,confidence:'high',possibleWinnings:null};
      }
    }
  }
  const monies=[];
  for(let i=start;i<stop;i++){
    const matches=[...String(lines[i]||'').matchAll(/\$\s*([\d,]+(?:\.\d{1,2})?)/g)];
    for(const m of matches){
      const n=Number(m[1].replace(/,/g,''));
      if(Number.isFinite(n))monies.push(n);
    }
  }
  if(monies.length){
    return {value:monies[0],confidence:layoutHint==='compact'?'high':'medium',possibleWinnings:layoutHint==='compact'&&monies.length>1?monies[1]:null};
  }
  return {value:null,confidence:'missing',possibleWinnings:null};
}

function findNearbyMeta(lines,start,end){
  const stop=Math.min(lines.length,end??start+24);
  let sourceBetId='',placedAt='',status='',eventText='';
  // Status can sit immediately above the selection, but ticket metadata belongs after it.
  for(let i=Math.max(0,start-2);i<Math.min(stop,start+5);i++){
    const line=lines[i];
    if(!status&&/^(Open|Won|Lost|Push|Pushed|Settled)$/i.test(line))status=line.replace(/^./,c=>c.toUpperCase());
  }
  for(let i=Math.max(0,start-3);i<stop;i++){
    const line=lines[i];
    if(!sourceBetId){const m=line.match(/Bet ID:\s*([^\s]+)/i);if(m)sourceBetId=m[1];}
    if(!placedAt){const m=line.match(/Placed:\s*(.+)$/i);if(m)placedAt=m[1].trim();}
    if(i>=start&&!eventText&&(/\s@\s|\sat\s/i.test(line))&&!/Placed:/i.test(line))eventText=line.replace(/^NCAAF\s*[•·-]?\s*/i,'').trim();
  }
  return {sourceBetId,placedAt,status,eventText};
}


function buildSportsbookCandidate({sportsbook,selection,betType,line,odds,stakeUsd,possibleWinningsUsd=null,eventText='',contextText='',standardUnitSize,status=''}){
  const stake=Number.isFinite(stakeUsd)?stakeUsd:null;
  return {id:crypto.randomUUID(),sportsbook,selection:canonicalizeParsedSelection(selection),rawSelection:selection,betType,line,odds,
    stakeUsd:stake,possibleWinningsUsd:Number.isFinite(possibleWinningsUsd)?possibleWinningsUsd:null,
    units:(stake!=null&&Number(standardUnitSize)>0)?Math.round((stake/Number(standardUnitSize))*100)/100:null,
    stakeConfidence:stake!=null?'high':'missing',status,eventText,contextText,layoutType:'card',placedAt:'',sourceBetId:'',reviewState:'Needs game match'};
}

function parseMarketHeaderNear(lines,marketIndex,market){
  // 2.5.4.11.1.1: GAME-FIRST candidate discovery. The explicit market label is the
  // anchor. A damaged/missing American-odds sign must never erase an otherwise
  // recognizable wager. Parse selection + line first, then treat payout odds as
  // an independent field that can be reviewed later.
  for(let i=marketIndex-1;i>=Math.max(0,marketIndex-4);i--){
    const raw=String(lines[i]||'').trim();
    if(!raw)continue;
    const statusless=raw.replace(/\s+(?:Open|Won|Lost|Pending)\s*$/i,'').trim();
    const clues=extractImportTeamClues(statusless);
    const knownTeam=clues.length&&clues[0].score>=88?clues[0].team:'';

    if(market==='Moneyline'){
      // Moneyline: team identity is enough to create a candidate. Signed price is
      // preferred; an unsigned 3/4 digit token is retained as uncertain, not guessed.
      const signed=[...statusless.matchAll(/(?:^|\s)([+-]\d{3,4})(?=\s|$)/g)].pop();
      const unsigned=!signed?[...statusless.matchAll(/(?:^|\s)(\d{3,4})(?=\s|$)/g)].pop():null;
      let selection=knownTeam;
      if(!selection){
        const cut=(signed||unsigned)?.index;
        selection=cleanSelectionName(cut==null?statusless:statusless.slice(0,cut));
      }
      if(selection){
        return {index:i,selection,line:null,odds:signed?Number(signed[1]):null,rawOddsToken:unsigned?unsigned[1]:'',oddsNeedsReview:!!unsigned};
      }
    }

    if(market==='Spread'){
      const spreadMatches=[...statusless.matchAll(/([+-]\s*\d{1,2}(?:\.\d+)?|[+-]\s*\d{1,2}\s*(?:½|1\/2))/g)];
      if(!spreadMatches.length)continue;
      const sm=spreadMatches[0];
      const line=normalizeParsedSpreadLine(sm[1].replace(/\s+/g,''),'card');
      let selection=knownTeam||cleanSelectionName(statusless.slice(0,sm.index));
      if(!selection)continue;
      const after=statusless.slice((sm.index||0)+sm[0].length);
      const signed=after.match(/(?:^|\s|[|Il•·])([+-]\d{3,4})(?=\s|$)/);
      const unsigned=!signed?after.match(/(?:^|\s|[|Il•·])(\d{3,4})(?=\s|$)/):null;
      return {index:i,selection,line,odds:signed?Number(signed[1]):null,rawOddsToken:unsigned?unsigned[1]:'',oddsNeedsReview:!!unsigned};
    }

    if(market==='Total'){
      const tm=statusless.match(/\b(Over|Under)\s*([0-9]{1,3}(?:\.\d+)?)\b/i);
      if(!tm)continue;
      const after=statusless.slice((tm.index||0)+tm[0].length);
      const signed=after.match(/(?:^|\s|[|Il•·])([+-]\d{3,4})(?=\s|$)/);
      const unsigned=!signed?after.match(/(?:^|\s|[|Il•·])(\d{3,4})(?=\s|$)/):null;
      return {index:i,selection:tm[1][0].toUpperCase()+tm[1].slice(1).toLowerCase(),line:Number(tm[2]),odds:signed?Number(signed[1]):null,rawOddsToken:unsigned?unsigned[1]:'',oddsNeedsReview:!!unsigned};
    }
  }
  return null;
}

function findSportsbookEventAndMoney(lines,start,end){
  let eventText='',stake=null,payout=null,status='';
  for(let i=start;i<end;i++){
    const line=String(lines[i]||'');
    if(!eventText && (/\s@\s|\sat\s/i.test(line)) && !/Placed:/i.test(line)) eventText=line.replace(/^NCAAF\s*[•·«-]?\s*/i,'').trim();
    if(!status && /\b(Open|Won|Lost|Push|Pushed)\b/i.test(line)){const m=line.match(/\b(Open|Won|Lost|Push|Pushed)\b/i);status=m?m[1]:'';}
    if(/\bWager\b/i.test(line)){
      const vals=[...line.matchAll(/\$\s*([\d,]+(?:\.\d{1,2})?)/g)].map(m=>Number(m[1].replace(/,/g,''))).filter(Number.isFinite);
      if(vals.length){stake=vals[0]; if(vals.length>1)payout=vals[1];}
      if(stake==null){
        for(let j=i+1;j<Math.min(end,i+3);j++){
          const vals2=[...String(lines[j]||'').matchAll(/\$\s*([\d,]+(?:\.\d{1,2})?)/g)].map(m=>Number(m[1].replace(/,/g,''))).filter(Number.isFinite);
          if(vals2.length){stake=vals2[0];if(vals2.length>1)payout=vals2[1];break;}
        }
      }
    }
  }
  if(stake==null){
    for(let i=start;i<end;i++){
      const vals=[...String(lines[i]||'').matchAll(/\$\s*([\d,]+(?:\.\d{1,2})?)/g)].map(m=>Number(m[1].replace(/,/g,''))).filter(Number.isFinite);
      if(vals.length){stake=vals[0];if(vals.length>1)payout=vals[1];break;}
    }
  }
  return {eventText,stake,payout,status};
}

function parseExplicitMarketSportsbook(rawText,standardUnitSize,sportsbook){
  const text=normalizeOcrBetText(rawText), lines=text.split('\n');
  const anchors=[];
  for(let i=0;i<lines.length;i++){
    const normalized=String(lines[i]||'').replace(/^[^A-Za-z]+/,'').trim();
    let market=null;
    // FanDuel icons/rank glyphs can OCR as a tiny prefix (e.g. "S MONEYLINE").
    // The market word at the END of the line is authoritative; the short prefix is disposable UI noise.
    if(/^(?:(?:[A-Z0-9]{1,2})\s+)?(?:SPREAD|gpread)$/i.test(normalized))market='Spread';
    else if(/^(?:(?:[A-Z0-9]{1,2})\s+)?(?:MONEYLINE|MONEY LINE)$/i.test(normalized))market='Moneyline';
    else if(/^(?:(?:[A-Z0-9]{1,2})\s+)?TOTAL$/i.test(normalized))market='Total';
    if(!market)continue;
    const header=parseMarketHeaderNear(lines,i,market);
    if(header)anchors.push({...header,market,marketIndex:i});
  }
  const out=[];
  for(let a=0;a<anchors.length;a++){
    const anchor=anchors[a], end=anchors[a+1]?.index??lines.length;
    const meta=findSportsbookEventAndMoney(lines,anchor.marketIndex+1,end);
    // 2.5.4.11.1: FanDuel OCR commonly drops the decimal in payout values ($46.74 -> $4674).
    // Repair only an implausibly large payout from an explicit FanDuel wager block.
    if(sportsbook==='FanDuel' && Number.isFinite(meta.payout) && Number.isFinite(meta.stake) && meta.payout>=1000 && meta.stake<500){
      const repaired=Math.round(meta.payout)/100;
      if(repaired>=meta.stake && repaired<=meta.stake*25){ meta.payout=repaired; meta.repairedPayout=true; }
    }
    // Futures/other sports may be visible below a CFB ticket. Preserve CFB wager
    // blocks; ignore clearly unsupported blocks rather than poisoning neighbors.
    const context=lines.slice(anchor.index,end).join('\n');
    if(isUnsupportedSportsContext(context)&&!/\bNCAAF\b|college football/i.test(context))continue;
    const candidate=buildSportsbookCandidate({sportsbook,selection:anchor.selection,betType:anchor.market,line:anchor.line,odds:anchor.odds,
      stakeUsd:meta.stake,possibleWinningsUsd:meta.payout,eventText:meta.eventText,contextText:context,standardUnitSize,status:meta.status});
    candidate.repairNotes=[];
    candidate.rawOddsToken=anchor.rawOddsToken||'';
    candidate.oddsNeedsReview=!!anchor.oddsNeedsReview;
    if(anchor.repairedOdds)candidate.repairNotes.push(`OCR odds sign repaired to ${anchor.odds}`);
    if(anchor.oddsNeedsReview)candidate.repairNotes.push(`Payout odds sign unreadable (${anchor.rawOddsToken}); review required`);
    if(meta.repairedPayout)candidate.repairNotes.push(`OCR payout decimal repaired to ${formatUsd(meta.payout)}`);
    out.push(candidate);
  }
  return out;
}

function parseScreenshotCandidates(rawText,standardUnitSize,layoutHint='card'){
  if(layoutHint==='compact'){
    const compact=parseCompactScreenshotCandidates(rawText,standardUnitSize);
    if(compact.length)return compact;
  }
  const text=normalizeOcrBetText(rawText);
  const lines=text.split('\n');
  const sportsbook=detectScreenshotSportsbook(text);
  // 2.5.4.10: explicit sportsbook parsers own their card grammar. Candidate
  // discovery happens before game matching and survives imperfect secondary fields.
  if(sportsbook==='FanDuel'||sportsbook==='DraftKings'){
    const specific=parseExplicitMarketSportsbook(text,standardUnitSize,sportsbook);
    if(specific.length)return specific;
  }else if(sportsbook==='Sportsbook'){
    // 2.5.4.10: cropped FanDuel/DraftKings screenshots can lose the brand header while
    // retaining explicit SPREAD/MONEYLINE blocks. Parse that grammar before falling
    // back to the legacy generic scanner; game matching remains a separate stage.
    const explicit=parseExplicitMarketSportsbook(text,standardUnitSize,'Sportsbook');
    if(explicit.length)return explicit;
  }
  const starts=[];
  const seen=new Set();
  const add=(index,selection,line,odds,typeHint='')=>{
    selection=cleanSelectionName(selection);
    if(!selection||selection.length<2||/^(Wager|Payout|Cash|Final|Finished|Open|Won|Lost)$/i.test(selection))return;
    const lineNum=line==null?null:normalizeParsedSpreadLine(line,layoutHint);
    const oddsNum=odds==null?null:Number(odds);
    const key=`${index}|${selection}|${lineNum}|${oddsNum}`;
    if(seen.has(key))return;
    seen.add(key);starts.push({index,selection,line:lineNum,odds:Number.isFinite(oddsNum)?oddsNum:null,typeHint});
  };

  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    // Team/selection + line + American odds on one OCR line.
    let m=line.match(/^(.+?)\s+([+-]\d+(?:\.\d+)?)\s*(?:[|Il1•·]\s*)?([+-]\d{3,4})\b/);
    if(m){add(i,m[1],m[2],m[3]);continue;}
    // Over/Under often appears as "Over 47.5 -110".
    m=line.match(/^((?:Over|Under)\b.*?)\s+([+-]?\d+(?:\.\d+)?)\s+([+-]\d{3,4})\b/i);
    if(m){add(i,m[1],m[2],m[3],'Total');continue;}
    // Selection + line, odds on a nearby line (common on Fanatics/FanDuel/BetMGM).
    // Keep the search tight so an opponent/score row cannot borrow another card's odds.
    m=line.match(/^(.+?)\s+([+-]\d+(?:\.\d+)?)$/);
    if(m){
      let nearbyOdds=null;
      for(let j=i+1;j<=Math.min(lines.length-1,i+3);j++){
        const om=lines[j].match(/^\s*([+-]\d{3,4})\s*$/);
        if(om){nearbyOdds=om[1];break;}
        if(/Bet ID:|Placed:|\bWager\b/i.test(lines[j]))break;
      }
      if(nearbyOdds){add(i,m[1],m[2],nearbyOdds);continue;}
    }
    // Moneyline cards may show team + American price with MONEYLINE on an adjacent line.
    m=line.match(/^(.+?)\s+([+-]\d{3,4})$/);
    if(m&&/(?:MONEYLINE|MONEY LINE|\bML\b)/i.test([lines[i-2],lines[i-1],lines[i+1],lines[i+2]].filter(Boolean).join(' '))){
      add(i,m[1],null,m[2],'Moneyline');continue;
    }
    if(/^[A-Za-z][A-Za-z0-9 .&'()-]{1,45}$/.test(line)&&lines[i+1]&&/^[+-]\d{3,4}$/.test(lines[i+1])&&/(?:MONEYLINE|MONEY LINE|\bML\b)/i.test([lines[i+2],lines[i-1]].filter(Boolean).join(' '))){
      add(i,line,null,lines[i+1],'Moneyline');continue;
    }
    // Selection is one line, spread is next line, market label follows (compact bet lists).
    if(/^[A-Za-z][A-Za-z0-9 .&'()-]{1,45}$/.test(line)&&lines[i+1]&&/^[+-]\d+(?:\.\d+)?$/.test(lines[i+1])){
      const nextMarket=(lines[i+2]||'');
      if(/^(SPREAD|TOTAL|MONEYLINE|ML)$/i.test(nextMarket))add(i,line,lines[i+1],null,nextMarket);
    }
  }

  // 2.5.4.4: container-first recovery. Direct selection headers are authoritative.
  // Once a supported sportsbook has yielded wager headers, do NOT roam through
  // scoreboards/matchup rows looking for more team + number combinations. That
  // was the source of phantom Arizona/Michigan/Mississippi State candidates.
  // Recovery is only used when the normal header pass found nothing at all.
  if(!starts.length) for(let i=0;i<lines.length;i++){
    const windowStart=Math.max(0,i-1), windowEnd=Math.min(lines.length,i+7);
    const windowLines=lines.slice(windowStart,windowEnd);
    const windowText=windowLines.join('\n');
    if(isUnsupportedSportsContext(windowText) && !/\bNCAAF\b|college football/i.test(windowText))continue;
    const clues=extractImportTeamClues(lines[i]);
    if(!clues.length||clues[0].score<88)continue;
    const team=clues[0].team;
    // Do not treat an event/matchup row itself as the wager selection.
    if(/\s@\s|\sat\s/i.test(lines[i]) && extractImportTeamClues(lines[i]).length>=2)continue;
    let spread=null,odds=null,typeHint='';
    for(let j=i;j<windowEnd;j++){
      const l=lines[j];
      if(!typeHint&&/^\s*(SPREAD|TOTAL|MONEYLINE|MONEY LINE|ML)\s*$/i.test(l))typeHint=l.trim();
      if(spread==null){
        const sm=l.match(/(?:^|\s)([+-]\d{1,2}(?:\.\d+)?)(?=\s|$)/);
        if(sm){const n=Number(sm[1]); if(Number.isFinite(n)&&Math.abs(n)<40)spread=sm[1];}
      }
      if(odds==null){
        const om=l.match(/(?:^|\s)([+-]\d{3,4})(?=\s|$)/);
        if(om)odds=om[1];
      }
    }
    const moneyline=/MONEYLINE|MONEY LINE|^ML$/i.test(typeHint);
    if((moneyline&&odds!=null)||(!moneyline&&spread!=null&&odds!=null)) add(i,team,moneyline?null:spread,odds,moneyline?'Moneyline':typeHint);
  }

  starts.sort((a,b)=>a.index-b.index);
  const parsed=starts.map((base,idx)=>{
    const next=starts[idx+1]?.index??Math.min(lines.length,base.index+18);
    const nearby=lines.slice(base.index,Math.min(lines.length,next)).join('\n');
    const type=inferCandidateType(base.selection,nearby,base.typeHint);
    const before=lines.slice(Math.max(0,base.index-3),base.index).join(' ');
    const nearbyLines=lines.slice(base.index,Math.min(lines.length,next));
    const compactRow=layoutHint==='compact'||(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s*\d{4}/i.test(before)&&!nearbyLines.some(x=>/\bWager\b/i.test(x)));
    const stake=findCandidateStake(lines,base.index,next,compactRow?'compact':'card');
    const meta=findNearbyMeta(lines,base.index,next);
    const contextText=lines.slice(Math.max(0,base.index-2),Math.min(lines.length,next)).join('\n');
    const units=(stake.value!=null&&Number(standardUnitSize)>0)?Math.round((stake.value/Number(standardUnitSize))*100)/100:null;
    let selection=canonicalizeParsedSelection(base.selection);
    if(type==='Total')selection=selection.replace(/\s+[+-]?\d+(?:\.\d+)?$/,'').trim();
    return {
      id:crypto.randomUUID(),sportsbook,selection,rawSelection:base.selection,betType:type,line:base.line,odds:base.odds,
      stakeUsd:stake.value,possibleWinningsUsd:stake.possibleWinnings,units,stakeConfidence:stake.confidence,status:meta.status,eventText:meta.eventText,
      contextText,layoutType:compactRow?'compact':'card',placedAt:meta.placedAt,sourceBetId:meta.sourceBetId,reviewState:'Needs game match'
    };
  });
  return parsed.filter(c=>{
    // 2.5.4.4: treat the wager container/header as authoritative. If an explicit
    // event row exists, the selected team must belong to that event. Scoreboard
    // opponents and unrelated cards therefore cannot become wager candidates.
    const selectionClues=extractImportTeamClues(c.selection||'');
    if(!selectionClues.length)return false;
    const selected=selectionClues[0].team;
    const eventClues=extractImportTeamClues(c.eventText||'');
    if(eventClues.length>=2){
      const eventTeams=eventClues.slice(0,4).map(x=>x.team);
      return eventTeams.includes(selected);
    }
    // A later unrelated card (for example WNBA below the first CFB wager) must not
    // invalidate the wager above it. Without an explicit event row, judge only the
    // selected wager header itself; week/game validation happens in the shared matcher.
    return !isUnsupportedSportsContext(`${c.selection} ${c.rawSelection||''}`);
  });
}


function normalizeImportTeamText(value){
  return String(value||'')
    .toLowerCase()
    .replace(/&/g,' and ')
    .replace(/[^a-z0-9]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function importTeamForms(teamName){
  const forms=new Set();
  const add=value=>{const n=normalizeImportTeamText(value);if(n.length>=2)forms.add(n);};
  add(teamName);
  const espnName=resolveEspnTeamName(teamName)||teamName;
  add(espnName);
  const meta=state.cfbTeams.find(t=>normalizeTeamName(t.espnName)===normalizeTeamName(espnName));
  if(meta){add(meta.espnName);add(meta.abbreviation);add(meta.shortDisplayName);add(meta.shortNickname);}
  for(const alias of state.cfbAliases){
    if(normalizeTeamName(alias.espnName)===normalizeTeamName(espnName))add(alias.alias);
  }
  return [...forms].sort((a,b)=>b.length-a.length);
}

function importTeamTextScore(text,teamName){
  const t=normalizeImportTeamText(text);
  if(!t)return 0;
  let best=0;
  for(const form of importTeamForms(teamName)){
    if(!form)continue;
    if(t===form)best=Math.max(best,100);
    else if(t.endsWith(' '+form) && t.length-form.length<=4)best=Math.max(best,96); // OCR prefix artifact
    else if(t.startsWith(form+' ') && t.length-form.length<=12)best=Math.max(best,91);
    else if((` ${t} `).includes(` ${form} `))best=Math.max(best,88);
    else if(form.length>=4 && (` ${form} `).includes(` ${t} `))best=Math.max(best,78);
  }
  return best;
}

function extractImportTeamClues(text){
  const clues=[];
  const seen=new Set();
  const teamNames=[...new Set(state.games.flatMap(g=>[g.away,g.home]).filter(Boolean))];
  for(const team of teamNames){
    const score=importTeamTextScore(text,team);
    if(score>=88){
      const canonical=resolveEspnTeamName(team)||team;
      const key=normalizeTeamName(canonical);
      if(!seen.has(key)){seen.add(key);clues.push({team:canonical,score});}
    }
  }
  return clues.sort((a,b)=>b.score-a.score);
}

function scoreImportCandidateForGame(candidate,game){
  if(!candidate||!game)return {score:0,selectionTeam:null};
  const selection=String(candidate.selection||'');
  const event=String(candidate.eventText||'');
  const context=String(candidate.contextText||event||'');
  const selAway=importTeamTextScore(selection,game.away);
  const selHome=importTeamTextScore(selection,game.home);
  const eventAway=importTeamTextScore(event,game.away);
  const eventHome=importTeamTextScore(event,game.home);
  const ctxAway=importTeamTextScore(context,game.away);
  const ctxHome=importTeamTextScore(context,game.home);
  const clues=extractImportTeamClues(context);
  const clueKeys=new Set(clues.map(x=>normalizeTeamName(x.team)));
  const awayKey=normalizeTeamName(resolveEspnTeamName(game.away)||game.away);
  const homeKey=normalizeTeamName(resolveEspnTeamName(game.home)||game.home);
  const hasTwoTeamContext=clueKeys.has(awayKey)&&clueKeys.has(homeKey);
  let score=0,selectionTeam=null;
  if(candidate.betType==='Total'){
    if(hasTwoTeamContext)score=280+Math.min(ctxAway,ctxHome);
    else if(eventAway>=78&&eventHome>=78)score=250+Math.min(eventAway,eventHome);
    else return {score:0,selectionTeam:null};
  }else{
    const selected=Math.max(selAway,selHome);
    if(selected<78)return {score:0,selectionTeam:null};
    selectionTeam=selAway>=selHome?game.away:game.home;
    // Card screenshots should normally prove both teams. Compact database rows are
    // intentionally single-selection records, so a strong selected-team match is
    // sufficient only when that team occurs in exactly one game in the target set.
    if(!hasTwoTeamContext && !(eventAway>=78&&eventHome>=78)){
      if(candidate.layoutType!=='compact')return {score:0,selectionTeam};
      const selectedKey=normalizeTeamName(resolveEspnTeamName(selectionTeam)||selectionTeam);
      const appearances=(state.games||[]).filter(g=>Number(g.week)===Number(game.week)&&[
        normalizeTeamName(resolveEspnTeamName(g.away)||g.away),normalizeTeamName(resolveEspnTeamName(g.home)||g.home)
      ].includes(selectedKey)).length;
      if(appearances!==1)return {score:0,selectionTeam};
      score=selected*2+125;
      return {score,selectionTeam};
    }
    score=selected*2+160;
    if(hasTwoTeamContext)score+=Math.min(ctxAway,ctxHome);
    if(eventAway>=78&&eventHome>=78)score+=80;
  }
  return {score,selectionTeam};
}

function extractImportMatchupPair(text){
  const raw=String(text||'').replace(/\s+/g,' ').trim();
  if(!raw)return null;
  // Sportsbook event rows are our strongest game identity signal.  Strip the
  // trailing date/time before comparing the two sides of "away @ home".
  const cleaned=raw
    .replace(/\b(?:SUN|MON|TUE|WED|THU|FRI|SAT)\b.*$/i,'')
    .replace(/\b(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{1,2}\b.*$/i,'')
    .trim();
  const m=cleaned.match(/^(.+?)\s+(?:@|at)\s+(.+?)$/i);
  if(!m)return null;
  const away=m[1].replace(/^NCAAF\s*[•·«-]?\s*/i,'').trim();
  const home=m[2].trim();
  return away&&home?{away,home}:null;
}

function directImportMatchupForGame(candidate,game){
  const sources=[candidate?.eventText,candidate?.contextText].filter(Boolean);
  for(const source of sources){
    const pair=extractImportMatchupPair(source);
    if(!pair)continue;
    const away=importTeamTextScore(pair.away,game.away);
    const home=importTeamTextScore(pair.home,game.home);
    if(away>=78&&home>=78){
      const selAway=importTeamTextScore(candidate.selection||'',game.away);
      const selHome=importTeamTextScore(candidate.selection||'',game.home);
      return {score:1000+away+home,selectionTeam:selAway>=78||selHome>=78?(selAway>=selHome?game.away:game.home):null};
    }
  }
  return null;
}

function bestImportGameMatch(candidate,games){
  // 2.5.4.10: resolve explicit sportsbook matchup rows first. If OCR gives us
  // "Oklahoma State @ West Virginia", that pair identifies the game; the
  // selected side/line should not be required to rediscover it.
  const direct=(games||[]).map(game=>{
    const hit=directImportMatchupForGame(candidate,game);
    return hit?{game,...hit}:null;
  }).filter(Boolean).sort((a,b)=>b.score-a.score);
  if(direct.length){
    const best=direct[0],second=direct[1];
    if(!second || best.score-second.score>=4)return best;
  }
  const ranked=(games||[]).map(game=>({game,...scoreImportCandidateForGame(candidate,game)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
  if(!ranked.length)return null;
  const best=ranked[0],second=ranked[1];
  const confident=best.score>=156 && (!second || best.score-second.score>=18 || best.score>=250);
  return confident?best:null;
}

function normalizeCandidateAgainstKnownGames(candidate){
  if(!candidate)return candidate;
  const evidence=[candidate.selection,candidate.eventText,candidate.contextText].filter(Boolean).join('\n');
  const clues=extractImportTeamClues(evidence);
  const selectionClues=extractImportTeamClues(candidate.selection||'');
  if(candidate.betType!=='Total'&&selectionClues.length){
    const best=selectionClues[0];
    if(best.score>=88 && (!selectionClues[1] || best.score-selectionClues[1].score>=4)) candidate.selection=best.team;
  }
  // Recover a clean event from any two-team context inside the same wager card.
  if((!candidate.eventText || extractImportTeamClues(candidate.eventText).length<2) && clues.length>=2){
    const keys=new Set(clues.slice(0,4).map(x=>normalizeTeamName(x.team)));
    const possible=state.games.filter(g=>keys.has(normalizeTeamName(resolveEspnTeamName(g.away)||g.away))&&keys.has(normalizeTeamName(resolveEspnTeamName(g.home)||g.home)));
    if(possible.length===1) candidate.eventText=`${possible[0].away} @ ${possible[0].home}`;
  }
  return candidate;
}

function finalizeScreenshotCandidateReadiness(candidate){
  if(!candidate)return candidate;
  const missing=[];
  if(candidate.matchStatus!=='matched')missing.push('matchup');
  if(candidate.betType==='Spread'){
    if(!candidate.selection)missing.push('pick selection');
    if(candidate.line==null||!Number.isFinite(Number(candidate.line)))missing.push('actual line taken');
  }else if(candidate.betType==='Total'){
    if(!/^(Over|Under)$/i.test(String(candidate.selection||'')))missing.push('pick selection');
    if(candidate.line==null||!Number.isFinite(Number(candidate.line)))missing.push('actual total taken');
  }else if(candidate.betType==='Moneyline'){
    if(!candidate.selection)missing.push('pick selection');
  }
  if(candidate.odds==null||!Number.isFinite(Number(candidate.odds))||candidate.oddsNeedsReview)missing.push('actual payout odds');
  if(candidate.units==null||!Number.isFinite(Number(candidate.units))||Number(candidate.units)<=0)missing.push('units wagered');
  candidate.missingFields=[...new Set(missing)];
  if(candidate.matchStatus==='wrong-week')candidate.reviewState=`Not in Week ${Number(state.screenshotImportWeek ?? state.selectedWeek)}`;
  else if(candidate.missingFields.length)candidate.reviewState='Needs review';
  else candidate.reviewState='Ready for Slip';
  return candidate;
}

function matchScreenshotCandidateToWeek(candidate,week){
  candidate=normalizeCandidateAgainstKnownGames(candidate);
  const activeWeek=Number(week);
  const inWeek=bestImportGameMatch(candidate,weekGames(activeWeek));
  if(inWeek){
    candidate.matchedGameId=inWeek.game.id;
    candidate.matchedWeek=activeWeek;
    candidate.matchedAway=inWeek.game.away;
    candidate.matchedHome=inWeek.game.home;
    candidate.matchedSelection=inWeek.selectionTeam||candidate.selection;
    // 2.5.4.11.1: the matched game is authoritative for team naming. Strip OCR/logo
    // garbage such as "C 2 Missouri" instead of displaying it as the selection.
    if(candidate.betType!=='Total' && inWeek.selectionTeam) candidate.selection=inWeek.selectionTeam;
    candidate.reviewState=`Matched Week ${activeWeek}`;
    candidate.matchStatus='matched';
    // Once a game is matched, canonical game identity outranks dirty OCR prefixes.
    if(candidate.betType!=='Total'){
      const a=importTeamTextScore(candidate.rawSelection||candidate.selection||'',inWeek.game.away);
      const h=importTeamTextScore(candidate.rawSelection||candidate.selection||'',inWeek.game.home);
      if(a>=78||h>=78)candidate.selection=a>=h?inWeek.game.away:inWeek.game.home;
    }
    return finalizeScreenshotCandidateReadiness(candidate);
  }
  const outside=bestImportGameMatch(candidate,state.games.filter(g=>Number(g.week)!==activeWeek));
  candidate.matchedGameId=null;
  candidate.matchedWeek=null;
  candidate.matchedAway='';candidate.matchedHome='';candidate.matchedSelection='';
  if(outside){
    candidate.detectedWeek=Number(outside.game.week);
    candidate.reviewState=`Not in Week ${activeWeek}`;
    candidate.matchStatus='wrong-week';
  }else{
    candidate.detectedWeek=null;
    candidate.reviewState='Needs game match';
    candidate.matchStatus='unmatched';
  }
  return finalizeScreenshotCandidateReadiness(candidate);
}

function matchScreenshotCandidatesToImportWeek(candidates){
  const week=Number(state.screenshotImportWeek ?? state.selectedWeek);
  return (candidates||[]).map(c=>matchScreenshotCandidateToWeek(c,week));
}

function buildScreenshotParserDiagnostic(item,prepared,rawText,candidates){
  const normalized=normalizeOcrBetText(rawText||'');
  const detectedSportsbook=detectScreenshotSportsbook(normalized);
  const flat=normalized.replace(/\n+/g,' ').replace(/\s+/g,' ').trim();
  const timestampMatches=[...flat.matchAll(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s*\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?/ig)];
  const americanOdds=[...flat.matchAll(/(?:^|\s)([+-]\d{3,4})(?=\s|\[|\$|$)/g)].map(m=>m[1]);
  const moneyTokens=[...flat.matchAll(/\$\s*[\d,]+(?:\.\d{1,2})?/g)].map(m=>m[0]);
  let compactCandidates=[];
  let compactError='';
  if(prepared?.layoutHint==='compact'){
    try{compactCandidates=parseCompactScreenshotCandidates(normalized,state.standardUnitSize)||[];}catch(e){compactError=String(e?.message||e);}
  }
  let reason='';
  if(!normalized) reason='OCR returned no text.';
  else if(prepared?.layoutHint!=='compact' && ((prepared?.ratio||0)>4.25 || (prepared?.sourceHeight||999)<240)) reason='Image looks compact, but preprocessing did not route it to the compact parser.';
  else if(prepared?.layoutHint==='compact' && !americanOdds.length) reason='Compact parser received text, but no American-odds token was recognized.';
  else if(prepared?.layoutHint==='compact' && !compactCandidates.length) reason='Compact parser received OCR text and odds, but produced zero wager candidates.';
  else if(compactCandidates.length && !(candidates||[]).length) reason='A compact wager candidate existed before shared validation/matching but disappeared afterward.';
  else if((candidates||[]).length) reason='Candidate extraction succeeded.';
  else reason='General parser produced zero wager candidates.';
  return {
    build:BUILD_VERSION,
    source:`${prepared?.sourceWidth||'?'} × ${prepared?.sourceHeight||'?'}`,
    prepared:`${prepared?.preparedWidth||'?'} × ${prepared?.preparedHeight||'?'}`,
    scale:prepared?.scale??'?',ratio:prepared?.ratio?Number(prepared.ratio).toFixed(2):'?',
    layoutHint:prepared?.layoutHint||'unknown',detectedSportsbook,
    rawCharCount:String(rawText||'').length,normalizedCharCount:normalized.length,
    timestampCount:timestampMatches.length,americanOdds,moneyTokens,
    compactCandidateCount:compactCandidates.length,finalCandidateCount:(candidates||[]).length,
    wagerAnchorCount:(candidates||[]).length,
    spreadCandidateCount:(candidates||[]).filter(c=>c.betType==='Spread').length,
    moneylineCandidateCount:(candidates||[]).filter(c=>c.betType==='Moneyline').length,
    totalCandidateCount:(candidates||[]).filter(c=>c.betType==='Total').length,
    compactCandidates:compactCandidates.map(c=>({rawSelection:c.rawSelection||'',selection:c.selection||'',betType:c.betType||'',line:c.line,odds:c.odds,stakeUsd:c.stakeUsd,possibleWinningsUsd:c.possibleWinningsUsd})),
    compactError,reason,ocrText:normalized
  };
}

async function processScreenshotBatch(){
  if(state.screenshotImportProcessing)return;
  const targets=state.screenshotImportFiles.filter(x=>x.preview&&(!x.candidates||!x.candidates.length)&&x.status!=='Parsing');
  if(!targets.length){state.screenshotImportMessage='Every screenshot in this batch has already been processed.';render();return;}
  state.screenshotImportProcessing=true;
  state.screenshotImportMessage='';
  render();
  let worker=null;
  try{
    const T=await ensureScreenshotOcr();
    worker=await T.createWorker('eng',T.OEM?.LSTM_ONLY??1,{logger:m=>{
      if(m?.status!=='recognizing text')return;
      const active=state.screenshotImportFiles.find(x=>x.status==='Parsing');
      if(!active)return;
      const pct=Math.max(0,Math.min(99,Math.round((m.progress||0)*100)));
      if(active.progress!==pct){active.progress=pct;if(pct%10===0)render();}
    }});
    for(const item of targets){
      item.status='Parsing';item.progress=0;item.error='';render();
      try{
        const prepared=await prepareScreenshotForOcr(item.preview);
        item.layoutHint=prepared.layoutHint;
        const result=await worker.recognize(prepared.source);
        item.rawOcrText=String(result?.data?.text||'');
        item.ocrText=normalizeOcrBetText(item.rawOcrText);
        item.candidates=matchScreenshotCandidatesToImportWeek(parseScreenshotCandidates(item.ocrText,state.standardUnitSize,prepared.layoutHint));
        item.parserDiagnostic=buildScreenshotParserDiagnostic(item,prepared,item.rawOcrText,item.candidates);
        item.status=item.candidates.length?`${item.candidates.length} bet${item.candidates.length===1?'':'s'} found`:'Needs review';
        item.progress=100;
        if(!item.candidates.length)item.error='No wager was confidently detected. Keep this screenshot in the batch for manual review.';
      }catch(err){
        console.error('Screenshot OCR error',err);
        item.status='Parse error';item.error=err?.message||'Unable to parse screenshot.';
      }
      render();
    }
  }catch(err){
    console.error('Screenshot parser load error',err);
    state.screenshotImportMessage=err?.message||'Unable to start screenshot parsing.';
  }finally{
    try{await worker?.terminate();}catch(_e){}
    state.screenshotImportProcessing=false;
    render();
  }
}


async function saveDisplayName(name){
  const clean=(name||'').trim();
  if(!clean) return {ok:false,message:'Enter a display name.'};

  const otherNames=state.pickerNames.filter(n=>n && n!==state.displayName && n!==clean);
  const nextNames=[clean,...otherNames];

  const {error}=await state.sb
    .from('profiles')
    .update({
      display_name: clean,
      picker_names: nextNames,
      updated_at: new Date().toISOString()
    })
    .eq('user_id',state.user.id);

  if(error) return {ok:false,message:error.message};

  state.displayName=clean;
  state.pickerNames=nextNames;
  return {ok:true};
}

async function addPickerName(name){
  const clean=(name||'').trim();
  if(!clean) return {ok:false,message:'Enter a name.'};

  const current=[state.displayName,...state.pickerNames.filter(n=>n!==state.displayName)].filter(Boolean);
  if(current.some(n=>n.toLowerCase()===clean.toLowerCase())){
    return {ok:false,message:'That name is already in your list.'};
  }

  const next=[state.displayName,...state.pickerNames.filter(n=>n!==state.displayName),clean].filter(Boolean);

  const {error}=await state.sb
    .from('profiles')
    .update({
      picker_names: next,
      updated_at: new Date().toISOString()
    })
    .eq('user_id',state.user.id);

  if(error) return {ok:false,message:error.message};

  state.pickerNames=next;
  return {ok:true};
}

function effectivePickerNames(){
  const names=[state.displayName,...state.pickerNames].filter(Boolean);
  return [...new Set(names)];
}


function renderDisplayNameSetup(){
  return `<div class="auth-wrap">
    <div class="auth-card">
      <div class="brand-mark">TrackPicks</div>
      <h1>What should we call you?</h1>
      <p class="auth-copy">This becomes the default name on your picks. You can change it later in Settings.</p>
      <div class="field full">
        <label>Display Name</label>
        <input id="displayNameSetupInput" type="text" maxlength="40" placeholder="Nickname or display name">
      </div>
      <button class="primary" data-save-display-name-setup>Continue</button>
    </div>
  </div>`;
}

function render(){
  const app=document.getElementById('app');
  if(state.user && !state.displayName){ app.innerHTML=renderDisplayNameSetup(); bindAuth(); return; }
  if(!state.authReady){ app.innerHTML=`<div class="auth-shell"><div class="auth-card"><h1 class="auth-brand">TrackPicks</h1><div class="auth-subtitle">Connecting…</div></div></div>`; return; }
  if(!cloudConfigured()){ app.innerHTML=renderCloudSetup(); bindAuth(); return; }
  if(!state.user){ app.innerHTML=renderAuth(); bindAuth(); return; }
  app.innerHTML=`<div class="app-shell">${topbar()}<main class="page">${state.view==='weeks'?renderWeeks():state.view==='market'?renderMarket():state.view==='slip'?renderSlip():renderDashboard()}</main></div>${bottomNav()}${state.activeGameId?renderGameSheet():''}${renderPickerSelector()}${state.showSettings?renderSettingsSheet():''}${state.showImportManager?renderImportManager():''}${state.showScreenshotImporter?renderScreenshotImporter():''}${state.historyChartKind?renderHistoryChart():''}${state.activeTeamId?renderTeamScreen():''}`;
  bind();
}

function renderCloudSetup(){ return `<div class="auth-shell"><div class="auth-card"><h1 class="auth-brand">TrackPicks</h1><div class="auth-subtitle">${versionStamp()} · Cloud setup</div><div class="cloud-warning">Enter your Supabase Project URL and public anon/publishable key. These are project connection values, not your account password.</div><div class="setup-grid"><div class="field"><label>Supabase Project URL</label><input id="setupUrl" type="url" placeholder="https://xxxxx.supabase.co" value="${escapeAttr(state.supabaseUrl)}"></div><div class="field"><label>Supabase public key</label><input id="setupKey" type="password" placeholder="Anon / publishable key" value="${escapeAttr(state.supabaseKey)}"></div></div><button class="primary" data-save-cloud>Save Cloud Setup</button>${state.authMessage?`<div class="auth-message error">${state.authMessage}</div>`:''}</div></div>`; }

function renderAuth(){ const signup=state.authMode==='signup'; return `<div class="auth-shell"><div class="auth-card"><h1 class="auth-brand">TrackPicks</h1><div class="auth-subtitle">${versionStamp()} · Your picks, synced across devices.</div><div class="auth-tabs"><button class="auth-tab ${!signup?'active':''}" data-auth-mode="signin">Log In</button><button class="auth-tab ${signup?'active':''}" data-auth-mode="signup">Create Account</button></div><div class="auth-fields"><div class="field"><label>Email</label><input id="authEmail" type="email" autocomplete="email"></div><div class="field"><label>Password</label><input id="authPassword" type="password" autocomplete="${signup?'new-password':'current-password'}"></div></div><button class="primary" data-auth-submit>${signup?'Create Account':'Log In'}</button>${state.authMessage?`<div class="auth-message ${/error|invalid|failed|wrong/i.test(state.authMessage)?'error':''}">${state.authMessage}</div>`:''}</div></div>`; }

function headerWeekSelect(){
  const weekOptions=state.weeks
    .filter(w=>w.enabled)
    .map(w=>`<option value="${w.week}" ${w.week===state.selectedWeek?'selected':''}>Week ${w.week}</option>`)
    .join('');
  return `<div class="app-header-week-wrap">
    <select class="app-header-week" data-market-week aria-label="Select week">${weekOptions}</select>
    <span class="app-header-week-chevron" aria-hidden="true">⌄</span>
  </div>`;
}

function appHeader(leftHtml=''){
  const syncLabel=state.syncing?'Syncing…':'Cloud synced';
  return `<header class="topbar app-main-header">
    <div class="app-main-header-row">
      <div class="app-header-left">${leftHtml||'<span class="app-header-left-spacer" aria-hidden="true"></span>'}</div>
      <div class="app-header-brand"><img src="trackpicks-wordmark.png" class="app-header-wordmark" alt="TrackPicks"></div>
      <div class="app-header-right">
        <button type="button" class="app-settings-btn" data-settings aria-label="Settings">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9.8 2h4.4l.6 2.4c.5.2 1 .4 1.5.7l2.2-1.2 3.1 3.1-1.2 2.2c.3.5.5 1 .7 1.5l2.4.6v4.4l-2.4.6c-.2.5-.4 1-.7 1.5l1.2 2.2-3.1 3.1-2.2-1.2c-.5.3-1 .5-1.5.7l-.6 2.4H9.8l-.6-2.4c-.5-.2-1-.4-1.5-.7l-2.2 1.2-3.1-3.1 1.2-2.2c-.3-.5-.5-1-.7-1.5l-2.4-.6v-4.4l2.4-.6c.2-.5.4-1 .7-1.5L2.4 7l3.1-3.1 2.2 1.2c.5-.3 1-.5 1.5-.7L9.8 2Z"/>
            <circle cx="12" cy="13.5" r="3.2"/>
          </svg>
        </button>
        <div class="app-header-sync ${state.syncing?'syncing':''}"><span aria-hidden="true">☁</span><span>${syncLabel}</span></div>
      </div>
    </div>
  </header>`;
}

function marketTopbar(){ return appHeader(headerWeekSelect()); }

function topbar(){
  if(state.view==='market')return marketTopbar();
  if(state.view==='slip')return appHeader(`<div class="app-header-screen-label">Slip</div>`);
  if(state.view==='dashboard')return appHeader(`<div class="app-header-screen-label">Dashboard</div>`);
  if(state.view==='weeks')return appHeader(`<div class="app-header-screen-label">Weeks</div>`);
  return appHeader();
}
function bottomNav(){ if(state.view==='weeks'||state.activeGameId||state.activeTeamId||state.showSettings||state.showScreenshotImporter)return''; return `<nav class="bottom-nav"><button class="nav-btn ${state.view==='market'?'active':''}" data-nav="market">Full Slate</button><button class="nav-btn ${state.view==='slip'?'active':''}" data-nav="slip">Slip</button><button class="nav-btn ${state.view==='dashboard'?'active':''}" data-nav="dashboard">Dashboard</button></nav>`; }
function renderWeeks(){ return `<div class="section-title">Weeks 1–12</div><div class="week-grid">${state.weeks.map(w=>{const games=weekGames(w.week).length,picks=weekWagers(w.week).length;const meta=!w.enabled?'Not used this season':games?`${games} games loaded · ${picks} saved wager(s)`:(w.week===4?'Starting week · not loaded':'Not loaded');return `<button class="week-card ${w.enabled?'':'disabled'}" data-week="${w.week}" ${w.enabled?'':'disabled'}><div class="week-name">Week ${w.week}</div><div class="week-meta">${meta}</div></button>`}).join('')}</div>`; }

function renderMarket(){
  const allGames=weekGames(state.selectedWeek),
        baseGames=baseFilteredSlateGames(),
        message=state.importMessage?`<div class="notice">${state.importMessage}</div>`:'',
        filters=renderSlateFilters();

  if(!allGames.length)return `${message}${filters}<div class="empty"><strong>No games loaded for Week ${state.selectedWeek}.</strong><br><br>${state.isAdmin?'Open <b>Settings → Admin Tools</b> to load or refresh the weekly slate.':'The weekly board has not been published yet.'}</div>`;
  if(!baseGames.length)return `${message}${filters}<div class="empty compact-empty">No games match this slate filter.</div>`;

  const visibleCount=baseGames.filter(g=>gameMatchesSlateSearch(g)).length;
  return `${message}${filters}<div class="game-list slate-game-list">${baseGames.map(g=>{
    const saved=wagersForGame(g.id).length;
    const k=formatKickoff(g.commenceTime);
    const caution=isCautioned(g.id);
    const signals=cardMovementSignals(g);
    const missing=!hasSpread(g)||!hasTotal(g);

    return `<button class="game-row slate-game-card ${saved?'saved':''} ${caution?'cautioned':''}" data-game="${g.id}" ${gameMatchesSlateSearch(g)?'':'hidden'}>
      <div class="slate-matchup">
        ${renderSlateTeamHero(g.away,'away')}
        <div class="slate-at" aria-hidden="true">@</div>
        ${renderSlateTeamHero(g.home,'home')}
      </div>

      <div class="slate-markets">
        ${renderSlateSpreadBlock(g,signals)}
        ${renderSlateTotalBlock(g,signals)}
      </div>

      <div class="slate-card-footer">
        <div class="slate-kickoff">
          <strong>${escapeAttr(k.date)}</strong>
          <span>${escapeAttr(k.time||'Time TBD')}</span>
        </div>
        <div class="slate-tv">${renderTvNetworkLogo(g.tv||'')}</div>
      </div>

      ${renderSlateStatus(saved,caution,missing)}
    </button>`;
  }).join('')}</div><div class="empty compact-empty slate-search-empty" data-slate-search-empty ${visibleCount?'hidden':''}>No games match your search.</div>`;
}

function resultClassFor(result){ return result==='Win'?'result-win':result==='Loss'?'result-loss':result==='DDL'?'result-ddl':result==='Push'?'result-push':'result-pending'; }
async function pushResults(){
  if(state.pushingResults||!state.sb||!state.user)return;
  const week=state.selectedWeek;
  state.pushingResults=true;
  state.pushResultsMessage='Checking final scores…';
  render();

  try{
    const {data,error}=await state.sb.functions.invoke('trackpicks_results_sync',{
      body:{week,gradeStraight:true,gradeParlays:true}
    });
    if(error)throw new Error(error.message||String(error));
    if(!data?.ok && data?.updateErrors?.length){
      throw new Error(data.updateErrors[0]?.error||'Results sync failed.');
    }

    const resultGames=Array.isArray(data?.results)?data.results:[];
    if(resultGames.length){
      const byId=new Map(resultGames.map(r=>[r.id,r]));
      state.games=state.games.map(g=>{
        const r=byId.get(g.id);
        if(!r)return g;
        return {...g,
          awayScore:r.awayScore==null?g.awayScore:Number(r.awayScore),
          homeScore:r.homeScore==null?g.homeScore:Number(r.homeScore),
          gameCompleted:!!r.gameCompleted,
          gameStatus:r.gameStatus||g.gameStatus||'',
          resultsUpdatedAt:r.resultsUpdatedAt||g.resultsUpdatedAt||null
        };
      });
    }

    const straightGrades=Array.isArray(data?.straightGrades)?data.straightGrades:[];
    if(straightGrades.length){
      const byWager=new Map(straightGrades.map(x=>[x.id,x.result]));
      state.wagers.forEach(w=>{const result=byWager.get(w.id);if(result)w.result=result;});
    }

    const legGrades=Array.isArray(data?.parlayLegGrades)?data.parlayLegGrades:[];
    if(legGrades.length){
      const byLeg=new Map(legGrades.map(x=>[x.id,x.result]));
      state.parlayLegs.forEach(l=>{const result=byLeg.get(l.id);if(result)l.result=result;});
    }

    const parlayGrades=Array.isArray(data?.parlayGrades)?data.parlayGrades:[];
    if(parlayGrades.length){
      const byParlay=new Map(parlayGrades.map(x=>[x.id,x.result]));
      state.parlays.forEach(p=>{const result=byParlay.get(p.id);if(result)p.result=result;});
    }

    const straightReviews=Array.isArray(data?.straightReviews)?data.straightReviews:[];
    const parlayReviews=Array.isArray(data?.parlayReviews)?data.parlayReviews:[];
    state.gradingReviews.straight=Object.fromEntries(straightReviews.map(x=>[x.id,x.reason||'Manual review required']));
    state.gradingReviews.parlays=Object.fromEntries(parlayReviews.map(x=>[x.id,x.reason||'Manual review required']));

    const straightGraded=Number(data?.straightGraded||0);
    const legsGraded=Number(data?.parlayLegsGraded||0);
    const parlaysGraded=Number(data?.parlaysGraded||0);
    const manualReview=straightReviews.length+parlayReviews.length;
    const failed=Number(data?.straightFailed||0)+Number(data?.parlayFailed||0);

    const parts=[];
    if(straightGraded)parts.push(`${straightGraded} straight ${straightGraded===1?'bet':'bets'} graded`);
    if(legsGraded)parts.push(`${legsGraded} ${legsGraded===1?'leg':'legs'} graded`);
    if(parlaysGraded)parts.push(`${parlaysGraded} ${parlaysGraded===1?'parlay/teaser':'parlays/teasers'} graded`);
    if(manualReview)parts.push(`${manualReview} pending review`);
    if(failed)parts.push(`${failed} failed`);

    state.pushResultsMessage=parts.length
      ? `Updated: ${parts.join(' · ')}.`
      : Number(data?.completed||0)>0
        ? 'Nothing new is ready to grade yet.'
        : 'No completed games are available yet.';
  }catch(err){
    state.pushResultsMessage=`Push Results failed: ${err.message||err}`;
  }finally{
    state.pushingResults=false;
    render();
  }
}

function renderStraightSlip(){
  const gameOrder=new Map(weekGames(state.selectedWeek).map((g,i)=>[g.id,i]));
  const wagers=[...weekWagers(state.selectedWeek)].sort((a,b)=>{
    const ai=gameOrder.has(a.gameId)?gameOrder.get(a.gameId):Number.MAX_SAFE_INTEGER;
    const bi=gameOrder.has(b.gameId)?gameOrder.get(b.gameId):Number.MAX_SAFE_INTEGER;
    return ai-bi;
  });
  if(!wagers.length)return `<div class="empty compact-empty">No saved straight picks yet. Open the Full Slate tab and select a game.</div>`;
  return wagers.map(w=>{
    const g=gameById(w.gameId); if(!g)return'';
    const result=w.result||'Pending',caution=isCautioned(g.id),reviewReason=state.gradingReviews.straight[w.id]||'';
    return `<div class="slip-card compact-slip ${caution?'cautioned':''}">
      <div class="slip-main"><div class="slip-copy"><div class="slip-pick">${caution?'<span class="caution-icon">⚠️</span> ':''}${w.pick}${reviewReason?` <button type="button" class="manual-review-icon" data-straight-review-info="${w.id}" aria-label="Manual grading review required" title="Manual grading review required">ⓘ</button>`:''}</div><div class="slip-meta">${g.away} @ ${g.home}</div><div class="slip-meta">${w.who} · <strong>${Number(w.units).toFixed(1)}u</strong> · <strong>${formatAmericanOdds(w.payoutOdds)}</strong>${reviewReason?' · <strong class="manual-review-text">Manual review</strong>':''}</div></div><div class="slip-right"><span class="result-badge ${resultClassFor(result)}">${result}</span><button class="remove-btn compact-remove" data-remove="${w.id}">Remove</button></div></div>
      <div class="slip-actions compact-actions"><button class="secondary compact-btn" data-edit="${w.id}">Edit Pick</button><button class="secondary compact-btn" data-open-game="${g.id}">Game</button><button class="secondary compact-btn" data-result-menu="${w.id}">${result==='Pending'?'Set Result':'Edit Result'}</button></div>
      <div class="result-picker" data-result-picker-for="${w.id}" hidden>${['Win','Loss','Push','DDL'].map(r=>`<button class="result-choice ${r.toLowerCase()}" data-set-result="${w.id}" data-result="${r}">${r}</button>`).join('')}</div>
    </div>`;
  }).join('');
}
function renderParlayLeg(leg,draft){
  const g=gameById(leg.gameId),finalLine=effectiveParlayLegLine(leg,draft),base=leg.sourceLine==null?null:Number(leg.sourceLine);
  const baseLabel=leg.betType==='Spread'?`${leg.selection} ${signed(base)}`:leg.betType==='Moneyline'?`${leg.selection} ML`:`${leg.selection} ${base}`;
  const finalLabel=leg.betType==='Spread'?`${leg.selection} ${signed(finalLine)}`:`${leg.selection} ${finalLine}`;
  return `<div class="parlay-leg"><div class="parlay-leg-copy"><strong>${draft.isTeaser&&leg.betType!=='Moneyline'?`${baseLabel} → ${finalLabel}`:baseLabel}</strong><span>${g?`${g.away} @ ${g.home}`:'Game unavailable'} · ${leg.betType} · Payout ${formatAmericanOdds(leg.odds)}</span></div><button class="parlay-leg-remove" data-remove-parlay-leg="${leg.id}" aria-label="Remove leg">✕</button></div>`;
}
function renderSavedParlay(p){
  const legs=legsForParlay(p.id),result=p.result||'Pending',profit=americanProfitUnits(p.units,p.odds);
  const hasPushedLeg=legs.some(l=>(l.result||'Pending')==='Push');
  const backendReview=state.gradingReviews.parlays[p.id]||'';
  const needsManualReview=hasPushedLeg||!!backendReview;
  const reviewKind=hasPushedLeg?'push':'safety';
  return `<div class="slip-card parlay-card"><div class="slip-main"><div class="slip-copy"><div class="slip-pick">${legs.length}-Leg ${p.isTeaser?`${Number(p.teaserPoints)}-Point Teaser`:'Parlay'}${needsManualReview?` <button type="button" class="manual-review-icon" data-parlay-review-info="${p.id}" data-review-kind="${reviewKind}" aria-label="Manual grading review required" title="Manual grading review required">ⓘ</button>`:''}</div><div class="slip-meta">${p.who} · <strong>${Number(p.units).toFixed(1)}u</strong> · <strong>${formatAmericanOdds(p.odds)}</strong>${profit!=null?` · To win ${profit.toFixed(2)}u`:''}${needsManualReview?` · <strong class="manual-review-text">Manual review</strong>`:''}</div></div><div class="slip-right"><span class="result-badge ${resultClassFor(result)}">${result}</span><button class="remove-btn compact-remove" data-remove-parlay="${p.id}">Remove</button></div></div><div class="saved-parlay-legs">${legs.map(l=>`<div class="saved-parlay-leg"><span>${escapeAttr(l.pick)}</span><span class="leg-result-badge ${resultClassFor(l.result||'Pending')}">${escapeAttr(l.result||'Pending')}</span></div>`).join('')}</div><div class="slip-actions compact-actions"><button class="secondary compact-btn" data-edit-parlay="${p.id}">Edit Parlay</button><button class="secondary compact-btn" data-parlay-result-menu="${p.id}">${result==='Pending'?'Set Result':'Edit Result'}</button></div><div class="result-picker" data-parlay-result-picker-for="${p.id}" hidden>${['Win','Loss','Push','DDL'].map(r=>`<button class="result-choice ${r.toLowerCase()}" data-set-parlay-result="${p.id}" data-result="${r}">${r}</button>`).join('')}</div></div>`;
}
function renderParlaysSlip(){
  const d=state.parlayDraft, saved=weekParlays(state.selectedWeek), names=effectivePickerNames(),profit=americanProfitUnits(d.units,d.odds);
  const hasMoneyline=d.legs.some(l=>l.betType==='Moneyline');
  const teaserBlocked=hasMoneyline&&!d.isTeaser;
  const builder=`<div class="parlay-builder">
    <div class="parlay-builder-head">
      <div><div class="section-title">${d.id?'Edit parlay':'Parlay Builder'}</div><div class="parlay-count">${d.legs.length} leg${d.legs.length===1?'':'s'} added</div></div>
      ${d.legs.length?'<button class="secondary compact-btn" data-clear-parlay>Clear</button>':''}
    </div>
    ${d.legs.length?`<div class="parlay-legs">${d.legs.map(l=>renderParlayLeg(l,d)).join('')}</div>`:'<div class="parlay-empty">Add picks from a game using <strong>Add to Parlay</strong>.</div>'}
    <button class="secondary parlay-add-leg" data-nav="market">+ Add Another Leg</button>
    <div class="teaser-row ${teaserBlocked?'teaser-blocked':''}">
      <div><strong>Teaser</strong><span>${teaserBlocked?'Moneyline leg present — teaser unavailable.':'Move every spread/total in your favor.'}</span></div>
      <button type="button" class="toggle-btn ${d.isTeaser?'active':''} ${teaserBlocked?'blocked':''}" data-toggle-teaser aria-pressed="${d.isTeaser?'true':'false'}" aria-disabled="${teaserBlocked?'true':'false'}"><span></span></button>
    </div>
    ${d.isTeaser?`<div class="field full teaser-points-field"><label>Tease every leg by</label><div class="points-input-wrap"><input id="teaserPointsInput" type="number" min="0.5" step="0.5" value="${escapeAttr(d.teaserPoints)}"><span>points</span></div></div>`:''}
    <div class="field-grid parlay-fields">
      <div class="field">
        <label>${d.isTeaser?'Locked payout odds':'Calculated payout odds'}</label>
        <input id="parlayOddsInput" type="text" inputmode="numeric" value="${escapeAttr(d.odds)}" placeholder="${d.isTeaser?'+120':'Add 2+ priced legs'}">
      </div>
      <div class="field"><label>Units</label><input id="parlayUnitsInput" type="number" min="0.1" step="0.5" value="${escapeAttr(d.units)}"></div>
      <div class="field full"><label>Who’s pick is this?</label><select id="parlayWhoInput">${names.map(n=>`<option value="${escapeAttr(n)}" ${(d.who||state.displayName)===n?'selected':''}>${escapeAttr(n)}</option>`).join('')}</select></div>
    </div>
    ${profit!=null?`<div class="parlay-payout"><span>To win</span><strong>${profit.toFixed(2)}u</strong><span>Total return ${(profit+Number(d.units)).toFixed(2)}u</span></div>`:''}
    <button class="primary ${state.parlaySaving?'saved-confirmation':''}" data-save-parlay ${state.parlaySaving?'disabled':''}>${state.parlaySaving?'Saving…':(d.id?'Save Parlay Changes':'Save Parlay')}</button>
    <div class="parlay-note">${d.isTeaser?'Enter the sportsbook payout odds for the teaser.':'Calculated from each leg’s saved Actual Payout. You can overwrite the final parlay payout before saving.'}</div>
  </div>`;
  return `${builder}${saved.length?`<div class="saved-parlays-title">Saved Parlays (${saved.length})</div>${saved.map(renderSavedParlay).join('')}`:'<div class="empty compact-empty">No saved parlays for this week yet.</div>'}`;
}
function renderSlip(){
  const pushControls=`<div class="push-results-row"><button class="primary push-results-btn" data-push-results ${state.pushingResults?'disabled':''}>${state.pushingResults?'Checking Results…':'Push Results'}</button>${state.pushResultsMessage?`<div class="push-results-message">${escapeAttr(state.pushResultsMessage)}</div>`:''}</div>`;
  const importBar=`<div class="screenshot-import-launch"><div><strong>Screenshot Import</strong><span>Bulk upload sportsbook screenshots and review bets before saving.</span></div><button type="button" class="secondary screenshot-import-btn" data-open-screenshot-import>Import Screenshots</button><input type="file" data-screenshot-file-input accept="image/*" multiple hidden></div>`;
  return `${importBar}<div class="slip-tabs"><button class="slip-tab ${state.slipTab==='straight'?'active':''}" data-slip-tab="straight">Straight Picks (${weekWagers(state.selectedWeek).length})</button><button class="slip-tab ${state.slipTab==='parlays'?'active':''}" data-slip-tab="parlays">Parlays (${weekParlays(state.selectedWeek).length})${state.parlayDraft.legs.length?` <span class="draft-dot">${state.parlayDraft.legs.length}</span>`:''}</button></div>${pushControls}${state.slipTab==='straight'?renderStraightSlip():renderParlaysSlip()}`;
}
function wagerMovementSignals(g){
  const history=oddsHistoryForGame(g);
  if(!history.length)return {awaySpread:null,homeSpread:null,total:null};
  const first=history[0];
  return {
    awaySpread:spreadMovementSignal(spreadForTeamFromSnapshot(first,g.away),fmtSpread(g,g.away)),
    homeSpread:spreadMovementSignal(spreadForTeamFromSnapshot(first,g.home),fmtSpread(g,g.home)),
    total:totalMovementSignal(first.total,g.total)
  };
}
function renderChoiceArea(g,kind,selection){
  const spreadAvailable=hasSpread(g), totalAvailable=hasTotal(g);
  const awayLine=spreadAvailable?signed(fmtSpread(g,g.away)):'—';
  const homeLine=spreadAvailable?signed(fmtSpread(g,g.home)):'—';
  const totalLine=totalAvailable?g.total:'—';
  const awayMl=g.awayMoneyline==null?'—':formatAmericanOdds(g.awayMoneyline);
  const homeMl=g.homeMoneyline==null?'—':formatAmericanOdds(g.homeMoneyline);
  const moves=wagerMovementSignals(g);
  const totalArrow=moves.total==='up'
    ? `<span class="market-move market-move-up" aria-label="Total rising">↑</span>`
    : moves.total==='down'
      ? `<span class="market-move market-move-down" aria-label="Total falling">↓</span>`
      : '';
  return `<div class="wager-market-list">
    <div class="wager-market-row">
      <div class="wager-market-label">${renderMiniTeamLogo(g.away)}<strong>${escapeAttr(g.away)}</strong></div>
      <button class="choice-btn wager-price-btn ${kind==='Spread'&&selection===g.away?'selected':''}" data-bet-kind="Spread" data-selection="${escapeAttr(g.away)}" ${spreadAvailable?'':'disabled'}><span class="wager-line-with-move">${awayLine}${renderMovementArrow(moves.awaySpread,g.away)}</span></button>
      <button class="choice-btn wager-price-btn ${kind==='Moneyline'&&selection===g.away?'selected':''}" data-bet-kind="Moneyline" data-selection="${escapeAttr(g.away)}" ${g.awayMoneyline!=null?'':'disabled'}>${awayMl}</button>
    </div>
    <div class="wager-market-row">
      <div class="wager-market-label">${renderMiniTeamLogo(g.home)}<strong>${escapeAttr(g.home)}</strong></div>
      <button class="choice-btn wager-price-btn ${kind==='Spread'&&selection===g.home?'selected':''}" data-bet-kind="Spread" data-selection="${escapeAttr(g.home)}" ${spreadAvailable?'':'disabled'}><span class="wager-line-with-move">${homeLine}${renderMovementArrow(moves.homeSpread,g.home)}</span></button>
      <button class="choice-btn wager-price-btn ${kind==='Moneyline'&&selection===g.home?'selected':''}" data-bet-kind="Moneyline" data-selection="${escapeAttr(g.home)}" ${g.homeMoneyline!=null?'':'disabled'}>${homeMl}</button>
    </div>
    <div class="wager-market-row">
      <div class="wager-market-label wager-total-label"><span class="total-bars" aria-hidden="true"><i></i><i></i><i></i></span><strong>Total</strong></div>
      <button class="choice-btn wager-price-btn total-price-btn ${kind==='Total'&&selection==='Over'?'selected':''}" data-bet-kind="Total" data-selection="Over" ${totalAvailable?'':'disabled'}><span class="total-price-label">Over</span><span class="total-price-line">${totalLine}${totalArrow}</span></button>
      <button class="choice-btn wager-price-btn total-price-btn ${kind==='Total'&&selection==='Under'?'selected':''}" data-bet-kind="Total" data-selection="Under" ${totalAvailable?'':'disabled'}><span class="total-price-label">Under</span><span class="total-price-line">${totalLine}${totalArrow}</span></button>
    </div>
  </div>`;
}

function renderPickerSelector(){
  if(!state.activePickerSelector) return '';
  const names=effectivePickerNames();
  return `<div class="overlay picker-overlay">
    <section class="sheet picker-sheet">
      <div class="sheet-handle"></div>
      <div class="close-row">
        <div>
          <h2 style="margin:0">Who’s pick is this?</h2>
        </div>
        <button class="icon-btn" data-close-picker-selector>✕</button>
      </div>
      <div class="picker-option-list">
        ${names.map((name,idx)=>`<button class="picker-option" data-picker-name="${escapeAttr(name)}"><span>${escapeAttr(name)}</span>${idx===0?'<span class="default-tag">Display Name</span>':''}</button>`).join('')}
        <button class="picker-option add-picker-name" data-add-picker-name>+ Add Name</button>
      </div>
      ${state.activeAddName ? `
        <div class="add-name-panel">
          <div class="field full">
            <label>Add Name</label>
            <input id="newPickerNameInput" type="text" maxlength="40" placeholder="Enter name">
          </div>
          <button class="primary" data-save-picker-name>Save</button>
        </div>` : ''}
    </section>
  </div>`;
}

function teamScreenResultFor(g,teamId){
  if(!g.game_completed)return '';
  const isAway=String(g.away_team_id)===String(teamId);
  const teamScore=Number(isAway?g.away_score:g.home_score);
  const oppScore=Number(isAway?g.home_score:g.away_score);
  if(!Number.isFinite(teamScore)||!Number.isFinite(oppScore))return '';
  return teamScore>oppScore?'W':teamScore<oppScore?'L':'T';
}
function teamScreenAtsFor(g,teamId){
  return String(g.away_team_id)===String(teamId)?(g.away_ats_result||''):(g.home_ats_result||'');
}
function teamScreenLineFor(g,teamId){
  if(g.closing_spread==null||!g.closing_spread_team_id)return null;
  const n=Number(g.closing_spread);
  if(!Number.isFinite(n))return null;
  return String(g.closing_spread_team_id)===String(teamId)?n:-n;
}
function teamRecordFromGames(games,teamId){
  let wins=0,losses=0,ties=0,atsWins=0,atsLosses=0,atsPushes=0,overWins=0,overLosses=0,overPushes=0;
  for(const g of games||[]){
    const r=teamScreenResultFor(g,teamId);
    if(r==='W')wins++;else if(r==='L')losses++;else if(r==='T')ties++;
    const a=teamScreenAtsFor(g,teamId);
    if(a==='Win')atsWins++;else if(a==='Loss')atsLosses++;else if(a==='Push')atsPushes++;
    if(g.total_result==='Over')overWins++;else if(g.total_result==='Under')overLosses++;else if(g.total_result==='Push')overPushes++;
  }
  return {wins,losses,ties,atsWins,atsLosses,atsPushes,overWins,overLosses,overPushes};
}
function teamScreenRecord(teamId){return teamRecordFromGames(state.teamScreenGames||[],teamId);}
function formatRecordTriplet(rec){
  if(!rec)return {overall:'—',ats:'—',overs:'—'};
  const overall=`${rec.wins}-${rec.losses}${rec.ties?`-${rec.ties}`:''}`;
  const ats=`${rec.atsWins}-${rec.atsLosses}${rec.atsPushes?`-${rec.atsPushes}`:''}`;
  const overs=`${rec.overWins}-${rec.overLosses}${rec.overPushes?`-${rec.overPushes}`:''}`;
  return {overall,ats,overs};
}
function renderGameTeamRecord(teamName){
  const meta=teamMetaFor(teamName),teamId=meta?.espnTeamId?String(meta.espnTeamId):'';
  const rec=teamId?state.gameTeamStats?.[teamId]:null;
  const fmt=formatRecordTriplet(rec);
  return `<div class="game-team-record"><span><small>Overall</small><b>${fmt.overall}</b></span><span><small>ATS</small><b>${fmt.ats}</b></span><span><small>Overs</small><b>${fmt.overs}</b></span></div>`;
}
async function loadGameTeamStats(g){
  if(!state.sb||!g)return;
  const metas=[teamMetaFor(g.away),teamMetaFor(g.home)].filter(m=>m?.espnTeamId);
  const unique=[...new Map(metas.map(m=>[String(m.espnTeamId),m])).values()];
  if(!unique.length)return;
  state.gameTeamStatsLoading=true;
  try{
    const results=await Promise.all(unique.map(async meta=>{
      const teamId=String(meta.espnTeamId);
      const {data,error}=await state.sb.from('team_season_games')
        .select('week,away_team_id,home_team_id,away_score,home_score,game_completed,away_ats_result,home_ats_result,total_result')
        .eq('season',2026)
        .or(`away_team_id.eq.${teamId},home_team_id.eq.${teamId}`);
      return {teamId,data:error?[]:(data||[])};
    }));
    for(const item of results)state.gameTeamStats[item.teamId]=teamRecordFromGames(item.data,item.teamId);
  }finally{
    state.gameTeamStatsLoading=false;
    if(state.activeGameId===g.id)render();
  }
}
function renderTeamScreen(){
  const teamId=String(state.activeTeamId||'');
  const meta=state.cfbTeams.find(t=>String(t.espnTeamId)===teamId)||teamMetaFor(state.activeTeamName);
  const teamName=meta?.espnName||state.activeTeamName||'Team';
  const display=splitSlateTeamName(teamName);
  const logo=meta?.logoUrl
    ? `<img class="team-page-logo" src="${escapeAttr(meta.logoUrl)}" alt="${escapeAttr(teamName)} logo">`
    : `<div class="team-page-logo team-page-logo-fallback">${escapeAttr(meta?.abbreviation||teamMonogram(teamName))}</div>`;
  const rec=teamScreenRecord(teamId);
  const overall=rec.ties?`${rec.wins}-${rec.losses}-${rec.ties}`:`${rec.wins}-${rec.losses}`;
  const ats=rec.atsPushes?`${rec.atsWins}-${rec.atsLosses}-${rec.atsPushes}`:`${rec.atsWins}-${rec.atsLosses}`;
  const overs=rec.overPushes?`${rec.overWins}-${rec.overLosses}-${rec.overPushes}`:`${rec.overWins}-${rec.overLosses}`;
  const games=[...(state.teamScreenGames||[])].sort((a,b)=>new Date(a.commence_time)-new Date(b.commence_time));
  let body='';
  if(state.teamScreenLoading)body='<div class="team-page-loading">Loading 2026 schedule…</div>';
  else if(state.teamScreenError)body=`<div class="empty compact-empty">${escapeAttr(state.teamScreenError)}</div>`;
  else if(!games.length)body='<div class="empty compact-empty">No 2026 games found for this team.</div>';
  else body=`<div class="team-schedule-list">${games.map(g=>{
    const isAway=String(g.away_team_id)===teamId;
    const opponent=isAway?g.home_team_name:g.away_team_name;
    const opponentId=isAway?g.home_team_id:g.away_team_id;
    const opponentMeta=state.cfbTeams.find(t=>String(t.espnTeamId)===String(opponentId));
    const date=new Date(g.commence_time);
    const dateLabel=Number.isNaN(date.getTime())?'TBD':new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(date);
    const result=teamScreenResultFor(g,teamId);
    const teamScore=isAway?g.away_score:g.home_score;
    const oppScore=isAway?g.home_score:g.away_score;
    const score=g.game_completed&&teamScore!=null&&oppScore!=null?`${teamScore}-${oppScore}`:'—';
    const atsResult=teamScreenAtsFor(g,teamId);
    const line=teamScreenLineFor(g,teamId);
    const lineText=line==null?'—':signed(line);
    const totalText=g.closing_total==null?'—':String(Number(g.closing_total));
    const totalResult=g.total_result||'';
    const opponentAbbr=opponentMeta?.abbreviation||teamMonogram(opponent);
    const oppLogo=opponentMeta?.logoUrl?`<img src="${escapeAttr(opponentMeta.logoUrl)}" alt="">`:`<span>${escapeAttr(opponentAbbr)}</span>`;
    const kickoff=formatKickoff(g.commence_time).time||'';
    return `<div class="team-schedule-row ${g.game_completed?'completed':'upcoming'}">
      <div class="team-game-identity">
        <div class="team-week-date"><strong>W${g.week}</strong><span>${escapeAttr(dateLabel)}</span></div>
        <div class="team-opponent">${oppLogo}<div><strong>${isAway?'@ ':'vs '}${escapeAttr(opponent)}</strong></div></div>
        ${!g.game_completed?`<div class="team-upcoming-time">${escapeAttr(kickoff||'TBD')}</div>`:''}
      </div>
      ${g.game_completed?`<div class="team-game-metrics">
        <div><span>Result</span><strong class="team-result-${String(result||'').toLowerCase()}">${escapeAttr(result||'—')}</strong></div>
        <div><span>Score</span><strong>${escapeAttr(score)}</strong></div>
        <div><span>ATS</span><strong class="team-ats-${String(atsResult||'').toLowerCase()}">${escapeAttr(atsResult||'—')}</strong></div>
        <div><span>Spread</span><strong>${escapeAttr(lineText)}</strong></div>
        <div><span>Total</span><strong class="team-total-${String(totalResult||'').toLowerCase()}">${escapeAttr(totalResult||'—')}</strong></div>
        <div><span>O/U</span><strong>${escapeAttr(totalText)}</strong></div>
      </div>`:''}
    </div>`;
  }).join('')}</div>`;
  return `<div class="team-page-overlay">
    <section class="team-page-sheet">
      <div class="team-page-top"><button class="team-back-btn" data-close-team aria-label="Back">‹</button><div class="team-page-title">2026 Team</div><span class="team-page-top-spacer"></span></div>
      <div class="team-page-scroll">
        <section class="team-page-hero">${logo}<div class="team-page-name"><h2>${escapeAttr(display.school||teamName)}</h2><div>${escapeAttr(display.mascot||'')}</div><span>${escapeAttr(meta?.conference||'')}</span></div></section>
        <div class="team-record-grid"><div><strong>${overall}</strong><span>Overall</span></div><div><strong>${ats}</strong><span>ATS</span></div><div><strong>${overs}</strong><span>Overs</span></div></div>
        <div class="team-schedule-heading"><strong>2026 Schedule</strong><span>Results · closing lines</span></div>
        ${body}
      </div>
    </section>
  </div>`;
}
async function openTeamScreen(teamName){
  const meta=teamMetaFor(teamName);
  if(!meta?.espnTeamId){alert('Team profile data is unavailable for this team.');return;}
  state.activeTeamId=String(meta.espnTeamId);
  state.activeTeamName=meta.espnName||teamName;
  state.teamScreenGames=[];
  state.teamScreenError='';
  state.teamScreenLoading=true;
  render();
  const {data,error}=await state.sb.from('team_season_games')
    .select('id,season,week,espn_event_id,commence_time,away_team_id,away_team_name,home_team_id,home_team_name,away_score,home_score,game_completed,game_status,venue_name,tv_network,closing_spread_team_id,closing_spread_team_name,closing_spread,closing_total,closing_source,away_ats_result,home_ats_result,total_result')
    .eq('season',2026)
    .or(`away_team_id.eq.${meta.espnTeamId},home_team_id.eq.${meta.espnTeamId}`)
    .order('commence_time',{ascending:true});
  state.teamScreenLoading=false;
  if(error)state.teamScreenError=`Could not load team schedule: ${error.message}`;
  else state.teamScreenGames=data||[];
  render();
}

function renderGameSheet(){
  const g=gameById(state.activeGameId);
  if(!g)return'';

  const editing=state.editWagerId?state.wagers.find(w=>w.id===state.editWagerId):null;
  const defaultWho=tempWho||editing?.who||state.displayName||'';
  let kind=editing?.betType||tempKind||'';
  if(kind==='Spread'&&!hasSpread(g))kind='';
  if(kind==='Total'&&!hasTotal(g))kind='';
  if(kind==='Moneyline'&&marketLineFor(g,'Moneyline',editing?.selection||tempSelection)==null)kind='';
  const selection=editing?.selection||tempSelection||null;
  tempKind=kind;
  tempSelection=selection;

  const actualLineValue=editing?(tempLine!==''?tempLine:editing.line):tempLine;
  const defaultPayout=kind==='Moneyline'&&selection?marketOddsFor(g,kind,selection):-110;
  const actualPayoutValue=editing
    ? (tempPayout!==''?tempPayout:(editing.payoutOdds??defaultPayout))
    : (tempPayout!==''?tempPayout:defaultPayout);
  const k=formatKickoff(g.commenceTime);
  const venue=gameVenueText(g);

  return `<div class="game-page-overlay">
    <section class="game-page-sheet">
      <div class="game-page-top"><button class="game-back-btn" data-close aria-label="Back">‹</button><div class="game-page-title">Game</div><span class="game-page-top-spacer"></span></div>
      <div class="game-page-scroll">

      <section class="matchup-hero reference-hero">
        <div class="matchup-team">
          <button type="button" class="matchup-logo-button" data-open-team="${escapeAttr(g.away)}" aria-label="Open ${escapeAttr(g.away)} team page">${renderTeamLogo(g.away)}</button>
          <div class="matchup-team-name">${escapeAttr(g.away)}</div>
          <div class="matchup-team-role">Away</div>
          ${renderGameTeamRecord(g.away)}
        </div>

        <div class="matchup-center reference-at"><div class="matchup-at">@</div></div>

        <div class="matchup-team">
          <button type="button" class="matchup-logo-button" data-open-team="${escapeAttr(g.home)}" aria-label="Open ${escapeAttr(g.home)} team page">${renderTeamLogo(g.home)}</button>
          <div class="matchup-team-name">${escapeAttr(g.home)}</div>
          <div class="matchup-team-role">Home</div>
          ${renderGameTeamRecord(g.home)}
        </div>
      </section>

      <div class="game-meta-row">
        <div class="game-meta-item">
          <span class="game-meta-icon">${metaIcon('calendar')}</span>
          <div><strong>${k.date}</strong><span>${k.time}</span></div>
        </div>
        <div class="game-meta-divider"></div>
        <div class="game-meta-item tv-meta-item tv-meta-logo-only">
          ${renderTvNetworkLogo(g.tv)}
        </div>
        <div class="game-meta-divider"></div>
        <div class="game-meta-item location-meta">
          <span class="game-meta-icon">${metaIcon('location')}</span>
          <div><strong>${escapeAttr(g.venueName||g.location||'Location TBD')}</strong><span>${escapeAttr([g.venueCity,g.venueState].filter(Boolean).join(', '))}</span></div>
        </div>
      </div>

      <section class="movement-card movement-card-graphs-only">
        <div class="history-buttons">
          <button type="button" class="secondary history-btn" data-open-history="Spread" ${historyChartPoints(g,'Spread').length<2?'disabled':''}>Spread Graph</button>
          <button type="button" class="secondary history-btn" data-open-history="Total" ${historyChartPoints(g,'Total').length<2?'disabled':''}>Total Graph</button>
        </div>
      </section>

      <div class="wager-editor">
        <div class="section-title">Add wager</div>
        <div id="choiceArea">${renderChoiceArea(g,kind,selection)}</div>
        <div class="field-grid wager-entry-fields">
          <div class="field">
            <label>Actual Line</label>
            <input id="lineInput" type="number" step="0.5" value="${actualLineValue}" placeholder="Market">
          </div>
          <div class="field">
            <label>Actual Payout</label>
            <input id="payoutInput" type="number" step="1" value="${escapeAttr(actualPayoutValue)}">
          </div>
          <div class="field">
            <label>Units</label>
            <input id="unitsInput" type="number" min="0.1" step="0.5" value="${editing?(tempUnits??editing.units):(tempUnits??1)}">
          </div>
        </div>
        <div class="picker-caution-row">
          <div class="field picker-inline-field">
            <label>Who’s pick is this?</label>
            <button type="button" class="picker-select-btn" data-open-picker-selector>
              <span id="pickerSelectionLabel">${escapeAttr(defaultWho)}</span>
              <span class="chev">›</span>
            </button>
            <input id="whoInput" type="hidden" value="${escapeAttr(defaultWho)}">
          </div>
          <button type="button" class="caution-toggle inline-caution ${isCautioned(g.id)?'active':''}" data-toggle-caution="${g.id}">${isCautioned(g.id)?'⚠️ Caution Marked':'⚠️ Mark Caution'}</button>
        </div>
        <button class="primary ${state.saving?'saved-confirmation':''}" data-save-wager ${state.saving?'disabled':''}>${state.saving?'✓ Saved':(editing?'Save Changes':'Confirm Bet')}</button>
        ${editing?'':`<button class="secondary add-to-parlay-btn" data-add-to-parlay>+ Add to Parlay</button>`}
      </div>
      </div>
    </section>
  </div>`;
}

function renderScreenshotImporter(){
  const files=state.screenshotImportFiles;
  const unitSet=Number.isFinite(Number(state.standardUnitSize))&&Number(state.standardUnitSize)>0;
  const totalCandidates=files.reduce((sum,item)=>sum+(item.candidates?.length||0),0);
  const importWeek=Number(state.screenshotImportWeek ?? state.selectedWeek);
  const cards=files.length?files.map((item,index)=>{
    const candidates=(item.candidates||[]).map((c,cIndex)=>{
      const stake=c.stakeUsd==null?'Stake not detected':`${formatUsd(c.stakeUsd)}${c.units!=null?` → ${Number(c.units).toFixed(2).replace(/\.00$/,'')}u`:''}`;
      const linePart=c.line==null?'':` ${signed(c.line)}`;
      const oddsPart=c.odds==null?'':` · ${signed(c.odds)}`;
      const meta=[c.sportsbook,c.betType,c.status].filter(Boolean).join(' · ');
      const matchClass=c.matchStatus==='wrong-week'?'wrong-week':c.reviewState==='Ready for Slip'?'matched':'review';
      const matchLine=c.matchStatus==='matched'?`<div class="parsed-bet-match"><strong>${escapeAttr(c.matchedAway)} @ ${escapeAttr(c.matchedHome)}</strong><span>Week ${importWeek} game matched</span></div>`:c.matchStatus==='wrong-week'?`<div class="parsed-bet-warning"><strong>Wrong week.</strong> This appears to be a Week ${Number(c.detectedWeek)} game. This batch can only accept Week ${importWeek} games.</div>`:'';
      return `<div class="parsed-bet-card">
        <div class="parsed-bet-head"><span>Bet ${cIndex+1}</span><span class="import-status-chip ${matchClass}">${escapeAttr(c.reviewState||'Needs review')}</span></div>
        <strong class="parsed-bet-pick">${escapeAttr(c.selection)}${escapeAttr(linePart)}</strong>
        <div class="parsed-bet-meta">${escapeAttr(meta)}${escapeAttr(oddsPart)}</div>
        <div class="parsed-bet-stake">${escapeAttr(stake)}${c.possibleWinningsUsd!=null?`<span> · Possible winnings ${escapeAttr(formatUsd(c.possibleWinningsUsd))}</span>`:''}</div>
        ${c.layoutType==='compact'?'<div class="parsed-bet-event">Compact row detected</div>':''}
        ${matchLine}
        ${c.eventText?`<div class="parsed-bet-event">${escapeAttr(c.eventText)}</div>`:''}
        ${c.stakeConfidence==='medium'?'<div class="parsed-bet-warning">Check wager amount — inferred from screenshot layout.</div>':''}${(c.missingFields||[]).length?`<div class="parsed-bet-warning"><strong>Needs review:</strong> ${escapeAttr(c.missingFields.join(' · '))}</div>`:''}
        ${(c.repairNotes||[]).length?`<div class="parsed-bet-warning"><strong>OCR repair:</strong> ${escapeAttr(c.repairNotes.join(' · '))}</div>`:''}
      </div>`;
    }).join('');
    const status=item.status==='Parsing'?`Parsing ${item.progress||0}%`:(item.status||'Queued');
    return `<article class="screenshot-review-card ${item.candidates?.length?'has-results':''}">
      <div class="screenshot-thumb-wrap">${item.preview?`<img src="${escapeAttr(item.preview)}" class="screenshot-thumb" alt="Screenshot ${index+1}">`:'<div class="screenshot-thumb-error">Image unavailable</div>'}</div>
      <div class="screenshot-review-copy"><div class="screenshot-review-top"><strong>Screenshot ${index+1}</strong><span class="import-status-chip ${item.status==='Parsing'?'working':''}">${escapeAttr(status)}</span></div><div class="screenshot-file-name">${escapeAttr(item.fileName)}</div>${item.status==='Parsing'?`<div class="import-progress"><span style="width:${Number(item.progress)||0}%"></span></div>`:''}<div class="screenshot-review-note">${item.candidates?.length?'Parsed locally. Review the detected wager details below.':'Ready for wager parsing. No bet will be added to your Slip until you approve it.'}</div>${item.error?`<div class="parsed-bet-warning">${escapeAttr(item.error)}</div>`:''}</div>
      ${item.parserDiagnostic?`<details class="parser-debug-panel" open><summary>Parser diagnostics · ${escapeAttr(item.parserDiagnostic.reason)}</summary><div class="parser-debug-grid"><span>Build</span><strong>${escapeAttr(item.parserDiagnostic.build)}</strong><span>Source</span><strong>${escapeAttr(item.parserDiagnostic.source)}</strong><span>Prepared</span><strong>${escapeAttr(item.parserDiagnostic.prepared)}</strong><span>Scale / ratio</span><strong>${escapeAttr(String(item.parserDiagnostic.scale))}× / ${escapeAttr(String(item.parserDiagnostic.ratio))}</strong><span>Layout route</span><strong>${escapeAttr(item.parserDiagnostic.layoutHint)}</strong><span>Sportsbook</span><strong>${escapeAttr(item.parserDiagnostic.detectedSportsbook)}</strong><span>OCR chars</span><strong>${escapeAttr(String(item.parserDiagnostic.normalizedCharCount))}</strong><span>Timestamps</span><strong>${escapeAttr(String(item.parserDiagnostic.timestampCount))}</strong><span>Odds tokens</span><strong>${escapeAttr((item.parserDiagnostic.americanOdds||[]).join(', ')||'none')}</strong><span>Money tokens</span><strong>${escapeAttr((item.parserDiagnostic.moneyTokens||[]).join(', ')||'none')}</strong><span>Compact candidates</span><strong>${escapeAttr(String(item.parserDiagnostic.compactCandidateCount))}</strong><span>Wager anchors</span><strong>${escapeAttr(String(item.parserDiagnostic.wagerAnchorCount??item.parserDiagnostic.finalCandidateCount))}</strong><span>Spread candidates</span><strong>${escapeAttr(String(item.parserDiagnostic.spreadCandidateCount??0))}</strong><span>Moneyline candidates</span><strong>${escapeAttr(String(item.parserDiagnostic.moneylineCandidateCount??0))}</strong><span>Total candidates</span><strong>${escapeAttr(String(item.parserDiagnostic.totalCandidateCount??0))}</strong><span>Final candidates</span><strong>${escapeAttr(String(item.parserDiagnostic.finalCandidateCount))}</strong></div>${(item.parserDiagnostic.compactCandidates||[]).map((c,i)=>`<div class="parser-debug-candidate"><div class="parser-debug-label">Compact candidate ${i+1}</div><pre class="parser-debug-text">Raw selection: ${escapeAttr(c.rawSelection||'(empty)')}\nNormalized selection: ${escapeAttr(c.selection||'(empty)')}\nType: ${escapeAttr(c.betType||'')}\nLine: ${escapeAttr(String(c.line??'none'))}\nOdds: ${escapeAttr(String(c.odds??'none'))}\nMoney: ${escapeAttr(String(c.stakeUsd??'none'))} / ${escapeAttr(String(c.possibleWinningsUsd??'none'))}</pre></div>`).join('')}${item.parserDiagnostic.compactError?`<div class="parsed-bet-warning">Compact parser error: ${escapeAttr(item.parserDiagnostic.compactError)}</div>`:''}<div class="parser-debug-label">OCR text reaching parser</div><pre class="parser-debug-text">${escapeAttr(item.parserDiagnostic.ocrText||'(empty)')}</pre></details>`:''}
      ${candidates?`<div class="parsed-bets-list">${candidates}</div>`:''}
    </article>`;
  }).join(''):`<div class="screenshot-import-empty"><strong>No screenshots selected yet.</strong><span>Select one or many sportsbook screenshots to start a review batch.</span></div>`;
  return `<div class="screenshot-import-overlay"><section class="screenshot-import-page">
    <div class="screenshot-import-top"><button type="button" class="settings-back-btn" data-close-screenshot-import aria-label="Back">‹</button><div class="settings-page-title">Import Screenshots</div><span class="settings-page-top-spacer"></span></div>
    <div class="screenshot-import-scroll">
      <div class="screenshot-import-summary"><div><strong>Week ${importWeek} import · ${files.length} screenshot${files.length===1?'':'s'}</strong><span>${totalCandidates?`${totalCandidates} wager candidate${totalCandidates===1?'':'s'} detected · Week ${importWeek} only`:`Bulk review queue · Week ${importWeek} only`}</span></div><div class="unit-size-chip ${unitSet?'ready':'missing'}"><span>Standard unit</span><strong>${unitSet?formatUsd(state.standardUnitSize):'Not set'}</strong></div></div>
      ${!unitSet?`<div class="screenshot-import-warning"><strong>Set your standard unit size first.</strong><span>The importer will use wager amount ÷ standard unit size to prefill Units.</span><button type="button" class="secondary" data-import-open-settings>Open Settings</button></div>`:''}
      ${state.screenshotImportMessage?`<div class="auth-message error">${escapeAttr(state.screenshotImportMessage)}</div>`:''}
      <div class="screenshot-import-actions">${files.length?`<button type="button" class="primary" data-process-screenshots ${state.screenshotImportProcessing?'disabled':''}>${state.screenshotImportProcessing?'Processing Screenshots…':(totalCandidates?'Process Remaining Screenshots':'Process Screenshots')}</button>`:''}<button type="button" class="${files.length?'secondary':'primary'}" data-add-screenshots ${state.screenshotImportProcessing?'disabled':''}>${files.length?'Add More Screenshots':'Choose Screenshots'}</button>${files.length?'<button type="button" class="secondary full-width" data-clear-screenshot-batch '+(state.screenshotImportProcessing?'disabled':'')+'>Clear Batch</button>':''}<input type="file" data-screenshot-import-file accept="image/*" multiple hidden></div>
      <div class="screenshot-import-stage-head"><div><span>Stage 4</span><strong>Parse + validate Week ${importWeek}</strong></div><p>TrackPicks auto-detects card vs compact-row layouts, parses every wager it can find, and only auto-matches when both teams agree with a Week ${importWeek} game.</p></div>
      <div class="screenshot-review-list">${cards}</div>
    </div>
  </section></div>`;
}

function renderSettingsSheet(){
  const adminApiSection = state.isAdmin ? `
    <div class="security-note">
      <strong>Admin:</strong> the Odds API key is stored only in this browser/device for now.
    </div>
    <div class="field full settings-field">
      <label>The Odds API key</label>
      <input id="adminApiKeyInput" type="password" value="${escapeAttr(state.apiKey)}" placeholder="Paste your API key">
    </div>
    <button class="primary" data-save-admin-api>Save API Key</button>
    <div class="api-usage-card">
      <div class="api-usage-label">Odds API Usage</div>
      <div class="api-usage-value">${apiUsageSummary()}</div>
      <div class="api-usage-note">Monthly usage reported directly by The Odds API.</div>
    </div>
    <div class="settings-section admin-tools-section">
      <div class="section-title">Admin Tools</div>
      <div class="admin-status-card">
        <div class="admin-status-row"><span>Version</span><strong>${versionStamp()}</strong></div>
        <div class="admin-status-row"><span>Deployed version</span><strong>V${escapeAttr(deployedVersion||BUILD_VERSION)}</strong></div>
        <div class="admin-status-row"><span>Service worker / cache</span><strong>V${BUILD_VERSION}</strong></div>
        <div class="admin-status-row admin-status-row-stacked"><span>Last Odds API pull</span><strong>${escapeAttr(formatAdminTimestamp(latestOddsPullTimestamp()))}</strong></div>
      </div>
      <button class="secondary full-width" data-load-week ${state.loadingWeek?'disabled':''}>${state.loadingWeek?'Loading Week…':`Load / Refresh Week ${state.selectedWeek}`}</button>
      <div class="report-note">Pull the current DraftKings board for the selected Full Slate week.</div>
    </div>
    <hr class="settings-divider">
  ` : '';

  return `<div class="settings-page-overlay">
    <section class="settings-page-sheet">
      <div class="settings-page-top">
        <button type="button" class="settings-back-btn" data-close-settings aria-label="Back">‹</button>
        <div class="settings-page-title">Settings</div>
        <span class="settings-page-top-spacer"></span>
      </div>
      <div class="settings-page-scroll">
        <div class="settings-page-account">${escapeAttr(state.user?.email||'')}</div>
      
      <div class="settings-section">
        <div class="section-title">Profile</div>
        <div class="field full settings-field">
          <label>Display Name</label>
          <input id="settingsDisplayNameInput" type="text" maxlength="40" value="${escapeAttr(state.displayName||'')}" placeholder="Nickname or display name">
        </div>
        <button class="secondary full-width" data-save-display-name>Save Display Name</button>
      </div>

      <div class="settings-section">
        <div class="section-title">Betting Units</div>
        <div class="field full settings-field">
          <label>Standard Unit Size (USD)</label>
          <input id="standardUnitSizeInput" type="number" min="0.01" step="0.01" inputmode="decimal" value="${state.standardUnitSize??''}" placeholder="25.00">
        </div>
        <button class="secondary full-width" data-save-unit-size>Save Standard Unit Size</button>
        <div class="report-note">Used by Screenshot Import to convert a detected dollar wager into TrackPicks units. Example: $50 ÷ $25 = 2.0u.</div>
      </div>

      ${adminApiSection}
      
      <div class="settings-section">
        <div class="section-title">Dashboard</div>
        <button class="secondary full-width" data-open-dashboard>Open Dashboard</button>
      </div>

      <div class="settings-section">
        <div class="section-title">Reports</div>
        <div class="report-card">
          <div class="report-row">
            <select id="reportWeekSelect" class="report-select">
              ${Array.from({length:13},(_,week)=>`<option value="${week}" ${week===state.selectedWeek?'selected':''}>Week ${week}</option>`).join('')}
            </select>
            <button class="secondary report-btn" data-export-report="week">Weekly CSV</button>
          </div>
          <div class="report-row">
            <select id="reportMonthSelect" class="report-select">
              ${reportMonths().length?reportMonths().map(([key,label])=>`<option value="${key}">${label}</option>`).join(''):'<option value="">No graded months yet</option>'}
            </select>
            <button class="secondary report-btn" data-export-report="month" ${reportMonths().length?'':'disabled'}>Monthly CSV</button>
          </div>
          <button class="secondary full-width" data-export-report="season">Season CSV</button>
          <div class="report-note">Only graded picks are included. DDL is graded and exported as a Loss with DDL = Yes.</div>
        </div>
      </div>

      <div class="cloud-warning">
        <strong>Cloud sync is active.</strong> This app is permanently connected to the shared TrackPicks database. Games are shared with signed-in users; picks are private to each account.
      </div>
      <button class="secondary full-width" data-sync-now>Sync Now</button>
      <button class="danger-outline" data-signout>Log Out</button>
      </div>
    </section>
  </div>`;
}

function bindAuth(){
  document.querySelectorAll('[data-save-cloud]').forEach(el=>el.onclick=async()=>{const url=document.getElementById('setupUrl').value.trim(),key=document.getElementById('setupKey').value.trim();if(!url||!key){state.authMessage='Enter both Supabase values.';render();return;}localStorage.setItem(STORAGE.supabaseUrl,url);localStorage.setItem(STORAGE.supabaseKey,key);state.supabaseUrl=url;state.supabaseKey=key;state.authMessage='';state.authReady=false;render();await initCloud();});
  document.querySelectorAll('[data-auth-mode]').forEach(el=>el.onclick=()=>{state.authMode=el.dataset.authMode;state.authMessage='';render();});
  document.querySelectorAll('[data-auth-submit]').forEach(el=>el.onclick=async()=>{const email=document.getElementById('authEmail').value.trim(),password=document.getElementById('authPassword').value;if(!email||!password){state.authMessage='Enter an email and password.';render();return;}el.disabled=true;try{if(state.authMode==='signup'){const {data,error}=await state.sb.auth.signUp({email,password});if(error)throw error;state.authMessage=data.session?'Account created.':'Account created. Check your email if confirmation is enabled, then log in.';}else{const {error}=await state.sb.auth.signInWithPassword({email,password});if(error)throw error;state.authMessage='';}}catch(err){state.authMessage=err.message||String(err);}render();});
  document.querySelectorAll('[data-edit-cloud]').forEach(el=>el.onclick=()=>{localStorage.removeItem(STORAGE.supabaseUrl);localStorage.removeItem(STORAGE.supabaseKey);state.supabaseUrl='';state.supabaseKey='';state.sb=null;state.session=null;state.user=null;state.authMessage='';render();});

  document.querySelectorAll('[data-save-display-name-setup]').forEach(el=>el.onclick=async()=>{
    const input=document.getElementById('displayNameSetupInput');
    const result=await saveDisplayName(input?.value||'');
    if(!result.ok){alert(result.message);return;}
    render();
  });

}

function bindDynamicSelections(){ document.querySelectorAll('[data-bet-kind][data-selection]').forEach(el=>el.onclick=()=>{if(el.disabled)return;captureWagerDraft();tempKind=el.dataset.betKind;tempSelection=el.dataset.selection;const g=gameById(state.activeGameId);const defaultPayout=tempKind==='Moneyline'?marketOddsFor(g,tempKind,tempSelection):-110;tempPayout=defaultPayout==null?'':String(defaultPayout);document.querySelectorAll('[data-bet-kind][data-selection]').forEach(b=>b.classList.toggle('selected',b.dataset.betKind===tempKind&&b.dataset.selection===tempSelection));const payout=document.getElementById('payoutInput');if(payout)payout.value=tempPayout;}); }
function captureGameSheetScroll(){
  const sheet=document.querySelector('.game-page-scroll')||document.querySelector('.game-detail-sheet');
  return sheet?sheet.scrollTop:null;
}
function restoreGameSheetScroll(scrollTop){
  if(scrollTop==null)return;
  requestAnimationFrame(()=>{
    const sheet=document.querySelector('.game-page-scroll')||document.querySelector('.game-detail-sheet');
    if(sheet)sheet.scrollTop=scrollTop;
  });
}

function closePickerSelectorLocal(){
  state.activePickerSelector=false;
  state.activeAddName=false;
  document.querySelector('.picker-overlay')?.remove();
}

function mountPickerSelectorLocal(){
  state.activePickerSelector=true;
  state.activeAddName=false;
  document.querySelector('.picker-overlay')?.remove();
  const app=document.getElementById('app');
  if(!app)return;
  app.insertAdjacentHTML('beforeend',renderPickerSelector());
  bindPickerSelectorLocal();
}

function refreshPickerSelectorLocal(){
  document.querySelector('.picker-overlay')?.remove();
  const app=document.getElementById('app');
  if(!app || !state.activePickerSelector)return;
  app.insertAdjacentHTML('beforeend',renderPickerSelector());
  bindPickerSelectorLocal();
}

function applyPickerSelectionLocal(name){
  tempWho=name;
  const hidden=document.getElementById('whoInput');
  const label=document.getElementById('pickerSelectionLabel');
  if(hidden)hidden.value=name;
  if(label)label.textContent=name;
  closePickerSelectorLocal();
}

function bindPickerSelectorLocal(){
  const overlay=document.querySelector('.picker-overlay');
  if(!overlay)return;

  overlay.querySelectorAll('[data-close-picker-selector]').forEach(el=>el.onclick=()=>{
    closePickerSelectorLocal();
  });

  overlay.querySelectorAll('[data-picker-name]').forEach(el=>el.onclick=()=>{
    applyPickerSelectionLocal(el.dataset.pickerName);
  });

  overlay.querySelectorAll('[data-add-picker-name]').forEach(el=>el.onclick=()=>{
    state.activeAddName=true;
    refreshPickerSelectorLocal();
    requestAnimationFrame(()=>document.getElementById('newPickerNameInput')?.focus());
  });

  overlay.querySelectorAll('[data-save-picker-name]').forEach(el=>el.onclick=async()=>{
    const input=document.getElementById('newPickerNameInput');
    const newName=(input?.value||'').trim();
    const result=await addPickerName(newName);
    if(!result.ok){alert(result.message);return;}
    applyPickerSelectionLocal(newName);
  });
}

function bind(){
  document.querySelectorAll('[data-market-week]').forEach(el=>el.onchange=()=>{
    state.selectedWeek=Number(el.value);
    state.slateDivision='FBS';
    state.slateConference='All';
    state.importMessage='';
    render();
  });
  document.querySelectorAll('[data-week]').forEach(el=>el.onclick=()=>{state.selectedWeek=Number(el.dataset.week);state.view='market';state.slateDivision='FBS';state.slateConference='All';state.importMessage='';render();});
  document.querySelectorAll('[data-nav]').forEach(el=>el.onclick=()=>{state.view=el.dataset.nav;render();});
  document.querySelectorAll('[data-settings]').forEach(el=>el.onclick=()=>{state.showSettings=true;render();});
  document.querySelectorAll('[data-close-settings]').forEach(el=>el.onclick=()=>{state.showSettings=false;render();});
  document.querySelectorAll('[data-save-unit-size]').forEach(el=>el.onclick=async()=>{const input=document.getElementById('standardUnitSizeInput');const result=await saveStandardUnitSize(input?.value);if(!result.ok){alert(result.message);return;}el.textContent='✓ Saved';setTimeout(()=>{if(document.body.contains(el))el.textContent='Save Standard Unit Size';},1200);});
  document.querySelectorAll('[data-open-screenshot-import]').forEach(el=>el.onclick=()=>document.querySelector('[data-screenshot-file-input]')?.click());
  document.querySelectorAll('[data-screenshot-file-input]').forEach(el=>el.onchange=async()=>{const files=[...(el.files||[])];el.value='';await queueScreenshotFiles(files);});
  document.querySelectorAll('[data-close-screenshot-import]').forEach(el=>el.onclick=()=>{state.showScreenshotImporter=false;render();});
  document.querySelectorAll('[data-add-screenshots]').forEach(el=>el.onclick=()=>document.querySelector('[data-screenshot-import-file]')?.click());
  document.querySelectorAll('[data-screenshot-import-file]').forEach(el=>el.onchange=async()=>{const files=[...(el.files||[])];el.value='';await queueScreenshotFiles(files);});
  document.querySelectorAll('[data-process-screenshots]').forEach(el=>el.onclick=processScreenshotBatch);
  document.querySelectorAll('[data-clear-screenshot-batch]').forEach(el=>el.onclick=()=>{if(state.screenshotImportProcessing)return;state.screenshotImportFiles=[];state.screenshotImportWeek=null;state.screenshotImportMessage='';render();});
  document.querySelectorAll('[data-import-open-settings]').forEach(el=>el.onclick=()=>{state.showScreenshotImporter=false;state.showSettings=true;render();});
  document.querySelectorAll('[data-open-dashboard]').forEach(el=>el.onclick=()=>{state.showSettings=false;state.view='dashboard';render();});
  document.querySelectorAll('[data-import-history]').forEach(el=>el.onclick=()=>document.querySelector('[data-history-file]')?.click());
  document.querySelectorAll('[data-download-import-template]').forEach(el=>el.onclick=downloadImportTemplate);
  document.querySelectorAll('[data-history-file]').forEach(el=>el.onchange=async()=>{const file=el.files?.[0];el.value='';if(file)await importHistoryFile(file);});
  document.querySelectorAll('[data-manage-imports]').forEach(el=>el.onclick=openImportManager);
  document.querySelectorAll('[data-close-import-manager]').forEach(el=>el.onclick=()=>{if(state.deletingImportBatchId)return;state.showImportManager=false;render();});
  document.querySelectorAll('[data-delete-import]').forEach(el=>el.onclick=()=>deleteImportBatch(el.dataset.deleteImport));
  document.querySelectorAll('[data-sync-now]').forEach(el=>el.onclick=async()=>{state.showSettings=false;await syncFromCloud();render();});
  document.querySelectorAll('[data-edit-cloud]').forEach(el=>el.onclick=()=>{localStorage.removeItem(STORAGE.supabaseUrl);localStorage.removeItem(STORAGE.supabaseKey);location.reload();});
  document.querySelectorAll('[data-save-admin-api]').forEach(el=>el.onclick=()=>{
    if(!state.isAdmin){ alert('Admin access required.'); return; }
    const input=document.getElementById('adminApiKeyInput');
    const value=(input?.value||'').trim();
    state.apiKey=value;
    if(value) localStorage.setItem(STORAGE.apiKey,value);
    else localStorage.removeItem(STORAGE.apiKey);
    alert(value ? 'API key saved on this device.' : 'API key cleared.');
    render();
  });
  document.querySelectorAll('[data-signout]').forEach(el=>el.onclick=async()=>{await state.sb.auth.signOut();state.showSettings=false;});
  document.querySelectorAll('[data-load-week]').forEach(el=>el.onclick=async()=>{state.showSettings=false;await loadSelectedWeek();});
  document.querySelectorAll('[data-slate-search]').forEach(el=>el.oninput=()=>{
    state.slateSearch=el.value||'';
    let visible=0;
    document.querySelectorAll('.slate-game-list [data-game]').forEach(card=>{
      const g=gameById(card.dataset.game);
      const show=!!g&&gameMatchesSlateSearch(g);
      card.hidden=!show;
      if(show)visible++;
    });
    const empty=document.querySelector('[data-slate-search-empty]');
    if(empty)empty.hidden=visible>0;
  });
  document.querySelectorAll('[data-slate-division]').forEach(el=>el.onclick=()=>{state.slateDivision=el.dataset.slateDivision;if(state.slateDivision==='FBS'&&!['All','SEC','Big Ten','Big 12','ACC','G6'].includes(state.slateConference))state.slateConference='All';render();});
  document.querySelectorAll('[data-slate-conference]').forEach(el=>el.onclick=()=>{state.slateConference=el.dataset.slateConference;state.slateDivision='FBS';render();});
  document.querySelectorAll('[data-game],[data-open-game]').forEach(el=>el.onclick=()=>{state.activeGameId=el.dataset.game||el.dataset.openGame;state.editWagerId=null;tempWho=null;resetWagerDraft();state.saving=false;render();const g=gameById(state.activeGameId);if(g)loadGameTeamStats(g);});
  document.querySelectorAll('[data-open-team]').forEach(el=>el.onclick=(event)=>{event.preventDefault();event.stopPropagation();openTeamScreen(el.dataset.openTeam);});
  document.querySelectorAll('[data-close-team]').forEach(el=>el.onclick=()=>{state.activeTeamId=null;state.activeTeamName='';state.teamScreenGames=[];state.teamScreenLoading=false;state.teamScreenError='';render();});
  document.querySelectorAll('[data-close]').forEach(el=>el.onclick=()=>{state.activeGameId=null;state.editWagerId=null;state.historyChartKind=null;state.historyPointIndex=null;tempWho=null;resetWagerDraft();state.saving=false;render();});
  document.querySelectorAll('[data-open-history]').forEach(el=>el.onclick=(event)=>{event.preventDefault();captureWagerDraft();const scrollTop=captureGameSheetScroll();state.historyChartKind=el.dataset.openHistory;state.historyPointIndex=null;render();restoreGameSheetScroll(scrollTop);});
  document.querySelectorAll('[data-close-history]').forEach(el=>el.onclick=(event)=>{event.preventDefault();const scrollTop=captureGameSheetScroll();state.historyChartKind=null;state.historyPointIndex=null;render();restoreGameSheetScroll(scrollTop);});
  document.querySelectorAll('[data-history-point]').forEach(el=>el.onclick=(event)=>{event.preventDefault();event.stopPropagation();state.historyPointIndex=Number(el.dataset.historyPoint);const scrollTop=captureGameSheetScroll();render();restoreGameSheetScroll(scrollTop);});
  document.querySelectorAll('[data-history-chart]').forEach(el=>el.onclick=(event)=>{if(event.target.closest?.('[data-history-point]'))return;if(state.historyPointIndex==null)return;state.historyPointIndex=null;const scrollTop=captureGameSheetScroll();render();restoreGameSheetScroll(scrollTop);});
  bindDynamicSelections();
  document.querySelectorAll('[data-save-wager]').forEach(el=>el.onclick=saveCurrentWager);
  document.querySelectorAll('[data-add-to-parlay]').forEach(el=>el.onclick=addCurrentSelectionToParlay);
  document.querySelectorAll('[data-slip-tab]').forEach(el=>el.onclick=()=>{state.slipTab=el.dataset.slipTab;render();});
  document.querySelectorAll('[data-push-results]').forEach(el=>el.onclick=pushResults);
  document.querySelectorAll('[data-remove-parlay-leg]').forEach(el=>el.onclick=()=>{captureParlayDraftInputs();state.parlayDraft.legs=state.parlayDraft.legs.filter(l=>l.id!==el.dataset.removeParlayLeg);syncParlayEstimate();render();});
  document.querySelectorAll('[data-clear-parlay]').forEach(el=>el.onclick=()=>{resetParlayDraft();render();});
  document.querySelectorAll('[data-toggle-teaser]').forEach(el=>el.onclick=()=>{captureParlayDraftInputs();if(!state.parlayDraft.isTeaser&&state.parlayDraft.legs.some(l=>l.betType==='Moneyline')){alert('No moneylines in teasers! Cmon!');return;}state.parlayDraft.isTeaser=!state.parlayDraft.isTeaser;syncParlayEstimate();render();});
  document.querySelectorAll('[data-save-parlay]').forEach(el=>el.onclick=saveCurrentParlay);
  document.querySelectorAll('[data-edit-parlay]').forEach(el=>el.onclick=()=>editParlay(el.dataset.editParlay));
  document.querySelectorAll('[data-remove-parlay]').forEach(el=>el.onclick=()=>removeParlay(el.dataset.removeParlay));
  document.querySelectorAll('[data-parlay-result-menu]').forEach(el=>el.onclick=()=>{const id=el.dataset.parlayResultMenu;document.querySelectorAll('[data-parlay-result-picker-for]').forEach(p=>{p.hidden=p.dataset.parlayResultPickerFor!==id?true:!p.hidden;});});
  document.querySelectorAll('[data-straight-review-info]').forEach(el=>el.onclick=()=>{
    const reason=state.gradingReviews.straight[el.dataset.straightReviewInfo]||'TrackPicks could not safely grade this completed pick.';
    alert(`${reason}\n\nReview the saved line/selection and manually grade this pick.`);
  });
  document.querySelectorAll('[data-parlay-review-info]').forEach(el=>el.onclick=()=>{
    const id=el.dataset.parlayReviewInfo;
    if(el.dataset.reviewKind==='push'){
      alert("You had a leg push, manually grade this. I'd edit the payout field as well for more accurate record keeping");
      return;
    }
    const reason=state.gradingReviews.parlays[id]||'TrackPicks could not safely grade one or more completed legs.';
    alert(`${reason}\n\nReview the leg data and manually grade this parlay or teaser.`);
  });
  document.querySelectorAll('[data-set-parlay-result]').forEach(el=>el.onclick=()=>setParlayResult(el.dataset.setParlayResult,el.dataset.result));
  ['parlayOddsInput','parlayUnitsInput','parlayWhoInput','teaserPointsInput'].forEach(id=>{const el=document.getElementById(id);if(el){el.oninput=captureParlayDraftInputs;el.onchange=()=>{captureParlayDraftInputs();render();};}});
  document.querySelectorAll('[data-edit]').forEach(el=>el.onclick=()=>{const w=state.wagers.find(x=>x.id===el.dataset.edit);const g=w?gameById(w.gameId):null;if(!w||!g)return;state.activeGameId=w.gameId;state.editWagerId=w.id;tempWho=w.who||state.displayName;tempLine=String(w.line??'');tempPayout=String(w.payoutOdds??(w.betType==='Moneyline'?w.marketMoneyline:-110)??-110);tempUnits=String(w.units??1);state.saving=false;tempKind=w.betType;tempSelection=w.selection;render();loadGameTeamStats(g);});
  document.querySelectorAll('[data-remove]').forEach(el=>el.onclick=()=>removeWager(el.dataset.remove));
  document.querySelectorAll('[data-result-menu]').forEach(el=>el.onclick=()=>{const id=el.dataset.resultMenu;document.querySelectorAll('[data-result-picker-for]').forEach(p=>{p.hidden=p.dataset.resultPickerFor!==id?true:!p.hidden;});});
  document.querySelectorAll('[data-set-result]').forEach(el=>el.onclick=async()=>{const id=el.dataset.setResult,result=el.dataset.result;const {error}=await state.sb.from('wagers').update({result,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',state.user.id);if(error){alert(`Could not update result: ${error.message}`);return;}const w=state.wagers.find(x=>x.id===id);if(w)w.result=result;const card=el.closest('.slip-card');const picker=card?.querySelector('.result-picker');if(picker)picker.hidden=true;const badge=card?.querySelector('.result-badge');if(badge){badge.className='result-badge result-saved';badge.textContent='✓ Saved';}const menuBtn=card?.querySelector('[data-result-menu]');if(menuBtn)menuBtn.textContent='Edit Result';setTimeout(()=>render(),1600);});

  document.querySelectorAll('[data-toggle-caution]').forEach(el=>el.onclick=async()=>{
    captureWagerDraft();
    const gameId=el.dataset.toggleCaution;
    const wasCautioned=isCautioned(gameId);
    el.disabled=true;
    if(wasCautioned){
      const {error}=await state.sb.from('user_game_flags').delete().eq('user_id',state.user.id).eq('game_id',gameId);
      if(error){el.disabled=false;alert(`Could not remove caution: ${error.message}`);return;}
      state.cautionGameIds=state.cautionGameIds.filter(id=>id!==gameId);
    }else{
      const {error}=await state.sb.from('user_game_flags').upsert({user_id:state.user.id,game_id:gameId,caution:true,updated_at:new Date().toISOString()});
      if(error){el.disabled=false;alert(`Could not save caution: ${error.message}`);return;}
      if(!state.cautionGameIds.includes(gameId))state.cautionGameIds.push(gameId);
    }
    const cautioned=isCautioned(gameId);
    el.classList.toggle('active',cautioned);
    el.textContent=cautioned?'⚠️ Caution Marked':'⚠️ Mark Caution';
    el.disabled=false;
  });

  document.querySelectorAll('[data-export-report]').forEach(el=>el.onclick=()=>{
    const scope=el.dataset.exportReport;
    let value=null;
    if(scope==='week')value=document.getElementById('reportWeekSelect')?.value;
    if(scope==='month')value=document.getElementById('reportMonthSelect')?.value;
    exportReportCSV(scope,value);
  });

  document.querySelectorAll('[data-action="export"]').forEach(el=>el.onclick=exportCSV);

  document.querySelectorAll('[data-save-display-name]').forEach(el=>el.onclick=async()=>{
    const value=document.getElementById('settingsDisplayNameInput')?.value||'';
    const result=await saveDisplayName(value);
    if(!result.ok){alert(result.message);return;}
    alert('Display name saved.');
    render();
  });

  document.querySelectorAll('[data-open-picker-selector]').forEach(el=>el.onclick=()=>{
    captureWagerDraft();
    mountPickerSelectorLocal();
  });

  // If another full-screen render happened while the picker was open,
  // only rebind the picker overlay itself; the game sheet remains untouched
  // during normal picker interactions.
  bindPickerSelectorLocal();

}

function captureParlayDraftInputs(){
  const odds=document.getElementById('parlayOddsInput'),units=document.getElementById('parlayUnitsInput'),who=document.getElementById('parlayWhoInput'),points=document.getElementById('teaserPointsInput');
  if(odds)state.parlayDraft.odds=odds.value.trim();
  if(units)state.parlayDraft.units=units.value;
  if(who)state.parlayDraft.who=who.value;
  if(points)state.parlayDraft.teaserPoints=points.value;
}
function parlayOddsNumber(value){ const cleaned=String(value??'').trim().replace(/\s+/g,''); if(!/^[+-]?\d+$/.test(cleaned))return null; const n=Number(cleaned); return Number.isFinite(n)&&n!==0?n:null; }
function addCurrentSelectionToParlay(){
  captureWagerDraft();
  const g=gameById(state.activeGameId);
  if(!g)return;
  if(!tempKind||!tempSelection){alert('Choose a wager first.');return;}
  if(state.parlayDraft.isTeaser&&tempKind==='Moneyline'){alert('No moneylines in teasers! Cmon!');return;}

  const marketLine=marketLineFor(g,tempKind,tempSelection);
  if(marketLine==null){alert('The selected DraftKings market is unavailable for this game.');return;}

  let sourceLine=null;
  if(tempKind!=='Moneyline'){
    const raw=String(tempLine??'').trim();
    sourceLine=raw===''?marketLine:Number(raw);
    if(!Number.isFinite(sourceLine)){alert('Enter a valid line, or leave the field blank to use the market line.');return;}
  }

  const payout=parlayOddsNumber(tempPayout);
  if(payout==null){alert('Enter a valid Actual Payout, such as -110 or +220.');return;}

  const duplicate=state.parlayDraft.legs.some(l=>l.gameId===g.id&&l.betType===tempKind&&l.selection===tempSelection);
  if(duplicate){alert('That exact leg is already in the current parlay.');return;}

  state.parlayDraft.legs.push({
    id:crypto.randomUUID(),
    gameId:g.id,
    betType:tempKind,
    selection:tempSelection,
    sourceLine,
    odds:payout
  });

  syncParlayEstimate();
  if(!state.parlayDraft.who)state.parlayDraft.who=tempWho||state.displayName||'';
  state.activeGameId=null;
  state.editWagerId=null;
  state.historyChartKind=null;
  tempWho=null;
  resetWagerDraft();
  state.view='slip';
  state.slipTab='parlays';
  render();
}
async function saveCurrentParlay(){
  if(state.parlaySaving)return; captureParlayDraftInputs(); const d=state.parlayDraft;
  if(d.isTeaser&&d.legs.some(l=>l.betType==='Moneyline')){alert('No moneylines in teasers! Cmon!');return;}
  if(d.legs.length<2){alert('A parlay needs at least 2 legs.');return;}
  const units=Number(d.units); if(!Number.isFinite(units)||units<=0){alert('Enter a valid unit amount greater than 0.');return;}
  const odds=parlayOddsNumber(d.odds); if(odds==null){alert('Enter the locked American payout odds, such as +575 or -120.');return;}
  const teaserPoints=Number(d.teaserPoints); if(d.isTeaser&&(!Number.isFinite(teaserPoints)||teaserPoints<=0)){alert('Enter a valid teaser point amount.');return;}
  const who=d.who||state.displayName; if(!who){alert('Choose whose parlay this is.');return;}
  const editing=!!d.id, id=d.id||crypto.randomUUID(), existing=editing?state.parlays.find(p=>p.id===id):null;
  const parent={id,week:state.selectedWeek,who,units,odds,isTeaser:!!d.isTeaser,teaserPoints:d.isTeaser?teaserPoints:null,result:existing?.result||d.result||'Pending'};
  state.parlaySaving=true; render();
  const {error:parentError}=await state.sb.from('parlays').upsert(toDbParlay(parent));
  if(parentError){state.parlaySaving=false;alert(`Could not save parlay: ${parentError.message}`);render();return;}
  const existingLegs=editing?legsForParlay(id):[];
  const existingLegById=new Map(existingLegs.map(l=>[l.id,l]));
  if(editing){const {error:deleteError}=await state.sb.from('parlay_legs').delete().eq('parlay_id',id).eq('user_id',state.user.id);if(deleteError){state.parlaySaving=false;alert(`Could not update parlay legs: ${deleteError.message}`);render();return;}}
  const rows=d.legs.map((leg,i)=>{
    const finalLine=effectiveParlayLegLine(leg,d);
    const previous=existingLegById.get(leg.id);
    const sameLine=(previous?.line==null&&finalLine==null)||(previous?.line!=null&&finalLine!=null&&Math.abs(Number(previous.line)-Number(finalLine))<0.0001);
    const sameGradeDefinition=!!previous
      && previous.gameId===leg.gameId
      && previous.betType===leg.betType
      && previous.selection===leg.selection
      && sameLine;
    const preservedResult=sameGradeDefinition?(previous.result||'Pending'):'Pending';
    return toDbParlayLeg(leg,id,i+1,finalLine,preservedResult);
  });
  const {data:legData,error:legsError}=await state.sb.from('parlay_legs').insert(rows).select('*');
  if(legsError){if(!editing)await state.sb.from('parlays').delete().eq('id',id).eq('user_id',state.user.id);state.parlaySaving=false;alert(`Could not save parlay legs: ${legsError.message}`);render();return;}
  if(editing)state.parlays[state.parlays.findIndex(p=>p.id===id)]=parent; else state.parlays.push(parent);
  state.parlayLegs=state.parlayLegs.filter(l=>l.parlayId!==id).concat((legData||[]).map(fromDbParlayLeg));
  resetParlayDraft(); state.parlaySaving=false; render();
}
function editParlay(id){
  const p=state.parlays.find(x=>x.id===id); if(!p)return; const legs=legsForParlay(id);
  state.parlayDraft={id:p.id,legs:legs.map(l=>({id:l.id,gameId:l.gameId,betType:l.betType,selection:l.selection,sourceLine:l.sourceLine,odds:l.odds??-110,result:l.result||'Pending'})),who:p.who,units:p.units,odds:formatAmericanOdds(p.odds),isTeaser:p.isTeaser,teaserPoints:p.teaserPoints??6,result:p.result}; state.slipTab='parlays'; render();
}
async function removeParlay(id){ if(!confirm('Remove this parlay?'))return; const {error}=await state.sb.from('parlays').delete().eq('id',id).eq('user_id',state.user.id); if(error){alert(`Could not remove parlay: ${error.message}`);return;} state.parlays=state.parlays.filter(p=>p.id!==id); state.parlayLegs=state.parlayLegs.filter(l=>l.parlayId!==id); if(state.parlayDraft.id===id)resetParlayDraft(); render(); }
async function setParlayResult(id,result){ const {error}=await state.sb.from('parlays').update({result,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',state.user.id); if(error){alert(`Could not update parlay result: ${error.message}`);return;} const p=state.parlays.find(x=>x.id===id); if(p)p.result=result; render(); }

async function saveCurrentWager(){
  if(state.saving)return;
  captureWagerDraft();

  const g=gameById(state.activeGameId);
  const editing=state.editWagerId?state.wagers.find(w=>w.id===state.editWagerId):null;
  const rawLine=String(tempLine??'').trim();
  const units=Number(tempUnits||1);
  const who=(tempWho||document.getElementById('whoInput').value||state.displayName);

  if(!tempKind||!tempSelection){alert('Choose a wager first.');return;}

  const marketLine=marketLineFor(g,tempKind,tempSelection);
  if(marketLine==null){alert('The selected DraftKings market is unavailable for this game.');return;}

  const finalLine=rawLine===''?marketLine:Number(rawLine);
  if(Number.isNaN(finalLine)){alert('Enter a valid Actual Line, or leave it blank to use the market.');return;}

  const payoutOdds=parlayOddsNumber(tempPayout);
  if(payoutOdds==null){alert('Enter a valid Actual Payout, such as -110 or +220.');return;}

  if(!Number.isFinite(units)||units<=0){alert('Enter a valid unit amount greater than 0.');return;}

  const pick=tempKind==='Spread'
    ? `${tempSelection} ${signed(finalLine)}`
    : tempKind==='Moneyline'
      ? `${tempSelection} ML`
      : `${tempSelection} ${finalLine}`;

  const obj={
    id:state.editWagerId||crypto.randomUUID(),
    gameId:g.id,
    betType:tempKind,
    selection:tempSelection,
    line:finalLine,
    payoutOdds,
    units,
    who,
    pick,
    result:editing?.result||'Pending',
    marketSpread:g.spread,
    marketTotal:g.total,
    marketMoneyline:tempKind==='Moneyline'?marketLine:null
  };

  const saveBtn=document.querySelector('[data-save-wager]');
  const originalText=saveBtn?.textContent||'Confirm Bet';
  state.saving=true;
  if(saveBtn){
    saveBtn.disabled=true;
    saveBtn.classList.add('saved-confirmation');
    saveBtn.textContent='Saving…';
  }

  const {error}=await state.sb.from('wagers').upsert(toDbWager(obj));
  if(error){
    state.saving=false;
    if(saveBtn){
      saveBtn.disabled=false;
      saveBtn.classList.remove('saved-confirmation');
      saveBtn.textContent=originalText;
    }
    alert(`Could not save pick: ${error.message}`);
    return;
  }

  if(editing)state.wagers[state.wagers.findIndex(w=>w.id===obj.id)]=obj;
  else state.wagers.push(obj);

  if(saveBtn){
    saveBtn.textContent='✓ Saved';
    saveBtn.classList.add('saved-confirmation');
  }

  setTimeout(()=>{
    state.activeGameId=null;
    state.editWagerId=null;
    tempWho=null;
    resetWagerDraft();
    state.saving=false;
    render();
  },2200);
}
async function removeWager(id){ const {error}=await state.sb.from('wagers').delete().eq('id',id).eq('user_id',state.user.id);if(error){alert(`Could not remove pick: ${error.message}`);return;}state.wagers=state.wagers.filter(w=>w.id!==id);if(state.editWagerId===id)state.editWagerId=null;render(); }
async function setResult(id,result){ const {error}=await state.sb.from('wagers').update({result,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',state.user.id);if(error){alert(`Could not update result: ${error.message}`);return;}const w=state.wagers.find(x=>x.id===id);if(w)w.result=result;render(); }

async function loadSelectedWeek(){
  if(!state.isAdmin){alert('Only the admin account can load or refresh the weekly board.');return;}
  if(!state.apiKey){state.showSettings=true;state.importMessage='Add your Odds API key first.';render();return;}
  const win=WEEK_WINDOWS[state.selectedWeek];
  if(!win){state.importMessage='Live imports currently support Weeks 4–12.';render();return;}

  state.loadingWeek=true;
  state.importMessage='';
  render();

  try{
    const results=await Promise.allSettled(
      ['americanfootball_ncaaf','americanfootball_ncaaf_fcs'].map(k=>fetchOdds(k,win))
    );

    const events=[],errors=[],usageSnapshots=[];
    let lastPullCost=0;

    for(const r of results){
      if(r.status==='fulfilled'){
        events.push(...r.value.events);
        if(r.value.usage){
          usageSnapshots.push(r.value.usage);
          if(Number.isFinite(r.value.usage.last)) lastPullCost+=r.value.usage.last;
        }
      }else{
        errors.push(r.reason?.message||'Unknown import error');
      }
    }

    if(usageSnapshots.length){
      const latest=usageSnapshots.reduce((best,u)=>{
        if(!best) return u;
        if(Number.isFinite(u.used) && (!Number.isFinite(best.used) || u.used>best.used)) return u;
        return best;
      },null);

      if(latest && Number.isFinite(latest.used) && Number.isFinite(latest.remaining)){
        state.apiUsage={
          used:latest.used,
          remaining:latest.remaining,
          lastPullCost,
          updatedAt:new Date().toISOString()
        };
        localStorage.setItem(STORAGE.apiUsage,JSON.stringify(state.apiUsage));
      }
    }

    if(!events.length&&errors.length)throw new Error(errors.join(' | '));

    const parsed=dedupeEvents(events.map(e=>parseOddsEvent(e,state.selectedWeek)).filter(Boolean));
    if(!parsed.length)throw new Error('No games returned for this week.');

    const {error:upsertError}=await state.sb.from('games').upsert(parsed.map(toDbGame));
    if(upsertError)throw upsertError;

    const capturedAt=new Date().toISOString();
    const historyRows=parsed.filter(g=>hasSpread(g)||hasTotal(g)).map(g=>toDbOddsSnapshot(g,capturedAt));
    if(historyRows.length){
      const {data:historyData,error:historyError}=await state.sb.from('game_odds_history').insert(historyRows).select('*');
      if(!historyError) state.oddsHistory=state.oddsHistory.concat((historyData||[]).map(fromDbOddsSnapshot));
      else console.warn('Odds history snapshot was not saved:',historyError.message);
    }

    const existing=state.games.filter(g=>g.week!==state.selectedWeek);
    state.games=existing.concat(parsed);

    const missingSpread=parsed.filter(g=>!hasSpread(g)).length,
          missingTotal=parsed.filter(g=>!hasTotal(g)).length,
          complete=parsed.filter(g=>hasSpread(g)&&hasTotal(g)).length;

    state.importMessage=`Loaded ${parsed.length} games · ${complete} with spread + total · ${missingSpread} missing spread · ${missingTotal} missing total.${errors.length?' One source returned an error, so this may be a partial slate.':''}`;
  }catch(err){
    state.importMessage=`Import failed: ${friendlyError(err)}`;
  }finally{
    state.loadingWeek=false;
    render();
  }
}

async function fetchOdds(sportKey,win){
  const params=new URLSearchParams({
    apiKey:state.apiKey,
    bookmakers:'draftkings',
    markets:'spreads,totals',
    oddsFormat:'american',
    dateFormat:'iso',
    commenceTimeFrom:win.start,
    commenceTimeTo:win.end
  });

  const res=await fetch(`https://api.the-odds-api.com/v4/sports/${sportKey}/odds?${params.toString()}`);

  const headerNumber=(name)=>{
    const raw=res.headers.get(name);
    if(raw==null||raw==='') return null;
    const n=Number(raw);
    return Number.isFinite(n)?n:null;
  };

  const usage={
    used:headerNumber('x-requests-used'),
    remaining:headerNumber('x-requests-remaining'),
    last:headerNumber('x-requests-last')
  };

  let body;
  try{body=await res.json()}catch(_){body=null}

  if(!res.ok)throw new Error(`${sportKey}: ${body?.message||body?.error_code||`HTTP ${res.status}`}`);

  return {
    events:Array.isArray(body)?body:[],
    usage
  };
}

function parseOddsEvent(e,week){if(!e?.id||!e.home_team||!e.away_team)return null;const dk=(e.bookmakers||[]).find(b=>b.key==='draftkings')||(e.bookmakers||[])[0];let spread=null,spreadTeam=null,total=null,updated=dk?.last_update||null;if(dk){const sm=(dk.markets||[]).find(m=>m.key==='spreads'),tm=(dk.markets||[]).find(m=>m.key==='totals');if(sm){const outcomes=sm.outcomes||[],fav=outcomes.find(o=>Number(o.point)<0),pick=fav||outcomes.find(o=>o.name===e.home_team)||outcomes[0];if(pick?.point!=null){spreadTeam=pick.name;spread=Number(pick.point)}updated=sm.last_update||updated;}if(tm){const over=(tm.outcomes||[]).find(o=>String(o.name).toLowerCase()==='over')||(tm.outcomes||[])[0];if(over?.point!=null)total=Number(over.point);updated=tm.last_update||updated;}}return{id:`odds-${e.id}`,sourceEventId:e.id,sourceSportKey:e.sport_key,week,away:e.away_team,home:e.home_team,spreadTeam,total,spread,commenceTime:e.commence_time,marketUpdatedAt:updated,tv:'',location:''};}
function dedupeEvents(games){const map=new Map();games.forEach(g=>{const key=`${g.away.toLowerCase()}|${g.home.toLowerCase()}|${g.commenceTime}`;if(!map.has(key))map.set(key,g);else{const p=map.get(key),ps=(hasSpread(p)?1:0)+(hasTotal(p)?1:0),ns=(hasSpread(g)?1:0)+(hasTotal(g)?1:0);if(ns>ps)map.set(key,g)}});return[...map.values()];}
function friendlyError(err){const msg=err?.message||String(err);if(/401|unauthorized|api key/i.test(msg))return'The Odds API key was rejected. Check Settings and try again.';if(/429|quota|usage/i.test(msg))return'The Odds API request limit appears to have been reached.';if(/Failed to fetch|NetworkError/i.test(msg))return'The browser could not reach the data service. Check your connection and try again.';return msg;}


const TRACKPICKS_IMPORT_HEADERS=[
  'Week','Ticket ID','Ticket Type','Leg #','Matchup','Bet Type','Source Line','Line/Total',
  'Payout Odds','Ticket Payout Odds','Who','Pick','Units','Result','Ticket Result','Caution','DDL'
];

function importCell(v){return String(v??'').trim();}
function importKey(v){return importCell(v).toLowerCase().replace(/[^a-z0-9]+/g,'');}
function parseImportNumber(v){
  const raw=importCell(v);
  if(!raw)return null;

  const direct=Number(raw.replace(/^\+/,''));
  if(Number.isFinite(direct))return direct;

  // Accept human-readable line values such as "TCU -8.5",
  // "Over 52.5", or "Louisville +4.5".
  const matches=raw.match(/[+-]?(?:\d+(?:\.\d+)?|\.\d+)/g);
  if(!matches?.length)return null;
  const n=Number(matches[matches.length-1]);
  return Number.isFinite(n)?n:null;
}
function parseImportResult(v){
  const s=importCell(v);
  if(!s)return '';
  const map={pending:'Pending',win:'Win',loss:'Loss',push:'Push',ddl:'DDL'};
  return map[s.toLowerCase()]||null;
}
function parseImportYesNo(v){
  const s=importCell(v).toLowerCase();
  if(!s)return false;
  if(['yes','y','true','1','no','n','false','0'].includes(s))return ['yes','y','true','1'].includes(s);
  return null;
}
function normalizeImportedBetType(v){
  const s=importCell(v).toLowerCase();
  if(s==='spread')return'Spread';
  if(s==='total'||s==='totals')return'Total';
  if(s==='moneyline'||s==='money line'||s==='ml')return'Moneyline';
  return null;
}
function normalizeImportedTicketType(v,betType){
  const s=importCell(v).toLowerCase();
  if(!s && ['Spread','Total','Moneyline'].includes(betType))return'Straight'; // legacy CSV
  if(s==='straight'||s==='single')return'Straight';
  if(s==='parlay')return'Parlay';
  if(s==='teaser')return'Teaser';
  return null;
}
function importMatchupSides(matchup){
  const raw=importCell(matchup).replace(/\r/g,'').trim();
  let parts=[];
  if(raw.includes('\n'))parts=raw.split(/\n+/);
  else if(/\s+@\s+/.test(raw))parts=raw.split(/\s+@\s+/);
  else if(/\s+at\s+/i.test(raw))parts=raw.split(/\s+at\s+/i);
  parts=parts.map(s=>s.trim()).filter(Boolean);
  if(parts.length!==2)return null;
  const away=resolveEspnTeamName(parts[0])||parts[0];
  const home=resolveEspnTeamName(parts[1])||parts[1];
  return {away,home};
}
function historicalGameId(week,away,home){
  const source=`2026|${week}|${normalizeTeamName(away)}|${normalizeTeamName(home)}`;
  let h=2166136261;
  for(let i=0;i<source.length;i++){
    h^=source.charCodeAt(i);
    h=Math.imul(h,16777619);
  }
  return `hist-2026-w${week}-${(h>>>0).toString(16).padStart(8,'0')}`;
}
function importedGameFor(week,matchup){
  const sides=importMatchupSides(matchup);
  if(!sides)return null;
  const clean=s=>String(s||'').toLowerCase().replace(/\s+/g,' ').replace(/[’']/g,"'").trim();
  const candidates=state.games.filter(g=>Number(g.week)===Number(week));
  const hit=candidates.find(g=>clean(g.away)===clean(sides.away)&&clean(g.home)===clean(sides.home));
  if(hit)return hit;

  // Weeks 0–3 predate TrackPicks' live board. Create a deterministic historical
  // game shell so imported wagers/legs can retain week + matchup relationships.
  if(Number(week)>=0&&Number(week)<=3){
    return {
      id:historicalGameId(week,sides.away,sides.home),
      sourceEventId:null,
      sourceSportKey:'historical_import',
      week:Number(week),
      away:sides.away,
      home:sides.home,
      spreadTeam:null,
      spread:null,
      total:null,
      commenceTime:WEEK_WINDOWS[week]?.start||null,
      marketUpdatedAt:null,
      tv:'',
      location:'',
      historicalImport:true
    };
  }
  return null;
}
function importedSelection(game,betType,pick){
  const p=importCell(pick);
  const low=p.toLowerCase();
  if(betType==='Total'){
    if(/^over\b/i.test(p))return'Over';
    if(/^under\b/i.test(p))return'Under';
    return null;
  }
  const teams=[game.away,game.home].sort((a,b)=>b.length-a.length);
  for(const team of teams){
    const t=team.toLowerCase();
    if(low===t||low.startsWith(`${t} `)||low.startsWith(`${t}+`)||low.startsWith(`${t}-`))return team;
  }
  return null;
}
function csvTextToMatrix(text){
  const rows=[];let row=[],field='',quoted=false;
  const s=String(text||'').replace(/^\uFEFF/,'');
  for(let i=0;i<s.length;i++){
    const ch=s[i];
    if(quoted){
      if(ch==='"'&&s[i+1]==='"'){field+='"';i++;}
      else if(ch==='"')quoted=false;
      else field+=ch;
    }else{
      if(ch==='"')quoted=true;
      else if(ch===','){row.push(field);field='';}
      else if(ch==='\n'){row.push(field);rows.push(row);row=[];field='';}
      else if(ch!=='\r')field+=ch;
    }
  }
  row.push(field);
  if(row.some(v=>String(v).trim())||rows.length===0)rows.push(row);
  return rows;
}
async function readHistoryImportFile(file){
  const lower=String(file?.name||'').toLowerCase();
  if(lower.endsWith('.csv')){
    return csvTextToMatrix(await file.text());
  }
  if(lower.endsWith('.xlsx')){
    if(!window.XLSX)throw new Error('The XLSX reader did not load. Check your connection and try again.');
    const buffer=await file.arrayBuffer();
    const wb=window.XLSX.read(buffer,{type:'array'});
    const sheet=wb.Sheets['Import Data']||wb.Sheets[wb.SheetNames[0]];
    return window.XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false});
  }
  throw new Error('Choose a .csv or .xlsx TrackPicks import file.');
}
function matrixToImportObjects(matrix){
  const rows=(matrix||[]).filter(r=>Array.isArray(r)&&r.some(v=>importCell(v)));
  if(rows.length<2)return{rows:[],legacy:false,errors:['The file has no data rows.']};
  const headers=rows[0].map(importKey);
  const idx={};
  headers.forEach((h,i)=>{if(h)idx[h]=i;});
  const get=(r,name)=>r[idx[importKey(name)]]??'';
  const legacy=!('ticketid' in idx)&&!('tickettype' in idx);
  const requiredLegacy=['Week','Matchup','Bet Type','Line/Total','Payout Odds','Who','Pick','Units','Result'];
  const requiredNew=['Week','Ticket Type','Matchup','Bet Type','Line/Total','Pick','Units'];
  const missing=(legacy?requiredLegacy:requiredNew).filter(h=>!(importKey(h) in idx));
  if(missing.length)return{rows:[],legacy,errors:[`Missing required column(s): ${missing.join(', ')}`]};
  return{
    legacy,
    errors:[],
    rows:rows.slice(1).filter(r=>r.some(v=>importCell(v))).map((r,i)=>({
      rowNumber:i+2,
      week:get(r,'Week'),
      ticketId:get(r,'Ticket ID'),
      ticketType:get(r,'Ticket Type'),
      legNumber:get(r,'Leg #'),
      matchup:get(r,'Matchup'),
      betType:get(r,'Bet Type'),
      sourceLine:get(r,'Source Line'),
      line:get(r,'Line/Total'),
      payoutOdds:get(r,'Payout Odds'),
      ticketPayoutOdds:get(r,'Ticket Payout Odds'),
      who:get(r,'Who'),
      pick:get(r,'Pick'),
      units:get(r,'Units'),
      result:get(r,'Result'),
      ticketResult:get(r,'Ticket Result'),
      caution:get(r,'Caution'),
      ddl:get(r,'DDL')
    }))
  };
}
function prepareHistoryImport(parsed){
  const errors=[...(parsed.errors||[])];
  const straight=[];
  const multiGroups=new Map();
  const cautions=new Set();
  const newGames=new Map();
  const activeUser=state.displayName||state.user?.email||'';
  if(!activeUser)errors.push('Your account needs a display name before importing.');

  for(const raw of parsed.rows||[]){
    const prefix=`Row ${raw.rowNumber}`;
    const week=Number(raw.week);
    if(!Number.isInteger(week)||week<0||week>12){errors.push(`${prefix}: Week must be 0–12.`);continue;}

    const betType=normalizeImportedBetType(raw.betType);
    if(!betType){errors.push(`${prefix}: Bet Type must be Spread, Total, or Moneyline.`);continue;}

    const ticketType=normalizeImportedTicketType(raw.ticketType,betType);
    if(!ticketType){errors.push(`${prefix}: Ticket Type must be Straight, Parlay, or Teaser.`);continue;}
    if(parsed.legacy&&ticketType!=='Straight'){
      errors.push(`${prefix}: legacy parlay/teaser rows cannot be rebuilt because they do not contain individual legs. Export with V2.1.2+ first.`);
      continue;
    }

    const game=importedGameFor(week,raw.matchup);
    if(!game){
      const suffix=week<=3?' could not be parsed as Away @ Home.':' was not found in the TrackPicks Week '+week+' board.';
      errors.push(`${prefix}: matchup "${importCell(raw.matchup)}"${suffix}`);
      continue;
    }
    if(game.historicalImport)newGames.set(game.id,game);

    const selection=importedSelection(game,betType,raw.pick);
    if(!selection){errors.push(`${prefix}: Pick "${importCell(raw.pick)}" does not identify a valid ${betType} selection for ${game.away} @ ${game.home}.`);continue;}

    const line=parseImportNumber(raw.line);
    if(line==null&&betType!=='Moneyline'){errors.push(`${prefix}: Line/Total is required for ${betType}.`);continue;}

    let payout=parseImportNumber(raw.payoutOdds);
    if(payout==null&&(betType==='Spread'||betType==='Total'))payout=-110;
    if(payout==null&&betType==='Moneyline'){errors.push(`${prefix}: Moneyline Payout Odds cannot be blank.`);continue;}

    const units=parseImportNumber(raw.units);
    if(units==null||units<=0){errors.push(`${prefix}: Units must be greater than 0.`);continue;}

    const caution=parseImportYesNo(raw.caution);
    const ddl=parseImportYesNo(raw.ddl);
    if(caution==null){errors.push(`${prefix}: Caution must be Yes, No, or blank.`);continue;}
    if(ddl==null){errors.push(`${prefix}: DDL must be Yes, No, or blank.`);continue;}

    let result=parseImportResult(raw.result);
    let ticketResult=parseImportResult(raw.ticketResult);
    if(result===null){errors.push(`${prefix}: Result is not valid.`);continue;}
    if(ticketResult===null){errors.push(`${prefix}: Ticket Result is not valid.`);continue;}
    if(ddl===true)result='DDL';

    const who=importCell(raw.who)||activeUser;
    const sourceLine=parseImportNumber(raw.sourceLine);
    const ticketPayout=parseImportNumber(raw.ticketPayoutOdds);

    if(ticketType==='Straight'){
      if(result&&ticketResult&&result!==ticketResult){
        errors.push(`${prefix}: Result and Ticket Result conflict for a Straight bet.`);
        continue;
      }
      let finalResult=result||ticketResult||'Pending';
      if(ddl===true)finalResult='DDL';
      const finalLine=line==null?payout:line;
      const marketSpread=betType==='Spread'?game.spread:null;
      const marketTotal=betType==='Total'?game.total:null;
      straight.push({
        id:crypto.randomUUID(),gameId:game.id,betType,selection,line:finalLine,payoutOdds:payout,
        units,who,pick:importCell(raw.pick),result:finalResult,
        marketSpread,marketTotal,marketMoneyline:betType==='Moneyline'?finalLine:null
      });
      if(caution)cautions.add(game.id);
      continue;
    }

    const ticketId=importCell(raw.ticketId);
    if(!ticketId){errors.push(`${prefix}: Ticket ID is required for ${ticketType}.`);continue;}
    if(ticketType==='Teaser'&&betType==='Moneyline'){errors.push(`${prefix}: Moneyline legs are not allowed in teasers.`);continue;}
    if(ticketPayout==null){errors.push(`${prefix}: Ticket Payout Odds is required for ${ticketType}.`);continue;}
    if(ticketType==='Teaser'&&sourceLine==null){errors.push(`${prefix}: Source Line is required for teaser legs.`);continue;}

    const key=`${week}|${ticketId}`;
    if(!multiGroups.has(key))multiGroups.set(key,{
      key,externalId:ticketId,week,ticketType,who,units,ticketPayout,
      ticketResult:ticketResult||'',legs:[],cautionIds:new Set()
    });
    const group=multiGroups.get(key);
    const conflicts=[
      ['Ticket Type',group.ticketType,ticketType],
      ['Who',group.who,who],
      ['Units',String(group.units),String(units)],
      ['Ticket Payout Odds',String(group.ticketPayout),String(ticketPayout)]
    ];
    for(const [field,a,b] of conflicts){
      if(a!==b)errors.push(`${prefix}: ${field} conflicts with another row for Ticket ID "${ticketId}".`);
    }
    if(ticketResult){
      if(group.ticketResult&&group.ticketResult!==ticketResult)errors.push(`${prefix}: Ticket Result conflicts with another row for Ticket ID "${ticketId}".`);
      else group.ticketResult=ticketResult;
    }

    group.legs.push({
      rowNumber:raw.rowNumber,
      legNumber:parseImportNumber(raw.legNumber),
      gameId:game.id,betType,selection,
      sourceLine:sourceLine==null?line:sourceLine,
      line:line==null?payout:line,
      odds:payout,pick:importCell(raw.pick),result:result||'Pending'
    });
    if(caution)group.cautionIds.add(game.id);
  }

  for(const group of multiGroups.values()){
    const legNums=group.legs.map(l=>l.legNumber).filter(v=>v!=null);
    if(legNums.length&&legNums.length!==group.legs.length)errors.push(`Ticket ${group.externalId}: either fill Leg # for every leg or leave it blank for every leg.`);
    if(legNums.length&&new Set(legNums).size!==legNums.length)errors.push(`Ticket ${group.externalId}: Leg # values must be unique.`);
    group.legs.sort((a,b)=>(a.legNumber??999)-(b.legNumber??999)||a.rowNumber-b.rowNumber);
    if(!group.ticketResult){
      const results=group.legs.map(l=>l.result||'Pending');
      if(results.some(r=>r==='Loss'||r==='DDL'))group.ticketResult='Loss';
      else if(results.length&&results.every(r=>r==='Win'))group.ticketResult='Win';
      else group.ticketResult='Pending';
    }
    if(group.ticketType==='Teaser'){
      const diffs=group.legs
        .filter(l=>l.sourceLine!=null&&l.line!=null)
        .map(l=>Math.abs(Number(l.line)-Number(l.sourceLine)))
        .filter(v=>Number.isFinite(v)&&v>0.0001);
      if(!diffs.length)errors.push(`Ticket ${group.externalId}: teaser points could not be derived from Source Line and Line/Total.`);
      else{
        const rounded=diffs.map(v=>Number(v.toFixed(4)));
        const first=rounded[0];
        if(rounded.some(v=>Math.abs(v-first)>0.0001))errors.push(`Ticket ${group.externalId}: teaser leg adjustments do not match.`);
        group.teaserPoints=first;
      }
    }else group.teaserPoints=null;
    for(const id of group.cautionIds)cautions.add(id);
  }

  return{errors,straight,multi:[...multiGroups.values()],cautions:[...cautions],newGames:[...newGames.values()]};
}
async function commitHistoryImport(plan,fileName=''){
  if(plan.errors.length)throw new Error('Import validation failed.');
  if(!state.sb||!state.user)throw new Error('You must be signed in to import data.');

  const batchId=crypto.randomUUID();
  const batchRow={
    id:batchId,
    user_id:state.user.id,
    file_name:importCell(fileName)||null,
    straight_count:plan.straight.length,
    multi_ticket_count:plan.multi.length,
    leg_count:plan.multi.reduce((n,g)=>n+g.legs.length,0)
  };

  const {error:batchError}=await state.sb.from('import_batches').insert(batchRow);
  if(batchError)throw new Error(`Import batch: ${batchError.message}`);

  try{
    for(const g of plan.newGames||[]){
      const {error}=await state.sb.rpc('trackpicks_upsert_historical_game',{
        p_week:Number(g.week),
        p_away:g.away,
        p_home:g.home,
        p_game_id:g.id,
        p_commence_time:g.commenceTime
      });
      if(error)throw new Error(`Historical game ${g.away} @ ${g.home}: ${error.message}`);
    }

    if(plan.straight.length){
      const {error}=await state.sb.from('wagers').insert(
        plan.straight.map(w=>toDbWager({...w,importBatchId:batchId}))
      );
      if(error)throw new Error(`Straight bets: ${error.message}`);
    }

    for(const group of plan.multi){
      const parlayId=crypto.randomUUID();
      const parent={
        id:parlayId,week:group.week,who:group.who,units:group.units,odds:group.ticketPayout,
        isTeaser:group.ticketType==='Teaser',teaserPoints:group.teaserPoints,
        result:group.ticketResult||'Pending',importBatchId:batchId
      };
      const {error:parentError}=await state.sb.from('parlays').insert(toDbParlay(parent));
      if(parentError)throw new Error(`Ticket ${group.externalId}: ${parentError.message}`);

      const rows=group.legs.map((leg,i)=>toDbParlayLeg({
        id:crypto.randomUUID(),gameId:leg.gameId,betType:leg.betType,selection:leg.selection,
        sourceLine:leg.sourceLine,odds:leg.odds
      },parlayId,i+1,leg.line,leg.result));
      const {error:legError}=await state.sb.from('parlay_legs').insert(rows);
      if(legError)throw new Error(`Ticket ${group.externalId} legs: ${legError.message}`);
    }

    if(plan.cautions.length){
      const rows=plan.cautions.map(gameId=>({
        user_id:state.user.id,game_id:gameId,caution:true,updated_at:new Date().toISOString()
      }));
      const {error}=await state.sb.from('user_game_flags').upsert(rows);
      if(error)throw new Error(`Caution flags: ${error.message}`);
    }

    return batchId;
  }catch(err){
    // Everything created by this upload is tagged with the same batch ID,
    // so a failed import can clean itself up safely.
    await state.sb.from('parlays').delete().eq('user_id',state.user.id).eq('import_batch_id',batchId);
    await state.sb.from('wagers').delete().eq('user_id',state.user.id).eq('import_batch_id',batchId);
    await state.sb.from('import_batches').delete().eq('user_id',state.user.id).eq('id',batchId);
    throw err;
  }
}
async function importHistoryFile(file){
  if(!file)return;
  state.importMessage=`Checking ${file.name}…`;render();
  try{
    const matrix=await readHistoryImportFile(file);
    const parsed=matrixToImportObjects(matrix);
    const plan=prepareHistoryImport(parsed);
    if(plan.errors.length){
      const shown=plan.errors.slice(0,12);
      const extra=plan.errors.length-shown.length;
      state.importMessage=`Import blocked: ${plan.errors.length} issue${plan.errors.length===1?'':'s'} found.`;
      alert(`Nothing was imported. Fix these issues first:\n\n${shown.join('\n')}${extra>0?`\n\n…and ${extra} more.`:''}`);
      render();
      return;
    }
    const count=plan.straight.length+plan.multi.length;
    const legCount=plan.multi.reduce((n,g)=>n+g.legs.length,0);
    if(!count){state.importMessage='No importable picks were found.';render();return;}
    const historicalCount=(plan.newGames||[]).length;
    const historicalNote=historicalCount?`\n${historicalCount} historical Week 0–3 matchup${historicalCount===1?'':'s'} will be linked for analytics.`:'';
    const ok=confirm(`Import ${plan.straight.length} straight bet${plan.straight.length===1?'':'s'} and ${plan.multi.length} parlay/teaser ticket${plan.multi.length===1?'':'s'} (${legCount} legs)?${historicalNote}`);
    if(!ok){state.importMessage='Import canceled. No data was changed.';render();return;}
    const batchId=await commitHistoryImport(plan,file.name);
    await syncFromCloud();
    state.importMessage=`Imported ${plan.straight.length} straight bet${plan.straight.length===1?'':'s'} and ${plan.multi.length} parlay/teaser ticket${plan.multi.length===1?'':'s'} successfully. Batch ${batchId.slice(0,8)}.`;
    render();
  }catch(err){
    state.importMessage=`Import failed: ${err.message||err}`;
    alert(state.importMessage);
    render();
  }
}

function formatImportTimestamp(value){
  if(!value)return'Unknown time';
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return'Unknown time';
  return new Intl.DateTimeFormat(undefined,{
    month:'short',day:'numeric',year:'numeric',
    hour:'numeric',minute:'2-digit'
  }).format(d);
}
function importBatchTypeCounts(batchId){
  const tickets=state.parlays.filter(p=>p.importBatchId===batchId);
  return {
    parlays:tickets.filter(p=>!p.isTeaser).length,
    teasers:tickets.filter(p=>p.isTeaser).length
  };
}
async function loadImportBatches(){
  if(!state.sb||!state.user)return;
  state.importManagerLoading=true;
  render();
  const {data,error}=await state.sb
    .from('import_batches')
    .select('id,file_name,straight_count,multi_ticket_count,leg_count,created_at')
    .eq('user_id',state.user.id)
    .order('created_at',{ascending:false});
  state.importManagerLoading=false;
  if(error){
    state.importBatches=[];
    alert(`Could not load imports: ${error.message}`);
    render();
    return;
  }
  state.importBatches=data||[];
  render();
}
function renderImportManager(){
  const rows=state.importBatches||[];
  const body=state.importManagerLoading
    ? `<div class="dashboard-empty">Loading imports…</div>`
    : !rows.length
      ? `<div class="dashboard-empty">No imports found for this account.</div>`
      : `<div class="import-history-list">${rows.map(b=>{
          const counts=importBatchTypeCounts(b.id);
          const chips=[
            `${Number(b.straight_count)||0} Straight`,
            `${counts.parlays} Parlay${counts.parlays===1?'':'s'}`,
            `${counts.teasers} Teaser${counts.teasers===1?'':'s'}`,
            `${Number(b.leg_count)||0} Leg${Number(b.leg_count)===1?'':'s'}`
          ];
          const deleting=state.deletingImportBatchId===b.id;
          return `<article class="import-history-card">
            <div class="import-history-main">
              <div class="import-history-file">${escapeAttr(b.file_name||'Imported data')}</div>
              <div class="import-history-time">${escapeAttr(formatImportTimestamp(b.created_at))}</div>
              <div class="import-history-chips">
                ${chips.map(x=>`<span class="import-chip">${escapeAttr(x)}</span>`).join('')}
              </div>
            </div>
            <div class="import-history-actions">
              <button type="button" class="danger-outline import-delete-btn" data-delete-import="${b.id}" ${deleting?'disabled':''}>${deleting?'Deleting…':'Delete'}</button>
            </div>
          </article>`;
        }).join('')}</div>`;

  return `<div class="overlay import-manager-overlay">
    <section class="sheet import-manager-sheet">
      <div class="sheet-handle"></div>
      <div class="close-row import-manager-header">
        <div>
          <h2 style="margin:0">Manage Imports</h2>
          <div class="detail-meta">Review and remove previous uploads.</div>
        </div>
        <button class="icon-btn" data-close-import-manager>✕</button>
      </div>
      ${body}
      <div class="import-manager-note">Deleting an import removes only the straight wagers, parlays, teasers, and legs created by that upload. Other picks are left alone.</div>
    </section>
  </div>`;
}
async function deleteImportBatch(batchId){
  if(!batchId||state.deletingImportBatchId)return;
  const batch=state.importBatches.find(b=>b.id===batchId);
  if(!batch)return;

  const counts=importBatchTypeCounts(batchId);
  const summary=[
    `${Number(batch.straight_count)||0} straight`,
    `${counts.parlays} parlay${counts.parlays===1?'':'s'}`,
    `${counts.teasers} teaser${counts.teasers===1?'':'s'}`
  ].join(', ');

  if(!confirm(`Delete "${batch.file_name||'this import'}"?\n\nUploaded ${formatImportTimestamp(batch.created_at)}\n${summary}\n\nThis cannot be undone.`))return;

  state.deletingImportBatchId=batchId;
  render();

  const {data,error}=await state.sb.rpc('trackpicks_delete_import_batch',{p_batch_id:batchId});
  if(error){
    state.deletingImportBatchId=null;
    alert(`Could not delete import: ${error.message}`);
    render();
    return;
  }

  await syncFromCloud();
  state.importBatches=state.importBatches.filter(b=>b.id!==batchId);
  state.deletingImportBatchId=null;
  state.importMessage=`Deleted import ${batch.file_name||batchId.slice(0,8)}.`;
  render();
}
async function openImportManager(){
  state.showImportManager=true;
  state.importBatches=[];
  render();
  await loadImportBatches();
}

function downloadImportTemplate(){
  const a=document.createElement('a');
  a.href=`TrackPicks_Import_Template.xlsx?v=${BUILD_VERSION}`;
  a.download='TrackPicks_Import_Template.xlsx';
  document.body.appendChild(a);a.click();a.remove();
}


function gradedParlaysForWeek(week){ return weekParlays(week).filter(p=>isGradedResult(p.result)); }
function csvRowsForWagers(wagers,parlays=[]){
  const rows=[TRACKPICKS_IMPORT_HEADERS];
  wagers.forEach(w=>{
    const g=gameById(w.gameId);
    if(!g)return;
    rows.push([
      g.week,
      w.id,
      'Straight',
      '',
      `${g.away} @ ${g.home}`,
      w.betType,
      w.line,
      w.line,
      formatAmericanOdds(w.payoutOdds),
      formatAmericanOdds(w.payoutOdds),
      w.who,
      w.pick,
      Number(w.units),
      w.result||'Pending',
      w.result||'Pending',
      isCautioned(g.id)?'Yes':'',
      isDDLResult(w.result)?'Yes':''
    ]);
  });
  parlays.forEach(p=>{
    const legs=legsForParlay(p.id).sort((a,b)=>a.legOrder-b.legOrder);
    legs.forEach((l,i)=>{
      const g=gameById(l.gameId);
      if(!g)return;
      rows.push([
        p.week,
        p.id,
        p.isTeaser?'Teaser':'Parlay',
        i+1,
        `${g.away} @ ${g.home}`,
        l.betType,
        l.sourceLine==null?l.line:l.sourceLine,
        l.line,
        l.odds==null?'':formatAmericanOdds(l.odds),
        formatAmericanOdds(p.odds),
        p.who,
        l.pick,
        Number(p.units),
        l.result||'Pending',
        p.result||'Pending',
        isCautioned(g.id)?'Yes':'',
        isDDLResult(l.result)?'Yes':''
      ]);
    });
  });
  return rows;
}
function downloadCSV(rows,filename){
  const csv=rows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=filename;
  a.click();
  URL.revokeObjectURL(url);
}
function exportReportCSV(scope,value){
  const wagers=wagersForReport(scope,value);
  if(!wagers.length){alert('No graded picks are available for that report.');return;}
  let label='2026_Season';
  if(scope==='week')label=`Week_${value}`;
  if(scope==='month')label=value;
  downloadCSV(csvRowsForWagers(wagers),`TrackPicks_${label}_Report.csv`);
}
function exportCSV(){
  const wagers=wagersForReport('week',state.selectedWeek);
  const parlays=gradedParlaysForWeek(state.selectedWeek);
  if(!wagers.length&&!parlays.length){alert(`Week ${state.selectedWeek} has no graded picks to export.`);return;}
  downloadCSV(csvRowsForWagers(wagers,parlays),`TrackPicks_Week_${state.selectedWeek}_Report.csv`);
}

initCloud();
ensureFreshPwaController(); checkForAppUpdate();
setInterval(checkForAppUpdate, 5 * 60 * 1000);
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') ensureFreshPwaController(); checkForAppUpdate(); });

if(typeof document!=='undefined'){
  const slateShortNameObserver=new MutationObserver(()=>detectSlateShortNameNeeds());
  document.addEventListener('DOMContentLoaded',()=>{
    slateShortNameObserver.observe(document.body,{childList:true,subtree:true});
    detectSlateShortNameNeeds();
  },{once:true});
}
