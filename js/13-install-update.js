'use strict';
// INSTALL & UPDATES — registers the offline copy (sw.js), shows 'Update now' when a new version is ready,
// and the Install buttons (top bar and Settings).
// When a new version is downloaded, show "Update now"; tapping it switches over and reloads.
if ('serviceWorker' in navigator)
  addEventListener('load', async () => {
    const reg = await navigator.serviceWorker.register('sw.js').catch(() => null);
    if (!reg) return;
    const ready = (w) => {
      if (w && navigator.serviceWorker.controller) $('#updBtn').hidden = false;
    };
    // Asks the newest waiting version to take over (not one remembered earlier: several updates may have
    // arrived since). If nothing happens within a few seconds, reloads anyway.
    $('#updBtn').onclick = () => {
      $('#updBtn').textContent = '⟳ Updating…';
      (reg.waiting || reg.installing)?.postMessage('skip');
      setTimeout(() => location.reload(), 3000);
    };
    ready(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w.addEventListener('statechange', () => w.state === 'installed' && ready(w));
    });
    // a new version took over: reload once (not on the very first visit, when there was no version before)
    let reloaded = !navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!reloaded) {
        reloaded = true;
        location.reload();
      }
    });
    document.addEventListener('visibilitychange', () => document.hidden || reg.update());
  });

/* ---------- Installing: the "⬇ Install" button in the top bar, and "Install the app" in Settings ---------- */
// Shown only while the app is open in a browser and can be installed; gone once it runs as an installed app.
// Android and computers: the browser hands over an install window to open. iPhone and iPad have no such
// window, so the button explains the two taps to do in Safari.
const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const onApple = /iPhone|iPad|iPod/.test(navigator.userAgent);
const installBtns = [$('#btnInstall'), $('#sInstall')];
const showInstall = (yes) => installBtns.forEach((b) => (b.hidden = !yes));
let installEvt = null;

addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvt = e;
  showInstall(true);
});
addEventListener('appinstalled', () => showInstall(false));
if (onApple && !installed) showInstall(true);

installBtns.forEach(
  (b) =>
    (b.onclick = async () => {
      if (!installEvt) return toast('To install: tap Share, then “Add to Home Screen”');
      installEvt.prompt();
      const { outcome } = await installEvt.userChoice;
      installEvt = null; // an install window can only be used once
      if (outcome === 'accepted') showInstall(false);
    }),
);
