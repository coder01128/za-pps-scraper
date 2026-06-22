# CLAUDE.md — Za-pps Seed Scraper

## Project Overview

This is a one-shot Node.js scraper utility for **Za-pps** — South Africa's app directory (`za-pps.co.za`). The scraper pulls SA-built apps from Google Play (and optionally the App Store), filters and deduplicates them, and exports three CSVs used to hand-curate the Za-pps launch seed list.

**Part of the DarkLoud Digital (DLD) product portfolio.**
**GitHub repo:** `coder01128/za-pps-scraper`
**Local path:** `C:\ccode\projects\za-pps-scraper`

---

## Permissions & Autonomy

**All read, write, and edit permissions are granted in advance for this project.**

Claude Code should work fully autonomously:
- Read, create, edit, and delete any file in this project without asking
- Install npm packages as needed without asking
- Fix bugs, refactor code, and improve the script without asking
- Make judgment calls on implementation details without asking
- Only pause and ask when genuinely blocked (e.g. a package is completely broken with no workaround, or a design decision fundamentally changes the output format)

---

## Git & GitHub Rules

- **Repo:** `github.com/coder01128/za-pps-scraper` — create it if it doesn't exist (public repo)
- **Branch:** work on `main` directly for this utility project (no feature branches needed)
- **Commit frequently** with clear, descriptive messages as work progresses
- **Push to GitHub** after any meaningful change: initial scaffold, working scraper, bug fixes, output improvements
- **DO NOT use Vercel CLI** — this project never deploys to Vercel
- **DO NOT use any other deployment tooling** — it's a local utility script, not a web app
- **Commits go to GitHub only** — no other remotes

### Good commit cadence
- After initial scaffold and package.json
- After first working fetch (even if partial)
- After dedup + filtering logic works
- After CSV export works end-to-end
- After any bug fix
- After README is written

---

## Tech Stack

- **Runtime:** Node.js (ESM modules — `"type": "module"` in package.json)
- **Scraping:** `google-play-scraper` + `app-store-scraper`
- **CSV export:** `csv-writer`
- **No framework, no build step, no TypeScript, no bundler**
- Single entry point: `scraper.js`

---

## Project Structure

```
za-pps-scraper/
├── CLAUDE.md               ← this file
├── README.md               ← keep updated as features are added
├── package.json
├── package-lock.json
├── scraper.js              ← main script
└── output/                 ← gitignored, created at runtime
    ├── za-apps-raw.csv
    ├── za-apps-likely-sa.csv
    └── za-developer-contacts.csv
```

**The `output/` directory must be in `.gitignore`** — CSV files are runtime output, not source code. Never commit them.

---

## What the Script Does

Pulls apps from Google Play using three strategies:
1. **Category sweeps** with `country: 'za'` across all major categories
2. **SA keyword searches** ("South Africa", "load shedding", "eskom", "SARS", "rand", etc.)
3. **Developer country filtering** where available

### Filtering logic (`likely_sa_built` flag)
Flag TRUE if any of:
- Developer website contains `.co.za`
- Developer email contains `.co.za`
- App description contains "South Africa", "South African", "Johannesburg", "Cape Town", "Eskom", "SARS", "load shed"
- App title contains any of those terms

### Output files
1. **`za-apps-raw.csv`** — everything scraped, deduplicated by appId
2. **`za-apps-likely-sa.csv`** — `likely_sa_built = TRUE` only, sorted by `ratings` desc
3. **`za-developer-contacts.csv`** — unique developers from file 2, with email, website, appCount

### CSV columns (raw + filtered)
`appId`, `title`, `developer`, `developerEmail`, `developerWebsite`, `genre`, `score`, `ratings`, `installs`, `description` (first 300 chars), `url`, `icon`, `likely_sa_built`

---

## Hard Rules

1. **Rate limit strictly** — minimum 1.5 second delay between every API call. Never hammer the API.
2. **Never crash on a single request failure** — catch per-request, log the error with context, continue the run.
3. **No API keys** — `google-play-scraper` and `app-store-scraper` don't need them. Never add secret credentials to this repo.
4. **Never commit the output/ directory or CSV files** — they're in `.gitignore`.
5. **Log progress to console** — which category/keyword is being fetched, results count, running dedup total, final export summary. The user needs to see it working.
6. **Keep it simple** — this is a one-shot data utility. No database, no server, no web UI, no over-engineering.
7. **ESM only** — `import`/`export` syntax throughout, matching `"type": "module"` in package.json.

---

## Running the Script

```bash
cd C:\ccode\projects\za-pps-scraper
npm install
node scraper.js
```

Expected runtime: 10–20 minutes (due to rate limiting).
Expected output: 200–500 raw results, 50–150 likely-SA-built apps.

---

## Error Handling Patterns

```javascript
// Per-request pattern — never let one failure kill the run
try {
  const results = await gplay.search({ term, country: 'za', lang: 'en', num: 250 });
  // process results
} catch (err) {
  console.error(`❌ Failed: ${term} — ${err.message}`);
  // continue to next iteration
}

// Rate limiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
await delay(1500); // between every request
```

---

## Known Package Quirks

- `google-play-scraper` is an unofficial reverse-engineered wrapper. Google occasionally changes their internal API and breaks it. If fetch calls return empty or throw unexpected errors, check the package's GitHub issues for the current workaround before assuming the code is wrong.
- `app-store-scraper` country filtering is less reliable than Google Play — treat App Store results as bonus, not primary.
- Some apps won't have `developerEmail` or `developerWebsite` — handle nulls gracefully, use empty string in CSV.

---

## Context: Why This Exists

Za-pps needs ~150 quality seed listings before it launches publicly — "never launch empty" is a core rule. This scraper generates the raw material (200–500 apps). Brad then manually curates `za-apps-likely-sa.csv`:
- Deletes anything not genuinely SA-built
- Adds a `notes` column for editorial comments
- Flags `Za-pps Picks` with a `featured` column
- This becomes the import file for the Za-pps database when the main site is built

The `za-developer-contacts.csv` becomes the cold outreach list — "your app is already listed on Za-pps, claim your listing and get the badge."

---

## README Template

Keep the README updated. Minimum content:

```markdown
# Za-pps Scraper

Scrapes Google Play for South African-built apps to seed the [Za-pps](https://za-pps.co.za) directory.

## Setup
npm install

## Run
node scraper.js

Output CSVs appear in ./output/

## Output
- za-apps-raw.csv — all results, deduplicated
- za-apps-likely-sa.csv — likely SA-built, sorted by rating
- za-developer-contacts.csv — developer outreach list

Part of the DarkLoud Digital product portfolio.
```
