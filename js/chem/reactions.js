/* 반응 목록과 예측 규칙. 각 반응: 기질에서 반응 자리를 찾고 생성물 그래프를 만든 뒤, 풀이 · 선택성 · 최신 관점을 붙인다 */
import { clone, parseSmiles, addBond, bondBetween, rings, isBenzene, subMol } from './core.js';
import { layout } from './layout.js';
import { nameMolecule } from './name.js';
import {
  work, graft, setBond, cut, finish, carbonNbrs, classOf, cationScore, shiftFor, applyShift, alkeneDegree, scan, product, none, rolesByKey,
  NUCS, substitute, eliminate, betas
} from './react.js';

const CLS = ['메틸', '1차', '2차', '3차', '4차'];
const b = s => `<b>${s}</b>`, code = s => `<code>${s}</code>`;

/* ── 공통: 양이온 경로 (SN1 · E1 · HX 첨가 · 수화) ─────────── */
/* prep(m): 이탈기를 떼거나 H 를 붙여 c 를 양이온 중심으로 만든다. nuc: 붙일 조각, e1: 제거도 */
function viaCation(mol, prep, c, nuc, opts = {}) {
  const out = [];
  const m0 = work(mol); prep(m0);
  const sh = opts.noShift ? null : shiftFor(m0, c);
  const cat = work(mol); prep(cat); cat.atoms[c].q = 1;
  const inter = [{ mol: finish(cat)[0], label: `${CLS[classOf(m0, c)] || ''} 탄소 양이온` }];
  let center = c;
  if (sh) {
    const r = work(mol); prep(r); applyShift(r, c, sh); r.atoms[sh.to].q = 1;
    inter.push({ mol: finish(r)[0], label: `${sh.kind === 'H' ? '1,2-수소화 이동' : '1,2-메틸 이동'} → 더 안정한 양이온` });
    center = sh.to;
  }
  const build = (useShift) => {
    const m = work(mol); prep(m);
    let z = c;
    if (useShift && sh) { applyShift(m, c, sh); z = sh.to; }
    return { m, z };
  };
  if (nuc) {
    const { m, z } = build(true);
    graft(m, z, nuc, 1, false);
    out.push(product(finish(m)[0], 'major', { tag: sh ? '자리옮김 생성물' : 'SN1' }));
    if (sh) { const u = build(false); graft(u.m, u.z, nuc, 1, false); out.push(product(finish(u.m)[0], 'minor', { tag: '자리옮김 전 생성물' })); }
  }
  if (opts.e1) {
    const { m: base, z } = build(true);
    const alk = [];
    for (const bt of carbonNbrs(base, z)) {
      if (base.atoms[bt].h < 1 || base.nb[bt].some(n => n.o > 1)) continue;
      for (const rel of ['trans', 'cis']) {
        const m = work(mol); prep(m);
        let zz = c; if (sh) { applyShift(m, c, sh); zz = sh.to; }
        m.atoms[bt].h -= 1;
        setBond(m, zz, bt, 2);
        const p = carbonNbrs(m, zz, bt)[0], q = carbonNbrs(m, bt, zz)[0];
        const extra = p !== undefined && q !== undefined ? [{ x: p, a: zz, b: bt, y: q, rel }] : [];
        alk.push({ mol: finish(m, extra)[0], deg: alkeneDegree(m, zz, bt), rel });
      }
    }
    rankAlkenes(alk, false).forEach((x, i) => out.push(product(x.mol, opts.nucMajor ? 'minor' : (i === 0 ? (nuc ? 'minor' : 'major') : 'minor'), { tag: 'E1' })));
  }
  return { products: out, inter, shift: sh, center };
}
/* 알켄 순위: 자이체프(치환 많은 쪽) 또는 호프만, 같은 치환도면 E 가 먼저 */
function rankAlkenes(list, hofmann) {
  const named = list.map(x => { let n = ''; try { n = nameMolecule(x.mol, { noNotes: true, noCompare: true }).nameEn; } catch { n = ''; } return { ...x, name: n }; });
  const seen = new Set(), uniq = [];
  for (const x of named) { if (seen.has(x.name)) continue; seen.add(x.name); uniq.push(x); }
  uniq.sort((p, q) => (hofmann ? p.deg - q.deg : q.deg - p.deg) || (/\(Z\)|\dZ/.test(p.name) - /\(Z\)|\dZ/.test(q.name)));
  return uniq;
}
function e2Products(mol, c, x, hofmann) {
  const alk = [];
  for (const bt of betas(mol, c)) for (const rel of ['trans', 'cis']) alk.push({ mol: eliminate(mol, c, x, bt, rel), deg: alkeneDegree(mol, c, bt) });
  return rankAlkenes(alk, hofmann);
}

/* ── 할로젠화 알킬 ─────────────────────────────── */
function snE(key) {
  return (mol, S) => {
    if (!S.halides.length) return none('sp³ 탄소에 붙은 Cl · Br · I (할로젠화 알킬)가 없습니다. 벤젠 · 이중결합 탄소의 할로젠은 SN · E 가 일어나지 않습니다.');
    const h = S.halides[0], N = NUCS[key];
    const { c, x, cls } = h;
    const stab = h.allylic || h.benzylic;
    const hasBeta = betas(mol, c).length > 0;
    const res = { products: [], steps: [], select: [], modern: [] };
    const X = mol.atoms[x].el;
    const kindTxt = `${CLS[cls]}${stab ? (h.benzylic ? ' · 벤질' : ' · 알릴') : ''} 할로젠화 알킬`;
    const add = (list, role) => list.forEach((p, i) => res.products.push(product(p.mol || p, i === 0 ? role : 'minor', { tag: p.tag })));
    let path;
    if (key === 'tBuOK') path = hasBeta ? 'E2h' : 'SN2';
    else if (N.nuc === 'weak') {
      if (cls === 3 || (cls >= 1 && stab) || cls === 2) path = 'SN1';
      else return none(`${kindTxt}은(는) 약한 친핵체와 거의 반응하지 않습니다. 양이온이 너무 불안정해서 SN1 이 안 되고, 친핵체가 약해 SN2 도 매우 느립니다.`, { mech: '반응 없음' });
    } else if (N.base === 'strong') path = cls <= 1 ? 'SN2' : cls === 2 ? (hasBeta ? 'E2+SN2' : 'SN2') : 'E2';
    else {
      if (cls <= 2) path = 'SN2';
      else if (key === 'NaCN') path = 'E2';
      else return none(`3차 할로젠화 알킬은 뒤쪽이 막혀 SN2 가 불가능하고, ${N.ko.split(' (')[0]}은(는) 염기가 약해 E2 도 거의 없습니다.`, { mech: '반응 없음' });
    }
    if (path === 'SN2') {
      res.mech = 'SN2';
      res.products.push(product(substitute(mol, c, x, N.frag), 'major', { tag: 'SN2' }));
      res.steps = [
        { t: '뒤쪽 공격', d: `친핵체가 C–${X} 결합의 ${b('반대편')}에서 탄소를 공격하고, 동시에 ${X}⁻ 가 떨어져 나갑니다 (한 단계, 협동).` },
        { t: '속도', d: `속도 = k[기질][친핵체] (2차). ${cls === 0 ? '메틸' : cls === 1 ? '1차' : '2차'} 탄소라 입체 장애가 ${cls <= 1 ? '작아 빠릅니다' : '조금 있어 느린 편입니다'}.${N.solvent === 'aprotic' ? ' 극성 비양성자성 용매(아세톤 · DMSO)는 친핵체를 덜 감싸 SN2 를 빠르게 합니다.' : ''}` }
      ];
      res.select.push('입체: 탄소가 입체중심이면 배열이 뒤집힙니다 (월든 반전).');
      res.modern.push({ y: '2008', t: '기체 상태 SN2 를 분자빔으로 직접 관찰한 실험에서, 교과서의 "뒤쪽 공격" 외에 친핵체가 탄소 주위를 한 바퀴 도는 "라운드어바웃" 경로도 발견되었습니다 (Mikosch 외, Science 2008).' });
    } else if (path === 'E2' || path === 'E2h' || path === 'E2+SN2') {
      const hof = path === 'E2h';
      res.mech = path === 'E2+SN2' ? 'E2 (주) + SN2 (부)' : 'E2';
      const alk = e2Products(mol, c, x, hof);
      alk.forEach((p, i) => res.products.push(product(p.mol, i === 0 ? 'major' : 'minor', { tag: 'E2' })));
      if (path === 'E2+SN2') res.products.push(product(substitute(mol, c, x, N.frag), 'minor', { tag: 'SN2' }));
      res.steps = [
        { t: '한 단계 제거', d: `염기가 β 탄소의 H 를 떼는 동시에 C–${X} 가 끊기며 C=C 가 생깁니다. H 와 ${X} 는 ${b('안티 평면')}(서로 180°)이어야 합니다.` },
        { t: hof ? '호프만 규칙' : '자이체프 규칙', d: hof ? '부피 큰 염기(tert-뷰톡사이드)는 가려지지 않은 바깥쪽 H 를 떼어 치환이 적은 알켄이 주생성물이 됩니다.' : '더 많이 치환된(안정한) 알켄이 주생성물입니다. 같은 알켄이면 E(트랜스)가 Z 보다 많습니다.' }
      ];
      if (path === 'E2+SN2') res.select.push('2차 기질 + 강한 염기(OH⁻ · RO⁻): 제거가 우세하고 치환은 적게 섞입니다. 온도를 올리면 제거가 더 늘어납니다.');
      if (cls === 2 && key !== 'tBuOK') res.modern.push({ y: '현대', t: '2차 기질에서 SN2 · E2 비율은 염기의 세기뿐 아니라 용매와 온도에 크게 좌우됩니다. 계산화학은 두 전이 상태의 에너지 차가 대개 수 kJ/mol 수준이라 조건에 민감하다는 것을 보여 줍니다.' });
    } else {
      /* SN1 + E1 */
      res.mech = 'SN1 (주) + E1 (부)';
      const prep = m => { m.atoms[x].dead = true; bondBetween(m, c, x).dead = true; };
      const v = viaCation(mol, prep, c, N.frag, { e1: hasBeta });
      res.products.push(...v.products);
      res.steps = [
        { t: '이온화 (느린 단계)', d: `C–${X} 가 먼저 끊어져 ${b('탄소 양이온')}이 생깁니다. 속도 = k[기질] (1차) — 친핵체 세기와 무관.`, mol: v.inter[0].mol },
        ...(v.shift ? [{ t: '자리옮김', d: `이웃 탄소의 ${v.shift.kind === 'H' ? 'H' : 'CH₃'} 가 전자쌍과 함께 옮겨 와 더 안정한 ${CLS[Math.min(3, Math.round(v.shift.score / 10))] || ''} 양이온이 됩니다.`, mol: v.inter[1].mol }] : []),
        { t: '친핵체 결합 / H 제거', d: `물 · 알코올이 평평한 양이온의 ${b('양쪽')}에서 붙거나(SN1), 옆 탄소의 H 를 잃고 알켄이 됩니다(E1). 가열하면 E1 이 늘어납니다.` }
      ];
      res.select.push('입체: 평면 양이온의 양쪽에서 공격 → 입체중심이면 라세미 혼합물 (실제로는 이온쌍 때문에 반전이 조금 더 많음).');
      if (cls === 2 && !stab) res.modern.push({ y: '현대', t: '교과서 표와 달리 단순한 2차 기질의 가용매 분해는 순수한 SN1 이 아니라 용매가 뒤쪽에서 돕는(SN2 성격이 섞인) 경계 메커니즘인 경우가 많습니다.' });
      res.modern.push({ y: '2013', t: '오랜 논쟁이던 2-노보닐 양이온이 "비고전적(가교된) 양이온"이라는 것이 X선 결정 구조로 확인되었습니다 (Scholz 외, Science 2013).' });
    }
    if (S.halides.length > 1) res.select.push('할로젠이 여러 개면 여기서는 첫 번째 자리만 보여 줍니다.');
    res.sites = [c, x];
    return res;
  };
}

/* ── 알코올 ──────────────────────────────────── */
function alcoholToHalide(reagent) {
  return (mol, S) => {
    if (!S.alcohols.length) return none('sp³ 탄소에 붙은 –OH (알코올)가 없습니다. 페놀의 OH 는 C–O 가 끊기지 않습니다.');
    const al = S.alcohols[0], { c, o, cls } = al;
    const X = reagent === 'SOCl2' ? 'Cl' : 'Br';
    const res = { products: [], steps: [], select: [], modern: [], sites: [c, o] };
    if (reagent !== 'HBr' && cls === 3) return none(`3차 알코올은 ${reagent === 'SOCl2' ? 'SOCl₂' : 'PBr₃'} 로 잘 바뀌지 않습니다 (SN2 불가). HBr · HCl 을 쓰면 SN1 로 바뀝니다.`, { mech: '반응 없음' });
    if (reagent === 'HBr' && (cls >= 2 || S.alcohols[0] && cationScore(mol, c) > 20)) {
      const prep = m => { m.atoms[o].dead = true; bondBetween(m, c, o).dead = true; };
      const v = viaCation(mol, prep, c, 'Br');
      res.mech = 'SN1';
      res.products.push(...v.products);
      res.steps = [
        { t: '양성자 첨가', d: 'OH 에 H⁺ 가 붙어 좋은 이탈기(H₂O)가 됩니다.' },
        { t: '물이 떨어짐', d: `물이 떨어지며 ${CLS[cls]} 탄소 양이온.`, mol: v.inter[0].mol },
        ...(v.shift ? [{ t: '자리옮김', d: '더 안정한 양이온으로 1,2-이동.', mol: v.inter[1].mol }] : []),
        { t: 'Br⁻ 결합', d: '브로민화 이온이 양이온에 붙습니다.' }
      ];
    } else {
      res.mech = 'SN2';
      res.products.push(product(substitute(mol, c, o, X), 'major', { tag: 'SN2' }));
      res.steps = reagent === 'HBr'
        ? [{ t: '양성자 첨가', d: 'OH 에 H⁺ 가 붙어 –OH₂⁺ (좋은 이탈기).' }, { t: '뒤쪽 공격', d: '1차 탄소라 양이온 대신 Br⁻ 가 뒤쪽에서 밀어내는 SN2.' }]
        : [{ t: 'OH 활성화', d: reagent === 'SOCl2' ? 'O 가 SOCl₂ 의 S 를 공격해 클로로설파이트(좋은 이탈기)가 됩니다.' : 'O 가 PBr₃ 의 P 를 공격해 O–PBr₂ (좋은 이탈기)가 됩니다.' },
          { t: '뒤쪽 공격', d: `${X}⁻ 가 뒤쪽에서 공격 (SN2). 양이온을 거치지 않으므로 ${b('자리옮김이 없습니다')}.` }];
      res.select.push('입체: 입체중심이면 반전.');
    }
    return res;
  };
}
function dehydrate(mol, S) {
  if (!S.alcohols.length) return none('sp³ 탄소에 붙은 –OH (알코올)가 없습니다.');
  const al = S.alcohols[0], { c, o, cls } = al;
  if (!betas(mol, c).length) return none('OH 탄소 옆에 H 를 가진 탄소(β-H)가 없어 알켄이 생길 수 없습니다.');
  const res = { products: [], steps: [], select: [], modern: [], sites: [c, o] };
  if (cls >= 2) {
    const prep = m => { m.atoms[o].dead = true; bondBetween(m, c, o).dead = true; };
    const v = viaCation(mol, prep, c, null, { e1: true });
    res.mech = 'E1';
    res.products.push(...v.products);
    res.steps = [
      { t: '양성자 첨가', d: 'OH → –OH₂⁺.' },
      { t: '물이 떨어짐 (느린 단계)', d: `${CLS[cls]} 탄소 양이온.`, mol: v.inter[0].mol },
      ...(v.shift ? [{ t: '자리옮김', d: '더 안정한 양이온으로.', mol: v.inter[1].mol }] : []),
      { t: 'H 제거', d: '물(또는 HSO₄⁻)이 옆 H 를 떼어 C=C. 자이체프: 더 치환된 알켄이 주생성물.' }
    ];
  } else {
    res.mech = 'E2';
    const alk = [];
    for (const bt of betas(mol, c)) for (const rel of ['trans', 'cis']) alk.push({ mol: eliminate(mol, c, o, bt, rel), deg: alkeneDegree(mol, c, bt) });
    rankAlkenes(alk, false).forEach((p, i) => res.products.push(product(p.mol, i === 0 ? 'major' : 'minor', { tag: 'E2' })));
    res.steps = [{ t: '양성자 첨가', d: 'OH → –OH₂⁺.' }, { t: '한 단계 제거', d: '1차 양이온은 너무 불안정해 E2 로 H 와 H₂O 가 함께 빠집니다.' }];
  }
  res.select.push('가열 · 진한 H₂SO₄ 조건. 온도가 낮으면 에터가 생기기도 합니다.');
  return res;
}
function oxidize(strong) {
  return (mol, S) => {
    const alc = S.alcohols.filter(a => a.cls <= 2 && mol.atoms[a.c].h > 0);
    const ald = strong ? S.carbonyls.filter(x => x.kind === 'aldehyde') : [];
    if (!alc.length && !ald.length) return none(S.alcohols.length ? '3차 알코올은 OH 탄소에 H 가 없어 산화되지 않습니다.' : '산화할 1차 · 2차 알코올이 없습니다.', { mech: '반응 없음' });
    const m = work(mol);
    for (const { c, o, cls } of alc) {
      setBond(m, c, o, 2); m.atoms[o].h = 0; m.atoms[c].h -= 1;
      if (strong && cls === 1) graft(m, c, 'O');
      else if (strong && cls === 0) graft(m, c, 'O');
    }
    for (const { c } of ald) graft(m, c, 'O');
    const res = { products: [product(finish(m)[0], 'major', { tag: '산화' })], steps: [], select: [], modern: [], sites: alc.map(a => a.c) };
    res.mech = strong ? '크로뮴산 산화' : 'PCC 산화';
    res.steps = strong
      ? [{ t: '크로뮴산 에스터', d: 'OH 가 Cr(VI) 에 붙어 크로뮴산 에스터가 됩니다.' }, { t: 'C–H 제거', d: 'OH 탄소의 H 가 떨어지며 C=O. 물이 있으면 알데하이드가 수화물을 거쳐 한 번 더 산화 → 카복실산.' }]
      : [{ t: 'Cr(VI) 에스터', d: 'PCC 의 Cr 에 O 가 붙습니다.' }, { t: 'C=O 생성', d: '물이 없는 CH₂Cl₂ 에서 반응하므로 1차 알코올은 알데하이드에서 멈춥니다.' }];
    res.select.push(strong ? '1차 → 카복실산, 2차 → 케톤, 3차 → 반응 없음.' : '1차 → 알데하이드, 2차 → 케톤, 3차 → 반응 없음.');
    res.modern.push({ y: '현대', t: '6가 크로뮴은 발암성이 있어 요즘 연구실에서는 스원 산화, 데스–마틴 퍼아이오디네인(DMP), TEMPO/NaOCl 산화를 주로 씁니다. 결과(1차 → 알데하이드)는 PCC 와 같습니다.' });
    return res;
  };
}
function williamson(mol, S) {
  const sites = [...S.alcohols, ...S.phenols];
  if (!sites.length) return none('–OH 가 없습니다.');
  const m = work(mol);
  for (const { o } of sites) graft(m, o, 'C');
  return {
    products: [product(finish(m)[0], 'major', { tag: 'SN2' })], mech: '윌리엄슨 에터 합성 (SN2)', sites: sites.map(s => s.o),
    steps: [{ t: '알콕사이드', d: 'NaH 가 O–H 의 H 를 H₂ 로 떼어 강한 친핵체 RO⁻ 를 만듭니다.' }, { t: 'SN2', d: 'RO⁻ 가 CH₃I 의 탄소를 뒤쪽에서 공격해 에터.' }],
    select: ['할로젠화 알킬 쪽은 메틸 · 1차여야 합니다 (2차 · 3차면 E2 가 이김).'], modern: []
  };
}

/* ── 알켄 첨가 ────────────────────────────────── */
/* spec(m, a, b) → { A: [원자, 조각|'H'], B: [...] } 마르코브니코프 방향을 결정 */
function moreSub(m, a, b) {
  const sa = cationScore(m, a), sb = cationScore(m, b);
  return sa === sb ? null : sa > sb ? [a, b] : [b, a];
}
function addAlkene(kind) {
  return (mol, S) => {
    const sites = S.alkenes;
    if (!sites.length) return none('탄소–탄소 이중결합(알켄)이 없습니다. 벤젠 고리의 이중결합은 첨가 반응 대신 치환 반응을 합니다.');
    const res = { products: [], steps: [], select: [], modern: [], sites: sites.flatMap(s => [s.a, s.b]) };
    const one = sites.length === 1;
    const spec = SPEC[kind];
    res.mech = spec.mech;
    /* 양이온 경로 + 자리옮김은 알켄이 하나일 때만 따라간다 */
    if (spec.cation && one) {
      const { a, b: bb } = sites[0];
      const ord = moreSub(mol, a, bb) || [a, bb];
      const [hi, lo] = ord;
      const prep = m => { setBond(m, hi, lo, 1); m.atoms[lo].h += 1; };
      const v = viaCation(mol, prep, hi, spec.nuc);
      res.products.push(...v.products);
      if (!moreSub(mol, a, bb)) {
        const v2 = viaCation(mol, m => { setBond(m, hi, lo, 1); m.atoms[hi].h += 1; }, lo, spec.nuc, { noShift: true });
        res.products.push(product(v2.products[0].mol, 'major', { tag: '같은 비율' }));
        res.select.push('두 탄소의 치환 정도가 같아 두 방향 생성물이 거의 같은 양으로 생깁니다.');
      }
      res.steps = [
        { t: 'H⁺ 첨가 (느린 단계)', d: `H⁺ 가 ${b('H 가 더 많은 탄소')}에 붙어, 더 안정한 ${CLS[Math.min(3, classOf(mol, hi) + 0)]} 탄소 양이온이 생깁니다 (마르코브니코프).`, mol: v.inter[0].mol },
        ...(v.shift ? [{ t: '자리옮김', d: `${v.shift.kind === 'H' ? '1,2-수소화' : '1,2-메틸'} 이동으로 더 안정한 양이온.`, mol: v.inter[1].mol }] : []),
        { t: spec.nucStep, d: spec.nucText }
      ];
    } else {
      const m = work(mol);
      for (const { a, b: bb } of sites) {
        const ord = moreSub(mol, a, bb) || [a, bb];
        const [hi, lo] = spec.anti ? [ord[1], ord[0]] : ord;
        setBond(m, a, bb, spec.cleave ? 0 : 1);
        if (spec.cleave) { cut(m, a, bb); graft(m, a, 'O', 2, false); graft(m, bb, 'O', 2, false); continue; }
        if (spec.epoxide) { const o = graft(m, a, 'O', 1, false); addBond(m, bb, o, 1); m.atoms[o].h = 0; continue; }
        for (const [atom, f] of [[hi, spec.hi], [lo, spec.lo]]) { if (f === 'H') m.atoms[atom].h += 1; else graft(m, atom, f, 1, false); }
      }
      const prods = finish(m);
      prods.forEach((p, i) => res.products.push(product(p, 'major', { tag: spec.tag })));
      res.steps = spec.steps;
      if (!one) res.select.push(`이중결합이 ${sites.length}개 — 시약을 넉넉히 넣어 모두 반응한 결과입니다.`);
    }
    res.select.push(...spec.select);
    res.modern.push(...(spec.modern || []));
    return res;
  };
}
const SPEC = {
  HBr: { cation: true, nuc: 'Br', mech: '친전자성 첨가 (마르코브니코프)', nucStep: 'Br⁻ 결합', nucText: '브로민화 이온이 양이온 탄소에 붙습니다.', select: ['위치: Br 은 치환이 많은 탄소에 (마르코브니코프).', '입체: 평면 양이온 → 새 입체중심은 라세미.'] },
  HCl: { cation: true, nuc: 'Cl', mech: '친전자성 첨가 (마르코브니코프)', nucStep: 'Cl⁻ 결합', nucText: '염화 이온이 양이온 탄소에 붙습니다.', select: ['위치: Cl 은 치환이 많은 탄소에.'] },
  H2O: { cation: true, nuc: 'O', mech: '산 촉매 수화 (마르코브니코프)', nucStep: '물 결합 → H⁺ 이탈', nucText: '물이 양이온에 붙고 H⁺ 를 잃어 알코올이 됩니다 (H⁺ 는 촉매로 되돌아감).', select: ['위치: OH 는 치환이 많은 탄소에.', '양이온을 거치므로 자리옮김이 일어날 수 있습니다.'] },
  HBrROOR: { hi: 'H', lo: 'Br', anti: false, mech: '라디칼 첨가 (반마르코브니코프)', tag: '라디칼', steps: [{ t: '개시', d: '과산화물 RO–OR 이 빛 · 열로 끊겨 RO· 가 생기고, HBr 에서 H 를 떼어 Br· 를 만듭니다.' }, { t: 'Br· 첨가', d: `Br· 가 ${b('H 가 더 많은 탄소')}에 붙어 더 안정한(치환 많은) 탄소 라디칼이 생깁니다.` }, { t: 'H 떼기', d: '탄소 라디칼이 HBr 의 H 를 떼어 생성물 + Br· (연쇄 반응).' }], select: ['위치: Br 은 치환이 적은 탄소에 (반마르코브니코프). HBr 만 이렇게 되고 HCl · HI 는 안 됩니다.'] },
  oxymerc: { hi: 'O', lo: 'H', mech: '옥시수은화–탈수은화 (마르코브니코프)', tag: '첨가', steps: [{ t: '수은 고리 이온', d: 'Hg(OAc)₂ 가 이중결합과 3원자 고리(머큐리늄) 이온을 만듭니다 — 자유 양이온이 아니라 자리옮김이 없습니다.' }, { t: '물의 공격', d: '물이 치환이 많은 탄소를 공격해 고리를 엽니다.' }, { t: '탈수은화', d: 'NaBH₄ 가 C–Hg 를 C–H 로 바꿉니다.' }], select: ['위치: 마르코브니코프, 자리옮김 없음.'], modern: [{ y: '현대', t: '수은은 독성이 커서 요즘은 거의 쓰지 않습니다. 코발트 촉매와 실레인 · 산소를 쓰는 무카이야마 수화처럼 수은 없이 마르코브니코프 알코올을 얻는 방법이 쓰입니다.' }] },
  hydrobor: { hi: 'H', lo: 'O', mech: '수소붕소화–산화 (반마르코브니코프, syn)', tag: '첨가', steps: [{ t: '수소붕소화', d: 'B–H 가 이중결합에 한 번에(협동) 붙습니다. 부피 큰 B 는 치환이 적은 탄소에, H 는 많은 탄소에 — 같은 쪽(syn).' }, { t: '산화', d: 'H₂O₂ / NaOH 가 C–B 를 같은 자리의 C–OH 로 바꿉니다 (배열 유지).' }], select: ['위치: OH 는 치환이 적은 탄소에 (반마르코브니코프).', '입체: H 와 OH 가 같은 쪽 (syn 첨가). 자리옮김 없음.'], modern: [{ y: '현대', t: '9-BBN · 다이사이아밀보레인 같은 부피 큰 보레인은 위치 선택성을 더 높입니다. 키랄 보레인(Brown)으로 한쪽 거울상 알코올만 얻을 수도 있습니다.' }] },
  Br2: { hi: 'Br', lo: 'Br', mech: '할로젠 첨가 (anti)', tag: '첨가', steps: [{ t: '브로모늄 이온', d: 'Br₂ 가 이중결합에 다가가 3원자 고리 브로모늄 이온을 만듭니다.' }, { t: '뒤쪽 공격', d: 'Br⁻ 가 고리의 반대쪽에서 공격 → 두 Br 은 서로 반대쪽 (anti).' }], select: ['입체: anti 첨가. 고리 알켄이면 trans-1,2-다이브로모 생성물.'] },
  Cl2: { hi: 'Cl', lo: 'Cl', mech: '할로젠 첨가 (anti)', tag: '첨가', steps: [{ t: '클로로늄 이온', d: 'Cl₂ 가 3원자 고리 이온을 만듭니다.' }, { t: '뒤쪽 공격', d: 'Cl⁻ 가 반대쪽에서 공격 (anti).' }], select: ['입체: anti 첨가.'] },
  halohydrin: { hi: 'O', lo: 'Br', mech: '할로하이드린 생성', tag: '첨가', steps: [{ t: '브로모늄 이온', d: '먼저 브로모늄 고리가 생깁니다.' }, { t: '물의 공격', d: '양이 훨씬 많은 물이 Br⁻ 대신, 양전하를 더 많이 가진 치환 많은 탄소를 뒤쪽에서 공격합니다.' }], select: ['위치: OH 는 치환 많은 탄소, Br 은 적은 탄소.', '입체: anti.'] },
  H2: { hi: 'H', lo: 'H', mech: '촉매 수소화 (syn)', tag: '환원', steps: [{ t: '금속 표면', d: 'H₂ 와 알켄이 Pd 표면에 흡착합니다.' }, { t: 'H 두 개 전달', d: '같은 면에서 H 두 개가 차례로 붙습니다 (syn).' }], select: ['벤젠 고리 · C=O 는 이 조건에서 거의 환원되지 않습니다.'], modern: [{ y: '2001', t: '키랄 로듐 · 루테늄 촉매로 한쪽 거울상만 만드는 비대칭 수소화로 놀스 · 노요리가 노벨 화학상을 받았습니다 (L-DOPA 합성 등).' }] },
  epox: { epoxide: true, mech: '에폭시화 (syn, 협동)', tag: '산화', steps: [{ t: '나비 모양 전이 상태', d: 'mCPBA 의 O 하나가 이중결합 양쪽 탄소에 한 번에 붙습니다.' }], select: ['입체: 알켄의 cis/trans 배치가 에폭사이드에 그대로 남습니다.'], modern: [{ y: '2001', t: '알릴 알코올을 한쪽 거울상 에폭사이드로 바꾸는 샤플리스 비대칭 에폭시화가 노벨상(2001)을 받았고, 제이콥슨 · 시(Shi) 에폭시화로 넓어졌습니다.' }] },
  OsO4: { hi: 'O', lo: 'O', mech: '다이하이드록시화 (syn)', tag: '산화', steps: [{ t: '고리형 오스뮴산 에스터', d: 'OsO₄ 가 이중결합의 같은 면에 O 두 개로 붙습니다.' }, { t: '가수분해', d: '고리가 풀려 1,2-다이올 (두 OH 가 같은 쪽).' }], select: ['입체: syn. 고리 알켄이면 cis-다이올.'], modern: [{ y: '현대', t: 'OsO₄ 는 비싸고 독해서 소량 촉매로 쓰고 NMO 로 되살립니다 (업존 법). 샤플리스 비대칭 다이하이드록시화(AD-mix)도 널리 쓰입니다.' }] },
  ozone: { cleave: true, mech: '오존 분해', tag: '절단', steps: [{ t: '1차 오조나이드', d: 'O₃ 가 이중결합에 붙어 불안정한 고리가 생깁니다.' }, { t: '크리기 중간체', d: '고리가 쪼개졌다가 다시 붙어 오조나이드가 됩니다.' }, { t: '환원 처리', d: '(CH₃)₂S 가 오조나이드를 두 개의 C=O 로 바꿉니다.' }], select: ['C=C 가 끊어져 양쪽이 각각 C=O. H 가 있던 탄소 → 알데하이드, 없던 탄소 → 케톤.'], modern: [{ y: '2012', t: '크리기 중간체(카보닐 옥사이드)를 기체 상태에서 직접 만들어 측정하는 데 성공했고, 대기 중 SO₂ 산화 등 대기 화학에서 생각보다 중요하다는 것이 밝혀졌습니다 (Welz 외, Science 2012).' }] }
};

/* ── 알카인 ──────────────────────────────────── */
function alkyne(kind) {
  return (mol, S) => {
    const ys = S.alkynes;
    if (!ys.length) return none('탄소–탄소 삼중결합(알카인)이 없습니다.');
    const res = { products: [], steps: [], select: [], modern: [], sites: ys.flatMap(s => [s.a, s.b]) };
    const extra = [];
    const m = work(mol);
    const alts = [];
    for (const { a, b: bb } of ys) {
      const na = carbonNbrs(m, a, bb).length, nb2 = carbonNbrs(m, bb, a).length;
      if (kind === 'H2') { setBond(m, a, bb, 1); m.atoms[a].h += 2; m.atoms[bb].h += 2; }
      else if (kind === 'lindlar' || kind === 'NaNH3') {
        setBond(m, a, bb, 2); m.atoms[a].h += 1; m.atoms[bb].h += 1;
        const p = carbonNbrs(m, a, bb)[0], q = carbonNbrs(m, bb, a)[0];
        if (p !== undefined && q !== undefined) extra.push({ x: p, a, b: bb, y: q, rel: kind === 'lindlar' ? 'cis' : 'trans' });
      } else if (kind === 'hydration' || kind === 'hydrobor') {
        let [t, u] = na >= nb2 ? [a, bb] : [bb, a];
        if (kind === 'hydrobor') [t, u] = [u, t];
        setBond(m, a, bb, 1); graft(m, t, 'O', 2, false); m.atoms[u].h += 2;
        if (kind === 'hydration' && na === nb2 && na > 0) alts.push([a, bb]);
      } else if (kind === 'alkylate') {
        const term = m.atoms[a].h > 0 ? a : m.atoms[bb].h > 0 ? bb : -1;
        if (term < 0) continue;
        graft(m, term, 'C');
      } else if (kind === 'HBr2') {
        const [t, u] = na >= nb2 ? [a, bb] : [bb, a];
        setBond(m, a, bb, 1); graft(m, t, 'Br', 1, false); graft(m, t, 'Br', 1, false); m.atoms[u].h += 2;
      }
    }
    if (kind === 'alkylate' && !ys.some(s => s.terminal)) return none('말단 알카인(≡C–H)이 없어 아세틸라이드 음이온을 만들 수 없습니다.');
    res.products.push(product(finish(m, extra)[0], 'major', { tag: kind }));
    /* 비대칭 내부 알카인의 수화: 두 케톤 혼합물 */
    if (alts.length && ys.length === 1) {
      const { a, b: bb } = ys[0];
      if (carbonNbrs(mol, a, bb).length && carbonNbrs(mol, bb, a).length) {
        const m2 = work(mol); setBond(m2, a, bb, 1); graft(m2, bb, 'O', 2, false); m2.atoms[a].h += 2;
        res.products.push(product(finish(m2)[0], 'major', { tag: '혼합물' }));
        res.select.push('비대칭 내부 알카인은 두 방향의 케톤이 섞여 나옵니다.');
      }
    }
    const T = {
      H2: ['촉매 수소화 (완전)', [{ t: 'H₂ 두 번', d: '알카인 → 알켄 → 알케인. Pd/C 는 중간에 멈추지 않습니다.' }], []],
      lindlar: ['린들라 촉매 (cis 알켄)', [{ t: '독을 넣은 촉매', d: 'Pd/CaCO₃ 에 납 · 퀴놀린을 넣어 활성을 낮춘 촉매는 알켄에서 멈춥니다.' }, { t: 'syn 첨가', d: 'H 두 개가 같은 면에서 붙어 cis(Z) 알켄.' }], [{ y: '현대', t: '납을 쓰는 린들라 촉매 대신 니켈 붕소화물(P-2 Ni), 구리 · 철 촉매 반수소화처럼 독성이 적은 방법이 개발되고 있습니다.' }]],
      NaNH3: ['용해 금속 환원 (trans 알켄)', [{ t: '전자 하나씩', d: 'Na 가 전자를 하나씩 주어 라디칼 음이온 → 비닐 라디칼 → 비닐 음이온. NH₃ 가 H 를 줍니다.' }, { t: 'trans', d: '비닐 라디칼 · 음이온이 치환기끼리 멀리 떨어진 trans 모양을 취해 (E) 알켄.' }], []],
      hydration: ['수화 (마르코브니코프) → 케톤', [{ t: '엔올', d: 'Hg²⁺ 촉매로 물이 치환 많은 탄소에 붙어 엔올이 생깁니다.' }, { t: '호변 이성질', d: '엔올은 곧바로 더 안정한 케토 형태로 바뀝니다. 말단 알카인 → 메틸 케톤.' }], [{ y: '현대', t: '수은 대신 금(Au) 촉매로 알카인을 수화하는 방법이 2000년대 이후 널리 쓰입니다.' }]],
      hydrobor: ['수소붕소화–산화 → 알데하이드', [{ t: '부피 큰 보레인', d: '(sia)₂BH · 9-BBN 이 한 번만 붙어 B 는 말단 탄소에.' }, { t: '엔올 → 알데하이드', d: '산화로 생긴 엔올이 호변 이성질화 → 말단 알카인은 알데하이드.' }], []],
      alkylate: ['아세틸라이드 알킬화 (C–C 결합)', [{ t: '탈양성자', d: 'NaNH₂ (pKa 38) 가 말단 C–H (pKa 25)를 떼어 아세틸라이드 음이온.' }, { t: 'SN2', d: '아세틸라이드가 CH₃I 를 공격해 새 C–C 결합.' }], []],
      HBr2: ['HBr 2당량 첨가', [{ t: '두 번의 마르코브니코프', d: '첫 HBr 로 브로모알켄, 두 번째 HBr 도 같은 탄소에 → 제미널 다이브로마이드.' }], []]
    }[kind];
    res.mech = T[0]; res.steps = T[1]; res.modern.push(...T[2]);
    if (kind === 'lindlar') res.select.push('입체: cis (Z) 알켄.');
    if (kind === 'NaNH3') res.select.push('입체: trans (E) 알켄.');
    return res;
  };
}

/* ── 카보닐: 환원 · 그리냐르 · 비티히 ───────────── */
function reduce(reagent) {
  return (mol, S) => {
    const ok = { NaBH4: ['aldehyde', 'ketone'], LiAlH4: ['aldehyde', 'ketone', 'acid', 'ester', 'acylhalide', 'amide', 'nitrile'], DIBAL: ['ester', 'nitrile'], WK: ['aldehyde', 'ketone'] }[reagent];
    const sites = S.carbonyls.filter(x => ok.includes(x.kind));
    if (!sites.length) {
      const has = S.carbonyls.map(x => x.kind);
      return none(reagent === 'NaBH4' && has.length ? `NaBH₄ 는 약한 환원제라 ${[...new Set(has)].map(k => ({ acid: '카복실산', ester: '에스터', amide: '아마이드', nitrile: '나이트릴', acylhalide: '산 염화물' }[k] || k)).join(' · ')}은(는) 환원하지 못합니다 (LiAlH₄ 필요).` : '환원할 카보닐 작용기가 없습니다.', { mech: '반응 없음' });
    }
    const m = work(mol);
    for (const { c } of sites) m.atoms[c].key = true;
    for (const { c, kind, f } of sites) {
      const O = f.oxo[0];
      if (reagent === 'WK') { m.atoms[O].dead = true; bondBetween(m, c, O).dead = true; m.atoms[c].h += 2; continue; }
      if (kind === 'aldehyde' || kind === 'ketone') { setBond(m, c, O, 1); m.atoms[O].h = 1; m.atoms[c].h += 1; }
      else if (kind === 'acid') { m.atoms[O].dead = true; bondBetween(m, c, O).dead = true; m.atoms[c].h += 2; }
      else if (kind === 'ester') {
        const { o } = f.OR[0];
        cut(m, c, o); m.atoms[o].h += 1;
        if (reagent === 'DIBAL') m.atoms[c].h += 1;
        else { m.atoms[O].dead = true; bondBetween(m, c, O).dead = true; m.atoms[c].h += 2; graft(m, c, 'O', 1, false); }
      } else if (kind === 'acylhalide') { const x = f.halo[0]; m.atoms[x].dead = true; bondBetween(m, c, x).dead = true; m.atoms[O].dead = true; bondBetween(m, c, O).dead = true; m.atoms[c].h += 2; graft(m, c, 'O', 1, false); }
      else if (kind === 'amide') { m.atoms[O].dead = true; bondBetween(m, c, O).dead = true; m.atoms[c].h += 2; }
      else if (kind === 'nitrile') {
        const n = f.nitN;
        if (reagent === 'DIBAL') { m.atoms[n].dead = true; bondBetween(m, c, n).dead = true; graft(m, c, 'O', 2, false); m.atoms[c].h += 1; }
        else { setBond(m, c, n, 1); m.atoms[c].h += 2; m.atoms[n].h += 2; }
      }
    }
    const prods = finish(m);
    const res = { products: rolesByKey(prods, '환원'), steps: [], select: [], modern: [], sites: sites.map(s => s.c) };
    const T = {
      NaBH4: ['수소화 음이온 첨가', [{ t: 'H⁻ 공격', d: 'BH₄⁻ 의 H⁻ 가 C=O 탄소를 공격해 알콕사이드.' }, { t: '양성자화', d: '용매(메탄올)가 O⁻ 에 H 를 주어 알코올.' }], ['알데하이드 → 1차 알코올, 케톤 → 2차 알코올.', 'NaBH₄ 는 에스터 · 산 · 아마이드를 건드리지 않습니다 (화학 선택성).']],
      LiAlH4: ['강한 수소화 음이온 환원', [{ t: 'H⁻ 공격', d: 'AlH₄⁻ 가 C=O 에 H⁻ 를 줍니다. 에스터는 알콕시가 떨어져 알데하이드가 되고, 한 번 더 환원됩니다.' }, { t: '처리', d: 'H₂O 로 처리해 알코올 · 아민.' }], ['에스터 → 1차 알코올 + 알코올(알콕시 쪽), 카복실산 → 1차 알코올, 아마이드 → 아민, 나이트릴 → 1차 아민.']],
      DIBAL: ['DIBAL-H 부분 환원', [{ t: '−78 °C', d: '낮은 온도에서 H⁻ 하나만 주고 사면체 중간체가 안정하게 머뭅니다.' }, { t: '처리', d: '물로 처리할 때 비로소 알데하이드가 됩니다 (더 환원되지 않음).' }], ['에스터 → 알데하이드 + 알코올, 나이트릴 → 알데하이드.']],
      WK: ['볼프–키시너 환원 (C=O → CH₂)', [{ t: '하이드라존', d: 'H₂NNH₂ 가 C=O 와 하이드라존을 만듭니다.' }, { t: 'N₂ 방출', d: 'KOH 로 가열하면 N₂ 가 빠지며 CH₂ 가 됩니다.' }], ['카보닐이 메틸렌(CH₂)으로. 산에 약한 분자에 좋고, 산성 조건이면 클레멘슨 환원(Zn(Hg), HCl).']]
    }[reagent];
    res.mech = T[0]; res.steps = T[1]; res.select.push(...T[2]);
    return res;
  };
}
function grignard(R, label) {
  return (mol, S) => {
    const sites = S.carbonyls.filter(x => ['aldehyde', 'ketone', 'ester', 'acylhalide', 'nitrile'].includes(x.kind));
    const acidic = S.acidic;
    if (acidic.length) {
      const rh = parseSmiles(R.replace('c1ccccc1', 'c1ccccc1')); layout(rh);
      return {
        ok: true, mech: '산–염기 반응 (첨가 없음)', sites: acidic.map(a => a.atom),
        products: [product(clone(mol), 'major', { tag: '그대로' }), product(rh, 'side', { tag: 'R–H' })],
        steps: [{ t: '가장 빠른 반응', d: `그리냐르 시약은 매우 강한 염기입니다. 기질의 ${b(acidic[0].why)} (산성 H)를 먼저 떼어 ${label.replace('MgBr', 'H')} 가 되고 시약이 사라집니다.` }],
        select: ['OH · NH · COOH · 말단 알카인 C–H 가 있으면 보호기를 달거나 시약을 훨씬 많이 써야 합니다.'], modern: [], warn: true
      };
    }
    if (!sites.length) return none('그리냐르 시약이 공격할 C=O (알데하이드 · 케톤 · 에스터 · 산 염화물) 나 나이트릴이 없습니다.');
    const m = work(mol);
    for (const { c } of sites) m.atoms[c].key = true;
    for (const { c, kind, f } of sites) {
      const O = f.oxo[0];
      if (kind === 'aldehyde' || kind === 'ketone') { setBond(m, c, O, 1); m.atoms[O].h = 1; graft(m, c, R, 1, false); }
      else if (kind === 'ester' || kind === 'acylhalide') {
        const lg = kind === 'ester' ? f.OR[0].o : f.halo[0];
        cut(m, c, lg); if (kind === 'ester') m.atoms[lg].h += 1; else m.atoms[lg].dead = true;
        setBond(m, c, O, 1); m.atoms[O].h = 1; graft(m, c, R, 1, false); graft(m, c, R, 1, false);
      } else if (kind === 'nitrile') { const n = f.nitN; m.atoms[n].dead = true; bondBetween(m, c, n).dead = true; graft(m, c, R, 1, false); graft(m, c, 'O', 2, false); }
    }
    const prods = finish(m);
    return {
      mech: '친핵성 첨가 (C–C 결합)', sites: sites.map(s => s.c),
      products: rolesByKey(prods, '그리냐르'),
      steps: [
        { t: '탄소 친핵체', d: `C–Mg 결합은 탄소 쪽이 음전하를 띱니다 (${label}). 이 탄소가 C=O 탄소를 공격해 ${b('새 C–C 결합')}.` },
        ...(sites.some(s => ['ester', 'acylhalide'].includes(s.kind)) ? [{ t: '두 번 첨가', d: '에스터 · 산 염화물은 첫 첨가 뒤 이탈기가 빠져 케톤이 되고, 더 반응성이 큰 케톤에 두 번째 R 이 붙습니다 → 3차 알코올.' }] : []),
        { t: '산 처리', d: 'H₃O⁺ 로 알콕사이드를 알코올로.' }
      ],
      select: ['폼알데하이드 → 1차, 알데하이드 → 2차, 케톤 → 3차 알코올, 에스터 → 3차 알코올 (R 둘), 나이트릴 → 케톤.'],
      modern: [{ y: '2004', t: 'iPrMgCl·LiCl ("터보 그리냐르", Knochel)처럼 LiCl 을 더한 시약은 낮은 온도에서도 빠르게 만들어지고 에스터 · 나이트릴 같은 작용기를 견딥니다.' }]
    };
  };
}
function wittig(mol, S) {
  const sites = S.carbonyls.filter(x => x.kind === 'aldehyde' || x.kind === 'ketone');
  if (!sites.length) return none('알데하이드 · 케톤이 없습니다 (에스터 · 산은 비티히 반응을 거의 하지 않음).');
  const m = work(mol);
  for (const { c, f } of sites) { const O = f.oxo[0]; m.atoms[O].dead = true; bondBetween(m, c, O).dead = true; graft(m, c, 'C', 2, false); }
  return {
    mech: '비티히 반응 (C=O → C=C)', sites: sites.map(s => s.c), products: [product(finish(m)[0], 'major', { tag: '비티히' })],
    steps: [{ t: '일라이드 공격', d: 'Ph₃P=CH₂ 의 탄소가 C=O 탄소를 공격합니다.' }, { t: '옥사포스페테인', d: 'P–O 가 이어진 4원자 고리가 생겼다가 쪼개지며 C=C 와 Ph₃P=O.' }],
    select: ['C=O 가 있던 자리에 정확히 C=C (위치가 섞이지 않음).'],
    modern: [{ y: '2013', t: '교과서에 흔히 그리던 베타인 중간체는 리튬염이 없으면 관찰되지 않습니다. 일라이드와 C=O 가 [2+2] 로 곧바로 옥사포스페테인을 만든다는 것이 현재 해석입니다 (Byrne · Gilheany 총설, Chem. Soc. Rev. 2013).' }]
  };
}

/* ── 카복실산 유도체 ─────────────────────────── */
function acyl(kind) {
  return (mol, S) => {
    const need = { fischer: ['acid'], socl2: ['acid'], water: ['acylhalide'], alcohol: ['acylhalide'], ammonia: ['acylhalide', 'ester'], methylamine: ['acylhalide'], sapon: ['ester'], nitrileHyd: ['nitrile'], amideHyd: ['amide'] }[kind];
    const sites = S.carbonyls.filter(x => need.includes(x.kind));
    if (!sites.length) return none(`이 시약과 반응할 ${need.map(k => ({ acid: '카복실산', acylhalide: '산 염화물', ester: '에스터', nitrile: '나이트릴', amide: '아마이드' }[k])).join(' · ')}이(가) 없습니다.`);
    const m = work(mol);
    for (const { c } of sites) m.atoms[c].key = true;
    for (const { c, kind: k, f } of sites) {
      if (kind === 'fischer') graft(m, f.OH[0], 'C');
      else if (kind === 'socl2') { const o = f.OH[0]; m.atoms[o].dead = true; bondBetween(m, c, o).dead = true; graft(m, c, 'Cl', 1, false); }
      else if (kind === 'nitrileHyd') { const n = f.nitN; m.atoms[n].dead = true; bondBetween(m, c, n).dead = true; graft(m, c, 'O', 2, false); graft(m, c, 'O', 1, false); }
      else {
        /* 이탈기 떼고 새 친핵체 */
        let lg;
        if (k === 'acylhalide') { lg = f.halo[0]; m.atoms[lg].dead = true; bondBetween(m, c, lg).dead = true; }
        else if (k === 'ester') { lg = f.OR[0].o; cut(m, c, lg); m.atoms[lg].h += 1; }
        else if (k === 'amide') { lg = f.N[0]; cut(m, c, lg); m.atoms[lg].h += 1; }
        const nu = { water: 'O', alcohol: 'OC', ammonia: 'N', methylamine: 'NC', sapon: 'O', amideHyd: 'O' }[kind];
        graft(m, c, nu, 1, false);
      }
    }
    const prods = finish(m);
    const T = {
      fischer: ['피셔 에스터화 (평형)', [{ t: 'C=O 활성화', d: 'H⁺ 가 C=O 의 O 에 붙어 탄소가 더 양전하를 띱니다.' }, { t: '사면체 중간체', d: '메탄올이 붙었다가 물이 떨어집니다 (첨가–제거).' }], ['평형 반응: 알코올을 많이 넣거나 물을 빼야 수율이 올라갑니다.'], [{ y: '현대', t: '리페이스 같은 효소로 물 대신 순한 조건에서 에스터를 만드는 생촉매 방법이 향료 · 의약품 산업에 쓰입니다 (효소 진화 연구로 아널드가 2018 노벨상).' }]],
      socl2: ['산 염화물 만들기', [{ t: '클로로설파이트', d: 'OH 가 SOCl₂ 와 반응해 좋은 이탈기가 됩니다.' }, { t: 'Cl⁻ 첨가–제거', d: 'Cl⁻ 가 붙고 SO₂ · HCl 이 빠집니다.' }], ['가장 반응성이 큰 산 유도체를 만듭니다 (다른 유도체의 출발 물질).'], []],
      water: ['가수분해', [{ t: '첨가–제거', d: '물이 C=O 탄소에 붙고 Cl⁻ 가 떨어집니다.' }], ['산 염화물은 물과 격렬히 반응합니다.'], []],
      alcohol: ['에스터 만들기 (알코올리시스)', [{ t: '첨가–제거', d: '메탄올이 붙고 Cl⁻ 가 떨어집니다. 피리딘이 HCl 을 잡습니다.' }], ['반응성: 산 염화물 > 산 무수물 > 에스터 ≈ 산 > 아마이드. 위에서 아래로만 쉽게 바뀝니다.'], []],
      ammonia: ['아마이드 만들기', [{ t: '첨가–제거', d: 'NH₃ 가 C=O 를 공격하고 이탈기가 떨어집니다. HCl 을 잡으려고 NH₃ 를 2당량 씁니다.' }], ['산 염화물 · 에스터 → 아마이드.'], [{ y: '현대', t: '의약품 · 펩타이드 합성에서는 산 염화물 대신 EDC · HATU 같은 커플링 시약으로 카복실산과 아민을 바로 잇습니다. 아마이드 결합 만들기는 제약 산업에서 가장 많이 하는 반응입니다.' }]],
      methylamine: ['N-메틸 아마이드', [{ t: '첨가–제거', d: 'CH₃NH₂ 가 공격합니다.' }], [], []],
      sapon: ['비누화 (염기 가수분해)', [{ t: 'OH⁻ 공격', d: 'OH⁻ 가 C=O 에 붙고 알콕사이드가 떨어집니다.' }, { t: '되돌릴 수 없음', d: '생긴 산이 곧바로 카복실레이트가 되어 평형이 오른쪽으로. 마지막에 H₃O⁺ 로 산.' }], ['생성물: 카복실산 + 알코올. 지방을 비누로 만드는 반응.'], []],
      nitrileHyd: ['나이트릴 가수분해', [{ t: '아마이드 거쳐', d: '산 · 가열로 나이트릴 → 아마이드 → 카복실산 (+ NH₄⁺).' }], ['탄소 수가 하나 는 카복실산을 만드는 방법 (R–X + CN⁻ 다음).'], []],
      amideHyd: ['아마이드 가수분해', [{ t: '가장 느린 유도체', d: '아마이드는 공명으로 안정해 진한 산 · 오랜 가열이 필요합니다.' }], ['생성물: 카복실산 + 아민(암모니아).'], []]
    }[kind];
    return { mech: T[0], steps: T[1], select: T[2], modern: T[3], sites: sites.map(s => s.c), products: rolesByKey(prods, kind) };
  };
}

/* ── 방향족 ──────────────────────────────────── */
/* 치환기의 방향 지시: w > 0 활성(o/p), 할로젠 o/p 비활성, w < 0 메타 */
function director(m, ringAtom, j, info) {
  const a = m.atoms[j];
  if (a.el === 'O') {
    if (a.h === 1 || a.q === -1) return { w: 3, op: true, ko: '–OH (강한 활성화, o/p)' };
    const other = m.nb[j].find(n => n.j !== ringAtom);
    if (other && info[other.j] && info[other.j].oxo.length) return { w: 1.5, op: true, ko: '–OCOR (약한 활성화, o/p)' };
    return { w: 2.2, op: true, ko: '–OR (활성화, o/p)' };
  }
  if (a.el === 'N') {
    if (a.q === 1) return { w: -3, op: false, ko: '–NO₂ (강한 비활성화, m)' };
    if (m.nb[j].some(n => info[n.j] && info[n.j].oxo.length)) return { w: 2, op: true, ko: '–NHCOR (활성화, o/p)', amideN: true };
    return { w: 3, op: true, ko: '–NH₂ (강한 활성화, o/p)', amine: true };
  }
  if (['F', 'Cl', 'Br', 'I'].includes(a.el)) return { w: -0.5, op: true, ko: `–${a.el} (약한 비활성화, o/p)` };
  if (a.el === 'C') {
    const f = info[j];
    if (f && f.kind === 'nitrile') return { w: -2.6, op: false, ko: '–CN (강한 비활성화, m)' };
    if (f && f.oxo.length) return { w: -2.2, op: false, ko: '–C=O (비활성화, m)' };
    return { w: 1, op: true, ko: '알킬 · 아릴 (약한 활성화, o/p)' };
  }
  return { w: 0, op: true, ko: '' };
}
function easPositions(mol, ring, info) {
  const n = ring.length;
  const subs = [];
  ring.forEach((r, k) => { for (const { j } of mol.nb[r]) if (!ring.includes(j)) subs.push({ k, r, j, d: director(mol, r, j, info) }); });
  const free = ring.map((r, k) => ({ r, k })).filter(x => mol.atoms[x.r].h > 0);
  const rel = (k1, k2) => { const d = Math.min(Math.abs(k1 - k2), n - Math.abs(k1 - k2)); return d === 1 ? 'o' : d === 2 ? 'm' : 'p'; };
  const top = subs.length ? subs.reduce((p, q) => q.d.w > p.d.w ? q : p) : null;
  for (const f of free) {
    let s = 0;
    for (const x of subs) {
      const r = rel(f.k, x.k), w = Math.abs(x.d.w);
      if (x.d.op) s += r === 'p' ? w + 0.25 : r === 'o' ? w : 0;
      else s += r === 'm' ? w * 0.6 : 0;
      if (x === top) s += x.d.op ? (r !== 'm' ? 5 : 0) : (r === 'm' ? 5 : 0);
    }
    /* 두 치환기 사이 자리는 입체 장애 */
    const nbSub = subs.filter(x => rel(f.k, x.k) === 'o').length;
    if (nbSub >= 2) s -= 6;
    f.score = s;
  }
  free.sort((p, q) => q.score - p.score);
  return { subs, free, top };
}
function eas(kind) {
  return (mol, S) => {
    if (!S.arenes.length) return none('벤젠 고리가 없습니다.');
    const ring = S.arenes[0].ring;
    const { info } = S;
    const { subs, free, top } = easPositions(mol, ring, info);
    if (!free.length) return none('벤젠 고리에 H 가 남아 있지 않습니다.');
    const E = { Br2: 'Br', Cl2: 'Cl', HNO3: '[N+](=O)[O-]', FCacyl: 'C(C)=O', FCalk: 'C' }[kind];
    const res = { products: [], steps: [], select: [], modern: [], sites: ring };
    if ((kind === 'FCacyl' || kind === 'FCalk') && subs.some(x => x.d.w <= -2 || x.d.amine)) {
      const bad = subs.find(x => x.d.w <= -2 || x.d.amine);
      return none(bad.d.amine ? '아미노기(–NH₂)의 비공유 전자쌍이 AlCl₃ 와 먼저 결합해 고리가 강하게 비활성화됩니다. 프리델–크래프츠 반응이 일어나지 않습니다.' : `고리에 ${bad.d.ko.split(' ')[0]} 같은 강한 비활성화기가 있으면 프리델–크래프츠 반응이 일어나지 않습니다.`, { mech: '반응 없음' });
    }
    /* 강한 활성화기 + Br₂: 빈 o/p 자리를 모두 브로민화 */
    const strong = subs.find(x => x.d.w >= 3);
    if (kind === 'Br2' && strong) {
      const m = work(mol);
      const k0 = strong.k, n = ring.length;
      const targets = free.filter(f => { const d = Math.min(Math.abs(f.k - k0), n - Math.abs(f.k - k0)); return d === 1 || d === 3; });
      targets.forEach(f => graft(m, f.r, 'Br'));
      res.products.push(product(finish(m)[0], 'major', { tag: '다중 치환' }));
      res.mech = '친전자성 방향족 치환 (다중)';
      res.steps = [{ t: '너무 활성화된 고리', d: `${strong.d.ko.split(' ')[0]} 는 고리에 전자를 강하게 밀어 넣어, 촉매 없이도 빈 오쏘 · 파라 자리가 모두 브로민화됩니다.` }];
      res.select.push('한 자리만 치환하려면 –NH₂ 를 아세틸화(–NHCOCH₃)해 활성을 낮춘 뒤 반응시킵니다.');
      return res;
    }
    const best = free[0].score;
    const cands = free.filter(f => f.score >= best - 2.5).slice(0, 4);
    const seen = new Set();
    cands.forEach((f, i) => {
      const m = work(mol); graft(m, f.r, E);
      const p = finish(m)[0];
      let nm = ''; try { nm = nameMolecule(p, { noNotes: true, noCompare: true }).nameEn; } catch { nm = String(i); }
      if (seen.has(nm)) return; seen.add(nm);
      res.products.push(product(p, f.score >= best - 0.01 ? 'major' : 'minor', { tag: 'EAS' }));
    });
    const T = {
      Br2: ['Br⁺', 'FeBr₃ 가 Br₂ 를 분극시켜 Br⁺ 처럼 행동하게 합니다.'], Cl2: ['Cl⁺', 'FeCl₃ 가 Cl₂ 를 활성화합니다.'],
      HNO3: ['NO₂⁺ (나이트로늄 이온)', 'H₂SO₄ 가 HNO₃ 에 양성자를 주어 물이 빠지며 NO₂⁺ 가 생깁니다.'],
      FCacyl: ['아실륨 이온 CH₃C≡O⁺', 'AlCl₃ 가 CH₃COCl 의 Cl 을 떼어 아실륨 이온 (자리옮김 없음).'], FCalk: ['CH₃⁺ (AlCl₃ 착물)', 'AlCl₃ 가 CH₃Cl 을 활성화합니다.']
    }[kind];
    res.mech = '친전자성 방향족 치환 (EAS)';
    res.steps = [
      { t: '친전자체 만들기', d: `${T[1]} → ${b(T[0])}` },
      { t: '시그마 착물 (느린 단계)', d: '고리의 π 전자가 친전자체를 공격해 방향족성이 깨진 양이온(아레늄 이온)이 생깁니다.' },
      { t: 'H⁺ 이탈', d: '염기가 H⁺ 를 떼어 방향족성이 되돌아옵니다 — 첨가가 아니라 치환.' }
    ];
    if (subs.length) {
      res.select.push(`방향 지시: ${subs.map(x => x.d.ko).join(', ')}.`);
      if (top) res.select.push(`가장 강하게 활성화하는 ${top.d.ko.split(' ')[0]} 가 위치를 정합니다${top.d.op ? ' — 파라가 입체 장애가 적어 주생성물, 오쏘는 부생성물' : ' — 메타'}.`);
    } else res.select.push('치환기가 없는 벤젠: 여섯 자리가 모두 같습니다.');
    if (kind === 'FCalk') res.select.push('주의: 알킬기가 고리를 활성화해 여러 번 알킬화되기 쉽고, 긴 할로젠화 알킬은 양이온 자리옮김이 일어납니다. 그래서 아실화 후 환원을 흔히 씁니다.');
    if (kind === 'FCalk' || kind === 'FCacyl') res.modern.push({ y: '현대', t: '에틸벤젠 · 큐멘 같은 대량 생산은 AlCl₃ 대신 재사용 가능한 제올라이트 고체 산 촉매로 바뀌었습니다 (폐기물 감소).' });
    return res;
  };
}
function aromaticMisc(kind) {
  return (mol, S) => {
    const m = work(mol);
    if (kind === 'nitroRed') {
      if (!S.nitro.length) return none('나이트로기(–NO₂)가 없습니다.');
      for (const { n } of S.nitro) { for (const { j } of mol.nb[n]) if (mol.atoms[j].el === 'O') { m.atoms[j].dead = true; bondBetween(m, n, j).dead = true; } m.atoms[n].q = 0; m.atoms[n].h = 2; }
      return { mech: '나이트로기 환원', sites: S.nitro.map(x => x.n), products: [product(finish(m)[0], 'major', { tag: '환원' })], steps: [{ t: '6전자 환원', d: 'H₂/Pd (또는 Fe · Sn + HCl) 가 –NO₂ 를 –NO, –NHOH 를 거쳐 –NH₂ 로 바꿉니다.' }], select: ['메타 지시기(–NO₂)가 오쏘 · 파라 지시기(–NH₂)로 바뀌므로 합성 순서를 짤 때 중요합니다.'], modern: [] };
    }
    if (kind === 'sideOx') {
      const sites = [];
      for (const { ring } of S.arenes) for (const r of ring) for (const { j } of mol.nb[r]) if (!ring.includes(j) && mol.atoms[j].el === 'C' && mol.nb[j].every(n => n.o === 1) && mol.atoms[j].h > 0) sites.push([r, j]);
      if (!sites.length) return none(S.arenes.length ? '벤질 자리 탄소에 H 가 없습니다 (예: tert-뷰틸). 곁사슬이 산화되지 않습니다.' : '벤젠 고리가 없습니다.', { mech: '반응 없음' });
      for (const [r, j] of sites) {
        const dead = [...branchFrom(mol, j, r)];
        dead.forEach(d => { m.atoms[d].dead = true; });
        m.bonds.forEach(bd => { if (dead.includes(bd.a) || dead.includes(bd.b)) bd.dead = true; });
        m.atoms[r].h += 1;
        graft(m, r, 'C(=O)O');
      }
      return { mech: '곁사슬 산화', sites: sites.map(s => s[1]), products: [product(finish(m)[0], 'major', { tag: '산화' })], steps: [{ t: '벤질 C–H', d: '벤질 자리의 C–H 가 약해 KMnO₄ 가 공격합니다. 곁사슬 길이와 상관없이 고리에 붙은 탄소만 남아 –COOH.' }], select: ['조건: 벤질 탄소에 H 가 하나 이상.'], modern: [] };
    }
    if (kind === 'NBS') {
      const cand = S.benzylic.map(x => x.c).concat(mol.atoms.map((a, i) => i).filter(i => mol.atoms[i].el === 'C' && mol.atoms[i].h > 0 && mol.nb[i].every(n => n.o === 1) && carbonNbrs(mol, i).some(j => mol.nb[j].some(n => n.o === 2 && mol.atoms[n.j].el === 'C' && !mol.bonds[n.k].arom))));
      if (!cand.length) return none('벤질 · 알릴 자리 C–H 가 없습니다.');
      cand.sort((p, q) => cationScore(mol, q) - cationScore(mol, p));
      graft(m, cand[0], 'Br');
      return { mech: '라디칼 치환 (벤질 · 알릴 자리)', sites: [cand[0]], products: [product(finish(m)[0], 'major', { tag: '라디칼' })], steps: [{ t: '낮은 농도의 Br₂', d: 'NBS 가 Br₂ 를 조금씩 내어 놓아 이중결합 첨가 대신 라디칼 치환만 일어납니다.' }, { t: '공명 안정 라디칼', d: 'H 를 뗀 자리의 라디칼이 고리 · 이중결합과 공명해 안정합니다.' }], select: ['알릴 라디칼은 양 끝이 공명하므로 이중결합이 옮겨 간 생성물이 섞일 수 있습니다.'], modern: [] };
    }
    return none('');
  };
}
function branchFrom(mol, j, from) {
  const set = new Set([j]), q = [j];
  while (q.length) { const i = q.pop(); for (const { j: k } of mol.nb[i]) if (k !== from && !set.has(k)) { set.add(k); q.push(k); } }
  return set;
}

/* ── 라디칼 할로젠화 (선택성 %) ─────────────────── */
const RATES = { Cl: [1, 1, 3.8, 5.0], Br: [1, 1, 82, 1600] };
function radical(X) {
  return (mol, S) => {
    const onlyCH = mol.atoms.every(a => a.el === 'C') && mol.bonds.every(b => b.o === 1);
    if (!onlyCH) return none('이 시뮬레이션은 알케인 · 사이클로알케인(C · H 와 단일결합만)에서 계산합니다. 벤질 · 알릴 자리는 NBS 를 쓰세요.');
    const groups = new Map();
    mol.atoms.forEach((a, i) => {
      if (!a.h) return;
      const cls = Math.max(1, classOf(mol, i));
      const share = a.h * RATES[X][cls];
      const m = work(mol); graft(m, i, X);
      const p = finish(m)[0];
      let nm = ''; try { nm = nameMolecule(p, { noNotes: true, noCompare: true }).nameEn; } catch { nm = 'x' + i; }
      if (!groups.has(nm)) groups.set(nm, { mol: p, share: 0, cls, h: 0 });
      const g = groups.get(nm); g.share += share; g.h += a.h;
    });
    const total = [...groups.values()].reduce((s, g) => s + g.share, 0);
    const list = [...groups.values()].sort((p, q) => q.share - p.share);
    const products = list.map((g, i) => product(g.mol, i === 0 ? 'major' : 'minor', { pct: Math.round(g.share / total * 1000) / 10, tag: `${CLS[g.cls]} C–H ${g.h}개` }));
    return {
      mech: '라디칼 연쇄 치환', sites: [], products,
      steps: [
        { t: '개시', d: `빛(hν)이 ${X}₂ 를 두 ${X}· 로 쪼갭니다.` },
        { t: '전파', d: `${X}· 가 C–H 의 H 를 떼어 탄소 라디칼 → 라디칼이 ${X}₂ 에서 ${X} 를 떼고 ${X}· 를 되살립니다.` },
        { t: '선택성 계산', d: `비율 = (그 종류 H 의 개수) × (상대 반응성). ${X === 'Cl' ? '염소화: 1차 : 2차 : 3차 = 1 : 3.8 : 5 (25 °C)' : '브로민화: 1차 : 2차 : 3차 = 1 : 82 : 1600'}.` }
      ],
      select: [X === 'Br' ? '브로민화는 선택성이 매우 커서 가장 치환된 C–H 가 거의 다 반응합니다 (하몬드 가설: 흡열 단계라 전이 상태가 라디칼과 닮음).' : '염소화는 빠르고 선택성이 작아 여러 생성물이 섞입니다.'],
      modern: [{ y: '현대', t: '빛 촉매(광산화환원) · 금속 촉매 C–H 작용기화로, 특정 C–H 만 골라 바꾸는 방법이 2010년대 이후 크게 발전했습니다.' }]
    };
  };
}

/* ── 알돌 · 클라이젠 ──────────────────────────── */
function joinCopies(mol) {
  const a = clone(mol), n = a.atoms.length;
  mol.atoms.forEach(x => { a.atoms.push({ ...x }); a.nb.push([]); });
  mol.bonds.forEach(bd => addBond(a, bd.a + n, bd.b + n, bd.o, { arom: bd.arom }));
  a._st = []; a._rings = null;
  return { m: a, off: n };
}
function aldol(heat) {
  return (mol, S) => {
    const cs = S.carbonyls.filter(x => x.kind === 'aldehyde' || x.kind === 'ketone');
    if (!cs.length) return none('알데하이드 · 케톤이 없습니다.');
    const c = cs.find(x => x.kind === 'aldehyde') || cs[0];
    const alphas = carbonNbrs(mol, c.c).filter(j => mol.atoms[j].h > 0 && mol.nb[j].every(n => n.o === 1));
    if (!alphas.length) return none('C=O 옆 탄소(α 탄소)에 H 가 없어 엔올레이트를 만들 수 없습니다 (예: 벤즈알데하이드, 폼알데하이드). 다른 알데하이드와의 교차 알돌은 가능합니다.');
    const al = alphas.sort((p, q) => mol.atoms[q].h - mol.atoms[p].h)[0];
    const { m, off } = joinCopies(mol);
    const O2 = c.f.oxo[0] + off, C2 = c.c + off;
    m.atoms[al].h -= 1;
    setBond(m, C2, O2, 1); m.atoms[O2].h = 1;
    addBond(m, al, C2, 1);
    m.atoms[al].nw = true; m.atoms[C2].nw = true; m.atoms[O2].nw = true;
    let extra = [];
    if (heat && m.atoms[al].h > 0) {
      m.atoms[O2].dead = true; bondBetween(m, C2, O2).dead = true;
      m.atoms[al].h -= 1;
      setBond(m, al, C2, 2);
      const q = carbonNbrs(m, C2, al)[0];
      if (q !== undefined) extra = [{ x: c.c, a: al, b: C2, y: q, rel: 'trans' }];
    }
    const p = finish(m, extra)[0];
    return {
      mech: heat ? '알돌 축합 (가열 → 탈수)' : '알돌 첨가', sites: [c.c, al], products: [product(p, 'major', { tag: '알돌' })],
      steps: [
        { t: '엔올레이트', d: 'OH⁻ 가 α 탄소의 H 를 떼어 엔올레이트 (탄소 친핵체).' },
        { t: 'C–C 결합', d: '엔올레이트의 α 탄소가 다른 분자의 C=O 탄소를 공격 → β-하이드록시 카보닐.' },
        ...(heat ? [{ t: '탈수 (E1cB)', d: '가열하면 α-H 와 OH 가 빠져 C=C 가 C=O 와 짝을 이루는 α,β-불포화 카보닐 (주로 E).' }] : [])
      ],
      select: ['같은 분자 두 개가 이어진 생성물 (자기 알돌). 탄소 수가 두 배.'],
      modern: [{ y: '2000 · 2021', t: '아미노산 프롤린 하나로 한쪽 거울상 알돌 생성물을 얻는 유기 촉매 반응(List 외, 2000)이 "비대칭 유기촉매"를 열었고, 리스트 · 맥밀런이 2021 노벨 화학상을 받았습니다.' }]
    };
  };
}
function claisen(mol, S) {
  const es = S.carbonyls.filter(x => x.kind === 'ester');
  if (!es.length) return none('에스터가 없습니다.');
  const e = es[0];
  const alphas = carbonNbrs(mol, e.c).filter(j => mol.atoms[j].h >= 2);
  if (!alphas.length) return none('α 탄소에 H 가 둘 이상 필요합니다 (생성물의 산성 H 를 떼어 평형을 끌어오기 때문).');
  const al = alphas[0];
  const { m, off } = joinCopies(mol);
  const C2 = e.c + off, O2r = e.f.OR[0].o + off;
  m.atoms[al].h -= 1;
  cut(m, C2, O2r); m.atoms[O2r].h += 1;
  addBond(m, al, C2, 1);
  m.atoms[al].nw = true; m.atoms[C2].nw = true; m.atoms[al].key = true;
  const prods = finish(m);
  return {
    mech: '클라이젠 축합', sites: [e.c, al], products: rolesByKey(prods, '클라이젠'),
    steps: [{ t: '에스터 엔올레이트', d: 'NaOEt 가 α-H 를 뗍니다.' }, { t: '첨가–제거', d: '엔올레이트가 다른 에스터의 C=O 를 공격하고 알콕사이드가 떨어져 β-케토 에스터.' }, { t: '구동력', d: '두 C=O 사이의 H (pKa 약 11)가 떼어지며 반응이 끝까지 갑니다. 마지막에 산 처리.' }],
    select: ['생성물: β-케토 에스터 + 알코올.'], modern: []
  };
}

/* ── 디엘스–알더 ─────────────────────────────── */
const DIENOPHILES = { ethene: 'C=C', acrylate: 'C=CC(=O)OC', acrolein: 'C=CC=O' };
function dielsAlder(dp) {
  return (mol, S) => {
    const R = rings(mol);
    let diene = null;
    for (const e1 of S.alkenes) for (const e2 of S.alkenes) {
      if (e1 === e2) continue;
      for (const [c1, c2] of [[e1.a, e1.b], [e1.b, e1.a]]) for (const [c3, c4] of [[e2.a, e2.b], [e2.b, e2.a]]) {
        const bd = bondBetween(mol, c2, c3);
        if (bd && bd.o === 1 && !(R.of[c2] >= 0 && R.of[c2] === R.of[c3]) && R.of[c1] < 0 && R.of[c4] < 0) diene = diene || [c1, c2, c3, c4];
      }
    }
    if (!diene) return none('짝지은(콘쥬게이트) 다이엔 C=C–C=C 가 없습니다. 예: 뷰타-1,3-다이엔. (고리 속 다이엔은 두 고리 생성물이라 여기서는 다루지 않습니다.)');
    const [c1, c2, c3, c4] = diene;
    const dmol = parseSmiles(DIENOPHILES[dp]);
    const make = flip => {
      const { m } = { m: clone(mol) }; m._st = []; m.atoms.forEach(a => delete a.nw);
      const off = m.atoms.length;
      dmol.atoms.forEach(x => { m.atoms.push({ ...x, nw: true }); m.nb.push([]); });
      dmol.bonds.forEach(bd => addBond(m, bd.a + off, bd.b + off, bd.o));
      const d1 = off, d2 = off + 1; /* d1 = CH2 끝, d2 = 치환기 쪽 */
      setBond(m, c1, c2, 1); setBond(m, c2, c3, 2); setBond(m, c3, c4, 1); setBond(m, d1, d2, 1);
      const [x1, x4] = flip ? [d2, d1] : [d1, d2];
      addBond(m, c1, x1, 1); addBond(m, c4, x4, 1);
      m._rings = null;
      return finish(m)[0];
    };
    const subAt = c => carbonNbrs(mol, c).filter(j => ![c1, c2, c3, c4].includes(j)).length + mol.nb[c].filter(n => mol.atoms[n.j].el !== 'C').length;
    const products = [];
    if (dp === 'ethene') products.push(product(make(false), 'major', { tag: '[4+2]' }));
    else {
      /* 오쏘 · 파라 규칙: C1 에 치환기 → EWG 탄소가 C1 쪽, C2 에 치환기 → EWG 탄소가 C4 쪽 */
      let flipMajor;
      if (subAt(c1) && !subAt(c4)) flipMajor = true;
      else if (subAt(c4) && !subAt(c1)) flipMajor = false;
      else if (subAt(c2) && !subAt(c3)) flipMajor = false;
      else if (subAt(c3) && !subAt(c2)) flipMajor = true;
      else flipMajor = null;
      if (flipMajor === null) products.push(product(make(false), 'major', { tag: '[4+2]' }));
      else { products.push(product(make(flipMajor), 'major', { tag: '[4+2]' })); products.push(product(make(!flipMajor), 'minor', { tag: '[4+2]' })); }
    }
    return {
      mech: '디엘스–알더 [4+2] 고리 첨가', sites: diene, products,
      steps: [
        { t: 's-cis 다이엔', d: '다이엔이 두 이중결합이 같은 쪽을 향하는 s-cis 모양으로 돌아야 반응합니다.' },
        { t: '한 번에 두 결합', d: '다이엔 양 끝(C1 · C4)과 친다이엔체의 두 탄소 사이에 새 σ 결합 둘이 동시에 생기고, 가운데(C2=C3)에 새 π 결합 — 6원자 고리.' }
      ],
      select: ['친다이엔체의 cis/trans 가 생성물에 그대로 (입체 특이적).', '엔도 규칙: 친다이엔체의 C=O 가 다이엔 아래쪽을 향하는 엔도 생성물이 주로 생깁니다.', ...(dp !== 'ethene' ? ['위치: 다이엔 C1 치환기 → "오쏘"(1,2), C2 치환기 → "파라"(1,4) 생성물이 주생성물.'] : ['에텐은 반응성이 낮아 높은 온도 · 압력이 필요합니다. C=O 같은 전자 끄는 기가 붙은 친다이엔체가 빠릅니다.'])],
      modern: [{ y: '2011', t: '자연에서 디엘스–알더 반응만 골라 촉매하는 효소(SpnF)가 처음 확인되었습니다 (Kim 외, Nature 2011). 이후 여러 "디엘스–알더레이스"가 발견되었습니다.' }]
    };
  };
}

/* ── 현대 C–C · C–N 결합 ───────────────────────── */
function coupling(kind) {
  return (mol, S) => {
    const sites = kind === 'suzuki' ? [...S.arylHalides, ...S.vinylHalides] : S.arylHalides;
    if (kind === 'metathesis') return metathesis(mol, S);
    if (!sites.length) return none(kind === 'suzuki' ? '방향족 · 비닐 할로젠화물(sp² 탄소의 Br · I)이 없습니다.' : '방향족 할로젠화물(벤젠 고리의 Br · I)이 없습니다.');
    const s = sites[0];
    const m = work(mol);
    m.atoms[s.x].dead = true; bondBetween(m, s.c, s.x).dead = true;
    const frag = { suzuki: 'c1ccccc1', heck: 'C=CC(=O)OC', sono: 'C#Cc1ccccc1', buchwald: 'N(C)C' }[kind];
    const st = m._st.map(x => (x.x === s.x ? { ...x, x: -1 } : x.y === s.x ? { ...x, y: -1 } : x));
    const f0 = graft(m, s.c, frag, 1, false);
    st.forEach(x => { if (x.x === -1) x.x = f0; if (x.y === -1) x.y = f0; });
    m._st = st;
    const extra = kind === 'heck' ? [{ x: s.c, a: f0, b: f0 + 1, y: f0 + 2, rel: 'trans' }] : [];
    const p = finish(m, extra)[0];
    const T = {
      suzuki: ['스즈키 짝지음 (Pd)', '페닐보론산 PhB(OH)₂', [{ t: '산화적 첨가', d: 'Pd(0) 가 C–X 결합 사이로 들어가 Ar–Pd(II)–X.' }, { t: '금속 교환', d: '염기로 활성화된 보론산의 페닐이 Pd 로 옮겨 갑니다.' }, { t: '환원적 제거', d: '두 탄소가 이어지며 Ar–Ph 가 떨어지고 Pd(0) 가 되살아납니다 (촉매 순환).' }], [{ y: '2010', t: '헥 · 네기시 · 스즈키가 Pd 촉매 교차 짝지음으로 노벨 화학상. 붕소 시약이 독성이 낮고 물에서도 되어 의약품 합성에서 가장 많이 쓰이는 C–C 결합 반응입니다.' }]],
      heck: ['헥 반응 (Pd)', '아크릴산 메틸 CH₂=CHCOOCH₃', [{ t: '산화적 첨가', d: 'Pd(0) 가 Ar–X 에 끼어듭니다.' }, { t: '끼워 넣기', d: '알켄이 Pd–Ar 사이에 끼어 Ar 이 알켄의 끝 탄소로.' }, { t: 'β-수소 제거', d: 'H 가 빠지며 다시 C=C — 주로 trans(E).' }], [{ y: '2010', t: '헥 반응도 2010 노벨상의 한 축입니다. 할로젠화 아릴과 알켄을 직접 잇습니다.' }]],
      sono: ['소노가시라 짝지음 (Pd/Cu)', '페닐아세틸렌', [{ t: 'Pd 순환', d: '산화적 첨가 → 구리 아세틸라이드에서 금속 교환 → 환원적 제거.' }], [{ y: '1975 · 현대', t: '다이아릴 알카인을 만드는 표준 방법. 유기 전자 재료 · 의약품에 널리 씁니다.' }]],
      buchwald: ['버크월드–하트위그 아민화 (Pd)', '다이메틸아민', [{ t: 'Pd 순환', d: 'Ar–X 에 Pd 가 끼어든 뒤 아민이 결합하고, 환원적 제거로 Ar–N 결합.' }], [{ y: '1995 · 현대', t: '아릴 아민을 만드는 가장 일반적인 방법이 되었습니다 (예전엔 SNAr 이 되는 전자 부족한 고리만 가능).' }, { y: '2018', t: '교과서의 SNAr 은 마이젠하이머 중간체를 거친다고 배우지만, 많은 경우 한 단계 협동 메커니즘이라는 것이 동위원소 효과 측정으로 밝혀졌습니다 (Kwan · Jacobsen 외, Nature Chemistry 2018).' }]]
    }[kind];
    return { mech: T[0], sites: [s.c, s.x], products: [product(p, 'major', { tag: kind })], steps: T[2], select: [`짝: ${T[1]}. 할로젠 반응성 I > Br > Cl (Cl 은 특수한 리간드 필요).`, ...(kind === 'heck' ? ['입체: 새 C=C 는 주로 E.'] : [])], modern: T[3] };
  };
}
function metathesis(mol, S) {
  const term = S.alkenes.filter(e => !e.ring).map(e => {
    const t = mol.atoms[e.a].h === 2 && carbonNbrs(mol, e.a, e.b).length === 0 ? e.a : mol.atoms[e.b].h === 2 && carbonNbrs(mol, e.b, e.a).length === 0 ? e.b : -1;
    return t < 0 ? null : { t, i: t === e.a ? e.b : e.a };
  }).filter(Boolean);
  if (!term.length) return none('말단 알켄(–CH=CH₂)이 없습니다. 그럽스 촉매 복분해 시뮬레이션은 말단 알켄에서 계산합니다.');
  const base = { mech: '올레핀 복분해 (그럽스 촉매)', steps: [{ t: '금속 카벤', d: 'Ru=CH–R 촉매가 알켄과 [2+2] 로 금속 사이클로뷰테인을 만듭니다.' }, { t: '짝 바꾸기', d: '고리가 반대로 쪼개지며 C=C 의 양쪽이 서로 바뀝니다. 에텐 기체가 빠져나가 평형이 생성물 쪽으로.' }], modern: [{ y: '2005', t: '쇼뱅 · 그럽스 · 슈록이 올레핀 복분해로 노벨 화학상. 고리 닫기 복분해(RCM)는 큰 고리 의약품 합성의 표준 도구가 되었습니다.' }] };
  if (term.length >= 2) {
    const [p, q] = term;
    const path = pathLen(mol, p.i, q.i);
    const size = path + 1;
    if (size >= 5 && size <= 8) {
      const m = work(mol);
      for (const x of [p, q]) { m.atoms[x.t].dead = true; bondBetween(m, x.i, x.t).dead = true; }
      addBond(m, p.i, q.i, 2); m.atoms[p.i].nw = true; m.atoms[q.i].nw = true;
      const prods = finish(m);
      const eth = parseSmiles('C=C'); layout(eth);
      return { ...base, mech: '고리 닫기 복분해 (RCM)', sites: [p.i, q.i], products: [product(prods[0], 'major', { tag: 'RCM' }), product(eth, 'side', { tag: '에텐' })], select: [`두 말단 알켄 사이가 ${size}원자 고리를 만들 거리라 고리가 닫힙니다.`] };
    }
  }
  const x = term[0];
  const { m, off } = joinCopies(mol);
  for (const [t, i] of [[x.t, x.i], [x.t + off, x.i + off]]) { m.atoms[t].dead = true; bondBetween(m, i, t).dead = true; }
  addBond(m, x.i, x.i + off, 2);
  m.atoms[x.i].nw = true; m.atoms[x.i + off].nw = true;
  const p1 = carbonNbrs(m, x.i, x.i + off)[0], p2 = carbonNbrs(m, x.i + off, x.i)[0];
  const extra = p1 !== undefined && p2 !== undefined ? [{ x: p1, a: x.i, b: x.i + off, y: p2, rel: 'trans' }] : [];
  const prods = finish(m, extra);
  const eth = parseSmiles('C=C'); layout(eth);
  return { ...base, mech: '교차(자기) 복분해', sites: [x.i], products: [product(prods[0], 'major', { tag: '복분해' }), product(eth, 'side', { tag: '에텐' })], select: ['같은 알켄 두 분자가 짝을 바꿔 가운데 C=C 가 생깁니다 (주로 E).'] };
}
function pathLen(mol, u, v) {
  const d = new Map([[u, 0]]), q = [u];
  while (q.length) { const i = q.shift(); if (i === v) return d.get(i); for (const { j } of mol.nb[i]) if (!d.has(j)) { d.set(j, d.get(i) + 1); q.push(j); } }
  return 99;
}

/* ── 목록 ────────────────────────────────────── */
export const CATS = [
  { id: 'sn', ko: '치환 · 제거', en: 'SN · E', sub: '할로젠화 알킬: SN1 · SN2 · E1 · E2' },
  { id: 'alc', ko: '알코올', en: 'ALCOHOLS', sub: '할로젠화 · 탈수 · 산화 · 에터' },
  { id: 'ene', ko: '알켄 첨가', en: 'ALKENES', sub: '마르코브니코프 · syn · anti · 절단' },
  { id: 'yne', ko: '알카인', en: 'ALKYNES', sub: '환원 · 수화 · 알킬화' },
  { id: 'co', ko: '카보닐', en: 'CARBONYL', sub: '환원 · 그리냐르 · 비티히' },
  { id: 'acyl', ko: '산 유도체', en: 'ACYL', sub: '첨가–제거 (친핵성 아실 치환)' },
  { id: 'aro', ko: '방향족', en: 'AROMATIC', sub: '친전자성 치환 · 방향 지시' },
  { id: 'rad', ko: '라디칼', en: 'RADICAL', sub: '선택성 계산' },
  { id: 'cc', ko: 'C–C 결합', en: 'C–C BONDS', sub: '알돌 · 디엘스–알더 · Pd 짝지음 · 복분해' }
];
export const REACTIONS = [
  { id: 'nai', cat: 'sn', label: 'NaI, 아세톤', note: '핀켈스타인', run: snE('NaI') },
  { id: 'nacn', cat: 'sn', label: 'NaCN, DMSO', note: '나이트릴 (탄소 +1)', run: snE('NaCN') },
  { id: 'nh3', cat: 'sn', label: 'NH₃ (과량)', note: '아민', run: snE('NH3') },
  { id: 'naoh', cat: 'sn', label: 'NaOH, H₂O', note: '강염기 · 강친핵체', run: snE('NaOH') },
  { id: 'naome', cat: 'sn', label: 'NaOCH₃, CH₃OH', note: '강염기 · 강친핵체', run: snE('NaOMe') },
  { id: 'tbuok', cat: 'sn', label: 't-BuOK, t-BuOH', note: '부피 큰 강염기', run: snE('tBuOK') },
  { id: 'h2o', cat: 'sn', label: 'H₂O, 가열', note: '약한 친핵체 (가용매 분해)', run: snE('H2O') },
  { id: 'meoh', cat: 'sn', label: 'CH₃OH, 가열', note: '약한 친핵체', run: snE('MeOH') },
  { id: 'hbr_alc', cat: 'alc', label: 'HBr', note: 'OH → Br', run: alcoholToHalide('HBr') },
  { id: 'pbr3', cat: 'alc', label: 'PBr₃', note: 'OH → Br (SN2)', run: alcoholToHalide('PBr3') },
  { id: 'socl2', cat: 'alc', label: 'SOCl₂, 피리딘', note: 'OH → Cl (SN2)', run: alcoholToHalide('SOCl2') },
  { id: 'h2so4', cat: 'alc', label: 'H₂SO₄, 가열', note: '탈수 → 알켄', run: dehydrate },
  { id: 'pcc', cat: 'alc', label: 'PCC (또는 DMP)', note: '약한 산화', run: oxidize(false) },
  { id: 'jones', cat: 'alc', label: 'CrO₃, H₂SO₄, H₂O', note: '존스 · 강한 산화', run: oxidize(true) },
  { id: 'nah', cat: 'alc', label: '① NaH ② CH₃I', note: '윌리엄슨 에터', run: williamson },
  { id: 'hbr', cat: 'ene', label: 'HBr', note: '마르코브니코프', run: addAlkene('HBr') },
  { id: 'hcl', cat: 'ene', label: 'HCl', note: '마르코브니코프', run: addAlkene('HCl') },
  { id: 'hbrroor', cat: 'ene', label: 'HBr, ROOR', note: '반마르코브니코프', run: addAlkene('HBrROOR') },
  { id: 'hydration', cat: 'ene', label: 'H₂O, H₂SO₄', note: '수화 · 자리옮김 가능', run: addAlkene('H2O') },
  { id: 'oxymerc', cat: 'ene', label: '① Hg(OAc)₂, H₂O ② NaBH₄', note: '마르코브니코프, 자리옮김 없음', run: addAlkene('oxymerc') },
  { id: 'hydrobor', cat: 'ene', label: '① BH₃·THF ② H₂O₂, NaOH', note: '반마르코브니코프 · syn', run: addAlkene('hydrobor') },
  { id: 'br2', cat: 'ene', label: 'Br₂, CH₂Cl₂', note: 'anti 첨가', run: addAlkene('Br2') },
  { id: 'cl2', cat: 'ene', label: 'Cl₂, CH₂Cl₂', note: 'anti 첨가', run: addAlkene('Cl2') },
  { id: 'halohydrin', cat: 'ene', label: 'Br₂, H₂O', note: '할로하이드린', run: addAlkene('halohydrin') },
  { id: 'h2pd', cat: 'ene', label: 'H₂, Pd/C', note: '수소화 · syn', run: addAlkene('H2') },
  { id: 'mcpba', cat: 'ene', label: 'mCPBA', note: '에폭시화', run: addAlkene('epox') },
  { id: 'oso4', cat: 'ene', label: 'OsO₄ (촉매), NMO', note: 'syn 다이올', run: addAlkene('OsO4') },
  { id: 'o3', cat: 'ene', label: '① O₃ ② (CH₃)₂S', note: '오존 분해', run: addAlkene('ozone') },
  { id: 'yne_h2', cat: 'yne', label: 'H₂ (2당량), Pd/C', note: '알케인까지', run: alkyne('H2') },
  { id: 'lindlar', cat: 'yne', label: 'H₂, 린들라 촉매', note: 'cis 알켄', run: alkyne('lindlar') },
  { id: 'nanh3', cat: 'yne', label: 'Na, NH₃(l)', note: 'trans 알켄', run: alkyne('NaNH3') },
  { id: 'yne_hyd', cat: 'yne', label: 'H₂O, H₂SO₄, HgSO₄', note: '케톤 (마르코브니코프)', run: alkyne('hydration') },
  { id: 'yne_hb', cat: 'yne', label: '① (sia)₂BH ② H₂O₂, NaOH', note: '알데하이드', run: alkyne('hydrobor') },
  { id: 'yne_hbr', cat: 'yne', label: 'HBr (2당량)', note: '제미널 다이브로마이드', run: alkyne('HBr2') },
  { id: 'yne_alk', cat: 'yne', label: '① NaNH₂ ② CH₃I', note: 'C–C 결합', run: alkyne('alkylate') },
  { id: 'nabh4', cat: 'co', label: 'NaBH₄, CH₃OH', note: '알데하이드 · 케톤만', run: reduce('NaBH4') },
  { id: 'lialh4', cat: 'co', label: '① LiAlH₄ ② H₂O', note: '센 환원', run: reduce('LiAlH4') },
  { id: 'dibal', cat: 'co', label: '① DIBAL-H, −78 °C ② H₂O', note: '에스터 → 알데하이드', run: reduce('DIBAL') },
  { id: 'wk', cat: 'co', label: 'H₂NNH₂, KOH, 가열', note: '볼프–키시너 (C=O → CH₂)', run: reduce('WK') },
  { id: 'mgme', cat: 'co', label: '① CH₃MgBr ② H₃O⁺', note: '그리냐르', run: grignard('C', 'CH₃MgBr') },
  { id: 'mget', cat: 'co', label: '① CH₃CH₂MgBr ② H₃O⁺', note: '그리냐르', run: grignard('CC', 'CH₃CH₂MgBr') },
  { id: 'mgph', cat: 'co', label: '① C₆H₅MgBr ② H₃O⁺', note: '그리냐르', run: grignard('c1ccccc1', 'C₆H₅MgBr') },
  { id: 'wittig', cat: 'co', label: 'Ph₃P=CH₂', note: '비티히', run: wittig },
  { id: 'fischer', cat: 'acyl', label: 'CH₃OH, H₂SO₄', note: '피셔 에스터화', run: acyl('fischer') },
  { id: 'socl2_acid', cat: 'acyl', label: 'SOCl₂', note: '산 → 산 염화물', run: acyl('socl2') },
  { id: 'acyl_h2o', cat: 'acyl', label: 'H₂O', note: '산 염화물 가수분해', run: acyl('water') },
  { id: 'acyl_meoh', cat: 'acyl', label: 'CH₃OH, 피리딘', note: '→ 에스터', run: acyl('alcohol') },
  { id: 'acyl_nh3', cat: 'acyl', label: 'NH₃', note: '→ 아마이드', run: acyl('ammonia') },
  { id: 'acyl_mena', cat: 'acyl', label: 'CH₃NH₂', note: '→ N-메틸 아마이드', run: acyl('methylamine') },
  { id: 'sapon', cat: 'acyl', label: '① NaOH, H₂O ② H₃O⁺', note: '비누화', run: acyl('sapon') },
  { id: 'nitrile_hyd', cat: 'acyl', label: 'H₃O⁺, 가열', note: '나이트릴 → 산', run: acyl('nitrileHyd') },
  { id: 'amide_hyd', cat: 'acyl', label: 'H₃O⁺, 오래 가열', note: '아마이드 → 산', run: acyl('amideHyd') },
  { id: 'br2fe', cat: 'aro', label: 'Br₂, FeBr₃', note: '브로민화', run: eas('Br2') },
  { id: 'cl2fe', cat: 'aro', label: 'Cl₂, FeCl₃', note: '염소화', run: eas('Cl2') },
  { id: 'hno3', cat: 'aro', label: 'HNO₃, H₂SO₄', note: '나이트로화', run: eas('HNO3') },
  { id: 'fcacyl', cat: 'aro', label: 'CH₃COCl, AlCl₃', note: '프리델–크래프츠 아실화', run: eas('FCacyl') },
  { id: 'fcalk', cat: 'aro', label: 'CH₃Cl, AlCl₃', note: '프리델–크래프츠 알킬화', run: eas('FCalk') },
  { id: 'nitrored', cat: 'aro', label: 'H₂, Pd/C (또는 Fe, HCl)', note: 'NO₂ → NH₂', run: aromaticMisc('nitroRed') },
  { id: 'kmno4', cat: 'aro', label: 'KMnO₄, 가열', note: '곁사슬 → COOH', run: aromaticMisc('sideOx') },
  { id: 'nbs', cat: 'aro', label: 'NBS, hν', note: '벤질 · 알릴 브로민화', run: aromaticMisc('NBS') },
  { id: 'cl2hv', cat: 'rad', label: 'Cl₂, hν', note: '비율 계산', run: radical('Cl') },
  { id: 'br2hv', cat: 'rad', label: 'Br₂, hν', note: '비율 계산', run: radical('Br') },
  { id: 'aldol', cat: 'cc', label: 'NaOH, H₂O (5 °C)', note: '알돌 첨가', run: aldol(false) },
  { id: 'aldolheat', cat: 'cc', label: 'NaOH, H₂O, 가열', note: '알돌 축합', run: aldol(true) },
  { id: 'claisen', cat: 'cc', label: '① NaOCH₂CH₃ ② H₃O⁺', note: '클라이젠 축합', run: claisen },
  { id: 'da_eth', cat: 'cc', label: '+ CH₂=CH₂, 가열', note: '디엘스–알더', run: dielsAlder('ethene') },
  { id: 'da_acr', cat: 'cc', label: '+ CH₂=CHCOOCH₃', note: '디엘스–알더', run: dielsAlder('acrylate') },
  { id: 'da_ald', cat: 'cc', label: '+ CH₂=CHCHO', note: '디엘스–알더', run: dielsAlder('acrolein') },
  { id: 'suzuki', cat: 'cc', label: 'PhB(OH)₂, Pd(PPh₃)₄, Na₂CO₃', note: '스즈키', run: coupling('suzuki'), modern: true },
  { id: 'heck', cat: 'cc', label: 'CH₂=CHCOOCH₃, Pd(OAc)₂, Et₃N', note: '헥', run: coupling('heck'), modern: true },
  { id: 'sono', cat: 'cc', label: 'PhC≡CH, Pd/CuI, Et₃N', note: '소노가시라', run: coupling('sono'), modern: true },
  { id: 'buchwald', cat: 'cc', label: 'HN(CH₃)₂, Pd, 리간드, NaOtBu', note: '버크월드–하트위그', run: coupling('buchwald'), modern: true },
  { id: 'grubbs', cat: 'cc', label: '그럽스 촉매', note: '올레핀 복분해', run: coupling('metathesis'), modern: true }
];

/* 예측 실행: 생성물에 이름 · 강조 원자를 붙인다 */
export function predict(mol, id) {
  const R = REACTIONS.find(r => r.id === id);
  const S = scan(mol);
  let res;
  try { res = R.run(mol, S); }
  catch (e) { console.error(e); res = none('이 조합은 아직 계산하지 못합니다 (' + e.message + ')'); }
  res.id = id; res.reaction = R;
  if (res.ok === undefined) res.ok = res.products.length > 0;
  const seen = new Map();
  const out = [];
  for (const p of res.products) {
    let nm = null, err = null;
    try { nm = nameMolecule(p.mol); } catch (e) { err = e.message; }
    const key = nm ? nm.nameEn : Math.random();
    if (seen.has(key)) {
      const q = seen.get(key);
      if (p.pct) q.pct = (q.pct || 0) + p.pct;
      if (p.role === 'major') q.role = 'major';
      continue;
    }
    p.name = nm; p.err = err;
    p.hl = new Set(p.mol.atoms.map((a, i) => a.nw ? i : -1).filter(i => i >= 0));
    seen.set(key, p);
    out.push(p);
  }
  const rank = { major: 0, minor: 1, side: 2 };
  out.sort((a, b2) => (rank[a.role] - rank[b2.role]) || ((b2.pct || 0) - (a.pct || 0)));
  res.products = out;
  return res;
}
/* 이 기질에 쓸 수 있는 반응인가 (메뉴에서 흐리게 표시) */
export function applicable(mol, S = scan(mol)) {
  const has = {
    sn: S.halides.length > 0, alc: S.alcohols.length + S.phenols.length > 0, ene: S.alkenes.length > 0, yne: S.alkynes.length > 0,
    co: S.carbonyls.length > 0, acyl: S.carbonyls.some(c => ['acid', 'acylhalide', 'ester', 'nitrile', 'amide'].includes(c.kind)), aro: S.arenes.length > 0,
    rad: mol.atoms.every(a => a.el === 'C') && mol.bonds.every(b2 => b2.o === 1)
  };
  const map = {};
  for (const r of REACTIONS) {
    let ok = has[r.cat];
    if (r.id === 'nitrored') ok = S.nitro.length > 0;
    if (r.id === 'nbs') ok = S.benzylic.length > 0 || S.alkenes.length > 0;
    if (r.cat === 'cc') ok = r.id.startsWith('aldol') ? S.carbonyls.some(c => c.kind === 'aldehyde' || c.kind === 'ketone') : r.id === 'claisen' ? S.carbonyls.some(c => c.kind === 'ester') : r.id.startsWith('da') ? S.alkenes.length >= 2 : r.id === 'grubbs' ? S.alkenes.length > 0 : r.id === 'suzuki' ? S.arylHalides.length + S.vinylHalides.length > 0 : S.arylHalides.length > 0;
    if (['mgme', 'mget', 'mgph'].includes(r.id)) ok = S.carbonyls.length > 0;
    map[r.id] = !!ok;
  }
  return map;
}
