/* IUPAC 치환 명명법 (2013 권고 기준, 옛 교과서 규칙과 다르면 함께 알림)
   다루는 범위: 가지 친 사슬(이중 · 삼중결합), 고리(벤젠 · 사이클로알케인/알켄 C3–C8 · 옥시레인),
   서로 붙은 두 벤젠(바이페닐), 작용기 — 카복실산 · 에스터 · 산 할로젠화물 · 아마이드 · 나이트릴 · 알데하이드 ·
   케톤 · 알코올(페놀) · 아민 · 에터 · 할로젠 · 나이트로. 고리가 원자를 나눠 갖는(축합) 분자는 다루지 않는다.
   결과: 영어 · 한글 토큰(역할별 색칠), 모체 · 번호 · 접두사 정보, 풀이에 쓰는 근거. */
import { rings as ringsOf, isBenzene, bondBetween, HALOGENS } from './core.js';
import { doubleBondStereo, stereogenicDB } from './cip.js';
import { stereoInfo, mirror, cisTrans, ringSites } from './stereo.js';

export const PRI = { acid: 1, ester: 2, acylhalide: 3, amide: 4, nitrile: 5, aldehyde: 6, ketone: 7, alcohol: 8, amine: 9 };
export const CLASS = {
  acid: { ko: '카복실산', en: 'carboxylic acid', fg: '–COOH' },
  ester: { ko: '에스터', en: 'ester', fg: '–COO–R' },
  acylhalide: { ko: '산 할로젠화물', en: 'acyl halide', fg: '–COCl' },
  amide: { ko: '아마이드', en: 'amide', fg: '–CONH₂' },
  nitrile: { ko: '나이트릴', en: 'nitrile', fg: '–C≡N' },
  aldehyde: { ko: '알데하이드', en: 'aldehyde', fg: '–CHO' },
  ketone: { ko: '케톤', en: 'ketone', fg: '>C=O' },
  alcohol: { ko: '알코올', en: 'alcohol', fg: '–OH' },
  amine: { ko: '아민', en: 'amine', fg: '–NH₂' }
};
const ACYL = new Set(['acid', 'ester', 'acylhalide', 'amide', 'nitrile', 'aldehyde']);

export class NameError extends Error {}

/* ── 어휘 ─────────────────────────────────────── */
const STEM = [null, 'meth', 'eth', 'prop', 'but', 'pent', 'hex', 'hept', 'oct', 'non', 'dec', 'undec', 'dodec', 'tridec', 'tetradec', 'pentadec', 'hexadec', 'heptadec', 'octadec', 'nonadec', 'icos'];
const KO_FULL = [null, '메테인', '에테인', '프로페인', '뷰테인', '펜테인', '헥세인', '헵테인', '옥테인', '노네인', '데케인', '운데케인', '도데케인', '트라이데케인', '테트라데케인', '펜타데케인', '헥사데케인', '헵타데케인', '옥타데케인', '노나데케인', '아이코세인'];
const KO_EL = [null, '메탄', '에탄', '프로판', '뷰탄', '펜탄', '헥산', '헵탄', '옥탄', '노난', '데칸', '운데칸', '도데칸', '트라이데칸', '테트라데칸', '펜타데칸', '헥사데칸', '헵타데칸', '옥타데칸', '노나데칸', '아이코산'];
const KO_UN = [null, '메트', '에트', '프로프', '뷰트', '펜트', '헥스', '헵트', '옥트', '논', '데크', '운데크', '도데크', '트라이데크', '테트라데크', '펜타데크', '헥사데크', '헵타데크', '옥타데크', '노나데크', '아이코스'];
const KO_A = [null, '메타', '에타', '프로파', '뷰타', '펜타', '헥사', '헵타', '옥타', '노나', '데카', '운데카', '도데카', '트라이데카', '테트라데카', '펜타데카', '헥사데카', '헵타데카', '옥타데카', '노나데카', '아이코사'];
const KO_YL = [null, '메틸', '에틸', '프로필', '뷰틸', '펜틸', '헥실', '헵틸', '옥틸', '노닐', '데실', '운데실', '도데실', '트라이데실', '테트라데실', '펜타데실', '헥사데실', '헵타데실', '옥타데실', '노나데실', '아이코실'];
const ENE_KO = [null, '메텐', '에텐', '프로펜', '뷰텐', '펜텐', '헥센', '헵텐', '옥텐', '노넨', '데센'];
const YNE_KO = [null, '', '에타인', '프로파인', '뷰타인', '펜타인', '헥사인', '헵타인', '옥타인', '노나인', '데카인'];
const MULT = ['', '', 'di', 'tri', 'tetra', 'penta', 'hexa', 'hepta', 'octa', 'nona', 'deca'];
const MULT_KO = ['', '', '다이', '트라이', '테트라', '펜타', '헥사', '헵타', '옥타', '노나', '데카'];
const MULT2 = ['', '', 'bis', 'tris', 'tetrakis', 'pentakis', 'hexakis', 'heptakis', 'octakis'];
const MULT2_KO = ['', '', '비스', '트리스', '테트라키스', '펜타키스', '헥사키스', '헵타키스', '옥타키스'];
export const CHAIN_WORD = { en: STEM, ko: KO_EL };

const PX = {
  F: ['fluoro', '플루오로'], Cl: ['chloro', '클로로'], Br: ['bromo', '브로모'], I: ['iodo', '아이오도'],
  nitro: ['nitro', '나이트로'], hydroxy: ['hydroxy', '하이드록시'], amino: ['amino', '아미노'], oxo: ['oxo', '옥소'],
  cyano: ['cyano', '사이아노'], formyl: ['formyl', '폼일'], carboxy: ['carboxy', '카복시'], carbamoyl: ['carbamoyl', '카바모일'], acetyl: ['acetyl', '아세틸']
};
const HALIDE_WORD = { F: ['fluoride', '플루오라이드'], Cl: ['chloride', '클로라이드'], Br: ['bromide', '브로마이드'], I: ['iodide', '아이오다이드'] };
const HALIDE_STEM = { F: 'fluorid', Cl: 'chlorid', Br: 'bromid', I: 'iodid' };
const HALIDE_STEM_KO = { F: '플루오리도', Cl: '클로리도', Br: '브로미도', I: '아이오디도' };

const T = (en, ko, r) => ({ en, ko: ko === undefined ? en : ko, r });
const cmpList = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const x = a[i] ?? 1e9, y = b[i] ?? 1e9; if (x !== y) return x - y; } return 0; };
const letters = s => s.toLowerCase().replace(/\btert-|\bsec-|\bn-(?=[a-z])/g, '').replace(/[^a-z]/g, '');
const fmtLoc = l => typeof l === 'string' ? l : (l % 1 ? Math.floor(l) + '′' : String(l));
function locSort(a, b) {
  const sa = typeof a === 'string', sb = typeof b === 'string';
  if (sa && sb) return a < b ? -1 : a > b ? 1 : 0;
  if (sa) return -1; if (sb) return 1;
  return a - b;
}
const numLocs = list => list.filter(l => typeof l === 'number');
/* 입체 표시 [[번호, E|Z|R|S]] → "E" 또는 "2E,4R". 범위 안에 입체 단위(이중결합 · 입체중심)가 둘 이상이면 하나여도 번호를 붙인다 */
function fmtDescs(list, units) {
  if (!list.length) return null;
  const L = list.slice().sort((x, y) => x[0] - y[0]);
  return L.length === 1 && units <= 1 ? L[0][1] : L.map(([l, d]) => fmtLoc(l) + d).join(',');
}
/* pos 범위에 걸친 입체 단위 수: 끝이 CH₂ 가 아닌 C=C (작은 고리 안 제외) + 입체중심 */
function stereoUnits(C, pos, skip = -1) {
  let n = 0;
  for (const b of C.mol.bonds) {
    if (b.o !== 2 || b.arom || b.a === skip || b.b === skip) continue;
    if (!pos.has(b.a) && !pos.has(b.b)) continue;
    const A = C.mol.atoms[b.a], B = C.mol.atoms[b.b];
    if (A.el !== 'C' || B.el !== 'C' || !stereogenicDB(C.mol, b.a, b.b)) continue;
    n++;
  }
  for (const c of C.centers || []) if (pos.has(c)) n++;
  return n;
}

/* ── 분석 ───────────────────────────────────────── */
export function analyze(mol) {
  const A = mol.atoms, R = ringsOf(mol);
  const info = A.map((a, i) => {
    if (a.el !== 'C') return null;
    const f = { oxo: [], OH: [], OR: [], N: [], nitN: -1, halo: [], nitro: [], kind: null };
    for (const { j, o } of mol.nb[i]) {
      const b = A[j];
      if (b.el === 'O') {
        if (o === 2) f.oxo.push(j);
        else if (R.of[j] >= 0) { /* 고리 속 O (옥시레인) */ }
        else if (b.h === 1 && mol.nb[j].length === 1) f.OH.push(j);
        else if (b.q === 0) { const other = mol.nb[j].find(n => n.j !== i); if (other && A[other.j].el === 'C') f.OR.push({ o: j, c: other.j }); }
      } else if (b.el === 'N') {
        if (o === 3) f.nitN = j;
        else if (b.q === 1) f.nitro.push(j);
        else if (o === 1 && b.q === 0) f.N.push(j);
      } else if (HALOGENS.has(b.el)) f.halo.push(j);
    }
    if (f.nitN >= 0) f.kind = 'nitrile';
    else if (f.oxo.length && f.OH.length) f.kind = 'acid';
    else if (f.oxo.length && f.OR.length) f.kind = 'ester';
    else if (f.oxo.length && f.halo.length) f.kind = 'acylhalide';
    else if (f.oxo.length && f.N.length) f.kind = 'amide';
    else if (f.oxo.length && a.h >= 1) f.kind = 'aldehyde';
    else if (f.oxo.length) f.kind = 'ketone';
    return f;
  });
  return { info, R };
}
/* 아민 N: 아마이드 N 이 아니고, 탄소에 붙은 중성 N */
function isAmineN(C, n) {
  const a = C.mol.atoms[n];
  if (a.el !== 'N' || a.q !== 0) return false;
  for (const { j, o } of C.mol.nb[n]) { if (o !== 1) return false; const f = C.info[j]; if (f && f.oxo.length) return false; }
  return C.mol.nb[n].some(x => C.mol.atoms[x.j].el === 'C');
}

function classesPresent(C) {
  const set = new Set();
  C.info.forEach((f, i) => {
    if (!f) return;
    if (f.kind) set.add(f.kind);
    if (f.OH.length && f.kind !== 'acid') set.add('alcohol');
  });
  C.mol.atoms.forEach((a, n) => { if (a.el === 'N' && isAmineN(C, n)) set.add('amine'); });
  return set;
}
function topClass(set) { let P = null; for (const c of set) if (!P || PRI[c] < PRI[P]) P = c; return P; }

/* ── 고리 종류 ─────────────────────────────────── */
/* 산소 하나가 든 포화 고리 (한치–비드만 이름): 크기 → [이름, 한글, 모음 앞 줄기, 한글 줄기] */
const OXA = { 3: ['oxirane', '옥시레인', 'oxiran', '옥시란'], 4: ['oxetane', '옥세테인', 'oxetan', '옥세탄'], 5: ['oxolane', '옥솔레인', 'oxolan', '옥솔란'], 6: ['oxane', '옥세인', 'oxan', '옥산'], 7: ['oxepane', '옥세페인', 'oxepan', '옥세판'], 8: ['oxocane', '옥소케인', 'oxocan', '옥소칸'] };
const isOxa = t => t === 'oxa';
function ringTypes(mol, R) {
  const inBi = new Set((R.bicyclic || []).flatMap(b => b.atoms));
  return R.list.map(r => {
    if (r.every(a => inBi.has(a))) return 'bi';
    if (isBenzene(mol, r)) return 'benzene';
    const els = r.map(i => mol.atoms[i].el);
    if (els.every(e => e === 'C')) {
      if (r.length < 3 || r.length > 8) throw new NameError('3~8원자 고리만 지원합니다');
      return 'cyclo';
    }
    const saturated = r.every((a, k) => { const b = bondBetween(mol, a, r[(k + 1) % r.length]); return b && b.o === 1 && !b.arom; });
    if (OXA[r.length] && saturated && els.filter(e => e === 'O').length === 1 && els.filter(e => e === 'C').length === r.length - 1) return 'oxa';
    throw new NameError('이 헤테로고리는 현재 명명 엔진이 지원하지 않습니다');
  });
}

/* ── 사슬 · 고리 이름 조각 ──────────────────────── */
/* n: 탄소 수, enes/ynes: 번호 목록, suf: { en, ko, vowel, locs(배열 또는 null) }, o: { ring, noUnsatLocs } */
function parentWord(n, enes, ynes, suf, o = {}) {
  if (n > 20) throw new NameError('주사슬 탄소가 20개를 넘어 지원하지 않습니다');
  const toks = [];
  const pre = o.ring ? 'cyclo' : '', preKo = o.ring ? '사이클로' : '';
  const vowel = !!(suf && suf.vowel);
  if (!enes.length && !ynes.length) {
    toks.push(T(pre + STEM[n] + (vowel ? 'an' : 'ane'), preKo + (vowel ? KO_EL[n] : KO_FULL[n]), 'par'));
  } else if (o.noUnsatLocs) {
    const e = enes.length ? 'en' : 'yn';
    toks.push(T(pre + STEM[n], preKo, 'par'));
    const last = toks[0];
    const ko = enes.length ? ENE_KO[n] : YNE_KO[n];
    last.ko = preKo + (vowel && !enes.length ? ko.replace(/아인$/, '인') : ko);
    toks.push(T(e + (vowel ? '' : 'e'), '', 'une'));
  } else {
    const firstCount = enes.length || ynes.length;
    toks.push(T(pre + STEM[n] + (firstCount > 1 ? 'a' : ''), preKo + (firstCount > 1 ? KO_A[n] : KO_UN[n]), 'par'));
    if (enes.length) {
      toks.push(T('-', '-', 'pun'), T(enes.join(','), enes.join(','), 'loc'), T('-', '-', 'pun'));
      toks.push(T(MULT[enes.length] + 'en' + (ynes.length || vowel ? '' : 'e'), MULT_KO[enes.length] + '엔', 'une'));
    }
    if (ynes.length) {
      toks.push(T('-', '-', 'pun'), T(ynes.join(','), ynes.join(','), 'loc'), T('-', '-', 'pun'));
      toks.push(T(MULT[ynes.length] + 'yn' + (vowel ? '' : 'e'), MULT_KO[ynes.length] + (vowel ? '인' : '아인'), 'une'));
    }
  }
  if (suf) {
    if (suf.locs && suf.locs.length) toks.push(T('-', '-', 'pun'), T(suf.locs.map(fmtLoc).join(','), suf.locs.map(fmtLoc).join(','), 'loc'), T('-', '-', 'pun'));
    toks.push(T(suf.en, suf.ko, 'suf'));
    /* 한글: -oyl 은 앞 음절과 이어 읽는다 (프로파노일, 뷰트-2-에노일) */
    if (suf.oyl) {
      const last = toks[toks.length - 2];
      if (last.r === 'par' && !enes.length && !ynes.length) { last.ko = preKo + KO_A[n]; toks[toks.length - 1].ko = suf.ko.replace(/^오/, '노'); }
      else if (last.r === 'une') { last.ko = last.ko.replace(/엔$/, '에').replace(/인$/, '이'); toks[toks.length - 1].ko = suf.ko.replace(/^오/, '노'); }
    }
  }
  return toks;
}

/* 접미사 모양 */
function suffixFor(P, k, place, halide) {
  const hw = HALIDE_WORD[halide || 'Cl'];
  if (place === 'carbo') {
    const m = k > 1 ? MULT[k] : '', mk = k > 1 ? MULT_KO[k] : '';
    const t = {
      acid: ['carboxylic acid', '카복실산'], ester: ['carboxylate', '카복실산'], acylhalide: ['carbonyl ' + hw[0], '카보닐 ' + hw[1]],
      amide: ['carboxamide', '카복스아마이드'], nitrile: ['carbonitrile', '카보나이트릴'], aldehyde: ['carbaldehyde', '카브알데하이드']
    }[P];
    const en = m + t[0], ko = mk + t[1];
    if (P === 'acylhalide' && k > 1) return { en: m + 'carbonyl ' + MULT[k] + hw[0], ko: mk + '카보닐 ' + MULT_KO[k] + hw[1], vowel: false };
    return { en, ko, vowel: false };
  }
  const one = {
    acid: ['oic acid', '산'], ester: ['oate', '산'], acylhalide: ['oyl ' + hw[0], '오일 ' + hw[1]], amide: ['amide', '아마이드'],
    nitrile: ['nitrile', '나이트릴'], aldehyde: ['al', '알'], ketone: ['one', '온'], alcohol: ['ol', '올'], amine: ['amine', '아민']
  }[P];
  if (k === 1) return { en: one[0], ko: one[1], vowel: P !== 'nitrile', oyl: P === 'acylhalide' };
  const many = {
    acid: ['dioic acid', '다이오산'], ester: ['dioate', '다이오산'], acylhalide: ['dioyl di' + hw[0], '다이오일 다이' + hw[1]], amide: ['diamide', '다이아마이드'],
    nitrile: ['dinitrile', '다이나이트릴'], aldehyde: ['dial', '다이알']
  }[P];
  if (many && k === 2) return { en: many[0], ko: many[1], vowel: false };
  if (P === 'ketone') return { en: MULT[k] + 'one', ko: MULT_KO[k] + '온', vowel: false };
  if (P === 'alcohol') return { en: k === 4 ? 'tetrol' : MULT[k] + 'ol', ko: k === 4 ? '테트롤' : MULT_KO[k] + '올', vowel: false };
  if (P === 'amine') return { en: MULT[k] + 'amine', ko: MULT_KO[k] + '아민', vowel: false };
  throw new NameError('이 작용기 조합은 현재 명명 엔진이 지원하지 않습니다');
}
const RETAINED = {
  acid: ['benzoic acid', '벤조산'], ester: ['benzoate', '벤조산'], acylhalide: ['benzoyl ', '벤조일 '], amide: ['benzamide', '벤즈아마이드'],
  nitrile: ['benzonitrile', '벤조나이트릴'], aldehyde: ['benzaldehyde', '벤즈알데하이드'], alcohol: ['phenol', '페놀'], amine: ['aniline', '아닐린']
};

/* ── 곁가지 이름 ────────────────────────────────── */
function simple(en, ko, extra) { return Object.assign({ en, ko, key: letters(en), compound: false }, extra || {}); }
function sub(C, r, from, bo = 1) {
  const k = r + '|' + from + '|' + bo;
  if (C.memo.has(k)) return C.memo.get(k);
  C.memo.set(k, simple('?', '?'));
  const v = subRaw(C, r, from, bo);
  C.memo.set(k, v);
  return v;
}
function subRaw(C, r, from, bo) {
  const A = C.mol.atoms, a = A[r];
  if (HALOGENS.has(a.el)) return simple(...PX[a.el]);
  if (a.el === 'N') {
    if (a.q === 1) return simple(...PX.nitro);
    const others = C.mol.nb[r].filter(n => n.j !== from).map(n => n.j);
    if (!others.length) return simple(...PX.amino);
    const acyl = others.filter(c => C.info[c] && C.info[c].oxo.length);
    if (acyl.length === 1 && others.length === 1) { const ac = acylName(C, acyl[0], r); return amido(ac); }
    if (acyl.length) throw new NameError('이 질소 치환 형태는 현재 명명 엔진이 지원하지 않습니다');
    const names = others.map(c => sub(C, c, r, 1));
    const g = groupNames(names);
    return { en: g.en + 'amino', ko: g.ko + '아미노', key: letters(g.en + 'amino'), compound: true };
  }
  if (a.el === 'O') {
    if (a.h === 1) return simple(...PX.hydroxy);
    const other = C.mol.nb[r].find(n => n.j !== from);
    if (!other) return simple('oxido', '옥시도');
    const f = C.info[other.j];
    if (f && f.oxo.length) { const ac = acylName(C, other.j, r); return { en: ac.en + 'oxy', ko: ac.ko + '옥시', key: letters(ac.en + 'oxy'), compound: ac.compound || true, base: null }; }
    return alkoxy(sub(C, other.j, r, 1));
  }
  if (a.el !== 'C') throw new NameError(a.el + ' 원자가 든 치환기는 현재 명명 엔진이 지원하지 않습니다');
  if (C.R.of[r] >= 0) return ringSub(C, r, from, bo);
  const f = C.info[r];
  if (bo === 1 && f.kind) {
    if (f.kind === 'acid') return simple(...PX.carboxy);
    if (f.kind === 'ester') {
      const o = f.OR[0];
      const al = alkoxy(sub(C, o.c, o.o, 1));
      return { en: al.en + 'carbonyl', ko: al.ko + '카보닐', key: letters(al.en + 'carbonyl'), compound: true };
    }
    if (f.kind === 'acylhalide') { const x = A[f.halo[0]].el; return { en: 'carbono' + HALIDE_STEM[x] + 'oyl', ko: '카보노' + HALIDE_STEM_KO[x] + '일', key: 'carbono' + HALIDE_STEM[x] + 'oyl', compound: false }; }
    if (f.kind === 'amide') {
      const n = f.N[0];
      const others = C.mol.nb[n].filter(x => x.j !== r).map(x => x.j);
      if (!others.length) return simple(...PX.carbamoyl);
      const g = groupNames(others.map(c => sub(C, c, n, 1)));
      return { en: g.en + 'carbamoyl', ko: g.ko + '카바모일', key: letters(g.en + 'carbamoyl'), compound: true };
    }
    if (f.kind === 'nitrile') return simple(...PX.cyano);
    if (f.kind === 'aldehyde') return simple(...PX.formyl);
    if (f.kind === 'ketone') return acylName(C, r, from);
  }
  return alkylSub(C, r, from, bo);
}
/* 치환기 이름 여러 개를 N-치환 · 에스터 알킬처럼 이어 붙임: dimethyl, ethyl(methyl) */
function groupNames(names) {
  const map = new Map();
  for (const n of names) { if (!map.has(n.en)) map.set(n.en, { ...n, k: 0 }); map.get(n.en).k++; }
  const g = [...map.values()].sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  let en = '', ko = '';
  g.forEach((x, i) => {
    const wrap = x.compound || (i > 0 && g.length > 1);
    const m = x.k > 1 ? (x.compound ? MULT2[x.k] : MULT[x.k]) : '', mk = x.k > 1 ? (x.compound ? MULT2_KO[x.k] : MULT_KO[x.k]) : '';
    if (wrap && (x.compound || i > 0)) { en += m + '(' + x.en + ')'; ko += mk + '(' + x.ko + ')'; }
    else { en += m + x.en; ko += mk + x.ko; }
  });
  return { en, ko };
}
function alkoxy(al) {
  const C2 = { methyl: ['methoxy', '메톡시'], ethyl: ['ethoxy', '에톡시'], propyl: ['propoxy', '프로폭시'], butyl: ['butoxy', '뷰톡시'], phenyl: ['phenoxy', '페녹시'], 'tert-butyl': ['tert-butoxy', 'tert-뷰톡시'] };
  if (C2[al.en]) return simple(...C2[al.en], { base: 'oxy' });
  if (al.base && C2[al.base] && al.en.endsWith(al.base)) {
    const stem = al.en.slice(0, -al.base.length), stemKo = al.ko.slice(0, al.ko.length - (al.baseKo || '').length);
    return { en: stem + C2[al.base][0], ko: stemKo + C2[al.base][1], key: letters(stem + C2[al.base][0]), compound: true };
  }
  if (al.compound || /\d/.test(al.en)) return { en: '(' + al.en + ')oxy', ko: '(' + al.ko + ')옥시', key: letters(al.en + 'oxy'), compound: true };
  return { en: al.en + 'oxy', ko: al.ko + '옥시', key: letters(al.en + 'oxy'), compound: true };
}
function amido(ac) {
  const map = { acetyl: ['acetamido', '아세트아미도'], benzoyl: ['benzamido', '벤즈아미도'], formyl: ['formamido', '폼아미도'] };
  if (map[ac.en]) return simple(...map[ac.en]);
  if (/oyl$/.test(ac.en) && !ac.compound) return simple(ac.en.replace(/oyl$/, 'amido'), ac.ko.replace(/노일$/, '아미도').replace(/오일$/, '아미도'));
  return { en: '(' + ac.en + ')amino', ko: '(' + ac.ko + ')아미노', key: letters(ac.en + 'amino'), compound: true };
}
/* 아실기 R–C(=O)– 이름: acetyl, benzoyl, propanoyl, cyclohexanecarbonyl … */
function acylName(C, c, from) {
  const A = C.mol.atoms, f = C.info[c];
  if (A[c].h >= 1) return simple(...PX.formyl);
  const R = C.mol.nb[c].filter(n => n.j !== from && n.o === 1 && A[n.j].el === 'C').map(n => n.j);
  if (R.length !== 1) throw new NameError('이 아실기는 현재 명명 엔진이 지원하지 않습니다');
  const r = R[0];
  if (C.R.of[r] >= 0) {
    const ri = C.R.of[r], type = C.types[ri];
    const rs = ringSubCore(C, r, c);
    if (type === 'benzene') return rs.pre ? { en: rs.pre + 'benzoyl', ko: rs.preKo + '벤조일', key: letters(rs.pre + 'benzoyl'), compound: true } : simple('benzoyl', '벤조일');
    const word = ringWordFor(C, ri, rs, true);
    const st = rs.stereo ? `(${rs.stereo})-` : '';
    return { en: st + word.en + 'carbonyl', ko: st + word.ko + '카보닐', key: letters(word.en + 'carbonyl'), compound: true };
  }
  /* 사슬 아실: c 가 1번 */
  const ch = substituentChain(C, c, from, true, c);
  const { n, enes, ynes, pre } = ch;
  if (n === 2 && !enes.length && !ynes.length && !pre.length) return simple(...PX.acetyl);
  const toks = parentWord(n, enes, ynes, { en: 'oyl', ko: '오일', vowel: true, oyl: true });
  const g = groupPrefixes(pre, false);
  const st = ch.stereo ? `(${ch.stereo})-` : '';
  const en = st + g.en + toks.map(t => t.en).join(''), ko = st + g.ko + toks.map(t => t.ko).join('');
  return { en, ko, key: letters(g.en + toks.map(t => t.en).join('')), compound: true };
}
/* 알킬 · 알켄일 · 알카인일 곁가지 */
function alkylSub(C, r, from, bo) {
  const ch = substituentChain(C, r, from, false);
  const { n, fv, enes, ynes, pre } = ch;
  const yl = bo === 2 ? 'ylidene' : bo === 3 ? 'ylidyne' : 'yl';
  const ylKo = bo === 2 ? '일리덴' : bo === 3 ? '일리딘' : '일';
  let en, ko, base = null, baseKo = null, locInBase = false;
  if (!enes.length && !ynes.length) {
    if (fv === 1) { en = STEM[n] + yl; ko = (bo === 1 ? KO_YL[n] : KO_YL[n] + (bo === 2 ? '리덴' : '리딘')); base = en; baseKo = ko; }
    else { en = `${STEM[n]}an-${fv}-${yl}`; ko = `${KO_EL[n]}-${fv}-${ylKo}`; locInBase = true; }
  } else if (n === 2 && fv === 1) {
    en = 'eth' + (enes.length ? 'en' : 'yn') + yl; ko = (enes.length ? '에텐' : '에타인') + ylKo;
  } else {
    const toks = parentWord(n, enes, ynes, { en: yl, ko: ylKo, vowel: true, locs: [fv] });
    en = toks.map(t => t.en).join(''); ko = toks.map(t => t.ko).join(''); locInBase = true;
  }
  /* 관용 접두사: tert-butyl, benzyl */
  if (bo === 1 && !enes.length && !ynes.length) {
    if (n === 3 && fv === 2 && pre.length === 1 && pre[0].en === 'methyl' && pre[0].loc === 2) return simple('tert-butyl', 'tert-뷰틸', { base: 'tert-butyl' });
    if (n === 1 && pre.length === 1 && pre[0].en === 'phenyl') return simple('benzyl', '벤질', { base: 'benzyl' });
  }
  const st = ch.stereo ? `(${ch.stereo})-` : '';
  if (!pre.length) return { en: st + en, ko: st + ko, key: letters(en), compound: locInBase || !!st, base, baseKo };
  const g = groupPrefixes(pre, n === 1);
  return { en: st + g.en + en, ko: st + g.ko + ko, key: letters(g.en + en), compound: true, base, baseKo };
}
/* 곁가지의 사슬 고르기: r(자유 원자가 원자)을 품은 가장 긴 사슬, 자유 원자가에 작은 번호 */
function substituentChain(C, r, from, acylMode, acylRoot) {
  const A = C.mol.atoms;
  const nodes = new Set([r]), q = [r];
  while (q.length) {
    const i = q.pop();
    for (const { j } of C.mol.nb[i]) {
      if (j === from || nodes.has(j) || A[j].el !== 'C' || C.R.of[j] >= 0) continue;
      const k = C.info[j].kind;
      if (k === 'acid' || k === 'nitrile') continue;
      nodes.add(j); q.push(j);
    }
  }
  const list = [...nodes];
  let best = null;
  const skip = new Set([from]);
  for (const u of list) for (const v of list) {
    const p = pathIn(C.mol, nodes, u, v);
    if (!p.length || !p.includes(r)) continue;
    if (acylMode && p[0] !== r) continue;
    const pos = new Map(p.map((c, i) => [c, i + 1]));
    const un = unsatOn(C.mol, p, pos);
    const cand = { p, pos, fv: pos.get(r), enes: un.enes, ynes: un.ynes, n: p.length };
    const lite = cmpSubLite(cand, best);
    if (best && lite > 0) continue;
    cand.pre = prefixesOn(C, p, pos, { skip, P: null, acylRoot });
    if (!best || lite < 0 || cmpSub(cand, best) < 0) best = cand;
  }
  /* 곁가지 안(과 곁가지에서 바깥으로 난) 이중결합의 E/Z. 둘 이상이면 번호를 붙인다 */
  const st = [];
  for (const d of C.db) {
    const ia = best.pos.has(d.a), ib = best.pos.has(d.b);
    if (ia && ib) st.push([Math.min(best.pos.get(d.a), best.pos.get(d.b)), d.desc]);
    else if ((ia || ib) && d.a !== from && d.b !== from) st.push([best.pos.get(ia ? d.a : d.b), d.desc]);
  }
  if (C.rs) for (const [c, d] of C.rs) if (best.pos.has(c)) st.push([best.pos.get(c), d]);
  best.stereo = fmtDescs(st, stereoUnits(C, best.pos, from));
  return best;
}
function cmpSubLite(a, b) {
  if (!b) return -1;
  const m = x => x.enes.length + x.ynes.length;
  return (b.n - a.n) || (m(b) - m(a)) || (b.enes.length - a.enes.length) || (a.fv - b.fv) || cmpList([...a.enes, ...a.ynes].sort((x, y) => x - y), [...b.enes, ...b.ynes].sort((x, y) => x - y)) || cmpList(a.enes, b.enes);
}
function cmpSub(a, b) {
  return cmpSubLite(a, b) || (b.pre.length - a.pre.length) || cmpList(sortedLocs(a.pre), sortedLocs(b.pre)) || cmpList(alphaLocs(a.pre), alphaLocs(b.pre));
}
/* 고리 치환기: phenyl, cyclohexyl, cyclohex-2-en-1-yl, oxiran-2-yl */
function ringSub(C, r, from, bo) {
  const ri = C.R.of[r], type = C.types[ri];
  const rs = ringSubCore(C, r, from);
  const yl = bo === 2 ? 'ylidene' : 'yl', ylKo = bo === 2 ? '일리덴' : '일';
  let en, ko, base = null, baseKo = null;
  if (type === 'benzene') { if (bo !== 1) throw new NameError('벤젠 고리에 이중결합으로 붙은 구조'); en = 'phenyl'; ko = '페닐'; base = 'phenyl'; baseKo = '페닐'; }
  else if (type === 'bi') throw new NameError('바이사이클로 고리가 곁가지인 구조는 현재 명명 엔진이 지원하지 않습니다');
  else if (isOxa(type)) { const O = OXA[rs.ring.length]; en = `${O[2]}-${rs.locOf(r)}-${yl}`; ko = `${O[3]}-${rs.locOf(r)}-${ylKo}`; }
  else {
    const m = rs.ring.length;
    if (!rs.enes.length) { en = 'cyclo' + STEM[m] + yl; ko = '사이클로' + KO_YL[m] + (bo === 2 ? '리덴' : ''); base = en; baseKo = ko; }
    else { const toks = parentWord(m, rs.enes, [], { en: yl, ko: ylKo, vowel: true, locs: [1] }, { ring: true }); en = toks.map(t => t.en).join(''); ko = toks.map(t => t.ko).join(''); }
  }
  const st = (rs.ct ? rs.ct + '-' : '') + (rs.stereo ? `(${rs.stereo})-` : '');
  if (!rs.pre) return { en: st + en, ko: st + ko, key: letters(en), compound: /\d/.test(en) || !!st, base, baseKo };
  return { en: st + rs.pre + en, ko: st + rs.preKo + ko, key: letters(rs.pre + en), compound: true, base, baseKo };
}
/* 고리 치환기 번호: 붙는 원자 = 1 (옥시레인은 O = 1) */
function ringSubCore(C, r, from) {
  const ri = C.R.of[r], ring = C.R.list[ri], type = C.types[ri], m = ring.length;
  let best = null;
  const skip = new Set([from]);
  if (type === 'bi') throw new NameError('바이사이클로 고리가 곁가지인 구조는 현재 명명 엔진이 지원하지 않습니다');
  const starts = isOxa(type) ? [ring.findIndex(i => C.mol.atoms[i].el === 'O')] : [ring.indexOf(r)];
  for (const s of starts) for (const d of [1, -1]) {
    const pos = new Map();
    for (let k = 0; k < m; k++) pos.set(ring[((s + d * k) % m + m) % m], k + 1);
    const fv = pos.get(r);
    const enes = type === 'cyclo' ? ringEnes(C.mol, ring, pos) : [];
    const cand = { pos, fv, enes };
    cand.pre = prefixesOn(C, ring, pos, { skip, P: null });
    const cmp = !best ? -1 : (a => a)((cand.fv - best.fv) || cmpList(cand.enes, best.enes) || cmpList(sortedLocs(cand.pre), sortedLocs(best.pre)) || cmpList(alphaLocs(cand.pre), alphaLocs(best.pre)));
    if (cmp < 0) best = cand;
  }
  const g = best.pre.length ? groupPrefixes(best.pre, false) : null;
  const st = [];
  /* 고리 원자에서 바깥으로 난 이중결합(…일리덴)의 E/Z, 고리 원자의 R/S */
  for (const d of C.db) { const ia = best.pos.has(d.a), ib = best.pos.has(d.b); if (ia !== ib && d.a !== from && d.b !== from) st.push([best.pos.get(ia ? d.a : d.b), d.desc]); }
  if (C.rs) for (const [c, d] of C.rs) if (best.pos.has(c)) st.push([best.pos.get(c), d]);
  const stereo = fmtDescs(st, stereoUnits(C, best.pos, from));
  const ct = (C.ct || []).find(x => x.n === 2 && x.atoms.every(a => best.pos.has(a)) && x.atoms.every(a => !(C.rs && C.rs.has(a))));
  return { att: r, ct: ct ? ct.rel : null, ring, type, pos: best.pos, enes: best.enes, pre: g ? g.en : '', preKo: g ? g.ko : '', locOf: a => best.pos.get(a), prefixes: best.pre, stereo };
}
function ringWordFor(C, ri, rs, carbo) {
  const type = C.types[ri], m = rs.ring.length;
  if (isOxa(type)) { const O = OXA[m]; return { en: `${rs.pre}${O[0]}-${rs.locOf(rs.att)}-`, ko: `${rs.preKo}${O[1]}-${rs.locOf(rs.att)}-` }; }
  if (type === 'benzene') return { en: 'benzene', ko: '벤젠' };
  const toks = parentWord(m, rs.enes, [], null, { ring: true });
  let en = rs.pre + toks.map(t => t.en).join(''), ko = rs.preKo + toks.map(t => t.ko).join('');
  if (carbo && (rs.pre || rs.enes.length)) { en += '-1-'; ko += '-1-'; }
  return { en, ko };
}

/* ── 접두사 모으기 ─────────────────────────────── */
/* mode: { skip(Set), P, suffix(Set: 접미사로 쓰는 원자), carbo(Set: 고리 · 셋 이상 사슬에서 접미사가 되는 아실 탄소), tri(Set), rec(모체일 때 에스터 알킬 · 할로젠화물 기록) } */
function prefixesOn(C, atoms, pos, mode) {
  const A = C.mol.atoms, out = [];
  const add = (loc, v, atom) => out.push(Object.assign({ loc, atom }, v));
  const suffix = mode.suffix || new Set(), carbo = mode.carbo || new Set();
  for (const p of atoms) {
    const L = pos.get(p);
    if (A[p].el !== 'C') continue;
    const f = C.info[p];
    const ownSuffix = suffix.has(p);
    /* 사슬 · 고리 원자 자신의 C=O (아실기 이름의 뿌리 탄소는 제외: 이미 -oyl 에 담김) */
    if (f.kind && !ownSuffix && f.kind !== 'nitrile' && p !== mode.acylRoot) {
      if (f.kind === 'aldehyde' || f.kind === 'ketone') add(L, simple(...PX.oxo), f.oxo[0]);
      else if (f.kind === 'ester') { add(L, simple(...PX.oxo), f.oxo[0]); add(L, sub(C, f.OR[0].o, p, 1), f.OR[0].o); }
      else if (f.kind === 'amide') { add(L, simple(...PX.oxo), f.oxo[0]); add(L, sub(C, f.N[0], p, 1), f.N[0]); }
      else if (f.kind === 'acylhalide') { add(L, simple(...PX.oxo), f.oxo[0]); add(L, simple(...PX[A[f.halo[0]].el]), f.halo[0]); }
      else if (f.kind === 'acid') { add(L, simple(...PX.oxo), f.oxo[0]); add(L, simple(...PX.hydroxy), f.OH[0]); }
    }
    if (ownSuffix && mode.rec) recordAcyl(C, p, mode, out, L);
    if (f.kind !== 'acid') for (const o of f.OH) if (!suffix.has(o)) add(L, simple(...PX.hydroxy), o);
    for (const n of f.N) {
      if (f.kind === 'amide' && n === f.N[0]) continue;
      if (suffix.has(n)) { if (mode.rec) nSubs(C, n, p, mode, out); continue; }
      if (mode.skip && mode.skip.has(n)) continue;
      add(L, sub(C, n, p, 1), n);
    }
    for (const o of f.OR) {
      if (f.kind === 'ester' && o.o === f.OR[0].o && p !== mode.acylRoot) continue;
      if (mode.skip && mode.skip.has(o.o)) continue;
      add(L, sub(C, o.o, p, 1), o.o);
    }
    for (const x of f.halo) { if (f.kind === 'acylhalide' && x === f.halo[0]) continue; add(L, simple(...PX[A[x].el]), x); }
    for (const x of f.nitro) add(L, simple(...PX.nitro), x);
    for (const { j, o } of C.mol.nb[p]) {
      if (A[j].el !== 'C' || pos.has(j) || (mode.skip && mode.skip.has(j))) continue;
      if (carbo.has(j)) { if (mode.rec) recordAcyl(C, j, mode, out, L); continue; }
      add(L, sub(C, j, p, o), j);
    }
  }
  return out;
}
/* 접미사가 된 아실 탄소에 딸린 것: 에스터의 알킬, 아마이드 N 치환기, 할로젠화물 */
function recordAcyl(C, c, mode, out, L) {
  const f = C.info[c];
  if (f.kind === 'ester') mode.rec.alkyls.push(Object.assign({ loc: L }, sub(C, f.OR[0].c, f.OR[0].o, 1)));
  else if (f.kind === 'amide') nSubs(C, f.N[0], c, mode, out);
  else if (f.kind === 'acylhalide') mode.rec.halides.push(C.mol.atoms[f.halo[0]].el);
}
function nSubs(C, n, host, mode, out) {
  const tag = mode.rec.nTag(n);
  for (const { j } of C.mol.nb[n]) {
    if (j === host || C.mol.atoms[j].el !== 'C') continue;
    out.push(Object.assign({ loc: tag, atom: j }, sub(C, j, n, 1)));
  }
}

/* 같은 접두사끼리 묶고 알파벳 순으로 */
function groupPrefixes(pre, noLocs) {
  const map = new Map();
  for (const p of pre) {
    if (!map.has(p.en)) map.set(p.en, { en: p.en, ko: p.ko, key: p.key, compound: p.compound, locs: [], atoms: [] });
    const g = map.get(p.en); g.locs.push(p.loc); if (p.atom !== undefined) g.atoms.push(p.atom);
  }
  const groups = [...map.values()].sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : a.en < b.en ? -1 : 1);
  const toks = [];
  /* 번호 없는 접두사가 여럿이면 둘째부터 괄호: chloro(methoxy)methane */
  const bare = groups.filter(g => noLocs && !g.locs.some(l => typeof l === 'string'));
  groups.forEach((g, i) => {
    g.locs.sort(locSort);
    const k = g.locs.length;
    const showLocs = !noLocs || g.locs.some(l => typeof l === 'string');
    if (showLocs) { if (toks.length) toks.push(T('-', '-', 'pun')); const s = g.locs.map(fmtLoc).join(','); toks.push(T(s, s, 'loc')); toks.push(T('-', '-', 'pun')); }
    const outer = bare.length > 1 && bare.indexOf(g) > 0;
    if (outer) toks.push(T('(', '(', 'pun'));
    if (g.compound) {
      const [o, c] = marks(g.en);
      if (k > 1) toks.push(T(MULT2[k], MULT2_KO[k], 'mul'));
      toks.push(T(o, o, 'pun'), T(g.en, g.ko, 'pre'), T(c, c, 'pun'));
    } else {
      if (k > 1) toks.push(T(MULT[k], MULT_KO[k], 'mul'));
      toks.push(T(g.en, g.ko, 'pre'));
    }
    if (outer) toks.push(T(')', ')', 'pun'));
  });
  return { groups, toks, en: toks.map(t => t.en).join(''), ko: toks.map(t => t.ko).join('') };
}
function marks(inner) { return inner.includes('[') ? ['{', '}'] : inner.includes('(') ? ['[', ']'] : ['(', ')']; }
const sortedLocs = pre => numLocs(pre.map(p => p.loc)).sort((a, b) => a - b);
function alphaLocs(pre) {
  const byKey = {};
  for (const p of pre) if (typeof p.loc === 'number') (byKey[p.key + '|' + p.en] = byKey[p.key + '|' + p.en] || []).push(p.loc);
  return Object.keys(byKey).sort().flatMap(k => byKey[k].sort((a, b) => a - b));
}

/* ── 그래프 도구 ─────────────────────────────────── */
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
function unsatOn(mol, path, pos) {
  const enes = [], ynes = [];
  for (let i = 0; i + 1 < path.length; i++) {
    const b = bondBetween(mol, path[i], path[i + 1]);
    const l = Math.min(pos.get(path[i]), pos.get(path[i + 1]));
    if (b.o === 2) enes.push(l); else if (b.o === 3) ynes.push(l);
  }
  return { enes: enes.sort((a, b) => a - b), ynes: ynes.sort((a, b) => a - b) };
}
function ringEnes(mol, ring, pos) {
  const m = ring.length, out = [];
  for (let k = 0; k < m; k++) {
    const a = ring[k], b = ring[(k + 1) % m], bd = bondBetween(mol, a, b);
    if (bd.o !== 2) continue;
    const la = pos.get(a), lb = pos.get(b);
    out.push(Math.abs(la - lb) === 1 ? Math.min(la, lb) : Math.max(la, lb));
  }
  return out.sort((x, y) => x - y);
}

/* ── 모체 후보 ───────────────────────────────────── */
function candidates(C) {
  const { mol, R, P } = C, A = mol.atoms;
  const out = [];
  /* 고리 */
  const assembled = new Set();
  for (const bi of R.bicyclic || []) {
    const het = bi.atoms.find(a => A[a].el !== 'C');
    if (bi.atoms.some(a => A[a].el !== 'C' && A[a].el !== 'O') || bi.atoms.filter(a => A[a].el !== 'C').length > 1) throw new NameError('이 고리계의 헤테로 원자는 현재 명명 엔진이 지원하지 않습니다');
    const nD = mol.bonds.filter(b => b.o === 2 && bi.atoms.includes(b.a) && bi.atoms.includes(b.b)).length;
    out.push({ type: 'vb', bi, het: het === undefined ? null : het, atoms: bi.atoms, size: bi.atoms.length, nRings: 2, cls: het === undefined ? 2 : 3, nMult: nD, nDouble: nD });
  }
  R.list.forEach((ring, ri) => {
    if (C.types[ri] === 'bi') return;
    if (C.types[ri] === 'benzene') {
      /* 바이페닐: 곧바로 이어진 두 벤젠 */
      for (const a of ring) for (const { j, o } of mol.nb[a]) {
        const rj = R.of[j];
        if (o !== 1 || rj < 0 || rj === ri || C.types[rj] !== 'benzene') continue;
        const key = [ri, rj].sort().join('-');
        if (assembled.has(key)) continue;
        assembled.add(key);
        out.push({ type: 'biphenyl', rings: [ri, rj], link: [a, j], atoms: ring.concat(R.list[rj]), size: 12, nRings: 2, cls: 2, nMult: 6, nDouble: 6 });
      }
    }
    const t = C.types[ri];
    const nD = t === 'benzene' ? 3 : ring.filter((a, k) => bondBetween(mol, a, ring[(k + 1) % ring.length]).o === 2).length;
    out.push({ type: 'ring', ri, rtype: t, atoms: ring, size: ring.length, nRings: 1, cls: isOxa(t) ? 3 : 2, nMult: nD, nDouble: nD });
  });
  /* 사슬: 고리 밖 탄소 */
  const skel = new Set();
  A.forEach((a, i) => {
    if (a.el !== 'C' || R.of[i] >= 0) return;
    const k = C.info[i].kind;
    if (k === 'nitrile' && (P !== 'nitrile' || C.tri)) return;
    if (C.tri && C.S.has(i)) return;
    skel.add(i);
  });
  const seen = new Set();
  for (const s of skel) {
    if (seen.has(s)) continue;
    const comp = new Set([s]), q = [s]; seen.add(s);
    while (q.length) { const i = q.pop(); for (const { j } of mol.nb[i]) if (skel.has(j) && !comp.has(j)) { comp.add(j); seen.add(j); q.push(j); } }
    const nodes = [...comp];
    for (let a = 0; a < nodes.length; a++) for (let b = a; b < nodes.length; b++) {
      const p = pathIn(mol, comp, nodes[a], nodes[b]);
      if (!p.length) continue;
      const un = unsatOn(mol, p, new Map(p.map((c, i) => [c, i + 1])));
      out.push({ type: 'chain', atoms: p, size: p.length, nRings: 0, cls: 1, nMult: un.enes.length + un.ynes.length, nDouble: un.enes.length });
    }
  }
  /* 주 작용기 수 */
  for (const c of out) principalOn(C, c);
  return out;
}
/* 후보가 품는 주 작용기: suffix(원자), carbo(아실 탄소), hosts(번호를 받는 원자) */
function principalOn(C, cand) {
  const { mol, P, info } = C;
  const suffix = new Set(), carbo = new Set(), hosts = [];
  const inCand = new Set(cand.atoms);
  if (P) for (const c of cand.atoms) {
    if (mol.atoms[c].el !== 'C') continue;
    const f = info[c];
    if (cand.type === 'chain') {
      if (C.tri) { for (const { j } of mol.nb[c]) if (C.S.has(j)) { carbo.add(j); hosts.push(c); } }
      else if (ACYL.has(P) || P === 'ketone') { if (f.kind === P) { suffix.add(c); hosts.push(c); } }
    } else {
      if (ACYL.has(P)) { for (const { j } of mol.nb[c]) if (!inCand.has(j) && info[j] && info[j].kind === P && C.R.of[j] < 0) { carbo.add(j); hosts.push(c); } }
      else if (P === 'ketone' && f.kind === 'ketone') { suffix.add(c); hosts.push(c); }
    }
    if (P === 'alcohol' && f.kind !== 'acid') for (const o of f.OH) { suffix.add(o); hosts.push(c); }
    if (P === 'amine') for (const n of f.N) if (isAmineN(C, n) && !suffix.has(n)) { suffix.add(n); hosts.push(c); }
  }
  cand.suffix = suffix; cand.carbo = carbo; cand.hosts = hosts; cand.nP = hosts.length;
}

/* 번호 매김 목록: [원자 → 번호 Map] */
function numberings(C, cand) {
  const out = [];
  if (cand.type === 'chain') {
    const p = cand.atoms;
    out.push(new Map(p.map((c, i) => [c, i + 1])));
    if (p.length > 1) out.push(new Map(p.map((c, i) => [c, p.length - i])));
  } else if (cand.type === 'ring') {
    const ring = cand.atoms, m = ring.length;
    const starts = isOxa(cand.rtype) ? [ring.findIndex(i => C.mol.atoms[i].el === 'O')] : ring.map((_, k) => k);
    for (const s of starts) for (const d of [1, -1]) {
      const pos = new Map();
      for (let k = 0; k < m; k++) pos.set(ring[((s + d * k) % m + m) % m], k + 1);
      out.push(pos);
    }
  } else if (cand.type === 'vb') {
    /* 폰 바이어: 주 다리목 = 1, 가장 긴 다리 → 둘째 다리목 → 둘째 다리(돌아오며) → 가장 짧은 다리(1번 쪽부터) */
    const { bh: [h1, h2], bridges } = cand.bi;
    const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]].filter(o => bridges[o[0]].length >= bridges[o[1]].length && bridges[o[1]].length >= bridges[o[2]].length);
    for (const [m, n] of [[h1, h2], [h2, h1]]) for (const o of perms) {
      const pos = new Map([[m, 1]]);
      let k = 2;
      const fromM = path => m === h1 ? path : path.slice().reverse();
      for (const a of fromM(bridges[o[0]])) pos.set(a, k++);
      pos.set(n, k++);
      for (const a of fromM(bridges[o[1]]).slice().reverse()) pos.set(a, k++);
      for (const a of fromM(bridges[o[2]])) pos.set(a, k++);
      out.push(pos);
    }
  } else {
    const [ri, rj] = cand.rings, [a, b] = cand.link;
    for (const [ru, au, rv, av] of [[ri, a, rj, b], [rj, b, ri, a]]) for (const d1 of [1, -1]) for (const d2 of [1, -1]) {
      const pos = new Map();
      const r1 = C.R.list[ru], r2 = C.R.list[rv], s1 = r1.indexOf(au), s2 = r2.indexOf(av);
      for (let k = 0; k < 6; k++) { pos.set(r1[((s1 + d1 * k) % 6 + 6) % 6], k + 1); pos.set(r2[((s2 + d2 * k) % 6 + 6) % 6], k + 1.5); }
      out.push(pos);
    }
  }
  return out;
}
/* 번호 하나로 후보를 평가 */
function evaluate(C, cand, pos) {
  const pLocs = cand.hosts.map(h => pos.get(h)).sort((a, b) => a - b);
  let enes = [], ynes = [];
  if (cand.type === 'chain') ({ enes, ynes } = unsatOn(C.mol, cand.atoms, pos));
  else if (cand.type === 'ring' && cand.rtype === 'cyclo') enes = ringEnes(C.mol, cand.atoms, pos);
  else if (cand.type === 'vb') {
    for (const b of C.mol.bonds) {
      if (b.o !== 2 || !pos.has(b.a) || !pos.has(b.b)) continue;
      const la = pos.get(b.a), lb = pos.get(b.b);
      if (Math.abs(la - lb) !== 1) throw new NameError('다리목에 걸친 이중결합은 현재 명명 엔진이 지원하지 않습니다');
      enes.push(Math.min(la, lb));
    }
    enes.sort((x, y) => x - y);
  }
  /* N-치환기 번호 (N, N′, N″): 주 작용기의 번호 순서대로 */
  const tags = new Map(), nList = [];
  const hostLoc = x => { let l = 1e9; for (const { j } of C.mol.nb[x]) if (pos.has(j)) l = Math.min(l, pos.get(j)); return l; };
  for (const x of [...cand.suffix, ...cand.carbo]) {
    const a = C.mol.atoms[x];
    if (a.el === 'N') nList.push([x, hostLoc(x)]);
    else if (a.el === 'C' && C.info[x].kind === 'amide') nList.push([C.info[x].N[0], pos.has(x) ? pos.get(x) : hostLoc(x)]);
  }
  nList.sort((p, q) => p[1] - q[1]).forEach(([n], i) => tags.set(n, 'N' + '′'.repeat(i)));
  const rec = { alkyls: [], halides: [], nTag: n => tags.get(n) || 'N' };
  const pre = prefixesOn(C, cand.atoms, pos, { P: C.P, suffix: cand.suffix, carbo: cand.carbo, rec });
  const descs = parentStereo(C, pos);
  const zL = descs.filter(x => x.d === 'Z').map(x => x.l), rL = descs.filter(x => x.d === 'R').map(x => x.l), rrL = descs.filter(x => x.d === 'r').map(x => x.l);
  const het = cand.type === 'vb' && cand.het !== null ? [pos.get(cand.het)] : [];
  return { cand, pos, pLocs, enes, ynes, mult: [...enes, ...ynes].sort((a, b) => a - b), pre, rec, descs, zL, rL, rrL, het };
}
/* 모체에 붙는 입체 표시: 모체 안 · 모체에서 뻗은 이중결합의 E/Z, 모체 원자의 R/S. [{ l(번호), d }] 번호 순 */
function parentStereo(C, pos) {
  const inParent = C.db.filter(d => pos.has(d.a) && pos.has(d.b) && !C.R.same(d.a, d.b));
  const exo = C.db.filter(d => (pos.has(d.a) !== pos.has(d.b)));
  const descs = inParent.map(d => ({ l: Math.min(pos.get(d.a), pos.get(d.b)), d: d.desc })).concat(exo.map(d => ({ l: pos.get(pos.has(d.a) ? d.a : d.b), d: d.desc })));
  if (C.rs) for (const [c, d] of C.rs) if (pos.has(c)) descs.push({ l: pos.get(c), d });
  return descs.sort((x, y) => x.l - y.l || (x.d < y.d ? -1 : 1));
}

/* 후보 비교: 음수면 a 가 낫다. 처음 갈린 기준 이름도 돌려준다 */
function cmpCandLite(a, b, rule) {
  /* 옛 교과서 규칙: 고리와 사슬은 탄소 수가 많은 쪽이 모체 (같으면 고리) */
  const mixed = (a.cls >= 2) !== (b.cls >= 2);
  const order = [
    ['nP', x => -x.nP],
    ['cls', x => rule === 'textbook' && mixed ? 0 : -x.cls],
    ['ringVsChain', x => rule === 'textbook' && mixed ? -(x.cls >= 2 ? x.size + 0.5 : x.size) : 0],
    ['nRings', x => -x.nRings],
    ['len', x => rule === 'textbook' && x.cls === 1 ? 0 : -x.size],
    ['mult', x => -x.nMult],
    ['len2', x => rule === 'textbook' && x.cls === 1 ? -x.size : 0],
    ['dbl', x => -x.nDouble]
  ];
  for (const [k, f] of order) { const d = f(a) - f(b); if (d) return [d, k]; }
  return [0, null];
}
function cmpEval(a, b) {
  const order = [
    /* 폰 바이어 고리의 헤테로 원자가 먼저 가장 작은 번호 */
    ['het', x => x.het, true],
    ['pLoc', x => x.pLocs, true], ['multLoc', x => x.mult, true], ['dblLoc', x => x.enes, true],
    ['nPre', x => -x.pre.length, false], ['preLoc', x => sortedLocs(x.pre), true], ['alpha', x => alphaLocs(x.pre), true],
    ['esterAlpha', x => x.rec.alkyls.slice().sort((p, q) => p.key < q.key ? -1 : p.key > q.key ? 1 : p.loc - q.loc).map(a => a.loc), true],
    /* 그래도 같으면: Z 에, 그다음 R 에 작은 번호 (IUPAC 2013 P-31.1.4.3.4) */
    ['stereoZ', x => x.zL, true], ['stereoR', x => x.rL, true], ['stereoRr', x => x.rrL, true]
  ];
  for (const [k, f, list] of order) { const d = list ? cmpList(f(a), f(b)) : f(a) - f(b); if (d) return [d, k]; }
  return [0, null];
}

/* ── 이름 짓기 ─────────────────────────────────── */
/* 이 엔진이 다루는 결합만 있는지 확인 (과산화물 · 이민 · 하이드라진 등은 거절) */
export function checkSupported(mol) {
  const A = mol.atoms;
  /* 카보닐 탄소에 O · N · 할로젠이 둘 이상 (탄산 · 카바메이트 · 요소), O 양쪽이 아실 (산 무수물) */
  A.forEach((a, i) => {
    if (a.el === 'C' && mol.nb[i].some(n => n.o === 2 && A[n.j].el === 'O')) {
      const het = mol.nb[i].filter(n => n.o === 1 && A[n.j].el !== 'C').length;
      if (het >= 2) throw new NameError('탄산 · 카바메이트 계열 구조는 현재 명명 엔진이 지원하지 않습니다');
    }
    if (a.el === 'O' && mol.nb[i].length === 2 && mol.nb[i].every(n => A[n.j].el === 'C' && mol.nb[n.j].some(m => m.o === 2 && A[m.j].el === 'O')))
      throw new NameError('산 무수물은 현재 명명 엔진이 지원하지 않습니다');
    if (a.el === 'N' && mol.nb[i].filter(n => A[n.j].el === 'C' && mol.nb[n.j].some(m => m.o === 2 && A[m.j].el === 'O')).length >= 2)
      throw new NameError('이미드(N 에 아실기 둘)는 현재 명명 엔진이 지원하지 않습니다');
  });
  for (const a of A) if (!['C', 'N', 'O', 'F', 'Cl', 'Br', 'I'].includes(a.el)) throw new NameError(a.el + ' 원자가 든 분자는 현재 명명 엔진이 지원하지 않습니다');
  for (const b of mol.bonds) {
    const x = A[b.a], y = A[b.b];
    const els = [x.el, y.el].sort().join('');
    if (els === 'CC') continue;
    if (els === 'CO' && (b.o === 1 || b.o === 2)) continue;
    if (els === 'CN' && b.o === 1) continue;
    if (els === 'CN' && b.o === 3 && (x.el === 'N' ? mol.nb[b.a] : mol.nb[b.b]).length === 1) continue;
    if ((x.el === 'C' || y.el === 'C') && HALOGENS.has(x.el === 'C' ? y.el : x.el) && b.o === 1) continue;
    if (els === 'NO' && (x.el === 'N' ? x : y).q === 1) continue;
    throw new NameError('이 결합(' + x.el + (b.o === 2 ? '=' : b.o === 3 ? '≡' : '–') + y.el + ')이 든 분자는 현재 명명 엔진이 지원하지 않습니다');
  }
}

export function nameMolecule(mol, opts = {}) {
  const rule = opts.rule || '2013';
  checkSupported(mol);
  const { info, R } = analyze(mol);
  if (R.fused && R.list.some((r, i) => R.list.some((q, j) => j !== i && q.some(a => r.includes(a))) && !R.bicyclic.some(b => r.every(a => b.atoms.includes(a))))) throw new NameError('고리가 셋 이상 붙거나 한 원자를 나눠 갖는(스파이로) 구조는 현재 명명 엔진이 지원하지 않습니다');
  if (!mol.atoms.some(a => a.el === 'C')) throw new NameError('탄소가 없는 분자는 명명 대상이 아닙니다');
  if (mol.atoms.some(a => a.q && !(a.el === 'N' && a.q === 1) && !(a.el === 'O' && a.q === -1))) throw new NameError('이온은 명명 대상이 아닙니다');
  const C = { mol, info, R, types: ringTypes(mol, R), memo: new Map(), rule };
  C.db = doubleBondStereo(mol);
  const SI = stereoInfo(mol);
  C.rs = SI.all; C.centers = SI.centers;
  /* 두 고리 계 안에서 R/S 가 아닌 배치(exo · endo, syn · anti)가 정해진 자리는 아직 이름에 담지 못한다 */
  for (const bi of R.bicyclic || []) for (const a of bi.atoms) {
    if (bi.bh.includes(a) || !mol.atoms[a].chi || SI.all.has(a) || SI.same.has(a) || mol.atoms[a].h !== 1) continue;
    if (mol.nb[a].filter(n => !bi.atoms.includes(n.j)).length === 1) throw new NameError('두 고리 계 안의 이 입체 배치(exo · endo 나 syn · anti)는 현재 이름에 표시하지 못합니다');
  }
  C.ct = cisTrans(mol);
  C.present = classesPresent(C);
  C.P = topClass(C.present);
  C.S = new Set();
  if (C.P && ACYL.has(C.P)) info.forEach((f, i) => { if (f && f.kind === C.P && !mol.nb[i].some(n => R.of[n.j] >= 0)) C.S.add(i); });
  C.tri = C.S.size > 2;

  const cands = candidates(C);
  if (!cands.length) throw new NameError('모체를 결정하지 못했습니다');
  /* 1단계: 번호와 상관없는 기준으로 추림 */
  let top = [cands[0]];
  for (const c of cands.slice(1)) {
    const [d] = cmpCandLite(c, top[0], rule);
    if (d < 0) top = [c]; else if (d === 0) top.push(c);
  }
  /* 2단계: 번호 매김까지 비교 */
  let best = null;
  const evals = [];
  for (const c of top) for (const pos of numberings(C, c)) {
    const e = evaluate(C, c, pos);
    evals.push(e);
    if (!best || cmpEval(e, best)[0] < 0) best = e;
  }
  /* 풀이용 근거: 다른 모체와 갈린 기준, 번호 방향을 정한 기준 */
  let chainWhy = null;
  const other = cands.filter(c => c !== best.cand && !sameAtoms(c, best.cand));
  if (other.length) {
    let run = null;
    for (const c of other) { const d = cmpCandLite(c, best.cand, rule); if (!run || d[0] < run.d) run = { d: d[0], k: d[1], c }; }
    chainWhy = run && run.d > 0 ? run.k : null;
    if (!chainWhy) {
      const alt = evals.filter(e => !sameAtoms(e.cand, best.cand));
      let w = null;
      for (const e of alt) { const d = cmpEval(best, e); if (d[0] < 0 && (!w || d[1])) { w = d[1]; break; } }
      chainWhy = w;
    }
  }
  let numWhy = 'sym';
  const sameCand = evals.filter(e => e.cand === best.cand && e !== best);
  const RANK = ['pLoc', 'multLoc', 'dblLoc', 'nPre', 'preLoc', 'alpha'];
  let deepest = -1;
  for (const e of sameCand) { const [d, k] = cmpEval(best, e); if (d < 0 && RANK.indexOf(k) > deepest) deepest = RANK.indexOf(k); }
  if (deepest >= 0) numWhy = RANK[deepest];

  const res = assemble(C, best);
  Object.assign(res, { why: { chain: chainWhy, num: numWhy }, present: C.present, info, rule, db: C.db });
  res.centers = SI.centers;
  res.rs = SI.rs; res.pseudo = SI.pseudo; res.undef = SI.undef; res.ct = C.ct;
  /* 치환된 자리가 셋 이상인 고리에서 R/S · r/s 로 나타나지 않는 자리(예: 1,3,5-트라이메틸사이클로헥세인)는 이름에 담지 못한다 → 안내 */
  res.siteMissing = [];
  for (const list of ringSites(mol).values()) if (list.length >= 3) for (const a of list) if (mol.atoms[a].chi && !SI.all.has(a) && !SI.same.has(a)) res.siteMissing.push(a);
  res.principalAtoms = principalAtoms(C, best);
  /* 이름에 들어가지 못한 R/S (곁가지의 곁가지 등) */
  const cited = (res.nameEn.match(/(?:^|[(,])\d*′*[RSrs](?=[,)])/g) || []).length;
  res.rsMissing = Math.max(0, SI.all.size - cited);
  /* 거울상의 이름 (같으면 메소) */
  if (!opts.noCompare && SI.rs.size) {
    try {
      const mi = nameMolecule(mirror(mol), { noCompare: true, noNotes: true, rule });
      res.mirror = { en: mi.nameEn, ko: mi.nameKo };
      res.meso = mi.nameEn === res.nameEn;
    } catch { /* 생략 */ }
  }
  if (!opts.noCompare) {
    try {
      const alt = nameMolecule(mol, { rule: 'textbook', noCompare: true, noNotes: true });
      if (alt.nameEn !== res.nameEn) res.alt1993 = { en: alt.nameEn, ko: alt.nameKo };
    } catch { /* 옛 규칙 이름은 생략 */ }
  }
  if (!opts.noNotes) res.notes = notesFor(mol, info, res);
  return res;
}
function sameAtoms(a, b) { if (a.atoms.length !== b.atoms.length) return false; const s = new Set(a.atoms); return b.atoms.every(x => s.has(x)); }

function assemble(C, e) {
  const { cand, pos, pLocs, enes, ynes, pre, rec } = e;
  const P = cand.nP ? C.P : null;
  const k = pLocs.length;
  const numericPre = pre.filter(p => typeof p.loc === 'number');
  const nSubst = k + numericPre.length;
  const toks = [];
  let alkyl = null, tail = null, kind = cand.type === 'chain' ? 'chain' : cand.type === 'biphenyl' ? 'biphenyl' : cand.type === 'vb' ? 'ring' : cand.rtype === 'benzene' ? 'benzene' : 'ring';
  let noLocs = false;
  const place = cand.type === 'chain' ? (C.tri && ACYL.has(P) ? 'carbo' : 'chain') : (ACYL.has(P) ? 'carbo' : 'ring');
  const halide = rec.halides[0];
  let suf = P ? suffixFor(P, k, place === 'carbo' ? 'carbo' : 'chain', halide) : null;

  if (cand.type === 'chain') {
    const n = cand.size;
    noLocs = n === 1 || (n === 2 && nSubst === 1);
    const showSufLocs = suf && !noLocs && (place === 'carbo' || !ACYL.has(P));
    if (suf) suf = { ...suf, locs: showSufLocs ? pLocs : null };
    if (place === 'carbo' && n === 1) suf.locs = null;
    const g = groupPrefixes(pre, noLocs);
    toks.push(...g.toks, ...parentWord(n, enes, ynes, suf, { noUnsatLocs: n === 2 }));
    e.groups = g.groups;
  } else if (cand.type === 'biphenyl') {
    const g = groupPrefixes(pre, false);
    if (P) {
      const lc = pLocs.map(fmtLoc).join(',');
      toks.push(...g.toks);
      if (g.toks.length) toks.push(T('-', '-', 'pun'));
      toks.push(T('[1,1′-biphenyl]', '[1,1′-바이페닐]', 'par'), T('-', '-', 'pun'), T(lc, lc, 'loc'), T('-', '-', 'pun'), T(suf.en, suf.ko, 'suf'));
    } else {
      toks.push(...g.toks);
      if (g.toks.length) toks.push(T('-', '-', 'pun'));
      toks.push(T('1,1′-biphenyl', '1,1′-바이페닐', 'par'));
    }
    e.groups = g.groups;
  } else if (cand.rtype === 'benzene') {
    const retained = P && k === 1 && RETAINED[P];
    noLocs = retained ? numericPre.length === 0 : nSubst <= 1;
    const g = groupPrefixes(pre, noLocs);
    toks.push(...g.toks);
    if (!P) toks.push(T('benzene', '벤젠', 'par'));
    else if (retained) {
      toks.push(T(RETAINED[P][0].trim(), RETAINED[P][1].trim(), 'par'));
      if (P === 'acylhalide') tail = HALIDE_WORD[halide];
    } else {
      const lc = pLocs.join(',');
      toks.push(T('benzene', '벤젠', 'par'), T('-', '-', 'pun'), T(lc, lc, 'loc'), T('-', '-', 'pun'), T(suf.en, suf.ko, 'suf'));
    }
    e.groups = g.groups;
  } else if (cand.type === 'vb') {
    /* 바이사이클로[a.b.c]알케인 · 옥사바이사이클로 */
    const [a, b, c] = cand.bi.bridges.map(x => x.length).sort((x, y) => y - x);
    const g = groupPrefixes(pre, false);
    toks.push(...g.toks);
    if (cand.het !== null) { const hl = String(pos.get(cand.het)); if (g.toks.length) toks.push(T('-', '-', 'pun')); toks.push(T(hl, hl, 'loc'), T('-', '-', 'pun'), T('oxa', '옥사', 'par')); }
    toks.push(T(`bicyclo[${a}.${b}.${c}]`, `바이사이클로[${a}.${b}.${c}]`, 'par'));
    if (suf) suf = { ...suf, locs: pLocs };
    toks.push(...parentWord(cand.size, enes, [], suf, {}));
    e.groups = g.groups;
  } else if (cand.type === 'ring' && isOxa(cand.rtype)) {
    const O = OXA[cand.size];
    const g = groupPrefixes(pre, false);
    toks.push(...g.toks);
    if (P) { const lc = pLocs.join(','); const v = suf.vowel || /^[aeiou]/.test(suf.en); toks.push(T(v ? O[2] : O[0], v ? O[3] : O[1], 'par'), T('-', '-', 'pun'), T(lc, lc, 'loc'), T('-', '-', 'pun'), T(suf.en, suf.ko, 'suf')); }
    else toks.push(T(O[0], O[1], 'par'));
    e.groups = g.groups;
  } else {
    const m = cand.size;
    noLocs = nSubst <= 1 && !enes.length;
    const onlyEne = nSubst === 0 && enes.length === 1;
    const g = groupPrefixes(pre, noLocs);
    toks.push(...g.toks);
    if (suf) suf = { ...suf, locs: noLocs ? null : pLocs };
    toks.push(...parentWord(m, enes, [], suf, { ring: true, noUnsatLocs: onlyEne }));
    e.groups = g.groups;
  }
  if (P === 'ester') alkyl = esterAlkyls(rec.alkyls);
  if (P === 'acylhalide' && !tail && suf && !suf.en.includes(' ')) tail = HALIDE_WORD[halide];
  /* 입체 표시 */
  const descs = e.descs || parentStereo(C, pos);
  const stereo = fmtDescs(descs.map(x => [x.l, x.d]), stereoUnits(C, pos));
  /* 고리 모체의 치환기 두 개 cis/trans: R/S 가 없는 고리(1,4-이치환 등)는 이름 맨 앞에 cis- · trans- */
  const ctP = cand.type === 'ring' ? (C.ct || []).find(x => x.n === 2 && x.atoms.every(a => pos.has(a))) : null;
  const ctPlain = ctP && ctP.atoms.every(a => !(C.rs && C.rs.has(a)));
  const ctTok = ctPlain ? [T(ctP.rel, ctP.rel, 'ste'), T('-', '-', 'pun')] : [];
  const ste = stereo ? [T(`(${stereo})`, `(${stereo})`, 'ste'), T('-', '-', 'pun')] : [];
  const core = ctTok.concat(ste, toks);
  const build = coreT => {
    let en = coreT.map(t => ({ s: t.en, r: t.r })), ko = coreT.map(t => ({ s: t.ko, r: t.r }));
    if (alkyl) {
      en = [{ s: alkyl.en, r: 'alk' }, { s: ' ', r: 'pun' }].concat(en);
      ko = ko.concat([{ s: ' ', r: 'pun' }, { s: alkyl.ko, r: 'alk' }]);
    }
    if (tail) { en.push({ s: ' ', r: 'pun' }, { s: tail[0], r: 'suf' }); ko.push({ s: ' ', r: 'pun' }, { s: tail[1], r: 'suf' }); }
    return { en, ko, nameEn: en.map(t => t.s).join(''), nameKo: ko.map(t => t.s).join('') };
  };
  const { en, ko, nameEn, nameKo } = build(core);
  /* 상대 배치 이름: (1R,2R)-2-methylcyclohexan-1-ol → trans-2-methylcyclohexan-1-ol, (Z)-but-2-ene → cis-but-2-ene */
  let relName = null;
  if (ctP && !ctPlain && descs.length === 2 && descs.every(x => /[RS]/.test(x.d)) && ctP.atoms.every(a => C.rs.has(a))) {
    const r = build([T(ctP.rel, ctP.rel, 'ste'), T('-', '-', 'pun'), ...toks]); relName = { en: r.nameEn, ko: r.nameKo, kind: 'ring', rel: ctP.rel };
  } else if (descs.length === 1 && /^[EZ]$/.test(descs[0].d) && !ctTok.length) {
    const d = C.db.find(x => pos.has(x.a) && pos.has(x.b) && Math.min(pos.get(x.a), pos.get(x.b)) === descs[0].l);
    if (d && C.mol.atoms[d.a].h === 1 && C.mol.atoms[d.b].h === 1) {
      const rel = descs[0].d === 'Z' ? 'cis' : 'trans';
      const r = build([T(rel, rel, 'ste'), T('-', '-', 'pun'), ...toks]); relName = { en: r.nameEn, ko: r.nameKo, kind: 'alkene', rel };
    }
  }
  const locOut = new Map(); for (const [a, l] of pos) locOut.set(a, fmtLoc(l));
  return {
    kind, P, tri: C.tri, en, ko, nameEn, nameKo, stereo, relName, ringCT: ctP ? { ...ctP, plain: ctPlain } : null,
    parent: { type: cand.type, rtype: cand.rtype, atoms: cand.atoms, size: cand.size },
    chain: cand.type === 'chain' ? cand.atoms.slice().sort((x, y) => pos.get(x) - pos.get(y)) : cand.atoms,
    pos, locLabel: locOut, pLocs, enes, ynes, prefixes: e.groups || [], noLocs, n: cand.size, core
  };
}
function esterAlkyls(list) {
  const map = new Map();
  for (const n of list) { if (!map.has(n.en)) map.set(n.en, { ...n, k: 0, locs: [] }); const g = map.get(n.en); g.k++; g.locs.push(n.loc); }
  const parts = [...map.values()].sort((a, b) => a.key < b.key ? -1 : 1);
  if (parts.length === 1) {
    const x = parts[0];
    if (x.k === 1) return { en: x.en, ko: x.ko };
    return x.compound ? { en: MULT2[x.k] + '(' + x.en + ')', ko: MULT2_KO[x.k] + '(' + x.ko + ')' } : { en: MULT[x.k] + x.en, ko: MULT_KO[x.k] + x.ko };
  }
  /* 서로 다른 알킬: 어느 카복실레이트인지 번호로 (1-ethyl 4-methyl butanedioate) */
  const one = (x, lang) => {
    const locs = x.locs.slice().sort((a, b) => a - b).map(fmtLoc).join(',');
    const nm = lang === 'en' ? x.en : x.ko;
    const m = x.k > 1 ? (x.compound ? (lang === 'en' ? MULT2 : MULT2_KO)[x.k] : (lang === 'en' ? MULT : MULT_KO)[x.k]) : '';
    return `${locs}-${m}${x.compound ? '(' + nm + ')' : nm}`;
  };
  return { en: parts.map(x => one(x, 'en')).join(' '), ko: parts.map(x => one(x, 'ko')).join(' ') };
}

/* 주 작용기 원자 (그림 · 3D 강조) */
function principalAtoms(C, e) {
  const set = new Set(), { mol, info } = C, cand = e.cand;
  const addAcyl = c => {
    set.add(c);
    for (const { j } of mol.nb[c]) {
      const a = mol.atoms[j];
      if (a.el === 'O' || a.el === 'N' || HALOGENS.has(a.el)) { if (info[c].kind === 'ketone' && a.el !== 'O') continue; set.add(j); }
    }
  };
  for (const x of cand.suffix) { if (mol.atoms[x].el === 'C') addAcyl(x); else set.add(x); }
  for (const x of cand.carbo) addAcyl(x);
  return set;
}

/* 호변이성질 · 불안정 구조 · 입체 안내 */
function notesFor(mol, info, res) {
  const notes = [], A = mol.atoms;
  const R = ringsOf(mol);
  info.forEach((f, i) => {
    if (!f) return;
    const arom = mol.nb[i].some(n => mol.bonds[n.k].arom);
    const onCC = !arom && mol.nb[i].some(n => n.o === 2 && A[n.j].el === 'C');
    if (onCC && f.OH.length) {
      let keto = null;
      try { const t = tautomer(mol, i, f.OH[0]); if (t) keto = nameMolecule(t, { noNotes: true, noCompare: true }); } catch { keto = null; }
      notes.push({ type: 'enol', atom: i, keto });
    }
    if (onCC && f.N.some(n => A[n].h > 0)) notes.push({ type: 'enamine', atom: i });
    /* 삼중결합 탄소의 OH · NH (이놀 · 이나민): 곧바로 케텐 · 케텐이민으로 바뀐다 */
    const onYne = mol.nb[i].some(n => n.o === 3 && A[n.j].el === 'C');
    if (onYne && f.OH.length) notes.push({ type: 'ynol', atom: i });
    if (onYne && f.N.some(n => A[n].h > 0)) notes.push({ type: 'ynamine', atom: i });
    if (f.OH.length >= 2) notes.push({ type: 'gemdiol', atom: i });
    else if (f.OH.length && f.halo.length && !f.kind) notes.push({ type: 'halohydrin', atom: i });
    else if (f.OH.length && f.N.length && !f.kind) notes.push({ type: 'hemiaminal', atom: i });
    else if (f.OH.length && f.OR.length && f.kind !== 'ester') notes.push({ type: 'hemiacetal', atom: i });
  });
  void R;
  if (res.centers.length) notes.push({ type: 'chiral', atoms: res.centers, rs: res.rs, undef: res.undef, meso: res.meso, mirror: res.mirror, missing: res.rsMissing });
  const ezOnly = (res.stereo || '').split(',').filter(x => /[EZ]$/.test(x));
  if (ezOnly.length) notes.push({ type: 'ez', desc: ezOnly.length === 1 && !res.stereo.includes(',') ? ezOnly[0] : ezOnly.join(',') });
  if (res.alt1993) notes.push({ type: 'rule1993', en: res.alt1993.en, ko: res.alt1993.ko });
  return notes;
}

/* 엔올 → 케토 */
export function tautomer(mol, c, o) {
  const other = mol.nb[c].find(n => n.o === 2 && mol.atoms[n.j].el === 'C');
  if (!other) return null;
  const atoms = mol.atoms.map(a => ({ ...a }));
  const bonds = mol.bonds.map(b => ({ ...b }));
  const bb = bonds.find(b => (b.a === c && b.b === other.j) || (b.b === c && b.a === other.j)); bb.o = 1;
  const bo = bonds.find(b => (b.a === c && b.b === o) || (b.b === c && b.a === o)); bo.o = 2;
  atoms[o].h = 0; atoms[other.j].h += 1;
  const nb = atoms.map(() => []);
  bonds.forEach((b, k) => { nb[b.a].push({ j: b.b, o: b.o, k }); nb[b.b].push({ j: b.a, o: b.o, k }); });
  return { atoms, bonds, nb };
}
