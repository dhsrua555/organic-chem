/* 입체중심의 R/S: CIP 순위 + 원자의 배열(chi) → R 또는 S.
   그림: 입체중심마다 결합 하나를 쐐기(앞으로 나옴) 또는 점선 쐐기(뒤로 들어감)로 그린다.
   편집기에서 새로 생긴 입체중심은 "붙인 쪽이 쐐기(앞)" 인 배열로 정해 두고, R/S 도구로 뒤집는다 */
import { clone, chiralOK, chiSignFor, rings } from './core.js';
import { rankBranches, stereocenters, compareBranch } from './cip.js';

const SYM = { 0: '없음', 1: 'H', 5: 'B', 6: 'C', 7: 'N', 8: 'O', 9: 'F', 12: 'Mg', 15: 'P', 16: 'S', 17: 'Cl', 35: 'Br', 53: 'I' };
export const zSym = z => SYM[z] || '?';

/* 입체중심 c 의 R/S (배열이 정해지지 않았으면 null) */
export function rsOf(mol, c) {
  if (!chiralOK(mol, c)) return null;
  const r = rankBranches(mol, c);
  if (!r) return null;
  const s = chiSignFor(mol.atoms[c].chi, r.map(x => x.atom));
  return s > 0 ? 'R' : s < 0 ? 'S' : null;
}
/* 분자의 입체중심 전부: R/S 가 정해진 것(rs)과 안 정해진 것(undef) */
export function stereoInfo(mol) {
  const centers = stereocenters(mol);
  const rs = new Map(), undef = [];
  for (const c of centers) { const d = rsOf(mol, c); if (d) rs.set(c, d); else undef.push(c); }
  return { centers, rs, undef };
}

/* 그림용 가짜 3D (중심 = 원점, 결합은 단위 길이): 쐐기 이웃 w 를 앞(z+) 또는 뒤(z−)로, 나머지는 종이 위.
   암시적 H 는 중심 자리에 둔다 — 표준 해석(RDKit · IUPAC 권고)과 같아서, H 가 있는 중심은
   쐐기가 아닌 두 결합의 방향만으로 배열이 정해진다 */
function pseudo(mol, c, w, up) {
  const A = mol.atoms, C = A[c], pos = new Map();
  for (const { j } of mol.nb[c]) {
    const dx = A[j].x - C.x, dy = A[j].y - C.y, L = Math.hypot(dx, dy) || 1;
    pos.set(j, [dx / L, dy / L, j === w ? (up ? 0.9 : -0.9) : 0]);
  }
  if (C.h) pos.set(-1, [0, 0, 0]);
  return pos;
}
/* 네 점의 부피 (부호 있음) */
function vol(p0, p1, p2, p3) {
  const a = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], b = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]], c = [p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]];
  return a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
}
/* 쐐기 후보 w 로 그렸을 때의 방향(부호)과 뚜렷함(0 에 가까우면 헷갈리는 그림: 두 결합이 일직선 등) */
function wedgeTry(mol, c, n, w) {
  const pos = pseudo(mol, c, w, true);
  const v = vol(...n.map(x => pos.get(x)));
  return { o: Math.sign(v), clear: Math.abs(v) };
}
/* 후보 중 그림이 뚜렷한(부피 0.25 이상) 것 가운데 선호 순 첫 번째, 없으면 가장 뚜렷한 것 */
function chooseWedge(mol, c, n, R, taken, used) {
  let best = null, bestClear = -1;
  for (const { j } of candidates(mol, c, R, taken)) {
    const k = mol.nb[c].find(x => x.j === j).k;
    if (used && used.has(k)) continue;
    const t = wedgeTry(mol, c, n, j);
    if (!t.o) continue;
    if (t.clear >= 0.25) return { j, k, o: t.o };
    if (t.clear > bestClear) { bestClear = t.clear; best = { j, k, o: t.o }; }
  }
  return best;
}
/* 쐐기로 그릴 이웃 후보: 고리 밖 · 다른 입체중심이 아닌 · 끝 원자 · 헤테로 원자 순 */
function candidates(mol, c, R, taken) {
  const inRing = j => R.of[c] >= 0 && R.of[j] === R.of[c];
  return mol.nb[c].map(({ j }) => ({ j, score: (inRing(j) ? 0 : 100) + (taken.has(j) ? 0 : 50) + (mol.nb[j].length === 1 ? 20 : 0) + (mol.atoms[j].el !== 'C' ? 5 : 0) - mol.nb[j].length }))
    .sort((p, q) => q.score - p.score || p.j - q.j);
}
/* 쐐기 결합: Map 결합번호 → { from(입체중심), to, up(true = 앞으로 나온 쐐기) } */
export function wedges(mol) {
  const R = rings(mol), out = new Map();
  const cs = stereocenters(mol).filter(c => chiralOK(mol, c));
  const taken = new Set(cs);
  for (const c of cs) {
    const w = chooseWedge(mol, c, mol.atoms[c].chi.n, R, taken, out);
    if (!w) continue;
    out.set(w.k, { from: c, to: w.j, up: w.o === mol.atoms[c].chi.s });
    taken.add(w.j);
  }
  return out;
}
/* 배열이 없는 입체중심에 배열을 정해 준다 (가장 알맞은 결합이 앞으로 나온 쐐기가 되도록). 바뀌면 새 분자 */
export function defineMissing(mol) {
  const miss = stereocenters(mol).filter(c => !chiralOK(mol, c));
  if (!miss.length) return mol;
  const m = clone(mol), R = rings(m);
  const taken = new Set(stereocenters(m));
  for (const c of miss) {
    const n = m.nb[c].map(x => x.j);
    if (m.atoms[c].h) n.push(-1);
    const w = chooseWedge(m, c, n, R, taken, null);
    if (!w) continue;
    m.atoms[c] = { ...m.atoms[c], chi: { n, s: w.o } };
    taken.add(w.j);
  }
  return m;
}
/* 입체중심 c 의 배열을 뒤집는다 (R ↔ S) */
export function flipCenter(mol, c) {
  if (!chiralOK(mol, c) || !stereocenters(mol).includes(c)) return { error: '입체중심(치환기 넷이 모두 다른 sp³ 탄소)을 눌러 주세요' };
  const m = clone(mol);
  m.atoms[c] = { ...m.atoms[c], chi: { n: m.atoms[c].chi.n.slice(), s: -m.atoms[c].chi.s } };
  return { mol: m };
}
/* 거울상: 모든 입체중심을 뒤집는다 (E/Z 는 그대로) */
export function mirror(mol) {
  const m = clone(mol);
  m.atoms.forEach((a, i) => { if (a.chi) m.atoms[i] = { ...a, chi: { n: a.chi.n.slice(), s: -a.chi.s } }; });
  return m;
}

/* 풀이: CIP 순위와 근거, 그림에서 보이는 회전 방향.
   반환 { ranked: [원자 번호(H 는 -1)], why: [{depth, za, zb}] (1↔2, 2↔3, 3↔4), rs, view: { lowest: 'back'|'front'|'plane', turn: 'cw'|'ccw' } } */
export function cipDetail(mol, c, wedgeMap) {
  const r = rankBranches(mol, c);
  if (!r) return null;
  const why = [];
  for (let k = 0; k < 3; k++) { const w = {}; compareBranch(mol, r[k], r[k + 1], w); why.push(w); }
  const ranked = r.map(n => n.atom);
  const rs = rsOf(mol, c);
  let view = null;
  const wm = wedgeMap || wedges(mol);
  const wd = [...wm.values()].find(x => x.from === c);
  if (wd && rs) {
    const pos = pseudo(mol, c, wd.to, wd.up);
    const P = ranked.map(x => pos.get(x));
    const low = ranked[3] === -1 ? (wd.up ? 'back' : 'front') : P[3][2] < -0.1 ? 'back' : P[3][2] > 0.1 ? 'front' : 'plane';
    const area = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[1][1] - P[0][1]) * (P[2][0] - P[0][0]);
    view = { lowest: low, turn: area < 0 ? 'cw' : 'ccw', wedge: wd };
  }
  return { ranked, why, rs, view };
}
