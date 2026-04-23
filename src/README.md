# App source

`src/app.js` is the current live runtime for the static app.

This is still a transitional file, but it is now separated from:

- HTML shell in `index.html`
- styles in `assets/styles/app.css`
- game data in `data/game-data.js`

## Intended next split

- `src/domain` for roster, validation, and points logic
- `src/ui` for rendering and modal behavior
- `src/lib` for shared helpers

## Rule for refactors

Do not rebuild from scratch unless necessary.
Port stable behavior out of the extracted app in small, testable steps.
