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
    assert pg.evaluate("[!!pet.querySelector('.heart'), set.pets, set.got.includes('pets'), hatUnlocked('flowers'), hatUnlocked('crown')]") == [True, 25, True, True, False]
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
    # (a paragraph with a picture shows the picture, with its text; it can't be changed here)
    pic = pg.evaluate('''paraOf({startIndex: 5, endIndex: 9, paragraph: {elements: [{textRun: {content: 'Map '}}, {inlineObjectElement: {inlineObjectId: 'i1'}}, {textRun: {content: '\\n'}}]}},
      {inlineObjects: {i1: {inlineObjectProperties: {embeddedObject: {imageProperties: {contentUri: 'https://lh3.example/pic'}, size: {width: {magnitude: 300}}}}}}})''')
    assert pic['fixed'] and pic['pic'] and pic['html'].startswith('Map <img src="https://lh3.example/pic"') and 'width:400px' in pic['html'], pic
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
    pg.click('#dlgWrite [data-close]')
    pg.evaluate('refreshAll()'); pg.wait_for_timeout(500)
    assert pg.evaluate('[byId("b1").words, wroteToday()]') == [154, 54], 'reading the Doc again counts nothing twice'
    pg.evaluate("addDocs([{id:'DOC2',name:'Brand new'},{id:'DOC1',name:'Northbound'}])"); pg.wait_for_timeout(500)
    assert pg.evaluate('[books.length, books[0].words, wroteToday()]') == [2, 154, 54], 'a picked Doc’s old words are not today’s'
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
