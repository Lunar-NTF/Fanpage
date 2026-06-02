// scripts/fetch.js
// Runs via GitHub Actions every 30 min.
// Reads config.json → fetches tweet counts → saves to data/snapshots.json
// GitHub Actions then commits the updated file back to the repo.

import fetch from 'node-fetch';
import fs    from 'fs';
import path  from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, '..');

// ── Load config ────────────────────────────────────────
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'config.json'), 'utf8'));

// API key: prefer env var (GitHub Secret) over config file
const API_KEY = process.env.RAPIDAPI_KEY || cfg.rapidApiKey;
if (!API_KEY || API_KEY === 'YOUR_RAPIDAPI_KEY_HERE') {
  console.error('❌ No API key found. Set the RAPIDAPI_KEY secret in GitHub Actions.');
  process.exit(1);
}

// ── Collect all tags to fetch ──────────────────────────
function allTags(cfg) {
  const tags = new Set();
  for (const p of cfg.permSlots || []) {
    if (p.hashtag) tags.add(p.hashtag);
    if (p.keyword) tags.add(p.keyword);
  }
  for (const ev of cfg.events || []) {
    for (const t of ev.tags || []) tags.add(t.value);
  }
  return [...tags];
}

// ── Fetch tweet count for one query ───────────────────
async function fetchCount(query) {
  try {
    const url = `https://twitter-api45.p.rapidapi.com/search.php?query=${encodeURIComponent(query)}&searchType=Top`;
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-key':  API_KEY,
        'x-rapidapi-host': 'twitter-api45.p.rapidapi.com',
        'Content-Type':    'application/json',
      },
    });
    if (!res.ok) return { count: null, error: `HTTP ${res.status}` };
    const data  = await res.json();
    const arr   = Array.isArray(data.timeline) ? data.timeline : Array.isArray(data) ? data : [];
    const likes = arr.length ? Math.max(...arr.map(t => t.favorites || t.favorite_count || 0)) : 0;
    return { count: arr.length, topLikes: likes };
  } catch (e) {
    return { count: null, error: e.message };
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Main ───────────────────────────────────────────────
async function main() {
  const tags = allTags(cfg);
  if (!tags.length) { console.log('No tags configured — nothing to fetch.'); return; }

  console.log(`Fetching counts for ${tags.length} tag(s)…`);
  const snapshot = { time: new Date().toISOString(), data: {} };

  for (const tag of tags) {
    process.stdout.write(`  ${tag} … `);
    const r = await fetchCount(tag);
    snapshot.data[tag] = r.count;
    if (r.error) console.log(`ERROR: ${r.error}`);
    else         console.log(`${r.count} results (top likes: ${r.topLikes})`);
    await sleep(300);
  }

  // ── Save snapshot ──────────────────────────────────
  const snapsPath = path.join(ROOT, 'docs', 'data', 'snapshots.json');
  let snaps = [];
  try { snaps = JSON.parse(fs.readFileSync(snapsPath, 'utf8')); } catch {}
  snaps.push(snapshot);

  // Keep last 30 days = 1440 half-hourly snapshots
  if (snaps.length > 1440) snaps = snaps.slice(-1440);
  fs.writeFileSync(snapsPath, JSON.stringify(snaps, null, 2));
  console.log(`\n✅ Snapshot saved (${snaps.length} total). Time: ${snapshot.time}`);
}

main().catch(e => { console.error(e); process.exit(1); });
