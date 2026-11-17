'use strict';
// THE BUDDY'S WALKS — it wanders along the floor, rests, and now and then walks off the side of a wall
// and comes in on the floor of the next one (the three floors are one floor going round the room).
// It likes company: when you turn to another wall, it usually comes over. It stays put while asleep.
// You can pick it up and put it down anywhere; held at the side of the screen, it's carried to the next wall.
//   where = { wall, x }: which wall's floor it is on (-1 Goals, 0 Attic, 1 Stats) and how far from the left

const PET_SPEED = 55; // pixels a second
const PET_W = 76;
const PET_H = 78;
const PET_FLOOR = 50; // how far above the bottom of the floor it stands (css/buddy.css)
const where = { wall: 0, x: 90 };
let petTimer = 0;

const floorOf = (k) => $(`#view-${Object.keys(WALLS).find((v) => WALLS[v] === k)} .floor`);
const floorWidth = () => floorOf(where.wall).clientWidth;

// Puts it at x right away (no walking)
function placePet(x) {
  where.x = x;
  pet.style.transition = 'none';
  pet.style.transform = `translateX(${x}px)`;
  pet.classList.toggle('right', x > floorWidth() / 2); // the bubble opens toward the middle
  void pet.offsetWidth; // so the next walk starts from here
}

// Walks along the floor to x, then does `then`
function walkPet(x, then) {
  const secs = Math.abs(x - where.x) / PET_SPEED;
  pet.classList.toggle('flip', x < where.x);
  pet.classList.add('walk');
  pet.style.transition = `transform ${secs}s linear`;
  pet.style.transform = `translateX(${x}px)`;
  clearTimeout(petTimer);
  petTimer = setTimeout(() => {
    where.x = x;
    pet.classList.remove('walk');
    pet.classList.toggle('right', x > floorWidth() / 2);
    then();
  }, secs * 1000);
}

const restPet = (ms = 3000 + Math.random() * 6000) => {
  clearTimeout(petTimer);
  petTimer = setTimeout(wanderPet, ms);
};
const somewhere = () => 10 + Math.random() * (floorWidth() - PET_W - 20);

// Walks off the side toward wall k, and comes in on the next wall's floor (one wall at a time)
function petGo(k) {
  const dir = Math.sign(k - where.wall);
  if (!dir) return walkPet(somewhere(), restPet);
  walkPet(dir > 0 ? floorWidth() + 10 : -PET_W - 10, () => {
    where.wall += dir;
    floorOf(where.wall).append(pet);
    placePet(dir > 0 ? -PET_W - 10 : floorWidth() + 10);
    where.wall === k ? walkPet(somewhere(), restPet) : petGo(k);
  });
}

// What next: usually join you on the wall you're looking at; sometimes explore the wall next door
function wanderPet() {
  if (pet.classList.contains('asleep')) return restPet(60e3);
  const yours = WALLS[view];
  if (yours !== where.wall && Math.random() < 0.7) return petGo(yours);
  const next = where.wall + (Math.random() < 0.5 ? -1 : 1);
  if (Math.random() < 0.15 && next >= FIRST && next <= LAST) return petGo(next);
  walkPet(somewhere(), restPet);
}

// You turned to another wall: it thinks about following soon (unless it's already on its way somewhere)
on('view', () => pet.classList.contains('walk') || restPet(1500 + Math.random() * 2500));
addEventListener('resize', () => pet.classList.contains('walk') || placePet(Math.min(where.x, floorWidth() - PET_W)));

/* ---------- Picking it up ---------- */
// Press and move: it follows your finger. Let go: it drops back to the floor right there.
// A press without moving is a tap: it talks (08-buddy.js).

let hold = null; // while a finger is on it: { id, ox, oy (where on the buddy you grabbed), moved, side, t }

pet.addEventListener('pointerdown', (e) => {
  const r = pet.getBoundingClientRect();
  hold = { id: e.pointerId, ox: e.clientX - r.left, oy: e.clientY - r.top, sx: e.clientX, sy: e.clientY };
});

// Where the finger is, as a place on the floor of the wall it's on: x from the left, y above (−) the floor line
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
    pet.classList.remove('walk');
    pet.classList.add('held');
    pet.style.transition = 'none';
  }
  const { x, y } = fingerSpot(e);
  where.x = x;
  pet.style.transform = `translate(${x}px, ${y}px)`;
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
  where.x = Math.max(0, Math.min(where.x, floorWidth() - PET_W));
  pet.classList.remove('held');
  pet.classList.toggle('right', where.x > floorWidth() / 2);
  pet.style.transition = 'transform 0.3s ease-in'; // falls to the floor
  pet.style.transform = `translate(${where.x}px, 0)`;
  restPet(4000);
}
addEventListener('pointerup', dropPet);
addEventListener('pointercancel', dropPet);

placePet(where.x);
restPet(4000);
