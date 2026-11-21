'use strict';
// THE DAILY PROMPT — a small note pinned on the attic wall with an idea to get you writing, a new one each day.
// Tap it for another one. Add ideas to PROMPTS; they're translated in js/lang/ like the rest of the app.

const PROMPTS = [
  'Write the scene your main character would least like anyone to see',
  'Someone lies in this scene. Who, and why?',
  'Describe the place your story is in using only sounds and smells',
  'Your villain gets one perfect day. What does it look like?',
  'Start a scene in the middle of an argument',
  'A letter arrives that should never have been sent',
  'Write what your character dreams about tonight',
  'Something small goes missing. It matters more than anyone thinks',
  'Two characters are stuck waiting together. Let them talk',
  'Show a memory your main character keeps going back to',
  'Write a scene with no dialogue at all',
  'A secret comes out at the worst possible time',
  'Your character breaks a promise. Write what comes after',
  'Describe a meal that changes everything',
  'Something your character believed turns out to be wrong',
  'Write the moment just before everything goes wrong',
  'A stranger knows your character’s name',
  'Write a goodbye that isn’t said out loud',
  'Your character has to choose between two people',
  'Give a side character a moment to shine',
  'The weather changes the plan',
  'Write the first time your character feels truly afraid',
  'Something old and forgotten is found',
  'Your character laughs at the wrong moment',
  'A door that is always locked is open today',
  'Write the scene from the other character’s eyes',
  'Someone your character trusts asks for something strange',
  'End the chapter with a question',
  'Your character finally says what they’ve been holding back',
  'Write 100 words about what your character wants most',
];

// Today's prompt: one a day, in turn; tapping moves to the next one for today
function promptToday() {
  const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4) / 864e5);
  if (set.promptDay !== day) set.promptShift = 0; // a new day starts at its own prompt
  set.promptDay = day;
  return PROMPTS[(day + (set.promptShift || 0)) % PROMPTS.length];
}

function drawPrompt() {
  $('#promptNote').innerHTML = `<b>✍️ Idea of the day</b><span>${esc(promptToday())}</span>`;
}

$('#promptNote').onclick = () => {
  set.promptShift = (set.promptShift || 0) + 1;
  saveSet();
  drawPrompt();
};
setInterval(drawPrompt, 30 * 6e4); // a new day while the app is open
drawPrompt();
