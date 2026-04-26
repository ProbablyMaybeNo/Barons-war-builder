import { BW_DATA, EQUIP, CG_UPGRADES } from '../data/game-data.js';

// Lite mode hides rules text (ability descriptions, faction trait tooltips, inherent ability details).
// Activated by serving from /lite/, by ?mode=lite on the script URL, or by <body class="lite-mode">.
const LITE_MODE = (typeof location !== 'undefined' && location.pathname.split('/').includes('lite'))
  || (typeof import.meta !== 'undefined' && new URL(import.meta.url).searchParams.get('mode') === 'lite')
  || (typeof document !== 'undefined' && document.body?.classList.contains('lite-mode'));

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════
const TIER_ORDER = {Green:0,Irregular:1,Regular:2,Veteran:3};
const TIER_CSS = {Green:'tier-green',Irregular:'tier-irregular',Regular:'tier-regular',Veteran:'tier-veteran',Named:'tier-named'};
const STORAGE_KEY = 'bw_kj_v4';
const FACTION_LABELS = {feudal_european:'Feudal European',mercenary:'Mercenary',flemish:'Flemish',poitevin:'Poitevin',medieval_scottish:'Medieval Scottish',welsh:'Welsh',outlaw:'Outlaw'};
const TWO_HANDED = new Set(['Two Handed Weapon','Improvised Two Handed Weapon','Bill / Polearm','Dane Axe','Dual Daggers','Bill','Bill (Regulars)']);
const COMMAND_UPGRADE_COST_OVERRIDES = {Pennant:7};
const WEAPON_CHOICE_RANGED_OPTIONS = ['Javelin','Bow'];

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════
// state.factions: array of selected faction_ids the player is fielding
// Each row in state.list already carries faction_id, so grouping comes for free
let state = {factions:[], list:[], ptsCap:500, nextId:1, openPanels:{}, mercenaryCompany:null};

// Mercenary Company Abilities — only one may be picked per Mercenary retinue
const MERC_COMPANIES = ['BRABANCON','FLEMISH','GASCON'];

// ═══════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════
function esc(s){if(!s&&s!==0)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function fac(id){return BW_DATA.factions.find(f=>f.faction_id===id)}
function facLabel(id){return FACTION_LABELS[id]||id}

// ── FACTION HELPERS ──
function hasFaction(fid){return state.factions.includes(fid)}
function addFaction(fid){if(!hasFaction(fid))state.factions.push(fid)}
function removeFaction(fid){
  state.list=state.list.filter(r=>r.faction_id!==fid);
  state.factions=state.factions.filter(f=>f!==fid);
  if(fid==='mercenary')state.mercenaryCompany=null;
}
function factionRows(fid){return state.list.filter(r=>r.faction_id===fid)}
function factionPts(fid){return factionRows(fid).reduce((s,r)=>s+rowTotal(r),0)}
// First-added retinue is the Liege; others are Allies. No UI to reorder yet.
function isCombined(){return state.factions.length>1}
function liegeFaction(){return state.factions[0]||null}
function factionRole(fid){return liegeFaction()===fid?'liege':'ally'}
// Promote a faction to Liege by moving it to the front of state.factions
function setLiegeFaction(fid){
  if(!state.factions.includes(fid))return;
  state.factions=[fid,...state.factions.filter(f=>f!==fid)];
}
// Migrate legacy single-faction saves to multi-faction shape
function migrateState(s){
  if(!s||typeof s!=='object')return s;
  if(!Array.isArray(s.factions)){
    s.factions=s.faction?[s.faction]:[];
    delete s.faction;
  }
  if(!('mercenaryCompany' in s))s.mercenaryCompany=null;
  return s;
}

function isCommanderUnit(uData){
  if(!uData)return false;
  if(uData.kind==='commander')return true;
  const m=(uData.full_profile||'').match(/Inherent Abilities: ([^\n]+)/);
  return m?/\bCommander\b/.test(m[1]):false;
}

function getAbilityLimit(unitName){
  const n=(unitName||'').toLowerCase();
  // Tier 3: Barons, Kings — 3 abilities
  if(n.includes('baron')||n.includes('king'))return 3;
  // All other commanders (Lord, Capitano, Burgemeester, Paladin, Serjeant at Arms, Gaelic Lord…) — 2 abilities
  return 2;
}

function parseProfile(profile){
  const res={weaponsMust:[],weaponsMay:[],armor:[],shields:[],mounts:[],cgUpgrades:[],cgMustFrom:'',notes:[]};
  if(!profile)return res;
  // Some entries (Capitano, Outlaw units) store escaped \n instead of real newlines — normalise first.
  const normalised=profile.replace(/\\n/g,'\n');
  for(const rawLine of normalised.split('\n')){
    const line=rawLine.trim();
    const strip=s=>s.split(',').map(w=>w.trim().split(' - ')[0].replace(/\*$/,'').replace(/\s*\([^)]*\)/g,'').trim()).filter(Boolean);
    if(line.startsWith('Weapon, Must'))res.weaponsMust=strip(line.replace(/^Weapon, Must choose one:\s*/,''));
    else if(line.startsWith('Weapon, May'))res.weaponsMay=strip(line.replace(/^Weapon, May choose one:\s*/,''));
    else if(line.startsWith('Armour,'))res.armor=strip(line.replace(/^Armour,.*?choose one:\s*/,''));
    else if(line.startsWith('Shield,'))res.shields=line.replace(/^Shield,.*?choose one:\s*/,'').split(',').map(s=>s.trim().replace(/\s*\([^)]*\)/g,'').replace(/\*$/,'').split(' - ')[0].trim()).filter(s=>s.length>2);
    else if(line.startsWith('Mount,'))res.mounts=strip(line.replace(/^Mount,.*?choose one:\s*/,''));
    else if(line.startsWith('Command Group upgrades:'))res.cgUpgrades=line.replace('Command Group upgrades:','').trim().split(',').flatMap(p=>p.split(/\s+OR\s+/i).map(s=>s.trim())).filter(Boolean);
    else if(line.startsWith('Command Group must be made from:'))res.cgMustFrom=line.replace('Command Group must be made from:','').trim();
    else if(line.startsWith('Note:')||line.startsWith('Mercenary Company:')||line.startsWith('Paladin:'))res.notes.push(line);
  }
  return res;
}

function getInherent(profile){
  const normalised=(profile||'').replace(/\\n/g,'\n');
  const m=normalised.match(/Inherent Abilities: ([^\n]+)/);
  if(!m)return[];
  return m[1].split(',').map(a=>a.trim()).filter(a=>a&&a!=='—'&&a!=='-'&&a!=='None'&&a!=='none');
}

// Built-in glossary for inherent-only abilities not in BW_DATA.purchasable / retinue_abilities
const INHERENT_GLOSSARY={
  COMMANDER:'This unit is a Commander. It may issue Command Actions to other Groups in its Retinue (within Command Range), lead a Command Group, generate its own Attack dice in Melee, target enemy Warriors in base contact, and be targeted by enemy Warriors in base contact.',
  PALADIN:'When selecting a Paladin you must choose one Paladin Ability (Cruelty, Experienced Knight, Glory Seekers, Indomitable, or Inspire). The cost is included in the Commander’s profile. The Paladin counts as having that Ability for all rules purposes (e.g. Command Group purchases like Feud).',
  REPUTATION:'Reputation is everything. The Group and its Commander (if part of the Group) ignore the negative effects of Morale Penalties in Melee Combat.'
};

function selectedAbilityEffect(row, abilityName){
  const upper=(abilityName||'').toUpperCase();
  const retinue=BW_DATA.retinue_abilities.find(a=>a.faction_id===row?.faction_id&&a.ability.toUpperCase()===upper);
  const generic=BW_DATA.purchasable.find(a=>a.name.toUpperCase()===upper);
  return retinue?.effect||generic?.effect||'';
}

function hasRangedWeaponChoice(row, inherent=getInherent(row?.unitData?.full_profile||'')){
  if(inherent.some(a=>/^Weapon Choices?$/i.test(a)))return true;
  return (row?.selAbilities||[]).some(a=>
    /^Weapon Choices?$/i.test(a.name||'') && /Ranged Weapon/i.test(selectedAbilityEffect(row,a.name))
  );
}

function addUniqueItems(items, additions){
  const seen=new Set(items);
  const out=[...items];
  for(const item of additions){
    if(EQUIP[item]&&!seen.has(item)){out.push(item);seen.add(item);}
  }
  return out;
}

function getParsedEquipment(row, parsed=parseProfile(row?.unitData?.full_profile||''), inherent=getInherent(row?.unitData?.full_profile||'')){
  const out={...parsed,weaponsMust:[...parsed.weaponsMust],weaponsMay:[...parsed.weaponsMay]};
  if(hasRangedWeaponChoice(row,inherent))out.weaponsMay=addUniqueItems(out.weaponsMay,WEAPON_CHOICE_RANGED_OPTIONS);
  return out;
}

function getUnitTiers(fid,unit){
  return BW_DATA.units.filter(u=>u.faction_id===fid&&u.unit===unit).sort((a,b)=>(TIER_ORDER[a.experience_tier]||0)-(TIER_ORDER[b.experience_tier]||0));
}

function uniqueUnits(units){
  const map=new Map();
  for(const u of units){
    const k=u.faction_id+'__'+u.unit;
    if(!map.has(k))map.set(k,{...u,tiers:[]});
    map.get(k).tiers.push({tier:u.experience_tier,pts:u.pts_per_warrior,profile:u.full_profile});
  }
  return Array.from(map.values());
}

function getAvailableAbilities(fid){
  const generic=BW_DATA.purchasable.map(a=>({name:a.name,cost:a.cost||0,effect:a.effect||'',source:'generic'}));
  let retinue=BW_DATA.retinue_abilities.filter(a=>a.faction_id===fid).map(a=>({name:a.ability,cost:a.cost||0,effect:a.effect||'',source:'retinue'}));
  // Mercenary Company Abilities: only the retinue's chosen Company is selectable
  if(fid==='mercenary'){
    const chosen=state.mercenaryCompany;
    retinue=retinue.filter(a=>{
      const u=a.name.toUpperCase();
      if(!MERC_COMPANIES.includes(u))return true;
      return chosen&&u===chosen;
    });
  }
  const seen=new Set(generic.map(a=>a.name));
  const out=[...generic];
  for(const a of retinue)if(!seen.has(a.name)){out.push(a);seen.add(a.name);}
  return out.sort((a,b)=>a.name.localeCompare(b.name));
}

function getCommandUpgrade(name){
  const upgrade=CG_UPGRADES[name]||{cost:0,effect:'See core rulebook.'};
  const override=COMMAND_UPGRADE_COST_OVERRIDES[name];
  return override!=null?{...upgrade,cost:override}:upgrade;
}

function getCommandUpgradeCost(name){
  return getCommandUpgrade(name).cost||0;
}

function unitMatchesCGType(unitName,cgMustFrom){
  if(!cgMustFrom)return true;
  const uL=unitName.toLowerCase();
  return cgMustFrom.replace(/\s+or\s+/gi,',').replace(/\([^)]*\)/g,'').split(',').map(t=>t.trim().toLowerCase()).filter(Boolean).some(t=>t&&uL.includes(t));
}

// ═══════════════════════════════════════════════════════════
// COST CALCULATION
// ═══════════════════════════════════════════════════════════
function rowTotal(row){
  const isCmd=row.kind==='commander'||isCommanderUnit(row.unitData);
  const w=isCmd?1:Math.max(1,parseInt(row.warriors)||1);
  const pts=parseInt(row.ptsPerW)||parseInt(row.unitData?.pts_per_warrior)||0;
  const eqC=n=>n?(EQUIP[n]?.cost||0):0;
  const eq=w*(eqC(row.selWeapon)+eqC(row.selOptWeapon)+eqC(row.selArmor)+eqC(row.selShield)+eqC(row.selMount));
  const abi=(row.selAbilities||[]).reduce((s,a)=>s+(a.cost||0),0);
  const cg=(row.selCGUpgrades||[]).reduce((s,u)=>s+getCommandUpgradeCost(u),0);
  const misc=parseInt(row.miscExtra)||0;
  return w*pts+eq+abi+cg+misc;
}
function totalPts(){return state.list.reduce((s,r)=>s+rowTotal(r),0)}

function newRow(fid,unitName,tier,uData){
  const realKind=isCommanderUnit(uData)?'commander':(uData?.kind||'warrior');
  const parsed=parseProfile(uData?.full_profile||'');
  const f=fac(fid);
  return {
    id:state.nextId++,unit:unitName,faction_id:fid,faction_name:f?.faction_name||fid,
    kind:realKind,tier,ptsPerW:uData?.pts_per_warrior||0,
    warriors:realKind==='commander'?1:5,hasRabble:uData?.has_rabble||false,unitData:uData,
    selWeapon:parsed.weaponsMust[0]||null,selOptWeapon:null,
    selArmor:parsed.armor[0]||null,selShield:null,
    selMount:parsed.mounts.length?parsed.mounts[0]:null,
    selAbilities:[],selCGUpgrades:[],miscExtra:0,
    commandGroupRowId:null,commanderRowId:null,
    _openPanel:null,
  };
}

// ═══════════════════════════════════════════════════════════
// FACTION LIST & SIDEBAR
// ═══════════════════════════════════════════════════════════
function renderRetinueList(){
  const c=document.getElementById('retinueList');
  if(!c)return;
  if(!state.factions.length){
    c.innerHTML='<div class="sb-empty">No retinues yet. Add one to begin.</div>';
  } else {
    c.innerHTML=state.factions.map(fid=>{
      const f=fac(fid);
      const sub=factionPts(fid);
      const rows=factionRows(fid).length;
      return `<div class="ret-row active">
        <div class="ret-row-main">
          <div class="ret-row-name">${esc(f?.faction_name||fid)}</div>
          <div class="ret-row-meta"><span>${rows} unit${rows===1?'':'s'}</span><span>·</span><span>${sub} pts</span></div>
        </div>
        <div class="ret-row-actions">
          <button class="ret-act-btn del" title="Remove retinue" onclick="uiRemoveFaction('${fid}')">✕</button>
        </div>
      </div>`;
    }).join('');
  }
  const lb=document.getElementById('sbListBuilder');
  if(lb)lb.style.display=state.factions.length?'block':'none';
  const lbHd=document.getElementById('sbLbHeading');
  if(lbHd)lbHd.textContent='List Builder';
}

function renderFactionPicker(open){
  const p=document.getElementById('factionPicker');
  const btn=document.getElementById('sbAddRetBtn');
  if(!p||!btn)return;
  p.style.display=open?'flex':'none';
  btn.classList.toggle('open',!!open);
  btn.textContent=open?'× Cancel':'+ Add Retinue';
  if(!open)return;
  const available=BW_DATA.factions.filter(f=>!hasFaction(f.faction_id));
  if(!available.length){p.innerHTML='<div class="sb-empty">All retinues already added.</div>';return;}
  p.innerHTML=available.map(f=>`<button class="faction-btn" onclick="uiAddFaction('${f.faction_id}')">${esc(f.faction_name)}</button>`).join('');
}

function toggleAddRetinue(){
  const p=document.getElementById('factionPicker');
  renderFactionPicker(p?.style.display==='none');
}

function uiAddFaction(fid){
  addFaction(fid);
  renderFactionPicker(false);
  refreshAll();
}

function uiRemoveFaction(fid){
  const rows=factionRows(fid).length;
  const f=fac(fid);
  const msg=rows?`Remove ${f?.faction_name||fid} and its ${rows} unit row${rows===1?'':'s'}?`:`Remove ${f?.faction_name||fid}?`;
  if(!confirm(msg))return;
  removeFaction(fid);
  refreshAll();
}

function uiSetLiege(fid){
  setLiegeFaction(fid);
  refreshAll();
}

function setMercenaryCompany(name){
  const newCompany=name||null;
  if(state.mercenaryCompany===newCompany)return;
  // Strip any existing company abilities that don't match the new selection from Mercenary unit rows
  const allow=new Set(newCompany?[newCompany]:[]);
  for(const r of state.list){
    if(r.faction_id!=='mercenary')continue;
    if(!r.selAbilities)continue;
    r.selAbilities=r.selAbilities.filter(a=>!MERC_COMPANIES.includes(a.name.toUpperCase())||allow.has(a.name.toUpperCase()));
  }
  state.mercenaryCompany=newCompany;
  refreshAll();
}

// Render everything that depends on faction selection
function refreshAll(){
  renderRetinueList();
  renderRetinue();
  renderBrowse();
  renderCharsBrowse();
  renderRules();
}

function getFactChars(fid){
  const label=facLabel(fid).toLowerCase().split(' ')[0].toLowerCase();
  const chars=BW_DATA.dramatis.filter(d=>(d.retinues||'').toLowerCase().includes(label));
  const list=chars.length?chars:BW_DATA.dramatis;
  return list.map(d=>({...d,unit:d.name}));
}

// Pick which faction to add to. If only one selected, use it. Else, prompt.
function pickAddFaction(){
  if(!state.factions.length)return null;
  if(state.factions.length===1)return state.factions[0];
  const labels=state.factions.map((fid,i)=>`${i+1}. ${facLabel(fid)}`).join('\n');
  const ans=prompt(`Add to which retinue?\n\n${labels}\n\nEnter number:`,'1');
  if(!ans)return null;
  const idx=parseInt(ans)-1;
  return state.factions[idx]||null;
}

function openSBUnitModal(fid){
  fid=fid||pickAddFaction();
  if(!fid){alert('Add a Retinue first.');return;}
  const warriors=uniqueUnits(BW_DATA.units.filter(u=>u.faction_id===fid&&!isCommanderUnit(u)));
  const first=warriors.length?warriors[0]:uniqueUnits(BW_DATA.units.filter(u=>u.faction_id===fid))[0];
  if(!first){alert('No units available for this retinue.');return;}
  openUBNew(fid,first.unit,'Regular');
}

function openSBCharModal(fid){
  fid=fid||pickAddFaction();
  if(!fid){alert('Add a Retinue first.');return;}
  const chars=getFactChars(fid);
  if(!chars.length){alert('No named characters available for this retinue.');return;}
  const d=chars[0];
  const f=fac(fid);
  _ub={
    _isNew:true,_isChar:true,
    unit:d.name,faction_id:fid,faction_name:f?.faction_name||fid,
    kind:'commander',tier:'Named',ptsPerW:parseInt((d.points_note||'0').replace(/\D/g,''))||0,
    warriors:1,hasRabble:false,unitData:null,
    selWeapon:null,selOptWeapon:null,selArmor:null,selShield:null,selMount:null,
    selAbilities:[],selCGUpgrades:[],miscExtra:0,commandGroupRowId:null,commanderRowId:null,_openPanel:null,
  };
  document.getElementById('ubTitle').textContent='Add Character';
  renderUB();
  document.getElementById('ubOverlay').classList.add('open');
}

function ubChangeChar(charName){
  const fid=_ub.faction_id;
  const chars=getFactChars(fid);
  const d=chars.find(c=>c.name===charName);
  if(!d)return;
  _ub.unit=d.name;_ub.tier='Named';
  _ub.ptsPerW=parseInt((d.points_note||'0').replace(/\D/g,''))||0;
  _ub.unitData=null;_ub.kind='commander';_ub.warriors=1;
  _ub.selWeapon=null;_ub.selOptWeapon=null;_ub.selArmor=null;_ub.selShield=null;_ub.selMount=null;
  _ub.selAbilities=[];_ub.selCGUpgrades=[];
  renderUB();
}

// ═══════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════
function initTabs(){
  initBrowseFilters();
  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.tab-btn[data-tab]').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
      if(btn.dataset.tab==='units')renderBrowse();
    });
  });
  document.querySelectorAll('.sub-tab-btn[data-sub]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.sub-tab-btn[data-sub]').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.sub-panel').forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('sub-'+btn.dataset.sub).classList.add('active');
      if(btn.dataset.sub==='browse-chars')renderCharsBrowse();
    });
  });
}
function switchTab(tab){
  document.querySelectorAll('.tab-btn[data-tab]').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
  document.getElementById('tab-'+tab)?.classList.add('active');
}

function initBrowseFilters(){
  const options=[
    '<option value="">All Retinues</option>',
    ...BW_DATA.factions.map(f=>`<option value="${esc(f.faction_id)}">${esc(f.faction_name)}</option>`)
  ].join('');
  const factionFilter=document.getElementById('browseFactionFilter');
  if(factionFilter)factionFilter.innerHTML=options;
  const charsFactionFilter=document.getElementById('charsFactionFilter');
  if(charsFactionFilter)charsFactionFilter.innerHTML=options;
}

// ═══════════════════════════════════════════════════════════
// POINTS BAR + ALERTS
// ═══════════════════════════════════════════════════════════
function updatePtsBar(){
  const spent=totalPts(),cap=state.ptsCap;
  const pct=Math.min(100,(spent/cap)*100);
  const fill=document.getElementById('ptsBarFill');
  const nums=document.getElementById('ptsNums');
  fill.style.width=pct+'%';
  fill.className='pts-bar-fill'+(pct>=100?' over':pct>=80?' warn':'');
  nums.className='pts-nums'+(pct>=100?' over':'');
  document.getElementById('ptsSpent').textContent=spent;
  document.getElementById('ptsCap2').textContent=cap;
  const tp=document.getElementById('retinueTotalPts');
  if(tp){tp.textContent=spent;tp.className='rt-pts'+(spent>cap?' over':'');}
  renderAlerts(spent);
}

// Heuristic: cavalry if mounted unit name, equipped mount, or has horsemen-style name
function isCavalryRow(row){
  const u=(row.unit||'').toLowerCase();
  if(u.startsWith('mounted ')||u.includes('horsem')||u.includes('light cavalry'))return true;
  if(row.selMount&&EQUIP[row.selMount]?.kind==='mount')return true;
  return false;
}

// Names mandated to be the Retinue Leader if included in the list
const MANDATORY_LEADER_NAMES=new Set(['King John','King Alexander II','Robin Hood','King Philip II of France','Prince Louis of France','Welsh King','Mounted Welsh King']);
// Mercenary Company Abilities (only one allowed per Mercenary Retinue)
const MERC_COMPANY_ABILITIES=new Set(['BRABANCON','BRABANÇON','FLEMISH','GASCON']);

// Per-faction legality checks. Returns {alerts, infos} for one faction's slice of the list.
function checkFactionLegality(fid){
  const alerts=[],infos=[];
  const f=fac(fid);
  const rows=factionRows(fid);
  if(!rows.length)return{alerts,infos};
  const spent=factionPts(fid);
  const cmds=rows.filter(r=>r.kind==='commander');
  const warriors=rows.filter(r=>r.kind!=='commander');
  const label=facLabel(fid);

  if(!cmds.length)alerts.push(`⚠ ${label}: no Commander (every Retinue needs at least one)`);

  // 50% Commanders + Command Groups cap (per retinue)
  if(spent>0){
    const seen=new Set();let cmdPts=0;
    for(const c of cmds){
      if(!seen.has(c.id)){cmdPts+=rowTotal(c);seen.add(c.id);}
      if(c.commandGroupRowId){
        const cg=rows.find(r=>r.id===c.commandGroupRowId);
        if(cg&&!seen.has(cg.id)){cmdPts+=rowTotal(cg);seen.add(cg.id);}
      }
    }
    const pct=(cmdPts/spent)*100;
    if(pct>50)alerts.push(`⚠ ${label}: Commanders + Command Groups ${pct.toFixed(0)}% of retinue (max 50%)`);
  }

  if(f?.green_min_pct>0){
    const gp=rows.filter(r=>r.tier==='Green').reduce((s,r)=>s+rowTotal(r),0);
    const pct=spent>0?(gp/spent)*100:0;
    if(pct<f.green_min_pct)alerts.push(`⚠ ${label}: Green troops ${pct.toFixed(0)}% (min ${f.green_min_pct}%)`);
  }
  if(f?.rabble_min_pct){
    // Per supplement: only Green or Irregular rabble-flagged groups count
    const rp=rows.filter(r=>r.hasRabble&&(r.tier==='Green'||r.tier==='Irregular')).reduce((s,r)=>s+rowTotal(r),0);
    const pct=spent>0?(rp/spent)*100:0;
    if(pct<f.rabble_min_pct)alerts.push(`⚠ ${label}: Rabble Groups ${pct.toFixed(0)}% (Horseless Classes requires ${f.rabble_min_pct}% on Green/Irregular Light Cavalry, Bowmen or Gaelic Levies)`);
  }

  for(const r of warriors){
    const w=parseInt(r.warriors)||1;
    const cav=isCavalryRow(r);
    const min=cav?2:4;
    if(w<min)alerts.push(`⚠ ${label}: ${esc(r.unit)} ×${w} below min Group size (${min} ${cav?'cavalry':'infantry'})`);
  }

  for(const c of cmds)if(!c.commandGroupRowId)alerts.push(`⚠ ${label}: ${esc(c.unit)} has no Command Group assigned`);

  const purchasableNames=new Set(BW_DATA.purchasable.map(a=>a.name));
  const abilityCounts={};
  for(const r of rows)for(const a of (r.selAbilities||[]))abilityCounts[a.name]=(abilityCounts[a.name]||0)+1;
  for(const[name,count]of Object.entries(abilityCounts)){
    if(count>1&&purchasableNames.has(name))alerts.push(`⚠ ${label}: Purchasable Ability "${esc(name)}" used ${count}× (once per Retinue)`);
  }

  const namedCounts={};
  for(const r of rows)if(r.tier==='Named')namedCounts[r.unit]=(namedCounts[r.unit]||0)+1;
  for(const[name,count]of Object.entries(namedCounts)){
    if(count>1)alerts.push(`⚠ ${label}: Named character "${esc(name)}" included ${count}× (one of each)`);
  }

  if(fid==='poitevin'){
    const baronRows=rows.filter(r=>/baron/i.test(r.unit||''));
    if(baronRows.length)alerts.push('⚠ Poitevin: Barons (Tier 3 Commanders) are not allowed');
    const paladins=rows.filter(r=>/paladin/i.test(r.unit||''));
    if(paladins.length)infos.push('ℹ Poitevin: a Paladin may not be the Retinue Leader at list-build (may take command if the Leader dies)');
  }
  if(fid==='welsh'){
    const penteulu=rows.filter(r=>(r.selAbilities||[]).some(a=>a.name.toUpperCase()==='PENTEULU'));
    if(penteulu.length>1)alerts.push(`⚠ Welsh: ${penteulu.length} Penteulu selected (max 1)`);
    if(penteulu.length)infos.push('ℹ Welsh: a Penteulu cannot be the Retinue Leader');
  }
  if(fid==='medieval_scottish'){
    const ettrick=rows.filter(r=>(r.selAbilities||[]).some(a=>a.name.toUpperCase()==='ETTRICK ARCHERS'));
    if(ettrick.length>1)alerts.push(`⚠ Scottish: Ettrick Archers used ${ettrick.length}× (once per Retinue)`);
  }
  if(fid==='mercenary'){
    const companies=new Set();
    for(const r of rows)for(const a of (r.selAbilities||[]))if(MERC_COMPANY_ABILITIES.has(a.name.toUpperCase()))companies.add(a.name.toUpperCase());
    if(companies.size>1)alerts.push(`⚠ Mercenary: ${companies.size} Company Abilities present (${[...companies].join(', ')}); only one allowed`);
    else if(companies.size===1&&state.mercenaryCompany&&!companies.has(state.mercenaryCompany))alerts.push(`⚠ Mercenary: a unit has a Company Ability (${[...companies][0]}) that doesn't match the retinue's selection (${state.mercenaryCompany})`);
    if(state.mercenaryCompany)infos.push(`ℹ Mercenary Company: ${state.mercenaryCompany} — units may take this as an additional Inherent Ability for the listed cost`);
    const capitano=rows.find(r=>/capitano/i.test(r.unit||''));
    if(capitano&&capitano.commandGroupRowId){
      const cg=rows.find(r=>r.id===capitano.commandGroupRowId);
      const cgCo=cg&&(cg.selAbilities||[]).find(a=>MERC_COMPANY_ABILITIES.has(a.name.toUpperCase()));
      const capCo=(capitano.selAbilities||[]).find(a=>MERC_COMPANY_ABILITIES.has(a.name.toUpperCase()));
      if(cgCo&&!capCo)alerts.push(`⚠ Mercenary: Capitano's Command Group has ${esc(cgCo.name)} — the Capitano must also take this Company Ability`);
    }
    const mercLord=rows.find(r=>/^mercenary (mounted )?lord$/i.test(r.unit||''));
    if(mercLord&&mercLord.commandGroupRowId){
      const cg=rows.find(r=>r.id===mercLord.commandGroupRowId);
      if(cg&&!/knight/i.test(cg.unit||''))alerts.push(`⚠ Mercenary Lord's Command Group must be Knights (currently: ${esc(cg.unit)})`);
    }
  }

  // Marcher unlock messaging is handled at the combined-list level in collectAlerts()
  const leaderUnits=new Set();
  for(const r of rows)if(MANDATORY_LEADER_NAMES.has(r.unit))leaderUnits.add(r.unit);
  for(const name of leaderUnits)infos.push(`ℹ ${esc(name)} must be designated as the Retinue Leader`);

  return{alerts,infos};
}

// Collect all alerts/infos for the current state. Pure function over state.
function collectAlerts(spent){
  const alerts=[],infos=[];
  if(!state.factions.length||!state.list.length)return{alerts,infos};

  // ── COMBINED-LIST RULES ─────────────────────────────────
  if(spent>state.ptsCap)alerts.push(`⚠ ${isCombined()?'Combined retinues':'Retinue'} over cap by ${spent-state.ptsCap} pts`);
  if(liegeFaction()==='outlaw'){
    if(isCombined())alerts.push('⚠ Outlaw cannot be the Liege Retinue — promote another retinue with the ★ Liege button, or remove and re-add Outlaw as an Ally');
    else alerts.push('⚠ Outlaw Retinues may only be fielded as Allies — add a non-Outlaw retinue to act as the Liege');
  } else if(state.factions.includes('outlaw')){
    infos.push('ℹ Outlaw is correctly placed as an Ally (its Leader may never be the Liege Lord)');
  }
  // Marcher: Feudal European Liege Leader Ability that unlocks Welsh allied Groups (no Commanders, ≤⅓ pts)
  if(liegeFaction()==='feudal_european'){
    const liegeRows=factionRows('feudal_european');
    const hasMarcher=liegeRows.some(r=>(r.selAbilities||[]).some(a=>a.name.toUpperCase()==='MARCHER'));
    const welshAllied=isCombined()&&state.factions.includes('welsh');
    if(hasMarcher&&!welshAllied){
      infos.push('ℹ Marcher unlocked: add Welsh as an Allied retinue to spend up to ⅓ of points on Welsh Groups (Welsh Commanders not permitted under Marcher)');
    }
    if(hasMarcher&&welshAllied){
      const welshRows=factionRows('welsh');
      const welshCmds=welshRows.filter(r=>r.kind==='commander');
      if(welshCmds.length){
        alerts.push(`⚠ Marcher: ${welshCmds.length} Welsh Commander${welshCmds.length===1?'':'s'} present — Marcher only allows Welsh Groups (warriors), not Commanders`);
      }
      if(spent>0){
        const welshAllyPts=welshRows.filter(r=>r.kind!=='commander').reduce((s,r)=>s+rowTotal(r),0);
        const pct=(welshAllyPts/spent)*100;
        const cap=spent/3;
        if(welshAllyPts>cap)alerts.push(`⚠ Marcher: Welsh allied Groups ${pct.toFixed(0)}% of points (cap is ⅓ — limit ${Math.floor(cap)} pts, currently ${welshAllyPts})`);
        else infos.push(`ℹ Marcher: Welsh allied Groups ${welshAllyPts}/${Math.floor(cap)} pts (⅓ cap)`);
      }
    }
    if(welshAllied&&!hasMarcher){
      alerts.push('⚠ Welsh allied to Feudal European requires the Liege Leader to take the Marcher Ability (or pick a different Liege)');
    }
  }

  // ── PER-RETINUE RULES ──────────────────────────────────
  for(const fid of state.factions){
    const{alerts:a,infos:i}=checkFactionLegality(fid);
    alerts.push(...a);infos.push(...i);
  }
  return{alerts,infos};
}

function renderAlerts(spent){
  const{alerts,infos}=collectAlerts(spent);
  renderSidebarIssues(alerts,infos);
}

// Mirror of the alert bar in the sidebar, under the List Builder buttons
function renderSidebarIssues(alerts,infos){
  const box=document.getElementById('sidebarIssues');
  if(!box)return;
  if(!state.factions.length||!state.list.length){box.innerHTML='';box.style.display='none';return;}
  if(!alerts.length&&!infos.length){
    box.style.display='block';
    box.className='sb-issues ok';
    box.innerHTML=`<div class="sb-issues-hd">✓ List Legal</div>`;
    return;
  }
  box.style.display='block';
  box.className='sb-issues '+(alerts.length?'error':'info');
  const items=[...alerts,...infos].map(a=>`<div class="sb-issues-item">${a}</div>`).join('');
  box.innerHTML=`<div class="sb-issues-hd">${alerts.length?`⚠ List Issues (${alerts.length})`:'ℹ Notes'}</div><div class="sb-issues-body">${items}</div>`;
}

// ═══════════════════════════════════════════════════════════
// FACTION HEADER
// ═══════════════════════════════════════════════════════════
// Render one header card per selected faction, stacked
function renderRetinueFactionHdr(){
  const hdr=document.getElementById('retinueFactionHdr');
  if(!hdr)return;
  if(!state.factions.length){hdr.style.display='none';hdr.innerHTML='';return;}
  hdr.style.display='block';
  const combinedPill=isCombined()?`<div class="combined-pill">⚭ Combined Retinue · ${state.factions.length} retinues · Liege: ${esc(facLabel(liegeFaction()))}</div>`:'';
  const multi=isCombined();
  hdr.innerHTML=combinedPill+state.factions.map(fid=>{
    const f=fac(fid);
    const traits=BW_DATA.faction_traits.filter(t=>t.faction_id===fid);
    const sub=factionPts(fid);
    const role=factionRole(fid);
    const badge=multi?`<span class="ret-badge ${role}">${role==='liege'?'Liege':'Ally'}</span>`:'';
    const liegeBtn=multi&&role==='ally'?`<button class="ret-group-liege" title="Promote this retinue to Liege" onclick="uiSetLiege('${fid}')">★ Make Liege</button>`:'';
    // Mercenary Company picker (only on the Mercenary card)
    let mercCompanyHtml='';
    if(fid==='mercenary'){
      const sel=state.mercenaryCompany||'';
      mercCompanyHtml=`<div class="merc-company-row">
        <label class="merc-company-lbl">Mercenary Company</label>
        <select class="merc-company-sel" onchange="setMercenaryCompany(this.value)">
          <option value="" ${!sel?'selected':''}>— None chosen —</option>
          <option value="BRABANCON" ${sel==='BRABANCON'?'selected':''}>Brabançon (+2 pts/Group)</option>
          <option value="FLEMISH" ${sel==='FLEMISH'?'selected':''}>Flemish (+1 pt/Group)</option>
          <option value="GASCON" ${sel==='GASCON'?'selected':''}>Gascon (+2 pts/Group)</option>
        </select>
      </div>`;
    }
    return `<div class="faction-hdr">
      <div class="faction-hdr-body">
        <div class="faction-hdr-name">⚜ ${esc(f?.faction_name||fid)} ${badge}</div>
        <div class="faction-hdr-sub">${sub} pts</div>
        <div class="faction-hdr-traits">
          ${traits.map(t=>LITE_MODE
            ? `<span class="faction-trait-tag">${esc(t.trait)}</span>`
            : `<div class="trait-tooltip-wrap">
                <span class="faction-trait-tag">${esc(t.trait)}</span>
                <div class="trait-tooltip">${esc(t.description||'')}</div>
              </div>`).join('')}
        </div>
        ${mercCompanyHtml}
        ${!LITE_MODE&&f?.restriction_notes?`<div class="faction-hdr-note">${esc(f.restriction_notes)}</div>`:''}
        ${!LITE_MODE&&f?.green_min_pct?`<div class="faction-hdr-note">Min. ${f.green_min_pct}% points on Green troops.${f.rabble_min_pct?` Min. ${f.rabble_min_pct}% on Rabble.`:''}</div>`:''}
      </div>
      <div class="faction-hdr-actions">
        <button class="ret-group-add" onclick="openSBUnitModal('${fid}')">+ Units</button>
        <button class="ret-group-add" onclick="openSBCharModal('${fid}')">+ Characters</button>
        ${liegeBtn}
      </div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════
// RETINUE CARDS
// ═══════════════════════════════════════════════════════════

function renderBrowse(){
  const container=document.getElementById('browseGrid');
  if(!container)return;
  const search=(document.getElementById('browseSearch')?.value||'').toLowerCase();
  const factionFilter=document.getElementById('browseFactionFilter')?.value||'';
  const kind=document.getElementById('browseKindFilter')?.value||'';
  let units=factionFilter?BW_DATA.units.filter(u=>u.faction_id===factionFilter):BW_DATA.units;
  if(kind==='commander')units=units.filter(u=>isCommanderUnit(u));
  else if(kind==='warrior')units=units.filter(u=>!isCommanderUnit(u));
  if(search)units=units.filter(u=>u.unit.toLowerCase().includes(search)||(u.full_profile||'').toLowerCase().includes(search));
  const grouped=uniqueUnits(units);
  if(!grouped.length){
    container.innerHTML=`<div style="grid-column:1/-1;color:var(--text3);text-align:center;padding:40px 0">No units found for the current filters.</div>`;
    return;
  }
  container.innerHTML=grouped.map(u=>{
    const isCmd=isCommanderUnit(u);
    const tiers=u.tiers.sort((a,b)=>(TIER_ORDER[a.tier]||0)-(TIER_ORDER[b.tier]||0));
    const abMatch=(u.full_profile||'').match(/Inherent Abilities: ([^\n]+)/);
    const abs=abMatch?abMatch[1]:'';
    return `<div class="browse-card ${isCmd?'is-commander':'is-warrior'}">
      <div class="bc-hdr">
        <div class="bc-name">${esc(u.unit)}</div>
        <span class="bc-kind ${isCmd?'commander':'warrior'}">${isCmd?'commander':'warrior'}</span>
      </div>
      ${abs?`<div class="bc-abilities">${esc(abs)}</div>`:''}
      <div class="bc-tiers">${tiers.map(t=>`<span class="bc-tier">${t.tier}: ${t.pts}pts</span>`).join('')}</div>
      <div class="bc-faction">${esc(u.faction_name)}</div>
    </div>`;
  }).join('');
}

function renderCharsBrowse(){
  const container=document.getElementById('charsBrowseList');
  if(!container)return;
  const search=(document.getElementById('charsBrowseSearch')?.value||'').toLowerCase();
  const fid=document.getElementById('charsFactionFilter')?.value||'';
  let displayed=fid?BW_DATA.dramatis.filter(d=>(d.retinues||'').toLowerCase().includes(facLabel(fid).toLowerCase().split(' ')[0])):BW_DATA.dramatis;
  if(search){
    displayed=displayed.filter(d=>
      (d.name||'').toLowerCase().includes(search)||
      (d.retinues||'').toLowerCase().includes(search)||
      (d.profile_and_rules||'').toLowerCase().includes(search)||
      (d.character_abilities||'').toLowerCase().includes(search)
    );
  }
  if(!displayed.length){
    container.innerHTML=`<div style="color:var(--text3);text-align:center;padding:40px 0">No characters found for the current filters.</div>`;
    return;
  }
  container.innerHTML=displayed.map((d,i)=>`
    <div class="char-browse-card" id="cbc-${i}" onclick="this.classList.toggle('open')">
      <div class="cbc-name">♛ ${esc(d.name)}</div>
      <div class="cbc-retinues">${esc(d.retinues)}</div>
      <div style="font-size:.74rem;color:var(--amber2);font-style:italic">${esc(d.points_note)}</div>
      <div class="cbc-body">
        <div style="margin-bottom:8px">${esc(d.profile_and_rules||'')}</div>
        ${d.character_abilities?`<div class="cbc-abilities">${esc(d.character_abilities).replace(/•\s*/g,'\n• ')}</div>`:``}
      </div>
    </div>`).join('');
}

// ═══════════════════════════════════════════════════════════
// RULES TAB
// ═══════════════════════════════════════════════════════════
// Rules tab: persistent retinue filter (independent of state.factions)
let _rulesFilterFid=null;
function setRulesFilter(fid){
  _rulesFilterFid=fid||null;
  renderRules();
}

function renderRules(){
  const panel=document.getElementById('rulesPanel');
  if(!panel)return;
  let html='<div class="rules-sections">';

  // ── SYSTEM-WIDE RULES (always visible) ─────────────────
  html+=ruleSec('⚖ Global & Optional Rules',BW_DATA.global_rules.map(r=>`<div class="trait-card"><div class="trait-card-name">${esc(r.topic)}</div><div class="trait-card-text">${esc(r.text||'')}</div></div>`).join(''));

  const alliedRules=[
    {topic:'Liege & Allied Retinues',text:'A combined force is built from one Liege Retinue and one or more Allied Retinues. The Liege Retinue Leader is the overall commander of the force. Each Retinue is built independently using its own list, then the totals are added together against the agreed points cap.'},
    {topic:'Per-Retinue Restrictions Still Apply',text:'Every Retinue in a combined force must satisfy its own restrictions: the 50% Commanders + Command Groups cap, minimum Group sizes (4 infantry / 2 cavalry), at least one Commander, faction-specific minimums (Green%, Rabble%), and "may only be chosen once per Retinue" abilities (e.g. Ettrick Archers, Penteulu, Mercenary Company Abilities).'},
    {topic:'Outlaw Retinues',text:'An Outlaw Retinue may only ever be fielded as an Allied Retinue. The Outlaw Retinue Leader can never be the Liege Lord. In this builder, the first retinue you add becomes the Liege — add a non-Outlaw retinue first, then add Outlaw as an Ally.'},
    {topic:'Mandatory Liege Leaders',text:'Some named characters must be the Retinue Leader of their Retinue when included: King John (Feudal European or Poitevin), King Alexander II (Medieval Scottish or Feudal European), Robin Hood (Outlaw), King Philip II of France, Prince Louis of France, and the Welsh King.'},
    {topic:'Marcher (Feudal European)',text:'If the Liege Retinue is Feudal European and the Retinue Leader purchases the Marcher Ability, you may spend up to one third of the total combined points on Groups (but NOT Commanders) chosen from the Welsh list. Welsh Groups use the Liege Leader\'s Morale and Command Actions, with a -1 penalty to Order checks when using his Command Actions.'},
    {topic:'Cross-Retinue Command',text:'A Commander may only issue Command Actions to and use the Command Group rules with units from his own Retinue, except where a faction-specific Ability (such as Marcher) explicitly grants cross-Retinue authority.'},
  ];
  html+=ruleSec('⚭ Allied / Combined Retinue Rules',alliedRules.map(r=>`<div class="trait-card"><div class="trait-card-name">${esc(r.topic)}</div><div class="trait-card-text">${esc(r.text)}</div></div>`).join(''));

  html+=ruleSec('✦ Universal Abilities',BW_DATA.purchasable.map((a,i)=>abiRefItem(a.name,a.cost,a.effect,'gen-'+i)).join(''));

  // Equipment reference
  const kinds=['melee','missile','armour_shield','mount'];
  const kindLabels={melee:'⚔ Melee Weapons',missile:'🏹 Ranged Weapons',armour_shield:'🛡 Armour & Shields',mount:'🐴 Mounts'};
  for(const k of kinds){
    const items=BW_DATA.equipment.filter(e=>e.kind===k);
    if(!items.length)continue;
    html+=ruleSec(kindLabels[k],`<table class="equip-ref-table"><thead><tr><th>Name</th><th>Modifier</th><th>Effect</th><th style="text-align:center">Pts/W</th></tr></thead><tbody>${
      items.map(e=>`<tr><td class="name-col">${esc(e.name)}</td><td>${esc((e.modifier||'—').replace('\n',', '))}</td><td>${esc(e.effect||'—')}</td><td class="cost-col">${e.cost!=null?e.cost:'—'}</td></tr>`).join('')
    }</tbody></table>`);
  }

  // Dramatis Personae
  html+=ruleSec('👑 Dramatis Personae',`<div class="note-box">Points costs are in the printed King John supplement.</div>`+
    BW_DATA.dramatis.map((d,i)=>`
      <div class="char-browse-card" onclick="this.classList.toggle('open')" style="margin-bottom:7px">
        <div class="cbc-name">${esc(d.name)}</div>
        <div class="cbc-retinues">${esc(d.retinues)}</div>
        <div style="font-size:.74rem;color:var(--amber2);font-style:italic">${esc(d.points_note)}</div>
        <div class="cbc-body">
          <div style="margin-bottom:8px">${esc(d.profile_and_rules||'')}</div>
          ${d.character_abilities?`<div class="cbc-abilities">${esc(d.character_abilities).replace(/•\s*/g,'\n• ')}</div>`:``}
        </div>
      </div>`).join(''));

  // ── RETINUE-SPECIFIC RULES (filtered by dropdown) ─────
  const fid=_rulesFilterFid;
  const filterDropdown=`<div class="rules-filter-row">
    <label class="rules-filter-lbl">Show retinue:</label>
    <select class="rules-filter-sel" onchange="setRulesFilter(this.value)">
      <option value="">— Select a retinue —</option>
      ${BW_DATA.factions.map(f=>`<option value="${esc(f.faction_id)}" ${fid===f.faction_id?'selected':''}>${esc(f.faction_name)}</option>`).join('')}
    </select>
  </div>`;
  let retBody=filterDropdown;
  if(fid){
    const f=fac(fid);
    const traits=BW_DATA.faction_traits.filter(t=>t.faction_id===fid);
    const abilities=BW_DATA.retinue_abilities.filter(a=>a.faction_id===fid);
    // Collect Command Group upgrade names mentioned in this faction's unit profiles.
    // Some profiles (e.g. Outlaw) store escaped \n instead of real newlines — normalize first.
    const cgNames=new Set();
    for(const u of BW_DATA.units.filter(u=>u.faction_id===fid)){
      const profile=(u.full_profile||'').replace(/\\n/g,'\n');
      const m=profile.match(/Command Group upgrades:\s*([^\n]+)/);
      if(!m)continue;
      m[1].split(',').flatMap(p=>p.split(/\s+OR\s+/i)).map(s=>s.trim()).filter(Boolean).forEach(n=>cgNames.add(n));
    }
    const cgItems=[...cgNames].map((n,i)=>{
      const cu=BW_DATA.command_upgrades.find(c=>c.name===n)||{cost:CG_UPGRADES[n]?.cost,effect:CG_UPGRADES[n]?.effect||''};
      const cost=COMMAND_UPGRADE_COST_OVERRIDES[n]??cu.cost;
      return abiRefItem(n,cost,cu.effect||'',fid+'-cg-'+i);
    }).join('');
    retBody+=`<div class="rules-retinue-block">
      <div class="rules-sub-hd">Faction Traits</div>
      ${traits.map(t=>`<div class="trait-card"><div class="trait-card-name">${esc(t.trait)}</div><div class="trait-card-text">${esc(t.description||'')}</div></div>`).join('')}
      ${f?.restriction_notes?`<div class="amber-box">${esc(f.restriction_notes)}</div>`:''}
      ${abilities.length?`<div class="rules-sub-hd">Retinue-Specific Abilities</div>${abilities.map((a,i)=>abiRefItem(a.ability,a.cost,a.effect,fid+'-'+i)).join('')}`:''}
      ${cgItems?`<div class="rules-sub-hd">Command Group Upgrades</div>${cgItems}`:''}
    </div>`;
  } else {
    retBody+=`<div class="rules-filter-empty">Select a retinue above to see its faction traits and retinue-specific abilities.</div>`;
  }
  html+=ruleSec('⚜ Retinue-Specific Rules',retBody);

  html+='</div>';
  panel.innerHTML=html;
  // Attach collapse toggles
  panel.querySelectorAll('.rules-section-hdr').forEach(h=>{
    h.addEventListener('click',()=>{
      const body=h.nextElementSibling;
      body.classList.toggle('collapsed');
      h.querySelector('.arrow').textContent=body.classList.contains('collapsed')?'▶':'▼';
    });
  });
  // Ability expand
  panel.querySelectorAll('.abi-ref-item').forEach(el=>{
    el.addEventListener('click',()=>el.classList.toggle('open'));
  });
}

function ruleSec(title,bodyHtml){
  return `<div><div class="rules-section-hdr"><span>${title}</span><span class="arrow">▼</span></div>
    <div class="rules-section-body">${bodyHtml}</div></div>`;
}
function abiRefItem(name,cost,effect,key){
  const cs=cost!=null?`${cost} pts`:'Inherent';
  return `<div class="abi-ref-item" id="aref-${key}">
    <div class="abi-ref-hdr"><span class="abi-ref-name">${esc(name)}</span><span class="abi-ref-cost">${esc(cs)}</span></div>
    <div class="abi-ref-effect">${esc(effect||'')}</div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════
// SAVE / LOAD
// ═══════════════════════════════════════════════════════════
function getSaved(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}catch{return{}}}
function setSaved(o){localStorage.setItem(STORAGE_KEY,JSON.stringify(o))}
function openSaveModal(){renderSavedList();document.getElementById('saveModalOverlay').classList.add('open')}
function closeSaveModal(){document.getElementById('saveModalOverlay').classList.remove('open')}
function doSave(){
  const name=document.getElementById('saveNameInput').value.trim();
  if(!name){alert('Enter a name.');return;}
  const saves=getSaved();
  const stripped=state.list.map(r=>{const c={...r};delete c.unitData;return c;});
  saves[name]={schema:3,factions:[...state.factions],ptsCap:state.ptsCap,mercenaryCompany:state.mercenaryCompany,list:stripped,savedAt:new Date().toLocaleString()};
  setSaved(saves);document.getElementById('saveNameInput').value='';renderSavedList();
}
function doLoad(name){
  const saves=getSaved();const s=migrateState(saves[name]);if(!s)return;
  state.factions=Array.isArray(s.factions)?[...s.factions]:[];
  state.ptsCap=s.ptsCap||500;
  state.mercenaryCompany=s.mercenaryCompany||null;
  state.list=(s.list||[]).map(r=>{
    const uData=BW_DATA.units.find(u=>u.faction_id===r.faction_id&&u.unit===r.unit&&u.experience_tier===r.tier)||null;
    return{...r,unitData:uData,kind:uData?(isCommanderUnit(uData)?'commander':uData.kind):r.kind,_openPanel:null};
  });
  // Make sure every row's faction is also in state.factions (backfill from row data)
  for(const r of state.list)if(r.faction_id&&!state.factions.includes(r.faction_id))state.factions.push(r.faction_id);
  state.nextId=Math.max(0,...state.list.map(r=>r.id))+1;
  document.getElementById('ptsCap').value=state.ptsCap;
  closeSaveModal();
  refreshAll();
}
function doDelete(name){if(!confirm(`Delete "${name}"?`))return;const s=getSaved();delete s[name];setSaved(s);renderSavedList()}
function renderSavedList(){
  const c=document.getElementById('savedListContainer');const s=getSaved();const keys=Object.keys(s);
  if(!keys.length){c.innerHTML=`<div style="color:var(--text3);font-size:.82rem;padding:10px 0">No saved retinues yet.</div>`;return;}
  c.innerHTML=keys.map(k=>`
    <div class="saved-item">
      <div><div class="saved-item-name">${esc(k)}</div><div class="saved-item-meta">${esc(s[k].savedAt||'')} · ${s[k].ptsCap||500}pts</div></div>
      <div class="saved-item-actions">
        <button class="sl-btn load" onclick="doLoad('${esc(k)}')">Load</button>
        <button class="sl-btn del" onclick="doDelete('${esc(k)}')">Del</button>
      </div>
    </div>`).join('');
}

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
function init(){
  refreshAll();
  initTabs();
  document.getElementById('ptsCap').addEventListener('input',function(){state.ptsCap=parseInt(this.value)||500;updatePtsBar();});
}


// ═══════════════════════════════════════════════════════
// STATS ENGINE
// ═══════════════════════════════════════════════════════
const BASE_STATS={Green:{atk:8,def:8,mor:8},Irregular:{atk:7,def:7,mor:7},Regular:{atk:6,def:6,mor:6},Veteran:{atk:5,def:5,mor:5}};
const EQ_MOD={'Padded':{move:-1,def:-1},'Mail':{move:-2,def:-2},'Small Shield':{shld:9},'Medium Shield':{shld:8},'Large Shield':{shld:7},'Horse':{move:3},'Barded Horse':{move:3,def:-1},'Pony':{move:2}};

function calcStats(row){
  const base=BASE_STATS[row.tier]||BASE_STATS.Regular;
  let move=6,def=base.def,shld=null,atkMod=0;
  [row.selWeapon,row.selOptWeapon,row.selArmor,row.selShield,row.selMount].filter(Boolean).forEach(e=>{
    const m=EQ_MOD[e];if(!m)return;
    if(m.move!==undefined)move+=m.move;
    if(m.def!==undefined)def+=m.def;
    if(m.shld!==undefined)shld=m.shld;
  });
  const wep=row.selWeapon,ed=EQUIP[wep]||{};
  const ms=(ed.modifier||'');
  if(ms.includes('+2 to Attack'))atkMod=-2;
  else if(ms.includes('+1 to Attack'))atkMod=-1;
  const note=wep&&ms?`${wep}: ${ms}`:'';
  const isC=row.kind==='commander'||isCommanderUnit(row.unitData);
  return{move:move+'"',attack:(base.atk+atkMod)+'+',defence:def+'+',shield:shld?shld+'+':'—',morale:base.mor+'+',actions:isC?3:2,note};
}

// ═══════════════════════════════════════════════════════
// MODAL STATE
// ═══════════════════════════════════════════════════════
let _ub=null;

function openUBNew(fid,unitName,tier){
  if(!fid){fid=state.factions[0]||'feudal_european';}
  const tiers=getUnitTiers(fid,unitName);
  const uData=tiers.find(t=>t.experience_tier===tier)||tiers.find(t=>t.experience_tier==='Regular')||tiers[0];
  if(!uData)return;
  _ub={...newRow(fid,unitName,uData.experience_tier,uData),_isNew:true};
  document.getElementById('ubTitle').textContent='Add Unit';
  renderUB();
  document.getElementById('ubOverlay').classList.add('open');
}

function openUBEdit(rowId){
  const row=state.list.find(r=>r.id===rowId);if(!row)return;
  _ub=JSON.parse(JSON.stringify(row));
  _ub._isNew=false;_ub._origId=rowId;
  document.getElementById('ubTitle').textContent='Edit — '+row.unit;
  renderUB();
  document.getElementById('ubOverlay').classList.add('open');
}

function closeUB(){document.getElementById('ubOverlay').classList.remove('open');_ub=null;}

function saveUB(){
  if(!_ub)return;
  if(_ub._isNew){
    const r={..._ub};delete r._isNew;r.id=state.nextId++;state.list.push(r);
  } else {
    const idx=state.list.findIndex(r=>r.id===_ub._origId);
    if(idx>-1){const r={..._ub};delete r._isNew;delete r._origId;state.list[idx]=r;}
  }
  closeUB();switchToTab('retinue');renderRetinue();renderRetinueList();
}

function switchToTab(tab){
  document.querySelectorAll('.tab-btn[data-tab]').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelector('[data-tab="'+tab+'"]')?.classList.add('active');
  document.getElementById('tab-'+tab)?.classList.add('active');
}

// ═══════════════════════════════════════════════════════
// RENDER MODAL
// ═══════════════════════════════════════════════════════

// Commander-only ability names (from rulebook)
const COMMANDER_ONLY_ABIS = new Set([
  'CRUELTY','EXPERIENCED KNIGHT','EXPERIENCED TACTICIAN','FORMIDABLE','INSPIRED LEADER','LUCKY',
  'PIOUS AIR','PRELATE','REBEL','RIDE DOWN','ROBUST','STEAL FROM THE RICH',
  'VETERAN CRUSADER','CLOSE RANKS','COUNTER CHARGE','ALL TO GAIN',
  'FRIENDS OF THE FOREST','DEERHOUNDS','JUSTICIAR','MARCHER','MILANESE STEEL',
  'CHALLENGER','CRUEL LORD','LORD OF THE SOUTH','MOUNTAIN MIST','NIFER','PATRON OF CULTURE',
  'PENTEULU','SCHOLAR','SURPRISE RAID','TEULU','EMBOLDENED','BURGEMEESTER',
  'CRACK SHOT','MELT AWAY'
]);

function renderUB(){
  if(!_ub)return;
  const fid=_ub.faction_id;
  const allU=uniqueUnits(BW_DATA.units.filter(u=>u.faction_id===fid));
  const isCustom=!!_ub._isCustom;
  const tiers=getUnitTiers(fid,_ub.unit);
  // For custom commanders, synthesise a profile that allows any equipment
  const customParsed={
    weaponsMust:BW_DATA.equipment.filter(e=>e.kind==='melee').map(e=>e.name),
    weaponsMay:BW_DATA.equipment.filter(e=>e.kind==='missile').map(e=>e.name),
    armor:['Padded','Mail'],
    shields:['Small Shield','Medium Shield','Large Shield'],
    mounts:['Horse','Barded Horse','Pony'],
    cgUpgrades:[],cgMustFrom:'',notes:[]
  };
  const inherent=isCustom?[]:getInherent(_ub.unitData?.full_profile||'');
  const parsed=isCustom?customParsed:getParsedEquipment(_ub,parseProfile(_ub.unitData?.full_profile||''),inherent);
  if(_ub.selOptWeapon&&!parsed.weaponsMay.includes(_ub.selOptWeapon))_ub.selOptWeapon=null;
  const isC=isCustom||_ub.kind==='commander'||isCommanderUnit(_ub.unitData);
  const isNamed=_ub.tier==='Named';
  const stats=calcStats(_ub);
  let h='';

  // Selectors
  const isChar=!!_ub._isChar;
  const charList=isChar?getFactChars(fid):null;
  const colCls=isC?'ub-sels two':'ub-sels three';
  h+=`<div class="${colCls}">
    <div class="ub-field"><label>${isChar?'Character':'Unit Type'}</label>
      <select class="ub-sel" onchange="${isChar?'ubChangeChar':'ubChangeUnit'}(this.value)">
        ${isChar
          ? charList.map(u=>`<option value="${esc(u.name)}" ${u.name===_ub.unit?'selected':''}>${esc(u.name)}</option>`).join('')
          : `<option value="__custom__" ${isCustom?'selected':''}>★ Custom Commander</option>`+
            allU.map(u=>`<option value="${esc(u.unit)}" ${!isCustom&&u.unit===_ub.unit?'selected':''}>${esc(u.unit)}${isCommanderUnit(u)?'  ♟':''}</option>`).join('')
        }
      </select></div>
    <div class="ub-field"><label>Experience</label>
      <select class="ub-sel" ${isChar?'disabled style="opacity:.5"':''} onchange="ubChangeTier(this.value)">
        ${isCustom
          ? ['Green','Irregular','Regular','Veteran'].map(t=>`<option value="${t}" ${_ub.tier===t?'selected':''}>${t}</option>`).join('')
          : tiers.map(t=>`<option value="${esc(t.experience_tier)}" ${t.experience_tier===_ub.tier?'selected':''}>${esc(t.experience_tier)} (${t.pts_per_warrior} pts)</option>`).join('')}
        ${isNamed?`<option value="Named" selected>Named Character</option>`:''}
      </select></div>
    ${!isC?`<div class="ub-field"><label>Count</label>
      <input type="number" class="ub-inp" value="${parseInt(_ub.warriors)||1}" min="1" max="50"
             oninput="ubSet('warriors',parseInt(this.value)||1)"></div>`:''}
  </div>`;

  // Custom commander extra fields: name + tier rank
  if(isCustom){
    h+=`<div class="ub-sels two">
      <div class="ub-field"><label>Name</label>
        <input type="text" class="ub-inp" value="${esc(_ub.unit)}" placeholder="Custom Commander"
               oninput="ubChangeCustomName(this.value)"></div>
      <div class="ub-field"><label>Commander Tier (no Tier 3)</label>
        <select class="ub-sel" onchange="ubChangeCustomRank(this.value)">
          <option value="1" ${_ub.customRank===1?'selected':''}>Tier 1 (1 ability)</option>
          <option value="2" ${_ub.customRank===2?'selected':''}>Tier 2 (2 abilities)</option>
        </select></div>
    </div>`;
  }

  // Stats
  if(!isNamed){
    h+=`<div class="ub-stats">
      <div class="ub-stats-grid">${[['Move',stats.move],['Attack',stats.attack],['Defence',stats.defence],['Shield',stats.shield],['Morale',stats.morale],['Actions',stats.actions]].map(([l,v])=>
        `<div class="ub-stat"><span class="ub-stat-lbl">${l}</span><span class="ub-stat-val" id="ubStat${l}">${v}</span></div>`).join('')}</div>
      ${stats.note?`<div class="ub-stat-note" id="ubStatNote">${esc(stats.note)}</div>`:`<div id="ubStatNote"></div>`}
    </div>`;
  }

  // Equipment
  if(!isNamed&&(parsed.weaponsMust.length||parsed.armor.length||parsed.mounts.length||parsed.shields.length)){
    h+=`<div class="ub-st">Equipment</div>`;
    const isTH=TWO_HANDED.has(_ub.selWeapon||'');
    const left=[];const right=[];
    if(parsed.weaponsMust.length)left.push({lbl:'Weapon',f:'selWeapon',items:parsed.weaponsMust,t:'radio'});
    if(parsed.weaponsMay.length){
      const isLanceOnly=parsed.weaponsMay.length===1&&parsed.weaponsMay[0]?.toLowerCase().includes('lance');
      left.push({lbl:isLanceOnly?'Lance (optional)':'Optional Weapon',f:'selOptWeapon',items:parsed.weaponsMay,t:isLanceOnly?'check':'radio-opt'});
    }
    if(parsed.mounts.length)left.push({lbl:'Mounts',f:'selMount',items:parsed.mounts,t:'radio'});
    if(parsed.armor.length)right.push({lbl:'Armour',f:'selArmor',items:parsed.armor,t:'radio'});
    if(parsed.shields.length)right.push({lbl:'Shields',f:'selShield',items:parsed.shields,t:'radio-opt',blocked:isTH});
    h+=`<div class="ub-eq-cols"><div>${left.map(s=>ubEqSec(s)).join('')}</div><div>${right.map(s=>ubEqSec(s)).join('')}</div></div>`;
  }

  // CG Upgrades
  if(isC&&parsed.cgUpgrades.length){
    h+=`<div class="ub-st">Command Group Upgrades</div><div class="ub-cg-row">
      ${parsed.cgUpgrades.map(u=>{
        const cg=getCommandUpgrade(u);
        const ck=(_ub.selCGUpgrades||[]).includes(u);
        const pts=cg.cost>0?`+${cg.cost} pts`:'core bk';
        const tipAttrs=LITE_MODE?'':`data-tkey="${regTip(esc(u),'',cg.effect||'')}" onmouseenter="showTipKey(this.dataset.tkey)" onmouseleave="clearTip()"`;
        return `<label class="ub-cg-pill ${ck?'ck':''}" ${tipAttrs}>
          <input type="checkbox" ${ck?'checked':''} onchange="ubTogCG('${esc(u)}',this.checked)">
          ${esc(u)} <span class="ub-cg-p">(${pts})</span></label>`;
      }).join('')}
    </div>`;
  }

  // Abilities
  const abils=getAvailableAbilities(fid);
  const selA=_ub.selAbilities||[];
  const selN=new Set(selA.map(a=>a.name));
  const lim=isCustom?(parseInt(_ub.customRank)||2):(isC?getAbilityLimit(_ub.unit):0);
  const atLim=isC&&selA.length>=lim;
  // Look up descriptions for inherent abilities. Names may include qualifiers like "(Regulars)"
  // or "(Green and Irregular)" — strip those before searching BW_DATA. Fall back to the
  // built-in INHERENT_GLOSSARY for inherent-only abilities (Commander, Paladin, Reputation…).
  const inhDetails=inherent.map(name=>{
    const base=name.replace(/\s*\([^)]*\)\s*$/,'').trim().toUpperCase();
    const u=BW_DATA.purchasable.find(a=>a.name.toUpperCase()===base);
    const r=BW_DATA.retinue_abilities.find(a=>a.ability.toUpperCase()===base);
    const effect=u?.effect||r?.effect||INHERENT_GLOSSARY[base]||'';
    return{name,effect};
  });
  h+=`<button class="ub-abi-tog" onclick="document.getElementById('ubAbiBody').classList.toggle('open')">
    <span style="font-family:'Cinzel',serif;font-size:.78rem;font-weight:700">Abilities</span>
    <div class="ub-inh-tags">${inherent.map(a=>`<span class="inh-tag">${esc(a)}</span>`).join('')}</div>
    <span style="font-size:.7rem;color:var(--text3)">▾</span>
  </button>
  <div class="ub-abi-body" id="ubAbiBody">
    ${!LITE_MODE&&inhDetails.length?`<div class="ub-abi-sub">Inherent Abilities</div>
      <div class="ub-inh-list">
        ${inhDetails.map(d=>`<div class="ub-inh-item"><div class="ub-inh-item-name">${esc(d.name)}</div>${d.effect?`<div class="ub-inh-item-effect">${esc(d.effect)}</div>`:`<div class="ub-inh-item-effect ub-inh-item-effect-empty">Faction trait — see Rules tab.</div>`}</div>`).join('')}
      </div>`:''}
    ${isC?`<div class="ub-abi-sub">Purchasable Abilities <span class="ub-abi-legend">✦ Universal &nbsp;⚜ Retinue &nbsp;⚔ Commander only</span></div>
      <div class="ub-abi-lim">Slots: <span class="${atLim?'abi-full':'abi-ok'}" id="ubAbiLim">${selA.length} / ${lim}</span></div>`:''}
    <div class="ub-abi-grid">
      ${abils.filter(a=>isC||!COMMANDER_ONLY_ABIS.has(a.name.toUpperCase())).map(a=>{
        const ck=selN.has(a.name);
        const cmdOnly=COMMANDER_ONLY_ABIS.has(a.name.toUpperCase());
        const dis=(isC&&!ck&&atLim)||(cmdOnly&&!isC);
        const tk=LITE_MODE?'':regTip(esc(a.name),'',a.effect||'');
        const tipAttrs=LITE_MODE?'':`data-tkey="${tk}" onmouseenter="showTipKey(this.dataset.tkey)" onmouseleave="clearTip()"`;
        const srcIcon=a.source==='generic'?'<span class="ub-an-src" title="Universal Ability">✦</span>':'<span class="ub-an-src ret" title="Retinue-Specific Ability">⚜</span>';
        return `<label class="ub-abi-it ${ck?'ck':''} ${dis?'dis':''}" ${tipAttrs}>
          <input type="checkbox" ${ck?'checked':''} ${dis?'disabled':''} onchange="ubTogAbi('${esc(a.name)}',${a.cost||0},this.checked)">
          <span class="ub-an">${srcIcon} ${esc(a.name)}${cmdOnly?' <span class="ub-an-cmd" title="Commander only">⚔</span>':''}</span>
          <span class="ub-ac">+${a.cost||0}</span></label>`;
      }).join('')}
    </div>
    ${!isC?`<div class="amber-box" style="margin-top:8px;font-size:.73rem">Ability purchasing is managed at retinue level for warrior groups.</div>`:''}
  </div>`;

  if(isNamed){
    h+=`<div class="ub-misc-row"><span>Points cost (from supplement):</span>
      <input type="number" class="ub-misc-inp" value="${parseInt(_ub.ptsPerW)||0}" min="0"
             oninput="ubSet('ptsPerW',parseInt(this.value)||0)"></div>`;
  }
  if(isCustom){
    h+=`<div class="ub-misc-row"><span>Base points cost (Knight Commander Generator):</span>
      <input type="number" class="ub-misc-inp" value="${parseInt(_ub.ptsPerW)||0}" min="0"
             oninput="ubSet('ptsPerW',parseInt(this.value)||0)"></div>
      <div class="amber-box" style="margin-top:6px;font-size:.78rem">Enter the base points cost from the Knight Commander Generator in the rulebook. Equipment, abilities and command-group upgrades are added automatically below.</div>`;
  }
  if(parsed.notes.length)h+=`<div class="note-box" style="margin-top:9px">${esc(parsed.notes.join('\n'))}</div>`;

  document.getElementById('ubScroll').innerHTML=h;
  document.getElementById('ubTip').innerHTML='<div class="ub-tip-empty">Hover an item to see rules</div>';
  ubUpdateCost();
}

function ubEqSec(sec){
  const blocked=sec.blocked||false;
  if(sec.t==='check'){
    const item=sec.items[0];if(!item)return'';
    const cost=EQUIP[item]?.cost||0;const eff=EQUIP[item]?.effect||'';
    const ck=_ub[sec.f]===item;
    return `<div style="margin-bottom:9px"><div class="ub-eq-hd">${esc(sec.lbl)}</div>
      <label class="ub-eq-opt ${ck?'sel':''}"
        data-tkey="${regTip(esc(item),'',eff)}" onmouseenter="showTipKey(this.dataset.tkey)" onmouseleave="clearTip()">
        <input type="checkbox" ${ck?'checked':''} onchange="ubEquip('${sec.f}',this.checked?'${esc(item)}':null)">
        <span class="ub-eq-n">${esc(item)}</span>
        <span class="ub-eq-c">+${cost} pts</span></label></div>`;
  }
  const isOpt=sec.t==='radio-opt';
  return `<div style="margin-bottom:9px">
    <div class="ub-eq-hd">${esc(sec.lbl)}${blocked?' <span style="font-size:.64rem;color:var(--red)">(locked — Two Handed)</span>':''}</div>
    ${isOpt?`<label class="ub-eq-opt ${!_ub[sec.f]?'sel':''} ${blocked?'locked':''}">
      <input type="radio" name="ub-${sec.f}" value="" ${!_ub[sec.f]?'checked':''} ${blocked?'disabled':''} onchange="ubEquip('${sec.f}',null)">
      <span class="ub-eq-n">None</span><span class="ub-eq-c">0 pts</span></label>`:''}
    ${sec.items.map(item=>{
      const cost=EQUIP[item]?.cost||0;const eff=EQUIP[item]?.effect||'';const mod=EQUIP[item]?.modifier||'';
      const sel=_ub[sec.f]===item;
      return `<label class="ub-eq-opt ${sel?'sel':''} ${blocked?'locked':''}"
        data-tkey="${regTip(esc(item),esc(mod),eff)}" onmouseenter="showTipKey(this.dataset.tkey)" onmouseleave="clearTip()">
        <input type="radio" name="ub-${sec.f}" value="${esc(item)}" ${sel?'checked':''} ${blocked?'disabled':''} onchange="ubEquip('${sec.f}','${esc(item)}')">
        <span class="ub-eq-n">${esc(item)}</span>
        <span class="ub-eq-c">+${cost} pts</span></label>`;
    }).join('')}
  </div>`;
}

function ubChangeUnit(newUnit){
  if(newUnit==='__custom__'){
    _ub._isCustom=true;
    _ub.unit='Custom Commander';
    _ub.kind='commander';
    _ub.customRank=2;
    _ub.tier='Regular';
    _ub.ptsPerW=0;
    _ub.unitData=null;
    _ub.selWeapon=null;_ub.selOptWeapon=null;_ub.selArmor=null;_ub.selShield=null;_ub.selMount=null;
    _ub.selAbilities=[];_ub.selCGUpgrades=[];
    _ub.warriors=1;
    document.getElementById('ubTitle').textContent='Custom Commander';
    renderUB();
    return;
  }
  const fid=_ub.faction_id;
  const tiers=getUnitTiers(fid,newUnit);
  if(!tiers.length)return;
  const uData=tiers.find(t=>t.experience_tier==='Regular')||tiers[0];
  const parsed=parseProfile(uData.full_profile||'');
  _ub._isCustom=false;_ub.customRank=undefined;
  _ub.unit=newUnit;_ub.tier=uData.experience_tier;_ub.ptsPerW=uData.pts_per_warrior;_ub.unitData=uData;
  _ub.kind=isCommanderUnit(uData)?'commander':(uData.kind||'warrior');
  _ub.warriors=_ub.kind==='commander'?1:5;
  _ub.selWeapon=parsed.weaponsMust[0]||null;_ub.selOptWeapon=null;
  _ub.selArmor=parsed.armor[0]||null;_ub.selShield=parsed.shields[0]||null;
  _ub.selMount=parsed.mounts.length?parsed.mounts[0]:null;
  _ub.selAbilities=[];_ub.selCGUpgrades=[];
  document.getElementById('ubTitle').textContent=_ub._isNew?'Add Unit':'Edit — '+newUnit;
  renderUB();
}

function ubChangeCustomRank(v){
  _ub.customRank=parseInt(v)||2;
  // Trim abilities if reducing rank
  if((_ub.selAbilities||[]).length>_ub.customRank)_ub.selAbilities=_ub.selAbilities.slice(0,_ub.customRank);
  renderUB();
}

function ubChangeCustomName(name){
  _ub.unit=(name||'').trim()||'Custom Commander';
}

// Window-exposed setter so inline handlers can mutate the module-scoped _ub
function ubSet(field,val){
  if(!_ub)return;
  _ub[field]=val;
  ubUpdateCost();
}

function ubChangeTier(newTier){
  if(_ub._isCustom){
    _ub.tier=newTier;
    ubUpdateCost();
    const stats=calcStats(_ub);
    ['Move','Attack','Defence','Shield','Morale','Actions'].forEach((l,i)=>{
      const el=document.getElementById('ubStat'+l);
      if(el)el.textContent=[stats.move,stats.attack,stats.defence,stats.shield,stats.morale,stats.actions][i];
    });
    return;
  }
  const fid=_ub.faction_id;
  const uData=BW_DATA.units.find(u=>u.faction_id===fid&&u.unit===_ub.unit&&u.experience_tier===newTier);
  if(!uData)return;
  _ub.tier=newTier;_ub.ptsPerW=uData.pts_per_warrior;_ub.unitData=uData;
  ubUpdateCost();
  // Update stat block only
  const stats=calcStats(_ub);
  ['Move','Attack','Defence','Shield','Morale','Actions'].forEach((l,i)=>{
    const el=document.getElementById('ubStat'+l);
    if(el)el.textContent=[stats.move,stats.attack,stats.defence,stats.shield,stats.morale,stats.actions][i];
  });
  const sn=document.getElementById('ubStatNote');if(sn)sn.textContent=stats.note||'';
}

function ubEquip(field,val){
  _ub[field]=val||null;
  if(field==='selWeapon'&&TWO_HANDED.has(val||''))_ub.selShield=null;
  ubUpdateCost();
  const stats=calcStats(_ub);
  ['Move','Attack','Defence','Shield','Morale','Actions'].forEach((l,i)=>{
    const el=document.getElementById('ubStat'+l);
    if(el)el.textContent=[stats.move,stats.attack,stats.defence,stats.shield,stats.morale,stats.actions][i];
  });
  const sn=document.getElementById('ubStatNote');if(sn)sn.textContent=stats.note||'';
  // Re-render equip section if shield lock changed (two-handed)
  if(field==='selWeapon')renderUB();
}

function ubTogCG(name,ck){
  if(!_ub.selCGUpgrades)_ub.selCGUpgrades=[];
  if(ck){if(!_ub.selCGUpgrades.includes(name))_ub.selCGUpgrades.push(name);}
  else _ub.selCGUpgrades=_ub.selCGUpgrades.filter(u=>u!==name);
  document.querySelectorAll('#ubScroll .ub-cg-pill').forEach(p=>{const i=p.querySelector('input');if(i)p.classList.toggle('ck',i.checked);});
  ubUpdateCost();
}

function ubTogAbi(name,cost,ck){
  if(!_ub.selAbilities)_ub.selAbilities=[];
  const changesWeaponChoices=/^Weapon Choices?$/i.test(name);
  const isC=_ub._isCustom||_ub.kind==='commander'||isCommanderUnit(_ub.unitData);
  if(COMMANDER_ONLY_ABIS.has(name.toUpperCase())&&!isC)return; // warriors can't take commander-only
  const lim=_ub._isCustom?(parseInt(_ub.customRank)||2):(isC?getAbilityLimit(_ub.unit):999);
  if(ck){if(isC&&_ub.selAbilities.length>=lim)return;if(!_ub.selAbilities.find(a=>a.name===name))_ub.selAbilities.push({name,cost});}
  else _ub.selAbilities=_ub.selAbilities.filter(a=>a.name!==name);
  if(changesWeaponChoices){renderUB();return;}
  const selN=new Set(_ub.selAbilities.map(a=>a.name));
  const atLim=_ub.selAbilities.length>=lim;
  document.querySelectorAll('#ubAbiBody .ub-abi-it').forEach(it=>{
    const inp=it.querySelector('input');if(!inp)return;
    const m=(inp.getAttribute('onchange')||'').match(/'([^']+)'/);
    const n=m?m[1]:'';
    const isCk=selN.has(n);const isDis=!isCk&&atLim;
    it.className=`ub-abi-it${isCk?' ck':''}${isDis?' dis':''}`;
    inp.checked=isCk;inp.disabled=isDis;
  });
  const limEl=document.getElementById('ubAbiLim');
  if(limEl){limEl.textContent=`${_ub.selAbilities.length} / ${lim}`;limEl.className=atLim?'abi-full':'abi-ok';}
  ubUpdateCost();
}

function ubUpdateCost(){
  if(!_ub)return;
  const isC=_ub._isCustom||_ub.kind==='commander'||isCommanderUnit(_ub.unitData);
  const w=isC?1:Math.max(1,parseInt(_ub.warriors)||1);
  const pts=parseInt(_ub.ptsPerW)||parseInt(_ub.unitData?.pts_per_warrior)||0;
  const eqC=n=>n?(EQUIP[n]?.cost||0):0;
  const eq=w*(eqC(_ub.selWeapon)+eqC(_ub.selOptWeapon)+eqC(_ub.selArmor)+eqC(_ub.selShield)+eqC(_ub.selMount));
  const abi=(_ub.selAbilities||[]).reduce((s,a)=>s+(a.cost||0),0);
  const cg=(_ub.selCGUpgrades||[]).reduce((s,u)=>s+getCommandUpgradeCost(u),0);
  const misc=parseInt(_ub.miscExtra)||0;
  const base=w*pts;const total=base+eq+abi+cg+misc;
  const el=document.getElementById('ubCostPts');if(el)el.textContent=total+' pts';
  const parts=['Base: '+base];if(eq)parts.push('Equip: '+eq);if(abi)parts.push('Abi: '+abi);if(cg)parts.push('CG: '+cg);if(misc)parts.push('Misc: '+misc);
  const bd=document.getElementById('ubBd');if(bd)bd.innerHTML=parts.map(p=>`<span>${p}</span>`).join(' · ');
}

// Tip store — avoids JSON.stringify in HTML attributes
const _TIPS = {};
let _tipIdx = 0;
function regTip(name, mod, eff) {
  const key = 't' + (_tipIdx++);
  _TIPS[key] = {name, mod, eff};
  return key;
}
function showTipKey(key) {
  const t = _TIPS[key]; if(!t) return;
  const panel = document.getElementById('ubTip'); if(!panel) return;
  panel.innerHTML = `${t.name ? `<div class="ub-tip-name">${esc(t.name)}</div>` : ''}
    ${t.mod ? `<div class="ub-tip-mod">${esc(t.mod)}</div>` : ''}
    ${t.eff ? `<div class="ub-tip-eff">${esc(t.eff)}</div>` : '<div class="ub-tip-empty">No additional rules text.</div>'}`;
}
function showTip(name,mod,eff){
  const panel=document.getElementById('ubTip');if(!panel)return;
  panel.innerHTML=`${name?`<div class="ub-tip-name">${esc(name)}</div>`:''}
    ${mod?`<div class="ub-tip-mod">${esc(mod)}</div>`:''}
    ${eff?`<div class="ub-tip-eff">${esc(eff)}</div>`:'<div class="ub-tip-empty">No additional rules text.</div>'}`;
}
function clearTip(){
  const p=document.getElementById('ubTip');if(p)p.innerHTML='<div class="ub-tip-empty">Hover an item to see its rules</div>';
}

// ═══════════════════════════════════════════════════════
// RETINUE: HORIZONTAL ROWS
// ═══════════════════════════════════════════════════════
function renderRetinue(){
  renderRetinueFactionHdr();
  const grid=document.getElementById('rcardGrid')||document.getElementById('retinueRows');
  const empty=document.getElementById('emptyState');
  const total=document.getElementById('retinueTotal');
  if(!grid)return;
  // Empty state only when no retinues are selected at all
  if(!state.factions.length){
    grid.innerHTML='';if(empty)empty.style.display='block';if(total)total.style.display='none';
    updatePtsBar();return;
  }
  if(empty)empty.style.display='none';
  if(total)total.style.display=state.list.length?'flex':'none';
  // Order: selected factions first, then any orphan rows (faction not in selection)
  const factionOrder=[...state.factions];
  for(const r of state.list)if(r.faction_id&&!factionOrder.includes(r.faction_id))factionOrder.push(r.faction_id);
  const multi=state.factions.length>1;
  let h='';
  for(const fid of factionOrder){
    const rows=factionRows(fid);
    const cmds=rows.filter(r=>r.kind==='commander');
    const wars=rows.filter(r=>r.kind!=='commander');
    if(multi)h+=`<div class="ret-group-divider">⚜ ${esc(facLabel(fid))}</div>`;
    if(!rows.length){
      h+=`<div class="ret-group-empty">No units yet — use + Units or + Characters in the ${esc(facLabel(fid))} card above to add to this retinue.</div>`;
      continue;
    }
    if(cmds.length){
      h+=`<div class="sec-hdr"><div class="sec-hdr-line"></div><span class="sec-hdr-lbl">Commanders</span><span class="sec-hdr-ct">${cmds.length}</span><div class="sec-hdr-line"></div></div>`;
      h+=cmds.map(r=>renderRow(r)).join('');
    }
    if(wars.length){
      h+=`<div class="sec-hdr"><div class="sec-hdr-line"></div><span class="sec-hdr-lbl">Warriors</span><span class="sec-hdr-ct">${wars.length}</span><div class="sec-hdr-line"></div></div>`;
      h+=wars.map(r=>renderRow(r)).join('');
    }
  }
  grid.innerHTML=h;
  updatePtsBar();
}

function renderRow(row){
  const isC=row.kind==='commander'||isCommanderUnit(row.unitData);
  const tot=rowTotal(row);
  const parsed=parseProfile(row.unitData?.full_profile||'');
  const inherent=getInherent(row.unitData?.full_profile||'');
  const TC={Green:'tier-green',Irregular:'tier-irregular',Regular:'tier-regular',Veteran:'tier-veteran',Named:'tier-named'};
  const tcls=TC[row.tier]||'tier-irregular';
  const eqs=[row.selWeapon,row.selOptWeapon,row.selArmor,row.selShield,row.selMount].filter(Boolean);
  const eqTags=eqs.map(e=>`<span class="r-tag-e">${esc(e)}</span>`).join('');
  const cgTags=(row.selCGUpgrades||[]).map(u=>`<span class="r-tag-cg">${esc(u)}</span>`).join('');
  const inhTags=inherent.map(a=>`<span class="r-tag-ai">${esc(a)}</span>`).join('');
  const abiTags=(row.selAbilities||[]).map(a=>`<span class="r-tag-a">${esc(a.name)}</span>`).join('');
  const hasTags=eqTags||cgTags||inhTags||abiTags;
  // CG assignment — restrict candidates to the same faction as the commander
  const cgCands=isC?state.list.filter(r=>r.id!==row.id&&r.kind!=='commander'&&r.faction_id===row.faction_id&&cgMatch(r.unit,parsed.cgMust||parsed.cgMustFrom)):[];
  const cgAssign=isC?`<div class="rrow-cg">
    <span class="rrow-cg-lbl">⚑ Group</span>
    <select class="rrow-cg-sel" onchange="assignCG(${row.id},this.value)">
      <option value="">— Unassigned —</option>
      ${cgCands.map(c=>`<option value="${c.id}" ${c.id===row.commandGroupRowId?'selected':''}>${esc(c.unit)} (${esc(c.tier)}, ×${c.warriors||1})</option>`).join('')}
    </select></div>`:'';
  return `<div class="rrow ${isC?'cmd-row':'war-row'}">
    <div class="rrow-top">
      <div class="rrow-left">
        <div class="rrow-name-line">
          <span class="rrow-name">${esc(row.unit)}</span>
          <span class="rrow-tier ${tcls}">${esc(row.tier)}</span>
          ${row._isCustom?`<span class="rrow-custom" title="Custom Commander (Knight Commander Generator)">★ Custom T${row.customRank||2}</span>`:''}
          ${row.hasRabble&&(row.tier==='Green'||row.tier==='Irregular')?`<span class="rrow-rabble" title="Counts toward the Scottish 20% Rabble requirement">RABBLE</span>`:''}
          ${!isC?`<span class="rrow-count">×${parseInt(row.warriors)||1}</span>`:''}
        </div>
        ${hasTags?`<div class="rrow-tags">${eqTags}${cgTags}${inhTags}${abiTags}</div>`:''}
      </div>
      <div class="rrow-right">
        <div class="rrow-cost">${tot} pts</div>
        <div class="rrow-btns">
          <button class="rrow-edit" onclick="openUBEdit(${row.id})">⚙ Edit</button>
          <button class="rrow-del" onclick="deleteRow(${row.id})">✕</button>
        </div>
      </div>
    </div>
    ${cgAssign}
  </div>`;
}

function cgMatch(unitName,cgMust){
  if(!cgMust)return true;
  const uL=unitName.toLowerCase();
  return cgMust.replace(/\s+or\s+/gi,',').replace(/\([^)]*\)/g,'').split(',').map(t=>t.trim().toLowerCase()).filter(Boolean).some(t=>t&&uL.includes(t));
}


function deleteRow(id){
  const row=state.list.find(r=>r.id===id);
  if(row?.commandGroupRowId){const w=state.list.find(r=>r.id===row.commandGroupRowId);if(w)w.commanderRowId=null;}
  state.list=state.list.filter(r=>r.id!==id);
  renderRetinue();renderRetinueList();
}

function assignCG(cmdId,val){
  const cmd=state.list.find(r=>r.id===cmdId);if(!cmd)return;
  if(cmd.commandGroupRowId){const old=state.list.find(r=>r.id===cmd.commandGroupRowId);if(old)old.commanderRowId=null;}
  const newId=val?parseInt(val):null;
  cmd.commandGroupRowId=newId||null;
  if(newId){const w=state.list.find(r=>r.id===newId);if(w)w.commanderRowId=cmdId;}
  renderRetinue();
}
document.addEventListener('DOMContentLoaded',init);

Object.assign(window, {
  openSaveModal,
  closeSaveModal,
  doSave,
  doLoad,
  doDelete,
  uiAddFaction,
  uiRemoveFaction,
  uiSetLiege,
  toggleAddRetinue,
  setRulesFilter,
  setMercenaryCompany,
  openSBUnitModal,
  openSBCharModal,
  renderBrowse,
  openUBNew,
  openUBEdit,
  closeUB,
  saveUB,
  ubChangeChar,
  ubChangeUnit,
  ubChangeTier,
  ubChangeCustomRank,
  ubChangeCustomName,
  ubSet,
  ubEquip,
  ubTogCG,
  ubTogAbi,
  showTipKey,
  clearTip,
  deleteRow,
  assignCG
});
