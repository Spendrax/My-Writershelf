# My Writershelf
An attic nook to keep up with the books you're writing. Your Google Docs sit on the shelf as spines that fill up
as you write; a daily word goal, a streak and a buddy keep you going. Plain HTML, CSS and JavaScript — no build
step, no libraries. Sibling of My Bookshelf and My Gameshelf.
Live at https://spendrax.github.io/My-Writershelf/

## How it fits together
- `index.html` holds the page: the three walls (Goals, Attic, Stats) and every pop-up sheet.
- The scripts load in number order. `01-core.js` comes first and everything else uses it.
- Files talk through small events: after any change to the books, `save()` sends `emit('change')`,
  and the shelf, the walls and the buddy redraw themselves with `on('change', …)`.
- Books and settings are kept on the phone in `localStorage` (`ws.books`, `ws.set`; `ws.set.look` is what you chose in Customize); what you're typing in
  "Write here" is in `ws.draft.<book id>` until Google has it.
- Word counts: every time a book's count changes, the difference goes on today's log (`setWords` in `01-core.js`).
  That log drives the daily goal, the streak, the stats and the medals.

## Where things are
| File | What's in it |
|---|---|
| `index.html` | The page: the attic, the walls and every pop-up sheet |
| `css/base.css` | Colours (the string-light colour is `--led`), fonts, top bar, form fields |
| `css/attic.css` | Roof, string lights, round window and its views, today's pinned note, the shelf and spines, the floor (the same on the three walls) and the rug |
| `css/buddy.css` | The buddy: its colours, blinking, tail, walking legs, moods, speech bubble |
| `css/walls.css` | Turning the walls, the + button, wall dots, Update button, cards on the Goals and Stats walls |
| `css/sheets.css` | Pop-up sheets, buttons, toast, the book card, the "Write here" sheet, Customize |
| `js/01-core.js` | Saving books and settings, events, helpers, the word log / daily goal / streak, drawing a spine |
| `js/02-google.js` | Google sign-in and talking to Google. **The Google client ID and API key go here** |
| `js/03-docs.js` | Picking Google Docs, reading their word counts (on open, on return, on ⟳) |
| `js/04-book-form.js` | The add/edit form, removing a book |
| `js/05-book-card.js` | The card shown when you tap a book |
| `js/06-attic.js` | Today's note and the shelf |
| `js/07-turning-walls.js` | Swiping round the hexagon: Goals ← Attic → Stats |
| `js/08-buddy.js` | The buddy: drawing each animal (the `ANIMALS` list), its moods, what it says |
| `js/09-goals-stats.js` | The Goals wall and the Stats wall (medals are the `MEDALS` list) |
| `js/10-write.js` | Write here: your text is added at the end of the Google Doc |
| `js/11-settings-backup.js` | Settings, saving and loading a backup file |
| `js/12-drive-backup.js` | Automatic Google Drive backup and syncing between devices |
| `js/13-install-update.js` | Offline copy, "Update now" button, Install button |
| `js/14-whats-new.js` | The "What's new" card: add an entry to `NEWS` for each important update |
| `js/16-buddy-moves.js` | The buddy's walks along the floor and over to the other walls |
| `js/17-customize.js` | The 🎨 sheet: string lights, walls, floor, rug, window, animal, fur (the `LOOKS` list) |
| `js/15-languages.js`, `js/lang/` | The app in French, Spanish, Haitian Creole, Portuguese, German, Italian |
| `tools/cloudflare-helper.js` | This app's own Cloudflare Worker: only the Google sign-in goes through it |
| `sw.js` | The offline copy. Bump `V` on every release, and list any new file in `SHELL` |

## Releasing an update
1. Bump `VERSION` in `js/01-core.js` and `V` in `sw.js`.
2. Important update? Add an entry at the top of `NEWS` in `js/14-whats-new.js`.
3. New text on screen? Add it to every file in `js/lang/`.
4. Run the tests (below), then push.

## Setting up Google (once)
The app has its own Google Cloud project and its own Cloudflare Worker, separate from the other apps.
Until this is done the app works by hand (no Docs, no Drive backup).

**Google Cloud** — https://console.cloud.google.com
1. Create a new project, for example "My Writershelf".
2. APIs & Services → Library → enable **Google Drive API**, **Google Docs API** and **Google Picker API**.
3. Google Auth Platform → Get started: app name "My Writershelf", audience **External**.
   Data access → add the scopes `…/auth/drive.file` and `…/auth/drive.appdata`.
   Audience → **Publish app** (in "Testing", Google signs you out every 7 days; these two scopes need no review).
4. Google Auth Platform → Clients → Create client → **Web application** →
   Authorized JavaScript origins: `https://spendrax.github.io`. Keep the **Client ID** and the **Client secret**.
5. APIs & Services → Credentials → Create credentials → **API key**. Restrict it to websites
   `https://spendrax.github.io/*` and to the Google Picker API.

**Cloudflare** — https://dash.cloudflare.com
6. Workers & Pages → Create → Import a repository → this repo (its name must be the one in `wrangler.toml`: `my-writershelf`).
7. The Worker → Settings → Variables and Secrets → add two secrets: `GOOGLE_ID` (the Client ID) and
   `GOOGLE_SECRET` (the Client secret). Check https://my-writershelf.spendraxapp.workers.dev/ping answers.

**The app**
8. In `js/02-google.js`, fill in `GOOGLE_CLIENT_ID` and `GOOGLE_API_KEY` (both are fine to be public; the
   secret never goes in the repo). If the Worker got another address, change `HELPER` there too.

## Tests
```
python3 -m http.server 8765 &
python3 tests/smoke.py        # the whole app in a phone-size browser, Google faked, plus French
node tests/files_exist.mjs    # the offline copy has every file it needs
```
