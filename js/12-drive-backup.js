'use strict';
// GOOGLE DRIVE BACKUP & SYNC — once Google is connected, the app keeps a copy of your shelf in a hidden app
// folder of your Drive ("appDataFolder": only this app sees it):
//   • about a minute after you change something, and when you open the app
//   • on another phone or computer, connecting merges both (mergeFrom): the newest version of each book wins,
//     and a book removed on one device is removed on the other (set.gone remembers removals)

const DRIVE_FILE = 'writershelf-backup.json';

/* ---------- Merging two copies (also used when loading a backup file) ---------- */

function mergeFrom(remote) {
  const theirs = remote.settings || {};
  const wasEmpty = !books.length;
  const gone = new Map((set.gone || []).concat(theirs.gone || []).map((x) => [x.id, x.at]));
  const all = new Map();
  for (const b of (remote.books || []).concat(books)) {
    if (!b?.id || !b.title || gone.has(b.id)) continue;
    const cur = all.get(b.id);
    if (!cur || (b.updated || b.added || 0) >= (cur.updated || cur.added || 0)) all.set(b.id, b);
  }
  books = [...all.values()];
  set.gone = [...gone].map(([id, at]) => ({ id, at })).slice(-500);
  // each day keeps its highest count: both devices read the same Docs, so adding them up would count twice
  for (const [day, n] of Object.entries(theirs.log || {})) set.log[day] = Math.max(set.log[day] || 0, +n || 0);
  Object.assign(set.hit, theirs.hit);
  // a brand-new device also takes your daily goal and your buddy's name
  if (wasEmpty) Object.assign(set, { goal: +theirs.goal || set.goal, pet: theirs.pet || set.pet });
  saveSet();
  save();
}

/* ---------- Talking to Drive ---------- */

// The backup file in your Drive's app folder: { id, modifiedTime } or undefined
async function driveFind() {
  const q = encodeURIComponent(`name='${DRIVE_FILE}'`);
  const d = await (await gfetch(`drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)`)).json();
  return d.files?.[0];
}

async function driveUpload(data) {
  const body = JSON.stringify(data);
  if (set.google.file) {
    try {
      await gfetch(`upload/drive/v3/files/${set.google.file}?uploadType=media`, { method: 'PATCH', body });
      return;
    } catch {} // the file was removed: make a new one
  }
  const b = 'ws' + Date.now();
  const meta = JSON.stringify({ name: DRIVE_FILE, parents: ['appDataFolder'] });
  const r = await gfetch('upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${b}` },
    body: `--${b}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--`,
  });
  set.google.file = (await r.json()).id;
}

/* ---------- Backing up ---------- */

let syncing = false;
// Gets your other devices' changes first (if any), then saves this device's copy
async function driveSync(loud) {
  if (!googleOn() || syncing || !navigator.onLine) return;
  syncing = true;
  try {
    const f = await driveFind();
    if (f) {
      set.google.file = f.id;
      // changed since this device last saved it: another device wrote it
      if (Date.parse(f.modifiedTime) > set.google.last + 5000) {
        const remote = await (await gfetch(`drive/v3/files/${f.id}?alt=media`)).json();
        if (remote.device !== set.device) {
          mergeFrom(remote);
          toast('Synced with your other device');
        }
      }
    }
    await driveUpload({ ...backupData(), device: set.device });
    set.google.last = Date.now();
    saveSet();
    if (loud) toast('Backed up to Google Drive');
  } catch {
    if (loud) toast('Google Drive backup didn’t work. Try again later.');
  } finally {
    syncing = false;
    drawGoogle();
  }
}

$('#gNow').onclick = () => driveSync(true);

// Automatic: a minute after changes, when you open the app, and right after connecting
let driveT = 0;
on('change', () => {
  clearTimeout(driveT);
  driveT = setTimeout(driveSync, 60e3);
});
on('google', () => driveSync(false));
if (googleOn()) setTimeout(driveSync, 6000);
