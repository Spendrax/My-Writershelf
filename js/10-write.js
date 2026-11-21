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
// Pictures show as they are, but a paragraph with a picture can only be changed in Google Docs.
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

// The Doc as a list of paragraphs. start/end are Google's positions. A paragraph that holds a picture, a table
// or another special thing is shown as it is but can't be changed here (fixed).
// (A Doc with tabs: Google gives the first tab in the usual places; older answers are read from tabs[0] too.)
async function readDoc(b) {
  const d = await (await gfetch(`https://docs.googleapis.com/v1/documents/${b.doc}`)).json();
  const tab = d.tabs?.[0]?.documentTab || {};
  const objects = { inline: d.inlineObjects || tab.inlineObjects || {}, positioned: d.positionedObjects || tab.positionedObjects || {} };
  const paras = ((d.body || tab.body)?.content || []).reduce((list, el) => {
    if (el.table) return list.concat({ text: '▦', html: '▦', fixed: true });
    return el.paragraph ? list.concat(paraOf(el, objects)) : list;
  }, []);
  return { rev: d.revisionId, paras };
}

// A picture in the Doc, as an <img>. Google gives each one a private address that works for about
// 30 minutes, only for you; it's not kept anywhere (reopening the book gets fresh ones).
// No address (a drawing, a chart…): a note saying to look at it in Google Docs.
const NO_PIC = '<span class="nopic">🖼 Picture: open the book in Google Docs to see it</span>';
function picture(obj) {
  const e = obj?.embeddedObject;
  const src = e?.imageProperties?.contentUri;
  if (!src) return NO_PIC;
  const w = e.size?.width?.magnitude; // in points
  return `<img src="${esc(src)}" alt="${esc(e.title || e.description || '')}" loading="lazy"${w ? ` style="width:${Math.round(w * 1.333)}px"` : ''}>`;
}

// Text from the Doc, ready to show: a line break inside a paragraph (Shift+Enter, which Google sends as a
// "vertical tab") becomes a real line break; other invisible marks Google uses are left out.
// A picture placed behind or in front of the text reaches apps only as a mark (U+E907) with no picture:
// Google doesn't give apps those pictures, so a note says so.
const BEHIND = '\ue907';
const NO_BEHIND =
  '<span class="nopic">🖼 A picture placed behind or in front of the text. Google only shows it in Google Docs</span>';
const showText = (t) =>
  esc(t.replace(/\n$/, ''))
    .replace(/\v/g, '<br>')
    .replace(new RegExp(BEHIND, 'g'), NO_BEHIND)
    .replace(/[\u0000-\u0008\u000c-\u001f\ue000-\uf8ff\ufffc]/g, '');

// How each kind of thing in a paragraph shows
function showPart(p, objects) {
  if (p.textRun) return showText(p.textRun.content);
  if (p.inlineObjectElement) return picture(objects.inline[p.inlineObjectElement.inlineObjectId]?.inlineObjectProperties);
  if (p.horizontalRule) return '<hr>';
  if (p.footnoteReference) return `<sup>${esc(p.footnoteReference.footnoteNumber)}</sup>`;
  if (p.person) return esc(p.person.personProperties?.name || p.person.personProperties?.email);
  if (p.richLink) return esc(p.richLink.richLinkProperties?.title);
  if (p.dateElement) return esc(p.dateElement.dateElementProperties?.displayText);
  return ''; // a page break, a column break, an equation…
}

// One paragraph: its text (what you change), and how to show it (html)
function paraOf(el, objects) {
  const parts = el.paragraph.elements || [];
  const placed = el.paragraph.positionedObjectIds || []; // pictures placed freely on the page (in front of or behind the text)
  const html =
    parts.reduce((h, p) => h + showPart(p, objects), '') +
    placed.reduce((h, id) => h + picture(objects.positioned[id]?.positionedObjectProperties), '');
  return {
    start: el.startIndex,
    end: el.endIndex,
    text: parts.reduce((t, p) => t + (p.textRun?.content || ''), '').replace(/\n$/, ''),
    html,
    h: /HEADING|TITLE/.test(el.paragraph.paragraphStyle?.namedStyleType || ''),
    lvl: +(el.paragraph.paragraphStyle?.namedStyleType || '').replace(/\D/g, '') || 0, // 1 for Heading 1… (0 for the title)
    brk: parts.some((p) => p.pageBreak), // a page break (often between chapters)
    pic: /<img|nopic|<hr/.test(html),
    // changing a paragraph holding such a picture would delete the picture: only in Google Docs
    fixed: parts.some((p) => !p.textRun || p.textRun.content.includes(BEHIND)) || placed.length > 0,
  };
}

// Keeps what's waiting to be saved, with the version of the Doc it was written on
function keepDraft(draft) {
  draft.rev = writing.rev;
  store(draftKey(writing.b), draft);
}

const docText = (w, edits) => w.paras.reduce((t, p, i) => t + (edits[i] ?? p.text) + '\n', '');

/* ---------- The sheet ---------- */

// Empty lines after your last line aren't shown, so the Doc ends where your writing ends
function drawDoc() {
  const edits = loadDraft(writing.b).edits;
  const shown = (p, i) => (edits[i] ?? p.text).replace(/\v/g, '').trim() || p.pic || p.fixed;
  const last = writing.paras.reduce((n, p, i) => (shown(p, i) ? i : n), -1);
  $('#wDoc').innerHTML = writing.paras.slice(0, last + 1).reduce((h, p, i) => {
    const text = edits[i] ?? p.text;
    const kind = [p.h && 'h', p.brk && 'brk', p.fixed && 'fixed', !text.replace(/\v/g, '').trim() && !p.pic && 'blank', edits[i] != null && 'edited'];
    const shows = p.brk ? '' : (edits[i] != null ? showText(text) : p.html) || '<br>';
    return h + `<p data-i="${i}" class="${kind.filter(Boolean).join(' ')}">${shows}</p>`;
  }, '');
}

function drawCount() {
  const draft = loadDraft(writing.b);
  const total = countWords(docText(writing, draft.edits) + draft.more);
  const today = wroteToday() + Math.max(0, total - (writing.b.words || 0));
  const waiting = draft.more.trim() || Object.keys(draft.edits).length;
  $('#wCount').textContent = `${num(total)} words in the book · ${num(today)} / ${num(set.goal)} today`;
  $('#wSend').disabled = !waiting;
  emit('writing', total); // the buddy peeking in cheers you on (22-buddy-life.js)
}

// at: a paragraph to open at (a chapter, from the book card); otherwise it opens at the end
async function openWrite(b, at) {
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
  const start = at != null && $(`#wDoc p[data-i="${at}"]`);
  if (start) $('#wDoc').scrollTop = start.offsetTop - $('#wDoc').offsetTop;
  else $('#wDoc').scrollTop = 1e7; // where you left off
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
  const text = p.innerText.replace(/\n$/, '').replace(/\n/g, '\v'); // a new line here stays in this paragraph, like Shift+Enter
  if (text === writing.paras[i].text) delete draft.edits[i];
  else draft.edits[i] = text;
  p.classList.toggle('edited', draft.edits[i] != null);
  keepDraft(draft);
  drawCount();
};

// A picture whose address stopped working (after about 30 minutes): a note instead
$('#wDoc').addEventListener(
  'error',
  (e) => e.target.tagName === 'IMG' && e.target.replaceWith(Object.assign(document.createElement('span'), { className: 'nopic', textContent: '🖼 This picture couldn’t load. Close the book and open it again.' })),
  true,
);

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
  emit('saved');
  await refreshBook(b, true, true).catch(() => {}); // the new word count, and today's words
  save();
  if (writing.b === b && $('#dlgWrite').open) openWrite(b);
};
