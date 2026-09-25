"""dev 페이지를 헤드리스 Chromium 으로 열고 <pre id="out"> 내용을 출력한다.
사용: python dev/run.py test.html   (Playwright: guitar-harmony/reference/.venv)"""
import sys, threading, functools, http.server, time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = 8093

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()

def serve():
    http.server.ThreadingHTTPServer.request_queue_size = 128
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

if __name__ == '__main__':
    page = sys.argv[1] if len(sys.argv) > 1 else 'test.html'
    out_file = sys.argv[2] if len(sys.argv) > 2 else None
    srv = serve()
    with sync_playwright() as pw:
        b = pw.chromium.launch(headless=True)
        p = b.new_page()
        errs = []
        p.on('pageerror', lambda e: errs.append(str(e)))
        p.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        p.goto(f'http://127.0.0.1:{PORT}/dev/{page}' + ('&' if '?' in page else '?') + f'v={time.time()}')
        p.wait_for_function('window.__done === true', timeout=300000)
        txt = p.inner_text('#out')
        b.close()
    srv.shutdown()
    if out_file: Path(out_file).write_text(txt, encoding='utf-8'); print('saved', out_file, len(txt))
    else: print(txt)
    for e in errs: print('ERR', e)
