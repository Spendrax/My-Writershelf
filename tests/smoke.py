# Runs the whole app in a phone-size browser. Google is faked (no real account needed):
# the test answers the app's Google requests itself, with a pretend Doc.
#   python3 -m http.server 8765 &   then   python3 tests/smoke.py
import json, re
from playwright.sync_api import sync_playwright

URL = 'http://localhost:8765/'
doc = {'text': 'word ' * 150, 'time': 't1', 'sent': []}  # the pretend Google Doc

def fake_google(route):
    u, m = route.request.url, route.request.method
    ok = lambda d: route.fulfill(status=200, content_type='application/json', body=json.dumps(d),
                                 headers={'Access-Control-Allow-Origin': '*'})
    if m == 'OPTIONS':
        return route.fulfill(status=204, headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'})
    if '/gtoken' in u: return ok({'access_token': 'pass', 'expires_in': 3600})
    if ':batchUpdate' in u:
        text = route.request.post_data_json['requests'][0]['insertText']['text']
        doc['sent'].append(text); doc['text'] += text; doc['time'] = 't' + str(len(doc['sent']) + 1)
        return ok({})
    if '/export' in u:
        return route.fulfill(status=200, content_type='text/plain', body=doc['text'], headers={'Access-Control-Allow-Origin': '*'})
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
    assert abs(got[0] - (r[0] + 60)) < 3 and got[1].endswith(', 0px)') and got[2:] == [False, False], got
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
    pg.click('.spine'); pg.click('[data-do=write]'); pg.wait_for_timeout(500)
    assert 'word' in pg.inner_text('#wCtx')
    pg.fill('#wText', 'three more words'); pg.dispatch_event('#wText', 'input')
    assert pg.evaluate("localStorage.getItem('ws.draft.b1')") == 'three more words', 'kept on the phone while typing'
    pg.click('#wSend'); pg.wait_for_timeout(500)
    assert doc['sent'] == ['\nthree more words'] and pg.evaluate("localStorage.getItem('ws.draft.b1')") is None
    assert pg.evaluate('[byId("b1").words, wroteToday()]') == [153, 53]
    pg.evaluate('refreshAll()'); pg.wait_for_timeout(500)
    assert pg.evaluate('[byId("b1").words, wroteToday()]') == [153, 53], 'reading the Doc again counts nothing twice'
    pg.evaluate("addDocs([{id:'DOC2',name:'Brand new'},{id:'DOC1',name:'Northbound'}])"); pg.wait_for_timeout(500)
    assert pg.evaluate('[books.length, books[0].words, wroteToday()]') == [2, 153, 53], 'a picked Doc’s old words are not today’s'
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
