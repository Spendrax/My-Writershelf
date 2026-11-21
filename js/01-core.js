'use strict';
// CORE — loaded first. Everything the other files share:
//   • the book list and settings, and saving them on the phone (localStorage)
//   • a tiny event system: emit('change') after any edit, other files listen with on('change', …)
//   • the word log: how many words you wrote each day, the daily goal and the streak
//   • small helpers ($, esc, today, …) and spineHTML(), which draws one book on the shelf
const VERSION = '1.6';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const STATUS = {
  idea: { label: 'Idea', color: '#8fb7ff' },
  draft: { label: 'Drafting', color: '#ffc66b' },
  edit: { label: 'Editing', color: '#c9a0ff' },
  done: { label: 'Finished', color: '#7fe0a0' },
};
const SPINES = ['#8c3b2e', '#2f5d50', '#34507d', '#7a5a2a', '#5e3a6e', '#3e3e44'];

const load = (k, d) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? d;
  } catch {
    return d;
  }
};
const store = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
    return true;
  } catch {
    toast('Storage is full: save a backup');
    return false;
  }
};

// A book: { id, title, doc (its Google Doc's id, or ''), docTime, words, target, status, color, notes, added, updated }
let books = load('ws.books', []);
// log: words written each day ({ '2026-11-16': 420 }) · hit: the days the daily goal was reached
const set = Object.assign({ pet: 'Inkwell', goal: 500, log: {}, hit: {} }, load('ws.set', {}));
// look: what you chose in Customize (17-customize.js) — the attic's colours, the window, the animal, its fur and hat.
// The window shows the real weather ('live', 18-weather.js) unless you picked a view.
set.look = Object.assign(
  { led: '#ffc66b', wall: '#17110d', floor: '#4a3320', rug: '#9c3f33', sky: 'live', kind: 'cat', fur: '#e8964a', hat: 'none' },
  set.look,
);

const listeners = {};
const on = (e, f) => (listeners[e] ??= []).push(f);
const emit = (e, d) => (listeners[e] || []).forEach((f) => f(d));
const save = () => {
  store('ws.books', books);
  emit('change');
};
const saveSet = () => store('ws.set', set);

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const dayOf = (d) => new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const today = () => dayOf(new Date());
const byId = (id) => books.find((b) => b.id === id);
const num = (n) => Math.round(n || 0).toLocaleString();
const countWords = (text) => (String(text).match(/\S+/g) || []).length;
const pct = (b) => (b.target ? Math.min(100, Math.round(((b.words || 0) / b.target) * 100)) : 0);

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2400);
}

function loadScript(src) {
  return new Promise((ok, fail) => {
    const s = Object.assign(document.createElement('script'), { src, onload: ok, onerror: fail });
    document.head.append(s);
  });
}

/* ---------- Words, the daily goal and the streak ---------- */

// Gives a book its new word count. The difference goes on today's log, unless counts is false
// (a book just brought in: the words already in it weren't written today).
function setWords(b, n, counts = true) {
  const diff = n - (b.words || 0);
  if (!diff) return;
  b.words = n;
  b.updated = Date.now();
  if (!counts) return;
  // shortcut: words typed in Google Docs land on the day the app reads them, not the day they were typed.
  // Upgrade if that matters: read the Doc's revision dates.
  const t = today();
  set.log[t] = Math.max(0, (set.log[t] || 0) + diff);
  if (set.log[t] >= set.goal && !set.hit[t]) {
    set.hit[t] = 1; // stays earned, even if you delete words later or raise the goal
    emit('goal');
  }
  saveSet();
}

const wroteToday = () => set.log[today()] || 0;

// Days in a row the goal was reached. Today not done yet doesn't break it: the day isn't over.
function streak() {
  const d = new Date();
  if (!set.hit[dayOf(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.hit[dayOf(d)]) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

function bestStreak() {
  return Object.keys(set.hit)
    .sort()
    .reduce(
      (a, day) => {
        const run = a.last && Date.parse(day) - Date.parse(a.last) === 864e5 ? a.run + 1 : 1;
        return { last: day, run, best: Math.max(a.best, run) };
      },
      { last: '', run: 0, best: 0 },
    ).best;
}

/* ---------- Drawing a book ---------- */

// A spine on the shelf: its colour fills up from the bottom as the book gets closer to its word goal
function spineHTML(b) {
  return (
    `<button class="spine${b.status === 'done' ? ' done' : ''}" data-id="${esc(b.id)}" style="--c:${esc(b.color || SPINES[0])};--p:${pct(b)}%" aria-label="${esc(b.title)}">` +
    `<b>${esc(b.title)}</b><i class="dot" style="--sc:${STATUS[b.status]?.color || '#888'}"></i></button>`
  );
}

// Any spine anywhere opens its book; anything with data-close closes its sheet
document.addEventListener('click', (e) => {
  const s = e.target.closest('.spine[data-id]');
  if (s) openBook(s.dataset.id);
  if (e.target.closest('[data-close]')) e.target.closest('dialog').close();
});
// Tapping the dark backdrop closes a sheet
$$('dialog').forEach((d) =>
  d.addEventListener('click', (e) => {
    if (e.target === d) d.close();
  }),
);
