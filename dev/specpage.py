"""분광 분석 페이지 점검: 예시 화합물을 모두 불러 IR · 질량 탭을 그리고, 표의 줄을 가리키면 구조식이 강조되는지,
오류 · 가로 넘침이 없는지 본다. 화면도 찍는다 (dev/out/spec_*.png). 사용: python dev/specpage.py"""
import sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).parent))
from run import serve, PORT
OUT = Path(__file__).parent / 'out'
srv = serve()
bad = []
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    for dev, cfg in {'desktop': dict(viewport={'width': 1440, 'height': 900}), 'mobile': dict(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)}.items():
        ctx = b.new_context(**cfg)
        p = ctx.new_page()
        errs = []
        p.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        p.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type == 'error' else None)
        p.goto(f'http://127.0.0.1:{PORT}/index.html#spectra'); time.sleep(3)
        p.evaluate('localStorage.clear()'); p.reload(); time.sleep(3.5)
        opts = p.evaluate("[...document.querySelectorAll('#s-ex option')].map(o => o.value).filter(Boolean)")
        if dev == 'mobile': opts = opts[::6]
        for smi in opts:
            p.select_option('#s-ex', smi); time.sleep(0.15)
            for tab in ['ms', 'ir']:
                p.click(f'#tb-spec-{tab}'); time.sleep(0.1)
                rows = p.evaluate(f"document.querySelectorAll('#tp-spec-{tab} tr[data-band], #tp-spec-{tab} tr[data-mz]').length")
                if not rows: bad.append(f'{dev} {smi} {tab}: 표가 비었음'); continue
                sel = f'#tp-spec-{tab} tr[data-band]' if tab == 'ir' else f'#tp-spec-{tab} tr[data-mz]'
                p.hover(sel, timeout=3000) if dev == 'desktop' else p.click(sel)
                time.sleep(0.05)
                hl = p.evaluate("document.querySelectorAll('.sp-svg .hl, .sp-svg .m-hlc').length")
                if not hl: bad.append(f'{dev} {smi} {tab}: 강조 없음')
            w = p.evaluate('[document.documentElement.scrollWidth, innerWidth]')
            if w[0] > w[1] + 1: bad.append(f'{dev} {smi}: 가로 넘침 {w}')
        # 벤질 알코올 107 · 108 · 109: 구조식 표시와 설명이 서로 달라야 한다 (−H · 분자 이온 · ¹³C)
        p.select_option('#s-ex', 'OCc1ccccc1'); time.sleep(0.2)
        p.click('#tb-spec-ms'); time.sleep(0.2)
        caps = {}
        for mz in (107, 108, 109):
            p.hover(f'.ms-bar[data-mz="{mz}"] rect.hit', force=True) if dev == 'desktop' else p.click(f'.ms-bar[data-mz="{mz}"] rect.hit', force=True)
            time.sleep(0.1)
            caps[mz] = (p.inner_text('.sp-sel'), p.evaluate("document.querySelectorAll('.sp-svg .m-hs').length"))
            if mz == 107: p.screenshot(path=str(OUT / f'spec_107_{dev}.png'))
        if caps[107][1] < 1: bad.append(f'{dev} 107: −H 표시 없음 {caps[107]}')
        if '¹³C' not in caps[109][0]: bad.append(f'{dev} 109: ¹³C 설명 없음 {caps[109]}')
        if '분자 이온' not in caps[108][0]: bad.append(f'{dev} 108: 분자 이온 설명 없음 {caps[108]}')
        print(dev, {k: v[0].split(chr(10))[0] for k, v in caps.items()})
        p.select_option('#s-ex', 'CCCBr'); time.sleep(0.2)
        p.click('#tb-spec-ms'); time.sleep(0.2)
        p.screenshot(path=str(OUT / f'spec_ms_{dev}.png'), full_page=True)
        p.click('#tb-spec-ref'); time.sleep(0.2)
        p.screenshot(path=str(OUT / f'spec_ref_{dev}.png'), full_page=dev == 'desktop')
        p.click('#tb-spec-ir'); p.select_option('#s-ex', 'Cc1ccccc1'); time.sleep(0.2)
        p.click('.ir-mk[data-band="0"] circle'); time.sleep(0.2)
        p.screenshot(path=str(OUT / f'spec_ir_{dev}.png'))
        # 편집기 → 스펙트럼 버튼
        p.goto(f'http://127.0.0.1:{PORT}/index.html#build'); time.sleep(2)
        p.click('#b-spec'); time.sleep(1.5)
        if 'spectra' not in p.url: bad.append(f'{dev}: 편집기의 스펙트럼 버튼이 이동하지 않음')
        print(dev, len(opts), '화합물')
        for e in errs: bad.append(f'{dev} {e}')
        ctx.close()
    b.close()
srv.shutdown()
print('\n'.join(bad) or 'ALL OK')
