# Inherent Abilities Audit — game-data.js vs King John supplement

Source of truth: `src/_user_doc.txt` + `src/_kj.txt` (extracted text from the
King John supplement + base 2nd ed rulebook). All entries below come from
`BW_DATA.units[].full_profile` `Inherent Abilities:` line in `data/game-data.js`.

Spot-checked against the source dumps; flagged items at the bottom.

---

## Feudal European

| Unit | Inherent Abilities |
|---|---|
| Lord | Chivalry, Commander, Live by the Sword |
| Mounted Lord | Chivalry, Commander, Live by the Sword, Ride Down |
| Baron (Tier 3) | Chivalry, Commander, Live by the Sword |
| Mounted Baron (Tier 3) | Chivalry, Commander, Live by the Sword, Ride Down |
| Serjeant at Arms | Commander, Martial Respect |
| Mounted Serjeant at Arms | Commander, Martial Respect |
| Knights | Chivalry, Live by the Sword (Regulars) |
| Mounted Knights | Chivalry, Live by the Sword (Regulars), Ride Down |
| Serjeants | Martial Respect |
| Mounted Serjeants | Chivalry, Live by the Sword (Regulars) |
| Spearmen | Martial Respect |
| Bowmen | Measured Shot (Regulars), Every Bloody Sunday (Regulars) |
| Crossbowmen | Martial Respect, Marksman (Regulars) |
| Marksman Serjeants | Martial Respect, Marksman (Regulars) |
| Squires | Squire |
| Militant Monks | Faith |
| Levy | Sorry M'lord |

## Mercenary

| Unit | Inherent Abilities |
|---|---|
| Mercenary Lord | Chivalry, Commander, Live by the Sword |
| Mercenary Mounted Lord | Chivalry, Commander, Live by the Sword, Ride Down |
| Capitano | Commander, Live by the Sword (Regulars), Martial Respect |
| Knights | Chivalry, Live by the Sword (Regulars) |
| Mercenary Mounted Knights | Chivalry, Live by the Sword (Regulars), Ride Down |
| Mercenary Serjeants | Martial Respect |
| Mercenary Mounted Serjeants | Martial Respect |
| Mercenary Marksman Serjeants | Martial Respect, Marksman (Regulars) |
| Mercenary Bowmen | Measured Shot (Regulars) |
| Mercenary Cutthroats | Gutter Thug (Green/Irregular), Old Soldiers (Regulars) |
| Bandits | Forager, Rabble (Green/Irregular) |

## Flemish

| Unit | Inherent Abilities |
|---|---|
| Flemish Lord | Chivalry, Commander, Live by the Sword |
| Flemish Mounted Lord | Chivalry, Commander, Live by the Sword, Ride Down |
| Flemish Baron | Chivalry, Commander, Live by the Sword |
| Flemish Mounted Baron | Chivalry, Commander, Live by the Sword, Ride Down |
| Burgemeester | Commander, Burgemeester, Flemish |
| Flemish Mounted Burgemeester | Commander, Burgemeester |
| Flemish Knights | Chivalry, Live by the Sword (Regulars) |
| Flemish Mounted Serjeants | Flemish, Martial Respect |
| Flemish Marksman Serjeants | Flemish, Martial Respect, Marksman (Regulars) |
| Flemish Crossbowmen | Flemish, Marksman (Regulars) |
| Flemish Bowmen | Flemish |
| Flemish Militia | Flemish, Rabble (Green and Irregular), Massed Ranks |
| Flemish Spearmen | Flemish, Massed Ranks |
| Flemish Rabble | Massed Ranks |

## Poitevin

| Unit | Inherent Abilities |
|---|---|
| Poitevin Lord | Chivalry, Commander, Live by the Sword |
| Poitevin Mounted Lord | Chivalry, Commander, Live by the Sword, Ride Down |
| Poitevin Paladin | Chivalry, Commander, Live by the Sword, Paladin |
| Poitevin Mounted Paladin | Chivalry, Commander, Live by the Sword, Paladin, Ride Down |
| Poitevin Knights | Chivalry, Live by the Sword (Regulars) |
| Poitevin Mounted Knights | Chivalry, Live by the Sword (Regulars), Ride Down |
| Poitevin Serjeants | Martial Respect |
| Poitevin Mounted Serjeants | Martial Respect |
| Poitevin Marksman Serjeants | Martial Respect, Marksman (Regulars) |
| Poitevin Crossbowmen | Martial Respect, Marksman (Regulars) |
| Poitevin Bowmen | Crack Shot (Regulars) |
| Poitevin Cutthroats | Gutter Thug (Green/Irregular), Old Soldiers (Regulars) |
| Gascon Infantry | Gascon, Javelinmen (Regulars) |
| Gascon Horsemen | Gascon, Javelinmen (Regulars) |
| Ribaldi | Melts Away |

## Medieval Scottish

| Unit | Inherent Abilities |
|---|---|
| Scottish Lord | Chivalry, Commander, Live by the Sword |
| Scottish Mounted Lord | Chivalry, Commander, Live by the Sword, Ride Down |
| Scottish Baron | Chivalry, Commander, Live by the Sword |
| Scottish Mounted Baron | Chivalry, Commander, Live by the Sword, Ride Down |
| Gaelic Lord | Commander, Bloodlust |
| Scottish Knights | Chivalry, Live by the Sword (Regulars) |
| Scottish Serjeants | Martial Respect |
| Scottish Mounted Serjeants | Martial Respect |
| Scottish Crossbowmen | Martial Respect, Marksman (Regulars) |
| Scottish Light Cavalry | Nimble, Rabble (Green and Irregular) |
| Scottish Burghers | Martial Respect |
| Scottish Bowmen | Rabble (Green and Irregular), Measured Shot (Regulars) |
| Scottish Lowlanders | Rabble (Green and Irregular), Volley (Irregulars) |
| Gaelic Levies | Rabble (Green and Irregular) |
| Galwegians | Hurly-Burly (Regulars), Reputation, Weapon Choice |

## Welsh

| Unit | Inherent Abilities |
|---|---|
| Welsh King | Chivalry, Commander, Live by the Sword (Regulars) |
| Mounted Welsh King | Chivalry, Commander, Live by the Sword (Regulars), Ride Down |
| Welsh Mounted Lord | Chivalry, Commander, Live by the Sword (Regulars), Ride Down |
| Welsh Knights | Chivalry, Live by the Sword (Regulars) |
| Mounted Welsh Knights | Chivalry, Live by the Sword (Regulars), Ride Down |
| Welsh Nobles | Live by the Sword (Regulars) |
| Mounted Welsh Nobles | Live by the Sword (Regulars), Ride Down |
| Welsh Spearmen | Wall of Spines (Regulars) |
| Welsh Bowmen | Volley (Irregulars) |
| Welsh Skirmishers | Skirmisher, Lightning Raid (Regulars) |
| Welsh Mounted Skirmishers | Ambush (Regulars) |

## Outlaw

| Unit | Inherent Abilities |
|---|---|
| Outlawed Noble | Challenger, Commander, Live by the Sword (Regulars+) |
| Mounted Outlawed Noble | Challenger, Commander, Live by the Sword (Regulars+) |
| Wolfshead | Commander, Inspire, Life in the Forest |
| Outlaw Serjeants | Feud |
| Mounted Outlaw Serjeants | Feud |
| Outlaws | Melt Away |
| Outlaw Bowmen | Melt Away, Every Bloody Sunday (Regulars+) |
| Cutthroats | Gutter Thug (Green/Irregular), Old Soldiers (Regulars+) |
| Forest Slingers | Live for the Hunt (Regulars+), Masters of the Wild |
| Bandits | Forager, Rabble (Green/Irregular) |

## Named Characters (dramatis)

| Character | Retinues | Inherent Abilities |
|---|---|---|
| King John | Feudal European, Poitevin | Chivalry, Commander, Cruel King, Cunning Tactician, Fear of Treachery, To the King! |
| William Marshal | Feudal European | Commander, Chivalry, For the Realm, Justiciar, The Greatest Knight |
| William Marshal (Young) | Feudal European | Commander, Chivalry, For the Realm, The Greatest Knight, Tourney Knight |
| Philippe Marc | Feudal European | Commander, Chivalry, Cruel Lord, Dishonourable, Steal from the Rich |
| Hubert de Burgh | Feudal European | Commander, Chivalry, Justiciar, Resolute Defender, Within Reach |
| William Longespee | Feudal European | Commander, Chivalry, Battle Cry, Charismatic Leader, Inspiring Presence |
| Peter des Roches | Feudal Eur., Flemish (arch.), Poitevin (arch.) | Commander, Devoted Faith, Prelate, Wily Commander |
| Stephen Langton | Feudal Eur., Flemish (arch.), Poitevin (arch.) | Commander, Divine Intervention, Pious Air |
| King Alexander II | Medieval Scottish, Feudal European | Commander, Chivalry, Charismatic Leader, Fox Cub, Inspiring Presence, To the King! |
| Robin Hood | Outlaw | Commander, Inspire, Life in the Forest, Misdirection, Silver Arrow, Weapon Choice |
| Maid Marian | Outlaw | Commander, Calming Presence, Courtesy, Friends of the Forest, Inspire, Weapon Choice |
| Little John | Outlaw | Merry Men, Steal from the Rich, Weapons Master; counts as a Pennant |
| Friar Tuck | Outlaw | Devoted Faith, Merry Men, Weapon Choice; counts as a Priest |
| Allan-a-Dale | Outlaw | Inspiring Presence, Merry Men, Weapon Choice; counts as a Musician |
| Will Scarlett | Outlaw | Live by the Sword, Merry Men, Open Up |
| Robert fitzWalter | Feudal Eur., Outlaw (Outlawed Noble) | Commander, Chivalry, Charismatic Leader, Inspired Leader |
| Thomas of Perche | Feudal European | Commander, Chivalry, Excommunicate, Glory Seekers, Momentum |
| William de Warenne | Feudal European | Commander, Chivalry, Charismatic Leader, Old Campaigner |
| Faulkes de Breauté | Feudal European, Mercenary | Commander, Bloodlust, Dishonourable, Fear, King's Justice |
| William of Cassingham | Outlaw (Wolfshead) | Commander, Cruelty, For the Realm, Inspire, Watchers in the Woods |
| King Philip II of France | Feudal European | Commander, Chivalry, Diligent, Schemer, To the King! |
| Prince Louis of France | Feudal European | Commander, Chivalry, Excommunicate, For the Lion!, Inspiring Presence, The Lion |
| Eustace the Monk | Outlaw, Mercenary | Commander, All to Gain, Cruelty, Hefty Ransom |
| Fulk fitzWarin | Feudal European, Outlaw (Outlawed Noble) | Commander, All or Nothing, All to Gain |
| Owain ap Gruffydd | Medieval Welsh | Commander, Calming Presence |
| Rhys Ieuanc | Medieval Welsh | Commander, Battle Cry, Challenger, Unflinching |
| King Louis VIII | Feudal European | Commander, Chivalry, For the Lion!, Inspiring Presence, The Lion, To the King! |

---

## Items I'm not 100% confident on

Each item has the **data value**, the **source-dump value** (where I could find it), and the suggested action.

### Confirmed mismatches against source dump

1. **Flemish Spearmen**
   - Data: `Flemish, Massed Ranks`
   - Source (_user_doc.txt L1778): `Flemish, Martial Respect`
   - Action: probably should be **Flemish, Martial Respect**.

2. **Galwegians** (Medieval Scottish)
   - Data: `Hurly-Burly (Regulars), Reputation, Weapon Choice`
   - Source (_user_doc.txt L2638): `Hurly-Burly (Regulars), Reputation(Green and Irregular)`
   - Action: drop `Weapon Choice`; qualify Reputation as **(Green and Irregular)**. (Reputation as a top-level inherent in the rulebook glossary was added under that name — see `INHERENT_GLOSSARY` in `app.js`.)

3. **Flemish Rabble**
   - Data: `Massed Ranks` (no Flemish)
   - Source: not found under that exact name in dumps. Flemish Militia (L1768) has `Flemish, Rabble (Green and Irregular), Massed Ranks`. If "Flemish Rabble" is the Green tier variant it likely needs `Flemish, Massed Ranks` at minimum.
   - Action: needs your eyes on the printed supplement.

4. **Flemish Bowmen**
   - Data: `Flemish` (just the one)
   - Source: not found as a separate unit in the dump (the King John Flemish list runs Militia/Spearmen/Knights/Mounted Serjeants/Marksman Serjeants/Crossbowmen — no Bowmen).
   - Action: confirm this unit exists in the supplement and add the correct inherents, or remove the unit.

5. **Flemish Mounted Burgemeester**
   - Data: `Commander, Burgemeester` (missing `Flemish`)
   - Foot Burgemeester has `Commander, Burgemeester, Flemish`. The mounted variant almost certainly inherits Flemish too.
   - Action: probably add **Flemish**.

### Units not found in any source dump (may be extras or different naming)

6. **Ribaldi** (Poitevin) — `Melts Away`. No match in `_user_doc.txt`, `_kj.txt`, or `_docx_text.txt`. Also note spelling: `Melts Away` (data) vs `Melt Away` (Outlaws inherent — same ability, different conjugation).

7. **Welsh Mounted Skirmishers** — `Ambush (Regulars)`. The supplement only lists *Welsh Skirmishers* on foot. Mounted Welsh Nobles have a note allowing upgrade to "Skirmisher" — suggests this isn't a standalone unit in the rulebook.

8. **Squires** (Feudal European) — `Squire`. Audit note (`tools/audit_report.md`) says the rulebook ability is named `SQUIRES` (plural) when listed in the inherent-abilities table — minor inconsistency.

### Outlaw entries that don't match the audit_report.md ability list

9. **Forest Slingers** — `Live for the Hunt (Regulars+), Masters of the Wild`. The prior abilities audit (tools/audit_report.md L212) flagged `LIVE FOR THE HUNT` as "not in docx — REMOVE". So either the audit was wrong, the ability is in the supplement under another name (e.g. `LIVE FOR THE FOREST`), or this unit's inherent should be different.

10. **Wolfshead** — `Commander, Inspire, Life in the Forest`. The Outlaw inherent ability is listed in the supplement glossary as `LIVE FOR THE FOREST` (see audit_report.md L211, _user_doc.txt L3048). "Life in the Forest" appears in the dramatis (Robin Hood, used as a character-specific ability) — possibly two different abilities, possibly a naming drift.

11. **Outlawed Noble / Mounted Outlawed Noble** — Both have `Challenger, Commander, Live by the Sword (Regulars+)`. The supplement says of Welsh Lords/Nobles that they count as Knights for Chivalry purposes — does the supplement give Outlawed Noble Chivalry as well? Worth a quick check; if yes, missing here.

12. **Mounted Outlaw Serjeants** — `Feud` only. The mounted serjeant pattern across other factions is `inherent + Ride Down` (e.g. Feudal Mounted Serjeants get Ride Down via Chivalry+LbtS, Mercenary Mounted Knights get Ride Down). Is `Ride Down` missing here, or are mounted outlaws explicitly excluded?

### Suffix consistency

13. The outlaw faction tags abilities with `(Regulars+)` while every other faction uses `(Regulars)`. Functionally identical, just inconsistent.

14. **Flemish Militia** / **Scottish Light Cavalry** / **Scottish Bowmen** / **Scottish Lowlanders** / **Gaelic Levies** use `(Green and Irregular)`. **Mercenary Cutthroats** / **Bandits** / **Poitevin Cutthroats** / **Cutthroats** use `(Green/Irregular)`. Just style drift, but the abilities are the same.
