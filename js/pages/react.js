/* 반응 예측: 기질을 고르고 시약을 누르면 주 · 부생성물을 그리고,
   과정 · 선택성 · 입체 · 최신 연구는 탭으로 골라 본다 (고른 탭은 기억) */
import { CATS, REACTIONS, predict, applicable } from '../chem/reactions.js';
import { fromSmiles } from '../chem/edit.js';
import { makeMol, toSmiles } from '../chem/core.js';
import { drawMolecule } from '../draw.js';
import { entry, tokensHTML, esc, store, getLang, onLang, tabsHTML } from '../ui.js';
import { commonName } from '../chem/common.js';
import { defineMissing } from '../chem/stereo.js';
import { rsCardHTML } from '../rsview.js';

export const EXAMPLES = {
  sn: [['C[C@@H](Br)CC', '(R)-2-브로모뷰테인'], ['CC(C)(C)Br', 'tert-뷰틸 브로마이드'], ['CCCBr', '1-브로모프로페인'], ['CC(C)C(C)Br', '자리옮김이 되는 2차'], ['BrCc1ccccc1', '벤질 브로마이드'],
    ['C[C@H](Br)[C@@H](C)CC', '2-브로모-3-메틸펜테인 (안티 E2)'], ['C[C@@H]1CCCC[C@H]1Br', 'trans-1-브로모-2-메틸사이클로헥세인'], ['CC(C)[C@@H]1CC[C@@H](C)C[C@H]1Cl', '멘틸 클로라이드'], ['CC(C)[C@@H]1CC[C@@H](C)C[C@@H]1Cl', '네오멘틸 클로라이드']],
  alc: [['C[C@@H](O)CC', '(R)-뷰탄-2-올'], ['CCCO', '프로판-1-올'], ['CC(C)(C)O', 'tert-뷰탄올'], ['OC1CCCCC1', '사이클로헥산올'], ['CC(C)C(C)O', '3-메틸뷰탄-2-올'],
    ['CC1CO1', '2-메틸옥시레인 (에폭사이드)'], ['CC1(C)CO1', '2,2-다이메틸옥시레인'], ['C[C@@H]1O[C@@H]1C', 'cis-2,3-다이메틸옥시레인'], ['COc1ccccc1', '아니솔 (에터)'], ['CC(C)(C)OC', 'tert-뷰틸 메틸 에터']],
  ene: [['CC=C', '프로펜'], ['CC(C)=CC', '2-메틸뷰트-2-엔'], ['C1=CCCCC1', '사이클로헥센'], ['CC(C)(C)C=C', '3,3-다이메틸뷰트-1-엔'], ['C/C=C/C', '(E)-뷰트-2-엔'], ['C/C=C\\C', '(Z)-뷰트-2-엔'], ['CC1=CCCCC1', '1-메틸사이클로헥센']],
  yne: [['CCC#C', '뷰트-1-아인'], ['CC#CC', '뷰트-2-아인'], ['C#Cc1ccccc1', '페닐아세틸렌']],
  co: [['CCC=O', '프로판알'], ['CC(=O)c1ccccc1', '아세토페논'], ['O=C1CCCCC1', '사이클로헥산온'], ['CC(=O)C(C)(C)C', '피나콜론 (바이어–빌리거)'], ['CC=CC(C)=O', '펜트-3-엔-2-온 (짝 첨가)'], ['CCOC(C)=O', '아세트산 에틸'], ['CCC#N', '프로페인나이트릴'], ['OCCC(C)=O', 'OH 가 있는 케톤']],
  acyl: [['CC(=O)O', '아세트산'], ['CC(=O)Cl', '아세틸 클로라이드'], ['CCOC(=O)c1ccccc1', '벤조산 에틸'], ['CC(N)=O', '아세트아마이드'], ['CCC#N', '프로페인나이트릴']],
  alpha: [['CC(=O)CC', '뷰탄-2-온'], ['CC(C)C(C)=O', '3-메틸뷰탄-2-온'], ['CC(=O)c1ccccc1', '아세토페논 (할로폼)'], ['CC=O', '아세트알데하이드'], ['CCC=O', '프로판알'], ['CCOC(C)=O', '아세트산 에틸'], ['O=C1CCCCC1', '사이클로헥산온']],
  aro: [['c1ccccc1', '벤젠'], ['Cc1ccccc1', '톨루엔'], ['COc1ccccc1', '아니솔'], ['[O-][N+](=O)c1ccccc1', '나이트로벤젠'], ['Nc1ccccc1', '아닐린'], ['CC(=O)Nc1ccccc1', '아세트아닐라이드'], ['Cc1ccc(C)cc1', 'p-자일렌'],
    ['Clc1ccc(cc1)[N+](=O)[O-]', '4-클로로나이트로벤젠 (SNAr)'], ['Cc1ccc(Cl)cc1', '4-클로로톨루엔 (벤자인)'], ['Nc1ccc(C)cc1', 'p-톨루이딘 (다이아조늄)']],
  rad: [['CCC', '프로페인'], ['CC(C)C', '아이소뷰테인'], ['CCCC', '뷰테인'], ['CC(C)CC', '2-메틸뷰테인'], ['C1CCCCC1', '사이클로헥세인']],
  cc: [['C=CC=C', '뷰타-1,3-다이엔'], ['C=CC(C)=C', '아이소프렌'], ['Brc1ccccc1', '브로모벤젠'], ['C=CCCCC=C', '헵타-1,6-다이엔'], ['C=CCCC', '펜트-1-엔']]
};
const ROLE = { major: '주생성물', minor: '부생성물', side: '함께 생김' };
const pack = m => ({ a: m.atoms.map(x => [x.el, x.h, x.q || 0, +x.x.toFixed(3), +x.y.toFixed(3), x.chi ? [...x.chi.n, x.chi.s] : 0]), b: m.bonds.map(x => [x.a, x.b, x.o, x.arom ? 1 : 0]) });
const unpack = p => makeMol(p.a.map(([el, h, q, x, y, c]) => Object.assign({ el, h, q, x, y }, c ? { chi: { n: c.slice(0, 4), s: c[4] } } : {})), p.b.map(([a, b, o, ar]) => ({ a, b, o, arom: !!ar })));
/* 기질의 입체중심은 늘 배열을 정해 둔다 (SN2 반전 · SN1 라세미가 보이도록) */
const sub0 = m => defineMissing(m);

export function mount(root, app, params) {
  const saved = store.get('react', null);
  let mol;
  try { mol = sub0(params && params.mol ? params.mol : params && params.smiles ? fromSmiles(params.smiles) : saved ? unpack(saved.mol) : fromSmiles('C[C@@H](Br)CC')); }
  catch { mol = sub0(fromSmiles('C[C@@H](Br)CC')); }
  const S = { mol, cat: (params && params.cat) || (saved && saved.cat) || null, rid: (params && params.rid) || null, res: null };
  const mode = () => store.get('drawMode', 'atoms');

  root.innerHTML = `<section class="page react">
    <div class="pg-head">
      <div><p class="eyebrow"><span class="bar"></span>02 — REACTIONS</p><h1 class="title">REACTIONS<small>반응 예측</small></h1></div>
      <p class="lead" style="margin:0;max-width:62ch">기질을 고르고 시약을 누르세요. 스미스 · 브루스 유기화학의 반응 규칙으로 주생성물 · 부생성물과 입체(R/S · cis/trans · E/Z)까지 예측하고, 왜 그렇게 되는지와 반응마다 최신 연구로 바뀐 이해를 함께 보여 줍니다.</p>
    </div>
    <div class="rx-grid">
      <div class="rx-left">
        <div class="panel ticks rx-sub">
          <p class="lbl">기질</p>
          <div class="rx-subsvg"></div>
          <p class="rx-subname"></p>
          <div class="tools-row"><button class="btn" type="button" id="r-from">분자 조립에서 가져오기</button><button class="btn" type="button" id="r-edit">조립에서 고치기</button></div>
          <details class="rx-ex-box"${store.get('rxExOpen', true) ? ' open' : ''}><summary class="lbl">예시 기질</summary><div class="rx-ex"></div></details>
        </div>
        <div class="panel rx-reag">
          <div class="rx-cats" role="tablist" aria-label="반응 종류">${CATS.map(c => `<button type="button" role="tab" data-cat="${c.id}"><b>${c.ko}</b><small>${c.sub}</small></button>`).join('')}</div>
          <div class="rx-list" role="list"></div>
        </div>
      </div>
      <div class="rx-right" aria-live="polite"></div>
    </div>
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
    q('.rx-ex-box > summary').textContent = `예시 기질 · ${CATS.find(c => c.id === cat).ko}`;
    q('.rx-ex').innerHTML = `<div class="ex-chips">${(EXAMPLES[cat] || []).map(([s, k]) => `<button type="button" data-smi="${esc(s)}">${esc(k)}</button>`).join('')}</div>`;
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
        <figcaption>${p.name ? `<span class="mono">${tokensHTML(ko ? p.name.ko : p.name.en)}</span><small>${esc(nm2(p))}${common ? ' · ' + esc(ko ? common.ko : common.en) : ''}</small>` : `<span class="muted">${esc(p.err || '')}</span>`}${p.tag ? `<em>${esc(p.tag)}</em>` : ''}${p.stereoTag ? `<em class="st">${esc(p.stereoTag)}${p.mirrorName ? ' · ' + esc(ko ? p.mirrorName.ko : p.mirrorName.en) : ''}</em>` : ''}</figcaption>
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
      ${tabsHTML('react', [
        res.steps && res.steps.length && { id: 'steps', label: '어떻게 일어나나', html: `<div class="panel"><ol class="steps">${res.steps.map(s => `<li><div><span class="sk">${esc(s.t)}</span>${s.d}${s.mol ? `<div class="step-mol">${drawMolecule(s.mol, null, { mode: mode(), locants: false, chain: false, compact: true })}</div>` : ''}</div></li>`).join('')}</ol></div>` },
        (res.select && res.select.length || res.stereoLine) && { id: 'select', label: '선택성 · 근거', n: (res.select || []).length + (res.stereoLine ? 1 : 0), html: `<div class="changes"><ul>${res.stereoLine ? `<li><b>R/S: ${esc(res.stereoLine)}</b></li>` : ''}${(res.select || []).map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>` },
        { id: 'stereo', label: '입체', html: rsBlock(rsProd = major.find(p => p.name && ((p.name.rs && p.name.rs.size) || (p.name.pseudo && p.name.pseudo.size)))) },
        res.modern && res.modern.length && { id: 'modern', label: '최신 연구', n: res.modern.length, html: `<div class="modern panel">${res.modern.map(m => `<p><span class="ty">${esc(m.y)}</span>${esc(m.t)}</p>`).join('')}</div>` }
      ], 'steps')}
      <div class="tools-row"><button class="btn" type="button" id="r-take">주생성물을 새 기질로</button><button class="btn" type="button" id="r-build">주생성물을 분자 조립에서</button><button class="btn" type="button" id="r-quiz">반응 퀴즈</button></div>`;
    const first = major.find(p => p.name);
    box.querySelector('#r-take').disabled = !first; box.querySelector('#r-build').disabled = !first;
    box.querySelector('#r-take').addEventListener('click', () => { if (!first) return; S.mol = sub0(first.mol); S.rid = null; S.res = null; paintSub(); q('.rx-right').innerHTML = placeholder(); app.setMol(entry(S.mol)); });
    box.querySelector('#r-build').addEventListener('click', () => first && app.go('build', { mol: first.mol }));
    box.querySelector('#r-quiz').addEventListener('click', () => app.go('quiz', { mode: 'react', cat: S.cat }));
  }
  /* 주생성물의 R/S 풀이 (입체중심이 있을 때) */
  let rsProd = null;
  const rsBlock = (p, sel) => p ? rsCardHTML(p.mol, p.name, { ko: getLang() === 'ko', racemic: true, sel }).replace('입체중심 R/S · CIP 순위 규칙', '주생성물의 R/S · CIP 순위') : '';
  const placeholder = () => `<div class="panel rx-empty"><p class="lbl">예측 결과</p><p>왼쪽에서 시약을 누르면 생성물이 여기에 나타납니다.</p><p class="hint">밝게 표시된 시약이 이 기질과 반응할 수 있는 것입니다. 흐린 시약을 눌러도 왜 반응하지 않는지 알려 줍니다.</p></div>`;

  q('.rx-ex-box').addEventListener('toggle', e => store.set('rxExOpen', e.currentTarget.open));
  root.addEventListener('click', e => {
    const t = e.target.closest('.rs-card [data-cip]');
    if (t && rsProd) { t.closest('.rs-card').outerHTML = rsBlock(rsProd, +t.dataset.cip); return; }
    const c = e.target.closest('[data-cat]'); if (c) { S.cat = c.dataset.cat; paintSub(); return; }
    const r = e.target.closest('[data-rid]'); if (r) { run(r.dataset.rid); if (innerWidth < 900) q('.rx-right').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const s = e.target.closest('[data-smi]'); if (s) { S.mol = sub0(fromSmiles(s.dataset.smi)); S.res = null; S.rid = null; paintSub(); q('.rx-right').innerHTML = placeholder(); app.setMol(entry(S.mol)); }
  });
  q('#r-from').addEventListener('click', () => {
    const b = store.get('build2', null);
    if (!b) return;
    S.mol = sub0(unpack(b.mol)); S.res = null; S.rid = null; S.cat = null; paintSub(); q('.rx-right').innerHTML = placeholder(); app.setMol(entry(S.mol));
  });
  q('#r-edit').addEventListener('click', () => app.go('build', { mol: S.mol }));
  const off = onLang(() => { paintSub(); if (S.res) paintResult(); });
  paintSub();
  if (S.rid) run(S.rid); else { q('.rx-right').innerHTML = placeholder(); app.setMol(subEntry.res ? subEntry : entry(S.mol)); }
  return {
    unmount() { off(); },
    report: () => ({
      '기질 SMILES': toSmiles(S.mol), '기질 이름': subEntry && subEntry.res ? subEntry.res.nameEn : subEntry && subEntry.err,
      '반응': S.rid ? `${S.rid} (${((REACTIONS.find(x => x.id === S.rid) || {}).label || '').replace(/<[^>]+>/g, '')})` : '(고르지 않음)',
      '결과': S.res ? (S.res.ok ? S.res.products.map(p => `${p.role}${p.pct ? ' ' + p.pct + '%' : ''}: ${p.name ? p.name.nameEn : p.err || ''} [${toSmiles(p.mol)}]`).join(' / ') : '반응 없음 — ' + (S.res.reason || '')) : ''
    })
  };
}
