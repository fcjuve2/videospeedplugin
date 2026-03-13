# Smart Video Speed

Automatically speeds up silent parts of videos using real-time audio analysis.

![Version](https://img.shields.io/badge/version-1.2.0-blue)
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
- Smooth speed transitions — no abrupt jumps in playback rate
- Configurable silence threshold and silence delay before the speed change triggers
- **Acceleration mode selector** — three one-click presets (Comfort / Balanced / Turbo) that set
  Fast rate, Silence threshold, and Silence delay simultaneously; manual adjustments are allowed
  at any time and are indicated with a `•` marker on the active mode button
- Live mode indicator in the popup showing whether the current video is playing at normal or fast speed
- Enable/disable toggle that immediately restores normal playback when turned off
- External rate-change detection: if the user manually adjusts speed, auto-control pauses
- MutationObserver-based video discovery — works with dynamically inserted video elements (SPAs)
- Graceful handling of cross-origin and DRM-protected videos with a non-intrusive banner notice
- Settings persisted via `chrome.storage.sync` — survive browser restarts and sync across devices
- Reset-to-defaults button in the popup
- **Time-saved counter** — tracks how many seconds were saved per video, today, and all time
- Toolbar badge showing accumulated time saved for the current video (updates every 5 seconds)
- Optional on-video overlay toast displayed each time fast mode activates, showing total session savings
- Statistics section in the popup with per-video, daily, and all-time totals
- Reset statistics button with confirmation dialog

## Screenshots / UI

No screenshots are included in the repository. The popup is 320 px wide and contains the
following elements, top to bottom:

| Element | Type | Description |
| --- | --- | --- |
| Title | Heading | "Smart Video Speed" displayed at the top left |
| Enable toggle | Checkbox / toggle switch | Enables or disables automatic speed control |
| Mode indicator | Status badge | Shows "Normal speed", "Fast speed", or "Disabled"; pulses green when fast |
| Acceleration mode selector | Segmented control (3 buttons) | One-click presets: Comfort, Balanced, Turbo. Active mode is highlighted; shows • when manually modified |
| Normal rate | Range slider + number input | Sets playback speed during voiced segments (0.5× – 2.0×) |
| Fast rate | Range slider + number input | Sets playback speed during silent segments (1.0× – 4.0×) |
| Silence threshold | Number input | RMS amplitude below which audio is considered silent (0.001 – 0.05) |
| Silence delay | Number input | Milliseconds of continuous silence before switching to fast speed (100 – 2000 ms) |
| Show overlay | Toggle switch | Enables an on-video toast notification each time fast mode activates |
| Reset to defaults | Button | Restores all settings to their factory values |
| — | Horizontal divider | Visual separator between settings and statistics |
| Time saved — Current video | Read-only value | Seconds saved since the current page was loaded |
| Time saved — Today | Read-only value | Cumulative seconds saved since midnight |
| Time saved — All time | Read-only value | Cumulative seconds saved since installation |
| Reset statistics | Button | Clears all three counters after a confirmation dialog |

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
| Acceleration mode | Select a preset (Comfort / Balanced / Turbo) to set Fast rate, Silence threshold, and Silence delay in one click. Clicking the active mode button when it shows • restores the preset. |
| Normal rate | The speed used when the video has audible content. Default: 1.0×. |
| Fast rate | The speed used when silence is detected. Default: 1.75×. |
| Silence threshold | RMS amplitude floor. Lower values are more sensitive (detect quieter audio as silence). |
| Silence delay | How long silence must persist before the speed increases. Reduces false triggers. |
| Show overlay | When enabled, a small toast appears on the video each time fast mode activates. Default: off. |
| Reset to defaults | Restores all settings to their factory values immediately. |
| Reset statistics | Clears all time-saved counters (per-video, today, all time) after confirmation. |

Settings take effect in the active tab within milliseconds via `chrome.storage.onChanged`.

### Toolbar badge

The extension icon in the Chrome toolbar displays a badge with the time saved for the current
video session:

| State | Badge text | Badge colour |
| --- | --- | --- |
| Plugin disabled | (empty) | — |
| No savings yet | (empty) | — |
| Savings < 60 s | e.g. `45s` | Grey `#888888` |
| Savings ≥ 60 s | e.g. `1:23` | Green `#27AE60` |
| Fast mode active right now | current value | Green `#27AE60` |

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
| `showOverlay` | `false` | `true` / `false` | Show on-video toast when fast mode activates |
| `activeMode` | `'balanced'` | `'comfort'` / `'balanced'` / `'turbo'` | Selected acceleration mode preset |

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
| Speed transition duration | 150 ms (`requestAnimationFrame` linear ramp, ~9 frames at 60 fps) |
| Silence detection latency | `silenceDelay` + up to one analysis interval (default ~575 ms) |
| Audio buffer size | 256 samples (fftSize) |
| CPU overhead | Negligible — one `getByteTimeDomainData` call per interval |

The analysis loop uses `setInterval` rather than `requestAnimationFrame` to keep processing
decoupled from the rendering pipeline and to ensure consistent timing even when the tab is in the
background. Speed transitions use `requestAnimationFrame` for frame-accurate interpolation of
`playbackRate`, eliminating the audible click caused by discrete rate steps.

## Known Limitations

- Cross-origin and DRM-protected videos cannot be analyzed (YouTube, Netflix). The extension falls
  back silently and shows a one-time banner.
- Only the largest visible video on the page is targeted. Smaller embedded videos are ignored.
- If the user manually changes playback speed (via the video controls or a keyboard shortcut),
  the extension detects the external rate change and stops automatic control for the remainder of
  the page session.
- The `AudioContext` must be created in response to a user gesture in some browser configurations.
  If the context starts in a suspended state, it is resumed automatically on the next analysis tick
  after any user interaction.
- Syncing settings via `chrome.storage.sync` requires the user to be signed in to Chrome when
  using the sync feature across devices.
- Time-saved statistics are device-local (`chrome.storage.local`) and do not sync across Chrome
  instances.
- If the background service worker is terminated by the browser (after ~30 seconds of inactivity)
  and restarts mid-session, at most one 5-second stats batch may be double-counted. This is an
  accepted edge case with negligible practical impact.
- The on-video overlay toast is injected into the page DOM and may be obscured by the player's
  own UI on some sites.

## Architecture Overview

The extension has three execution contexts: the **content script**, the **background service
worker**, and the **popup**. The content script performs audio analysis and accumulates time-saved
statistics. Every 5 seconds it forwards a delta value to the background service worker via
`chrome.runtime.sendMessage`. The background persists the counters to `chrome.storage.local` with
on every stats message and updates the toolbar badge. The popup reads from both `chrome.storage.sync`
(settings) and `chrome.storage.local` (statistics, current mode) on open and reflects live updates
via `chrome.storage.onChanged`.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full component diagram, audio pipeline
description, and design decisions.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, code style guidelines, and the
pull-request process.

## License

MIT — see [LICENSE](LICENSE) for details.
