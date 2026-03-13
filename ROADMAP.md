# Roadmap

Planned features in priority order. Each item links to the relevant spec below.

| # | Feature | Scope |
|---|---------|-------|
| 1 | ~~[Seek reset](#1-seek-reset)~~ ✓ | `content_script.js` |
| 2 | ~~[Site exclusion](#2-site-exclusion)~~ ✓ | all files |
| 3 | ~~[Manual override pause](#3-manual-override-pause)~~ ✓ | `content_script.js`, `popup.js` |
| 4 | ~~[Weekly time chart](#4-weekly-time-chart)~~ ✓ | `popup.*`, `options.*`, `background.js` |
| 5 | ~~[Per-site statistics](#5-per-site-statistics)~~ ✓ | `background.js`, `options.*` |
| 6 | ~~[Video-end notification](#6-video-end-notification)~~ ✓ | `content_script.js`, `background.js`, `popup.*` |

---

## 1. Seek reset

**Files:** `content_script.js`

Reset internal state when the user scrubs the video so that silence detection starts fresh at the
new position.

**Behaviour**
- `seeking` event: set `playbackRate = normalRate`, pause analysis iterations (`isSeeking = true`).
- `seeked` event: reset `silenceSince = null`, resume analysis (`isSeeking = false`).
- Selected acceleration mode (Comfort / Balanced / Turbo) is not affected.
- No-op when the plugin is disabled (`enabled = false`).

---

## 2. Site exclusion

**Files:** `popup.html`, `popup.js`, `background.js`, `content_script.js`

Let the user disable the plugin for the current domain directly from the popup.

**Behaviour**
- Popup shows a row "Disable on [domain.com]" with a toggle, visually separated from the main
  On/Off toggle (red label).
- Domain resolved from the active tab URL via `chrome.tabs.query`.
- Excluded domains stored in `chrome.storage.sync` under key `excludedDomains: string[]`.
- On page load, `content_script.js` checks the current hostname against `excludedDomains` and
  skips initialisation if matched.
- Adding a domain: immediately sets `playbackRate = 1.0` and stops analysis without page reload.
- Removing a domain: re-initialises the plugin on the current tab.

---

## 3. Manual override pause

**Files:** `content_script.js`, `popup.js`

When the user manually changes playback speed via the player controls, yield control for 10
seconds instead of immediately overwriting the rate.

**Behaviour**
- Subscribe to `ratechange` on the video element.
- Ignore events fired while `isPluginChanging = true` (set before every plugin-initiated write,
  cleared 50 ms after).
- On a user-initiated `ratechange`: enter a 10-second pause — stop overwriting `playbackRate`.
- After 10 seconds: resume normal operation automatically.
- Popup mode indicator shows `⏸ Paused (manual override)` during the pause.

---

## 4. Weekly time chart

**Files:** `popup.html`, `popup.js`, `popup.css`, `background.js`, `options.html`, `options.js`,
`manifest.json`

Bar chart of time saved per day for the last 7 days.

**Storage** — `chrome.storage.local` key `weeklyStats`:
```json
[
  { "date": "2026-03-07", "savedSeconds": 142 },
  { "date": "2026-03-08", "savedSeconds": 87 }
]
```
Always exactly 7 entries; oldest entry dropped when a new day is added.

**Compact view (popup)** — placed below the three stats rows; 60 px tall, full width; 7 columns
with day-of-week labels; today's column accented (`#2E75B6`); hover tooltip shows exact value;
implemented in SVG or Canvas, no external libraries.

**Full view (options page)** — opened via "Detailed statistics" link in popup; 300 px tall chart;
adds weekly total, daily average, best day; Y-axis in minutes, X-axis with full dates.

---

## 5. Per-site statistics

**Files:** `content_script.js`, `background.js`, `options.html`, `options.js`

Table showing time saved broken down by domain.

**Storage** — `chrome.storage.local` key `domainStats`:
```json
{
  "youtube.com": { "savedSeconds": 3842, "sessions": 47 },
  "vimeo.com":   { "savedSeconds": 612,  "sessions": 8  }
}
```
Domain captured in `content_script.js` via `window.location.hostname` (without `www.`) and
included in every `UPDATE_STATS` message.

**Display** — options page only; columns: Site / Saved / Sessions / Avg per session; sorted by
saved time descending; top 3 rows visually highlighted; "Clear site statistics" button with
confirmation.

---

## 6. Video-end notification

**Files:** `content_script.js`, `background.js`, `popup.html`, `popup.js`, `manifest.json`

Notify the user of total time saved when a video finishes. Requires `> 10 s` saved to avoid
noise on short clips.

**On-video toast** — centred over the player, 4-second display, 0.4 s fade; text:
`Smart Video Speed saved X min Y sec on this video ⚡`; click to dismiss early; controlled by
existing `showOverlay` setting.

**System notification** — sent via `chrome.notifications.create` from `background.js`; title:
`Smart Video Speed`; body: `Saved X min Y sec on last video. Today total: Z min.`; extension icon
used; controlled by new `showSystemNotifications` toggle (default off); permission requested on
first enable.

**New manifest permission:** `notifications`
