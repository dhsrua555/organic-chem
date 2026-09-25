/* IUPAC 이름 짓기 (2013 권고 기준, 교과서 표기 병기)
   - 사슬(메테인 ~ 프로펜 + 작용기): 주 작용기 → 주사슬 → 번호 → 접두사(알파벳 순) → 입체(E/Z)
   - 벤젠 + 작용기: 모체(phenol, benzoic acid …) → 번호 → 접두사
   결과는 영어 · 한글 토큰 목록(역할별 색칠용)과 풀이 단계를 함께 돌려준다. */
import { doubleBondStereo, stereocenters } from './cip.js';

export const PRI = { acid: 1, ester: 2, amide: 3, nitrile: 4, aldehyde: 5, ketone: 6, alcohol: 7, amine: 8 };
export const CLASS = {
  acid: { ko: '카복실산', en: 'carboxylic acid', fg: '–COOH' },
  ester: { ko: '에스터', en: 'ester', fg: '–COO–' },
  amide: { ko: '아마이드', en: 'amide', fg: '–CONH₂' },
  nitrile: { ko: '나이트릴', en: 'nitrile', fg: '–C≡N' },
  aldehyde: { ko: '알데하이드', en: 'aldehyde', fg: '–CHO' },
  ketone: { ko: '케톤', en: 'ketone', fg: '>C=O' },
  alcohol: { ko: '알코올', en: 'alcohol', fg: '–OH' },
  amine: { ko: '아민', en: 'amine', fg: '–NH₂' }
};
const TERMINAL = new Set(['acid', 'ester', 'amide', 'nitrile', 'aldehyde']);

const STEM = [null, 'meth', 'eth', 'prop', 'but', 'pent', 'hex', 'hept', 'oct', 'non', 'dec', 'undec', 'dodec'];
const KO_FULL = [null, '메테인', '에테인', '프로페인', '뷰테인', '펜테인', '헥세인', '헵테인', '옥테인', '노네인', '데케인', '운데케인', '도데케인'];
const KO_EL = [null, '메탄', '에탄', '프로판', '뷰탄', '펜탄', '헥산', '헵탄', '옥탄', '노난', '데칸', '운데칸', '도데칸'];
const KO_UN = [null, '메트', '에트', '프로프', '뷰트', '펜트', '헥스', '헵트', '옥트', '논', '데크', '운데크', '도데크'];
const KO_YL = [null, '메틸', '에틸', '프로필', '뷰틸', '펜틸', '헥실', '헵틸', '옥틸', '노닐', '데실'];
const MULT = ['', '', 'di', 'tri', 'tetra', 'penta', 'hexa'];
const MULT_KO = ['', '', '다이', '트라이', '테트라', '펜타', '헥사'];
const MULT2 = ['', '', 'bis', 'tris', 'tetrakis'];
const MULT2_KO = ['', '', '비스', '트리스', '테트라키스'];
export const CHAIN_WORD = { en: STEM, ko: KO_EL };

const PX = {
  F: ['fluoro', '플루오로'], Cl: ['chloro', '클로로'], Br: ['bromo', '브로모'], I: ['iodo', '아이오도'],
  nitro: ['nitro', '나이트로'], hydroxy: ['hydroxy', '하이드록시'], amino: ['amino', '아미노'], methoxy: ['methoxy', '메톡시'],
  oxo: ['oxo', '옥소'], cyano: ['cyano', '사이아노'], formyl: ['formyl', '폼일'], carboxy: ['carboxy', '카복시'],
  carbamoyl: ['carbamoyl', '카바모일'], methoxycarbonyl: ['methoxycarbonyl', '메톡시카보닐'], acetyl: ['acetyl', '아세틸'],
  methyl: ['methyl', '메틸']
};
/* 접미사: [영어, 한글, 모음으로 시작?] 개수별 */
const SUF = {
  acid: [null, ['oic acid', '산', 1], ['dioic acid', '다이오산', 0]],
  ester: [null, ['oate', '산', 1], ['dioate', '다이오산', 0]],
  amide: [null, ['amide', '아마이드', 1], ['diamide', '다이아마이드', 0]],
  nitrile: [null, ['nitrile', '나이트릴', 0], ['dinitrile', '다이나이트릴', 0]],
  aldehyde: [null, ['al', '알', 1], ['dial', '다이알', 0]],
  ketone: [null, ['one', '온', 1], ['dione', '다이온', 0], ['trione', '트라이온', 0], ['tetrone', '테트론', 0]],
  alcohol: [null, ['ol', '올', 1], ['diol', '다이올', 0], ['triol', '트라이올', 0], ['tetrol', '테트롤', 0]],
  amine: [null, ['amine', '아민', 1], ['diamine', '다이아민', 0], ['triamine', '트라이아민', 0], ['tetraamine', '테트라아민', 0]]
};
/* 탄소를 사슬 밖에 두고 붙이는 접미사 (고리, 또는 한 사슬에 셋 이상) */
const CARBO = {
  acid: ['carboxylic acid', '카복실산'], ester: ['carboxylate', '카복실산'], amide: ['carboxamide', '카복스아마이드'],
  nitrile: ['carbonitrile', '카보나이트릴'], aldehyde: ['carbaldehyde', '카브알데하이드']
};
const RETAINED = {
  acid: ['benzoic acid', '벤조산'], ester: ['benzoate', '벤조산'], amide: ['benzamide', '벤즈아마이드'],
  nitrile: ['benzonitrile', '벤조나이트릴'], aldehyde: ['benzaldehyde', '벤즈알데하이드'], alcohol: ['phenol', '페놀'], amine: ['aniline', '아닐린']
};

const T = (en, ko, r) => ({ en, ko: ko === undefined ? en : ko, r });
const cmpList = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const x = a[i] ?? 1e9, y = b[i] ?? 1e9; if (x !== y) return x - y; } return 0; };
const letters = s => s.toLowerCase().replace(/[^a-z]/g, '');

/* ── 분석: 탄소마다 붙은 헤테로원자와 작용기 종류 ─────────────────────── */
export function analyze(mol) {
  const A = mol.atoms;
  return A.map((a, i) => {
    if (a.el !== 'C') return null;
    const f = { oxo: [], OH: [], OR: [], NH2: [], nitN: -1, halo: [], nitro: [], kind: null };
    for (const { j, o } of mol.nb[i]) {
      const b = A[j];
      if (b.el === 'O') {
        if (o === 2) f.oxo.push(j);
        else if (b.h === 1) f.OH.push(j);
        else {
          const other = mol.nb[j].find(n => n.j !== i);
          if (other && A[other.j].el === 'C') f.OR.push({ o: j, c: other.j });
        }
      } else if (b.el === 'N') {
        if (o === 3) f.nitN = j;
        else if (b.q === 1) f.nitro.push(j);
        else if (b.h === 2) f.NH2.push(j);
      } else if (b.el !== 'C') f.halo.push(j);
    }
    if (f.nitN >= 0) f.kind = 'nitrile';
    else if (f.oxo.length && f.OH.length) f.kind = 'acid';
    else if (f.oxo.length && f.OR.length) f.kind = 'ester';
    else if (f.oxo.length && f.NH2.length) f.kind = 'amide';
    else if (f.oxo.length && a.h >= 1) f.kind = 'aldehyde';
    else if (f.oxo.length) f.kind = 'ketone';
    return f;
  });
}

function classesPresent(mol, info, atoms) {
  const set = new Set();
  for (const i of atoms) {
    const f = info[i]; if (!f) continue;
    if (f.kind) set.add(f.kind);
    if (f.OH.length && f.kind !== 'acid') set.add('alcohol');
    if (f.NH2.length && f.kind !== 'amide') set.add('amine');
  }
  return set;
}
function topClass(set) { let P = null; for (const c of set) if (!P || PRI[c] < PRI[P]) P = c; return P; }

/* 원자 i 에서 탄소–탄소 결합만 따라 닿는 탄소 (block 은 건너뜀) */
function carbonTree(mol, starts, block) {
  const seen = new Set(), q = [];
  for (const s of starts) if (!block.has(s)) { seen.add(s); q.push(s); }
  while (q.length) {
    const i = q.shift();
    for (const { j } of mol.nb[i]) if (mol.atoms[j].el === 'C' && !seen.has(j) && !block.has(j)) { seen.add(j); q.push(j); }
  }
  return seen;
}
function pathIn(mol, nodes, u, v) {
  const par = new Map([[u, -1]]), q = [u];
  while (q.length) {
    const i = q.shift(); if (i === v) break;
    for (const { j } of mol.nb[i]) if (nodes.has(j) && !par.has(j)) { par.set(j, i); q.push(j); }
  }
  if (!par.has(v)) return [];
  const p = []; for (let x = v; x !== -1; x = par.get(x)) p.push(x);
  return p.reverse();
}
function bondOrder(mol, a, b) { const n = mol.nb[a].find(x => x.j === b); return n ? n.o : 0; }

/* ── 접두사 목록: 사슬(path, 번호 pos) 위의 모든 치환기 ───────────────── */
function prefixesOn(ctx, path, pos) {
  const { mol, info, P, tri, S } = ctx;
  const out = [];
  const add = (loc, key, extra) => out.push(Object.assign({ loc, en: PX[key][0], ko: PX[key][1], key: PX[key][0], compound: key === 'methoxycarbonyl' }, extra || {}));
  const suffixKind = k => !tri && P && k === P && (TERMINAL.has(P) || P === 'ketone');
  for (const c of path) {
    const L = pos.get(c), f = info[c];
    if (f.kind && !suffixKind(f.kind)) {
      if (f.kind === 'aldehyde' || f.kind === 'ketone') add(L, 'oxo');
      else if (f.kind === 'ester') { add(L, 'oxo'); add(L, 'methoxy'); }
      else if (f.kind === 'amide') { add(L, 'oxo'); add(L, 'amino'); }
      else if (f.kind === 'acid') { add(L, 'oxo'); add(L, 'hydroxy'); }
    }
    if (f.kind !== 'acid') for (const o of f.OH) if (P !== 'alcohol' || tri) add(L, 'hydroxy', { atom: o });
    if (f.kind !== 'amide') for (const n of f.NH2) if (P !== 'amine' || tri) add(L, 'amino', { atom: n });
    if (f.kind !== 'ester') for (const o of f.OR) add(L, 'methoxy', { atom: o.o });
    for (const x of f.halo) add(L, mol.atoms[x].el, { atom: x });
    for (const x of f.nitro) add(L, 'nitro', { atom: x });
    for (const { j, o } of mol.nb[c]) {
      if (mol.atoms[j].el !== 'C' || pos.has(j) || ctx.skip.has(j)) continue;
      if (tri && S.has(j)) continue;
      const b = branchName(ctx, j, c, o);
      out.push(Object.assign({ loc: L, atom: j }, b));
    }
  }
  return out;
}

/* 곁가지 이름 (메틸, 하이드록시메틸, 프로판-2-일, 메틸리덴 …) */
function branchName(ctx, r, from, bo) {
  const { mol, info } = ctx, f = info[r];
  const simple = (en, ko, compound = false) => ({ en, ko, key: letters(en), compound });
  if (bo === 1 && f.kind) {
    if (f.kind === 'acid') return simple('carboxy', '카복시');
    if (f.kind === 'ester') return simple('methoxycarbonyl', '메톡시카보닐', true);
    if (f.kind === 'amide') return simple('carbamoyl', '카바모일');
    if (f.kind === 'nitrile') return simple('cyano', '사이아노');
    if (f.kind === 'aldehyde') return simple('formyl', '폼일');
    if (f.kind === 'ketone') {
      const others = mol.nb[r].filter(n => n.j !== from && mol.atoms[n.j].el === 'C');
      if (others.length === 1) {
        const m = others[0].j, fm = info[m];
        const bare = mol.atoms[m].h === 3 && !fm.kind && !fm.OH.length && !fm.NH2.length && !fm.OR.length && !fm.halo.length && !fm.nitro.length;
        if (bare) return simple('acetyl', '아세틸');
      }
    }
  }
  /* 일반 알킬: 곁가지 안에서 다시 사슬을 고른다 (자유 원자가 자리에 작은 번호) */
  const block = new Set([from]);
  const sub = carbonTree(mol, [r], block);
  for (const c of [...sub]) { const k = info[c].kind; if (c !== r && (k === 'acid' || k === 'nitrile')) sub.delete(c); }
  /* 가지 뿌리가 산/나이트릴이면 위에서 이미 처리됐으므로 여기서는 없다 */
  const nodes = [...sub].filter(c => c === r || isConnectedWithout(mol, sub, r, c));
  const nodeSet = new Set(nodes);
  const sctx = { mol, info, P: null, tri: false, S: new Set(), skip: new Set([from]) };
  let best = null;
  for (const u of nodes) for (const v of nodes) {
    const p = pathIn(mol, nodeSet, u, v);
    if (!p.includes(r)) continue;
    const pos = new Map(p.map((c, i) => [c, i + 1]));
    const enes = enesOn(mol, p, pos);
    const pre = prefixesOn(sctx, p, pos);
    const cand = { p, pos, fv: pos.get(r), enes, pre, n: p.length };
    if (!best || cmpBranch(cand, best) < 0) best = cand;
  }
  const { n, fv, enes, pre } = best;
  const yl = bo === 2 ? ['ylidene', '일리덴'] : ['yl', '일'];
  let en, ko, locInBase = false;
  if (!enes.length) {
    if (fv === 1) { en = STEM[n] + yl[0]; ko = (KO_YL[n] || KO_EL[n]) + (bo === 2 ? '리덴' : ''); }
    else { en = `${STEM[n]}an-${fv}-${yl[0]}`; ko = `${KO_EL[n]}-${fv}-${yl[1]}`; locInBase = true; }
  } else if (n === 2) { en = 'ethen' + yl[0]; ko = '에텐' + yl[1]; }
  else { en = `${STEM[n]}-${enes.join(',')}-en-${fv}-${yl[0]}`; ko = `${KO_UN[n]}-${enes.join(',')}-엔-${fv}-${yl[1]}`; locInBase = true; }
  if (!pre.length) return { en, ko, key: letters(en), compound: locInBase };
  const g = groupPrefixes(pre, n === 1);
  return { en: g.en + en, ko: g.ko + ko, key: letters(g.en + en), compound: true };
}
function isConnectedWithout(mol, set, a, b) { const p = pathIn(mol, set, a, b); return p.length && p[0] === a; }
function cmpBranch(a, b) {
  return (b.n - a.n) || (b.enes.length - a.enes.length) || (a.fv - b.fv) || cmpList(a.enes, b.enes)
    || (b.pre.length - a.pre.length) || cmpList(sortedLocs(a.pre), sortedLocs(b.pre)) || cmpList(alphaLocs(a.pre), alphaLocs(b.pre));
}
function enesOn(mol, path, pos) {
  const out = [];
  for (let i = 0; i + 1 < path.length; i++) if (bondOrder(mol, path[i], path[i + 1]) === 2) out.push(Math.min(pos.get(path[i]), pos.get(path[i + 1])));
  return out.sort((a, b) => a - b);
}
const sortedLocs = pre => pre.map(p => p.loc).sort((a, b) => a - b);
function alphaLocs(pre) {
  const byKey = {};
  for (const p of pre) (byKey[p.key] = byKey[p.key] || []).push(p.loc);
  return Object.keys(byKey).sort().flatMap(k => byKey[k].sort((a, b) => a - b));
}

/* 괄호 안에 괄호가 있으면 한 단계 바깥 괄호: ( ) → [ ] → { } */
function marks(inner) { return inner.includes('[') ? ['{', '}'] : inner.includes('(') ? ['[', ']'] : ['(', ')']; }

/* 같은 접두사끼리 묶고 알파벳 순으로 이어 붙인다 */
function groupPrefixes(pre, noLocs) {
  const map = new Map();
  for (const p of pre) {
    const id = p.en;
    if (!map.has(id)) map.set(id, { en: p.en, ko: p.ko, key: p.key, compound: p.compound, locs: [], atoms: [] });
    const g = map.get(id); g.locs.push(p.loc); if (p.atom !== undefined) g.atoms.push(p.atom);
  }
  const groups = [...map.values()].sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  const toks = [];
  /* 번호가 없는 모체(메테인 등)에 접두사가 여럿이면 둘째부터 괄호로 묶어 뜻이 갈리지 않게 한다:
     chloro(methoxy)methane ≠ (chloromethoxy)methane */
  const sep = noLocs && groups.length > 1;
  groups.forEach((g, i) => {
    g.locs.sort((a, b) => a - b);
    const k = g.locs.length;
    if (!noLocs) { if (i > 0) toks.push(T('-', '-', 'pun')); toks.push(T(g.locs.join(','), g.locs.join(','), 'loc')); toks.push(T('-', '-', 'pun')); }
    const outer = sep && i > 0;
    if (g.compound) {
      const [o, c] = marks(g.en);
      if (outer) toks.push(T('(', '(', 'pun'));
      if (k > 1) toks.push(T(MULT2[k], MULT2_KO[k], 'mul'));
      toks.push(T(o, o, 'pun')); toks.push(T(g.en, g.ko, 'pre')); toks.push(T(c, c, 'pun'));
      if (outer) toks.push(T(')', ')', 'pun'));
    } else {
      if (outer) toks.push(T('(', '(', 'pun'));
      if (k > 1) toks.push(T(MULT[k], MULT_KO[k], 'mul'));
      toks.push(T(g.en, g.ko, 'pre'));
      if (outer) toks.push(T(')', ')', 'pun'));
    }
  });
  return { groups, toks, en: toks.map(t => t.en).join(''), ko: toks.map(t => t.ko).join('') };
}

/* ── 사슬 이름 ──────────────────────────────────────────────── */
function chainCandidates(ctx) {
  const { mol, skel } = ctx;
  const nodes = [...skel];
  const out = [];
  for (let a = 0; a < nodes.length; a++) for (let b = a; b < nodes.length; b++) {
    const p = pathIn(mol, skel, nodes[a], nodes[b]);
    out.push(p);
    if (a !== b) out.push(p.slice().reverse());
  }
  return out.map(p => evalChain(ctx, p));
}
function evalChain(ctx, p) {
  const { mol, info, P, tri, S } = ctx;
  const pos = new Map(p.map((c, i) => [c, i + 1]));
  const pLocs = [], pAtoms = [];
  for (const c of p) {
    const f = info[c], L = pos.get(c);
    if (tri) { for (const { j } of mol.nb[c]) if (S.has(j)) { pLocs.push(L); pAtoms.push(j); } }
    else if (P && (TERMINAL.has(P) || P === 'ketone')) { if (f.kind === P) { pLocs.push(L); pAtoms.push(c); } }
    else if (P === 'alcohol') { if (f.kind !== 'acid') for (const o of f.OH) { pLocs.push(L); pAtoms.push(o); } }
    else if (P === 'amine') { if (f.kind !== 'amide') for (const n of f.NH2) { pLocs.push(L); pAtoms.push(n); } }
  }
  pLocs.sort((a, b) => a - b);
  const enes = enesOn(mol, p, pos);
  const pre = prefixesOn(ctx, p, pos);
  return { p, pos, pLocs, pAtoms, enes, pre, n: p.length };
}
const CRIT = ['nP', 'len', 'ene', 'pLoc', 'eneLoc', 'nPre', 'preLoc', 'alpha'];
function critValues(c, rule) {
  const v = {
    nP: -c.pLocs.length, len: -c.n, ene: -c.enes.length, pLoc: c.pLocs, eneLoc: c.enes,
    nPre: -c.pre.length, preLoc: sortedLocs(c.pre), alpha: alphaLocs(c.pre)
  };
  const order = rule === '1993' ? ['nP', 'ene', 'len', 'pLoc', 'eneLoc', 'nPre', 'preLoc', 'alpha'] : CRIT;
  return order.map(k => [k, v[k]]);
}
/* 두 후보를 비교해 (차이, 처음 갈린 기준) 을 돌려준다 */
function compareCand(a, b, rule) {
  const va = critValues(a, rule), vb = critValues(b, rule);
  for (let i = 0; i < va.length; i++) {
    const x = va[i][1], y = vb[i][1];
    const d = Array.isArray(x) ? cmpList(x, y) : x - y;
    if (d) return [d, va[i][0]];
  }
  return [0, null];
}

function nameChain(mol, info, rule) {
  const scafC = mol.atoms.map((a, i) => i).filter(i => mol.atoms[i].src.kind === 'scaf');
  const all = carbonTree(mol, scafC, new Set());
  const present = classesPresent(mol, info, all);
  const P = topClass(present);
  const S = new Set();
  if (P && TERMINAL.has(P)) for (const c of all) if (info[c].kind === P) S.add(c);
  const tri = S.size > 2;
  const block = new Set();
  for (const c of all) if (info[c].kind === 'nitrile' && (P !== 'nitrile' || tri)) block.add(c);
  if (tri) for (const c of S) block.add(c);
  const skel = carbonTree(mol, scafC, block);
  const ctx = { mol, info, P, tri, S, skel, skip: new Set() };
  const cands = chainCandidates(ctx);
  let best = cands[0];
  for (const c of cands) if (compareCand(c, best, rule)[0] < 0) best = c;

  /* 왜 이 사슬 · 이 번호인가 (풀이용) */
  let chainWhy = null, numWhy = null;
  const samePath = (a, b) => a.p.length === b.p.length && (a.p.every((x, i) => x === b.p[i]) || a.p.every((x, i) => x === b.p[b.p.length - 1 - i]));
  let runner = null;
  for (const c of cands) if (!samePath(c, best)) { if (!runner || compareCand(c, runner, rule)[0] < 0) runner = c; }
  if (runner) chainWhy = compareCand(best, runner, rule)[1];
  const rev = cands.find(c => c !== best && c.p.length === best.p.length && c.p.every((x, i) => x === best.p[best.p.length - 1 - i]));
  if (rev) numWhy = compareCand(best, rev, rule)[1] || 'sym';

  const n = best.n, k = best.pLocs.length;
  const nSubst = k + best.pre.length;
  const noLocs = n === 1 || (n === 2 && nSubst === 1);
  const g = groupPrefixes(best.pre, noLocs);

  /* 모체 + 접미사 */
  const toks = [];
  let alkyl = null;
  let sufEn = '', sufKo = '', vowel = false, sufLocs = false;
  if (tri) {
    const m = k;
    sufEn = MULT[m] + CARBO[P][0]; sufKo = MULT_KO[m] + CARBO[P][1]; sufLocs = n > 1;
    if (P === 'ester') alkyl = [MULT[m] + 'methyl', MULT_KO[m] + '메틸'];
  } else if (P) {
    const s = SUF[P][k];
    sufEn = s[0]; sufKo = s[1]; vowel = !!s[2];
    sufLocs = !TERMINAL.has(P) && !noLocs;
    if (P === 'ester') alkyl = [MULT[k] + 'methyl', MULT_KO[k] + '메틸'];
  }
  if (!best.enes.length) {
    toks.push(T(vowel ? STEM[n] + 'an' : STEM[n] + 'ane', vowel ? KO_EL[n] : KO_FULL[n], 'par'));
  } else if (n === 2) {
    toks.push(T('eth', '에', 'par')); toks.push(T(vowel ? 'en' : 'ene', '텐', 'une'));
  } else {
    toks.push(T(STEM[n], KO_UN[n], 'par'));
    toks.push(T('-', '-', 'pun')); toks.push(T(best.enes.join(','), best.enes.join(','), 'loc')); toks.push(T('-', '-', 'pun'));
    /* 모음 접미사 앞 'e' 탈락: prop-2-en-1-ol, but-3-enoic acid / 자음이면 유지: but-2-ene-1,4-diol */
    toks.push(T(vowel ? 'en' : 'ene', '엔', 'une'));
  }
  if (sufEn) {
    if (sufLocs) {
      toks.push(T('-', '-', 'pun')); toks.push(T(best.pLocs.join(','), best.pLocs.join(','), 'loc')); toks.push(T('-', '-', 'pun'));
    }
    toks.push(T(sufEn, sufKo, 'suf'));
  }
  const core = g.toks.concat(toks);
  return {
    kind: 'chain', P, tri, rule, core, alkyl,
    chain: best.p, pos: best.pos, pLocs: best.pLocs, pAtoms: best.pAtoms, enes: best.enes, prefixes: g.groups, noLocs,
    why: { chain: chainWhy, num: numWhy }, n, present
  };
}

/* ── 벤젠 ──────────────────────────────────────────────────── */
const GCLASS = { COOH: 'acid', COOCH3: 'ester', CONH2: 'amide', CN: 'nitrile', CHO: 'aldehyde', COCH3: 'ketone', OH: 'alcohol', NH2: 'amine' };
const RPX = {
  CH3: 'methyl', OCH3: 'methoxy', F: 'F', Cl: 'Cl', Br: 'Br', I: 'I', NO2: 'nitro', COOCH3: 'methoxycarbonyl', CONH2: 'carbamoyl',
  CN: 'cyano', CHO: 'formyl', COCH3: 'acetyl', OH: 'hydroxy', NH2: 'amino', COOH: 'carboxy'
};
function nameBenzene(mol) {
  const ring = mol.ring;
  const gid = ring.map(i => { const s = mol.sites.find(x => x.atom === i); return s ? s.group : null; });
  const present = new Set(gid.filter(Boolean).map(g => GCLASS[g]).filter(Boolean));
  const P = topClass(present);
  const pIdx = gid.map((g, i) => g && GCLASS[g] === P ? i : -1).filter(i => i >= 0);
  const k = pIdx.length;
  const nsub = gid.filter(Boolean).length;
  const cands = [];
  for (let s = 0; s < 6; s++) for (const d of [1, -1]) {
    const loc = ring.map((_, i) => ((d * (i - s)) % 6 + 6) % 6 + 1);
    const pre = [];
    gid.forEach((g, i) => {
      if (!g || (P && GCLASS[g] === P)) return;
      const key = RPX[g];
      pre.push({ loc: loc[i], en: PX[key][0], ko: PX[key][1], key: PX[key][0], compound: key === 'methoxycarbonyl', atom: mol.sites.find(x => x.atom === ring[i]).gAtom });
    });
    const pLocs = pIdx.map(i => loc[i]).sort((a, b) => a - b);
    if ((P === 'ketone' || (P && k === 1)) && pLocs[0] !== 1) continue;
    cands.push({ loc, pre, pLocs, s, d });
  }
  const cmp = (a, b) => cmpList(a.pLocs, b.pLocs) || cmpList(sortedLocs(a.pre), sortedLocs(b.pre)) || cmpList(alphaLocs(a.pre), alphaLocs(b.pre));
  let best = cands[0];
  for (const c of cands) if (cmp(c, best) < 0) best = c;
  /* 번호를 가른 기준: 다른 번호 매김들을 이긴 기준 중 가장 깊은 것 */
  const RANK = ['pLoc', 'preLoc', 'alpha'];
  let numWhy = null;
  for (const c of cands) {
    if (c === best || gidSame(c, best, gid)) continue;
    const d1 = cmpList(best.pLocs, c.pLocs), d2 = cmpList(sortedLocs(best.pre), sortedLocs(c.pre)), d3 = cmpList(alphaLocs(best.pre), alphaLocs(c.pre));
    const why = d1 ? 'pLoc' : d2 ? 'preLoc' : d3 ? 'alpha' : null;
    if (why && (!numWhy || RANK.indexOf(why) > RANK.indexOf(numWhy))) numWhy = why;
  }
  numWhy = numWhy || 'sym';
  const noLocs = nsub <= 1;
  let core = [], alkyl = null;
  if (P === 'ketone') {
    /* 1-(치환 페닐)에탄-1-온 / 1,1′-(1,3-페닐렌)다이(에탄-1-온) */
    const g = groupPrefixes(best.pre, false);
    const primes = ['', '′', '″', '‴'];
    const head = best.pLocs.map((_, i) => '1' + primes[i]).join(',');
    core.push(T(head, head, 'loc')); core.push(T('-', '-', 'pun'));
    let ringEn, ringKo;
    if (k === 1) { ringEn = 'phenyl'; ringKo = '페닐'; }
    else if (k === 2) { ringEn = best.pLocs.join(',') + '-phenylene'; ringKo = best.pLocs.join(',') + '-페닐렌'; }
    else { ringEn = `benzene-${best.pLocs.join(',')}-${MULT[k]}yl`; ringKo = `벤젠-${best.pLocs.join(',')}-${MULT_KO[k]}일`; }
    const paren = k > 1 || best.pre.length > 0;
    if (paren) core.push(T('(', '(', 'pun'));
    core = core.concat(g.toks);
    if (g.toks.length && k > 1) core.push(T('-', '-', 'pun'));
    core.push(T(ringEn, ringKo, 'pre'));
    if (paren) core.push(T(')', ')', 'pun'));
    if (k === 1) core.push(T('ethan', '에탄', 'par'), T('-', '-', 'pun'), T('1', '1', 'loc'), T('-', '-', 'pun'), T('one', '온', 'suf'));
    else core.push(T(MULT[k], MULT_KO[k], 'mul'), T('(', '(', 'pun'), T('ethan', '에탄', 'par'), T('-', '-', 'pun'), T('1', '1', 'loc'), T('-', '-', 'pun'), T('one', '온', 'suf'), T(')', ')', 'pun'));
    return { kind: 'benzene', P, k, core, alkyl, loc: best.loc, pLocs: best.pLocs, prefixes: g.groups, why: { num: numWhy }, present, gid };
  }
  const g = groupPrefixes(best.pre, noLocs);
  core = g.toks.slice();
  if (!P) core.push(T('benzene', '벤젠', 'par'));
  else if (k === 1) {
    const [en, ko] = RETAINED[P];
    core.push(T(en, ko, 'par'));
    if (P === 'ester') alkyl = ['methyl', '메틸'];
  } else {
    const suf = ['alcohol', 'amine'].includes(P) ? SUF[P][k] : [MULT[k] + CARBO[P][0], MULT_KO[k] + CARBO[P][1]];
    core.push(T('benzene', '벤젠', 'par'), T('-', '-', 'pun'), T(best.pLocs.join(','), best.pLocs.join(','), 'loc'), T('-', '-', 'pun'), T(suf[0], suf[1], 'suf'));
    if (P === 'ester') alkyl = [MULT[k] + 'methyl', MULT_KO[k] + '메틸'];
  }
  return { kind: 'benzene', P, k, core, alkyl, loc: best.loc, pLocs: best.pLocs, prefixes: g.groups, why: { num: numWhy }, present, gid, noLocs };
}

/* 두 번호 매김이 같은 이름을 만드는가 (대칭) */
function gidSame(a, b, gid) {
  const sig = c => gid.map((g, i) => [c.loc[i], g || '']).sort((x, y) => x[0] - y[0]).map(x => x[1]).join(',');
  return sig(a) === sig(b);
}

/* ── 조립 · 입체 · 주의 사항 ──────────────────────────────────── */
function assemble(res, stereo) {
  const ste = stereo ? [T(`(${stereo})`, `(${stereo})`, 'ste'), T('-', '-', 'pun')] : [];
  const core = ste.concat(res.core);
  let en, ko;
  if (res.alkyl) {
    en = [T(res.alkyl[0], res.alkyl[0], 'alk'), T(' ', ' ', 'pun')].concat(core).map(t => ({ s: t.en, r: t.r }));
    ko = core.concat([T(' ', ' ', 'pun'), T(res.alkyl[1], res.alkyl[1], 'alk')]).map(t => ({ s: t.ko, r: t.r }));
    /* 영어 에스터: 모음 접미사 'oate' 는 이미 'an/en' 뒤에 붙어 있다 */
  } else {
    en = core.map(t => ({ s: t.en, r: t.r }));
    ko = core.map(t => ({ s: t.ko, r: t.r }));
  }
  /* 한글 에스터 알킬의 '다이메틸' 등은 그대로 */
  return { en, ko, nameEn: en.map(t => t.s).join(''), nameKo: ko.map(t => t.s).join('') };
}

export function nameMolecule(mol, opts = {}) {
  const info = analyze(mol);
  const rule = opts.rule || '2013';
  const res = mol.ring ? nameBenzene(mol) : nameChain(mol, info, rule);
  const db = doubleBondStereo(mol);
  const stereo = db.length ? db[0].desc : null;
  const out = Object.assign(res, assemble(res, stereo), { stereo, db, info });
  out.centers = stereocenters(mol);
  out.principalAtoms = principalAtoms(mol, out);
  if (!mol.ring && !opts.noCompare) {
    const alt = nameMolecule(mol, { rule: '1993', noCompare: true, noNotes: true });
    if (alt.nameEn !== out.nameEn) out.alt1993 = { en: alt.nameEn, ko: alt.nameKo };
  }
  if (!opts.noNotes) out.notes = notesFor(mol, info, out);
  return out;
}

/* 주 작용기에 속한 원자 (그림 · 3D 강조용) */
function principalAtoms(mol, res) {
  const set = new Set();
  if (!res.P) return set;
  if (res.kind === 'benzene') {
    res.gid.forEach((g, i) => {
      if (!g || GCLASS[g] !== res.P) return;
      const s = mol.sites.find(x => x.atom === mol.ring[i]);
      mol.atoms.forEach((a, k) => { if (a.src.kind === 'grp' && a.src.site === s.i) set.add(k); });
    });
    return set;
  }
  for (const c of res.pAtoms) {
    set.add(c);
    if (mol.atoms[c].el !== 'C') continue;
    for (const { j } of mol.nb[c]) {
      const a = mol.atoms[j];
      if (a.el !== 'O' && a.el !== 'N') continue;
      set.add(j);
      for (const { j: m } of mol.nb[j]) if (m !== c && mol.atoms[m].el === 'C' && mol.atoms[m].src.kind === 'grp') set.add(m);
    }
  }
  return set;
}

/* 호변이성질 · 불안정한 구조 · 입체 안내 */
function notesFor(mol, info, res) {
  const notes = [];
  const A = mol.atoms;
  mol.atoms.forEach((a, i) => {
    const f = info[i]; if (!f || mol.ring) return;
    const onCC = mol.nb[i].some(n => n.o === 2 && A[n.j].el === 'C');
    if (onCC && f.OH.length) {
      const t = tautomer(mol, i, f.OH[0]);
      notes.push({ type: 'enol', atom: i, keto: t ? nameMolecule(t, { noNotes: true, noCompare: true }) : null });
    }
    if (onCC && f.NH2.length) notes.push({ type: 'enamine', atom: i });
    if (f.OH.length >= 2) notes.push({ type: 'gemdiol', atom: i });
    else if (f.OH.length && f.halo.length) notes.push({ type: 'halohydrin', atom: i });
    else if (f.OH.length && f.NH2.length) notes.push({ type: 'hemiaminal', atom: i });
    else if (f.OH.length && f.OR.length && f.kind !== 'ester') notes.push({ type: 'hemiacetal', atom: i });
  });
  if (res.centers.length) notes.push({ type: 'chiral', atoms: res.centers });
  if (res.stereo) notes.push({ type: 'ez', desc: res.stereo });
  if (res.alt1993) notes.push({ type: 'rule1993', en: res.alt1993.en, ko: res.alt1993.ko });
  return notes;
}

/* 엔올 → 케토: O–H 의 H 를 옆 탄소로 옮기고 C=C 를 C=O 로 */
export function tautomer(mol, c, o) {
  const other = mol.nb[c].find(n => n.o === 2 && mol.atoms[n.j].el === 'C');
  if (!other) return null;
  const atoms = mol.atoms.map(a => ({ ...a, src: { ...a.src } }));
  const bonds = mol.bonds.map(b => ({ ...b }));
  const bb = bonds.find(b => (b.a === c && b.b === other.j) || (b.b === c && b.a === other.j)); bb.o = 1;
  const bo = bonds.find(b => (b.a === c && b.b === o) || (b.b === c && b.a === o)); bo.o = 2;
  atoms[o].h = 0; atoms[other.j].h += 1;
  const nb = atoms.map(() => []);
  bonds.forEach((b, k) => { nb[b.a].push({ j: b.b, o: b.o, k }); nb[b.b].push({ j: b.a, o: b.o, k }); });
  return { ...mol, atoms, bonds, nb, sites: [] };
}
