'use strict';
// BOOK CARD — shown when you tap a book: how far it is, and the buttons to write, open the Doc, refresh, edit.

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
    ${
      b.doc
        ? `<button class="btn primary wide" data-do="write">✍️ Write here</button>
           <a class="btn wide" href="${docLink(b)}" target="_blank" rel="noopener">📄 Open in Google Docs</a>
           <button class="btn ghost wide" data-do="refresh">⟳ Read the word count again</button>`
        : ''
    }
    <button class="btn ghost wide" data-do="edit">Edit</button>`;
  $('#bBody').dataset.id = id;
  if (!$('#dlgBook').open) $('#dlgBook').showModal();
}

$('#bBody').onclick = async (e) => {
  const what = e.target.closest('[data-do]')?.dataset.do;
  const b = byId($('#bBody').dataset.id);
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
