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

// ─── SA keyword searches (no category sweeps) ────────────────────────────────

const KEYWORDS = [
  'South Africa',
  'South African',
  'load shedding',
  'eskom',
  'SARS eFiling',
  'South Africa app',
  'SA business',
  'Johannesburg app',
  'Cape Town app',
  'loadshedding',
  'CIPC',
  'spaza shop'
];

// ─── Pre-filter: skip obvious global brands before detail fetch ───────────────

const GLOBAL_APPID_PREFIXES = [
  'com.google', 'com.facebook', 'com.meta', 'com.microsoft', 'com.amazon',
  'com.netflix', 'com.spotify', 'com.uber', 'com.twitter', 'com.x.android',
  'com.instagram', 'com.whatsapp', 'com.zhiliaoapp', 'com.tiktok',
  'com.snapchat', 'com.linkedin', 'com.discord', 'com.telegram',
  'com.apple', 'com.samsung', 'com.huawei', 'com.xiaomi',
  'com.temu', 'com.shein', 'com.aliexpress', 'com.ebay', 'com.paypal',
  'com.adobe', 'com.dropbox', 'com.slack', 'com.airbnb', 'com.booking',
  'com.tripadvisor', 'com.duolingo', 'com.king', 'com.supercell',
  'com.rovio', 'com.roblox', 'com.mojang'
];

const GLOBAL_TITLE_KEYWORDS = [
  'zoom', 'facebook', 'whatsapp', 'instagram', 'tiktok', 'netflix',
  'youtube', 'spotify', 'uber', 'amazon', 'microsoft', 'google',
  'snapchat', 'twitter', 'discord', 'telegram', 'linkedin',
  'temu', 'shein', 'aliexpress', 'roblox', 'minecraft', 'candy crush',
  'subway surfers', 'clash of clans', 'clash royale', 'pubg', 'fortnite'
];

function isGlobalBrand(appId, title) {
  const appIdLower = appId.toLowerCase();
  const titleLower = title.toLowerCase();

  for (const prefix of GLOBAL_APPID_PREFIXES) {
    if (appIdLower.startsWith(prefix)) return true;
  }

  for (const kw of GLOBAL_TITLE_KEYWORDS) {
    if (titleLower.includes(kw)) return true;
  }

  return false;
}

// ─── SA detection (post-detail-fetch) ────────────────────────────────────────

const SA_TEXT_TERMS = [
  'south africa', 'south african', 'johannesburg', 'cape town',
  'eskom', 'sars', 'load shedding', 'loadshedding', 'load shed',
  'cipc', 'braai', 'spaza', 'pretoria', 'durban', 'soweto'
];

function getSASignal(app) {
  const website = (app.developerWebsite || '').toLowerCase();
  const email = (app.developerEmail || '').toLowerCase();

  // Strongest signal: .co.za domain
  if (website.includes('.co.za') || email.includes('.co.za')) return 'domain';

  const desc = (app.description || '').toLowerCase();
  const title = (app.title || '').toLowerCase();

  for (const term of SA_TEXT_TERMS) {
    if (desc.includes(term) || title.includes(term)) return 'text';
  }

  return 'none';
}

// ─── Phase 1: Keyword searches → collect candidate appIds ────────────────────

async function collectCandidates() {
  console.log('\n=== Phase 1: SA keyword searches ===');

  const candidates = new Map(); // appId → { appId, title }
  let skipped = 0;

  for (const kw of KEYWORDS) {
    console.log(`  🔍 "${kw}"...`);
    try {
      const results = await gplay.search({
        term: kw,
        country: 'za',
        lang: 'en',
        num: 250
      });

      let added = 0;
      for (const app of results) {
        if (candidates.has(app.appId)) continue;
        if (isGlobalBrand(app.appId, app.title)) {
          skipped++;
          continue;
        }
        candidates.set(app.appId, { appId: app.appId, title: app.title });
        added++;
      }

      console.log(`     ${results.length} results → +${added} new candidates (${skipped} global brands skipped)`);
    } catch (err) {
      console.error(`  ❌ "${kw}": ${err.message}`);
    }
    await delay(DELAY_MS);
  }

  console.log(`\n  📊 Total candidates for detail fetch: ${candidates.size} (skipped ${skipped} global brands)`);
  return [...candidates.values()];
}

// ─── Phase 2: Detail fetch for candidates only ───────────────────────────────

async function fetchDetails(candidates) {
  console.log(`\n=== Phase 2: Detail fetch (${candidates.length} apps) ===`);
  const apps = [];

  for (let i = 0; i < candidates.length; i++) {
    const { appId, title } = candidates[i];
    if ((i + 1) % 20 === 0 || i === 0 || i === candidates.length - 1) {
      console.log(`  📱 [${i + 1}/${candidates.length}] ${appId}`);
    }
    try {
      const detail = await gplay.app({ appId, country: 'za', lang: 'en' });
      apps.push(detail);
    } catch (err) {
      console.error(`  ❌ ${appId}: ${err.message}`);
    }
    await delay(DELAY_MS);
  }

  console.log(`  ✓ Fetched details for ${apps.length}/${candidates.length} apps`);
  return apps;
}

// ─── Phase 3: App Store bonus ─────────────────────────────────────────────────

const APPSTORE_KEYWORDS = ['South Africa', 'load shedding', 'eskom', 'SARS eFiling'];

async function fetchAppStoreBonus() {
  console.log('\n=== Phase 3: App Store bonus ===');
  const appStoreApps = [];
  const seenIds = new Set();

  for (const kw of APPSTORE_KEYWORDS) {
    console.log(`  🍎 "${kw}"...`);
    try {
      const results = await store.search({ term: kw, country: 'za', num: 100, lang: 'en-za' });
      for (const app of results) {
        const id = app.appId || String(app.id || '');
        if (!seenIds.has(id) && !isGlobalBrand(id, app.title || '')) {
          seenIds.add(id);
          appStoreApps.push(app);
        }
      }
      console.log(`     → App Store total: ${appStoreApps.length}`);
    } catch (err) {
      console.error(`  ❌ App Store "${kw}": ${err.message}`);
    }
    await delay(DELAY_MS);
  }

  return appStoreApps;
}

// ─── Processing ───────────────────────────────────────────────────────────────

function processPlayApp(app) {
  const signal = getSASignal(app);
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
    sa_signal: signal,
    likely_sa_built: signal !== 'none' ? 'TRUE' : 'FALSE'
  };
}

function processAppStoreApp(app) {
  const mockApp = {
    developerWebsite: app.developerUrl || '',
    developerEmail: '',
    description: app.description || '',
    title: app.title || ''
  };
  const signal = getSASignal(mockApp);
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
    sa_signal: signal,
    likely_sa_built: signal !== 'none' ? 'TRUE' : 'FALSE'
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
  { id: 'sa_signal', title: 'sa_signal' },
  { id: 'likely_sa_built', title: 'likely_sa_built' }
];

const SIGNAL_RANK = { domain: 0, text: 1, none: 2 };

async function exportCSVs(allApps) {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const rawWriter = createObjectCsvWriter({
    path: path.join(OUTPUT_DIR, 'za-apps-raw.csv'),
    header: CSV_HEADERS
  });
  await rawWriter.writeRecords(allApps);
  console.log(`  ✅ za-apps-raw.csv — ${allApps.length} apps`);

  // Sort SA apps: domain signal first, then text, then by ratings desc within each tier
  const saApps = allApps
    .filter(a => a.likely_sa_built === 'TRUE')
    .sort((a, b) => {
      const rankDiff = SIGNAL_RANK[a.sa_signal] - SIGNAL_RANK[b.sa_signal];
      if (rankDiff !== 0) return rankDiff;
      return (Number(b.ratings) || 0) - (Number(a.ratings) || 0);
    });

  const filteredWriter = createObjectCsvWriter({
    path: path.join(OUTPUT_DIR, 'za-apps-likely-sa.csv'),
    header: CSV_HEADERS
  });
  await filteredWriter.writeRecords(saApps);

  const domainCount = saApps.filter(a => a.sa_signal === 'domain').length;
  const textCount = saApps.filter(a => a.sa_signal === 'text').length;
  console.log(`  ✅ za-apps-likely-sa.csv — ${saApps.length} SA-built (${domainCount} domain, ${textCount} text)`);

  const devMap = new Map();
  for (const app of saApps) {
    const key = app.developer;
    if (!devMap.has(key)) {
      devMap.set(key, {
        developer: app.developer,
        developerEmail: app.developerEmail,
        developerWebsite: app.developerWebsite,
        appCount: 0,
        sa_signal: app.sa_signal
      });
    }
    const entry = devMap.get(key);
    entry.appCount++;
    // Upgrade signal if this app has a stronger one
    if (SIGNAL_RANK[app.sa_signal] < SIGNAL_RANK[entry.sa_signal]) {
      entry.sa_signal = app.sa_signal;
    }
  }

  const contacts = [...devMap.values()]
    .sort((a, b) => {
      const rankDiff = SIGNAL_RANK[a.sa_signal] - SIGNAL_RANK[b.sa_signal];
      if (rankDiff !== 0) return rankDiff;
      return b.appCount - a.appCount;
    });

  const contactWriter = createObjectCsvWriter({
    path: path.join(OUTPUT_DIR, 'za-developer-contacts.csv'),
    header: [
      { id: 'developer', title: 'developer' },
      { id: 'developerEmail', title: 'developerEmail' },
      { id: 'developerWebsite', title: 'developerWebsite' },
      { id: 'appCount', title: 'appCount' },
      { id: 'sa_signal', title: 'sa_signal' }
    ]
  });
  await contactWriter.writeRecords(contacts);
  console.log(`  ✅ za-developer-contacts.csv — ${contacts.length} unique developers`);

  return saApps.length;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Za-pps Seed Scraper (v2 — keyword-first, pre-filtered)');
  console.log('   Rate limit: 1.5s/request. Estimated runtime: 5–15 min.\n');

  const candidates = await collectCandidates();
  const rawPlayApps = await fetchDetails(candidates);
  const playApps = rawPlayApps.map(processPlayApp);

  const appStoreRaw = await fetchAppStoreBonus();
  const playIds = new Set(playApps.map(a => a.appId));
  const appStoreApps = appStoreRaw
    .filter(a => !playIds.has(a.appId || String(a.id || '')))
    .map(processAppStoreApp);

  const allApps = [...playApps, ...appStoreApps];
  const saCount = allApps.filter(a => a.likely_sa_built === 'TRUE').length;
  const domainCount = allApps.filter(a => a.sa_signal === 'domain').length;

  console.log(`\n📊 ${allApps.length} total apps → ${saCount} likely SA-built (${domainCount} with .co.za domain)`);

  console.log('\n=== Exporting CSVs ===');
  await exportCSVs(allApps);

  console.log('\n✅ Done. Check ./output/');
}

main().catch(err => {
  console.error('\n💥 Fatal:', err.message);
  process.exit(1);
});
