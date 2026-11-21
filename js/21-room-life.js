'use strict';
// THE ROOM COMES ALIVE
//   • the light follows the time of day: a sunbeam with floating dust through the window by day, orange at
//     sunrise and sunset, the string lights glowing brighter at night (from the real sunrise/sunset when known)
//   • the weather inside: rain running down the window, lightning flashes in a storm, snow piling on the sill,
//     and the sound of rain and thunder (Settings → Sounds)
//   • decorations for the season: autumn leaves, Halloween, December lights, Valentine's
//   • a decoration on the shelf for each medal won (MEDALS in 09-goals-stats.js)

const root = document.documentElement;

/* ---------- The light ---------- */

// 'night', 'dawn', 'day' or 'dusk', from the real sunrise and sunset if the weather knows them (7:00 and 17:00 if not)
function timeOfDay(d = new Date()) {
  const [rise, fall] = set.weather?.sun || [420, 1020];
  const m = d.getHours() * 60 + d.getMinutes();
  if (Math.abs(m - rise) <= 45) return 'dawn';
  if (Math.abs(m - fall) <= 45) return 'dusk';
  return m > rise && m < fall ? 'day' : 'night';
}

// Dust specks floating in the sunbeam, each drifting at its own pace
$('.sunbeam').innerHTML = Array.from({ length: 9 }).reduce(
  (h, _, i) =>
    h + `<i style="left:${10 + ((i * 37) % 80)}%;top:${15 + ((i * 53) % 70)}%;animation-delay:-${i * 1.7}s;animation-duration:${9 + (i % 4) * 3}s"></i>`,
  '',
);

/* ---------- The weather inside ---------- */

// What the window shows right now (a view you picked, or the real weather)
const skyNow = () => root.dataset.sky;
const stormy = () => skyNow() === 'storm';
const rainy = () => ['rain', 'storm'].includes(skyNow());

// A storm: a flash every 8 to 20 seconds, and thunder a moment later
let flashT = 0;
function lightning() {
  clearTimeout(flashT);
  if (!stormy()) return;
  flashT = setTimeout(() => {
    if (!document.hidden) {
      $('#flash').classList.remove('on');
      void $('#flash').offsetWidth;
      $('#flash').classList.add('on');
      setTimeout(thunder, 600 + Math.random() * 1200);
    }
    lightning();
  }, 8000 + Math.random() * 12000);
}

/* ---------- Sounds: rain and thunder, made by the phone itself (no sound files) ---------- */
// Browsers only allow sound after a first tap, so it starts with your first tap in the app.

set.sound ??= true;
let audio = null; // { ctx, rain (its volume) }

function startAudio() {
  if (audio || !set.sound) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  // two seconds of "brown" noise, softened: it sounds like steady rain
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) data[i] = last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
  const noise = Object.assign(ctx.createBufferSource(), { buffer: buf, loop: true });
  const soft = Object.assign(ctx.createBiquadFilter(), { type: 'lowpass' });
  soft.frequency.value = 900;
  const rain = ctx.createGain();
  rain.gain.value = 0;
  noise.connect(soft).connect(rain).connect(ctx.destination);
  noise.start();
  audio = { ctx, rain };
  updateSound();
}

// The rain fades in when it's raining (and you're in the app), out otherwise
function updateSound() {
  if (!audio) return;
  const on = set.sound && rainy() && !document.hidden;
  audio.rain.gain.setTargetAtTime(on ? (stormy() ? 3.5 : 2.2) : 0, audio.ctx.currentTime, 0.8);
}

function thunder() {
  if (!audio || !set.sound || document.hidden) return;
  const { ctx } = audio;
  const len = ctx.sampleRate * 3;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  // a deep rumble that rolls in and fades away
  for (let i = 0; i < len; i++) {
    last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.01;
    data[i] = last * Math.min(1, i / 4000) * (1 - i / len);
  }
  const src = Object.assign(ctx.createBufferSource(), { buffer: buf });
  const low = Object.assign(ctx.createBiquadFilter(), { type: 'lowpass' });
  low.frequency.value = 160;
  const vol = ctx.createGain();
  vol.gain.value = 9;
  src.connect(low).connect(vol).connect(ctx.destination);
  src.start();
}

addEventListener('pointerdown', startAudio, { once: true });
document.addEventListener('visibilitychange', updateSound);
$('#sSound').checked = set.sound;
$('#sSound').onchange = (e) => {
  set.sound = e.target.checked;
  saveSet();
  set.sound ? startAudio() : 0;
  updateSound();
};

/* ---------- Decorations for the season ---------- */
// wall: things on the attic wall · floor: things on the floor · each is [emoji, left %, a size, a turn]

const SEASONS = [
  {
    id: 'valentine',
    when: (m, d) => m === 1 && d <= 14,
    wall: [['💕', 20, 22, -8], ['💗', 40, 18, 6], ['💕', 60, 22, -4], ['💗', 80, 18, 8]],
    floor: [['💝', 6, 26, -6]],
  },
  {
    id: 'halloween',
    when: (m) => m === 9,
    wall: [['🕸️', 2, 40, 0], ['🦇', 58, 22, -12]],
    floor: [['🎃', 4, 34, 0], ['🎃', 88, 24, 8]],
  },
  {
    id: 'autumn',
    when: (m, d) => (m === 8 && d >= 22) || m === 10,
    wall: [],
    floor: [['🍂', 5, 22, -20], ['🍁', 12, 18, 30], ['🍂', 86, 20, 10]],
  },
  {
    id: 'winter',
    when: (m) => m === 11,
    wall: [['❄️', 6, 26, 0], ['❄️', 16, 18, 20], ['⭐', 50, 20, 0]],
    floor: [['🎄', 2, 44, 0], ['🎁', 13, 24, -6]],
  },
];

function drawSeason() {
  const now = new Date();
  const s = SEASONS.find((x) => x.when(now.getMonth(), now.getDate()));
  root.dataset.season = s?.id || '';
  const place = (list) =>
    (list || []).reduce(
      (h, [e, left, size, turn]) => h + `<i style="left:${left}%;font-size:${size}px;transform:rotate(${turn}deg)">${e}</i>`,
      '',
    );
  $('#decoWall').innerHTML = place(s?.wall);
  $('#decoFloor').innerHTML = place(s?.floor);
}

/* ---------- Medal decorations on the shelf ---------- */
// They stand on the shelf after the books; tap one to see which medal won it

function drawTrinkets() {
  const won = MEDALS.reduce(
    (h, m) => (hasMedal(m) ? h + `<button class="trinket" data-m="${m.id}" aria-label="${m.decoName}">${m.deco}</button>` : h),
    '',
  );
  $('#shelf').insertAdjacentHTML('beforeend', won);
}
$('#shelf').addEventListener('click', (e) => {
  const t = e.target.closest('.trinket');
  if (!t) return;
  const m = MEDALS.find((x) => x.id === t.dataset.m);
  toast(`${m.deco} ${m.decoName} · 🏅 ${m.name}`);
});

/* ---------- Keeping it all up to date ---------- */

function drawRoom() {
  root.dataset.time = timeOfDay();
  lightning();
  updateSound();
}
on('look', drawRoom); // the window's view changed (Customize)
on('weather', drawRoom); // new weather, or new sunrise/sunset times
on('change', drawTrinkets); // after the shelf is redrawn (06-attic.js)
setInterval(() => {
  drawRoom();
  drawSeason();
}, 5 * 6e4);
drawRoom();
drawSeason();
drawTrinkets();
