"""링크 미리보기 이미지(og-image.jpg, 1200x630) 와 휴대폰 분자 조립 화면 확인용 캡처"""
import sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).parent))
from run import serve, PORT
ROOT = Path(__file__).resolve().parent.parent
srv = serve()
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    p = b.new_page(viewport={'width': 1200, 'height': 630})
    p.goto(f'http://127.0.0.1:{PORT}/index.html#home'); time.sleep(5)
    p.screenshot(path=str(ROOT / 'og-image.jpg'), type='jpeg', quality=86)
    m = b.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    m.goto(f'http://127.0.0.1:{PORT}/index.html#build'); time.sleep(3)
    m.evaluate('document.querySelector(".stage").scrollIntoView()'); time.sleep(0.5)
    m.screenshot(path=str(ROOT / 'dev/out/m_build_stage.png'))
    b.close()
srv.shutdown()
