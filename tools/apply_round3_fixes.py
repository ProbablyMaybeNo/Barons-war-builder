"""Round 3 fixes:
  1. Remove three "Warriors" entries that are actually stat-table headers
     mis-captured as unit profiles by the original scrape:
       - flemish/Flemish Warriors
       - medieval_scottish/Medieval Scottish Warriors
       - welsh/Medieval Welsh Warriors
  2. Update Flemish Spearmen to match book: 12/15/18 (Irreg/Reg/Vet) ->
     10/13/16 (Green/Irreg/Reg, no Veteran), with book-accurate abilities.
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "game-data.js"

REMOVE = {
    ("flemish", "Flemish Warriors"),
    ("medieval_scottish", "Medieval Scottish Warriors"),
    ("welsh", "Medieval Welsh Warriors"),
}


def main():
    text = DATA.read_text(encoding="utf-8")
    m = re.search(r"export const BW_DATA\s*=\s*(\{.*?\});", text, re.DOTALL)
    data = json.loads(m.group(1))
    units = data["units"]

    changes = []

    # 1. Remove the stat-table-header entries
    before = len(units)
    units[:] = [u for u in units if (u["faction_id"], u["unit"]) not in REMOVE]
    after = len(units)
    if before != after:
        changes.append(f"  Removed {before - after} rows for {len(REMOVE)} stat-table units: {sorted(REMOVE)}")

    # 2. Update Flemish Spearmen
    exp_line = "Experience: Green (10), Irregular (13), Regular (16)"
    profile_lines = [
        exp_line,
        "Inherent Abilities: Flemish, Massed Ranks",
        "Weapon, Must choose one: Spear, Bill*",
        "Armour, May choose one: Padded, Mail (Regulars)",
        "Shield, May* choose one: Small Shield, Medium Shield, Large Shield (Regulars) (* unless equipped with Bill)",
    ]
    full_profile = "\n".join(profile_lines)

    fs_rows = [u for u in units if u["faction_id"] == "flemish" and u["unit"] == "Flemish Spearmen"]
    if fs_rows:
        template = fs_rows[0]
        # Build the new tier rows
        new_tiers = [("Green", 10), ("Irregular", 13), ("Regular", 16)]
        # remove existing rows
        for u in fs_rows:
            units.remove(u)
            changes.append(f"  flemish/Flemish Spearmen [-{u['experience_tier']}]: REMOVED row at {u['pts_per_warrior']} pts")
        # insert new rows in faction-block-appropriate position
        # find insertion point: end of flemish faction
        insertion_idx = None
        for idx, u in enumerate(units):
            if u["faction_id"] == "flemish":
                insertion_idx = idx + 1
        if insertion_idx is None:
            insertion_idx = len(units)
        for offset, (tier, pts) in enumerate(new_tiers):
            row = {
                "faction_id": "flemish",
                "faction_name": "Flemish",
                "unit": "Flemish Spearmen",
                "kind": template["kind"],
                "experience_tier": tier,
                "pts_per_warrior": pts,
                "has_rabble": False,
                "full_profile": full_profile,
            }
            units.insert(insertion_idx + offset, row)
            changes.append(f"  flemish/Flemish Spearmen [+{tier}]: NEW row at {pts} pts")

    # Re-serialize
    new_blob = "export const BW_DATA = " + json.dumps(data, ensure_ascii=False) + ";"
    rest = text[m.end():]
    new_text = text[: m.start()] + new_blob + rest
    DATA.write_text(new_text, encoding="utf-8")

    print(f"{len(changes)} operations:")
    for c in changes:
        print(c)
    print(f"Wrote {DATA}")


if __name__ == "__main__":
    main()
