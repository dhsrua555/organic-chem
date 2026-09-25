/* 반응 예측: 기질을 고르고 시약을 누르면 주 · 부생성물, 메커니즘, 풀이, 선택성, 최신 관점을 보여 준다 */
import { CATS, REACTIONS, predict, applicable } from '../chem/reactions.js';
import { fromSmiles } from '../chem/edit.js';
import { makeMol } from '../chem/core.js';
import { drawMolecule } from '../draw.js';
import { entry, tokensHTML, esc, store, getLang, onLang } from '../ui.js';
import { TIMELINE } from '../data.js';
import { commonName } from '../chem/common.js';

const EXAMPLES = {
  sn: [['CCC(C)Br', '2-브로모뷰테인'], ['CC(C)(C)Br', 'tert-뷰틸 브로마이드'], ['CCCBr', '1-브로모프로페인'], ['CC(C)C(C)Br', '자리옮김이 되는 2차'], ['BrCc1ccccc1', '벤질 브로마이드']],
  alc: [['CC(O)CC', '뷰탄-2-올'], ['CCCO', '프로판-1-올'], ['CC(C)(C)O', 'tert-뷰탄올'], ['OC1CCCCC1', '사이클로헥산올'], ['CC(C)C(C)O', '3-메틸뷰탄-2-올']],
  ene: [['CC=C', '프로펜'], ['CC(C)=CC', '2-메틸뷰트-2-엔'], ['C1=CCCCC1', '사이클로헥센'], ['CC(C)(C)C=C', '3,3-다이메틸뷰트-1-엔'], ['C/C=C/C', '(E)-뷰트-2-엔']],
  yne: [['CCC#C', '뷰트-1-아인'], ['CC#CC', '뷰트-2-아인'], ['C#Cc1ccccc1', '페닐아세틸렌']],
  co: [['CCC=O', '프로판알'], ['CC(=O)c1ccccc1', '아세토페논'], ['O=C1CCCCC1', '사이클로헥산온'], ['CCOC(C)=O', '아세트산 에틸'], ['CCC#N', '프로페인나이트릴'], ['OCCC(C)=O', 'OH 가 있는 케톤']],
  acyl: [['CC(=O)O', '아세트산'], ['CC(=O)Cl', '아세틸 클로라이드'], ['CCOC(=O)c1ccccc1', '벤조산 에틸'], ['CC(N)=O', '아세트아마이드'], ['CCC#N', '프로페인나이트릴']],
  aro: [['c1ccccc1', '벤젠'], ['Cc1ccccc1', '톨루엔'], ['COc1ccccc1', '아니솔'], ['[O-][N+](=O)c1ccccc1', '나이트로벤젠'], ['Nc1ccccc1', '아닐린'], ['CC(=O)Nc1ccccc1', '아세트아닐라이드'], ['Cc1ccc(C)cc1', 'p-자일렌']],
  rad: [['CCC', '프로페인'], ['CC(C)C', '아이소뷰테인'], ['CCCC', '뷰테인'], ['CC(C)CC', '2-메틸뷰테인'], ['C1CCCCC1', '사이클로헥세인']],
  cc: [['CC=O', '아세트알데하이드'], ['CCOC(C)=O', '아세트산 에틸'], ['C=CC=C', '뷰타-1,3-다이엔'], ['C=CC(C)=C', '아이소프렌'], ['Brc1ccccc1', '브로모벤젠'], ['C=CCCCC=C', '헵타-1,6-다이엔'], ['C=CCCC', '펜트-1-엔']]
};
const ROLE = { major: '주생성물', minor: '부생성물', side: '함께 생김' };
const pack = m => ({ a: m.atoms.map(x => [x.el, x.h, x.q || 0, +x.x.toFixed(3), +x.y.toFixed(3)]), b: m.bonds.map(x => [x.a, x.b, x.o, x.arom ? 1 : 0]) });
const unpack = p => makeMol(p.a.map(([el, h, q, x, y]) => ({ el, h, q, x, y })), p.b.map(([a, b, o, ar]) => ({ a, b, o, arom: !!ar })));

export function mount(root, app, params) {
  const saved = store.get('react', null);
  let mol;
  try { mol = params && params.mol ? params.mol : params && params.smiles ? fromSmiles(params.smiles) : saved ? unpack(saved.mol) : fromSmiles('CCC(C)Br'); }
  catch { mol = fromSmiles('CCC(C)Br'); }
  const S = { mol, cat: (params && params.cat) || (saved && saved.cat) || null, rid: (params && params.rid) || null, res: null };
  const mode = () => store.get('drawMode', 'atoms');

  root.innerHTML = `<section class="page react">
    <div class="pg-head">
      <div><p class="eyebrow"><span class="bar"></span>02 — REACTIONS</p><h1 class="title">REACTIONS<small>반응 예측</small></h1></div>
      <p class="lead" style="margin:0;max-width:60ch">기질을 고르고 시약을 누르세요. 스미스 유기화학의 핵심 반응 규칙으로 주생성물과 부생성물을 예측하고, 왜 그렇게 되는지와 교과서 이후에 새로 알려진 것을 함께 보여 줍니다.</p>
    </div>
    <div class="rx-grid">
      <div class="rx-left">
        <div class="panel ticks rx-sub">
          <p class="lbl">기질</p>
          <div class="rx-subsvg"></div>
          <p class="rx-subname"></p>
          <div class="tools-row"><button class="btn" type="button" id="r-from">분자 조립에서 가져오기</button><button class="btn" type="button" id="r-edit">조립에서 고치기</button></div>
          <div class="rx-ex"></div>
        </div>
        <div class="panel rx-reag">
          <div class="rx-cats" role="tablist" aria-label="반응 종류">${CATS.map(c => `<button type="button" role="tab" data-cat="${c.id}"><b>${c.ko}</b><small>${c.sub}</small></button>`).join('')}</div>
          <div class="rx-list" role="list"></div>
        </div>
      </div>
      <div class="rx-right" aria-live="polite"></div>
    </div>
    <div class="sec-h"><h2>Since Smith</h2><p>교과서 이후에 새로 알려지거나 널리 쓰이게 된 것</p></div>
    <ol class="timeline">${TIMELINE.map(t => `<li><span class="ty">${t.y}</span><div><b>${esc(t.t)}</b><p>${esc(t.d)}</p></div></li>`).join('')}</ol>
  </section>`;
  const q = s => root.querySelector(s);

  let subEntry = null;
  function paintSub() {
    subEntry = entry(S.mol);
    const r = subEntry.res, ko = getLang() === 'ko';
    const hl = new Set(S.res && S.res.sites ? S.res.sites : []);
    q('.rx-subsvg').innerHTML = drawMolecule(S.mol, r, { mode: mode(), locants: false, chain: false, hl, compact: true });
    q('.rx-subname').innerHTML = r ? `<span class="mono">${esc(ko ? r.nameKo : r.nameEn)}</span><small>${esc(ko ? r.nameEn : r.nameKo)}</small>` : `<span class="muted">${esc(subEntry.err || '')}</span>`;
    const ok = applicable(S.mol);
    const cat = S.cat || CATS.find(c => REACTIONS.some(x => x.cat === c.id && ok[x.id]))?.id || 'sn';
    S.cat = cat;
    root.querySelectorAll('[data-cat]').forEach(b => {
      b.setAttribute('aria-selected', String(b.dataset.cat === cat));
      b.classList.toggle('dim', !REACTIONS.some(x => x.cat === b.dataset.cat && ok[x.id]));
    });
    q('.rx-list').innerHTML = REACTIONS.filter(x => x.cat === cat).map(x => `<button type="button" role="listitem" class="rx-btn${ok[x.id] ? '' : ' dim'}${S.rid === x.id ? ' on' : ''}" data-rid="${x.id}"><b>${x.label}</b><small>${x.note}${x.modern ? ' · 현대' : ''}</small></button>`).join('');
    q('.rx-ex').innerHTML = `<p class="lbl">예시 기질 · ${CATS.find(c => c.id === cat).ko}</p><div class="ex-chips">${(EXAMPLES[cat] || []).map(([s, k]) => `<button type="button" data-smi="${esc(s)}">${esc(k)}</button>`).join('')}</div>`;
  }
  function run(rid) {
    S.rid = rid;
    S.cat = (REACTIONS.find(x => x.id === rid) || {}).cat || S.cat;
    S.res = predict(S.mol, rid);
    store.set('react', { mol: pack(S.mol), cat: S.cat });
    paintSub();
    paintResult();
    const major = S.res.products.find(p => p.role === 'major' && p.name);
    if (major) { app.setMol({ mol: major.mol, res: major.name }, { hl: major.hl }); }
  }
  function paintResult() {
    const res = S.res, ko = getLang() === 'ko';
    const R = res.reaction;
    const box = q('.rx-right');
    if (!res.ok) {
      box.innerHTML = `<div class="panel ticks rx-scheme none"><p class="lbl">${esc(R.label)} · ${esc(R.note)}</p><p class="rx-none"><b>${esc(res.mech || '반응 없음')}</b></p><p>${esc(res.reason)}</p>
        <p class="hint">같은 기질에 쓸 수 있는 시약은 목록에서 밝게 표시됩니다.</p></div>`;
      return;
    }
    const nm = p => p.name ? (ko ? p.name.nameKo : p.name.nameEn) : '';
    const nm2 = p => p.name ? (ko ? p.name.nameEn : p.name.nameKo) : '';
    const prodHTML = p => {
      const common = p.name ? commonName(p.name) : null;
      return `<figure class="rx-prod ${p.role}">
        <span class="rx-role">${ROLE[p.role] || ''}${p.pct ? ` · ${p.pct}%` : ''}</span>
        ${drawMolecule(p.mol, p.name, { mode: mode(), locants: false, chain: false, hl: p.hl, compact: true })}
        <figcaption>${p.name ? `<span class="mono">${tokensHTML(ko ? p.name.ko : p.name.en)}</span><small>${esc(nm2(p))}${common ? ' · ' + esc(ko ? common.ko : common.en) : ''}</small>` : `<span class="muted">${esc(p.err || '')}</span>`}${p.tag ? `<em>${esc(p.tag)}</em>` : ''}</figcaption>
      </figure>`;
    };
    const major = res.products.filter(p => p.role === 'major'), others = res.products.filter(p => p.role !== 'major');
    box.innerHTML = `
      <div class="panel ticks rx-scheme${res.warn ? ' warn' : ''}">
        <div class="rx-row">
          <figure class="rx-prod sub">${drawMolecule(S.mol, subEntry.res, { mode: mode(), locants: false, chain: false, hl: new Set(res.sites || []), compact: true })}<figcaption><span class="mono">${esc(subEntry.res ? (ko ? subEntry.res.nameKo : subEntry.res.nameEn) : '')}</span></figcaption></figure>
          <div class="rx-arrow"><span class="rx-reagent">${R.label}</span><svg viewBox="0 0 120 16" aria-hidden="true"><path d="M2 8h112M104 2l10 6-10 6"/></svg><span class="rx-mech">${esc(res.mech || '')}</span></div>
          <div class="rx-prods">${major.map(prodHTML).join('')}</div>
        </div>
        ${others.length ? `<div class="rx-minor"><p class="lbl">부생성물 · 함께 생기는 것</p><div class="rx-prods small">${others.map(prodHTML).join('')}</div></div>` : ''}
      </div>
      ${res.steps && res.steps.length ? `<div class="panel"><p class="lbl" style="padding:16px 18px 0;margin:0">어떻게 일어나나</p><ol class="steps">${res.steps.map(s => `<li><div><span class="sk">${esc(s.t)}</span>${s.d}${s.mol ? `<div class="step-mol">${drawMolecule(s.mol, null, { mode: mode(), locants: false, chain: false, compact: true })}</div>` : ''}</div></li>`).join('')}</ol></div>` : ''}
      ${res.select && res.select.length ? `<div class="changes"><p class="lbl">선택성 · 예측의 근거</p><ul>${res.select.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
      ${res.modern && res.modern.length ? `<div class="modern panel"><p class="lbl">교과서 이후 · 지금의 이해</p>${res.modern.map(m => `<p><span class="ty">${esc(m.y)}</span>${esc(m.t)}</p>`).join('')}</div>` : ''}
      <div class="tools-row"><button class="btn" type="button" id="r-take">주생성물을 새 기질로</button><button class="btn" type="button" id="r-build">주생성물을 분자 조립에서</button><button class="btn" type="button" id="r-quiz">반응 퀴즈</button></div>`;
    const first = major.find(p => p.name);
    box.querySelector('#r-take').disabled = !first; box.querySelector('#r-build').disabled = !first;
    box.querySelector('#r-take').addEventListener('click', () => { if (!first) return; S.mol = first.mol; S.rid = null; S.res = null; paintSub(); q('.rx-right').innerHTML = placeholder(); app.setMol(entry(S.mol)); });
    box.querySelector('#r-build').addEventListener('click', () => first && app.go('build', { mol: first.mol }));
    box.querySelector('#r-quiz').addEventListener('click', () => app.go('quiz', { mode: 'react' }));
  }
  const placeholder = () => `<div class="panel rx-empty"><p class="lbl">예측 결과</p><p>왼쪽에서 시약을 누르면 생성물이 여기에 나타납니다.</p><p class="hint">밝게 표시된 시약이 이 기질과 반응할 수 있는 것입니다. 흐린 시약을 눌러도 왜 반응하지 않는지 알려 줍니다.</p></div>`;

  root.addEventListener('click', e => {
    const c = e.target.closest('[data-cat]'); if (c) { S.cat = c.dataset.cat; paintSub(); return; }
    const r = e.target.closest('[data-rid]'); if (r) { run(r.dataset.rid); if (innerWidth < 900) q('.rx-right').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const s = e.target.closest('[data-smi]'); if (s) { S.mol = fromSmiles(s.dataset.smi); S.res = null; S.rid = null; paintSub(); q('.rx-right').innerHTML = placeholder(); app.setMol(entry(S.mol)); }
  });
  q('#r-from').addEventListener('click', () => {
    const b = store.get('build2', null);
    if (!b) return;
    S.mol = unpack(b.mol); S.res = null; S.rid = null; S.cat = null; paintSub(); q('.rx-right').innerHTML = placeholder(); app.setMol(entry(S.mol));
  });
  q('#r-edit').addEventListener('click', () => app.go('build', { mol: S.mol }));
  const off = onLang(() => { paintSub(); if (S.res) paintResult(); });
  paintSub();
  if (S.rid) run(S.rid); else { q('.rx-right').innerHTML = placeholder(); app.setMol(subEntry.res ? subEntry : entry(S.mol)); }
  return { unmount() { off(); } };
}
