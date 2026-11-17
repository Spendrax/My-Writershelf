'use strict';
// THE BUDDY'S WALKS — it wanders along the floor, rests, and now and then walks off the side of a wall
// and comes in on the floor of the next one (the three floors are one floor going round the room).
// It likes company: when you turn to another wall, it usually comes over. It stays put while asleep.
//   where = { wall, x }: which wall's floor it is on (-1 Goals, 0 Attic, 1 Stats) and how far from the left

const PET_SPEED = 55; // pixels a second
const PET_W = 76;
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

placePet(where.x);
restPet(4000);
