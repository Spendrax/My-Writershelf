'use strict';
// PLAYING WITH THE BUDDY
//   • tap it: a little heart and it tells you how today is going
//   • tap it twice quickly: it does a happy spin
//   • hold your finger on it: you're petting it — hearts float up and it makes its happy sound
//   • tap the floor: it comes to that spot (even from another wall)
// Petting counts toward the "Pet your buddy 25 times" medal (19-achievements.js). Picking it up is in 16-buddy-moves.js.

let lastTap = 0;
let petting = null; // while you hold your finger on it: { timer, hearts } (the timer waits to tell a hold from a tap)

function heart() {
  const h = Object.assign(document.createElement('i'), { className: 'heart', textContent: '❤' });
  h.style.left = 20 + Math.random() * 36 + 'px';
  pet.append(h);
  setTimeout(() => h.remove(), 1100);
}

function petted() {
  set.pets = (set.pets || 0) + 1;
  saveSet();
  emit('pet');
}

pet.onclick = () => {
  if (petting?.done) return (petting = null); // the end of a hold, not a tap
  const now = Date.now();
  heart();
  if (now - lastTap < 350) {
    // two taps: a happy spin
    pet.classList.remove('spin');
    void pet.offsetWidth;
    pet.classList.add('spin');
    setTimeout(() => pet.classList.remove('spin'), 700);
    say('🎉 Wheee!', 1800);
  } else {
    say(buddyLine());
    petted();
  }
  lastTap = now;
};

/* ---------- Holding your finger on it: petting ---------- */

pet.addEventListener('pointerdown', () => {
  clearTimeout(petting?.timer);
  petting = {
    timer: setTimeout(() => {
      if (pet.classList.contains('held')) return; // it's being carried, not petted
      petting.done = true;
      pet.classList.add('petted');
      say(ANIMALS[set.look.kind]?.pet || '💕', 60e3);
      heart();
      petting.hearts = setInterval(heart, 350);
      petted();
    }, 450),
  };
});
function stopPetting() {
  if (!petting) return;
  clearTimeout(petting.timer);
  clearInterval(petting.hearts);
  pet.classList.remove('petted');
  if (petting.done) {
    clearTimeout(say.t);
    say.t = setTimeout(() => pet.classList.remove('talk'), 1500);
  } else petting = null;
}
addEventListener('pointerup', stopPetting);
addEventListener('pointercancel', stopPetting);
// moving your finger while holding it means you're carrying it (16-buddy-moves.js)
addEventListener('pointermove', () => pet.classList.contains('held') && petting && stopPetting());

/* ---------- Tap the floor: it comes over ---------- */

$$('.floor').forEach((floor) =>
  floor.addEventListener('click', (e) => {
    if (e.target !== floor && !e.target.classList.contains('rug')) return; // the bowl, the buddy…
    if (busy() && !pet.classList.contains('walk')) return; // eating
    const k = WALLS[floor.closest('.view').id.replace('view-', '')];
    const x = Math.max(0, Math.min(e.clientX - floor.getBoundingClientRect().left - PET_W / 2, floor.clientWidth - PET_W));
    hopDown(() => petGo(k, x, () => restPet(6000 + Math.random() * 6000)));
  }),
);
