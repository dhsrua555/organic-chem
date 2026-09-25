import sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).parent))
from run import serve, PORT
OUT = Path(__file__).parent / 'out'
srv = serve()
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    p = b.new_page(viewport={'width': 1440, 'height': 900})
    p.goto(f'http://127.0.0.1:{PORT}/index.html#home'); time.sleep(3)
    p.click('.hexbtn.next')
    for k in range(6):
        time.sleep(0.25); p.screenshot(path=str(OUT / f'trans_{k}.png'))
    b.close()
srv.shutdown()
