'use strict';
// BOOK CARD — shown when you tap a book: how far it is, its chapters, and the buttons to write, open the Doc,
// refresh, edit. The chapters come from the headings in the Google Doc, each with its number of words;
// tap one to open the book right there.

function openBook(id) {
  const b = byId(id);
  if (!b) return;
  const st = STATUS[b.status] || STATUS.draft;
  const left = Math.max(0, (b.target || 0) - (b.words || 0));
  $('#bBody').innerHTML = `
    <div class="sheet-h"><h2 class="btitle">${esc(b.title)}</h2><button class="x" data-close aria-label="Close">✕</button></div>
    <span class="pill" style="--sc:${st.color}">${st.label}</span>
    <p class="bwords"><b>${num(b.words)}</b> <span class="dim">${b.target ? `/ ${num(b.target)} words` : 'words'}</span></p>
    ${b.target ? `<div class="meter"><i style="width:${pct(b)}%"></i></div><p class="dim small">${left ? `${pct(b)}% · ${num(left)} words left` : 'Word goal reached!'}</p>` : ''}
    ${b.notes ? `<p class="notes">${esc(b.notes)}</p>` : ''}
    <p class="dim small move-h">Move to</p>
    <div class="seg move">${SHELVES.reduce((h, s) => h + `<button data-shelf="${s.id}"${shelfOf(b) === s ? ' class="on"' : ''}>${s.name}</button>`, '')}</div>
    ${
      b.doc
        ? `<button class="btn primary wide" data-do="write">📖 Open and write</button>
           <a class="btn wide" href="${docLink(b)}" target="_blank" rel="noopener">📄 Open in Google Docs</a>
           <button class="btn ghost wide" data-do="refresh">⟳ Read the word count again</button>
           <div id="bChapters" class="chapters"></div>`
        : ''
    }
    <button class="btn ghost wide" data-do="edit">Edit</button>`;
  $('#bBody').dataset.id = id;
  if (!$('#dlgBook').open) $('#dlgBook').showModal();
  if (b.doc && googleOn()) drawChapters(b);
}

// The headings of the Doc (that aren't empty), each with the words written under it until the next heading
function chaptersOf(paras) {
  return paras.reduce((list, p, i) => {
    if (p.h && p.text.trim()) return list.concat({ i, name: p.text.replace(/\v/g, ' ').trim(), lvl: p.lvl, words: 0 });
    if (list.length) list[list.length - 1].words += countWords(p.text);
    return list;
  }, []);
}

// chapters named like one (Chapter, Chapitre, Capítulo…), or else every heading, count as chapters
const CHAPTER_WORD = /chap|cap[ií]t|kapitel|chapit/i;

async function drawChapters(b) {
  const box = $('#bChapters');
  box.innerHTML = '<p class="dim small">…</p>';
  let doc;
  try {
    doc = await readDoc(b);
  } catch {
    return (box.innerHTML = '');
  }
  if ($('#bBody').dataset.id !== b.id) return; // another book was opened meanwhile
  const list = chaptersOf(doc.paras);
  if (!list.length) return (box.innerHTML = '');
  const top = list.reduce((m, c) => Math.min(m, c.lvl || 1), 9); // the biggest heading level used
  box.innerHTML =
    '<h3>Chapters</h3>' +
    list.reduce(
      (h, c) =>
        h + `<button class="chap" data-at="${c.i}" style="padding-left:${8 + Math.max(0, (c.lvl || 1) - top) * 14}px"><span>${esc(c.name)}</span><small>${num(c.words)}</small></button>`,
      '',
    );
  const named = list.reduce((n, c) => n + CHAPTER_WORD.test(c.name), 0);
  countChapters(b, named || list.length); // a new chapter since last time: a little party (22-buddy-life.js)
}

$('#bBody').onclick = async (e) => {
  const what = e.target.closest('[data-do]')?.dataset.do;
  const b = byId($('#bBody').dataset.id);
  // Move to another shelf
  const to = SHELVES.find((s) => s.id === e.target.closest('[data-shelf]')?.dataset.shelf);
  if (to && b && shelfOf(b) !== to) {
    b.status = to.status;
    b.updated = Date.now();
    save();
    toast(`Moved to ${to.name}`);
    return openBook(b.id);
  }
  const chap = e.target.closest('.chap');
  if (chap && b) {
    $('#dlgBook').close();
    return openWrite(b, +chap.dataset.at);
  }
  if (!what || !b) return;
  if (what === 'refresh') {
    try {
      await refreshBook(b, true, true);
      save();
      toast('Word counts are up to date');
    } catch {
      toast('Couldn’t read this Doc. Is Google connected?');
    }
    return openBook(b.id);
  }
  $('#dlgBook').close();
  if (what === 'edit') openEdit(b);
  if (what === 'write') openWrite(b);
};
