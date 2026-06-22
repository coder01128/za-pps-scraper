import gplay from 'google-play-scraper';
import store from 'app-store-scraper';
import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'output');
const DELAY_MS = 1500;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ─── SA detection ────────────────────────────────────────────────────────────

const SA_TEXT_TERMS = [
  'south africa', 'south african', 'johannesburg', 'cape town',
  'eskom', 'sars', 'load shed', 'loadshedding', 'load shedding',
  'cipc', 'braai', 'spaza'
];

function isSABuilt(app) {
  const website = (app.developerWebsite || '').toLowerCase();
  const email = (app.developerEmail || '').toLowerCase();
  const desc = (app.description || '').toLowerCase();
  const title = (app.title || '').toLowerCase();

  if (website.includes('.co.za') || email.includes('.co.za')) return true;

  for (const term of SA_TEXT_TERMS) {
    if (desc.includes(term) || title.includes(term)) return true;
  }

  return false;
}

// ─── Phase 1: Category sweeps ────────────────────────────────────────────────

const CATEGORIES = [
  'BUSINESS', 'FINANCE', 'TOOLS', 'PRODUCTIVITY', 'LIFESTYLE',
  'SHOPPING', 'FOOD_AND_DRINK', 'HEALTH_AND_FITNESS', 'EDUCATION',
  'ENTERTAINMENT', 'NEWS_AND_MAGAZINES', 'SOCIAL', 'MAPS_AND_NAVIGATION',
  'TRAVEL_AND_LOCAL'
];

async function fetchCategoryApps(allIds) {
  console.log('\n=== Phase 1: Google Play category sweeps ===');

  for (const cat of CATEGORIES) {
    console.log(`  📂 ${cat}...`);
    try {
      const results = await gplay.list({
        category: gplay.category[cat],
        collection: gplay.collection.TOP_FREE,
        country: 'za',
        lang: 'en',
        num: 100
      });
      const before = allIds.size;
      results.forEach(a => allIds.add(a.appId));
      console.log(`     ${results.length} fetched, +${allIds.size - before} new (total: ${allIds.size})`);
    } catch (err) {
      console.error(`  ❌ ${cat}: ${err.message}`);
    }
    await delay(DELAY_MS);
  }
}

// ─── Phase 2: Keyword searches ───────────────────────────────────────────────

const KEYWORDS = [
  'South Africa',
  'South African app',
  'Johannesburg',
  'Cape Town',
  'load shedding',
  'loadshedding',
  'eskom',
  'SARS',
  'CIPC',
  'rand pay',
  'braai',
  'spaza'
];

async function fetchKeywordApps(allIds) {
  console.log('\n=== Phase 2: Google Play keyword searches ===');

  for (const kw of KEYWORDS) {
    console.log(`  🔍 "${kw}"...`);
    try {
      const results = await gplay.search({
        term: kw,
        country: 'za',
        lang: 'en',
        num: 250
      });
      const before = allIds.size;
      results.forEach(a => allIds.add(a.appId));
      console.log(`     ${results.length} results, +${allIds.size - before} new (total: ${allIds.size})`);
    } catch (err) {
      console.error(`  ❌ "${kw}": ${err.message}`);
    }
    await delay(DELAY_MS);
  }
}

// ─── Phase 3: Detail fetch ───────────────────────────────────────────────────

async function fetchPlayDetails(appIds) {
  console.log(`\n=== Phase 3: Fetching details for ${appIds.length} apps ===`);
  const apps = [];

  for (let i = 0; i < appIds.length; i++) {
    const appId = appIds[i];
    if ((i + 1) % 10 === 0 || i === 0) {
      console.log(`  📱 [${i + 1}/${appIds.length}] ${appId}`);
    }
    try {
      const detail = await gplay.app({ appId, country: 'za', lang: 'en' });
      apps.push(detail);
    } catch (err) {
      console.error(`  ❌ ${appId}: ${err.message}`);
    }
    await delay(DELAY_MS);
  }

  return apps;
}

// ─── Phase 4: App Store bonus ─────────────────────────────────────────────────

const APPSTORE_KEYWORDS = [
  'South Africa', 'load shedding', 'eskom', 'SARS'
];

async function fetchAppStoreApps() {
  console.log('\n=== Phase 4: App Store keyword bonus ===');
  const appStoreApps = [];
  const seenIds = new Set();

  for (const kw of APPSTORE_KEYWORDS) {
    console.log(`  🍎 "${kw}"...`);
    try {
      const results = await store.search({
        term: kw,
        country: 'za',
        num: 100,
        lang: 'en-za'
      });
      for (const app of results) {
        if (!seenIds.has(app.appId)) {
          seenIds.add(app.appId);
          appStoreApps.push(app);
        }
      }
      console.log(`     ${results.length} results (App Store total: ${appStoreApps.length})`);
    } catch (err) {
      console.error(`  ❌ App Store "${kw}": ${err.message}`);
    }
    await delay(DELAY_MS);
  }

  return appStoreApps;
}

// ─── Processing ───────────────────────────────────────────────────────────────

function processPlayApp(app) {
  return {
    source: 'google_play',
    appId: app.appId || '',
    title: app.title || '',
    developer: app.developer || '',
    developerEmail: app.developerEmail || '',
    developerWebsite: app.developerWebsite || '',
    genre: app.genre || '',
    score: app.score || 0,
    ratings: app.ratings || 0,
    installs: app.installs || '',
    description: (app.description || '').substring(0, 300),
    url: app.url || `https://play.google.com/store/apps/details?id=${app.appId}`,
    icon: app.icon || '',
    likely_sa_built: isSABuilt(app) ? 'TRUE' : 'FALSE'
  };
}

function processAppStoreApp(app) {
  return {
    source: 'app_store',
    appId: app.appId || String(app.id || ''),
    title: app.title || '',
    developer: app.developer || '',
    developerEmail: '',
    developerWebsite: app.developerUrl || '',
    genre: app.primaryGenreName || '',
    score: app.score || 0,
    ratings: app.reviews || 0,
    installs: '',
    description: (app.description || '').substring(0, 300),
    url: app.url || '',
    icon: app.icon || '',
    likely_sa_built: isSABuilt({
      developerWebsite: app.developerUrl || '',
      developerEmail: '',
      description: app.description || '',
      title: app.title || ''
    }) ? 'TRUE' : 'FALSE'
  };
}

// ─── CSV export ───────────────────────────────────────────────────────────────

const CSV_HEADERS = [
  { id: 'source', title: 'source' },
  { id: 'appId', title: 'appId' },
  { id: 'title', title: 'title' },
  { id: 'developer', title: 'developer' },
  { id: 'developerEmail', title: 'developerEmail' },
  { id: 'developerWebsite', title: 'developerWebsite' },
  { id: 'genre', title: 'genre' },
  { id: 'score', title: 'score' },
  { id: 'ratings', title: 'ratings' },
  { id: 'installs', title: 'installs' },
  { id: 'description', title: 'description' },
  { id: 'url', title: 'url' },
  { id: 'icon', title: 'icon' },
  { id: 'likely_sa_built', title: 'likely_sa_built' }
];

async function exportCSVs(allApps) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const rawWriter = createObjectCsvWriter({
    path: path.join(OUTPUT_DIR, 'za-apps-raw.csv'),
    header: CSV_HEADERS
  });
  await rawWriter.writeRecords(allApps);
  console.log(`  ✅ za-apps-raw.csv — ${allApps.length} apps`);

  const saApps = allApps
    .filter(a => a.likely_sa_built === 'TRUE')
    .sort((a, b) => (Number(b.ratings) || 0) - (Number(a.ratings) || 0));

  const filteredWriter = createObjectCsvWriter({
    path: path.join(OUTPUT_DIR, 'za-apps-likely-sa.csv'),
    header: CSV_HEADERS
  });
  await filteredWriter.writeRecords(saApps);
  console.log(`  ✅ za-apps-likely-sa.csv — ${saApps.length} likely SA-built`);

  const devMap = new Map();
  for (const app of saApps) {
    const key = app.developer;
    if (!devMap.has(key)) {
      devMap.set(key, {
        developer: app.developer,
        developerEmail: app.developerEmail,
        developerWebsite: app.developerWebsite,
        appCount: 0
      });
    }
    devMap.get(key).appCount++;
  }

  const contacts = [...devMap.values()].sort((a, b) => b.appCount - a.appCount);

  const contactWriter = createObjectCsvWriter({
    path: path.join(OUTPUT_DIR, 'za-developer-contacts.csv'),
    header: [
      { id: 'developer', title: 'developer' },
      { id: 'developerEmail', title: 'developerEmail' },
      { id: 'developerWebsite', title: 'developerWebsite' },
      { id: 'appCount', title: 'appCount' }
    ]
  });
  await contactWriter.writeRecords(contacts);
  console.log(`  ✅ za-developer-contacts.csv — ${contacts.length} unique developers`);

  return saApps.length;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Za-pps Seed Scraper starting...');
  console.log('   Rate limit: 1.5s between requests. Expected runtime: 10–20 min.\n');

  const playIds = new Set();

  await fetchCategoryApps(playIds);
  await fetchKeywordApps(playIds);

  console.log(`\n📊 Unique Play Store apps to detail-fetch: ${playIds.size}`);

  const rawPlayApps = await fetchPlayDetails([...playIds]);
  const playApps = rawPlayApps.map(processPlayApp);

  const appStoreRaw = await fetchAppStoreApps();
  const appStoreApps = appStoreRaw.map(processAppStoreApp);

  // Merge, deduplicate by appId (Play takes priority)
  const seenAppIds = new Set(playApps.map(a => a.appId));
  const uniqueAppStore = appStoreApps.filter(a => !seenAppIds.has(a.appId));

  const allApps = [...playApps, ...uniqueAppStore];

  const saCount = allApps.filter(a => a.likely_sa_built === 'TRUE').length;
  console.log(`\n📊 Total: ${allApps.length} apps (${saCount} likely SA-built)`);

  console.log('\n=== Exporting CSVs ===');
  const exported = await exportCSVs(allApps);

  console.log(`\n✅ Done! ${allApps.length} raw apps → ${exported} SA-built → check ./output/`);
}

main().catch(err => {
  console.error('\n💥 Fatal:', err.message);
  process.exit(1);
});
