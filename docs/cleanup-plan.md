# Cleanup scaffold

This document gives Codex a safe path to modernize the app without breaking the current version.

## Phase 1 — Preserve behavior
- Keep legacy app intact
- Do not modify rules logic yet

## Phase 2 — Extract domains
- factions
- units
- abilities
- equipment
- roster state
- validation

## Phase 3 — Data normalization
- Move large embedded data into structured files

## Phase 4 — UI cleanup
- Remove inline handlers
- centralize state

## Phase 5 — Testing
- points calculation
- faction restrictions
- save/load
