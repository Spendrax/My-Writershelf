'use strict';
// FORMATTING — bold, italic, underline, strikethrough and paragraph styles (Normal, Title, Heading 1–3) in
// "Open and write" (10-write.js), shown as in Google Docs and saved back to it.
// A paragraph's text is kept as "runs": pieces of text with the same look, [{ t: 'Hello ', b: true }, { t: 'you' }]
// (b bold, i italic, u underline, s strikethrough; only the ones that are on). '\v' is a line break inside
// the paragraph (Shift+Enter in Google Docs).
// The toolbar above the Doc works on the paragraph you're changing: select words, then tap B, I, U or S.

const LOOKS_RUN = [
  ['b', 'bold', 'B,STRONG'],
  ['i', 'italic', 'I,EM'],
  ['u', 'underline', 'U'],
  ['s', 'strikethrough', 'S,STRIKE,DEL'],
];
const PARA_STYLES = { NORMAL_TEXT: 'Normal', TITLE: 'Title', HEADING_1: 'Heading 1', HEADING_2: 'Heading 2', HEADING_3: 'Heading 3' };

const runsText = (runs) => runs.reduce((t, r) => t + r.t, '');

// Adds text to a list of runs, joined to the last one when it looks the same
function addRun(runs, t, look) {
  if (!t) return runs;
  const last = runs[runs.length - 1];
  const same = last && LOOKS_RUN.every(([k]) => !!last[k] === !!look[k]);
  if (same) last.t += t;
  else runs.push(LOOKS_RUN.reduce((r, [k]) => (look[k] ? { ...r, [k]: true } : r), { t }));
  return runs;
}

// The runs of a paragraph read from Google Docs (its text pieces, with their look)
function runsOfDoc(parts) {
  return parts.reduce((runs, p) => {
    if (!p.textRun) return runs;
    const st = p.textRun.textStyle || {};
    return addRun(runs, p.textRun.content.replace(/\n$/, ''), { b: st.bold, i: st.italic, u: st.underline, s: st.strikethrough });
  }, []);
}

// Runs shown on screen: each piece of text wrapped in <b>, <i>, <u>, <s>
const runHTML = (r) =>
  LOOKS_RUN.reduce((h, [k, , tags]) => (r[k] ? `<${tags.split(',')[0]}>${h}</${tags.split(',')[0]}>` : h), showText(r.t));
const runsHTML = (runs) => runs.reduce((h, r) => h + runHTML(r), '');

// The runs of a paragraph as you edited it on screen
function runsOfScreen(el) {
  const runs = [];
  const walk = (n, look) => {
    if (n.nodeType === 3) return addRun(runs, n.data.replace(/ /g, ' '), look);
    if (n.nodeName === 'BR') return addRun(runs, '\v', look);
    if (n.nodeType !== 1) return;
    const css = n.style || {};
    const deco = css.textDecorationLine || css.textDecoration || '';
    const next = LOOKS_RUN.reduce(
      (l, [k, , tags]) => ({ ...l, [k]: l[k] || tags.split(',').includes(n.nodeName) }),
      { ...look },
    );
    if (/bold|[6-9]00/.test(css.fontWeight || '')) next.b = true;
    if (css.fontStyle === 'italic') next.i = true;
    if (deco.includes('underline')) next.u = true;
    if (deco.includes('line-through')) next.s = true;
    if (/^(DIV|P)$/.test(n.nodeName) && runs.length) addRun(runs, '\v', look); // a new line the phone made
    n.childNodes.forEach((c) => walk(c, next));
  };
  el.childNodes.forEach((c) => walk(c, {}));
  // the line break a phone leaves at the very end isn't part of the text
  const last = runs[runs.length - 1];
  if (last) last.t = last.t.replace(/\v+$/, '');
  return last && !last.t ? runs.slice(0, -1) : runs;
}

const sameRuns = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Google's changes that give the text at `start` its look, run by run
function runRequests(runs, start) {
  let at = start;
  return runs.reduce((list, r) => {
    const range = { startIndex: at, endIndex: (at += r.t.length) };
    return list.concat({
      updateTextStyle: {
        range,
        textStyle: { bold: !!r.b, italic: !!r.i, underline: !!r.u, strikethrough: !!r.s },
        fields: 'bold,italic,underline,strikethrough',
      },
    });
  }, []);
}

/* ---------- The toolbar ---------- */

let editingP = null; // the paragraph being changed (it keeps its place when the style menu takes the focus)

$('#wTools').innerHTML =
  LOOKS_RUN.reduce((h, [k, name]) => h + `<button type="button" data-look="${name}" class="t-${k}" aria-label="${name[0].toUpperCase() + name.slice(1)}">${k.toUpperCase()}</button>`, '') +
  `<select id="wStyle" aria-label="Paragraph style">${Object.entries(PARA_STYLES).reduce((h, [v, n]) => h + `<option value="${v}">${n}</option>`, '')}</select>`;

// tapping a button doesn't take the focus away from the paragraph
$('#wTools').addEventListener('pointerdown', (e) => e.target.closest('button') && e.preventDefault());
$('#wTools').addEventListener('click', (e) => {
  const look = e.target.closest('[data-look]')?.dataset.look;
  if (!look) return;
  if (!editingP?.isContentEditable) return toast('Tap a paragraph first, then select words');
  document.execCommand('styleWithCSS', false, false);
  document.execCommand(look === 'strikethrough' ? 'strikeThrough' : look);
  editingP.dispatchEvent(new Event('input', { bubbles: true }));
  drawTools();
});

// The style menu: the paragraph you're changing becomes a heading, the title or normal text
$('#wStyle').onchange = (e) => {
  if (!editingP) return toast('Tap a paragraph first, then select words');
  const i = editingP.dataset.i;
  const draft = loadDraft(writing.b);
  if (e.target.value === (writing.paras[i].named || 'NORMAL_TEXT')) delete draft.styles[i];
  else draft.styles[i] = e.target.value;
  keepDraft(draft);
  editingP.classList.toggle('h', e.target.value !== 'NORMAL_TEXT');
  editingP.classList.toggle('edited', draft.edits[i] != null || draft.styles[i] != null);
  drawCount();
};

// The buttons light up for the look of the selected words, the menu shows the paragraph's style
function drawTools() {
  const on = !!editingP?.isContentEditable;
  $$('#wTools button').forEach((b) => b.classList.toggle('on', on && document.queryCommandState(b.dataset.look === 'strikethrough' ? 'strikeThrough' : b.dataset.look)));
  if (editingP) $('#wStyle').value = loadDraft(writing.b).styles[editingP.dataset.i] || writing.paras[editingP.dataset.i]?.named || 'NORMAL_TEXT';
}
document.addEventListener('selectionchange', () => $('#dlgWrite').open && drawTools());
