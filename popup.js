/**
 * Smart Video Speed — Popup Script
 * Reads/writes settings via chrome.storage.sync and updates the UI.
 * Displays time-saved statistics from chrome.storage.local.
 */

const DEFAULTS = {
  enabled: true,
  normalRate: 1.0,
  fastRate: 1.75,
  silenceThreshold: 0.01,
  silenceDelay: 500,
  showOverlay: false,
  showSystemNotifications: false,
  activeMode: 'balanced',
  excludedDomains: [],
};

const DEFAULT_MODE_SETTINGS = {
  comfort:  { normalRate: 1.0, fastRate: 1.5,  silenceThreshold: 0.005, silenceDelay: 1000 },
  balanced: { normalRate: 1.0, fastRate: 1.75, silenceThreshold: 0.01,  silenceDelay: 500  },
  turbo:    { normalRate: 1.0, fastRate: 2.25, silenceThreshold: 0.02,  silenceDelay: 200  },
};

const DEFAULT_STATS = { session: 0, today: 0, total: 0, todayDate: '' };

// ── DOM references ────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

const enabledToggle      = $('enabled');
const modeIndicator      = $('mode-indicator');
const modeLabel          = $('mode-label');
const normalRateSlider   = $('normalRateSlider');
const normalRateInput    = $('normalRate');
const fastRateSlider     = $('fastRateSlider');
const fastRateInput      = $('fastRate');
const silenceThreshInput = $('silenceThreshold');
const silenceDelayInput  = $('silenceDelay');
const showOverlayToggle      = $('showOverlay');
const showSysNotifToggle     = $('showSystemNotifications');
const excludeSiteToggle      = $('excludeSite');
const excludeSiteLabel   = $('excludeSiteLabel');
const resetBtn           = $('resetBtn');
const statSession        = $('statSession');
const statToday          = $('statToday');
const statTotal          = $('statTotal');
const modeBtns           = document.querySelectorAll('.mode-btn');

// ── State ─────────────────────────────────────────────────────────────────────

let settings = { ...DEFAULTS };
let currentDomain = '';
let modeSettings = {
  comfort:  { ...DEFAULT_MODE_SETTINGS.comfort  },
  balanced: { ...DEFAULT_MODE_SETTINGS.balanced },
  turbo:    { ...DEFAULT_MODE_SETTINGS.turbo    },
};
let modeSaveTimer = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value), min), max);
}

function round(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function saveModeSettings() {
  clearTimeout(modeSaveTimer);
  modeSaveTimer = setTimeout(() => {
    modeSettings[settings.activeMode] = {
      normalRate:       settings.normalRate,
      fastRate:         settings.fastRate,
      silenceThreshold: settings.silenceThreshold,
      silenceDelay:     settings.silenceDelay,
    };
    chrome.storage.sync.set({ modeSettings });
  }, 500);
}

/**
 * Format seconds into a human-readable string.
 *   0        → "—"
 *   45       → "0:45"
 *   90       → "1:30"
 *   3810     → "1:03:30"
 */
function formatTime(seconds) {
  const s = Math.floor(seconds || 0);
  if (s <= 0) return '\u2014';

  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ── UI rendering ──────────────────────────────────────────────────────────────

function renderSettings() {
  enabledToggle.checked        = settings.enabled;
  normalRateSlider.value       = settings.normalRate;
  normalRateInput.value        = settings.normalRate;
  fastRateSlider.value         = settings.fastRate;
  fastRateInput.value          = settings.fastRate;
  silenceThreshInput.value     = settings.silenceThreshold;
  silenceDelayInput.value      = settings.silenceDelay;
  showOverlayToggle.checked        = settings.showOverlay;
  showSysNotifToggle.checked       = settings.showSystemNotifications;

  if (currentDomain) {
    excludeSiteToggle.checked = (settings.excludedDomains || []).includes(currentDomain);
  }

  updateModeIndicator();
  renderModeBtns();
}

function renderStats(stats) {
  statSession.textContent = formatTime(stats.session);
  statToday.textContent   = formatTime(stats.today);
  statTotal.textContent   = formatTime(stats.total);
}

function updateModeIndicator(modeOverride) {
  if (!settings.enabled) {
    modeIndicator.className = 'mode-indicator mode-disabled';
    modeLabel.textContent   = 'Disabled';
    return;
  }

  chrome.storage.local.get({ currentMode: 'normal' }, ({ currentMode }) => {
    const mode = modeOverride || currentMode;
    if (mode === 'fast') {
      modeIndicator.className = 'mode-indicator mode-fast';
      modeLabel.textContent   = 'Fast speed';
    } else if (mode === 'override') {
      modeIndicator.className = 'mode-indicator mode-override';
      modeLabel.textContent   = '\u23F8 Paused (manual override)';
    } else {
      modeIndicator.className = 'mode-indicator mode-normal';
      modeLabel.textContent   = 'Normal speed';
    }
  });
}

// ── Acceleration mode helpers ─────────────────────────────────────────────────

const MODE_LABELS = {
  comfort:  '🟢 Comfort',
  balanced: '🔵 Balanced',
  turbo:    '🔴 Turbo',
};

function renderModeBtns() {
  const active = settings.activeMode;
  modeBtns.forEach((btn) => {
    const mode = btn.dataset.mode;
    btn.classList.toggle('active', mode === active);
    btn.textContent = MODE_LABELS[mode];
  });
}

// ── Persistence ───────────────────────────────────────────────────────────────

function saveSettings() {
  chrome.storage.sync.set(settings);
}

// ── Event handlers — settings ─────────────────────────────────────────────────

enabledToggle.addEventListener('change', () => {
  settings.enabled = enabledToggle.checked;
  saveSettings();
  updateModeIndicator();
});

normalRateSlider.addEventListener('input', () => {
  const v = round(parseFloat(normalRateSlider.value), 2);
  normalRateInput.value = v;
  settings.normalRate   = v;
  saveSettings();
  saveModeSettings();
});

normalRateInput.addEventListener('change', () => {
  const v = round(clamp(normalRateInput.value, 0.5, 2.0), 2);
  normalRateInput.value  = v;
  normalRateSlider.value = v;
  settings.normalRate    = v;
  saveSettings();
  saveModeSettings();
});

fastRateSlider.addEventListener('input', () => {
  const v = round(parseFloat(fastRateSlider.value), 2);
  fastRateInput.value = v;
  settings.fastRate   = v;
  saveSettings();
  saveModeSettings();
});

fastRateInput.addEventListener('change', () => {
  const v = round(clamp(fastRateInput.value, 1.0, 4.0), 2);
  fastRateInput.value  = v;
  fastRateSlider.value = v;
  settings.fastRate    = v;
  saveSettings();
  saveModeSettings();
});

silenceThreshInput.addEventListener('change', () => {
  const v = round(clamp(silenceThreshInput.value, 0.001, 0.05), 3);
  silenceThreshInput.value  = v;
  settings.silenceThreshold = v;
  saveSettings();
  saveModeSettings();
});

silenceDelayInput.addEventListener('change', () => {
  const v = Math.round(clamp(silenceDelayInput.value, 100, 2000));
  silenceDelayInput.value = v;
  settings.silenceDelay   = v;
  saveSettings();
  saveModeSettings();
});

showOverlayToggle.addEventListener('change', () => {
  settings.showOverlay = showOverlayToggle.checked;
  saveSettings();
});

showSysNotifToggle.addEventListener('change', () => {
  settings.showSystemNotifications = showSysNotifToggle.checked;
  saveSettings();
});

excludeSiteToggle.addEventListener('change', () => {
  if (!currentDomain) return;
  const domains = settings.excludedDomains || [];
  if (excludeSiteToggle.checked) {
    if (!domains.includes(currentDomain)) {
      settings.excludedDomains = [...domains, currentDomain];
    }
  } else {
    settings.excludedDomains = domains.filter((d) => d !== currentDomain);
  }
  saveSettings();
});

modeBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    if (mode === settings.activeMode) return;
    const ms = modeSettings[mode];
    settings.normalRate        = ms.normalRate;
    settings.fastRate          = ms.fastRate;
    settings.silenceThreshold  = ms.silenceThreshold;
    settings.silenceDelay      = ms.silenceDelay;
    settings.activeMode        = mode;
    saveSettings();
    renderSettings();
  });
});

resetBtn.addEventListener('click', () => {
  modeSettings = {
    comfort:  { ...DEFAULT_MODE_SETTINGS.comfort  },
    balanced: { ...DEFAULT_MODE_SETTINGS.balanced },
    turbo:    { ...DEFAULT_MODE_SETTINGS.turbo    },
  };
  chrome.storage.sync.set({ modeSettings });
  const ms = DEFAULT_MODE_SETTINGS[settings.activeMode];
  settings.normalRate        = ms.normalRate;
  settings.fastRate          = ms.fastRate;
  settings.silenceThreshold  = ms.silenceThreshold;
  settings.silenceDelay      = ms.silenceDelay;
  saveSettings();
  renderSettings();
});

// ── React to live changes while popup is open ─────────────────────────────────

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.currentMode) {
      updateModeIndicator(changes.currentMode.newValue);
    }
    if (changes.savedTime) {
      renderStats(changes.savedTime.newValue || DEFAULT_STATS);
    }
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const url = tabs[0]?.url;
  if (url) {
    try {
      currentDomain = new URL(url).hostname;
      if (currentDomain) {
        excludeSiteLabel.textContent = currentDomain;
        excludeSiteToggle.checked = (settings.excludedDomains || []).includes(currentDomain);
      }
    } catch (_) {}
  }
  if (!currentDomain) {
    // Non-web page (e.g. chrome://) — hide the exclusion row
    const row = excludeSiteToggle.closest('.site-exclusion-row');
    if (row) row.style.display = 'none';
  }
});

chrome.storage.sync.get({ ...DEFAULTS, modeSettings: null }, (stored) => {
  settings = { ...DEFAULTS, ...stored };
  if (!DEFAULT_MODE_SETTINGS[settings.activeMode]) settings.activeMode = 'balanced';
  if (stored.modeSettings) {
    modeSettings = stored.modeSettings;
  } else {
    modeSettings = {
      comfort:  { ...DEFAULT_MODE_SETTINGS.comfort  },
      balanced: { ...DEFAULT_MODE_SETTINGS.balanced },
      turbo:    { ...DEFAULT_MODE_SETTINGS.turbo    },
    };
    chrome.storage.sync.set({ modeSettings });
  }
  renderSettings();
});

chrome.storage.local.get({ savedTime: DEFAULT_STATS }, (data) => {
  renderStats(data.savedTime);
});

document.getElementById('open-options').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
