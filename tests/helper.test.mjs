// Tests the Cloudflare helper's reminders and Doc versions without Cloudflare: a pretend KV space and a
// pretend internet.   node tests/helper.test.mjs
import assert from 'node:assert/strict';
import helper from '../tools/cloudflare-helper.js';

const store = new Map();
const kv = {
  get: async (k, type) => (store.has(k) ? (type === 'json' ? JSON.parse(store.get(k)) : store.get(k)) : null),
  put: async (k, v) => void store.set(k, v),
  delete: async (k) => void store.delete(k),
  list: async ({ prefix }) => ({ keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }),
};
const env = { REMIND: kv };
const APP = 'https://spendrax.github.io';
const call = (path, body) =>
  helper.fetch(new Request('https://helper.test' + path, { method: body ? 'POST' : 'GET', body: body && JSON.stringify(body), headers: { Origin: APP } }), env);

let sent = [];
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://push.example/')) {
    sent.push({ url, init });
    return new Response(null, { status: url.endsWith('gone') ? 410 : 201 });
  }
  if (String(url).startsWith('https://docs.google.com/feeds/download/documents/export/')) {
    assert.equal(init.headers.Authorization, 'Bearer pass');
    return new Response('one two three');
  }
  throw new Error('unexpected fetch ' + url);
};

// the push key is made once and stays the same
const k1 = (await (await call('/vapid')).json()).key;
const k2 = (await (await call('/vapid')).json()).key;
assert.ok(k1.length > 80 && k1 === k2);

// a reminder at 20:00 in Toronto
const sub = { endpoint: 'https://push.example/phone1', keys: {} };
assert.equal((await call('/reminder', { sub, time: '20:00', tz: 'America/Toronto', done: '' })).status, 200);
assert.equal((await call('/reminder', { sub, time: 'later', tz: 'America/Toronto' })).status, 400);
assert.equal((await call('/reminder', { sub, time: '20:00', tz: 'Mars/Base' })).status, 400);

const { sendReminders } = await import('../tools/reminders.js');
const at = (iso) => new Date(iso);
await sendReminders(kv, at('2026-11-21T19:30:00-05:00')); // too early
assert.equal(sent.length, 0);
await sendReminders(kv, at('2026-11-21T20:07:00-05:00')); // its time
assert.equal(sent.length, 1);
const auth = sent[0].init.headers.Authorization;
assert.match(auth, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);
// the signature checks out with the public key
const [, jwt, pub] = auth.match(/t=([^,]+), k=(.+)$/);
const [h, c, s] = jwt.split('.');
const bytes = (b) => Uint8Array.from(atob(b.replace(/-/g, '+').replace(/_/g, '/')), (x) => x.charCodeAt(0));
const key = await crypto.subtle.importKey('raw', bytes(pub), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, bytes(s), new TextEncoder().encode(`${h}.${c}`)));
assert.equal(JSON.parse(new TextDecoder().decode(bytes(c))).aud, 'https://push.example');
await sendReminders(kv, at('2026-11-21T21:00:00-05:00')); // already sent today
assert.equal(sent.length, 1);
// the next day the goal is already done: no reminder
await call('/reminder', { sub, time: '20:00', tz: 'America/Toronto', done: '2026-11-22' });
await sendReminders(kv, at('2026-11-22T20:30:00-05:00'));
assert.equal(sent.length, 1);
// a phone that unsubscribed is forgotten
await call('/reminder', { sub: { endpoint: 'https://push.example/gone' }, time: '08:00', tz: 'Europe/Paris' });
await sendReminders(kv, at('2026-11-23T09:00:00+01:00'));
assert.ok(![...store.values()].some((v) => v.includes('push.example/gone')));
// turning it off
await call('/reminder', { sub, off: true });
assert.equal([...store.keys()].filter((k) => k.startsWith('sub:')).length, 0);

// an earlier version of a Doc: only Google Docs' download addresses
assert.equal((await call('/gexport', { url: 'https://evil.example/x', token: 'pass' })).status, 400);
const v = await call('/gexport', { url: 'https://docs.google.com/feeds/download/documents/export/Export?id=1&revision=2&exportFormat=txt', token: 'pass' });
assert.equal(await v.text(), 'one two three');
// and nobody else's site may use the helper
assert.equal((await helper.fetch(new Request('https://helper.test/vapid', { headers: { Origin: 'https://evil.example' } }), env)).status, 403);
console.log('helper: all good');
