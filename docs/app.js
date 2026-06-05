/* ─────────────────────────────────────────────────────────
   FANTRACKER app.js — GitHub Pages edition
   Reads: config.json, data/snapshots.json, data/trends.json
   All data is committed by GitHub Actions every 30 min.
───────────────────────────────────────────────────────── */

let cfg       = {};
let snapshots = [];
let trends    = {};
let histChart = null;
let refreshInterval = null;
let countdownSecs   = 30 * 60;

// ── Helpers ─────────────────────────────────────────────
const $ = id => document.getElementById(id);

const fmtN = n => {
  if (n === null || n === undefined) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(Math.round(n));
};

const fmtDate = iso =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

function countdownText(endDate) {
  if (!endDate) return '';
  const diff = new Date(endDate) - new Date();
  if (diff < 0) return 'ended';
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000)  / 60_000);
  return d > 0 ? `${d}d ${h}h left` : h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

function allTags() {
  const tags = [];
  for (const p of cfg.permSlots || []) {
    if (p.hashtag) tags.push(p.hashtag);
    if (p.keyword) tags.push(p.keyword);
  }
  for (const ev of cfg.events || []) {
    for (const t of ev.tags || []) tags.push(t.value);
  }
  return [...new Set(tags)];
}

// ── Load data ────────────────────────────────────────────
async function fetchJSON(path) {
  try {
    const r = await fetch(path + '?_=' + Date.now());
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function loadData() {
  $('live-dot').className = 'live-dot inactive';
  $('refresh-status').textContent = 'Refreshing…';

  const [cfgData, snapsData, trendsData] = await Promise.all([
    fetchJSON('config.json'),
    fetchJSON('data/snapshots.json'),
    fetchJSON('data/trends.json'),
  ]);

  if (cfgData)    cfg       = cfgData;
  if (snapsData)  snapshots = Array.isArray(snapsData) ? snapsData : [];
  if (trendsData) trends    = trendsData;

  const title = cfg.title || 'Fan Club Tracker ✦';
  $('dashboard-title').textContent = title;
  document.title = title;

  const lastSnap = snapshots[snapshots.length - 1];
  $('live-dot').className = 'live-dot';
  $('refresh-status').textContent = lastSnap
    ? 'Updated: ' + fmtDate(lastSnap.time)
    : 'Waiting for first workflow run…';

  renderLive();
  renderCountrySelect();
  populateHistSelect();
  startCountdown();
}

// ── Countdown ─────────────────────────────────────────────
function startCountdown() {
  clearInterval(refreshInterval);
  countdownSecs = 30 * 60;
  refreshInterval = setInterval(() => {
    countdownSecs--;
    if (countdownSecs <= 0) { loadData(); return; }
    const m = Math.floor(countdownSecs / 60);
    const s = countdownSecs % 60;
    $('next-refresh').textContent = `Next refresh in ${m}:${String(s).padStart(2, '0')}`;
  }, 1000);
}

// ── Get latest volume from snapshots ──────────────────────
// snapshot.data[tag] = { volume, rank } or just a number (legacy)
function getLatestVolume(tag) {
  for (let i = snapshots.length - 1; i >= 0; i--) {
    const val = snapshots[i]?.data?.[tag];
    if (val === null || val === undefined) continue;
    if (typeof val === 'object') return val.volume ?? null;
    if (typeof val === 'number') return val;
  }
  return null;
}

function getLatestRank(tag) {
  for (let i = snapshots.length - 1; i >= 0; i--) {
    const val = snapshots[i]?.data?.[tag];
    if (val && typeof val === 'object') return val.rank ?? null;
  }
  return null;
}

function getBestVolume(tag) {
  let best = null;
  for (const snap of snapshots) {
    const val = snap?.data?.[tag];
    let v = null;
    if (typeof val === 'object') v = val?.volume;
    else if (typeof val === 'number') v = val;
    if (v && (!best || v > best)) best = v;
  }
  return best;
}

// ── Live tab ──────────────────────────────────────────────
function renderLive() {
  renderPermSection();
  renderEventsSection();
}

function renderPermSection() {
  const grid  = $('perm-grid');
  const slots = (cfg.permSlots || []).filter(p => p.hashtag || p.keyword);
  if (!slots.length) {
    grid.innerHTML = '<div class="empty-state">Add artist hashtags to config.json in GitHub</div>';
    return;
  }

  grid.innerHTML = slots.map(p => {
    const v1      = getLatestVolume(p.hashtag);
    const v2      = getLatestVolume(p.keyword);
    const r1      = getLatestRank(p.hashtag);
    const r2      = getLatestRank(p.keyword);
    // Use highest available volume as the main number
    const mainVol = v1 !== null && v2 !== null
      ? Math.max(v1, v2)
      : (v1 ?? v2);
    const bestRank = r1 && r2 ? Math.min(r1, r2) : (r1 ?? r2);
    const goal     = p.goalK ? p.goalK * 1000 : null;
    const pct      = goal && mainVol ? Math.min(Math.round(mainVol / goal * 100), 100) : null;

    return `
    <div class="perm-card">
      <div class="perm-card-header">
        <span class="perm-tag-name">${p.hashtag || p.keyword}</span>
        ${bestRank ? `<span class="ht-rank-badge ${bestRank <= 10 ? 'hot' : ''}">🔥 #${bestRank} trending</span>` : ''}
      </div>

      <div class="perm-volume">${fmtN(mainVol)}</div>
      <div class="perm-volume-lbl">tweet volume ${mainVol === null ? '— not trending' : '(Twitter reported)'}</div>

      ${p.hashtag && p.keyword ? `
        <div class="perm-rows" style="margin-top:8px">
          <div class="perm-row">
            <span class="perm-row-label">${p.hashtag}</span>
            <span class="perm-row-count">${fmtN(v1)}${r1 ? ` <span class="rank-tag">#${r1}</span>` : ''}</span>
          </div>
          <div class="perm-row">
            <span class="perm-row-label keyword">"${p.keyword}"</span>
            <span class="perm-row-count">${fmtN(v2)}${r2 ? ` <span class="rank-tag">#${r2}</span>` : ''}</span>
          </div>
        </div>` : ''}

      ${goal && pct !== null ? `
        <div class="mile-bar-bg">
          <div class="mile-bar-fill" style="width:${pct}%"></div>
        </div>
        <div class="mile-labels"><span>Goal: ${fmtN(goal)}</span><span>${pct}%</span></div>` : ''}
    </div>`;
  }).join('');
}

function renderEventsSection() {
  const wrap   = $('events-live');
  const active = (cfg.events || []).filter(ev => (ev.tags || []).length);
  if (!active.length) {
    wrap.innerHTML = '<div class="empty-state">No events in config.json yet</div>';
    return;
  }

  wrap.innerHTML = active.map(ev => {
    const tags    = ev.tags || [];
    // Sum volumes across all tags for combined total
    const volumes = tags.map(t => getLatestVolume(t.value) || 0);
    const combined = volumes.reduce((a, b) => a + b, 0);
    const goal    = ev.goalK ? ev.goalK * 1000 : null;
    const pct     = goal && combined ? Math.min(Math.round(combined / goal * 100), 100) : null;
    const cd      = countdownText(ev.endDate);

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
          <div class="event-combined">${fmtN(combined || null)}</div>
          <div class="event-combined-lbl">combined volume</div>
        </div>
      </div>

      ${goal ? `
        <div class="event-mile-bar-bg">
          <div class="event-mile-bar-fill" style="width:${pct || 0}%"></div>
        </div>
        <div class="event-mile-labels">
          <span>Goal: ${fmtN(goal)}</span><span>${pct || 0}%</span>
        </div>` : ''}

      <table class="event-tags-table">
        ${tags.map((t, i) => {
          const rank      = getLatestRank(t.value);
          // Best rank from trends.json
          const trendData = trends[t.value];
          const ww        = trendData?.results?.find(r => r.isWW);
          return `
          <tr>
            <td class="${t.type === 'keyword' ? 'keyword-cell' : ''}">${t.type === 'keyword' ? '"' + t.value + '"' : t.value}</td>
            <td>${fmtN(volumes[i])}</td>
            <td>
              ${rank ? `<span class="rank-pill ${rank <= 10 ? 'hot' : ''}">#${rank}</span>` : ''}
              ${ww?.rank ? `<span class="rank-pill ${ww.rank <= 5 ? 'hot' : ''}">WW #${ww.rank}</span>` : ''}
              ${ww?.bestRank && ww.bestRank !== ww.rank ? `<span class="rank-pill" style="color:var(--yellow-400)">best WW #${ww.bestRank}</span>` : ''}
            </td>
          </tr>`;
        }).join('')}
      </table>
    </div>`;
  }).join('');
}

// ── Countries tab ──────────────────────────────────────────
function renderCountrySelect() {
  const sel  = $('country-tag-select');
  const tags = (cfg.events || []).flatMap(ev => (ev.tags || []).map(t => ({
    value: t.value, eventName: ev.name
  })));
  sel.innerHTML = tags.length
    ? tags.map(t => `<option value="${t.value}">${t.value} (${t.eventName})</option>`).join('')
    : '<option>No event tags yet</option>';
  if (tags.length) renderCountryResults(tags[0].value);
}

function renderCountryResults(tag) {
  const data = trends[tag];
  const el   = $('country-results');

  if (!data?.results) {
    el.innerHTML = `<div class="empty-state">No scan data for <strong>${tag}</strong> yet.<br>
      Run <strong>Scan trends</strong> in GitHub Actions.</div>`;
    $('trends-timestamp').textContent = '—';
    return;
  }

  $('trends-timestamp').textContent = data.timestamp ? fmtDate(data.timestamp) : '—';

  const ww        = data.results.find(r => r.isWW);
  const countries  = data.results.filter(r => !r.isWW);
  const trending   = countries.filter(r => r.rank);
  const best       = trending.length ? trending.reduce((a, b) => a.rank < b.rank ? a : b) : null;
  const bestEver   = countries.filter(r => r.bestRank).reduce((a, b) => (!a || b.bestRank < a.bestRank) ? b : a, null);
  const sorted     = [...countries].sort((a, b) => {
    // Sort by current rank first, then bestRank, then name
    if (a.rank && b.rank)         return a.rank - b.rank;
    if (a.rank)                   return -1;
    if (b.rank)                   return 1;
    if (a.bestRank && b.bestRank) return a.bestRank - b.bestRank;
    if (a.bestRank)               return -1;
    if (b.bestRank)               return 1;
    return 0;
  });

  el.innerHTML = `
    <div class="country-summary">
      <div class="summary-card blue-card">
        <div class="summary-lbl">🌍 Worldwide now</div>
        <div class="summary-val">${ww?.rank ? '#' + ww.rank : '—'}</div>
        <div class="summary-sub">${ww?.volume ? fmtN(ww.volume) + ' tweets' : ww?.rank ? 'trending' : 'not in top 50'}</div>
        ${ww?.bestRank && ww.bestRank !== ww.rank
          ? `<div style="font-size:11px;color:var(--yellow-400);margin-top:3px;">best ever: #${ww.bestRank}</div>`
          : ''}
      </div>
      <div class="summary-card green-card">
        <div class="summary-lbl">Trending in</div>
        <div class="summary-val">${trending.length} <span style="font-size:14px;font-weight:400">now</span></div>
        <div class="summary-sub">${best ? 'Best now: ' + best.name + ' #' + best.rank : 'not trending'}</div>
        ${bestEver ? `<div style="font-size:11px;color:var(--yellow-400);margin-top:3px;">best ever: ${bestEver.name} #${bestEver.bestRank}</div>` : ''}
      </div>
    </div>

    <div class="country-grid">
      ${ww ? `<div class="country-card ww-card">
        <span class="country-flag-name">🌍 Worldwide</span>
        <div>
          <span class="country-rank-val ${ww.rank ? 'hot' : ''}">${ww.rank ? '#' + ww.rank : '—'}</span>
          ${ww.bestRank && ww.bestRank !== ww.rank
            ? `<span class="best-ever">best #${ww.bestRank}</span>`
            : ''}
          ${ww.volume ? `<span class="volume-badge">${fmtN(ww.volume)}</span>` : ''}
        </div>
      </div>` : ''}

      ${sorted.map(c => `
        <div class="country-card ${c.rank === 1 ? 'trending-top' : c.rank ? 'trending' : c.bestRank ? 'had-trending' : ''}">
          <span class="country-flag-name">${c.flag} ${c.name}</span>
          <div>
            <span class="country-rank-val ${c.rank && c.rank <= 10 ? 'hot' : ''}">${c.rank ? '#' + c.rank : '—'}</span>
            ${c.bestRank && c.bestRank !== c.rank
              ? `<span class="best-ever">best #${c.bestRank}</span>`
              : ''}
            ${c.volume ? `<span class="volume-badge">${fmtN(c.volume)}</span>` : ''}
          </div>
        </div>`).join('')}
    </div>`;
}

// ── History tab ────────────────────────────────────────────
function populateHistSelect() {
  const sel  = $('hist-tag');
  const cur  = sel.value;
  const tags = allTags();
  sel.innerHTML = tags.map(t => `<option value="${t}">${t}</option>`).join('');
  if (cur && tags.includes(cur)) sel.value = cur;
  renderHistory();
}

function renderHistory() {
  const tag  = $('hist-tag')?.value;
  const view = $('hist-view')?.value || 'chart';
  const el   = $('history-content');
  if (!tag) { el.innerHTML = '<div class="empty-state">No tags yet.</div>'; return; }

  // Extract volume values from snapshots (handle both object and number format)
  const snaps = snapshots
    .filter(s => s?.data?.[tag] !== undefined && s?.data?.[tag] !== null)
    .map(s => {
      const val = s.data[tag];
      return {
        time:   s.time,
        volume: typeof val === 'object' ? (val?.volume ?? null) : val,
        rank:   typeof val === 'object' ? (val?.rank   ?? null) : null,
      };
    })
    .filter(s => s.volume !== null);

  if (!snaps.length) {
    el.innerHTML = '<div class="empty-state">No history yet — snapshots save every 30 min.</div>';
    return;
  }

  if (view === 'table') {
    if (histChart) { histChart.destroy(); histChart = null; }
    el.innerHTML = `
      <table class="hist-table">
        <thead><tr><th>Time</th><th>Volume</th><th>Rank</th><th>Change</th></tr></thead>
        <tbody>${snaps.slice().reverse().map((s, i, arr) => {
          const prev = arr[i + 1];
          const diff = prev?.volume !== null && s.volume !== null ? s.volume - prev.volume : null;
          return `<tr>
            <td>${fmtDate(s.time)}</td>
            <td>${fmtN(s.volume)}</td>
            <td>${s.rank ? '#' + s.rank : '—'}</td>
            <td class="${diff > 0 ? 'change-pos' : diff < 0 ? 'change-neg' : ''}">${diff !== null ? (diff >= 0 ? '+' : '') + fmtN(diff) : '—'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
  } else {
    el.innerHTML = '<div class="chart-wrap"><canvas id="hist-chart" role="img" aria-label="Volume history"></canvas></div>';
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
            data:  snaps.map(s => s.volume || 0),
            borderColor:     '#378ADD',
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
  const tag   = $('hist-tag')?.value;
  const snaps = snapshots.filter(s => s?.data?.[tag] !== undefined);
  if (!snaps.length) return;
  const rows = [['time', 'volume', 'rank'], ...snaps.map(s => {
    const val = s.data[tag];
    const v   = typeof val === 'object' ? val?.volume : val;
    const r   = typeof val === 'object' ? val?.rank   : '';
    return [s.time, v ?? '', r ?? ''];
  })];
  const csv = rows.map(r => r.join(',')).join('\n');
  const a   = document.createElement('a');
  a.href    = 'data:text/csv,' + encodeURIComponent(csv);
  a.download = tag.replace('#', '') + '_history.csv';
  a.click();
}

// ── Tab switching ──────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.nav-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('hidden', p.id !== `tab-${name}`);
  });
  if (name === 'history')   { populateHistSelect(); renderHistory(); }
  if (name === 'countries') renderCountrySelect();
}

// ── Boot ───────────────────────────────────────────────────
loadData();