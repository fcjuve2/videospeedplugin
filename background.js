/**
 * Smart Video Speed — Background Service Worker
 *
 * Responsibilities:
 *   - Receive UPDATE_STATS messages from content_script (every 5 s per tab)
 *   - Persist today / total counters to chrome.storage.local on every stats message
 *   - Update the toolbar badge (text + colour) on each stats message
 *   - Handle RESET_STATS messages from the popup
 *
 * Data flow:
 *   content_script → sendMessage(UPDATE_STATS { sessionSaved, delta, isFast })
 *                 → background updates storage + badge
 *   popup         → sendMessage(RESET_STATS)
 *                 → background clears storage + badge
 */

const DEFAULT_STATS = { session: 0, today: 0, total: 0, todayDate: '' };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayString() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/** Format seconds into badge text: "45s" or "1:23" */
function formatBadge(seconds) {
  const s = Math.floor(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

// ─── Badge ───────────────────────────────────────────────────────────────────

function updateBadge(sessionSaved, isFast) {
  if (sessionSaved <= 0) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }
  chrome.action.setBadgeText({ text: formatBadge(sessionSaved) });
  chrome.action.setBadgeBackgroundColor({ color: isFast ? '#27AE60' : '#888888' });
}

// ─── Storage ─────────────────────────────────────────────────────────────────

function writeStats(stats) {
  chrome.storage.local.set({ savedTime: stats });
}

// ─── Message handler ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  // ── Stats update from content script ──────────────────────────────────────
  if (msg.type === 'UPDATE_STATS') {
    const { sessionSaved, delta, isFast } = msg;

    chrome.storage.local.get(
      { savedTime: { ...DEFAULT_STATS, todayDate: todayString() } },
      (data) => {
        const stats = { ...data.savedTime };

        // Roll over today counter at midnight
        const today = todayString();
        if (stats.todayDate !== today) {
          stats.today = 0;
          stats.todayDate = today;
        }

        // delta is computed by content_script to avoid double-counting
        // across service-worker restarts (content_script tracks lastSentSaved)
        if (delta > 0) {
          stats.today = (stats.today || 0) + delta;
          stats.total = (stats.total || 0) + delta;
        }

        stats.session = sessionSaved;

        writeStats(stats);
        updateBadge(sessionSaved, isFast);
      }
    );

    sendResponse({ ok: true });
    return true; // keep channel open for async callback
  }

  // ── Stats reset from popup ─────────────────────────────────────────────────
  if (msg.type === 'RESET_STATS') {
    const empty = { ...DEFAULT_STATS, todayDate: todayString() };
    writeStats(empty);
    chrome.action.setBadgeText({ text: '' });
    sendResponse({ ok: true });
    return true;
  }
});
