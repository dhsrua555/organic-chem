"""분광학 연습 문제 화면을 주제마다 찍는다 (문제 · 채점 뒤): dev/out/sq_<주제>_<a|b>.png. 사용: python dev/specquiz.py [mobile]"""
import sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).parent))
from run import serve, PORT
OUT = Path(__file__).parent / 'out'
mobile = 'mobile' in sys.argv
cfg = dict(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2) if mobile else dict(viewport={'width': 1280, 'height': 900})
srv = serve()
errs = []
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    p = b.new_context(**cfg).new_page()
    p.on('pageerror', lambda e: errs.append(str(e)))
    p.goto(f'http://127.0.0.1:{PORT}/index.html#quiz'); time.sleep(3)
    p.click('[data-area="spec"]'); time.sleep(0.5)
    for t in ['irtab', 'irspec', 'msion', 'msfrag', 'formula']:
        if mobile: p.evaluate("document.querySelector('.q-topics-box').open = true")
        p.click(f'[data-topic="{t}"]'); time.sleep(0.6)
        p.screenshot(path=str(OUT / f'sq_{t}_a{"_m" if mobile else ""}.png'), full_page=True)
        p.click('.q-card .q-opt[data-i="1"]'); time.sleep(0.4)
        p.screenshot(path=str(OUT / f'sq_{t}_b{"_m" if mobile else ""}.png'), full_page=True)
        w = p.evaluate('[document.documentElement.scrollWidth, innerWidth]')
        if w[0] > w[1] + 1: errs.append(f'{t}: 가로 넘침 {w}')
    b.close()
srv.shutdown()
print(errs or 'OK')
