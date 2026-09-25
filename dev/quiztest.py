"""퀴즈 주제마다 문제를 여러 개 만들어 풀어 본다: 오류 · 보기 수 · 정답 표시 · 보기 중복 · 문제 만드는 시간.
사용: python dev/quiztest.py [주제마다 문제 수=6]"""
import sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).parent))
from run import serve, PORT
N = int(sys.argv[1]) if len(sys.argv) > 1 else 6
srv = serve()
bad = []
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    p = b.new_page(viewport={'width': 1280, 'height': 900})
    errs = []
    p.on('pageerror', lambda e: errs.append(str(e)))
    p.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type == 'error' else None)
    p.goto(f'http://127.0.0.1:{PORT}/index.html#quiz'); time.sleep(3)
    p.evaluate('localStorage.clear()'); p.reload(); time.sleep(3)
    areas = p.evaluate("[...document.querySelectorAll('[data-area]')].map(b => b.dataset.area)")
    for area in areas:
        p.click(f'[data-area="{area}"]'); time.sleep(0.3)
        variants = {'name': [('dir', 'name'), ('dir', 'struct'), ('level', 'hard')], 'react': [('rx', 'prod'), ('rx', 'reagent')]}.get(area, [(None, None)])
        topics = p.evaluate("[...document.querySelectorAll('[data-topic]')].map(b => b.dataset.topic)")
        for attr, val in variants:
            if attr: p.click(f'[data-{attr}="{val}"]'); time.sleep(0.2)
            for t in topics:
                t0 = time.time(); p.click(f'[data-topic="{t}"]'); p.wait_for_selector('.q-card .q-opt, .q-card #q-next', timeout=60000)
                times = [time.time() - t0]
                for k in range(N):
                    info = p.evaluate("""() => { const o = [...document.querySelectorAll('.q-card .q-opt')];
                      return { n: o.length, texts: o.map(x => x.innerText.replace(/\\s+/g, ' ').trim()), prompt: (document.querySelector('.q-prompt') || {}).innerText || '', fail: !!document.querySelector('.q-card p') && /만들지 못했/.test(document.querySelector('.q-card').innerText) }; }""")
                    tag = f'{area}/{t}' + (f' {val}' if attr else '')
                    if info['fail']: bad.append(f'{tag}: 문제를 못 만듦'); break
                    if info['n'] < 2: bad.append(f'{tag}: 보기 {info["n"]}개')
                    if len(set(info['texts'])) < info['n'] and 'pic' not in p.evaluate("document.querySelector('.q-opt').className"): bad.append(f'{tag}: 같은 보기 {info["texts"]}')
                    p.click(f'.q-card .q-opt[data-i="{k % max(1, info["n"])}"]'); time.sleep(0.15)
                    right = p.evaluate("document.querySelectorAll('.q-card .q-opt.right').length")
                    if right != 1: bad.append(f'{tag}: 정답 표시 {right}개 — {info["prompt"][:60]} {info["texts"]}')
                    t1 = time.time(); p.click('#q-next'); p.wait_for_selector('.q-card .q-opt:not([disabled]), .q-card #q-next', timeout=60000); times.append(time.time() - t1)
                print(f'{area:6s} {t:10s} {val or "":8s} avg {sum(times) / len(times) * 1000:6.0f} ms  max {max(times) * 1000:6.0f} ms')
    p.screenshot(path=str(Path(__file__).parent / 'out' / 'quiz_topics.png'), full_page=True)
    stats = p.evaluate("JSON.parse(localStorage.getItem('hexa:quizStats') || '{}')")
    print('stats keys:', len(stats))
    b.close()
srv.shutdown()
print('errors:', errs[:10])
print('RESULT:', 'ALL OK' if not bad and not errs else '\n'.join(bad[:40]))
