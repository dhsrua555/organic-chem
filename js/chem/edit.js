/* 분자 편집: 조각 붙이기, 결합 차수 바꾸기, 가지 지우기, E/Z 뒤집기. 매번 새 분자를 돌려준다 (되돌리기용) */
import { parseSmiles, clone, addBond, setOrder, fixH, removeAtoms, rings, perceiveAromatic, maxValence } from './core.js';
import { layout, stereoFromCoords, branch } from './layout.js';
import { checkSupported } from './name.js';

/* 붙일 조각: 첫 원자가 붙는 자리. order 2 는 수소 둘을 바꿔 이중결합으로 (=O) */
export const FRAGMENTS = {
  CH3: { smi: 'C', label: 'CH3', ko: '메틸 (탄소 하나 늘리기)', group: 'c' },
  C2H5: { smi: 'CC', label: 'C2H5', ko: '에틸', group: 'c' },
  vinyl: { smi: 'C=C', label: 'CH=CH2', ko: '에텐일 (바이닐)', group: 'c' },
  ethynyl: { smi: 'C#C', label: 'C≡CH', ko: '에타인일', group: 'c' },
  phenyl: { smi: 'c1ccccc1', label: 'C6H5', ko: '페닐 (벤젠 고리)', group: 'c' },
  cyclohexyl: { smi: 'C1CCCCC1', label: 'C6H11', ko: '사이클로헥실', group: 'c' },
  cyclopropyl: { smi: 'C1CC1', label: 'C3H5', ko: '사이클로프로필', group: 'c' },
  OH: { smi: 'O', label: 'OH', ko: '하이드록시 → 알코올', group: 'o' },
  oxo: { smi: 'O', order: 2, label: '=O', ko: '카보닐 (H 둘 대신 =O)', group: 'o' },
  OCH3: { smi: 'OC', label: 'OCH3', ko: '메톡시 → 에터', group: 'o' },
  OAc: { smi: 'OC(C)=O', label: 'OCOCH3', ko: '아세틸옥시 → 에스터', group: 'o' },
  NH2: { smi: 'N', label: 'NH2', ko: '아미노 → 아민', group: 'o' },
  NO2: { smi: '[N+](=O)[O-]', label: 'NO2', ko: '나이트로', group: 'o' },
  CN: { smi: 'C#N', label: 'CN', ko: '사이아노 → 나이트릴', group: 'y' },
  CHO: { smi: 'C=O', label: 'CHO', ko: '폼일 → 알데하이드', group: 'y' },
  COCH3: { smi: 'C(C)=O', label: 'COCH3', ko: '아세틸 → 케톤', group: 'y' },
  COOH: { smi: 'C(=O)O', label: 'COOH', ko: '카복시 → 카복실산', group: 'y' },
  COOCH3: { smi: 'C(=O)OC', label: 'COOCH3', ko: '메톡시카보닐 → 에스터', group: 'y' },
  COCl: { smi: 'C(=O)Cl', label: 'COCl', ko: '염화 아실 → 산 할로젠화물', group: 'y' },
  CONH2: { smi: 'C(N)=O', label: 'CONH2', ko: '카바모일 → 아마이드', group: 'y' },
  F: { smi: 'F', label: 'F', ko: '플루오로', group: 'x' },
  Cl: { smi: 'Cl', label: 'Cl', ko: '클로로', group: 'x' },
  Br: { smi: 'Br', label: 'Br', ko: '브로모', group: 'x' },
  I: { smi: 'I', label: 'I', ko: '아이오도', group: 'x' }
};
export const FRAG_GROUPS = [['c', '탄소 뼈대'], ['o', '산소 · 질소'], ['y', '카보닐 · 사이아노'], ['x', '할로젠']];

/* 시작 분자 (뼈대 · 유명한 분자) */
export const TEMPLATES = [
  { id: 'methane', smi: 'C', ko: '메테인', kind: 'base' },
  { id: 'ethane', smi: 'CC', ko: '에테인', kind: 'base' },
  { id: 'ethene', smi: 'C=C', ko: '에텐', kind: 'base' },
  { id: 'ethyne', smi: 'C#C', ko: '에타인', kind: 'base' },
  { id: 'propane', smi: 'CCC', ko: '프로페인', kind: 'base' },
  { id: 'propene', smi: 'C=CC', ko: '프로펜', kind: 'base' },
  { id: 'butane', smi: 'CCCC', ko: '뷰테인', kind: 'base' },
  { id: 'butadiene', smi: 'C=CC=C', ko: '뷰타-1,3-다이엔', kind: 'base' },
  { id: 'cyclohexane', smi: 'C1CCCCC1', ko: '사이클로헥세인', kind: 'base' },
  { id: 'cyclohexene', smi: 'C1=CCCCC1', ko: '사이클로헥센', kind: 'base' },
  { id: 'cyclopentane', smi: 'C1CCCC1', ko: '사이클로펜테인', kind: 'base' },
  { id: 'benzene', smi: 'c1ccccc1', ko: '벤젠', kind: 'base' },
  { id: 'ibuprofen', smi: 'CC(C)Cc1ccc(cc1)C(C)C(=O)O', ko: '이부프로펜', kind: 'famous', note: '진통 · 소염제' },
  { id: 'aspirin', smi: 'CC(=O)Oc1ccccc1C(=O)O', ko: '아스피린', kind: 'famous', note: '해열 · 진통제' },
  { id: 'paracetamol', smi: 'CC(=O)Nc1ccc(O)cc1', ko: '아세트아미노펜', kind: 'famous', note: '해열 진통제 (타이레놀)' },
  { id: 'vanillin', smi: 'COc1cc(C=O)ccc1O', ko: '바닐린', kind: 'famous', note: '바닐라 향' },
  { id: 'capsaicin', smi: 'COc1cc(CNC(=O)CCCC/C=C/C(C)C)ccc1O', ko: '캡사이신', kind: 'famous', note: '고추의 매운맛' },
  { id: 'geraniol', smi: 'CC(C)=CCC/C(C)=C/CO', ko: '제라니올', kind: 'famous', note: '장미 향' },
  { id: 'limonene', smi: 'CC1=CCC(CC1)C(=C)C', ko: '리모넨', kind: 'famous', note: '귤 껍질 향' },
  { id: 'menthol', smi: 'CC(C)C1CCC(C)CC1O', ko: '멘톨', kind: 'famous', note: '박하' },
  { id: 'dopamine', smi: 'NCCc1ccc(O)c(O)c1', ko: '도파민', kind: 'famous', note: '신경전달물질' },
  { id: 'benzocaine', smi: 'CCOC(=O)c1ccc(N)cc1', ko: '벤조카인', kind: 'famous', note: '국소 마취제' },
  { id: 'ethylacetate', smi: 'CCOC(C)=O', ko: '아세트산 에틸', kind: 'famous', note: '매니큐어 제거제 향' },
  { id: 'citric', smi: 'OC(=O)CC(O)(CC(=O)O)C(=O)O', ko: '시트르산', kind: 'famous', note: '레몬의 신맛' },
  { id: 'tnt', smi: 'Cc1c(cc(cc1[N+](=O)[O-])[N+](=O)[O-])[N+](=O)[O-]', ko: 'TNT', kind: 'famous', note: '폭약' },
  { id: 'isoamylacetate', smi: 'CC(C)CCOC(C)=O', ko: '아세트산 아이소아밀', kind: 'famous', note: '바나나 향' }
];

export function fromSmiles(smi) { const m = parseSmiles(smi); layout(m, { root: 0 }); return m; }

/* 원자 i 에 조각을 붙인다. 불가능하면 { error } */
export function attach(mol, i, fragId) {
  const F = FRAGMENTS[fragId];
  const order = F.order || 1;
  const a = mol.atoms[i];
  if (!a) return { error: '원자를 찾지 못했습니다' };
  if (a.h < order) return { error: order === 2 ? '=O 를 붙이려면 이 원자에 H 가 둘 있어야 합니다' : '이 원자에는 붙일 H 가 없습니다' };
  if (a.q) return { error: '전하를 띤 원자에는 붙이지 않습니다' };
  /* O · N 의 H 자리에는 탄소 조각만 (O–O, O–Cl, N–N 같은 결합은 만들지 않는다) */
  const firstC = F.smi[0] === 'C' || F.smi[0] === 'c';
  if (a.el !== 'C' && (!firstC || order !== 1)) return { error: a.el + ' 의 H 자리에는 탄소로 시작하는 조각(CH₃, 페닐, 아세틸 …)만 붙일 수 있습니다' };
  const stereo = stereoFromCoords(mol);
  const m = clone(mol);
  const frag = parseSmiles(F.smi);
  const base = m.atoms.length;
  frag.atoms.forEach(x => { m.atoms.push({ ...x }); m.nb.push([]); });
  frag.bonds.forEach(b => addBond(m, base + b.a, base + b.b, b.o, { arom: b.arom }));
  addBond(m, i, base, order);
  m.atoms[i].h -= order;
  m.atoms[base].h = Math.max(0, m.atoms[base].h - order);
  m._rings = null;
  perceiveAromatic(m);
  try { checkSupported(m); } catch (e) { return { error: e.message }; }
  layout(m, { root: 0, stereo, orient: false });
  return { mol: m };
}

/* 결합 k 의 차수를 한 단계 올린다 (1 → 2 → 3 → 1). 원자가가 허락하지 않으면 건너뛴다 */
export function cycleBond(mol, k) {
  const b = mol.bonds[k];
  if (b.arom) return { error: '벤젠 고리의 결합은 바꾸지 않습니다' };
  if (mol.atoms[b.a].el !== 'C' || mol.atoms[b.b].el !== 'C') return { error: '탄소–탄소 결합만 이중 · 삼중으로 바꿀 수 있습니다 (C=O 는 =O 조각으로)' };
  const R = rings(mol);
  const inRing = R.of[b.a] >= 0 && R.of[b.a] === R.of[b.b];
  const A = mol.atoms[b.a], B = mol.atoms[b.b];
  if (A.q || B.q) return { error: '전하를 띤 원자의 결합은 바꾸지 않습니다' };
  const stereo = stereoFromCoords(mol);
  for (const next of [b.o + 1, b.o + 2, 1]) {
    const o = next > 3 ? next - 3 : next;
    if (o === b.o) continue;
    if (o === 3 && inRing) continue;
    const need = o - b.o;
    if (need > 0 && (A.h < need || B.h < need)) continue;
    if (o === 3 && (mol.nb[b.a].length > 2 || mol.nb[b.b].length > 2)) continue;
    if (o >= 2 && (A.el === 'O' && B.el === 'O')) continue;
    const m = clone(mol);
    setOrder(m, k, o);
    fixH(m, b.a); fixH(m, b.b);
    if (m.atoms[b.a].h < 0 || m.atoms[b.b].h < 0) continue;
    if (m.nb[b.a].reduce((s, n) => s + n.o, 0) > maxValence(m.atoms[b.a]) || m.nb[b.b].reduce((s, n) => s + n.o, 0) > maxValence(m.atoms[b.b])) continue;
    perceiveAromatic(m);
    layout(m, { root: 0, stereo: stereo.filter(s => !(s.a === b.a && s.b === b.b) && !(s.a === b.b && s.b === b.a)), orient: false });
    return { mol: m };
  }
  return { error: '이 결합은 더 바꿀 수 없습니다 (원자가가 꽉 참)' };
}

/* 원자 i 와 그 너머 가지를 지운다 (뿌리 쪽은 남긴다). root 는 지우지 않는다 */
export function removeBranch(mol, i, root = 0) {
  if (i === root) return { error: '처음 뼈대의 첫 원자는 지울 수 없습니다. 뼈대를 새로 고르세요' };
  const R = rings(mol);
  /* 뿌리까지의 길에서 i 바로 앞 원자 */
  const par = new Map([[root, -1]]), q = [root];
  while (q.length) { const x = q.shift(); for (const { j } of mol.nb[x]) if (!par.has(j)) { par.set(j, x); q.push(j); } }
  const p = par.get(i);
  let dead;
  if (R.of[i] >= 0 && R.of[p] === R.of[i]) {
    /* 고리 원자면 그 고리 전체와 딸린 가지를 지운다 (뿌리 고리는 안 됨) */
    const ring = R.list[R.of[i]];
    if (ring.includes(root)) return { error: '처음 뼈대의 고리는 지울 수 없습니다' };
    let entry = ring.find(a => ring.includes(par.get(a)) === false);
    dead = branch(mol, entry, par.get(entry));
  } else dead = branch(mol, i, p);
  if (dead.has(root)) return { error: '이 원자는 지울 수 없습니다' };
  const stereo = stereoFromCoords(mol);
  const m = clone(mol);
  const anchor = [...dead].map(d => mol.nb[d].filter(n => !dead.has(n.j))).flat();
  const map = removeAtoms(m, [...dead]);
  for (const n of anchor) { const ni = map.get(n.j); if (ni !== undefined) { m.atoms[ni].h += n.o; } }
  const st = stereo.map(s => ({ ...s, x: map.get(s.x), a: map.get(s.a), b: map.get(s.b), y: map.get(s.y) })).filter(s => [s.x, s.a, s.b, s.y].every(v => v !== undefined));
  perceiveAromatic(m);
  layout(m, { root: 0, stereo: st, orient: false });
  return { mol: m };
}

/* 이중결합 k 의 E/Z 를 뒤집는다 */
export function flipEZ(mol, k) {
  const b = mol.bonds[k];
  if (b.o !== 2 || b.arom) return { error: '이중결합이 아닙니다' };
  const stereo = stereoFromCoords(mol);
  const s = stereo.find(x => (x.a === b.a && x.b === b.b) || (x.a === b.b && x.b === b.a));
  if (!s) return { error: '이 이중결합은 한쪽 끝의 치환기가 같아 E/Z 가 없습니다' };
  const m = clone(mol);
  const st = stereo.map(x => x === s ? { ...x, rel: x.rel === 'cis' ? 'trans' : 'cis' } : x);
  layout(m, { root: 0, stereo: st, orient: false });
  return { mol: m };
}

/* 다시 그리기 (정리) */
export function tidy(mol) {
  const m = clone(mol);
  layout(m, { stereo: stereoFromCoords(mol) });
  return m;
}
