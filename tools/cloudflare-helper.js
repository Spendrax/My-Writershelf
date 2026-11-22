// MY WRITERSHELF'S HELPER — a tiny Cloudflare Worker: the Google sign-in (js/02-google.js), a few Google and
// weather helpers, and the daily writing reminder (tools/reminders.js).
// Google's sign-in needs a secret that can't be put in the app itself, so these two steps happen here:
//   POST /gauth    trades Google's one-time sign-in code for a lasting token
//   POST /gtoken   trades that lasting token for a short pass (about an hour)
//   GET  /where    roughly where you are (your city), from Cloudflare, for the real weather in the window
//   POST /gexport  reads an earlier version of one of your Docs, to know how many words it had on a past day
//                  (Google doesn't let a web page read it directly). The text is passed on, never kept.
//   GET  /vapid    the public key the app needs to subscribe to reminders
//   POST /reminder turn the daily reminder on, change it, say today's goal is done, or turn it off
//   /ping          "are you there?": open it in a browser to check the helper's version
// Nothing is stored here but the reminders (time, time zone and the phone's notification address). Only the app's own site may use it, at most 60 requests a minute per connection.
// Set up (see README → "Setting up Google"): two secrets in Cloudflare → this Worker → Settings →
// Variables and Secrets: GOOGLE_ID (the OAuth client ID) and GOOGLE_SECRET (the client secret).

import { pushKeys, saveReminder, sendReminders } from './reminders.js';

const HELPER_VERSION = 4;
const APP = 'https://spendrax.github.io';

// Counts requests per connection over the last minute (kept in this server's memory, so it's a soft limit)
const recent = new Map();
function tooMany(ip) {
  const now = Date.now();
  const r = recent.get(ip);
  if (!r || now - r.since > 60e3) {
    if (recent.size > 5000) recent.clear();
    recent.set(ip, { since: now, n: 1 });
    return false;
  }
  return ++r.n > 60;
}

export default {
  async fetch(request, env) {
    const headers = { 'Access-Control-Allow-Origin': APP, 'Content-Type': 'application/json' };
    const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });
    const url = new URL(request.url);

    if (url.pathname === '/ping') return reply({ ok: true, version: HELPER_VERSION });
    // only the app may use the helper (browsers always say which site is asking)
    if (request.headers.get('Origin') !== APP) return reply({ error: 'forbidden' }, 403);
    if (tooMany(request.headers.get('CF-Connecting-IP') || '')) return reply({ error: 'busy' }, 429);

    // Cloudflare already knows roughly where each request comes from; only the city-level position is sent back
    if (url.pathname === '/where') return reply({ lat: request.cf?.latitude ?? null, lon: request.cf?.longitude ?? null });

    if (url.pathname === '/vapid') return reply({ key: (await pushKeys(env.REMIND)).publicKey });
    if (request.method === 'POST' && url.pathname === '/reminder') {
      const done = await saveReminder(env.REMIND, await request.json().catch(() => null));
      return reply(done, done.error ? 400 : 200);
    }

    // an earlier version of a Doc: only Google Docs' own download addresses, with your own pass
    if (request.method === 'POST' && url.pathname === '/gexport') {
      const { url: link, token } = await request.json().catch(() => ({}));
      if (!/^https:\/\/docs\.google\.com\/feeds\/download\/documents\/export\//.test(link || '') || !token)
        return reply({ error: 'bad request' }, 400);
      const doc = await fetch(link, { headers: { Authorization: 'Bearer ' + token } });
      return new Response(doc.body, { status: doc.status, headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    if (request.method === 'POST' && (url.pathname === '/gauth' || url.pathname === '/gtoken')) {
      const v = (await request.text()).trim();
      const google = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env.GOOGLE_ID || '',
          client_secret: env.GOOGLE_SECRET || '',
          ...(url.pathname === '/gauth'
            ? { code: v, grant_type: 'authorization_code', redirect_uri: 'postmessage' }
            : { refresh_token: v, grant_type: 'refresh_token' }),
        }),
      }).then((r) => r.json());
      // only what the app needs
      return reply({
        access_token: google.access_token,
        expires_in: google.expires_in,
        refresh_token: google.refresh_token,
        error: google.error,
      });
    }
    return reply({ error: 'not found' }, 404);
  },

  // Cloudflare runs this every 15 minutes (wrangler.toml → triggers): the daily reminders
  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendReminders(env.REMIND));
  },
};
