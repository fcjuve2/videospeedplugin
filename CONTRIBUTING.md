# Contributing to Smart Video Speed

Thank you for your interest in contributing. This document covers everything needed to set up a
development environment, follow the project's conventions, and submit changes.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Loading the Extension in Chrome](#loading-the-extension-in-chrome)
- [Code Style](#code-style)
- [Generating Icons](#generating-icons)
- [Submitting Changes](#submitting-changes)
- [Reporting Bugs](#reporting-bugs)

## Prerequisites

The extension has **no build step**. All source files are plain JavaScript, HTML, and CSS that
Chrome loads directly.

| Tool | Required | Purpose |
| --- | --- | --- |
| Google Chrome (or Chromium) | Yes | Running and testing the extension |
| Node.js 18+ | Optional | Generating PNG icons via `generate_icons.js` |
| `sharp` npm package | Optional | Required by `generate_icons.js` |
| Git | Yes | Version control |

No bundler, transpiler, or framework is involved. Editing a `.js` or `.css` file and reloading
the extension is sufficient to test a change.

## Loading the Extension in Chrome

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** and select the repository root (the directory containing
   `manifest.json`).
4. The extension is now active. The icon appears in the toolbar.

After editing a source file:

- For popup changes (`popup.html`, `popup.js`, `popup.css`): close and reopen the popup — no
  reload required.
- For content script changes (`content_script.js`): click the **reload** icon on the extensions
  page, then reload any tab where you want to test.
- For manifest changes (`manifest.json`): click **reload** on the extensions page.

## Code Style

The project is written in **vanilla JavaScript** with no frameworks or external runtime
dependencies.

### Language

- Target: **ES2020+** (Chrome's V8 supports all modern features natively).
- No TypeScript, no transpilation, no polyfills.
- Do not introduce framework dependencies (React, Vue, etc.) or utility libraries (lodash, etc.).
  If something can be done in fewer than 50 lines of plain JS, write it in plain JS.

### Formatting

- **Indentation**: 2 spaces, no tabs.
- **Quotes**: single quotes for strings, except in HTML attributes.
- **Semicolons**: always present.
- **Line length**: aim for 100 characters maximum. Longer lines are acceptable inside template
  literals or when splitting would harm readability.
- **Trailing whitespace**: none.
- **Blank lines**: one blank line between logical sections; two blank lines between top-level
  declarations.

### Naming

- Variables and functions: `camelCase`.
- Constants: `UPPER_SNAKE_CASE` for module-level compile-time constants.
- DOM IDs in HTML match the JS variable names (e.g., `id="normalRate"` → `normalRateInput`).

### Comments

- Use JSDoc-style block comments for file-level documentation.
- Use `//` line comments for inline explanation of non-obvious logic.
- Section separators use the style already in the codebase:
  `// ─── Section name ───...` (em-dash, padded to ~80 chars).

### Commit hygiene

- Each commit should represent one logical change.
- Do not commit `console.log` statements added for debugging.
- Do not commit changes to `icons/` unless you are intentionally updating the icon set.

## Generating Icons

Icon PNG files are generated from an SVG source using `generate_icons.js` and the `sharp` image
processing library.

```bash
# Install the dependency (one-time)
npm install sharp

# Regenerate all icon sizes
node generate_icons.js
```

The script produces `icons/icon16.png`, `icons/icon48.png`, and `icons/icon128.png`. Commit the
generated PNGs; do not commit `node_modules/`.

Add a `.gitignore` entry if one does not exist:

```
node_modules/
```

## Submitting Changes

### Branch naming

| Type of change | Branch name pattern |
| --- | --- |
| New feature | `feature/<short-description>` |
| Bug fix | `fix/<short-description>` |
| Documentation | `docs/<short-description>` |
| Refactoring | `refactor/<short-description>` |

Example: `feature/threshold-auto-calibration`, `fix/cors-banner-duplicate`.

### Commit message format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short imperative description>

[Optional body: why this change was made, not what it does]

[Optional footer: references, breaking change notes]
```

Valid types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.

Valid scopes: `content`, `popup`, `manifest`, `icons`, `docs`, `config`.

Examples:

```
feat(content): add threshold auto-calibration based on ambient noise floor

fix(popup): prevent duplicate CORS banner on rapid tab switches

docs(readme): add Chrome Web Store installation section
```

### Pull request checklist

Before opening a pull request, confirm the following:

- [ ] The extension loads without errors in `chrome://extensions`.
- [ ] The feature or fix works on at least one test page with an HTML5 video.
- [ ] No `console.log` debug statements are left in the submitted code.
- [ ] Code follows the style guidelines in this document.
- [ ] The commit message follows the Conventional Commits format.
- [ ] If settings were added or changed, `docs/CONFIGURATION.md` has been updated.
- [ ] If the architecture changed, `docs/ARCHITECTURE.md` has been updated.

## Reporting Bugs

Open a GitHub issue and include the following information:

1. **Chrome version** — from `chrome://version`.
2. **Extension version** — from `chrome://extensions` (currently 1.0.0).
3. **Operating system** — name and version.
4. **URL of the affected page** — or a minimal reproduction if the original is private.
5. **Steps to reproduce** — numbered, specific, starting from a fresh page load.
6. **Expected behavior** — what should happen.
7. **Actual behavior** — what actually happens.
8. **Console output** — open DevTools on the affected tab (`F12`), go to the Console tab, filter
   by `[SmartVideoSpeed]`, and paste any relevant lines.
9. **Does the issue occur on a generic HTML5 video page?** — this helps isolate CORS/DRM issues
   from logic bugs.
