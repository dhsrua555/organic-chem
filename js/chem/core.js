/* 분자 그래프의 바탕: 원자 · 결합 · 암시적 수소, SMILES 읽기, 고리 찾기, 분자식, MOL 파일.
   원자: { el, h(암시적 수소 수), q(전하), x, y, chi? }  결합: { a, b, o(1·2·3), arom }
   chi(입체중심의 배열): { n: [이웃 넷 (원자 번호, 암시적 H 는 -1)], s: ±1 }
     s = 네 이웃 위치 p0..p3 로 만든 부피 det[p1−p0, p2−p0, p3−p0] 의 부호.
     SMILES 의 @ 는 s = −1, @@ 는 s = +1 (이웃 순서 = SMILES 에 적힌 순서) */

export const ELEMENTS = {
  H: { z: 1, m: 1.008, v: 1 }, C: { z: 6, m: 12.011, v: 4 }, N: { z: 7, m: 14.007, v: 3 }, O: { z: 8, m: 15.999, v: 2 },
  F: { z: 9, m: 18.998, v: 1 }, Cl: { z: 17, m: 35.45, v: 1 }, Br: { z: 35, m: 79.904, v: 1 }, I: { z: 53, m: 126.904, v: 1 },
  S: { z: 16, m: 32.06, v: 2 }, B: { z: 5, m: 10.81, v: 3 }, Mg: { z: 12, m: 24.305, v: 2 }, P: { z: 15, m: 30.974, v: 3 }
};
export const HALOGENS = new Set(['F', 'Cl', 'Br', 'I']);

/* ── 만들기 · 복사 ─────────────────────────── */
export function makeMol(atoms, bonds, extra = {}) {
  const mol = { atoms, bonds, ...extra };
  return reindex(mol);
}
export function reindex(mol) {
  mol.nb = mol.atoms.map(() => []);
  mol.bonds.forEach((b, k) => { mol.nb[b.a].push({ j: b.b, o: b.o, k }); mol.nb[b.b].push({ j: b.a, o: b.o, k }); });
  mol._rings = null;
  return mol;
}
export function clone(mol) {
  return reindex({ ...mol, atoms: mol.atoms.map(a => ({ ...a })), bonds: mol.bonds.map(b => ({ ...b })) });
}
export function bondBetween(mol, a, b) { const n = mol.nb[a].find(x => x.j === b); return n ? mol.bonds[n.k] : null; }
export function degree(mol, i) { return mol.nb[i].length; }
export function valenceUsed(mol, i) { return mol.nb[i].reduce((s, n) => s + n.o, 0) + mol.atoms[i].h; }
/* 결합 차수 합으로 본 원자가: 전하가 있으면 N⁺ 4, O⁻ 1, C⁺ 3 */
export function maxValence(a) {
  const v = ELEMENTS[a.el] ? ELEMENTS[a.el].v : 4;
  if (a.q === 1 && (a.el === 'N' || a.el === 'O')) return v + 1;
  if (a.q === -1 && (a.el === 'O' || a.el === 'N')) return v - 1;
  if (a.q === 1 && a.el === 'C') return 3;
  if (a.q === -1 && a.el === 'C') return 3;
  return v;
}
/* 결합을 바꾼 뒤 수소 수를 원자가에 맞춤 */
export function fixH(mol, i) {
  const a = mol.atoms[i];
  const used = mol.nb[i].reduce((s, n) => s + n.o, 0);
  a.h = Math.max(0, maxValence(a) - used);
}
export function addAtom(mol, el, extra = {}) {
  mol.atoms.push({ el, h: 0, q: 0, x: 0, y: 0, ...extra });
  mol.nb.push([]);
  mol._rings = null;
  return mol.atoms.length - 1;
}
export function addBond(mol, a, b, o = 1, extra = {}) {
  const k = mol.bonds.length;
  mol.bonds.push({ a, b, o, ...extra });
  mol.nb[a].push({ j: b, o, k }); mol.nb[b].push({ j: a, o, k });
  mol._rings = null;
  return k;
}
export function setOrder(mol, k, o) {
  const b = mol.bonds[k]; b.o = o;
  for (const n of mol.nb[b.a]) if (n.k === k) n.o = o;
  for (const n of mol.nb[b.b]) if (n.k === k) n.o = o;
}
/* ── 입체중심 배열 (chi) ─────────────────────── */
/* 네 점의 방향: det[p1−p0, p2−p0, p3−p0] 의 부호 (+1 / −1, 납작하면 0) */
export function orient4(p0, p1, p2, p3) {
  const a = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], b = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]], c = [p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]];
  const d = a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  return Math.abs(d) < 1e-9 ? 0 : Math.sign(d);
}
/* 순열의 홀짝: 같은 원소 넷을 다른 순서로 적었을 때 +1(짝) / −1(홀) */
export function permParity(from, to) {
  const idx = to.map(x => from.indexOf(x));
  if (idx.some(i => i < 0) || new Set(idx).size !== idx.length) return 0;
  let p = 1;
  const v = idx.slice();
  for (let i = 0; i < v.length; i++) while (v[i] !== i) { const j = v[i]; [v[i], v[j]] = [v[j], v[i]]; p = -p; }
  return p;
}
/* chi 가 지금 연결과 맞는가: sp³ (단일결합만), 이웃 넷 = chi.n 과 같은 집합, H 는 많아야 하나 */
export function chiralOK(mol, i) {
  const a = mol.atoms[i];
  if (!a || !a.chi) return false;
  const n = a.chi.n;
  if (n.length !== 4 || a.h > 1 || mol.nb[i].length + a.h !== 4) return false;
  if (mol.nb[i].some(x => x.o !== 1 || (mol.bonds[x.k] && mol.bonds[x.k].arom))) return false;
  if (n.filter(j => j < 0).length !== a.h) return false;
  const heavy = n.filter(j => j >= 0);
  return heavy.length === mol.nb[i].length && new Set(heavy).size === heavy.length && mol.nb[i].every(x => heavy.includes(x.j));
}
/* 같은 배열을 이웃 순서 to 로 적을 때의 부호 */
export function chiSignFor(chi, to) { const p = permParity(chi.n, to); return p ? chi.s * p : 0; }
/* 원자 번호가 바뀔 때 chi 를 옮긴다 (없어진 이웃은 H 로 바뀌었다고 본다) */
function remapChi(a, map) {
  if (!a.chi) return a;
  return { ...a, chi: { n: a.chi.n.map(j => j < 0 ? -1 : map.has(j) ? map.get(j) : -1), s: a.chi.s } };
}
/* 맞지 않게 된 chi 는 지운다 (결합이 바뀌었거나 이웃이 둘 이상 바뀜) */
export function cleanChi(mol) {
  mol.atoms.forEach((a, i) => { if (a.chi && !chiralOK(mol, i)) delete a.chi; });
  return mol;
}

/* 원자 여럿을 지우고 번호를 다시 매긴다. 반환: 옛 번호 → 새 번호 */
export function removeAtoms(mol, dead) {
  const kill = new Set(dead);
  const map = new Map();
  const atoms = [];
  mol.atoms.forEach((a, i) => { if (!kill.has(i)) { map.set(i, atoms.length); atoms.push(a); } });
  atoms.forEach((a, k) => { atoms[k] = remapChi(a, map); });
  const bonds = [];
  for (const b of mol.bonds) {
    if (kill.has(b.a) || kill.has(b.b)) continue;
    bonds.push({ ...b, a: map.get(b.a), b: map.get(b.b) });
  }
  mol.atoms = atoms; mol.bonds = bonds; reindex(mol);
  return map;
}
/* 연결된 조각들 (반응 뒤 여러 분자로 나눌 때) */
export function components(mol) {
  const seen = new Array(mol.atoms.length).fill(-1), out = [];
  for (let s = 0; s < mol.atoms.length; s++) {
    if (seen[s] >= 0) continue;
    const comp = [], q = [s]; seen[s] = out.length;
    while (q.length) { const i = q.pop(); comp.push(i); for (const { j } of mol.nb[i]) if (seen[j] < 0) { seen[j] = out.length; q.push(j); } }
    out.push(comp.sort((a, b) => a - b));
  }
  return out;
}
export function subMol(mol, atomList) {
  const map = new Map(atomList.map((a, i) => [a, i]));
  const atoms = atomList.map(i => remapChi({ ...mol.atoms[i] }, map));
  const bonds = mol.bonds.filter(b => map.has(b.a) && map.has(b.b)).map(b => ({ ...b, a: map.get(b.a), b: map.get(b.b) }));
  return makeMol(atoms, bonds);
}

/* ── 고리 ──────────────────────────────────── */
/* 고리가 원자를 나눠 갖지 않는(축합 · 스파이로 아닌) 분자만 다룬다. 반환: { list: [[원자 순서]], of: 원자→고리 번호, fused } */
export function rings(mol) {
  if (mol._rings) return mol._rings;
  const n = mol.atoms.length;
  const parent = new Array(n).fill(-2), depth = new Array(n).fill(0), list = [];
  const seenEdge = new Set();
  for (let s = 0; s < n; s++) {
    if (parent[s] !== -2) continue;
    parent[s] = -1;
    const stack = [[s, 0]];
    while (stack.length) {
      const top = stack[stack.length - 1];
      const [i, k] = top;
      if (k >= mol.nb[i].length) { stack.pop(); continue; }
      top[1]++;
      const { j, k: bk } = mol.nb[i][k];
      if (seenEdge.has(bk)) continue;
      seenEdge.add(bk);
      if (parent[j] === -2) { parent[j] = i; depth[j] = depth[i] + 1; stack.push([j, 0]); }
      else {
        /* 되돌아가는 간선: j 는 i 의 조상 */
        const cyc = [];
        let x = i;
        while (x !== j && x !== -1) { cyc.push(x); x = parent[x]; }
        if (x === j) { cyc.push(j); list.push(cyc.reverse()); }
      }
    }
  }
  const of = new Array(n).fill(-1);
  let fused = false;
  list.forEach((r, ri) => r.forEach(a => { if (of[a] >= 0) fused = true; of[a] = ri; }));
  mol._rings = { list, of, fused };
  return mol._rings;
}
/* 벤젠 고리: 탄소 6개, 단일 · 이중이 번갈아 */
export function isBenzene(mol, ring) {
  if (ring.length !== 6 || ring.some(a => mol.atoms[a].el !== 'C')) return false;
  let d = 0;
  for (let i = 0; i < 6; i++) { const b = bondBetween(mol, ring[i], ring[(i + 1) % 6]); if (!b) return false; if (b.o === 2 || b.arom) d++; }
  if (ring.every((a, i) => { const b = bondBetween(mol, a, ring[(i + 1) % 6]); return b.arom; })) return true;
  if (d !== 3) return false;
  for (let i = 0; i < 6; i++) { const b1 = bondBetween(mol, ring[i], ring[(i + 1) % 6]), b2 = bondBetween(mol, ring[(i + 1) % 6], ring[(i + 2) % 6]); if (b1.o === b2.o) return false; }
  return true;
}
/* 벤젠 고리 결합에 arom 표시 */
export function perceiveAromatic(mol) {
  const R = rings(mol);
  for (const b of mol.bonds) b.arom = false;
  for (const r of R.list) if (isBenzene(mol, r)) for (let i = 0; i < 6; i++) bondBetween(mol, r[i], r[(i + 1) % 6]).arom = true;
  return mol;
}

/* ── SMILES (필요한 만큼만) ─────────────────────── */
/* 지원: C N O F Cl Br I S B P, 방향족 c, [N+] [O-] [NH3+] 같은 괄호 원자, = # : / \, 가지, 고리 닫기 숫자.
   / \ 는 이중결합 cis/trans 제약으로 바꿔 mol.stereo 에 담는다: [{ x, a, b, y, rel: 'cis'|'trans' }] */
export function parseSmiles(s) {
  const atoms = [], bonds = [], aromAtom = [];
  const dir = []; /* 결합 k 의 방향 문자와 쓴 순서 (from, to) */
  const order = []; /* 원자마다 SMILES 에 적힌 이웃 순서 (@ · @@ 해석용). 'H' = 괄호 안 H, {ring} = 아직 안 닫힌 고리 */
  const chiral = []; /* [원자, '@' | '@@'] */
  let prev = -1, pend = null, pendDir = null;
  const stack = [], ringOpen = {};
  let i = 0;
  const addA = (el, arom, q = 0, hx = null, chi = '') => {
    atoms.push({ el, h: 0, q, x: 0, y: 0, _hx: hx });
    aromAtom.push(arom);
    const idx = atoms.length - 1;
    order.push(prev >= 0 ? [prev] : []);
    if (hx) order[idx].push('H');
    if (chi) chiral.push([idx, chi]);
    if (prev >= 0) {
      const o = pend || (arom && aromAtom[prev] ? 1.5 : 1);
      bonds.push({ a: prev, b: idx, o });
      dir.push(pendDir ? { c: pendDir, from: prev, to: idx } : null);
      order[prev].push(idx);
    }
    pend = null; pendDir = null; prev = idx;
  };
  while (i < s.length) {
    const ch = s[i];
    if (ch === '(') { stack.push(prev); i++; continue; }
    if (ch === ')') { prev = stack.pop(); i++; continue; }
    if (ch === '-') { pend = 1; i++; continue; }
    if (ch === '=') { pend = 2; i++; continue; }
    if (ch === '#') { pend = 3; i++; continue; }
    if (ch === ':') { pend = 1.5; i++; continue; }
    if (ch === '/' || ch === '\\') { pend = 1; pendDir = ch; i++; continue; }
    if (ch === '.') { prev = -1; i++; continue; }
    if (/[0-9%]/.test(ch)) {
      let num;
      if (ch === '%') { num = s.substr(i + 1, 2); i += 3; } else { num = ch; i++; }
      if (ringOpen[num]) {
        const r = ringOpen[num];
        const o = pend || r.o || (aromAtom[r.atom] && aromAtom[prev] ? 1.5 : 1);
        bonds.push({ a: r.atom, b: prev, o });
        const dc = pendDir || r.dir;
        dir.push(dc ? { c: dc, from: pendDir ? prev : r.atom, to: pendDir ? r.atom : prev } : null);
        const slot = order[r.atom].indexOf(r.slot); if (slot >= 0) order[r.atom][slot] = prev;
        order[prev].push(r.atom);
        delete ringOpen[num];
      } else { const slot = { ring: num }; order[prev].push(slot); ringOpen[num] = { atom: prev, o: pend, dir: pendDir, slot }; }
      pend = null; pendDir = null;
      continue;
    }
    if (ch === '[') {
      const end = s.indexOf(']', i);
      const inner = s.slice(i + 1, end);
      const m = inner.match(/^(\d*)([A-Z][a-z]?|[cnos])(@*)(H\d*)?([+-]\d*)?$/);
      if (!m) throw new Error('SMILES 괄호 원자를 읽지 못함: ' + inner);
      let el = m[2]; const arom = /^[a-z]$/.test(el); if (arom) el = el.toUpperCase();
      const hx = m[4] ? (m[4].length > 1 ? +m[4].slice(1) : 1) : 0;
      let q = 0; if (m[5]) q = (m[5][0] === '+' ? 1 : -1) * (m[5].length > 1 ? +m[5].slice(1) : 1);
      addA(el, arom, q, hx, m[3]);
      i = end + 1; continue;
    }
    const two = s.substr(i, 2);
    if (two === 'Cl' || two === 'Br') { addA(two, false); i += 2; continue; }
    if (/[BCNOFPSI]/.test(ch)) { addA(ch, false); i++; continue; }
    if (/[cnos]/.test(ch)) { addA(ch.toUpperCase(), true); i++; continue; }
    throw new Error('SMILES 글자를 읽지 못함: ' + ch);
  }
  /* 방향족 결합 1.5 → 케쿨레 */
  kekulize(atoms, bonds, aromAtom);
  const mol = makeMol(atoms, bonds);
  atoms.forEach((a, k) => {
    if (a._hx !== null && a._hx !== undefined) a.h = a._hx;
    else fixH(mol, k);
    delete a._hx;
  });
  perceiveAromatic(mol);
  /* 입체중심: 적힌 이웃 순서로 부호를 정한다 (@ = 반시계 = −1) */
  for (const [idx, c] of chiral) {
    const n = order[idx].map(x => x === 'H' ? -1 : x);
    if (n.length !== 4 || n.some(x => typeof x !== 'number')) continue;
    atoms[idx].chi = { n, s: c === '@@' ? 1 : -1 };
    if (!chiralOK(mol, idx)) delete atoms[idx].chi;
  }
  /* cis/trans 제약 */
  const stereo = [];
  bonds.forEach((b, k) => {
    if (b.o !== 2 || b.arom) return;
    const side = (atom, other) => {
      for (const n of mol.nb[atom]) {
        if (n.j === other) continue;
        const d = dir[n.k];
        if (!d) continue;
        /* 이중결합 원자 atom 쪽 치환기 n.j: "치환기 → atom" 방향으로 본 문자 */
        const seenFromSub = d.from === n.j ? d.c : flip(d.c);
        return { sub: n.j, c: seenFromSub };
      }
      return null;
    };
    const L = side(b.a, b.b), R = side(b.b, b.a);
    if (!L || !R) return;
    /* 오른쪽은 "atom → 치환기" 방향으로 본 문자여야 같은 규칙: 같으면 trans */
    const rc = flip(R.c);
    stereo.push({ x: L.sub, a: b.a, b: b.b, y: R.sub, rel: L.c === rc ? 'trans' : 'cis' });
  });
  mol.stereo = stereo;
  return mol;
}
const flip = c => c === '/' ? '\\' : '/';

function kekulize(atoms, bonds, aromAtom) {
  const ar = bonds.map((b, k) => b.o === 1.5 ? k : -1).filter(k => k >= 0);
  if (!ar.length) return;
  for (const k of ar) bonds[k].o = 1;
  /* 방향족 원자마다 이중결합 하나가 필요 (방향족이 아닌 쪽으로 이미 이중결합이 있으면 제외) */
  const need = atoms.map((a, i) => aromAtom[i] && !bonds.some(b => (b.a === i || b.b === i) && b.o === 2));
  const adj = atoms.map(() => []);
  for (const k of ar) { adj[bonds[k].a].push(k); adj[bonds[k].b].push(k); }
  const match = new Array(atoms.length).fill(-1);
  const order = atoms.map((_, i) => i).filter(i => need[i]);
  const solve = idx => {
    if (idx === order.length) return true;
    const i = order[idx];
    if (match[i] >= 0) return solve(idx + 1);
    for (const k of adj[i]) {
      const j = bonds[k].a === i ? bonds[k].b : bonds[k].a;
      if (!need[j] || match[j] >= 0) continue;
      match[i] = k; match[j] = k;
      if (solve(idx + 1)) return true;
      match[i] = -1; match[j] = -1;
    }
    return false;
  };
  if (!solve(0)) throw new Error('방향족 고리를 케쿨레 구조로 바꾸지 못함');
  for (const k of new Set(match.filter(k => k >= 0))) bonds[k].o = 2;
}

/* ── 분자식 · 질량 · 불포화도 ───────────────────── */
export function formula(mol) {
  const cnt = {};
  for (const a of mol.atoms) { cnt[a.el] = (cnt[a.el] || 0) + 1; if (a.h) cnt.H = (cnt.H || 0) + a.h; }
  const keys = Object.keys(cnt).filter(k => k !== 'C' && k !== 'H').sort();
  const order = (cnt.C ? ['C', 'H'] : ['H']).filter(k => cnt[k]).concat(keys);
  const parts = order.map(k => [k, cnt[k]]);
  let mass = 0;
  for (const [k, n] of parts) mass += ELEMENTS[k].m * n;
  const q = mol.atoms.reduce((s, a) => s + (a.q || 0), 0);
  return { parts, text: parts.map(([k, n]) => k + (n > 1 ? n : '')).join(''), mass, count: cnt, charge: q };
}
export function unsaturation(mol) {
  const c = formula(mol).count;
  const X = (c.F || 0) + (c.Cl || 0) + (c.Br || 0) + (c.I || 0);
  return (2 * (c.C || 0) + 2 + (c.N || 0) - (c.H || 0) - X) / 2;
}
export function heavyCount(mol) { return mol.atoms.length; }

/* ── MOL 파일 (검증용). wedges: Map 결합 → { from, up } 이면 쐐기(1) · 점선 쐐기(6) 로 적는다 ── */
export function molblock(mol, wedges) {
  const L = ['', '  hexa', ''];
  L.push(`${String(mol.atoms.length).padStart(3)}${String(mol.bonds.length).padStart(3)}  0  0  0  0  0  0  0  0999 V2000`);
  for (const a of mol.atoms) L.push(`${a.x.toFixed(4).padStart(10)}${a.y.toFixed(4).padStart(10)}${'0.0000'.padStart(10)} ${a.el.padEnd(3)} 0  0  0  0  0  0  0  0  0  0  0  0`);
  mol.bonds.forEach((b, k) => {
    const w = wedges && wedges.get(k);
    const [p, q] = w && w.from === b.b ? [b.b, b.a] : [b.a, b.b];
    L.push(`${String(p + 1).padStart(3)}${String(q + 1).padStart(3)}${String(b.o).padStart(3)}${String(w ? (w.up ? 1 : 6) : 0).padStart(3)}`);
  });
  const ch = mol.atoms.map((a, i) => [i + 1, a.q]).filter(([, q]) => q);
  if (ch.length) L.push(`M  CHG${String(ch.length).padStart(3)}` + ch.map(([i, q]) => `${String(i).padStart(4)}${String(q).padStart(4)}`).join(''));
  L.push('M  END');
  return L.join('\n');
}

/* ── 간단한 SMILES 쓰기 (화면 · 저장용. 입체는 좌표로 판단해 / \ 를 붙인다) ── */
export function toSmiles(mol) {
  const n = mol.atoms.length;
  if (!n) return '';
  const R = rings(mol);
  const seen = new Array(n).fill(false);
  const closures = new Map(); /* 결합 k → 고리 닫기 번호 */
  let ringNo = 1;
  /* 먼저 신장 트리를 만들어 고리 닫기 결합을 찾는다 */
  const tree = new Set();
  const vis = new Array(n).fill(false);
  const dfs0 = i => { vis[i] = true; for (const { j, k } of mol.nb[i]) if (!vis[j]) { tree.add(k); dfs0(j); } };
  dfs0(0);
  const out = [];
  const sym = { 1: '', 2: '=', 3: '#' };
  const atomStr = (a, chi) => {
    const plain = ['B', 'C', 'N', 'O', 'P', 'S', 'F', 'Cl', 'Br', 'I'];
    if (!a.q && !chi && plain.includes(a.el)) return a.el;
    return `[${a.el}${chi || ''}${a.h ? 'H' + (a.h > 1 ? a.h : '') : ''}${a.q ? (a.q > 0 ? '+' : '-') + (Math.abs(a.q) > 1 ? Math.abs(a.q) : '') : ''}]`;
  };
  const walk = (i, from) => {
    seen[i] = true;
    const kids = mol.nb[i].filter(x => tree.has(x.k) && x.j !== from && !seen[x.j]);
    /* 입체중심: 적는 순서(앞 원자, H, 고리 닫기, 가지)로 @ / @@ */
    let chi = '';
    if (chiralOK(mol, i)) {
      const seq = [];
      if (from >= 0) seq.push(from);
      if (mol.atoms[i].h) seq.push(-1);
      for (const { j, k } of mol.nb[i]) if (!tree.has(k)) seq.push(j);
      for (const x of kids) seq.push(x.j);
      const sg = chiSignFor(mol.atoms[i].chi, seq);
      chi = sg > 0 ? '@@' : sg < 0 ? '@' : '';
    }
    let s = atomStr(mol.atoms[i], chi);
    for (const { k, o } of mol.nb[i]) {
      if (tree.has(k)) continue;
      if (!closures.has(k)) { closures.set(k, ringNo++); s += sym[o] + closures.get(k); }
      else s += sym[o] + closures.get(k);
    }
    kids.forEach((x, idx) => {
      const sub = sym[x.o] + walk(x.j, i);
      s += idx < kids.length - 1 ? `(${sub})` : sub;
    });
    return s;
  };
  out.push(walk(0, -1));
  void R;
  return out.join('.');
}
