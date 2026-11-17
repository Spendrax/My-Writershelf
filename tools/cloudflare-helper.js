// MY WRITERSHELF'S HELPER — a tiny Cloudflare Worker, used only for the Google sign-in (js/02-google.js).
// Google's sign-in needs a secret that can't be put in the app itself, so these two steps happen here:
//   POST /gauth    trades Google's one-time sign-in code for a lasting token
//   POST /gtoken   trades that lasting token for a short pass (about an hour)
//   /ping          "are you there?": open it in a browser to check the helper's version
// Nothing is stored here. Only the app's own site may use it, at most 60 requests a minute per connection.
// Set up (see README → "Setting up Google"): two secrets in Cloudflare → this Worker → Settings →
// Variables and Secrets: GOOGLE_ID (the OAuth client ID) and GOOGLE_SECRET (the client secret).

const HELPER_VERSION = 1;
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
};
