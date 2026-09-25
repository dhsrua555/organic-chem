/* 퀴즈: 네 분야(이름 짓기 · 반응 · 입체 · 작용기)를 다시 세부 주제로 나눠 한 가지씩 집중해서 푼다. 주제마다 맞힌 수를 따로 센다.
   오답 보기는 조각 자리 · 종류를 바꾼 "진짜 다른 분자", 반응에서는 다른 시약 · 다른 방향의 생성물 */
import { TEMPLATES, fromSmiles, attach, flipEZ } from '../chem/edit.js';
import { steps } from '../chem/explain.js';
import { CATS, REACTIONS, predict, applicable } from '../chem/reactions.js';
import { drawMolecule } from '../draw.js';
import { defineMissing, flipCenter, stereoInfo, stereoSites, cipDetail } from '../chem/stereo.js';
import { branchesOf, compareBranch } from '../chem/cip.js';
import { toSmiles } from '../chem/core.js';
import { CLASS } from '../chem/name.js';
import { GROUP_INFO } from '../data.js';
import { centerHTML, groupLabel } from '../rsview.js';
import { EXAMPLES } from './react.js';
import { entry, tokensHTML, esc, store, getLang, onLang, pick, shuffle, drawMode } from '../ui.js';

const UNSTABLE = ['enol', 'enamine', 'ynol', 'ynamine', 'gemdiol', 'halohydrin', 'hemiaminal', 'hemiacetal'];
const POOL = ['OH', 'OH', 'OH', 'COOH', 'COOH', 'CHO', 'NH2', 'NH2', 'CH3', 'CH3', 'CH3', 'CH3', 'Cl', 'Cl', 'Br', 'NO2', 'OCH3', 'COCH3', 'CN', 'COOCH3', 'CONH2', 'F', 'oxo', 'C2H5', 'vinyl', 'phenyl'];
const BASE_SMI = TEMPLATES.filter(t => t.kind === 'base').map(t => t.smi);
const CHAINS = ['CC', 'CCC', 'CCCC', 'CCCCC', 'CCCCCC'];
const RX_SUBS = ['CCC(C)Br', 'CC(C)(C)Br', 'CCCBr', 'CC(C)C(C)Br', 'BrCc1ccccc1', 'CC(O)CC', 'CCCO', 'CC(C)(C)O', 'OC1CCCCC1', 'CC=C', 'CC(C)=CC', 'C1=CCCCC1', 'CC(C)(C)C=C',
  'CCC#C', 'CC#CC', 'CCC=O', 'CC(=O)c1ccccc1', 'O=C1CCCCC1', 'CCOC(C)=O', 'CCC#N', 'CC(=O)O', 'CC(=O)Cl', 'c1ccccc1', 'Cc1ccccc1', 'COc1ccccc1', '[O-][N+](=O)c1ccccc1', 'CCC', 'CC(C)C', 'CC=O', 'C=CC=C', 'Brc1ccccc1',
  'CC1CO1', 'CC1(C)CO1', 'CC=CC(C)=O', 'CC(=O)CC', 'Nc1ccccc1', 'Clc1ccc(cc1)[N+](=O)[O-]', 'Cc1ccc(Cl)cc1', 'CC(C)=O'];
const mode = drawMode;
const HALO = new Set(['F', 'Cl', 'Br', 'I']);
const hasEther = m => m.atoms.some((a, i) => a.el === 'O' && m.nb[i].length === 2 && m.nb[i].every(n => n.o === 1 && m.atoms[n.j].el === 'C' && !m.nb[n.j].some(x => x.o === 2 && m.atoms[x.j].el === 'O')));
const hasMulti = m => m.bonds.some(b => b.o >= 2 && !b.arom && m.atoms[b.a].el === 'C' && m.atoms[b.b].el === 'C');

/* ── 주제 ─────────────────────────────── */
const NAME_T = [
  { id: 'mix', ko: '종합', sub: '기본 골격 12종 × 치환기 26종' },
  { id: 'alkane', ko: '알케인 · 곁사슬', sub: '메틸 · 에틸 곁사슬', bases: ['CCCC', 'CCCCC', 'CCCCCC', 'CCC'], pool: ['CH3', 'CH3', 'CH3', 'C2H5'],
    want: e => e.res.kind === 'chain' && e.mol.atoms.every(a => a.el === 'C') && e.mol.bonds.every(b => b.o === 1) },
  { id: 'unsat', ko: '알켄 · 알카인', sub: '-ene · -yne 위치번호, E/Z', bases: ['C=CC', 'C=CCC', 'CC=CC', 'C=CCCC', 'C#CC', 'C#CCC', 'CC#CC', 'C=CC=C'], pool: ['CH3', 'CH3', 'CH3', 'C2H5', 'vinyl', 'ethynyl', 'Cl', 'Br', 'OH'],
    want: e => e.res.kind !== 'benzene' && hasMulti(e.mol) },
  { id: 'halo', ko: '할로젠 · 나이트로', sub: '접두사 전용 치환기', bases: [...CHAINS, 'C1CCCCC1', 'c1ccccc1'], pool: ['F', 'Cl', 'Cl', 'Br', 'Br', 'I', 'NO2', 'NO2', 'CH3', 'CH3'],
    want: e => !e.res.P && e.mol.atoms.some(a => HALO.has(a.el) || (a.el === 'N' && a.q === 1)) },
  { id: 'alcohol', ko: '알코올 · 에터 · 아민', sub: '-ol · -amine · 알콕시', bases: [...CHAINS, 'C1CCCCC1', 'C=CC'], pool: ['OH', 'OH', 'OH', 'NH2', 'NH2', 'OCH3', 'OCH3', 'CH3', 'CH3', 'Cl'],
    want: e => ['alcohol', 'amine'].includes(e.res.P) || (!e.res.P && hasEther(e.mol)) },
  { id: 'carbonyl', ko: '알데하이드 · 케톤', sub: '-al · -one · oxo · formyl', bases: [...CHAINS, 'C1CCCCC1', 'C=CC', 'c1ccccc1'], pool: ['CHO', 'CHO', 'oxo', 'oxo', 'COCH3', 'CH3', 'CH3', 'OH', 'Cl', 'C2H5'],
    want: e => ['aldehyde', 'ketone'].includes(e.res.P) },
  { id: 'acid', ko: '카복실산과 유도체', sub: '산 · 에스터 · 아마이드 · 나이트릴', bases: [...CHAINS, 'C1CCCCC1', 'C=CC', 'c1ccccc1'], pool: ['COOH', 'COOH', 'COOCH3', 'COOCH3', 'CONH2', 'CN', 'COCl', 'CH3', 'CH3', 'OH', 'Cl'],
    want: e => ['acid', 'ester', 'amide', 'nitrile', 'acylhalide'].includes(e.res.P) },
  { id: 'ring', ko: '고리 화합물', sub: '사이클로알케인 · 고리 위치번호', bases: ['C1CCCCC1', 'C1CCCC1', 'C1=CCCCC1', 'C1CC1', 'C1CCC1'], pool: ['CH3', 'CH3', 'C2H5', 'OH', 'Cl', 'Br', 'oxo', 'COOH', 'NH2', 'CHO'],
    want: e => !['chain', 'benzene', 'biphenyl'].includes(e.res.kind) },
  { id: 'benzene', ko: '벤젠 유도체', sub: '페놀 · 아닐린 · 톨루엔 · o/m/p', bases: ['c1ccccc1'], pool: ['CH3', 'OH', 'NH2', 'Cl', 'Br', 'NO2', 'COOH', 'CHO', 'OCH3', 'COCH3', 'CN', 'C2H5'],
    want: e => e.res.kind === 'benzene' },
  { id: 'multi', ko: '다작용기 화합물', sub: '작용기 우선순위와 접미사', min: 2, pool: ['COOH', 'COOCH3', 'CONH2', 'CN', 'CHO', 'oxo', 'COCH3', 'OH', 'OH', 'NH2', 'NH2', 'Cl', 'CH3'],
    want: e => e.res.P && [...(e.res.present || [])].filter(c => CLASS[c]).length >= 2 }
];
const RX_T = [{ id: 'all', ko: '종합', sub: '시약 97종' }, ...CATS.map(c => ({ id: c.id, ko: c.ko, sub: c.sub }))];
const ST_T = [
  { id: 'mix', ko: '종합', sub: '여섯 주제 혼합' },
  { id: 'rs1', ko: 'R/S · 입체중심 1개', sub: '단순 화합물' },
  { id: 'rsN', ko: 'R/S · 다중 입체중심', sub: '여러 중심 가운데 하나' },
  { id: 'cip', ko: 'CIP 우선순위', sub: '① ② ③ 결정' },
  { id: 'ct', ko: '고리 cis · trans', sub: '고리의 같은 면 · 반대 면' },
  { id: 'ez', ko: 'E/Z 배치', sub: 'CIP 우선순위로 판정' },
  { id: 'meso', ko: '메소 화합물', sub: '거울상과 포개어지는가' }
];
const GR_T = [
  { id: 'mix', ko: '종합', sub: '세 주제 혼합' },
  { id: 'identify', ko: '작용기 식별', sub: '구조 → 작용기' },
  { id: 'principal', ko: '주 작용기 결정', sub: '접미사로 표시되는 작용기' },
  { id: 'affix', ko: '접미사 · 접두사', sub: '-ol ↔ hydroxy-' }
];
const AREAS = [
  { id: 'name', ko: '명명', topics: NAME_T },
  { id: 'react', ko: '반응', topics: RX_T },
  { id: 'stereo', ko: '입체화학', topics: ST_T },
  { id: 'group', ko: '작용기', topics: GR_T }
];

/* ── 이름 짓기 ─────────────────────────── */
function ok(e) { return e.res && !(e.res.notes || []).some(n => UNSTABLE.includes(n.type)) && !e.res.alt1993 && e.res.nameEn.length <= 48; }
function replay(base, recipe) {
  let m = fromSmiles(base);
  for (const [i, f] of recipe) { if (!m.atoms[i]) return null; const r = attach(m, i, f); if (!r.mol) return null; m = r.mol; }
  return m;
}
function randomQ(tp, level) {
  const bases = tp.bases || BASE_SMI, pool = tp.pool || POOL, want = tp.want || (() => true);
  for (let t = 0; t < 400; t++) {
    const base = pick(bases);
    const lo = Math.max(tp.min || 1, level === 'easy' ? 1 : 2), hi = level === 'easy' ? Math.max(lo, 2) : 4;
    const k = lo + Math.floor(Math.random() * (hi - lo + 1));
    const recipe = [];
    let m = fromSmiles(base);
    for (let j = 0; j < k; j++) {
      const at = m.atoms.map((a, i) => i).filter(i => m.atoms[i].h > 0 && m.atoms[i].el === 'C');
      if (!at.length) break;
      const i = pick(at), f = pick(pool);
      const r = attach(m, i, f); if (!r.mol) continue;
      recipe.push([i, f]); m = r.mol;
    }
    if (!recipe.length) continue;
    const e = entry(m);
    if (!ok(e) || !want(e)) continue;
    return { base, recipe, e, tp };
  }
  return null;
}
function distractors(q) {
  const out = new Map(), tp = q.tp, pool = tp.pool || POOL, bases = tp.bases || BASE_SMI, want = tp.want || (() => true);
  const add = (m, strict) => { if (!m) return; const e = entry(m); if (ok(e) && (!strict || want(e)) && e.res.nameEn !== q.e.res.nameEn && !out.has(e.res.nameEn)) out.set(e.res.nameEn, { e }); };
  for (let t = 0; t < 90 && out.size < 8; t++) {
    const rec = q.recipe.map(x => x.slice());
    const k = Math.floor(Math.random() * rec.length);
    const r = Math.random();
    if (r < 0.5) { const n = fromSmiles(q.base).atoms.length + k * 2; rec[k][0] = Math.floor(Math.random() * Math.max(2, n)); }
    else if (r < 0.85) rec[k][1] = pick(pool);
    else { add(replay(pick(bases), rec), t < 60); continue; }
    add(replay(q.base, rec), t < 60);
  }
  return shuffle([...out.values()]).slice(0, 3);
}
function nameQ(topic, level, dir) {
  const tp = NAME_T.find(x => x.id === topic) || NAME_T[0];
  const q = randomQ(tp, level);
  if (!q) return null;
  const opts = shuffle([{ e: q.e }, ...distractors(q)]);
  return { ...q, kind: dir === 'struct' ? 'struct' : 'name', opts, correct: opts.find(o => o.e === q.e), mol3d: q.e, open: ['build', { mol: q.e.mol }] };
}

/* ── 반응 ─────────────────────────────── */
const OKMAP = new Map();
function okFor(smi, mol) { if (!OKMAP.has(smi)) OKMAP.set(smi, applicable(mol)); return OKMAP.get(smi); }
function subsFor(cat) {
  if (cat === 'all') return RX_SUBS;
  const list = [...new Set([...(EXAMPLES[cat] || []).map(x => x[0]), ...RX_SUBS])];
  return list.filter(s => { const m = fromSmiles(s), okm = okFor(s, m); return REACTIONS.some(r => r.cat === cat && okm[r.id]); });
}
const SUBS = new Map();
const subsCached = cat => { if (!SUBS.has(cat)) SUBS.set(cat, subsFor(cat)); return SUBS.get(cat); };
const inCat = (cat, id) => cat === 'all' || (REACTIONS.find(r => r.id === id) || {}).cat === cat;
const byCat = (cat, ids) => [...shuffle(ids.filter(x => inCat(cat, x))), ...shuffle(ids.filter(x => !inCat(cat, x)))];
function reactQ(cat) {
  const subs = subsCached(cat);
  for (let t = 0; t < 80; t++) {
    const smi = pick(subs);
    const mol = fromSmiles(smi);
    const okMap = okFor(smi, mol);
    const all = REACTIONS.filter(r => okMap[r.id]).map(r => r.id);
    const ids = all.filter(x => inCat(cat, x));
    if (!ids.length) continue;
    const rid = pick(ids);
    const res = predict(mol, rid);
    const major = res.ok && res.products.find(p => p.role === 'major' && p.name);
    if (!major || res.warn) continue;
    const opts = new Map([[major.name.nameEn, { e: { mol: major.mol, res: major.name } }]]);
    const addP = p => { if (p && p.name && !opts.has(p.name.nameEn) && p.role !== 'side') opts.set(p.name.nameEn, { e: { mol: p.mol, res: p.name } }); };
    res.products.forEach(addP);
    for (const other of byCat(cat, all.filter(x => x !== rid))) {
      if (opts.size >= 4) break;
      const r2 = predict(mol, other);
      if (r2.ok) addP(r2.products.find(p => p.role === 'major'));
    }
    const sub = entry(mol);
    if (opts.size < 4 && sub.res && !opts.has(sub.res.nameEn)) opts.set(sub.res.nameEn, { e: sub, same: true });
    if (opts.size < 3) continue;
    const list = [...opts.values()].slice(0, 4);
    const correct = list[0];
    return { kind: 'react', smi, rid, res, sub, e: correct.e, correct, opts: shuffle(list), mol3d: sub, open: ['react', { smiles: smi, rid }] };
  }
  return null;
}
/* 시약 맞히기: 기질 → 생성물을 만든 시약은? 다른 보기는 다른 생성물을 주거나 반응하지 않는 시약 */
function reagentQ(cat) {
  const subs = subsCached(cat);
  for (let t = 0; t < 80; t++) {
    const smi = pick(subs);
    const mol = fromSmiles(smi);
    const okMap = okFor(smi, mol);
    const all = REACTIONS.filter(r => okMap[r.id]).map(r => r.id);
    const ids = all.filter(x => inCat(cat, x));
    if (!ids.length) continue;
    const rid = pick(ids);
    const res = predict(mol, rid);
    const major = res.ok && res.products.find(p => p.role === 'major' && p.name);
    if (!major || res.warn) continue;
    const target = major.name.nameEn;
    const opts = [{ key: rid, prod: major }];
    const tryAdd = id => {
      if (opts.length >= 4) return;
      const r2 = predict(mol, id);
      const m2 = r2.ok ? r2.products.find(p => p.role === 'major' && p.name) : null;
      if (m2 && m2.name.nameEn === target) return; /* 같은 생성물을 주는 시약은 보기에서 뺀다 (정답이 둘이 되지 않게) */
      if (r2.ok && !m2) return;
      opts.push({ key: id, prod: m2, none: !r2.ok, why: r2.ok ? '' : r2.reason });
    };
    for (const id of byCat(cat, all.filter(x => x !== rid))) tryAdd(id);
    /* 모자라면 같은 분류의 반응하지 않는 시약 */
    for (const r of shuffle(REACTIONS.filter(r => inCat(cat, r.id) && !okMap[r.id]))) tryAdd(r.id);
    for (const r of shuffle(REACTIONS.filter(r => !inCat(cat, r.id) && !okMap[r.id])).slice(0, 6)) tryAdd(r.id);
    if (opts.length < 3) continue;
    const sub = entry(mol);
    return { kind: 'reagent', smi, rid, res, sub, prod: { mol: major.mol, res: major.name }, opts: shuffle(opts), answer: rid, mol3d: { mol: major.mol, res: major.name }, open: ['react', { smiles: smi, rid }] };
  }
  return null;
}

/* ── 입체 ─────────────────────────────── */
/* R/S 문제용: 입체중심이 하나인 쉬운 분자들 (배열은 문제마다 무작위로 뒤집는다) */
const RS_EASY = ['C[C@@H](O)CC', 'C[C@H](Br)CC', 'C[C@H](N)C(=O)O', 'C[C@@H](O)C(=O)O', 'O[C@@H](c1ccccc1)C', 'CC[C@@H](C)CO', 'C[C@H](Cl)C=C', 'ClC[C@@H](O)C',
  'C[C@@H](C#N)CC', 'OC[C@H](O)C=O', 'CC(C)[C@@H](C)Br', 'C[C@@H]1CCCCC1=O', 'CC[C@H](C)C(=O)O', 'C[C@@H](F)CCl', 'CC[C@@H](O)C=C', 'N[C@@H](Cc1ccccc1)C(=O)O', 'C[C@H](OC)CC=O', 'CC(=O)[C@@H](C)CC'];
/* cis/trans 문제용 고리 */
const CT_RINGS = ['CC1CCC(C)CC1', 'CC1CCCCC1C', 'CC1CCC(O)CC1', 'CC1CC(C)C1', 'CC(C)(C)C1CCC(O)CC1', 'CC1CCC(Cl)CC1', 'OC1CCCC1Br', 'CC1CC1C', 'OC(=O)C1CCC(C)CC1', 'CC1CCCC(C)C1'];
/* E/Z 문제용 알켄 (양 끝의 두 치환기가 서로 다른 것) */
const EZ_SMI = ['CC=CC', 'CCC=CC', 'CCC=CCC', 'ClC=CC', 'BrC=CBr', 'ClC=CBr', 'OCC=CC', 'CC=CC(=O)O', 'CC=CC=O', 'CC(Cl)=CC', 'CCC(C)=CC', 'CC(Br)=C(Cl)C', 'CC=C(C)CC', 'OC(=O)C=CC(=O)O', 'CC=CCl', 'CC=CC#N', 'CC(F)=CCl', 'CC(O)C=CC', 'CC=C(Br)CC', 'ClC(C)=C(C)CC'];
/* 메소 · 카이랄 문제용: 입체중심 둘 (대칭인 것과 아닌 것) */
const MESO_SYM = ['CC(O)C(O)C', 'CC(Br)C(Br)C', 'CC(Cl)C(Cl)C', 'OC(=O)C(O)C(O)C(=O)O', 'CC(N)C(N)C', 'CC1CCCC1C', 'CC1CCCCC1C', 'OC1CCCCC1O', 'ClC1CCCC1Cl', 'CC(O)CC(O)C', 'CC(Br)CC(Br)C', 'CC1CC(C)C1'];
const MESO_ASYM = ['CC(O)C(O)CC', 'CC(O)C(Br)C', 'CC(Cl)C(O)C', 'OC1CCCCC1Cl', 'CC(O)C(N)C', 'CC1CCCC1CC'];
const BASES_FOR_RS = TEMPLATES.filter(t => t.kind === 'base');
function randomRS(level) {
  for (let t = 0; t < 400; t++) {
    let m;
    if (level === 'easy') m = fromSmiles(pick(RS_EASY));
    else {
      m = fromSmiles(pick(BASES_FOR_RS).smi);
      const k = 2 + Math.floor(Math.random() * 3);
      for (let j = 0; j < k; j++) {
        const at = m.atoms.map((a, i) => i).filter(i => m.atoms[i].h > 0 && m.atoms[i].el === 'C');
        const r = attach(m, pick(at), pick(POOL)); if (r.mol) m = r.mol;
      }
      if (!stereoInfo(m).centers.length) continue;
    }
    m = defineMissing(m);
    for (const c of stereoInfo(m).centers) if (Math.random() < 0.5) { const r = flipCenter(m, c); if (r.mol) m = r.mol; }
    const e = entry(m);
    if (!e.res || !e.res.rs || !e.res.rs.size || (level !== 'easy' && !ok(e))) continue;
    const c = pick([...e.res.rs.keys()]);
    return { e, c, answer: e.res.rs.get(c) };
  }
  return null;
}
const locOf = e => c => e.res.locLabel && e.res.locLabel.get(c);
const labC = (e, c) => { const l = locOf(e)(c); return l ? 'C' + l : '원자 ' + (c + 1); };
const buildOpen = e => ['build', { mol: e.mol }];
function rsQ(level) {
  const r = randomRS(level);
  if (!r) return null;
  const { e, c, answer } = r;
  return {
    kind: 'rs', e, mol3d: e, answer, open: buildOpen(e),
    prompt: '표시한 입체중심의 절대 배열은? (굵은 쐐기: 지면 앞쪽 · 점선 쐐기: 지면 뒤쪽)',
    pic: done => drawMolecule(e.mol, e.res, { mode: mode(), locants: done, chain: false, compact: true, mark: c, rsLabels: done, cip: done ? c : null }),
    opts: [{ key: 'R', label: 'R', sub: 'rectus · 시계 방향' }, { key: 'S', label: 'S', sub: 'sinister · 반시계 방향' }],
    verdict: () => `${labC(e, c)}는 <b>${answer}</b> · ${esc(e.res.nameEn)}`,
    why: () => `<div class="rs-card panel">${centerHTML(e.mol, c, locOf(e))}</div>`
  };
}
const CIRC = ['①', '②', '③', '④'];
function cipQ(level) {
  for (let t = 0; t < 40; t++) {
    const r = randomRS(level);
    if (!r) return null;
    const { e, c } = r;
    const det = cipDetail(e.mol, c);
    if (!det) continue;
    const labels = det.ranked.map(j => groupLabel(e.mol, c, j));
    if (new Set(labels).size < 4) continue;
    const k = pick([0, 0, 1, 2]);
    return {
      kind: 'cip', e, mol3d: e, answer: String(k), open: buildOpen(e),
      prompt: `표시한 입체중심에서 CIP 우선순위 ${CIRC[k]}${k === 0 ? '(최고 순위)' : ''}에 해당하는 치환기는?`,
      pic: done => drawMolecule(e.mol, e.res, { mode: mode(), locants: done, chain: false, compact: true, mark: c, rsLabels: done, cip: done ? c : null }),
      opts: shuffle(labels.map((l, i) => ({ key: String(i), label: esc(l), sub: '' }))),
      verdict: () => `순위 ${CIRC[k]}: <b>${esc(labels[k])}</b> · 전체 ${labels.map((l, i) => CIRC[i] + ' ' + esc(l)).join(' → ')}`,
      why: () => `<div class="rs-card panel">${centerHTML(e.mol, c, locOf(e))}</div>`
    };
  }
  return null;
}
function ctQ() {
  for (let t = 0; t < 60; t++) {
    let m = defineMissing(fromSmiles(pick(CT_RINGS)));
    for (const c of stereoSites(m)) if (Math.random() < 0.5) { const r = flipCenter(m, c); if (r.mol) m = r.mol; }
    const e = entry(m);
    const ct = e.res && e.res.ct && e.res.ct.find(x => x.n === 2);
    if (!ct) continue;
    const ans = ct.rel;
    return {
      kind: 'ct', e, mol3d: e, answer: ans, open: buildOpen(e),
      prompt: '고리 위 두 치환기의 상대 배치는? (굵은 쐐기: 지면 앞쪽 · 점선 쐐기: 지면 뒤쪽)',
      pic: done => drawMolecule(e.mol, e.res, { mode: mode(), locants: done, chain: false, compact: true, rsLabels: done, ctLabels: done }),
      opts: [{ key: 'cis', label: 'cis', sub: '두 치환기가 고리의 같은 면' }, { key: 'trans', label: 'trans', sub: '두 치환기가 고리의 반대 면' }],
      verdict: () => `<b>${ans}</b> · ${esc(e.res.relName ? e.res.relName.en : e.res.nameEn)}`,
      why: () => `<div class="rs-card panel"><p class="rs-how">두 치환기의 결합이 ${ans === 'cis' ? '모두 굵은 쐐기이거나 모두 점선 쐐기이므로 고리의 같은 면 → <b>cis</b>' : '하나는 굵은 쐐기, 하나는 점선 쐐기이므로 고리의 반대 면 → <b>trans</b>'}. 고리 결합은 자유 회전이 불가능하므로 cis 와 trans 는 서로 다른 부분입체이성질체입니다.${e.res.ringCT && e.res.ringCT.plain ? ' 이 경우 두 탄소는 CIP 입체중심이 아니므로 이름 앞에 cis-/trans- 를 붙입니다.' : ''}</p></div>`
    };
  }
  return null;
}
/* 이중결합 한쪽 끝 c 의 두 치환기를 CIP 순위대로 (높은 것 먼저) */
function endRank(mol, c, o) {
  const br = branchesOf(mol, c).filter(n => n.atom !== o);
  br.sort((p, q) => compareBranch(mol, q, p));
  return br.map(n => groupLabel(mol, c, n.atom));
}
function ezQ() {
  for (let t = 0; t < 80; t++) {
    let m = fromSmiles(pick(EZ_SMI));
    const ks = m.bonds.map((b, k) => k).filter(k => m.bonds[k].o === 2 && !m.bonds[k].arom && m.atoms[m.bonds[k].a].el === 'C' && m.atoms[m.bonds[k].b].el === 'C');
    if (ks.length && Math.random() < 0.5) { const r = flipEZ(m, pick(ks)); if (r.mol) m = r.mol; }
    const e = entry(m);
    if (!e.res || !e.res.db || e.res.db.length !== 1 || !ok(e)) continue;
    const d = e.res.db[0];
    const A = endRank(e.mol, d.a, d.b), B = endRank(e.mol, d.b, d.a);
    if (A.length !== 2 || B.length !== 2) continue;
    const both = e.mol.atoms[d.a].h === 1 && e.mol.atoms[d.b].h === 1;
    return {
      kind: 'ez', e, mol3d: e, answer: d.desc, open: buildOpen(e),
      prompt: '이 이중결합의 배치는? 양 끝 탄소에서 CIP 우선순위가 높은 치환기의 상대 위치로 판정합니다.',
      pic: done => drawMolecule(e.mol, e.res, { mode: mode(), locants: done, chain: false, compact: true }),
      opts: [{ key: 'E', label: 'E', sub: 'entgegen · 우선 치환기가 반대쪽' }, { key: 'Z', label: 'Z', sub: 'zusammen · 우선 치환기가 같은 쪽' }],
      verdict: () => `<b>${d.desc}</b> · ${esc(e.res.nameEn)}`,
      why: () => `<div class="rs-card panel"><p class="rs-how">${labC(e, d.a)} 쪽: <b>${esc(A[0])}</b> &gt; ${esc(A[1])} · ${labC(e, d.b)} 쪽: <b>${esc(B[0])}</b> &gt; ${esc(B[1])} → 우선 치환기가 ${d.desc === 'Z' ? '같은 쪽이므로 <b>Z</b>' : '반대쪽이므로 <b>E</b>'}. ${both ? `양 끝 탄소에 H 가 하나씩이므로 ${d.desc === 'Z' ? 'cis' : 'trans'} 와 같습니다.` : '삼치환 이상의 이중결합은 cis/trans 기준이 모호하므로 E/Z 로만 표시합니다.'}</p></div>`
    };
  }
  return null;
}
function mesoQ() {
  const target = Math.random() < 0.5 ? 'meso' : 'chiral';
  for (let t = 0; t < 80; t++) {
    const src = target === 'chiral' && Math.random() < 0.4 ? MESO_ASYM : MESO_SYM;
    let m = defineMissing(fromSmiles(pick(src)));
    for (const c of stereoSites(m)) if (Math.random() < 0.5) { const r = flipCenter(m, c); if (r.mol) m = r.mol; }
    const e = entry(m);
    if (!e.res || !e.res.rs || e.res.rs.size < 2 || (e.res.undef && e.res.undef.length)) continue;
    const ans = e.res.meso ? 'meso' : 'chiral';
    if (ans !== target && t < 60) continue;
    return {
      kind: 'meso', e, mol3d: e, answer: ans, open: buildOpen(e),
      prompt: '이 화합물은 메소 화합물인가, 카이랄 화합물인가? (굵은 쐐기: 지면 앞쪽 · 점선 쐐기: 지면 뒤쪽)',
      pic: done => drawMolecule(e.mol, e.res, { mode: mode(), locants: done, chain: false, compact: true, rsLabels: done }),
      opts: [{ key: 'meso', label: '메소', sub: '거울상과 포개어짐 · 광학 비활성' }, { key: 'chiral', label: '카이랄', sub: '거울상과 포개어지지 않음 · 광학 활성' }],
      verdict: () => `<b>${ans === 'meso' ? '메소' : '카이랄'}</b> · ${esc(e.res.nameEn)}`,
      why: () => `<div class="rs-card panel"><p class="rs-how">${ans === 'meso'
        ? `입체중심이 ${e.res.rs.size}개 있으나 분자 내 대칭면이 있어(대칭 위치의 두 중심이 R · S 로 반대) 거울상과 포개어집니다. 따라서 광학 비활성입니다.`
        : `거울상 이성질체는 <span class="mono">${esc(e.res.mirror ? e.res.mirror.en : '')}</span> 로, 서로 포개어지지 않습니다.${e.res.rs.size === 2 ? ' 대칭 위치의 두 중심이 같은 배열(RR · SS)이면 대칭면이 없습니다.' : ''}`}</p></div>`
    };
  }
  return null;
}

/* ── 작용기 ───────────────────────────── */
const GI = GROUP_INFO.filter(g => g.id !== 'alkyl');
const CONFUSE = {
  acid: ['ester', 'aldehyde', 'ketone', 'alcohol'], ester: ['ether', 'ketone', 'acid'], acylhalide: ['halide', 'ketone', 'acid'], amide: ['amine', 'ketone', 'acid', 'nitrile'],
  nitrile: ['amine', 'amide', 'nitro'], aldehyde: ['ketone', 'alcohol', 'acid'], ketone: ['aldehyde', 'ether', 'ester'], alcohol: ['ether', 'aldehyde', 'acid'],
  amine: ['amide', 'nitrile', 'nitro'], ether: ['alcohol', 'ester', 'ketone'], halide: ['acylhalide', 'nitro', 'alcohol'], nitro: ['amine', 'amide', 'nitrile']
};
const HAL_FR = ['F', 'Cl', 'Br', 'I'];
function identifyQ() {
  for (let t = 0; t < 80; t++) {
    const g = pick(GI);
    let m = fromSmiles(pick(['CC', 'CCC', 'CCCC', 'C1CCCCC1', 'c1ccccc1', 'CC(C)C']));
    const at = m.atoms.map((a, i) => i).filter(i => m.atoms[i].h > 0);
    const r = attach(m, pick(at), g.id === 'halide' ? pick(HAL_FR) : g.gid);
    if (!r.mol) continue;
    m = r.mol;
    const e = entry(m);
    if (!ok(e)) continue;
    if (g.rank ? e.res.P !== g.id : e.res.P) continue;
    const others = shuffle([...new Set([...shuffle(CONFUSE[g.id] || []).slice(0, 2), ...shuffle(GI.map(x => x.id))])].filter(x => x !== g.id)).slice(0, 3);
    const opts = shuffle([g.id, ...others].map(id => { const x = GI.find(y => y.id === id); return { key: id, label: esc(x.ko), sub: x.fg }; }));
    return {
      kind: 'identify', e, mol3d: e, answer: g.id, open: ['groups', { sub: g.id }],
      prompt: '이 화합물의 작용기는?',
      pic: done => drawMolecule(e.mol, e.res, { mode: mode(), locants: done, chain: false, compact: true }),
      opts,
      verdict: () => `<b>${esc(g.ko)}</b> (${g.fg}) · ${esc(e.res.nameEn)}`,
      why: () => `<p class="note">${esc(g.desc)}</p><p class="note">명명 시 ${g.rank ? `주 작용기이면 접미사 <code>${esc(g.suffix[0])}</code>, 그렇지 않으면 접두사 <code>${esc(g.prefix[0])}</code>` : `항상 접두사 <code>${esc(g.prefix[0])}</code>`} → <span class="mono">${tokensHTML(getLang() === 'ko' ? e.res.ko : e.res.en)}</span></p>`
    };
  }
  return null;
}
const FG_POOL = ['COOH', 'COOCH3', 'CONH2', 'CN', 'CHO', 'oxo', 'COCH3', 'OH', 'OH', 'NH2', 'NH2', 'COCl'];
const PRIORITY = 'acid ester acylhalide amide nitrile aldehyde ketone alcohol amine'.split(' ');
function principalQ() {
  for (let t = 0; t < 300; t++) {
    let m = fromSmiles(pick([...CHAINS.slice(1), 'C1CCCCC1', 'c1ccccc1', 'C=CC']));
    const k = 2 + (Math.random() < 0.4 ? 1 : 0);
    for (let j = 0; j < k; j++) {
      const at = m.atoms.map((a, i) => i).filter(i => m.atoms[i].h > 0 && m.atoms[i].el === 'C');
      if (!at.length) break;
      const r = attach(m, pick(at), pick(FG_POOL)); if (r.mol) m = r.mol;
    }
    const e = entry(m);
    if (!ok(e) || !e.res.P) continue;
    const present = [...(e.res.present || [])].filter(c => CLASS[c]);
    if (present.length < 2) continue;
    const fill = shuffle(PRIORITY.filter(c => !present.includes(c)));
    const keys = [...present, ...fill].slice(0, 4);
    const P = e.res.P;
    return {
      kind: 'principal', e, mol3d: e, answer: P, open: buildOpen(e),
      prompt: '이 화합물의 주 작용기(접미사로 표시되는 작용기)는?',
      pic: done => drawMolecule(e.mol, e.res, { mode: mode(), locants: done, chain: done, compact: true }),
      opts: shuffle(keys.map(c => ({ key: c, label: esc(CLASS[c].ko), sub: CLASS[c].fg }))),
      verdict: () => `<b>${esc(CLASS[P].ko)}</b> · <span class="mono">${tokensHTML(getLang() === 'ko' ? e.res.ko : e.res.en)}</span>`,
      why: () => `<p class="note">포함된 작용기: ${present.map(c => CLASS[c].ko).join(' · ')}. 우선순위 ${PRIORITY.map(c => c === P ? `<b>${CLASS[c].ko}</b>` : CLASS[c].ko).join(' &gt; ')} 에서 가장 높은 <b>${CLASS[P].ko}</b> 가 주 작용기로서 접미사가 되고, 나머지는 접두사로 나타냅니다.</p>`
    };
  }
  return null;
}
const PREFIXES = g => g.prefix[0].split(/\s*\/\s*|\s+/).filter(x => /^[a-z]+-$/.test(x));
function affixQ() {
  const RANKED = GROUP_INFO.filter(g => g.rank);
  const v = pick(['suffix', 'suffix', 'prefix', 'reverse', 'ring']);
  /* 고리 이름 끝: 접미사로 붙는 것만 (알코올 · 아민 · 케톤은 고리에서 다른 방식) */
  const pool = v === 'suffix' ? RANKED : v === 'ring' ? RANKED.filter(g => /^-|carboxylate/.test(g.ring[0])) : GROUP_INFO.filter(g => g.id !== 'alkyl');
  let g = pick(pool), shown = '';
  if (v === 'reverse') {
    /* 다른 작용기와 겹치지 않는 접두사 하나 (oxo- 는 알데하이드 · 케톤 둘 다라 빼기) */
    const own = x => PREFIXES(x).filter(pf => !pool.some(y => y !== x && PREFIXES(y).includes(pf)));
    const cand = pool.filter(x => own(x).length);
    g = pick(cand); shown = pick(own(g));
  }
  const others = shuffle(pool.filter(x => x !== g)).slice(0, 3);
  const field = v === 'suffix' ? 'suffix' : v === 'ring' ? 'ring' : 'prefix';
  const txt = x => x[field][0];
  const prompt = v === 'suffix' ? `${g.ko}(${g.fg})가 주 작용기일 때 사슬 화합물의 접미사는?`
    : v === 'ring' ? `${g.ko}(${g.fg})가 고리에 결합한 주 작용기일 때의 접미사는?`
      : v === 'prefix' ? `${g.ko}(${g.fg})의 접두사 형태는?`
        : `접두사 ‘${shown}’ 가 나타내는 작용기는?`;
  const opts = shuffle([g, ...others].map(x => v === 'reverse' ? { key: x.id, label: esc(x.ko), sub: x.fg } : { key: x.id, label: esc(txt(x)), sub: '' }));
  const ex = entry(fromSmiles(g.demo));
  return {
    kind: 'affix', e: ex, mol3d: ex, answer: g.id, open: ['groups', { sub: g.id }], prompt, pic: null, opts, mono: v !== 'reverse',
    verdict: () => `<b>${esc(v === 'reverse' ? g.ko : txt(g))}</b> · ${esc(g.ko)}`,
    why: () => `<p class="note">${esc(g.ko)}: 사슬 접미사 <code>${esc(g.suffix[0])}</code> · 고리 <code>${esc(g.ring[0])}</code> · 접두사 <code>${esc(g.prefix[0])}</code>. 예: <span class="mono">${ex.res ? tokensHTML(getLang() === 'ko' ? ex.res.ko : ex.res.en) : ''}</span></p>`
  };
}

export function mount(root, app, params) {
  /* 옛 설정(방식 네 가지) → 분야 */
  const oldMode = store.get('quizMode', 'name');
  const S = {
    area: store.get('quizArea', oldMode === 'react' ? 'react' : oldMode === 'rs' ? 'stereo' : 'name'),
    topic: store.get('quizTopic', {}), dir: store.get('quizDir', oldMode === 'struct' ? 'struct' : 'name'), level: store.get('quizLevel', 'easy'), rx: store.get('quizRx', 'prod'),
    score: store.get('quizScore2', { right: 0, total: 0, streak: 0, best: 0 }), stats: store.get('quizStats', {}), q: null, done: false, chosen: null
  };
  if (params && params.mode) { S.area = { react: 'react', rs: 'stereo', name: 'name', struct: 'name' }[params.mode] || S.area; if (params.mode === 'struct') S.dir = 'struct'; }
  if (params && params.cat && S.area === 'react') S.topic.react = params.cat;
  const areaOf = () => AREAS.find(a => a.id === S.area) || AREAS[0];
  const topicOf = () => { const a = areaOf(); const t = S.topic[a.id]; return a.topics.some(x => x.id === t) ? t : a.topics[0].id; };
  const key = () => S.area + ':' + topicOf();

  root.innerHTML = `<section class="page"><div class="quiz">
    <p class="eyebrow"><span class="bar"></span>05 — PRACTICE</p>
    <h1 class="title">PRACTICE<small>연습 문제</small></h1>
    <div class="q-areas" role="tablist" aria-label="분야">${AREAS.map(a => `<button type="button" role="tab" data-area="${a.id}">${a.ko}</button>`).join('')}</div>
    <details class="q-topics-box"${innerWidth >= 700 ? ' open' : ''}><summary><span class="lbl">주제</span><b class="q-cur"></b><small>바꾸기</small></summary><div class="q-topics" role="radiogroup" aria-label="주제"></div></details>
    <div class="q-bar">
      <div class="q-sets">
        <div class="seg" role="group" aria-label="문제 방식" data-for="name"><button type="button" data-dir="name">구조 → 이름</button><button type="button" data-dir="struct">이름 → 구조</button></div>
        <div class="seg" role="group" aria-label="난이도" data-for="name"><button type="button" data-level="easy">치환기 1–2개</button><button type="button" data-level="hard">2–4개</button></div>
        <div class="seg" role="group" aria-label="반응 문제" data-for="react"><button type="button" data-rx="prod">생성물 예측</button><button type="button" data-rx="reagent">시약 선택</button></div>
      </div>
      <p class="score" aria-live="polite"></p>
    </div>
    <div class="q-card panel ticks"></div>
  </div></section>`;
  const card = root.querySelector('.q-card');

  function paintBar() {
    const a = areaOf(), t = topicOf();
    root.querySelectorAll('[data-area]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.area === a.id)));
    root.querySelector('.q-topics').innerHTML = a.topics.map(x => {
      const st = S.stats[a.id + ':' + x.id];
      return `<button type="button" role="radio" data-topic="${x.id}" aria-checked="${x.id === t}"><b>${esc(x.ko)}</b><small>${esc(x.sub || '')}</small>${st && st.t ? `<span class="q-st">${st.r}/${st.t}</span>` : ''}</button>`;
    }).join('');
    root.querySelector('.q-cur').textContent = (a.topics.find(x => x.id === t) || {}).ko || '';
    root.querySelectorAll('.q-sets [data-for]').forEach(s => { s.hidden = s.dataset.for !== a.id; });
    root.querySelectorAll('[data-dir]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.dir === S.dir)));
    root.querySelectorAll('[data-level]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.level === S.level)));
    root.querySelectorAll('[data-rx]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rx === S.rx)));
    const s = S.score, st = S.stats[key()] || { r: 0, t: 0 };
    root.querySelector('.score').innerHTML = `<span>이 주제 <b>${st.r}</b> / ${st.t}</span><span>연속 <b>${s.streak}</b></span><span>최고 <b>${s.best}</b></span>`;
  }
  const nameOf = e => getLang() === 'ko' ? e.res.nameKo : e.res.nameEn;
  const small = e => drawMolecule(e.mol, e.res, { mode: mode(), locants: false, chain: false, compact: true });

  function makeQ() {
    const a = S.area, t = topicOf();
    if (a === 'name') return nameQ(t, S.level, S.dir);
    if (a === 'react') return S.rx === 'reagent' ? reagentQ(t) : reactQ(t);
    if (a === 'stereo') {
      const k = t === 'mix' ? pick(['rs1', 'rsN', 'cip', 'ct', 'ez', 'meso']) : t;
      return { rs1: () => rsQ('easy'), rsN: () => rsQ('hard'), cip: () => cipQ(Math.random() < 0.6 ? 'easy' : 'hard'), ct: ctQ, ez: ezQ, meso: mesoQ }[k]();
    }
    const k = t === 'mix' ? pick(['identify', 'principal', 'affix']) : t;
    return { identify: identifyQ, principal: principalQ, affix: affixQ }[k]();
  }
  function next() {
    S.done = false; S.chosen = null;
    let q = null;
    for (let i = 0; i < 3 && !q; i++) q = makeQ();
    if (!q) { card.innerHTML = '<p>문제를 생성하지 못했습니다. 다시 시도하세요.</p><div class="q-actions"><button class="btn solid" type="button" id="q-next">다시</button></div>'; card.querySelector('#q-next').addEventListener('click', next); return; }
    if (q.answer !== undefined && !q.correct) q.correct = q.opts.find(o => o.key === q.answer);
    S.q = q;
    if (q.mol3d && q.mol3d.res) app.setMol(q.mol3d);
    draw();
  }
  const actions = () => `<div class="q-actions"><button class="btn solid" type="button" id="q-next">다음 문제</button><button class="btn" type="button" id="q-open">${S.q.open[0] === 'react' ? '반응 예측에서 열기' : S.q.open[0] === 'groups' ? '작용기 페이지에서 보기' : '편집기에서 열기'}</button></div>`;
  function wire() {
    card.querySelectorAll('.q-opt').forEach(b => b.addEventListener('click', () => answer(S.q.opts[+b.dataset.i])));
    if (S.done) {
      card.querySelector('#q-next').addEventListener('click', next);
      card.querySelector('#q-open').addEventListener('click', () => app.go(...S.q.open));
      card.querySelector('#q-next').focus({ preventScroll: true });
    }
  }
  /* 글자 보기 문제 (입체 · 작용기 · 시약) */
  function drawText() {
    const q = S.q, chosen = S.chosen, done = S.done;
    let head = `<p class="q-prompt">${q.prompt}</p>`;
    if (q.kind === 'reagent') head += `<div class="q-rx">${small(q.sub)}<div class="rx-arrow"><span class="rx-reagent">?</span><svg viewBox="0 0 120 16" aria-hidden="true"><path d="M2 8h112M104 2l10 6-10 6"/></svg></div>${small(q.prod)}</div>`;
    else if (q.pic) head += `<div class="q-struct">${q.pic(done)}</div>`;
    const big = ['rs', 'ct', 'ez', 'meso'].includes(q.kind);
    const opts = q.opts.map((o, i) => {
      const cls = !done ? '' : o === q.correct ? ' right' : o === chosen ? ' wrong' : '';
      if (q.kind === 'reagent') {
        const R = REACTIONS.find(r => r.id === o.key);
        const after = done ? `<small class="q-after">${o === q.correct ? '→ 이 생성물' : o.none ? '→ 반응하지 않음' : o.prod ? '→ ' + esc(nameOf({ res: o.prod.name })) : ''}</small>` : '';
        return `<button class="q-opt txt${cls}" type="button" data-i="${i}" ${done ? 'disabled' : ''}><span class="k">${i + 1}</span><b>${R.label}</b><small>${esc(R.note)}</small>${after}</button>`;
      }
      return `<button class="q-opt ${big ? 'rs' : 'txt'}${q.mono ? ' mono' : ''}${cls}" type="button" data-i="${i}" ${done ? 'disabled' : ''}><span class="k">${i + 1}</span><b>${o.label}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</button>`;
    }).join('');
    let fb = '';
    if (done) {
      const right = chosen === q.correct;
      let verdict, why;
      if (q.kind === 'reagent') {
        const R = REACTIONS.find(r => r.id === q.rid);
        verdict = `<b>${R.label}</b> · ${esc(R.note)} → ${esc(q.prod.res.nameEn)}`;
        why = `<p class="note">${esc(q.res.mech || '')}</p><ol class="steps" style="padding:0">${(q.res.steps || []).map(s => `<li><div><span class="sk">${esc(s.t)}</span>${s.d}</div></li>`).join('')}</ol>${q.res.select && q.res.select.length ? `<ul class="sel">${q.res.select.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}`;
      } else { verdict = q.verdict(); why = q.why(); }
      fb = `<div class="q-feedback"><p class="q-verdict ${right ? 'ok' : 'no'}"><b>${right ? '정답' : '오답'}</b> — ${verdict}</p>${why}${actions()}</div>`;
    }
    card.innerHTML = head + `<div class="q-opts${q.opts.length === 2 ? ' two' : ''}">${opts}</div>` + fb;
    wire();
  }
  /* 그림 보기 문제 (이름 짓기 · 반응 생성물) */
  function drawPic() {
    const q = S.q, keys = ['A', 'B', 'C', 'D'], chosen = S.chosen, done = S.done;
    let head;
    if (q.kind === 'react') head = `<p class="q-prompt">주생성물은?</p><div class="q-rx">${small(q.sub)}<div class="rx-arrow"><span class="rx-reagent">${q.res.reaction.label}</span><svg viewBox="0 0 120 16" aria-hidden="true"><path d="M2 8h112M104 2l10 6-10 6"/></svg></div><span class="q-what">?</span></div>`;
    else if (q.kind === 'name') head = `<p class="q-prompt">이 분자의 IUPAC 이름은?</p><div class="q-struct">${small(q.e)}</div>`;
    else head = `<p class="q-prompt">이 이름에 해당하는 구조는?</p><p class="q-name">${tokensHTML(getLang() === 'ko' ? q.e.res.ko : q.e.res.en)}</p>`;
    const opts = q.opts.map((o, i) => {
      const cls = !done ? '' : o === q.correct ? ' right' : o === chosen ? ' wrong' : '';
      const cap = done ? `<span class="q-cap">${esc(nameOf(o.e))}${o.same ? ' (반응 없음)' : ''}</span>` : '';
      return q.kind === 'name'
        ? `<button class="q-opt${cls}" type="button" data-i="${i}" ${done ? 'disabled' : ''}><span class="k">${keys[i]}</span>${esc(nameOf(o.e))}</button>`
        : `<button class="q-opt pic${cls}" type="button" data-i="${i}" ${done ? 'disabled' : ''} aria-label="보기 ${keys[i]}"><span class="k">${keys[i]}</span>${small(o.e)}${cap}</button>`;
    }).join('');
    let fb = '';
    if (done) {
      const right = chosen === q.correct;
      const verdict = `<p class="q-verdict ${right ? 'ok' : 'no'}"><b>${right ? '정답' : '오답'}</b> — ${esc(q.correct.e.res.nameEn)} · ${esc(q.correct.e.res.nameKo)}</p>`;
      if (q.kind === 'react') {
        const r = q.res;
        fb = `<div class="q-feedback">${verdict}<p class="note">${esc(r.mech || '')}</p>
          <ol class="steps" style="padding:0">${(r.steps || []).map(s => `<li><div><span class="sk">${esc(s.t)}</span>${s.d}</div></li>`).join('')}</ol>
          ${r.select && r.select.length ? `<ul class="sel">${r.select.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}${actions()}</div>`;
      } else {
        const st = steps(q.e.mol, q.e.res);
        fb = `<div class="q-feedback">${verdict}
          ${!right && chosen ? `<p class="note">선택한 보기는 ${esc(chosen.e.res.nameEn)} 로, 작용기의 위치 또는 종류가 다른 화합물입니다.</p>` : ''}
          <ol class="steps" style="padding:0">${st.map(s => `<li><div><span class="sk">${s.k}</span>${s.t}</div></li>`).join('')}</ol>${actions()}</div>`;
      }
    }
    card.innerHTML = head + `<div class="q-opts">${opts}</div>` + fb;
    wire();
  }
  function draw() { if (['name', 'struct', 'react'].includes(S.q.kind)) drawPic(); else drawText(); }
  function answer(o) {
    if (S.done) return;
    S.done = true; S.chosen = o;
    const s = S.score, right = o === S.q.correct;
    s.total++;
    if (right) { s.right++; s.streak++; s.best = Math.max(s.best, s.streak); } else s.streak = 0;
    const st = S.stats[key()] || (S.stats[key()] = { r: 0, t: 0 });
    st.t++; if (right) st.r++;
    store.set('quizScore2', s); store.set('quizStats', S.stats);
    if (S.q.kind === 'react') app.setMol(S.q.correct.e);
    paintBar(); draw();
  }
  root.addEventListener('click', e => {
    const a = e.target.closest('[data-area]');
    if (a) { S.area = a.dataset.area; store.set('quizArea', S.area); paintBar(); next(); return; }
    const t = e.target.closest('[data-topic]');
    if (t) { S.topic[S.area] = t.dataset.topic; store.set('quizTopic', S.topic); if (innerWidth < 700) root.querySelector('.q-topics-box').open = false; paintBar(); next(); return; }
    const d = e.target.closest('[data-dir]');
    if (d) { S.dir = d.dataset.dir; store.set('quizDir', S.dir); paintBar(); next(); return; }
    const l = e.target.closest('[data-level]');
    if (l) { S.level = l.dataset.level; store.set('quizLevel', S.level); paintBar(); next(); return; }
    const r = e.target.closest('[data-rx]');
    if (r) { S.rx = r.dataset.rx; store.set('quizRx', S.rx); paintBar(); next(); }
  });
  const off = onLang(() => draw());
  paintBar(); next();
  return {
    unmount() { off(); },
    report: () => {
      const q = S.q; if (!q) return { '퀴즈': key() };
      const e = q.e || q.sub;
      const pickedName = o => o.e && o.e.res ? o.e.res.nameEn : o.key || '';
      return { '퀴즈': `${key()} · ${S.area === 'name' ? S.dir + ' · ' + S.level : S.area === 'react' ? S.rx : ''}`, '문제 분자 SMILES': e && e.mol ? toSmiles(e.mol) : '', '정답': q.answer || (q.correct && pickedName(q.correct)) || '', '고른 답': S.chosen ? pickedName(S.chosen) : '(아직)' };
    }
  };
}
