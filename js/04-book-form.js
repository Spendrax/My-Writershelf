'use strict';
// BOOK FORM — adding a book by hand and editing any book: title, status, words, word goal, spine colour, notes.
// A book linked to a Google Doc gets its words from the Doc, so that box is locked for it.

const fEdit = $('#fEdit');
let editing = null; // the book being edited (a new one isn't in `books` until it's saved)

$('#eStatus').innerHTML = Object.entries(STATUS).reduce(
  (h, [k, s]) => h + `<button type="button" data-s="${k}" style="--sc:${s.color}">${s.label}</button>`,
  '',
);
$('#eColor').innerHTML = SPINES.reduce(
  (h, c) => h + `<button type="button" data-c="${c}" style="--c:${c}" aria-label="Colour"></button>`,
  '',
);
const mark = (box, attr, v) => $$('button', box).forEach((b) => b.classList.toggle('on', b.dataset[attr] === v));

function openEdit(b) {
  editing = b || { id: uid(), title: '', doc: '', words: 0, target: 50000, status: 'draft', color: SPINES[books.length % SPINES.length], added: Date.now() };
  $('#editH').textContent = b ? 'Edit the book' : 'New book';
  fEdit.title.value = editing.title;
  fEdit.words.value = editing.words || '';
  fEdit.words.readOnly = !!editing.doc;
  $('#eDocHint').hidden = !editing.doc;
  fEdit.target.value = editing.target || '';
  fEdit.notes.value = editing.notes || '';
  mark($('#eStatus'), 's', editing.status);
  mark($('#eColor'), 'c', editing.color);
  $('#eDel').hidden = !b;
  $('#dlgEdit').showModal();
}

$('#eStatus').onclick = (e) => e.target.dataset.s && mark($('#eStatus'), 's', (editing.status = e.target.dataset.s));
$('#eColor').onclick = (e) => e.target.dataset.c && mark($('#eColor'), 'c', (editing.color = e.target.dataset.c));

fEdit.onsubmit = (e) => {
  e.preventDefault();
  const isNew = !byId(editing.id);
  editing.title = fEdit.title.value.trim();
  editing.target = Math.max(0, Math.round(+fEdit.target.value || 0));
  editing.notes = fEdit.notes.value.trim();
  // words typed here: a new book's words were written before today, later changes count for today
  if (!editing.doc) setWords(editing, Math.max(0, Math.round(+fEdit.words.value || 0)), !isNew);
  editing.updated = Date.now();
  if (isNew) books.unshift(editing);
  save();
  $('#dlgEdit').close();
  toast(isNew ? 'Book added' : 'Saved');
};

$('#eDel').onclick = () => {
  if (!confirm(`Take “${editing.title}” off your shelf? Your Google Doc is not touched.`)) return;
  books = books.filter((b) => b.id !== editing.id);
  (set.gone ||= []).push({ id: editing.id, at: Date.now() }); // so a sync doesn't bring it back
  localStorage.removeItem('ws.draft.' + editing.id);
  saveSet();
  save();
  $('#dlgEdit').close();
  toast('Removed');
};

$('#addManual').onclick = () => {
  $('#dlgAdd').close();
  openEdit();
};
