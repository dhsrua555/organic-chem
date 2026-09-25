"""실제 조작 시험: 분자 조립(붙이기 · 결합 · 지우기 · E/Z · 되돌리기 · 유명 분자) · 3D 보기(확대 · 회전) ·
반응 예측 · 메뉴 · 언어 · 퀴즈(반응 포함) · 도감 링크 · 커서 효과"""
import sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).parent))
from run import serve, PORT
OUT = Path(__file__).parent / 'out'
URL = f'http://127.0.0.1:{PORT}/index.html'
srv = serve()
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width': 1440, 'height': 900})
    p = ctx.new_page()
    errs = []
    p.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    p.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
    p.goto(URL + '#build'); time.sleep(3)
    p.evaluate('localStorage.clear()'); p.reload(); time.sleep(3)
    name = lambda: p.inner_text('.name-main')
    ch = lambda: p.inner_text('.changes ul').replace('\n', ' | ') if p.query_selector('.changes ul') else '-'
    smi = lambda: p.inner_text('.stage-foot .smi')
    print('start:', name(), smi())
    # 프로펜(C=CC): 원자 2(C3)에 OH
    p.click('.chip[data-g="OH"]'); p.click('.svgwrap [data-atom="2"]'); time.sleep(0.4)
    print('C3+OH:', name(), '|', ch())
    # 사슬 늘리기: C1 쪽 끝에 탄소 3개 이어 붙이기
    p.click('.chip[data-g="CH3"]')
    for k in range(3):
        n = p.evaluate("document.querySelectorAll('.svgwrap [data-atom]').length")
        target = 0 if k == 0 else n - 1
        p.click(f'.svgwrap [data-atom="{target}"]'); time.sleep(0.3)
        print(f'  +C on {target}:', name())
    # 결합 도구: 첫 결합 순환
    p.click('.tool[data-tool="bond"]')
    p.click('.svgwrap [data-bond="0"]'); time.sleep(0.3); print('bond0 cycle:', name())
    p.click('.svgwrap [data-bond="0"]'); time.sleep(0.3); print('bond0 cycle2:', name(), '|', p.inner_text('.pal-info'))
    p.click('#b-undo'); time.sleep(0.3); print('undo:', name())
    # E/Z 뒤집기
    p.click('.tool[data-tool="flip"]')
    bonds = p.evaluate("[...document.querySelectorAll('.svgwrap [data-bond]')].map(e => e.dataset.bond)")
    before = name()
    for k in bonds:
        p.dispatch_event(f'.svgwrap [data-bond="{k}"]', 'click'); time.sleep(0.2)
        if name() != before: break
    print('flip:', before, '→', name())
    # 지우기
    p.click('.tool[data-tool="erase"]')
    n = p.evaluate("document.querySelectorAll('.svgwrap [data-atom]').length")
    p.click(f'.svgwrap [data-atom="{n - 1}"]'); time.sleep(0.3); print('erase last:', name())
    p.screenshot(path=str(OUT / 'act_build1.png'))
    # 사이클로헥세인 + 페닐
    p.click('.scaf[data-t="cyclohexane"]'); time.sleep(0.3)
    p.click('.tool[data-tool="add"]'); p.click('.chip[data-g="phenyl"]'); p.click('.svgwrap [data-atom="0"]'); time.sleep(0.4)
    print('cyclohexylbenzene:', name())
    # 유명한 분자
    p.click('.famous summary'); p.click('.fam-list [data-t="capsaicin"]'); time.sleep(0.6)
    print('capsaicin:', name(), '|', p.inner_text('.name-common') if p.query_selector('.name-common') else '')
    p.screenshot(path=str(OUT / 'act_build_big.png'))
    p.click('.seg.small [data-mode="skeletal"]'); time.sleep(0.4)
    p.screenshot(path=str(OUT / 'act_build_skel.png'))
    p.click('.seg.small [data-mode="atoms"]'); time.sleep(0.2)
    # 무작위
    for k in range(3): p.click('#b-rand'); time.sleep(0.3); print('rand:', name())
    # 언어
    p.click('.lang button[data-lang="ko"]'); time.sleep(0.3); print('ko:', name())
    p.click('.lang button[data-lang="en"]'); time.sleep(0.3)
    # 3D 보기: 가운데를 누르면 캔버스가 받아야 한다
    p.click('.scaf[data-t="benzene"]'); time.sleep(0.2)
    p.click('.chip[data-g="COOH"]'); p.click('.svgwrap [data-atom="0"]'); time.sleep(0.3)
    p.click('#b-3d'); time.sleep(2.5)
    hit = p.evaluate("(() => { const e = document.elementFromPoint(720, 420); return e ? (e.id || e.className || e.tagName) : null })()")
    print('3D: element at center =', hit)
    p.screenshot(path=str(OUT / 'act_3d_a.png'))
    for k in range(5): p.mouse.move(720, 420); p.mouse.wheel(0, -300); time.sleep(0.1)
    time.sleep(1.2); p.screenshot(path=str(OUT / 'act_3d_zoomin.png'))
    p.mouse.move(720, 420); p.mouse.down(); p.mouse.move(980, 520, steps=12); p.mouse.up(); time.sleep(1.0)
    p.screenshot(path=str(OUT / 'act_3d_rot.png'))
    p.click('#z-out'); p.click('#z-out'); p.click('#z-out'); time.sleep(1)
    p.screenshot(path=str(OUT / 'act_3d_zoomout.png'))
    p.click('#z-h'); time.sleep(0.8); p.screenshot(path=str(OUT / 'act_3d_noh.png')); p.click('#z-h')
    p.keyboard.press('Escape'); time.sleep(0.5)
    print('focus3d off:', p.evaluate('document.body.classList.contains("focus3d")'))
    # 반응 예측으로
    p.click('#b-react'); time.sleep(1.5)
    print('react route:', p.evaluate('location.hash'), '| sub:', p.inner_text('.rx-subname').replace('\n', ' / '))
    p.click('.rx-cats [data-cat="sn"]'); time.sleep(0.2)
    p.click('.ex-chips [data-smi="CCC(C)Br"]'); time.sleep(0.3)
    rids = p.evaluate("[...document.querySelectorAll('.rx-btn')].map(b => b.dataset.rid + (b.classList.contains('dim') ? '(dim)' : ''))")
    print('sn reagents:', rids)
    p.query_selector('.rx-btn:not(.dim)').click(); time.sleep(0.6)
    print('result:', p.inner_text('.rx-scheme').replace('\n', ' / ')[:300])
    p.screenshot(path=str(OUT / 'act_react.png'), full_page=True)
    # 모든 분류 · 예시 · 시약을 눌러서 오류가 없는지
    cats = p.evaluate("[...document.querySelectorAll('[data-cat]')].map(b => b.dataset.cat)")
    total = 0
    for c in cats:
        p.click(f'[data-cat="{c}"]'); time.sleep(0.1)
        smis = p.evaluate("[...document.querySelectorAll('.ex-chips [data-smi]')].map(b => b.dataset.smi)")
        for s in smis:
            p.click(f'[data-cat="{c}"]')
            p.evaluate("s => [...document.querySelectorAll('.ex-chips [data-smi]')].find(b => b.dataset.smi === s).click()", s)
            for r in p.evaluate("[...document.querySelectorAll('.rx-btn')].map(b => b.dataset.rid)"):
                p.evaluate("r => document.querySelector('.rx-btn[data-rid=\"' + r + '\"]').click()", r); total += 1
    print('react sweep clicks:', total, 'errors so far:', len(errs))
    p.click('[data-cat="cc"]'); p.evaluate("[...document.querySelectorAll('.ex-chips [data-smi]')].find(b => b.dataset.smi === 'C=CCCCC=C').click()")
    p.evaluate("document.querySelector('.rx-btn[data-rid=\"grubbs\"]').click()"); time.sleep(0.5)
    print('RCM:', p.inner_text('.rx-scheme').replace('\n', ' / ')[:200])
    p.screenshot(path=str(OUT / 'act_react_rcm.png'), full_page=True)
    # 메뉴
    p.click('#menu-btn'); time.sleep(0.8); p.screenshot(path=str(OUT / 'act_menu.png'))
    p.click('.menu-list a[href="#quiz"]'); time.sleep(1.5)
    print('route:', p.evaluate('location.hash'), p.evaluate('document.getElementById("menu").hidden'))
    for mode in ['name', 'struct', 'react']:
        p.click(f'.q-bar [data-mode="{mode}"]'); time.sleep(0.5)
        for k in range(3):
            opts = p.query_selector_all('.q-opt')
            opts[k % len(opts)].click(); time.sleep(0.3)
            print(f' quiz {mode}:', p.inner_text('.q-verdict')[:70].replace('\n', ' '))
            if k < 2: p.click('#q-next'); time.sleep(0.3)
        p.screenshot(path=str(OUT / f'act_quiz_{mode}.png'), full_page=True)
    p.click('#q-open'); time.sleep(1.2)
    print('quiz open →', p.evaluate('location.hash'), p.inner_text('.rx-scheme')[:80].replace('\n', ' / ') if p.query_selector('.rx-scheme') else '')
    # 도감 → 조립
    p.goto(URL + '#groups-ester'); time.sleep(2)
    print('groups title:', p.inner_text('.g-hero .title'))
    p.click('[data-row="3"]'); time.sleep(1)
    print('from groups →', p.evaluate('location.hash'), name())
    # 명명법
    p.goto(URL + '#rules'); time.sleep(2); print('rules steps:', len(p.query_selector_all('.rule-step')))
    # 홈 · 커서 효과
    p.goto(URL + '#home'); time.sleep(2)
    p.mouse.move(300, 300); p.mouse.move(600, 400, steps=10); time.sleep(0.3)
    print('reticle opacity:', p.evaluate("getComputedStyle(document.querySelector('.reticle')).opacity"))
    p.mouse.down(); time.sleep(0.15); print('ripples:', p.evaluate("document.querySelectorAll('.ripple').length")); p.screenshot(path=str(OUT / 'act_fx.png')); p.mouse.up()
    for k in range(5):
        p.click('.hexbtn.next'); time.sleep(1.3); print('slide:', p.inner_text('.slide-text .title').replace('\n', ' '))
    for e in errs: print('ERR', e)
    b.close()
srv.shutdown()
