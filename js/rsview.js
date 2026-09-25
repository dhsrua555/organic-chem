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
  if (R.of[j] >= 0 && R.of[j] === R.of[c]) return 'C' + hs + ' (고리)';
  return 'C' + hs + '(' + others.map(n => A[n.j].el).join(',') + ')';
}

const setTxt = z => '(' + z.map(zSym).join(', ') + ')';
/* 두 가지 사이 순위 근거 한 줄 */
function whyText(w, la, lb) {
  if (!w || !w.depth) return `${la} > ${lb}`;
  if (w.depth === 1) return `붙은 원자의 원자번호 ${zSym(w.za[0])}(${w.za[0]}) > ${zSym(w.zb[0])}(${w.zb[0]})`;
  if (w.depth === 2) return `붙은 원자가 같아서 그다음 원자들을 비교: ${setTxt(w.za)} > ${setTxt(w.zb)}${w.za.length > 2 && hasDup(w) ? ' (이중결합의 원자는 두 번 셉니다)' : ''}`;
  return `${w.depth - 1}칸 떨어진 원자들까지 가서야 갈림: ${setTxt(w.za)} > ${setTxt(w.zb)}`;
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
  if (v && det.rs) {
    const turnKo = v.turn === 'cw' ? '시계 방향' : '시계 반대 방향';
    const rOf = t => t === 'cw' ? 'R' : 'S';
    if (v.lowest === 'back' && rOf(v.turn) === det.rs) how = `가장 낮은 ④ ${labs[3]} 가 <b>뒤쪽</b>(${labs[3] === 'H' ? '쐐기의 반대편' : '점선 쐐기'})을 향합니다. 그대로 ① → ② → ③ 을 따라가면 <b>${turnKo}</b> → <b>${det.rs}</b>.`;
    else if (v.lowest === 'front' && rOf(v.turn) !== det.rs) how = `가장 낮은 ④ ${labs[3]} 가 <b>앞쪽</b>(${labs[3] === 'H' ? '점선 쐐기의 반대편' : '쐐기'})으로 나와 있습니다. 그림에서 ① → ② → ③ 은 ${turnKo}이지만 ④ 가 앞이면 <b>거꾸로 읽어</b> <b>${det.rs}</b>.`;
    else how = `④ 가 종이 면에 있어 그림만으로는 읽기 어렵습니다. 3D 보기로 ④ 를 뒤로 돌리면 ① → ② → ③ 이 ${det.rs === 'R' ? '시계 방향 → R' : '시계 반대 방향 → S'}.`;
  }
  return `<div class="rs-one" data-center="${c}"><p class="rs-head">${head}</p><ol class="cip-list">${order}</ol>${how ? `<p class="rs-how">${how}</p>` : ''}</div>`;
}

/* 시스 · 트랜스 풀이 (고리 · 이중결합) */
function cisTransHTML(mol, res, locOf, ko) {
  const out = [];
  const lab = a => locOf(a) ? 'C' + locOf(a) : '원자 ' + (a + 1);
  for (const x of res.ct || []) {
    const [a, b] = x.atoms;
    out.push(`<li><b>${lab(a)} · ${lab(b)}: ${x.rel}</b> — 두 치환기가 고리의 ${x.rel === 'cis' ? '같은 면 (쐐기끼리 또는 빗금끼리)' : '반대 면 (하나는 쐐기, 하나는 빗금)'}${x.rel === 'cis' ? '' : ''}.</li>`);
  }
  const rn = res.relName;
  if (rn && rn.kind === 'ring') out.push(`<li>R/S 대신 상대 배치로 부르면 <span class="mono">${ko ? rn.ko : rn.en}</span> — 거울상 두 가지를 함께 가리키는 이름입니다.</li>`);
  if (rn && rn.kind === 'alkene') out.push(`<li>시스 · 트랜스로는 <span class="mono">${ko ? rn.ko : rn.en}</span>. 이중결합 양쪽 탄소에 H 가 하나씩 있을 때만 Z = cis, E = trans 로 같습니다.</li>`);
  /* 이중결합마다: 양쪽에 H 가 하나씩이면 E = trans, Z = cis. 아니면 E/Z 만 */
  for (const d of res.db || []) {
    const A = mol.atoms[d.a], B = mol.atoms[d.b];
    if (!A || !B) continue;
    const la = locOf(d.a), lb = locOf(d.b);
    const where = la && lb ? `C${Math.min(+la || 0, +lb || 0) || la}=C${Math.max(+la || 0, +lb || 0) || lb}` : '이중결합';
    if (A.h === 1 && B.h === 1) { if (!(rn && rn.kind === 'alkene')) out.push(`<li>${where}: ${d.desc} = <b>${d.desc === 'Z' ? 'cis' : 'trans'}</b> (양쪽 탄소에 H 가 하나씩이라 둘이 같은 뜻).</li>`); }
    else out.push(`<li>${where}: <b>${d.desc}</b> — 치환기가 셋 이상인 이중결합은 무엇을 기준으로 cis/trans 인지 모호해서 E/Z 로만 부릅니다.</li>`);
  }
  if (res.ringCT && res.ringCT.plain) out.push(`<li>이 고리의 두 탄소는 R/S 입체중심이 아니지만(고리 양쪽 길이 같음) cis · trans 두 가지가 따로 존재합니다. 이름 앞에 cis- · trans- 를 붙여 구별합니다.</li>`);
  return out.length ? `<div class="ct-box"><p class="lbl">시스 · 트랜스</p><ul>${out.join('')}</ul></div>` : '';
}
/* 분자 전체의 R/S 카드 */
export function rsCardHTML(mol, res, opts = {}) {
  if (!res) return '';
  const locOf0 = c => res.locLabel && res.locLabel.get(c);
  const ctHTML = cisTransHTML(mol, res, locOf0, opts.ko);
  if (!res.centers || !res.centers.length) return ctHTML ? `<div class="panel rs-card"><p class="lbl">입체 · 시스 · 트랜스</p>${ctHTML}</div>` : '';
  const W = wedges(mol);
  const locOf = c => res.locLabel && res.locLabel.get(c);
  const defined = res.centers.filter(c => res.rs && res.rs.has(c));
  const sel = opts.sel !== undefined && defined.includes(opts.sel) ? opts.sel : defined[0];
  const tabs = defined.length > 1 ? `<div class="rs-tabs" role="tablist">${defined.map(c => `<button type="button" role="tab" data-cip="${c}" aria-selected="${c === sel}">${locOf(c) ? 'C' + locOf(c) : '원자 ' + (c + 1)} · ${res.rs.get(c)}</button>`).join('')}</div>` : '';
  const undef = res.centers.length - defined.length;
  const extra = [];
  if (res.meso) extra.push(`<p class="note"><b>메소 화합물</b>: 입체중심이 ${defined.length}개 있지만 분자 안에 거울면이 있어 거울상과 겹칩니다 (광학 비활성).</p>`);
  else if (res.mirror) extra.push(`<p class="rs-mirror">거울상 이성질체: <span class="mono">${opts.ko ? res.mirror.ko : res.mirror.en}</span>${opts.mirrorBtn ? ' <button class="link" type="button" id="b-mirror">거울상으로 바꾸기</button>' : ''}</p>`);
  if (undef) extra.push(`<p class="hint">* 표시 ${undef}개는 배열(R/S)이 정해지지 않은 입체중심입니다${opts.racemic ? ' — 두 배열이 1:1 로 섞여 생깁니다 (라세미)' : ''}.</p>`);
  if (res.rsMissing) extra.push(`<p class="hint">곁가지 깊은 곳의 입체중심 ${res.rsMissing}개는 이름에 넣지 못했습니다 (그림의 R/S 를 보세요).</p>`);
  return `<div class="panel rs-card"><p class="lbl">입체중심 R/S · CIP 순위 규칙</p>
    <p class="rs-rule">① 붙은 원자의 원자번호가 클수록 높다 → ② 같으면 그다음 원자들을 큰 것부터 비교 → ③ 이중결합은 원자를 두 번 센다. 가장 낮은 ④ 를 뒤로 보내고 ① → ② → ③ 이 시계 방향이면 <b>R</b>(rectus), 반대면 <b>S</b>(sinister).</p>
    ${tabs}${defined.length ? centerHTML(mol, sel, locOf, W) : ''}${extra.join('')}${ctHTML}</div>`;
}
