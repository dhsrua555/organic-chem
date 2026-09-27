/* 스펙트럼 그림 (SVG): IR 투과율 곡선과 질량 스펙트럼 막대. 분광 페이지와 연습 문제가 함께 쓴다 */
import { irCurve, irT, STR_KO, PROC, IR_TABLE, MS_LOSSES, MS_IONS, tableIds } from './chem/spectra.js';
import { tabsHTML } from './ui.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const r1 = v => Math.round(v * 10) / 10;
/* 휴대폰: 가로로 밀지 않고 한눈에 보이도록 좁은 그림 (글자는 CSS 에서 키움) */
const dims = o => { const W = o.w || (typeof innerWidth === 'number' && innerWidth < 640 ? 440 : 760); return { W, L: W < 600 ? 40 : 50, RR: W - 14, narrow: W < 600 }; };

/* IR: opts.marks(번호 표시) · opts.sel(강조할 흡수 띠 번호) · opts.title */
export function irSVG(bands, opts = {}) {
  const { W, L, RR, narrow } = dims(opts);
  const T = narrow ? 74 : 58, B = narrow ? 278 : 262, H = B - T, HT = B + 56;
  const x = nu => L + (4000 - nu) / 3600 * (RR - L), y = t => T + (1 - t / 100) * H;
  const regs = [[4000, 2500, 'X–H 신축'], [2500, 2000, '삼중결합'], [2000, 1500, '이중결합'], [1500, 400, '지문 영역']];
  let s = `<svg class="chart ir${narrow ? ' narrow' : ''}" viewBox="0 0 ${W} ${HT}" role="img" aria-label="${esc(opts.title || 'IR 스펙트럼')}">`;
  regs.forEach(([a, b, t], i) => {
    s += `<rect class="ch-reg r${i}" x="${r1(x(a))}" y="${T}" width="${r1(x(b) - x(a))}" height="${H}"/>`;
    s += `<text class="ch-rt" x="${r1((x(a) + x(b)) / 2)}" y="16" text-anchor="middle">${t}</text>`;
  });
  s += `<line class="ch-fg" x1="${r1(x(1500))}" y1="${T - 6}" x2="${r1(x(1500))}" y2="${B}"/>`;
  for (const t of [0, 50, 100]) s += `<line class="ch-grid" x1="${L}" y1="${r1(y(t))}" x2="${RR}" y2="${r1(y(t))}"/><text class="ch-t" x="${L - 7}" y="${r1(y(t) + 4)}" text-anchor="end">${t}</text>`;
  for (let nu = 4000; nu >= 500; nu -= 500) s += `<line class="ch-tick" x1="${r1(x(nu))}" y1="${B}" x2="${r1(x(nu))}" y2="${B + 5}"/><text class="ch-t" x="${r1(x(nu))}" y="${B + 19}" text-anchor="middle">${nu}</text>`;
  s += `<text class="ch-ax" x="${(L + RR) / 2}" y="${HT - 8}" text-anchor="middle">파수 (cm⁻¹)</text><text class="ch-ax" transform="translate(12 ${(T + B) / 2}) rotate(-90)" text-anchor="middle">투과율 (%)</text>`;
  const pts = irCurve(bands).map(([nu, t]) => `${r1(x(nu))},${r1(y(t))}`);
  s += `<path class="ch-area" d="M${r1(x(4000))},${T} L${pts.join(' L')} L${r1(x(400))},${T} Z"/><polyline class="ch-line" points="${pts.join(' ')}"/>`;
  s += `<line class="ch-frame" x1="${L}" y1="${B}" x2="${RR}" y2="${B}"/><line class="ch-frame" x1="${L}" y1="${T}" x2="${L}" y2="${B}"/>`;
  if (opts.marks !== false) {
    const rows = narrow ? [28, 44, 60] : [28, 44], last = rows.map(() => -99);
    const order = bands.map((b, i) => i).sort((p, q) => x(bands[p].nu) - x(bands[q].nu));
    for (const i of order) {
      const b = bands[i], px = x(b.nu), dip = y(irT(bands, b.nu));
      let row = last.findIndex(v => px - v >= 19);
      if (row < 0) row = last.indexOf(Math.min(...last));
      last[row] = px;
      const my = rows[row];
      s += `<g class="ir-mk${opts.sel === i ? ' on' : ''}${b.diag ? '' : ' minor'}" data-band="${i}" tabindex="0" role="button" aria-label="${i + 1}번 흡수 띠 ${b.nu} cm⁻¹ ${esc(b.vib)} (${esc(b.grp)})">`
        + (opts.tips === false ? '' : `<title>${i + 1}. ${b.nu} cm⁻¹ · ${esc(b.vib)} · ${esc(b.grp)}</title>`)
        + `<line x1="${r1(px)}" y1="${my + 8}" x2="${r1(px)}" y2="${r1(Math.max(my + 8, dip - 3))}"/><circle cx="${r1(px)}" cy="${my}" r="8.5"/><text x="${r1(px)}" y="${my + 3.8}" text-anchor="middle">${i + 1}</text></g>`;
    }
  }
  return s + '</svg>';
}

/* 질량 스펙트럼: opts.mark(물음표로 표시할 m/z) · opts.sel(강조) · opts.tags(M⁺• · 기준 피크 글자) · opts.tips(마우스 설명) */
export function msSVG(ms, opts = {}) {
  const { W, L, RR, narrow } = dims(opts);
  const T = 34, B = 252, H = B - T;
  const show = ms.peaks.filter(p => p.rel >= 0.4);
  const minMz = Math.min(...show.map(p => p.mz));
  let lo = Math.max(0, Math.floor((minMz - 6) / 10) * 10), hi = Math.ceil((ms.M + 6) / 10) * 10;
  if (hi - lo < 50) lo = Math.max(0, hi - 50);
  const x = z => L + 8 + (z - lo) / (hi - lo) * (RR - L - 16), y = r => B - r / 100 * H;
  const bw = Math.max(1.6, Math.min(7, (RR - L) / (hi - lo) * 0.55));
  /* 누르는 칸: 이웃 막대와 겹치지 않게 m/z 1 간격만큼 (넓으면 10) */
  const hw = Math.max(3, Math.min(10, (x(1) - x(0)) * 0.96));
  let s = `<svg class="chart ms${narrow ? ' narrow' : ''}" viewBox="0 0 ${W} 300" role="img" aria-label="${esc(opts.title || '질량 스펙트럼')}">`;
  for (const t of [0, 25, 50, 75, 100]) s += `<line class="ch-grid" x1="${L}" y1="${r1(y(t))}" x2="${RR}" y2="${r1(y(t))}"/><text class="ch-t" x="${L - 7}" y="${r1(y(t) + 4)}" text-anchor="end">${t}</text>`;
  const step = hi - lo > (narrow ? 80 : 160) ? (narrow && hi - lo > 160 ? 40 : 20) : 10;
  for (let z = Math.ceil(lo / step) * step; z <= hi; z += step) s += `<line class="ch-tick" x1="${r1(x(z))}" y1="${B}" x2="${r1(x(z))}" y2="${B + 5}"/><text class="ch-t" x="${r1(x(z))}" y="${B + 19}" text-anchor="middle">${z}</text>`;
  s += `<text class="ch-ax" x="${(L + RR) / 2}" y="292" text-anchor="middle">m/z</text><text class="ch-ax" transform="translate(12 ${(T + B) / 2}) rotate(-90)" text-anchor="middle">상대 세기 (%)</text>`;
  s += `<line class="ch-frame" x1="${L}" y1="${B}" x2="${RR}" y2="${B}"/><line class="ch-frame" x1="${L}" y1="${T - 10}" x2="${L}" y2="${B}"/>`;
  /* 막대 */
  for (const p of show) {
    const iso = p.main.off !== 0, isM = p.main.f.proc === 'M' && !iso;
    const cls = 'ms-bar' + (p === ms.base ? ' base' : '') + (isM ? ' m' : '') + (iso ? ' iso' : '') + (opts.mark === p.mz ? ' ask' : '') + (opts.sel === p.mz ? ' on' : '');
    const h = Math.max(1.2, p.rel / 100 * H);
    s += `<g class="${cls}" data-mz="${p.mz}">${opts.tips === false ? '' : `<title>m/z ${p.mz} · ${p.rel.toFixed(p.rel < 10 ? 1 : 0)}% · ${iso ? `동위원소 피크 (${esc(p.main.f.text)} 의 +${p.main.off})` : `${esc(p.main.f.text)} — ${esc(PROC[p.main.f.proc].ko)}`}</title>`}<rect x="${r1(x(p.mz) - bw / 2)}" y="${r1(B - h)}" width="${r1(bw)}" height="${r1(h)}"/><rect class="hit" x="${r1(x(p.mz) - hw / 2)}" y="${T - 10}" width="${r1(hw)}" height="${H + 10}"/></g>`;
  }
  /* 글자: 큰 피크부터, 겹치면 건너뜀 */
  const placed = [];
  /* 염소 · 브로민: M 과 M+2 를 한 글자로 (막대가 붙어 있어 따로 쓰면 겹친다) */
  const pair = ms.m2 > 20;
  const want = show.filter(p => (p.rel >= 7 && !(pair && p.mz === ms.M + 2)) || p.mz === ms.M || p === ms.base || opts.mark === p.mz).sort((a, b) => (b.mz === opts.mark) - (a.mz === opts.mark) || (b.mz === ms.M) - (a.mz === ms.M) || b.rel - a.rel);
  for (const p of want) {
    const isM = p.mz === ms.M, top = isM && pair ? Math.max(p.rel, (show.find(q => q.mz === ms.M + 2) || p).rel) : p.rel;
    const px = x(p.mz) + (isM && pair ? x(ms.M + 2) - x(ms.M) : 0) / 2, py = y(top) - 6;
    if (placed.some(q => Math.abs(q[0] - px) < (isM && pair ? 30 : 17) && Math.abs(q[1] - py) < 14)) continue;
    placed.push([px, py]);
    const ask = opts.mark === p.mz;
    s += `<text class="ms-lab${ask ? ' ask' : ''}" x="${r1(px)}" y="${r1(py)}" text-anchor="middle">${isM && pair ? `${p.mz} · ${p.mz + 2}` : p.mz}</text>`;
 if (ask) s += `<text class="ms-tag ask" x="${r1(px)}" y="${r1(py - 14)}" text-anchor="middle">?</text>`;
    else if (opts.tags !== false && isM) s += `<text class="ms-tag" x="${r1(px)}" y="${r1(py - 14)}" text-anchor="middle">${pair ? 'M⁺• · M+2' : 'M⁺•'}</text>`;
    else if (opts.tags !== false && p === ms.base) s += `<text class="ms-tag base" x="${r1(px)}" y="${r1(py - 14)}" text-anchor="middle">기준</text>`;
  }
  return s + '</svg>';
}

/* IR 흡수 띠 표 */
export function irTableHTML(bands, sel) {
  return `<div class="tbl-wrap"><table class="tbl sp-tbl"><thead><tr><th>번호</th><th>파수 cm⁻¹</th><th>진동</th><th>작용기</th><th>세기 · 모양</th></tr></thead><tbody>${bands.map((b, i) => `<tr data-band="${i}" tabindex="0"${sel === i ? ' class="on"' : ''}${b.diag ? '' : ' data-minor'}>
    <td><span class="n">${i + 1}</span></td><td class="m">${b.peaks.length > 1 ? b.peaks.map(p => p[0]).sort((p, q) => q - p).join(' · ') : b.nu}<small>${b.range[0]}–${b.range[1]}</small></td>
    <td>${esc(b.vib)}${b.note ? `<small>${esc(b.note)}</small>` : ''}</td><td>${esc(b.grp)}</td><td>${STR_KO[b.str]}${b.shape ? ' · ' + esc(b.shape) : ''}</td></tr>`).join('')}</tbody></table></div>`;
}
/* 질량 스펙트럼 이온 표 */
export function msTableHTML(ms, sel) {
  return `<div class="tbl-wrap"><table class="tbl sp-tbl"><thead><tr><th>m/z</th><th>상대 세기</th><th>이온</th><th>떨어진 조각</th><th>과정</th></tr></thead><tbody>${ms.ions.map((f, i) => `<tr data-mz="${f.mz}" data-ion="${i}" tabindex="0"${sel === f.mz ? ' class="on"' : ''}>
    <td class="m"><b>${f.mz}</b>${f.proc === 'M' ? '<small>M⁺•</small>' : `<small>M − ${ms.M - f.mz}</small>`}</td><td class="m">${f.rel < 1 ? f.rel.toFixed(1) : Math.round(f.rel)}%</td>
    <td class="m">${esc(f.text)}</td><td class="m">${f.lost ? esc(f.lost) : '—'}</td><td>${esc(PROC[f.proc].ko)}${f.from ? `<small>${esc(f.from)} 에서</small>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
}

/* ── 상관표 · 규칙: 작은 탭 셋 (IR 흡수 위치 · 질량 스펙트럼 규칙 · 자주 보이는 조각) ── */
const REGIONS = [
  { hi: 4000, lo: 2500, name: 'X–H 신축', say: '수소가 가벼워 파수가 가장 높은 영역입니다. 3000 cm⁻¹ 을 경계로 sp² C–H 는 위, sp³ C–H 는 아래에 나타납니다.' },
  { hi: 2500, lo: 2000, name: '삼중결합', say: '다른 흡수가 드문 영역이라 C≡N · C≡C 를 쉽게 찾을 수 있습니다.' },
  { hi: 2000, lo: 1500, name: '이중결합', say: 'C=O 는 스펙트럼에서 가장 강한 흡수입니다. 산 할로젠화물 > 에스터 > 알데하이드 > 케톤 · 카복실산 > 아마이드 순으로 높습니다.' },
  { hi: 1500, lo: 400, name: '지문 영역', say: '흡수가 많이 겹쳐 분자마다 고유한 무늬를 이룹니다. 작용기를 찾기보다 같은 화합물인지 확인하는 데 씁니다.' }
];
const pos = nu => (4000 - nu) / 3600 * 100;
const pc = v => v.toFixed(2) + '%';
function irRefHTML(have) {
  const row = t => {
    const l = pos(t.range[0]), w = Math.max(0.9, pos(t.range[1]) - l), end = l + w, mine = have.has(t.id);
    const num = end < 68 ? `<em class="ir-num" style="left:calc(${pc(end)} + 8px)">` : `<em class="ir-num" style="right:calc(${pc(100 - l)} + 8px)">`;
    return `<div class="ir-row${mine ? ' mine' : ''}">
      <div class="ir-name"><b>${esc(t.bond)}</b><span>${esc(t.grp)}</span>${mine ? '<i class="mine-tag">이 화합물</i>' : ''}</div>
      <div class="ir-track"><i class="ir-bar ${t.str}" style="left:${pc(l)};width:${pc(w)}"></i>${num}${t.range[0]}–${t.range[1]}</em></div>
      <p class="ir-note"><span class="st ${t.str}">${STR_KO[t.str]}${t.shape ? ' · ' + esc(t.shape) : ''}</span>${t.note ? esc(t.note) : ''}</p></div>`;
  };
  const axis = `<div class="ir-axis-row" aria-hidden="true"><span></span><div class="ir-axis">${[4000, 3500, 3000, 2500, 2000, 1500, 1000, 500].map(n => `<b${n % 1000 ? ' class="half"' : ''} style="left:${pc(pos(n))}">${n}</b>`).join('')}</div></div>`;
  const secs = REGIONS.map((R, i) => {
    const items = IR_TABLE.filter(t => t.range[0] <= R.hi && t.range[0] > R.lo).sort((a, b) => b.range[0] - a.range[0]);
    return `<section class="ir-sec r${i}" style="--a:${pc(pos(R.hi))};--b:${pc(pos(R.lo))}"><div class="ir-sec-head"><h3>${R.name}</h3><span>${R.hi}–${R.lo} cm⁻¹</span><p>${R.say}</p></div>${items.map(row).join('')}</section>`;
  }).join('');
  const tips = [['파수의 크기', '결합이 강할수록(삼중 > 이중 > 단일), 원자가 가벼울수록(X–H) 높습니다. 훅의 법칙 ν̃ ∝ √(k/μ).'], ['짝지음(공액)', 'C=O · C=C 의 이중결합성이 줄어 20–30 cm⁻¹ 낮아집니다. 예: 아세토페논 C=O 1690.'],
    ['IR 비활성', '신축해도 쌍극자 모멘트가 변하지 않는 진동(대칭 알카인 · 알켄)은 흡수가 거의 없습니다.'], ['읽는 순서', '1500 cm⁻¹ 위(작용기 영역)에서 작용기를 찾고, 아래(지문 영역)는 같은 화합물인지 확인하는 데 씁니다.']];
  return `<div class="panel ir-ref">
    <div class="ir-ref-top"><p class="lbl">IR 흡수 위치</p><p class="ir-key"><span><i class="ir-bar s"></i>강</span><span><i class="ir-bar m"></i>중간</span><span><i class="ir-bar w"></i>약</span><span><i class="mine-tag">이 화합물</i> 지금 화합물에 있는 흡수</span></p></div>
    ${axis}${secs}</div>
    <div class="rc-grid">${tips.map(([h, p]) => `<div class="rc"><b>${h}</b><p>${p}</p></div>`).join('')}</div>`;
}
function msRuleHTML() {
  const R = [
    ['분자 이온 M⁺•', '분자에서 전자 하나가 떨어진 라디칼 양이온. m/z 가 정수 질량(분자량)과 같습니다.', '뷰탄-2-온 C₄H₈O → m/z 72'],
    ['기준 피크', '가장 센 피크를 100 으로 두고, 나머지 피크는 상대 세기(%)로 나타냅니다.', '뷰탄-2-온 → m/z 43 (CH₃C≡O⁺)'],
    ['질소 규칙', 'M 이 홀수이면 질소 원자가 홀수 개, 짝수이면 없거나 짝수 개입니다.', '뷰탄-1-아민 C₄H₁₁N → m/z 73'],
    ['M+1 피크', '주로 ¹³C (자연 존재비 1.1%) 때문입니다. M+1 이 M 의 몇 %인지를 1.1 로 나누면 탄소 수를 어림할 수 있습니다.', 'M+1 이 M 의 6.6% → 탄소 약 6개'],
    ['M+2 피크', '염소 M : M+2 ≈ 3 : 1, 브로민 ≈ 1 : 1, 황 ≈ 4%.', '2-클로로프로페인 → 78 · 80'],
    ['불포화도', '(2C + 2 + N − H − X) ÷ 2 = 고리 수 + π 결합 수. 산소는 넣지 않습니다.', 'C₆H₆ → 4 (고리 1 + π 3)'],
    ['분자 이온이 약한 경우', '3차 알코올 · 가지 친 알케인은 쉽게 조각나 M⁺• 가 거의 보이지 않습니다. 가장 큰 m/z 가 분자량이 아닐 수 있습니다.', '2-메틸프로판-2-올 → M 74 거의 없음, 59 가 기준'],
    ['고분해능 (HRMS)', '정밀 질량(소수점 넷째 자리)으로 정수 질량이 같은 분자식을 구별합니다.', 'C₃H₆O 58.0419 · C₄H₁₀ 58.0783']
  ];
  return `<div class="rc-grid">${R.map(([h, p, ex]) => `<div class="rc"><b>${h}</b><p>${p}</p><small>예: ${ex}</small></div>`).join('')}</div>`;
}
function fragRefHTML() {
  const P = [
    ['α-개열', '헤테로 원자(O · N)가 붙은 탄소 옆 C–C 가 끊어져 옥소늄 · 이미늄 이온. 큰 라디칼이 떨어지는 쪽이 유리합니다.', '뷰탄-1-올 → 31 (CH₂=OH⁺) · 뷰탄-1-아민 → 30'],
    ['아실륨 이온', '카보닐 탄소 옆 결합이 끊어져 R–C≡O⁺.', '뷰탄-2-온 → 43 · 아세토페논 → 105'],
    ['McLafferty 자리옮김', 'γ-수소가 카보닐 O 로 옮겨 가며 알켄이 떨어집니다. 짝수 m/z.', '헥산-2-온 → 58 · 뷰탄산 → 60 · 뷰탄산 메틸 → 74'],
    ['벤질 개열', '벤질 자리가 끊어져 트로필륨 이온 C₇H₇⁺.', '톨루엔 · 에틸벤젠 → 91'],
    ['탈수 · HX 이탈', '알코올은 H₂O(18), 할로젠화 알킬은 HCl(36) · HBr(80)을 잃습니다.', '뷰탄-1-올 → 56 (M − 18)'],
    ['C–X 개열', '할로젠 라디칼이 떨어져 탄소 양이온. C–Br · C–I 는 쉽게 끊어집니다.', '1-브로모프로페인 → 43']
  ];
  const list = (title, rows, a) => `<div class="panel frag-list"><p class="lbl">${title}</p><ul>${rows.map(r => `<li><b>${r[0]}</b><span>${r[1]}</span><small>${r[2]}</small></li>`).join('')}</ul></div>`;
  return `<div class="rc-grid">${P.map(([h, p, ex]) => `<div class="rc"><b>${h}</b><p>${p}</p><small>예: ${ex}</small></div>`).join('')}</div>
    <div class="frag-cols">${list('자주 보이는 중성 조각 손실', MS_LOSSES)}${list('자주 보이는 조각 이온 (m/z)', MS_IONS)}</div>`;
}
export function refTabsHTML(bands) {
  return tabsHTML('specref', [
    { id: 'ir', label: 'IR 흡수 위치', html: irRefHTML(tableIds(bands)) },
    { id: 'ms', label: '질량 스펙트럼 규칙', html: msRuleHTML() },
    { id: 'frag', label: '조각 · 개열 과정', html: fragRefHTML() }
  ], 'ir');
}
