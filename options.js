/**
 * Smart Video Speed — Options Page
 * Renders the full weekly time-saved bar chart and summary statistics.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(sec) {
  const s = Math.floor(sec || 0);
  if (s <= 0) return '\u2014';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const mRem = m % 60;
  return mRem > 0 ? `${h}h ${mRem}m` : `${h}h`;
}

/**
 * Round up to a chart-friendly maximum so gridlines land on clean values.
 * The returned value is always >= maxSec and a multiple of the step used.
 */
function niceMax(maxSec) {
  if (maxSec <= 0) return 120;
  const steps = [30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400];
  const target = maxSec * 1.1;
  return steps.find((s) => s >= target) || Math.ceil(target / 3600) * 3600;
}

function formatYLabel(sec) {
  if (sec === 0) return '0';
  if (sec < 60) return `${Math.round(sec)}s`;
  return `${Math.round(sec / 60)}m`;
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatXLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

// ── Build 7-day array ─────────────────────────────────────────────────────────

function buildDays(weeklyStats) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const entry = (weeklyStats || []).find((e) => e.date === dateStr);
    days.push({
      date:         dateStr,
      savedSeconds: entry ? (entry.savedSeconds || 0) : 0,
      isToday:      dateStr === todayStr,
    });
  }
  return days;
}

// ── Summary ───────────────────────────────────────────────────────────────────

function renderSummary(days) {
  const total   = days.reduce((s, d) => s + d.savedSeconds, 0);
  const avg     = total / 7;
  const bestDay = days.reduce((best, d) => (d.savedSeconds > best.savedSeconds ? d : best), days[0]);

  document.getElementById('weekTotal').textContent = formatTime(total);
  document.getElementById('weekAvg').textContent   = formatTime(avg);

  const bestEl = document.getElementById('weekBest');
  if (bestDay.savedSeconds > 0) {
    bestEl.textContent = `${formatTime(bestDay.savedSeconds)}`;
    bestEl.title       = bestDay.date;
  } else {
    bestEl.textContent = '\u2014';
  }
}

// ── Full chart ────────────────────────────────────────────────────────────────

function renderFullChart(days) {
  const svg = document.getElementById('fullChart');
  if (!svg) return;

  // Logical SVG dimensions (scaled to 100% width via viewBox + CSS)
  const SVG_W = 540;
  const SVG_H = 300;
  const ML    = 44;   // left margin — Y-axis labels
  const MR    = 12;   // right margin
  const MT    = 10;   // top margin
  const MB    = 28;   // bottom margin — X-axis labels
  const CW    = SVG_W - ML - MR;  // chart width  = 484
  const CH    = SVG_H - MT - MB;  // chart height = 262

  const GAP  = 6;
  const n    = 7;
  const barW = (CW - GAP * (n - 1)) / n;

  const maxSec = Math.max(...days.map((d) => d.savedSeconds), 0);
  const yMax   = niceMax(maxSec);
  const TICKS  = 4; // gridlines at 0 %, 25 %, 50 %, 75 %, 100 %

  const parts = [];

  // Gridlines + Y-axis labels (bottom → top)
  for (let t = 0; t <= TICKS; t++) {
    const val = (t / TICKS) * yMax;
    const y   = MT + CH - (t / TICKS) * CH;
    parts.push(
      `<line x1="${ML}" y1="${y.toFixed(1)}" x2="${ML + CW}" y2="${y.toFixed(1)}" stroke="#1e1e30" stroke-width="1"/>`,
      `<text x="${(ML - 6).toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="#555" font-size="10" font-family="sans-serif">${formatYLabel(val)}</text>`,
    );
  }

  // Y-axis spine
  parts.push(
    `<line x1="${ML}" y1="${MT}" x2="${ML}" y2="${MT + CH}" stroke="#333" stroke-width="1"/>`,
  );

  // Bars + X-axis labels
  days.forEach((day, i) => {
    const x     = ML + i * (barW + GAP);
    const frac  = yMax > 0 ? day.savedSeconds / yMax : 0;
    const barH  = day.savedSeconds > 0 ? Math.max(2, frac * CH) : 0;
    const barY  = MT + CH - barH;
    const fill  = day.isToday ? '#2E75B6' : '#2a2a56';
    const cx    = x + barW / 2;
    const label = formatXLabel(day.date);
    const tip   = day.savedSeconds > 0 ? formatTime(day.savedSeconds) : '0s';

    parts.push(
      `<rect x="${x.toFixed(1)}" y="${barY.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" fill="${fill}" rx="3"><title>${day.date}: ${tip}</title></rect>`,
      `<text x="${cx.toFixed(1)}" y="${(MT + CH + MB - 7).toFixed(1)}" text-anchor="middle" fill="${day.isToday ? '#7ab4ff' : '#555'}" font-size="10" font-family="sans-serif">${label}</text>`,
    );

    // Value label above the bar (only when bar is tall enough to avoid overlap)
    if (barH >= 18 && day.savedSeconds > 0) {
      parts.push(
        `<text x="${cx.toFixed(1)}" y="${(barY - 5).toFixed(1)}" text-anchor="middle" fill="${day.isToday ? '#7ab4ff' : '#888'}" font-size="9" font-family="sans-serif">${formatTime(day.savedSeconds)}</text>`,
      );
    }
  });

  svg.setAttribute('viewBox', `0 0 ${SVG_W} ${SVG_H}`);
  svg.setAttribute('width', SVG_W);
  svg.setAttribute('height', SVG_H);
  svg.innerHTML = parts.join('');
}

// ── Per-site table ────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderDomainTable(domainStats) {
  const tbody = document.getElementById('domainTableBody');
  if (!tbody) return;

  const entries = Object.entries(domainStats || {});
  if (entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-msg">No data yet.</td></tr>';
    return;
  }

  entries.sort((a, b) => b[1].savedSeconds - a[1].savedSeconds);

  tbody.innerHTML = entries.map(([domain, { savedSeconds, sessions }], i) => {
    const avg = sessions > 0 ? savedSeconds / sessions : 0;
    const cls = i < 3 ? ` class="top-${i + 1}"` : '';
    return `<tr${cls}>
      <td class="domain-name">${escapeHtml(domain)}</td>
      <td>${formatTime(savedSeconds)}</td>
      <td>${sessions}</td>
      <td>${formatTime(avg)}</td>
    </tr>`;
  }).join('');
}

document.getElementById('clearDomainBtn').addEventListener('click', () => {
  if (!confirm('Clear all per-site statistics? This cannot be undone.')) return;
  chrome.storage.local.set({ domainStats: {} });
});

// ── Init ──────────────────────────────────────────────────────────────────────

chrome.storage.local.get({ weeklyStats: [], domainStats: {} }, (data) => {
  const days = buildDays(data.weeklyStats);
  renderSummary(days);
  renderFullChart(days);
  renderDomainTable(data.domainStats);
});

// Live updates while the page is open
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.weeklyStats) {
    const days = buildDays(changes.weeklyStats.newValue || []);
    renderSummary(days);
    renderFullChart(days);
  }
  if (changes.domainStats) {
    renderDomainTable(changes.domainStats.newValue || {});
  }
});
