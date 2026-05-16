"""Round 2 fixes to game-data.js — corrections + missing-unit additions
verified against the higher-quality screenshots in
D:\\AI-Workstation\\Antigravity\\apps\\Webscraper\\data\\images\\Barons War King John #2

Each fix or addition has been confirmed visually (or directly by Ross). See
tools/audit_report.md for the full audit table.

Two operations:
  1. FIXES: change tier costs / tier list on an existing unit. Also rewrites
     the Experience: line inside `full_profile` for every row.
  2. ADDITIONS: insert wholly new unit profiles. The new rows are inserted
     after the last existing row of the same faction's last similar unit
     (or simply appended at the end of the units list if no anchor matches).

Run with `py -3.13 tools/apply_round2_fixes.py`. The script is idempotent for
fixes (it just rewrites the values to the target). Additions are guarded by
a pre-check that the (faction_id, unit) does not already exist.
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "game-data.js"
TIER_ORDER = ["Green", "Irregular", "Regular", "Veteran"]


# ── Fixes: (faction_id, unit_name) -> [(tier, pts), ...]
FIXES = {
    ("poitevin", "Poitevin Cutthroats"): [
        ("Green", 10), ("Irregular", 13), ("Regular", 16), ("Veteran", 19),
    ],
    ("poitevin", "Poitevin Crossbowmen"): [
        ("Green", 8), ("Irregular", 11), ("Regular", 14), ("Veteran", 17),
    ],
    ("flemish", "Flemish Mounted Serjeants"): [
        ("Irregular", 12), ("Regular", 15), ("Veteran", 18),
    ],
    ("welsh", "Welsh Nobles"): [
        ("Irregular", 11), ("Regular", 15), ("Veteran", 18),
    ],
    ("welsh", "Mounted Welsh Nobles"): [
        ("Irregular", 11), ("Regular", 15), ("Veteran", 18),
    ],
    ("welsh", "Welsh Skirmishers"): [
        ("Green", 8), ("Irregular", 11), ("Regular", 15), ("Veteran", 18),
    ],
    ("flemish", "Burgemeester"): [
        ("Green", 23), ("Irregular", 26), ("Regular", 30),
    ],
}


# ── Renames: (faction_id, old_name) -> new_name
RENAMES = {
    ("poitevin", "Gascon Javelinmen"): "Gascon Infantry",
}


# After renames, additional cost fix for Gascon Infantry
POST_RENAME_FIXES = {
    ("poitevin", "Gascon Infantry"): [
        ("Green", 10), ("Irregular", 13), ("Regular", 18), ("Veteran", 21),
    ],
}


# ── New unit additions
def mk_unit(faction_id, faction_name, unit, kind, tiers, profile_lines, has_rabble=False):
    """Create the per-tier rows for a new unit profile."""
    exp_line = "Experience: " + ", ".join(f"{t} ({p})" for t, p in tiers)
    full_profile = "\n".join([exp_line] + profile_lines)
    rows = []
    for t, p in tiers:
        rows.append({
            "faction_id": faction_id,
            "faction_name": faction_name,
            "unit": unit,
            "kind": kind,
            "experience_tier": t,
            "pts_per_warrior": p,
            "has_rabble": has_rabble,
            "full_profile": full_profile,
        })
    return rows


ADDITIONS = []

# FE Marksman Serjeants — SS 214233 right page
ADDITIONS += mk_unit(
    "feudal_european", "Feudal European", "Marksman Serjeants", "warrior",
    [("Irregular", 12), ("Regular", 16), ("Veteran", 19)],
    [
        "Inherent Abilities: Martial Respect, Marksman (Regulars)",
        "Weapon, Must choose one: Crossbow",
        "Armour, Must choose one: Padded, Mail (Regulars)",
    ],
)

# Mercenary Mounted Knights — SS 222108 (only as Command Group for Mounted Lord)
ADDITIONS += mk_unit(
    "mercenary", "Mercenary", "Mercenary Mounted Knights", "warrior",
    [("Irregular", 14), ("Regular", 18), ("Veteran", 21)],
    [
        "Inherent Abilities: Chivalry, Live by the Sword (Regulars), Ride Down",
        "Weapon, Must choose one: Battle Axe, Sword, Mace, Falchion, Horseman's Pick",
        "Weapon, May choose one: Lance - does not replace main Weapon",
        "Armour, Must choose one: Mail",
        "Shield, Must* choose one: Medium Shield, Large Shield (* unless equipped with Two Handed Weapon)",
        "Mount, Must choose one: Horse, Barded Horse",
        "Note: A Mercenary Retinue may only select Mounted Knights as a Command Group for a Mounted Lord.",
    ],
)

# Mercenary Mounted Serjeants — confirmed 12/15/18 by Ross
ADDITIONS += mk_unit(
    "mercenary", "Mercenary", "Mercenary Mounted Serjeants", "warrior",
    [("Irregular", 12), ("Regular", 15), ("Veteran", 18)],
    [
        "Inherent Abilities: Martial Respect",
        "Weapon, Must choose one: Battle Axe, Cavalry Spear, Sword (Regulars), Mace, Falchion",
        "Armour, Must choose one: Padded, Mail (Regulars)",
        "Shield, Must choose one: Medium Shield, Large Shield",
        "Mount, Must choose one: Horse, Barded Horse (Regulars)",
    ],
)

# Poitevin Mounted Knights — SS 235743
ADDITIONS += mk_unit(
    "poitevin", "Poitevin", "Poitevin Mounted Knights", "warrior",
    [("Irregular", 14), ("Regular", 18), ("Veteran", 21)],
    [
        "Inherent Abilities: Chivalry, Live by the Sword (Regulars), Ride Down",
        "Weapon, Must choose one: Battle Axe, Sword, Mace, Falchion, Horseman's Pick",
        "Weapon, May choose one: Lance - does not replace main Weapon",
        "Armour, Must choose one: Mail",
        "Shield, Must* choose one: Medium Shield, Large Shield (* unless equipped with Two Handed Weapon)",
        "Mount, Must choose one: Horse, Barded Horse",
    ],
)

# Poitevin Marksman Serjeants — SS 235743
ADDITIONS += mk_unit(
    "poitevin", "Poitevin", "Poitevin Marksman Serjeants", "warrior",
    [("Irregular", 12), ("Regular", 16), ("Veteran", 19)],
    [
        "Inherent Abilities: Martial Respect, Marksman (Regulars)",
        "Weapon, Must choose one: Crossbow",
        "Armour, Must choose one: Padded, Mail (Regulars)",
    ],
)

# Poitevin Mounted Serjeants — SS 235743
ADDITIONS += mk_unit(
    "poitevin", "Poitevin", "Poitevin Mounted Serjeants", "warrior",
    [("Irregular", 12), ("Regular", 15), ("Veteran", 18)],
    [
        "Inherent Abilities: Martial Respect",
        "Weapon, Must choose one: Battle Axe, Cavalry Spear, Sword (Regulars), Mace, Falchion",
        "Armour, Must choose one: Padded, Mail (Regulars)",
        "Shield, Must choose one: Medium Shield, Large Shield",
        "Mount, Must choose one: Horse, Barded Horse (Regulars)",
    ],
)

# Poitevin Bowmen — SS 235838
ADDITIONS += mk_unit(
    "poitevin", "Poitevin", "Poitevin Bowmen", "warrior",
    [("Green", 8), ("Irregular", 11), ("Regular", 15), ("Veteran", 18)],
    [
        "Inherent Abilities: Crack Shot (Regulars)",
        "Weapon, Must choose one: Bow",
        "Armour, May choose one: Padded, Mail (Regulars)",
    ],
)

# Gascon Horsemen — SS 235838 (confirmed by Ross at 13/18/21)
ADDITIONS += mk_unit(
    "poitevin", "Poitevin", "Gascon Horsemen", "warrior",
    [("Irregular", 13), ("Regular", 18), ("Veteran", 21)],
    [
        "Inherent Abilities: Gascon, Javelinmen (Regulars)",
        "Weapon, Must choose one: Javelin",
        "Armour, May choose one: Padded",
        "Shield, May choose one: Small Shield, Medium Shield (Regulars)",
        "Mount, Must choose one: Horse, Pony",
    ],
)

# Ribaldi — SS 235838
ADDITIONS += mk_unit(
    "poitevin", "Poitevin", "Ribaldi", "warrior",
    [("Green", 9), ("Irregular", 12)],
    [
        "Inherent Abilities: Melts Away",
        "Weapon, Must choose one: Hand Weapon, Spear, Sling, Improvised Two Handed Weapon*",
        "Shield, May* choose one: Small Shield (* unless equipped with Improvised Two Handed Weapon)",
    ],
)

# Flemish Mounted Burgemeester — SS 235924 (3 tiers per Ross)
ADDITIONS += mk_unit(
    "flemish", "Flemish", "Flemish Mounted Burgemeester", "commander",
    [("Green", 23), ("Irregular", 26), ("Regular", 30)],
    [
        "Inherent Abilities: Commander, Burgemeester",
        "Weapon, Must choose one: Battle Axe, Cavalry Spear, Sword, Mace, Falchion",
        "Armour, Must choose one: Padded, Mail (Regulars)",
        "Shield, Must choose one: Medium Shield, Large Shield",
        "Mount, Must choose one: Horse, Barded Horse",
    ],
)

# Flemish Bowmen — SS 235911
ADDITIONS += mk_unit(
    "flemish", "Flemish", "Flemish Bowmen", "warrior",
    [("Green", 8), ("Irregular", 11), ("Regular", 15), ("Veteran", 18)],
    [
        "Inherent Abilities: Flemish",
        "Weapon, Must choose one: Bow",
        "Armour, May choose one: Padded, Mail (Regulars)",
    ],
)

# Flemish Rabble — SS 235911
ADDITIONS += mk_unit(
    "flemish", "Flemish", "Flemish Rabble", "warrior",
    [("Green", 9), ("Irregular", 12)],
    [
        "Inherent Abilities: Massed Ranks",
        "Weapon, Must choose one: Hand Weapon, Spear, Sling, Goedendag, Improvised Two Handed Weapon*",
        "Armour, May choose one: Padded",
        "Shield, May* choose one: Small Shield (* unless equipped with Improvised Two Handed Weapon)",
    ],
    has_rabble=True,
)

# Welsh Spearmen — SS 223839
ADDITIONS += mk_unit(
    "welsh", "Welsh", "Welsh Spearmen", "warrior",
    [("Green", 8), ("Irregular", 11), ("Regular", 15), ("Veteran", 18)],
    [
        "Inherent Abilities: Wall of Spines (Regulars)",
        "Weapon, Must choose one: Spear, Bill* (Regulars)",
        "Armour, May choose one: Padded (Regulars)",
        "Shield, May* choose one: Small Shield, Medium Shield (Irregulars) (* unless equipped with Bill)",
    ],
)

# Welsh Mounted Skirmishers — SS 223839
ADDITIONS += mk_unit(
    "welsh", "Welsh", "Welsh Mounted Skirmishers", "warrior",
    [("Green", 8), ("Irregular", 11), ("Regular", 15), ("Veteran", 18)],
    [
        "Inherent Abilities: Ambush (Regulars)",
        "Weapon, Must choose one: Hand Weapon, Javelin, Cavalry Spear",
        "Armour, May choose one: Padded (Regulars)",
        "Shield, May choose one: Small Shield, Medium Shield (Regulars)",
        "Mount, Must choose one: Pony, Horse (Regulars)",
    ],
)


# ── implementation
def build_exp_line(tiers):
    return "Experience: " + ", ".join(f"{t} ({p})" for t, p in tiers)


def rewrite_profile(profile, new_exp_line):
    return re.sub(r"^Experience:[^\n]*", new_exp_line, profile, count=1, flags=re.M)


def apply_fix(units, fid, name, new_tiers, changes):
    exp_line = build_exp_line(new_tiers)
    existing = [u for u in units if u["faction_id"] == fid and u["unit"] == name]
    if not existing:
        print(f"WARN: Fix target not found: ({fid}, {name})")
        return
    template = existing[0]
    existing_by_tier = {u["experience_tier"]: u for u in existing}
    target_tiers = {t for t, _ in new_tiers}
    # Update or add per-tier rows
    for tier, pts in new_tiers:
        if tier in existing_by_tier:
            row = existing_by_tier[tier]
            old_pts = row["pts_per_warrior"]
            row["pts_per_warrior"] = pts
            row["full_profile"] = rewrite_profile(row["full_profile"], exp_line)
            if old_pts != pts:
                changes.append(f"  {fid}/{name} [{tier}]: pts {old_pts} -> {pts}")
        else:
            # Insert new row at the correct tier-order position
            new_row = dict(template)
            new_row["experience_tier"] = tier
            new_row["pts_per_warrior"] = pts
            new_row["full_profile"] = rewrite_profile(template["full_profile"], exp_line)
            insertion_idx = None
            for idx, u in enumerate(units):
                if u["faction_id"] != fid or u["unit"] != name:
                    continue
                if TIER_ORDER.index(u["experience_tier"]) > TIER_ORDER.index(tier):
                    insertion_idx = idx
                    break
            if insertion_idx is None:
                last_idx = max(idx for idx, u in enumerate(units)
                               if u["faction_id"] == fid and u["unit"] == name)
                insertion_idx = last_idx + 1
            units.insert(insertion_idx, new_row)
            changes.append(f"  {fid}/{name} [+{tier}]: NEW row at {pts} pts")
    # Remove tier rows not in the new list (e.g. if Veteran was dropped)
    for u in list(units):
        if u["faction_id"] == fid and u["unit"] == name and u["experience_tier"] not in target_tiers:
            changes.append(f"  {fid}/{name} [-{u['experience_tier']}]: REMOVED row at {u['pts_per_warrior']} pts")
            units.remove(u)
    # Ensure all remaining rows have the updated Experience: line
    for u in units:
        if u["faction_id"] == fid and u["unit"] == name:
            u["full_profile"] = rewrite_profile(u["full_profile"], exp_line)


def apply_rename(units, fid, old_name, new_name, changes):
    rows = [u for u in units if u["faction_id"] == fid and u["unit"] == old_name]
    if not rows:
        print(f"WARN: Rename target not found: ({fid}, {old_name})")
        return
    for u in rows:
        u["unit"] = new_name
    changes.append(f"  {fid}/{old_name} -> {new_name} ({len(rows)} rows)")


def apply_addition(units, new_rows, changes):
    # check existing
    fid = new_rows[0]["faction_id"]
    name = new_rows[0]["unit"]
    if any(u["faction_id"] == fid and u["unit"] == name for u in units):
        changes.append(f"  SKIP add (already exists): {fid}/{name}")
        return
    # Append at end of the faction's units block (before next faction's first row)
    insertion_idx = None
    for idx, u in enumerate(units):
        if u["faction_id"] == fid:
            insertion_idx = idx + 1  # last seen idx of this faction
    if insertion_idx is None:
        # faction doesn't exist anywhere — just append at end
        insertion_idx = len(units)
    for offset, row in enumerate(new_rows):
        units.insert(insertion_idx + offset, row)
    changes.append(f"  ADD {fid}/{name}: {len(new_rows)} rows ({[r['experience_tier']+'/'+str(r['pts_per_warrior']) for r in new_rows]})")


def main():
    text = DATA.read_text(encoding="utf-8")
    m = re.search(r"export const BW_DATA\s*=\s*(\{.*?\});", text, re.DOTALL)
    if not m:
        raise SystemExit("BW_DATA not found")
    data = json.loads(m.group(1))
    units = data["units"]
    changes = []

    print("== FIXES ==")
    for (fid, name), tiers in FIXES.items():
        apply_fix(units, fid, name, tiers, changes)

    print("== RENAMES ==")
    for (fid, old), new in RENAMES.items():
        apply_rename(units, fid, old, new, changes)

    print("== POST-RENAME FIXES ==")
    for (fid, name), tiers in POST_RENAME_FIXES.items():
        apply_fix(units, fid, name, tiers, changes)

    print("== ADDITIONS ==")
    # Group additions by unit (since each unit has multiple tier rows)
    seen = set()
    add_groups = []
    for row in ADDITIONS:
        key = (row["faction_id"], row["unit"])
        if key in seen:
            # find the group
            for g in add_groups:
                if (g[0]["faction_id"], g[0]["unit"]) == key:
                    g.append(row)
                    break
        else:
            seen.add(key)
            add_groups.append([row])
    for g in add_groups:
        apply_addition(units, g, changes)

    # Serialize back
    new_blob = "export const BW_DATA = " + json.dumps(data, ensure_ascii=False) + ";"
    rest = text[m.end():]
    new_text = text[: m.start()] + new_blob + rest
    DATA.write_text(new_text, encoding="utf-8")

    print(f"\n{len(changes)} total operations:")
    for c in changes:
        print(c)
    print(f"\nWrote {DATA}")


if __name__ == "__main__":
    main()
