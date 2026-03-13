# Configuration Reference

User-configurable settings are persisted via `chrome.storage.sync`. They survive browser
restarts, apply immediately to all open tabs via `chrome.storage.onChanged`, and sync across
devices when the user is signed in to Chrome.

Runtime state (current mode, time-saved statistics) is stored separately in
`chrome.storage.local`. See [Storage Schema](#storage-schema) for both namespaces.

## Table of Contents

- [Settings Summary](#settings-summary)
- [enabled](#enabled)
- [normalRate](#normalrate)
- [fastRate](#fastrate)
- [silenceThreshold](#silencethreshold)
- [silenceDelay](#silencedelay)
- [showOverlay](#showoverlay)
- [activeMode](#activemode)
- [excludedDomains](#excludeddomains)
- [Storage Schema](#storage-schema)
- [Resetting to Defaults](#resetting-to-defaults)
- [Resetting Statistics](#resetting-statistics)

## Settings Summary

| Key | Type | Default | Min | Max | Step | Description |
| --- | --- | --- | --- | --- | --- | --- |
| `enabled` | boolean | `true` | — | — | — | Master on/off switch for automatic speed control |
| `normalRate` | number | `1.0` | `0.5` | `2.0` | `0.25` | Playback rate when audio is detected |
| `fastRate` | number | `1.75` | `1.0` | `4.0` | `0.25` | Playback rate during detected silence |
| `silenceThreshold` | number | `0.01` | `0.001` | `0.05` | `0.001` | RMS amplitude below which audio is treated as silent |
| `silenceDelay` | number | `500` | `100` | `2000` | `50` | Milliseconds of continuous silence before speed increases |
| `showOverlay` | boolean | `false` | — | — | — | Show on-video toast notification when fast mode activates |
| `activeMode` | string | `'balanced'` | — | — | — | Selected acceleration mode preset (`'comfort'`, `'balanced'`, or `'turbo'`) |
| `excludedDomains` | string[] | `[]` | — | — | — | Hostnames where the plugin is disabled (e.g. `["www.example.com"]`) |

## enabled

**Type:** boolean
**Default:** `true`

### Purpose

Master switch for the extension. When `false`, the content script stops the analysis loop and
smoothly restores the video to `normalRate`. No audio analysis occurs while the extension is
disabled.

### Effect

- `true` — analysis runs; speed changes automatically based on audio content.
- `false` — analysis stops immediately; any in-progress speed transition is cancelled; the video
  rate is set back to `normalRate`.

### Edge cases

- If the extension is disabled while the video is playing at `fastRate`, the speed returns to
  `normalRate` through the smooth transition algorithm (not an abrupt jump).
- The mode indicator in the popup shows "Disabled" when this value is `false`, regardless of
  the current actual playback rate.

## normalRate

**Type:** number
**Default:** `1.0`
**Range:** 0.5 – 2.0
**Step:** 0.25

### Purpose

The playback speed used when the audio signal is above `silenceThreshold`. This is the speed at
which the user wants to watch content that has speech or music.

### Effect

When the RMS amplitude rises above `silenceThreshold` after a silent period, the content script
calls `setSpeedSmooth(video, normalRate)` to return to this rate.

### Recommended range

- `1.0` — real-time playback (default).
- `1.25` – `1.5` — faster viewing for familiar content while still tracking speech.
- Values below `1.0` slow the video down during speech, which is useful for language learning or
  dense technical content.

### Edge cases

- Setting `normalRate` equal to or greater than `fastRate` is technically allowed but defeats the
  purpose of the extension. The UI does not enforce a relationship between the two values.
- Changes take effect on the next audio analysis tick. If the video is currently playing at
  `normalRate`, the change is applied immediately by the `onChanged` listener.

## fastRate

**Type:** number
**Default:** `1.75`
**Range:** 1.0 – 4.0
**Step:** 0.25

### Purpose

The playback speed applied when silence has been detected for longer than `silenceDelay`. A higher
value skips silent pauses more aggressively.

### Effect

When `RMS < silenceThreshold` persists for `silenceDelay` milliseconds, `setSpeedSmooth(video,
fastRate)` is called.

### Recommended range

- `1.5` – `2.0` — noticeable speedup that is still comfortable if the silence detection triggers
  slightly early (e.g., during a soft-spoken passage).
- `2.0` – `3.0` — aggressive skipping; useful for lecture recordings with long pauses.
- Values above `3.0` may cause the video to advance past short silences before the transition
  completes, making the start of the next sentence feel clipped.

### Edge cases

- Values above `2.0` may interact poorly with low `silenceThreshold` values if the silence
  detector is over-sensitive: the video may jump back and forth at high speed.
- The HTML5 video element technically supports rates up to 16×, but most browsers cap the maximum
  useful rate at 4×–8× before audio becomes incomprehensible.

## silenceThreshold

**Type:** number
**Default:** `0.01`
**Range:** 0.001 – 0.05
**Step:** 0.001

### Purpose

The RMS amplitude floor below which audio is classified as silence. The RMS value is dimensionless
and lies in [0, 1] for typical audio content.

### Effect

On each analysis tick, if `RMS < silenceThreshold`, the silence timer starts (or continues). If
`RMS >= silenceThreshold`, the timer resets and the speed returns to `normalRate`.

### Recommended range

- `0.005` – `0.015` — covers typical pauses between sentences in lecture recordings.
- `0.02` – `0.03` — useful when background noise is present and genuine silences are at a higher
  amplitude than absolute silence.
- Values above `0.03` risk triggering on quiet (not silent) speech, causing false speed-ups during
  soft-spoken passages.

### Edge cases

- Very low values (`< 0.003`) may never trigger on videos with a constant low-level hum or
  background noise floor.
- The threshold applies to the raw RMS of the 256-sample PCM buffer. It is not frequency-weighted
  or A-weighted, so hiss or high-frequency noise counts toward the amplitude measurement.

## silenceDelay

**Type:** number (integer milliseconds)
**Default:** `500`
**Range:** 100 – 2000
**Step:** 50

### Purpose

The minimum duration of continuous silence required before the speed increases to `fastRate`.
This prevents brief micro-pauses (mouth sounds, breath intakes, cut edits) from triggering
unwanted speed changes.

### Effect

The content script records the timestamp when silence is first detected. The speed increases only
when `now - silenceSince >= silenceDelay`. Silence is "broken" (timer reset) as soon as one
analysis tick measures `RMS >= silenceThreshold`.

### Recommended range

- `300` – `500` ms — responsive, covers most natural inter-sentence pauses.
- `600` – `1000` ms — conservative; avoids false triggers during hesitations or slow speech.
- Values above `1000` ms are only useful for content with very long deliberate pauses (e.g.,
  silent films, time-lapses with commentary).

### Edge cases

- The effective minimum latency is `silenceDelay + ANALYSIS_INTERVAL_MS (75 ms)` because silence
  must be confirmed on at least one analysis tick after the delay expires.
- Setting this to `100` ms (minimum) on content with natural speech rhythm can cause the extension
  to flip between `normalRate` and `fastRate` rapidly during pauses between words.

## showOverlay

**Type:** boolean
**Default:** `false`

### Purpose

Controls whether a semi-transparent toast notification is displayed on the video each time the
extension transitions from normal speed to fast speed. The toast provides real-time feedback
showing total session savings at the moment fast mode activates.

### Effect

- `false` — no DOM element is injected into the page; no visual distraction.
- `true` — when `currentMode` transitions to `'fast'`, a fixed-position `<div>` with
  `z-index: 2147483647` is appended to `document.body` showing `⚡ +Xs saved` (where X is the
  total session savings in whole seconds). The toast remains visible for 2 seconds then fades
  out over 0.5 seconds via a CSS `opacity` transition.

### Recommended use

Disabled by default to avoid visual interference with the video player UI. Enable it during
initial setup to verify that the silence detection is working as intended, then disable it for
normal use.

### Edge cases

- If `sessionSaved` rounds to 0 seconds at the time fast mode first activates, the toast is
  suppressed (`if (s <= 0) return`).
- If fast mode activates again before the previous toast has faded out, the previous toast is
  removed immediately and replaced with a new one.
- The toast is injected into the host page's DOM. On sites with strict Content Security Policies
  the injection may be blocked. In that case no error is thrown — the toast is simply absent.
- The toast position (`bottom: 60px; right: 20px`) may overlap with subtitles or player controls
  on some sites. There is no per-site position adjustment in this version.

## activeMode

**Type:** string
**Default:** `'balanced'`
**Allowed values:** `'comfort'` | `'balanced'` | `'turbo'`

### Purpose

Identifies which acceleration mode preset is currently selected. The popup uses this value to
highlight the active button in the segmented control and to detect whether the current slider
values still match the preset.

### Presets

| Mode | `fastRate` | `silenceThreshold` | `silenceDelay` | Intended use |
| --- | --- | --- | --- | --- |
| `'comfort'` | `1.5` | `0.005` | `1000` ms | Lectures, interviews — gentle speedup, long pauses only |
| `'balanced'` | `1.75` | `0.01` | `500` ms | General use — matches the v1.1.0 default behaviour |
| `'turbo'` | `2.25` | `0.02` | `200` ms | Podcasts, streams — aggressive speedup of short pauses |

`normalRate` is always `1.0` regardless of the selected mode.

### Effect

When the user clicks a mode button in the popup, `popup.js` applies the three preset values
(`fastRate`, `silenceThreshold`, `silenceDelay`) to `settings` and writes all four keys
(including `activeMode`) to `chrome.storage.sync` in one `set()` call. The sliders and number
inputs update immediately.

### Modified-preset indicator

After applying a preset, if the user manually adjusts `fastRate`, `silenceThreshold`, or
`silenceDelay`, the active mode button displays a `•` prefix. `activeMode` in storage still holds
the last explicitly selected mode. Clicking the `•`-prefixed button re-applies the preset values,
removing the indicator.

### Edge cases

- If the stored `activeMode` value is not one of the three known modes, `popup.js` falls back to
  `'balanced'` silently.
- `activeMode` is a UI preference. The content script reads `fastRate`, `silenceThreshold`, and
  `silenceDelay` directly and is unaffected by `activeMode`.

## excludedDomains

**Type:** string[] (array of hostname strings)
**Default:** `[]`

### Purpose

A list of hostnames on which the plugin is fully disabled. When the content script initialises on
a page whose `window.location.hostname` is in this array, it skips audio graph setup and analysis
entirely. No audio context is created, no speed changes are made.

### Effect

- If a domain is added while the plugin is running on that tab: `resetSpeed()` and `stopAnalysis()`
  are called immediately via `chrome.storage.onChanged`. The video returns to `normalRate` without
  requiring a page reload.
- If a domain is removed: the plugin does **not** auto-restart on the current page. The user must
  reload the tab. This is intentional — restarting the audio graph mid-session is disruptive.
- Exclusions are stored at hostname granularity (e.g. `"www.youtube.com"` does not exclude
  `"m.youtube.com"`).

### Effect in the popup

The popup reads the active tab URL via `chrome.tabs.query` (requires the `tabs` permission) and
displays the hostname as the label for the exclusion toggle (e.g. "Exclude this site" becomes
`"www.example.com"`). The toggle is hidden when the popup is opened on a non-web page
(`chrome://`, `about:`, `file://` with no hostname).

### Edge cases

- Entries are plain hostname strings — no wildcards, no scheme, no port. The comparison is exact.
- The array grows unboundedly as the user excludes more domains. There is no upper limit enforced
  by the extension; the effective limit is `chrome.storage.sync` quota (about 102 KB total).
- `excludedDomains` syncs across Chrome profiles (like all `chrome.storage.sync` data). Excluding
  a domain on one device excludes it everywhere.

## Storage Schema

### chrome.storage.sync (user settings)

Written and read by `popup.js`. Applied in `content_script.js` via `chrome.storage.onChanged`.

```json
{
  "enabled": true,
  "normalRate": 1.0,
  "fastRate": 1.75,
  "silenceThreshold": 0.01,
  "silenceDelay": 500,
  "showOverlay": false,
  "activeMode": "balanced",
  "excludedDomains": []
}
```

### chrome.storage.local (runtime state)

`currentMode` is written by the content script and read by the popup to update the mode indicator.

`savedTime` is written by the background service worker and read by the popup to display the
statistics section.

```json
{
  "currentMode": "normal",
  "savedTime": {
    "session": 0,
    "today":   0,
    "total":   0,
    "todayDate": "2026-03-12"
  }
}
```

| Field | Description |
| --- | --- |
| `session` | Seconds saved since the current page was loaded. Reset to 0 by `startAnalysis()` when a new video is targeted. |
| `today` | Cumulative seconds saved since the start of the current calendar day (`todayDate`). |
| `total` | Cumulative seconds saved since installation. Only reset by the user via the Reset statistics button. |
| `todayDate` | ISO date string (`YYYY-MM-DD`) of the day when `today` was last reset. Used to detect midnight rollover. |

Neither `currentMode` nor `savedTime` are user-configurable settings; they are not written to
`chrome.storage.sync`.

## Resetting to Defaults

### Via the popup

Click the **Reset to defaults** button at the bottom of the popup. This writes the default values
to `chrome.storage.sync` immediately and re-renders all controls. The change propagates to the
active tab within one storage-change event cycle.

### Via the Chrome DevTools console

Open DevTools on any page, switch to the **Console** tab, and run:

```javascript
chrome.storage.sync.clear(() => console.log('Settings cleared.'));
```

The extension will fall back to its built-in defaults (`DEFAULTS` constant in both
`popup.js` and `content_script.js`) on the next read from storage.

### Via chrome.storage API (from the extensions page)

Open `chrome://extensions`, click the **Service worker** link next to Smart Video Speed to open
DevTools for the background context, and run:

```javascript
chrome.storage.sync.clear();
```

Each extension has its own isolated storage area, so this only affects Smart Video Speed settings.

## Resetting Statistics

### Via the popup

Click the **Reset statistics** button in the Statistics section of the popup. A `confirm()` dialog
asks for confirmation. On confirmation, a `RESET_STATS` message is sent to the background service
worker, which immediately writes zeroed `savedTime` to `chrome.storage.local` and clears the
toolbar badge. The popup updates all three counter rows to `—` via `chrome.storage.onChanged`.

### Via the Chrome DevTools console

Open DevTools on any page (or in the background Service Worker context) and run:

```javascript
chrome.storage.local.set({
  savedTime: { session: 0, today: 0, total: 0, todayDate: new Date().toISOString().slice(0, 10) }
});
```

### Via chrome.storage API (from the extensions page)

To clear only statistics without affecting settings:

```javascript
chrome.storage.local.remove('savedTime');
```

The extension will recreate the `savedTime` key with default values on the next stats update from
the content script.
