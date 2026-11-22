'use strict';
// DAILY REMINDER — Settings → Daily reminder: a notification at the time you pick, only on days you haven't
// reached your goal yet, even when the app is closed. The helper sends it (tools/reminders.js); this file:
//   • subscribes this phone to notifications and tells the helper the time and your time zone
//   • tells the helper as soon as today's goal is done (no reminder today then)
//   • writes the notification's words, in your language, where the offline copy finds them (sw.js)

set.remind = Object.assign({ on: false, time: '20:00' }, set.remind);
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const b64uBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function pushSub(create) {
  const reg = await navigator.serviceWorker.ready;
  const had = await reg.pushManager.getSubscription();
  if (had || !create) return had;
  const { key } = await fetch(HELPER + '/vapid', { signal: AbortSignal.timeout(10000) }).then((r) => r.json());
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uBytes(key) });
}

// Tells the helper: on (with the time, time zone and whether today's goal is done) or off
async function tellHelper(sub, off) {
  const body = { sub: sub.toJSON(), time: set.remind.time, tz: tz(), done: set.hit[today()] ? today() : '', off };
  const r = await helperPost('/reminder', JSON.stringify(body));
  if (r.error) throw new Error(r.error);
}

// a problem to tell you about in plain words (other errors mean the helper couldn't be reached)
const problem = (text) => Object.assign(new Error(text), { plain: true });

async function reminderOn() {
  if (!('PushManager' in window) || !navigator.serviceWorker) throw problem('This phone or browser can’t show reminders');
  if ((await Notification.requestPermission()) !== 'granted') throw problem('Notifications are turned off for this app');
  await tellHelper(await pushSub(true));
}

$('#rOn').onchange = async (e) => {
  const on = e.target.checked;
  try {
    if (on) await reminderOn();
    else {
      const sub = await pushSub(false);
      if (sub) {
        await tellHelper(sub, true);
        await sub.unsubscribe();
      }
    }
    set.remind.on = on;
    saveSet();
    saveReminderWords();
    toast(on ? `Reminder set for ${set.remind.time}` : 'Reminder off');
  } catch (err) {
    e.target.checked = !on;
    toast(err.plain ? err.message : 'Couldn’t reach the helper. Try again later.');
  }
};
$('#rTime').onchange = async (e) => {
  set.remind.time = e.target.value || '20:00';
  saveSet();
  if (set.remind.on) await syncReminder();
};

// Keeps the helper up to date: on opening the app (a new time zone…), and when today's goal is done
async function syncReminder() {
  if (!set.remind.on) return;
  const sub = await pushSub(false).catch(() => null);
  if (sub) await tellHelper(sub).catch(() => {});
}
on('goal', syncReminder);

/* ---------- The notification's words ---------- */

function reminderWords() {
  const s = streak();
  const t = (x) => (typeof tr === 'function' ? tr(x) : x); // in your language (15-languages.js)
  return {
    title: t('✍️ Time to write'),
    body: t(s ? `🔥 Keep your ${s}-day streak going: ${num(set.goal)} words today?` : `${set.pet} is waiting in the attic`),
  };
}
function saveReminderWords() {
  if (!set.remind.on || !window.caches) return;
  caches.open('ws-push').then((c) => c.put('msg', new Response(JSON.stringify(reminderWords())))).catch(() => {});
}
on('change', saveReminderWords);

$('#rOn').checked = set.remind.on;
$('#rTime').value = set.remind.time;
saveReminderWords();
syncReminder();
