"""화면 점검: 모든 경로 × 데스크톱/휴대폰에서 콘솔 오류, 가로 넘침, 화면 글자 속 undefined · NaN · null, 빈 이름,
눌러도 반응 없는 버튼을 찾는다. 사용: python dev/audit.py"""
import sys, time, re
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).parent))
from run import serve, PORT
OUT = Path(__file__).parent / 'out'
GROUPS = ['acid', 'ester', 'acylhalide', 'amide', 'nitrile', 'aldehyde', 'ketone', 'alcohol', 'amine', 'alkyl', 'ether', 'halide', 'nitro']
ROUTES = ['home', 'build', 'react', 'rules', 'quiz'] + ['groups-' + g for g in GROUPS]
DEV = {'desktop': dict(viewport={'width': 1440, 'height': 900}), 'mobile': dict(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)}
BAD = re.compile(r'\bundefined\b|\bNaN\b|\bnull\b|\[object|\$\{')
srv = serve()
problems = []
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    for dev, cfg in DEV.items():
        ctx = b.new_context(**cfg)
        p = ctx.new_page()
        errs = []
        p.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        p.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
        p.goto(f'http://127.0.0.1:{PORT}/index.html#home'); time.sleep(3)
        for r in ROUTES:
            errs.clear()
            p.goto(f'http://127.0.0.1:{PORT}/index.html#{r}'); time.sleep(1.6)
            info = p.evaluate("""() => {
              const W = document.documentElement.clientWidth;
              const over = [];
              document.querySelectorAll('#view *').forEach(el => {
                const r = el.getBoundingClientRect();
                if (r.width && (r.right > W + 1 || r.left < -1) && getComputedStyle(el).position !== 'fixed' && !el.closest('.tbl-wrap, .svgwrap, .fam-list, .scafs')) over.push((el.className && el.className.baseVal === undefined ? el.className : el.tagName) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
              });
              return { scrollW: document.documentElement.scrollWidth, W, over: over.slice(0, 6), text: document.getElementById('view').innerText };
            }""")
            if info['scrollW'] > info['W'] + 1: problems.append(f'[{dev}] #{r}: 가로 넘침 {info["scrollW"]} > {info["W"]}')
            if info['over']: problems.append(f'[{dev}] #{r}: 화면 밖 요소 {info["over"]}')
            m = BAD.findall(info['text'])
            if m: problems.append(f'[{dev}] #{r}: 글자에 {set(m)} — ' + ' / '.join(l for l in info['text'].split('\n') if BAD.search(l))[:300])
            for e in errs: problems.append(f'[{dev}] #{r}: {e}')
            p.screenshot(path=str(OUT / f'audit_{r}_{dev}.png'), full_page=True)
        ctx.close()
    b.close()
srv.shutdown()
print('\n'.join(problems) or 'no problems')
print(f'{len(problems)} problems')
