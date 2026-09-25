/* CIP 우선순위: 원자번호를 구(球)마다 비교한다. 다중결합은 복제 원자로 펼친다.
   E/Z (이중결합 양쪽의 높은 순위 치환기가 같은 쪽이면 Z) 와 입체중심(서로 다른 치환기 넷) 판정에 쓴다. */
import { ELEMENTS } from './core.js';

const Z = el => ELEMENTS[el].z;

/* 노드: { atom(-1 = 수소), from, z, dup, path } */
function kids(mol, n) {
  if (n.dup || n.atom < 0) return [];
  const a = n.atom, out = [];
  for (const { j, o } of mol.nb[a]) {
    const z = Z(mol.atoms[j].el);
    if (j === n.from) { for (let k = 1; k < o; k++) out.push({ atom: j, z, dup: true }); continue; }
    if (n.path.includes(j)) { out.push({ atom: j, z, dup: true }); continue; }
    out.push({ atom: j, from: a, z, dup: false, path: n.path.concat(a) });
    for (let k = 1; k < o; k++) out.push({ atom: j, z, dup: true });
  }
  for (let k = 0; k < mol.atoms[a].h; k++) out.push({ atom: -1, z: 1, dup: false });
  return out;
}

/* 가지 하나를 구마다 [원자번호 목록] 으로 펼친 서명. 같은 원자번호끼리 순서를 정할 때 쓴다 */
function sig(mol, n, depth = 7) {
  const out = [n.z];
  let f = [n];
  for (let d = 0; d < depth && f.length; d++) {
    const next = [];
    for (const m of f) {
      const k = sortKids(mol, kids(mol, m), depth - d - 1);
      out.push(-1, ...k.map(x => x.z));
      next.push(...k);
    }
    f = next;
  }
  return out;
}
function cmpArr(a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) { const x = a[i] ?? -2, y = b[i] ?? -2; if (x !== y) return x - y; }
  return 0;
}
function sortKids(mol, list, depth) {
  if (depth <= 0) return list.slice().sort((p, q) => q.z - p.z);
  const withSig = list.map(k => ({ k, s: sig(mol, k, Math.min(depth, 4)) }));
  withSig.sort((p, q) => q.k.z - p.k.z || cmpArr(q.s, p.s));
  return withSig.map(x => x.k);
}

/* a, b: 같은 중심에서 뻗은 두 가지의 첫 원자 노드. 양수면 a 가 높다 */
export function compareBranch(mol, a, b) {
  if (a.z !== b.z) return a.z - b.z;
  let fa = [a], fb = [b];
  for (let d = 0; d < 12; d++) {
    const ca = fa.map(n => sortKids(mol, kids(mol, n), 5));
    const cb = fb.map(n => sortKids(mol, kids(mol, n), 5));
    const len = Math.max(ca.length, cb.length);
    for (let i = 0; i < len; i++) {
      const za = (ca[i] || []).map(x => x.z), zb = (cb[i] || []).map(x => x.z);
      const m = Math.max(za.length, zb.length, 3);
      for (let k = 0; k < m; k++) { const x = za[k] ?? 0, y = zb[k] ?? 0; if (x !== y) return x - y; }
    }
    fa = ca.flat(); fb = cb.flat();
    if (!fa.length && !fb.length) return 0;
  }
  return 0;
}

/* 중심 원자 c 에서 뻗은 치환기 노드 목록 (이웃 + 수소) */
export function branchesOf(mol, c) {
  const out = [];
  for (const { j } of mol.nb[c]) out.push({ atom: j, from: c, z: Z(mol.atoms[j].el), dup: false, path: [c] });
  for (let k = 0; k < mol.atoms[c].h; k++) out.push({ atom: -1, z: 1, dup: false });
  return out;
}

/* 입체중심: sp3 탄소, 치환기 넷이 모두 다름 */
export function stereocenters(mol) {
  const out = [];
  mol.atoms.forEach((a, i) => {
    if (a.el !== 'C' || a.h > 1) return;
    if (mol.nb[i].some(n => n.o > 1)) return;
    const br = branchesOf(mol, i);
    if (br.length !== 4) return;
    for (let p = 0; p < 4; p++) for (let q = p + 1; q < 4; q++) if (compareBranch(mol, br[p], br[q]) === 0) return;
    out.push(i);
  });
  return out;
}

/* C=C 결합의 E/Z. 반환: [{ a, b, desc: 'E'|'Z' }] (한쪽 치환기가 같으면 빠진다) */
export function doubleBondStereo(mol) {
  const out = [];
  for (const bd of mol.bonds) {
    if (bd.o !== 2 || bd.arom) continue;
    if (inSmallRing(mol, bd.a, bd.b)) continue;
    const A = mol.atoms[bd.a], B = mol.atoms[bd.b];
    if (A.el !== 'C' || B.el !== 'C') continue;
    const hiA = higherSide(mol, bd.a, bd.b), hiB = higherSide(mol, bd.b, bd.a);
    if (hiA === null || hiB === null) continue;
    out.push({ a: bd.a, b: bd.b, desc: hiA === hiB ? 'Z' : 'E' });
  }
  return out;
}

/* 8원자 이하 고리 안의 이중결합은 cis 로만 존재하므로 E/Z 를 붙이지 않는다 */
function inSmallRing(mol, a, b) {
  const seen = new Set([a]); let frontier = [[a, 0]];
  while (frontier.length) {
    const next = [];
    for (const [i, d] of frontier) for (const { j } of mol.nb[i]) {
      if (i === a && j === b) continue;
      if (j === b) return d + 1 <= 7;
      if (!seen.has(j) && d < 7) { seen.add(j); next.push([j, d + 1]); }
    }
    frontier = next;
  }
  return false;
}

/* 이중결합 c=d 에서 c 쪽 두 치환기 중 높은 것이 결합 축의 어느 쪽(+1/-1)에 있는지. 같으면 null.
   수소는 좌표가 없지만 늘 순위가 가장 낮으므로, 무거운 치환기 하나 + 수소면 그 무거운 쪽이 높다 */
function higherSide(mol, c, d) {
  const subs = [];
  for (const { j } of mol.nb[c]) if (j !== d) subs.push({ node: { atom: j, from: c, z: Z(mol.atoms[j].el), dup: false, path: [c] }, pos: [mol.atoms[j].x, mol.atoms[j].y] });
  if (!subs.length || subs.length + mol.atoms[c].h !== 2) return null;
  let hi;
  if (subs.length === 1) hi = subs[0];
  else {
    const r = compareBranch(mol, subs[0].node, subs[1].node);
    if (r === 0) return null;
    hi = r > 0 ? subs[0] : subs[1];
  }
  const C = mol.atoms[c], D = mol.atoms[d];
  /* 두 탄소 모두 같은 기준(c→d 가 아니라 번호 작은 원자 → 큰 원자)으로 쪽을 잰다 */
  const [P, Q] = c < d ? [C, D] : [D, C];
  const cross = (Q.x - P.x) * (hi.pos[1] - P.y) - (Q.y - P.y) * (hi.pos[0] - P.x);
  if (Math.abs(cross) < 1e-3) return null; /* 일직선: 판단 불가 */
  return cross > 0 ? 1 : -1;
}
