'use strict';
// WHAT'S NEW — after an important update, a card lists what changed (newest first).
// To announce an update: add an entry at the top of NEWS with the new VERSION.
// Small fixes don't need an entry. The card is also in Settings → "What's new".

const NEWS = [
  {
    v: '1.4',
    items: ['\u{1F408} Your buddy jumps up onto the shelves, today\u2019s note and the cards on its own'],
  },
  {
    v: '1.3',
    items: [
      '\u{1F43E} Let go of your buddy above a shelf, today\u2019s note or a card: it lands on it',
      '\u{1F356} Tap the food bowl on the floor: your buddy comes over to eat',
    ],
  },
  {
    v: '1.2',
    items: [
      '\u270B Pick up your buddy and put it down anywhere. Hold it at the side of the screen to carry it to the next wall',
      '\u{1F3A8} Customize shows you what you are changing',
      '\u2B07 An Install button while the app isn\u2019t installed, and a new icon',
    ],
  },
  {
    v: '1.1',
    items: [
      '\u{1F3A8} Customize the attic: string lights, walls, floor, rug and the view from the window',
      '\u{1F43E} Choose your buddy: cat, dog, fox, bunny, bear or mouse, and its fur',
      '\u{1F463} Your buddy walks around and visits the other walls',
    ],
  },
  {
    v: '1.0',
    items: [
      '\u{1F4DA} Your books on an attic shelf: each spine fills up as you get closer to its word goal',
      '\u{1F4C4} Pick your Google Docs: word counts are read by themselves',
      '\u{1F525} A daily word goal and a streak',
      '✍️ Write here: your text is added at the end of your Google Doc',
      '☁ Automatic Google Drive backup that also syncs your devices',
    ],
  },
];

// Compares versions number by number, so 1.10 comes after 1.9
const newer = (a, b) => {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  }
  return false;
};

function showNews(since) {
  const list = NEWS.reduce(
    (h, n) =>
      !since || newer(n.v, since)
        ? h + `<h3>Version ${n.v}</h3><ul>${n.items.reduce((li, t) => li + `<li>${esc(t)}</li>`, '')}</ul>`
        : h,
    '',
  );
  if (!list) return;
  $('#newsBody').innerHTML = list;
  $('#dlgNews').showModal();
}

// Shown by itself only after an update (a brand-new install has seen nothing yet, so it skips the card)
const lastSeen = set.seen; // read before it's updated below
if (lastSeen && newer(VERSION, lastSeen)) setTimeout(() => showNews(lastSeen), 900);
set.seen = VERSION;
saveSet();

$('#sNews').onclick = () => {
  $('#dlgSet').close();
  showNews();
};
