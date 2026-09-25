"""앱 화면을 찍는다: python dev/shot.py [route ...]  → dev/out/shot_<route>_<device>.png"""
import sys, time, json
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).parent))
from run import serve, PORT
OUT = Path(__file__).parent / 'out'
routes = sys.argv[1:] or ['home', 'build', 'react', 'groups', 'rules', 'quiz']
DEV = {'desktop': dict(viewport={'width': 1440, 'height': 900}), 'mobile': dict(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)}
srv = serve()
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    for dev, cfg in DEV.items():
        ctx = b.new_context(**cfg)
        p = ctx.new_page()
        errs = []
        p.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        p.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
        for r in routes:
            full = r.startswith('full:')
            r = r.replace('full:', '')
            p.goto(f'http://127.0.0.1:{PORT}/index.html#{r}')
            time.sleep(4.5)
            p.screenshot(path=str(OUT / f'shot_{r}_{dev}.png'), full_page=full)
        for e in errs: print(dev, e)
        ctx.close()
    b.close()
srv.shutdown()
print('done')
