'use strict';
// THE BUDDY'S WALKS — it wanders along the floor, rests, and now and then walks off the side of a wall
// and comes in on the floor of the next one (the three floors are one floor going round the room).
// It likes company: when you turn to another wall, it usually comes over. It stays put while asleep.
//   • now and then it jumps up onto something on its own (a shelf board, today's note, a card)
//   • pick it up and let go: it falls onto whatever is below it (a shelf board, today's note, a card, the floor)
//   • held at the side of the screen, it's carried to the next wall
//   • tap a food bowl on the floor: it comes over and eats
//   where = { wall, x, y }: which wall it's on (-1 Goals, 0 Attic, 1 Stats), how far from the left of the floor,
//   and how far above the floor (0 on the floor, negative when it's up on something)
//   where.on = what it's standing on (see surfaces()), so it stays on it when the walls change size

const PET_SPEED = 55; // pixels a second
const PET_W = 76;
const PET_H = 78;
const PET_FLOOR = 50; // how far above the bottom of the floor it stands (css/buddy.css)
const where = { wall: 0, x: 90, y: 0, on: null };
let petTimer = 0;

const floorOf = (k) => $(`#view-${Object.keys(WALLS).find((v) => WALLS[v] === k)} .floor`);
const floorWidth = () => floorOf(where.wall).clientWidth;
const busy = () => pet.classList.contains('walk') || pet.classList.contains('eat');

const moveTo = (x, y, secs, ease = 'linear') => {
  pet.style.transition = secs ? `transform ${secs}s ${ease}` : 'none';
  pet.style.transform = `translate(${x}px, ${y}px)`;
};

// Puts it at x on the floor right away (no walking)
function placePet(x) {
  Object.assign(where, { x, y: 0, on: null });
  moveTo(x, 0, 0);
  pet.classList.toggle('right', x > floorWidth() / 2); // the bubble opens toward the middle
  void pet.offsetWidth; // so the next walk starts from here
}

// Walks along the floor to x, then does `then`
function walkPet(x, then) {
  const secs = Math.abs(x - where.x) / PET_SPEED;
  pet.classList.toggle('flip', x < where.x);
  pet.classList.add('walk');
  moveTo(x, 0, secs);
  clearTimeout(petTimer);
  petTimer = setTimeout(() => {
    where.x = x;
    pet.classList.remove('walk');
    pet.classList.toggle('right', x > floorWidth() / 2);
    then();
  }, secs * 1000);
}

// Up on something: hops down to the floor first, then does `then`
function hopDown(then) {
  if (!where.y) return then();
  Object.assign(where, { y: 0, on: null });
  moveTo(where.x, 0, 0.35, 'ease-in');
  clearTimeout(petTimer);
  petTimer = setTimeout(then, 400);
}

const restPet = (ms = 3000 + Math.random() * 6000) => {
  clearTimeout(petTimer);
  petTimer = setTimeout(wanderPet, ms);
};
const somewhere = () => 10 + Math.random() * (floorWidth() - PET_W - 20);

// Walks off the side toward wall k, comes in on the next wall's floor (one wall at a time), walks to x there
function petGo(k, x = somewhere(), then = restPet) {
  const dir = Math.sign(k - where.wall);
  if (!dir) return walkPet(x, then);
  walkPet(dir > 0 ? floorWidth() + 10 : -PET_W - 10, () => {
    where.wall += dir;
    floorOf(where.wall).append(pet);
    placePet(dir > 0 ? -PET_W - 10 : floorWidth() + 10);
    petGo(k, x, then);
  });
}

// What next: up on something, it often stays a while; usually it joins you on the wall you're looking at;
// sometimes it jumps up onto something, or explores the wall next door
function wanderPet() {
  if (pet.classList.contains('asleep')) return restPet(60e3);
  if (where.y && Math.random() < 0.5) return restPet();
  hopDown(() => {
    const yours = WALLS[view];
    if (yours !== where.wall && Math.random() < 0.7) return petGo(yours);
    if (Math.random() < 0.3 && jumpUp()) return;
    const next = where.wall + (Math.random() < 0.5 ? -1 : 1);
    if (Math.random() < 0.15 && next >= FIRST && next <= LAST) return petGo(next);
    walkPet(somewhere(), restPet);
  });
}

// You turned to another wall: it thinks about following soon (unless it's already busy)
on('view', () => busy() || restPet(1500 + Math.random() * 2500));

/* ---------- Landing on things ---------- */
// The tops of things it can stand on, on the wall it's on, measured on the screen: { top, left, right, on }
// `on` names it: 'thing0', 'thing1'… (today's note, the cards, in page order; cards are redrawn often, so
// they're named by their place, not kept as elements), or 'board0', 'board1'… for the shelf's boards

function surfaces() {
  const wall = floorOf(where.wall).closest('.view');
  const tops = $$('.pinned, .card, .kpi', wall).reduce((list, el, i) => {
    const r = el.getBoundingClientRect();
    return list.concat({ top: r.top, left: r.left, right: r.right, on: 'thing' + i });
  }, []);
  // the shelf's boards: one under each row of books (every 172px, see .shelf in css/attic.css)
  const shelf = $('.shelf', wall);
  if (!shelf) return tops;
  const s = shelf.getBoundingClientRect();
  for (let top = s.top + 150, n = 0; top < s.bottom - 10; top += 172, n++)
    tops.push({ top, left: s.left + 12, right: s.right - 12, on: 'board' + n });
  return tops;
}

// Picks something on its wall it can reach (not too high, in view, wide enough), walks under it and jumps up.
// Answers false if there's nothing to jump on.
function jumpUp() {
  const f = floorOf(where.wall).getBoundingClientRect();
  const ground = f.bottom - PET_FLOOR;
  const spots = surfaces().reduce((list, s) => {
    const high = ground - s.top;
    const fits = s.right - s.left > PET_W + 10 && s.top > 70 && s.top < innerHeight;
    return fits && high > 40 && high < 360 ? list.concat(s) : list;
  }, []);
  if (!spots.length) return false;
  const s = spots[Math.floor(Math.random() * spots.length)];
  const x = s.left - f.left + 5 + Math.random() * (s.right - s.left - PET_W - 10);
  const y = s.top - ground;
  walkPet(x, () => {
    // up a little past it, then down onto it
    Object.assign(where, { y, on: s.on });
    pet.classList.add('leap');
    moveTo(x, y - 24, 0.4, 'ease-out');
    petTimer = setTimeout(() => {
      moveTo(x, y, 0.15, 'ease-in');
      pet.classList.remove('leap');
      restPet();
    }, 420);
  });
  return true;
}

// Falls straight down from where it is onto the first thing below its feet (or the floor)
function landPet() {
  const f = floorOf(where.wall).getBoundingClientRect();
  const ground = f.bottom - PET_FLOOR; // where its feet are when it's on the floor
  where.x = Math.max(0, Math.min(where.x, floorWidth() - PET_W));
  const feet = ground + where.y;
  const mid = f.left + where.x + PET_W / 2;
  const below = surfaces().reduce(
    (best, s) => (s.left <= mid && mid <= s.right && s.top >= feet - 12 && s.top < best.top ? s : best),
    { top: ground, on: null },
  );
  const y = below.top < ground - 5 ? below.top - ground : 0;
  where.on = y ? below.on : null;
  const secs = Math.min(0.6, 0.15 + Math.abs(y - where.y) / 900); // a longer fall takes a little longer
  where.y = y;
  moveTo(where.x, y, secs, 'ease-in');
  pet.classList.toggle('right', where.x > floorWidth() / 2);
}
// The walls changed size (Customize opened, a book added, the phone turned…): it stays on what it was standing on
function keepFooting() {
  if (busy() || hold) return;
  if (!where.on) return placePet(Math.min(where.x, floorWidth() - PET_W));
  const s = surfaces().find((t) => t.on === where.on);
  if (!s) return landPet(); // it's gone (a row of books removed): falls to what's below
  const f = floorOf(where.wall).getBoundingClientRect();
  where.y = s.top - (f.bottom - PET_FLOOR);
  where.x = Math.max(s.left - f.left, Math.min(where.x, s.right - f.left - PET_W));
  moveTo(where.x, where.y, 0);
}
const footing = new ResizeObserver(() => keepFooting());
$$('.view, .shelf').forEach((el) => footing.observe(el));
on('change', () => setTimeout(keepFooting, 50)); // the cards were redrawn

/* ---------- Picking it up ---------- */
// Press and move: it follows your finger. Let go: it falls onto whatever is below.
// A press without moving is a tap: it talks (08-buddy.js).

let hold = null; // while a finger is on it: { id, ox, oy (where on the buddy you grabbed), moved, side, t }

pet.addEventListener('pointerdown', (e) => {
  const r = pet.getBoundingClientRect();
  hold = { id: e.pointerId, ox: e.clientX - r.left, oy: e.clientY - r.top, sx: e.clientX, sy: e.clientY };
});

// Where the finger is, as a place on the wall it's on: x from the left of the floor, y above (−) the floor
function fingerSpot(e) {
  const f = floorOf(where.wall).getBoundingClientRect();
  return {
    x: e.clientX - hold.ox - f.left,
    y: Math.min(20, e.clientY - hold.oy - (f.bottom - PET_FLOOR - PET_H)),
  };
}

addEventListener('pointermove', (e) => {
  if (!hold || e.pointerId !== hold.id) return;
  if (!hold.moved) {
    if (Math.hypot(e.clientX - hold.sx, e.clientY - hold.sy) < 8) return; // still a tap
    hold.moved = true;
    clearTimeout(petTimer); // whatever it was doing, it stops
    pet.classList.remove('walk', 'eat');
    $$('.bowl.full').forEach((b) => b.classList.remove('full')); // picked up on its way to eat: no meal
    pet.classList.add('held');
  }
  const { x, y } = fingerSpot(e);
  Object.assign(where, { x, y });
  moveTo(x, y, 0);
  // held at the side of the screen for a moment: carried to the wall on that side
  const side = e.clientX < 30 ? -1 : e.clientX > innerWidth - 30 ? 1 : 0;
  if (side === hold.side) return;
  hold.side = side;
  clearTimeout(hold.t);
  const next = where.wall + side;
  if (side && next >= FIRST && next <= LAST) hold.t = setTimeout(() => carryPet(next), 600);
});

function carryPet(k) {
  where.wall = k;
  floorOf(k).append(pet);
  go(k); // the room turns with you
  hold.side = 0;
}

function dropPet(e) {
  if (!hold || e.pointerId !== hold.id) return;
  const was = hold;
  hold = null;
  clearTimeout(was.t);
  if (!was.moved) return; // a tap
  // the tap that follows a drag shouldn't make it talk
  pet.addEventListener('click', (c) => c.stopImmediatePropagation(), { capture: true, once: true });
  pet.classList.remove('held');
  landPet();
  restPet(5000 + Math.random() * 5000);
}
addEventListener('pointerup', dropPet);
addEventListener('pointercancel', dropPet);

/* ---------- Food bowls ---------- */
// One on each floor. Tap it: it fills up, the buddy comes over (from any wall, even asleep) and eats.

$$('.bowl').forEach((bowl) =>
  bowl.addEventListener('click', () => {
    if (bowl.classList.contains('full') || hold) return;
    bowl.classList.add('full');
    say('🍖 Food? Coming!', 2000);
    const k = WALLS[bowl.closest('.view').id.replace('view-', '')];
    const spot = bowl.offsetLeft - PET_W + 16; // just left of the bowl, facing it
    pet.classList.remove('eat');
    hopDown(() =>
      petGo(k, spot, () => {
        pet.classList.remove('flip');
        pet.classList.add('eat');
        petTimer = setTimeout(() => {
          pet.classList.remove('eat');
          bowl.classList.remove('full');
          say('😋 Yum! Thanks!');
          set.fed = (set.fed || 0) + 1; // for the "Feed your buddy 10 times" medal
          saveSet();
          emit('fed');
          restPet();
        }, 3000);
      }),
    );
  }),
);

placePet(where.x);
restPet(4000);
