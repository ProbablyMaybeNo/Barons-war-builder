# Barons War Builder

Static roster builder for **Barons' War: King John** with a GitHub Pages-friendly structure.

## Current status

The original attached prototype has now been unpacked into separate repo assets so the app can be maintained in GitHub without living inside one giant HTML file.

- `index.html` contains the live app shell
- `assets/styles/app.css` contains the extracted styling
- `data/game-data.js` contains the extracted roster data
- `src/app.js` contains the live builder logic
- `legacy/Barons_War_KingJohn_List_Builder.source.html` preserves the original reference build

## Local usage

Open `index.html` directly in a browser for quick checks, or serve the repo root with any static server.

Run the lightweight smoke check with:

```bash
npm run check
```

Run a local preview server with:

```bash
npm run preview
```

Mobile testing notes live in [docs/mobile-qa.md](/D:/AI-Workstation/Antigravity/apps/Barons%20War%20List%20Builder/docs/mobile-qa.md:1).

## GitHub Pages

This repository now includes a Pages deployment workflow at `.github/workflows/pages.yml`.

To publish the app:

1. Push `main` to GitHub.
2. In GitHub repository settings, set Pages to use GitHub Actions if it is not already enabled.
3. The workflow will deploy the repo root as a static site.

## Next refactor targets

- break `src/app.js` into domain and UI modules
- normalize `data/game-data.js` into smaller files
- replace inline event handlers with event delegation
- add real rules and points regression tests

## Notes

This repository includes gameplay reference data extracted from the working prototype. Review any published rules text or proprietary material for licensing and fair-use concerns before broad public distribution.
