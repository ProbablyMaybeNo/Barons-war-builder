"""Apply verified point-cost fixes to the King John DOCX.

Updates the Experience: ... line on specific unit profiles, preserving the
bold "Experience:" formatting by editing only the trailing non-bold run.

Targets (paragraph indices located via a separate inventory pass):
  idx 678  FE Mounted Serjeants  ->  Irregular (12), Regular (15), Veteran (18)
  idx 702  FE Crossbowmen        ->  Green (8), Irregular (11), Regular (14), Veteran (17)
  idx 2161 Scottish Burghers     ->  Irregular (12), Regular (15), Veteran (18)
  idx 2145 Scottish Crossbowmen  ->  Irregular (12), Regular (15), Veteran (18)
"""

from pathlib import Path
import shutil

from docx import Document
from docx.oxml.ns import qn

DOCX = Path(r"D:\AI-Workstation\Antigravity\apps\Barons War List Builder\src\Barons_War_King_John UPDATED (1).docx")
BAK = DOCX.with_suffix(DOCX.suffix + ".bak")

FIXES = [
    (678, "Irregular (12), Regular (15), Veteran (18)", "FE Mounted Serjeants"),
    (702, "Green (8), Irregular (11), Regular (14), Veteran (17)", "FE Crossbowmen"),
    (2145, "Irregular (12), Regular (15), Veteran (18)", "Scottish Crossbowmen"),
    (2161, "Irregular (12), Regular (15), Veteran (18)", "Scottish Burghers"),
]


def update_experience_run(p_elem, new_tail):
    """Replace the text of the FIRST non-bold run with `new_tail`.

    Assumes layout:
        Run 0 (bold): "Experience: "
        Run 1 (not bold): "...the values..."
    """
    runs = list(p_elem.iter(qn("w:r")))
    target_run = None
    for r in runs:
        # detect bold
        is_bold = r.find(qn("w:rPr") + "/" + qn("w:b")) is not None
        # match w:t inside
        ts = list(r.iter(qn("w:t")))
        if not ts:
            continue
        if not is_bold:
            target_run = r
            break
    if target_run is None:
        raise RuntimeError("No non-bold run found in paragraph")
    ts = list(target_run.iter(qn("w:t")))
    # set first w:t to the new text, clear any others
    ts[0].text = new_tail
    # preserve whitespace
    ts[0].set(qn("xml:space"), "preserve")
    for extra in ts[1:]:
        extra.text = ""


def main():
    if not BAK.exists():
        shutil.copy2(DOCX, BAK)
        print(f"Backup: {BAK}")
    doc = Document(str(DOCX))
    all_p = [p for p in doc.element.body.iter(qn("w:p"))]
    print(f"Total paragraphs: {len(all_p)}")
    for idx, new_tail, label in FIXES:
        p = all_p[idx]
        before = "".join(t.text or "" for t in p.iter(qn("w:t")))
        update_experience_run(p, new_tail)
        after = "".join(t.text or "" for t in p.iter(qn("w:t")))
        print(f"  [{label}] before: {before!r}")
        print(f"  [{label}] after:  {after!r}")
    doc.save(str(DOCX))
    print(f"Saved {DOCX}")


if __name__ == "__main__":
    main()
