/* 반응 예측: 기질(분자 그래프) + 시약 → 생성물(주 · 부), 메커니즘, 선택성, 풀이 단계, 최신 관점.
   규칙은 스미스 유기화학의 핵심 반응 단원 흐름을 따르고, 2000년대 이후 달라진 이해와 방법을 덧붙였다.
   생성물은 이름 엔진으로 이름을 짓는다 (react-data.js 에 시약 목록과 설명 글). */
import { clone, parseSmiles, addBond, setOrder, removeAtoms, bondBetween, rings, isBenzene, perceiveAromatic, components, subMol, HALOGENS, chiralOK, cleanChi, orient4 } from './core.js';
import { layout, stereoFromCoords, branch } from './layout.js';
import { stereocenters } from './cip.js';
import { analyze } from './name.js';

/* ── 그래프 도구 ─────────────────────────────── */
export function work(mol) {
  const m = clone(mol);
  m._st = stereoFromCoords(mol);
  m.atoms.forEach(a => { delete a.nw; });
  return m;
}
/* 원자 i 에 조각(SMILES)을 order 결합으로 붙이고 조각 첫 원자 번호를 돌려준다 */
export function graft(m, i, smi, order = 1, replaceH = true) {
  const f = parseSmiles(smi);
  const base = m.atoms.length;
  f.atoms.forEach(x => { m.atoms.push({ ...x, nw: true }); m.nb.push([]); });
  f.bonds.forEach(b => addBond(m, base + b.a, base + b.b, b.o, { arom: b.arom }));
  addBond(m, i, base, order);
  if (replaceH) m.atoms[i].h -= order;
  m.atoms[base].h = Math.max(0, m.atoms[base].h - order);
  m.atoms[i].nw = true;
  (m._extraSt = m._extraSt || []).push(...(f.stereo || []).map(s => ({ x: s.x + base, a: s.a + base, b: s.b + base, y: s.y + base, rel: s.rel })));
  m._rings = null;
  return base;
}
export function setBond(m, a, b, o) {
  const bd = bondBetween(m, a, b);
  const k = m.bonds.indexOf(bd);
  setOrder(m, k, o);
  m.atoms[a].nw = true; m.atoms[b].nw = true;
}
/* 결합을 끊는다 (나중에 조각으로 나뉨) */
export function cut(m, a, b) {
  const bd = bondBetween(m, a, b);
  bd.o = 0; bd.dead = true;
  m.atoms[a].nw = true; m.atoms[b].nw = true;
}
/* 여러 조각 중 key 원자(반응 중심)가 든 것을 주생성물로 */
export function rolesByKey(prods, tag) {
  const hasKey = prods.map(p => p.atoms.some(a => a.key));
  const any = hasKey.some(Boolean);
  return prods.map((p, i) => ({ mol: p, role: (any ? hasKey[i] : i === 0) ? 'major' : 'side', tag }));
}
/* 반응이 끝난 그래프를 분자 여러 개로 나누고 좌표를 만든다. stereoExtra: [{x,a,b,y,rel}] (옛 번호) */
export function finish(m, stereoExtra = []) {
  const dead = new Set();
  m.atoms.forEach((a, i) => { if (a.dead) dead.add(i); });
  const st = [...(m._st || []), ...(m._extraSt || []), ...stereoExtra];
  const liveBonds = m.bonds.filter(b => !b.dead && !dead.has(b.a) && !dead.has(b.b));
  const atoms = m.atoms.map(a => ({ ...a }));
  const tmp = { atoms, bonds: liveBonds.map(b => ({ ...b })) };
  const nb = atoms.map(() => []);
  tmp.bonds.forEach((b, k) => { nb[b.a].push({ j: b.b, o: b.o, k }); nb[b.b].push({ j: b.a, o: b.o, k }); });
  tmp.nb = nb;
  const comps = components(tmp).filter(c => !c.every(i => dead.has(i)));
  return comps.map(c => {
    const s = subMol(tmp, c);
    const map = new Map(c.map((a, i) => [a, i]));
    const cons = st.map(x => ({ ...x, x: map.get(x.x), a: map.get(x.a), b: map.get(x.b), y: map.get(x.y) }))
      .filter(x => [x.x, x.a, x.b, x.y].every(v => v !== undefined) && bondBetween(s, x.a, x.b) && bondBetween(s, x.a, x.b).o === 2);
    perceiveAromatic(s);
    cleanChi(s);
    layout(s, { stereo: cons });
    return s;
  });
}
/* 알켄 첨가의 입체: 이중결합 a=b 의 면 위(+1) · 아래(−1)에서 새 원자가 붙었다고 보고 두 탄소의 배열(chi)을 정한다.
   mol0: 반응 전 분자(좌표), m: 반응 뒤 그래프, faces: { [원자]: ±1 }, addedH: 이번에 H 를 받은 원자 Set, n0: 반응 전 원자 수.
   결과는 한쪽 거울상 하나 — 실제로는 두 면에서 똑같이 일어나므로 라세미(또는 메소) */
/* 첨가로 새 입체중심이 하나만 생기면 상대 배열이 없으므로 배열을 지운다 (그냥 라세미). 둘 이상이면 남긴다 */
export function settleFaces(prod) {
  const fc = stereocenters(prod).filter(i => prod.atoms[i].face);
  prod.atoms.forEach((a, i) => { if (a.face) { if (fc.length < 2) delete a.chi; delete a.face; } });
  return fc.length >= 2;
}
export function faceStereo(mol0, m, a, b, faces, addedH, n0) {
  for (const [c, other] of [[a, b], [b, a]]) {
    const A = mol0.atoms[c];
    if (m.atoms[c].h > 1) continue;
    const nbs = m.nb[c].filter(n => !(m.bonds[n.k] && m.bonds[n.k].dead) && !(m.atoms[n.j].dead)).map(n => n.j);
    if (nbs.length + m.atoms[c].h !== 4 || m.nb[c].some(n => !(m.bonds[n.k] && m.bonds[n.k].dead) && n.o !== 1 && m.bonds[n.k].o !== 1)) continue;
    const pos = new Map();
    /* 반응 전부터 있던 이웃은 평면 위 (x, y, 0) */
    let sx = 0, sy = 0;
    for (const j of nbs) {
      if (j < n0) { const P = mol0.atoms[j], dx = P.x - A.x, dy = P.y - A.y, L = Math.hypot(dx, dy) || 1; pos.set(j, [dx / L, dy / L, 0]); sx += dx / L; sy += dy / L; }
    }
    for (const j of nbs) if (j >= n0) pos.set(j, [0, 0, faces[c]]);
    if (m.atoms[c].h === 1) {
      if (addedH.has(c)) pos.set(-1, [0, 0, faces[c]]);
      else { const L = Math.hypot(sx, sy) || 1; pos.set(-1, [-sx / L, -sy / L, 0]); }
    }
    const n = nbs.slice(); if (m.atoms[c].h === 1) n.push(-1);
    if (n.length !== 4 || n.some(j => !pos.has(j))) continue;
    const o = orient4(...n.map(j => pos.get(j)));
    if (o) m.atoms[c] = { ...m.atoms[c], chi: { n, s: o }, face: true };
    void other;
  }
}
const isC = (m, i) => m.atoms[i].el === 'C';
const live = (m, n) => !m.atoms[n.j].dead && !(m.bonds[n.k] && m.bonds[n.k].dead);
export function carbonNbrs(m, i, except = -1) { return m.nb[i].filter(n => n.j !== except && isC(m, n.j) && live(m, n)).map(n => n.j); }
function aromaticAtom(m, i) { return m.nb[i].some(n => m.bonds[n.k].arom); }
function sp3(m, i) { return m.nb[i].every(n => n.o === 1) && !aromaticAtom(m, i); }
export function classOf(m, i) { return carbonNbrs(m, i).length; }
const CLASS_KO = ['메틸', '1차', '2차', '3차', '4차'];
function benzylic(m, i) { return carbonNbrs(m, i).some(j => aromaticAtom(m, j)); }
function allylic(m, i) { return carbonNbrs(m, i).some(j => !aromaticAtom(m, j) && m.nb[j].some(n => n.o === 2 && isC(m, n.j) && n.j !== i)); }
/* 탄소 양이온 안정도 점수 (클수록 안정) */
export function cationScore(m, i) {
  let s = classOf(m, i) * 10;
  if (benzylic(m, i)) s += 16;
  if (allylic(m, i)) s += 13;
  if (m.nb[i].some(n => live(m, n) && m.atoms[n.j].el === 'O' && n.o === 1)) s += 12;
  return s;
}
/* 1,2-이동: i 의 양이온이 이웃으로 옮겨 더 안정해지는가. 반환 { to, kind:'H'|'CH3', mover } 또는 null */
export function shiftFor(m, c) {
  let best = null;
  const base = cationScore(m, c);
  for (const n of carbonNbrs(m, c)) {
    if (!sp3(m, n)) continue;
    if (m.atoms[n].h > 0) {
      const s = cationScore(m, n) ;
      if (s > base && (!best || s > best.score)) best = { to: n, kind: 'H', score: s };
    } else {
      for (const r of carbonNbrs(m, n, c)) {
        if (m.atoms[r].h !== 3) continue;
        /* 메틸이 c 로 옮기면 n 은 이웃 하나를 잃는다 */
        const s = (classOf(m, n) - 1 + 1) * 10 + (benzylic(m, n) ? 16 : 0);
        if (s > base && (!best || s > best.score)) best = { to: n, kind: 'CH3', mover: r, score: s };
      }
    }
  }
  return best;
}
/* 양이온 중심 c 에서 이웃 to 로 H 또는 CH3 가 옮겨 와 양이온이 to 로 간다 */
export function applyShift(m, c, sh) {
  if (sh.kind === 'H') { m.atoms[c].h += 1; m.atoms[sh.to].h -= 1; }
  else {
    const r = sh.mover;
    const k = m.bonds.findIndex(b => (b.a === sh.to && b.b === r) || (b.b === sh.to && b.a === r));
    m.bonds.splice(k, 1);
    rebuild(m);
    addBond(m, c, r, 1);
    m.atoms[r].nw = true;
  }
  m.atoms[c].nw = true; m.atoms[sh.to].nw = true;
}
function rebuild(m) {
  m.nb = m.atoms.map(() => []);
  m.bonds.forEach((b, k) => { m.nb[b.a].push({ j: b.b, o: b.o, k }); m.nb[b.b].push({ j: b.a, o: b.o, k }); });
  m._rings = null;
}
/* 이중결합 탄소에 붙은 탄소 수 (치환도) */
export function alkeneDegree(m, a, b) { return carbonNbrs(m, a, b).length + carbonNbrs(m, b, a).length; }
function conjugated(m, a, b) { return [a, b].some(x => carbonNbrs(m, x).some(j => j !== a && j !== b && (aromaticAtom(m, j) || m.nb[j].some(n => n.o >= 2 && n.j !== x)))); }

/* ── 작용기 찾기 ─────────────────────────────── */
export function scan(mol) {
  const m = mol, A = m.atoms, R = rings(m);
  const { info } = analyze(m);
  const out = { halides: [], alcohols: [], phenols: [], alkenes: [], alkynes: [], carbonyls: [], arenes: [], arylHalides: [], vinylHalides: [], acidic: [], nitro: [], benzylic: [], amines: [] };
  A.forEach((a, i) => {
    if (a.el === 'C' && sp3(m, i)) for (const n of m.nb[i]) if (['Cl', 'Br', 'I'].includes(A[n.j].el)) out.halides.push({ c: i, x: n.j, cls: classOf(m, i), allylic: allylic(m, i), benzylic: benzylic(m, i) });
    if (a.el === 'C' && !sp3(m, i)) for (const n of m.nb[i]) if (['Cl', 'Br', 'I'].includes(A[n.j].el) && !(info[i] && info[i].oxo.length)) (aromaticAtom(m, i) ? out.arylHalides : out.vinylHalides).push({ c: i, x: n.j });
    if (a.el === 'O' && a.h === 1 && m.nb[i].length === 1) {
      const c = m.nb[i][0].j;
      if (A[c].el !== 'C') return;
      if (aromaticAtom(m, c)) { out.phenols.push({ c, o: i }); out.acidic.push({ atom: i, why: '페놀 O–H' }); }
      else if (info[c] && info[c].oxo.length) out.acidic.push({ atom: i, why: '카복실산 O–H' });
      else if (sp3(m, c)) { out.alcohols.push({ c, o: i, cls: classOf(m, c) }); out.acidic.push({ atom: i, why: '알코올 O–H' }); }
    }
    if (a.el === 'N' && a.q === 0 && a.h > 0) { out.acidic.push({ atom: i, why: 'N–H' }); if (!m.nb[i].some(n => info[n.j] && info[n.j].oxo.length)) out.amines.push({ n: i }); }
    if (a.el === 'N' && a.q === 1) out.nitro.push({ n: i, c: m.nb[i].find(n => A[n.j].el === 'C')?.j });
    if (a.el === 'C' && a.h > 0 && m.nb[i].some(n => n.o === 3 && A[n.j].el === 'C')) out.acidic.push({ atom: i, why: '말단 알카인 C–H' });
  });
  m.bonds.forEach(b => {
    if (b.arom || A[b.a].el !== 'C' || A[b.b].el !== 'C') return;
    if (b.o === 2) out.alkenes.push({ a: b.a, b: b.b, ring: R.of[b.a] >= 0 && R.of[b.a] === R.of[b.b] });
    if (b.o === 3) out.alkynes.push({ a: b.a, b: b.b, terminal: A[b.a].h > 0 || A[b.b].h > 0 });
  });
  info.forEach((f, i) => { if (f && f.kind) out.carbonyls.push({ c: i, kind: f.kind, f }); });
  R.list.forEach(r => { if (isBenzene(m, r)) out.arenes.push({ ring: r }); });
  A.forEach((a, i) => { if (a.el === 'C' && a.h > 0 && sp3(m, i) && benzylic(m, i)) out.benzylic.push({ c: i }); });
  out.info = info;
  return out;
}

/* ── 결과 만들기 ─────────────────────────────── */
export function product(mol, role, extra = {}) { return { mol, role, ...extra }; }
export function none(reason, extra = {}) { return { ok: false, reason, products: [], steps: [], select: [], ...extra }; }

/* ═══ 치환 · 제거 (할로젠화 알킬) ════════════════ */
/* 친핵체/염기 성격: nuc 세기, base 세기, bulky, solvent(protic/aprotic), frag(붙는 조각 SMILES) */
export const NUCS = {
  NaI: { frag: 'I', nuc: 'strong', base: 'weak', solvent: 'aprotic', ko: '아이오딘화 이온 (좋은 친핵체 · 약한 염기)' },
  NaCN: { frag: 'C#N', nuc: 'strong', base: 'moderate', solvent: 'aprotic', ko: '사이안화 이온 (좋은 친핵체 · 약한 염기)' },
  NH3: { frag: 'N', nuc: 'strong', base: 'weak', solvent: 'protic', ko: '암모니아 (중성 친핵체)' },
  NaOH: { frag: 'O', nuc: 'strong', base: 'strong', solvent: 'protic', ko: '수산화 이온 (강한 친핵체 · 강한 염기)' },
  NaOMe: { frag: 'OC', nuc: 'strong', base: 'strong', solvent: 'protic', ko: '메톡사이드 (강한 친핵체 · 강한 염기)' },
  NaOEt: { frag: 'OCC', nuc: 'strong', base: 'strong', solvent: 'protic', ko: '에톡사이드 (강한 친핵체 · 강한 염기)' },
  tBuOK: { frag: 'OC(C)(C)C', nuc: 'weak', base: 'strong', bulky: true, solvent: 'protic', ko: 'tert-뷰톡사이드 (부피 큰 강염기)' },
  H2O: { frag: 'O', nuc: 'weak', base: 'weak', solvent: 'protic', heat: true, ko: '물 (약한 친핵체 · 약한 염기, 양성자성 용매)' },
  MeOH: { frag: 'OC', nuc: 'weak', base: 'weak', solvent: 'protic', heat: true, ko: '메탄올 (약한 친핵체 · 약한 염기, 양성자성 용매)' }
};

/* 치환: 탄소 c 의 이탈기 x 를 frag 로 바꾼다. inv: 뒤쪽 공격(SN2)이면 배열이 거울상으로 뒤집힌다 (월든 반전) */
export function substitute(mol, c, x, frag, inv = true) {
  const m = work(mol);
  m.atoms[x].dead = true;
  const bd = bondBetween(m, c, x); bd.dead = true;
  m.atoms[c].h += 1;
  const nu = graft(m, c, frag);
  if (chiralOK(mol, c)) {
    const chi = mol.atoms[c].chi;
    m.atoms[c] = { ...m.atoms[c], chi: { n: chi.n.map(j => j === x ? nu : j), s: inv ? -chi.s : chi.s } };
  }
  return finish(m)[0];
}
/* 제거: c 의 이탈기 x 와 β 탄소 bt 의 H 로 C=C. rel: 'cis'|'trans'|null (기준 치환기끼리) */
export function eliminate(mol, c, x, bt, rel) {
  const m = work(mol);
  m.atoms[x].dead = true;
  bondBetween(m, c, x).dead = true;
  m.atoms[bt].h -= 1;
  setBond(m, c, bt, 2);
  const extra = [];
  if (rel) {
    const p = carbonNbrs(m, c, bt).concat(m.nb[c].filter(n => n.j !== bt && n.j !== x && !isC(m, n.j) && !m.atoms[n.j].dead).map(n => n.j))[0];
    const q = m.nb[bt].filter(n => n.j !== c).map(n => n.j)[0];
    if (p !== undefined && q !== undefined) extra.push({ x: p, a: c, b: bt, y: q, rel });
  }
  return finish(m, extra)[0];
}
/* β 탄소 목록 (H 있고, 이미 다중결합이 아닌 탄소) */
export function betas(m, c) { return carbonNbrs(m, c).filter(j => m.atoms[j].h > 0 && sp3(m, j)); }
