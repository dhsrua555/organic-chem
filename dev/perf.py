"""큰 분자 렉 측정: 분자 조립에서 조각을 계속 붙여 가며 (1) 클릭마다 처리 시간 (2) 가만히 둘 때 프레임 시간
(3) CPU 프로파일에서 오래 걸린 함수 순위를 본다. 사용: python dev/perf.py [붙일 횟수=14]"""
import sys, time, json, collections
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).parent))
from run import serve, PORT
N = int(sys.argv[1]) if len(sys.argv) > 1 else 14
FR = ['phenyl', 'COOH', 'cyclohexyl', 'OH', 'C2H5', 'NH2', 'COOCH3', 'Cl', 'CH3', 'CONH2', 'OCH3', 'CN', 'Br', 'CHO']
srv = serve()
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    p = b.new_page(viewport={'width': 1440, 'height': 900})
    errs = []
    p.on('pageerror', lambda e: errs.append(str(e)))
    p.goto(f'http://127.0.0.1:{PORT}/index.html#build'); time.sleep(3)
    p.evaluate('localStorage.clear()'); p.reload(); time.sleep(3)
    p.evaluate("""() => { window.__lt = []; new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(e.duration))).observe({ entryTypes: ['longtask'] }); }""")
    p.click('.famous summary'); p.click('.fam-list [data-t="capsaicin"]'); time.sleep(1.5)
    cdp = p.context.new_cdp_session(p)
    cdp.send('Profiler.enable'); cdp.send('Profiler.setSamplingInterval', {'interval': 200}); cdp.send('Profiler.start')
    rows = []
    for k in range(N):
        f = FR[k % len(FR)]
        p.evaluate("g => { const c = document.querySelector('.chip[data-g=\"' + g + '\"]'); const t = document.querySelector('#tb-pal-' + c.closest('.tab-panel').dataset.panel); if (t) t.click(); c.click(); }", f)
        cand = p.evaluate("[...document.querySelectorAll('.svgwrap [data-atom]')].filter(e => !/H 없음/.test(e.getAttribute('aria-label'))).map(e => +e.dataset.atom)")
        atoms = p.evaluate("document.querySelectorAll('.svgwrap [data-atom]').length")
        target = cand[(k * 7) % len(cand)] if cand else 0
        p.evaluate("() => { window.__lt = []; }")
        t0 = time.time()
        dur = p.evaluate("""a => new Promise(res => { const t = performance.now(); document.querySelector('.svgwrap [data-atom="' + a + '"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
          const js = performance.now() - t; requestAnimationFrame(() => requestAnimationFrame(() => res([js, performance.now() - t]))); })""", target)
        time.sleep(0.9)
        lt = p.evaluate('window.__lt')
        rows.append((atoms, f, round(dur[0]), round(dur[1]), [round(x) for x in lt]))
    prof = cdp.send('Profiler.stop')['profile']
    # 가만히 둘 때 프레임 시간
    frames = p.evaluate("""() => new Promise(res => { const d = []; let last = performance.now(); const f = now => { d.push(now - last); last = now; if (d.length < 120) requestAnimationFrame(f); else res(d); }; requestAnimationFrame(f); })""")
    name = p.inner_text('.name-main')
    b.close()
srv.shutdown()
print('click → (JS ms, 2 frames ms, long tasks during next 0.9 s)')
for r in rows: print(f'  atoms {r[0]:3d} +{r[1]:10s} js {r[2]:5d}  paint {r[3]:5d}  long {r[4]}')
fs = sorted(frames)
print(f'idle frames: median {fs[len(fs)//2]:.1f} ms, p95 {fs[int(len(fs)*0.95)]:.1f} ms')
print('last name:', name[:120])
# 함수별 자기 시간
nodes = {n['id']: n for n in prof['nodes']}
dt = collections.Counter()
samples, deltas = prof['samples'], prof['timeDeltas']
for sid, d in zip(samples, deltas):
    cf = nodes[sid]['callFrame']
    dt[(cf['functionName'] or '(anon)', cf['url'].split('/')[-1], cf['lineNumber'] + 1)] += d / 1000
tot = sum(dt.values())
print(f'CPU profile total {tot:.0f} ms — top self time:')
for (fn, url, ln), ms in dt.most_common(28): print(f'  {ms:7.1f} ms  {fn} ({url}:{ln})')
print('errors:', errs)
