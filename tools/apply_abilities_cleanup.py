"""Remove 7 entries from BW_DATA.purchasable that aren't generic abilities:
  - Shield Discipline (not a real ability — duplicate of Raise Shields)
  - Lucky, Professional, Shove, War Wise (Mercenary retinue abilities)
  - Steal from the Rich (Mercenary/Poitevin/Scottish retinue ability)
  - Ride Down (inherent ability of every faction's mounted Knights)

All 6 of the misplaced abilities already exist in BW_DATA.retinue_abilities
with the correct faction_id and effect text, so deleting from `purchasable`
is non-destructive.
"""

import json
import re
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "data" / "game-data.js"

TO_REMOVE = {
    "SHIELD DISCIPLINE",
    "LUCKY",
    "PROFESSIONAL",
    "RIDE DOWN",
    "SHOVE",
    "STEAL FROM THE RICH",
    "WAR WISE",
}


def main():
    text = DATA.read_text(encoding="utf-8")
    m = re.search(r"export const BW_DATA\s*=\s*(\{.*?\});", text, re.DOTALL)
    data = json.loads(m.group(1))

    before = len(data["purchasable"])
    kept = [a for a in data["purchasable"] if a["name"].upper() not in TO_REMOVE]
    removed = [a["name"] for a in data["purchasable"] if a["name"].upper() in TO_REMOVE]
    data["purchasable"] = kept

    new_blob = "export const BW_DATA = " + json.dumps(data, ensure_ascii=False) + ";"
    rest = text[m.end():]
    DATA.write_text(text[:m.start()] + new_blob + rest, encoding="utf-8")

    print(f"Removed {len(removed)} entries from purchasable ({before} -> {len(kept)}):")
    for n in removed:
        print(f"  - {n}")
    print(f"Wrote {DATA}")


if __name__ == "__main__":
    main()
