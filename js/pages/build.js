/* 분자 조립: 뼈대 · 유명한 분자에서 시작해 원자를 눌러 조각을 붙이고, 결합을 바꾸고, 가지를 지운다.
   이름은 늘 보이고, 바뀐 점 · 풀이 · 입체 · 참고 · 비교는 탭으로 골라 본다 (고른 탭은 기억).
   입체중심은 늘 배열(R/S)을 정해 두고 R/S 도구로 뒤집는다.
   비교 목록은 무거워서 ‘비교’ 탭을 열었을 때만, 잠깐 뒤에 채운다 (연달아 눌러도 끊기지 않게) */
import { FRAGMENTS, FRAG_GROUPS, TEMPLATES, fromSmiles, attach, cycleBond, removeBranch, flipEZ, tidy } from '../chem/edit.js';
import { makeMol, toSmiles, unsaturation } from '../chem/core.js';
import { defineMissing, flipCenter, mirror } from '../chem/stereo.js';
import { rsCardHTML } from '../rsview.js';
import { CLASS } from '../chem/name.js';
import { steps, diff, noteText } from '../chem/explain.js';
import { drawMolecule, templateIcon } from '../draw.js';
import { entry, molecule, tokensHTML, formulaHTML, esc, store, getLang, onLang, pick, copyText, tabsHTML, tabNow, drawMode, setDrawMode } from '../ui.js';

const LBL = s => s.replace(/(\d)/g, '<sub>$1</sub>');
const TOOLS = [
  ['add', '치환', '원자를 선택하면 수소 하나를 지정한 치환기로 바꿉니다'],
  ['bond', '결합', 'C–C 결합을 선택할 때마다 결합 차수가 1 → 2 → 3 으로 바뀝니다'],
  ['erase', '삭제', '선택한 원자와 그 원자에 딸린 곁사슬을 삭제합니다'],
  ['flip', 'E/Z', '이중결합을 선택하면 E ↔ Z 배치가 바뀝니다'],
  ['rs', 'R/S', '입체중심 또는 치환된 고리 탄소를 선택하면 배열이 반전됩니다 (R ↔ S, cis ↔ trans)']
];
const BASES = TEMPLATES.filter(t => t.kind === 'base');
/* 편집기에 보이는 기본 골격은 여섯 개만 (나머지는 치환 · 결합 도구로 만들 수 있다) */
const SHOWN = ['ethane', 'butane', 'propene', 'ethyne', 'cyclohexane', 'benzene'].map(id => BASES.find(t => t.id === id));
const FAMOUS = TEMPLATES.filter(t => t.kind === 'famous');

/* 저장용: 원자 · 결합만 */
const pack = m => ({ a: m.atoms.map(x => [x.el, x.h, x.q || 0, +x.x.toFixed(3), +x.y.toFixed(3), x.chi ? [...x.chi.n, x.chi.s] : 0]), b: m.bonds.map(x => [x.a, x.b, x.o, x.arom ? 1 : 0]) });
const unpack = p => makeMol(p.a.map(([el, h, q, x, y, c]) => Object.assign({ el, h, q, x, y }, c ? { chi: { n: c.slice(0, 4), s: c[4] } } : {})), p.b.map(([a, b, o, ar]) => ({ a, b, o, arom: !!ar })));

export function mount(root, app, params) {
  const saved = store.get('build2', null);
  let start;
  try { start = params && params.smiles ? fromSmiles(params.smiles) : params && params.mol ? params.mol : saved ? unpack(saved.mol) : fromSmiles('C=CC'); }
  catch { start = fromSmiles('C=CC'); }
  const S = {
    mol: defineMissing(start), tool: 'add', sel: (saved && saved.sel) || 'OH', mode: drawMode(),
    hist: [], redo: [], prev: null, pick: null, msg: '', lastFrag: (params && params.focusGroup) || null, cip: null
  };
  if (!FRAGMENTS[S.sel]) S.sel = 'OH';

  root.innerHTML = `<section class="page build">
    <div class="pg-head">
      <div><p class="eyebrow"><span class="bar"></span>01 — BUILD</p><h1 class="title">BUILD<small>구조식 편집기</small></h1></div>
      <p class="lead" style="margin:0;max-width:56ch">원자를 선택하면 수소 하나가 지정한 치환기로 바뀝니다. 탄소를 이어 주사슬을 늘리고 고리 · 다중결합을 만들 수 있습니다. 파란 띠는 주사슬(모체), 작은 숫자는 위치번호입니다.</p>
    </div>
    <div class="bl-grid">
      <div class="bl-tools">
        <div class="blk blk-scaf panel ticks">
          <h2 class="lbl" id="lb-scaf">기본 골격</h2>
          <div class="scafs" role="group" aria-labelledby="lb-scaf">${SHOWN.map(t => `<button class="scaf" type="button" data-t="${t.id}"><span class="hx">${templateIcon(t.id)}</span>${t.ko}</button>`).join('')}</div>
          <label class="lbl fam-lbl" for="fam">대표 화합물</label>
          <select id="fam" class="fam-select"><option value="">화합물 선택 (${FAMOUS.length}종)</option>${FAMOUS.map(t => `<option value="${t.id}">${t.ko} — ${t.note}</option>`).join('')}</select>
        </div>
        <div class="blk blk-pal panel">
          <div class="toolbar" role="radiogroup" aria-label="도구">${TOOLS.map(([id, ko, tip]) => `<button class="tool" type="button" role="radio" data-tool="${id}" title="${tip}">${ko}</button>`).join('')}</div>
          <div class="palette-wrap">${tabsHTML('pal', FRAG_GROUPS.map(([g, ko]) => ({ id: g, label: ko, html: `<div class="palette" role="radiogroup" aria-label="${ko}">${Object.entries(FRAGMENTS).filter(([, f]) => f.group === g).map(([id, f]) => `<button class="chip" type="button" role="radio" data-g="${id}" aria-checked="false" title="${f.ko}"><span>${LBL(f.label)}</span></button>`).join('')}</div>` })), (FRAGMENTS[S.sel] || {}).group)}</div>
          <p class="pal-info" aria-live="polite"></p>
        </div>
        <div class="blk blk-tools panel"><h2 class="lbl">편집</h2><div class="tools-row">
          <button class="btn" type="button" id="b-undo">실행 취소</button><button class="btn" type="button" id="b-redo">다시 실행</button>
          <button class="btn" type="button" id="b-tidy">구조 정리</button><button class="btn" type="button" id="b-rand">무작위 생성</button>
          <button class="btn" type="button" id="b-3d">3D 보기</button><button class="btn solid" type="button" id="b-react">반응 예측 →</button></div></div>
      </div>
      <div class="stage panel ticks">
        <div class="stage-top"><p class="lbl">구조식</p>
          <div class="seg small" role="group" aria-label="구조식 표기"><button type="button" data-mode="skeletal">골격 구조식</button><button type="button" data-mode="atoms">축약 구조식</button></div>
          <span class="stage-count"></span></div>
        <div class="svgwrap"></div>
        <div class="stage-foot"></div>
      </div>
      <div class="result"></div>
    </div>
    <div class="focus-bar" hidden><p></p>
      <div class="fb-tools"><button class="btn" type="button" id="z-out" aria-label="축소">−</button><button class="btn" type="button" id="z-in" aria-label="확대">+</button>
      <button class="btn" type="button" id="z-reset">시점 초기화</button><button class="btn" type="button" id="z-h" aria-pressed="true">수소 표시</button>
      <button class="btn solid" type="button" id="b-back">구조식으로 돌아가기</button></div>
      <small>드래그: 회전 · 휠/두 손가락: 확대 · 더블클릭: 초기화 · 길게 누르기: 분해도</small></div>
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
  function commit(m, frag, fresh) {
    S.hist.push(S.mol); if (S.hist.length > 80) S.hist.shift();
    S.redo = [];
    S.prev = fresh ? null : cur; /* 새 분자를 불러오면 "바뀐 점"을 비교하지 않는다 */
    S.mol = defineMissing(m); S.msg = '';
    if (frag) S.lastFrag = frag;
    save(); render(true);
  }
  let cur = null;
  /* 접미사 작용기가 없는 헤테로 원자 화합물의 분류 */
  const hetero = m => [m.atoms.some(a => ['F', 'Cl', 'Br', 'I'].includes(a.el)) && '할로젠화물', m.atoms.some(a => a.el === 'N' && a.q === 1) && '나이트로 화합물', m.atoms.some(a => a.el === 'O' && !a.q) && m.atoms.some((a, i) => a.el === 'O' && m.nb[i].length === 2) && '에터'].filter(Boolean).join(' · ') || '치환 탄화수소';
  function render(changed) {
    cur = entry(S.mol);
    paintTools();
    const m = cur.mol, r = cur.res;
    const nC = m.atoms.filter(a => a.el === 'C').length;
    q('.stage-count').textContent = `중원자 ${m.atoms.length} · 탄소 ${nC}`;
    const hasC = c => r && ((r.rs && r.rs.has(c)) || (r.pseudo && r.pseudo.has(c)));
    if (!hasC(S.cip)) S.cip = r && r.rs && r.rs.size && S.tool === 'rs' ? r.rs.keys().next().value : null;
    q('.svgwrap').innerHTML = drawMolecule(m, r, { interactive: true, tool: S.tool, mode: S.mode, pick: S.pick, cip: S.cip });
    const cls = r ? (r.P ? CLASS[r.P].ko : r.enes.length || r.ynes.length ? (r.ynes.length ? '알카인' : '알켄') : r.kind === 'benzene' || r.kind === 'biphenyl' ? '방향족 화합물' : m.atoms.some(a => a.el !== 'C') ? hetero(m) : r.kind === 'ring' ? '사이클로알케인' : '알케인') : '—';
    q('.stage-foot').innerHTML = `<span><em>분자식</em>${formulaHTML(cur.f)}</span><span><em>몰질량</em>${cur.f.mass.toFixed(2)} g/mol</span><span><em>화합물군</em>${cls}</span><span><em>불포화도</em>${unsaturation(m)}</span><span class="smi"><em>SMILES</em>${esc(toSmiles(m))}</span>`;
    renderResult();
    if (changed !== false && r) app.setMol(cur, { instant: changed === 'first' });
    if (document.body.classList.contains('focus3d') && r) q('.focus-bar p').textContent = getLang() === 'ko' ? r.nameKo : r.nameEn;
  }

  function renderResult() {
    const r = cur.res, ko = getLang() === 'ko';
    if (!r) {
      q('.result').innerHTML = `<div class="nm panel ticks"><p class="lbl">IUPAC 이름</p><p class="name-main muted">명명할 수 없는 구조입니다</p><p class="note warn">${esc(cur.err || '')}</p><p class="hint">‘실행 취소’로 이전 구조로 돌아갈 수 있습니다.</p></div>`;
      return;
    }
    const main = ko ? r.ko : r.en, subName = ko ? r.nameEn : r.nameKo;
    const cm = cur.common;
    const st = steps(cur.mol, r);
    const notes = (r.notes || []).map(noteText).filter(Boolean);
    const warns = notes.filter(n => n.tone === 'warn'), infos = notes.filter(n => n.tone !== 'warn');
    const d = S.prev && S.prev.res ? diff(S.prev.mol, S.prev.res, cur.mol, r) : [];
    const rsHTML = rsCardHTML(cur.mol, r, { sel: S.cip, ko, mirrorBtn: true });
    const nSt = (r.centers ? r.centers.length : 0) + (r.ct ? r.ct.length : 0);
    q('.result').innerHTML = `
      <div class="nm panel ticks">
        <button class="copy" type="button" id="b-copy">복사</button>
        <p class="lbl">IUPAC 이름</p>
        <p class="name-main" aria-live="polite">${tokensHTML(main)}</p>
        <p class="name-sub">${esc(subName)}</p>
        ${cm ? `<p class="name-common">관용명 <b>${esc(ko ? cm.ko : cm.en)}</b> · ${esc(ko ? cm.en : cm.ko)}${cm.note ? ` — ${esc(cm.note)}` : ''}</p>` : ''}
        <p class="legend" aria-hidden="true"><span class="l-loc">위치번호</span><span class="l-pre">접두사</span><span class="l-par">모체(어근)</span><span class="l-une">불포화 어미</span><span class="l-suf">접미사</span>${r.stereo ? '<span class="l-ste">입체 표시</span>' : ''}</p>
      </div>
      ${warns.length ? `<div class="notes">${warns.map(n => `<p class="note ${n.tone}">${n.t}</p>`).join('')}</div>` : ''}
      ${tabsHTML('build', [
        d.length && { id: 'diff', label: '명명 변화', n: d.length, html: `<div class="changes"><p class="from">${esc(S.prev.res.nameEn)} → ${esc(r.nameEn)}</p><ul>${d.map(x => `<li>${x}</li>`).join('')}</ul></div>` },
        { id: 'steps', label: '명명 과정', html: `<div class="panel"><ol class="steps">${st.map(s => `<li><div><span class="sk">${s.k}</span>${s.t}</div></li>`).join('')}</ol></div>` },
        rsHTML && { id: 'stereo', label: '입체화학', n: nSt, html: rsHTML },
        infos.length && { id: 'notes', label: '참고 사항', n: infos.length, html: `<div class="notes">${infos.map(n => `<p class="note ${n.tone}">${n.t}</p>`).join('')}</div>` },
        { id: 'cmp', label: '비교', html: `<div class="cmp-slot"><p class="hint">계산 중…</p></div>` }
      ], 'steps')}`;
    root.querySelectorAll('.rs-tabs [data-cip]').forEach(bt => bt.addEventListener('click', () => { S.cip = +bt.dataset.cip; renderSvgOnly(); renderResult(true); }));
    const mb = q('#b-mirror'); if (mb) mb.addEventListener('click', () => commit(mirror(S.mol)));
    fillCmp();
    q('#b-copy').addEventListener('click', async e => {
      const ok = await copyText(r.nameEn, q('.name-main'));
      e.target.textContent = ok ? '복사됨' : '선택됨';
      setTimeout(() => { e.target.textContent = '복사'; }, 1400);
    });
  }
  /* 비교 목록: ‘비교’ 탭이 열려 있을 때만, 잠깐 뒤에 (그 사이 또 바뀌면 취소) */
  function fillCmp() {
    const token = ++cmpToken;
    clearTimeout(cmpTimer);
    if (tabNow(root, 'build') !== 'cmp') return;
    const frag = S.lastFrag || S.sel;
    cmpTimer = setTimeout(() => {
      if (token !== cmpToken || !cur.res) return;
      rowsCache = [];
      const cmpB = S.tool === 'add' && cur.mol.atoms.length <= 40 ? compareSites(S.sel) : [];
      const cmpA = compareBases(frag);
      const slot = q('.cmp-slot'); if (!slot) return;
      slot.innerHTML = (cmpB.length ? `<div class="cmp panel"><p class="lbl">위치별 ${LBL(FRAGMENTS[S.sel].label)} 치환체</p><ul class="cmp-list">${cmpB.map(rowHTML).join('')}</ul></div>` : '')
        + (cmpA.length ? `<div class="cmp panel"><p class="lbl">기본 골격별 ${LBL(FRAGMENTS[frag].label)} 치환체</p><ul class="cmp-list">${cmpA.map(rowHTML).join('')}</ul></div>` : '')
        || '<p class="hint">비교할 구조가 없습니다. ‘치환’ 도구에서 치환기를 선택하면 위치별 치환체를 보여 줍니다.</p>';
      slot.querySelectorAll('.cmp-list button').forEach((bt, i) => bt.addEventListener('click', () => {
        const x = rowsCache[i];
        commit(x.mol, x.frag);
        if (innerWidth < 900) q('.stage').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }));
    }, 180);
  }
  root.addEventListener('tabchange', e => { if (e.detail.key === 'build' && e.detail.id === 'cmp') fillCmp(); });
  let rowsCache = [], cmpToken = 0, cmpTimer = 0;
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
  function act(el, kb) {
    S.msg = '';
    if (el.dataset.atom !== undefined) {
      const i = +el.dataset.atom;
      let r;
      if (S.tool === 'add') r = attach(S.mol, i, S.sel);
      else if (S.tool === 'erase') r = removeBranch(S.mol, i, 0);
      else if (S.tool === 'rs') {
        r = flipCenter(S.mol, i);
        if (r.error) { S.msg = r.error + (cur.res && cur.res.centers.length ? '' : ' — 현재 구조에는 입체중심이 없습니다 (예: 뷰테인의 C2 에 OH 를 도입)'); paintTools(); return; }
        S.cip = i; commit(r.mol); return;
      }
      else { S.msg = S.tool === 'bond' ? '결합을 선택하세요' : '이중결합을 선택하세요'; paintTools(); return; }
      if (r.error) { S.msg = r.error; paintTools(); return; }
      S.pick = S.tool === 'add' ? i : null;
      commit(r.mol, S.tool === 'add' ? S.sel : null);
      /* 키보드로 눌렀을 때만 같은 원자로 초점을 되돌린다 (마우스일 때 큰 그림에서 초점을 옮기면 화면 계산이 한 번 더 들어 느려짐) */
      if (kb) { const again = q(`.svgwrap [data-atom="${i}"]`); if (again) again.focus({ preventScroll: true }); }
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
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(el, true); }
  });
  const loadT = id => { const t = TEMPLATES.find(x => x.id === id); S.pick = null; S.cip = null; commit(fromSmiles(t.smi), null, true); };
  root.querySelectorAll('.scaf[data-t]').forEach(b => b.addEventListener('click', () => loadT(b.dataset.t)));
  q('#fam').addEventListener('change', e => { const id = e.target.value; if (!id) return; loadT(id); e.target.value = ''; });
  root.querySelector('.toolbar').addEventListener('click', e => { const b = e.target.closest('[data-tool]'); if (!b) return; S.tool = b.dataset.tool; S.msg = ''; if (S.tool === 'rs') store.set('tab:build', 'stereo'); paintTools(); render(false); });
  root.querySelector('.palette-wrap').addEventListener('click', e => {
    const b = e.target.closest('[data-g]'); if (!b) return;
    S.sel = b.dataset.g; S.tool = 'add'; S.msg = ''; save(); paintTools(); renderResult();
  });
  root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { S.mode = b.dataset.mode; setDrawMode(S.mode); paintTools(); renderSvgOnly(); }));
  function renderSvgOnly() { q('.svgwrap').innerHTML = drawMolecule(cur.mol, cur.res, { interactive: true, tool: S.tool, mode: S.mode, pick: S.pick, cip: S.cip }); }
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
      if (!e.res || (e.res.notes || []).some(n => ['enol', 'enamine', 'ynol', 'ynamine', 'gemdiol', 'halohydrin', 'hemiaminal', 'hemiacetal'].includes(n.type))) continue;
      S.pick = null; commit(m, null, true); return;
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

  /* 뒤 배경의 3D 분자는 흐릿하게만 보이므로 가벼운 모드로 (3D 보기를 켜면 원래대로) */
  if (app.scene) app.scene.setLite(true);
  render('first');
  return {
    unmount() { clearTimeout(cmpTimer); offLang(); document.removeEventListener('keydown', onKey); app.focus3d(false); if (app.scene) { app.scene.setLite(false, false); app.scene.setFocus(false); app.scene.setShowH(true); } },
    report: () => ({ '분자 SMILES': toSmiles(S.mol), '이름': cur && cur.res ? cur.res.nameEn : cur && cur.err ? '(명명 불가) ' + cur.err : '', '도구': S.tool === 'add' ? '치환 ' + S.sel : S.tool })
  };
}
