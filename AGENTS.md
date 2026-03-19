# an-dr Chrome Extensions — Agent Guide

## Repo layout

```
an-dr-chrome-ext/
├── AGENTS.md               ← this file
├── README.md               ← user-facing install instructions
├── bootstrap.ps1           ← one-liner bootstrap (clone + install)
├── install.ps1             ← installer (discovers all extensions, opens Chrome)
└── <extension-name>/       ← one folder per extension (see naming below)
    ├── manifest.json
    ├── content.js
    ├── popup.html / popup.js
    ├── styles.css
    └── icon{16,48,128}.png
```

## Extension naming

Folders follow the pattern `an-dr-<scope>`, e.g. `an-dr-jira`, `an-dr-confluence-axis`.

## Mandatory rules

### Version bump
**Every change to any file inside an extension folder must increment the `version` field in that extension's `manifest.json`.**
Use semantic patch bumps (`1.0.0` → `1.0.1`) for fixes, minor bumps for new features.
Chrome only picks up changes after a reload at `chrome://extensions` — the version change signals the user to do so.

### Adding a new extension
1. Create `an-dr-<name>/` with `manifest.json`, `content.js`, `popup.html`, `popup.js`, `styles.css`, icons.
2. Use Manifest V3 (`"manifest_version": 3`).
3. Use `"host_permissions": ["<all_urls>"]` unless the extension is strictly single-site.
4. Generate placeholder icons with the Python snippet in the repo history (16 × 16, 48 × 48, 128 × 128 solid-color PNGs).
5. Add the new extension to the table in `README.md`.

### Storage keys
Prefix all `chrome.storage.sync` keys with `andr_<scope>_`, e.g. `andr_jira_watched_fields`.

### Content script conventions
- Inject dynamic CSS via a `<style id="andr-...-styles">` tag — never rely solely on the static `styles.css` for values that can change (color, toggle state).
- Always listen to `chrome.storage.onChanged` and re-apply state live (no page reload needed).
- Use a debounced `scheduleScan()` + `MutationObserver` for SPA pages.
- Add a `setInterval(scheduleScan, 2000)` re-apply loop for pages where the host app (Jira, Confluence) re-renders and strips injected classes.

## Known DOM structures

### Jira Server / Data Center (jira.se.axis.com, jira.2n.com)
Field layout in the issue detail view:
```html
<div class="wrap">
  <strong class="name">
    <label for="customfield_16820">TeamID (2N):</label>
  </strong>
  <div id="customfield_16820-val" class="value editable-field inactive">
    <!-- value content -->
    <span class="overlay-icon aui-icon aui-iconfont-edit" aria-label="Edit ..."></span>
  </div>
</div>
```
- **Label selector:** `label[for]`
- **Value element:** `document.getElementById(forId + '-val')`
- **Empty check:** get visible text excluding `.overlay-icon` / `.aui-iconfont-edit` spans; match against `/^(none|unassigned|–|-|\s*)$/i`

### Confluence 9.x (confluence.se.axis.com)
Uses the Atlassian Fabric editor. Jira macros appear as extension nodes:
- `[data-macro-name="jira"]`, `[data-extension-key="jira"]`
- Inline smart-links: `a[href*="/browse/"]`
- Issue keys extracted with regex `/\b([A-Z][A-Z0-9]+-\d+)\b/g`
- Titles fetched from Jira REST API: `GET /rest/api/2/issue/{key}?fields=summary` with `credentials: 'include'`

## Current extensions

| Folder | Version | Purpose |
|--------|---------|---------|
| `an-dr-jira/` | see manifest | Highlights watched fields on Jira issue pages; supports Always / Empty-only modes and custom color |
| `an-dr-confluence-axis/` | see manifest | Shows Jira story titles inline on Jira macro widgets in Confluence edit mode |
