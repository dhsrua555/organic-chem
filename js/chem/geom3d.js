/* 3D 좌표: 2D 그림에서 출발해 결합 길이 · 결합각 · 이중결합의 평면(cis/trans)을 거리 제약으로 맞춘다.
   사이클로헥세인은 저절로 주름진 모양이 되고, E/Z 는 2D 그대로, 입체중심(R/S)은 원자의 chi 대로 맞춘다. 단위 Å */
import { rings, chiralOK, orient4 } from './core.js';

const LEN = {
  'CC1': 1.53, 'CC2': 1.34, 'CC3': 1.20, 'CH1': 1.09, 'CO1': 1.43, 'CO2': 1.22, 'CN1': 1.47, 'CN2': 1.28, 'CN3': 1.16,
  'HO1': 0.97, 'HN1': 1.01, 'CF1': 1.35, 'CCl1': 1.77, 'CBr1': 1.94, 'CI1': 2.14, 'NO1': 1.22, 'NO2': 1.22, 'OO1': 1.47
};
function blen(e1, e2, o, arom) {
  if (arom) return 1.39;
  const k = [e1, e2].sort().join('') + o;
  return LEN[k] || 1.45;
}
const RAD = Math.PI / 180;

export function embed3d(mol) {
  const R = rings(mol);
  const atoms = mol.atoms.map((a, i) => ({ el: a.el, heavy: i, q: a.q, p: [a.x * 1.5, a.y * 1.5, 0] }));
  const bonds = mol.bonds.map(b => ({ a: b.a, b: b.b, o: b.o, arom: !!b.arom }));
  const nbH = mol.atoms.map(() => []);
  /* 수소 */
  mol.atoms.forEach((a, i) => {
    for (let k = 0; k < a.h; k++) {
      atoms.push({ el: 'H', heavy: -1, p: [0, 0, 0] });
      const hi = atoms.length - 1;
      bonds.push({ a: i, b: hi, o: 1 });
      nbH[i].push(hi);
    }
  });
  const n = atoms.length;
  const nb = atoms.map(() => []);
  bonds.forEach(b => { nb[b.a].push({ j: b.b, o: b.o, arom: b.arom }); nb[b.b].push({ j: b.a, o: b.o, arom: b.arom }); });
  const hyb = i => {
    const a = atoms[i];
    if (a.el === 'H') return 0;
    if (nb[i].some(x => x.arom)) return 2;
    const pi = nb[i].reduce((s, x) => s + (x.o - 1), 0);
    if (pi >= 2) return 1;
    if (pi === 1) return 2;
    if (a.el === 'N' && a.q === 1) return 2;
    if (a.el === 'N' && nb[i].some(x => atoms[x.j].el === 'C' && nb[x.j].some(m => m.o === 2 && atoms[m.j].el === 'O'))) return 2;
    return 3;
  };
  /* 처음 z: 고리 sp3 원자는 번갈아 위아래 (의자 모양의 씨앗), 나머지는 조금씩 흔든다 */
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
  R.list.forEach(r => r.forEach((a, k) => { if (hyb(a) === 3) atoms[a].p[2] = (k % 2 ? 0.35 : -0.35); }));
  mol.atoms.forEach((_, i) => { if (R.of[i] < 0) atoms[i].p[2] += rnd() * 0.5; });
  /* 수소 처음 자리: 이웃 반대쪽 */
  mol.atoms.forEach((a, i) => {
    const hs = nbH[i]; if (!hs.length) return;
    const c = atoms[i].p;
    let dx = 0, dy = 0;
    for (const { j } of nb[i]) if (atoms[j].el !== 'H') { dx += atoms[j].p[0] - c[0]; dy += atoms[j].p[1] - c[1]; }
    const L = Math.hypot(dx, dy) || 1;
    const bx = -dx / L, by = -dy / L;
    hs.forEach((h, k) => {
      const ang = (k - (hs.length - 1) / 2) * 1.1;
      const zx = hs.length > 1 ? (k % 2 ? 0.8 : -0.8) : 0;
      atoms[h].p = [c[0] + (bx * Math.cos(ang) - by * Math.sin(ang)) * 1.0, c[1] + (bx * Math.sin(ang) + by * Math.cos(ang)) * 1.0, c[2] + zx + rnd() * 0.2];
    });
  });
  /* 거리 제약 */
  const cons = [];
  const d12 = new Map();
  const key = (i, j) => i < j ? i * 100000 + j : j * 100000 + i;
  bonds.forEach(b => { const L = blen(atoms[b.a].el, atoms[b.b].el, b.o, b.arom); cons.push([b.a, b.b, L, 1]); d12.set(key(b.a, b.b), L); });
  const near = new Set(bonds.map(b => key(b.a, b.b)));
  for (let c = 0; c < n; c++) {
    const h = hyb(c); if (!h) continue;
    const th = (h === 1 ? 180 : h === 2 ? 120 : 109.5) * RAD;
    const ns = nb[c].map(x => x.j);
    for (let p = 0; p < ns.length; p++) for (let q = p + 1; q < ns.length; q++) {
      const a = d12.get(key(c, ns[p])), b = d12.get(key(c, ns[q]));
      cons.push([ns[p], ns[q], Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(th)), 0.6]);
      near.add(key(ns[p], ns[q]));
    }
  }
  /* 이중결합 건너편: 2D 에서 같은 쪽이면 cis 거리, 반대쪽이면 trans 거리 */
  const side2d = (a, b, x) => {
    const A = mol.atoms[a], B = mol.atoms[b], X = atoms[x].heavy >= 0 ? mol.atoms[atoms[x].heavy] : null;
    if (!X) return 0;
    return Math.sign((B.x - A.x) * (X.y - A.y) - (B.y - A.y) * (X.x - A.x));
  };
  bonds.filter(b => (b.o === 2 || b.arom) && b.b < mol.atoms.length).forEach(b => {
    const xs = nb[b.a].filter(x => x.j !== b.b).map(x => x.j), ys = nb[b.b].filter(x => x.j !== b.a).map(x => x.j);
    if (!xs.length || !ys.length) return;
    const L = d12.get(key(b.a, b.b));
    /* 한쪽에 둘이면 서로 반대쪽: 수소는 무거운 원자의 반대편으로 */
    const sideOf = (list, a, bb) => {
      const s = list.map(x => side2d(a, bb, x));
      if (list.length === 2) { if (!s[0] && s[1]) s[0] = -s[1]; if (!s[1] && s[0]) s[1] = -s[0]; if (!s[0] && !s[1]) { s[0] = 1; s[1] = -1; } }
      else if (!s[0]) s[0] = 1;
      return s;
    };
    const sx = sideOf(xs, b.a, b.b), sy = sideOf(ys, b.a, b.b);
    xs.forEach((x, i) => ys.forEach((y, k) => {
      const lx = d12.get(key(b.a, x)), ly = d12.get(key(b.b, y));
      const px = [lx * Math.cos(120 * RAD), lx * Math.sin(120 * RAD) * sx[i]];
      const py = [L + ly * Math.cos(60 * RAD), ly * Math.sin(60 * RAD) * sy[k]];
      cons.push([x, y, Math.hypot(px[0] - py[0], px[1] - py[1]), 0.5]);
      near.add(key(x, y));
    }));
  });
  /* 벤젠: 마주 보는 원자 거리 */
  R.list.forEach(r => {
    if (r.length !== 6 || !bondsArom(mol, r)) return;
    for (let k = 0; k < 3; k++) { cons.push([r[k], r[k + 3], 2.78, 0.5]); near.add(key(r[k], r[k + 3])); }
  });
  /* 입체중심: 네 이웃(암시적 H 는 방금 만든 H 원자)의 방향이 chi 와 같아야 한다 */
  const chiral = [];
  mol.atoms.forEach((a, i) => {
    if (!chiralOK(mol, i)) return;
    const nn = a.chi.n.map(j => j < 0 ? nbH[i][0] : j);
    if (nn.some(j => j === undefined)) return;
    /* 뒤집을 이웃: 가지(중심 너머 원자들)가 가장 작은 것 — H 가 있으면 H. 가지째 거울에 비춰 넘긴다.
       고리로 다른 이웃과 이어진 가지는 통째로 옮길 수 없으니 그 원자 하나만 */
    const branchOf = s0 => {
      const seen = new Set([s0]), q = [s0];
      while (q.length) { const x = q.pop(); for (const { j } of nb[x]) if (j !== i && !seen.has(j)) { seen.add(j); q.push(j); } }
      return seen;
    };
    let best = null;
    for (const j of nn) {
      const br = branchOf(j);
      const ok = !nn.some(o => o !== j && br.has(o));
      const move = ok ? [...br] : [j];
      /* 다른 입체중심이 든 가지를 통째로 비추면 그 중심이 뒤집히므로 되도록 피한다 */
      const hasOther = ok && move.some(x => x < mol.atoms.length && x !== i && chiralOK(mol, x));
      const cost = ok ? move.length + (hasOther ? 500 : 0) : 1000 + nb[j].length;
      if (!best || cost < best.cost) best = { flip: j, move, cost };
    }
    chiral.push({ c: i, nn, s: a.chi.s, flip: best.flip, move: best.move });
  });

  /* 좌표는 한 줄짜리 배열 (x0 y0 z0 x1 …), 거리 제약도 숫자 배열로: 빠르게 */
  const X = new Float64Array(n * 3);
  atoms.forEach((a, i) => { X[i * 3] = a.p[0]; X[i * 3 + 1] = a.p[1]; X[i * 3 + 2] = a.p[2]; });
  const nc = cons.length, CI = new Int32Array(nc), CJ = new Int32Array(nc), CD = new Float64Array(nc), CK = new Float64Array(nc);
  cons.forEach(([i, j, d, k], t) => { CI[t] = i * 3; CJ[t] = j * 3; CD[t] = d; CK[t] = k * 0.5; });
  const nearM = new Uint8Array(n * n);
  for (const k of near) { const i = Math.floor(k / 100000), j = k % 100000; nearM[i * n + j] = 1; nearM[j * n + i] = 1; }
  const isH = atoms.map(a => a.el === 'H');
  /* 겹침 검사 후보: 가까운 쌍만 (20번마다 다시 고름) */
  let pairs = new Int32Array(0);
  const refreshPairs = () => {
    const out = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (nearM[i * n + j]) continue;
      const dx = X[j * 3] - X[i * 3], dy = X[j * 3 + 1] - X[i * 3 + 1], dz = X[j * 3 + 2] - X[i * 3 + 2];
      if (dx * dx + dy * dy + dz * dz < 25) out.push(i, j);
    }
    pairs = Int32Array.from(out);
  };
  const fixChiral = () => {
    for (const ch of chiral) {
      const p = ch.nn.map(j => [X[j * 3], X[j * 3 + 1], X[j * 3 + 2]]);
      const o = orient4(p[0], p[1], p[2], p[3]);
      if (o === ch.s) continue;
      /* 뒤집을 이웃을 나머지 세 이웃이 만드는 평면 건너편으로 */
      const k = ch.nn.indexOf(ch.flip), rest = p.filter((_, t) => t !== k);
      const u = [rest[1][0] - rest[0][0], rest[1][1] - rest[0][1], rest[1][2] - rest[0][2]];
      const v = [rest[2][0] - rest[0][0], rest[2][1] - rest[0][1], rest[2][2] - rest[0][2]];
      const nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0];
      const L2 = nx * nx + ny * ny + nz * nz || 1e-9;
      for (const at of ch.move) {
        const f = at * 3;
        const d = ((X[f] - rest[0][0]) * nx + (X[f + 1] - rest[0][1]) * ny + (X[f + 2] - rest[0][2]) * nz) / L2;
        const push = at === ch.flip && Math.abs(d) < 1e-6 ? 0.3 / Math.sqrt(L2) : 0;
        X[f] -= (2 * d + push) * nx; X[f + 1] -= (2 * d + push) * ny; X[f + 2] -= (2 * d + push) * nz;
      }
    }
  };
  const iters = n > 80 ? 220 : 300;
  const relaxOnce = it => {
    if (it % 20 === 0) refreshPairs();
    for (let t = 0; t < nc; t++) {
      const i = CI[t], j = CJ[t];
      const dx = X[j] - X[i], dy = X[j + 1] - X[i + 1], dz = X[j + 2] - X[i + 2];
      const L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6, f = (L - CD[t]) / L * CK[t];
      X[i] += dx * f; X[i + 1] += dy * f; X[i + 2] += dz * f; X[j] -= dx * f; X[j + 1] -= dy * f; X[j + 2] -= dz * f;
    }
    if (it % 2 === 0) for (let q = 0; q < pairs.length; q += 2) {
      const a = pairs[q], b = pairs[q + 1], i = a * 3, j = b * 3;
      const min = isH[a] && isH[b] ? 1.9 : isH[a] || isH[b] ? 2.35 : 2.9;
      const dx = X[j] - X[i], dy = X[j + 1] - X[i + 1], dz = X[j + 2] - X[i + 2];
      const L2 = dx * dx + dy * dy + dz * dz;
      if (L2 < min * min && L2 > 1e-12) { const L = Math.sqrt(L2), f = (L - min) / L * 0.2; X[i] += dx * f; X[i + 1] += dy * f; X[i + 2] += dz * f; X[j] -= dx * f; X[j + 1] -= dy * f; X[j + 2] -= dz * f; }
    }
  };
  const wrong = () => chiral.some(ch => orient4(...ch.nn.map(j => [X[j * 3], X[j * 3 + 1], X[j * 3 + 2]])) !== ch.s);
  for (let it = 0; it < iters; it++) {
    if (chiral.length && it % 4 === 0 && it < iters - 60) fixChiral();
    relaxOnce(it);
  }
  /* 끝에서 뒤집힌 입체중심이 남았으면 몇 번 더 (고리에 묶인 중심은 한 번에 안 넘어가기도 한다) */
  for (let extra = 0; extra < 6 && chiral.length && wrong(); extra++) {
    for (let it = 0; it < 80; it++) { if (it % 4 === 0 && it < 40) fixChiral(); relaxOnce(it); }
  }
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += X[i * 3]; cy += X[i * 3 + 1]; cz += X[i * 3 + 2]; }
  cx /= n; cy /= n; cz /= n;
  atoms.forEach((a, i) => { a.p = [X[i * 3] - cx, X[i * 3 + 1] - cy, X[i * 3 + 2] - cz]; });
  return { atoms, bonds };
}
function bondsArom(mol, r) { for (let k = 0; k < 6; k++) { const a = r[k], b = r[(k + 1) % 6]; const nb = mol.nb[a].find(x => x.j === b); if (!nb || !mol.bonds[nb.k].arom) return false; } return true; }
