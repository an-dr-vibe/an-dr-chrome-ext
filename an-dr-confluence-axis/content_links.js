// an-dr: Link Status - Content Script
// Shows Jira issue status chips next to Jira links on any page.

const KEY_JIRA_URL        = 'andr_confluence_jira_url';
const KEY_ENABLED         = 'andr_confluence_enabled';
const KEY_ALL_LINK_STATUS = 'andr_all_link_status';
const BROWSE_RE           = /\/browse\/([A-Z][A-Z0-9]+-\d+)/i;
const DEFAULT_URL         = 'https://jira.se.axis.com';
const CHIP_ATTR           = 'data-andr-chip';
const PROCESSED_ATTR      = 'data-andr-lp';

let jiraBaseUrl  = DEFAULT_URL;
let enabled      = true;
let showAllLinks = false;
let scanning     = false;
let scanQueued   = false;

const cache = new Map();

// ── Config ────────────────────────────────────────────────────────────────────

function loadConfig(cb) {
  chrome.storage.sync.get([KEY_JIRA_URL, KEY_ENABLED, KEY_ALL_LINK_STATUS], (r) => {
    jiraBaseUrl  = (r[KEY_JIRA_URL] || DEFAULT_URL).replace(/\/$/, '');
    enabled      = r[KEY_ENABLED] !== false;
    showAllLinks = r[KEY_ALL_LINK_STATUS] === true;
    cb();
  });
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes[KEY_JIRA_URL]) {
    jiraBaseUrl = (changes[KEY_JIRA_URL].newValue || DEFAULT_URL).replace(/\/$/, '');
    cache.clear();
  }
  if (changes[KEY_ENABLED])         enabled      = changes[KEY_ENABLED].newValue !== false;
  if (changes[KEY_ALL_LINK_STATUS]) showAllLinks = changes[KEY_ALL_LINK_STATUS].newValue === true;

  if (changes[KEY_ALL_LINK_STATUS]) {
    if (showAllLinks && enabled) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      observer.disconnect();
    }
  }
  requestScan();
});

// ── Jira API ──────────────────────────────────────────────────────────────────

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

// ── Styles ────────────────────────────────────────────────────────────────────

function ensureStyles() {
  if (document.getElementById('andr-link-status-styles')) return;
  const s = document.createElement('style');
  s.id = 'andr-link-status-styles';
  s.textContent = `
    .andr-link-chip {
      display: inline-block;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 10px;
      font-weight: 700;
      line-height: 1;
      padding: 2px 5px;
      border-radius: 3px;
      margin-left: 4px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      vertical-align: middle;
      white-space: nowrap;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      pointer-events: none;
      user-select: none;
    }
  `;
  document.head.appendChild(s);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(status) {
  const s = (status || '').toLowerCase();
  if (/done|closed|resolved|fixed|complete/.test(s)) return '#00875a';
  if (/progress|development|review|testing/.test(s)) return '#0052cc';
  if (/blocked|impediment/.test(s))                  return '#de350b';
  return '#6b778c';
}

function removeChips() {
  document.querySelectorAll(`[${CHIP_ATTR}]`).forEach(el => el.remove());
  document.querySelectorAll(`[${PROCESSED_ATTR}]`).forEach(a => a.removeAttribute(PROCESSED_ATTR));
}

// ── Scan ──────────────────────────────────────────────────────────────────────

function requestScan() {
  if (scanning) { scanQueued = true; return; }
  scan();
}

async function scan() {
  scanning = true;
  scanQueued = false;
  observer.disconnect();

  try {
    removeChips();
    if (!enabled || !showAllLinks) return;

    ensureStyles();

    const links = [];
    document.querySelectorAll('a[href]').forEach(a => {
      const m = (a.getAttribute('href') || '').match(BROWSE_RE);
      if (!m) return;
      links.push({ el: a, key: m[1].toUpperCase() });
    });

    if (!links.length) return;

    const baseUrl = jiraBaseUrl;
    const allKeys = [...new Set(links.map(l => l.key))];
    await Promise.all(allKeys.map(k => fetchIssue(k, baseUrl)));

    links.forEach(({ el, key }) => {
      if (el.getAttribute(PROCESSED_ATTR)) return;
      el.setAttribute(PROCESSED_ATTR, '1');
      const entry = cache.get(`${baseUrl}/${key}`);
      if (!entry?.status) return;
      const chip = document.createElement('span');
      chip.className = 'andr-link-chip';
      chip.setAttribute(CHIP_ATTR, key);
      chip.textContent = entry.status;
      chip.style.background = statusColor(entry.status);
      el.insertAdjacentElement('afterend', chip);
    });

  } finally {
    scanning = false;
    if (enabled && showAllLinks) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
    if (scanQueued) scan();
  }
}

// ── DOM observer ──────────────────────────────────────────────────────────────

const observer = new MutationObserver(() => requestScan());

// ── Init ──────────────────────────────────────────────────────────────────────

loadConfig(() => {
  if (enabled && showAllLinks) {
    observer.observe(document.body, { childList: true, subtree: true });
    requestScan();
  }
});
