/**
 * Smart Video Speed — Content Script
 * Analyzes video audio in real-time and adjusts playback speed based on silence detection.
 * Accumulates time-saved statistics and forwards them to the background service worker.
 */

const DEFAULTS = {
  enabled: true,
  normalRate: 1.0,
  fastRate: 1.75,
  silenceThreshold: 0.01,
  silenceDelay: 500,
  showOverlay: false,
};

const ANALYSIS_INTERVAL_MS   = 75;
const GAIN_FADE_DURATION_S   = 0.020; // 20 ms gain fade via AudioParam — sample-accurate
const GAIN_SETTLE_MS         = 25;    // wait for gain to reach 0 before changing playbackRate
const STATS_SEND_INTERVAL_MS = 5000;  // send stats to background every 5 s

let settings = { ...DEFAULTS };

// ─── Audio graph state — one AudioContext per page ────────────────────────────

let audioCtx    = null;
let analyser    = null;
let sourceNode  = null;
let gainNode    = null;
let dataBuffer  = null;

// ─── Playback / analysis state ───────────────────────────────────────────────

let currentVideo          = null;
let analysisTimer         = null;
let transitionTimer       = null;
let silenceSince          = null;
let currentMode           = 'normal'; // 'normal' | 'fast'
let lastKnownRate         = null;     // detect external playbackRate changes
let isCrossOriginBlocked  = false;

// ─── Time-saved statistics ────────────────────────────────────────────────────

// SESSION_ID is unique per page load. Background uses it to detect navigations.
// (Not sent in this implementation — delta approach is used instead.)
let sessionSaved     = 0;  // seconds saved this page session
let lastSentSaved    = 0;  // value at last successful sendMessage
let lastStatsSendTime = 0;

// ─── Toast state ──────────────────────────────────────────────────────────────

let toastEl    = null;
let toastTimer = null;

// ─── Settings ────────────────────────────────────────────────────────────────

function loadSettings(callback) {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.sync.get(DEFAULTS, (stored) => {
      settings = { ...DEFAULTS, ...stored };
      callback();
    });
  } else {
    callback();
  }
}

// Listen for settings changes from popup
if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    for (const [key, { newValue }] of Object.entries(changes)) {
      settings[key] = newValue;
    }
    if (!settings.enabled) {
      resetSpeed();
    }
  });
}

// ─── Audio graph ─────────────────────────────────────────────────────────────

function initAudio(video) {
  if (sourceNode && currentVideo === video) return;

  teardownAudio();

  try {
    if (!audioCtx) {
      audioCtx = new AudioContext();
    }

    sourceNode = audioCtx.createMediaElementSource(video);
    gainNode   = audioCtx.createGain();
    analyser   = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    dataBuffer = new Uint8Array(analyser.fftSize);

    sourceNode.connect(gainNode);
    gainNode.connect(analyser);
    analyser.connect(audioCtx.destination);

    currentVideo = video;
    isCrossOriginBlocked = false;

    console.log('[SmartVideoSpeed] Audio graph connected.');
  } catch (err) {
    if (err.name === 'SecurityError') {
      isCrossOriginBlocked = true;
      console.warn('[SmartVideoSpeed] Cross-origin video — audio analysis unavailable.');
      notifyCrossOriginBlocked();
      teardownAudio();
    } else {
      console.error('[SmartVideoSpeed] Audio init error:', err);
      teardownAudio();
    }
  }
}

function teardownAudio() {
  if (gainNode) {
    if (audioCtx) {
      // Cancel scheduled ramps so the AudioParam doesn't linger after disconnect.
      gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
      gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
    }
    try { gainNode.disconnect(); } catch (_) {}
    gainNode = null;
  }
  if (sourceNode) {
    try { sourceNode.disconnect(); } catch (_) {}
    sourceNode = null;
  }
  if (analyser) {
    try { analyser.disconnect(); } catch (_) {}
    analyser = null;
  }
  dataBuffer   = null;
  currentVideo = null;
}

function closeAudioContext() {
  teardownAudio();
  if (audioCtx) {
    audioCtx.close().catch(() => {});
    audioCtx = null;
  }
}

// ─── RMS calculation ─────────────────────────────────────────────────────────

function computeRMS() {
  if (!analyser || !dataBuffer) return 0;

  analyser.getByteTimeDomainData(dataBuffer);

  let sumSq = 0;
  for (let i = 0; i < dataBuffer.length; i++) {
    const normalized = (dataBuffer[i] - 128) / 128; // [-1, 1]
    sumSq += normalized * normalized;
  }
  return Math.sqrt(sumSq / dataBuffer.length);
}

// ─── Speed management ────────────────────────────────────────────────────────

function setSpeedSmooth(video, targetRate) {
  if (transitionTimer) {
    clearTimeout(transitionTimer);
    transitionTimer = null;
  }

  if (Math.abs(video.playbackRate - targetRate) < 0.01) return;

  // Without a running AudioContext, fall back to a direct assignment.
  if (!gainNode || !audioCtx || audioCtx.state !== 'running') {
    video.playbackRate = targetRate;
    lastKnownRate      = targetRate;
    return;
  }

  // Fade gain to 0 using AudioParam scheduling (sample-accurate, no click).
  const gain = gainNode.gain;
  const now  = audioCtx.currentTime;
  gain.cancelScheduledValues(now);
  gain.setValueAtTime(gain.value, now);
  gain.linearRampToValueAtTime(0, now + GAIN_FADE_DURATION_S);

  // Once the gain has reached 0, change playbackRate and restore gain.
  transitionTimer = setTimeout(() => {
    transitionTimer = null;
    if (!gainNode || !audioCtx) return; // teardown raced the timer

    video.playbackRate = targetRate;
    lastKnownRate      = targetRate;

    const t = audioCtx.currentTime;
    gainNode.gain.cancelScheduledValues(t);
    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(1, t + GAIN_FADE_DURATION_S);
  }, GAIN_SETTLE_MS);
}

function resetSpeed() {
  if (currentVideo) {
    setSpeedSmooth(currentVideo, settings.normalRate);
  }
  silenceSince = null;
  currentMode  = 'normal';
}

// ─── Time-saved accumulation ─────────────────────────────────────────────────

/**
 * Forwards accumulated stats to background.
 * Called from within the analysis loop — no separate timer needed.
 * Sends at most once every STATS_SEND_INTERVAL_MS.
 */
function maybeSendStats() {
  const now = Date.now();
  if (now - lastStatsSendTime < STATS_SEND_INTERVAL_MS) return;
  lastStatsSendTime = now;

  const delta = sessionSaved - lastSentSaved;
  lastSentSaved = sessionSaved;

  chrome.runtime.sendMessage({
    type: 'UPDATE_STATS',
    sessionSaved,
    delta,
    isFast: currentMode === 'fast',
  }).catch(() => {
    // Service worker may be sleeping — it will wake on next message.
    // lastSentSaved was already updated, so the delta is carried forward.
    lastSentSaved -= delta; // revert so the unsent delta is retried next tick
  });
}

/** Flush remaining unsent savings before the page unloads. */
function flushStats() {
  const delta = sessionSaved - lastSentSaved;
  if (delta <= 0) return;
  lastSentSaved = sessionSaved;

  chrome.runtime.sendMessage({
    type: 'UPDATE_STATS',
    sessionSaved,
    delta,
    isFast: false,
  }).catch(() => {});
}

// ─── Overlay toast ────────────────────────────────────────────────────────────

function showSavedToast(seconds) {
  if (!settings.showOverlay) return;
  if (!currentVideo) return;

  const s = Math.floor(seconds);
  if (s <= 0) return;

  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  if (toastEl) {
    toastEl.remove();
    toastEl = null;
  }

  toastEl = document.createElement('div');
  toastEl.id = 'svs-toast';
  toastEl.style.cssText = `
    position: fixed; bottom: 60px; right: 20px; z-index: 2147483647;
    background: rgba(0,0,0,0.72); color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 13px; font-weight: 500;
    padding: 8px 14px; border-radius: 6px;
    pointer-events: none;
    opacity: 1; transition: opacity 0.5s ease;
  `;
  toastEl.textContent = `\u26A1 +${s}s saved`;
  document.body.appendChild(toastEl);

  toastTimer = setTimeout(() => {
    if (toastEl) {
      toastEl.style.opacity = '0';
      setTimeout(() => { toastEl?.remove(); toastEl = null; }, 500);
    }
    toastTimer = null;
  }, 2000);
}

// ─── Analysis loop ───────────────────────────────────────────────────────────

function analyseAudio() {
  if (!settings.enabled || !currentVideo || isCrossOriginBlocked) return;

  // While paused or ended: hold state, never accumulate savings.
  if (currentVideo.paused || currentVideo.ended) {
    silenceSince = null;
    if (currentMode === 'fast') {
      currentMode = 'normal';
      currentVideo.playbackRate = settings.normalRate;
      lastKnownRate = settings.normalRate;
      notifyModeChange('normal');
    }
    return;
  }

  // Resume suspended context (browsers suspend after user inactivity)
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  // Detect external playbackRate change — user took manual control
  if (lastKnownRate !== null && Math.abs(currentVideo.playbackRate - lastKnownRate) > 0.05) {
    console.log('[SmartVideoSpeed] External rate change detected — pausing auto-control.');
    stopAnalysis();
    return;
  }

  const rms = computeRMS();
  const now = Date.now();

  if (rms < settings.silenceThreshold) {
    if (silenceSince === null) silenceSince = now;

    if (now - silenceSince >= settings.silenceDelay && currentMode !== 'fast') {
      currentMode = 'fast';
      setSpeedSmooth(currentVideo, settings.fastRate);
      notifyModeChange('fast');
    }
  } else {
    silenceSince = null;

    if (currentMode !== 'normal') {
      currentMode = 'normal';
      setSpeedSmooth(currentVideo, settings.normalRate);
      notifyModeChange('normal');
    }
  }

  // Accumulate savings while in fast mode.
  // Formula: Δt × (fastRate − normalRate) / fastRate
  if (currentMode === 'fast') {
    sessionSaved +=
      (ANALYSIS_INTERVAL_MS / 1000) *
      (settings.fastRate - settings.normalRate) /
      settings.fastRate;
  }

  maybeSendStats();
}

function startAnalysis(video) {
  stopAnalysis();

  // Reset per-session stats for this video
  sessionSaved      = 0;
  lastSentSaved     = 0;
  lastStatsSendTime = 0;

  initAudio(video);
  if (isCrossOriginBlocked) return;

  lastKnownRate = video.playbackRate;
  analysisTimer = setInterval(analyseAudio, ANALYSIS_INTERVAL_MS);
  console.log('[SmartVideoSpeed] Analysis started.');
}

function stopAnalysis() {
  if (analysisTimer) {
    clearInterval(analysisTimer);
    analysisTimer = null;
  }
  if (transitionTimer) {
    clearTimeout(transitionTimer);
    transitionTimer = null;
  }
  silenceSince = null;
}

// ─── Notifications ───────────────────────────────────────────────────────────

function notifyCrossOriginBlocked() {
  const banner = document.createElement('div');
  banner.id = 'svs-cors-notice';
  banner.style.cssText = `
    position: fixed; top: 16px; right: 16px; z-index: 2147483647;
    background: #1a1a2e; color: #e0e0e0; font-family: sans-serif; font-size: 13px;
    padding: 12px 16px; border-radius: 8px; max-width: 320px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.5); border-left: 4px solid #e74c3c;
  `;
  banner.textContent =
    'Smart Video Speed: audio analysis unavailable on this site due to cross-origin restrictions.';

  const close = document.createElement('span');
  close.textContent  = ' \u2715';
  close.style.cursor = 'pointer';
  close.onclick = () => banner.remove();
  banner.appendChild(close);

  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 6000);
}

function notifyModeChange(mode) {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.set({ currentMode: mode }).catch(() => {});
  }
  if (mode === 'fast') {
    showSavedToast(sessionSaved);
  }
}

// ─── Video discovery ─────────────────────────────────────────────────────────

function findPrimaryVideo() {
  const videos = Array.from(document.querySelectorAll('video'));
  if (!videos.length) return null;

  // Prefer the largest visible video (likely the main player)
  return videos.reduce((best, v) => {
    const area     = v.offsetWidth * v.offsetHeight;
    const bestArea = best ? best.offsetWidth * best.offsetHeight : 0;
    return area > bestArea ? v : best;
  }, null);
}

function handleVideoFound(video) {
  if (!settings.enabled) return;
  if (video === currentVideo) return;

  console.log('[SmartVideoSpeed] Video element found.');
  startAnalysis(video);
}

// ─── MutationObserver ────────────────────────────────────────────────────────

const observer = new MutationObserver(() => {
  const video = findPrimaryVideo();
  if (video && video !== currentVideo) {
    handleVideoFound(video);
  }
});

observer.observe(document.documentElement, { childList: true, subtree: true });

// ─── Initialisation ───────────────────────────────────────────────────────────

loadSettings(() => {
  const video = findPrimaryVideo();
  if (video) handleVideoFound(video);
});

// ─── Cleanup on page unload ──────────────────────────────────────────────────

window.addEventListener('beforeunload', () => {
  observer.disconnect();
  flushStats();
  stopAnalysis();
  closeAudioContext();
});
