# Runs the whole app in a phone-size browser. Google is faked (no real account needed):
# the test answers the app's Google requests itself, with a pretend Doc.
#   python3 -m http.server 8765 &   then   python3 tests/smoke.py
import json, re
from playwright.sync_api import sync_playwright

URL = 'http://localhost:8765/'
# the pretend Google Doc: a heading and one long paragraph (150 words), kept the way Google counts positions
doc = {'paras': ['Chapter One', ' '.join(['word'] * 148)], 'rev': 'r1', 'time': 't1', 'sent': []}
full = lambda: '\n'.join(doc['paras']) + '\n'

def doc_json():
    content, i = [], 1
    for n, t in enumerate(doc['paras']):
        content.append({'startIndex': i, 'endIndex': i + len(t) + 1, 'paragraph': {
            'paragraphStyle': {'namedStyleType': 'HEADING_1' if n == 0 else 'NORMAL_TEXT'},
            'elements': [{'textRun': {'content': t + '\n'}}]}})
        i += len(t) + 1
    return {'revisionId': doc['rev'], 'body': {'content': content}}

def apply_requests(body):
    text = full()
    for r in body['requests']:
        if 'deleteContentRange' in r:
            g = r['deleteContentRange']['range']; text = text[:g['startIndex'] - 1] + text[g['endIndex'] - 1:]
        elif 'endOfSegmentLocation' in r['insertText']:
            text = text[:-1] + r['insertText']['text'] + '\n'
        else:
            k = r['insertText']['location']['index'] - 1; text = text[:k] + r['insertText']['text'] + text[k:]
    doc['paras'] = text[:-1].split('\n'); doc['sent'].append(body['requests'])
    doc['rev'] = 'r' + str(len(doc['sent']) + 1); doc['time'] = 't' + str(len(doc['sent']) + 1)

def fake_google(route):
    u, m = route.request.url, route.request.method
    ok = lambda d: route.fulfill(status=200, content_type='application/json', body=json.dumps(d),
                                 headers={'Access-Control-Allow-Origin': '*'})
    if m == 'OPTIONS':
        return route.fulfill(status=204, headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'})
    if '/gtoken' in u: return ok({'access_token': 'pass', 'expires_in': 3600})
    if '/where' in u: return ok({'lat': 45.5, 'lon': -73.6})
    if '/revisions' in u: return ok({'revisions': doc.get('revs', [])})
    if '/gexport' in u:  # an earlier version of the Doc, read through the helper
        assert route.request.post_data_json['token'] == 'pass'
        return route.fulfill(status=200, content_type='text/plain', body=doc['old'], headers={'Access-Control-Allow-Origin': '*'})
    if ':batchUpdate' in u:
        body = route.request.post_data_json
        if body['writeControl']['requiredRevisionId'] != doc['rev']:  # changed elsewhere: Google refuses
            return route.fulfill(status=400, body='{}', headers={'Access-Control-Allow-Origin': '*'})
        apply_requests(body)
        return ok({})
    if '/v1/documents/' in u: return ok(doc_json())
    if '/export' in u:
        return route.fulfill(status=200, content_type='text/plain', body=full(), headers={'Access-Control-Allow-Origin': '*'})
    if 'fields=modifiedTime' in u: return ok({'modifiedTime': doc['time']})
    if 'appDataFolder' in u: return ok({'files': []})
    return ok({'id': 'F1'})

def page(b, locale='en-US', google=False):
    pg = b.new_page(locale=locale, viewport={'width': 390, 'height': 844}, service_workers='block')  # no offline copy: always the files as they are now
    pg.errs = []
    pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    if google:
        # give the app a pretend Google set-up and sign-in
        def with_id(route):
            body = open('js/02-google.js').read().replace("GOOGLE_CLIENT_ID = '", "GOOGLE_CLIENT_ID = '123-x'; '")
            route.fulfill(status=200, content_type='text/javascript', body=body)
        pg.route('**/js/02-google.js', with_id)
        pg.route(re.compile(r'googleapis\.com/(drive|upload|v1)|workers\.dev'), fake_google)
        pg.route('**/api.open-meteo.com/**', lambda r: r.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'},
            body=json.dumps({'current': {'time': '2026-11-18T12:00', 'temperature_2m': -2.4, 'weather_code': 73, 'is_day': 1},
                             'daily': {'sunrise': ['2026-11-18T07:00'], 'sunset': ['2026-11-18T16:20']}})))
        books = [{'id': 'b1', 'title': 'Northbound', 'doc': 'DOC1', 'docTime': 't0', 'words': 100, 'target': 1000, 'status': 'draft', 'added': 1}]
        pg.add_init_script("if(!localStorage.getItem('ws.set')){localStorage.setItem('ws.set',JSON.stringify({google:{refresh:'r',last:0,file:''}}));localStorage.setItem('ws.books',%s)}" % json.dumps(json.dumps(books)))
    pg.goto(URL); pg.wait_for_timeout(600)
    return pg

def add(pg, title, words, target):
    pg.click('#btnAdd'); pg.click('#addManual')
    pg.fill('[name=title]', title); pg.fill('[name=words]', str(words)); pg.fill('[name=target]', str(target))
    pg.click('#fEdit .btn.primary'); pg.wait_for_timeout(100)

with sync_playwright() as p:
    b = p.chromium.launch()

    # --- by hand: books, today's words, the daily goal, the streak, the walls, removing, backups
    pg = page(b)
    add(pg, 'Ashes of Winter', 9000, 50000)
    assert pg.evaluate('wroteToday()') == 0, 'a new book’s words were not written today'
    pg.click('.spine'); pg.click('[data-do=edit]'); pg.fill('[name=words]', '9300'); pg.click('#fEdit .btn.primary')
    assert pg.evaluate('[wroteToday(), streak()]') == [300, 0]
    pg.click('.spine'); pg.click('[data-do=edit]'); pg.fill('[name=words]', '9520'); pg.click('#fEdit .btn.primary')
    assert pg.evaluate('[wroteToday(), streak(), bestStreak()]') == [520, 1, 1], 'goal of 500 reached today'
    assert 'happy' in pg.get_attribute('#pet', 'class')
    pg.click('.dots [data-k="-1"]'); pg.wait_for_timeout(500)
    pg.click('[data-g="50"]'); assert pg.evaluate('[set.goal, streak()]') == [550, 1], 'raising the goal keeps today earned'
    pg.click('.dots [data-k="1"]'); pg.wait_for_timeout(500)
    assert pg.inner_text('#statsBody .kpi b') == '9,520'
    pg.click('.dots [data-k="0"]'); pg.wait_for_timeout(500)
    saved = pg.evaluate('JSON.stringify(backupData())')
    pg.click('.spine'); pg.click('[data-do=edit]'); pg.once('dialog', lambda d: d.accept()); pg.click('#eDel')
    assert pg.evaluate('books.length') == 0
    pg.evaluate('mergeFrom(%s)' % saved)
    assert pg.evaluate('books.length') == 0, 'a removed book stays removed when copies are merged'
    pg.evaluate("mergeFrom({books:[{id:'x',title:'From my other phone',words:10,updated:5}],settings:{log:{[today()]:900},hit:{}}})")
    assert pg.evaluate('[books.length, wroteToday()]') == [1, 900], 'merge keeps the highest count of the day'
    # Customize: another animal and floor show right away and are kept
    pg.click('#btnLook'); pg.click('[data-k=kind] [data-v=fox]'); pg.click('[data-k=floor] [data-v="#7a5c3a"]'); pg.click('[data-k=rug] [data-v=none]')
    assert pg.evaluate("[pet.dataset.kind, !!pet.querySelector('.leg'), getComputedStyle(document.documentElement).getPropertyValue('--fl'), $('.rug').hidden, load('ws.set').look.kind]") == ['fox', True, '#7a5c3a', True, 'fox']
    # the room shows what you're changing: lights at the top of the wall, the floor at the bottom
    pg.click('[data-k=led] [data-v="#9fd6ff"]'); pg.wait_for_timeout(900); assert pg.evaluate("$('#view-attic').scrollTop") == 0
    pg.click('[data-k=floor] [data-v="#4a3320"]'); pg.wait_for_timeout(900)
    assert pg.evaluate("(v => v.scrollTop > 0 && v.scrollTop + v.clientHeight >= v.scrollHeight - 2)($('#view-attic'))")
    pg.click('#dlgLook [data-close]'); pg.evaluate("$('#view-attic').scrollTo(0, 1e6)")
    # pick the buddy up, carry it over the shelf, let go: it drops to the floor there, without talking
    pg.evaluate('clearTimeout(petTimer); clearTimeout(say.t); pet.classList.remove("talk")')
    r = pg.evaluate("(r => [r.x + 38, r.y + 40])(pet.getBoundingClientRect())")
    m = pg.mouse; m.move(r[0], r[1]); m.down(); m.move(r[0] + 60, r[1] - 200, steps=6)
    assert pg.evaluate("pet.classList.contains('held') && pet.getBoundingClientRect().y") < r[1] - 150
    m.up(); pg.wait_for_timeout(500)
    got = pg.evaluate("[Math.round(pet.getBoundingClientRect().x + 38), pet.style.transform, pet.classList.contains('talk'), pet.classList.contains('held')]")
    assert abs(got[0] - (r[0] + 60)) < 3 and got[2:] == [False, False], got  # (it falls onto whatever is below)
    # let go above a shelf board: it lands on the board, not the floor
    pg.evaluate("$('#view-attic').scrollTo(0, 0)"); pg.wait_for_timeout(200)
    board = pg.evaluate("$('.shelf').getBoundingClientRect().top + 150")
    r = pg.evaluate("(r => [r.x + 38, r.y + 40])(pet.getBoundingClientRect())")
    m.move(r[0], r[1]); m.down(); m.move(150, board - 120, steps=6); m.up(); pg.wait_for_timeout(800)
    got = pg.evaluate("[where.y < 0, Math.round(pet.getBoundingClientRect().bottom - $('.shelf').getBoundingClientRect().top)]")
    assert got[0] and abs(got[1] - 150) < 3, got
    # tap the bowl: it hops down, walks over and eats, then the bowl is empty
    pg.evaluate("clearTimeout(petTimer)"); pg.click('#view-attic .bowl', force=True)
    assert pg.evaluate("$('#view-attic .bowl').classList.contains('full')")
    pg.wait_for_function("pet.classList.contains('eat')", timeout=15000)
    assert pg.evaluate("[where.y, Math.abs(pet.getBoundingClientRect().right - 16 - $('#view-attic .bowl').getBoundingClientRect().left) < 3]") == [0, True]
    pg.wait_for_function("!$('#view-attic .bowl').classList.contains('full') && !pet.classList.contains('eat')", timeout=6000)
    pg.evaluate("$('#view-attic').scrollTo(0, 1e6)"); pg.wait_for_timeout(200)
    # on its own: walks under something it can reach and jumps up onto it
    pg.set_viewport_size({'width': 390, 'height': 844}); pg.evaluate("$('#view-attic').scrollTo(0, 1e6); clearTimeout(petTimer)"); pg.wait_for_timeout(300)
    assert pg.evaluate('jumpUp()'), 'something to jump on'
    pg.wait_for_function("where.y < 0 && !pet.classList.contains('walk') && !pet.classList.contains('leap')", timeout=15000); pg.wait_for_timeout(300)
    got = pg.evaluate("(b => [...$$('.pinned, .card, .kpi'), ...[0,1,2].map(k => ({getBoundingClientRect: () => ({top: $('.shelf').getBoundingClientRect().top + 150 + k * 172})}))].some(el => Math.abs(el.getBoundingClientRect().top - b) < 3))(pet.getBoundingClientRect().bottom)")
    assert got, 'standing on a surface'
    pg.evaluate("clearTimeout(petTimer); hopDown(() => {})"); pg.wait_for_timeout(500)
    # up on a shelf, opening Customize (the walls get shorter) doesn't leave it floating
    pg.evaluate("$('#view-attic').scrollTo(0, 0); clearTimeout(petTimer); where.x = 150; where.y = $('.shelf').getBoundingClientRect().top + 140 - ($('#view-attic .floor').getBoundingClientRect().bottom - 50); landPet()"); pg.wait_for_timeout(800)
    on_board = "Math.round(pet.getBoundingClientRect().bottom - $('.shelf').getBoundingClientRect().top)"
    assert pg.evaluate(on_board) == 150, pg.evaluate(on_board + " + ' ' + JSON.stringify(where) + ' ' + $('.shelf').getBoundingClientRect().height")
    pg.click('#btnLook'); pg.wait_for_timeout(900); assert pg.evaluate(on_board) == 150, 'still on the board'
    pg.click('#dlgLook [data-close]'); pg.wait_for_timeout(300); assert pg.evaluate(on_board) == 150
    pg.evaluate("clearTimeout(petTimer); hopDown(() => {})"); pg.wait_for_timeout(500)
    pg.evaluate("$('#view-attic').scrollTo(0, 1e6); clearTimeout(petTimer)"); pg.wait_for_timeout(200)
    # tap it: a heart; the 25th pet wins the flower crown
    pg.evaluate('set.pets = 24; clearTimeout(petTimer)'); pg.wait_for_timeout(400); pg.click('#pet', force=True)
    got = pg.evaluate("[!!pet.querySelector('.heart'), set.pets, set.got.includes('pets'), hatUnlocked('flowers'), hatUnlocked('crown'), pet.className, pet.parentElement.className]"); assert got[:5] == [True, 25, True, True, False], got
    # hold a finger on it: petting
    r = pg.evaluate("(r => [r.x + 38, r.y + 40])(pet.getBoundingClientRect())")
    m.move(r[0], r[1]); m.down(); pg.wait_for_timeout(800)
    assert pg.evaluate("pet.classList.contains('petted') && pet.querySelectorAll('.heart').length > 0")
    m.up(); pg.wait_for_timeout(100); assert pg.evaluate("[pet.classList.contains('petted'), set.pets]") == [False, 26]
    # Customize → Hat: a hat not won yet stays locked; a won one goes on its head
    pg.click('#btnLook'); pg.click('[data-k=hat] [data-v=crown]')
    assert pg.inner_text('#toast') == '🔒 Unlock with: A finished book' and pg.evaluate('set.look.hat') == 'none'
    pg.click('[data-k=hat] [data-v=flowers]'); pg.wait_for_timeout(200)
    assert pg.evaluate("[set.look.hat, pet.querySelector('.hat').children.length > 0]") == ['flowers', True]
    pg.click('#dlgLook [data-close]'); pg.evaluate("$('#view-attic').scrollTo(0, 1e6)"); pg.wait_for_timeout(300)
    # tap the floor: it walks there
    pg.evaluate('clearTimeout(petTimer)'); f = pg.evaluate("(r => [r.x, r.y])($('#view-attic .floor').getBoundingClientRect())")
    pg.mouse.click(f[0] + 230, f[1] + 60); pg.wait_for_function("!pet.classList.contains('walk') && Math.abs(where.x - (230 - 38)) < 2", timeout=10000)
    # held at the right side of the screen: carried to the Stats wall, and the room turns
    r = pg.evaluate("(r => [r.x + 38, r.y + 40])(pet.getBoundingClientRect())")
    m.move(r[0], r[1]); m.down(); m.move(380, r[1] - 60, steps=6); pg.wait_for_timeout(900); m.up(); pg.wait_for_timeout(600)
    assert pg.evaluate("[where.wall, view, pet.parentElement === $('#view-stats .floor')]") == [1, 'stats', True]
    pg.click('.dots [data-k="0"]'); pg.wait_for_timeout(500); pg.evaluate('petGo(0)')
    pg.wait_for_function("where.wall === 0 && !pet.classList.contains('walk')", timeout=20000)
    # the buddy walks off the attic and comes in on the Stats wall's floor; the three floors are the same floor
    pg.evaluate('petGo(1)'); pg.wait_for_function("pet.parentElement === $('#view-stats .floor') && !pet.classList.contains('walk')", timeout=20000)
    assert pg.evaluate("$$('.floor').length") == 3
    # the Install button shows when the browser says the app can be installed, and opens its install window
    assert pg.is_hidden('#btnInstall')
    pg.evaluate("window.asked=0; dispatchEvent(Object.assign(new Event('beforeinstallprompt'), {prompt(){asked++}, userChoice: Promise.resolve({outcome:'accepted'})}))")
    pg.click('#btnInstall'); pg.wait_for_timeout(100)
    assert pg.evaluate('asked') == 1 and pg.is_hidden('#btnInstall')
    # --- the shelves: Writing, To continue later, Dropped, Finished; a book moves from its card
    pg.evaluate("books.push({id: 'l1', title: 'Paused one', words: 10, status: 'later', added: 1}, {id: 'd1', title: 'Old idea', words: 5, status: 'dropped', added: 1}, {id: 'i1', title: 'Needs fixing', words: 50, status: 'improve', added: 1}); save()")
    assert pg.evaluate("[...$$('#shelf .shelf-group')].map(g => g.dataset.shelf + ':' + g.querySelectorAll('.spine').length)") == ['writing:1', 'improve:1', 'later:1', 'dropped:1']
    pg.click('.spine[data-id="l1"]'); pg.click('.move [data-shelf="done"]'); pg.click('#dlgBook .x')
    assert pg.evaluate("[byId('l1').status, [...$$('#shelf .shelf-group')].map(g => g.dataset.shelf).join()]") == ['done', 'writing,improve,dropped,done']
    pg.evaluate("books = books.filter(b => !['l1', 'd1', 'i1'].includes(b.id)); save()")
    # --- the room: light by time, seasons, storms, a decoration for each medal won
    assert pg.evaluate("[timeOfDay(new Date(2026, 0, 1, 23)), timeOfDay(new Date(2026, 0, 1, 12)), timeOfDay(new Date(2026, 0, 1, 7, 10))]") == ['night', 'day', 'dawn']
    assert pg.evaluate("[9, 11, 1, 3].map(m => SEASONS.find(s => s.when(m, 10))?.id)") == ['halloween', 'winter', 'valentine', None]
    assert pg.evaluate("emit('change'); $$('#shelf .trinket').length") >= 1, 'the medal for petting put a teddy bear on the shelf'
    pg.evaluate("set.look.sky = 'storm'; applyLook()"); assert pg.evaluate("document.documentElement.dataset.sky") == 'storm' and pg.evaluate('!!flashT')
    pg.evaluate("set.look.sky = 'night'; applyLook()")
    # --- the buddy's life: a trick, the yarn, levels, hello
    pg.evaluate("$('#view-attic').scrollTo(0, 1e6); clearTimeout(petTimer); pet.className = 'pet'"); pg.wait_for_timeout(300)
    assert pg.evaluate("(() => { const r = Math.random; Math.random = () => 0; const ok = idleTrick(); Math.random = r; return [ok, pet.classList.contains('yawn')] })()") == [True, True]
    pg.wait_for_timeout(2000); pg.evaluate("clearTimeout(petTimer)"); pg.click('#yarn', force=True)
    pg.wait_for_function("pet.classList.contains('bat')", timeout=15000)
    pg.evaluate("clearTimeout(petTimer); books[0].words = 12600; save()"); pg.wait_for_timeout(200)
    got = pg.evaluate("[buddyLevel(), set.level, !!$('.confetti'), $('#bubble').textContent, allWords()]"); assert got[:3] == [6, 6, True] and got[3] in ('⭐ Level 6!', '🎩 New hat: Beanie'), got  # (level 5 was reached by an earlier book; the 10,000-word medal may speak after)
    assert 'Level 6' in pg.text_content('#goalsBody') and 'Dances' in pg.text_content('#goalsBody')
    pg.evaluate("set.seen = Date.now() - 7 * 36e5; greet()"); pg.wait_for_timeout(2700)
    assert pg.inner_text('#bubble') == '💛 You’re back!'
    # --- writing helpers: the sprint, the prompt, the calendar
    pg.click('#sprintBtn'); pg.click('[data-min="10"]'); pg.wait_for_timeout(300)
    assert pg.is_visible('#sprintBar') and '9:5' in pg.inner_text('#sprintBar')
    pg.evaluate("set.sprint.from -= 100; set.sprint.end = Date.now() - 1; tickSprint()"); pg.wait_for_timeout(500)
    assert pg.evaluate("[set.sprint, set.sprints.count, set.sprints.best]") == [None, 1, 100] and pg.is_hidden('#sprintBar')
    assert pg.inner_text('#bubble') == '🎉 Sprint done: +100 words!'
    before = pg.inner_text('#promptNote'); pg.click('#promptNote'); assert pg.inner_text('#promptNote') != before
    assert pg.evaluate("$$('.cal i.c3').length") >= 1
    pg.evaluate("$('.cal i.c3').click()"); assert pg.inner_text('#toast').endswith('words')
    # --- the daily reminder: subscribes, tells the helper the time, time zone and when today's goal is done
    told = []
    pg.route('**/my-writershelf.spendraxapp.workers.dev/reminder', lambda r: (told.append(json.loads(r.request.post_data)),
        r.fulfill(status=200, content_type='application/json', body='{"ok":true}', headers={'Access-Control-Allow-Origin': '*'})))
    pg.evaluate("pushSub = async () => ({ toJSON: () => ({ endpoint: 'https://push.example/me' }), unsubscribe: async () => true }); Notification.requestPermission = async () => 'granted'")
    pg.evaluate("$('#rTime').value = '21:30'; $('#rTime').dispatchEvent(new Event('change')); $('#rOn').checked = true; $('#rOn').dispatchEvent(new Event('change'))")
    pg.wait_for_timeout(500)
    assert pg.evaluate('set.remind') == {'on': True, 'time': '21:30'} and told[-1]['time'] == '21:30' and told[-1]['sub']['endpoint'] == 'https://push.example/me' and told[-1]['tz']
    words = pg.evaluate("caches.open('ws-push').then(c => c.match('msg')).then(r => r.json())")
    assert words['title'] == '✍️ Time to write' and words['body'], words
    pg.evaluate("$('#rOn').checked = false; $('#rOn').dispatchEvent(new Event('change'))"); pg.wait_for_timeout(300)
    assert told[-1]['off'] is True and pg.evaluate('set.remind.on') is False
    pg.click('#btnSettings'); assert pg.is_visible('#gConnect')  # Google is set up, not connected yet
    assert not pg.errs, pg.errs

    # the walls scroll together (top with top, bottom with bottom); at the bottom, the floor is at the bottom of the screen
    pg.click('#dlgSet [data-close]')
    pg.set_viewport_size({'width': 390, 'height': 560}); pg.wait_for_timeout(200)
    for where_to, top in [('bottom', False), ('top', True)]:
        pg.evaluate("(v => v.scrollTo(0, %s))($('#view-attic'))" % ('0' if top else 'v.scrollHeight')); pg.wait_for_timeout(200)
        pg.click('.dots [data-k="1"]'); pg.wait_for_timeout(600)
        v = pg.evaluate("(v => [v.scrollTop, v.scrollHeight - v.clientHeight, Math.round(v.querySelector('.floor').getBoundingClientRect().bottom)])($('#view-stats'))")
        assert v[1] > 50 and (v[0] == 0 if top else v[0] >= v[1] - 2) and (v[2] > 560 if top else v[2] == 560), (where_to, v)
        pg.click('.dots [data-k="0"]'); pg.wait_for_timeout(600)

    # --- Google Docs: word counts read by themselves, Write here, a picked Doc
    pg = page(b, google=True); pg.wait_for_timeout(2500)
    assert pg.evaluate('[byId("b1").words, wroteToday()]') == [150, 50], 'the Doc grew from 100 to 150 words'
    # the real weather in the window: snowing, -2°
    assert pg.evaluate('document.documentElement.dataset.sky') == 'snow'
    pg.click('.porthole'); assert pg.inner_text('#toast') == '-2° · Snow'
    # Open and write: the whole Doc, change a paragraph, add at the end, save
    behind = pg.evaluate("paraOf({startIndex: 1, endIndex: 7, paragraph: {elements: [{textRun: {content: '\\ue907ZETA\\n'}}]}}, {inline: {}, positioned: {}})")
    assert behind['fixed'] and 'behind or in front' in behind['html'] and behind['html'].endswith('ZETA'), 'a picture behind the text: a note, and the paragraph is kept safe'
    # (a paragraph with a picture shows the picture, with its text; it can't be changed here)
    pic = pg.evaluate('''paraOf({startIndex: 5, endIndex: 9, paragraph: {elements: [{textRun: {content: '\\u000bMap '}}, {inlineObjectElement: {inlineObjectId: 'i1'}}, {inlineObjectElement: {inlineObjectId: 'i2'}}, {textRun: {content: '\\n'}}]}},
      {inline: {i1: {inlineObjectProperties: {embeddedObject: {imageProperties: {contentUri: 'https://lh3.example/pic'}, size: {width: {magnitude: 300}}}}}, i2: {inlineObjectProperties: {embeddedObject: {}}}}, positioned: {}})''')
    assert pic['fixed'] and pic['pic'] and pic['html'].startswith('<br>Map <img src="https://lh3.example/pic"') and 'width:400px' in pic['html'] and 'nopic' in pic['html'], pic
    assert pg.evaluate("writing = {b: byId('b1'), paras: [{text: 'a'}, {text: ''}, {text: 'b'}, {text: ''}, {text: '  '}]}; drawDoc(); [...$$('#wDoc p')].map(p => p.className)") == ['', 'blank', ''], 'no empty lines after the last one'
    pg.click('.spine'); pg.click('[data-do=write]'); pg.wait_for_timeout(500)
    assert pg.evaluate("[...$$('#wDoc p')].map(p => p.className + ':' + p.innerText.slice(0, 11))") == ['h:Chapter One', ':word word w']
    pg.click('#wDoc p[data-i="1"]')
    pg.evaluate("(p => { p.innerText += ' again'; p.dispatchEvent(new Event('input', {bubbles: true})) })($('#wDoc p[data-i=\"1\"]'))")
    pg.fill('#wText', 'three more words'); pg.dispatch_event('#wText', 'input')
    draft = pg.evaluate("load('ws.draft.b1')")
    assert draft['more'] == 'three more words' and draft['edits']['1'].endswith('word again'), 'kept on the phone while typing'
    assert pg.inner_text('#wCount').startswith('154 words in the book · 54 / 500')
    pg.click('#wSend'); pg.wait_for_timeout(800)
    assert doc['paras'] == ['Chapter One', ' '.join(['word'] * 148) + ' again', 'three more words'], doc['paras']
    assert pg.evaluate("localStorage.getItem('ws.draft.b1')") is None
    assert pg.evaluate('[byId("b1").words, wroteToday()]') == [154, 54]
    # changed in Google Docs meanwhile: nothing is overwritten, your change is kept to save again
    pg.click('#wDoc p[data-i="0"]')
    pg.evaluate("(p => { p.innerText = 'Chapter 1'; p.dispatchEvent(new Event('input', {bubbles: true})) })($('#wDoc p[data-i=\"0\"]'))")
    doc['rev'] = 'changed-elsewhere'; pg.click('#wSend'); pg.wait_for_timeout(800)
    assert doc['paras'][0] == 'Chapter One' and pg.evaluate("load('ws.draft.b1').edits[0]") == 'Chapter 1'
    pg.click('#wSend'); pg.wait_for_timeout(800)
    assert doc['paras'][0] == 'Chapter 1' and pg.evaluate('byId("b1").words') == 154
    # while writing, your buddy peeks in and cheers each 100 words
    pg.fill('#wText', ' '.join(['more'] * 105)); pg.dispatch_event('#wText', 'input')
    assert pg.evaluate("$('#peek').classList.contains('talk') && $('#peek .bubble').textContent") == '🎉 +100 words!'
    pg.fill('#wText', ''); pg.dispatch_event('#wText', 'input')
    pg.click('#dlgWrite [data-close]')
    # the chapters on the book card, and opening the book at one
    pg.click('.spine'); pg.wait_for_selector('.chap')
    got = pg.evaluate("[[...$$('.chap')].map(c => c.innerText.replace(/\\s+/g, ' ')), byId('b1').chapters]"); assert got == [['Chapter 1 152'], 1], got
    pg.click('.chap'); pg.wait_for_timeout(500); assert pg.evaluate("$('#dlgWrite').open && writing.b.id") == 'b1'
    pg.click('#dlgWrite [data-close]')
    pg.evaluate('refreshAll()'); pg.wait_for_timeout(500)
    assert pg.evaluate('[byId("b1").words, wroteToday()]') == [154, 54], 'reading the Doc again counts nothing twice'
    pg.evaluate("addDocs([{id:'DOC2',name:'Brand new'},{id:'DOC1',name:'Northbound'}])"); pg.wait_for_timeout(500)
    assert pg.evaluate('[books.length, books[0].words, wroteToday()]') == [2, 154, 54], 'a picked Doc’s old words are not today’s'
    # words written last night, read this morning: they count for last night (the Doc's versions say when)
    times = pg.evaluate('''(() => { const y = new Date(); y.setDate(y.getDate() - 1); y.setHours(23, 0, 0, 0);
      const old = new Date(y); old.setDate(old.getDate() - 1); return [old.toISOString(), y.toISOString(), new Date().toISOString(), dayOf(y)] })()''')
    pg.evaluate(f"byId('b1').docTime = '{times[0]}'")
    before = pg.evaluate("[byId('b1').words, set.log[today()] || 0, set.log['%s'] || 0]" % times[3])
    link = 'https://docs.google.com/feeds/download/documents/export/Export?id=DOC1&revision=%d&exportFormat=txt'
    doc['old'] = full() + ' '.join(['y'] * 30)  # last night's version: 30 more words
    doc['paras'].append(' '.join(['y'] * 30 + ['z'] * 10))  # and 10 more this morning
    doc['revs'] = [{'modifiedTime': times[1], 'exportLinks': {'text/plain': link % 7}}, {'modifiedTime': times[2], 'exportLinks': {'text/plain': link % 8}}]
    doc['time'] = times[2]
    pg.evaluate(f"books.find(b => b.doc === 'DOC2').docTime = '{times[2]}'")  # (the other book shares the pretend Doc: leave it out)
    pg.evaluate('refreshAll()'); pg.wait_for_timeout(800)
    after = pg.evaluate("[byId('b1').words, set.log[today()] || 0, set.log['%s'] || 0]" % times[3])
    assert after == [before[0] + 40, before[1] + 10, before[2] + 30], (before, after)
    pg.evaluate('driveSync(true)'); pg.wait_for_timeout(500)
    assert pg.evaluate('set.google.file') == 'F1'
    assert not pg.errs, pg.errs

    # --- French: nothing left in English on the three walls and the sheets
    pg = page(b, 'fr-CA'); add(pg, 'Mon roman', 100, 1000); pg.click('#btnSettings')
    text = pg.evaluate("document.body.textContent + [...document.querySelectorAll('[aria-label],[placeholder]')].map(e => e.getAttribute('aria-label') || e.placeholder).join(' ')")
    left = re.findall(r'\b(Today|Goals?|Customize|Settings|Streak|Medals|Backup|words?|Save|Delete|Close|Language|book|day|Your)\b', text)
    assert 'Aujourd’hui' in text and 'OBJECTIFS' in text and not left, left
    pg.click('#dlgSet [data-close]'); pg.click('#view-attic .bowl', force=True); pg.wait_for_timeout(200)
    assert pg.inner_text('#bubble') == '🍖 À manger ? J’arrive!', pg.inner_text('#bubble')
    assert not pg.errs, pg.errs
    b.close()
print('all good')
