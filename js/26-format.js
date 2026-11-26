'use strict';
// FORMATTING — bold, italic, underline, strikethrough, text size, font and paragraph styles (Normal, Title, Heading 1–3) in
// "Open and write" (10-write.js), shown as in Google Docs and saved back to it.
// A paragraph's text is kept as "runs": pieces of text with the same look, [{ t: 'Hello ', b: true }, { t: 'you' }]
// (b bold, i italic, u underline, s strikethrough, z size in points, f font; only the ones that are set). '\v' is a
// line break inside the paragraph (Shift+Enter in Google Docs).
// The toolbar above the Doc works on the paragraph you're changing: select words, then tap B, I, U, S or pick a
// size or font. On screen a size is shown next to Google's usual 11 points: 22 points is twice the paragraph's size.

const LOOKS_RUN = [
  ['b', 'bold', 'B,STRONG'],
  ['i', 'italic', 'I,EM'],
  ['u', 'underline', 'U'],
  ['s', 'strikethrough', 'S,STRIKE,DEL'],
];
const RUN_KEYS = ['b', 'i', 'u', 's', 'z', 'f'];
const SIZES = [8, 9, 10, 11, 12, 14, 18, 24, 30, 36, 48];
// fonts on the menu; the ones a phone doesn't have come from Google Fonts when shown (see useFont)
const FONTS = ['Arial', 'Times New Roman', 'Georgia', 'Courier New', 'Verdana', 'Comic Sans MS', 'Lora', 'Merriweather', 'Roboto', 'Open Sans', 'Playfair Display', 'Caveat'];
const SYSTEM_FONTS = ['Arial', 'Times New Roman', 'Georgia', 'Courier New', 'Verdana', 'Comic Sans MS', 'Trebuchet MS', 'Calibri', 'Cambria'];
const PARA_STYLES = { NORMAL_TEXT: 'Normal', TITLE: 'Title', HEADING_1: 'Heading 1', HEADING_2: 'Heading 2', HEADING_3: 'Heading 3' };

const runsText = (runs) => runs.reduce((t, r) => t + r.t, '');

// Adds text to a list of runs, joined to the last one when it looks the same
function addRun(runs, t, look) {
  if (!t) return runs;
  const last = runs[runs.length - 1];
  const same = last && RUN_KEYS.every((k) => (last[k] || null) === (look[k] || null));
  if (same) last.t += t;
  else runs.push(RUN_KEYS.reduce((r, k) => (look[k] ? { ...r, [k]: look[k] } : r), { t }));
  return runs;
}

// The runs of a paragraph read from Google Docs (its text pieces, with their look)
function runsOfDoc(parts) {
  return parts.reduce((runs, p) => {
    if (!p.textRun) return runs;
    const st = p.textRun.textStyle || {};
    const look = { b: st.bold, i: st.italic, u: st.underline, s: st.strikethrough, z: st.fontSize?.magnitude, f: st.weightedFontFamily?.fontFamily };
    return addRun(runs, p.textRun.content.replace(/\n$/, ''), look);
  }, []);
}

// A font name made safe to put in a style
const cleanFont = (f) => f.replace(/[^\w \-]/g, '');

// Fonts a phone doesn't have are fetched from Google Fonts, once each (a name it doesn't know just stays unfetched)
const fontsAsked = new Set();
function useFont(f) {
  if (!f || fontsAsked.has(f) || SYSTEM_FONTS.includes(f)) return;
  fontsAsked.add(f);
  document.head.insertAdjacentHTML('beforeend', `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(f)}&display=swap">`);
}

// The size and font of a run as a style
function sizeFontCSS(r) {
  useFont(r.f);
  return (r.z ? `font-size:${r.z / 11}em;` : '') + (r.f ? `font-family:'${cleanFont(r.f)}';` : '');
}

// Runs shown on screen: each piece of text wrapped in <b>, <i>, <u>, <s>, and a <span> for its size and font
function runHTML(r) {
  const looks = LOOKS_RUN.reduce((h, [k, , tags]) => (r[k] ? `<${tags.split(',')[0]}>${h}</${tags.split(',')[0]}>` : h), showText(r.t));
  return r.z || r.f ? `<span style="${sizeFontCSS(r)}">${looks}</span>` : looks;
}
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
    const size = sizeOf(n, el);
    if (size) next.z = size;
    const font = fontOf(n, el);
    if (font) next.f = font;
    if (/^(DIV|P)$/.test(n.nodeName) && runs.length) addRun(runs, '\v', look); // a new line the phone made
    n.childNodes.forEach((c) => walk(c, next));
  };
  el.childNodes.forEach((c) => walk(c, {}));
  // the line break a phone leaves at the very end isn't part of the text
  const last = runs[runs.length - 1];
  if (last) last.t = last.t.replace(/\v+$/, '');
  return last && !last.t ? runs.slice(0, -1) : runs;
}

// The size (points) set on one element on screen, if any: em sizes are ours; a phone sometimes writes pixels
// instead, which are compared with the paragraph's own size
function sizeOf(n, el) {
  const css = n.style?.fontSize || '';
  const half = (x) => Math.round(x * 2) / 2;
  if (css.endsWith('em')) return half(parseFloat(css) * 11);
  if (!css.endsWith('px')) return null;
  const ratio = parseFloat(getComputedStyle(n).fontSize) / parseFloat(getComputedStyle(el).fontSize);
  return Math.abs(ratio - 1) < 0.02 ? null : half(ratio * 11);
}

// The font set on one element on screen, if any (not the app's own, which a phone sometimes copies in)
function fontOf(n, el) {
  const css = n.getAttribute?.('face') || n.style?.fontFamily || '';
  const f = css.split(',')[0].replace(/["']/g, '').trim();
  return f && f !== getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim() ? f : null;
}

const sameRuns = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Google's changes that give the text at `start` its look, run by run. A size or font left out goes back to
// the paragraph style's own.
function runRequests(runs, start) {
  let at = start;
  return runs.reduce((list, r) => {
    const range = { startIndex: at, endIndex: (at += r.t.length) };
    const textStyle = { bold: !!r.b, italic: !!r.i, underline: !!r.u, strikethrough: !!r.s };
    if (r.z) textStyle.fontSize = { magnitude: r.z, unit: 'PT' };
    if (r.f) textStyle.weightedFontFamily = { fontFamily: r.f };
    return list.concat({ updateTextStyle: { range, textStyle, fields: 'bold,italic,underline,strikethrough,fontSize,weightedFontFamily' } });
  }, []);
}

/* ---------- The toolbar ---------- */

let editingP = null; // the paragraph being changed (it keeps its place when the style menu takes the focus)
let pickedWords = null; // the words last selected in it (a menu takes the focus, and the selection with it)

$('#wTools').innerHTML =
  LOOKS_RUN.reduce((h, [k, name]) => h + `<button type="button" data-look="${name}" class="t-${k}" aria-label="${name[0].toUpperCase() + name.slice(1)}">${k.toUpperCase()}</button>`, '') +
  `<select id="wStyle" aria-label="Paragraph style">${Object.entries(PARA_STYLES).reduce((h, [v, n]) => h + `<option value="${v}">${n}</option>`, '')}</select>` +
  `<select id="wSize" aria-label="Text size"><option value="">Size</option>${SIZES.reduce((h, z) => h + `<option>${z}</option>`, '')}</select>` +
  `<select id="wFont" aria-label="Font"><option value="">Font</option>${FONTS.reduce((h, f) => h + `<option style="font-family:'${f}'">${f}</option>`, '')}</select>`;

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

// The size and font menus: the selected words get the size or font picked ("Size" or "Font": the paragraph's own).
// The browser wraps the words in a marker (<font size="7"> for a size, <font face="ws-mark"> for a font: each one
// clears only the old value of what's being changed), which is turned into our own style.
// shortcut: words inside a bigger piece already sized or fonted can't go back to the paragraph's own; pick a value.
function sizeOrFont(key, value) {
  if (!editingP || !pickedWords || pickedWords.collapsed) return toast('Tap a paragraph first, then select words');
  editable(editingP);
  getSelection().removeAllRanges();
  getSelection().addRange(pickedWords);
  document.execCommand('styleWithCSS', false, false);
  if (key === 'z') document.execCommand('fontSize', false, '7');
  else document.execCommand('fontName', false, 'ws-mark');
  const prop = key === 'z' ? 'fontSize' : 'fontFamily';
  editingP.querySelectorAll(key === 'z' ? 'font[size="7"]' : 'font[face="ws-mark"]').forEach((mark) => {
    mark.removeAttribute(key === 'z' ? 'size' : 'face');
    mark.querySelectorAll('*').forEach((n) => {
      n.style[prop] = '';
      if (key === 'f') n.removeAttribute('face');
    });
    mark.style[prop] = !value ? '' : key === 'z' ? `${value / 11}em` : `'${cleanFont(value)}'`;
  });
  if (key === 'f') useFont(value);
  editingP.dispatchEvent(new Event('input', { bubbles: true }));
  drawTools();
}
$('#wSize').onchange = (e) => sizeOrFont('z', +e.target.value);
$('#wFont').onchange = (e) => sizeOrFont('f', e.target.value);

// The size and font set where the selection starts ('' when it's the paragraph's own)
function lookAtSelection(key) {
  for (let n = getSelection().anchorNode; n && n !== editingP; n = n.parentNode) {
    const v = n.nodeType === 1 && (key === 'z' ? sizeOf(n, editingP) : fontOf(n, editingP));
    if (v) return String(v);
  }
  return '';
}

// A menu that doesn't list the value shown gets it added (a 15-point size or a font from Google Docs)
function showIn(select, value) {
  if (value && ![...select.options].some((o) => o.value === value)) select.add(new Option(value, value));
  select.value = value;
}

// The buttons light up for the look of the selected words, the menu shows the paragraph's style
function drawTools() {
  const on = !!editingP?.isContentEditable;
  $$('#wTools button').forEach((b) => b.classList.toggle('on', on && document.queryCommandState(b.dataset.look === 'strikethrough' ? 'strikeThrough' : b.dataset.look)));
  if (editingP) $('#wStyle').value = loadDraft(writing.b).styles[editingP.dataset.i] || writing.paras[editingP.dataset.i]?.named || 'NORMAL_TEXT';
  const inside = on && getSelection().rangeCount && editingP.contains(getSelection().anchorNode);
  if (!inside) return;
  pickedWords = getSelection().getRangeAt(0).cloneRange();
  showIn($('#wSize'), lookAtSelection('z'));
  showIn($('#wFont'), lookAtSelection('f'));
}
document.addEventListener('selectionchange', () => $('#dlgWrite').open && drawTools());
