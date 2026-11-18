'use strict';
// GOOGLE DOCS — bringing your Docs onto the shelf and keeping their word counts up to date.
//   • "Pick from Google Docs" opens Google's own file picker; each Doc you pick becomes a book
//   • the app re-reads the word count of every book when you open it, when you come back to it,
//     and when you tap ⟳ on today's note. New words go on today's log (setWords in 01-core.js).

const docLink = (b) => `https://docs.google.com/document/d/${b.doc}/edit`;

/* ---------- Picking Docs ---------- */

async function pickDocs() {
  if (!GOOGLE_CLIENT_ID) return toast('Google isn’t set up yet');
  if (!googleOn() && !(await googleConnect())) return;
  let token;
  try {
    token = await googleAccess();
    if (!window.google?.picker) {
      await loadScript('https://apis.google.com/js/api.js');
      await new Promise((ok) => gapi.load('picker', ok));
    }
  } catch {
    return toast('Couldn’t reach Google. Check your connection.');
  }
  new google.picker.PickerBuilder()
    .addView(new google.picker.DocsView(google.picker.ViewId.DOCUMENTS).setMode(google.picker.DocsViewMode.LIST))
    .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
    .setOAuthToken(token)
    .setDeveloperKey(GOOGLE_API_KEY)
    .setAppId(GOOGLE_CLIENT_ID.split('-')[0]) // the project number: lets the app open the Docs you pick
    .setCallback((d) => d.action === 'picked' && addDocs(d.docs))
    .build()
    .setVisible(true);
}

// Each picked Doc becomes a book (a Doc already on the shelf is left alone)
async function addDocs(docs) {
  const fresh = docs.reduce((list, d) => {
    if (books.some((b) => b.doc === d.id)) return list;
    const b = {
      id: uid(),
      title: d.name,
      doc: d.id,
      words: 0,
      target: 50000,
      status: 'draft',
      color: SPINES[(books.length + list.length) % SPINES.length],
      added: Date.now(),
    };
    return list.concat(b);
  }, []);
  if (!fresh.length) return toast('Already on your shelf');
  books = fresh.concat(books);
  save();
  for (const b of fresh) await refreshBook(b, false).catch(() => {}); // words already written don't count for today
  save();
  toast(fresh.length === 1 ? 'Book added' : `${fresh.length} books added`);
}

/* ---------- Word counts ---------- */

// Reads one Doc again if it changed since last time. force: read it anyway.
async function refreshBook(b, counts = true, force = false) {
  const meta = await (await gfetch(`drive/v3/files/${b.doc}?fields=modifiedTime`)).json();
  if (!force && meta.modifiedTime === b.docTime) return;
  const text = await (await gfetch(`drive/v3/files/${b.doc}/export?mimeType=text/plain`)).text();
  b.docTime = meta.modifiedTime;
  setWords(b, countWords(text), counts);
}

let refreshing = false;
let refreshedAt = 0;
async function refreshAll(loud) {
  if (!googleOn() || refreshing || !navigator.onLine) return loud && toast('Connect Google in Settings first');
  refreshing = true;
  const before = wroteToday();
  let failed = 0;
  for (const b of books) if (b.doc) await refreshBook(b).catch(() => failed++);
  refreshing = false;
  refreshedAt = Date.now();
  save();
  const got = wroteToday() - before;
  if (got > 0) toast(`+${num(got)} words from Google Docs`);
  else if (loud) toast(failed ? 'Couldn’t read some of your Docs' : 'Word counts are up to date');
}

// When you open the app, and when you come back to it (at most every 2 minutes)
if (googleOn()) setTimeout(refreshAll, 1500);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && Date.now() - refreshedAt > 12e4) refreshAll();
});

/* ---------- The + sheet ---------- */

$('#btnAdd').onclick = () => $('#dlgAdd').showModal();
$('#addDocs').onclick = () => {
  $('#dlgAdd').close(); // Google's picker can't show above an open sheet
  pickDocs();
};
