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

// Books still being written first, finished ones at the end; inside each, the last one touched first
function drawShelf() {
  const order = (b) => (b.status === 'done' ? 1 : 0);
  const list = books.slice().sort((a, b) => order(a) - order(b) || (b.updated || b.added) - (a.updated || a.added));
  $('#shelf').innerHTML = list.length
    ? list.reduce((h, b) => h + spineHTML(b), '')
    : '<p class="empty">Your shelf is empty.<br>Tap + to add the book you’re writing.</p>';
}

$('#todayNote').onclick = (e) => e.target.id === 'resync' && refreshAll(true);

on('change', () => {
  drawToday();
  drawShelf();
});
drawToday();
drawShelf();
