# Stringboard

A spoiler-safe "detective board" for story-heavy games. Characters are pinned to a cork board, red strings show how they connect, and a timeline slider lets you scroll back through the story — but never forward past where you are.

Live: https://atomilab.fi/stringboard/

## Features
- **Spoiler-safe timeline** – the right end of the slider is always "now". It never shows how far through the game you are (no percentages, no totals).
- **Character cards** – tap a character to see what is known about them up to the selected point.
- **Your own images** – add your own screenshots to any card. They are stored only in your browser (localStorage).
- **Single file** – plain HTML, CSS and JavaScript. No build step, no dependencies.

## Current boards
- GTA VI – up to the start of Chapter 3 (*Dealer's Choice*).

## Adding story data
All data lives in `index.html`:
- `T` – timeline steps `[title, summary]`, in story order. The last step is "now".
- `C` – characters: position (`x`, `y`), name, role, the step they appear (`a`) and facts (`f: [[step, text], …]`).
- `L` – strings between characters: `[from, to, step]`.

Write summaries in your own words and only up to the point they cover.

## Disclaimer
Fan-made project, not affiliated with or endorsed by Rockstar Games or Take-Two Interactive. Game names are trademarks of their owners. No game assets are included.

## License
MIT – see `LICENSE`.

## Deployment
Every push to `main` uploads `index.html` to https://atomilab.fi/stringboard/ via FTP (`.github/workflows/deploy-ftp.yml`).
Required repository secrets: `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`.
Optional repository variables: `FTP_SERVER_DIR` (default `public_html/stringboard/`), `FTP_PROTOCOL` (default `ftps`; set to `ftp` if the host does not support FTPS).
