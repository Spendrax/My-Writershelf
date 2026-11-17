'use strict';
// THE BUDDY — the animal that lives on the attic floor. This file:
//   • draws it: every animal shares one body (4 legs, belly, head, eyes, nose, mouth); ANIMALS adds what
//     makes each one itself (ears, tail, muzzle, whiskers…). The colours come from css/buddy.css (--fur).
//   • gives it moods: happy once the daily goal is done, asleep at night, sad when a streak may be lost
//   • makes it talk: tap it to hear how today is going
// Walking around is in 16-buddy-moves.js; choosing the animal and its fur is in 17-customize.js.

const pet = $('#pet');
const PINK = '#f4a9b8';

// What each animal adds. back: drawn behind the head (ears) · front: drawn on the face · tail · nose colour
const ANIMALS = {
  cat: {
    name: 'Cat',
    tail: '<path class="ts" d="M12 33C2 31 1 20 7 15"/>',
    back: `<path class="f" d="M35 13l1-11 9 6zM57 13l-1-11-9 6z"/><path fill="${PINK}" d="M37.5 10.5l.6-5.5 4.6 3.2zM54.5 10.5l-.6-5.5-4.6 3.2z"/>`,
    front: '<path d="M37 25l-5-1M37 26.5l-5 1M56 25l5-1M56 26.5l5 1" stroke="#fff9" stroke-width=".6"/>',
    nose: PINK,
  },
  dog: {
    name: 'Dog',
    tail: '<path class="ts" d="M12 31C6 28 6 21 9 17"/>',
    front:
      '<ellipse class="f2" cx="34.5" cy="19" rx="4" ry="8.5" transform="rotate(14 34.5 19)"/><ellipse class="f2" cx="57.5" cy="19" rx="4" ry="8.5" transform="rotate(-14 57.5 19)"/><ellipse class="fl" cx="46.5" cy="26.2" rx="6.5" ry="4.6"/>',
  },
  fox: {
    name: 'Fox',
    tail: '<path class="f" d="M13 35C0 37-2 23 6 14c3 7 6 12 9 15z"/><path fill="#fff" d="M6 14c-3 3-4.5 6.5-4.5 9.5 3.5-1 6.5-3 7.5-5.500z"/>',
    back: '<path class="f" d="M34 14V1l10 7zM58 14V1L48 8z"/><path fill="#3a2418" d="M34 1v5l3.5-2.300zM58 1v5l-3.5-2.300z"/>',
    front: '<ellipse fill="#fff" cx="46" cy="27.5" rx="8.5" ry="5.2"/>',
  },
  bunny: {
    name: 'Bunny',
    tail: '<circle fill="#fff" cx="11" cy="32" r="4.5"/>',
    back: `<ellipse class="f" cx="41" cy="2" rx="3.6" ry="10" transform="rotate(-8 41 8)"/><ellipse fill="${PINK}" cx="41" cy="2.5" rx="1.6" ry="7" transform="rotate(-8 41 8)"/><ellipse class="f" cx="51" cy="2" rx="3.6" ry="10" transform="rotate(8 51 8)"/><ellipse fill="${PINK}" cx="51" cy="2.5" rx="1.6" ry="7" transform="rotate(8 51 8)"/>`,
    front: '<rect x="45.3" y="27.8" width="2.4" height="2.2" rx=".5" fill="#fff"/>',
    nose: PINK,
  },
  bear: {
    name: 'Bear',
    tail: '<circle class="f2" cx="11.5" cy="31" r="3"/>',
    back: '<circle class="f" cx="36" cy="10.5" r="4.8"/><circle class="fl" cx="36" cy="10.5" r="2.3"/><circle class="f" cx="56" cy="10.5" r="4.8"/><circle class="fl" cx="56" cy="10.5" r="2.3"/>',
    front: '<ellipse class="fl" cx="46.5" cy="26.2" rx="6" ry="4.5"/>',
  },
  mouse: {
    name: 'Mouse',
    tail: `<path d="M12 36C2 38 0 28 5 24" stroke="${PINK}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
    back: `<circle class="f" cx="35.5" cy="10" r="7"/><circle fill="${PINK}" cx="35.5" cy="10" r="4.5"/><circle class="f" cx="56.5" cy="10" r="7"/><circle fill="${PINK}" cx="56.5" cy="10" r="4.5"/>`,
    front: '<path d="M37 25.500l-4-.5M56 25.500l4-.5" stroke="#fff9" stroke-width=".6"/>',
    nose: PINK,
  },
};

// One leg with its paw. a/b: the two groups that swing in turn when walking · far: the legs on the other side
const leg = (x, group, far) =>
  `<g class="leg ${group}"><rect class="${far ? 'f2' : 'f'}" x="${x}" y="38" width="6.5" height="14" rx="3.2"/><ellipse class="fl" cx="${x + 3.6}" cy="51.5" rx="3.7" ry="2"/></g>`;

// The whole animal, facing right
function petSVG(kind) {
  const a = ANIMALS[kind] || ANIMALS.cat;
  return `<svg viewBox="0 -10 64 66" aria-hidden="true">
    <ellipse cx="30" cy="54" rx="21" ry="2.5" fill="#0005"/>
    <g class="top">
      <g class="tail">${a.tail}</g>
      ${leg(13, 'b', true)}${leg(32, 'a', true)}
      <ellipse class="f" cx="28" cy="35" rx="17" ry="11"/>
      <ellipse class="fl" cx="29" cy="41" rx="11" ry="4.5"/>
      ${leg(19, 'a')}${leg(38, 'b')}
      ${a.back || ''}
      <circle class="f" cx="46" cy="21" r="13"/>
      ${a.front || ''}
      <g class="eyes"><circle cx="41.5" cy="20" r="2.4" fill="#2a1c10"/><circle cx="42.3" cy="19.2" r=".8" fill="#fff"/><circle cx="51" cy="20" r="2.4" fill="#2a1c10"/><circle cx="51.8" cy="19.2" r=".8" fill="#fff"/></g>
      <path class="shut line" d="M39.3 20.500q2.2 2 4.4 0M48.8 20.500q2.2 2 4.4 0"/>
      <ellipse cx="38" cy="25" rx="2.2" ry="1.3" fill="#ff8fa3" opacity=".5"/><ellipse cx="54.5" cy="25" rx="2.2" ry="1.3" fill="#ff8fa3" opacity=".5"/>
      <path d="M44.7 24h3.200l-1.6 2z" fill="${a.nose || '#2a1c10'}"/>
      <path class="mouth line" d="M43.5 27.200q1.4 1.7 2.8 0q1.4 1.7 2.8 0"/>
      <path class="smile" d="M43.6 27q2.7 4.6 5.4 0z" fill="#c2455a" stroke="#2a1c10" stroke-width=".8" stroke-linejoin="round"/>
      <path class="frown line" d="M44 29q2.3-2 4.6 0"/>
    </g>
  </svg>`;
}

/* ---------- Moods ---------- */

// happy once the goal is done, asleep at night, sad when a streak is about to be lost
function buddyMood() {
  const hour = new Date().getHours();
  if (wroteToday() >= set.goal) return 'happy';
  if (hour >= 23 || hour < 6) return 'asleep';
  return streak() && hour >= 20 ? 'sad' : '';
}

function drawBuddy() {
  if (pet.dataset.kind !== set.look.kind) {
    pet.dataset.kind = set.look.kind;
    $('#petArt').innerHTML = petSVG(set.look.kind);
  }
  ['happy', 'asleep', 'sad'].forEach((m) => pet.classList.toggle(m, m === buddyMood()));
  pet.setAttribute('aria-label', set.pet);
}

/* ---------- Talking ---------- */

function buddyLine() {
  const n = wroteToday();
  const s = streak();
  const hour = new Date().getHours();
  if (!books.length) return 'Tap + to put your first book on the shelf';
  if (n >= set.goal) return s > 1 ? `Goal done! ${s} days in a row` : 'Goal done! See you tomorrow';
  if (n > 0) return `${num(set.goal - n)} words to go today. You can do it!`;
  if (s > 0 && hour >= 18) return `Write a little tonight to keep your ${s}-day streak`;
  if (hour >= 18) return 'Still time to write a little tonight';
  return 'Ready when you are';
}

function say(text, ms = 4500) {
  $('#bubble').textContent = text;
  pet.classList.add('talk');
  clearTimeout(say.t);
  say.t = setTimeout(() => pet.classList.remove('talk'), ms);
}

pet.onclick = () => say(buddyLine());
pet.onkeydown = (e) => e.key === 'Enter' && pet.click();

on('change', drawBuddy);
on('look', drawBuddy);
on('goal', () => {
  drawBuddy();
  pet.classList.add('jump');
  setTimeout(() => pet.classList.remove('jump'), 1600);
  say('🎉 Daily goal done!', 6000);
});
drawBuddy();
setTimeout(() => say(buddyLine()), 1200);
