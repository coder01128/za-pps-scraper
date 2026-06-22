# Za-pps Scraper

Scrapes Google Play for South African-built apps to seed the [Za-pps](https://za-pps.co.za) directory.

## Setup

```bash
npm install
```

## Run

```bash
node scraper.js
```

Expected runtime: 10–20 minutes (rate limiting). Output CSVs appear in `./output/`.

## Output

- `za-apps-raw.csv` — all results, deduplicated by appId
- `za-apps-likely-sa.csv` — likely SA-built only, sorted by ratings desc
- `za-developer-contacts.csv` — unique developers from the SA list (outreach list)

## Strategy

1. Category sweeps across 14 major Google Play categories with `country: 'za'`
2. SA-specific keyword searches ("load shedding", "eskom", "SARS", "rand", etc.)
3. Bonus: App Store keyword searches

## Filtering

Apps flagged `likely_sa_built = TRUE` if:
- Developer website or email contains `.co.za`
- App title or description mentions SA-specific terms

Part of the DarkLoud Digital product portfolio.
