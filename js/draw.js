/* 2D 구조식 (SVG). 모드: 'atoms' = 모든 원자를 CH₃ · CH₂ 처럼 표시, 'skeletal' = 골격 구조식(탄소는 꼭짓점).
   주사슬 · 주고리는 파란 띠, 위치 번호는 작은 숫자, 입체중심은 *. 누를 수 있는 원자 · 결합 표시 */
import { rings } from './chem/core.js';

const U = 50, FS = 15, CW = FS * 0.6;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const X = x => x * U, Y = y => -y * U;
const r1 = v => Math.round(v * 10) / 10;
const RAD = Math.PI / 180;

/* 원자 글자: [{t, sub, sup}] 조각과 붙는 원자 글자의 위치 */
function labelOf(mol, i, mode) {
  const a = mol.atoms[i];
  const showC = mode === 'atoms' || mol.atoms.length === 1 || a.q;
  if (a.el === 'C' && !showC) return null;
  const parts = [{ t: a.el }];
  const hPart = a.h ? [{ t: 'H' }, ...(a.h > 1 ? [{ t: String(a.h), sub: true }] : [])] : [];
  const charge = a.q ? [{ t: a.q > 0 ? '+' : '−', sup: true }] : [];
  /* 결합이 오른쪽으로 뻗어 있으면 H 를 왼쪽에: HO, H₂N, H₃C */
  let dx = 0;
  for (const { j } of mol.nb[i]) dx += mol.atoms[j].x - a.x;
  const hLeft = mol.nb[i].length && dx > 0.35;
  const seq = hLeft ? [...hPart, ...parts, ...charge] : [...parts, ...hPart, ...charge];
  const elIdx = hLeft ? hPart.length : 0;
  return { seq, elIdx };
}
function seqWidth(seq) { return seq.reduce((w, p) => w + (p.sub || p.sup ? CW * 0.62 : CW * (p.t.length)), 0); }
function seqX(seq, idx) { let w = 0; for (let k = 0; k < idx; k++) w += seq[k].sub || seq[k].sup ? CW * 0.62 : CW * seq[k].t.length; return w + CW * seq[idx].t.length / 2; }
function spans(seq) {
  return seq.map(p => p.sub ? `<tspan class="sb" dy="4">${esc(p.t)}</tspan><tspan dy="-4">​</tspan>`
    : p.sup ? `<tspan class="sp" dy="-6">${esc(p.t)}</tspan><tspan dy="6">​</tspan>` : esc(p.t)).join('');
}

/* opts: { interactive, mode, locants, chain, stars, pick, tool, hl(Set 강조 원자), compact } */
export function drawMolecule(mol, res, opts = {}) {
  const mode = opts.mode || 'atoms';
  const A = mol.atoms, R = rings(mol);
  const pri = res ? res.principalAtoms || new Set() : new Set();
  const hl = opts.hl || new Set();
  const labels = A.map((_, i) => labelOf(mol, i, mode));
  const shrink = i => labels[i] ? 0.3 : 0;
  const box = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
  const grow = (x, y, p = 0) => { box.x0 = Math.min(box.x0, x - p); box.x1 = Math.max(box.x1, x + p); box.y0 = Math.min(box.y0, y - p); box.y1 = Math.max(box.y1, y + p); };
  const out = { band: [], bonds: [], hits: [], atoms: [], locs: [], marks: [] };

  /* 주사슬 · 주고리 띠 */
  if (res && opts.chain !== false && res.parent) {
    const pa = res.parent.atoms;
    if (res.parent.type === 'chain') {
      const pts = res.chain.map(i => A[i]);
      if (pts.length === 1) out.band.push(`<circle class="m-chain" cx="${r1(X(pts[0].x))}" cy="${r1(Y(pts[0].y))}" r="${U * 0.36}"/>`);
      else out.band.push(`<polyline class="m-chain" points="${pts.map(p => `${r1(X(p.x))},${r1(Y(p.y))}`).join(' ')}"/>`);
    } else {
      const ringsIn = R.list.filter(r => r.every(a => pa.includes(a)));
      for (const r of ringsIn) out.band.push(`<polygon class="m-chain ring" points="${r.map(i => `${r1(X(A[i].x))},${r1(Y(A[i].y))}`).join(' ')}"/>`);
    }
  }
  /* 결합 */
  mol.bonds.forEach((b, k) => {
    const P = A[b.a], Q = A[b.b];
    const dx = Q.x - P.x, dy = Q.y - P.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const sa = shrink(b.a), sb = shrink(b.b);
    const x1 = P.x + ux * sa, y1 = P.y + uy * sa, x2 = Q.x - ux * sb, y2 = Q.y - uy * sb;
    const hot = pri.has(b.a) && pri.has(b.b) ? ' pri' : (hl.has(b.a) && hl.has(b.b) ? ' hl' : '');
    const cls = 'm-b' + hot;
    const line = (a1, b1, a2, b2, c = cls) => `<line class="${c}" x1="${r1(X(a1))}" y1="${r1(Y(b1))}" x2="${r1(X(a2))}" y2="${r1(Y(b2))}"/>`;
    const nx = -uy, ny = ux;
    if (b.o === 1) out.bonds.push(line(x1, y1, x2, y2));
    else if (b.o === 3) {
      const o = 0.09;
      out.bonds.push(line(x1, y1, x2, y2), line(x1 + nx * o, y1 + ny * o, x2 + nx * o, y2 + ny * o), line(x1 - nx * o, y1 - ny * o, x2 - nx * o, y2 - ny * o));
    } else {
      /* 이중결합: 고리 안이거나 골격식에서 끝 글자가 없으면 안쪽 선 하나 더 */
      const ringIdx = R.of[b.a] >= 0 && R.of[b.a] === R.of[b.b] ? R.of[b.a] : -1;
      if (ringIdx >= 0) {
        const ring = R.list[ringIdx];
        const c = ring.reduce((s, i) => [s[0] + A[i].x / ring.length, s[1] + A[i].y / ring.length], [0, 0]);
        const mx = (P.x + Q.x) / 2, my = (P.y + Q.y) / 2, s = Math.sign((c[0] - mx) * nx + (c[1] - my) * ny) || 1;
        const o = 0.16, t = 0.16;
        out.bonds.push(line(x1, y1, x2, y2), line(P.x + nx * o * s + dx * t, P.y + ny * o * s + dy * t, Q.x + nx * o * s - dx * t, Q.y + ny * o * s - dy * t));
      } else if (!labels[b.a] && !labels[b.b]) {
        /* 치환기가 많은 쪽으로 둘째 선 */
        let s = 0;
        for (const i of [b.a, b.b]) for (const { j } of mol.nb[i]) if (j !== b.a && j !== b.b) s += (A[j].x - P.x) * nx + (A[j].y - P.y) * ny;
        s = Math.sign(s) || 1;
        const o = 0.15, t = 0.14;
        out.bonds.push(line(x1, y1, x2, y2), line(P.x + nx * o * s + dx * t, P.y + ny * o * s + dy * t, Q.x + nx * o * s - dx * t, Q.y + ny * o * s - dy * t));
      } else {
        const o = 0.075;
        out.bonds.push(line(x1 + nx * o, y1 + ny * o, x2 + nx * o, y2 + ny * o), line(x1 - nx * o, y1 - ny * o, x2 - nx * o, y2 - ny * o));
      }
    }
    if (opts.interactive) out.hits.push(`<line class="hit-b" data-bond="${k}" x1="${r1(X(P.x))}" y1="${r1(Y(P.y))}" x2="${r1(X(Q.x))}" y2="${r1(Y(Q.y))}" role="button" tabindex="-1" aria-label="${b.a + 1}–${b.b + 1} 결합"/>`);
  });
  /* 원자 */
  A.forEach((a, i) => {
    grow(a.x, a.y, 0.45);
    const lab = labels[i];
    const cls = 'm-at' + (pri.has(i) ? ' pri' : hl.has(i) ? ' hl' : '') + (a.el !== 'C' ? ' het' : '');
    if (lab) {
      const w = seqWidth(lab.seq);
      const x0 = X(a.x) - seqX(lab.seq, lab.elIdx);
      out.atoms.push(`<rect class="m-lbg" x="${r1(x0 - 2)}" y="${r1(Y(a.y) - FS * 0.72)}" width="${r1(w + 4)}" height="${r1(FS * 1.36)}" rx="3"/>`);
      out.atoms.push(`<text class="${cls}" x="${r1(x0)}" y="${r1(Y(a.y) + FS * 0.36)}">${spans(lab.seq)}</text>`);
      grow(x0 / U, a.y, 0.3); grow((x0 + w) / U, a.y, 0.3);
    }
    if (opts.interactive) {
      const name = a.el + (a.h ? 'H' + (a.h > 1 ? a.h : '') : '');
      out.hits.push(`<g class="hit-a${opts.pick === i ? ' on' : ''}" data-atom="${i}" role="button" tabindex="0" aria-label="${i + 1}번 원자 ${name}${a.h ? '' : ' (H 없음)'}"><polygon points="${hexPts(a.x, a.y, 0.34)}"/></g>`);
    }
  });
  /* 위치 번호 */
  if (res && opts.locants !== false && res.pos && !(res.noLocs && res.parent.type === 'chain' && res.n <= 1)) {
    const parentSet = new Set(res.parent.atoms);
    const showRing = res.parent.type !== 'chain' ? (res.P || res.prefixes.length > 1 || (res.prefixes[0] && res.prefixes[0].locs.length > 1)) : true;
    if (showRing && !(res.parent.type === 'chain' && res.n === 1)) for (const [ai, loc] of res.pos) {
      const a = A[ai];
      if (!a) continue;
      let px, py;
      if (res.parent.type !== 'chain' && R.of[ai] >= 0) {
        const ring = R.list[R.of[ai]];
        const c = ring.reduce((s, i) => [s[0] + A[i].x / ring.length, s[1] + A[i].y / ring.length], [0, 0]);
        px = a.x + (c[0] - a.x) * 0.36; py = a.y + (c[1] - a.y) * 0.36;
      } else {
        const dirs = mol.nb[ai].map(({ j }) => Math.atan2(A[j].y - a.y, A[j].x - a.x) / RAD);
        const f = freeAngle(dirs);
        const rr = labels[ai] ? 0.62 : 0.42;
        px = a.x + Math.cos(f * RAD) * rr; py = a.y + Math.sin(f * RAD) * rr;
      }
      const txt = res.locLabel ? res.locLabel.get(ai) : loc;
      out.locs.push(`<text class="m-loc${parentSet.has(ai) && res.parent.type !== 'chain' ? ' ring' : ''}" x="${r1(X(px))}" y="${r1(Y(py) + 4)}" text-anchor="middle">${esc(txt)}</text>`);
    }
  }
  /* 입체중심 * */
  if (res && opts.stars !== false && res.centers) for (const i of res.centers) {
    const a = A[i];
    const dirs = mol.nb[i].map(({ j }) => Math.atan2(A[j].y - a.y, A[j].x - a.x) / RAD);
    const f = freeAngle(dirs) + 40;
    out.marks.push(`<text class="m-star" x="${r1(X(a.x + Math.cos(f * RAD) * 0.42))}" y="${r1(Y(a.y + Math.sin(f * RAD) * 0.42) + 5)}" text-anchor="middle">*</text>`);
  }
  const pad = 0.35;
  const w = Math.max(box.x1 - box.x0 + 2 * pad, 2.4), h = Math.max(box.y1 - box.y0 + 2 * pad, 1.6);
  const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
  const vb = [X(cx - w / 2), Y(cy + h / 2), w * U, h * U].map(r1);
  const cls = 'mol ' + mode + (opts.interactive ? ' interactive tool-' + (opts.tool || 'add') : '') + (opts.compact ? ' compact' : '');
  const label = res ? `${res.nameEn} 구조식` : '구조식';
  return `<svg class="${cls}" viewBox="${vb.join(' ')}" role="img" aria-label="${esc(label)}" style="--u:${U}px">`
    + `<g class="m-bands">${out.band.join('')}</g><g class="m-bonds">${out.bonds.join('')}</g><g class="m-atoms">${out.atoms.join('')}</g>`
    + `<g class="m-locs">${out.locs.join('')}${out.marks.join('')}</g><g class="m-hits">${out.hits.join('')}</g></svg>`;
}

function hexPts(x, y, r) {
  const o = [];
  for (let k = 0; k < 6; k++) { const a = (60 * k + 30) * RAD; o.push(`${r1(X(x + Math.cos(a) * r))},${r1(Y(y + Math.sin(a) * r))}`); }
  return o.join(' ');
}
function freeAngle(dirs) {
  if (!dirs.length) return 225;
  const a = dirs.map(d => ((d % 360) + 360) % 360).sort((p, q) => p - q);
  let best = 0, at = 0;
  for (let i = 0; i < a.length; i++) {
    const nx = i + 1 < a.length ? a[i + 1] : a[0] + 360;
    if (nx - a[i] > best) { best = nx - a[i]; at = a[i] + best / 2; }
  }
  return at;
}

/* 뼈대 선택 버튼용 작은 아이콘 */
export function templateIcon(id) {
  const P = {
    methane: 'M16 8v16M8 16h16', ethane: 'M6 16h20', ethene: 'M7 14h18M7 18h18', ethyne: 'M7 12h18M7 16h18M7 20h18',
    propane: 'M5 19l7-6 7 6 7-6', propene: 'M5 19l7-6M6 21l7-6M12 13l7 6 7-6', butane: 'M3 19l6.5-6 6.5 6 6.5-6 6.5 6', butadiene: 'M3 19l6.5-6M4 21l6.5-6M9.5 13l6.5 6 6.5-6M16 19l6.5-6 6.5 6M16.5 21l6.5-6',
    cyclohexane: 'M16 5l9.5 5.5v11L16 27l-9.5-5.5v-11z', cyclohexene: 'M16 5l9.5 5.5v11L16 27l-9.5-5.5v-11zM18 9l5 3', cyclopentane: 'M16 5l10 7.5-4 12H10l-4-12z',
    benzene: 'M16 5l9.5 5.5v11L16 27l-9.5-5.5v-11zM16 9.5l5.6 3.2M21.6 19.5L16 22.7M10.4 19.2v-6.4'
  };
  return `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="${P[id] || 'M8 16a8 8 0 1 0 16 0a8 8 0 1 0-16 0'}"/></svg>`;
}
