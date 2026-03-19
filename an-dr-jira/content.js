// an-dr: Jira - Content Script

const KEY_FIELDS       = 'andr_jira_watched_fields';
const KEY_ENABLED      = 'andr_jira_enabled';
const KEY_COLOR        = 'andr_jira_color';
const KEY_MODE         = 'andr_jira_mode';
const DEFAULT_COLOR    = '#ff991f';
const SCAN_DEBOUNCE_MS = 600;

let watchedFields = [];
let enabled       = true;
let color         = DEFAULT_COLOR;
let mode          = 'always';
let scanTimer     = null;
let styleEl       = null;

// ── Dynamic styles ────────────────────────────────────────────────────────────

function applyStyles() {
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'andr-jira-styles';
    document.head.appendChild(styleEl);
  }
  const rgb = hexToRgb(color);
  styleEl.textContent = `
    .andr-jira-highlight {
      background-color: rgba(${rgb}, 0.20) !important;
      box-shadow: inset 4px 0 0 ${color} !important;
    }
    .andr-jira-highlight-label {
      color: ${color} !important;
      font-weight: 700 !important;
    }
  `;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

// ── Storage ───────────────────────────────────────────────────────────────────

function loadConfig(cb) {
  chrome.storage.sync.get([KEY_FIELDS, KEY_ENABLED, KEY_COLOR, KEY_MODE], (r) => {
    watchedFields = r[KEY_FIELDS]  || [];
    enabled       = r[KEY_ENABLED] !== false;
    color         = r[KEY_COLOR]   || DEFAULT_COLOR;
    mode          = r[KEY_MODE]    || 'always';
    cb();
  });
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes[KEY_FIELDS])  watchedFields = changes[KEY_FIELDS].newValue  || [];
  if (changes[KEY_ENABLED]) enabled       = changes[KEY_ENABLED].newValue !== false;
  if (changes[KEY_COLOR])   color         = changes[KEY_COLOR].newValue   || DEFAULT_COLOR;
  if (changes[KEY_MODE])    mode          = changes[KEY_MODE].newValue    || 'always';
  applyStyles();
  scheduleScan();
});

// ── Text helpers ──────────────────────────────────────────────────────────────

function normalizeText(t) {
  return t.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matches(labelText, normalized) {
  const n = normalizeText(labelText);
  return normalized.some(f => n.includes(f) || f.includes(n));
}

/**
 * Get visible text from an element, skipping Jira's edit-overlay icon elements.
 * This prevents the edit button text ("Edit Field Name") from polluting the value.
 */
function visibleText(el) {
  let text = '';
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const cls = node.className || '';
      // Skip Jira's inline edit overlay buttons
      if (cls.includes('overlay-icon') || cls.includes('aui-iconfont-edit')) continue;
      text += visibleText(node);
    }
  }
  return text;
}

const EMPTY_RE = /^(none|unassigned|–|-|\s*)$/i;

function isEffectivelyEmpty(valueEl) {
  if (!valueEl) return false;
  return EMPTY_RE.test(visibleText(valueEl).trim());
}

function shouldHighlight(valueEl) {
  return mode === 'always' || isEffectivelyEmpty(valueEl);
}

// ── Highlight management ──────────────────────────────────────────────────────

function clearHighlights() {
  document.querySelectorAll('.andr-jira-highlight').forEach(el => el.classList.remove('andr-jira-highlight'));
  document.querySelectorAll('.andr-jira-highlight-label').forEach(el => el.classList.remove('andr-jira-highlight-label'));
}

// ── Scan ──────────────────────────────────────────────────────────────────────

function scheduleScan() {
  clearTimeout(scanTimer);
  scanTimer = setTimeout(scanAndHighlight, SCAN_DEBOUNCE_MS);
}

function scanAndHighlight() {
  clearHighlights();
  if (!enabled || !watchedFields.length) return;

  const normalized = watchedFields.map(f => normalizeText(f));
  let count = 0;

  // ── Strategy 1: Jira Server/DC field structure ────────────────────────────
  // div.wrap > strong.name > label[for="customfield_X"]
  // value at: div#customfield_X-val  (appends "-val" to the for attribute)
  document.querySelectorAll('label[for]').forEach(labelEl => {
    const labelText = (labelEl.innerText || labelEl.textContent || '').trim();
    if (!labelText || !matches(labelText, normalized)) return;

    const forId  = labelEl.getAttribute('for');
    const valueEl = document.getElementById(`${forId}-val`)
                 || labelEl.closest('.wrap, .field-group')?.querySelector('.value, [class*="field-value"]');

    if (!valueEl) return;
    if (!shouldHighlight(valueEl)) return;

    labelEl.classList.add('andr-jira-highlight-label');
    valueEl.classList.add('andr-jira-highlight');
    count++;
  });

  // ── Strategy 2: table-based layouts (some Jira views / sidebars) ──────────
  document.querySelectorAll('td, th').forEach(cell => {
    const text = (cell.innerText || cell.textContent || '').trim();
    if (!text || !matches(text, normalized)) return;

    const valueCell = cell.nextElementSibling;
    const targetEl  = (valueCell?.tagName === 'TD' || valueCell?.tagName === 'TH')
      ? valueCell : cell;

    if (!shouldHighlight(targetEl)) return;

    cell.classList.add('andr-jira-highlight-label');
    targetEl.classList.add('andr-jira-highlight');
    count++;
  });

  // ── Strategy 3: Jira Cloud / Next-gen label elements ─────────────────────
  const cloudSelectors = [
    'dt', '[data-testid$="-field-label"]', '[class*="FieldHeading"]',
    'span[class*="field-label"]', 'div[class*="field-label"]',
  ].join(',');

  document.querySelectorAll(cloudSelectors).forEach(labelEl => {
    const text = (labelEl.innerText || labelEl.textContent || '').trim();
    if (!text || !matches(text, normalized)) return;

    const container = labelEl.closest('[data-testid], li, [data-component-selector]') || labelEl.parentElement;
    const valueEl   = container?.querySelector('[role="textbox"],[role="combobox"],[role="listbox"],input,select,textarea') || container;
    if (!shouldHighlight(valueEl)) return;

    labelEl.classList.add('andr-jira-highlight-label');
    (valueEl || labelEl.parentElement).classList.add('andr-jira-highlight');
    count++;
  });

  console.log(`[an-dr: Jira] highlighted: ${count}`);
}

// ── MutationObserver ──────────────────────────────────────────────────────────

const observer = new MutationObserver((mutations) => {
  const relevant = mutations.some(m => [...m.addedNodes].some(n => n.nodeType === 1));
  if (relevant) scheduleScan();
});

observer.observe(document.body, { childList: true, subtree: true });

// ── Init ──────────────────────────────────────────────────────────────────────

function isJiraPage() {
  const meta = document.querySelector('meta[name="application-name"]');
  const appName = (meta?.getAttribute('content') || '').toLowerCase();

  // Explicitly not Jira
  if (appName.includes('confluence')) return false;
  if (document.querySelector('#confluence-ui, .confluence-content-body, #confluence')) return false;

  // Positive Jira signals
  if (appName.includes('jira')) return true;
  if (document.querySelector('#jira, #jira-frontend, #issue-container, [data-issue-key]')) return true;

  return false;
}

console.log('[an-dr: Jira] content script loaded on', location.hostname);

if (isJiraPage()) {
  loadConfig(() => {
    applyStyles();
    scheduleScan();
    setInterval(scheduleScan, 2000);
  });
} else {
  console.log('[an-dr: Jira] not a Jira page, skipping');
}
