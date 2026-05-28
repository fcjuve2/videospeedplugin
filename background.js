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

const MODE_CYCLE = ['comfort', 'balanced', 'turbo'];

const PRESETS = {
  comfort:  { fastRate: 1.5,  silenceThreshold: 0.005, silenceDelay: 1000 },
  balanced: { fastRate: 1.75, silenceThreshold: 0.01,  silenceDelay: 500  },
  turbo:    { fastRate: 2.25, silenceThreshold: 0.02,  silenceDelay: 200  },
};

const DEFAULT_MODE_SETTINGS = {
  comfort:  { normalRate: 1.0, fastRate: 1.5,  silenceThreshold: 0.005, silenceDelay: 1000 },
  balanced: { normalRate: 1.0, fastRate: 1.75, silenceThreshold: 0.01,  silenceDelay: 500  },
  turbo:    { normalRate: 1.0, fastRate: 2.25, silenceThreshold: 0.02,  silenceDelay: 200  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayString() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/** Format seconds into a human-readable string for notifications. */
function formatTimeBrief(sec) {
  const s = Math.floor(sec || 0);
  if (s <= 0) return '0s';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const mRem = m % 60;
  return mRem > 0 ? `${h}h ${mRem}m` : `${h}h`;
}

/** Format seconds into badge text: "45s" or "1:23" */
function formatBadge(seconds) {
  const s = Math.floor(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

// ─── Icon ────────────────────────────────────────────────────────────────────

function updateIcon(enabled) {
  const suffix = enabled ? '' : '_disabled';
  chrome.action.setIcon({
    path: {
      '16':  `icons/icon16${suffix}.png`,
      '32':  `icons/icon32${suffix}.png`,
      '48':  `icons/icon48${suffix}.png`,
      '128': `icons/icon128${suffix}.png`,
    }
  });
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

// ─── Helpers — weekly stats ───────────────────────────────────────────────────

/** Merge today's total into the 7-entry weeklyStats array. */
function mergeWeeklyStats(entries, todayStr, todaySeconds) {
  const list = Array.isArray(entries) ? [...entries] : [];
  const idx  = list.findIndex((e) => e.date === todayStr);
  if (idx >= 0) {
    list[idx] = { date: todayStr, savedSeconds: todaySeconds };
  } else {
    list.push({ date: todayStr, savedSeconds: todaySeconds });
  }
  list.sort((a, b) => a.date.localeCompare(b.date));
  return list.length > 7 ? list.slice(list.length - 7) : list;
}

// ─── Startup init ─────────────────────────────────────────────────────────────

chrome.storage.sync.get({ enabled: true, modeSettings: null }, ({ enabled, modeSettings }) => {
  updateIcon(enabled);
  if (!modeSettings) {
    chrome.storage.sync.set({ modeSettings: DEFAULT_MODE_SETTINGS });
  }
});

// ─── Message handler ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  // ── Stats update from content script ──────────────────────────────────────
  if (msg.type === 'UPDATE_STATS') {
    const { sessionSaved, delta, isFast } = msg;

    const { hostname, newSession } = msg;

    chrome.storage.local.get(
      {
        savedTime:   { ...DEFAULT_STATS, todayDate: todayString() },
        weeklyStats: [],
        domainStats: {},
      },
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

        const weeklyStats  = mergeWeeklyStats(data.weeklyStats, today, stats.today);

        // Update per-domain stats
        const domainStats  = { ...data.domainStats };
        if (hostname) {
          const entry = { savedSeconds: 0, sessions: 0, ...(domainStats[hostname] || {}) };
          if (delta > 0)  entry.savedSeconds += delta;
          if (newSession) entry.sessions     += 1;
          domainStats[hostname] = entry;
        }

        chrome.storage.local.set({ savedTime: stats, weeklyStats, domainStats });
        updateBadge(sessionSaved, isFast);
      }
    );

    sendResponse({ ok: true });
    return true; // keep channel open for async callback
  }

  // ── Video-end notification ─────────────────────────────────────────────────
  if (msg.type === 'VIDEO_END') {
    const { sessionSaved, hostname } = msg;

    chrome.storage.sync.get({ showSystemNotifications: false }, ({ showSystemNotifications }) => {
      if (!showSystemNotifications) { sendResponse({ ok: true }); return; }

      chrome.storage.local.get({ savedTime: DEFAULT_STATS }, ({ savedTime }) => {
        const body = `Saved ${formatTimeBrief(sessionSaved)} on last video.` +
                     ` Today total: ${formatTimeBrief(savedTime.today)}.`;
        chrome.notifications.create('svs-video-end', {
          type:    'basic',
          iconUrl: 'icons/icon128.png',
          title:   'Smart Video Speed',
          message: body,
        });
        sendResponse({ ok: true });
      });
    });

    return true; // keep channel open for async callbacks
  }

  // ── Stats reset from popup ─────────────────────────────────────────────────
  if (msg.type === 'RESET_STATS') {
    const empty = { ...DEFAULT_STATS, todayDate: todayString() };
    chrome.storage.local.set({ savedTime: empty, weeklyStats: [], domainStats: {} });
    chrome.action.setBadgeText({ text: '' });

    // Reset session counter in the content script of the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'RESET_STATS' }).catch(() => {});
      }
    });

    sendResponse({ ok: true });
    return true;
  }
});

// ─── Keyboard shortcut commands ───────────────────────────────────────────────

chrome.commands.onCommand.addListener((command) => {

  if (command === 'toggle-plugin') {
    chrome.storage.sync.get({ enabled: true }, ({ enabled }) => {
      const newEnabled = !enabled;
      chrome.storage.sync.set({ enabled: newEnabled });
      updateIcon(newEnabled);

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'TOGGLE_PLUGIN',
            enabled: newEnabled,
          }).catch(() => {});
        }
      });
    });
  }

  if (command === 'cycle-mode') {
    chrome.storage.sync.get({ activeMode: 'balanced', modeSettings: DEFAULT_MODE_SETTINGS }, ({ activeMode, modeSettings }) => {
      const idx      = MODE_CYCLE.indexOf(activeMode);
      const nextMode = MODE_CYCLE[(idx + 1) % MODE_CYCLE.length];
      const preset   = modeSettings[nextMode] ?? DEFAULT_MODE_SETTINGS[nextMode];

      chrome.storage.sync.set({
        activeMode:       nextMode,
        normalRate:       preset.normalRate ?? 1.0,
        fastRate:         preset.fastRate,
        silenceThreshold: preset.silenceThreshold,
        silenceDelay:     preset.silenceDelay,
      });

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type:             'CYCLE_MODE',
            mode:             nextMode,
            normalRate:       preset.normalRate ?? 1.0,
            fastRate:         preset.fastRate,
            silenceThreshold: preset.silenceThreshold,
            silenceDelay:     preset.silenceDelay,
          }).catch(() => {});
        }
      });
    });
  }
});
