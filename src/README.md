# Future app scaffold

This folder is reserved for the cleaned-up application that will eventually replace the legacy static app.

## Intended direction

- `src/data` for normalized Barons' War data loaders and schemas
- `src/domain` for roster, validation, and points logic
- `src/ui` for any future interface layer
- `src/lib` for small shared helpers

## Rule for refactors

Do not rebuild from scratch unless necessary.
Start by porting stable behavior out of `legacy/` in small steps.
