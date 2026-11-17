'use strict';
// SETTINGS — daily goal, the buddy's name, the Google connection, and saving a backup file or loading one back.

$('#btnSettings').onclick = () => {
  $('#sGoal').value = set.goal;
  $('#sPet').value = set.pet;
  $('#ver').textContent = VERSION;
  drawGoogle();
  $('#dlgSet').showModal();
};
$('#sGoal').onchange = (e) => {
  set.goal = Math.max(1, Math.round(+e.target.value || 500));
  saveSet();
  emit('change');
};
$('#sPet').onchange = (e) => {
  set.pet = e.target.value.trim() || 'Inkwell';
  saveSet();
  emit('change');
};

/* ---------- Google ---------- */

function drawGoogle() {
  const ago = set.google.last ? Math.round((Date.now() - set.google.last) / 60000) : -1;
  $('#gStatus').textContent = !GOOGLE_CLIENT_ID
    ? 'Not set up yet.'
    : !googleOn()
      ? 'Connect once to pick your Google Docs, read their word counts, and keep an automatic backup of your shelf in your Drive.'
      : ago < 0
        ? 'Connected. First backup coming up…'
        : `Connected. Last backup: ${ago < 1 ? 'just now' : ago < 60 ? ago + ' min ago' : Math.round(ago / 60) + ' h ago'}.`;
  $('#gConnect').hidden = googleOn() || !GOOGLE_CLIENT_ID;
  $('#gActions').hidden = !googleOn();
}
on('google', drawGoogle);
$('#gConnect').onclick = googleConnect;
$('#gOff').onclick = () => {
  if (confirm('Disconnect Google on this device? Your Docs and your backup in Drive stay.')) googleOff();
};

/* ---------- Backup file ---------- */

// Everything worth keeping (also used by the Google Drive backup). The Google sign-in stays on this phone.
const backupData = () => ({
  app: 'my-writershelf',
  version: VERSION,
  saved: new Date().toISOString(),
  settings: { ...set, google: undefined },
  books,
});

$('#sExport').onclick = () => {
  const blob = new Blob([JSON.stringify(backupData(), null, 1)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `writershelf-backup-${today()}.json`,
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1e4);
  toast('Backup saved');
};
$('#sImport').onchange = async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (data.app !== 'my-writershelf' || !Array.isArray(data.books)) throw 0;
    mergeFrom(data);
    toast('Backup loaded');
  } catch {
    toast('That file isn’t a Writershelf backup');
  }
};
