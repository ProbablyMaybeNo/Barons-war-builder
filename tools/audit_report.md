# Point cost audit — 2026-05-15

Source-of-truth ranking (per Ross):
1. Screenshots in `D:\AI-Workstation\Antigravity\apps\Webscraper\data\images\Barons War King John #2\` (2nd ed photos of book)
2. `D:\AI-Workstation\Antigravity\apps\Barons War List Builder\src\Barons_War_King_John UPDATED (1).docx`
3. `data/game-data.js` (deployed)

The printed first-edition rules text was set aside per Ross's instruction.

---

## 1. Fixes applied this session (verified directly from screenshots)

| Faction | Unit | Before | After | Source |
|---|---|---|---|---|
| Feudal European | Mounted Serjeants | Irreg 12 / Reg 16 / Vet 19 | Irreg 12 / Reg 15 / Vet 18 | SS 214233 right page |
| Feudal European | Crossbowmen | Irreg 12 / Reg 16 / Vet 19 (no Green) | **Green 8** / Irreg 11 / Reg 14 / Vet 17 | SS 214233 right page (crossbowmen crop) |
| Medieval Scottish | Scottish Burghers | Irreg 12 / Reg 16 / Vet 18 | Irreg 12 / Reg 15 / Vet 18 | SS 222130 right page strip 1 |
| Medieval Scottish | Scottish Crossbowmen | Irreg 12 / Reg 16 / Vet 19 | Irreg 12 / Reg 15 / Vet 18 | SS 222130 right page strip 2 |

All four also have the `full_profile` Experience: line rewritten to match.
Crossbowmen gained a brand-new Green-tier row.

---

## 2. Non-+3 patterns the screenshots CONFIRMED as correct in book

These violate the "+3 between tiers" assumption but the screenshots agree with the data. Per Ross's instruction (follow screenshots, not first-ed rules), these stay as-is.

| Faction | Unit | Pattern | Deltas | Screenshot evidence |
|---|---|---|---|---|
| Feudal European | Knights | 12/16/19 | 4/3 | SS 214233 left page (verified) |
| Feudal European | Mounted Knights | 12/16/19 | 4/3 | SS 214233 left page (verified) |
| Feudal European | Marksman Serjeants* | 12/16/19 | 4/3 | SS 214233 right page (verified) |
| Mercenary | Capitano | 25/29/32 | 4/3 | SS 222102 left page (verified) |
| Welsh | Welsh King | 35/39/42 | 4/3 | SS 222201 (verified) |
| Welsh | Mounted Welsh King | 35/39/42 | 4/3 | SS 222201 (verified) |

`*` Note: FE Marksman Serjeants is actually MISSING from `game-data.js` (see section 4d).

---

## 3. Non-+3 patterns that are PROBABLY correct (same pattern as verified unit, not directly visually verified)

| Faction | Unit | Pattern | Note |
|---|---|---|---|
| Flemish | Flemish Knights | 12/16/19 | Mirrors FE Knights |
| Flemish | Flemish Marksman Serjeants | 12/16/19 | Mirrors FE Marksman Serjeants |
| Scottish | Scottish Knights | 12/16/19 | Mirrors FE Knights |
| Mercenary | Knights | 12/16/19 | Mirrors FE Knights |
| Poitevin | Poitevin Knights | 12/16/19 | Mirrors FE Knights |
| Welsh | Welsh Knights | 12/16/19 | Mirrors FE Knights |
| Welsh | Mounted Welsh Knights | 12/16/19 | Mirrors FE Mounted Knights |
| Outlaw | Outlawed Noble | 25/29/32 | Mirrors Capitano |
| Outlaw | Mounted Outlawed Noble | 25/29/32 | Mirrors Capitano |

---

## 4. Units that need YOUR DECISION — couldn't determine 100% from screenshots

### 4a. Suspicious "12/16/19" patterns — possibly Mounted-Serjeants-style bugs (should be 12/15/18)

| Faction | Unit | Current data | Suspect because... |
|---|---|---|---|
| Flemish | Flemish Mounted Serjeants | 12/16/19 | FE Mounted Serjeants was 12/16/19→12/15/18; likely same pattern |
| Flemish | Flemish Warriors | 12/16/19 | Unit-name ambiguous — verify it isn't a duplicate of Flemish Knights |
| Scottish | Medieval Scottish Warriors | 12/16/19 | Likely a Tier-1 stat-table row captured as a unit |
| Scottish | Scottish Mounted Serjeants | 12/16/19 | Mirrors FE — should likely be 12/15/18 |
| Poitevin | Poitevin Crossbowmen | 12/16/19 | FE Crossbowmen had Green tier missing; check if Poitevin needs Green too |
| Poitevin | Poitevin Serjeants | 12/16/19 | Likely should be 12/15/18 like FE Serjeants |
| Welsh | Medieval Welsh Warriors | 12/16/19 | Same naming issue as Scottish Warriors |
| Welsh | Mounted Welsh Nobles | 12/16/19 | Verify |
| Welsh | Welsh Nobles | 12/16/19 | Verify |

### 4b. Bowmen pattern (8/11/16/19, +3/+5/+3) — unusual 5-pt jump

| Faction | Unit | Current data | Suspect because... |
|---|---|---|---|
| Feudal European | Bowmen | 8/11/16/19 | FE Crossbowmen was actually 8/11/14/17; Bowmen could be the same |
| Scottish | Scottish Bowmen | 8/11/16/19 | Same question |
| Mercenary | Mercenary Bowmen | 8/11/16/19 | Same question |
| Outlaw | Outlaw Bowmen | 9/12/16/19 | Variant Green base; verify |

### 4c. Other unusual patterns

| Faction | Unit | Current data | Notes |
|---|---|---|---|
| Scottish | Galwegians | 9/13/17/20 | +4/+4/+3 |
| Scottish | Scottish Light Cavalry | 8/11/14/18 | +3/+3/+4 |
| Welsh | Welsh Bowmen | 8/12/15/18 | +4/+3/+3 |
| Welsh | Welsh Skirmishers | 10/14/18/21 | +4/+4/+3 |
| Welsh | Welsh Lord | 24/28/32 | +4/+4 — unusual; FE/Poitevin Lord is 23/26/29/32 |
| Welsh | Welsh Mounted Lord | 24/28/32 | +4/+4 |
| Poitevin | Gascon Javelinmen | 10/15/18/21 | +5/+3/+3 |
| Poitevin | Poitevin Cutthroats | 10/15/16/19 | +5/+1/+3 — looks WRONG (Mercenary Cutthroats is 10/13/16/19) |
| Mercenary | Bandits | 8/11/15 (3 tiers) | +3/+4 |
| Outlaw | Bandits | 8/11/15 (3 tiers) | Same as Mercenary Bandits |
| Outlaw | Forest Slingers | 15/17/20 | +2/+3 — just updated by you in commit 738a07e |

### 4d. Units potentially MISSING from `game-data.js` (seen in screenshots, not in data)

| Faction | Unit | Evidence |
|---|---|---|
| Feudal European | Marksman Serjeants | SS 214233 right page (FE Tier 1) |
| Mercenary | Mounted Knights | SS 222108 — Mercenary p.106 |
| Mercenary | Mercenary Mounted Serjeants | SS 222108 — Mercenary p.106 |
| Poitevin | Poitevin Mounted Knights | SS 223611 — Poitevin Tier 1 |
| Poitevin | Poitevin Marksman Serjeants | SS 223611 |
| Poitevin | Poitevin Mounted Serjeants | SS 223611 |
| Poitevin | Gascon Infantry | SS 223611 — separate from Gascon Javelinmen |
| Welsh | Welsh Spearmen | SS 223839 |
| Welsh | Welsh Mounted Skirmishers | SS 223839 |

---

## 5. Files updated

- `data/game-data.js` — 4 unit fixes, 1 new tier row (FE Crossbowmen Green)
- `tools/apply_points_fixes.py` — repeatable fix script
- `tools/audit_report.md` — this report
- `tools/_kj_book_ocr/`, `tools/_kj_book_pages/`, `tools/_kj_strips/`, `tools/_kj_exp_crops/` — OCR text + page crops produced during the audit

`smoke-check` passes after the fixes.

The DOCX has not been updated yet — same fixes need re-applying in `scripts/build_barons_war_docx.py` over in the Webscraper project (see next step).

---

## 6. Recommended next actions for you to choose

1. **Accept the 4 confirmed fixes** and push them.
2. **Visual-verify section 4a/4b/4c** — would need either tighter screenshots of those specific pages, or you confirming each by looking at the printed book. Tell me which ones to patch and I'll do them.
3. **Decide whether to add the missing units (4d)** — these are real units in the book that the builder currently can't roster.
