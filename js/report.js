/* 버그 제보함: 무엇이 이상한지 적으면 지금 화면 · 분자 정보를 붙여
   GitHub 이슈로 보내거나, 복사해서 메시지로 보낸다. claude.ai 안에서 열었으면 페이지 댓글로도 남길 수 있다.
   쓰던 글은 이 브라우저에 남겨 두어 창을 닫아도 사라지지 않는다 */
import { $, store, copyText, recentErrors, getLang } from './ui.js';

const REPO = 'https://github.com/dhsrua555/organic-chem';
const KINDS = [['name', '이름이 틀려요'], ['react', '반응 결과가 이상해요'], ['draw', '그림 · 3D 가 이상해요'], ['ui', '버튼 · 화면 오류'], ['slow', '느려요 · 렉'], ['idea', '제안 · 기타']];

export function initReport({ version, context }) {
  const btn = $('#bug-btn');
  if (!btn) return;
  let dlg = null, comments = null;
  /* claude.ai 에서 열었을 때만: 페이지 댓글 입력창을 열 수 있다 */
  if (window.claude && typeof window.claude.use === 'function') {
    window.claude.use('comments').then(c => { comments = c; paintSend(); }).catch(() => { comments = null; });
  }

  function build() {
    dlg = document.createElement('dialog');
    dlg.className = 'bug-dlg';
    dlg.setAttribute('aria-labelledby', 'bug-t');
    dlg.innerHTML = `<form method="dialog" class="bug-form">
      <div class="bug-head"><div><p class="lbl">BUG REPORT</p><h2 id="bug-t">버그 제보함</h2></div><button class="bug-x" value="close" aria-label="닫기">×</button></div>
      <p class="bug-lead">틀린 이름, 이상한 반응 결과, 깨진 화면을 알려 주세요. 지금 보고 있는 분자와 화면 정보가 함께 붙어서 그대로 다시 만들어 볼 수 있습니다.</p>
      <fieldset class="bug-kinds"><legend class="lbl">어떤 문제인가요</legend>${KINDS.map(([k, t]) => `<label><input type="radio" name="bug-kind" value="${k}"><span>${t}</span></label>`).join('')}</fieldset>
      <label class="lbl" for="bug-body">무엇이 이상한가요</label>
      <textarea id="bug-body" rows="5" maxlength="2000" placeholder="예: 사이클로헥산올에 CH₃ 를 붙였더니 이름이 ○○ 로 나오는데 △△ 가 맞는 것 같아요"></textarea>
      <label class="lbl" for="bug-who">답을 받을 이름 · 연락처 <small>(선택)</small></label>
      <input id="bug-who" type="text" maxlength="80" autocomplete="off">
      <details class="bug-ctx"><summary>함께 보낼 화면 정보 보기</summary><pre></pre></details>
      <label class="bug-inc"><input type="checkbox" id="bug-inc" checked> 화면 정보 함께 보내기</label>
      <div class="bug-send">
        <button type="button" class="btn solid" data-send="gh">GitHub 이슈로 보내기</button>
        <button type="button" class="btn" data-send="copy">내용 복사</button>
        <button type="button" class="btn" data-send="cm" hidden>이 페이지에 댓글로</button>
        <button type="button" class="btn link" data-send="clear">새로 쓰기</button>
      </div>
      <p class="bug-msg" aria-live="polite"></p>
      <p class="hint">GitHub 계정이 없으면 ‘내용 복사’ 뒤 만든 사람에게 메시지로 붙여 보내 주세요.</p>
    </form>`;
    document.body.appendChild(dlg);
    const d = store.get('bugDraft', {});
    dlg.querySelector('#bug-body').value = d.body || '';
    dlg.querySelector('#bug-who').value = d.who || '';
    const k = dlg.querySelector(`[name="bug-kind"][value="${d.kind || 'name'}"]`); if (k) k.checked = true;
    dlg.addEventListener('input', () => { saveDraft(); msg(''); });
    dlg.addEventListener('change', () => { saveDraft(); paintCtx(); });
    dlg.querySelector('.bug-send').addEventListener('click', e => { const b = e.target.closest('[data-send]'); if (b) send(b.dataset.send); });
    /* 바깥(어두운 배경)을 누르면 닫기 */
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', () => btn.focus());
  }
  const val = s => dlg.querySelector(s).value.trim();
  const kind = () => (dlg.querySelector('[name="bug-kind"]:checked') || {}).value || 'name';
  const msg = (t, tone) => { const p = dlg.querySelector('.bug-msg'); p.textContent = t; p.className = 'bug-msg' + (tone ? ' ' + tone : ''); };
  function saveDraft() { store.set('bugDraft', { kind: kind(), body: dlg.querySelector('#bug-body').value, who: dlg.querySelector('#bug-who').value }); }

  /* 화면 정보: 페이지가 알려 주는 분자 · 반응 + 앱 · 브라우저 */
  function ctxLines() {
    let c = {};
    try { c = context() || {}; } catch (e) { c = { '화면 정보 오류': e.message }; }
    const lines = Object.entries(c).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}: ${v}`);
    lines.push(`앱: ${version} · 이름 표기 ${getLang() === 'ko' ? '한글 먼저' : 'EN 먼저'}`);
    lines.push(`브라우저: ${navigator.userAgent}`);
    lines.push(`화면: ${innerWidth}×${innerHeight} @${(window.devicePixelRatio || 1).toFixed(2)}x`);
    lines.push(`주소: ${location.href.split('?')[0]}`);
    lines.push(`시각: ${new Date().toISOString()}`);
    if (recentErrors.length) lines.push('최근 오류:', ...recentErrors.map(e => '  ' + e));
    return lines;
  }
  function paintCtx() { dlg.querySelector('.bug-ctx pre').textContent = ctxLines().join('\n'); }
  function text() {
    const who = val('#bug-who');
    const out = [`[종류] ${KINDS.find(k => k[0] === kind())[1]}`, '', val('#bug-body')];
    if (who) out.push('', `[연락처] ${who}`);
    if (dlg.querySelector('#bug-inc').checked) out.push('', '--- 화면 정보 ---', ...ctxLines());
    return out.join('\n');
  }
  function paintSend() {
    if (!dlg) return;
    dlg.querySelector('[data-send="cm"]').hidden = !comments;
  }
  async function send(how) {
    if (how === 'clear') {
      dlg.querySelector('#bug-body').value = ''; dlg.querySelector('#bug-who').value = '';
      saveDraft(); msg('새로 쓸 수 있습니다.'); dlg.querySelector('#bug-body').focus(); return;
    }
    if (!val('#bug-body')) { msg('무엇이 이상한지 한 줄이라도 적어 주세요.', 'warn'); dlg.querySelector('#bug-body').focus(); return; }
    const body = text();
    if (how === 'gh') {
      const first = val('#bug-body').split('\n')[0].slice(0, 60);
      const title = `[${KINDS.find(k => k[0] === kind())[1]}] ${first}`;
      const url = `${REPO}/issues/new?labels=bug&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body.slice(0, 6000))}`;
      const w = window.open(url, '_blank', 'noopener');
      msg(w === null ? '새 창이 막혔습니다. ‘내용 복사’ 로 보내 주세요.' : 'GitHub 새 창에서 ‘Submit new issue’ 를 누르면 접수됩니다. 고마워요!', w === null ? 'warn' : 'ok');
      return;
    }
    if (how === 'copy') {
      const ok = await copyText(body);
      msg(ok ? '복사했습니다. 메시지 창에 붙여 넣어 보내 주세요. 고마워요!' : '복사가 막혔습니다. 아래 글을 직접 선택해 복사해 주세요.', ok ? 'ok' : 'warn');
      if (!ok) { const det = dlg.querySelector('.bug-ctx'); det.open = true; det.querySelector('pre').textContent = body; }
      return;
    }
    if (how === 'cm' && comments) {
      const ok = await copyText(body);
      dlg.close();
      try {
        const r = await comments.openComposer({ element: btn });
        if (!r || !r.opened) throw { code: 'soft' };
        /* 입력창이 열렸다: 복사해 둔 글을 붙여 넣으면 된다 */
        if (!ok) { dlg.showModal(); msg('댓글 창이 열렸습니다. 복사가 막혀 있어 글을 직접 옮겨 적어 주세요.', 'warn'); }
      } catch (e) {
        if (e && e.code === 'unavailable') { comments = null; paintSend(); }
        dlg.showModal();
        msg(e && e.code === 'unavailable' ? '여기서는 댓글을 남길 수 없습니다. GitHub 이나 복사로 보내 주세요.' : '댓글 창을 열지 못했습니다. 페이지를 한 번 누른 뒤 다시 시도하거나 복사로 보내 주세요.', 'warn');
      }
    }
  }
  function open() {
    if (!dlg) build();
    paintCtx(); paintSend(); msg('');
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    dlg.querySelector('#bug-body').focus();
  }
  btn.addEventListener('click', open);
  return { open };
}
