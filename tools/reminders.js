// REMINDERS — the daily "time to write" notification, sent by the helper even when the app is closed.
//   • the app subscribes in Settings → Daily reminder, with the time you picked and your time zone
//   • every 15 minutes Cloudflare runs sendReminders(): each phone whose time has come gets one notification a
//     day, unless the app said today's goal is already done
//   • the notification carries no text (so nothing needs encrypting); the app's offline copy (sw.js) writes it
// Stored in the KV space bound as REMIND (wrangler.toml): the app's push keys ('vapid', made here the first
// time) and one entry per phone ('sub:' + a fingerprint of its address): { sub, time, tz, done, sent }.

const b64u = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

// The app's own push keys: made once, then kept. Only the public half ever leaves the helper.
export async function pushKeys(kv) {
  const saved = await kv.get('vapid', 'json');
  if (saved) return saved;
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const keys = {
    publicKey: b64u(await crypto.subtle.exportKey('raw', pair.publicKey)),
    privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey),
  };
  await kv.put('vapid', JSON.stringify(keys));
  return keys;
}

const fingerprint = async (text) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

// The day ('2026-11-21') and the time ('20:05') right now where that phone is
function localNow(tz, now = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(now)
    .reduce((o, x) => ({ ...o, [x.type]: x.value }), {});
  return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

// From the app: turn the reminder on (or change it), tell it today's goal is done, or turn it off
export async function saveReminder(kv, body) {
  const { sub, time, tz, done, off } = body || {};
  if (!sub?.endpoint || !/^https:\/\//.test(sub.endpoint)) return { error: 'bad request' };
  const key = 'sub:' + (await fingerprint(sub.endpoint));
  if (off) {
    await kv.delete(key);
    return { ok: true };
  }
  if (!/^\d\d:\d\d$/.test(time || '')) return { error: 'bad request' };
  try {
    localNow(tz);
  } catch {
    return { error: 'bad request' };
  }
  const was = (await kv.get(key, 'json')) || {};
  await kv.put(key, JSON.stringify({ sub, time, tz, done: done || '', sent: was.sent || '' }));
  return { ok: true };
}

// A notification with no text: a signed note (VAPID) saying it comes from this app's helper
async function sendPush(sub, keys) {
  const enc = (o) => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const claims = { aud: new URL(sub.endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'mailto:spendraxapp@gmail.com' };
  const unsigned = `${enc({ typ: 'JWT', alg: 'ES256' })}.${enc(claims)}`;
  const key = await crypto.subtle.importKey('jwk', keys.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
  return fetch(sub.endpoint, {
    method: 'POST',
    headers: { TTL: '43200', Urgency: 'normal', Authorization: `vapid t=${unsigned}.${b64u(sig)}, k=${keys.publicKey}` },
  });
}

// Every 15 minutes: the phones whose reminder time has passed today, that haven't had it yet and haven't
// reached today's goal, get their notification. A phone that unsubscribed (410/404) is forgotten.
export async function sendReminders(kv, now = new Date()) {
  const keys = await pushKeys(kv);
  let cursor;
  do {
    const page = await kv.list({ prefix: 'sub:', cursor });
    for (const { name } of page.keys) {
      const r = await kv.get(name, 'json');
      if (!r) continue;
      const { day, time } = localNow(r.tz, now);
      if (time < r.time || r.sent === day || r.done === day) continue;
      const res = await sendPush(r.sub, keys).catch(() => null);
      if (res && (res.status === 404 || res.status === 410)) await kv.delete(name);
      else if (res?.ok) await kv.put(name, JSON.stringify({ ...r, sent: day }));
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
}
