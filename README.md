# Smart Video Speed

Automatically speeds up silent parts of videos using real-time audio analysis.

![Version](https://img.shields.io/badge/version-1.7.0-blue)
![Manifest](https://img.shields.io/badge/manifest-v3-green)
![License](https://img.shields.io/badge/license-MIT-brightgreen)
![Platform](https://img.shields.io/badge/platform-Chrome-yellow)

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Screenshots / UI](#screenshots--ui)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Platform Support](#platform-support)
- [Performance](#performance)
- [Known Limitations](#known-limitations)
- [Architecture Overview](#architecture-overview)
- [Contributing](#contributing)
- [License](#license)

## Overview

Smart Video Speed solves the problem of wasted time during silent gaps in videos — pauses between
sentences, dead air in lectures, or quiet transitions in screencasts. The extension continuously
analyzes the audio signal of any HTML5 video element using the Web Audio API, and automatically
raises the playback rate when silence is detected for longer than a configurable delay. As soon
as audio resumes, the rate returns to normal — smoothly, without jarring jumps.

## Features

- Real-time audio analysis using the Web Audio API and RMS (Root Mean Square) amplitude measurement
- Automatic speed switching between a configurable normal rate and a configurable fast rate
- Smooth speed transitions via GainNode/AudioParam fade — no audible click when changing rate
- Configurable silence threshold and silence delay before the speed change triggers
- **Acceleration mode selector** — three one-click presets (Comfort / Balanced / Turbo) that set
  Fast rate, Silence threshold, and Silence delay simultaneously; manual adjustments are indicated
  with a `•` marker on the active mode button
- Live mode indicator in the popup — Normal / Fast / Paused (manual override) / Disabled
- Enable/disable toggle that immediately restores normal playback when turned off
- **Seek reset** — scrubbing the video immediately restores normal speed, freezes the silence
  timer for the duration of the seek, and resumes detection cleanly from the new position
- **Site exclusion** — per-domain toggle in the popup to disable the extension on the current
  site; excluded domains are stored in `chrome.storage.sync` and sync across Chrome profiles
- **Manual override pause** — when the user changes playback speed manually, auto-control yields
  for 10 seconds then resumes automatically; popup shows `⏸ Paused (manual override)`
- **Weekly time chart** — compact 7-bar SVG chart in the popup; full chart with Y-axis, date
  labels, and summary cards (This week / Daily average / Best day) on the detailed statistics page
- **Per-site statistics** — options page table (Site / Saved / Sessions / Avg per session),
  sorted by savings, top-3 rows highlighted with gold/silver/bronze accents
- **Video-end notification** — when a video ends with >10 s saved, optionally shows a centered
  on-video toast and/or a system notification with session savings and today's total
- MutationObserver-based video discovery — works with dynamically inserted video elements (SPAs)
- Graceful handling of cross-origin and DRM-protected videos with a non-intrusive banner notice
- Settings persisted via `chrome.storage.sync` — survive browser restarts and sync across devices
- Time-saved counter — tracks how many seconds were saved per video, today, and all time
- Toolbar badge showing accumulated time saved for the current video (updates every 5 seconds)
- Reset-to-defaults and Reset statistics buttons with confirmation dialogs

## Screenshots / UI

No screenshots are included in the repository. The popup is 320 px wide and contains the
following elements, top to bottom:

| Element | Type | Description |
| --- | --- | --- |
| Title | Heading | "Smart Video Speed" displayed at the top left |
| Enable toggle | Toggle switch | Enables or disables automatic speed control |
| Mode indicator | Status badge | Shows "Normal speed", "Fast speed", "⏸ Paused (manual override)", or "Disabled" |
| Acceleration mode selector | Segmented control (3 buttons) | One-click presets: Comfort, Balanced, Turbo. Active mode is highlighted; shows `•` when manually modified |
| Normal rate | Range slider + number input | Sets playback speed during voiced segments (0.5× – 2.0×) |
| Fast rate | Range slider + number input | Sets playback speed during silent segments (1.0× – 4.0×) |
| Silence threshold | Number input | RMS amplitude below which audio is considered silent (0.001 – 0.05) |
| Silence delay | Number input | Milliseconds of continuous silence before switching to fast speed (100 – 2000 ms) |
| Show overlay | Toggle switch | Enables on-video toast when fast mode activates and when the video ends |
| End notification | Toggle switch | Enables a system notification when the video ends (default: off) |
| Exclude this site | Toggle switch (red) | Disables the extension for the current domain |
| Reset to defaults | Button | Restores all settings to their factory values immediately |
| — | Horizontal divider | Visual separator between settings and statistics |
| Time saved — Current video | Read-only value | Seconds saved since the current page was loaded |
| Time saved — Today | Read-only value | Cumulative seconds saved since midnight |
| Time saved — All time | Read-only value | Cumulative seconds saved since installation |
| Weekly chart | SVG bar chart | 7-day history; today's bar highlighted in blue; hover for exact values |
| Detailed statistics | Link | Opens the full statistics page in a new tab |
| Reset statistics | Button | Clears all counters after a confirmation dialog |

## Installation

### From source (Developer mode)

1. Clone or download this repository to your local machine.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked**.
5. Select the `videospeedplugin` directory (the one containing `manifest.json`).
6. The extension icon appears in the Chrome toolbar. Pin it for quick access.

If you modify any source file, click the **reload** icon on the extensions page to pick up the
changes. Content scripts require a page reload on any already-open tab to take effect.

### Production (Chrome Web Store)

The extension has not yet been published to the Chrome Web Store. A store link will be added here
once it is available.

## Usage

1. Navigate to any page that contains an HTML5 video element (YouTube, Vimeo, a local media
   server, a course platform, etc.).
2. Press **Play** on the video.
3. The extension detects the video automatically. No interaction is required.
4. Open the popup by clicking the extension icon to see the current mode and adjust settings.

### Popup controls

| Control | What it does |
| --- | --- |
| Enable toggle | Turn the extension on or off. When off, playback rate is restored to `normalRate`. |
| Acceleration mode | Select a preset (Comfort / Balanced / Turbo) to set Fast rate, Silence threshold, and Silence delay in one click. Clicking the active mode button when it shows `•` restores the preset. |
| Normal rate | The speed used when the video has audible content. Default: 1.0×. |
| Fast rate | The speed used when silence is detected. Default: 1.75×. |
| Silence threshold | RMS amplitude floor. Lower values are more sensitive (detect quieter audio as silence). |
| Silence delay | How long silence must persist before the speed increases. Reduces false triggers. |
| Show overlay | When enabled, an on-video toast appears each time fast mode activates and at video end. Default: off. |
| End notification | When enabled, a system notification appears when the video ends with >10 s saved. Default: off. |
| Exclude this site | Disables the extension on the current domain. Toggle it off to re-enable (requires page reload). |
| Reset to defaults | Restores all settings to their factory values immediately. |
| Reset statistics | Clears all time-saved counters (per-video, today, all time, weekly, per-site) after confirmation. |

Settings take effect in the active tab within milliseconds via `chrome.storage.onChanged`.

### Detailed statistics page

Click **Detailed statistics ›** in the popup to open the full statistics page. It shows:

- A full bar chart of time saved per day for the last 7 days, with Y-axis in minutes and date labels
- Summary cards: This week / Daily average / Best day
- A per-site breakdown table with columns: Site / Saved / Sessions / Avg per session

### Toolbar badge

The extension icon in the Chrome toolbar displays a badge with the time saved for the current
video session:

| State | Badge text | Badge colour |
| --- | --- | --- |
| Plugin disabled or no savings | (empty) | — |
| Savings < 60 s | e.g. `45s` | Grey `#888888` |
| Savings ≥ 60 s | e.g. `1:23` | Green `#27AE60` (when fast) / Grey (when normal) |

The badge updates at most once every 5 seconds to avoid excessive IPC overhead.

## Configuration

All settings are stored in `chrome.storage.sync`. See [docs/CONFIGURATION.md](docs/CONFIGURATION.md)
for the full reference.

| Setting | Default | Range | Description |
| --- | --- | --- | --- |
| `enabled` | `true` | `true` / `false` | Master on/off switch |
| `normalRate` | `1.0` | 0.5 – 2.0 | Playback rate during voiced audio |
| `fastRate` | `1.75` | 1.0 – 4.0 | Playback rate during silence |
| `silenceThreshold` | `0.01` | 0.001 – 0.05 | RMS amplitude threshold for silence detection |
| `silenceDelay` | `500` | 100 – 2000 ms | Silence duration required before speed increase |
| `showOverlay` | `false` | `true` / `false` | Show on-video toast when fast mode activates / video ends |
| `showSystemNotifications` | `false` | `true` / `false` | Send system notification when video ends with >10 s saved |
| `activeMode` | `'balanced'` | `'comfort'` / `'balanced'` / `'turbo'` | Selected acceleration mode preset |
| `excludedDomains` | `[]` | string[] | Hostnames where the extension is disabled |

## Platform Support

| Site | Audio Analysis | Notes |
| --- | --- | --- |
| YouTube | Limited | YouTube serves video from a different origin; CORS restrictions block audio analysis on most streams |
| Vimeo | Limited | Same-origin embeds work; cross-origin embeds are blocked |
| Netflix | Not available | DRM (Widevine) prevents `createMediaElementSource` — a CORS/SecurityError is thrown |
| Generic HTML5 | Full | Any page serving video from the same origin works without restriction |

When audio analysis is blocked, the extension shows a brief banner notification and does not
attempt speed control for that video. Playback continues normally without interference.

## Performance

| Metric | Value |
| --- | --- |
| Analysis interval | 75 ms |
| Speed transition duration | ~45 ms (20 ms gain fade out → rate change → 20 ms gain fade in) |
| Silence detection latency | `silenceDelay` + up to one analysis interval (default ~575 ms) |
| Audio buffer size | 256 samples (fftSize) |
| CPU overhead | Negligible — one `getByteTimeDomainData` call per interval |

The analysis loop uses `setInterval` rather than `requestAnimationFrame` to keep processing
consistent even when the tab is in the background. Speed transitions use `AudioParam.linearRampToValueAtTime`
for sample-accurate gain fading, eliminating the audible click caused by direct `playbackRate`
changes at Web Audio render-quantum boundaries.

## Known Limitations

- Cross-origin and DRM-protected videos cannot be analyzed (YouTube, Netflix). The extension
  falls back silently and shows a one-time banner.
- Only the largest visible video on the page is targeted. Smaller embedded videos are ignored.
- When the user manually changes playback speed, auto-control pauses for 10 seconds then resumes.
  Repeated manual changes each reset the 10-second timer.
- When a domain is removed from the exclusion list, the extension does not restart automatically —
  a page reload is required.
- The `AudioContext` must be created in response to a user gesture in some browser configurations.
  If the context starts in a suspended state, it is resumed automatically on the next analysis tick
  after any user interaction.
- Syncing settings via `chrome.storage.sync` requires the user to be signed in to Chrome when
  using the sync feature across devices. Time-saved statistics are device-local
  (`chrome.storage.local`) and do not sync.
- If the background service worker is terminated by the browser (after ~30 seconds of inactivity)
  and restarts mid-session, at most one 5-second stats batch may be lost. This is an accepted edge
  case with negligible practical impact.
- The on-video overlay toast is injected into the page DOM and may be obscured by the player's
  own UI on some sites.
- System notifications require the `notifications` permission. Chrome may prompt the user to allow
  notifications from the extension on first use.

## Architecture Overview

The extension has three execution contexts: the **content script**, the **background service
worker**, and the **popup**. The content script performs audio analysis, accumulates time-saved
statistics, and handles video lifecycle events (seek, end, manual rate change). Every 5 seconds
it forwards a delta value and metadata (hostname, session flag) to the background service worker
via `chrome.runtime.sendMessage`. The background persists `savedTime`, `weeklyStats`, and
`domainStats` to `chrome.storage.local` on every stats message and updates the toolbar badge.
The popup reads from both `chrome.storage.sync` (settings) and `chrome.storage.local` (statistics,
current mode) on open and reflects live updates via `chrome.storage.onChanged`.

The **detailed statistics page** (`options.html`) is opened in a new tab and reads directly from
`chrome.storage.local`, rendering the full weekly chart and per-site table.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full component diagram, audio pipeline
description, and design decisions.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, code style guidelines, and the
pull-request process.

## License

MIT — see [LICENSE](LICENSE) for details.
