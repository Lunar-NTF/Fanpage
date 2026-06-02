// scripts/trends.js
// Run MANUALLY from GitHub Actions (workflow_dispatch).
// Scans trend rank for all event tags across countries.
// Saves results to data/trends.json

import fetch from 'node-fetch';
import fs    from 'fs';
import path  from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, '..');

const cfg     = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const API_KEY = process.env.RAPIDAPI_KEY || cfg.rapidApiKey;

if (!API_KEY || API_KEY === 'YOUR_RAPIDAPI_KEY_HERE') {
  console.error('❌ No API key. Set RAPIDAPI_KEY secret in GitHub Actions.');
  process.exit(1);
}

// ── Countries ──────────────────────────────────────────
const ASIA_ME = [
  { name:'Worldwide',    woeid:'1',        flag:'🌍', vn:'Worldwide',   isWW:true  },
  { name:'Japan',        woeid:'23424856',  flag:'🇯🇵', vn:'Japan'         },
  { name:'India',        woeid:'23424848',  flag:'🇮🇳', vn:'India'         },
  { name:'Indonesia',    woeid:'23424846',  flag:'🇮🇩', vn:'Indonesia'     },
  { name:'Thailand',     woeid:'23424960',  flag:'🇹🇭', vn:'Thailand'      },
  { name:'Hong Kong',    woeid:'24865698',  flag:'🇭🇰', vn:'HongKong'      },
  { name:'Philippines',  woeid:'23424934',  flag:'🇵🇭', vn:'Philippines'   },
  { name:'Malaysia',     woeid:'23424901',  flag:'🇲🇾', vn:'Malaysia'      },
  { name:'Singapore',    woeid:'23424948',  flag:'🇸🇬', vn:'Singapore'     },
  { name:'Pakistan',     woeid:'23424922',  flag:'🇵🇰', vn:'Pakistan'      },
  { name:'South Korea',  woeid:'23424868',  flag:'🇰🇷', vn:'SouthKorea'    },
  { name:'Taiwan',       woeid:'23424971',  flag:'🇹🇼', vn:'Taiwan'        },
  { name:'Vietnam',      woeid:'23424984',  flag:'🇻🇳', vn:'Vietnam'       },
  { name:'Saudi Arabia', woeid:'23424938',  flag:'🇸🇦', vn:'SaudiArabia'   },
  { name:'UAE',          woeid:'23424932',  flag:'🇦🇪', vn:'UAE'           },
  { name:'Israel',       woeid:'23424852',  flag:'🇮🇱', vn:'Israel'        },
  { name:'Jordan',       woeid:'23424860',  flag:'🇯🇴', vn:'Jordan'        },
  { name:'Lebanon',      woeid:'23424873',  flag:'🇱🇧', vn:'Lebanon'       },
  { name:'Kuwait',       woeid:'23424870',  flag:'🇰🇼', vn:'Kuwait'        },
  { name:'Qatar',        woeid:'23424930',  flag:'🇶🇦', vn:'Qatar'         },
  { name:'Bahrain',      woeid:'23424753',  flag:'🇧🇭', vn:'Bahrain'       },
  { name:'Oman',         woeid:'23424898',  flag:'🇴🇲', vn:'Oman'          },
];

const ALL_64 = [
  ...ASIA_ME,
  { name:'United Kingdom', woeid:'23424975', flag:'🇬🇧', vn:'UnitedKingdom' },
  { name:'Germany',        woeid:'23424829', flag:'🇩🇪', vn:'Germany'       },
  { name:'France',         woeid:'23424819', flag:'🇫🇷', vn:'France'        },
  { name:'Spain',          woeid:'23424950', flag:'🇪🇸', vn:'Spain'         },
  { name:'Netherlands',    woeid:'23424909', flag:'🇳🇱', vn:'Netherlands'   },
  { name:'Italy',          woeid:'23424853', flag:'🇮🇹', vn:'Italy'         },
  { name:'Russia',         woeid:'23424936', flag:'🇷🇺', vn:'Russia'        },
  { name:'Turkey',         woeid:'23424969', flag:'🇹🇷', vn:'Turkey'        },
  { name:'Poland',         woeid:'23424923', flag:'🇵🇱', vn:'Poland'        },
  { name:'Portugal',       woeid:'23424925', flag:'🇵🇹', vn:'Portugal'      },
  { name:'Sweden',         woeid:'23424954', flag:'🇸🇪', vn:'Sweden'        },
  { name:'Norway',         woeid:'23424910', flag:'🇳🇴', vn:'Norway'        },
  { name:'Denmark',        woeid:'23424796', flag:'🇩🇰', vn:'Denmark'       },
  { name:'Belgium',        woeid:'23424757', flag:'🇧🇪', vn:'Belgium'       },
  { name:'Austria',        woeid:'23424750', flag:'🇦🇹', vn:'Austria'       },
  { name:'Switzerland',    woeid:'23424957', flag:'🇨🇭', vn:'Switzerland'   },
  { name:'Greece',         woeid:'23424833', flag:'🇬🇷', vn:'Greece'        },
  { name:'Ireland',        woeid:'23424803', flag:'🇮🇪', vn:'Ireland'       },
  { name:'Ukraine',        woeid:'23424976', flag:'🇺🇦', vn:'Ukraine'       },
  { name:'Belarus',        woeid:'23424765', flag:'🇧🇾', vn:'Belarus'       },
  { name:'Latvia',         woeid:'23424874', flag:'🇱🇻', vn:'Latvia'        },
  { name:'United States',  woeid:'23424977', flag:'🇺🇸', vn:'UnitedStates'  },
  { name:'Brazil',         woeid:'23424768', flag:'🇧🇷', vn:'Brazil'        },
  { name:'Mexico',         woeid:'23424900', flag:'🇲🇽', vn:'Mexico'        },
  { name:'Canada',         woeid:'23424775', flag:'🇨🇦', vn:'Canada'        },
  { name:'Argentina',      woeid:'23424672', flag:'🇦🇷', vn:'Argentina'     },
  { name:'Colombia',       woeid:'23424787', flag:'🇨🇴', vn:'Colombia'      },
  { name:'Chile',          woeid:'23424782', flag:'🇨🇱', vn:'Chile'         },
  { name:'Peru',           woeid:'23424919', flag:'🇵🇪', vn:'Peru'          },
  { name:'Venezuela',      woeid:'23424982', flag:'🇻🇪', vn:'Venezuela'     },
  { name:'Ecuador',        woeid:'23424801', flag:'🇪🇨', vn:'Ecuador'       },
  { name:'Dominican Rep.', woeid:'23424800', flag:'🇩🇴', vn:'DominicanRep'  },
  { name:'Guatemala',      woeid:'23424834', flag:'🇬🇹', vn:'Guatemala'     },
  { name:'Panama',         woeid:'23424924', flag:'🇵🇦', vn:'Panama'        },
  { name:'Puerto Rico',    woeid:'23424935', flag:'🇵🇷', vn:'PuertoRico'    },
  { name:'South Africa',   woeid:'23424942', flag:'🇿🇦', vn:'SouthAfrica'   },
  { name:'Nigeria',        woeid:'23424908', flag:'🇳🇬', vn:'Nigeria'       },
  { name:'Kenya',          woeid:'23424863', flag:'🇰🇪', vn:'Kenya'         },
  { name:'Ghana',          woeid:'23424824', flag:'🇬🇭', vn:'Ghana'         },
  { name:'Egypt',          woeid:'23424802', flag:'🇪🇬', vn:'Egypt'         },
  { name:'Algeria',        woeid:'23424740', flag:'🇩🇿', vn:'Algeria'       },
  { name:'Morocco',        woeid:'23424893', flag:'🇲🇦', vn:'Morocco'       },
  { name:'Australia',      woeid:'23424748', flag:'🇦🇺', vn:'Australia'     },
  { name:'New Zealand',    woeid:'23424916', flag:'🇳🇿', vn:'NewZealand'    },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

function normTag(s) { return (s||'').toLowerCase().replace(/^#+/,'').replace(/\s+/g,'').trim(); }
function matches(a, b) {
  const na = normTag(a), nb = normTag(b);
  return na && nb && (na === nb || na.includes(nb) || nb.includes(na));
}

async function fetchRank(tag, vn) {
  try {
    const url = `https://twitter-api45.p.rapidapi.com/trends.php?country=${encodeURIComponent(vn)}`;
    const res = await fetch(url, {
      headers: { 'x-rapidapi-key': API_KEY, 'x-rapidapi-host': 'twitter-api45.p.rapidapi.com' }
    });
    if (!res.ok) return null;
    const d = await res.json();
    const trends = Array.isArray(d.trends) ? d.trends : Array.isArray(d) ? d : [];
    const idx = trends.findIndex(t => matches(t.name || '', tag));
    return idx >= 0 ? { rank: idx + 1, volume: trends[idx].tweet_volume || null } : null;
  } catch { return null; }
}

async function main() {
  const events = (cfg.events || []).filter(ev => (ev.tags||[]).length > 0);
  if (!events.length) { console.log('No events with tags configured.'); return; }

  const results = {};

  for (const ev of events) {
    const list = ev.scope === 'all64' ? ALL_64 : ASIA_ME;
    console.log(`\n📍 Event: "${ev.name}" — scanning ${list.length} locations (${ev.scope||'asia'})…`);

    for (const t of ev.tags || []) {
      console.log(`  Tag: ${t.value}`);
      const tagResults = [];
      for (const c of list) {
        process.stdout.write(`    ${c.flag} ${c.name} … `);
        const r = await fetchRank(t.value, c.vn);
        tagResults.push({ name: c.name, flag: c.flag, isWW: c.isWW||false, rank: r?.rank||null, volume: r?.volume||null });
        console.log(r ? `#${r.rank}` : '—');
        await sleep(120);
      }
      results[t.value] = { eventId: ev.id, eventName: ev.name, results: tagResults, timestamp: new Date().toISOString() };
    }
  }

  const trendsPath = path.join(ROOT, 'docs', 'data', 'trends.json');
  // Merge with existing results (keep history of previous scans per tag)
  let existing = {};
  try { existing = JSON.parse(fs.readFileSync(trendsPath, 'utf8')); } catch {}
  for (const [tag, data] of Object.entries(results)) {
    existing[tag] = data;
  }
  fs.writeFileSync(trendsPath, JSON.stringify(existing, null, 2));
  console.log('\n✅ Trend results saved to data/trends.json');
}

main().catch(e => { console.error(e); process.exit(1); });
