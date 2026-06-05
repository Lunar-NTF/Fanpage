// scripts/fetch.js
// Runs every 30 min via GitHub Actions.
// Uses the TRENDS endpoint to get tweet_volume (real Twitter count)
// for all tracked hashtags. Saves snapshots to docs/data/snapshots.json.

import fetch from 'node-fetch';
import fs    from 'fs';
import path  from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, '..');

// ── Load config ────────────────────────────────────────
const cfgPath = path.join(ROOT, 'docs', 'config.json');
const cfg     = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const API_KEY = process.env.RAPIDAPI_KEY || cfg.rapidApiKey;

if (!API_KEY || API_KEY === 'YOUR_RAPIDAPI_KEY_HERE') {
  console.error('❌ No API key. Set RAPIDAPI_KEY in GitHub Secrets.');
  process.exit(1);
}

// ── Countries to check for perm slots (Asia + WW) ─────
const PERM_COUNTRIES = [
  { name: 'Worldwide',   vn: 'Worldwide',  isWW: true },
  { name: 'Thailand',    vn: 'Thailand'               },
  { name: 'Japan',       vn: 'Japan'                  },
  { name: 'South Korea', vn: 'SouthKorea'             },
  { name: 'Indonesia',   vn: 'Indonesia'              },
  { name: 'Philippines', vn: 'Philippines'            },
  { name: 'Malaysia',    vn: 'Malaysia'               },
  { name: 'Singapore',   vn: 'Singapore'              },
  { name: 'Vietnam',     vn: 'Vietnam'                },
  { name: 'Hong Kong',   vn: 'HongKong'               },
  { name: 'Taiwan',      vn: 'Taiwan'                 },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

function normTag(s) {
  return (s || '').toLowerCase().replace(/^#+/, '').replace(/\s+/g, '').trim();
}
function matches(a, b) {
  const na = normTag(a), nb = normTag(b);
  return na && nb && (na === nb || na.includes(nb) || nb.includes(na));
}

// ── Fetch trends for one country, find our tag ────────
async function fetchVolumeForTag(tag, vn) {
  try {
    const url = `https://twitter-api45.p.rapidapi.com/trends.php?country=${encodeURIComponent(vn)}`;
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-key':  API_KEY,
        'x-rapidapi-host': 'twitter-api45.p.rapidapi.com',
        'Content-Type':    'application/json',
      },
    });
    if (!res.ok) return null;
    const d      = await res.json();
    const trends = Array.isArray(d.trends) ? d.trends : Array.isArray(d) ? d : [];
    const idx    = trends.findIndex(t => matches(t.name || '', tag));
    if (idx < 0) return null;
    return {
      rank:   idx + 1,
      volume: trends[idx].tweet_volume || null,
    };
  } catch { return null; }
}

// ── Collect all tags ───────────────────────────────────
function allTags() {
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

// ── Main ───────────────────────────────────────────────
async function main() {
  const tags = allTags();
  if (!tags.length) { console.log('No tags configured.'); return; }

  console.log(`Fetching tweet_volume for ${tags.length} tag(s) via trends API…\n`);

  const snapshot = { time: new Date().toISOString(), data: {} };

  for (const tag of tags) {
    console.log(`  ${tag}:`);
    let bestVolume = null;
    let bestRank   = null;

    // Check across key countries to find the best volume number
    for (const c of PERM_COUNTRIES) {
      const r = await fetchVolumeForTag(tag, c.vn);
      if (r) {
        process.stdout.write(`    ${c.name}: rank #${r.rank}, volume: ${r.volume || 'n/a'}\n`);
        // Use the highest volume number found across countries
        if (r.volume && (!bestVolume || r.volume > bestVolume)) {
          bestVolume = r.volume;
        }
        if (!bestRank || r.rank < bestRank) bestRank = r.rank;
      }
      await sleep(150);
    }

    snapshot.data[tag] = {
      volume: bestVolume,
      rank:   bestRank,
    };
    console.log(`    → best volume: ${bestVolume || 'not trending'}, best rank: ${bestRank || 'n/a'}\n`);
  }

  // ── Load existing snapshots ────────────────────────
  const snapsPath = path.join(ROOT, 'docs', 'data', 'snapshots.json');
  let snaps = [];
  try { snaps = JSON.parse(fs.readFileSync(snapsPath, 'utf8')); } catch {}

  snaps.push(snapshot);
  // Keep last 30 days (48 per day × 30 = 1440)
  if (snaps.length > 1440) snaps = snaps.slice(-1440);

  fs.writeFileSync(snapsPath, JSON.stringify(snaps, null, 2));
  console.log(`✅ Snapshot saved. Total: ${snaps.length}. Time: ${snapshot.time}`);
}

main().catch(e => { console.error(e); process.exit(1); });