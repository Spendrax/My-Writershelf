'use strict';
// THE BUDDY'S LIFE
//   • levels: it grows as your books grow (one level per few thousand words), and learns new tricks (TRICKS)
//   • little tricks when it's idle: yawning, stretching, grooming, playing with its yarn, chasing a butterfly…
//   • Zzz while it sleeps (css/buddy.css), and hello when you come back to the app
//   • the yarn ball on the attic floor: tap it to throw it, your buddy runs after it and bats it back
//   • while you write (Open and write), it peeks in from the top: a cheer every 100 words, and on saving
//   • confetti for big moments (a new level, a finished chapter)

/* ---------- Levels ---------- */
// Level L is reached at 500 × (L−1)² words in your books: 500, 2,000, 4,500, 8,000… up to level 20

const MAX_LEVEL = 20;
const wordsForLevel = (L) => 500 * (L - 1) ** 2;
const allWords = () => books.reduce((t, b) => t + (b.words || 0), 0);
const buddyLevel = () => Math.min(MAX_LEVEL, 1 + Math.floor(Math.sqrt(allWords() / 500)));

// Tricks, and the level that teaches each one. Each one plays for `ms` milliseconds (or runs `go`).
const TRICKS = [
  { id: 'yawn', name: 'Yawns', level: 1, ms: 1800 },
  { id: 'stretch', name: 'Stretches', level: 1, ms: 1800 },
  { id: 'groom', name: 'Grooms itself', level: 2, ms: 2200 },
  { id: 'yarn', name: 'Plays with its yarn', level: 3, go: () => chaseYarn(throwSpot()) },
  { id: 'moth', name: 'Chases butterflies', level: 4, go: () => chaseButterfly() },
  { id: 'roll', name: 'Rolls over', level: 5, ms: 1200 },
  { id: 'dance', name: 'Dances', level: 6, ms: 2000 },
];

// It grows a little with each level (css/buddy.css: --grow)
function growBuddy() {
  pet.style.setProperty('--grow', (0.82 + 0.03 * Math.min(buddyLevel(), 12)).toFixed(2));
}

// The card on the Goals wall
function buddyCard() {
  const L = buddyLevel();
  const next = L < MAX_LEVEL ? wordsForLevel(L + 1) : 0;
  const from = wordsForLevel(L);
  const nextTrick = TRICKS.find((t) => t.level > L);
  return `<div class="card">
    <h3>${esc(set.pet)} · Level ${L}</h3>
    ${next ? `<div class="meter"><i style="width:${((allWords() - from) / (next - from)) * 100}%"></i></div><p class="dim small">${num(next - allWords())} words to level ${L + 1}</p>` : '<p class="dim small">Highest level!</p>'}
    <p class="small">${TRICKS.reduce((h, t) => h + (t.level <= L ? `<span class="trick">${t.name}</span>` : ''), '')}</p>
    ${nextTrick ? `<p class="dim small">Level ${nextTrick.level}: ${nextTrick.name}</p>` : ''}
  </div>`;
}

// A new level: confetti, and it tells you
function checkLevel() {
  const L = buddyLevel();
  growBuddy();
  if (!set.level) {
    set.level = L; // the first time: no party for the levels it already had
    saveSet();
  }
  if (L <= set.level) return;
  set.level = L;
  saveSet();
  const learned = TRICKS.find((t) => t.level === L);
  confetti();
  pet.classList.add('jump');
  setTimeout(() => pet.classList.remove('jump'), 1600);
  say(`⭐ Level ${L}!`, 5000);
  if (learned) setTimeout(() => toast(`✨ New trick: ${learned.name}`), 1500);
}
on('change', checkLevel);

/* ---------- Tricks when idle ---------- */

// Plays one of the tricks it knows. Answers false when it isn't in the mood (asleep, busy, being held).
function idleTrick() {
  if (busy() || hold || pet.classList.contains('asleep')) return false;
  const known = TRICKS.filter((t) => t.level <= buddyLevel() && (t.ms || where.wall === 0 || t.id === 'moth'));
  const t = known[Math.floor(Math.random() * known.length)];
  if (!t) return false;
  if (t.go) return t.go() !== false;
  pet.classList.add(t.id);
  clearTimeout(petTimer);
  petTimer = setTimeout(() => {
    pet.classList.remove(t.id);
    restPet();
  }, t.ms);
  return true;
}

// A butterfly flutters by; it follows it along the floor, jumps at it twice, and the butterfly gets away
function chaseButterfly() {
  if (where.y) return false;
  const floor = floorOf(where.wall);
  const x = 20 + Math.random() * (floor.clientWidth - 60);
  const fly = Object.assign(document.createElement('i'), { className: 'butterfly', textContent: '🦋' });
  fly.style.left = x + 'px';
  floor.append(fly);
  const spot = Math.max(0, Math.min(x - PET_W / 2, floor.clientWidth - PET_W));
  walkPet(spot, () => {
    pet.classList.add('pounce');
    petTimer = setTimeout(() => {
      pet.classList.remove('pounce');
      fly.classList.add('away');
      setTimeout(() => fly.remove(), 1500);
      say('🦋 Almost!', 2500);
      restPet();
    }, 1700);
  });
}

/* ---------- Hello when you come back ---------- */

function greet() {
  const away = Date.now() - (set.seen || Date.now());
  set.seen = Date.now();
  saveSet();
  if (away < 6 * 36e5 || pet.classList.contains('asleep')) return;
  setTimeout(() => {
    pet.classList.add('jump');
    setTimeout(() => pet.classList.remove('jump'), 1600);
    say(away > 3 * 864e5 ? '💛 I missed you!' : '💛 You’re back!', 4000);
  }, 2500);
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return greet();
  set.seen = Date.now(); // when you left
  saveSet();
});

/* ---------- The yarn ball ---------- */
// Tap it: it flies across the floor. Your buddy runs over and bats it a little way back.

const yarn = $('#yarn');
let yarnX = 60; // from the left of the attic floor

const throwSpot = () => 10 + Math.random() * (yarn.parentElement.clientWidth - 50);
function rollYarn(to, ms, lift) {
  const from = yarnX;
  yarnX = to;
  yarn.animate(
    [
      { transform: `translateX(${from}px) rotate(0)` },
      { transform: `translate(${(from + to) / 2}px, -${lift}px) rotate(${(to - from) * 1.5}deg)` },
      { transform: `translateX(${to}px) rotate(${(to - from) * 3}deg)` },
    ],
    { duration: ms, easing: 'ease-out', fill: 'forwards' },
  );
}

// It runs to the yarn on the attic floor (from wherever it is) and bats it
function chaseYarn(to) {
  if (to != null) rollYarn(to, 700, 60);
  if (hold || pet.classList.contains('asleep')) return;
  const floorW = yarn.parentElement.clientWidth;
  const left = yarnX > PET_W; // it comes from the side with more room
  const spot = Math.max(0, Math.min(left ? yarnX - PET_W + 10 : yarnX + 26, floorW - PET_W));
  hopDown(() =>
    petGo(0, spot, () => {
      pet.classList.toggle('flip', !left);
      pet.classList.add('bat');
      petTimer = setTimeout(() => {
        pet.classList.remove('bat');
        rollYarn(Math.max(10, Math.min(floorW - 40, yarnX + (left ? 1 : -1) * (40 + Math.random() * 60))), 600, 6);
        restPet(4000 + Math.random() * 5000);
      }, 700);
    }),
  );
}

yarn.onclick = () => chaseYarn(throwSpot());
rollYarn(yarnX, 1, 0);

/* ---------- Watching you write ---------- */
// While "Open and write" is open, your buddy peeks in at the top of the sheet

const peek = $('#peek');
let wroteFrom = null; // words in the book when you opened it
let cheered = 0; // how many hundreds it has cheered for

function peekSay(text) {
  $('.bubble', peek).textContent = text;
  peek.classList.add('talk', 'hop');
  clearTimeout(peekSay.t);
  peekSay.t = setTimeout(() => peek.classList.remove('talk', 'hop'), 2600);
}

on('writing', (total) => {
  if (wroteFrom == null) {
    wroteFrom = total;
    $('.pv', peek).innerHTML = petSVG(set.look.kind, set.look.hat);
    return;
  }
  const hundreds = Math.floor((total - wroteFrom) / 100);
  if (hundreds > cheered) peekSay(`🎉 +${hundreds * 100} words!`);
  cheered = Math.max(cheered, hundreds);
});
on('saved', () => peekSay('✨ Saved!'));
$('#dlgWrite').addEventListener('close', () => {
  wroteFrom = null;
  cheered = 0;
});

/* ---------- Finished chapters ---------- */
// When a book has more chapters than last time (its list is read by the book card, 05-book-card.js)

function countChapters(b, n) {
  if (b.chapters != null && n > b.chapters) {
    confetti();
    say('🎉 A new chapter!', 5000);
    toast(`📖 ${b.title}: chapter ${n}!`);
  }
  if (b.chapters !== n) {
    b.chapters = n;
    store('ws.books', books);
  }
}

/* ---------- Confetti ---------- */

function confetti() {
  const box = Object.assign(document.createElement('div'), { className: 'confetti' });
  box.innerHTML = Array.from({ length: 40 }).reduce(
    (h, _, i) =>
      h +
      `<i style="left:${Math.random() * 100}%;background:${['#ffc66b', '#ff8fb1', '#7fe0a0', '#8fb7ff', '#c9a0ff'][i % 5]};animation-delay:${Math.random() * 0.6}s;animation-duration:${1.8 + Math.random() * 1.4}s"></i>`,
    '',
  );
  document.body.append(box);
  setTimeout(() => box.remove(), 3800);
}

growBuddy();
checkLevel();
greet();
drawGoals();
