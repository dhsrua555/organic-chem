/* R/S 풀이 화면 조각: 입체중심마다 CIP 순위 ①②③④, 왜 그 순서인지, 그림에서 R/S 를 읽는 법 */
import { cipDetail, wedges, zSym } from './chem/stereo.js';
import { rings } from './chem/core.js';

const SUBN = n => String(n).replace(/\d/g, d => '₀₁₂₃₄₅₆₇₈₉'[d]);
const CIRC = ['①', '②', '③', '④'];

/* 중심 c 에서 본 이웃 j 쪽 치환기 이름 (짧게) */
export function groupLabel(mol, c, j) {
  if (j < 0) return 'H';
  const A = mol.atoms, a = A[j], R = rings(mol);
  const hs = a.h ? 'H' + (a.h > 1 ? SUBN(a.h) : '') : '';
  const others = mol.nb[j].filter(n => n.j !== c);
  if (a.el !== 'C') {
    if (a.el === 'O' && !others.length) return 'OH';
    if (a.el === 'O' && others.length === 1) { const o = others[0].j; if (mol.nb[o].some(n => n.o === 2 && A[n.j].el === 'O')) return 'OC(=O)R (에스터 O)'; return A[o].el === 'C' && A[o].h === 3 ? 'OCH₃' : 'OR (에터 O)'; }
    if (a.el === 'N' && a.q === 1) return 'NO₂';
    if (a.el === 'N') return 'N' + hs + (others.length ? 'R' : '');
    return a.el + hs;
  }
  if (R.of[j] >= 0 && R.list[R.of[j]].length === 6 && mol.nb[j].some(n => mol.bonds[n.k].arom)) return 'C₆H₅ 고리 (페닐)';
  const dO = others.find(n => n.o === 2 && A[n.j].el === 'O');
  if (dO) {
    const rest = others.filter(n => n !== dO);
    if (rest.some(n => A[n.j].el === 'O' && A[n.j].h === 1)) return 'COOH';
    if (rest.some(n => A[n.j].el === 'O')) return 'COOR (에스터)';
    if (rest.some(n => A[n.j].el === 'N')) return 'CONH₂ (아마이드)';
    if (a.h === 1) return 'CHO';
    return 'C(=O)R (케톤)';
  }
  if (others.some(n => n.o === 3 && A[n.j].el === 'N')) return 'C≡N';
  if (others.some(n => n.o === 3)) return 'C≡C';
  if (others.some(n => n.o === 2)) return 'CH=C (이중결합)'.replace('CH', 'C' + hs);
  if (a.h === 3) return 'CH₃';
  if (a.h === 2 && others.length === 1) {
    const o = others[0].j, b = A[o];
    if (b.el === 'C' && b.h === 3) return 'CH₂CH₃';
    if (b.el !== 'C') return 'CH₂' + b.el + (b.h ? 'H' + (b.h > 1 ? SUBN(b.h) : '') : '');
    return 'CH₂–C…';
  }
  if (R.same(j, c)) return 'C' + hs + ' (고리)';
  return 'C' + hs + '(' + others.map(n => A[n.j].el).join(',') + ')';
}

const setTxt = z => '(' + z.map(zSym).join(', ') + ')';
/* 두 가지 사이 순위 근거 한 줄 */
function whyText(w, la, lb) {
  if (w && w.rule === 5) return `두 치환기의 구성은 같으나 R 배열 중심을 가진 쪽이 우선 (CIP 규칙 5)`;
  if (w && w.rule === 4) return `두 치환기의 구성은 같으나 like 쌍(RR · SS)을 가진 쪽이 우선 (CIP 규칙 4)`;
  if (!w || !w.depth) return `${la} > ${lb}`;
  if (w.depth === 1) return `결합 원자의 원자번호 ${zSym(w.za[0])}(${w.za[0]}) > ${zSym(w.zb[0])}(${w.zb[0]})`;
  if (w.depth === 2) return `결합 원자가 같으므로 다음 원자 집합을 비교: ${setTxt(w.za)} > ${setTxt(w.zb)}${w.za.length > 2 && hasDup(w) ? ' (다중결합 원자는 중복 계산)' : ''}`;
  return `${w.depth}번째 원자 집합에서 처음으로 차이: ${setTxt(w.za)} > ${setTxt(w.zb)}`;
}
const hasDup = w => w.za.filter(z => z === 8).length >= 2 || w.zb.filter(z => z === 8).length >= 2 || w.za.filter(z => z === 6).length >= 2;

/* 입체중심 하나의 풀이 (HTML). locOf: 원자 → 위치 번호 문자열 */
export function centerHTML(mol, c, locOf, W) {
  const det = cipDetail(mol, c, W || wedges(mol));
  if (!det) return '';
  const labs = det.ranked.map(j => groupLabel(mol, c, j));
  const loc = locOf ? locOf(c) : null;
  const head = `${loc ? `C${loc}` : `원자 ${c + 1}`} → <b class="rs-big">${det.rs || '?'}</b>`;
  const order = labs.map((l, k) => `<li><span class="cipn r${k + 1}">${k + 1}</span>${l}${k < 3 ? `<small>${whyText(det.why[k], l, labs[k + 1])}</small>` : ''}</li>`).join('');
  let how = '';
  const v = det.view;
  const RS = det.rs ? det.rs.toUpperCase() : null;
  if (v && det.rs) {
    const turnKo = v.turn === 'cw' ? '시계 방향' : '반시계 방향';
    const rOf = t => t === 'cw' ? 'R' : 'S';
    if (v.lowest === 'back' && rOf(v.turn) === RS) how = `최저 순위 ④ ${labs[3]} 가 <b>지면 뒤쪽</b>(${labs[3] === 'H' ? '쐐기의 반대편' : '점선 쐐기'})을 향하므로 ① → ② → ③ 의 회전 방향을 그대로 읽습니다: <b>${turnKo}</b> → <b>${det.rs}</b>.`;
    else if (v.lowest === 'front' && rOf(v.turn) !== RS) how = `최저 순위 ④ ${labs[3]} 가 <b>지면 앞쪽</b>(${labs[3] === 'H' ? '점선 쐐기의 반대편' : '굵은 쐐기'})을 향하므로, 보이는 회전 방향(${turnKo})을 <b>반대로 읽습니다</b> → <b>${det.rs}</b>.`;
    else how = `④ 가 지면에 있어 구조식만으로는 판정하기 어렵습니다. ④ 가 뒤쪽을 향하도록 회전하면 ① → ② → ③ 이 ${RS === 'R' ? '시계 방향 → ' + det.rs : '반시계 방향 → ' + det.rs}.`;
  }
  return `<div class="rs-one" data-center="${c}"><p class="rs-head">${head}</p><ol class="cip-list">${order}</ol>${how ? `<p class="rs-how">${how}</p>` : ''}</div>`;
}

/* 시스 · 트랜스 풀이 (고리 · 이중결합) */
function cisTransHTML(mol, res, locOf, ko) {
  const out = [];
  const lab = a => locOf(a) ? 'C' + locOf(a) : '원자 ' + (a + 1);
  for (const x of res.ct || []) {
    const [a, b] = x.atoms;
    out.push(`<li><b>${lab(a)} · ${lab(b)}: ${x.rel}</b> — 두 치환기가 고리의 ${x.rel === 'cis' ? '같은 면에 있습니다 (두 결합이 모두 굵은 쐐기 또는 모두 점선 쐐기)' : '반대 면에 있습니다 (굵은 쐐기 하나, 점선 쐐기 하나)'}.</li>`);
  }
  const rn = res.relName;
  if (rn && rn.kind === 'ring') out.push(`<li>상대 배치로 나타내면 <span class="mono">${ko ? rn.ko : rn.en}</span> 이며, 이 이름은 두 거울상 이성질체를 함께 가리킵니다.</li>`);
  if (rn && rn.kind === 'alkene') out.push(`<li>cis/trans 로는 <span class="mono">${ko ? rn.ko : rn.en}</span> 입니다. 이중결합 양 끝 탄소에 H 가 하나씩 있을 때에만 Z = cis, E = trans 가 성립합니다.</li>`);
  /* 이중결합마다: 양쪽에 H 가 하나씩이면 E = trans, Z = cis. 아니면 E/Z 만 */
  for (const d of res.db || []) {
    const A = mol.atoms[d.a], B = mol.atoms[d.b];
    if (!A || !B) continue;
    const la = locOf(d.a), lb = locOf(d.b);
    const where = la && lb ? `C${Math.min(+la || 0, +lb || 0) || la}=C${Math.max(+la || 0, +lb || 0) || lb}` : '이중결합';
    if (A.h === 1 && B.h === 1) { if (!(rn && rn.kind === 'alkene')) out.push(`<li>${where}: ${d.desc} = <b>${d.desc === 'Z' ? 'cis' : 'trans'}</b> (양 끝 탄소에 H 가 하나씩이므로 같은 의미).</li>`); }
    else out.push(`<li>${where}: <b>${d.desc}</b> — 삼치환 · 사치환 이중결합은 cis/trans 기준이 모호하므로 E/Z 로만 표시합니다.</li>`);
  }
  if (res.siteMissing && res.siteMissing.length) out.push(`<li>${res.siteMissing.map(lab).join(', ')} 의 상대 배치(셋 이상의 고리 치환기 사이의 cis/trans)는 R/S 로 표현되지 않아 이름에 포함하지 않았습니다. 구조식의 쐐기 결합으로 확인할 수 있습니다.</li>`);
  if (res.ringCT && res.ringCT.plain) out.push(`<li>이 고리의 두 탄소는 CIP 입체중심은 아니지만 cis/trans 부분입체이성질체가 존재하므로, 이름 앞에 cis- 또는 trans- 를 붙여 구별합니다.</li>`);
  return out.length ? `<div class="ct-box"><p class="lbl">cis/trans · E/Z</p><ul>${out.join('')}</ul></div>` : '';
}
/* 분자 전체의 R/S 카드 */
export function rsCardHTML(mol, res, opts = {}) {
  if (!res) return '';
  const locOf0 = c => res.locLabel && res.locLabel.get(c);
  const ctHTML = cisTransHTML(mol, res, locOf0, opts.ko);
  if (!res.centers || !res.centers.length) return ctHTML ? `<div class="panel rs-card"><p class="lbl">입체화학</p>${ctHTML}</div>` : '';
  const W = wedges(mol);
  const locOf = c => res.locLabel && res.locLabel.get(c);
  const dOf = c => (res.rs && res.rs.get(c)) || (res.pseudo && res.pseudo.get(c));
  const defined = res.centers.filter(c => dOf(c));
  const sel = opts.sel !== undefined && defined.includes(opts.sel) ? opts.sel : defined[0];
  const tabs = defined.length > 1 ? `<div class="rs-tabs" role="tablist">${defined.map(c => `<button type="button" role="tab" data-cip="${c}" aria-selected="${c === sel}">${locOf(c) ? 'C' + locOf(c) : '원자 ' + (c + 1)} · ${dOf(c)}</button>`).join('')}</div>` : '';
  const undef = res.centers.length - defined.length;
  const extra = [];
  if (res.pseudo && res.pseudo.size) extra.push(`<p class="note"><b>의사비대칭 중심 (소문자 r · s)</b>: ${[...res.pseudo].map(([c, d]) => `${locOf(c) ? 'C' + locOf(c) : '원자 ' + (c + 1)} = ${d}`).join(', ')}. 구성이 같은 두 치환기가 각각 R · S 배열을 가져 서로 거울상 관계이므로, CIP 규칙 5 에 따라 R 치환기를 우선합니다. r · s 는 거울상에서도 바뀌지 않습니다.</p>`);
  if (res.meso) extra.push(`<p class="note"><b>메소 화합물</b>: 입체중심이 ${defined.length}개 있지만 분자 내 대칭면이 있어 거울상과 포개어집니다 (광학 비활성).</p>`);
  else if (res.mirror) extra.push(`<p class="rs-mirror">거울상 이성질체: <span class="mono">${opts.ko ? res.mirror.ko : res.mirror.en}</span>${opts.mirrorBtn ? ' <button class="link" type="button" id="b-mirror">거울상 이성질체로 바꾸기</button>' : ''}</p>`);
  if (undef) extra.push(`<p class="hint">* 는 배열이 지정되지 않은 입체중심입니다 (${undef}개)${opts.racemic ? '. 두 배열이 1:1 로 생성됩니다 (라세미)' : ''}.</p>`);
  if (res.rsMissing) extra.push(`<p class="hint">치환기 내부 깊숙한 입체중심 ${res.rsMissing}개는 이름에 표시하지 못했습니다 (구조식의 R/S 참고).</p>`);
  return `<div class="panel rs-card"><p class="lbl">입체중심의 R/S · CIP 우선순위</p>
    <p class="rs-rule">입체중심에 직접 결합한 원자의 원자번호가 클수록 우선합니다. 같으면 다음 원자 집합을 원자번호 순으로 비교하며, 다중결합 원자는 중복 원자로 계산합니다. 최저 순위 ④ 를 관찰자 반대쪽에 두고 ① → ② → ③ 이 시계 방향이면 <b>R</b>(rectus), 반시계 방향이면 <b>S</b>(sinister) 입니다.</p>
    ${tabs}${defined.length ? centerHTML(mol, sel, locOf, W) : ''}${extra.join('')}${ctHTML}</div>`;
}
