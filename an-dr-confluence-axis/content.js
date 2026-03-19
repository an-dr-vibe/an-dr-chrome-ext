// an-dr: Confluence Axis - Content Script
// Overlays Jira titles over macro widgets using fixed-position elements
// in the MAIN document — TinyMCE never touches them.

const KEY_JIRA_URL    = 'andr_confluence_jira_url';
const KEY_ENABLED     = 'andr_confluence_enabled';
const KEY_SHOW_STATUS = 'andr_confluence_show_status';
const KEY_BADGE_POS      = 'andr_confluence_badge_pos';
const KEY_HIDE_ON_CURSOR = 'andr_confluence_hide_on_cursor';
const DEFAULT_URL     = 'https://jira.se.axis.com';
const ISSUE_KEY_RE    = /\b([A-Z][A-Z0-9]+-\d+)\b/g;
const LABEL_ATTR      = 'data-andr-title';

let jiraBaseUrl  = DEFAULT_URL;
let enabled      = true;
let showStatus   = false;
let badgePos      = 'right'; // 'right' | 'left' | 'above' | 'below'
let hideOnCursor  = false;
let scanning      = false;
let scanQueued   = false;

const cache = new Map(); // `${baseUrl}/${key}` → { title, status } | null

// ── Storage ───────────────────────────────────────────────────────────────────

function loadConfig(cb) {
  chrome.storage.sync.get([KEY_JIRA_URL, KEY_ENABLED, KEY_SHOW_STATUS, KEY_BADGE_POS, KEY_HIDE_ON_CURSOR], (r) => {
    jiraBaseUrl   = (r[KEY_JIRA_URL] || DEFAULT_URL).replace(/\/$/, '');
    enabled       = r[KEY_ENABLED] !== false;
    showStatus    = r[KEY_SHOW_STATUS] === true;
    badgePos      = r[KEY_BADGE_POS] || 'right';
    hideOnCursor  = r[KEY_HIDE_ON_CURSOR] === true;
    cb();
  });
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes[KEY_JIRA_URL])       { jiraBaseUrl  = (changes[KEY_JIRA_URL].newValue || DEFAULT_URL).replace(/\/$/, ''); cache.clear(); }
  if (changes[KEY_ENABLED])        { enabled      = changes[KEY_ENABLED].newValue !== false; }
  if (changes[KEY_SHOW_STATUS])    { showStatus   = changes[KEY_SHOW_STATUS].newValue === true; }
  if (changes[KEY_BADGE_POS])      { badgePos     = changes[KEY_BADGE_POS].newValue || 'right'; }
  if (changes[KEY_HIDE_ON_CURSOR]) { hideOnCursor = changes[KEY_HIDE_ON_CURSOR].newValue === true; updateCursorHiding(); return; }
  requestScan();
});

// ── Editor iframe ─────────────────────────────────────────────────────────────

function getIframe() {
  return document.querySelector('iframe[id$="_ifr"], iframe.mce-content-body');
}

function getEditorDoc() {
  const f = getIframe();
  return (f?.contentDocument?.body) ? f.contentDocument : null;
}

// ── Jira API (via background service worker — no CORS issues) ─────────────────

function fetchIssue(issueKey, baseUrl) {
  const key = `${baseUrl}/${issueKey}`;
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ action: 'fetchJiraTitle', issueKey, baseUrl }, (r) => {
      const entry = r?.title ? { title: r.title, status: r.status ?? null } : null;
      cache.set(key, entry);
      resolve(entry);
    });
  });
}

// ── Overlay container — lives in the main document, outside the iframe ────────

let overlayContainer = null;

function getOverlayContainer() {
  if (overlayContainer?.isConnected) return overlayContainer;
  overlayContainer = document.createElement('div');
  overlayContainer.id = 'andr-confluence-overlays';
  overlayContainer.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:2147483647;';
  document.body.appendChild(overlayContainer);

  // Inject badge styles into main document
  if (!document.getElementById('andr-confluence-styles')) {
    const s = document.createElement('style');
    s.id = 'andr-confluence-styles';
    s.textContent = `
      .andr-confluence-label {
        position: fixed;
        background: #0052cc;
        color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 11px;
        font-weight: 600;
        line-height: 1;
        padding: 3px 8px;
        border-radius: 10px;
        pointer-events: none;
        user-select: none;
        white-space: nowrap;
        max-width: 400px;
        overflow: hidden;
        text-overflow: ellipsis;
        box-shadow: 0 1px 4px rgba(0,0,0,0.2);
      }
    `;
    document.head.appendChild(s);
  }
  return overlayContainer;
}

function removeOverlays() {
  overlayContainer?.querySelectorAll(`[${LABEL_ATTR}]`).forEach(el => el.remove());
}

// ── Positioning ───────────────────────────────────────────────────────────────

// Returns {top, left?, right?} in viewport px. Use right instead of left for 'left' mode.
function getBadgePos(img) {
  const iframe = getIframe();
  if (!iframe) return null;
  const fr  = iframe.getBoundingClientRect();
  const ir  = img.getBoundingClientRect(); // relative to iframe viewport
  const midV = fr.top + ir.top + (ir.height - 20) / 2;
  switch (badgePos) {
    case 'above': return { top: fr.top + ir.top - 26,       left: fr.left + ir.left };
    case 'below': return { top: fr.top + ir.bottom + 4,     left: fr.left + ir.left };
    case 'left':  return { top: midV, right: window.innerWidth - (fr.left + ir.left) + 6 };
    default:      return { top: midV, left:  fr.left + ir.right + 6 };
  }
}

function applyPos(badge, pos) {
  badge.style.top   = pos.top   + 'px';
  badge.style.left  = pos.left  != null ? pos.left  + 'px' : '';
  badge.style.right = pos.right != null ? pos.right + 'px' : '';
}

function repositionAll() {
  const ed = getEditorDoc();
  if (!ed) return;
  overlayContainer?.querySelectorAll(`[${LABEL_ATTR}]`).forEach(badge => {
    const macroId = badge.getAttribute('data-andr-macro-id');
    const img = macroId ? ed.querySelector(`img[data-macro-id="${macroId}"]`) : null;
    if (!img) return;
    const pos = getBadgePos(img);
    if (pos) applyPos(badge, pos);
  });
}

// ── Cursor-line hiding ────────────────────────────────────────────────────────

function updateCursorHiding() {
  if (!overlayContainer) return;
  const ed = getEditorDoc();
  if (!ed) return;

  let cursorTop = null, cursorBottom = null;

  if (hideOnCursor) {
    const sel = ed.defaultView?.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      // getClientRects() works for collapsed carets; getBoundingClientRect() may return zero rect
      const rects = Array.from(range.getClientRects());
      const r = rects[0] ?? (
        range.startContainer.nodeType !== Node.TEXT_NODE
          ? range.startContainer.getBoundingClientRect?.()
          : range.startContainer.parentElement?.getBoundingClientRect()
      );
      if (r && r.height > 0) { cursorTop = r.top; cursorBottom = r.bottom; }
    }
  }

  overlayContainer.querySelectorAll(`[${LABEL_ATTR}]`).forEach(badge => {
    if (!hideOnCursor || cursorTop === null) { badge.style.display = ''; return; }
    const macroId = badge.getAttribute('data-andr-macro-id');
    const img = macroId ? ed.querySelector(`img[data-macro-id="${macroId}"]`) : null;
    if (!img) { badge.style.display = ''; return; }
    const ir = img.getBoundingClientRect(); // iframe-relative coords
    badge.style.display = (cursorTop < ir.bottom && cursorBottom > ir.top) ? 'none' : '';
  });
}

// ── Widget discovery ──────────────────────────────────────────────────────────

function extractKeys(str) {
  return [...new Set([...str.matchAll(ISSUE_KEY_RE)].map(m => m[1]))];
}

function findWidgets(ed) {
  const widgets = [];
  ed.querySelectorAll('img[data-macro-name="jira"], img.editor-inline-macro[data-macro-parameters]')
    .forEach(img => {
      const m = (img.getAttribute('data-macro-parameters') || '').match(/(?:^|\|)key=([A-Z][A-Z0-9]+-\d+)/i);
      if (m) widgets.push({ el: img, key: m[1], macroId: img.getAttribute('data-macro-id') || '' });
    });
  return widgets;
}

// ── Scan ──────────────────────────────────────────────────────────────────────

function requestScan() {
  if (scanning) { scanQueued = true; return; }
  scan();
}

async function scan() {
  scanning   = true;
  scanQueued = false;

  try {
    removeOverlays();
    if (!enabled) return;

    const ed = getEditorDoc();
    if (!ed) return;

    const widgets = findWidgets(ed);
    if (!widgets.length) { console.log('[an-dr: Confluence] no Jira widgets found'); return; }

    const baseUrl = jiraBaseUrl;
    const allKeys = [...new Set(widgets.map(w => w.key))];
    console.log('[an-dr: Confluence] fetching', allKeys.length, 'issue(s) from', baseUrl);
    await Promise.all(allKeys.map(k => fetchIssue(k, baseUrl)));

    const container = getOverlayContainer();
    let n = 0;
    widgets.forEach(({ el, key, macroId }) => {
      const entry = cache.get(`${baseUrl}/${key}`);
      if (!entry) return;

      const pos = getBadgePos(el);
      if (!pos) return;

      const statusPrefix = (showStatus && entry.status) ? `[${entry.status}] ` : '';
      const badge = document.createElement('span');
      badge.className = 'andr-confluence-label';
      badge.setAttribute(LABEL_ATTR, key);
      badge.setAttribute('data-andr-macro-id', macroId);
      badge.textContent = `${statusPrefix}${key}: ${entry.title}`;
      applyPos(badge, pos);
      container.appendChild(badge);
      n++;
    });
    console.log(`[an-dr: Confluence] showed ${n} badge(s)`);
    updateCursorHiding();

  } finally {
    scanning = false;
    if (scanQueued) scan();
  }
}

// ── Reposition on scroll / resize ─────────────────────────────────────────────

window.addEventListener('scroll',  repositionAll, { passive: true });
window.addEventListener('resize',  repositionAll, { passive: true });

// ── Watch for iframe, observe editor changes ──────────────────────────────────

const iframePoller = setInterval(() => {
  const ed = getEditorDoc();
  if (ed && !ed._andrObserved) {
    ed._andrObserved = true;
    clearInterval(iframePoller);

    // Reposition when editor scrolls
    ed.defaultView?.addEventListener('scroll', repositionAll, { passive: true });

    // Hide badges when cursor is on same line
    ed.addEventListener('selectionchange', updateCursorHiding);

    // Re-scan when editor content changes
    new MutationObserver(() => requestScan())
      .observe(ed.body, { childList: true, subtree: true });

    requestScan();
  }
}, 500);

// ── Init ──────────────────────────────────────────────────────────────────────

console.log('[an-dr: Confluence] loaded on', location.hostname);
loadConfig(() => requestScan());
