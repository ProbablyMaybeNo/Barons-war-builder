import { BW_DATA, EQUIP, CG_UPGRADES } from '../data/game-data.js';

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════
const TIER_ORDER = {Green:0,Irregular:1,Regular:2,Veteran:3};
const TIER_CSS = {Green:'tier-green',Irregular:'tier-irregular',Regular:'tier-regular',Veteran:'tier-veteran',Named:'tier-named'};
const STORAGE_KEY = 'bw_kj_v4';
const FACTION_LABELS = {feudal_european:'Feudal European',mercenary:'Mercenary',flemish:'Flemish',poitevin:'Poitevin',medieval_scottish:'Medieval Scottish',welsh:'Welsh',outlaw:'Outlaw'};
const TWO_HANDED = new Set(['Two Handed Weapon','Improvised Two Handed Weapon','Bill / Polearm','Dane Axe','Dual Daggers','Bill','Bill (Regulars)']);
const COMMAND_UPGRADE_COST_OVERRIDES = {Pennant:7};

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════
let state = {faction:null, list:[], ptsCap:500, nextId:1, openPanels:{}};

// ═══════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════
function esc(s){if(!s&&s!==0)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function fac(id){return BW_DATA.factions.find(f=>f.faction_id===id)}
function facLabel(id){return FACTION_LABELS[id]||id}

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
  // Tier 1: Capitano, Burgemeester — 1 ability
  if(n.includes('capitano')||n.includes('burgemeester'))return 1;
  // Tier 2: Lords, Serjeants at Arms, Paladins, Gaelic Lords, etc — 2 abilities
  return 2;
}

function parseProfile(profile){
  const res={weaponsMust:[],weaponsMay:[],armor:[],shields:[],mounts:[],cgUpgrades:[],cgMustFrom:'',notes:[]};
  if(!profile)return res;
  for(const rawLine of profile.split('\n')){
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
  const m=(profile||'').match(/Inherent Abilities: ([^\n]+)/);
  return m?m[1].split(',').map(a=>a.trim()).filter(Boolean):[];
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
  const retinue=BW_DATA.retinue_abilities.filter(a=>a.faction_id===fid).map(a=>({name:a.ability,cost:a.cost||0,effect:a.effect||'',source:'retinue'}));
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
function renderFactionList(){
  document.getElementById('factionList').innerHTML=BW_DATA.factions.map(f=>`
    <button class="faction-btn ${state.faction===f.faction_id?'active':''}" onclick="selectFaction('${f.faction_id}')">
      ${esc(f.faction_name)}
    </button>`).join('');
}

function selectFaction(fid){
  state.faction=fid;
  renderFactionList();
  document.getElementById('sbListBuilder').style.display='block';
  renderSBDropdowns();
  renderRetinueFactionHdr();
  renderBrowse();
  renderCharsBrowse();
  renderRules();
  renderRetinue();
}

function renderSBDropdowns(){/* no-op: sidebar now uses direct modal */}

function getFactChars(fid){
  const label=facLabel(fid).toLowerCase().split(' ')[0].toLowerCase();
  const chars=BW_DATA.dramatis.filter(d=>(d.retinues||'').toLowerCase().includes(label));
  const list=chars.length?chars:BW_DATA.dramatis;
  return list.map(d=>({...d,unit:d.name}));
}

function openSBUnitModal(){
  if(!state.faction){alert('Select a Retinue first.');return;}
  const fid=state.faction;
  const warriors=uniqueUnits(BW_DATA.units.filter(u=>u.faction_id===fid&&!isCommanderUnit(u)));
  const first=warriors.length?warriors[0]:uniqueUnits(BW_DATA.units.filter(u=>u.faction_id===fid))[0];
  if(!first){alert('No units available for this retinue.');return;}
  openUBNew(fid,first.unit,'Regular');
}

function openSBCharModal(){
  if(!state.faction){alert('Select a Retinue first.');return;}
  const fid=state.faction;
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

function renderAlerts(spent){
  const bar=document.getElementById('retinueAlertBar');
  if(!state.faction||!state.list.length){bar.innerHTML='';return;}
  const f=fac(state.faction);const alerts=[],infos=[];
  if(spent>state.ptsCap)alerts.push(`⚠ Over cap by ${spent-state.ptsCap} pts`);
  if(f?.green_min_pct>0){
    const gp=state.list.filter(r=>r.tier==='Green').reduce((s,r)=>s+rowTotal(r),0);
    const pct=spent>0?(gp/spent)*100:0;
    if(pct<f.green_min_pct)alerts.push(`⚠ Green troops: ${pct.toFixed(0)}% (min ${f.green_min_pct}%)`);
  }
  if(f?.rabble_min_pct){
    const rp=state.list.filter(r=>r.hasRabble).reduce((s,r)=>s+rowTotal(r),0);
    const pct=spent>0?(rp/spent)*100:0;
    if(pct<f.rabble_min_pct)alerts.push(`⚠ Rabble Groups: ${pct.toFixed(0)}% (Horseless Classes requires ${f.rabble_min_pct}%)`);
  }
  if(state.faction==='outlaw')infos.push('ℹ Outlaw: Allied Retinues only. Leader may never be Liege Lord.');
  if(state.list.length&&!state.list.find(r=>r.kind==='commander'))alerts.push('⚠ No Commander in retinue');
  if(!alerts.length&&!infos.length){bar.innerHTML='';bar.className='alert-bar';return;}
  bar.className='alert-bar '+(alerts.length?'error':'info');
  bar.innerHTML=`<div class="alert-title">${alerts.length?'⚠ List Issues':'ℹ Notes'}</div>${[...alerts,...infos].map(a=>`<div>${esc(a)}</div>`).join('')}`;
}

// ═══════════════════════════════════════════════════════════
// FACTION HEADER
// ═══════════════════════════════════════════════════════════
function renderRetinueFactionHdr(){
  const hdr=document.getElementById('retinueFactionHdr');
  if(!state.faction){hdr.style.display='none';return;}
  const f=fac(state.faction);
  const traits=BW_DATA.faction_traits.filter(t=>t.faction_id===state.faction);
  hdr.style.display='block';
  hdr.innerHTML=`
    <div class="faction-hdr">
      <div class="faction-hdr-name">⚜ ${esc(f?.faction_name)}</div>
      <div class="faction-hdr-traits">
        ${traits.map(t=>`<div class="trait-tooltip-wrap">
          <span class="faction-trait-tag">${esc(t.trait)}</span>
          <div class="trait-tooltip">${esc(t.description||'')}</div>
        </div>`).join('')}
      </div>
      ${f?.restriction_notes?`<div class="faction-hdr-note">${esc(f.restriction_notes)}</div>`:''}
      ${f?.green_min_pct?`<div class="faction-hdr-note">Min. ${f.green_min_pct}% points on Green troops.${f.rabble_min_pct?` Min. ${f.rabble_min_pct}% on Rabble.`:''}</div>`:''}
    </div>`;
}

// ═══════════════════════════════════════════════════════════
// RETINUE CARDS
// ═══════════════════════════════════════════════════════════

function renderBrowse(){
  const container=document.getElementById('browseGrid');
  const search=(document.getElementById('browseSearch')?.value||'').toLowerCase();
  const kind=document.getElementById('browseKindFilter')?.value||'';
  let units=state.faction?BW_DATA.units.filter(u=>u.faction_id===state.faction):BW_DATA.units;
  if(kind==='commander')units=units.filter(u=>isCommanderUnit(u));
  else if(kind==='warrior')units=units.filter(u=>!isCommanderUnit(u));
  if(search)units=units.filter(u=>u.unit.toLowerCase().includes(search)||(u.full_profile||'').toLowerCase().includes(search));
  const grouped=uniqueUnits(units);
  if(!grouped.length){
    container.innerHTML=`<div style="grid-column:1/-1;color:var(--text3);text-align:center;padding:40px 0">No units found.${!state.faction?' ← Select a retinue to filter.':''}</div>`;
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
  const fid=state.faction;
  const chars=fid?BW_DATA.dramatis.filter(d=>(d.retinues||'').toLowerCase().includes(facLabel(fid).toLowerCase().split(' ')[0])):BW_DATA.dramatis;
  const displayed=chars.length?chars:BW_DATA.dramatis;
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
function renderRules(){
  const panel=document.getElementById('rulesPanel');
  let html='<div class="rules-sections">';

  // Faction traits
  const fid=state.faction;
  if(fid){
    const f=fac(fid);
    const traits=BW_DATA.faction_traits.filter(t=>t.faction_id===fid);
    html+=ruleSec('⚜ Faction Traits',traits.map(t=>`<div class="trait-card"><div class="trait-card-name">${esc(t.trait)}</div><div class="trait-card-text">${esc(t.description||'')}</div></div>`).join('')+
      (f?.restriction_notes?`<div class="amber-box">${esc(f.restriction_notes)}</div>`:''));
  } else {
    const groups={};
    for(const t of BW_DATA.faction_traits){if(!groups[t.faction_id])groups[t.faction_id]=[];groups[t.faction_id].push(t);}
    html+=ruleSec('⚜ Faction Traits',Object.entries(groups).map(([gfid,traits])=>`
      <div style="margin-bottom:14px">
        <div style="font-family:'Cinzel',serif;font-size:.72rem;color:var(--text2);margin-bottom:6px;letter-spacing:.06em">${esc(FACTION_LABELS[gfid]||gfid)}</div>
        ${traits.map(t=>`<div class="trait-card"><div class="trait-card-name">${esc(t.trait)}</div><div class="trait-card-text">${esc(t.description||'')}</div></div>`).join('')}
      </div>`).join(''));
  }

  // Global rules
  html+=ruleSec('⚖ Global & Optional Rules',BW_DATA.global_rules.map(r=>`<div class="trait-card"><div class="trait-card-name">${esc(r.topic)}</div><div class="trait-card-text">${esc(r.text||'')}</div></div>`).join(''));

  // Purchasable abilities reference
  html+=ruleSec('✦ Universal Abilities',BW_DATA.purchasable.map((a,i)=>abiRefItem(a.name,a.cost,a.effect,'gen-'+i)).join(''));

  // Retinue abilities
  if(fid){
    const fa=BW_DATA.retinue_abilities.filter(a=>a.faction_id===fid);
    if(fa.length)html+=ruleSec(`⚔ ${esc(FACTION_LABELS[fid]||fid)} Retinue Abilities`,fa.map((a,i)=>abiRefItem(a.ability,a.cost,a.effect,'fac-'+i)).join(''));
  } else {
    const groups={};
    for(const a of BW_DATA.retinue_abilities){if(!groups[a.faction_id])groups[a.faction_id]=[];groups[a.faction_id].push(a);}
    for(const[rfid,abils] of Object.entries(groups)){
      html+=ruleSec(`⚔ ${esc(FACTION_LABELS[rfid]||rfid)} Abilities`,abils.map((a,i)=>abiRefItem(a.ability,a.cost,a.effect,rfid+'-'+i)).join(''));
    }
  }

  // Command upgrades
  html+=ruleSec('⚑ Command Group Upgrades',BW_DATA.command_upgrades.map((a,i)=>{
    const cost=COMMAND_UPGRADE_COST_OVERRIDES[a.name]??a.cost;
    return abiRefItem(a.name,cost,a.effect,'cmd-'+i);
  }).join(''));

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
  saves[name]={faction:state.faction,ptsCap:state.ptsCap,list:stripped,savedAt:new Date().toLocaleString()};
  setSaved(saves);document.getElementById('saveNameInput').value='';renderSavedList();
}
function doLoad(name){
  const saves=getSaved();const s=saves[name];if(!s)return;
  state.faction=s.faction;state.ptsCap=s.ptsCap||500;
  state.list=(s.list||[]).map(r=>{
    const uData=BW_DATA.units.find(u=>u.faction_id===r.faction_id&&u.unit===r.unit&&u.experience_tier===r.tier)||null;
    return{...r,unitData:uData,kind:uData?(isCommanderUnit(uData)?'commander':uData.kind):r.kind,_openPanel:null};
  });
  state.nextId=Math.max(...state.list.map(r=>r.id),0)+1;
  document.getElementById('ptsCap').value=state.ptsCap;
  closeSaveModal();renderFactionList();renderSBDropdowns();
  renderRetinueFactionHdr();renderRetinue();renderBrowse();renderRules();
  if(state.faction)document.getElementById('sbListBuilder').style.display='block';
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
  renderFactionList();renderBrowse();renderRules();renderRetinue();
  initTabs();
  document.getElementById('ptsCap').addEventListener('input',function(){state.ptsCap=parseInt(this.value)||500;updatePtsBar();});
}


// ═══════════════════════════════════════════════════════
// STATS ENGINE
// ═══════════════════════════════════════════════════════
const BASE_STATS={Green:{atk:8,def:5,mor:5},Irregular:{atk:7,def:5,mor:5},Regular:{atk:6,def:6,mor:6},Veteran:{atk:5,def:7,mor:7}};
const EQ_MOD={'Padded':{move:-1,def:1},'Mail':{move:-2,def:2},'Small Shield':{shld:9},'Medium Shield':{shld:8},'Large Shield':{shld:7},'Horse':{move:3},'Barded Horse':{move:3,def:1},'Pony':{move:2}};

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
  if(!fid){fid=state.faction||'feudal_european';}
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
  closeUB();switchToTab('retinue');renderRetinue();
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
  'CRUELTY','EXPERIENCED TACTICIAN','FORMIDABLE','INSPIRED LEADER','LUCKY',
  'PIOUS AIR','PRELATE','REBEL','RIDE DOWN','ROBUST','STEAL FROM THE RICH',
  'VETERAN CRUSADER','CLOSE RANKS','COUNTER CHARGE','ALL TO GAIN',
  'FRIENDS OF THE FOREST','DEERHOUNDS','JUSTICIAR','MARCHER','MILANESE STEEL'
]);

function renderUB(){
  if(!_ub)return;
  const fid=_ub.faction_id;
  const allU=uniqueUnits(BW_DATA.units.filter(u=>u.faction_id===fid));
  const tiers=getUnitTiers(fid,_ub.unit);
  const parsed=parseProfile(_ub.unitData?.full_profile||'');
  const inherent=getInherent(_ub.unitData?.full_profile||'');
  const isC=_ub.kind==='commander'||isCommanderUnit(_ub.unitData);
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
          : allU.map(u=>`<option value="${esc(u.unit)}" ${u.unit===_ub.unit?'selected':''}>${esc(u.unit)}${isCommanderUnit(u)?'  ♟':''}</option>`).join('')
        }
      </select></div>
    <div class="ub-field"><label>Experience</label>
      <select class="ub-sel" ${isChar?'disabled style="opacity:.5"':''} onchange="ubChangeTier(this.value)">
        ${tiers.map(t=>`<option value="${esc(t.experience_tier)}" ${t.experience_tier===_ub.tier?'selected':''}>${esc(t.experience_tier)} (${t.pts_per_warrior} pts)</option>`).join('')}
        ${isNamed?`<option value="Named" selected>Named Character</option>`:''}
      </select></div>
    ${!isC?`<div class="ub-field"><label>Count</label>
      <input type="number" class="ub-inp" value="${parseInt(_ub.warriors)||1}" min="1" max="50"
             oninput="_ub.warriors=parseInt(this.value)||1;ubUpdateCost()"></div>`:''}
  </div>`;

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
    if(parsed.weaponsMay.length)left.push({lbl:parsed.weaponsMay[0]?.toLowerCase().includes('lance')?'Lance (optional)':'Optional',f:'selOptWeapon',items:parsed.weaponsMay,t:'check'});
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
        return `<label class="ub-cg-pill ${ck?'ck':''}"
          data-tkey="${regTip(esc(u),'',cg.effect||'')}" onmouseenter="showTipKey(this.dataset.tkey)" onmouseleave="clearTip()">
          <input type="checkbox" ${ck?'checked':''} onchange="ubTogCG('${esc(u)}',this.checked)">
          ${esc(u)} <span class="ub-cg-p">(${pts})</span></label>`;
      }).join('')}
    </div>`;
  }

  // Abilities
  const abils=getAvailableAbilities(fid);
  const selA=_ub.selAbilities||[];
  const selN=new Set(selA.map(a=>a.name));
  const lim=isC?getAbilityLimit(_ub.unit):0;
  const atLim=isC&&selA.length>=lim;
  h+=`<button class="ub-abi-tog" onclick="document.getElementById('ubAbiBody').classList.toggle('open')">
    <span style="font-family:'Cinzel',serif;font-size:.78rem;font-weight:700">Abilities</span>
    <div class="ub-inh-tags">${inherent.map(a=>`<span class="inh-tag">${esc(a)}</span>`).join('')}</div>
    <span style="font-size:.7rem;color:var(--text3)">▾</span>
  </button>
  <div class="ub-abi-body" id="ubAbiBody">
    ${isC?`<div class="ub-abi-lim">Slots: <span class="${atLim?'abi-full':'abi-ok'}" id="ubAbiLim">${selA.length} / ${lim}</span></div>`:''}
    <div class="ub-abi-grid">
      ${abils.filter(a=>isC||!COMMANDER_ONLY_ABIS.has(a.name.toUpperCase())).map(a=>{
        const ck=selN.has(a.name);
        const cmdOnly=COMMANDER_ONLY_ABIS.has(a.name.toUpperCase());
        const dis=(isC&&!ck&&atLim)||(cmdOnly&&!isC);
        const tk=regTip(esc(a.name),'',a.effect||'');
        return `<label class="ub-abi-it ${ck?'ck':''} ${dis?'dis':''}"
          data-tkey="${tk}" onmouseenter="showTipKey(this.dataset.tkey)" onmouseleave="clearTip()">
          <input type="checkbox" ${ck?'checked':''} ${dis?'disabled':''} onchange="ubTogAbi('${esc(a.name)}',${a.cost||0},this.checked)">
          <span class="ub-an">${esc(a.name)}${cmdOnly?' <span style="font-size:.58rem;color:var(--amber2)">⚔</span>':''}</span>
          <span class="ub-ac">+${a.cost||0}</span></label>`;
      }).join('')}
    </div>
    ${!isC?`<div class="amber-box" style="margin-top:8px;font-size:.73rem">Ability purchasing is managed at retinue level for warrior groups.</div>`:''}
  </div>`;

  if(isNamed){
    h+=`<div class="ub-misc-row"><span>Points cost (from supplement):</span>
      <input type="number" class="ub-misc-inp" value="${parseInt(_ub.ptsPerW)||0}" min="0"
             oninput="_ub.ptsPerW=parseInt(this.value)||0;ubUpdateCost()"></div>`;
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
  const fid=_ub.faction_id;
  const tiers=getUnitTiers(fid,newUnit);
  if(!tiers.length)return;
  const uData=tiers.find(t=>t.experience_tier==='Regular')||tiers[0];
  const parsed=parseProfile(uData.full_profile||'');
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

function ubChangeTier(newTier){
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
  const isC=_ub.kind==='commander'||isCommanderUnit(_ub.unitData);
  if(COMMANDER_ONLY_ABIS.has(name.toUpperCase())&&!isC)return; // warriors can't take commander-only
  const lim=isC?getAbilityLimit(_ub.unit):999;
  if(ck){if(isC&&_ub.selAbilities.length>=lim)return;if(!_ub.selAbilities.find(a=>a.name===name))_ub.selAbilities.push({name,cost});}
  else _ub.selAbilities=_ub.selAbilities.filter(a=>a.name!==name);
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
  const isC=_ub.kind==='commander'||isCommanderUnit(_ub.unitData);
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
  if(!state.list.length){
    grid.innerHTML='';if(empty)empty.style.display='block';if(total)total.style.display='none';
    updatePtsBar();return;
  }
  if(empty)empty.style.display='none';if(total)total.style.display='flex';
  const cmds=state.list.filter(r=>r.kind==='commander');
  const wars=state.list.filter(r=>r.kind!=='commander');
  let h='';
  if(cmds.length){
    h+=`<div class="sec-hdr"><div class="sec-hdr-line"></div><span class="sec-hdr-lbl">Commanders</span><span class="sec-hdr-ct">${cmds.length}</span><div class="sec-hdr-line"></div></div>`;
    h+=cmds.map(r=>renderRow(r)).join('');
  }
  if(wars.length){
    h+=`<div class="sec-hdr"><div class="sec-hdr-line"></div><span class="sec-hdr-lbl">Warriors</span><span class="sec-hdr-ct">${wars.length}</span><div class="sec-hdr-line"></div></div>`;
    h+=wars.map(r=>renderRow(r)).join('');
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
  // CG assignment
  const cgCands=isC?state.list.filter(r=>r.id!==row.id&&r.kind!=='commander'&&cgMatch(r.unit,parsed.cgMust||parsed.cgMustFrom)):[];
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
  renderRetinue();
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
  selectFaction,
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
  ubEquip,
  ubTogCG,
  ubTogAbi,
  showTipKey,
  clearTip,
  deleteRow,
  assignCG
});

