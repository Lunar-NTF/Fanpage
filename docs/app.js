/* ─────────────────────────────────────────────────────────
   FANTRACKER — app.js (GitHub Pages edition)
   Reads config.json, data/snapshots.json, data/trends.json
   directly from the repo via raw GitHub URLs.
   No backend needed — data is committed by GitHub Actions.
───────────────────────────────────────────────────────── */

// ── State ───────────────────────────────────────────────
let cfg       = {};
let snapshots = [];
let trends    = {};
let histChart = null;
let nextTimer = null;
let countdown = 30 * 60; // seconds until next auto-refresh

// ── Helpers ─────────────────────────────────────────────
const $ = id => document.getElementById(id);

const fmtN = n => {
  if (n === null || n === undefined) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(Math.round(n));
};

const fmtDate = iso =>
  new Date(iso).toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });

function countdownText(endDate) {
  if (!endDate) return '';
  const diff = new Date(endDate) - new Date();
  if (diff < 0) return 'ended';
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  return d > 0 ? `${d}d ${h}h left` : `${h}h left`;
}

function allEventTags() {
  const tags = [];
  for (const ev of cfg.events || []) {
    for (const t of ev.tags || []) tags.push({ value: t.value, eventName: ev.name });
  }
  return tags;
}

// ── Data loading ─────────────────────────────────────────
// Paths work both locally (docs/) and on GitHub Pages
async function fetchJSON(path) {
  try {
    const r = await fetch(path + '?_=' + Date.now()); // cache-bust
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function loadData() {
  $('live-dot').className = 'live-dot inactive';
  $('refresh-status').textContent = 'Refreshing…';

  // From GitHub Pages, these paths resolve relative to docs/
  // config.json and data/ are one level up — served via raw.githubusercontent or relative path
  // We use relative paths that work when GitHub Pages serves from /docs
  const [cfgData, snapsData, trendsData] = await Promise.all([
    fetchJSON('../config.json'),
    fetchJSON('../data/snapshots.json'),
    fetchJSON('../data/trends.json'),
  ]);

  if (cfgData)    cfg       = cfgData;
  if (snapsData)  snapshots = snapsData;
  if (trendsData) trends    = trendsData;

  // Apply title
  const title = cfg.title || 'Fan Club Tracker ✦';
  $('dashboard-title').textContent = title;
  document.title = title;

  // Last snapshot time
  const lastSnap = snapshots[snapshots.length - 1];
  $('live-dot').className = 'live-dot';
  $('refresh-status').textContent = lastSnap
    ? 'Last updated: ' + fmtDate(lastSnap.time)
    : 'No data yet — workflow hasn\'t run yet';

  renderLive();
  renderCountrySelect();
  populateHistSelect();

  // Restart countdown
  startCountdown();
}

// ── Countdown to next auto-refresh ───────────────────────
function startCountdown() {
  clearInterval(nextTimer);
  countdown = 30 * 60;
  nextTimer = setInterval(() => {
    countdown--;
    if (countdown <= 0) { loadData(); return; }
    const m = Math.floor(countdown / 60);
    const s = countdown % 60;
    $('next-refresh').textContent = `Next refresh in ${m}:${String(s).padStart(2,'0')}`;
  }, 1000);
}

// ── Live tab rendering ────────────────────────────────────
function renderLive() {
  renderPermSection();
  renderEventsSection();
}

function getLatestCount(tag) {
  // Get the most recent snapshot value for a tag
  for (let i = snapshots.length - 1; i >= 0; i--) {
    const val = snapshots[i]?.data?.[tag];
    if (val !== null && val !== undefined) return val;
  }
  return null;
}

function renderPermSection() {
  const grid  = $('perm-grid');
  const slots = (cfg.permSlots || []).filter(p => p.hashtag || p.keyword);
  if (!slots.length) {
    grid.innerHTML = '<div class="empty-state">Add your artist hashtags to <code>config.json</code> in GitHub</div>';
    return;
  }

  grid.innerHTML = slots.map(p => {
    const c1      = getLatestCount(p.hashtag);
    const c2      = getLatestCount(p.keyword);
    const combined = (c1 || 0) + (c2 || 0);
    const goal    = p.goalK ? p.goalK * 1000 : null;
    const pct     = goal && combined ? Math.min(Math.round(combined / goal * 100), 100) : null;

    return `
    <div class="perm-card">
      <div class="perm-card-header">
        <span class="perm-tag-name">${p.hashtag || p.keyword}</span>
        ${pct !== null ? `<span class="perm-goal-pct">${pct}% of ${fmtN(goal)}</span>` : ''}
      </div>
      <div class="perm-rows">
        ${p.hashtag ? `<div class="perm-row">
          <span class="perm-row-label">${p.hashtag}</span>
          <span class="perm-row-count">${fmtN(c1)}</span>
        </div>` : ''}
        ${p.keyword ? `<div class="perm-row">
          <span class="perm-row-label keyword">"${p.keyword}"</span>
          <span class="perm-row-count">${fmtN(c2)}</span>
        </div>` : ''}
      </div>
      ${p.hashtag && p.keyword ? `
        <div class="combined-row">
          <span class="combined-lbl">combined</span>
          <span class="combined-count">${fmtN(combined)}</span>
        </div>` : ''}
      ${goal ? `
        <div class="mile-bar-bg">
          <div class="mile-bar-fill" style="width:${pct}%"></div>
        </div>
        <div class="mile-labels">
          <span>Goal: ${fmtN(goal)}</span><span>${pct}%</span>
        </div>` : ''}
    </div>`;
  }).join('');
}

function renderEventsSection() {
  const wrap   = $('events-live');
  const active = (cfg.events || []).filter(ev => (ev.tags || []).length);
  if (!active.length) {
    wrap.innerHTML = '<div class="empty-state">No events in <code>config.json</code> yet</div>';
    return;
  }

  wrap.innerHTML = active.map(ev => {
    const tags     = ev.tags || [];
    const counts   = tags.map(t => getLatestCount(t.value) || 0);
    const combined = counts.reduce((a, b) => a + b, 0);
    const goal     = ev.goalK ? ev.goalK * 1000 : null;
    const pct      = goal && combined ? Math.min(Math.round(combined / goal * 100), 100) : null;
    const cd       = countdownText(ev.endDate);

    return `
    <div class="event-card">
      <div class="event-card-header">
        <div class="event-card-left">
          ${cd ? `<div class="countdown-badge ${cd === 'ended' ? 'ended' : ''}">${cd}</div>` : ''}
          <div class="event-name">${ev.name || 'Unnamed event'}</div>
          ${ev.startDate || ev.endDate
            ? `<div class="event-dates">${ev.startDate || ''}${ev.startDate && ev.endDate ? ' → ' : ''}${ev.endDate || ''}</div>`
            : ''}
        </div>
        <div class="event-card-right">
          <div class="event-combined">${fmtN(combined)}</div>
          <div class="event-combined-lbl">combined total</div>
        </div>
      </div>
      ${goal ? `
        <div class="event-mile-bar-bg">
          <div class="event-mile-bar-fill" style="width:${pct}%"></div>
        </div>
        <div class="event-mile-labels">
          <span>Goal: ${fmtN(goal)}</span><span>${pct}%</span>
        </div>` : ''}
      <table class="event-tags-table">
        ${tags.map((t, i) => {
          const trendData = trends[t.value];
          const ww = trendData?.results?.find(r => r.isWW);
          return `
          <tr>
            <td class="${t.type === 'keyword' ? 'keyword-cell' : ''}">${t.type === 'keyword' ? '"' + t.value + '"' : t.value}</td>
            <td>${fmtN(counts[i])}</td>
            <td>${ww?.rank ? `<span class="rank-pill ${ww.rank <= 10 ? 'hot' : ''}">WW #${ww.rank}</span>` : ''}</td>
          </tr>`;
        }).join('')}
      </table>
    </div>`;
  }).join('');
}

// ── Countries tab ─────────────────────────────────────────
function renderCountrySelect() {
  const sel  = $('country-tag-select');
  const tags = allEventTags();
  sel.innerHTML = tags.length
    ? tags.map(t => `<option value="${t.value}">${t.value} (${t.eventName})</option>`).join('')
    : '<option>No event tags in config.json</option>';
  sel.onchange = () => renderCountryResults(sel.value);
  if (tags.length) renderCountryResults(tags[0].value);
}

function renderCountryResults(tag) {
  const data = trends[tag];
  const el   = $('country-results');

  if (!data?.results) {
    el.innerHTML = `<div class="empty-state">No trend scan data for <strong>${tag}</strong> yet.<br>Run the <strong>Scan trends</strong> workflow in GitHub Actions.</div>`;
    $('trends-timestamp').textContent = '—';
    return;
  }

  $('trends-timestamp').textContent = data.timestamp ? fmtDate(data.timestamp) : '—';

  const ww       = data.results.find(r => r.isWW);
  const countries = data.results.filter(r => !r.isWW);
  const trending  = countries.filter(r => r.rank);
  const best      = trending.length ? trending.reduce((a, b) => a.rank < b.rank ? a : b) : null;
  const sorted    = [...countries].sort((a, b) => {
    if (a.rank && b.rank) return a.rank - b.rank;
    if (a.rank) return -1; if (b.rank) return 1; return 0;
  });

  el.innerHTML = `
    <div class="country-summary">
      <div class="summary-card blue-card">
        <div class="summary-lbl">🌍 Worldwide</div>
        <div class="summary-val">${ww?.rank ? '#' + ww.rank : '—'}</div>
        <div class="summary-sub">${ww?.rank ? 'trending' : 'not in top 50'}</div>
      </div>
      <div class="summary-card green-card">
        <div class="summary-lbl">Trending in</div>
        <div class="summary-val">${trending.length} <span style="font-size:14px;font-weight:400">countries</span></div>
        <div class="summary-sub">${best ? 'Best: ' + best.name + ' #' + best.rank : 'not trending'}</div>
      </div>
    </div>
    <div class="country-grid">
      ${ww ? `<div class="country-card ww-card">
        <span class="country-flag-name">🌍 Worldwide</span>
        <span class="country-rank-val ${ww.rank ? 'hot' : ''}">${ww.rank ? '#' + ww.rank : '—'}</span>
      </div>` : ''}
      ${sorted.map(c => `
        <div class="country-card ${c.rank === 1 ? 'trending-top' : c.rank ? 'trending' : ''}">
          <span class="country-flag-name">${c.flag} ${c.name}</span>
          <span class="country-rank-val ${c.rank && c.rank <= 10 ? 'hot' : ''}">${c.rank ? '#' + c.rank : '—'}</span>
        </div>`).join('')}
    </div>`;
}

// ── History tab ───────────────────────────────────────────
function populateHistSelect() {
  const sel  = $('hist-tag');
  const cur  = sel.value;
  const tags = [
    ...(cfg.permSlots || []).flatMap(p => [p.hashtag, p.keyword].filter(Boolean)),
    ...(cfg.events || []).flatMap(ev => (ev.tags || []).map(t => t.value)),
  ];
  sel.innerHTML = [...new Set(tags)].map(t => `<option value="${t}">${t}</option>`).join('');
  if (cur && tags.includes(cur)) sel.value = cur;
  renderHistory();
}

function renderHistory() {
  const tag  = $('hist-tag').value;
  const view = $('hist-view').value;
  const el   = $('history-content');
  if (!tag) { el.innerHTML = '<div class="empty-state">No tags in config yet.</div>'; return; }

  const snaps = snapshots.filter(s => s?.data?.[tag] !== undefined && s?.data?.[tag] !== null);
  if (!snaps.length) {
    el.innerHTML = '<div class="empty-state">No history yet for this tag — data saves every 30 min via GitHub Actions.</div>';
    return;
  }

  if (view === 'table') {
    if (histChart) { histChart.destroy(); histChart = null; }
    el.innerHTML = `
      <table class="hist-table">
        <thead><tr><th>Time</th><th>${tag}</th><th>Change</th></tr></thead>
        <tbody>${snaps.slice().reverse().map((s, i, arr) => {
          const prev = arr[i + 1];
          const diff = prev ? (s.data[tag] || 0) - (prev.data[tag] || 0) : null;
          return `<tr>
            <td>${fmtDate(s.time)}</td>
            <td>${fmtN(s.data[tag])}</td>
            <td class="${diff > 0 ? 'change-pos' : diff < 0 ? 'change-neg' : ''}">${diff !== null ? (diff >= 0 ? '+' : '') + fmtN(diff) : '—'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
  } else {
    el.innerHTML = '<div class="chart-wrap"><canvas id="hist-chart" role="img" aria-label="History chart"></canvas></div>';
    setTimeout(() => {
      const ctx = $('hist-chart');
      if (!ctx) return;
      if (histChart) histChart.destroy();
      histChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: snaps.map(s => fmtDate(s.time)),
          datasets: [{
            label: tag,
            data:  snaps.map(s => s.data[tag] || 0),
            borderColor: '#378ADD',
            backgroundColor: 'rgba(55,138,221,0.08)',
            fill: true, tension: 0.4,
            pointRadius: 3, pointBackgroundColor: '#378ADD',
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color:'#535C73', font:{size:11}, maxRotation:45, autoSkip:true }, grid:{color:'rgba(255,255,255,.04)'} },
            y: { ticks: { color:'#535C73', font:{size:11}, callback: v => fmtN(v) },        grid:{color:'rgba(255,255,255,.04)'} },
          },
        },
      });
    }, 60);
  }
}

function exportCSV() {
  const tag   = $('hist-tag').value;
  const snaps = snapshots.filter(s => s?.data?.[tag] !== undefined);
  if (!snaps.length) return;
  const rows = [['time', 'count'], ...snaps.map(s => [s.time, s.data[tag] ?? ''])];
  const csv  = rows.map(r => r.join(',')).join('\n');
  const a    = document.createElement('a');
  a.href     = 'data:text/csv,' + encodeURIComponent(csv);
  a.download = tag.replace('#', '') + '_history.csv';
  a.click();
}

// ── Tab switching ─────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.nav-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('hidden', p.id !== `tab-${name}`);
  });
  if (name === 'history') renderHistory();
  if (name === 'countries') renderCountrySelect();
}

// ── Boot ──────────────────────────────────────────────────
loadData();
