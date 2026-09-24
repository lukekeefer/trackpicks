const BUILD_VERSION = '20260923-13';

function showUpdateBanner(latestVersion){
  if(document.getElementById('trackpicks-update-banner')) return;
  const banner=document.createElement('div');
  banner.id='trackpicks-update-banner';
  banner.className='update-banner';
  banner.innerHTML=`<div><strong>TrackPicks update available</strong><span>Reload to use the newest version.</span></div><button type="button">Reload</button>`;
  banner.querySelector('button').onclick=()=>{
    const url=new URL(window.location.href);
    url.searchParams.set('v',latestVersion||Date.now());
    window.location.replace(url.toString());
  };
  document.body.appendChild(banner);
}

async function checkForAppUpdate(){
  try{
    const res=await fetch(`version.json?t=${Date.now()}`,{cache:'no-store'});
    if(!res.ok)return;
    const data=await res.json();
    if(data?.version && data.version!==BUILD_VERSION) showUpdateBanner(data.version);
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
  for (let w = 4; w <= 12; w++) {
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
  importMessage: '', authMessage: '', authMode: 'signin',
  apiKey: localStorage.getItem(STORAGE.apiKey) || '',
  apiUsage: JSON.parse(localStorage.getItem(STORAGE.apiUsage) || 'null'),
  supabaseUrl: 'https://doatdvdaggmuycgxkwhh.supabase.co',
  supabaseKey: 'sb_publishable_sxuPFdJVj5xQF7iIPs2FzQ_k1alR7Zy',
  sb: null, session: null, user: null,
  authReady: false,
  weeks: Array.from({ length: 12 }, (_, i) => ({ week: i + 1, enabled: i + 1 >= 4 })),
  games: [], wagers: [], cautionGameIds: [], oddsHistory: [],
  cfbTeams: [], cfbAliases: [],
  slateDivision: 'FBS', slateConference: 'All',
  parlays: [], parlayLegs: [], slipTab: 'straight',
  parlayDraft: {id:null,legs:[],who:'',units:1,odds:'',isTeaser:false,teaserPoints:6,result:'Pending'},
  parlaySaving: false,
  pickerOptions: ['Keef','Wilson','Both','Tail'],
  historyChartKind: null
};
let tempKind='', tempSelection=null, tempWho=null, tempLine='', tempUnits=1;

function signed(n){ return Number(n)>0?`+${Number(n)}`:`${Number(n)}`; }

function captureWagerDraft(){
  const line=document.getElementById('lineInput');
  const units=document.getElementById('unitsInput');
  const who=document.getElementById('whoInput');
  if(line) tempLine=line.value;
  if(units) tempUnits=units.value;
  if(who && who.value) tempWho=who.value;
}
function resetWagerDraft(){
  tempKind='';
  tempSelection=null;
  tempLine='';
  tempUnits=1;
}

function escapeAttr(s){ return String(s??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function gameById(id){ return state.games.find(g=>g.id===id); }
function wagersForGame(id){ return state.wagers.filter(w=>w.gameId===id); }
function fmtSpread(g,team){ if(g.spread==null||!g.spreadTeam)return null; return team===g.spreadTeam?g.spread:-g.spread; }
function marketLineFor(g,kind,selection){ return kind==='Spread'?fmtSpread(g,selection):g.total; }
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
function gameConferences(g){
  return [...new Set([conferenceForTeam(g.away),conferenceForTeam(g.home)].filter(Boolean))];
}
function gameMatchesConference(g,filter){
  if(filter==='All')return true;
  const confs=gameConferences(g);
  if(filter==='G6')return confs.some(c=>G6_CONFERENCES.includes(c));
  return confs.includes(filter);
}
function filteredSlateGames(){
  const games=weekGames(state.selectedWeek);
  if(state.slateDivision==='FCS') return games.filter(g=>g.sourceSportKey==='americanfootball_ncaaf_fcs');
  return games.filter(g=>g.sourceSportKey==='americanfootball_ncaaf').filter(g=>gameMatchesConference(g,state.slateConference));
}
function renderSlateFilters(){
  const division=`<div class="slate-filter-primary"><button class="slate-filter-btn primary-filter ${state.slateDivision==='FBS'?'active':''}" data-slate-division="FBS">FBS</button><button class="slate-filter-btn primary-filter ${state.slateDivision==='FCS'?'active':''}" data-slate-division="FCS">FCS</button></div>`;
  const sub=state.slateDivision==='FBS'?`<div class="slate-filter-sub">${['All','SEC','Big Ten','Big 12','ACC','G6'].map(f=>`<button class="slate-filter-btn ${state.slateConference===f?'active':''}" data-slate-conference="${f}">${f}</button>`).join('')}</div>`:'';
  return `<div class="slate-filter-bar">${division}<div class="slate-filter-divider"></div>${sub}</div>`;
}
function legsForParlay(parlayId){ return state.parlayLegs.filter(l=>l.parlayId===parlayId).sort((a,b)=>a.legOrder-b.legOrder); }
function estimatedParlayAmericanOdds(legCount){
  const n=Number(legCount);
  if(!Number.isInteger(n)||n<2)return '';
  const decimal=Math.pow(1+(100/110),n);
  const american=decimal>=2?Math.round((decimal-1)*100):Math.round(-100/(decimal-1));
  return american>0?`+${american}`:`${american}`;
}
function syncParlayEstimate(){
  if(state.parlayDraft.isTeaser){state.parlayDraft.odds='';return;}
  state.parlayDraft.odds=estimatedParlayAmericanOdds(state.parlayDraft.legs.length);
}
function resetParlayDraft(){ state.parlayDraft={id:null,legs:[],who:state.displayName||'',units:1,odds:'',isTeaser:false,teaserPoints:6,result:'Pending'}; }
function teasedLineFor(leg,points){ const base=Number(leg.sourceLine); const pts=Number(points)||0; if(leg.betType==='Spread')return base+pts; return leg.selection==='Over'?base-pts:base+pts; }
function effectiveParlayLegLine(leg,draft=state.parlayDraft){ return draft.isTeaser?teasedLineFor(leg,draft.teaserPoints):Number(leg.sourceLine); }
function americanProfitUnits(units,odds){ const u=Number(units),o=Number(odds); if(!Number.isFinite(u)||u<=0||!Number.isFinite(o)||o===0)return null; return o>0?u*o/100:u*100/Math.abs(o); }
function formatAmericanOdds(odds){ const n=Number(odds); if(!Number.isFinite(n)||n===0)return '—'; return n>0?`+${Math.round(n)}`:`${Math.round(n)}`; }

function isCautioned(gameId){ return state.cautionGameIds.includes(gameId); }
function isGradedResult(result){ return ['Win','Loss','Push','DDL'].includes(result); }
function normalizedResult(result){ return result==='DDL'?'Loss':result; }
function isDDLResult(result){ return result==='DDL'; }
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
      else {state.isAdmin=false;state.games=[];state.wagers=[];state.cautionGameIds=[];state.oddsHistory=[];state.cfbTeams=[];state.cfbAliases=[];}
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
    const [gamesRes,wagersRes,flagsRes,teamsRes,aliasesRes]=await Promise.all([
      state.sb.from('games').select('*').eq('season',2026).gte('week',4).lte('week',12),
      state.sb.from('wagers').select('*').eq('user_id',state.user.id),
      state.sb.from('user_game_flags').select('game_id,caution').eq('user_id',state.user.id).eq('caution',true),
      state.sb.from('cfb_teams').select('espn_name,conference,subdivision,season').eq('season',2026),
      state.sb.from('cfb_team_aliases').select('provider,alias,espn_name')
    ]);
    if(gamesRes.error)throw gamesRes.error;
    if(wagersRes.error)throw wagersRes.error;
    if(flagsRes.error)throw flagsRes.error;
    if(teamsRes.error)throw teamsRes.error;
    if(aliasesRes.error)throw aliasesRes.error;
    state.games=(gamesRes.data||[]).map(fromDbGame);
    state.wagers=(wagersRes.data||[]).map(fromDbWager);
    state.cautionGameIds=(flagsRes.data||[]).map(r=>r.game_id);
    state.cfbTeams=(teamsRes.data||[]).map(r=>({espnName:r.espn_name,conference:r.conference,subdivision:r.subdivision,season:r.season}));
    state.cfbAliases=(aliasesRes.data||[]).map(r=>({provider:r.provider,alias:r.alias,espnName:r.espn_name}));
    const historyRes=await state.sb.from('game_odds_history').select('*').eq('season',2026).gte('week',4).lte('week',12).order('captured_at',{ascending:true});
    state.oddsHistory=historyRes.error?[]:(historyRes.data||[]).map(fromDbOddsSnapshot);
    const [parlaysRes,parlayLegsRes]=await Promise.all([
      state.sb.from('parlays').select('*').eq('user_id',state.user.id).eq('season',2026).gte('week',4).lte('week',12).order('created_at',{ascending:true}),
      state.sb.from('parlay_legs').select('*').eq('user_id',state.user.id).order('leg_order',{ascending:true})
    ]);
    state.parlays=parlaysRes.error?[]:(parlaysRes.data||[]).map(fromDbParlay);
    state.parlayLegs=parlayLegsRes.error?[]:(parlayLegsRes.data||[]).map(fromDbParlayLeg);
  }catch(err){ state.importMessage=`Sync failed: ${err.message||err}`; }
  finally{ state.syncing=false; }
}

function fromDbGame(r){ return {id:r.id,sourceEventId:r.source_event_id,sourceSportKey:r.source_sport_key,week:r.week,away:r.away,home:r.home,spreadTeam:r.spread_team,spread:r.spread==null?null:Number(r.spread),total:r.total==null?null:Number(r.total),commenceTime:r.commence_time,marketUpdatedAt:r.market_updated_at,tv:r.tv||'',location:r.location||''}; }
function toDbGame(g){ return {id:g.id,source_event_id:g.sourceEventId||null,source_sport_key:g.sourceSportKey||null,season:2026,week:g.week,away:g.away,home:g.home,spread_team:g.spreadTeam||null,spread:g.spread,total:g.total,commence_time:g.commenceTime,market_updated_at:g.marketUpdatedAt||null,tv:g.tv||'',location:g.location||'',updated_at:new Date().toISOString()}; }
function fromDbOddsSnapshot(r){ return {id:r.id,gameId:r.game_id,week:r.week,spreadTeam:r.spread_team,spread:r.spread==null?null:Number(r.spread),total:r.total==null?null:Number(r.total),marketUpdatedAt:r.market_updated_at,capturedAt:r.captured_at}; }
function toDbOddsSnapshot(g,capturedAt){ return {game_id:g.id,season:2026,week:g.week,spread_team:g.spreadTeam||null,spread:g.spread,total:g.total,market_updated_at:g.marketUpdatedAt||null,captured_at:capturedAt}; }
function oddsHistoryForGame(gameId){ return state.oddsHistory.filter(h=>h.gameId===gameId).sort((a,b)=>new Date(a.capturedAt)-new Date(b.capturedAt)); }
function spreadForTeamFromSnapshot(h,team){ if(h?.spread==null||!h.spreadTeam)return null; return h.spreadTeam===team?h.spread:-h.spread; }
function movementForGame(g){
  const history=oddsHistoryForGame(g.id);
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
  const rows=oddsHistoryForGame(g.id);
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
function renderMovementHistory(g){
  const rows=compactOddsHistory(g);
  if(rows.length<2)return '<div class="movement-empty">No line movement captured yet.</div>';
  return `<div class="movement-history">${rows.slice(-6).map((h,i,arr)=>{const when=formatKickoff(h.capturedAt);const label=rows.length>6&&i===0?'Earlier':(i===arr.length-1?'Current':`${when.date} · ${when.time}`);const spread=h.homeSpread==null?'—':`${g.home} ${signed(h.homeSpread)}`;const total=h.total==null?'—':`O/U ${h.total}`;return `<div class="movement-row"><span>${label}</span><strong>${spread}</strong><strong>${total}</strong></div>`;}).join('')}</div>`;
}

function historyChartPoints(g,kind){
  const rows=oddsHistoryForGame(g.id);
  return rows.map(h=>({
    capturedAt:h.capturedAt,
    value:kind==='Spread'?spreadForTeamFromSnapshot(h,g.home):h.total
  })).filter(p=>p.value!=null&&p.capturedAt).sort((a,b)=>new Date(a.capturedAt)-new Date(b.capturedAt));
}
function renderHistorySvg(points,kind,g){
  if(points.length<2)return '<div class="chart-empty">Not enough snapshots to graph yet.</div>';
  const W=620,H=270,L=48,R=18,T=20,B=42;
  const times=points.map(p=>new Date(p.capturedAt).getTime()), vals=points.map(p=>Number(p.value));
  let minT=Math.min(...times),maxT=Math.max(...times);if(maxT===minT)maxT=minT+1;
  let minV=Math.min(...vals),maxV=Math.max(...vals);if(maxV===minV){minV-=1;maxV+=1;}else{const pad=Math.max(.5,(maxV-minV)*.18);minV-=pad;maxV+=pad;}
  const x=t=>L+((t-minT)/(maxT-minT))*(W-L-R), y=v=>T+(1-(v-minV)/(maxV-minV))*(H-T-B);
  const coords=points.map((p,i)=>({x:x(times[i]),y:y(vals[i]),p}));
  const path=coords.map((c,i)=>`${i?'L':'M'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const grid=[0,.25,.5,.75,1].map(fr=>{const v=maxV-(maxV-minV)*fr,yy=T+(H-T-B)*fr;return `<line x1="${L}" y1="${yy.toFixed(1)}" x2="${W-R}" y2="${yy.toFixed(1)}" class="chart-grid-line"/><text x="${L-8}" y="${(yy+4).toFixed(1)}" text-anchor="end" class="chart-axis-text">${kind==='Spread'?signed(Number(v.toFixed(1))):Number(v.toFixed(1))}</text>`;}).join('');
  const dots=coords.map(c=>{const when=formatKickoff(c.p.capturedAt);const label=kind==='Spread'?`${g.home} ${signed(c.p.value)}`:`O/U ${c.p.value}`;return `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="5" class="chart-dot"><title>${when.date} ${when.time} — ${label}</title></circle>`;}).join('');
  const first=formatKickoff(points[0].capturedAt),last=formatKickoff(points[points.length-1].capturedAt);
  return `<svg class="history-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${kind} line history">${grid}<path d="${path}" class="chart-line"/>${dots}<text x="${L}" y="${H-12}" class="chart-axis-text">${first.date} ${first.time}</text><text x="${W-R}" y="${H-12}" text-anchor="end" class="chart-axis-text">${last.date} ${last.time}</text></svg>`;
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
function fromDbWager(r){ return {id:r.id,gameId:r.game_id,betType:r.bet_type,selection:r.selection,line:Number(r.line),units:Number(r.units),who:r.who,pick:r.pick,result:r.result||'Pending',marketSpread:r.market_spread==null?null:Number(r.market_spread),marketTotal:r.market_total==null?null:Number(r.market_total)}; }
function toDbWager(w){ return {id:w.id,user_id:state.user.id,game_id:w.gameId,bet_type:w.betType,selection:w.selection,line:w.line,units:w.units,who:w.who,pick:w.pick,result:w.result||'Pending',market_spread:w.marketSpread,market_total:w.marketTotal,updated_at:new Date().toISOString()}; }
function fromDbParlay(r){ return {id:r.id,week:Number(r.week),who:r.who,units:Number(r.units),odds:Number(r.odds),isTeaser:!!r.is_teaser,teaserPoints:r.teaser_points==null?null:Number(r.teaser_points),result:r.result||'Pending',createdAt:r.created_at}; }
function toDbParlay(p){ return {id:p.id,user_id:state.user.id,season:2026,week:p.week,who:p.who,units:p.units,odds:p.odds,is_teaser:p.isTeaser,teaser_points:p.isTeaser?p.teaserPoints:null,result:p.result||'Pending',updated_at:new Date().toISOString()}; }
function fromDbParlayLeg(r){ return {id:r.id,parlayId:r.parlay_id,gameId:r.game_id,legOrder:Number(r.leg_order),betType:r.bet_type,selection:r.selection,sourceLine:Number(r.source_line),line:Number(r.line),pick:r.pick}; }
function toDbParlayLeg(leg,parlayId,legOrder,finalLine){ const pick=leg.betType==='Spread'?`${leg.selection} ${signed(finalLine)}`:`${leg.selection} ${finalLine}`; return {id:leg.id||crypto.randomUUID(),parlay_id:parlayId,user_id:state.user.id,game_id:leg.gameId,leg_order:legOrder,bet_type:leg.betType,selection:leg.selection,source_line:Number(leg.sourceLine),line:Number(finalLine),pick}; }


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
  }catch(e){
    state.isAdmin = false;
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
    .select('display_name,picker_names,is_admin')
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
  app.innerHTML=`<div class="app-shell">${topbar()}<main class="page">${state.view==='weeks'?renderWeeks():state.view==='market'?renderMarket():renderSlip()}</main>${bottomNav()}</div>${state.activeGameId?renderGameSheet():''}${renderPickerSelector()}${state.showSettings?renderSettingsSheet():''}${state.historyChartKind?renderHistoryChart():''}`;
  bind();
}

function renderCloudSetup(){ return `<div class="auth-shell"><div class="auth-card"><h1 class="auth-brand">TrackPicks</h1><div class="auth-subtitle">V1.2 · Cloud setup</div><div class="cloud-warning">Enter your Supabase Project URL and public anon/publishable key. These are project connection values, not your account password.</div><div class="setup-grid"><div class="field"><label>Supabase Project URL</label><input id="setupUrl" type="url" placeholder="https://xxxxx.supabase.co" value="${escapeAttr(state.supabaseUrl)}"></div><div class="field"><label>Supabase public key</label><input id="setupKey" type="password" placeholder="Anon / publishable key" value="${escapeAttr(state.supabaseKey)}"></div></div><button class="primary" data-save-cloud>Save Cloud Setup</button>${state.authMessage?`<div class="auth-message error">${state.authMessage}</div>`:''}</div></div>`; }

function renderAuth(){ const signup=state.authMode==='signup'; return `<div class="auth-shell"><div class="auth-card"><h1 class="auth-brand">TrackPicks</h1><div class="auth-subtitle">V1.2 · Your picks, synced across devices.</div><div class="auth-tabs"><button class="auth-tab ${!signup?'active':''}" data-auth-mode="signin">Log In</button><button class="auth-tab ${signup?'active':''}" data-auth-mode="signup">Create Account</button></div><div class="auth-fields"><div class="field"><label>Email</label><input id="authEmail" type="email" autocomplete="email"></div><div class="field"><label>Password</label><input id="authPassword" type="password" autocomplete="${signup?'new-password':'current-password'}"></div></div><button class="primary" data-auth-submit>${signup?'Create Account':'Log In'}</button>${state.authMessage?`<div class="auth-message ${/error|invalid|failed|wrong/i.test(state.authMessage)?'error':''}">${state.authMessage}</div>`:''}</div></div>`; }

function topbar(){ let title='TrackPicks',subtitle='Track your picks · V1.2',action=`<div><div class="account-chip">${escapeAttr(state.user?.email||'')}</div><button class="secondary" data-settings>Settings</button></div>`; if(state.view==='market'){title=`Week ${state.selectedWeek}`;subtitle=`${formatWeekRange(state.selectedWeek)} · DraftKings market board`;const loadButton=state.isAdmin?`<button class="primary compact" data-load-week ${state.loadingWeek?'disabled':''}>${state.loadingWeek?'Loading…':'Load Week'}</button>`:'';action=`<div class="top-actions"><button class="secondary" data-nav="weeks">← Weeks</button><button class="secondary" data-settings>Settings</button>${loadButton}</div>`;} if(state.view==='slip'){title='Slip';subtitle=`${weekWagers(state.selectedWeek).length} straight · ${weekParlays(state.selectedWeek).length} parlay${weekParlays(state.selectedWeek).length===1?'':'s'} · Week ${state.selectedWeek}`;action=`<div class="top-actions"><button class="secondary" data-settings>Settings</button><button class="secondary" data-action="export">Export CSV</button></div>`;} return `<header class="topbar"><div class="topbar-row"><div><h1 class="title">${title}</h1><div class="subtitle">${subtitle}</div>${state.syncing?'<div class="sync-note">↻ Syncing…</div>':'<div class="sync-note">✓ Cloud synced</div>'}</div>${action}</div></header>`; }
function bottomNav(){ if(state.view==='weeks')return''; return `<nav class="bottom-nav"><button class="nav-btn ${state.view==='market'?'active':''}" data-nav="market">Full Slate</button><button class="nav-btn ${state.view==='slip'?'active':''}" data-nav="slip">Slip</button></nav>`; }
function renderWeeks(){ return `<div class="section-title">Weeks 1–12</div><div class="week-grid">${state.weeks.map(w=>{const games=weekGames(w.week).length,picks=weekWagers(w.week).length;const meta=!w.enabled?'Not used this season':games?`${games} games loaded · ${picks} saved wager(s)`:(w.week===4?'Starting week · not loaded':'Not loaded');return `<button class="week-card ${w.enabled?'':'disabled'}" data-week="${w.week}" ${w.enabled?'':'disabled'}><div class="week-name">Week ${w.week}</div><div class="week-meta">${meta}</div></button>`}).join('')}</div>`; }

function renderMarket(){
  const allGames=weekGames(state.selectedWeek),
        games=filteredSlateGames(),
        message=state.importMessage?`<div class="notice">${state.importMessage}</div>`:'',
        filters=renderSlateFilters();
  if(!allGames.length)return `${message}${filters}<div class="empty"><strong>No games loaded for Week ${state.selectedWeek}.</strong><br><br>${state.isAdmin?'Tap <b>Load Week</b> to pull the current DraftKings slate.':'The weekly board has not been published yet.'}</div>`;
  if(!games.length)return `${message}${filters}<div class="empty compact-empty">No games match this slate filter.</div>`;
  return `${message}${filters}<div class="game-list">${games.map(g=>{
    const saved=wagersForGame(g.id).length,k=formatKickoff(g.commenceTime),caution=isCautioned(g.id),movement=movementSummary(g);
    return `<button class="game-row ${saved?'saved':''} ${caution?'cautioned':''}" data-game="${g.id}">
      <div class="game-matchup">${caution?'<span class="caution-icon">⚠️</span> ':''}${g.away} @ ${g.home}</div>
      <div class="game-market">${marketSummary(g)}</div>
      ${movement?`<div class="line-movement">↔ ${movement}</div>`:''}
      <div class="game-kickoff">${k.date} · ${k.time}</div>
      ${saved?`<span class="badge">${saved} saved</span>`:''}
      ${(!hasSpread(g)||!hasTotal(g))?'<span class="warning-badge">Missing market</span>':''}
    </button>`;
  }).join('')}</div>`;
}

function resultClassFor(result){ return result==='Win'?'result-win':result==='Loss'?'result-loss':result==='DDL'?'result-ddl':result==='Push'?'result-push':'result-pending'; }
function renderStraightSlip(){
  const wagers=weekWagers(state.selectedWeek);
  if(!wagers.length)return `<div class="empty compact-empty">No saved straight picks yet. Open the Full Slate tab and select a game.</div>`;
  return wagers.map(w=>{
    const g=gameById(w.gameId); if(!g)return'';
    const result=w.result||'Pending',caution=isCautioned(g.id);
    return `<div class="slip-card compact-slip ${caution?'cautioned':''}">
      <div class="slip-main"><div class="slip-copy"><div class="slip-pick">${caution?'<span class="caution-icon">⚠️</span> ':''}${w.pick}</div><div class="slip-meta">${g.away} @ ${g.home}</div><div class="slip-meta">${w.who} · <strong>${Number(w.units).toFixed(1)}u</strong></div></div><div class="slip-right"><span class="result-badge ${resultClassFor(result)}">${result}</span><button class="remove-btn compact-remove" data-remove="${w.id}">Remove</button></div></div>
      <div class="slip-actions compact-actions"><button class="secondary compact-btn" data-edit="${w.id}">Edit Pick</button><button class="secondary compact-btn" data-open-game="${g.id}">Game</button><button class="secondary compact-btn" data-result-menu="${w.id}">${result==='Pending'?'Set Result':'Edit Result'}</button></div>
      <div class="result-picker" data-result-picker-for="${w.id}" hidden>${['Win','Loss','Push','DDL'].map(r=>`<button class="result-choice ${r.toLowerCase()}" data-set-result="${w.id}" data-result="${r}">${r}</button>`).join('')}</div>
    </div>`;
  }).join('');
}
function renderParlayLeg(leg,draft){
  const g=gameById(leg.gameId),finalLine=effectiveParlayLegLine(leg,draft),base=Number(leg.sourceLine);
  const baseLabel=leg.betType==='Spread'?`${leg.selection} ${signed(base)}`:`${leg.selection} ${base}`;
  const finalLabel=leg.betType==='Spread'?`${leg.selection} ${signed(finalLine)}`:`${leg.selection} ${finalLine}`;
  return `<div class="parlay-leg"><div class="parlay-leg-copy"><strong>${draft.isTeaser?`${baseLabel} → ${finalLabel}`:baseLabel}</strong><span>${g?`${g.away} @ ${g.home}`:'Game unavailable'} · ${leg.betType}</span></div><button class="parlay-leg-remove" data-remove-parlay-leg="${leg.id}" aria-label="Remove leg">✕</button></div>`;
}
function renderSavedParlay(p){
  const legs=legsForParlay(p.id),result=p.result||'Pending',profit=americanProfitUnits(p.units,p.odds);
  return `<div class="slip-card parlay-card"><div class="slip-main"><div class="slip-copy"><div class="slip-pick">${legs.length}-Leg ${p.isTeaser?`${Number(p.teaserPoints)}-Point Teaser`:'Parlay'}</div><div class="slip-meta">${p.who} · <strong>${Number(p.units).toFixed(1)}u</strong> · <strong>${formatAmericanOdds(p.odds)}</strong>${profit!=null?` · To win ${profit.toFixed(2)}u`:''}</div></div><div class="slip-right"><span class="result-badge ${resultClassFor(result)}">${result}</span><button class="remove-btn compact-remove" data-remove-parlay="${p.id}">Remove</button></div></div><div class="saved-parlay-legs">${legs.map(l=>`<div>${escapeAttr(l.pick)}</div>`).join('')}</div><div class="slip-actions compact-actions"><button class="secondary compact-btn" data-edit-parlay="${p.id}">Edit Parlay</button><button class="secondary compact-btn" data-parlay-result-menu="${p.id}">${result==='Pending'?'Set Result':'Edit Result'}</button></div><div class="result-picker" data-parlay-result-picker-for="${p.id}" hidden>${['Win','Loss','Push','DDL'].map(r=>`<button class="result-choice ${r.toLowerCase()}" data-set-parlay-result="${p.id}" data-result="${r}">${r}</button>`).join('')}</div></div>`;
}
function renderParlaysSlip(){
  const d=state.parlayDraft, saved=weekParlays(state.selectedWeek), names=effectivePickerNames(),profit=americanProfitUnits(d.units,d.odds);
  const builder=`<div class="parlay-builder"><div class="parlay-builder-head"><div><div class="section-title">${d.id?'Edit parlay':'Parlay Builder'}</div><div class="parlay-count">${d.legs.length} leg${d.legs.length===1?'':'s'} added</div></div>${d.legs.length?'<button class="secondary compact-btn" data-clear-parlay>Clear</button>':''}</div>${d.legs.length?`<div class="parlay-legs">${d.legs.map(l=>renderParlayLeg(l,d)).join('')}</div>`:'<div class="parlay-empty">Add picks from a game using <strong>Add to Parlay</strong>.</div>'}<button class="secondary parlay-add-leg" data-nav="market">+ Add Another Leg</button><div class="teaser-row"><div><strong>Teaser</strong><span>Move every spread/total in your favor.</span></div><button type="button" class="toggle-btn ${d.isTeaser?'active':''}" data-toggle-teaser aria-pressed="${d.isTeaser?'true':'false'}"><span></span></button></div>${d.isTeaser?`<div class="field full teaser-points-field"><label>Tease every leg by</label><div class="points-input-wrap"><input id="teaserPointsInput" type="number" min="0.5" step="0.5" value="${escapeAttr(d.teaserPoints)}"><span>points</span></div></div>`:''}<div class="field-grid parlay-fields"><div class="field"><label>${d.isTeaser?'Locked payout odds':'Payout odds estimate'}</label><input id="parlayOddsInput" type="text" inputmode="numeric" value="${escapeAttr(d.odds)}" placeholder="${d.isTeaser?'+120':'Auto from -110 legs'}"></div><div class="field"><label>Units</label><input id="parlayUnitsInput" type="number" min="0.1" step="0.5" value="${escapeAttr(d.units)}"></div><div class="field full"><label>Who’s picks are these?</label><select id="parlayWhoInput">${names.map(n=>`<option value="${escapeAttr(n)}" ${(d.who||state.displayName)===n?'selected':''}>${escapeAttr(n)}</option>`).join('')}</select></div></div>${profit!=null?`<div class="parlay-payout"><span>To win</span><strong>${profit.toFixed(2)}u</strong><span>Total return ${(profit+Number(d.units)).toFixed(2)}u</span></div>`:''}<button class="primary ${state.parlaySaving?'saved-confirmation':''}" data-save-parlay ${state.parlaySaving?'disabled':''}>${state.parlaySaving?'Saving…':(d.id?'Save Parlay Changes':'Save Parlay')}</button><div class="parlay-note">${d.isTeaser?'Enter the sportsbook payout odds for teasers.':'Estimate assumes every leg is -110. You can overwrite it with the sportsbook payout before saving.'} Only one odds value is saved. Straight-pick reports remain separate.</div></div>`;
  return `${builder}${saved.length?`<div class="saved-parlays-title">Saved Parlays (${saved.length})</div>${saved.map(renderSavedParlay).join('')}`:'<div class="empty compact-empty">No saved parlays for this week yet.</div>'}`;
}
function renderSlip(){
  return `<div class="slip-tabs"><button class="slip-tab ${state.slipTab==='straight'?'active':''}" data-slip-tab="straight">Straight Picks (${weekWagers(state.selectedWeek).length})</button><button class="slip-tab ${state.slipTab==='parlays'?'active':''}" data-slip-tab="parlays">Parlays (${weekParlays(state.selectedWeek).length})${state.parlayDraft.legs.length?` <span class="draft-dot">${state.parlayDraft.legs.length}</span>`:''}</button></div>${state.slipTab==='straight'?renderStraightSlip():renderParlaysSlip()}`;
}
function renderChoiceArea(g,kind,selection){
  if(!kind)return '<div class="missing-box selection-prompt">Choose Spread or Total to begin.</div>';
  if(kind==='Spread'){
    if(!hasSpread(g))return '<div class="missing-box">DraftKings spread is unavailable for this game.</div>';
    return `<div class="bet-type-grid" style="margin-top:10px"><button class="choice-btn ${selection===g.away?'selected':''}" data-selection="${escapeAttr(g.away)}">${g.away} ${signed(fmtSpread(g,g.away))}</button><button class="choice-btn ${selection===g.home?'selected':''}" data-selection="${escapeAttr(g.home)}">${g.home} ${signed(fmtSpread(g,g.home))}</button></div>`;
  }
  if(kind==='Total'){
    if(!hasTotal(g))return '<div class="missing-box">DraftKings total is unavailable for this game.</div>';
    return `<div class="bet-type-grid" style="margin-top:10px"><button class="choice-btn ${selection==='Over'?'selected':''}" data-selection="Over">Over ${g.total}</button><button class="choice-btn ${selection==='Under'?'selected':''}" data-selection="Under">Under ${g.total}</button></div>`;
  }
  return '<div class="missing-box selection-prompt">Choose Spread or Total to begin.</div>';
}

function renderPickerSelector(){
  if(!state.activePickerSelector) return '';
  const names=effectivePickerNames();
  return `<div class="overlay picker-overlay">
    <section class="sheet picker-sheet">
      <div class="sheet-handle"></div>
      <div class="close-row">
        <div>
          <h2 style="margin:0">Who’s picks are these?</h2>
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

function renderGameSheet(){ const g=gameById(state.activeGameId);if(!g)return'';const editing=state.editWagerId?state.wagers.find(w=>w.id===state.editWagerId):null;const defaultWho=tempWho||editing?.who||state.displayName||'';let kind=editing?.betType||tempKind||'';if(kind==='Spread'&&!hasSpread(g))kind='';if(kind==='Total'&&!hasTotal(g))kind='';const selection=editing?.selection||tempSelection||null;tempKind=kind;tempSelection=selection;const actualLineValue=editing?(tempLine!==''?tempLine:editing.line):tempLine;const k=formatKickoff(g.commenceTime);return `<div class="overlay"><section class="sheet"><div class="sheet-handle"></div><div class="close-row"><div><h2 style="margin:0">${g.away} @ ${g.home}</h2><div class="detail-meta">${k.date} · ${k.time}${g.tv?`<br>${g.tv}`:''}${g.location?` · ${g.location}`:''}</div></div><button class="icon-btn" data-close>✕</button></div><div class="market-box"><strong>DraftKings market snapshot</strong>${marketSummary(g)}${g.marketUpdatedAt?`<div class="market-updated">Updated ${formatKickoff(g.marketUpdatedAt).date} · ${formatKickoff(g.marketUpdatedAt).time}</div>`:''}<div class="movement-title">Line movement</div>${renderMovementHistory(g)}<div class="history-buttons"><button type="button" class="secondary history-btn" data-open-history="Spread" ${historyChartPoints(g,'Spread').length<2?'disabled':''}>Spread History</button><button type="button" class="secondary history-btn" data-open-history="Total" ${historyChartPoints(g,'Total').length<2?'disabled':''}>Total History</button></div></div><div class="wager-editor"><div class="section-title">${editing?'Edit wager':'Add wager'}</div><div class="bet-type-grid"><button class="choice-btn ${kind==='Spread'?'selected':''}" data-kind="Spread" ${hasSpread(g)?'':'disabled'}>Spread</button><button class="choice-btn ${kind==='Total'?'selected':''}" data-kind="Total" ${hasTotal(g)?'':'disabled'}>Total</button></div><div id="choiceArea">${renderChoiceArea(g,kind,selection)}</div><div class="field-grid"><div class="field"><label>Actual line taken</label><input id="lineInput" type="number" step="0.5" value="${actualLineValue}" placeholder="Optional — defaults to market"></div><div class="field"><label>Units</label><input id="unitsInput" type="number" min="0.1" step="0.5" value="${editing?(tempUnits??editing.units):(tempUnits??1)}"></div><div class="field full"><label>Who’s picks are these?</label><button type="button" class="picker-select-btn" data-open-picker-selector><span id="pickerSelectionLabel">${escapeAttr(defaultWho)}</span><span class="chev">›</span></button><input id="whoInput" type="hidden" value="${escapeAttr(defaultWho)}"></div></div><button type="button" class="caution-toggle ${isCautioned(g.id)?'active':''}" data-toggle-caution="${g.id}">${isCautioned(g.id)?'⚠️ Caution Marked':'⚠️ Mark Caution'}</button><button class="primary ${state.saving?'saved-confirmation':''}" data-save-wager ${state.saving?'disabled':''}>${state.saving?'✓ Saved':(editing?'Save Changes':'Confirm Bet')}</button>${editing?'':`<button class="secondary add-to-parlay-btn" data-add-to-parlay>+ Add to Parlay</button>`}</div></section></div>`; }
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
    <hr class="settings-divider">
  ` : '';

  return `<div class="overlay">
    <section class="sheet settings-sheet">
      <div class="sheet-handle"></div>
      <div class="close-row">
        <div>
          <h2 style="margin:0">Settings</h2>
          <div class="detail-meta">${escapeAttr(state.user?.email||'')}</div>
        </div>
        <button class="icon-btn" data-close-settings>✕</button>
      </div>
      
      <div class="settings-section">
        <div class="section-title">Profile</div>
        <div class="field full settings-field">
          <label>Display Name</label>
          <input id="settingsDisplayNameInput" type="text" maxlength="40" value="${escapeAttr(state.displayName||'')}" placeholder="Nickname or display name">
        </div>
        <button class="secondary full-width" data-save-display-name>Save Display Name</button>
      </div>

      ${adminApiSection}
      
      <div class="settings-section">
        <div class="section-title">Reports</div>
        <div class="report-card">
          <div class="report-row">
            <select id="reportWeekSelect" class="report-select">
              ${state.weeks.filter(w=>w.enabled).map(w=>`<option value="${w.week}" ${w.week===state.selectedWeek?'selected':''}>Week ${w.week}</option>`).join('')}
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

function bindDynamicSelections(){ document.querySelectorAll('[data-selection]').forEach(el=>el.onclick=()=>{tempSelection=el.dataset.selection;document.querySelectorAll('[data-selection]').forEach(b=>b.classList.toggle('selected',b.dataset.selection===tempSelection));}); }
function bind(){
  document.querySelectorAll('[data-week]').forEach(el=>el.onclick=()=>{state.selectedWeek=Number(el.dataset.week);state.view='market';state.slateDivision='FBS';state.slateConference='All';state.importMessage='';render();});
  document.querySelectorAll('[data-nav]').forEach(el=>el.onclick=()=>{state.view=el.dataset.nav;render();});
  document.querySelectorAll('[data-settings]').forEach(el=>el.onclick=()=>{state.showSettings=true;render();});
  document.querySelectorAll('[data-close-settings]').forEach(el=>el.onclick=()=>{state.showSettings=false;render();});
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
  document.querySelectorAll('[data-load-week]').forEach(el=>el.onclick=loadSelectedWeek);
  document.querySelectorAll('[data-slate-division]').forEach(el=>el.onclick=()=>{state.slateDivision=el.dataset.slateDivision;if(state.slateDivision==='FBS'&&!['All','SEC','Big Ten','Big 12','ACC','G6'].includes(state.slateConference))state.slateConference='All';render();});
  document.querySelectorAll('[data-slate-conference]').forEach(el=>el.onclick=()=>{state.slateConference=el.dataset.slateConference;state.slateDivision='FBS';render();});
  document.querySelectorAll('[data-game],[data-open-game]').forEach(el=>el.onclick=()=>{state.activeGameId=el.dataset.game||el.dataset.openGame;state.editWagerId=null;tempWho=null;resetWagerDraft();state.saving=false;render();});
  document.querySelectorAll('[data-close]').forEach(el=>el.onclick=()=>{state.activeGameId=null;state.editWagerId=null;state.historyChartKind=null;tempWho=null;resetWagerDraft();state.saving=false;render();});
  document.querySelectorAll('[data-open-history]').forEach(el=>el.onclick=()=>{captureWagerDraft();state.historyChartKind=el.dataset.openHistory;render();});
  document.querySelectorAll('[data-close-history]').forEach(el=>el.onclick=()=>{state.historyChartKind=null;render();});
  document.querySelectorAll('[data-kind]').forEach(el=>el.onclick=()=>{if(el.disabled)return;tempKind=el.dataset.kind;tempSelection=null;const g=gameById(state.activeGameId);document.querySelectorAll('[data-kind]').forEach(b=>b.classList.toggle('selected',b.dataset.kind===tempKind));document.getElementById('choiceArea').innerHTML=renderChoiceArea(g,tempKind,tempSelection);bindDynamicSelections();});
  bindDynamicSelections();
  document.querySelectorAll('[data-save-wager]').forEach(el=>el.onclick=saveCurrentWager);
  document.querySelectorAll('[data-add-to-parlay]').forEach(el=>el.onclick=addCurrentSelectionToParlay);
  document.querySelectorAll('[data-slip-tab]').forEach(el=>el.onclick=()=>{state.slipTab=el.dataset.slipTab;render();});
  document.querySelectorAll('[data-remove-parlay-leg]').forEach(el=>el.onclick=()=>{captureParlayDraftInputs();state.parlayDraft.legs=state.parlayDraft.legs.filter(l=>l.id!==el.dataset.removeParlayLeg);syncParlayEstimate();render();});
  document.querySelectorAll('[data-clear-parlay]').forEach(el=>el.onclick=()=>{resetParlayDraft();render();});
  document.querySelectorAll('[data-toggle-teaser]').forEach(el=>el.onclick=()=>{captureParlayDraftInputs();state.parlayDraft.isTeaser=!state.parlayDraft.isTeaser;syncParlayEstimate();render();});
  document.querySelectorAll('[data-save-parlay]').forEach(el=>el.onclick=saveCurrentParlay);
  document.querySelectorAll('[data-edit-parlay]').forEach(el=>el.onclick=()=>editParlay(el.dataset.editParlay));
  document.querySelectorAll('[data-remove-parlay]').forEach(el=>el.onclick=()=>removeParlay(el.dataset.removeParlay));
  document.querySelectorAll('[data-parlay-result-menu]').forEach(el=>el.onclick=()=>{const id=el.dataset.parlayResultMenu;document.querySelectorAll('[data-parlay-result-picker-for]').forEach(p=>{p.hidden=p.dataset.parlayResultPickerFor!==id?true:!p.hidden;});});
  document.querySelectorAll('[data-set-parlay-result]').forEach(el=>el.onclick=()=>setParlayResult(el.dataset.setParlayResult,el.dataset.result));
  ['parlayOddsInput','parlayUnitsInput','parlayWhoInput','teaserPointsInput'].forEach(id=>{const el=document.getElementById(id);if(el){el.oninput=captureParlayDraftInputs;el.onchange=()=>{captureParlayDraftInputs();render();};}});
  document.querySelectorAll('[data-edit]').forEach(el=>el.onclick=()=>{const w=state.wagers.find(x=>x.id===el.dataset.edit);if(!w||!gameById(w.gameId))return;state.activeGameId=w.gameId;state.editWagerId=w.id;tempWho=w.who||state.displayName;tempLine=String(w.line??'');tempUnits=String(w.units??1);state.saving=false;tempKind=w.betType;tempSelection=w.selection;render();});
  document.querySelectorAll('[data-remove]').forEach(el=>el.onclick=()=>removeWager(el.dataset.remove));
  document.querySelectorAll('[data-result-menu]').forEach(el=>el.onclick=()=>{const id=el.dataset.resultMenu;document.querySelectorAll('[data-result-picker-for]').forEach(p=>{p.hidden=p.dataset.resultPickerFor!==id?true:!p.hidden;});});
  document.querySelectorAll('[data-set-result]').forEach(el=>el.onclick=async()=>{const id=el.dataset.setResult,result=el.dataset.result;const {error}=await state.sb.from('wagers').update({result,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',state.user.id);if(error){alert(`Could not update result: ${error.message}`);return;}const w=state.wagers.find(x=>x.id===id);if(w)w.result=result;const card=el.closest('.slip-card');const picker=card?.querySelector('.result-picker');if(picker)picker.hidden=true;const badge=card?.querySelector('.result-badge');if(badge){badge.className='result-badge result-saved';badge.textContent='✓ Saved';}const menuBtn=card?.querySelector('[data-result-menu]');if(menuBtn)menuBtn.textContent='Edit Result';setTimeout(()=>render(),1600);});

  document.querySelectorAll('[data-toggle-caution]').forEach(el=>el.onclick=async()=>{
    captureWagerDraft();
    const gameId=el.dataset.toggleCaution;
    if(isCautioned(gameId)){
      const {error}=await state.sb.from('user_game_flags').delete().eq('user_id',state.user.id).eq('game_id',gameId);
      if(error){alert(`Could not remove caution: ${error.message}`);return;}
      state.cautionGameIds=state.cautionGameIds.filter(id=>id!==gameId);
    }else{
      const {error}=await state.sb.from('user_game_flags').upsert({user_id:state.user.id,game_id:gameId,caution:true,updated_at:new Date().toISOString()});
      if(error){alert(`Could not save caution: ${error.message}`);return;}
      if(!state.cautionGameIds.includes(gameId))state.cautionGameIds.push(gameId);
    }
    render();
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
    state.activePickerSelector=true;
    state.activeAddName=false;
    render();
  });

  document.querySelectorAll('[data-close-picker-selector]').forEach(el=>el.onclick=()=>{
    captureWagerDraft();
    state.activePickerSelector=false;
    state.activeAddName=false;
    render();
  });

  document.querySelectorAll('[data-picker-name]').forEach(el=>el.onclick=()=>{
    captureWagerDraft();
    const name=el.dataset.pickerName;
    tempWho=name;
    state.activePickerSelector=false;
    state.activeAddName=false;
    render();

    setTimeout(()=>{
      const hidden=document.getElementById('whoInput');
      const label=document.getElementById('pickerSelectionLabel');
      if(hidden) hidden.value=name;
      if(label) label.textContent=name;
    },0);
  });

  document.querySelectorAll('[data-add-picker-name]').forEach(el=>el.onclick=()=>{
    captureWagerDraft();
    state.activeAddName=true;
    render();
  });

  document.querySelectorAll('[data-save-picker-name]').forEach(el=>el.onclick=async()=>{
    captureWagerDraft();
    const input=document.getElementById('newPickerNameInput');
    const result=await addPickerName(input?.value||'');
    if(!result.ok){alert(result.message);return;}
    const newName=(input?.value||'').trim();
    tempWho=newName;
    state.activePickerSelector=false;
    state.activeAddName=false;
    render();

    setTimeout(()=>{
      const hidden=document.getElementById('whoInput');
      const label=document.getElementById('pickerSelectionLabel');
      if(hidden) hidden.value=newName;
      if(label) label.textContent=newName;
    },0);
  });

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
  captureWagerDraft(); const g=gameById(state.activeGameId); if(!g)return;
  if(!tempKind){alert('Choose Spread or Total first.');return;}
  if(!tempSelection){alert(tempKind==='Spread'?'Choose a team for the spread.':'Choose Over or Under.');return;}
  const marketLine=marketLineFor(g,tempKind,tempSelection); if(marketLine==null){alert('The selected DraftKings market is unavailable for this game.');return;}
  const raw=String(tempLine??'').trim(),line=raw===''?marketLine:Number(raw); if(!Number.isFinite(line)){alert('Enter a valid line, or leave the field blank to use the market line.');return;}
  const duplicate=state.parlayDraft.legs.some(l=>l.gameId===g.id&&l.betType===tempKind&&l.selection===tempSelection);
  if(duplicate){alert('That exact leg is already in the current parlay.');return;}
  state.parlayDraft.legs.push({id:crypto.randomUUID(),gameId:g.id,betType:tempKind,selection:tempSelection,sourceLine:Number(line)});
  syncParlayEstimate();
  if(!state.parlayDraft.who)state.parlayDraft.who=tempWho||state.displayName||'';
  state.activeGameId=null; state.editWagerId=null; state.historyChartKind=null; tempWho=null; resetWagerDraft(); state.view='slip'; state.slipTab='parlays'; render();
}
async function saveCurrentParlay(){
  if(state.parlaySaving)return; captureParlayDraftInputs(); const d=state.parlayDraft;
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
  if(editing){const {error:deleteError}=await state.sb.from('parlay_legs').delete().eq('parlay_id',id).eq('user_id',state.user.id);if(deleteError){state.parlaySaving=false;alert(`Could not update parlay legs: ${deleteError.message}`);render();return;}}
  const rows=d.legs.map((leg,i)=>toDbParlayLeg(leg,id,i+1,effectiveParlayLegLine(leg,d)));
  const {data:legData,error:legsError}=await state.sb.from('parlay_legs').insert(rows).select('*');
  if(legsError){if(!editing)await state.sb.from('parlays').delete().eq('id',id).eq('user_id',state.user.id);state.parlaySaving=false;alert(`Could not save parlay legs: ${legsError.message}`);render();return;}
  if(editing)state.parlays[state.parlays.findIndex(p=>p.id===id)]=parent; else state.parlays.push(parent);
  state.parlayLegs=state.parlayLegs.filter(l=>l.parlayId!==id).concat((legData||[]).map(fromDbParlayLeg));
  resetParlayDraft(); state.parlaySaving=false; render();
}
function editParlay(id){
  const p=state.parlays.find(x=>x.id===id); if(!p)return; const legs=legsForParlay(id);
  state.parlayDraft={id:p.id,legs:legs.map(l=>({id:l.id,gameId:l.gameId,betType:l.betType,selection:l.selection,sourceLine:l.sourceLine})),who:p.who,units:p.units,odds:formatAmericanOdds(p.odds),isTeaser:p.isTeaser,teaserPoints:p.teaserPoints??6,result:p.result}; state.slipTab='parlays'; render();
}
async function removeParlay(id){ if(!confirm('Remove this parlay?'))return; const {error}=await state.sb.from('parlays').delete().eq('id',id).eq('user_id',state.user.id); if(error){alert(`Could not remove parlay: ${error.message}`);return;} state.parlays=state.parlays.filter(p=>p.id!==id); state.parlayLegs=state.parlayLegs.filter(l=>l.parlayId!==id); if(state.parlayDraft.id===id)resetParlayDraft(); render(); }
async function setParlayResult(id,result){ const {error}=await state.sb.from('parlays').update({result,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',state.user.id); if(error){alert(`Could not update parlay result: ${error.message}`);return;} const p=state.parlays.find(x=>x.id===id); if(p)p.result=result; render(); }

async function saveCurrentWager(){
  if(state.saving)return;captureWagerDraft();const g=gameById(state.activeGameId),editing=state.editWagerId?state.wagers.find(w=>w.id===state.editWagerId):null,rawLine=String(tempLine??'').trim(),units=Number(tempUnits||1),who=(tempWho||document.getElementById('whoInput').value||state.displayName);if(!tempKind){alert('Choose Spread or Total first.');return;}if(!tempSelection){alert(tempKind==='Spread'?'Choose a team for the spread.':'Choose Over or Under.');return;}const marketLine=marketLineFor(g,tempKind,tempSelection);if(marketLine==null){alert('The selected DraftKings market is unavailable for this game.');return;}const finalLine=rawLine===''?marketLine:Number(rawLine);if(Number.isNaN(finalLine)){alert('Enter a valid spread or total, or leave the field blank to use the market line.');return;}if(!Number.isFinite(units)||units<=0){alert('Enter a valid unit amount greater than 0.');return;}const pick=tempKind==='Spread'?`${tempSelection} ${signed(finalLine)}`:`${tempSelection} ${finalLine}`;const obj={id:state.editWagerId||crypto.randomUUID(),gameId:g.id,betType:tempKind,selection:tempSelection,line:finalLine,units,who,pick,result:editing?.result||'Pending',marketSpread:g.spread,marketTotal:g.total};state.saving=true;render();const {error}=await state.sb.from('wagers').upsert(toDbWager(obj));if(error){state.saving=false;alert(`Could not save pick: ${error.message}`);render();return;}if(editing){state.wagers[state.wagers.findIndex(w=>w.id===obj.id)]=obj;}else state.wagers.push(obj);render();setTimeout(()=>{state.activeGameId=null;state.editWagerId=null;tempWho=null;resetWagerDraft();state.saving=false;render();},2200);
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

function csvRowsForWagers(wagers){
  const rows=[['Week','Matchup','Bet Type','Line/Total','Who','Pick','Units','Result','Caution','DDL']];
  wagers.forEach(w=>{
    const g=gameById(w.gameId);
    if(!g)return;
    rows.push([
      g.week,
      `${g.away}\n${g.home}`,
      w.betType,
      w.line,
      w.who,
      w.pick,
      Number(w.units),
      normalizedResult(w.result),
      isCautioned(g.id)?'Yes':'',
      isDDLResult(w.result)?'Yes':''
    ]);
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
  if(!wagers.length){alert(`Week ${state.selectedWeek} has no graded picks to export.`);return;}
  downloadCSV(csvRowsForWagers(wagers),`TrackPicks_Week_${state.selectedWeek}_Report.csv`);
}

initCloud();
checkForAppUpdate();
setInterval(checkForAppUpdate, 5 * 60 * 1000);
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') checkForAppUpdate(); });
