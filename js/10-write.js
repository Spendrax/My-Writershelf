'use strict';
// WRITE HERE — write the next part of a book in the app; "Add to my Google Doc" puts it at the end of the Doc.
// What you type is saved on this phone at every keystroke (ws.draft.<book id>), so nothing is lost if the
// app closes or you're offline; it's only cleared once Google has confirmed the text is in the Doc.
// shortcut: this only adds text at the end. Editing what's already in the Doc means rebuilding Google Docs'
// editor (formatting, comments, suggestions); upgrade only if adding at the end isn't enough.

let writing = null; // the book being written
const draftKey = () => 'ws.draft.' + writing.id;

function drawCount() {
  const n = countWords($('#wText').value);
  $('#wCount').textContent = `${num(n)} words here · ${num(wroteToday() + n)} / ${num(set.goal)} today`;
}

async function openWrite(b) {
  writing = b;
  $('#wTitle').textContent = b.title;
  $('#wText').value = localStorage.getItem(draftKey()) || '';
  $('#wCtx').textContent = tails[b.id] ?? '…';
  drawCount();
  $('#dlgWrite').showModal();
  // the last lines of the Doc, to pick up where you left off
  if (tails[b.id] == null) {
    await refreshBook(b, true, true).then(save, () => {});
    if (writing !== b) return;
    $('#wCtx').textContent = tails[b.id] ?? '';
    if (tails[b.id] == null) toast('Couldn’t read the Doc right now. You can still write: your text is kept here.');
  }
  $('#wCtx').scrollTop = 1e6;
}

$('#wText').oninput = () => {
  localStorage.setItem(draftKey(), $('#wText').value);
  drawCount();
};

$('#wSend').onclick = async () => {
  const text = $('#wText').value.trim();
  const b = writing;
  if (!text) return;
  $('#wSend').disabled = true;
  try {
    await gfetch(`https://docs.googleapis.com/v1/documents/${b.doc}:batchUpdate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ insertText: { endOfSegmentLocation: {}, text: '\n' + text } }] }),
    });
  } catch {
    $('#wSend').disabled = false;
    return toast('Couldn’t reach Google Docs. Your text is kept here.');
  }
  $('#wSend').disabled = false;
  localStorage.removeItem(draftKey());
  $('#wText').value = '';
  tails[b.id] = ((tails[b.id] || '') + '\n' + text).slice(-1200);
  setWords(b, (b.words || 0) + countWords(text));
  b.docTime = ''; // the Doc changed: the next refresh reads its real count again
  save();
  $('#dlgWrite').close();
  toast('Added to your Google Doc');
};
