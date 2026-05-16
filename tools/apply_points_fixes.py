"""Apply verified point-cost fixes to data/game-data.js.

Each fix is keyed by (faction_id, unit). The fix specifies the new tier list
in order. If a tier exists in the data, its pts_per_warrior is updated. If a
tier is missing from the data but present in the fix, a new row is inserted
(cloning the closest existing row's profile fields). The full_profile string
is rewritten on every affected row so the Experience: line matches.

The screenshots in
D:\\AI-Workstation\\Antigravity\\apps\\Webscraper\\data\\images\\Barons War King John #2
are the source of truth. See tools/audit_report.md for the discrepancy table.
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "game-data.js"

# Fix list: (faction_id, unit) -> [(tier, pts_per_warrior), ...]
# Source: screenshots in Webscraper/data/images/Barons War King John #2
FIXES = {
    ("feudal_european", "Mounted Serjeants"): [
        ("Irregular", 12), ("Regular", 15), ("Veteran", 18),
    ],
    ("feudal_european", "Crossbowmen"): [
        ("Green", 8), ("Irregular", 11), ("Regular", 14), ("Veteran", 17),
    ],
    ("medieval_scottish", "Scottish Burghers"): [
        ("Irregular", 12), ("Regular", 15), ("Veteran", 18),
    ],
    ("medieval_scottish", "Scottish Crossbowmen"): [
        ("Irregular", 12), ("Regular", 15), ("Veteran", 18),
    ],
}

TIER_ORDER = ["Green", "Irregular", "Regular", "Veteran"]


def build_exp_line(tiers):
    parts = [f"{t} ({p})" for t, p in tiers]
    return "Experience: " + ", ".join(parts)


def rewrite_profile(profile, new_exp_line):
    return re.sub(r"^Experience:[^\n]*", new_exp_line, profile, count=1, flags=re.M)


def main():
    text = DATA.read_text(encoding="utf-8")
    m = re.search(r"export const BW_DATA\s*=\s*(\{.*?\});", text, re.DOTALL)
    if not m:
        raise SystemExit("Could not locate BW_DATA in game-data.js")
    data = json.loads(m.group(1))
    units = data["units"]

    changes = []
    for (fid, name), new_tiers in FIXES.items():
        exp_line = build_exp_line(new_tiers)
        # collect existing rows for this unit, indexed by tier
        existing = [u for u in units if u["faction_id"] == fid and u["unit"] == name]
        if not existing:
            print(f"WARN: No rows found for ({fid}, {name}); skipping.")
            continue
        existing_by_tier = {u["experience_tier"]: u for u in existing}
        template = existing[0]
        # Update existing tier rows
        for tier, pts in new_tiers:
            if tier in existing_by_tier:
                row = existing_by_tier[tier]
                old_pts = row["pts_per_warrior"]
                row["pts_per_warrior"] = pts
                row["full_profile"] = rewrite_profile(row["full_profile"], exp_line)
                if old_pts != pts:
                    changes.append(f"  {fid}/{name} [{tier}]: pts {old_pts} -> {pts}")
        # Find any tiers in fix not present in existing -> insert new rows
        for tier, pts in new_tiers:
            if tier not in existing_by_tier:
                new_row = dict(template)
                new_row["experience_tier"] = tier
                new_row["pts_per_warrior"] = pts
                new_row["full_profile"] = rewrite_profile(template["full_profile"], exp_line)
                # find correct insertion position: keep tier order around the existing rows
                # Insert immediately before the first row whose tier comes after this one
                insertion_idx = None
                for idx, u in enumerate(units):
                    if u["faction_id"] != fid or u["unit"] != name:
                        continue
                    if TIER_ORDER.index(u["experience_tier"]) > TIER_ORDER.index(tier):
                        insertion_idx = idx
                        break
                if insertion_idx is None:
                    # append after the last existing row for this unit
                    last_idx = max(idx for idx, u in enumerate(units)
                                   if u["faction_id"] == fid and u["unit"] == name)
                    insertion_idx = last_idx + 1
                units.insert(insertion_idx, new_row)
                changes.append(f"  {fid}/{name} [+{tier}]: NEW row at {pts} pts")
        # Also rewrite the Experience: line of any rows that didn't change pts (e.g. Irregular kept at 12)
        # so that the full_profile experience string is consistent across all rows
        for tier in TIER_ORDER:
            row = existing_by_tier.get(tier)
            if row is not None:
                row["full_profile"] = rewrite_profile(row["full_profile"], exp_line)

    # Re-serialize and write back
    new_blob = "export const BW_DATA = " + json.dumps(data, ensure_ascii=False) + ";"
    rest = text[m.end():]
    new_text = text[: m.start()] + new_blob + rest
    DATA.write_text(new_text, encoding="utf-8")

    print(f"Applied {len(changes)} change(s):")
    for c in changes:
        print(c)
    print(f"Wrote {DATA}")


if __name__ == "__main__":
    main()
