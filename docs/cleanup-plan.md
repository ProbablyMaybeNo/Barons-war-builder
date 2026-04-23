# Cleanup scaffold

This document gives Codex a safe path to modernize the app without breaking the current version.

## Phase 1 - Preserve behavior
- Keep the original source preserved in `legacy/Barons_War_KingJohn_List_Builder.source.html`
- Keep the live app visually and functionally close to the attached prototype
- Avoid rules changes during structural extraction

Status:
- Completed for the first extraction pass

## Phase 2 - Extract domains
- factions
- units
- abilities
- equipment
- roster state
- validation

Status:
- Started
- Data is extracted to `data/game-data.js`
- UI and logic are extracted out of the single prototype HTML file

## Phase 3 - Data normalization
- Move the large data blob into smaller structured files
- Prefer faction, equipment, upgrades, and dramatis personae as separate sources

## Phase 4 - UI cleanup
- Remove inline handlers
- centralize state
- split rendering into focused modules

## Phase 5 - Testing
- points calculation
- faction restrictions
- save/load
- GitHub Pages smoke test after deploy
