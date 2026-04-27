"""Merge extracted character data into game-data.js dramatis entries.

For each entry the extractor produced, find the matching dramatis entry by display name
(after normalising case, accents and the (REGENT)/(YOUNG)/etc. suffixes), then enrich it
with structured stats/options/abilities. Preserves all existing fields.
"""
from __future__ import annotations
import json
import re
import unicodedata
from pathlib import Path

DATA_PATH = Path(r"D:/AI-Workstation/Antigravity/apps/Barons War List Builder/data/game-data.js")
EXTRACT_PATH = Path(r"D:/AI-Workstation/Antigravity/apps/Barons War List Builder/tools/extracted_characters.json")


def fold(s: str) -> str:
    s = unicodedata.normalize('NFKD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]', '', s.lower())


def parse_options_text(text: str) -> dict:
    """Pull the structured choices out of the options paragraphs."""
    out = {
        'points': None,
        'inherent_abilities': [],
        'weapon_must': [],
        'weapon_may': [],
        'armour': [],
        'shield': [],
        'mount': [],
        'cg_upgrades': [],
        'cg_must_from': '',
        'notes': [],
    }
    for line in text.split('\n'):
        line = line.strip()
        if not line:
            continue
        m = re.match(r'Points cost:\s*(\d+)', line, re.I)
        if m:
            out['points'] = int(m.group(1))
            continue
        m = re.match(r'Inherent Abilities?:\s*(.+)', line, re.I)
        if m:
            out['inherent_abilities'] = [a.strip() for a in m.group(1).split(',') if a.strip()]
            continue
        m = re.match(r'Weapon, Must choose one:\s*(.+)', line, re.I)
        if m:
            out['weapon_must'] = [w.strip() for w in m.group(1).split(',') if w.strip()]
            continue
        m = re.match(r'Weapon, May choose one:\s*(.+)', line, re.I)
        if m:
            out['weapon_may'] = [w.strip() for w in m.group(1).split(',') if w.strip()]
            continue
        m = re.match(r'Armou?r, Must choose one:\s*(.+)', line, re.I)
        if m:
            out['armour'] = [w.strip() for w in m.group(1).split(',') if w.strip()]
            continue
        m = re.match(r'Shield, (?:Must|May)\*? choose one:\s*(.+)', line, re.I)
        if m:
            out['shield'] = [w.strip() for w in m.group(1).split(',') if w.strip()]
            continue
        m = re.match(r'Mount, (?:Must|May)\*? choose one:\s*(.+)', line, re.I)
        if m:
            out['mount'] = [w.strip() for w in m.group(1).split(',') if w.strip()]
            continue
        m = re.match(r'Command Group upgrades?:\s*(.+)', line, re.I)
        if m:
            out['cg_upgrades'] = [w.strip() for w in m.group(1).split(',') if w.strip()]
            continue
        m = re.match(r'Command Group must be made from:\s*(.+)', line, re.I)
        if m:
            out['cg_must_from'] = m.group(1).strip()
            continue
        if line.startswith('Note:'):
            out['notes'].append(line)
    return out


def main():
    extracted = json.loads(EXTRACT_PATH.read_text(encoding='utf-8'))
    src = DATA_PATH.read_text(encoding='utf-8').lstrip('﻿')

    m = re.search(r'export const BW_DATA = \{', src)
    start = m.end() - 1
    depth = 0
    end = None
    for i in range(start, len(src)):
        if src[i] == '{':
            depth += 1
        elif src[i] == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    bw = json.loads(src[start:end])
    rest = src[end:]

    dram = bw['dramatis']
    by_fold = {fold(d['name']): d for d in dram}

    matched = 0
    new_entries = []
    for c in extracted:
        title = c['title']
        # Strip parenthetical suffixes for matching
        bare = re.sub(r'\s*\([^)]*\)\s*$', '', title).strip()
        key = fold(bare)
        # Try exact then partial
        target = by_fold.get(key)
        if not target:
            # partial: find any dramatis name that contains the bare name or vice versa
            for k, d in by_fold.items():
                if key in k or k in key:
                    target = d
                    break
        opts = parse_options_text(c['options_text'])
        char_data = {
            'extracted_label': c['label'],
            'variant_label': title if title != bare.upper() else None,
            'stats': c['stats'],
            'points': opts['points'],
            'inherent_abilities': opts['inherent_abilities'],
            'weapon_must': opts['weapon_must'],
            'weapon_may': opts['weapon_may'],
            'armour_options': opts['armour'],
            'shield_options': opts['shield'],
            'mount_options': opts['mount'],
            'cg_upgrades': opts['cg_upgrades'],
            'cg_must_from': opts['cg_must_from'],
            'character_abilities': c['abilities'],
            'options_notes': opts['notes'],
        }
        if target:
            target.setdefault('variants', [])
            target['variants'].append(char_data)
            matched += 1
        else:
            print(f"NO MATCH: {title}  -> creating new dramatis entry")
            new_dram = {
                'name': bare.title(),
                'retinues': '',
                'points_note': f"Points cost: {opts['points']}" if opts['points'] else '',
                'profile_and_rules': c['options_text'],
                'character_abilities': '',
                'variants': [char_data],
            }
            dram.append(new_dram)
            new_entries.append(bare.title())

    # For each dramatis with one variant, hoist the fields up so we don't always nest.
    for d in dram:
        vs = d.get('variants', [])
        if len(vs) == 1:
            v = vs[0]
            d.update({
                'stats': v['stats'],
                'points': v['points'],
                'inherent_abilities': v['inherent_abilities'],
                'weapon_must': v['weapon_must'],
                'weapon_may': v['weapon_may'],
                'armour_options': v['armour_options'],
                'shield_options': v['shield_options'],
                'mount_options': v['mount_options'],
                'cg_upgrades': v['cg_upgrades'],
                'cg_must_from': v['cg_must_from'],
                'character_abilities_struct': v['character_abilities'],
                'options_notes': v['options_notes'],
            })
            del d['variants']

    new_src = src[:start] + json.dumps(bw, ensure_ascii=False) + rest
    DATA_PATH.write_text(new_src, encoding='utf-8')
    print(f"Matched {matched} extracted -> existing dramatis. New entries: {new_entries}")
    print(f"Total dramatis after merge: {len(dram)}")


if __name__ == '__main__':
    main()
