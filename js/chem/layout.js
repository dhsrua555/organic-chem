/* 2D 좌표 만들기: 사슬은 지그재그, 고리는 정다각형, 이중결합의 cis/trans 는 제약대로.
   겹치면 단일결합을 축으로 작은 쪽을 뒤집어 푼다. 결합 길이 1 */
import { rings, bondBetween } from './core.js';

const RAD = Math.PI / 180;
const dirv = d => [Math.cos(d * RAD), Math.sin(d * RAD)];
const ang = (p, q) => Math.atan2(q[1] - p[1], q[0] - p[0]) / RAD;

/* 현재 좌표에서 C=C 의 cis/trans 관계를 읽어 둔다 (다시 배치해도 유지하려고) */
export function stereoFromCoords(mol) {
  const out = [];
  const R = rings(mol);
  mol.bonds.forEach(b => {
    if (b.o !== 2 || b.arom) return;
    if (R.same(b.a, b.b)) return;
    const x = mol.nb[b.a].find(n => n.j !== b.b), y = mol.nb[b.b].find(n => n.j !== b.a);
    if (!x || !y) return;
    const s1 = side(mol, b.a, b.b, x.j), s2 = side(mol, b.a, b.b, y.j);
    if (!s1 || !s2) return;
    out.push({ x: x.j, a: b.a, b: b.b, y: y.j, rel: s1 === s2 ? 'cis' : 'trans' });
  });
  return out;
}
function side(mol, a, b, p) {
  const A = mol.atoms[a], B = mol.atoms[b], P = mol.atoms[p];
  const c = (B.x - A.x) * (P.y - A.y) - (B.y - A.y) * (P.x - A.x);
  return Math.abs(c) < 1e-6 ? 0 : Math.sign(c);
}

/* opts: { root, stereo, orient(기본 true), dir(뿌리에서 시작 각도) } */
export function layout(mol, opts = {}) {
  const n = mol.atoms.length;
  if (!n) return mol;
  const R = rings(mol);
  const pos = new Array(n).fill(null);
  const theta = new Array(n).fill(0), turn = new Array(n).fill(1);
  const placedRing = new Set();
  const stereo = opts.stereo || mol.stereo || [];

  /* 가지 깊이: 주사슬을 지그재그로 곧게 이어 가려고 */
  const depthMemo = new Map();
  const depth = (i, from) => {
    const k = i + ',' + from;
    if (depthMemo.has(k)) return depthMemo.get(k);
    depthMemo.set(k, 0);
    let d = 0;
    for (const { j } of mol.nb[i]) if (j !== from && !R.same(i, j)) d = Math.max(d, depth(j, i));
    const v = d + (R.of[i] >= 0 ? R.list[R.of[i]].length : 1);
    depthMemo.set(k, v);
    return v;
  };
  const linear = i => mol.nb[i].some(x => x.o === 3) || mol.nb[i].filter(x => x.o === 2).length >= 2;

  const comps = componentsOf(mol);
  let offsetX = 0;
  for (const comp of comps) {
    const root = opts.root !== undefined && comp.includes(opts.root) ? opts.root : pickRoot(mol, comp, R);
    const queue = [];
    if (R.of[root] >= 0) {
      placeRing(R.of[root], null, [0, 0], 90);
    } else {
      pos[root] = [0, 0]; theta[root] = (opts.dir ?? 0) - 30; turn[root] = -1;
      queue.push(root);
    }
    while (queue.length) {
      const A = queue.shift();
      const kids = mol.nb[A].filter(x => !pos[x.j]).map(x => x.j);
      if (!kids.length) continue;
      const parentN = mol.nb[A].filter(x => pos[x.j]);
      kids.sort((p, q) => depth(q, A) - depth(p, A));
      let dirs;
      if (R.of[A] >= 0) {
        /* 고리 원자의 바깥쪽 치환기 (두 고리에 걸친 원자는 두 고리 중심의 평균에서 바깥쪽) */
        const cs = R.list.filter(r => r.includes(A) && r.every(i => pos[i])).map(r => centroid(r.map(i => pos[i])));
        const c = cs.length ? centroid(cs) : centroid(R.list[R.of[A]].filter(i => pos[i]).map(i => pos[i]));
        const phi = ang(c, pos[A]);
        dirs = kids.length === 1 ? [phi] : [phi + 35, phi - 35];
      } else if (!parentN.length || A === root && R.of[A] < 0 && parentN.length === 0) {
        /* 뿌리: 120° 간격 (180° 로 펴면 cis/trans 를 읽을 수 없다). 단 삼중결합 · C=C=C 의 sp 원자는 일직선 */
        const t0 = theta[A];
        if (linear(A) && kids.length === 2) dirs = [t0 + 60, t0 + 240];
        else dirs = [[t0 + 60], [t0 + 60, t0 - 60], [t0 + 60, t0 - 60, t0 + 180], [t0 + 45, t0 - 45, t0 + 135, t0 - 135]][Math.min(kids.length, 4) - 1];
      } else {
        const t = theta[A];
        if (linear(A) && kids.length === 1) dirs = [t];
        else if (kids.length === 1) dirs = [t + 60 * turn[A]];
        else if (kids.length === 2) dirs = [t + 60 * turn[A], t - 60 * turn[A]];
        else dirs = [t, t + 90, t - 90];
      }
      kids.forEach((j, i) => {
        const d = dirs[Math.min(i, dirs.length - 1)] + (i >= dirs.length ? 25 * i : 0);
        if (pos[j]) return;
        /* 이미 놓인 고리와 결합 하나를 나눠 갖는 고리(축합): 그 결합 위에 바깥쪽으로 정다각형 */
        const fr = R.list.findIndex((r, ri) => !placedRing.has(ri) && r.includes(j) && r.includes(A) && r.some(x => x !== A && pos[x]));
        if (fr >= 0 && placeFused(fr)) return;
        if (R.of[j] >= 0 && !placedRing.has(R.of[j])) {
          const v = dirv(d);
          const p = [pos[A][0] + v[0], pos[A][1] + v[1]];
          placeRing(R.of[j], j, p, d);
        } else {
          const v = dirv(d);
          pos[j] = [pos[A][0] + v[0], pos[A][1] + v[1]];
          theta[j] = d;
          const diff = ((d - theta[A]) % 360 + 540) % 360 - 180;
          turn[j] = Math.abs(diff) < 1 ? turn[A] : -Math.sign(diff) || 1;
          queue.push(j);
        }
      });
    }
    /* 고리 배치: entry 원자를 p 에, 들어온 방향 d 로 */
    function placeRing(ri, entry, p, d) {
      placedRing.add(ri);
      const ring = R.list[ri], m = ring.length;
      const rr = 1 / (2 * Math.sin(Math.PI / m));
      const e = entry === null ? ring[0] : entry;
      const start = ring.indexOf(e);
      const v = dirv(d);
      const c = entry === null ? [0, 0] : [p[0] + v[0] * rr, p[1] + v[1] * rr];
      const a0 = entry === null ? 90 : d + 180;
      const tryDir = s => ring.map((_, k) => {
        const a = a0 + s * 360 * k / m;
        return [c[0] + Math.cos(a * RAD) * rr, c[1] + Math.sin(a * RAD) * rr];
      });
      let best = null, bestScore = Infinity;
      for (const s of [1, -1]) {
        const pts = tryDir(s);
        let score = 0;
        pts.forEach(pt => pos.forEach((q, qi) => { if (q && !ring.includes(qi)) { const dd = Math.hypot(pt[0] - q[0], pt[1] - q[1]); if (dd < 0.8) score += (0.8 - dd) ** 2; } }));
        if (score < bestScore) { bestScore = score; best = pts; }
      }
      for (let k = 0; k < m; k++) {
        const atom = ring[(start + k) % m];
        pos[atom] = best[k];
      }
      ring.forEach(a => queue.push(a));
    }
    function placeFused(ri) {
      const ring = R.list[ri], m = ring.length;
      let k0 = -1;
      for (let k = 0; k < m; k++) if (pos[ring[k]] && pos[ring[(k + 1) % m]]) { k0 = k; break; }
      if (k0 < 0) return false;
      placedRing.add(ri);
      const u = ring[k0], v = ring[(k0 + 1) % m], U = pos[u], V = pos[v];
      const other = R.list.find((r, i) => i !== ri && placedRing.has(i) && r.includes(u) && r.includes(v));
      const oc = other ? centroid(other.map(x => pos[x])) : null;
      const mid = [(U[0] + V[0]) / 2, (U[1] + V[1]) / 2];
      const ex = V[0] - U[0], ey = V[1] - U[1], L = Math.hypot(ex, ey) || 1;
      let nx = -ey / L, ny = ex / L;
      if (oc && (oc[0] - mid[0]) * nx + (oc[1] - mid[1]) * ny > 0) { nx = -nx; ny = -ny; }
      const rr = L / (2 * Math.sin(Math.PI / m)), hh = L / (2 * Math.tan(Math.PI / m));
      const c = [mid[0] + nx * hh, mid[1] + ny * hh];
      const au = Math.atan2(U[1] - c[1], U[0] - c[0]), av = Math.atan2(V[1] - c[1], V[0] - c[0]);
      let step = av - au;
      step = ((step + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
      for (let t = 2; t < m; t++) {
        const a = ring[(k0 + t) % m], an = av + step * (t - 1);
        if (!pos[a]) pos[a] = [c[0] + Math.cos(an) * rr, c[1] + Math.sin(an) * rr];
      }
      ring.forEach(a => queue.push(a));
      return true;
    }
    /* 조각마다 옆으로 띄운다 */
    const xs = comp.map(i => pos[i][0]);
    const minX = Math.min(...xs);
    comp.forEach(i => { pos[i][0] += offsetX - minX; });
    offsetX = Math.max(...comp.map(i => pos[i][0])) + 2;
  }
  mol.atoms.forEach((a, i) => { a.x = pos[i][0]; a.y = pos[i][1]; });

  /* cis/trans 제약 맞추기: 틀린 쪽의 가지를 이중결합 축에 대해 뒤집는다 */
  for (let pass = 0; pass < 2; pass++) for (const s of stereo) {
    if (!validStereo(mol, s)) continue;
    const want = s.rel === 'cis' ? 1 : -1;
    const got = side(mol, s.a, s.b, s.x) * side(mol, s.a, s.b, s.y);
    if (got === want || got === 0) continue;
    const sideB = branch(mol, s.b, s.a), sideA = branch(mol, s.a, s.b);
    const flipSet = sideB.size <= sideA.size ? sideB : sideA;
    reflect(mol, flipSet, s.a, s.b);
  }
  untangle(mol, R, stereo, linear);
  if (opts.orient !== false) orient(mol);
  return mol;
}

function validStereo(mol, s) {
  return [s.x, s.a, s.b, s.y].every(i => i >= 0 && i < mol.atoms.length) && bondBetween(mol, s.a, s.b) && bondBetween(mol, s.x, s.a) && bondBetween(mol, s.b, s.y);
}
function componentsOf(mol) {
  const seen = new Array(mol.atoms.length).fill(false), out = [];
  for (let s = 0; s < mol.atoms.length; s++) {
    if (seen[s]) continue;
    const c = [], q = [s]; seen[s] = true;
    while (q.length) { const i = q.pop(); c.push(i); for (const { j } of mol.nb[i]) if (!seen[j]) { seen[j] = true; q.push(j); } }
    out.push(c.sort((a, b) => a - b));
  }
  return out;
}
/* 뿌리: 고리가 있으면 가장 큰 고리, 없으면 가장 긴 경로의 한쪽 끝 */
function pickRoot(mol, comp, R) {
  const ringAtoms = comp.filter(i => R.of[i] >= 0);
  if (ringAtoms.length) {
    let best = ringAtoms[0];
    for (const a of ringAtoms) if (R.list[R.of[a]].length > R.list[R.of[best]].length) best = a;
    return R.list[R.of[best]][0];
  }
  const far = s => { const d = new Map([[s, 0]]), q = [s]; let last = s; while (q.length) { const i = q.shift(); last = i; for (const { j } of mol.nb[i]) if (!d.has(j)) { d.set(j, d.get(i) + 1); q.push(j); } } return last; };
  return far(far(comp[0]));
}
function centroid(pts) { const s = pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]); return [s[0] / pts.length, s[1] / pts.length]; }

/* a 에서 b 방향으로 뻗은 쪽 원자들 (b 포함, a 제외) */
export function branch(mol, b, a) {
  const set = new Set([b]), q = [b];
  while (q.length) { const i = q.pop(); for (const { j } of mol.nb[i]) if (j !== a && !set.has(j)) { set.add(j); q.push(j); } }
  set.delete(a);
  return set;
}
function reflect(mol, set, a, b) {
  const A = mol.atoms[a], B = mol.atoms[b];
  const dx = B.x - A.x, dy = B.y - A.y, L = dx * dx + dy * dy;
  for (const i of set) {
    if (i === a || i === b) continue;
    const P = mol.atoms[i];
    const t = ((P.x - A.x) * dx + (P.y - A.y) * dy) / L;
    const fx = A.x + t * dx, fy = A.y + t * dy;
    P.x = 2 * fx - P.x; P.y = 2 * fy - P.y;
  }
}
function rotate(mol, set, c, deg) {
  const C = mol.atoms[c], co = Math.cos(deg * RAD), si = Math.sin(deg * RAD);
  for (const i of set) { if (i === c) continue; const P = mol.atoms[i]; const x = P.x - C.x, y = P.y - C.y; P.x = C.x + x * co - y * si; P.y = C.y + x * si + y * co; }
}
function clashScore(mol) {
  const A = mol.atoms, n = A.length;
  const bonded = new Set(mol.bonds.map(b => b.a < b.b ? b.a * 4096 + b.b : b.b * 4096 + b.a));
  let s = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (bonded.has(i * 4096 + j)) continue;
    const d = Math.hypot(A[i].x - A[j].x, A[i].y - A[j].y);
    if (d < 0.72) s += (0.72 - d) ** 2 * (d < 0.3 ? 4 : 1);
  }
  /* 결합이 서로 가로지르는 것도 벌점 */
  const B = mol.bonds;
  for (let p = 0; p < B.length; p++) for (let q = p + 1; q < B.length; q++) {
    const b1 = B[p], b2 = B[q];
    if (b1.a === b2.a || b1.a === b2.b || b1.b === b2.a || b1.b === b2.b) continue;
    if (cross(A[b1.a], A[b1.b], A[b2.a], A[b2.b])) s += 0.5;
  }
  return s;
}
function cross(p1, p2, p3, p4) {
  const d = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
/* 겹침 풀기: 고리 밖 단일결합마다 작은 쪽을 뒤집거나 돌려 본다.
   움직이는 쪽(side)만 바뀌므로 점수는 "움직이는 원자 × 나머지 원자", "움직이는 결합 × 고정된 결합" 만 다시 센다
   (움직이는 쪽 안의 쌍은 통째로 움직여 그대로). 지금 겹침이 없는 쪽은 돌려 봐야 나아질 수 없으므로 건너뛴다 */
function untangle(mol, R, stereo, linear) {
  let score = clashScore(mol);
  if (score < 1e-6) return;
  const A = mol.atoms, n = A.length;
  const bonded = new Set(mol.bonds.map(b => b.a < b.b ? b.a * 4096 + b.b : b.b * 4096 + b.a));
  const locked = new Set();
  for (const s of stereo) { locked.add(s.a); locked.add(s.b); }
  /* sp 원자(삼중결합 · C=C=C)에서 가지를 돌리면 180° 가 깨진다 */
  A.forEach((_, i) => { if (linear(i)) locked.add(i); });
  const inS = new Uint8Array(n);
  for (let pass = 0; pass < 4 && score > 1e-6; pass++) {
    for (let k = 0; k < mol.bonds.length && score > 1e-6; k++) {
      const b = mol.bonds[k];
      if (b.o !== 1 || R.same(b.a, b.b)) continue;
      for (const [u, v] of [[b.a, b.b], [b.b, b.a]]) {
        const side = branch(mol, v, u);
        if (side.size > n / 2 + 0.5) continue;
        const S = [...side];
        inS.fill(0); for (const i of S) inS[i] = 1;
        const mv = [], fx = [];
        for (const bd of mol.bonds) (inS[bd.a] || inS[bd.b] ? mv : fx).push(bd);
        const part = () => {
          let t = 0;
          for (const i of S) {
            const P = A[i];
            for (let j = 0; j < n; j++) {
              if (inS[j] || bonded.has(i < j ? i * 4096 + j : j * 4096 + i)) continue;
              const d = Math.hypot(P.x - A[j].x, P.y - A[j].y);
              if (d < 0.72) t += (0.72 - d) ** 2 * (d < 0.3 ? 4 : 1);
            }
          }
          for (const b1 of mv) for (const b2 of fx) {
            if (b1.a === b2.a || b1.a === b2.b || b1.b === b2.a || b1.b === b2.b) continue;
            if (cross(A[b1.a], A[b1.b], A[b2.a], A[b2.b])) t += 0.5;
          }
          return t;
        };
        const before = part();
        if (before < 1e-9) continue;
        const save = S.map(i => [i, A[i].x, A[i].y]);
        const restore = () => save.forEach(([i, x, y]) => { A[i].x = x; A[i].y = y; });
        const trials = [() => reflect(mol, side, u, v), () => rotate(mol, side, u, 60), () => rotate(mol, side, u, -60), () => rotate(mol, side, u, 30), () => rotate(mol, side, u, -30)];
        let best = before, bestT = -1;
        trials.forEach((f, ti) => {
          if (ti > 0 && locked.has(u)) return; /* 이중결합 · sp 원자에서는 각도를 바꾸지 않음 */
          f(); const t = part(); if (t < best - 1e-9) { best = t; bestT = ti; } restore();
        });
        if (bestT >= 0) { trials[bestT](); score += best - before; }
      }
    }
  }
  if (score > 1e-6) relax(mol);
}
/* 남은 겹침은 살짝 밀어낸다 */
function relax(mol) {
  const A = mol.atoms, n = A.length;
  const bonded = new Set(mol.bonds.map(b => b.a < b.b ? b.a * 4096 + b.b : b.b * 4096 + b.a));
  for (let it = 0; it < 60; it++) {
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (bonded.has(i * 4096 + j)) continue;
      const dx = A[j].x - A[i].x, dy = A[j].y - A[i].y, d = Math.hypot(dx, dy) || 1e-3;
      if (d < 0.8) { const f = (0.8 - d) / d * 0.25; A[i].x -= dx * f; A[i].y -= dy * f; A[j].x += dx * f; A[j].y += dy * f; }
    }
    for (const b of mol.bonds) {
      const P = A[b.a], Q = A[b.b], dx = Q.x - P.x, dy = Q.y - P.y, d = Math.hypot(dx, dy) || 1e-3, f = (d - 1) / d * 0.5;
      P.x += dx * f; P.y += dy * f; Q.x -= dx * f; Q.y -= dy * f;
    }
  }
}
/* 가장 긴 방향을 가로로 (30° 단위로 맞춰 육각형 모양 유지) */
function orient(mol) {
  const A = mol.atoms, n = A.length;
  if (n < 3) { if (n === 2) { const d = ang([A[0].x, A[0].y], [A[1].x, A[1].y]); rotAll(mol, -d); } center(mol); return; }
  const c = centroid(A.map(a => [a.x, a.y]));
  let sxx = 0, syy = 0, sxy = 0;
  for (const a of A) { const x = a.x - c[0], y = a.y - c[1]; sxx += x * x; syy += y * y; sxy += x * y; }
  const t = 0.5 * Math.atan2(2 * sxy, sxx - syy) / RAD;
  const snap = Math.round(t / 30) * 30;
  rotAll(mol, -snap);
  center(mol);
}
function rotAll(mol, deg) {
  const co = Math.cos(deg * RAD), si = Math.sin(deg * RAD);
  for (const a of mol.atoms) { const x = a.x, y = a.y; a.x = x * co - y * si; a.y = x * si + y * co; }
}
function center(mol) {
  const c = centroid(mol.atoms.map(a => [a.x, a.y]));
  for (const a of mol.atoms) { a.x -= c[0]; a.y -= c[1]; }
}
