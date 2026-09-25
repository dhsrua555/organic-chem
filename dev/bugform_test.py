"""버그 제보함 → 구글 폼 시험 (실제로는 보내지 않음: docs.google.com 요청을 가로챈다).
FORM_URL 이 비어 있으면 시험용 주소로 바꿔 끼운다. 사용: python dev/bugform_test.py"""
import sys, time
from urllib.parse import parse_qs, urlparse
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).parent))
from run import serve, PORT
TEST = 'https://docs.google.com/forms/d/e/1FAIpQLtest/viewform?usp=pp_url&entry.111=%EC%9D%B4%EB%A6%84%EC%9D%B4+%ED%8B%80%EB%A0%A4%EC%9A%94&entry.222=WHAT&entry.333=WHO&entry.444=CTX'
srv = serve()
bad = []
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    p = b.new_page(viewport={'width': 1280, 'height': 900})
    errs = []
    p.on('pageerror', lambda e: errs.append(str(e)))
    sent = []
    mode = {'fail': False}
    def handle(route):
        sent.append((route.request.method, route.request.url, route.request.post_data))
        if mode['fail']: route.abort()
        else: route.fulfill(status=200, body='')
    p.route('https://docs.google.com/**', handle)
    p.goto(f'http://127.0.0.1:{PORT}/index.html#build'); time.sleep(3)
    p.evaluate('localStorage.clear()'); p.reload(); time.sleep(3)
    configured = p.evaluate("fetch('/js/report.js').then(r => r.text()).then(t => !/const FORM_URL = '';/.test(t))")
    if not configured: p.evaluate(f"import('/js/report.js').then(m => m.useForm({TEST!r}))")
    print('real form configured:', configured)
    p.click('#bug-btn'); time.sleep(0.3)
    vis = p.evaluate("[...document.querySelectorAll('.bug-send [data-send]')].filter(b => !b.hidden).map(b => b.dataset.send + (b.classList.contains('solid') ? '*' : ''))")
    print('buttons:', vis, '|', p.inner_text('.bug-hint'))
    if vis[:1] != ['form*']: bad.append('보내기 버튼이 맨 앞에 없음')
    p.click('.bug-kinds label:nth-child(3) span')
    p.fill('#bug-body', '[시험] 제보함 자동 시험입니다 — 무시해 주세요')
    p.fill('#bug-who', '시험')
    p.click('[data-send="form"]'); time.sleep(0.8)
    print('msg:', p.inner_text('.bug-msg'))
    post = [x for x in sent if x[0] == 'POST' and x[1].endswith('/formResponse')]
    if not post: bad.append('formResponse POST 없음')
    else:
        q = parse_qs(post[-1][2] or '')
        print('POST fields:', {k: v[0][:40] for k, v in q.items()})
        want = {'kind': '반응 결과가 이상해요', 'what': '[시험] 제보함'}
        vals = list(q.values())
        if not any(v[0] == want['kind'] for v in vals): bad.append('종류 값이 폼 선택지와 다름')
        if not any(v[0].startswith(want['what']) for v in vals): bad.append('내용이 안 들어감')
        if not any('분자 SMILES' in v[0] for v in vals): bad.append('화면 정보가 안 들어감')
    if p.input_value('#bug-body'): bad.append('보낸 뒤 글이 지워지지 않음')
    # 네트워크가 막히면 채워 둔 폼을 새 창으로
    mode['fail'] = True
    p.evaluate("window.open = u => { window.__opened = u; return {}; }")
    p.fill('#bug-body', '[시험] 두 번째'); p.click('[data-send="form"]'); time.sleep(0.8)
    opened = p.evaluate('window.__opened') or ''
    print('fallback opened:', opened[:120], '|', p.inner_text('.bug-msg'))
    u = urlparse(opened); q = parse_qs(u.query)
    if not (u.path.endswith('/viewform') and q.get('usp') == ['pp_url'] and any(v[0] == '[시험] 두 번째' for v in q.values())): bad.append('새 창 폼 주소가 이상함')
    # GitHub 버튼도 새 창 (noopener 로 null 이 돌아와 "막힘" 이라 하던 문제)
    p.click('[data-send="gh"]'); time.sleep(0.3)
    if '막혔' in p.inner_text('.bug-msg'): bad.append('GitHub 새 창을 막혔다고 잘못 안내')
    print('errors:', errs)
    b.close()
srv.shutdown()
print('RESULT:', 'ALL OK' if not bad and not errs else bad + errs)
