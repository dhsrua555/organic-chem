/* 분광 분석: 구조식에서 IR 스펙트럼과 질량 스펙트럼을 예측하고, 흡수 띠 · 피크마다 어느 결합 · 원자에서 나오는지 보여 준다.
   IR · 질량 스펙트럼 · 상관표는 탭으로 골라 본다 (고른 탭은 기억). 표의 줄 · 그림의 번호 · 막대를 가리키면 구조식에서 해당 원자를 강조하고,
   누르면 강조를 고정한다 */
import { fromSmiles } from '../chem/edit.js';
import { makeMol, toSmiles } from '../chem/core.js';
import { irBands, irChecks, massSpec, isoPattern, IR_TABLE, MS_LOSSES, MS_IONS, STR_KO } from '../chem/spectra.js';
import { irSVG, msSVG, irTableHTML, msTableHTML } from '../specview.js';
import { drawMolecule } from '../draw.js';
import { entry, esc, store, getLang, onLang, tabsHTML, drawMode, formulaHTML, tokensHTML } from '../ui.js';

/* 예시 화합물 (분류별) */
export const SPEC_EX = [
  ['알케인 · 알켄 · 알카인', [['CCCCCC', '헥세인'], ['CC(C)CCC', '2-메틸펜테인'], ['C1CCCCC1', '사이클로헥세인'], ['C=CCCCC', '헥스-1-엔'], ['C/C=C/CC', '(E)-펜트-2-엔'], ['C1=CCCCC1', '사이클로헥센'], ['C#CCCCC', '헥스-1-아인'], ['CCC#CCC', '헥스-3-아인']]],
  ['방향족 탄화수소', [['Cc1ccccc1', '톨루엔'], ['CCc1ccccc1', '에틸벤젠'], ['Cc1ccccc1C', 'o-자일렌'], ['Cc1ccc(C)cc1', 'p-자일렌']]],
  ['할로젠화물', [['CCCBr', '1-브로모프로페인'], ['CC(C)Cl', '2-클로로프로페인'], ['CCCCCl', '1-클로로뷰테인'], ['Brc1ccccc1', '브로모벤젠']]],
  ['알코올 · 페놀 · 에터', [['CCCCO', '뷰탄-1-올'], ['CCC(C)O', '뷰탄-2-올'], ['CC(C)(C)O', '2-메틸프로판-2-올'], ['OC1CCCCC1', '사이클로헥산올'], ['Oc1ccccc1', '페놀'], ['CCOCC', '다이에틸 에터'], ['COc1ccccc1', '아니솔'], ['CC(C)(C)OC', 'tert-뷰틸 메틸 에터']]],
  ['아민 · 나이트로 화합물', [['CCCCN', '뷰탄-1-아민'], ['CCNCC', '다이에틸아민'], ['Nc1ccccc1', '아닐린'], ['[O-][N+](=O)c1ccccc1', '나이트로벤젠']]],
  ['알데하이드 · 케톤', [['CCCC=O', '뷰탄알'], ['O=Cc1ccccc1', '벤즈알데하이드'], ['CCC(C)=O', '뷰탄-2-온'], ['CCCCC(C)=O', '헥산-2-온'], ['O=C1CCCCC1', '사이클로헥산온'], ['O=C1CCCC1', '사이클로펜탄온'], ['CC(=O)c1ccccc1', '아세토페논'], ['CC=CC(C)=O', '펜트-3-엔-2-온']]],
  ['카복실산과 유도체', [['CCC(=O)O', '프로판산'], ['CCCC(=O)O', '뷰탄산'], ['OC(=O)c1ccccc1', '벤조산'], ['CCOC(C)=O', '아세트산 에틸'], ['CCCC(=O)OC', '뷰탄산 메틸'], ['COC(=O)c1ccccc1', '벤조산 메틸'], ['CC(N)=O', '아세트아마이드'], ['CCCC(N)=O', '뷰탄아마이드'], ['CC(Cl)=O', '아세틸 클로라이드']]],
  ['나이트릴', [['CCC#N', '프로페인나이트릴'], ['N#Cc1ccccc1', '벤조나이트릴']]]
];
const pack = m => ({ a: m.atoms.map(x => [x.el, x.h, x.q || 0, +x.x.toFixed(3), +x.y.toFixed(3), x.chi ? [...x.chi.n, x.chi.s] : 0]), b: m.bonds.map(x => [x.a, x.b, x.o, x.arom ? 1 : 0]) });
const unpack = p => makeMol(p.a.map(([el, h, q, x, y, c]) => Object.assign({ el, h, q, x, y }, c ? { chi: { n: c.slice(0, 4), s: c[4] } } : {})), p.b.map(([a, b, o, ar]) => ({ a, b, o, arom: !!ar })));
const pct = v => v < 1 ? v.toFixed(1) : v < 10 ? v.toFixed(1) : Math.round(v);

export function mount(root, app, params) {
  const saved = store.get('spectra', null);
  let mol;
  try { mol = params && params.mol ? params.mol : params && params.smiles ? fromSmiles(params.smiles) : saved ? unpack(saved.mol) : fromSmiles('CCCCC(C)=O'); }
  catch { mol = fromSmiles('CCCCC(C)=O'); }
  const S = { mol, e: null, ir: null, ms: null, pin: null, err: '' };
  const nEx = SPEC_EX.reduce((s, [, l]) => s + l.length, 0);

  root.innerHTML = `<section class="page spectra">
    <div class="pg-head">
      <div><p class="eyebrow"><span class="bar"></span>05 — SPECTRA</p><h1 class="title">SPECTRA<small>분광 분석</small></h1></div>
      <p class="lead" style="margin:0;max-width:62ch">구조식에서 적외선(IR) 스펙트럼과 전자 이온화 질량 스펙트럼(EI-MS)을 예측합니다. 흡수 띠나 피크를 선택하면 그 흡수 · 이온을 만드는 결합과 원자가 구조식에 강조되고, 흡수 상관표와 개열 규칙에 따른 귀속을 제시합니다.</p>
    </div>
    <div class="sp-grid">
      <div class="sp-left">
        <div class="panel ticks sp-mol">
          <p class="lbl">화합물</p>
          <div class="sp-svg"></div>
          <p class="sp-name"></p>
          <dl class="sp-facts"></dl>
          <div class="tools-row"><button class="btn" type="button" id="s-from">편집기의 구조 가져오기</button><button class="btn" type="button" id="s-edit">편집기에서 수정</button></div>
          <label class="lbl fam-lbl" for="s-ex">예시 화합물</label>
          <select id="s-ex" class="fam-select"><option value="">화합물 선택 (${nEx}종)</option>${SPEC_EX.map(([g, l]) => `<optgroup label="${esc(g)}">${l.map(([s, k]) => `<option value="${esc(s)}">${esc(k)}</option>`).join('')}</optgroup>`).join('')}</select>
          <p class="hint sp-pin-hint">흡수 띠 번호 · 피크 막대 · 표의 줄을 가리키면 해당 원자가 초록색으로 강조됩니다. 누르면 강조가 고정됩니다.</p>
        </div>
        <button class="btn solid sp-quiz" type="button" id="s-quiz">분광학 연습 문제 →</button>
      </div>
      <div class="sp-right" aria-live="polite"></div>
    </div>
  </section>`;
  const q = s => root.querySelector(s);

  function compute() {
    S.e = entry(S.mol);
    S.pin = null;
    try { S.ir = irBands(S.mol); S.ms = massSpec(S.mol); S.err = ''; }
    catch (e) { S.ir = null; S.ms = null; S.err = e.message || String(e); }
    store.set('spectra', { mol: pack(S.mol) });
  }
  /* 강조할 원자: 흡수 띠 번호 또는 m/z */
  const atomsOf = key => {
    if (!key) return new Set();
    if (key.kind === 'band') return new Set((S.ir[key.i] || { atoms: [] }).atoms);
    const p = S.ms.peaks.find(x => x.mz === key.mz);
    const own = S.ms.ions.filter(f => f.mz === key.mz);
    return new Set(own.length ? own.flatMap(f => f.atoms) : p ? p.main.f.atoms : []);
  };
  function paintMol(key) {
    const r = S.e.res, ko = getLang() === 'ko';
    const lite = r ? { ...r, principalAtoms: new Set() } : null;
    q('.sp-svg').innerHTML = drawMolecule(S.mol, lite, { mode: drawMode(), locants: false, chain: false, hl: atomsOf(key), hlDots: true, compact: true });
    const cm = S.e.common;
    q('.sp-name').innerHTML = r ? `<span class="mono">${tokensHTML(ko ? r.ko : r.en)}</span><small>${esc(ko ? r.nameEn : r.nameKo)}${cm ? ' · ' + esc(ko ? cm.ko : cm.en) : ''}</small>` : `<span class="muted">${esc(S.e.err || '이름을 붙일 수 없는 구조')}</span>`;
    /* 그림 · 표의 강조 표시 */
    root.querySelectorAll('.sp-right .on').forEach(x => x.classList.remove('on'));
    if (key && key.kind === 'band') root.querySelectorAll(`.sp-right [data-band="${key.i}"]`).forEach(x => x.classList.add('on'));
    if (key && key.kind === 'mz') root.querySelectorAll(`.sp-right [data-mz="${key.mz}"]`).forEach(x => x.classList.add('on'));
  }
  function paintFacts() {
    const ms = S.ms;
    q('.sp-facts').innerHTML = ms ? `<div><dt>분자식</dt><dd>${formulaHTML(S.e.f)}</dd></div><div><dt>정수 질량 (M)</dt><dd>${ms.M}</dd></div>
      <div><dt>정밀 질량</dt><dd>${ms.exact.toFixed(4)}</dd></div><div><dt>불포화도</dt><dd>${ms.ihd}</dd></div>` : '';
  }
  function paintRight() {
    const box = q('.sp-right');
    if (!S.ir) { box.innerHTML = `<div class="panel rx-empty"><p class="lbl">예측할 수 없음</p><p>${esc(S.err)}</p></div>`; return; }
    const ir = S.ir, ms = S.ms, checks = irChecks(ir);
    const nC = S.e.f.count.C || 0;
    const odd = ms.M % 2 === 1;
    const iso = isoPattern(ms);
    const irHTML = `<div class="panel ticks sp-chart"><div class="sp-chart-top"><p class="lbl">IR 스펙트럼 (예측 모식도)</p><span class="sp-legend"><i class="lg-diag"></i>진단 흡수 <i class="lg-minor"></i>보조 흡수</span></div>
        <div class="chart-wrap">${irSVG(ir, { title: `${S.e.res ? S.e.res.nameEn : ''} IR 스펙트럼` })}</div>
        <p class="hint">흡수 상관표의 특성 흡수로 그린 예측으로, 실측 스펙트럼과 세기 · 폭이 다를 수 있습니다. 지문 영역(1500 cm⁻¹ 이하)에는 실제로 훨씬 많은 흡수 띠가 겹쳐 분자마다 고유한 무늬를 이룹니다.</p></div>
      <div class="panel sp-checks"><p class="lbl">작용기 영역 판독 순서</p><ul class="ir-checks">${checks.map(c => `<li class="${c.ok ? 'yes' : 'no'}"><span class="ck">${c.ok ? '있음' : '없음'}</span><b>${c.q}</b><small>${esc(c.say)}</small></li>`).join('')}</ul></div>
      <div class="panel sp-list"><p class="lbl">흡수 띠 귀속</p>${irTableHTML(ir)}</div>`;
    const msHTML = `<div class="panel ticks sp-chart"><div class="sp-chart-top"><p class="lbl">질량 스펙트럼 (EI, 예측 모식도)</p><span class="sp-legend"><i class="lg-m"></i>분자 이온 <i class="lg-base"></i>기준 피크 <i class="lg-iso"></i>동위원소</span></div>
        <div class="chart-wrap">${msSVG(ms, { title: `${S.e.res ? S.e.res.nameEn : ''} 질량 스펙트럼` })}</div>
        <p class="hint">교과서의 개열 규칙으로 계산한 주요 이온이며, 상대 세기는 경향을 보여 주는 추정값입니다. 동위원소 피크는 자연 존재비로 계산했습니다.</p></div>
      <div class="panel sp-msf">
        <div class="ms-facts">
          <span><em>분자 이온 M⁺•</em>m/z ${ms.M} · ${pct(ms.mRel)}%</span><span><em>기준 피크</em>m/z ${ms.base.mz}</span>
          <span><em>M+1</em>${ms.m1.toFixed(1)}%</span><span><em>M+2</em>${ms.m2.toFixed(1)}%</span><span><em>불포화도</em>${ms.ihd}</span></div>
        <div class="notes">
          ${ms.mRel < 5 ? `<p class="note warn"><b>분자 이온이 약합니다 (${pct(ms.mRel)}%).</b> 3차 알코올 · 가지 친 알케인처럼 쉽게 조각나는 분자는 M⁺• 가 거의 보이지 않아, 가장 큰 m/z 의 피크가 분자량이 아닐 수 있습니다.</p>` : ''}
          ${iso ? `<p class="note"><b>${esc(iso)}</b></p>` : ''}
          <p class="note"><b>질소 규칙</b> — M⁺• 의 m/z ${ms.M} 이 ${odd ? '홀수이므로 질소 원자가 홀수 개' : '짝수이므로 질소 원자가 없거나 짝수 개'} 입니다 (이 분자는 N ${ms.nN}개).</p>
          <p class="note"><b>M+1 피크</b> — 주로 ¹³C (자연 존재비 1.1%) 때문입니다. 탄소 ${nC}개 × 1.1% ≈ ${(nC * 1.1).toFixed(1)}% 로, 반대로 M+1 / M 비에서 탄소 수를 어림할 수 있습니다.</p>
          ${ms.ringSkip ? '<p class="note">고리 안의 결합 하나가 끊어지면 질량이 변하지 않아, 고리를 여는 여러 단계의 개열은 예측에서 생략했습니다.</p>' : ''}
        </div></div>
      <div class="panel sp-list"><p class="lbl">주요 이온 귀속</p>${msTableHTML(ms)}</div>
      ${ms.alts.length > 1 ? `<div class="panel sp-list"><p class="lbl">고분해능 질량 분석 (HRMS) — 정수 질량 ${ms.M} 의 분자식 후보</p>
        <div class="tbl-wrap"><table class="tbl sp-tbl"><thead><tr><th>분자식</th><th>정밀 질량</th><th>불포화도</th></tr></thead><tbody>${ms.alts.map(a => `<tr${a.self ? ' class="self"' : ''}><td class="m">${a.f}${a.self ? ' <small>이 화합물</small>' : ''}</td><td class="m">${a.exact.toFixed(4)}</td><td class="m">${a.ihd}</td></tr>`).join('')}</tbody></table></div>
        <p class="hint">정수 질량이 같아도 ¹H 1.0078 · ¹⁶O 15.9949 · ¹⁴N 14.0031 처럼 원자의 정밀 질량이 달라, 소수점 넷째 자리까지 재면 분자식을 하나로 정할 수 있습니다.</p></div>` : ''}`;
    const refHTML = `<div class="panel sp-list"><p class="lbl">IR 흡수 상관표</p>
        <div class="tbl-wrap"><table class="tbl sp-tbl"><thead><tr><th>진동</th><th>작용기</th><th>파수 cm⁻¹</th><th>세기 · 모양</th></tr></thead><tbody>${IR_TABLE.map(t => `<tr><td>${esc(t.bond)}${t.note ? `<small>${esc(t.note)}</small>` : ''}</td><td>${esc(t.grp)}</td><td class="m">${t.range[0]}–${t.range[1]}</td><td>${STR_KO[t.str]}${t.shape ? ' · ' + esc(t.shape) : ''}</td></tr>`).join('')}</tbody></table></div>
        <ul class="sel sp-rules"><li>흡수 파수는 결합이 강할수록(삼중 &gt; 이중 &gt; 단일), 원자가 가벼울수록(X–H) 높습니다 — 훅의 법칙 ν̃ ∝ √(k/μ).</li><li>짝지음(공액)된 C=O · C=C 는 이중결합성이 줄어 약 20–30 cm⁻¹ 낮아집니다.</li><li>쌍극자 모멘트가 변하지 않는 진동(대칭 알카인 · 알켄)은 흡수가 거의 없습니다.</li><li>1500 cm⁻¹ 위(작용기 영역)로 작용기를 찾고, 아래(지문 영역)는 같은 화합물인지 확인하는 데 씁니다.</li></ul></div>
      <div class="panel sp-list"><p class="lbl">질량 스펙트럼 읽는 규칙</p>
        <ul class="sel sp-rules"><li><b>분자 이온 M⁺•</b>: 전자 하나를 잃은 라디칼 양이온으로 m/z 가 정수 질량(분자량)과 같습니다.</li><li><b>기준 피크</b>: 가장 센 피크를 100 으로 두고 나머지를 상대 세기로 나타냅니다.</li>
          <li><b>질소 규칙</b>: M 이 홀수이면 질소가 홀수 개입니다.</li><li><b>M+1</b>: ¹³C 때문에 탄소 하나당 약 1.1%.</li><li><b>M+2</b>: 염소 M : M+2 ≈ 3 : 1, 브로민 ≈ 1 : 1.</li>
          <li><b>불포화도</b> = (2C + 2 + N − H − X) ÷ 2 = 고리 수 + π 결합 수.</li><li><b>조각화</b>: 더 안정한 양이온(3차 · 알릴 · 벤질 · 아실륨 · 옥소늄 · 이미늄)과 더 큰 라디칼이 생기는 쪽으로 끊어집니다.</li></ul></div>
      <div class="panel sp-list"><p class="lbl">자주 보이는 중성 조각 손실</p><div class="tbl-wrap"><table class="tbl sp-tbl"><thead><tr><th>피크</th><th>잃은 조각</th><th>예상 구조</th></tr></thead><tbody>${MS_LOSSES.map(r => `<tr><td class="m">${r[0]}</td><td class="m">${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="panel sp-list"><p class="lbl">자주 보이는 조각 이온</p><div class="tbl-wrap"><table class="tbl sp-tbl"><thead><tr><th>m/z</th><th>이온</th><th>기원</th></tr></thead><tbody>${MS_IONS.map(r => `<tr><td class="m">${r[0]}</td><td class="m">${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table></div></div>`;
    box.innerHTML = tabsHTML('spec', [
      { id: 'ir', label: 'IR 스펙트럼', n: ir.length, html: irHTML },
      { id: 'ms', label: '질량 스펙트럼', n: ms.ions.length, html: msHTML },
      { id: 'ref', label: '상관표 · 규칙', html: refHTML }
    ], 'ir');
  }
  function render() {
    paintFacts();
    paintRight();
    paintMol(S.pin);
    if (S.e.res) app.setMol(S.e);
  }

  /* 가리키면 미리 보기, 누르면 고정 */
  const keyOf = el => el.dataset.band !== undefined ? { kind: 'band', i: +el.dataset.band } : { kind: 'mz', mz: +el.dataset.mz };
  const same = (a, b) => a && b && a.kind === b.kind && (a.kind === 'band' ? a.i === b.i : a.mz === b.mz);
  let hover = null;
  const target = e => e.target.closest && e.target.closest('.sp-right [data-band], .sp-right [data-mz]');
  root.addEventListener('mouseover', e => { const t = target(e); const k = t ? keyOf(t) : null; if (same(k, hover) || (!k && !hover)) return; hover = k; paintMol(k || S.pin); });
  root.addEventListener('focusin', e => { const t = target(e); if (t) { hover = keyOf(t); paintMol(hover); } });
  root.addEventListener('click', e => {
    const t = target(e);
    if (t) { const k = keyOf(t); S.pin = same(k, S.pin) ? null : k; hover = null; paintMol(S.pin || k); return; }
  });
  root.addEventListener('keydown', e => { const t = target(e); if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); t.click(); } });
  root.addEventListener('tabchange', () => { S.pin = null; hover = null; paintMol(null); });

  const load = m => { S.mol = m; compute(); render(); };
  q('#s-ex').addEventListener('change', e => { const smi = e.target.value; if (!smi) return; load(fromSmiles(smi)); e.target.value = ''; });
  q('#s-from').addEventListener('click', () => { const b = store.get('build2', null); if (b) load(unpack(b.mol)); });
  q('#s-edit').addEventListener('click', () => app.go('build', { mol: S.mol }));
  q('#s-quiz').addEventListener('click', () => app.go('quiz', { mode: 'spec' }));
  const off = onLang(() => paintMol(S.pin));
  compute(); render();
  return {
    unmount() { off(); },
    report: () => ({ '분자 SMILES': toSmiles(S.mol), '이름': S.e && S.e.res ? S.e.res.nameEn : S.e && S.e.err, '탭': store.get('tab:spec', 'ir'), '기준 피크': S.ms ? S.ms.base.mz : S.err })
  };
}
