"""실제 조작 시험: 분자 조립에서 H 누르기 · 되돌리기 · 3D 보기 · 메뉴 · 언어 · 퀴즈 · 도감 링크"""
import sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).parent))
from run import serve, PORT
OUT = Path(__file__).parent / 'out'
srv = serve()
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width': 1440, 'height': 900})
    p = ctx.new_page()
    errs = []
    p.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    p.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
    p.goto(f'http://127.0.0.1:{PORT}/index.html#build'); time.sleep(3)
    name = lambda: p.inner_text('.name-main')
    print('start:', name())
    # 프로펜 C3 의 H 에 OH
    p.click('.chip[data-g="OH"]')
    p.click('.svgwrap [data-site="3"]'); time.sleep(0.5)
    print('C3+OH:', name()); print('  changes:', p.inner_text('.changes ul').replace('\n', ' | ') if p.query_selector('.changes ul') else '-')
    p.click('.chip[data-g="CH3"]')
    p.click('.svgwrap [data-site="4"]'); time.sleep(0.5)
    print('+CH3 on C3:', name()); print('  changes:', p.inner_text('.changes ul').replace('\n', ' | ') if p.query_selector('.changes ul') else '-')
    p.click('.chip[data-g="COOH"]')
    p.click('.svgwrap [data-site="0"]'); time.sleep(0.5)
    print('+COOH on C1:', name()); print('  changes:', p.inner_text('.changes ul').replace('\n', ' | ') if p.query_selector('.changes ul') else '-')
    p.screenshot(path=str(OUT / 'act_build1.png'))
    p.click('#b-undo'); time.sleep(0.3); print('undo:', name())
    # 떼기
    p.click('.svgwrap [data-group="CH3"]'); time.sleep(0.3); print('remove CH3:', name())
    # 벤젠
    p.click('.scaf[data-scaf="benzene"]'); time.sleep(0.3)
    for g, s in [('CHO', 0), ('OCH3', 2), ('OH', 3)]:
        p.click(f'.chip[data-g="{g}"]'); p.click(f'.svgwrap [data-site="{s}"]'); time.sleep(0.3)
    print('vanillin:', name(), '|', p.inner_text('.name-common'))
    p.screenshot(path=str(OUT / 'act_build2.png'))
    # 언어
    p.click('.lang button[data-lang="ko"]'); time.sleep(0.3); print('ko:', name())
    p.click('.lang button[data-lang="en"]'); time.sleep(0.3)
    # 3D 보기
    p.click('#b-3d'); time.sleep(2.5); p.screenshot(path=str(OUT / 'act_3d.png'))
    p.mouse.move(700, 450); p.mouse.down(); p.mouse.move(900, 500, steps=8); p.mouse.up(); time.sleep(0.5)
    p.keyboard.press('Escape'); time.sleep(0.5)
    print('focus3d off:', p.evaluate('document.body.classList.contains("focus3d")'))
    # 메뉴
    p.click('#menu-btn'); time.sleep(0.8); p.screenshot(path=str(OUT / 'act_menu.png'))
    p.click('.menu-list a[href="#quiz"]'); time.sleep(1.5)
    print('route:', p.evaluate('location.hash'), p.evaluate('document.getElementById("menu").hidden'))
    # 퀴즈: 3문제 풀기
    for k in range(3):
        opts = p.query_selector_all('.q-opt'); print(' quiz opts', len(opts), [o.inner_text()[:40] for o in opts])
        opts[0].click(); time.sleep(0.3)
        print('  verdict:', p.inner_text('.q-verdict')[:80])
        p.click('#q-next'); time.sleep(0.3)
    p.click('[data-mode="struct"]'); time.sleep(0.5)
    p.screenshot(path=str(OUT / 'act_quiz_struct.png'))
    p.query_selector_all('.q-opt')[1].click(); time.sleep(0.3)
    p.screenshot(path=str(OUT / 'act_quiz_fb.png'), full_page=True)
    # 도감 → 조립
    p.goto(f'http://127.0.0.1:{PORT}/index.html#groups-ester'); time.sleep(2)
    print('groups title:', p.inner_text('.g-hero .title'))
    p.click('[data-row="3"]'); time.sleep(1)
    print('from groups →', p.evaluate('location.hash'), name())
    # 홈 슬라이드 넘기기
    p.goto(f'http://127.0.0.1:{PORT}/index.html#home'); time.sleep(2)
    p.click('.hexbtn.next'); time.sleep(0.9); p.screenshot(path=str(OUT / 'act_home_mid.png'))
    time.sleep(1.5); print('slide:', p.inner_text('.slide-text .title'))
    for e in errs: print('ERR', e)
    b.close()
srv.shutdown()
