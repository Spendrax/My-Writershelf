'use strict';
// GOOGLE — signing in once (Settings → Google, or the first time you pick a Doc), and talking to Google.
// The app only asks for two narrow permissions:
//   • drive.file: only the Docs you pick yourself in Google's file picker (reading them, adding text to them)
//   • drive.appdata: a hidden app folder in your Drive for the automatic backup (12-drive-backup.js)
// Signing in uses Google's own window. Google gives a long-lasting "refresh token" so the app keeps working
// without signing in again; turning it into a short-lived pass needs a secret, so that step goes through
// this app's own Cloudflare helper (tools/cloudflare-helper.js). The token stays on this phone.

// From this app's own Google Cloud project (see README → "Setting up Google"). Empty = not set up yet.
const GOOGLE_CLIENT_ID = '901155885450-ij7clv4a6l799f76l9gkotuuu8j7rq6m.apps.googleusercontent.com'; // "OAuth client ID" (web application)
const GOOGLE_API_KEY = 'AIzaSyBLCdzlbLmuFPZXI2g29nUajHabFvUUbmY'; // "API key", needed by Google's file picker
const HELPER = 'https://my-writershelf.spendraxapp.workers.dev';
const GOOGLE_SCOPES =
  'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata';

set.google = Object.assign({ refresh: '', last: 0, file: '' }, set.google);
set.device ||= uid(); // tells your devices apart
let googleToken = { value: '', until: 0 };

const googleOn = () => !!(GOOGLE_CLIENT_ID && set.google.refresh);
const helperPost = (path, body) =>
  fetch(HELPER + path, { method: 'POST', body, signal: AbortSignal.timeout(15000) }).then((r) => r.json());

// Opens Google's sign-in. Answers true once connected, false if it was cancelled or didn't work.
async function googleConnect() {
  if (!GOOGLE_CLIENT_ID) return (toast('Google isn’t set up yet'), false);
  try {
    if (!window.google?.accounts) await loadScript('https://accounts.google.com/gsi/client');
  } catch {
    return (toast('Couldn’t reach Google. Check your connection.'), false);
  }
  return new Promise((done) =>
    google.accounts.oauth2
      .initCodeClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPES,
        ux_mode: 'popup',
        error_callback: () => done(false),
        // the one-time code is traded by the helper for a refresh token
        callback: async (r) => {
          if (!r.code) return (toast('Google sign-in was cancelled'), done(false));
          const t = await helperPost('/gauth', r.code).catch(() => ({}));
          if (!t.refresh_token) return (toast('Google sign-in didn’t work. Try again later.'), done(false));
          set.google.refresh = t.refresh_token;
          googleToken = { value: t.access_token, until: Date.now() + (t.expires_in - 60) * 1000 };
          saveSet();
          toast('Google connected');
          emit('google');
          done(true);
        },
      })
      .requestCode(),
  );
}

function googleOff() {
  set.google = { refresh: '', last: 0, file: '' };
  googleToken = { value: '', until: 0 };
  saveSet();
  emit('google');
}

// A short-lived pass to talk to Google (renewed through the helper)
async function googleAccess() {
  if (Date.now() < googleToken.until) return googleToken.value;
  const t = await helperPost('/gtoken', set.google.refresh);
  if (!t.access_token) {
    if (t.error === 'invalid_grant') googleOff(); // access was removed in your Google account: connect again
    throw new Error('no access');
  }
  googleToken = { value: t.access_token, until: Date.now() + (t.expires_in - 60) * 1000 };
  return googleToken.value;
}

// Asks Google something. path: 'drive/v3/…' (Drive) or a full https address (Docs).
async function gfetch(path, init = {}) {
  const r = await fetch(path.startsWith('https://') ? path : `https://www.googleapis.com/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await googleAccess()}`, ...init.headers },
  });
  if (!r.ok) throw Object.assign(new Error('google ' + r.status), { status: r.status });
  return r;
}
