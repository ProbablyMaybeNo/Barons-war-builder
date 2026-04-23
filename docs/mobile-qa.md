# Mobile QA guide

Use this checklist when testing the live site or a local preview.

## Local preview

Run:

```bash
npm run preview
```

Then open:

`http://localhost:4173/`

## Recommended viewport sizes

- iPhone 12 / 13 / 14: `390 x 844`
- iPhone SE: `375 x 667`
- Pixel 7 / 8: `412 x 915`
- Small tablet portrait: `768 x 1024`

## Core flows to test

1. Load the page and confirm the top bar wraps cleanly.
2. Select a faction from the sidebar.
3. Add a unit from `+ Units`.
4. Open the unit builder modal and confirm:
   - fields stack correctly
   - stat cards stay readable
   - equipment options are tappable
   - the cost bar and save/cancel actions remain visible
5. Add a character from `+ Characters`.
6. Switch between `Retinue`, `Units`, and `Rules`.
7. Use the unit search and kind filter.
8. Open `Save / Load` and confirm saved rows/buttons do not overflow.

## Things to watch for

- horizontal page scrolling
- clipped modals
- buttons too small to tap comfortably
- retinue rows overlapping or wrapping badly
- rules tables overflowing without scroll access
- top bar or tabs becoming unreadable
- mobile keyboard covering important actions

## Good regression checks

- desktop still looks unchanged at `1280 x 800`
- points totals update after unit edits
- save/load still works
- unit builder opens and closes correctly
