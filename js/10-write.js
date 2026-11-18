'use strict';
// OPEN AND WRITE — a book's whole Google Doc, in the app:
//   • read everything you've written (it opens at the end, where you left off)
//   • tap any paragraph to change it
//   • keep writing in the box at the bottom
//   • "Save to my Google Doc" sends all of it in one go
// Your changes are kept on this phone at every keystroke (ws.draft.<book id>), so nothing is lost if the app
// closes or you're offline; they're cleared once Google confirms they're in the Doc.
// If the Doc was changed somewhere else since you opened it, Google refuses the save (nothing is overwritten)
// and the app opens the new version, keeping your changes so you can save them again.
// shortcut: text is shown plain (headings stand out, bold/italics don't show), and bold or italics inside a
// paragraph you change are lost in that paragraph. Upgrade: read and send the text styles too.

let writing = null; // { b: the book, rev: the Doc's version, paras: [{ start, end, text, h, fixed }] }
const draftKey = (b) => 'ws.draft.' + b.id;
// what's waiting to be saved: { rev, edits: { paragraph number: new text }, more: text for the end }
function loadDraft(b) {
  const d = load(draftKey(b), null);
  if (d && typeof d === 'object') return { rev: '', edits: {}, more: '', ...d };
  // before version 1.5 only the text for the end was kept, as plain text
  return { rev: '', edits: {}, more: localStorage.getItem(draftKey(b)) || '' };
}

/* ---------- Reading the Doc ---------- */

// The Doc as a list of paragraphs. start/end are Google's positions; a paragraph that holds a picture, or a
// table, is shown but can't be changed here (fixed).
async function readDoc(b) {
  const d = await (await gfetch(`https://docs.googleapis.com/v1/documents/${b.doc}`)).json();
  const paras = (d.body?.content || []).reduce((list, el) => {
    if (el.table) return list.concat({ text: '▦', fixed: true });
    if (!el.paragraph) return list;
    const parts = el.paragraph.elements || [];
    const text = parts.reduce((t, p) => t + (p.textRun?.content || ''), '').replace(/\n$/, '');
    return list.concat({
      start: el.startIndex,
      end: el.endIndex,
      text,
      h: /HEADING|TITLE/.test(el.paragraph.paragraphStyle?.namedStyleType || ''),
      fixed: parts.some((p) => !p.textRun),
    });
  }, []);
  return { rev: d.revisionId, paras };
}

// Keeps what's waiting to be saved, with the version of the Doc it was written on
function keepDraft(draft) {
  draft.rev = writing.rev;
  store(draftKey(writing.b), draft);
}

const docText = (w, edits) => w.paras.reduce((t, p, i) => t + (edits[i] ?? p.text) + '\n', '');

/* ---------- The sheet ---------- */

function drawDoc() {
  const edits = loadDraft(writing.b).edits;
  $('#wDoc').innerHTML = writing.paras.reduce(
    (h, p, i) =>
      h +
      `<p data-i="${i}" class="${p.h ? 'h' : ''}${p.fixed ? ' fixed' : ''}${edits[i] != null ? ' edited' : ''}">${esc(edits[i] ?? p.text) || '<br>'}</p>`,
    '',
  );
}

function drawCount() {
  const draft = loadDraft(writing.b);
  const total = countWords(docText(writing, draft.edits) + draft.more);
  const today = wroteToday() + Math.max(0, total - (writing.b.words || 0));
  const waiting = draft.more.trim() || Object.keys(draft.edits).length;
  $('#wCount').textContent = `${num(total)} words in the book · ${num(today)} / ${num(set.goal)} today`;
  $('#wSend').disabled = !waiting;
}

async function openWrite(b) {
  writing = { b, rev: '', paras: [] };
  $('#wTitle').textContent = b.title;
  $('#wDoc').innerHTML = '<p class="dim">…</p>';
  $('#wText').value = loadDraft(b).more;
  if (!$('#dlgWrite').open) $('#dlgWrite').showModal();
  try {
    Object.assign(writing, await readDoc(b));
  } catch {
    if (writing.b !== b) return;
    $('#wDoc').innerHTML = '';
    toast('Couldn’t read the Doc right now. You can still write: your text is kept here.');
    return drawCount();
  }
  if (writing.b !== b) return; // closed and opened another book meanwhile
  const draft = loadDraft(b);
  // changes made on an older version of the Doc are kept: check them before saving
  if (draft.rev && draft.rev !== writing.rev) {
    toast('The Doc changed in Google Docs: check your changes before saving');
    keepDraft(draft);
  }
  drawDoc();
  drawCount();
  $('#wDoc').scrollTop = 1e7; // where you left off
}

// Tap a paragraph: it becomes editable
$('#wDoc').onclick = (e) => {
  const p = e.target.closest('p[data-i]');
  if (!p || p.isContentEditable) return;
  if (writing.paras[p.dataset.i].fixed) return toast('Pictures and tables can only be changed in Google Docs');
  p.contentEditable = 'plaintext-only';
  p.focus();
};
$('#wDoc').oninput = (e) => {
  const p = e.target.closest('p[data-i]');
  const draft = loadDraft(writing.b);
  const i = p.dataset.i;
  const text = p.innerText.replace(/\n$/, '');
  if (text === writing.paras[i].text) delete draft.edits[i];
  else draft.edits[i] = text;
  p.classList.toggle('edited', draft.edits[i] != null);
  keepDraft(draft);
  drawCount();
};

$('#wText').oninput = () => {
  const draft = loadDraft(writing.b);
  draft.more = $('#wText').value;
  keepDraft(draft);
  drawCount();
};

/* ---------- Saving ---------- */

// One list of changes for Google: the new text at the end first, then the changed paragraphs from the last to
// the first, so each change leaves the positions of the ones still to come as they were
function saveRequests(draft) {
  const more = draft.more.trim() ? [{ insertText: { endOfSegmentLocation: {}, text: '\n' + draft.more.trim() } }] : [];
  return Object.keys(draft.edits)
    .map(Number)
    .sort((a, b) => b - a)
    .reduce((list, i) => {
      const p = writing.paras[i];
      const text = draft.edits[i];
      if (!p || p.fixed) return list;
      const cut = p.text ? [{ deleteContentRange: { range: { startIndex: p.start, endIndex: p.end - 1 } } }] : [];
      const put = text ? [{ insertText: { location: { index: p.start }, text } }] : [];
      return list.concat(cut, put);
    }, more);
}

$('#wSend').onclick = async () => {
  const b = writing.b;
  const requests = saveRequests(loadDraft(b));
  if (!requests.length) return;
  $('#wSend').disabled = true;
  try {
    await gfetch(`https://docs.googleapis.com/v1/documents/${b.doc}:batchUpdate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // only if the Doc is still the version shown here: nothing written elsewhere gets overwritten
      body: JSON.stringify({ requests, writeControl: { requiredRevisionId: writing.rev } }),
    });
  } catch (e) {
    $('#wSend').disabled = false;
    if (e.status === 400) {
      toast('The Doc changed in Google Docs. Here’s the new version: check your changes and save again.');
      return openWrite(b);
    }
    return toast('Couldn’t reach Google Docs. Your text is kept here.');
  }
  localStorage.removeItem(draftKey(b));
  $('#wText').value = '';
  toast('Saved to your Google Doc');
  await refreshBook(b, true, true).catch(() => {}); // the new word count, and today's words
  save();
  if (writing.b === b && $('#dlgWrite').open) openWrite(b);
};
