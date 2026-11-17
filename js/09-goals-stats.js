'use strict';
// THE GOALS WALL (left of the attic) and THE STATS WALL (right of it).
//   Goals: today's words against the daily goal, the streak with the last 7 days, each book's word goal
//   Stats: totals, the last 14 days as bars, and medals

// The last n days, oldest first: [{ day: '2026-11-16', words, hit }]
function lastDays(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    const day = dayOf(d);
    return { day, words: set.log[day] || 0, hit: !!set.hit[day] };
  });
}

/* ---------- Goals ---------- */

function drawGoals() {
  const n = wroteToday();
  const week = lastDays(7);
  const open = books.reduce((h, b) => {
    if (b.status === 'done' || !b.target) return h;
    return h + `<div class="bar"><span class="bt">${esc(b.title)}</span><div><i style="width:${pct(b)}%"></i></div><span>${pct(b)}%</span></div>`;
  }, '');
  $('#goalsBody').innerHTML = `
    <h2>GOALS</h2>
    <div class="card">
      <h3>Today</h3>
      <p class="big"><b>${num(n)}</b> / ${num(set.goal)} words</p>
      <div class="meter"><i style="width:${Math.min(100, (n / set.goal) * 100)}%"></i></div>
      <div class="stepper"><button data-g="-50" aria-label="Lower goal">−</button><span class="dim">Daily goal</span><button data-g="50" aria-label="Raise goal">+</button></div>
    </div>
    <div class="card">
      <h3>Streak</h3>
      <p class="big"><b>🔥 ${streak()}</b> <span class="dim small">Best: ${bestStreak()}</span></p>
      <div class="week">${week.reduce((h, d) => h + `<i class="${d.hit ? 'hit' : d.words ? 'some' : ''}">${new Date(d.day + 'T12:00').toLocaleDateString(document.documentElement.lang, { weekday: 'narrow' })}</i>`, '')}</div>
    </div>
    <div class="card"><h3>Your books</h3>${open || '<p class="dim">Give a book a word goal to follow it here.</p>'}</div>`;
}

$('#goalsBody').onclick = (e) => {
  const step = +e.target.dataset.g;
  if (!step) return;
  set.goal = Math.max(50, set.goal + step);
  saveSet();
  emit('change');
};

/* ---------- Stats ---------- */

// Medals: each one is earned once its test is true
const MEDALS = [
  { icon: '✏️', name: 'First 1,000 words', test: (s) => s.total >= 1000 },
  { icon: '📜', name: '10,000 words', test: (s) => s.total >= 10000 },
  { icon: '📚', name: '50,000 words', test: (s) => s.total >= 50000 },
  { icon: '🔥', name: '7-day streak', test: (s) => s.best >= 7 },
  { icon: '🌙', name: '30-day streak', test: (s) => s.best >= 30 },
  { icon: '🏆', name: 'A finished book', test: (s) => s.done >= 1 },
];

function drawStats() {
  const days = lastDays(14);
  const s = {
    total: books.reduce((t, b) => t + (b.words || 0), 0),
    done: books.reduce((t, b) => t + (b.status === 'done'), 0),
    week: days.slice(7).reduce((t, d) => t + d.words, 0),
    bestDay: Math.max(0, ...Object.values(set.log)),
    best: bestStreak(),
  };
  const top = Math.max(1, ...days.map((d) => d.words));
  $('#statsBody').innerHTML = `
    <h2>STATS</h2>
    <div class="kpis">
      <div class="kpi"><b>${num(s.total)}</b><span>Words in your books</span></div>
      <div class="kpi"><b>${num(s.week)}</b><span>Words this week</span></div>
      <div class="kpi"><b>${num(s.bestDay)}</b><span>Best day</span></div>
      <div class="kpi"><b>${s.done}</b><span>Books finished</span></div>
    </div>
    <div class="card"><h3>Last 14 days</h3><div class="dist">${days.reduce((h, d) => h + `<div><i class="${d.hit ? 'hit' : ''}" style="height:${(d.words / top) * 60}px" title="${num(d.words)}"></i>${+d.day.slice(8)}</div>`, '')}</div></div>
    <div class="card"><h3>Medals</h3><div class="medals">${MEDALS.reduce((h, m) => h + `<div class="medal${m.test(s) ? ' got' : ''}"><i>${m.icon}</i><span>${m.name}</span></div>`, '')}</div></div>`;
}

on('change', () => {
  drawGoals();
  drawStats();
});
drawGoals();
drawStats();
