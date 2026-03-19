// an-dr: Jira - Popup Script

const KEY_FIELDS  = 'andr_jira_watched_fields';
const KEY_ENABLED = 'andr_jira_enabled';
const KEY_COLOR   = 'andr_jira_color';
const KEY_MODE    = 'andr_jira_mode';
const DEFAULT_COLOR = '#ff991f';

const fieldList     = document.getElementById('field-list');
const newFieldInput = document.getElementById('new-field');
const addBtn        = document.getElementById('add-btn');
const statusEl      = document.getElementById('status');
const toggle        = document.getElementById('enabled-toggle');
const toggleLabel   = document.getElementById('toggle-label');
const colorPick     = document.getElementById('color-pick');
const resetColor    = document.getElementById('reset-color');
const modeBtns      = document.querySelectorAll('.mode-btn');

let fields  = [];
let enabled = true;
let color   = DEFAULT_COLOR;
let mode    = 'always'; // 'always' | 'empty'

// ── Render ────────────────────────────────────────────────────────────────────

function render() {
  // Toggle state
  toggle.checked = enabled;
  toggleLabel.textContent = enabled ? 'On' : 'Off';
  document.body.classList.toggle('disabled', !enabled);

  // Mode buttons
  modeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));

  // Color
  colorPick.value = color;

  // Field list
  fieldList.innerHTML = '';
  if (fields.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = 'No fields watched yet.';
    fieldList.appendChild(empty);
    return;
  }

  fields.forEach((name, idx) => {
    const li   = document.createElement('li');
    li.className = 'field-item';

    const span = document.createElement('span');
    span.className = 'name';
    span.textContent = name;

    const btn = document.createElement('button');
    btn.textContent = '×';
    btn.title = 'Remove';
    btn.addEventListener('click', () => { fields.splice(idx, 1); saveAll(); });

    li.appendChild(span);
    li.appendChild(btn);
    fieldList.appendChild(li);
  });
}

// ── Persistence ───────────────────────────────────────────────────────────────

function saveAll() {
  chrome.storage.sync.set({
    [KEY_FIELDS]:  fields,
    [KEY_ENABLED]: enabled,
    [KEY_COLOR]:   color,
    [KEY_MODE]:    mode,
  }, () => { render(); flash('Saved'); });
}

function flash(msg) {
  statusEl.textContent = msg;
  clearTimeout(statusEl._t);
  statusEl._t = setTimeout(() => { statusEl.textContent = ''; }, 1500);
}

// ── Handlers ──────────────────────────────────────────────────────────────────

toggle.addEventListener('change', () => {
  enabled = toggle.checked;
  saveAll();
});

modeBtns.forEach(btn => btn.addEventListener('click', () => {
  mode = btn.dataset.mode;
  saveAll();
}));

colorPick.addEventListener('input', () => {
  color = colorPick.value;
  saveAll();
});

resetColor.addEventListener('click', () => {
  color = DEFAULT_COLOR;
  saveAll();
});

function addField() {
  const value = newFieldInput.value.trim();
  if (!value) return;
  if (fields.map(f => f.toLowerCase()).includes(value.toLowerCase())) {
    flash('Already in the list.');
    return;
  }
  fields.push(value);
  newFieldInput.value = '';
  saveAll();
}

addBtn.addEventListener('click', addField);
newFieldInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addField(); });

// ── Init ──────────────────────────────────────────────────────────────────────

chrome.storage.sync.get([KEY_FIELDS, KEY_ENABLED, KEY_COLOR, KEY_MODE], (result) => {
  fields  = result[KEY_FIELDS]  || [];
  enabled = result[KEY_ENABLED] !== false;
  color   = result[KEY_COLOR]   || DEFAULT_COLOR;
  mode    = result[KEY_MODE]    || 'always';
  render();
  newFieldInput.focus();
});
