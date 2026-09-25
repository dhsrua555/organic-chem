/* 3D 좌표: 이상적인 결합 길이 · 각도로 원자를 하나씩 놓고(Z-행렬 방식), 겹치는 곳만 살짝 밀어낸다.
   이중결합 양쪽의 cis/trans 는 2D 그림에서 가져와 E/Z 가 그대로 유지된다. 단위 Å. */

const LEN = {
  'C-C1': 1.53, 'C-C2': 1.34, 'C-C3': 1.20, 'C-Car': 1.39, 'C-H1': 1.09, 'C-O1': 1.43, 'C-O2': 1.22, 'C-N1': 1.47, 'C-N3': 1.16,
  'O-H1': 0.97, 'N-H1': 1.01, 'C-F1': 1.35, 'C-Cl1': 1.77, 'C-Br1': 1.94, 'C-I1': 2.14, 'N-O1': 1.22, 'N-O2': 1.22
};
function blen(e1, e2, o, arom) {
  if (arom) return 1.39;
  const k1 = `${e1}-${e2}${o}`, k2 = `${e2}-${e1}${o}`;
  return LEN[k1] || LEN[k2] || 1.45;
}
const v = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: a => Math.hypot(a[0], a[1], a[2]), norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
};
function perp(u) { const t = Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]; return v.norm(v.cross(u, t)); }

/* 반환: { atoms: [{el, heavy(원래 번호 또는 -1), p:[x,y,z]}], bonds: [{a,b,o,arom}] } */
export function embed3d(mol) {
  const atoms = mol.atoms.map((a, i) => ({ el: a.el, heavy: i, x2: a.x, y2: a.y, p: null, q: a.q }));
  const bonds = mol.bonds.map(b => ({ a: b.a, b: b.b, o: b.o, arom: !!b.arom }));
  /* 수소를 실제 원자로: 뼈대의 빈 자리는 2D 좌표가 있다 */
  mol.atoms.forEach((a, i) => {
    const free = mol.sites.filter(s => s.atom === i && !s.group && a.src.kind === 'scaf');
    for (let k = 0; k < a.h; k++) {
      const s = free[k];
      atoms.push({ el: 'H', heavy: -1, x2: s ? s.x : null, y2: s ? s.y : null, p: null });
      bonds.push({ a: i, b: atoms.length - 1, o: 1 });
    }
  });
  const nb = atoms.map(() => []);
  bonds.forEach(b => { nb[b.a].push({ j: b.b, o: b.o, arom: b.arom }); nb[b.b].push({ j: b.a, o: b.o, arom: b.arom }); });
  const hyb = i => {
    const a = atoms[i];
    if (nb[i].some(n => n.arom)) return 2;
    const pi = nb[i].reduce((s, n) => s + (n.o - 1), 0);
    if (a.el === 'N' && a.q === 1) return 2;
    if (pi >= 2) return 1; if (pi === 1) return 2;
    if (a.el === 'N' && nb[i].some(n => atoms[n.j].el === 'C' && nb[n.j].some(m => m.o === 2 && atoms[m.j].el === 'O'))) return 2; /* 아마이드 N */
    return 3;
  };

  /* 시작: 고리면 정육각형, 아니면 첫 탄소와 그 이웃 하나 */
  const placed = [];
  const put = (i, p) => { atoms[i].p = p; placed.push(i); };
  if (mol.ring) {
    mol.ring.forEach((i, k) => { const a = Math.PI / 2 - k * Math.PI / 3; put(i, [Math.cos(a) * 1.39, Math.sin(a) * 1.39, 0]); });
  } else {
    put(0, [0, 0, 0]);
    const first = nb[0].find(n => atoms[n.j].el !== 'H') || nb[0][0];
    if (first) put(first.j, [blen(atoms[0].el, atoms[first.j].el, first.o, first.arom), 0, 0]);
  }
  /* 2D 에서 X 와 Q 가 선 P–A 의 같은 쪽인가 (+1 같은 쪽, -1 반대, 0 모름) */
  const side2d = (P, A, Q, X) => {
    const pa = atoms[P], aa = atoms[A], qa = atoms[Q], xa = atoms[X];
    if ([pa, aa, qa, xa].some(t => t.x2 == null)) return 0;
    const cr = (o, t) => (aa.x2 - pa.x2) * (t.y2 - o.y2) - (aa.y2 - pa.y2) * (t.x2 - o.x2);
    const s1 = cr(pa, qa), s2 = cr(pa, xa);
    if (Math.abs(s1) < 1e-6 || Math.abs(s2) < 1e-6) return 0;
    return Math.sign(s1) === Math.sign(s2) ? 1 : -1;
  };

  const queue = placed.slice();
  const done = new Set();
  while (queue.length) {
    const A = queue.shift();
    if (done.has(A)) continue;
    done.add(A);
    const todo = nb[A].filter(n => !atoms[n.j].p);
    if (!todo.length) continue;
    const placedN = nb[A].filter(n => atoms[n.j].p).map(n => n.j);
    const pos = atoms[A].p;
    const h = hyb(A);
    let dirs = [];
    if (mol.ring && mol.ring.includes(A)) {
      /* 고리 원자의 치환기: 바깥쪽으로 */
      dirs = [v.norm(pos)];
    } else if (!placedN.length) {
      dirs = [[1, 0, 0], [-0.33, 0.94, 0], [-0.33, -0.47, 0.82], [-0.33, -0.47, -0.82]];
    } else {
      const P = placedN[0];
      const u = v.norm(v.sub(atoms[P].p, pos)); /* A → P */
      const Qc = nb[P].map(n => n.j).filter(j => j !== A && atoms[j].p);
      let w1;
      if (placedN.length >= 2) {
        const o = v.norm(v.sub(atoms[placedN[1]].p, pos));
        const op = v.sub(o, v.mul(u, v.dot(o, u)));
        w1 = v.len(op) > 1e-6 ? v.norm(op) : perp(u);
      } else if (Qc.length) {
        const q = v.sub(atoms[Qc[0]].p, atoms[P].p);
        const qp = v.sub(q, v.mul(u, v.dot(q, u)));
        w1 = v.len(qp) > 1e-6 ? v.mul(v.norm(qp), -1) : perp(u); /* Q 의 반대쪽 = anti */
      } else w1 = Math.abs(u[2]) < 0.9 ? v.norm(v.cross(u, [0, 0, 1])) : perp(u);
      const w2 = v.norm(v.cross(u, w1));
      const ang = h === 1 ? 180 : h === 2 ? 120 : 109.47;
      const th = ang * Math.PI / 180;
      const need = nb[A].length - placedN.length;
      let phis;
      if (h === 1) phis = [0];
      else if (h === 2) phis = placedN.length >= 2 ? [180] : [0, 180];
      else phis = placedN.length >= 2 ? [120, 240].slice(0, need) : [0, 120, 240];
      if (placedN.length >= 2 && h === 3) {
        /* 이미 둘이 놓인 sp3: 남은 둘은 두 결합의 이등분선 반대쪽 위아래 */
        const o = v.norm(v.sub(atoms[placedN[1]].p, pos));
        const bis = v.norm(v.mul(v.add(u, o), -1));
        const nrm = v.norm(v.cross(u, o));
        dirs = [v.norm(v.add(v.mul(bis, Math.cos(0.955)), v.mul(nrm, Math.sin(0.955)))), v.norm(v.add(v.mul(bis, Math.cos(0.955)), v.mul(nrm, -Math.sin(0.955))))];
      } else if (placedN.length >= 3) {
        const s = placedN.reduce((acc, j) => v.add(acc, v.norm(v.sub(atoms[j].p, pos))), [0, 0, 0]);
        dirs = [v.norm(v.mul(s, -1))];
      } else {
        dirs = phis.map(ph => {
          const p = ph * Math.PI / 180;
          return v.norm(v.add(v.mul(u, Math.cos(th)), v.mul(v.add(v.mul(w1, Math.cos(p)), v.mul(w2, Math.sin(p))), Math.sin(th))));
        });
      }
      /* sp2 에서 두 자리 중 어느 쪽에 누구를: 2D 의 cis/trans 를 따른다 (phi 0 = Q 반대쪽, 180 = Q 쪽) */
      if (h === 2 && dirs.length === 2 && Qc.length && placedN.length === 1) {
        const Q = Qc[0];
        const sorted = todo.slice().sort((m, n) => side2d(P, A, Q, m.j) - side2d(P, A, Q, n.j));
        todo.splice(0, todo.length, ...sorted);
      }
    }
    todo.forEach((n, k) => {
      const d = dirs[k] || dirs[dirs.length - 1] || [1, 0, 0];
      const L = blen(atoms[A].el, atoms[n.j].el, n.o, n.arom);
      put(n.j, v.add(pos, v.mul(d, L)));
      queue.push(n.j);
    });
    for (const j of placedN) if (!done.has(j)) queue.push(j);
  }
  for (const a of atoms) if (!a.p) a.p = [Math.random(), Math.random(), Math.random()];
  relax(atoms, bonds, nb);
  const c = atoms.reduce((s, a) => v.add(s, a.p), [0, 0, 0]).map(x => x / atoms.length);
  atoms.forEach(a => { a.p = v.sub(a.p, c); });
  return { atoms, bonds };
}

/* 결합 · 1-3 거리는 처음 값을 지키고, 3결합 이상 떨어진 원자끼리 너무 가까우면 민다 */
function relax(atoms, bonds, nb) {
  const n = atoms.length;
  const cons = [];
  const dist = (i, j) => v.len(v.sub(atoms[i].p, atoms[j].p));
  const near = atoms.map(() => new Set());
  bonds.forEach(b => { cons.push([b.a, b.b, dist(b.a, b.b), 1]); near[b.a].add(b.b); near[b.b].add(b.a); });
  for (let i = 0; i < n; i++) {
    const ns = nb[i].map(x => x.j);
    for (let p = 0; p < ns.length; p++) for (let q = p + 1; q < ns.length; q++) { cons.push([ns[p], ns[q], dist(ns[p], ns[q]), 0.6]); near[ns[p]].add(ns[q]); near[ns[q]].add(ns[p]); }
  }
  /* 이중결합 건너 1-4 (평면 · cis/trans 유지) */
  bonds.filter(b => b.o === 2 || b.arom).forEach(b => {
    for (const x of nb[b.a]) for (const y of nb[b.b]) if (x.j !== b.b && y.j !== b.a) cons.push([x.j, y.j, dist(x.j, y.j), 0.4]);
  });
  const P = atoms.map(a => a.p.slice());
  for (let it = 0; it < 160; it++) {
    for (const [i, j, d0, k] of cons) {
      const d = v.sub(P[j], P[i]); const L = v.len(d) || 1e-6; const f = (L - d0) / L * 0.5 * k;
      for (let t = 0; t < 3; t++) { P[i][t] += d[t] * f; P[j][t] -= d[t] * f; }
    }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (near[i].has(j)) continue;
      const min = atoms[i].el === 'H' || atoms[j].el === 'H' ? 2.2 : 2.9;
      const d = v.sub(P[j], P[i]); const L = v.len(d);
      if (L < min && L > 1e-6) { const f = (L - min) / L * 0.25; for (let t = 0; t < 3; t++) { P[i][t] += d[t] * f; P[j][t] -= d[t] * f; } }
    }
  }
  atoms.forEach((a, i) => { a.p = P[i]; });
}
