"""Extract named-character stat blocks, options and abilities from the King John supplement docx.

Walks body elements in order. A character section is anchored by a 2x7 stat-block table
whose header row is ('', 'Move', 'Attack', 'Defence', 'Morale', 'Shield', 'Command'). The
preceding 1x1 title table gives the character display name. The following paragraphs and
tables yield the OPTIONS text and the ABILITIES table.
"""
from __future__ import annotations
import json
import re
import sys
from pathlib import Path
from docx import Document
from docx.oxml.ns import qn

DOCX = Path(r"D:/AI-Workstation/Antigravity/apps/Barons War List Builder/src/Barons_War_King_John UPDATED (1).docx")

STAT_HEADERS = ['Move', 'Attack', 'Defence', 'Morale', 'Shield', 'Command']

def cell_text(cell):
    return cell.text.replace('’', "'").replace('–', '-').replace('—', '-').strip()

def is_stat_table(rows):
    """A 2x7 table: header row Move/Attack/Defence/Morale/Shield/Command + data row."""
    if len(rows) != 2 or len(rows[0]) != 7 or len(rows[1]) != 7:
        return False
    return [c.strip() for c in rows[0][1:7]] == STAT_HEADERS

def get_table_rows(table):
    return [[cell_text(c) for c in r.cells] for r in table.rows]

def main():
    doc = Document(DOCX)
    body = doc.element.body

    # Walk body in document order. Build a flat sequence: ('p', text) or ('t', rows, table_index)
    seq = []
    table_idx = 0
    for child in body.iterchildren():
        if child.tag == qn('w:p'):
            text = ''.join((t.text or '') for t in child.iter(qn('w:t')))
            text = text.replace('’', "'").replace('–', '-').replace('—', '-').strip()
            if text:
                seq.append(('p', text))
        elif child.tag == qn('w:tbl'):
            t = doc.tables[table_idx]
            rows = get_table_rows(t)
            seq.append(('t', rows, table_idx))
            table_idx += 1

    # Find every stat-table position; the immediately preceding title table is the name.
    characters = []
    for i, item in enumerate(seq):
        if item[0] != 't':
            continue
        rows = item[1]
        if not is_stat_table(rows):
            continue
        # Skip warrior stat tables (their preceding title says "TIER 1/2/3" etc.)
        # Look back for the most recent 1x1 title table.
        title = None
        for j in range(i - 1, max(-1, i - 6), -1):
            if seq[j][0] == 't' and len(seq[j][1]) == 1 and len(seq[j][1][0]) == 1:
                title_text = seq[j][1][0][0]
                if title_text and 'TIER' not in title_text and 'WARRIORS (TIER' not in title_text:
                    title = title_text
                    break
            if seq[j][0] == 't' and len(seq[j][1]) >= 2:
                # Don't cross another stat table or multi-row table
                break
        if not title:
            continue
        # Skip if the title still looks like a unit header (e.g. "TIER 2", "FEUDAL WARRIORS")
        if re.search(r'\bTIER\s+\d', title, re.I) or 'WARRIORS' in title.upper() and 'WARRIOR' == title.upper().split()[-1]:
            continue
        # Stat row data
        stat_row = rows[1]
        char_label = stat_row[0] or title
        stats = {
            'move': stat_row[1],
            'attack': stat_row[2],
            'defence': stat_row[3],
            'morale': stat_row[4],
            'shield': stat_row[5],
            'command': stat_row[6],
        }
        # Walk forward to capture OPTIONS paragraphs and ABILITIES table
        options_text = []
        abilities = []
        in_options = False
        in_abilities_header = False
        for k in range(i + 1, min(len(seq), i + 60)):
            it = seq[k]
            if it[0] == 't':
                tt = it[1]
                if len(tt) == 1 and len(tt[0]) == 1:
                    th = tt[0][0].upper()
                    if 'OPTIONS' == th.strip():
                        in_options = True
                        in_abilities_header = False
                        continue
                    if 'ABILITIES' in th and '-' in th:
                        # e.g. "KING JOHN - ABILITIES"
                        in_options = False
                        in_abilities_header = True
                        continue
                    # Another character title — stop
                    if th and th == th.upper() and len(th.split()) <= 6 and th != 'OPTIONS':
                        # Could be next character header — break
                        break
                if len(tt) >= 2 and tt[0] and tt[0][0].upper() in ('ABILITY',):
                    # Abilities table
                    for arow in tt[1:]:
                        if len(arow) >= 3 and arow[0]:
                            abilities.append({
                                'name': arow[0].strip(),
                                'effect': arow[1].strip(),
                                'cost': arow[2].strip(),
                            })
                    break
                if is_stat_table(tt):
                    break
            elif it[0] == 'p':
                if in_options or (not in_abilities_header and len(options_text) < 30):
                    # Collect paragraphs until we hit the abilities table
                    if it[1].upper().endswith('ABILITIES'):
                        continue
                    options_text.append(it[1])
        characters.append({
            'title': title,
            'label': char_label,
            'stats': stats,
            'options_text': '\n'.join(options_text)[:2000],
            'abilities': abilities,
        })

    print(f'Extracted {len(characters)} characters\n')
    for c in characters:
        print(f"{c['title']} ({c['label']}): {c['stats']}  abilities={len(c['abilities'])}")
    out_path = Path(r"D:/AI-Workstation/Antigravity/apps/Barons War List Builder/tools/extracted_characters.json")
    out_path.write_text(json.dumps(characters, indent=2), encoding='utf-8')
    print(f'\nWrote {out_path}')

if __name__ == '__main__':
    main()
