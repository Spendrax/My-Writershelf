'use strict';
// WRITING SPRINT — "⏱ Writing sprint" on today's note: pick 10, 15 or 25 minutes, then write as much as you can
// before the candle burns down (in Google Docs, or with Open and write). A bar at the top shows the candle,
// the time left and the words written so far. At the end your buddy cheers.
//   set.sprint = { start, end, from (words in all your books at the start) } while one is going on, so it
//   carries on if the app is closed; set.sprints = { count, best } for after.

let editorExtra = 0; // words typed in Open and write that aren't saved yet (they count already)
const sprintWords = () => Math.max(0, books.reduce((t, b) => t + (b.words || 0), 0) - set.sprint.from + editorExtra);

function startSprint(min) {
  const now = Date.now();
  set.sprint = { start: now, end: now + min * 6e4, from: books.reduce((t, b) => t + (b.words || 0), 0) };
  saveSet();
  $('#dlgSprint').close();
  say('🕯️ Go go go!', 3000);
  tickSprint();
}

// Every second: the candle, the time left, the words
let sprintT = 0;
function tickSprint() {
  clearTimeout(sprintT);
  const s = set.sprint;
  const bar = $('#sprintBar');
  bar.hidden = !s;
  if (!s) return;
  const left = s.end - Date.now();
  if (left <= 0) return endSprint();
  const mins = Math.floor(left / 6e4);
  const secs = String(Math.floor((left % 6e4) / 1000)).padStart(2, '0');
  const burnt = 1 - left / (s.end - s.start);
  bar.innerHTML = `<span class="candle" style="--wax:${Math.round((1 - burnt) * 100)}%"><i></i></span>
    <b>${mins}:${secs}</b><span>+${num(sprintWords())} words</span>
    <button class="x" id="sprintStop" aria-label="Stop the sprint">✕</button>`;
  // the word counts from Google Docs are read again every minute meanwhile
  if (Date.now() - refreshedAt > 6e4) refreshAll();
  sprintT = setTimeout(tickSprint, 1000);
}

async function endSprint(stopped) {
  const s = set.sprint;
  if (!s) return;
  if (!stopped) await refreshAll().catch(() => {}); // the very last words
  const words = sprintWords();
  set.sprint = null;
  set.sprints = set.sprints || { count: 0, best: 0 };
  if (!stopped) {
    set.sprints.count++;
    set.sprints.best = Math.max(set.sprints.best, words);
  }
  saveSet();
  tickSprint();
  if (stopped) return toast('Sprint stopped');
  if (words) confetti();
  pet.classList.add('jump');
  setTimeout(() => pet.classList.remove('jump'), 1600);
  say(words ? `🎉 Sprint done: +${num(words)} words!` : 'Sprint done! Next time for sure', 6000);
}

$('#todayNote').addEventListener('click', (e) => e.target.id === 'sprintBtn' && $('#dlgSprint').showModal());
$('#dlgSprint').onclick = (e) => e.target.dataset.min && startSprint(+e.target.dataset.min);
$('#sprintBar').onclick = (e) => e.target.id === 'sprintStop' && confirm('Stop the sprint?') && endSprint(true);
on('writing', (total) => (editorExtra = writing ? Math.max(0, total - (writing.b.words || 0)) : 0));
on('saved', () => (editorExtra = 0));
$('#dlgWrite').addEventListener('close', () => (editorExtra = 0));
// back in the app after the time was up: it ends now
document.addEventListener('visibilitychange', () => !document.hidden && tickSprint());
tickSprint();
