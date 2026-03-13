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
  activeMode: 'balanced',
  excludedDomains: [],
};

const PRESETS = {
  comfort:  { fastRate: 1.5,  silenceThreshold: 0.005, silenceDelay: 1000 },
  balanced: { fastRate: 1.75, silenceThreshold: 0.01,  silenceDelay: 500  },
  turbo:    { fastRate: 2.25, silenceThreshold: 0.02,  silenceDelay: 200  },
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
const showOverlayToggle  = $('showOverlay');
const excludeSiteToggle  = $('excludeSite');
const excludeSiteLabel   = $('excludeSiteLabel');
const resetBtn           = $('resetBtn');
const resetStatsBtn      = $('resetStatsBtn');
const statSession        = $('statSession');
const statToday          = $('statToday');
const statTotal          = $('statTotal');
const modeBtns           = document.querySelectorAll('.mode-btn');

// ── State ─────────────────────────────────────────────────────────────────────

let settings = { ...DEFAULTS };
let currentDomain = '';

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value), min), max);
}

function round(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
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
  showOverlayToggle.checked    = settings.showOverlay;

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

function isPresetModified(mode) {
  const preset = PRESETS[mode];
  if (!preset) return false;
  return (
    round(settings.fastRate, 2)          !== preset.fastRate          ||
    round(settings.silenceThreshold, 3)  !== preset.silenceThreshold  ||
    Math.round(settings.silenceDelay)    !== preset.silenceDelay
  );
}

function renderModeBtns() {
  const active = settings.activeMode;
  modeBtns.forEach((btn) => {
    const mode = btn.dataset.mode;
    const isActive = mode === active;
    btn.classList.toggle('active', isActive);
    if (isActive && isPresetModified(mode)) {
      btn.textContent = '• ' + MODE_LABELS[mode];
    } else {
      btn.textContent = MODE_LABELS[mode];
    }
  });
}

function applyPreset(mode) {
  const preset = PRESETS[mode];
  if (!preset) return;
  settings.fastRate          = preset.fastRate;
  settings.silenceThreshold  = preset.silenceThreshold;
  settings.silenceDelay      = preset.silenceDelay;
  settings.activeMode        = mode;
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
});

normalRateInput.addEventListener('change', () => {
  const v = round(clamp(normalRateInput.value, 0.5, 2.0), 2);
  normalRateInput.value  = v;
  normalRateSlider.value = v;
  settings.normalRate    = v;
  saveSettings();
});

fastRateSlider.addEventListener('input', () => {
  const v = round(parseFloat(fastRateSlider.value), 2);
  fastRateInput.value = v;
  settings.fastRate   = v;
  saveSettings();
  renderModeBtns();
});

fastRateInput.addEventListener('change', () => {
  const v = round(clamp(fastRateInput.value, 1.0, 4.0), 2);
  fastRateInput.value  = v;
  fastRateSlider.value = v;
  settings.fastRate    = v;
  saveSettings();
  renderModeBtns();
});

silenceThreshInput.addEventListener('change', () => {
  const v = round(clamp(silenceThreshInput.value, 0.001, 0.05), 3);
  silenceThreshInput.value  = v;
  settings.silenceThreshold = v;
  saveSettings();
  renderModeBtns();
});

silenceDelayInput.addEventListener('change', () => {
  const v = Math.round(clamp(silenceDelayInput.value, 100, 2000));
  silenceDelayInput.value = v;
  settings.silenceDelay   = v;
  saveSettings();
  renderModeBtns();
});

showOverlayToggle.addEventListener('change', () => {
  settings.showOverlay = showOverlayToggle.checked;
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
    const isActive = mode === settings.activeMode;
    // If already active and modified, restore preset; otherwise switch to mode.
    if (isActive && isPresetModified(mode)) {
      applyPreset(mode);
    } else if (!isActive) {
      applyPreset(mode);
    }
    saveSettings();
    renderSettings();
  });
});

resetBtn.addEventListener('click', () => {
  settings = { ...DEFAULTS };
  saveSettings();
  renderSettings();
});

// ── Event handlers — statistics ───────────────────────────────────────────────

resetStatsBtn.addEventListener('click', () => {
  if (!confirm('Reset all saved-time statistics? This cannot be undone.')) return;

  chrome.runtime.sendMessage({ type: 'RESET_STATS' }, () => {
    renderStats(DEFAULT_STATS);
  });
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

chrome.storage.sync.get(DEFAULTS, (stored) => {
  settings = { ...DEFAULTS, ...stored };
  if (!PRESETS[settings.activeMode]) settings.activeMode = 'balanced';
  renderSettings();
});

chrome.storage.local.get({ savedTime: DEFAULT_STATS }, ({ savedTime }) => {
  renderStats(savedTime);
});
