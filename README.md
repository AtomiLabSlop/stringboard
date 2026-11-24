# Stringboard

A spoiler-safe "detective board" for story-heavy games. Characters are pinned to a cork board, red strings show how they connect, and a timeline slider lets you scroll back through the story — but never forward past where you are.

Live: https://atomilab.fi/stringboard/

## Pages
- **Landing (`site/index.html`)** – pick a game, enter the chapter you are on (a free text field, so the total number of chapters is never shown) and optionally describe what you did last. Or reveal the whole story behind a spoiler warning.
- **Board (`site/board.html`)** – the detective board itself.

## Features
- **Spoiler-safe timeline** – the right end of the slider is always "now". It never shows how far through the game you are (no percentages, no totals).
- **Character cards** – tap a character to see what is known about them up to the selected point.
- **Your own images** – add your own screenshots to any card. They are stored only in your browser (localStorage).
- **Progress matching** – free-text descriptions ("did my first drug deal") are matched to story steps with simple keyword matching in the browser. It only looks inside the chapter you entered and never shows unmatched steps.
- **Board tools** – drag cards, strings stay pinned; marker and eraser; sticky notes (S/M/L, two colours, three fonts); desk lamp mode; settings for card size, image size and frame shape, card style, font, background (incl. map), frame, string and pin colours, string slack and random tilt.
- **Plain web tech** – HTML, CSS and JavaScript, no build step. UI components from [Shoelace](https://shoelace.style) (MIT) via CDN.

## Current boards
- GTA VI – up to the start of Chapter 3 (*Dealer's Choice*).

## Adding story data
Story data lives in `site/data/<game>.json`:
- `steps` – timeline steps `{ch, title, text, kw}` in story order; `kw` are matching keywords (any language, lower case, accents removed).
- `chars` – cards: position in a 1100×1000 board space (`x`, `y`), name `n`, role `r`, the step they appear `a`, optional role changes `rs` and facts `f: [[step, text], …]`.
- `links` – strings between cards: `[from, to, step]`.

Default card images live in `site/data/<game>-images.json` (`{ "images": { "<card id>": { "url": "https://…", "credit": "…" } } }`). Only use images you have the right to use; empty urls show a silhouette. Users can still override any card image in their own browser.

Write summaries in your own words and only up to the point they cover.

## Disclaimer
Fan-made project, not affiliated with or endorsed by Rockstar Games or Take-Two Interactive. Game names are trademarks of their owners. No game assets are included.

## License
MIT – see `LICENSE`.

## Deployment
Every push to `main` uploads the `site/` folder to https://atomilab.fi/stringboard/ via FTP (`.github/workflows/deploy-ftp.yml`).
Required repository secrets: `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`.
Optional repository variables: `FTP_SERVER_DIR` (default `httpdocs/stringboard/`), `FTP_PROTOCOL` (default `ftps`; set to `ftp` if the host does not support FTPS).

---

### Support me

If you find my open-source projects useful, you can support the time and care that goes into maintaining and improving them by buying me a coffee. It’s entirely optional, but always appreciated :)

<br>

<a href="https://www.buymeacoffee.com/atomilabslop"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me a Coffee" width="200"></a>
