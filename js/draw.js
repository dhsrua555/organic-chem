/* 2D 구조식 (SVG). 뼈대 탄소는 C, 빈 자리는 누를 수 있는 H, 붙인 작용기는 축약 표기(COOH …).
   주사슬은 파란 띠로, 번호(위치 번호)는 작은 숫자로 얹는다. */
import { GROUPS, SCAFFOLDS } from './chem/mol.js';

const U = 56, FS = 15, CW = FS * 0.6, SUBW = 0.62;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const R = d => d * Math.PI / 180;
const X = x => x * U, Y = y => -y * U;

/* 축약 표기 조각: 숫자는 아래첨자 */
function parts(s) { return [...s].map(ch => ({ ch, sub: /\d/.test(ch) })); }
function width(s) { return parts(s).reduce((w, p) => w + (p.sub ? CW * SUBW : CW), 0); }
function charX(s, idx) { let w = 0; parts(s).forEach((p, i) => { if (i < idx) w += p.sub ? CW * SUBW : CW; }); return w + CW / 2; }
function textSpans(s) {
  return parts(s).map(p => p.sub ? `<tspan class="sb" dy="4">${p.ch}</tspan><tspan dy="-4">​</tspan>` : esc(p.ch)).join('');
}

/* 자리 방향에 따라 축약 표기를 어느 쪽으로 쓸지 */
function labelLayout(gid, dir) {
  const g = GROUPS[gid], c = Math.cos(R(dir));
  const rev = c < -0.3;
  const s = rev ? g.rev : g.label;
  const attachIdx = rev ? [...s].length - 1 : 0;
  return { s, rev, attachIdx, w: width(s) };
}

/* 원자 둘레에서 가장 넓게 빈 방향 (번호 붙일 자리) */
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
const angleTo = (p, q) => Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI;

/* opts: { interactive, locants, chain, hideH, compact, pick } */
export function drawMolecule(mol, res, opts = {}) {
  const def = SCAFFOLDS[mol.scaf];
  const ring = !!mol.ring;
  const hideH = !!opts.hideH;
  const pri = res ? res.principalAtoms : new Set();
  const els = { chain: [], bonds: [], atoms: [], sites: [], locs: [] };
  const box = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
  const grow = (x, y, pad = 0) => { box.x0 = Math.min(box.x0, x - pad); box.x1 = Math.max(box.x1, x + pad); box.y0 = Math.min(box.y0, y - pad); box.y1 = Math.max(box.y1, y + pad); };

  /* 뼈대 탄소 라벨 (사슬만) */
  const cLabel = i => {
    if (ring) return null;
    const h = mol.atoms[i].h;
    return hideH ? 'C' + (h ? 'H' + (h > 1 ? h : '') : '') : 'C';
  };
  const shrinkC = i => ring ? 0 : (cLabel(i).length > 1 ? 0.42 : 0.24);

  /* 뼈대 결합 */
  def.bonds.forEach(([a, c, o]) => {
    const A = def.atoms[a], B = def.atoms[c];
    const ang = Math.atan2(B.y - A.y, B.x - A.x), ux = Math.cos(ang), uy = Math.sin(ang);
    const sa = shrinkC(a), sb = shrinkC(c);
    const x1 = A.x + ux * sa, y1 = A.y + uy * sa, x2 = B.x - ux * sb, y2 = B.y - uy * sb;
    if (o === 1 || ring && o === 1) els.bonds.push(line(x1, y1, x2, y2));
    else if (ring) {
      els.bonds.push(line(A.x, A.y, B.x, B.y));
      /* 고리 안쪽 선 */
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, k = 0.16 / Math.hypot(mx, my);
      const ix = -mx * k, iy = -my * k, t = 0.16;
      els.bonds.push(line(A.x + ix + (B.x - A.x) * t, A.y + iy + (B.y - A.y) * t, B.x + ix - (B.x - A.x) * t, B.y + iy - (B.y - A.y) * t));
    } else {
      const nx = -uy * 0.075, ny = ux * 0.075;
      els.bonds.push(line(x1 + nx, y1 + ny, x2 + nx, y2 + ny), line(x1 - nx, y1 - ny, x2 - nx, y2 - ny));
    }
  });
  def.atoms.forEach((a, i) => {
    grow(a.x, a.y, 0.4);
    const lab = cLabel(i);
    if (lab) els.atoms.push(`<text class="m-at${pri.has(i) ? ' pri' : ''}" x="${X(a.x)}" y="${Y(a.y) + FS * 0.35}" text-anchor="middle">${textSpans(lab)}</text>`);
  });

  /* 자리: H 또는 작용기 */
  const labelPos = new Map(); /* 작용기 원자 → 글자 위치 (번호 · 사슬 띠용) */
  mol.sites.forEach(s => {
    const C = def.atoms[s.atom];
    const ux = Math.cos(R(s.dir)), uy = Math.sin(R(s.dir));
    if (!s.group) {
      if (hideH) return;
      const sa = shrinkC(s.atom);
      els.bonds.push(line(C.x + ux * sa, C.y + uy * sa, s.x - ux * 0.26, s.y - uy * 0.26, 'm-hb'));
      grow(s.x, s.y, 0.45);
      const tag = opts.interactive ? `role="button" tabindex="0" data-site="${s.i}" aria-label="${siteName(mol, s)} 수소 자리: 작용기 붙이기"` : '';
      els.sites.push(`<g class="m-site${opts.pick === s.i ? ' on' : ''}" ${tag}><polygon points="${hexPts(s.x, s.y, 0.34)}"/><text x="${X(s.x)}" y="${Y(s.y) + FS * 0.35}" text-anchor="middle">H</text></g>`);
      return;
    }
    const L = labelLayout(s.group, s.dir);
    const ax = s.x, ay = s.y; /* 붙는 원자 글자 중심 */
    const x0 = X(ax) - charX(L.s, L.attachIdx);
    const sa = shrinkC(s.atom);
    els.bonds.push(line(C.x + ux * sa, C.y + uy * sa, ax - ux * 0.27, ay - uy * 0.27));
    const isPri = s.gAtom >= 0 && pri.has(s.gAtom);
    const tag = opts.interactive ? `role="button" tabindex="0" data-site="${s.i}" data-group="${s.group}" aria-label="${siteName(mol, s)} 의 ${GROUPS[s.group].label} 떼기"` : '';
    els.sites.push(`<g class="m-grp${isPri ? ' pri' : ''}" ${tag}><rect x="${x0 - 4}" y="${Y(ay) - FS * 0.8}" width="${L.w + 8}" height="${FS * 1.5}" rx="2"/><text x="${x0}" y="${Y(ay) + FS * 0.35}">${textSpans(L.s)}</text></g>`);
    grow(ax, ay, 0.45); grow((x0 + L.w) / U, ay, 0.3); grow(x0 / U, ay, 0.3);
    /* 사슬에 들 수 있는 탄소의 글자 위치: 0번 원자 = 붙는 글자, 아세틸의 CH3 = 가운데 C */
    labelPos.set(s.gAtom, { x: (x0 + charX(L.s, L.attachIdx)) / U, y: ay, dir: s.dir });
    if (s.group === 'COCH3') labelPos.set(s.gAtom + 2, { x: (x0 + charX(L.s, 2)) / U, y: ay, dir: s.dir });
  });

  /* 주사슬 띠와 번호 */
  if (res && opts.chain !== false && res.kind === 'chain' && res.chain.length) {
    const pts = res.chain.map(i => mol.atoms[i].src.kind === 'scaf' ? def.atoms[mol.atoms[i].src.i] : labelPos.get(i)).filter(Boolean);
    if (pts.length === 1) els.chain.push(`<circle class="m-chain" cx="${X(pts[0].x)}" cy="${Y(pts[0].y)}" r="${U * 0.34}"/>`);
    else els.chain.push(`<polyline class="m-chain" points="${pts.map(p => `${X(p.x)},${Y(p.y)}`).join(' ')}"/>`);
  }
  if (res && opts.locants !== false) {
    if (res.kind === 'chain' && res.chain.length > 1) {
      res.chain.forEach(i => {
        const L = res.pos.get(i);
        const a = mol.atoms[i];
        if (a.src.kind === 'scaf') {
          const si = a.src.i, A = def.atoms[si];
          const dirs = [];
          def.bonds.forEach(([p, q]) => { if (p === si) dirs.push(angleTo(A, def.atoms[q])); if (q === si) dirs.push(angleTo(A, def.atoms[p])); });
          mol.sites.forEach(s => { if (s.atom === si && (s.group || !hideH)) dirs.push(s.dir); });
          const f = freeAngle(dirs);
          els.locs.push(locBadge(A.x + Math.cos(R(f)) * 0.5, A.y + Math.sin(R(f)) * 0.5, L));
        } else {
          const p = labelPos.get(i); if (!p) return;
          const up = Math.sin(R(p.dir)) >= -0.2 ? 1 : -1;
          els.locs.push(locBadge(p.x, p.y + up * 0.5, L));
        }
      });
    } else if (res.kind === 'benzene' && res.loc && (res.P || res.gid.filter(Boolean).length > 1)) {
      def.atoms.forEach((A, i) => els.locs.push(locBadge(A.x * 0.62, A.y * 0.62, res.loc[i], true)));
    }
  }

  const pad = 0.35;
  const vb = [X(box.x0 - pad), Y(box.y1 + pad), (box.x1 - box.x0 + 2 * pad) * U, (box.y1 - box.y0 + 2 * pad) * U].map(v => Math.round(v * 10) / 10);
  const cls = 'mol' + (opts.interactive ? ' interactive' : '') + (opts.compact ? ' compact' : '');
  const label = res ? `${res.nameEn} 구조식` : '구조식';
  return `<svg class="${cls}" viewBox="${vb.join(' ')}" role="img" aria-label="${esc(label)}" style="--u:${U}px">`
    + `<g class="m-chains">${els.chain.join('')}</g><g class="m-bonds">${els.bonds.join('')}</g><g class="m-atoms">${els.atoms.join('')}</g>`
    + `<g class="m-locs">${els.locs.join('')}</g><g class="m-sites">${els.sites.join('')}</g></svg>`;
}

function line(x1, y1, x2, y2, cls = 'm-b') { return `<line class="${cls}" x1="${r1(X(x1))}" y1="${r1(Y(y1))}" x2="${r1(X(x2))}" y2="${r1(Y(y2))}"/>`; }
const r1 = v => Math.round(v * 10) / 10;
function hexPts(x, y, r) {
  const out = [];
  for (let k = 0; k < 6; k++) { const a = R(60 * k + 30); out.push(`${r1(X(x + Math.cos(a) * r))},${r1(Y(y + Math.sin(a) * r))}`); }
  return out.join(' ');
}
function locBadge(x, y, n, ring) {
  return `<g class="m-loc${ring ? ' ring' : ''}"><text x="${r1(X(x))}" y="${r1(Y(y) + 4)}" text-anchor="middle">${n}</text></g>`;
}

/* 자리 이름 (화면 낭독 · 도움말): "C2 의 위쪽" */
const DIRNAME = d => { d = ((d % 360) + 360) % 360; if (d > 45 && d < 135) return '위'; if (d >= 135 && d <= 225) return '왼쪽'; if (d > 225 && d < 315) return '아래'; return '오른쪽'; };
export function siteName(mol, s) {
  if (mol.ring) return `고리 ${s.atom + 1}번 자리`;
  return `C${s.atom + 1} ${DIRNAME(s.dir)}`;
}

/* 작은 아이콘: 뼈대 모양 (선택 버튼용) */
export function scaffoldIcon(id) {
  const P = {
    methane: 'M16 8v16M8 16h16', ethane: 'M6 16h20M10 10v12M22 10v12', ethene: 'M7 14h18M7 18h18', propane: 'M4 16h24M9 11v10M16 11v10M23 11v10',
    propene: 'M5 13l9 0M5 17l9 0M14 15l9 6', benzene: 'M16 5l9.5 5.5v11L16 27l-9.5-5.5v-11zM16 9.5l5.6 3.2M21.6 19.5L16 22.7M10.4 19.2v-6.4'
  };
  return `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="${P[id]}"/></svg>`;
}
