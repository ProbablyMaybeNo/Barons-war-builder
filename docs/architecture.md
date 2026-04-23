# App architecture

The current app is now split into deployable static pieces instead of a single HTML file.

## Runtime layout

- `index.html`: live app shell and UI markup
- `assets/styles/app.css`: extracted stylesheet from the original prototype
- `data/game-data.js`: extracted King John faction, unit, equipment, and character data
- `src/app.js`: live roster builder logic
- `legacy/Barons_War_KingJohn_List_Builder.source.html`: preserved original reference document

## Why this shape

- It keeps the original prototype intact for comparison.
- It makes GitHub Pages deployment straightforward.
- It creates clear boundaries for the next refactor pass.

Next split targets:
- move pure rules logic into `src/domain`
- move UI rendering into `src/ui`
- normalize the large data blob into smaller structured files under `data`

## Verification

- Run `npm run check` for a lightweight module smoke check.
- Open `index.html` in a browser or serve the repo root with any static file server for manual QA.
