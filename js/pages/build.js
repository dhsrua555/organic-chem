/* 분자 조립: 뼈대를 고르고 H 자리를 눌러 작용기를 붙인다. 이름 · 풀이 · 바뀐 점 · 비교를 곧바로 보여 준다 */
import { GROUPS, GROUP_ORDER, SCAFFOLD_ORDER, SCAFFOLDS, MAX_GROUPS, countGroups, unsaturation } from '../chem/mol.js';
import { CLASS } from '../chem/name.js';
import { steps, diff, noteText } from '../chem/explain.js';
import { drawMolecule, scaffoldIcon, siteName } from '../draw.js';
import { molecule, tokensHTML, formulaHTML, esc, store, getLang, onLang, pick, copyText } from '../ui.js';
import { SCAF_KO } from '../data.js';

const GLABEL = g => GROUPS[g].label.replace(/(\d)/g, '<sub>$1</sub>');
const ATOM_DESC = {
  methane: ['탄소'], ethane: ['탄소', '탄소'], ethene: ['탄소', '탄소'], propane: ['끝 탄소', '가운데 탄소', '끝 탄소'],
  propene: ['=CH₂ 쪽 끝', '가운데 =CH–', 'CH₃ 쪽 끝'], benzene: Array(6).fill('고리')
};
const GROUP_TIP = {
  COOH: '카복시기 → 카복실산 (-oic acid). 우선순위 1위', COOCH3: '메톡시카보닐기 → 에스터 (methyl …-oate)', CONH2: '카바모일기 → 아마이드 (-amide)',
  CN: '사이아노기 → 나이트릴 (-nitrile)', CHO: '폼일기 → 알데하이드 (-al)', COCH3: '아세틸기 → 케톤 (-one)', OH: '하이드록시기 → 알코올 (-ol) · 페놀',
  NH2: '아미노기 → 아민 (-amine)', CH3: '메틸기: 사슬을 늘리는 가지 (접두사만)', OCH3: '메톡시기: 에터 (접두사만)', NO2: '나이트로기 (접두사만)',
  F: '플루오로 (접두사만)', Cl: '클로로 (접두사만)', Br: '브로모 (접두사만)', I: '아이오도 (접두사만)'
};

export function mount(root, app, params) {
  const saved = store.get('build', null);
  const S = {
    scaf: (params && params.scaf) || (saved && saved.scaf) || 'propene',
    subs: (params && params.subs) || (saved && saved.subs) || {},
    sel: (saved && saved.sel) || 'OH',
    hist: [], prev: null, lastGroup: (params && params.focusGroup) || null, pick: null
  };
  if (!SCAFFOLDS[S.scaf]) { S.scaf = 'propene'; S.subs = {}; }

  root.innerHTML = `<section class="page build">
    <div class="pg-head">
      <div><p class="eyebrow"><span class="bar"></span>01 — BUILD</p><h1 class="title">BUILD<small>분자 조립</small></h1></div>
      <p class="lead" style="margin:0;max-width:52ch">H 자리를 누르면 고른 작용기가 붙고, 붙은 작용기를 누르면 떨어집니다. 파란 띠가 주사슬, 작은 숫자가 위치 번호입니다.</p>
    </div>
    <div class="bl-grid">
      <div class="bl-tools">
        <div class="blk blk-scaf panel ticks"><h2 class="lbl" id="lb-scaf">뼈대</h2><div class="scafs" role="radiogroup" aria-labelledby="lb-scaf"></div></div>
        <div class="blk blk-pal panel"><h2 class="lbl" id="lb-pal">붙일 작용기</h2><div class="palette" role="radiogroup" aria-labelledby="lb-pal"></div><p class="pal-info" aria-live="polite"></p></div>
        <div class="blk blk-tools panel"><h2 class="lbl">도구</h2><div class="tools-row">
          <button class="btn" type="button" id="b-undo">되돌리기</button><button class="btn" type="button" id="b-clear">비우기</button>
          <button class="btn" type="button" id="b-rand">무작위</button><button class="btn" type="button" id="b-3d">3D 보기</button></div></div>
      </div>
      <div class="stage panel ticks">
        <div class="stage-top"><p class="lbl">구조식</p><span class="stage-count"></span></div>
        <div class="svgwrap"></div>
        <div class="stage-foot"></div>
      </div>
      <div class="result"></div>
    </div>
    <div class="focus-bar" hidden><p></p><button class="btn solid" type="button" id="b-back">구조식으로</button></div>
  </section>`;
  const q = s => root.querySelector(s);

  /* ── 도구 ── */
  q('.scafs').innerHTML = SCAFFOLD_ORDER.map(id => `<button class="scaf" type="button" role="radio" data-scaf="${id}" aria-checked="false"><span class="hx">${scaffoldIcon(id)}</span>${SCAF_KO[id]}<small>${SCAFFOLDS[id].formula.replace(/(\d)/g, '<sub>$1</sub>')}</small></button>`).join('');
  q('.palette').innerHTML = GROUP_ORDER.map(g => `<button class="chip" type="button" role="radio" data-g="${g}" data-cls="${GROUPS[g].cls}" aria-checked="false" title="${GROUP_TIP[g]}"><span>${GLABEL(g)}</span></button>`).join('');

  function paintTools() {
    root.querySelectorAll('.scaf').forEach(b => b.setAttribute('aria-checked', String(b.dataset.scaf === S.scaf)));
    root.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-checked', String(b.dataset.g === S.sel)));
    q('.pal-info').innerHTML = `<b>${GLABEL(S.sel)}</b> — ${GROUP_TIP[S.sel]}`;
    q('#b-undo').disabled = !S.hist.length;
  }

  function save() { store.set('build', { scaf: S.scaf, subs: S.subs, sel: S.sel }); }
  function commit(scaf, subs, group) {
    S.hist.push({ scaf: S.scaf, subs: S.subs });
    if (S.hist.length > 60) S.hist.shift();
    const before = molecule(S.scaf, S.subs);
    S.prev = before;
    S.scaf = scaf; S.subs = subs;
    if (group) S.lastGroup = group;
    save(); render(true);
  }

  /* ── 그리기 ── */
  function render(changed) {
    const m = molecule(S.scaf, S.subs);
    paintTools();
    const n = countGroups(S.subs);
    q('.stage-count').textContent = `작용기 ${n} / ${MAX_GROUPS}`;
    q('.svgwrap').innerHTML = drawMolecule(m.mol, m.res, { interactive: true, pick: S.pick });
    const cls = m.res.P ? `${CLASS[m.res.P].ko}` : (m.res.enes && m.res.enes.length ? '알켄' : m.res.kind === 'benzene' ? '방향족 탄화수소' : n ? '치환 탄화수소' : '알케인');
    q('.stage-foot').innerHTML = `<span><em>분자식</em>${formulaHTML(m.f)}</span><span><em>몰질량</em>${m.f.mass.toFixed(2)} g/mol</span><span><em>분류</em>${cls}</span><span><em>불포화도</em>${unsaturation(m.mol)}</span>`;
    renderResult(m);
    if (changed !== false) app.setMol(m, { instant: changed === 'first' });
    if (document.body.classList.contains('focus3d')) q('.focus-bar p').textContent = getLang() === 'ko' ? m.res.nameKo : m.res.nameEn;
  }

  function renderResult(m) {
    const r = m.res, ko = getLang() === 'ko';
    const main = ko ? r.ko : r.en, subName = ko ? r.nameEn : r.nameKo;
    const cm = m.common;
    const st = steps(m.mol, r);
    const notes = (r.notes || []).map(noteText).filter(Boolean);
    const d = S.prev ? diff(S.prev.mol, S.prev.res, m.mol, r) : [];
    const cmpA = compareScaffolds(S.lastGroup || firstGroup() || S.sel);
    const cmpB = countGroups(S.subs) < MAX_GROUPS ? compareSites(m, S.sel) : [];
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
      ${cmpB.length ? `<div class="cmp panel"><p class="lbl">빈 자리마다 ${GLABEL(S.sel)} 붙여 보기</p><ul class="cmp-list">${cmpB.map(rowHTML).join('')}</ul></div>` : ''}
      ${cmpA.rows.length ? `<div class="cmp panel"><p class="lbl">${GLABEL(cmpA.g)} 하나를 여러 뼈대에 붙이면</p><ul class="cmp-list">${cmpA.rows.map(rowHTML).join('')}</ul></div>` : ''}`;
    q('#b-copy').addEventListener('click', async e => {
      const ok = await copyText(r.nameEn, q('.name-main'));
      e.target.textContent = ok ? '복사됨' : '선택됨';
      setTimeout(() => { e.target.textContent = '복사'; }, 1400);
    });
    root.querySelectorAll('.cmp-list button').forEach(b => b.addEventListener('click', () => {
      const [scaf, json, g] = [b.dataset.scaf, b.dataset.subs, b.dataset.g];
      commit(scaf, JSON.parse(json), g);
      if (innerWidth < 900) q('.stage').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }
  function firstGroup() { const v = Object.values(S.subs).filter(Boolean); return v[v.length - 1]; }
  function rowHTML(x) {
    const ko = getLang() === 'ko';
    const cur = x.key === molecule(S.scaf, S.subs).key;
    return `<li><button type="button" data-scaf="${x.scaf}" data-subs='${JSON.stringify(x.subs)}' data-g="${x.g}" aria-current="${cur}">
      <span class="cw">${esc(x.where)}</span><span class="cn">${esc(ko ? x.m.res.nameKo : x.m.res.nameEn)}<span class="ck">${esc(ko ? x.m.res.nameEn : x.m.res.nameKo)}${x.m.common ? ' · ' + esc(x.m.common.ko) : ''}</span></span></button></li>`;
  }
  /* 같은 작용기 하나를 뼈대마다 붙인 이름 (이름이 같으면 한 번만) */
  function compareScaffolds(g) {
    const rows = [], seen = new Set();
    for (const scaf of SCAFFOLD_ORDER) {
      SCAFFOLDS[scaf].sites.forEach((s, i) => {
        const m = molecule(scaf, { [i]: g });
        if (seen.has(m.res.nameEn)) return; seen.add(m.res.nameEn);
        rows.push({ scaf, subs: { [i]: g }, g, m, key: m.key, where: `${SCAF_KO[scaf]}${scaf === 'benzene' || scaf === 'methane' || scaf === 'ethane' ? '' : ' · ' + ATOM_DESC[scaf][s.atom]}` });
      });
    }
    return { g, rows };
  }
  /* 지금 분자의 빈 H 자리마다 g 를 붙인 결과 */
  function compareSites(m, g) {
    const rows = [], seen = new Set();
    m.mol.sites.forEach(s => {
      if (s.group) return;
      const subs = { ...S.subs, [s.i]: g };
      const x = molecule(S.scaf, subs);
      if (seen.has(x.res.nameEn)) return; seen.add(x.res.nameEn);
      rows.push({ scaf: S.scaf, subs, g, m: x, key: x.key, where: siteName(m.mol, s) });
    });
    return rows;
  }

  /* ── 이벤트 ── */
  function onSite(el) {
    const i = +el.dataset.site;
    if (el.dataset.group) {
      const subs = { ...S.subs }; delete subs[i];
      S.pick = i; commit(S.scaf, subs, null);
    } else {
      if (countGroups(S.subs) >= MAX_GROUPS) { q('.pal-info').innerHTML = `<b>작용기는 ${MAX_GROUPS}개까지</b> 붙일 수 있습니다. 붙은 것을 눌러 떼어 낸 뒤 붙여 보세요.`; return; }
      S.pick = i; commit(S.scaf, { ...S.subs, [i]: S.sel }, S.sel);
    }
    const again = q(`.svgwrap [data-site="${i}"]`); if (again) again.focus({ preventScroll: true });
  }
  q('.svgwrap').addEventListener('click', e => { const el = e.target.closest('[data-site]'); if (el) onSite(el); });
  q('.svgwrap').addEventListener('keydown', e => {
    const el = e.target.closest('[data-site]'); if (!el) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSite(el); }
  });
  q('.scafs').addEventListener('click', e => {
    const b = e.target.closest('[data-scaf]'); if (!b || b.dataset.scaf === S.scaf) return;
    S.pick = null; commit(b.dataset.scaf, {}, null);
  });
  q('.palette').addEventListener('click', e => {
    const b = e.target.closest('[data-g]'); if (!b) return;
    S.sel = b.dataset.g; save(); paintTools();
    renderResult(molecule(S.scaf, S.subs));
  });
  /* 라디오 묶음: 화살표로 이동 */
  for (const sel of ['.scafs', '.palette']) q(sel).addEventListener('keydown', e => {
    const list = [...q(sel).children]; const k = list.indexOf(document.activeElement);
    if (k < 0) return;
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!d) return; e.preventDefault();
    const nx = list[(k + d + list.length) % list.length]; nx.focus(); nx.click();
  });
  q('#b-undo').addEventListener('click', () => {
    const h = S.hist.pop(); if (!h) return;
    S.prev = molecule(S.scaf, S.subs);
    S.scaf = h.scaf; S.subs = h.subs; S.pick = null; save(); render(true);
  });
  q('#b-clear').addEventListener('click', () => { S.pick = null; commit(S.scaf, {}, null); });
  q('#b-rand').addEventListener('click', () => {
    for (let t = 0; t < 40; t++) {
      const scaf = pick(['benzene', 'benzene', 'propene', 'propene', 'ethene', 'propane', 'ethane']);
      const nsites = SCAFFOLDS[scaf].sites.length, k = 1 + Math.floor(Math.random() * 3);
      const subs = {};
      const pool = ['OH', 'OH', 'COOH', 'CHO', 'NH2', 'CH3', 'CH3', 'Cl', 'Br', 'NO2', 'OCH3', 'COCH3', 'CN', 'COOCH3', 'CONH2', 'F'];
      for (let j = 0; j < k; j++) subs[Math.floor(Math.random() * nsites)] = pick(pool);
      const m = molecule(scaf, subs);
      if ((m.res.notes || []).some(n => ['enol', 'enamine', 'gemdiol', 'halohydrin', 'hemiaminal', 'hemiacetal'].includes(n.type))) continue;
      S.pick = null; commit(scaf, subs, Object.values(subs)[0]); return;
    }
  });
  const focus = on => {
    app.focus3d(on);
    q('.focus-bar').hidden = !on;
    app.anchor(on ? { x: 0, y: 0.06, scale: innerWidth < 900 ? 1.05 : 1.3, dim: 1 } : null);
    if (on) { const m = molecule(S.scaf, S.subs); q('.focus-bar p').textContent = getLang() === 'ko' ? m.res.nameKo : m.res.nameEn; q('#b-back').focus(); }
    else q('#b-3d').focus();
  };
  q('#b-3d').addEventListener('click', () => focus(true));
  q('#b-back').addEventListener('click', () => focus(false));
  const onKey = e => { if (e.key === 'Escape' && document.body.classList.contains('focus3d')) focus(false); };
  document.addEventListener('keydown', onKey);
  const offLang = onLang(() => render(false));

  render('first');
  return { unmount() { offLang(); document.removeEventListener('keydown', onKey); app.focus3d(false); } };
}
