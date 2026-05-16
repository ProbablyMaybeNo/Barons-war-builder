// One-shot script to apply Ross's updated abilities inventory.
// Run: node tools/apply_inventory_updates_2026-05-16.mjs

import fs from 'node:fs';
import vm from 'node:vm';

const path = 'data/game-data.js';
let code = fs.readFileSync(path, 'utf8');

function safeReplace(from, to, label) {
  const occ = code.split(from).length - 1;
  if (occ !== 1) { console.error('FAIL: ' + label + ' anchor occurrences: ' + occ); process.exit(1); }
  code = code.replace(from, to);
  console.log('OK   ' + label);
}

// 1a. Flemish revert (BRABANCON already reverted by previous partial run, skipping)
function safeReplaceIfPresent(from, to, label) {
  const occ = code.split(from).length - 1;
  if (occ === 0) { console.log('skip ' + label + ' (already in target state)'); return; }
  if (occ !== 1) { console.error('FAIL: ' + label + ' anchor occurrences: ' + occ); process.exit(1); }
  code = code.replace(from, to);
  console.log('OK   ' + label);
}
safeReplaceIfPresent(
  'Spearmen. In Melee Combat the Group may re-roll all Attack dice in any of its Attack dice pools. All dice in the Attack dice pool must be re-rolled (successes as well as failures).", "inherent_only": true}',
  'Spearmen. In Melee Combat the Group may re-roll all Attack dice in any of its Attack dice pools. All dice in the Attack dice pool must be re-rolled (successes as well as failures)."}',
  'flemish BRABANCON revert'
);
safeReplace(
  'The Cavalry group may not Ride Down and must Charge as normal. The Braced Group will Attack Back, with any Warriors who are removed as casualties contributing Attack dice.", "inherent_only": true}',
  'The Cavalry group may not Ride Down and must Charge as normal. The Braced Group will Attack Back, with any Warriors who are removed as casualties contributing Attack dice."}',
  'flemish BRACE revert'
);
safeReplace(
  'or Bills. If a Group with this Ability has a Defend Action when it is Charged, each successfully defended Attack (using Defence dice but not Shield rolls) generates a bonus Attack.", "inherent_only": true}',
  'or Bills. If a Group with this Ability has a Defend Action when it is Charged, each successfully defended Attack (using Defence dice but not Shield rolls) generates a bonus Attack."}',
  'flemish SPEAR HEDGE revert'
);

// 1b. Welsh TEULU cost 2 -> 1
{
  const tag = '"ability": "TEULU", "cost": 2.0';
  let i = -1, found = false;
  while ((i = code.indexOf(tag, i + 1)) >= 0) {
    const before = code.slice(Math.max(0, i - 200), i);
    if (before.includes('"welsh"')) {
      code = code.slice(0, i) + '"ability": "TEULU", "cost": 1.0' + code.slice(i + tag.length);
      console.log('OK   welsh TEULU cost 2 -> 1');
      found = true;
      break;
    }
  }
  if (!found) { console.error('FAIL: welsh TEULU not found'); process.exit(1); }
}

// 1c. Poitevin FEUD dedup — remove one of two identical entries
{
  const feudTag = '"faction_id": "poitevin", "faction_name": "Poitevin", "ability": "FEUD"';
  const positions = [];
  let i = -1;
  while ((i = code.indexOf(feudTag, i + 1)) >= 0) positions.push(i);
  console.log('  poitevin FEUD entries at positions: ' + positions.join(', '));
  if (positions.length !== 2) { console.error('FAIL: expected 2 FEUD entries, found ' + positions.length); process.exit(1); }
  const startBrace = code.lastIndexOf('{', positions[1]);
  let depth = 1, j = startBrace + 1;
  while (depth > 0 && j < code.length) { if (code[j] === '{') depth++; else if (code[j] === '}') depth--; j++; }
  let cutStart = startBrace;
  if (code.slice(startBrace - 2, startBrace) === ', ') cutStart = startBrace - 2;
  code = code.slice(0, cutStart) + code.slice(j);
  console.log('OK   poitevin FEUD duplicate removed');
}

// 1d. Poitevin Paladin flips
function flipPoitevin(ability) {
  const tag = '"faction_id": "poitevin", "faction_name": "Poitevin", "ability": "' + ability + '"';
  const positions = [];
  let i = -1;
  while ((i = code.indexOf(tag, i + 1)) >= 0) positions.push(i);
  if (positions.length !== 1) { console.error('FAIL: ' + ability + ' poitevin occurrences: ' + positions.length); process.exit(1); }
  const startBrace = code.lastIndexOf('{', positions[0]);
  let depth = 1, j = startBrace + 1;
  while (depth > 0 && j < code.length) { if (code[j] === '{') depth++; else if (code[j] === '}') depth--; j++; }
  const closeBraceIdx = j - 1;
  const objText = code.slice(startBrace, j);
  if (/"inherent_only":/.test(objText)) { console.log('skip ' + ability + ' (already has inherent_only)'); return; }
  code = code.slice(0, closeBraceIdx) + ', "inherent_only": true' + code.slice(closeBraceIdx);
  console.log('OK   poitevin ' + ability + ' -> inherent_only=true (Paladin)');
}
['CRUELTY', 'EXPERIENCED KNIGHT', 'GLORY SEEKERS', 'INSPIRE'].forEach(flipPoitevin);

// 2. Insertions into retinue_abilities array
function findRetinueAbilitiesClose() {
  const keyIdx = code.indexOf('"retinue_abilities":');
  if (keyIdx < 0) throw new Error('retinue_abilities not found');
  const openBr = code.indexOf('[', keyIdx);
  let depth = 1, j = openBr + 1;
  while (depth > 0 && j < code.length) { if (code[j] === '[') depth++; else if (code[j] === ']') depth--; j++; }
  return j - 1;
}

// Load CURRENT state to look up effect text from generic + existing retinue
const tmpCode = code.replace(/export const /g, 'global.');
const ctx = { global: {} };
vm.runInNewContext(tmpCode, ctx);
const BW = ctx.global.BW_DATA;
const eg = (n) => BW.purchasable.find(a => a.name === n)?.effect;
const er = (n) => BW.retinue_abilities.find(a => a.ability === n)?.effect;

function entry(fid, factionName, ability, cost, effect, inherent_only) {
  const obj = { faction_id: fid, faction_name: factionName, ability, cost, effect };
  if (inherent_only) obj.inherent_only = true;
  return JSON.stringify(obj);
}

const newEntries = [
  // Feudal Retinue (purchasable additions)
  entry('feudal_european', 'Feudal European', 'REBEL', 3, eg('REBEL')),
  entry('feudal_european', 'Feudal European', 'SKILLED SPEARMEN', 1, eg('SKILLED SPEARMEN')),
  entry('feudal_european', 'Feudal European', 'VETERAN CRUSADER', 3, eg('VETERAN CRUSADER')),
  // Medieval Scottish Inherent (lookup glossary entries — units still need to reference them)
  entry('medieval_scottish', 'Medieval Scottish', 'NIMBLE', 1, eg('NIMBLE'), true),
  entry('medieval_scottish', 'Medieval Scottish', 'RABBLE', 1, er('RABBLE'), true),
  entry('medieval_scottish', 'Medieval Scottish', 'REPUTATION', 1, 'Reputation is everything. The Group and its Commander (if part of the Group) ignore the negative effects of Morale Penalties in Melee Combat.', true),
  entry('medieval_scottish', 'Medieval Scottish', 'RESOLVED', 1, 'Steadfast in adversity — see King John supplement for full effect.', true),
  entry('medieval_scottish', 'Medieval Scottish', 'RIDE DOWN', 2, er('RIDE DOWN'), true),
  entry('medieval_scottish', 'Medieval Scottish', 'SPEAR HEDGE', 1, er('SPEAR HEDGE'), true),
  entry('medieval_scottish', 'Medieval Scottish', 'SKIRMISHER', 2, eg('SKIRMISHER'), true),
  entry('medieval_scottish', 'Medieval Scottish', 'WEAPON CHOICE', 2, er('WEAPON CHOICE'), true),
];

const closePos = findRetinueAbilitiesClose();
const insertText = ', ' + newEntries.join(', ');
code = code.slice(0, closePos) + insertText + code.slice(closePos);
console.log('OK   inserted ' + newEntries.length + ' new entries into retinue_abilities');

fs.writeFileSync(path, code, 'utf8');
console.log();
console.log('wrote ' + code.length + ' bytes.');

// Verify
const verifyCode = fs.readFileSync(path, 'utf8').replace(/export const /g, 'global.');
const ctx2 = { global: {} };
vm.runInNewContext(verifyCode, ctx2);
const BWv = ctx2.global.BW_DATA;
const factions = ['feudal_european', 'mercenary', 'flemish', 'poitevin', 'medieval_scottish', 'welsh', 'outlaw'];
console.log();
console.log('=== Post-write state ===');
for (const fid of factions) {
  const all = BWv.retinue_abilities.filter(a => a.faction_id === fid);
  const inh = all.filter(a => a.inherent_only).map(a => a.ability).sort();
  const ret = all.filter(a => !a.inherent_only).map(a => a.ability).sort();
  console.log(fid + ' inh(' + inh.length + '): ' + inh.join(', '));
  console.log(fid + ' ret(' + ret.length + '): ' + ret.join(', '));
  console.log();
}
