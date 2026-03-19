// an-dr: Confluence Axis - Popup Script

const KEY_JIRA_URL       = 'andr_confluence_jira_url';
const KEY_ENABLED        = 'andr_confluence_enabled';
const KEY_SHOW_STATUS    = 'andr_confluence_show_status';
const KEY_BADGE_POS      = 'andr_confluence_badge_pos';
const KEY_HIDE_ON_CURSOR   = 'andr_confluence_hide_on_cursor';
const KEY_SHOW_LINK_STATUS = 'andr_confluence_show_link_status';
const DEFAULT_URL     = 'https://jira.se.axis.com';

const jiraUrlInput     = document.getElementById('jira-url');
const saveBtn          = document.getElementById('save-btn');
const statusEl         = document.getElementById('status');
const toggle           = document.getElementById('enabled-toggle');
const toggleLabel      = document.getElementById('toggle-label');
const showStatusToggle   = document.getElementById('show-status-toggle');
const badgePosSelect     = document.getElementById('badge-pos-select');
const hideOnCursorToggle   = document.getElementById('hide-on-cursor-toggle');
const showLinkStatusToggle = document.getElementById('show-link-status-toggle');

let enabled        = true;
let showStatus     = false;
let badgePos       = 'right';
let hideOnCursor   = false;
let showLinkStatus = false;

function render() {
  toggle.checked               = enabled;
  toggleLabel.textContent      = enabled ? 'On' : 'Off';
  showStatusToggle.checked     = showStatus;
  badgePosSelect.value         = badgePos;
  hideOnCursorToggle.checked   = hideOnCursor;
  showLinkStatusToggle.checked = showLinkStatus;
  document.body.classList.toggle('disabled', !enabled);
}

function flash(msg) {
  statusEl.textContent = msg;
  clearTimeout(statusEl._t);
  statusEl._t = setTimeout(() => { statusEl.textContent = ''; }, 1800);
}

toggle.addEventListener('change', () => {
  enabled = toggle.checked;
  chrome.storage.sync.set({ [KEY_ENABLED]: enabled }, () => { render(); flash('Saved'); });
});

showStatusToggle.addEventListener('change', () => {
  showStatus = showStatusToggle.checked;
  chrome.storage.sync.set({ [KEY_SHOW_STATUS]: showStatus }, () => flash('Saved'));
});

badgePosSelect.addEventListener('change', () => {
  badgePos = badgePosSelect.value;
  chrome.storage.sync.set({ [KEY_BADGE_POS]: badgePos }, () => flash('Saved'));
});

hideOnCursorToggle.addEventListener('change', () => {
  hideOnCursor = hideOnCursorToggle.checked;
  chrome.storage.sync.set({ [KEY_HIDE_ON_CURSOR]: hideOnCursor }, () => flash('Saved'));
});

showLinkStatusToggle.addEventListener('change', () => {
  showLinkStatus = showLinkStatusToggle.checked;
  chrome.storage.sync.set({ [KEY_SHOW_LINK_STATUS]: showLinkStatus }, () => flash('Saved'));
});

saveBtn.addEventListener('click', () => {
  const value = jiraUrlInput.value.trim().replace(/\/$/, '') || DEFAULT_URL;
  chrome.storage.sync.set({ [KEY_JIRA_URL]: value }, () => flash('Saved'));
});

jiraUrlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveBtn.click(); });

chrome.storage.sync.get([KEY_JIRA_URL, KEY_ENABLED, KEY_SHOW_STATUS, KEY_BADGE_POS, KEY_HIDE_ON_CURSOR, KEY_SHOW_LINK_STATUS], (r) => {
  jiraUrlInput.value = r[KEY_JIRA_URL] || DEFAULT_URL;
  enabled        = r[KEY_ENABLED] !== false;
  showStatus     = r[KEY_SHOW_STATUS] === true;
  badgePos       = r[KEY_BADGE_POS] || 'right';
  hideOnCursor   = r[KEY_HIDE_ON_CURSOR] === true;
  showLinkStatus = r[KEY_SHOW_LINK_STATUS] === true;
  render();
  jiraUrlInput.focus();
});
