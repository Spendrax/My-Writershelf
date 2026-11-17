'use strict';
// THE BUDDY — a cat on the attic rug. It cheers when you write, celebrates the daily goal,
// nudges you when the day is going by without words, and sleeps at night. Tap it to hear from it.

const pet = $('#pet');

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

// happy once the goal is done, asleep at night, sad when a streak is about to be lost
function drawBuddy() {
  const hour = new Date().getHours();
  const done = wroteToday() >= set.goal;
  pet.className =
    'pet ' + (done ? 'happy' : hour >= 23 || hour < 6 ? 'asleep' : streak() && hour >= 20 ? 'sad' : '');
  pet.setAttribute('aria-label', set.pet);
}

pet.onclick = () => say(buddyLine());
pet.onkeydown = (e) => e.key === 'Enter' && pet.click();

on('change', drawBuddy);
on('goal', () => {
  drawBuddy();
  pet.classList.add('jump');
  setTimeout(() => pet.classList.remove('jump'), 1600);
  say('🎉 Daily goal done!', 6000);
});
drawBuddy();
setTimeout(() => say(buddyLine()), 1200);
