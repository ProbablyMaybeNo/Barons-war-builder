# Barons War Builder

A Codex-friendly starter repository for building a **Barons' War** list builder.

## Purpose

This project is intended to become a practical roster and list-building tool for Barons' War. The goal is to create a clean, maintainable codebase that can be worked on effectively with ChatGPT Codex and other coding agents.

## Initial goals

- Store faction, unit, upgrade, and equipment data in a structured format
- Validate lists against Barons' War army-building rules
- Calculate points totals automatically
- Provide a clear foundation for either:
  - a simple web app, or
  - a data-first backend that can later power a UI

## Suggested first milestones

1. Define the project data model
2. Add sample Barons' War data files
3. Build a rules validation layer
4. Build a basic roster builder flow
5. Add import/export support

## Recommended stack

This repo is currently scaffolded to be flexible. A good starting path would be:

- **TypeScript**
- **Next.js** or **Vite + React** for UI
- **JSON** or **SQLite** for structured game data
- **Zod** for schema validation

## Repository structure

```text
/docs              Project notes, rules assumptions, planning docs
/data              Structured game data files
/src               Application source code
/tests             Tests
```

## Working with Codex

Codex should:

- make focused, minimal changes
- avoid unnecessary rewrites
- preserve existing patterns
- document assumptions when rules are unclear
- prefer structured data and validation over hard-coded UI logic

See `AGENTS.md` for repo-specific working instructions.

## Notes

This repository does **not** include Barons' War rules text or proprietary material by default. Any game data added should be reviewed for copyright and licensing considerations before publication.
