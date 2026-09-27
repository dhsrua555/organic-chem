/* 분광학: 구조에서 IR 특성 흡수와 전자 이온화(EI, 70 eV) 질량 스펙트럼을 예측한다.
   교과서(스미스 · 브루스 유기화학)의 흡수 상관표와 개열 규칙을 따른 모식도이며, 세기는 경향을 보이는 추정값이다.
   IR — 결합 · 작용기마다 흡수 띠(파수 · 세기 · 모양)를 정하고, 로런츠(넓은 띠는 가우스) 곡선을 흡광도로 더해 투과율로 바꾼다.
   MS — 분자 이온과 동위원소 피크(자연 존재비로 계산)에 규칙 기반 조각 이온(α-개열 · 아실륨 · McLafferty 자리옮김 ·
   탈수 · C–X 개열 · 벤질 개열 · C–C 개열 등)을 더한다. 고리 안의 결합 하나만 끊어지면 질량이 그대로라 생략한다. */
import { rings, isBenzene, unsaturation } from './core.js';
import { analyze } from './name.js';

/* ── 글자 ─────────────────────────────────── */
const SUBD = '₀₁₂₃₄₅₆₇₈₉';
export const subN = n => String(n).replace(/\d/g, d => SUBD[d]);
/* 조성 → 분자식 글자 (C, H 먼저, 나머지는 알파벳 순) */
export function fstr(c) {
  const ks = Object.keys(c).filter(k => c[k] > 0);
  const head = (c.C ? ['C', 'H'] : ['H']).filter(k => c[k] > 0);
  return [...head, ...ks.filter(k => k !== 'C' && k !== 'H').sort()].map(k => k + (c[k] > 1 ? subN(c[k]) : '')).join('');
}

/* ── 그래프 도우미 ─────────────────────────── */
const isC = (m, i) => m.atoms[i].el === 'C';
const arom = (m, i) => m.nb[i].some(n => m.bonds[n.k].arom);
const sp3 = (m, i) => m.nb[i].every(n => n.o === 1) && !arom(m, i);
const cNb = (m, i, ex = -1) => m.nb[i].filter(n => n.j !== ex && isC(m, n.j)).map(n => n.j);
const HAL = new Set(['F', 'Cl', 'Br', 'I']);
const bk = (i, j) => i < j ? i + '-' + j : j + '-' + i;

/* 작용기 찾기 (IR · MS 공용) */
function perceive(m) {
  const A = m.atoms, R = rings(m), { info } = analyze(m);
  const P = { R, info, carbonyl: [], nitrile: [], alcohol: [], phenol: [], acidOH: [], amine: [], amideN: [], ether: [], epoxide: [], nitro: [], halide: [], alkene: [], alkyne: [], arenes: [] };
  info.forEach((f, c) => {
    if (!f || !f.kind) return;
    if (f.kind === 'nitrile') P.nitrile.push({ c, n: f.nitN });
    else P.carbonyl.push({ c, o: f.oxo[0], kind: f.kind, f });
  });
  A.forEach((a, i) => {
    if (a.el === 'O' && a.h === 1 && !a.q && m.nb[i].length === 1) {
      const c = m.nb[i][0].j;
      if (!isC(m, c)) return;
      if (info[c] && info[c].oxo.length) P.acidOH.push({ o: i, c });
      else if (arom(m, c)) P.phenol.push({ o: i, c });
      else if (sp3(m, c)) P.alcohol.push({ o: i, c, cls: cNb(m, c).length });
    }
    if (a.el === 'O' && !a.h && !a.q && m.nb[i].length === 2 && m.nb[i].every(n => n.o === 1 && isC(m, n.j))) {
      const [p, q] = m.nb[i].map(n => n.j);
      if ([p, q].some(c => info[c] && info[c].oxo.length)) return; /* 에스터의 O */
      if (m.nb[p].some(n => n.j === q)) P.epoxide.push({ o: i, a: p, b: q });
      else P.ether.push({ o: i, c1: p, c2: q, aryl: [p, q].filter(c => arom(m, c)).length });
    }
    if (a.el === 'N' && !a.q) {
      const ac = m.nb[i].find(n => n.o === 1 && info[n.j] && info[n.j].oxo.length);
      if (ac) P.amideN.push({ n: i, c: ac.j, h: a.h });
      else if (m.nb[i].every(n => n.o === 1) && m.nb[i].some(n => isC(m, n.j))) P.amine.push({ n: i, h: a.h, aryl: m.nb[i].some(n => arom(m, n.j)) });
    }
    if (a.el === 'N' && a.q === 1 && m.nb[i].some(n => A[n.j].el === 'O')) {
      const c = m.nb[i].find(n => isC(m, n.j));
      P.nitro.push({ n: i, c: c ? c.j : -1, k: c ? c.k : -1, os: m.nb[i].filter(n => A[n.j].el === 'O').map(n => n.j), aryl: !!(c && arom(m, c.j)) });
    }
    if (HAL.has(a.el) && m.nb[i].length === 1) {
      const c = m.nb[i][0].j;
      if (isC(m, c) && !(info[c] && info[c].oxo.length)) P.halide.push({ x: i, c, k: m.nb[i][0].k, el: a.el, aryl: arom(m, c), vinyl: !arom(m, c) && !sp3(m, c) });
    }
  });
  m.bonds.forEach((b, k) => {
    if (b.arom || !isC(m, b.a) || !isC(m, b.b)) return;
    if (b.o === 2) P.alkene.push({ k, a: b.a, b: b.b });
    if (b.o === 3) P.alkyne.push({ k, a: b.a, b: b.b });
  });
  R.list.forEach(r => { if (isBenzene(m, r)) P.arenes.push(r); });
  return P;
}
/* 결합 양쪽의 치환 모양이 같은가 (대칭 알카인 · 알켄: IR 에서 거의 안 보임) */
function sameSides(m, a, b) {
  const sig = (i, from, d, seen) => {
    if (d > 6 || seen.has(i)) return '~';
    seen.add(i);
    const at = m.atoms[i];
    const kids = m.nb[i].filter(n => n.j !== from).map(n => n.o + sig(n.j, i, d + 1, new Set(seen))).sort();
    return at.el + at.h + '(' + kids.join(',') + ')';
  };
  return sig(a, b, 0, new Set([b])) === sig(b, a, 0, new Set([a]));
}
/* 이중결합 양 끝 치환기가 같은 쪽인가 (2D 좌표): cis 이면 true */
function cisOf(m, a, b) {
  const X = m.nb[a].find(n => n.j !== b), Y = m.nb[b].find(n => n.j !== a);
  if (!X || !Y) return null;
  const A = m.atoms, dx = A[b].x - A[a].x, dy = A[b].y - A[a].y;
  const s1 = dx * (A[X.j].y - A[a].y) - dy * (A[X.j].x - A[a].x), s2 = dx * (A[Y.j].y - A[a].y) - dy * (A[Y.j].x - A[a].x);
  return s1 * s2 > 0;
}

/* ═══ IR ═══════════════════════════════════════ */
export const STR_KO = { s: '강', m: '중간', w: '약', vw: '매우 약' };
/* 흡수 상관표 (참고 표 · 연습 문제). range = [높은 쪽, 낮은 쪽] cm⁻¹ */
export const IR_TABLE = [
  { id: 'OH', bond: 'O–H 신축', grp: '알코올 · 페놀', range: [3550, 3200], str: 's', shape: '넓음', note: '분자 사이 수소 결합으로 넓어진다' },
  { id: 'OHacid', bond: 'O–H 신축', grp: '카복실산', range: [3300, 2500], str: 's', shape: '매우 넓음', note: '수소 결합 이량체 때문에 C–H 신축과 겹칠 만큼 넓다' },
  { id: 'NH', bond: 'N–H 신축', grp: '아민 · 아마이드', range: [3500, 3300], str: 'm', shape: '', note: 'NH₂ 는 두 흡수 띠, NH 는 하나, 3차 아민은 없음' },
  { id: 'CHsp', bond: '≡C–H 신축', grp: '말단 알카인', range: [3320, 3270], str: 's', shape: '날카로움', note: 'O–H · N–H 보다 폭이 좁다' },
  { id: 'CHsp2', bond: 'C–H 신축 (sp²)', grp: '알켄 · 방향족', range: [3100, 3000], str: 'm', shape: '', note: '3000 cm⁻¹ 보다 높은 쪽' },
  { id: 'CHsp3', bond: 'C–H 신축 (sp³)', grp: '알케인 · 알킬기', range: [3000, 2850], str: 's', shape: '', note: '3000 cm⁻¹ 보다 낮은 쪽' },
  { id: 'CHO', bond: 'C–H 신축 (CHO)', grp: '알데하이드', range: [2830, 2695], str: 'm', shape: '두 흡수 띠', note: '약 2820 · 2720 cm⁻¹' },
  { id: 'CN', bond: 'C≡N 신축', grp: '나이트릴', range: [2260, 2220], str: 'm', shape: '날카로움', note: '' },
  { id: 'CC3', bond: 'C≡C 신축', grp: '알카인', range: [2260, 2100], str: 'w', shape: '', note: '대칭 내부 알카인은 거의 보이지 않는다' },
  { id: 'COacylhalide', bond: 'C=O 신축', grp: '산 할로젠화물', range: [1815, 1785], str: 's', shape: '', note: '카보닐 가운데 가장 높다' },
  { id: 'COester', bond: 'C=O 신축', grp: '에스터', range: [1750, 1735], str: 's', shape: '', note: 'C–O 신축 두 흡수 띠(1300–1000)가 함께 나타난다' },
  { id: 'COaldehyde', bond: 'C=O 신축', grp: '알데하이드', range: [1740, 1720], str: 's', shape: '', note: '2720 cm⁻¹ C–H 와 함께 확인' },
  { id: 'COketone', bond: 'C=O 신축', grp: '케톤', range: [1720, 1705], str: 's', shape: '', note: '고리가 작을수록 높아진다 (사이클로펜탄온 약 1745)' },
  { id: 'COacid', bond: 'C=O 신축', grp: '카복실산', range: [1725, 1700], str: 's', shape: '', note: '넓은 O–H 와 함께 나타난다' },
  { id: 'COamide', bond: 'C=O 신축', grp: '아마이드', range: [1690, 1630], str: 's', shape: '', note: '아마이드 I 띠 · 공명으로 C=O 가 약해져 낮다' },
  { id: 'CCdb', bond: 'C=C 신축', grp: '알켄', range: [1680, 1620], str: 'm', shape: '', note: '대칭으로 치환된 알켄은 약하다' },
  { id: 'CCar', bond: 'C=C 고리 신축', grp: '방향족 고리', range: [1600, 1450], str: 'm', shape: '두세 흡수 띠', note: '약 1600 · 1500 cm⁻¹' },
  { id: 'NO2', bond: 'N–O 신축', grp: '나이트로 화합물', range: [1550, 1350], str: 's', shape: '두 흡수 띠', note: '약 1550 (비대칭) · 1350 (대칭) cm⁻¹' },
  { id: 'CHb', bond: 'C–H 굽힘', grp: 'CH₂ · CH₃', range: [1470, 1370], str: 'm', shape: '', note: 'CH₂ 약 1465 · CH₃ 약 1375 cm⁻¹' },
  { id: 'COs', bond: 'C–O 신축', grp: '알코올 · 에터 · 에스터', range: [1300, 1000], str: 's', shape: '', note: '지문 영역에 있어 단독으로는 판단하기 어렵다' },
  { id: 'oop', bond: 'C–H 면외 굽힘', grp: '알켄 · 방향족', range: [1000, 650], str: 's', shape: '', note: '치환 형태를 알려 준다 (일치환 벤젠 750 · 700)' },
  { id: 'CCl', bond: 'C–Cl 신축', grp: '염화물', range: [800, 600], str: 's', shape: '', note: '' },
  { id: 'CBr', bond: 'C–Br 신축', grp: '브로민화물', range: [690, 515], str: 's', shape: '', note: '' }
];
/* 카보닐 C=O: 기본 · 짝지음(공액) 파수와 범위 */
const CO = {
  acylhalide: { nu: 1800, r: [1815, 1785], cn: 1775, cr: [1790, 1765], grp: '산 할로젠화물' },
  ester: { nu: 1740, r: [1750, 1735], cn: 1720, cr: [1730, 1715], grp: '에스터' },
  aldehyde: { nu: 1730, r: [1740, 1720], cn: 1700, cr: [1710, 1685], grp: '알데하이드' },
  ketone: { nu: 1715, r: [1720, 1705], cn: 1690, cr: [1700, 1680], grp: '케톤' },
  acid: { nu: 1710, r: [1725, 1700], cn: 1690, cr: [1700, 1680], grp: '카복실산' },
  amide: { nu: 1660, r: [1690, 1630], cn: 1655, cr: [1680, 1630], grp: '아마이드' }
};
/* 흡수 띠: key(진단 기호) · vib(진동) · grp(작용기) · range · str · peaks[[파수, 흡광도, 반너비, 가우스?]] */
const band = (key, vib, grp, range, str, peaks, o = {}) => ({ key, vib, grp, range, str, peaks, shape: o.shape || '', atoms: o.atoms || [], note: o.note || '', diag: o.diag !== false });

export function irBands(mol) {
  const m = mol, A = m.atoms, P = perceive(m), R = P.R, out = [];
  const add = b => {
    const id = b.key + '|' + b.grp + '|' + b.peaks[0][0];
    const same = out.find(x => x.id === id);
    if (same) { same.atoms = [...new Set([...same.atoms, ...b.atoms])]; return; }
    b.id = id; out.push(b);
  };
  /* O–H */
  if (P.acidOH.length) add(band('OHacid', 'O–H 신축', '카복실산', [3300, 2500], 's', [[3000, 0.85, 270, 1]], { shape: '매우 넓음', atoms: P.acidOH.map(x => x.o), note: '수소 결합한 이량체 때문에 매우 넓게 퍼져 C–H 신축과 겹칩니다.' }));
  if (P.alcohol.length) add(band('OH', 'O–H 신축', '알코올', [3550, 3200], 's', [[3350, 0.95, 120, 1]], { shape: '넓음', atoms: P.alcohol.map(x => x.o), note: '분자 사이 수소 결합으로 넓어집니다. 묽은 용액에서는 3600 cm⁻¹ 부근의 날카로운 흡수(자유 O–H)로 바뀝니다.' }));
  if (P.phenol.length) add(band('OH', 'O–H 신축', '페놀', [3550, 3200], 's', [[3350, 0.95, 120, 1]], { shape: '넓음', atoms: P.phenol.map(x => x.o), note: '분자 사이 수소 결합으로 넓어집니다.' }));
  /* N–H */
  for (const x of P.amine) {
    if (x.h === 2) {
      add(band('NH2', 'N–H 신축', x.aryl ? '1차 방향족 아민' : '1차 아민', [3500, 3300], 'm', [[3385, 0.42, 30, 1], [3300, 0.38, 30, 1]], { shape: '두 흡수 띠', atoms: [x.n], note: 'NH₂ 의 두 N–H 가 비대칭 · 대칭으로 신축해 두 흡수 띠가 나타납니다. O–H 보다 좁고 약합니다.' }));
      add(band('NHb', 'N–H 굽힘', '1차 아민', [1650, 1580], 'm', [[1615, 0.4, 20]], { atoms: [x.n], diag: false }));
    } else if (x.h === 1) add(band('NH', 'N–H 신축', '2차 아민', [3350, 3310], 'w', [[3320, 0.24, 30, 1]], { shape: '흡수 띠 하나', atoms: [x.n], note: 'N–H 가 하나이므로 흡수 띠도 하나입니다.' }));
    const cn = m.nb[x.n].filter(n => isC(m, n.j)).map(n => n.j);
    add(x.aryl ? band('CNs', 'C–N 신축', '방향족 아민', [1340, 1250], 's', [[1280, 0.75, 16]], { atoms: [x.n, ...cn], diag: false })
      : band('CNs', 'C–N 신축', '지방족 아민', [1250, 1020], 'w', [[1130, 0.25, 22]], { atoms: [x.n, ...cn], diag: false }));
  }
  for (const x of P.amideN) {
    if (x.h === 2) add(band('NH2', 'N–H 신축', '1차 아마이드', [3400, 3150], 'm', [[3350, 0.55, 40, 1], [3180, 0.5, 40, 1]], { shape: '두 흡수 띠', atoms: [x.n] }));
    else if (x.h === 1) add(band('NH', 'N–H 신축', '2차 아마이드', [3350, 3250], 'm', [[3300, 0.5, 40, 1]], { shape: '흡수 띠 하나', atoms: [x.n] }));
    if (x.h) add(band('NHb', 'N–H 굽힘 (아마이드 II 띠)', x.h === 2 ? '1차 아마이드' : '2차 아마이드', x.h === 2 ? [1650, 1590] : [1570, 1515], 'm', [[x.h === 2 ? 1620 : 1550, 0.5, 16]], { atoms: [x.n], diag: false }));
  }
  /* C–H 신축 */
  const ynH = A.map((a, i) => i).filter(i => isC(m, i) && A[i].h && m.nb[i].some(n => n.o === 3 && isC(m, n.j)));
  if (ynH.length) {
    add(band('CHsp', '≡C–H 신축', '말단 알카인', [3320, 3270], 's', [[3300, 0.9, 13]], { shape: '날카로움', atoms: ynH, note: '넓은 O–H · N–H 와 달리 폭이 좁고 강합니다.' }));
    add(band('CHspb', '≡C–H 굽힘', '말단 알카인', [700, 610], 's', [[630, 0.65, 20]], { atoms: ynH, diag: false }));
  }
  const vin = [...new Set(P.alkene.flatMap(d => [d.a, d.b]))].filter(i => A[i].h);
  if (vin.length) add(band('CHsp2', '=C–H 신축', '알켄', [3100, 3010], 'm', [[3080, 0.33, 14]], { atoms: vin, note: '3000 cm⁻¹ 보다 높은 C–H 는 sp² 탄소의 C–H 입니다.' }));
  const arH = [...new Set(P.arenes.flat())].filter(i => A[i].h);
  if (arH.length) add(band('CHar', 'C–H 신축 (방향족)', '방향족 고리', [3100, 3000], 'w', [[3065, 0.2, 12], [3030, 0.2, 12]], { atoms: arH, note: '3000 cm⁻¹ 보다 높은 쪽의 약한 흡수입니다.' }));
  const ch = { 3: [], 2: [], 1: [] };
  A.forEach((a, i) => { if (isC(m, i) && a.h && sp3(m, i)) ch[Math.min(3, a.h)].push(i); });
  const h3 = ch[3].length * 3, h2 = ch[2].length * 2, h1 = ch[1].length;
  if (h3 + h2 + h1) {
    const amp = x => x > 0 ? Math.min(1.0, 0.2 + 0.075 * x) : 0;
    const pk = [[2962, amp(h3 + h1 / 2), 13], [2926, amp(h2 + h1 / 2), 13], [2872, amp(h3) * 0.6, 11], [2853, amp(h2) * 0.6, 11]].filter(p => p[1] > 0.02).sort((p, q) => q[1] - p[1]);
    add(band('CHsp3', 'C–H 신축 (sp³)', '알킬기', [3000, 2850], 's', pk, { atoms: [...ch[3], ...ch[2], ...ch[1]], note: '3000 cm⁻¹ 보다 낮은 C–H 는 sp³ 탄소의 C–H 입니다. 거의 모든 유기 화합물에 나타납니다.' }));
  }
  for (const x of P.carbonyl.filter(x => x.kind === 'aldehyde')) add(band('CHO', 'C–H 신축 (CHO)', '알데하이드', [2830, 2695], 'm', [[2720, 0.3, 13], [2820, 0.28, 13]], { shape: '두 흡수 띠', atoms: [x.c], note: '페르미 공명으로 2820 · 2720 cm⁻¹ 두 흡수 띠로 갈라집니다. 2720 cm⁻¹ 은 다른 C–H 와 겹치지 않아 알데하이드 확인에 쓰입니다.' }));
  /* 삼중결합 */
  for (const x of P.nitrile) {
    const conj = cNb(m, x.c).some(j => arom(m, j) || m.nb[j].some(n => n.o === 2));
    add(band('CN', 'C≡N 신축', '나이트릴', [2260, 2220], 'm', [[conj ? 2230 : 2250, 0.55, 9]], { shape: '날카로움', atoms: [x.c, x.n], note: conj ? '짝지음(공액)으로 조금 낮은 쪽(약 2230 cm⁻¹)에 나타납니다.' : '삼중결합 영역(2300–2100 cm⁻¹)에는 흡수가 드물어 쉽게 확인됩니다.' }));
  }
  for (const t of P.alkyne) {
    const term = A[t.a].h > 0 || A[t.b].h > 0;
    if (term) add(band('CC3', 'C≡C 신축', '말단 알카인', [2140, 2100], 'w', [[2120, 0.3, 9]], { atoms: [t.a, t.b], note: '≡C–H(3300 cm⁻¹)와 함께 말단 알카인을 알려 줍니다.' }));
    else {
      const sym = sameSides(m, t.a, t.b);
      add(band('CC3', 'C≡C 신축', sym ? '대칭 내부 알카인' : '내부 알카인', [2260, 2190], sym ? 'vw' : 'w', [[2230, sym ? 0.02 : 0.12, 9]], { atoms: [t.a, t.b], note: sym ? '양쪽이 같은 알카인은 신축해도 쌍극자 모멘트가 변하지 않아 흡수가 거의 나타나지 않습니다 (IR 비활성).' : '내부 알카인은 신축할 때 쌍극자 변화가 작아 약합니다.' }));
    }
  }
  /* C=O */
  for (const x of P.carbonyl) {
    const T = CO[x.kind], c = x.c;
    const conj = m.nb[c].some(n => n.j !== x.o && isC(m, n.j) && (arom(m, n.j) || m.nb[n.j].some(q => q.j !== c && q.o === 2 && isC(m, q.j))));
    let nu = conj ? T.cn : T.nu, range = conj ? T.cr : T.r, note = conj ? '짝지음(공액)된 카보닐은 C=O 의 이중결합성이 줄어 약 20–30 cm⁻¹ 낮아집니다.' : '';
    const ringC = R.list.find(r => r.includes(c));
    if (ringC && x.kind === 'ketone') {
      const f = { 3: 1815, 4: 1780, 5: 1745, 6: 1715, 7: 1700 }[ringC.length];
      if (f && ringC.length !== 6) { nu = f - (conj ? 25 : 0); range = [nu + 10, nu - 10]; note = `${ringC.length}원자 고리 케톤: 고리가 작을수록 각 무리로 C=O 파수가 높아집니다 (사이클로헥산온 1715 · 사이클로펜탄온 1745 · 사이클로뷰탄온 1780).`; }
    }
    if (ringC && x.kind === 'ester' && x.f.OR.some(r => ringC.includes(r.o))) {
      const f = { 4: 1840, 5: 1770, 6: 1735 }[ringC.length];
      if (f) { nu = f; range = [f + 10, f - 10]; note = `${ringC.length}원자 고리 에스터(락톤): 고리가 작을수록 파수가 높아집니다.`; }
    }
    if (x.kind === 'amide') note = (note ? note + ' ' : '') + '아마이드는 질소의 비공유 전자쌍과 공명해 C=O 가 약해지므로 가장 낮은 쪽에 나타납니다 (아마이드 I 띠).';
    if (x.kind === 'acylhalide') note = (note ? note + ' ' : '') + '전기음성도가 큰 할로젠이 C=O 를 강하게 만들어 가장 높은 쪽에 나타납니다.';
    add(band('CO', 'C=O 신축', T.grp, range, 's', [[nu, 1.45, 11]], { atoms: [c, x.o], note: note || '1800–1650 cm⁻¹ 의 가장 강한 흡수 가운데 하나로, 카보닐 화합물 확인의 기준입니다.' }));
    if (x.kind === 'ketone' && !conj && cNb(m, c).length === 2) add(band('CCOs', 'C–CO–C 신축', '케톤', [1230, 1100], 'm', [[1170, 0.4, 20]], { atoms: [c, ...cNb(m, c)], diag: false }));
    if (x.kind === 'ester') add(band('COs', 'C–O 신축', '에스터', [1300, 1000], 's', [[1240, 1.0, 18], [1050, 0.7, 18]], { shape: '두 흡수 띠', atoms: [c, ...x.f.OR.flatMap(r => [r.o, r.c])], diag: false }));
    if (x.kind === 'acid') {
      add(band('COs', 'C–O 신축', '카복실산', [1320, 1210], 's', [[1285, 0.85, 20]], { atoms: [c, ...x.f.OH], diag: false }));
      add(band('OHb', 'O–H 굽힘', '카복실산', [960, 900], 'm', [[935, 0.42, 30, 1], [1420, 0.35, 16]], { shape: '넓음', atoms: x.f.OH, diag: false }));
    }
  }
  /* C=C */
  for (const d of P.alkene) {
    const conj = [d.a, d.b].some(x => m.nb[x].some(n => n.j !== d.a && n.j !== d.b && (arom(m, n.j) || m.nb[n.j].some(q => q.j !== x && q.o >= 2))));
    const sym = sameSides(m, d.a, d.b), sub4 = A[d.a].h + A[d.b].h === 0;
    const inRing = R.list.some(r => r.includes(d.a) && r.includes(d.b));
    const vw = !conj && sym && (sub4 || (!inRing && cisOf(m, d.a, d.b) === false)), w = !conj && !vw && (sym || sub4);
    add(band('CCdb', 'C=C 신축', conj ? '짝지은 알켄' : '알켄', conj ? [1640, 1600] : [1680, 1620], vw ? 'vw' : w ? 'w' : 'm', [[conj ? 1625 : 1650, vw ? 0.04 : w ? 0.15 : conj ? 0.55 : 0.38, 11]], {
      atoms: [d.a, d.b], note: conj ? '짝지음(공액)으로 파수가 낮아지고 세기가 커집니다.' : vw ? '대칭 중심이 있는 알켄(양쪽이 같은 trans · 사치환)은 신축해도 쌍극자 모멘트가 변하지 않아 흡수가 거의 없습니다 (IR 비활성).' : w ? '양쪽 치환이 비슷한 알켄은 쌍극자 변화가 작아 흡수가 약합니다.' : '보통 중간 세기 이하로, C=O 보다 훨씬 약합니다.'
    }));
    const ha = A[d.a].h, hb = A[d.b].h;
    const ring = R.list.some(r => r.includes(d.a) && r.includes(d.b));
    if ((ha === 2 && hb === 1) || (ha === 1 && hb === 2)) add(band('oopV', '=C–H 면외 굽힘', '일치환 알켄 (–CH=CH₂)', [995, 905], 's', [[910, 0.85, 9], [990, 0.65, 9]], { shape: '두 흡수 띠', atoms: [d.a, d.b], diag: false }));
    else if ((ha === 2 && hb === 0) || (ha === 0 && hb === 2)) add(band('oop11', '=C–H 면외 굽힘', '1,1-이치환 알켄 (C=CH₂)', [895, 885], 's', [[890, 0.85, 9]], { atoms: [d.a, d.b], diag: false }));
    else if (ha === 1 && hb === 1) {
      const cis = ring || cisOf(m, d.a, d.b);
      add(cis ? band('oopZ', '=C–H 면외 굽힘', 'cis-이치환 알켄', [730, 665], 'm', [[700, 0.45, 22]], { shape: '넓음', atoms: [d.a, d.b], diag: false })
        : band('oopE', '=C–H 면외 굽힘', 'trans-이치환 알켄', [980, 960], 's', [[965, 0.85, 9]], { atoms: [d.a, d.b], diag: false, note: 'trans 와 cis 를 구별하는 흡수입니다 (cis 는 약 700 cm⁻¹).' }));
    } else if (ha + hb === 1) add(band('oop3', '=C–H 면외 굽힘', '삼치환 알켄', [840, 800], 'm', [[820, 0.45, 11]], { atoms: [d.a, d.b], diag: false }));
  }
  /* 방향족 고리 */
  if (P.arenes.length) {
    const at = [...new Set(P.arenes.flat())];
    add(band('CCar', 'C=C 고리 신축', '방향족 고리', [1600, 1450], 'm', [[1500, 0.5, 9], [1600, 0.42, 9], [1585, 0.2, 7], [1455, 0.33, 9]], { shape: '두세 흡수 띠', atoms: at, note: '1600 · 1500 cm⁻¹ 부근의 짝은 벤젠 고리의 특징입니다.' }));
    add(band('ovt', '배음 · 결합음', '방향족 고리', [2000, 1667], 'vw', [[1945, 0.05, 16], [1865, 0.05, 16], [1790, 0.04, 16]], { atoms: at, diag: false, note: '벤젠 고리의 약한 흡수 무리로, 무늬가 치환 형태를 반영합니다.' }));
    for (const r of P.arenes) {
      const pos = r.map((a, k) => m.nb[a].some(n => !r.includes(n.j)) ? k : -1).filter(k => k >= 0);
      let b = null;
      if (pos.length === 0) b = band('oopAr', 'C–H 면외 굽힘', '벤젠', [690, 660], 's', [[675, 0.9, 11]]);
      else if (pos.length === 1) b = band('oopAr', 'C–H 면외 굽힘', '일치환 벤젠', [770, 690], 's', [[750, 0.95, 11], [695, 0.9, 11]], { shape: '두 흡수 띠', note: '750 · 700 cm⁻¹ 의 두 강한 흡수는 일치환 벤젠의 특징입니다.' });
      else if (pos.length === 2) {
        const d = Math.abs(pos[1] - pos[0]), g = Math.min(d, 6 - d);
        b = g === 1 ? band('oopAr', 'C–H 면외 굽힘', '오쏘(1,2-)이치환 벤젠', [770, 735], 's', [[750, 0.95, 11]])
          : g === 2 ? band('oopAr', 'C–H 면외 굽힘', '메타(1,3-)이치환 벤젠', [810, 690], 's', [[780, 0.85, 11], [690, 0.8, 11], [880, 0.4, 9]], { shape: '두세 흡수 띠' })
            : band('oopAr', 'C–H 면외 굽힘', '파라(1,4-)이치환 벤젠', [860, 800], 's', [[830, 0.95, 13]], { note: '800–860 cm⁻¹ 의 강한 흡수 하나는 파라 이치환의 특징입니다.' });
      } else b = band('oopAr', 'C–H 면외 굽힘', '다치환 벤젠', [900, 800], 'm', [[850, 0.5, 18]]);
      b.atoms = r.slice(); b.diag = false; add(b);
    }
  }
  /* 나이트로 */
  for (const x of P.nitro) add(band('NO2', 'N–O 신축 (비대칭 · 대칭)', x.aryl ? '방향족 나이트로 화합물' : '나이트로 화합물', x.aryl ? [1550, 1345] : [1560, 1350], 's', x.aryl ? [[1525, 1.2, 13], [1348, 1.05, 13]] : [[1552, 1.2, 13], [1375, 1.0, 13]], { shape: '두 흡수 띠', atoms: [x.n, ...x.os], note: '1550 · 1350 cm⁻¹ 부근의 두 강한 흡수가 짝을 이룹니다.' }));
  /* C–O */
  for (const x of P.alcohol) {
    const cls = Math.max(1, x.cls), nu = cls >= 3 ? 1150 : cls === 2 ? 1100 : 1050;
    add(band('COs', 'C–O 신축', ['', '1차', '2차', '3차'][Math.min(3, cls)] + ' 알코올', cls >= 3 ? [1210, 1100] : cls === 2 ? [1150, 1075] : [1075, 1000], 's', [[nu, 0.9, 16]], { atoms: [x.c, x.o], diag: false, note: '1차 약 1050 · 2차 약 1100 · 3차 약 1150 cm⁻¹ 로, 탄소가 많이 치환될수록 높아집니다.' }));
  }
  for (const x of P.phenol) add(band('COs', 'C–O 신축', '페놀', [1260, 1180], 's', [[1230, 0.85, 16]], { atoms: [x.c, x.o], diag: false }));
  for (const x of P.ether) {
    if (x.aryl === 1) add(band('COs', 'C–O 신축', '아릴 알킬 에터', [1275, 1020], 's', [[1250, 1.0, 15], [1040, 0.8, 15]], { shape: '두 흡수 띠', atoms: [x.o, x.c1, x.c2], note: '1250 cm⁻¹ (비대칭) · 1040 cm⁻¹ (대칭) 두 흡수 띠가 나타납니다.' }));
    else if (x.aryl === 2) add(band('COs', 'C–O 신축', '다이아릴 에터', [1270, 1200], 's', [[1240, 1.0, 15]], { atoms: [x.o, x.c1, x.c2] }));
    else add(band('COs', 'C–O 신축', R.list.some(r => r.includes(x.o)) ? '고리 에터' : '다이알킬 에터', [1150, 1070], 's', [[1120, 1.0, 17]], { atoms: [x.o, x.c1, x.c2], note: '에터는 O–H · C=O 흡수가 없고 1100 cm⁻¹ 부근의 강한 C–O 흡수만 두드러집니다.' }));
  }
  for (const x of P.epoxide) add(band('COs', 'C–O 고리 신축', '에폭사이드', [1280, 810], 'm', [[1255, 0.55, 11], [880, 0.6, 13]], { shape: '두 흡수 띠', atoms: [x.o, x.a, x.b] }));
  /* C–X */
  for (const x of P.halide) {
    const T = { F: ['C–F 신축', [1400, 1000], 1100, 1.1, 28], Cl: ['C–Cl 신축', [800, 600], 730, 0.9, 16], Br: ['C–Br 신축', [690, 515], 600, 0.8, 16], I: ['C–I 신축', [600, 485], 520, 0.65, 16] }[x.el];
    add(band('CX', T[0], { F: '플루오린화물', Cl: '염화물', Br: '브로민화물', I: '아이오딘화물' }[x.el], T[1], x.el === 'I' ? 'm' : 's', [[T[2], T[3], T[4]]], { atoms: [x.c, x.x], diag: false, note: x.el === 'F' ? '' : '지문 영역 낮은 쪽에 있어 IR 만으로는 확인이 어렵습니다. 질량 스펙트럼의 M+2 피크가 더 확실합니다.' }));
  }
  /* C–H 굽힘 */
  if (h2 || h3) {
    const pk = [h2 ? [1465, Math.min(0.5, 0.2 + 0.03 * h2), 9] : null, h3 ? [1455, Math.min(0.4, 0.15 + 0.02 * h3), 9] : null].filter(Boolean);
    add(band('CHb', 'C–H 굽힘 (가위 · 비대칭)', 'CH₂ · CH₃', [1470, 1450], 'm', pk, { atoms: [...ch[2], ...ch[3]], diag: false }));
  }
  if (h3) {
    const nMe = i => cNb(m, i).filter(j => A[j].h === 3 && sp3(m, j)).length;
    const tbu = A.some((a, i) => isC(m, i) && nMe(i) >= 3), gem = A.some((a, i) => isC(m, i) && nMe(i) === 2);
    add(tbu ? band('CHb3', 'CH₃ 대칭 굽힘 (갈라짐)', 'tert-뷰틸기', [1395, 1365], 'm', [[1366, 0.45, 5], [1393, 0.33, 5]], { shape: '두 흡수 띠', atoms: ch[3], diag: false, note: 'C(CH₃)₃ 는 1395 · 1365 cm⁻¹ 로 갈라지며 낮은 쪽이 더 강합니다.' })
      : gem ? band('CHb3', 'CH₃ 대칭 굽힘 (갈라짐)', '아이소프로필기 · 이중 메틸', [1385, 1365], 'm', [[1383, 0.35, 5], [1368, 0.35, 5]], { shape: '두 흡수 띠', atoms: ch[3], diag: false, note: '한 탄소에 CH₃ 두 개가 붙으면 1385 · 1370 cm⁻¹ 로 갈라집니다.' })
        : band('CHb3', 'CH₃ 대칭 굽힘 (우산 굽힘)', 'CH₃', [1380, 1370], 'm', [[1377, 0.33, 7]], { atoms: ch[3], diag: false }));
  }
  /* 네 개 이상 이어진 CH₂: 약 720 cm⁻¹ 흔들림 */
  const isCH2 = i => isC(m, i) && A[i].h === 2 && sp3(m, i) && !R.list.some(r => r.includes(i));
  let run = 0;
  for (const s of A.map((a, i) => i).filter(isCH2)) {
    const seen = new Set([s]), st = [[s, 1]];
    while (st.length) { const [i, d] = st.pop(); run = Math.max(run, d); for (const n of m.nb[i]) if (isCH2(n.j) && !seen.has(n.j)) { seen.add(n.j); st.push([n.j, d + 1]); } }
  }
  if (run >= 4) add(band('rock', 'CH₂ 흔들림', '긴 사슬 (CH₂ 4개 이상)', [730, 720], 'w', [[722, 0.22, 6]], { atoms: A.map((a, i) => i).filter(isCH2), diag: false }));
  /* 대표 파수(가장 강한 봉우리)로 높은 쪽부터 */
  for (const b of out) { const p = b.peaks.reduce((s, x) => x[1] > s[1] ? x : s); b.nu = p[0]; }
  out.sort((p, q) => q.nu - p.nu);
  return out;
}
/* 투과율 곡선: [[파수, %T]] (4000 → 400 cm⁻¹) */
export function irCurve(bands, n = 720) {
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const nu = 4000 - 3600 * k / n;
    pts.push([nu, irT(bands, nu)]);
  }
  return pts;
}
export function irT(bands, nu) {
  let a = 0.025;
  for (const b of bands) for (const [c, h, w, g] of b.peaks) {
    const d = (nu - c) / w;
    if (Math.abs(d) > 60) continue;
    a += h * (g ? Math.exp(-0.693 * d * d) : 1 / (1 + d * d));
  }
  return 100 * Math.pow(10, -a);
}
/* 흡수 띠로 보는 진단 순서 (있다 · 없다 · 결론) */
export function irChecks(bands) {
  const has = k => bands.filter(b => b.key === k);
  const one = (q, list, yes, no) => ({ q, ok: list.length > 0, say: list.length ? yes(list) : no });
  const co = has('CO'), grp = l => [...new Set(l.map(b => b.grp))].join(' · ');
  return [
    one('3550–3200 cm⁻¹ 넓은 O–H', [...has('OH'), ...has('OHacid')], l => l.some(b => b.key === 'OHacid') ? '3300–2500 cm⁻¹ 로 매우 넓음 → 카복실산의 O–H' : grp(l) + '의 O–H', 'O–H 없음'),
    one('3500–3300 cm⁻¹ N–H', [...has('NH2'), ...has('NH')], l => l.some(b => b.key === 'NH2') ? '두 흡수 띠 → NH₂ (' + grp(l) + ')' : '흡수 띠 하나 → NH (' + grp(l) + ')', 'N–H 없음 (3차 아민이면 N–H 가 없음)'),
    one('3300 cm⁻¹ 날카로운 ≡C–H', has('CHsp'), () => '말단 알카인', '없음'),
    one('3000 cm⁻¹ 위 C–H (sp²)', [...has('CHsp2'), ...has('CHar')], l => grp(l) + '의 C–H', '없음 → 알켄 · 방향족 C–H 없음'),
    one('3000 cm⁻¹ 아래 C–H (sp³)', has('CHsp3'), () => '알킬기의 C–H', '없음'),
    one('2820 · 2720 cm⁻¹ C–H', has('CHO'), () => '알데하이드의 C–H', '없음'),
    one('2260–2100 cm⁻¹ 삼중결합', [...has('CN'), ...has('CC3')].filter(b => b.str !== 'vw'), l => l.map(b => `${b.vib.split(' ')[0]} (${b.grp})`).join(' · '), has('CC3').length ? '거의 없음 (대칭 알카인은 IR 비활성)' : '없음'),
    one('1800–1650 cm⁻¹ 강한 C=O', co, l => l.map(b => `${b.nu} cm⁻¹ → ${b.grp}`).join(' · '), '없음 → 카보닐 화합물이 아님'),
    one('1680–1450 cm⁻¹ C=C', [...has('CCdb'), ...has('CCar')].filter(b => b.str !== 'vw'), l => grp(l), has('CCdb').length ? '거의 없음 (대칭 알켄)' : '없음'),
    one('1550 · 1350 cm⁻¹ N–O', has('NO2'), () => '나이트로기', '없음')
  ];
}
/* 연습 문제용: 진단에 쓰는 흡수 띠 모음 (같으면 IR 로 구별하기 어렵다) */
export const sigKey = b => b.key === 'CO' ? 'CO:' + b.grp : ['NH2', 'NH', 'OH'].includes(b.key) ? b.key + ':' + b.grp.replace(/방향족 /, '') : b.key;
export function irSignature(bands) {
  return [...new Set(bands.filter(b => b.diag && b.str !== 'vw').map(sigKey))].sort().join(' ');
}

/* ═══ 질량 분석 ═══════════════════════════════════ */
/* 동위원소 [질량수, 자연 존재비] · 가장 흔한 동위원소의 정수 질량 · 정밀 질량 */
const ISO = {
  H: [[1, 0.999885], [2, 0.000115]], C: [[12, 0.9893], [13, 0.0107]], N: [[14, 0.99636], [15, 0.00364]], O: [[16, 0.99757], [17, 0.00038], [18, 0.00205]],
  F: [[19, 1]], Cl: [[35, 0.7576], [37, 0.2424]], Br: [[79, 0.5069], [81, 0.4931]], I: [[127, 1]], S: [[32, 0.9499], [33, 0.0075], [34, 0.0425], [36, 0.0001]],
  P: [[31, 1]], B: [[10, 0.199], [11, 0.801]], Mg: [[24, 0.7899], [25, 0.1], [26, 0.1101]]
};
const NOM = { H: 1, C: 12, N: 14, O: 16, F: 19, Cl: 35, Br: 79, I: 127, S: 32, P: 31, B: 11, Mg: 24 };
const MONO = { H: 1.00782503, C: 12, N: 14.00307401, O: 15.99491462, F: 18.99840316, Cl: 34.96885268, Br: 78.9183371, I: 126.9044719, S: 31.97207117, P: 30.97376163, B: 11.0093054, Mg: 23.9850417 };
export const nominal = c => Object.entries(c).reduce((s, [e, n]) => s + (NOM[e] || 0) * n, 0);
export const exactMass = c => Object.entries(c).reduce((s, [e, n]) => s + (MONO[e] || 0) * n, 0);
/* 동위원소 분포: [[정수 질량 차, 확률]] */
export function isotopes(c) {
  let d = new Map([[0, 1]]);
  for (const [e, n] of Object.entries(c)) {
    const pat = (ISO[e] || [[NOM[e], 1]]).map(([ms, p]) => [ms - NOM[e], p]);
    for (let k = 0; k < n; k++) {
      const nd = new Map();
      for (const [o, p] of d) for (const [dm, q] of pat) { const v = p * q; if (v < 1e-7) continue; nd.set(o + dm, (nd.get(o + dm) || 0) + v); }
      d = nd;
    }
  }
  return [...d.entries()].sort((a, b) => a[0] - b[0]);
}
function compOf(m, set, dH = 0) {
  const c = {};
  for (const i of set) { const a = m.atoms[i]; c[a.el] = (c[a.el] || 0) + 1; if (a.h) c.H = (c.H || 0) + a.h; }
  if (dH) c.H = (c.H || 0) + dH;
  return c;
}
const minus = (c, d) => { const o = { ...c }; for (const [e, n] of Object.entries(d)) o[e] = (o[e] || 0) - n; for (const e of Object.keys(o)) if (!o[e]) delete o[e]; return o; };

/* 개열 과정 (표 · 연습 문제의 보기) */
export const PROC = {
  M: { ko: '분자 이온', d: '분자에서 전자 하나가 떨어져 생긴 라디칼 양이온 M⁺• 입니다. m/z 가 분자량(정수 질량)과 같습니다.' },
  alpha: { ko: 'α-개열', d: '산소 · 질소가 붙은 탄소(α-탄소)의 이웃 C–C 결합이 끊어져, 비공유 전자쌍이 양전하를 공명 안정화한 옥소늄 · 이미늄 이온이 생깁니다. 가장 큰 알킬 라디칼이 떨어지는 쪽이 유리합니다.' },
  alphaX: { ko: 'α-개열 (할로젠)', d: '할로젠이 붙은 탄소의 이웃 C–C 결합이 끊어져 할로늄 이온 R–CH=X⁺ 이 생깁니다.' },
  acyl: { ko: '카보닐 α-개열 (아실륨 이온)', d: '카보닐 탄소와 이웃 원자 사이의 결합이 끊어져 공명 안정화된 아실륨 이온 R–C≡O⁺ 이 생깁니다.' },
  mcl: { ko: 'McLafferty 자리옮김', d: 'γ-탄소의 수소가 여섯 고리 전이 상태를 거쳐 카보닐 산소(나이트릴은 질소)로 옮겨 가고 α–β 결합이 끊어지며, 알켄이 중성 분자로 떨어집니다. 짝수 질량의 라디칼 양이온이 남습니다.' },
  dehyd: { ko: '탈수 (M − 18)', d: '알코올의 분자 이온에서 물 분자(18)가 떨어집니다.' },
  hx: { ko: 'HX 이탈', d: '할로젠화 알킬의 분자 이온에서 HX(HCl 36 · HBr 80)가 떨어집니다.' },
  cx: { ko: 'C–X 결합 개열', d: '할로젠 라디칼이 떨어지며 탄소 양이온이 생깁니다. C–Br · C–I 결합은 약해서 잘 끊어집니다.' },
  benz: { ko: '벤질 개열 (트로필륨 이온)', d: '벤질 자리의 결합이 끊어져 벤질 양이온이 생기고, 이는 일곱 원자 고리의 방향족 트로필륨 이온 C₇H₇⁺ (m/z 91)으로 재배열됩니다.' },
  aryl: { ko: '아릴–치환기 결합 개열', d: '벤젠 고리와 치환기 사이의 결합이 끊어져 페닐 양이온 C₆H₅⁺ (m/z 77) 이 생깁니다.' },
  cc: { ko: 'C–C 결합 개열 (알킬 양이온)', d: '사슬의 C–C 결합이 끊어져 알킬 양이온이 생깁니다. 더 치환된(2차 · 3차) 탄소 양이온이 생기는 가지 자리에서 잘 끊어지고, 14(CH₂) 간격의 피크 무리가 나타납니다.' },
  allyl: { ko: '알릴 개열', d: '이중결합 옆 결합이 끊어져 공명 안정화된 알릴 양이온(C₃H₅⁺, m/z 41 등)이 생깁니다.' },
  co: { ko: 'C–O 결합 개열', d: '에터 · 에스터의 알킬–산소 결합이 끊어져 탄소 양이온이 생깁니다.' },
  hloss: { ko: 'H• 이탈 (M − 1)', d: '분자 이온에서 수소 원자가 떨어집니다. 나이트릴은 α-수소를 잃어 C=C=N⁺ 공명으로 안정화된 양이온을 주고, 방향족 고리는 분자 이온이 안정해 M − 1 이 작게 나타납니다.' },
  loss: { ko: '작은 중성 분자 이탈', d: '분자 이온에서 CO · HCN · NO 같은 안정한 작은 분자가 떨어집니다.' },
  sec: { ko: '이차 조각화', d: '먼저 생긴 조각 이온이 다시 작은 중성 분자(CO 28 · C₂H₂ 26)를 잃습니다.' },
  nitro: { ko: 'NO₂ 이탈', d: '나이트로 화합물은 •NO₂(46)를 잃어 [M − 46]⁺ 이온을 줍니다.' },
  ring: { ko: '고리 개열 (에틸렌 이탈)', d: '고리가 열린 라디칼 양이온에서 에틸렌(28)이 떨어집니다.' },
  rda: { ko: '레트로 딜스–알더', d: '사이클로헥센 고리가 다이엔 라디칼 양이온과 알켄으로 갈라집니다 (딜스–알더 반응의 역과정).' }
};

/* 조각의 축약 구조식: set 의 원자로 이루어진 나무 (고리는 한 덩어리로 묶음).
   mods: { o: Map('i-j' → 결합 차수), h: Map(원자 → 수소 수 변화), q: Map(원자 → 전하) }, root: 먼저 적을 원자(라디칼 자리) */
function condensed(m, set, mods = {}, root = -1) {
  const A = m.atoms, R = rings(m);
  if ([...set].some(i => A[i].el === 'N' && A[i].q === 1 && m.nb[i].some(n => A[n.j].el === 'O'))) return null;
  const ringOf = new Map(), rs = [];
  for (const r of R.list) {
    if (!r.every(i => set.has(i))) continue;
    if (r.some(i => ringOf.has(i))) return null;
    r.forEach(i => ringOf.set(i, rs.length)); rs.push(r);
  }
  const node = i => ringOf.has(i) ? 'r' + ringOf.get(i) : 'a' + i;
  const N = new Map();
  for (const i of set) { const id = node(i); if (!N.has(id)) N.set(id, { id, atoms: [], adj: [] }); N.get(id).atoms.push(i); }
  if (N.size > 10) return null;
  const ord = (i, j) => mods.o && mods.o.has(bk(i, j)) ? mods.o.get(bk(i, j)) : m.nb[i].find(n => n.j === j).o;
  let edges = 0;
  for (const b of m.bonds) {
    if (!set.has(b.a) || !set.has(b.b)) continue;
    const u = node(b.a), v = node(b.b);
    if (u === v) continue;
    N.get(u).adj.push({ to: v, o: ord(b.a, b.b) }); N.get(v).adj.push({ to: u, o: ord(b.a, b.b) }); edges++;
  }
  if (edges !== N.size - 1) return null;
  const hOf = i => A[i].h + ((mods.h && mods.h.get(i)) || 0);
  const qOf = i => mods.q && mods.q.has(i) ? mods.q.get(i) : A[i].q || 0;
  const qs = q => q > 0 ? '⁺' : q < 0 ? '⁻' : '';
  const label = id => {
    const nd = N.get(id);
    if (id[0] === 'r') {
      const c = {}; let q = 0;
      for (const i of nd.atoms) { c[A[i].el] = (c[A[i].el] || 0) + 1; c.H = (c.H || 0) + hOf(i); q += qOf(i); }
      return fstr(c) + qs(q);
    }
    const i = nd.atoms[0], h = hOf(i);
    return A[i].el + (h ? 'H' + (h > 1 ? subN(h) : '') : '') + qs(qOf(i));
  };
  /* 첫 원자: 가장 먼 끝(탄소 우선), 전하 자리에서 먼 쪽 */
  const dist = s => { const d = new Map([[s, 0]]), q = [s]; while (q.length) { const v = q.shift(); for (const e of N.get(v).adj) if (!d.has(e.to)) { d.set(e.to, d.get(v) + 1); q.push(e.to); } } return d; };
  let start;
  if (root >= 0 && set.has(root)) start = node(root);
  else {
    const qn = [...N.values()].find(nd => nd.atoms.some(i => qOf(i)));
    const dq = qn ? dist(qn.id) : null;
    let best = -1;
    for (const nd of N.values()) {
      if (nd.adj.length > 1) continue;
      const ecc = Math.max(...dist(nd.id).values());
      const carb = nd.id[0] === 'r' || A[nd.atoms[0]].el === 'C';
      const sc = ecc * 100 + (carb ? 50 : 0) + (dq ? dq.get(nd.id) : 0);
      if (sc > best) { best = sc; start = nd.id; }
    }
    if (!start) start = N.keys().next().value;
  }
  const BS = { 1: '', 2: '=', 3: '≡' };
  const size = (v, p) => 1 + N.get(v).adj.filter(e => e.to !== p).reduce((s, e) => s + size(e.to, v), 0);
  const wr = (v, p) => {
    let s = label(v);
    const kids = N.get(v).adj.filter(e => e.to !== p).map(e => ({ n: size(e.to, v), t: BS[e.o] + wr(e.to, v) }));
    kids.sort((x, y) => x.n - y.n || x.t.length - y.t.length);
    const last = kids.pop();
    const groups = [];
    for (const k of kids) { const g = groups.find(x => x.t === k.t); if (g) g.n++; else groups.push({ t: k.t, n: 1 }); }
    const merge = last && last.n === 1 && groups.find(g => g.t === last.t);
    if (merge) merge.n++;
    s += groups.map(g => '(' + g.t + ')' + (g.n > 1 ? subN(g.n) : '')).join('');
    if (last && !merge) s += last.t;
    return s;
  };
  return (root >= 0 ? '•' : '') + wr(start, null);
}

/* 분자 이온의 세기 (다른 조각과 견준 점수): 방향족은 강하고, 3차 알코올 · 가지 친 알케인은 약하다 */
function mScore(m, P) {
  const A = m.atoms, kinds = new Set(P.carbonyl.map(x => x.kind));
  if (P.arenes.length) {
    const benzCC = P.arenes.some(r => r.some(a => m.nb[a].some(n => !r.includes(n.j) && isC(m, n.j) && sp3(m, n.j) && cNb(m, n.j).some(j => !r.includes(j)))));
    if (P.halide.some(h => !h.aryl)) return 20;
    if (P.phenol.length || P.amine.some(x => x.aryl)) return 100;
    if (kinds.has('aldehyde')) return 85;
    if (kinds.has('acid')) return 70;
    if (P.nitro.length) return 60;
    if (kinds.size) return 40;
    if (P.alcohol.length) return 30;
    return benzCC ? 35 : 80;
  }
  const v = [];
  if (P.alcohol.length) v.push(Math.min(...P.alcohol.map(x => P.R.list.some(r => r.includes(x.c)) ? 8 : x.cls >= 3 ? 0.3 : 3)));
  if (P.amine.length) v.push(10);
  if (P.ether.length || P.epoxide.length) v.push(10);
  for (const k of kinds) v.push({ ketone: 30, aldehyde: 20, ester: 10, acid: 8, amide: 35, acylhalide: 5 }[k]);
  if (P.nitrile.length) v.push(5);
  if (P.nitro.length) v.push(1);
  for (const h of P.halide) v.push({ F: 5, Cl: 10, Br: 15, I: 40 }[h.el]);
  if (v.length) return Math.min(...v);
  if (P.alkyne.length) return 15;
  if (P.alkene.length) return P.R.list.length ? 40 : 30;
  if (P.R.list.length) return 50;
  const nb = i => cNb(m, i).length;
  if (A.some((a, i) => isC(m, i) && nb(i) === 4)) return 1.5;
  if (A.some((a, i) => isC(m, i) && nb(i) === 3)) return 7;
  return 20;
}

export function massSpec(mol) {
  const m = mol, A = m.atoms, P = perceive(m), R = P.R;
  const all = new Set(A.map((_, i) => i));
  const M0 = compOf(m, all), M = nominal(M0);
  const frags = [];
  const ringBond = k => { const b = m.bonds[k]; return R.list.some(r => r.includes(b.a) && r.includes(b.b)); };
  const side = (k, from) => { const s = new Set([from]), st = [from]; while (st.length) { const i = st.pop(); for (const n of m.nb[i]) if (n.k !== k && !s.has(n.j)) { s.add(n.j); st.push(n.j); } } return s; };
  const hetFG = P.alcohol.length + P.phenol.length + P.acidOH.length + P.amine.length + P.amideN.length + P.ether.length + P.carbonyl.length + P.nitrile.length + P.nitro.length + P.halide.length > 0;
  /* 조각 하나 넣기: c(조성) · text(이온) · lost(떨어진 조각) · atoms(이온에 남은 원자, 강조용) */
  const push = (proc, c, score, text, lost, atoms, extra = {}) => { if (score > 0.05) frags.push({ proc, c, mz: nominal(c), score, text: text || `[${fstr(c)}]${extra.rad ? '⁺•' : '⁺'}`, lost, atoms: [...atoms], ...extra }); };
  const ionText = (set, mods) => condensed(m, set, mods);
  const radText = (set, r) => set.size === 1 && HAL.has(A[r].el) ? '•' + A[r].el : condensed(m, set, {}, r) || `•${fstr(compOf(m, set))}`;
  /* 떨어지는 라디칼의 안정도 (클수록 잘 떨어짐) */
  const radF = (lost, r) => {
    const a = A[r];
    if (a.el === 'O') return a.h ? 0.35 : 1.0;
    if (a.el === 'N') return a.h === 2 ? 0.5 : 0.6;
    if (HAL.has(a.el)) return { F: 0.2, Cl: 1.3, Br: 1.4, I: 1.5 }[a.el];
    if (a.el !== 'C') return 0.5;
    const hv = m.nb[r].filter(n => lost.has(n.j));
    if (arom(m, r) || hv.some(n => n.o >= 2)) return hv.some(n => n.o === 2 && A[n.j].el === 'O') ? 0.6 : hv.some(n => n.o === 3 && A[n.j].el === 'N') ? 0.2 : 0.3;
    const nC = hv.length, size = [...lost].filter(i => isC(m, i)).length;
    let f = nC === 0 ? 0.15 : nC === 1 ? Math.min(1, 0.8 + 0.05 * (size - 2)) : nC === 2 ? 1 : 1.15;
    if (hv.some(n => arom(m, n.j) || m.nb[n.j].some(q => q.o >= 2 && q.j !== r))) f = Math.max(f, 1.1);
    if (hv.some(n => A[n.j].el === 'O' || A[n.j].el === 'N')) f = Math.max(f, 0.8);
    return f;
  };
  /* 탄소 양이온의 안정도 (이온 쪽 원자 c 에 양전하) */
  const catS = (ion, c) => {
    if (!isC(m, c)) return 0;
    if (arom(m, c)) return 30;
    if (!sp3(m, c)) return 2;
    const nb = m.nb[c].filter(n => ion.has(n.j) && isC(m, n.j));
    const nC = [...ion].filter(i => isC(m, i)).length;
    let s = nb.length === 0 ? 2 : nb.length === 1 ? 12 + 8 * Math.min(4, nC - 1) : nb.length === 2 ? 45 + 3 * Math.min(4, nC - 3) : 75;
    if (nb.some(n => arom(m, n.j))) s += 60;
    else if (nb.some(n => m.nb[n.j].some(q => q.o === 2 && q.j !== c && isC(m, q.j) && ion.has(q.j)))) s += 35;
    else if (nb.some(n => m.nb[n.j].some(q => q.o === 3 && ion.has(q.j)))) s += 25;
    if (m.nb[c].some(n => ion.has(n.j) && (A[n.j].el === 'O' || A[n.j].el === 'N') && !A[n.j].q)) s += 40;
    else if (m.nb[c].some(n => ion.has(n.j) && ['Cl', 'Br', 'I'].includes(A[n.j].el))) s += 25;
    if (nb.some(n => P.info[n.j] && (P.info[n.j].oxo.length || P.info[n.j].nitN >= 0))) s *= 0.2;
    return s;
  };

  /* 분자 이온 */
  push('M', M0, mScore(m, P), `[${fstr(M0)}]⁺•`, '', all, { rad: true });

  /* α-개열: 알코올 · 에터 · 아민 */
  const het = [...P.alcohol.map(x => ({ y: x.o, base: 70 })), ...P.ether.map(x => ({ y: x.o, base: 55 })), ...P.amine.filter(x => !x.aryl).map(x => ({ y: x.n, base: 100 }))];
  for (const h of het) for (const n of m.nb[h.y]) {
    const ca = n.j;
    if (!isC(m, ca) || !sp3(m, ca)) continue;
    const mods = { o: new Map([[bk(ca, h.y), 2]]), q: new Map([[h.y, 1]]) };
    for (const r of m.nb[ca]) {
      if (r.j === h.y || !isC(m, r.j) || ringBond(r.k)) continue;
      const lost = side(r.k, r.j), ion = side(r.k, ca);
      if (lost.has(ca)) continue;
      const rem = cNb(m, ca).filter(j => j !== r.j).length;
      push('alpha', compOf(m, ion), h.base * radF(lost, r.j) * (1 + 0.25 * rem), ionText(ion, mods), radText(lost, r.j), ion);
    }
    if (A[ca].h && h.base >= 70) push('alpha', compOf(m, all, -1), h.base * 0.03, ionText(all, { ...mods, h: new Map([[ca, -1]]) }), 'H•', all);
  }
  /* 카보닐 α-개열 → 아실륨 이온 */
  const ACYL_C = { ketone: 80, aldehyde: 30, ester: 25, acid: 25, amide: 40, acylhalide: 10 };
  const acyls = [];
  for (const x of P.carbonyl) {
    const c = x.c, mods = { o: new Map([[bk(c, x.o), 3]]), q: new Map([[x.o, 1]]) };
    for (const n of m.nb[c]) {
      if (n.j === x.o || ringBond(n.k)) continue;
      const lost = side(n.k, n.j), ion = side(n.k, c), X = A[n.j];
      const aryl = m.nb[c].some(q => q.j !== n.j && ion.has(q.j) && arom(m, q.j));
      let base = X.el === 'C' ? ACYL_C[x.kind] : X.el === 'O' ? 80 : X.el === 'N' ? 60 : 100;
      let f = radF(lost, n.j);
      if (aryl) { base = 110; f = Math.max(f, 0.8); }
      const fr = { c: compOf(m, ion), score: base * f, text: ionText(ion, mods), lost: radText(lost, n.j), ion, c0: c, o: x.o, aryl };
      push('acyl', fr.c, fr.score, fr.text, fr.lost, ion);
      acyls.push(fr);
    }
    if (x.kind === 'aldehyde') {
      const aryl = cNb(m, c).some(j => arom(m, j));
      const fr = { c: compOf(m, all, -1), score: aryl ? 88 : 80 * 0.06, text: ionText(all, { ...mods, h: new Map([[c, -1]]) }), lost: 'H•', ion: all, c0: c, o: x.o, aryl };
      push('acyl', fr.c, fr.score, fr.text, fr.lost, all);
      acyls.push(fr);
    }
  }
  /* 이차: 아실륨 → CO 이탈 (ArCO⁺ → Ar⁺, RCO⁺ → R⁺) */
  for (const f of acyls) {
    const rest = [...f.ion].filter(i => i !== f.c0 && i !== f.o);
    if (!rest.length || !rest.some(i => isC(m, i))) continue;
    const at = m.nb[f.c0].find(n => rest.includes(n.j));
    if (!at || !isC(m, at.j)) continue;
    const set = new Set(rest);
    const s = f.aryl ? f.score * 0.55 : f.score * 0.3 * Math.min(1.5, catS(set, at.j) / 45);
    push('sec', compOf(m, set), s, condensed(m, set, { q: new Map([[at.j, 1]]) }), 'CO', set, { from: f.text });
  }
  /* McLafferty 자리옮김 (γ-수소) */
  const MCL = { ketone: 70, aldehyde: 90, acid: 95, ester: 85, amide: 85, nitrile: 60 };
  for (const x of [...P.carbonyl.filter(k => k.kind !== 'acylhalide'), ...P.nitrile.map(n => ({ c: n.c, o: n.n, kind: 'nitrile' }))]) {
    const c = x.c;
    for (const a1 of cNb(m, c)) {
      if (!sp3(m, a1)) continue;
      for (const nb of m.nb[a1]) {
        const b1 = nb.j;
        if (b1 === c || !isC(m, b1) || !sp3(m, b1) || ringBond(nb.k)) continue;
        const lost = side(nb.k, b1);
        if (lost.has(c)) continue;
        const gs = cNb(m, b1).filter(g => g !== a1 && A[g].h > 0);
        if (!gs.length) continue;
        const ion = side(nb.k, a1), g = gs[0];
        const mods = { o: new Map([[bk(c, x.o), x.kind === 'nitrile' ? 2 : 1], [bk(c, a1), 2]]), h: new Map([[x.o, 1]]) };
        const t = ionText(ion, mods);
        const alk = condensed(m, lost, { o: new Map([[bk(b1, g), 2]]), h: new Map([[g, -1]]) }) || fstr(compOf(m, lost, -1));
        push('mcl', compOf(m, ion, 1), MCL[x.kind] * (1 + 0.1 * (gs.length - 1)), t ? `[${t}]⁺•` : null, alk, ion, { rad: true });
      }
    }
  }
  /* 탈수 · HX 이탈 */
  for (const x of P.alcohol) {
    if (!cNb(m, x.c).some(j => A[j].h > 0 && sp3(m, j))) continue;
    const nC = M0.C || 0, cyc = R.list.some(r => r.includes(x.c));
    push('dehyd', minus(M0, { H: 2, O: 1 }), cyc ? 30 : x.cls >= 3 ? 8 : x.cls === 2 ? 12 : nC >= 4 ? 30 : 15, null, 'H₂O', [...all].filter(i => i !== x.o), { rad: true });
  }
  for (const x of P.halide) {
    if (x.aryl || x.vinyl || !cNb(m, x.c).some(j => A[j].h > 0 && sp3(m, j))) continue;
    push('hx', minus(M0, { H: 1, [x.el]: 1 }), { F: 10, Cl: 8, Br: 6, I: 3 }[x.el], null, 'H' + x.el, [...all].filter(i => i !== x.x), { rad: true });
  }
  /* C–X 개열 · 할로젠 α-개열 */
  for (const x of P.halide) {
    const ion = side(x.k, x.c);
    const st = x.aryl ? 30 : x.vinyl ? 3 : catS(ion, x.c);
    push('cx', compOf(m, ion), st * { F: 0.1, Cl: 0.55, Br: 1.0, I: 1.2 }[x.el], ionText(ion, { q: new Map([[x.c, 1]]) }), '•' + x.el, ion);
    if (x.aryl || x.vinyl || x.el === 'F') continue;
    for (const r of m.nb[x.c]) {
      if (r.j === x.x || !isC(m, r.j) || ringBond(r.k)) continue;
      const lost = side(r.k, r.j), ion2 = side(r.k, x.c);
      push('alphaX', compOf(m, ion2), (x.el === 'Cl' ? 12 : 8) * radF(lost, r.j), ionText(ion2, { o: new Map([[bk(x.c, x.x), 2]]), q: new Map([[x.x, 1]]) }), radText(lost, r.j), ion2);
    }
  }
  /* 벤질 개열 → 트로필륨, 방향족 고리–치환기 개열 → 페닐 양이온 */
  const trop = c => c.C === 7 && c.H === 7 && Object.keys(c).length === 2;
  for (const r of P.arenes) {
    const methyls = r.filter(a => m.nb[a].some(n => !r.includes(n.j) && A[n.j].h === 3 && isC(m, n.j)));
    for (const ai of r) for (const n of m.nb[ai]) {
      if (r.includes(n.j) || ringBond(n.k)) continue;
      const b = n.j;
      if (isC(m, b) && sp3(m, b)) {
        const cand = m.nb[b].filter(q => q.j !== ai && isC(m, q.j) && !ringBond(q.k)).map(q => { const lost = side(q.k, q.j); return { q, lost, f: radF(lost, q.j) }; });
        const best = Math.max(0, ...cand.map(x => x.f));
        for (const { q, lost, f } of cand) {
          const ion = side(q.k, b), c = compOf(m, ion);
          const keep = m.nb[b].filter(n => n.j !== ai && n.j !== q.j).length;
          push('benz', c, 100 * Math.pow(f / best, 2) * (1 + 0.3 * keep), trop(c) ? 'C₇H₇⁺ (트로필륨 이온)' : ionText(ion, { q: new Map([[b, 1]]) }), radText(lost, q.j), ion);
        }
        if (A[b].h === 3) {
          const c = compOf(m, all, -1);
          push('benz', c, methyls.length > 1 ? 35 : 100, trop(c) ? 'C₇H₇⁺ (트로필륨 이온)' : null, 'H•', all);
          if (methyls.length > 1) { const ion = side(n.k, ai), c2 = compOf(m, ion); push('benz', c2, 100 / methyls.length, trop(c2) ? 'C₇H₇⁺ (트로필륨 이온)' : null, '•CH₃', ion); }
        }
      }
      if (HAL.has(A[b].el) || (A[b].el === 'N' && A[b].q === 1) || (methyls.length > 1 && A[b].h === 3)) continue;
      const lost = side(n.k, b), ion = side(n.k, ai);
      push('aryl', compOf(m, ion), (isC(m, b) && sp3(m, b) ? 8 : 25) * radF(lost, b), ionText(ion, { q: new Map([[ai, 1]]) }), radText(lost, b), ion);
    }
  }
  /* 알킬 C–C 개열 (탄화수소 조각이 양이온) */
  m.bonds.forEach((b, k) => {
    if (b.o !== 1 || b.arom || !isC(m, b.a) || !isC(m, b.b) || ringBond(k)) return;
    const seen = new Set();
    for (const [c, r] of [[b.a, b.b], [b.b, b.a]]) {
      const ion = side(k, c), lost = side(k, r);
      if (![...ion].every(i => isC(m, i)) || !sp3(m, c)) continue;
      if (m.nb[c].some(n => ion.has(n.j) && arom(m, n.j))) continue; /* 벤질: 위에서 */
      const st = catS(ion, c);
      const text = ionText(ion, { q: new Map([[c, 1]]) }) || `${fstr(compOf(m, ion))}⁺`;
      if (seen.has(text)) continue;
      seen.add(text);
      const allyl = m.nb[c].some(n => ion.has(n.j) && m.nb[n.j].some(q => q.o === 2 && q.j !== c));
      push(allyl ? 'allyl' : 'cc', compOf(m, ion), st * radF(lost, r) * (hetFG ? 0.5 : 1), text, radText(lost, r), ion);
    }
  });
  /* C–O 개열: 에터 · 에스터의 알킬–O */
  const coCut = (cc, o) => {
    if (arom(m, cc)) return;
    const nb = m.nb[cc].find(n => n.j === o);
    if (!nb || ringBond(nb.k)) return;
    const ion = side(nb.k, cc), lost = side(nb.k, o);
    push('co', compOf(m, ion), catS(ion, cc) * 0.35, ionText(ion, { q: new Map([[cc, 1]]) }), radText(lost, o), ion);
  };
  for (const x of P.ether) { coCut(x.c1, x.o); coCut(x.c2, x.o); }
  for (const x of P.carbonyl.filter(k => k.kind === 'ester')) for (const r of x.f.OR) coCut(r.c, r.o);
  /* 나이트로: •NO₂ 이탈, NO 이탈 */
  for (const x of P.nitro) {
    if (x.k < 0) continue;
    const ion = side(x.k, x.c);
    push('nitro', compOf(m, ion), x.aryl ? 90 : catS(ion, x.c), ionText(ion, { q: new Map([[x.c, 1]]) }), '•NO₂', ion);
    if (x.aryl) push('loss', minus(M0, { N: 1, O: 1 }), 12, null, 'NO', [...all].filter(i => i !== x.n));
  }
  /* 작은 분자 이탈: 페놀 CO, 아닐린 · 벤조나이트릴 HCN */
  if (P.phenol.length) { push('loss', minus(M0, { C: 1, O: 1 }), 30, null, 'CO', all, { rad: true }); push('loss', minus(M0, { C: 1, O: 1, H: 1 }), 20, null, '•CHO', all); }
  if (P.amine.some(x => x.aryl && x.h === 2) || P.nitrile.some(x => cNb(m, x.c).some(j => arom(m, j)))) push('loss', minus(M0, { H: 1, C: 1, N: 1 }), 30, null, 'HCN', all, { rad: true });
  if (P.nitrile.some(x => cNb(m, x.c).some(j => sp3(m, j) && A[j].h))) push('hloss', compOf(m, all, -1), 20, null, 'H•', all);
  if (P.arenes.length && !frags.some(f => f.proc !== 'M')) push('hloss', compOf(m, all, -1), 15, null, 'H•', all);
  /* 고리: 사이클로알케인의 에틸렌 이탈, 사이클로헥센의 레트로 딜스–알더 */
  if (!hetFG && !P.arenes.length) {
    for (const r of R.list) {
      if (r.length === 6) {
        const dbl = r.findIndex((a, i) => m.nb[a].some(n => n.j === r[(i + 1) % 6] && n.o === 2));
        if (dbl >= 0) {
          const at = k => r[(dbl + k + 6) % 6];
          const cut = new Set([bk(at(2), at(3)), bk(at(4), at(5))]);
          const s0 = new Set([at(0)]), st = [at(0)];
          while (st.length) { const i = st.pop(); for (const n of m.nb[i]) if (!cut.has(bk(i, n.j)) && !s0.has(n.j)) { s0.add(n.j); st.push(n.j); } }
          if (!s0.has(at(3))) { push('rda', compOf(m, s0), 70, null, fstr(minus(M0, compOf(m, s0))), s0, { rad: true }); continue; }
        }
      }
      if (r.length >= 5 && r.every(a => sp3(m, a))) { push('ring', minus(M0, { C: 2, H: 4 }), 100, null, 'CH₂=CH₂', all, { rad: true }); push('allyl', { C: 3, H: 5 }, 40, 'C₃H₅⁺ (알릴 양이온)', '', r.slice(0, 3)); break; }
    }
  }
  for (const x of P.carbonyl.filter(k => k.kind === 'ketone')) {
    const r = R.list.find(q => q.includes(x.c));
    if (r && r.length >= 5 && !P.arenes.some(a => a.includes(x.c))) { push('ring', minus(M0, { C: 1, O: 1 }), 45, null, 'CO', [...all].filter(i => i !== x.o), { rad: true }); break; }
  }
  /* 이차: C₂H₂ 이탈 (C₆H₅⁺ 77 → 51, C₇H₇⁺ 91 → 65) */
  for (const f of frags.slice()) {
    const c = f.c;
    if (Object.keys(c).length !== 2) continue;
    if ((c.C === 6 && c.H === 5) || (c.C === 7 && c.H === 7)) push('sec', { C: c.C - 2, H: c.H - 2 }, f.score * (c.C === 6 ? 0.35 : 0.12), `C${subN(c.C - 2)}H${subN(c.H - 2)}⁺`, 'HC≡CH', f.atoms, { from: f.text });
  }

  /* 같은 이온 합치기 */
  const merged = new Map();
  for (const f of frags) {
    const key = f.mz + '|' + f.proc + '|' + f.text;
    const g = merged.get(key);
    if (g) { g.score += f.score; g.atoms = [...new Set([...g.atoms, ...f.atoms])]; } else merged.set(key, { ...f });
  }
  const ions = [...merged.values()];
  for (const f of ions) {
    if (f.text === `[${fstr(f.c)}]⁺`) { const nm = trop(f.c) ? 'C₇H₇⁺ (트로필륨 이온)' : f.c.C === 6 && f.c.H === 5 && Object.keys(f.c).length === 2 ? 'C₆H₅⁺ (페닐 양이온)' : null; if (nm) f.text = nm; }
    if (f.text === 'C₆H₅⁺') f.text = 'C₆H₅⁺ (페닐 양이온)';
    if (f.text === 'C₆H₅C≡O⁺') f.text = 'C₆H₅C≡O⁺ (벤조일 양이온)';
  }
  /* 동위원소까지 펼쳐 피크 모으기 */
  const pk = new Map();
  for (const f of ions) {
    f.iso = isotopes(f.c);
    for (const [off, p] of f.iso) {
      const mz = f.mz + off, I = f.score * p;
      if (!pk.has(mz)) pk.set(mz, { mz, I: 0, parts: [] });
      const e = pk.get(mz); e.I += I; e.parts.push({ f, off, I });
    }
  }
  const top = Math.max(...[...pk.values()].map(x => x.I));
  const peaks = [...pk.values()].map(x => { x.parts.sort((a, b) => b.I - a.I); return { mz: x.mz, rel: 100 * x.I / top, main: x.parts[0], parts: x.parts }; })
    .filter(x => x.rel >= 0.8 || (x.mz >= M && x.mz <= M + 4 && x.rel >= 0.05)).sort((a, b) => a.mz - b.mz);
  for (const f of ions) { const p0 = f.iso.find(x => x[0] === 0); f.rel = 100 * f.score * (p0 ? p0[1] : 0) / top; }
  const Mion = ions.find(f => f.proc === 'M');
  const pM = isotopes(M0), at = o => (pM.find(x => x[0] === o) || [0, 0])[1];
  const base = peaks.reduce((s, x) => x.rel > s.rel ? x : s, peaks[0]);
  const list = ions.filter(f => f.proc === 'M' || f.rel >= 3).sort((a, b) => b.mz - a.mz || b.rel - a.rel);
  return {
    M, comp: M0, formula: fstr(M0), exact: exactMass(M0), peaks, ions: list, base, mRel: Mion.rel,
    m1: 100 * at(1) / at(0), m2: 100 * at(2) / at(0), m4: 100 * at(4) / at(0),
    nN: M0.N || 0, nCl: M0.Cl || 0, nBr: M0.Br || 0, nS: M0.S || 0, ihd: unsaturation(m),
    ringSkip: !P.arenes.length && R.list.length > 0 && hetFG, alts: altFormulas(M0)
  };
}
/* 같은 정수 질량의 다른 분자식 (C · H · N · O 만): 고분해능 질량 분석으로 구별 */
export function altFormulas(c0) {
  if (Object.keys(c0).some(e => !['C', 'H', 'N', 'O'].includes(e))) return [];
  const M = nominal(c0), ex = exactMass(c0), out = [];
  for (let n = 0; n <= 4; n++) for (let o = 0; o <= 6; o++) for (let c = 1; 12 * c <= M; c++) {
    const h = M - 12 * c - 14 * n - 16 * o;
    if (h < 0 || h > 2 * c + 2 + n || (2 * c + 2 + n - h) % 2) continue;
    const cc = { C: c, H: h }; if (n) cc.N = n; if (o) cc.O = o;
    out.push({ c: cc, f: fstr(cc), exact: exactMass(cc), self: fstr(cc) === fstr(c0), ihd: (2 * c + 2 + n - h) / 2 });
  }
  out.sort((a, b) => Math.abs(a.exact - ex) - Math.abs(b.exact - ex));
  const self = out.find(x => x.self);
  const rest = out.filter(x => !x.self && x.c.H > 0).slice(0, 4);
  return [self, ...rest].filter(Boolean).sort((a, b) => a.exact - b.exact);
}
/* 동위원소 무늬 이름 */
export function isoPattern(ms) {
  if (ms.nCl === 1 && !ms.nBr) return 'M : M+2 ≈ 3 : 1 → 염소 원자 1개 (³⁵Cl 75.8% · ³⁷Cl 24.2%)';
  if (ms.nCl === 2 && !ms.nBr) return 'M : M+2 : M+4 ≈ 9 : 6 : 1 → 염소 원자 2개';
  if (ms.nBr === 1 && !ms.nCl) return 'M : M+2 ≈ 1 : 1 → 브로민 원자 1개 (⁷⁹Br 50.7% · ⁸¹Br 49.3%)';
  if (ms.nBr === 2 && !ms.nCl) return 'M : M+2 : M+4 ≈ 1 : 2 : 1 → 브로민 원자 2개';
  if (ms.nBr && ms.nCl) return `염소 ${ms.nCl}개와 브로민 ${ms.nBr}개가 함께 있어 M+2 · M+4 가 모두 큽니다`;
  if (ms.nS) return `M+2 ≈ ${ms.m2.toFixed(1)}% → 황 (³⁴S 4.2%)`;
  return '';
}
/* 질량 분석 참고 표: 자주 보이는 중성 조각 손실 · 조각 이온 */
export const MS_LOSSES = [
  ['M − 1', 'H•', '알데하이드 · 아민 · 나이트릴'], ['M − 15', '•CH₃', '메틸기가 있는 가지 자리'], ['M − 17', '•OH', '카복실산'], ['M − 18', 'H₂O', '알코올'],
  ['M − 28', 'CO · CH₂=CH₂', '케톤 · 페놀 / 고리 · McLafferty'], ['M − 29', '•C₂H₅ · •CHO', '에틸기 / 알데하이드'], ['M − 31', '•OCH₃', '메틸 에스터'], ['M − 35 · 37', '•Cl', '염화물'],
  ['M − 36', 'HCl', '염화 알킬'], ['M − 43', '•C₃H₇ · •COCH₃', '프로필기 / 메틸 케톤'], ['M − 45', '•OC₂H₅ · •COOH', '에틸 에스터 / 카복실산'], ['M − 46', '•NO₂', '나이트로 화합물'], ['M − 79 · 81', '•Br', '브로민화물']
];
export const MS_IONS = [
  ['15', 'CH₃⁺', ''], ['29', 'C₂H₅⁺ · HC≡O⁺', '알킬 · 알데하이드'], ['30', 'CH₂=NH₂⁺', '1차 아민의 α-개열'], ['31', 'CH₂=OH⁺', '1차 알코올의 α-개열'], ['41', 'C₃H₅⁺', '알릴 양이온'],
  ['43', 'C₃H₇⁺ · CH₃C≡O⁺', '프로필 · 아세틸 (메틸 케톤)'], ['44', '[CH₂=CHOH]⁺•', '알데하이드의 McLafferty'], ['57', 'C₄H₉⁺ · C₂H₅C≡O⁺', '뷰틸 · 프로파노일'], ['58', '[CH₂=C(OH)CH₃]⁺•', '메틸 케톤의 McLafferty'],
  ['60', '[CH₂=C(OH)₂]⁺•', '카복실산의 McLafferty'], ['74', '[CH₂=C(OH)OCH₃]⁺•', '메틸 에스터의 McLafferty'], ['77', 'C₆H₅⁺', '페닐 양이온'], ['91', 'C₇H₇⁺', '트로필륨 이온 (알킬벤젠)'], ['105', 'C₆H₅C≡O⁺', '벤조일 양이온']
];
