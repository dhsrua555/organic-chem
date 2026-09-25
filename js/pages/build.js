/* 분자 조립: 뼈대 · 유명한 분자에서 시작해 원자를 눌러 조각을 붙이고, 결합을 바꾸고, 가지를 지운다.
   이름 · 풀이 · 바뀐 점 · 비교 목록을 곧바로 보여 준다 */
import { FRAGMENTS, FRAG_GROUPS, TEMPLATES, fromSmiles, attach, cycleBond, removeBranch, flipEZ, tidy } from '../chem/edit.js';
import { makeMol, toSmiles, unsaturation } from '../chem/core.js';
import { CLASS } from '../chem/name.js';
import { steps, diff, noteText } from '../chem/explain.js';
import { drawMolecule, templateIcon } from '../draw.js';
import { entry, molecule, tokensHTML, formulaHTML, esc, store, getLang, onLang, pick, copyText } from '../ui.js';

const LBL = s => s.replace(/(\d)/g, '<sub>$1</sub>');
const TOOLS = [
  ['add', '붙이기', '원자를 누르면 고른 조각이 붙습니다 (H 하나를 바꿈)'],
  ['bond', '결합', '탄소–탄소 결합을 누를 때마다 단일 → 이중 → 삼중'],
  ['erase', '지우기', '원자를 누르면 그 원자와 바깥 가지를 지웁니다'],
  ['flip', 'E/Z', '이중결합을 누르면 E ↔ Z 로 뒤집습니다']
];
const BASES = TEMPLATES.filter(t => t.kind === 'base');
const FAMOUS = TEMPLATES.filter(t => t.kind === 'famous');

/* 저장용: 원자 · 결합만 */
const pack = m => ({ a: m.atoms.map(x => [x.el, x.h, x.q || 0, +x.x.toFixed(3), +x.y.toFixed(3)]), b: m.bonds.map(x => [x.a, x.b, x.o, x.arom ? 1 : 0]) });
const unpack = p => makeMol(p.a.map(([el, h, q, x, y]) => ({ el, h, q, x, y })), p.b.map(([a, b, o, ar]) => ({ a, b, o, arom: !!ar })));

export function mount(root, app, params) {
  const saved = store.get('build2', null);
  let start;
  try { start = params && params.smiles ? fromSmiles(params.smiles) : params && params.mol ? params.mol : saved ? unpack(saved.mol) : fromSmiles('C=CC'); }
  catch { start = fromSmiles('C=CC'); }
  const S = {
    mol: start, tool: 'add', sel: (saved && saved.sel) || 'OH', mode: store.get('drawMode', 'atoms'),
    hist: [], redo: [], prev: null, pick: null, msg: '', lastFrag: (params && params.focusGroup) || null
  };
  if (!FRAGMENTS[S.sel]) S.sel = 'OH';

  root.innerHTML = `<section class="page build">
    <div class="pg-head">
      <div><p class="eyebrow"><span class="bar"></span>01 — BUILD</p><h1 class="title">BUILD<small>분자 조립</small></h1></div>
      <p class="lead" style="margin:0;max-width:56ch">원자를 누르면 고른 조각이 붙습니다. 탄소를 계속 이어 붙이면 사슬이 길어지고, 고리 · 이중결합도 만들 수 있습니다. 파란 띠가 주사슬(주고리), 작은 숫자가 위치 번호입니다.</p>
    </div>
    <div class="bl-grid">
      <div class="bl-tools">
        <div class="blk blk-scaf panel ticks">
          <h2 class="lbl" id="lb-scaf">시작 분자</h2>
          <div class="scafs" role="group" aria-labelledby="lb-scaf">${BASES.map(t => `<button class="scaf" type="button" data-t="${t.id}"><span class="hx">${templateIcon(t.id)}</span>${t.ko}</button>`).join('')}</div>
          <details class="famous"><summary>유명한 분자 ${FAMOUS.length}개</summary><div class="fam-list">${FAMOUS.map(t => `<button type="button" data-t="${t.id}"><b>${t.ko}</b><small>${t.note}</small></button>`).join('')}</div></details>
        </div>
        <div class="blk blk-pal panel">
          <div class="toolbar" role="radiogroup" aria-label="도구">${TOOLS.map(([id, ko, tip]) => `<button class="tool" type="button" role="radio" data-tool="${id}" title="${tip}">${ko}</button>`).join('')}</div>
          <div class="palette-wrap">${FRAG_GROUPS.map(([g, ko]) => `<h2 class="lbl">${ko}</h2><div class="palette" role="radiogroup" aria-label="${ko}">${Object.entries(FRAGMENTS).filter(([, f]) => f.group === g).map(([id, f]) => `<button class="chip" type="button" role="radio" data-g="${id}" aria-checked="false" title="${f.ko}"><span>${LBL(f.label)}</span></button>`).join('')}</div>`).join('')}</div>
          <p class="pal-info" aria-live="polite"></p>
        </div>
        <div class="blk blk-tools panel"><h2 class="lbl">편집</h2><div class="tools-row">
          <button class="btn" type="button" id="b-undo">되돌리기</button><button class="btn" type="button" id="b-redo">다시</button>
          <button class="btn" type="button" id="b-tidy">정리</button><button class="btn" type="button" id="b-rand">무작위</button>
          <button class="btn" type="button" id="b-3d">3D 보기</button><button class="btn solid" type="button" id="b-react">반응 예측 →</button></div></div>
      </div>
      <div class="stage panel ticks">
        <div class="stage-top"><p class="lbl">구조식</p>
          <div class="seg small" role="group" aria-label="그림 방식"><button type="button" data-mode="atoms">원자 표시</button><button type="button" data-mode="skeletal">골격</button></div>
          <span class="stage-count"></span></div>
        <div class="svgwrap"></div>
        <div class="stage-foot"></div>
      </div>
      <div class="result"></div>
    </div>
    <div class="focus-bar" hidden><p></p>
      <div class="fb-tools"><button class="btn" type="button" id="z-out" aria-label="축소">−</button><button class="btn" type="button" id="z-in" aria-label="확대">+</button>
      <button class="btn" type="button" id="z-reset">처음 모양</button><button class="btn" type="button" id="z-h" aria-pressed="true">H 보이기</button>
      <button class="btn solid" type="button" id="b-back">구조식으로</button></div>
      <small>끌어서 돌리기 · 휠/두 손가락으로 확대 · 두 번 눌러 처음 모양 · 길게 누르면 분해도</small></div>
  </section>`;
  const q = s => root.querySelector(s);

  function paintTools() {
    root.querySelectorAll('.tool').forEach(b => b.setAttribute('aria-checked', String(b.dataset.tool === S.tool)));
    root.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-checked', String(b.dataset.g === S.sel)));
    root.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === S.mode)));
    root.querySelector('.palette-wrap').hidden = S.tool !== 'add';
    const f = FRAGMENTS[S.sel];
    const tip = TOOLS.find(t => t[0] === S.tool)[2];
    q('.pal-info').innerHTML = S.msg ? `<b class="warnc">${esc(S.msg)}</b>` : S.tool === 'add' ? `<b>${LBL(f.label)}</b> — ${esc(f.ko)}. ${tip}.` : esc(tip) + '.';
    q('#b-undo').disabled = !S.hist.length; q('#b-redo').disabled = !S.redo.length;
  }
  function save() { store.set('build2', { mol: pack(S.mol), sel: S.sel }); }
  function commit(m, frag) {
    S.hist.push(S.mol); if (S.hist.length > 80) S.hist.shift();
    S.redo = [];
    S.prev = cur;
    S.mol = m; S.msg = '';
    if (frag) S.lastFrag = frag;
    save(); render(true);
  }
  let cur = null;
  function render(changed) {
    cur = entry(S.mol);
    paintTools();
    const m = cur.mol, r = cur.res;
    const nC = m.atoms.filter(a => a.el === 'C').length;
    q('.stage-count').textContent = `원자 ${m.atoms.length} · 탄소 ${nC}`;
    q('.svgwrap').innerHTML = drawMolecule(m, r, { interactive: true, tool: S.tool, mode: S.mode, pick: S.pick });
    const cls = r ? (r.P ? CLASS[r.P].ko : r.enes.length || r.ynes.length ? (r.ynes.length ? '알카인' : '알켄') : r.kind === 'benzene' || r.kind === 'biphenyl' ? '방향족 탄화수소' : m.atoms.some(a => a.el !== 'C') ? '치환 탄화수소' : r.kind === 'ring' ? '사이클로알케인' : '알케인') : '—';
    q('.stage-foot').innerHTML = `<span><em>분자식</em>${formulaHTML(cur.f)}</span><span><em>몰질량</em>${cur.f.mass.toFixed(2)} g/mol</span><span><em>분류</em>${cls}</span><span><em>불포화도</em>${unsaturation(m)}</span><span class="smi"><em>SMILES</em>${esc(toSmiles(m))}</span>`;
    renderResult();
    if (changed !== false && r) app.setMol(cur, { instant: changed === 'first' });
    if (document.body.classList.contains('focus3d') && r) q('.focus-bar p').textContent = getLang() === 'ko' ? r.nameKo : r.nameEn;
  }

  function renderResult() {
    rowsCache = [];
    const r = cur.res, ko = getLang() === 'ko';
    if (!r) {
      q('.result').innerHTML = `<div class="nm panel ticks"><p class="lbl">IUPAC 이름</p><p class="name-main muted">이름을 짓지 못했습니다</p><p class="note warn">${esc(cur.err || '')}</p><p class="hint">되돌리기로 한 단계 전으로 돌아가 보세요.</p></div>`;
      return;
    }
    const main = ko ? r.ko : r.en, subName = ko ? r.nameEn : r.nameKo;
    const cm = cur.common;
    const st = steps(cur.mol, r);
    const notes = (r.notes || []).map(noteText).filter(Boolean);
    const d = S.prev && S.prev.res ? diff(S.prev.mol, S.prev.res, cur.mol, r) : [];
    const frag = S.lastFrag || S.sel;
    const cmpB = S.tool === 'add' && cur.mol.atoms.length <= 40 ? compareSites(frag === S.sel ? S.sel : S.sel) : [];
    const cmpA = compareBases(frag);
    q('.result').innerHTML = `
      <div class="nm panel ticks">
        <button class="copy" type="button" id="b-copy">복사</button>
        <p class="lbl">IUPAC 이름</p>
        <p class="name-main" aria-live="polite">${tokensHTML(main)}</p>
        <p class="name-sub">${esc(subName)}</p>
        ${cm ? `<p class="name-common">관용명 <b>${esc(ko ? cm.ko : cm.en)}</b> · ${esc(ko ? cm.en : cm.ko)}${cm.note ? ` — ${esc(cm.note)}` : ''}</p>` : ''}
        <p class="legend" aria-hidden="true"><span class="l-loc">위치 번호</span><span class="l-pre">접두사</span><span class="l-par">모체(어근)</span><span class="l-une">불포화</span><span class="l-suf">접미사</span>${r.stereo ? '<span class="l-ste">입체</span>' : ''}</p>
      </div>
      ${d.length ? `<div class="changes"><p class="lbl">방금 바뀐 것</p><p class="from">${esc(S.prev.res.nameEn)} → ${esc(r.nameEn)}</p><ul>${d.map(x => `<li>${x}</li>`).join('')}</ul></div>` : ''}
      ${notes.length ? `<div class="notes">${notes.map(n => `<p class="note ${n.tone}">${n.t}</p>`).join('')}</div>` : ''}
      <div class="panel"><p class="lbl" style="padding:16px 18px 0;margin:0">이름 짓는 과정</p><ol class="steps">${st.map(s => `<li><div><span class="sk">${s.k}</span>${s.t}</div></li>`).join('')}</ol></div>
      ${cmpB.length ? `<div class="cmp panel"><p class="lbl">원자마다 ${LBL(FRAGMENTS[S.sel].label)} 붙여 보기</p><ul class="cmp-list">${cmpB.map(rowHTML).join('')}</ul></div>` : ''}
      ${cmpA.length ? `<div class="cmp panel"><p class="lbl">${LBL(FRAGMENTS[frag].label)} 하나를 여러 뼈대에 붙이면</p><ul class="cmp-list">${cmpA.map(rowHTML).join('')}</ul></div>` : ''}`;
    q('#b-copy').addEventListener('click', async e => {
      const ok = await copyText(r.nameEn, q('.name-main'));
      e.target.textContent = ok ? '복사됨' : '선택됨';
      setTimeout(() => { e.target.textContent = '복사'; }, 1400);
    });
    root.querySelectorAll('.cmp-list button').forEach((bt, i) => bt.addEventListener('click', () => {
      const x = rowsCache[i];
      commit(x.mol, x.frag);
      if (innerWidth < 900) q('.stage').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }
  let rowsCache = [];
  const baseCache = new Map();
  function rowHTML(x) {
    const ko = getLang() === 'ko';
    rowsCache.push(x);
    return `<li><button type="button" aria-current="${x.name === cur.res.nameEn}">
      <span class="cw">${esc(x.where)}</span><span class="cn">${esc(ko ? x.e.res.nameKo : x.e.res.nameEn)}<span class="ck">${esc(ko ? x.e.res.nameEn : x.e.res.nameKo)}${x.e.common ? ' · ' + esc(x.e.common.ko) : ''}</span></span></button></li>`;
  }
  /* 지금 분자의 원자마다 조각을 붙인 결과 (이름이 같으면 한 번만) */
  function compareSites(fr) {
    const out = [], seen = new Set();
    S.mol.atoms.forEach((a, i) => {
      if (!a.h || out.length >= 14) return;
      const r = attach(S.mol, i, fr);
      if (!r.mol) return;
      const e = entry(r.mol);
      if (!e.res || seen.has(e.res.nameEn)) return;
      seen.add(e.res.nameEn);
      out.push({ mol: r.mol, e, name: e.res.nameEn, where: `${a.el}${i + 1}`, frag: fr });
    });
    return out;
  }
  /* 같은 조각 하나를 기본 뼈대들에 붙이면 (조각마다 한 번만 계산) */
  function compareBases(fr) {
    if (baseCache.has(fr)) return baseCache.get(fr);
    const out = [], seen = new Set();
    for (const t of BASES) {
      const base = molecule(t.smi).mol;
      base.atoms.forEach((a, i) => {
        if (!a.h) return;
        const r = attach(base, i, fr);
        if (!r.mol) return;
        const e = entry(r.mol);
        if (!e.res || seen.has(e.res.nameEn)) return;
        seen.add(e.res.nameEn);
        out.push({ mol: r.mol, e, name: e.res.nameEn, where: t.ko, frag: fr });
      });
    }
    baseCache.set(fr, out.slice(0, 16));
    return baseCache.get(fr);
  }

  /* ── 이벤트 ── */
  function act(el) {
    S.msg = '';
    if (el.dataset.atom !== undefined) {
      const i = +el.dataset.atom;
      let r;
      if (S.tool === 'add') r = attach(S.mol, i, S.sel);
      else if (S.tool === 'erase') r = removeBranch(S.mol, i, 0);
      else { S.msg = S.tool === 'bond' ? '결합(원자 사이의 선)을 눌러 주세요' : '이중결합을 눌러 주세요'; paintTools(); return; }
      if (r.error) { S.msg = r.error; paintTools(); return; }
      S.pick = S.tool === 'add' ? i : null;
      commit(r.mol, S.tool === 'add' ? S.sel : null);
      const again = q(`.svgwrap [data-atom="${i}"]`); if (again) again.focus({ preventScroll: true });
    } else if (el.dataset.bond !== undefined) {
      const k = +el.dataset.bond;
      if (S.tool === 'bond') { const r = cycleBond(S.mol, k); if (r.error) { S.msg = r.error; paintTools(); return; } commit(r.mol); }
      else if (S.tool === 'flip') { const r = flipEZ(S.mol, k); if (r.error) { S.msg = r.error; paintTools(); return; } commit(r.mol); }
      else if (S.tool === 'add' || S.tool === 'erase') {
        /* 결합을 누르면 가까운 끝 원자에 적용 */
        const bd = S.mol.bonds[k];
        act({ dataset: { atom: String(S.mol.atoms[bd.b].h ? bd.b : bd.a) } });
      }
    }
  }
  q('.svgwrap').addEventListener('click', e => { const el = e.target.closest('[data-atom], [data-bond]'); if (el) act(el); });
  q('.svgwrap').addEventListener('keydown', e => {
    const el = e.target.closest('[data-atom]'); if (!el) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(el); }
  });
  const loadT = id => { const t = TEMPLATES.find(x => x.id === id); S.pick = null; commit(fromSmiles(t.smi)); };
  root.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => loadT(b.dataset.t)));
  root.querySelector('.toolbar').addEventListener('click', e => { const b = e.target.closest('[data-tool]'); if (!b) return; S.tool = b.dataset.tool; S.msg = ''; paintTools(); renderSvgOnly(); });
  root.querySelector('.palette-wrap').addEventListener('click', e => {
    const b = e.target.closest('[data-g]'); if (!b) return;
    S.sel = b.dataset.g; S.tool = 'add'; S.msg = ''; save(); paintTools(); renderResult();
  });
  root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { S.mode = b.dataset.mode; store.set('drawMode', S.mode); paintTools(); renderSvgOnly(); }));
  function renderSvgOnly() { q('.svgwrap').innerHTML = drawMolecule(cur.mol, cur.res, { interactive: true, tool: S.tool, mode: S.mode, pick: S.pick }); }
  q('#b-undo').addEventListener('click', () => { const h = S.hist.pop(); if (!h) return; S.redo.push(S.mol); S.prev = cur; S.mol = h; S.pick = null; save(); render(true); });
  q('#b-redo').addEventListener('click', () => { const h = S.redo.pop(); if (!h) return; S.hist.push(S.mol); S.prev = cur; S.mol = h; S.pick = null; save(); render(true); });
  q('#b-tidy').addEventListener('click', () => commit(tidy(S.mol)));
  q('#b-rand').addEventListener('click', () => {
    const pool = ['CH3', 'CH3', 'OH', 'OH', 'COOH', 'CHO', 'NH2', 'Cl', 'Br', 'NO2', 'OCH3', 'COCH3', 'CN', 'COOCH3', 'oxo', 'C2H5', 'phenyl', 'vinyl'];
    for (let t = 0; t < 30; t++) {
      let m = fromSmiles(pick(BASES).smi);
      const k = 2 + Math.floor(Math.random() * 4);
      for (let j = 0; j < k; j++) { const at = m.atoms.map((a, i) => i).filter(i => m.atoms[i].h > 0); const r = attach(m, pick(at), pick(pool)); if (r.mol) m = r.mol; }
      const e = entry(m);
      if (!e.res || (e.res.notes || []).some(n => ['enol', 'enamine', 'gemdiol', 'halohydrin', 'hemiaminal', 'hemiacetal'].includes(n.type))) continue;
      S.pick = null; commit(m); return;
    }
  });
  q('#b-react').addEventListener('click', () => app.go('react', { mol: S.mol }));
  const focus = on => {
    app.focus3d(on);
    q('.focus-bar').hidden = !on;
    if (app.scene) app.scene.setFocus(on);
    app.anchor(on ? { x: 0, y: innerWidth < 900 ? 0.18 : 0.08, scale: innerWidth < 600 ? 0.78 : innerWidth < 900 ? 1 : 1.3, dim: 1 } : null);
    if (on) { q('.focus-bar p').textContent = cur.res ? (getLang() === 'ko' ? cur.res.nameKo : cur.res.nameEn) : ''; q('#b-back').focus(); }
    else q('#b-3d').focus();
  };
  q('#b-3d').addEventListener('click', () => focus(true));
  q('#b-back').addEventListener('click', () => focus(false));
  q('#z-in').addEventListener('click', () => app.scene && app.scene.zoomIn());
  q('#z-out').addEventListener('click', () => app.scene && app.scene.zoomOut());
  q('#z-reset').addEventListener('click', () => app.scene && app.scene.reset());
  q('#z-h').addEventListener('click', e => { const on = e.currentTarget.getAttribute('aria-pressed') !== 'true'; e.currentTarget.setAttribute('aria-pressed', String(on)); if (app.scene) app.scene.setShowH(on); });
  const onKey = e => {
    if (e.key === 'Escape' && document.body.classList.contains('focus3d')) focus(false);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.target.closest('input, textarea')) { e.preventDefault(); q(e.shiftKey ? '#b-redo' : '#b-undo').click(); }
  };
  document.addEventListener('keydown', onKey);
  const offLang = onLang(() => render(false));

  render('first');
  return { unmount() { offLang(); document.removeEventListener('keydown', onKey); app.focus3d(false); if (app.scene) { app.scene.setFocus(false); app.scene.setShowH(true); } } };
}
