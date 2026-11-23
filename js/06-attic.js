'use strict';
// THE ATTIC — the main wall: today's note pinned under the roof, and the shelf of books.

// Today's note: words written today against the daily goal, and the streak
function drawToday() {
  const n = wroteToday();
  const done = n >= set.goal;
  $('#todayNote').innerHTML = `
    <h2>Today</h2>
    <p class="big"><b>${num(n)}</b> / ${num(set.goal)} words</p>
    <div class="meter"><i style="width:${Math.min(100, (n / set.goal) * 100)}%"></i></div>
    <p class="row2"><span>${done ? '✅ Daily goal done!' : `${num(set.goal - n)} words to go`}</span><span>🔥 ${streak()}</span></p>
    <button class="sprint-btn" id="sprintBtn">⏱ Writing sprint</button>
    ${books.some((b) => b.doc) ? '<button class="resync" id="resync" aria-label="Read the word count again">⟳</button>' : ''}`;
}

// One shelf for each of SHELVES (01-core.js), each with its name on a plaque; inside, the book touched last
// comes first. The Writing shelf is always there; the others only once they hold a book.
function drawShelf() {
  if (!books.length) return ($('#shelf').innerHTML = '<p class="empty">Your shelf is empty.<br>Tap + to add the book you’re writing.</p>');
  const recent = books.slice().sort((a, b) => (b.updated || b.added) - (a.updated || a.added));
  $('#shelf').innerHTML = SHELVES.reduce((h, shelf) => {
    const spines = recent.reduce((s, b) => (shelfOf(b) === shelf ? s + spineHTML(b) : s), '');
    if (!spines && shelf.id !== 'writing') return h;
    return (
      h +
      `<section class="shelf-group" data-shelf="${shelf.id}"><h3 class="plaque">${shelf.name}</h3>` +
      `<div class="shelf">${spines || '<p class="empty small">Nothing being written right now</p>'}</div></section>`
    );
  }, '');
}

$('#todayNote').onclick = (e) => e.target.id === 'resync' && refreshAll(true);

on('change', () => {
  drawToday();
  drawShelf();
});
drawToday();
drawShelf();
