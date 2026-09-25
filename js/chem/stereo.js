/* 입체중심의 R/S: CIP 순위 + 원자의 배열(chi) → R 또는 S.
   고리의 cis/trans: 고리 원자 둘에 치환기가 하나씩 있으면(각각 H 하나) 두 치환기가 고리의 같은 면(cis) · 반대 면(trans).
     1,4-다이메틸사이클로헥세인처럼 R/S 가 없는 경우도 이 "입체 자리"의 배열로 구별한다.
   그림: 입체 자리마다 결합 하나를 쐐기(앞으로 나옴) 또는 점선 쐐기(뒤로 들어감)로 그린다.
   편집기에서 새로 생긴 입체 자리는 "붙인 쪽이 쐐기(앞)" 인 배열로 정해 두고, R/S 도구로 뒤집는다 */
import { clone, chiralOK, chiSignFor, rings } from './core.js';
import { rankBranches, stereocenters, compareBranch, tiedCenters, branchesOf } from './cip.js';

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
/* 고리 입체 자리: 방향족이 아닌 고리의 sp³ 원자 중 H 하나 + 고리 밖 치환기 하나. 같은 고리에 둘 이상일 때만.
   반환 Map 고리 번호 → [원자] (고리 순서대로) */
export function ringSites(mol) {
  const R = rings(mol), out = new Map();
  /* 두 고리 계의 다리목은 고리계가 배치를 정하므로 제외 */
  const bh = new Set((R.bicyclic || []).flatMap(b => b.bh));
  R.list.forEach((ring, ri) => {
    const sites = ring.filter(i => {
      const a = mol.atoms[i];
      if (bh.has(i)) return false;
      if (a.el !== 'C' || a.h !== 1 || mol.nb[i].length !== 3) return false;
      if (mol.nb[i].some(n => n.o !== 1 || mol.bonds[n.k].arom)) return false;
      return mol.nb[i].filter(n => !ring.includes(n.j)).length === 1;
    });
    if (sites.length >= 2) out.set(ri, sites);
  });
  return out;
}
/* 배열을 정해야 하는 자리 전부: 입체중심 + 고리 입체 자리 + 가짜 비대칭 후보 */
export function stereoSites(mol) {
  const set = new Set(stereocenters(mol));
  for (const list of ringSites(mol).values()) list.forEach(i => set.add(i));
  for (const t of tiedCenters(mol)) set.add(t.c);
  return [...set].sort((a, b) => a - b);
}
/* 고리 원자 i 의 치환기가 고리의 어느 면(±1)인가: 고리를 적힌 순서로 돌 때의 앞 · 뒤 원자로 잰다 */
function faceOf(mol, ring, i) {
  if (!chiralOK(mol, i)) return 0;
  const k = ring.indexOf(i), m = ring.length;
  const exo = mol.nb[i].find(n => !ring.includes(n.j));
  if (!exo) return 0;
  return chiSignFor(mol.atoms[i].chi, [ring[(k - 1 + m) % m], ring[(k + 1) % m], exo.j, -1]);
}
/* 고리마다 치환기 쌍의 cis/trans: [{ ring(번호), atoms: [a, b], rel }] (배열이 정해진 쌍만) */
export function cisTrans(mol) {
  const R = rings(mol), out = [];
  for (const [ri, sites] of ringSites(mol)) {
    const ring = R.list[ri];
    for (let p = 0; p < sites.length; p++) for (let q = p + 1; q < sites.length; q++) {
      const fa = faceOf(mol, ring, sites[p]), fb = faceOf(mol, ring, sites[q]);
      if (fa && fb) out.push({ ring: ri, atoms: [sites[p], sites[q]], rel: fa === fb ? 'cis' : 'trans', n: sites.length });
    }
  }
  return out;
}
/* 가지 하나를 따라가며(계층 그래프: 고리는 되돌아오지 않고 풀어서) 만나는 입체중심의 R/S 를 깊이 순으로. 같은 깊이에 둘 이상이면 null */
function descSeq(mol, c, start, rs) {
  const out = [];
  let front = [{ i: start, up: { i: c, up: null } }], count = 0;
  const onPath = (x, j) => { for (let y = x; y; y = y.up) if (y.i === j) return true; return false; };
  for (let d = 1; front.length && d < 40; d++) {
    const here = [...new Set(front.filter(x => rs.has(x.i)).map(x => x.i))];
    if (here.length > 1) return null;
    if (here.length) out.push({ d, v: rs.get(here[0]) });
    const next = [];
    for (const x of front) for (const { j } of mol.nb[x.i]) if (!onPath(x, j)) { next.push({ i: j, up: x }); if (++count > 5000) return null; }
    front = next;
  }
  return out;
}
/* 구조가 같은 두 가지의 입체 비교 (CIP 규칙 4b: 같은 짝(RR · SS)이 먼저, 규칙 5: R 이 S 보다 먼저).
   kind: 'same'(똑같음 → 입체 자리 아님) · 'pseudo'(거울상 → r/s) · 'dia'(다름 → R/S). sign > 0 이면 첫째 가지가 높다 */
function cmpSeq(A, B) {
  if (!A || !B || !A.length || A.length !== B.length || A.some((x, k) => x.d !== B[k].d)) return null;
  const a = A.map(x => x.v), b = B.map(x => x.v);
  if (a.join() === b.join()) return { kind: 'same' };
  for (let k = 1; k < a.length; k++) { const la = a[k] === a[0], lb = b[k] === b[0]; if (la !== lb) return { kind: 'dia', sign: la ? 1 : -1, rule: 4 }; }
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return { kind: 'pseudo', sign: a[k] === 'R' ? 1 : -1, rule: 5 };
  return null;
}
function pseudoOne(mol, t, rs) {
  const [p, q] = t.pair;
  const r = cmpSeq(descSeq(mol, t.c, p.atom, rs), descSeq(mol, t.c, q.atom, rs));
  if (!r || r.kind === 'same') return r;
  return { ...r, hi: r.sign > 0 ? p : q };
}
/* 규칙 1~5 로 매긴 순위 (높은 것 먼저) */
function rankWith(mol, c, hi) {
  return branchesOf(mol, c).sort((p, q) => compareBranch(mol, q, p) || (p.atom === hi.atom ? -1 : q.atom === hi.atom ? 1 : 0));
}
const trueRS = mol => { const m = new Map(); for (const c of stereocenters(mol)) { const d = rsOf(mol, c); if (d) m.set(c, d); } return m; };
/* 중심 c 의 순위: 보통 입체중심은 원자번호로, 구조가 같은 두 가지는 규칙 4 · 5 까지. { ranked(노드), rule(같은 가지 쌍을 가른 규칙), kind } */
export function rankFull(mol, c) {
  const r = rankBranches(mol, c);
  if (r) return { ranked: r, rule: 0 };
  const t = tiedCenters(mol).find(x => x.c === c);
  if (!t) return null;
  const x = pseudoOne(mol, t, trueRS(mol));
  if (!x || x.kind === 'same') return null;
  return { ranked: rankWith(mol, c, x.hi), rule: x.rule, kind: x.kind };
}
/* 분자의 입체중심 전부: R/S 가 정해진 것(rs), 가짜 비대칭 r/s(pseudo), 안 정해진 것(undef).
   same: 구조가 같은 두 가지가 입체까지 똑같아 입체 자리가 아닌 원자 */
export function stereoInfo(mol) {
  const centers = stereocenters(mol);
  const rs = new Map(), undef = [], pseudo = new Map(), same = new Set();
  for (const c of centers) { const d = rsOf(mol, c); if (d) rs.set(c, d); else undef.push(c); }
  const base = new Map(rs);
  for (const t of tiedCenters(mol)) {
    const x = pseudoOne(mol, t, base);
    if (!x) continue;
    if (x.kind === 'same') { same.add(t.c); continue; }
    centers.push(t.c);
    const s = chiralOK(mol, t.c) ? chiSignFor(mol.atoms[t.c].chi, rankWith(mol, t.c, x.hi).map(n => n.atom)) : 0;
    if (!s) undef.push(t.c);
    else if (x.kind === 'pseudo') pseudo.set(t.c, s > 0 ? 'r' : 's');
    else rs.set(t.c, s > 0 ? 'R' : 'S');
  }
  centers.sort((a, b) => a - b);
  return { centers, rs, undef, pseudo, same, all: new Map([...rs, ...pseudo]) };
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
  const inRing = j => R.same(c, j);
  return mol.nb[c].map(({ j }) => ({ j, score: (inRing(j) ? 0 : 100) + (taken.has(j) ? 0 : 50) + (mol.nb[j].length === 1 ? 20 : 0) + (mol.atoms[j].el !== 'C' ? 5 : 0) - mol.nb[j].length }))
    .sort((p, q) => q.score - p.score || p.j - q.j);
}
/* 쐐기 결합: Map 결합번호 → { from(입체중심), to, up(true = 앞으로 나온 쐐기) } */
export function wedges(mol) {
  const R = rings(mol), out = new Map();
  const cs = stereoSites(mol).filter(c => chiralOK(mol, c));
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
  const sites = stereoSites(mol);
  const miss = sites.filter(c => !chiralOK(mol, c));
  if (!miss.length) return mol;
  const m = clone(mol), R = rings(m);
  const taken = new Set(sites);
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
  if (!chiralOK(mol, c) || !stereoSites(mol).includes(c)) return { error: '입체중심(네 치환기가 모두 다른 sp³ 탄소) 또는 치환된 고리 탄소(cis/trans)를 선택하세요' };
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
  const F = rankFull(mol, c);
  if (!F) return null;
  const r = F.ranked;
  const why = [];
  for (let k = 0; k < 3; k++) { const w = {}; if (!compareBranch(mol, r[k], r[k + 1], w)) w.rule = F.rule; why.push(w); }
  const ranked = r.map(n => n.atom);
  let rs = rsOf(mol, c);
  if (!rs && F.rule && chiralOK(mol, c)) { const s = chiSignFor(mol.atoms[c].chi, ranked); rs = s ? (F.kind === 'pseudo' ? (s > 0 ? 'r' : 's') : (s > 0 ? 'R' : 'S')) : null; }
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
