'use strict';
// THE GOALS WALL (left of the attic) and THE STATS WALL (right of it).
//   Goals: today's words against the daily goal, the streak with the last 7 days, each book's word goal
//   Stats: totals, the last 14 days as bars, and medals (each one wins a hat)

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
    ${typeof buddyCard === 'function' ? buddyCard() : '' /* your buddy's level (22-buddy-life.js) */}
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

// The writing calendar: the last 18 weeks, one square a day (weeks in columns, Monday on top),
// coloured by the words written that day: none, some, half the goal, the goal reached
const CAL_WEEKS = 18;
function calendarCard() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - (CAL_WEEKS - 1) * 7 - ((end.getDay() + 6) % 7)); // a Monday
  const days = Math.round((end - start) / 864e5) + 1;
  const cells = Array.from({ length: days }).reduce((h, _, k) => {
    const d = new Date(start);
    d.setDate(start.getDate() + k);
    const day = dayOf(d);
    const n = set.log[day] || 0;
    const lv = set.hit[day] ? 3 : n >= set.goal / 2 ? 2 : n > 0 ? 1 : 0;
    return h + `<i class="c${lv}" data-day="${day}" data-n="${n}"></i>`;
  }, '');
  return `<div class="card"><h3>Writing calendar</h3><div class="cal">${cells}</div>
    <p class="cal-key dim small">Less <i class="c0"></i><i class="c1"></i><i class="c2"></i><i class="c3"></i> More</p></div>`;
}
// Tap a day: how much you wrote
$('#statsBody').addEventListener('click', (e) => {
  const c = e.target.closest('.cal i');
  if (!c) return;
  const date = new Date(c.dataset.day + 'T12:00').toLocaleDateString(document.documentElement.lang, { month: 'long', day: 'numeric' });
  toast(`${date} · ${num(+c.dataset.n)} words`);
});


// Medals: each one is earned once its test is true, and wins your buddy a hat (HATS in 08-buddy.js)
// and a decoration for the shelf (21-room-life.js).
// 19-achievements.js notices new ones and remembers them (set.got), so a medal stays won.
const MEDALS = [
  { id: 'w1k', deco: '🪴', decoName: 'Plant', icon: '✏️', name: 'First 1,000 words', hat: 'beret', test: (s) => s.total >= 1000 },
  { id: 'w10k', deco: '🕯️', decoName: 'Candle', icon: '📜', name: '10,000 words', hat: 'beanie', test: (s) => s.total >= 10000 },
  { id: 'w50k', deco: '🌍', decoName: 'Globe', icon: '📚', name: '50,000 words', hat: 'tophat', test: (s) => s.total >= 50000 },
  { id: 's7', deco: '⏳', decoName: 'Hourglass', icon: '🔥', name: '7-day streak', hat: 'party', test: (s) => s.best >= 7 },
  { id: 's30', deco: '🔭', decoName: 'Telescope', icon: '🌙', name: '30-day streak', hat: 'wizard', test: (s) => s.best >= 30 },
  { id: 'done', deco: '🏆', decoName: 'Trophy', icon: '🏆', name: 'A finished book', hat: 'crown', test: (s) => s.done >= 1 },
  { id: 'pets', deco: '🧸', decoName: 'Teddy bear', icon: '🐾', name: 'Pet your buddy 25 times', hat: 'flowers', test: (s) => s.pets >= 25 },
  { id: 'fed', deco: '🐠', decoName: 'Fishbowl', icon: '🍖', name: 'Feed your buddy 10 times', hat: 'chef', test: (s) => s.fed >= 10 },
];
const hasMedal = (m) => (set.got || []).includes(m.id);

// The numbers the Stats wall and the medals are worked out from
function medalStats() {
  const days = lastDays(14);
  return {
    days,
    total: books.reduce((t, b) => t + (b.words || 0), 0),
    done: books.reduce((t, b) => t + (b.status === 'done'), 0),
    week: days.slice(7).reduce((t, d) => t + d.words, 0),
    bestDay: Math.max(0, ...Object.values(set.log)),
    best: bestStreak(),
    pets: set.pets || 0,
    fed: set.fed || 0,
  };
}

function drawStats() {
  const s = medalStats();
  const days = s.days;
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
    ${calendarCard()}
    <div class="card"><h3>Medals</h3><div class="medals">${MEDALS.reduce((h, m) => h + `<div class="medal${hasMedal(m) || m.test(s) ? ' got' : ''}"><i>${m.icon}</i><span>${m.name}</span><small>🎩 ${HATS[m.hat].name} · ${m.deco}</small></div>`, '')}</div></div>`;
}

on('change', () => {
  drawGoals();
  drawStats();
});
drawGoals();
drawStats();
