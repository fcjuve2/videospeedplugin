# Changelog

All notable changes to Smart Video Speed will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.4.0] - 2026-03-13

### Added

- Manual override pause: when the user changes `playbackRate` via the player controls or keyboard,
  auto-control yields for 10 seconds then resumes automatically.
  - A `ratechange` listener on the video element detects user-initiated speed changes. Events
    fired by the plugin itself are filtered out via an `isPluginChanging` flag, which is set to
    `true` immediately before every plugin write to `video.playbackRate` and cleared 50 ms later.
  - During the pause, the analysis loop returns early each tick — silence detection is frozen but
    the interval is not cancelled, so no re-initialisation is needed on resume.
  - The popup mode indicator shows `⏸ Paused (manual override)` (amber colour) during the pause
    and returns to its previous state (Normal / Fast) when the 10-second timer expires.
  - The override timer resets if the user changes the rate again during the pause window.
  - The previous polling-based external-rate-change detection in `analyseAudio` is replaced by
    this event-driven approach. The old behaviour (permanent `stopAnalysis()` on rate change) is
    gone — auto-control always resumes after 10 s.

## [1.3.0] - 2026-03-13

### Added

- Site exclusion: a per-domain toggle in the popup lets the user disable the plugin on the
  current site without affecting other domains.
  - The label shows the active tab's hostname (e.g. `www.example.com`). Toggling it adds or
    removes the hostname from `excludedDomains`, a string array persisted in
    `chrome.storage.sync` (syncs across Chrome profiles).
  - When exclusion is toggled on while the plugin is running, `resetSpeed()` and `stopAnalysis()`
    are called immediately so the video returns to normal speed without requiring a page reload.
  - The toggle is hidden automatically when the popup is opened on a non-web page (e.g.
    `chrome://` URLs) where `window.location.hostname` is empty.
  - `manifest.json` now declares the `tabs` permission (required by `chrome.tabs.query` to read
    the active tab URL in the popup).

## [1.2.1] - 2026-03-13

### Fixed

- Audible click on playback rate transitions (Normal → Fast and Fast → Normal). Root cause:
  changing `video.playbackRate` causes the browser's internal resampler to reset at the Web Audio
  render-quantum boundary, producing a PCM discontinuity regardless of how gradually the rate is
  interpolated in JavaScript. Fixed by inserting a `GainNode` into the audio graph
  (`sourceNode → gainNode → analyser → destination`) and using `AudioParam.linearRampToValueAtTime`
  to fade gain to 0 over 20 ms before changing `playbackRate`, then restoring gain over 20 ms
  after. The rate change happens while the signal is silent — a physically inaudible 45 ms cycle.
- Time-saved statistics not appearing in the popup (all rows showed `—` despite the badge
  updating correctly). Root cause: `background.js` deferred all writes to `chrome.storage.local`
  by 10 seconds; the popup read from storage immediately on open and always saw stale or empty
  data before the write fired. Fixed by removing the debounce — stats are now written on every
  `UPDATE_STATS` message (~every 5 s), which is the natural cadence of the content script and
  within `chrome.storage.local` write limits. This also resolves the value discrepancy between
  the toolbar badge and the popup counters.
- Plugin continued accumulating time-saved statistics while the video was paused. Root cause:
  the analysis loop had no guard for `video.paused` or `video.ended`; a paused video produces
  zero RMS amplitude, which the silence detector treated as fast-mode silence and incremented the
  counter. Fixed by returning early from `analyseAudio` when the video is paused or ended,
  resetting `silenceSince`, and restoring `playbackRate` to `normalRate` if the plugin had already
  entered fast mode before the pause.

## [1.2.0] - 2026-03-13

### Added

- Acceleration mode selector — a segmented control placed between the mode indicator and the
  settings section, offering three presets:
  - **Comfort** — gentle speedup for lectures and interviews: Fast rate 1.5×, Silence threshold
    0.005, Silence delay 1000 ms.
  - **Balanced** — default behaviour, matches prior v1.1.0 settings: 1.75×, 0.01, 500 ms.
  - **Turbo** — aggressive speedup for podcasts and streams: 2.25×, 0.02, 200 ms.
- `activeMode` setting persisted in `chrome.storage.sync` (`'comfort'` | `'balanced'` | `'turbo'`;
  default: `'balanced'`). Restored from storage when the popup is opened.
- Active mode button is highlighted with its mode colour (green / blue / red).
- Modified-preset indicator: when `fastRate`, `silenceThreshold`, or `silenceDelay` is adjusted
  manually after selecting a mode, the active mode button gains a `•` prefix to signal divergence
  from the preset.
- Clicking an active mode button that shows the `•` indicator restores the original preset values
  for all three parameters.
- `Normal rate` is intentionally excluded from presets — it is always 1.0× across all modes.

### Fixed

- Popup width increased from 300 px to 320 px to prevent slider and number field overflow.
- Slider rows restructured to a flat flex layout: label (120 px fixed, `white-space: nowrap`) →
  range input (`flex: 1; min-width: 0`) → number input (52 px fixed) → unit label. Eliminates
  the range slider overflowing the container and the number field being clipped at the right edge.
- Number input width narrowed from 58 px to 52 px — sufficient for the widest expected value
  (`"2.25"`) without wasting layout space.

### Changed

- `DEFAULTS` in `popup.js` now includes `activeMode: 'balanced'`.
- Slider rows in `popup.html` now use `.setting-row` / `.setting-label` / `.setting-slider` /
  `.setting-value` classes instead of the previous `.row` / `.row-label` / `.row-control` wrapper
  structure.

## [1.1.0] - 2026-03-12

### Added

- Background service worker (`background.js`) to handle cross-context communication between the
  content script and the toolbar badge.
- Time-saved counter with three levels of granularity: current video session, today (resets at
  midnight), and all time since installation.
- Savings accumulation formula applied on every analysis tick while fast mode is active:
  `Δt × (fastRate − normalRate) / fastRate`.
- `chrome.runtime.sendMessage` flow from content script to background every 5 seconds, carrying
  a `delta` value (computed locally to avoid double-counting across service-worker restarts) and
  the current `sessionSaved` total.
- `chrome.storage.local` persistence for statistics under the `savedTime` key
  (`{ session, today, total, todayDate }`), written with a 10-second debounce to limit write
  frequency.
- Automatic daily rollover: if `todayDate` does not match the current date when a stats update
  arrives, the `today` counter resets to zero.
- Toolbar badge showing time saved for the current video session — `"45s"` format below 60 s,
  `"1:23"` format at 60 s and above. Badge updates at most once every 5 seconds.
- Badge colour: green (`#27AE60`) while fast mode is active, grey (`#888888`) otherwise. Badge
  is hidden when no savings have been recorded or the plugin is disabled.
- `showOverlay` setting (default `false`, stored in `chrome.storage.sync`) controlling an optional
  on-video toast notification.
- On-video overlay toast: a semi-transparent fixed element that appears for 2 seconds with a
  0.5 s fade-out transition each time fast mode activates, showing total session savings in the
  format `⚡ +Xs saved`.
- Statistics section in the popup, separated from settings by a horizontal divider, showing
  Current video, Today, and All time values in `M:SS` or `H:MM:SS` format; zero values shown
  as an em dash.
- Show overlay toggle in the popup settings section.
- Reset statistics button in the popup statistics section, guarded by a `confirm()` dialog,
  sending a `RESET_STATS` message to the background service worker.
- Live statistics updates in the popup via `chrome.storage.onChanged` while the popup is open.
- Stats flush in the `beforeunload` handler: any unsent delta is sent synchronously before the
  page tears down.
- `flushStats()` function that sends remaining unsent savings to the background on page unload.

### Changed

- Manifest version bumped to `1.1.0`.
- `manifest.json` now declares `background.service_worker: "background.js"`.
- `startAnalysis()` now resets `sessionSaved`, `lastSentSaved`, and `lastStatsSendTime` to zero
  each time a new video is targeted, ensuring per-video session accuracy.
- `notifyModeChange()` now calls `showSavedToast()` when transitioning to fast mode.
- `beforeunload` handler now calls `flushStats()` before tearing down the audio context.

## [1.0.0] - 2026-03-12

### Added

- Real-time audio analysis using the Web Audio API (`AudioContext`, `MediaElementAudioSourceNode`,
  `AnalyserNode`) to compute RMS amplitude from a 256-sample time-domain buffer.
- Automatic playback speed switching: raises speed to `fastRate` when the RMS amplitude stays
  below `silenceThreshold` for longer than `silenceDelay` milliseconds; returns to `normalRate`
  as soon as audio resumes.
- Smooth speed transitions stepping 0.05× every 50 ms to avoid jarring rate jumps.
- External rate-change detection: auto-control pauses when the user manually adjusts playback
  speed, respecting manual overrides.
- MutationObserver-based video discovery to detect dynamically inserted `<video>` elements in
  single-page applications.
- Largest-visible-video selection heuristic: targets the video element with the greatest rendered
  area when multiple `<video>` elements are present on a page.
- `chrome.storage.sync` persistence for all five user settings (`enabled`, `normalRate`,
  `fastRate`, `silenceThreshold`, `silenceDelay`) — settings survive browser restarts and sync
  across signed-in Chrome instances.
- Popup UI (300 px wide, dark theme) with:
  - Enable/disable toggle switch.
  - Live mode indicator badge showing "Normal speed", "Fast speed", or "Disabled".
  - Slider + number input pairs for `normalRate` and `fastRate`.
  - Number inputs for `silenceThreshold` and `silenceDelay`.
  - "Reset to defaults" button.
- Real-time mode indicator updates while the popup is open via `chrome.storage.onChanged`.
- Settings changes applied to the active tab within one storage-change event cycle.
- Graceful `SecurityError` handling for cross-origin and DRM-protected video sources (YouTube,
  Netflix): audio analysis is skipped and a dismissible banner is shown for six seconds.
- Automatic `AudioContext` resume after browser-initiated suspension (e.g., tab backgrounding,
  user inactivity policy).
- Full cleanup on `beforeunload`: `MutationObserver` disconnected, analysis timers cleared,
  `AudioContext` closed.
- Manifest V3 extension with `storage` and `activeTab` permissions only.
- Content script matched against `https://www.youtube.com/*`, `https://vimeo.com/*`,
  `https://www.netflix.com/*`, and all `https://*/*` and `http://*/*` URLs, injected at
  `document_idle`.
- Icon set at 16×16, 48×48, and 128×128 pixels with a `generate_icons.js` helper script using
  the `sharp` library.
