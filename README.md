# Sarkar Sahayak

Find the government schemes you actually qualify for. A mobile-first PWA
that turns a live Google Sheet of Indian government schemes into a
short, conversational eligibility check.

## Stack

- **Frontend:** vanilla HTML/CSS/JS (no build step) in `public/`
- **Data:** fetched client-side at runtime from a published Google
  Sheets CSV export, parsed with PapaParse
- **Backend:** a Cloudflare Worker (`src/worker.js`) that serves the
  static assets via the `[assets]` binding in `wrangler.toml`
- **PWA:** `public/manifest.webmanifest` + `public/sw.js` so the app can
  be added to the home screen and the shell loads offline

## Project structure

```
sarkar-sahayak/
├── public/
│   ├── index.html
│   ├── css/styles.css
│   ├── js/data.js         # fetch + parse + eligibility engine
│   ├── js/app.js          # UI: wizard, results, share, tabs
│   ├── manifest.webmanifest
│   ├── sw.js
│   └── assets/
│       ├── og-image.png   # 1200x630 social preview image
│       └── icons/         # PWA + favicon icons
├── src/
│   └── worker.js          # Worker entry point, serves the assets
├── wrangler.toml
└── README.md
```

## Local development

```bash
npm install -g wrangler   # if you don't already have it
wrangler dev
```

This serves the app at `http://localhost:8787` using the same
asset-binding configuration as production.

## Deploying via GitHub → Cloudflare

1. Push this repo to GitHub.
2. In the Cloudflare dashboard, create a new **Worker** and connect it
   to the GitHub repo (Workers & Pages → Create → Connect to Git).
3. Cloudflare will detect `wrangler.toml` and use it as the build
   config — no extra build command is needed since there's no bundler,
   just make sure the build output directory setting (if asked) is
   left as-is; `[assets].directory = "public"` already tells Cloudflare
   what to serve.
4. Every push to your default branch redeploys automatically.

Or deploy directly from the CLI:

```bash
wrangler deploy
```

## Updating the scheme data

The app reads live from the published Google Sheet CSV URL set in
`public/js/data.js` (`SHEET_URL`). Editing the sheet and re-publishing
it (File → Share → Publish to web) updates the app automatically — no
redeploy required.

## Notes on the eligibility matching

The source sheet doesn't have dedicated age/state/income columns, so
state relevance and "who this is for" are inferred by scanning each
scheme's own published text for state names and demographic keywords
(see `DEMOGRAPHIC_GROUPS` and `STATE_ALIASES` in `public/js/data.js`).
This is a best-effort heuristic, not a legal determination — the UI
says so, and every result links through to the scheme's own official
application steps.

## Customizing before you deploy

- Swap `public/assets/og-image.png` and the icons in
  `public/assets/icons/` for your own artwork — the current ones are
  generated placeholders.
- Update `suvadipchakraborty@gmail.com` and the absolute URL
  `https://sarkar-sahayak.suvadipchakraborty.workers.dev/` in
  `public/index.html` and `public/js/app.js` if either changes.
