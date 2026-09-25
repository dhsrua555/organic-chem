/* 3D 좌표: 2D 그림에서 출발해 결합 길이 · 결합각 · 이중결합의 평면(cis/trans)을 거리 제약으로 맞춘다.
   사이클로헥세인은 저절로 주름진 모양이 되고, E/Z 는 2D 그대로 유지된다. 단위 Å */
import { rings } from './core.js';

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
  const P = atoms.map(a => a.p.slice());
  const iters = n > 80 ? 220 : 320;
  for (let it = 0; it < iters; it++) {
    for (const [i, j, d0, k] of cons) {
      const dx = P[j][0] - P[i][0], dy = P[j][1] - P[i][1], dz = P[j][2] - P[i][2];
      const L = Math.hypot(dx, dy, dz) || 1e-6, f = (L - d0) / L * 0.5 * k;
      P[i][0] += dx * f; P[i][1] += dy * f; P[i][2] += dz * f; P[j][0] -= dx * f; P[j][1] -= dy * f; P[j][2] -= dz * f;
    }
    if (it % 2 === 0) for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (near.has(key(i, j))) continue;
      const hi = atoms[i].el === 'H', hj = atoms[j].el === 'H';
      const min = hi && hj ? 1.9 : hi || hj ? 2.35 : 2.9;
      const dx = P[j][0] - P[i][0], dy = P[j][1] - P[i][1], dz = P[j][2] - P[i][2];
      const L = Math.hypot(dx, dy, dz);
      if (L < min && L > 1e-6) { const f = (L - min) / L * 0.2; P[i][0] += dx * f; P[i][1] += dy * f; P[i][2] += dz * f; P[j][0] -= dx * f; P[j][1] -= dy * f; P[j][2] -= dz * f; }
    }
  }
  const c = P.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]).map(x => x / n);
  atoms.forEach((a, i) => { a.p = [P[i][0] - c[0], P[i][1] - c[1], P[i][2] - c[2]]; });
  return { atoms, bonds };
}
function bondsArom(mol, r) { for (let k = 0; k < 6; k++) { const a = r[k], b = r[(k + 1) % 6]; const nb = mol.nb[a].find(x => x.j === b); if (!nb || !mol.bonds[nb.k].arom) return false; } return true; }
