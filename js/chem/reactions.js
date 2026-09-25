/* 반응 목록과 예측 규칙. 각 반응: 기질에서 반응 자리를 찾고 생성물 그래프를 만든 뒤, 풀이 · 선택성 · 최신 관점을 붙인다.
   규칙은 스미스 · 브루스 유기화학의 반응 단원을 따르고, 교과서 이후 바뀐 이해 · 방법은 반응마다 modern 에 적는다 */
import { clone, parseSmiles, addBond, bondBetween, rings, isBenzene, subMol, chiralOK } from './core.js';
import { layout } from './layout.js';
import { nameMolecule } from './name.js';
import {
  work, graft, setBond, cut, finish, carbonNbrs, classOf, cationScore, shiftFor, applyShift, alkeneDegree, scan, product, none, rolesByKey,
  NUCS, substitute, eliminate, betas, faceStereo, settleFaces, antiE2
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
    inter.push({ mol: finish(r)[0], label: `${sh.kind === 'H' ? '1,2-하이드라이드 이동' : '1,2-메틸 이동'} → 더 안정한 양이온` });
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
    if (sh) { const u = build(false); graft(u.m, u.z, nuc, 1, false); out.push(product(finish(u.m)[0], 'minor', { tag: '자리옮김 없는 생성물' })); }
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
/* 알켄 순위: 자이체프(더 치환된 쪽) 또는 호프만, 같은 치환도면 E 가 먼저 */
function rankAlkenes(list, hofmann) {
  const named = list.map(x => { let n = ''; try { n = nameMolecule(x.mol, { noNotes: true, noCompare: true }).nameEn; } catch { n = ''; } return { ...x, name: n }; });
  const seen = new Set(), uniq = [];
  for (const x of named) { if (seen.has(x.name)) continue; seen.add(x.name); uniq.push(x); }
  uniq.sort((p, q) => (hofmann ? p.deg - q.deg : q.deg - p.deg) || (/\(Z\)|\dZ/.test(p.name) - /\(Z\)|\dZ/.test(q.name)));
  return uniq;
}
/* E2: β 탄소마다 안티-페리플래너 H 가 있는지 보고(고리는 trans-다이축), 사슬에서 배열이 정해져 있으면 E/Z 하나만 */
function e2Products(mol, c, x, hofmann, why = { blocked: [], fixed: [] }) {
  const alk = [];
  for (const bt of betas(mol, c)) {
    const a = antiE2(mol, c, x, bt);
    if (!a.ok) { why.blocked.push(bt); continue; }
    if (a.rel) why.fixed.push(bt);
    for (const rel of a.rel ? [a.rel] : ['trans', 'cis']) alk.push({ mol: eliminate(mol, c, x, bt, rel), deg: alkeneDegree(mol, c, bt) });
  }
  return rankAlkenes(alk, hofmann);
}
/* E2 입체 설명 */
function e2Notes(res, why) {
  if (why.blocked.length) res.select.push('고리에서 E2 는 이탈기와 β-H 가 둘 다 축 방향(trans-다이축, 180°)이어야 합니다. 이탈기와 같은 면(cis)에 있는 H 는 제거될 수 없어, 자이체프 규칙과 다른 알켄이 생성될 수 있습니다 (예: 멘틸 클로라이드 → 덜 치환된 알켄만 생성).');
  if (why.fixed.length) res.select.push('안티-페리플래너: 두 입체중심의 배열 때문에 H 와 이탈기가 180° 를 이루는 형태가 하나뿐이므로 알켄의 E/Z 가 하나로 결정됩니다 (입체특이적 제거).');
}

/* ── 할로젠화 알킬 ─────────────────────────────── */
/* 할로젠화 알킬 + 시약 → 'SN2' | 'SN1' | 'E2' | 'E2h' | 'E2+SN2' | null(반응 없음) */
function snPath(key, mol, h) {
  const N = NUCS[key], { c, cls } = h;
  const stab = h.allylic || h.benzylic, hasBeta = betas(mol, c).length > 0;
  if (key === 'tBuOK') return hasBeta ? 'E2h' : 'SN2';
  if (N.nuc === 'weak') return cls >= 2 || (cls >= 1 && stab) ? 'SN1' : null;
  if (N.base === 'strong') return cls <= 1 ? 'SN2' : cls === 2 ? (hasBeta ? 'E2+SN2' : 'SN2') : 'E2';
  return cls <= 2 ? 'SN2' : key === 'NaCN' ? 'E2' : null;
}
const snCan = key => (S, mol) => S.halides.length > 0 && !!snPath(key, mol, S.halides[0]);
function snE(key) {
  return (mol, S) => {
    if (!S.halides.length) return none('sp³ 탄소에 결합한 Cl · Br · I (할로젠화 알킬)가 없습니다. sp² 탄소(방향족 고리 · 알켄)의 할로젠은 SN · E 반응을 하지 않습니다.');
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
      else return none(`${kindTxt}은(는) 약한 친핵체와 거의 반응하지 않습니다. 탄소 양이온이 매우 불안정해 SN1 이 진행되지 않고, 친핵체가 약해 SN2 도 매우 느립니다.`, { mech: '반응 없음' });
    } else if (N.base === 'strong') path = cls <= 1 ? 'SN2' : cls === 2 ? (hasBeta ? 'E2+SN2' : 'SN2') : 'E2';
    else {
      if (cls <= 2) path = 'SN2';
      else if (key === 'NaCN') path = 'E2';
      else return none(`3차 할로젠화 알킬은 후면이 가려져 SN2 가 불가능하고, ${N.ko.split(' (')[0]}은(는) 염기성이 약해 E2 도 거의 일어나지 않습니다.`, { mech: '반응 없음' });
    }
    if (path === 'SN2') {
      res.mech = 'SN2';
      res.products.push(product(substitute(mol, c, x, N.frag), 'major', { tag: 'SN2' }));
      res.steps = [
        { t: '후면 공격', d: `친핵체가 C–${X} 결합의 ${b('반대편(후면)')}에서 탄소를 공격하고, 동시에 ${X}⁻ 가 이탈합니다 (단일 단계의 협동 과정).` },
        { t: '속도', d: `속도 = k[기질][친핵체] (2차). ${cls === 0 ? '메틸' : cls === 1 ? '1차' : '2차'} 탄소이므로 입체 장애가 ${cls <= 1 ? '작아 반응이 빠릅니다' : '있어 상대적으로 느립니다'}.${N.solvent === 'aprotic' ? ' 극성 비양성자성 용매(아세톤 · DMSO)는 친핵체를 약하게 용매화하여 SN2 를 가속합니다.' : ''}` }
      ];
      res.select.push('입체: 반응 탄소가 입체중심이면 배열이 반전됩니다 (월든 반전).');
      if (key === 'NaI') res.select.push('NaCl · NaBr 은 아세톤에 녹지 않아 침전하므로 평형이 생성물 쪽으로 이동합니다 (르 샤틀리에 원리).');
      if (key === 'NH3') res.select.push('NH₃ 가 부족하면 생성된 아민이 다시 알킬화되어 2차 · 3차 아민과 4차 암모늄염이 섞이므로, NH₃ 를 큰 과량으로 사용합니다.');
      res.modern.push({ y: '2008', t: '기체 상태 SN2 를 분자빔으로 직접 관찰한 실험에서, 교과서의 후면 공격 외에 친핵체가 탄소 주위를 한 바퀴 도는 "라운드어바웃" 경로도 발견되었습니다 (Mikosch 외, Science 2008).' });
    } else if (path === 'E2' || path === 'E2h' || path === 'E2+SN2') {
      const hof = path === 'E2h';
      res.mech = path === 'E2+SN2' ? 'E2 (주) + SN2 (부)' : 'E2';
      const why = { blocked: [], fixed: [] };
      const alk = e2Products(mol, c, x, hof, why);
      alk.forEach((p, i) => res.products.push(product(p.mol, i === 0 ? 'major' : 'minor', { tag: why.fixed.length ? 'E2 · 안티' : 'E2' })));
      if (!alk.length) return none('모든 β-H 가 이탈기와 안티-페리플래너(고리에서는 trans-다이축)이 될 수 없어 E2 가 일어나지 않습니다.', { mech: '반응 없음 (E2 불가)' });
      if (path === 'E2+SN2') res.products.push(product(substitute(mol, c, x, N.frag), 'minor', { tag: 'SN2' }));
      e2Notes(res, why);
      res.steps = [
        { t: '협동 제거 (E2)', d: `염기가 β-수소를 제거하는 동시에 C–${X} 결합이 끊어지며 C=C 가 생성됩니다. H 와 ${X} 는 ${b('안티-페리플래너')}(서로 180°)이어야 합니다.` },
        why.blocked.length
          ? { t: '입체전자 조건이 자이체프 규칙에 우선', d: '더 치환된 알켄을 만들 β-H 가 이탈기와 trans-다이축(180°) 배치를 이룰 수 없어 제거되지 않으므로 덜 치환된 알켄이 생성됩니다. E2 에서는 기하 조건이 생성물 안정성보다 먼저 적용됩니다.' }
          : { t: hof ? '호프만 규칙' : '자이체프 규칙', d: hof ? '부피 큰 염기(tert-뷰톡사이드)는 입체 장애가 작은 말단 수소를 제거하므로 덜 치환된 알켄이 주생성물이 됩니다.' : `더 많이 치환된(안정한) 알켄이 주생성물입니다.${why.fixed.length ? ' 두 입체중심 때문에 안티-페리플래너 형태가 하나뿐이므로 E/Z 는 하나로 정해집니다.' : ' 같은 알켄이면 E(트랜스)가 Z 보다 많습니다.'}` }
      ];
      if (path === 'E2+SN2') res.select.push('2차 기질 + 강염기(OH⁻ · RO⁻): 제거가 우세하고 치환 생성물은 소량입니다. 온도를 높이면 제거 비율이 커집니다.');
      if (cls === 2 && key !== 'tBuOK') res.modern.push({ y: '현대', t: '2차 기질에서 SN2 · E2 비율은 염기의 세기뿐 아니라 용매와 온도에 크게 좌우됩니다. 계산화학은 두 전이 상태의 에너지 차가 대개 수 kJ/mol 수준이라 조건에 민감하다는 것을 보여 줍니다.' });
    } else {
      /* SN1 + E1 */
      res.mech = hasBeta ? 'SN1 (주) + E1 (부)' : 'SN1';
      const prep = m => { m.atoms[x].dead = true; bondBetween(m, c, x).dead = true; };
      const v = viaCation(mol, prep, c, N.frag, { e1: hasBeta });
      res.products.push(...v.products);
      res.steps = [
        { t: '이온화 (속도 결정 단계)', d: `C–${X} 결합이 먼저 이종 분해되어 ${b('탄소 양이온')}이 생성됩니다. 속도 = k[기질] (1차)로, 친핵체와 무관합니다.`, mol: v.inter[0].mol },
        ...(v.shift ? [{ t: '자리옮김', d: `이웃 탄소의 ${v.shift.kind === 'H' ? 'H' : 'CH₃'} 가 전자쌍과 함께 이동하여 더 안정한 ${CLS[Math.min(3, Math.round(v.shift.score / 10))] || ''} 양이온이 됩니다.`, mol: v.inter[1].mol }] : []),
        { t: '친핵체 결합 / 탈양성자화', d: `물 · 알코올이 평면 탄소 양이온의 ${b('양면')}에서 결합하거나(SN1), 이웃 탄소의 H 가 제거되어 알켄이 생성됩니다(E1). 가열하면 E1 비율이 커집니다.` }
      ];
      res.select.push('입체: 평면 양이온의 양면에서 공격하므로 입체중심이면 라세미화됩니다 (실제로는 이온쌍 효과로 반전 생성물이 약간 많음).');
      if (cls === 2 && !stab) res.modern.push({ y: '현대', t: '교과서 표와 달리 단순한 2차 기질의 가용매 분해는 순수한 SN1 이 아니라 용매가 후면에서 관여하는(SN2 성격이 섞인) 경계 메커니즘인 경우가 많습니다.' });
      res.modern.push({ y: '2013', t: '오랜 논쟁이던 2-노보닐 양이온이 "비고전적(가교된) 양이온"이라는 것이 X선 결정 구조로 확인되었습니다 (Scholz 외, Science 2013).' });
    }
    if (S.halides.length > 1) res.select.push('할로젠이 여러 개이면 첫 번째 위치의 반응만 표시합니다.');
    res.sites = [c, x];
    return res;
  };
}

/* ── 알코올 ──────────────────────────────────── */
function alcoholToHalide(reagent) {
  return (mol, S) => {
    if (!S.alcohols.length) return none('sp³ 탄소에 결합한 –OH (알코올)가 없습니다. 페놀의 C–O 결합은 끊어지지 않습니다.');
    const al = S.alcohols[0], { c, o, cls } = al;
    const X = reagent === 'SOCl2' ? 'Cl' : 'Br';
    const res = { products: [], steps: [], select: [], modern: [], sites: [c, o] };
    if (reagent !== 'HBr' && cls === 3) return none(`3차 알코올은 ${reagent === 'SOCl2' ? 'SOCl₂' : 'PBr₃'} 로 잘 전환되지 않습니다 (SN2 불가). HBr · HCl 을 쓰면 SN1 로 전환됩니다.`, { mech: '반응 없음' });
    const stab = carbonNbrs(mol, c).some(j => mol.nb[j].some(n => mol.bonds[n.k].arom || (n.o === 2 && mol.atoms[n.j].el === 'C')));
    if (reagent === 'HBr' && (cls >= 2 || stab)) {
      const prep = m => { m.atoms[o].dead = true; bondBetween(m, c, o).dead = true; };
      const v = viaCation(mol, prep, c, 'Br');
      res.mech = 'SN1';
      res.products.push(...v.products);
      res.steps = [
        { t: '양성자화', d: 'OH 가 양성자화되어 좋은 이탈기(H₂O)가 됩니다.' },
        { t: '물의 이탈', d: `물이 이탈하며 ${CLS[cls]} 탄소 양이온이 생성됩니다.`, mol: v.inter[0].mol },
        ...(v.shift ? [{ t: '자리옮김', d: '1,2-이동으로 더 안정한 양이온이 됩니다.', mol: v.inter[1].mol }] : []),
        { t: 'Br⁻ 결합', d: '브로민화 이온이 탄소 양이온과 결합합니다.' }
      ];
    } else {
      res.mech = 'SN2';
      res.products.push(product(substitute(mol, c, o, X), 'major', { tag: 'SN2' }));
      res.steps = reagent === 'HBr'
        ? [{ t: '양성자화', d: 'OH 가 양성자화되어 –OH₂⁺ (좋은 이탈기)가 됩니다.' }, { t: '후면 공격', d: '1차 탄소이므로 탄소 양이온을 거치지 않고 Br⁻ 가 후면 공격하는 SN2 로 진행합니다.' }]
        : [{ t: 'OH 활성화', d: reagent === 'SOCl2' ? 'O 가 SOCl₂ 의 S 를 공격해 클로로설파이트(좋은 이탈기)가 됩니다.' : 'O 가 PBr₃ 의 P 를 공격해 O–PBr₂ (좋은 이탈기)가 됩니다.' },
          { t: '후면 공격', d: `${X}⁻ 가 후면에서 공격 (SN2). 양이온을 거치지 않으므로 ${b('자리옮김이 없습니다')}.` }];
      res.select.push('입체: 입체중심이면 배열이 반전됩니다.');
      if (reagent === 'SOCl2') res.select.push('피리딘이 있으면 Cl⁻ 가 후면에서 공격하여 배열이 반전됩니다. 피리딘 없이 SOCl₂ 만 쓰면 배열이 유지되는 SNi 경로가 섞일 수 있습니다.');
    }
    res.modern.push({ y: '현대', t: '미츠노부 반응(PPh₃ + DEAD/DIAD)은 알코올을 배열 반전하며 에스터 · 아자이드 등으로 바꾸는 표준 방법이고, 아펠 반응(PPh₃ + CBr₄)은 순한 조건에서 OH → Br 로 바꿉니다.' });
    return res;
  };
}
function dehydrate(mol, S) {
  if (!S.alcohols.length) return none('sp³ 탄소에 결합한 –OH (알코올)가 없습니다.');
  const al = S.alcohols[0], { c, o, cls } = al;
  if (!betas(mol, c).length) return none('β-탄소에 수소가 없어 알켄이 생성될 수 없습니다.');
  const res = { products: [], steps: [], select: [], modern: [], sites: [c, o] };
  if (cls >= 2) {
    const prep = m => { m.atoms[o].dead = true; bondBetween(m, c, o).dead = true; };
    const v = viaCation(mol, prep, c, null, { e1: true });
    res.mech = 'E1';
    res.products.push(...v.products);
    res.steps = [
      { t: '양성자화', d: 'OH 가 양성자화되어 –OH₂⁺ 가 됩니다.' },
      { t: '물의 이탈 (속도 결정 단계)', d: `${CLS[cls]} 탄소 양이온이 생성됩니다.`, mol: v.inter[0].mol },
      ...(v.shift ? [{ t: '자리옮김', d: '1,2-이동으로 더 안정한 양이온이 됩니다.', mol: v.inter[1].mol }] : []),
      { t: '탈양성자화', d: '물(또는 HSO₄⁻)이 이웃 탄소의 H 를 제거하여 C=C 가 생성됩니다. 자이체프 규칙에 따라 더 치환된 알켄이 주생성물입니다.' }
    ];
  } else {
    res.mech = 'E2';
    const alk = [];
    for (const bt of betas(mol, c)) for (const rel of ['trans', 'cis']) alk.push({ mol: eliminate(mol, c, o, bt, rel), deg: alkeneDegree(mol, c, bt) });
    rankAlkenes(alk, false).forEach((p, i) => res.products.push(product(p.mol, i === 0 ? 'major' : 'minor', { tag: 'E2' })));
    res.steps = [{ t: '양성자화', d: 'OH 가 양성자화되어 –OH₂⁺ 가 됩니다.' }, { t: '협동 제거 (E2)', d: '1차 탄소 양이온은 매우 불안정하므로 H 와 H₂O 가 E2 로 동시에 제거됩니다.' }];
  }
  res.select.push('진한 H₂SO₄ · 가열 조건. 온도가 낮으면 분자 간 탈수로 에터가 생성될 수 있습니다.');
  res.select.push('평형 반응(산 촉매 수화의 역반응)이므로 끓는점이 낮은 알켄을 증류로 제거해 수율을 높입니다.');
  return res;
}
function oxidize(strong) {
  return (mol, S) => {
    const alc = S.alcohols.filter(a => a.cls <= 2 && mol.atoms[a.c].h > 0);
    const ald = strong ? S.carbonyls.filter(x => x.kind === 'aldehyde') : [];
    if (!alc.length && !ald.length) return none(S.alcohols.length ? '3차 알코올은 카비놀 탄소에 H 가 없어 산화되지 않습니다.' : '산화할 1차 · 2차 알코올이 없습니다.', { mech: '반응 없음' });
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
      ? [{ t: '크로뮴산 에스터', d: '알코올이 Cr(VI) 과 반응하여 크로뮴산 에스터를 형성합니다.' }, { t: 'C–H 절단', d: 'OH 탄소의 C–H 결합이 끊어지며 C=O 가 생성됩니다. 수용액에서는 알데하이드가 수화물을 거쳐 다시 산화되어 카복실산이 됩니다.' }]
      : [{ t: 'Cr(VI) 에스터', d: '알코올이 PCC 의 Cr(VI) 과 크로뮴산 에스터를 형성합니다.' }, { t: 'C=O 생성', d: '무수 CH₂Cl₂ 에서 반응하므로 1차 알코올은 알데하이드 단계에서 멈춥니다.' }];
    res.select.push(strong ? '1차 → 카복실산, 2차 → 케톤, 3차 → 반응 없음.' : '1차 → 알데하이드, 2차 → 케톤, 3차 → 반응 없음.');
    res.modern.push({ y: '현대', t: '6가 크로뮴은 발암성이 있어 현재 연구실에서는 스원 산화, 데스–마틴 퍼아이오디네인(DMP), TEMPO/NaOCl 산화를 주로 씁니다. 결과(1차 → 알데하이드)는 PCC 와 같습니다.' });
    if (strong) res.modern.push({ y: '1998 · 현대', t: '그린 케미스트리 12원칙(아나스타스 · 워너, 1998) 이후 산업에서는 크로뮴 대신 산소 · 과산화수소를 산화제로 쓰는 촉매 산화(TEMPO/공기, 백금 촉매 등)로 바뀌고 있습니다.' });
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
    steps: [{ t: '알콕사이드', d: 'NaH 가 O–H 를 탈양성자화하여(H₂ 발생) 강한 친핵체 RO⁻ 를 만듭니다.' }, { t: 'SN2', d: 'RO⁻ 가 CH₃I 의 탄소를 후면 공격(SN2)하여 에터가 생성됩니다.' }],
    select: ['할로젠화 알킬은 메틸 · 1차여야 합니다 (2차 · 3차에서는 E2 가 우세).'], modern: []
  };
}

/* ── 알켄 첨가 ────────────────────────────────── */
/* spec(m, a, b) → { A: [원자, 조각|'H'], B: [...] } 마르코브니코프 방향을 결정 */
/* 짝지은 다이엔 C1=C2–C3=C4 (고리 밖) */
function conjDiene(mol, S) {
  const R = rings(mol);
  for (const e1 of S.alkenes) for (const e2 of S.alkenes) {
    if (e1 === e2) continue;
    for (const [c1, c2] of [[e1.a, e1.b], [e1.b, e1.a]]) for (const [c3, c4] of [[e2.a, e2.b], [e2.b, e2.a]]) {
      const bd = bondBetween(mol, c2, c3);
      if (bd && bd.o === 1 && !R.same(c2, c3) && R.of[c1] < 0 && R.of[c4] < 0) return [c1, c2, c3, c4];
    }
  }
  return null;
}
function moreSub(m, a, b) {
  const sa = cationScore(m, a), sb = cationScore(m, b);
  return sa === sb ? null : sa > sb ? [a, b] : [b, a];
}
function addAlkene(kind) {
  return (mol, S) => {
    const sites = S.alkenes;
    if (!sites.length) return none('C=C 이중결합(알켄)이 없습니다. 방향족 고리는 첨가 대신 치환 반응을 합니다.');
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
        res.products.push(product(v2.products[0].mol, 'major', { tag: '1:1' }));
        res.select.push('두 탄소의 치환 정도가 같아 두 방향 생성물이 거의 같은 양으로 생깁니다.');
      }
      res.steps = [
        { t: 'H⁺ 첨가 (속도 결정 단계)', d: `H⁺ 가 ${b('수소가 더 많은 탄소')}에 첨가되어, 더 안정한 ${CLS[Math.min(3, classOf(mol, hi) + 0)]} 탄소 양이온이 생깁니다 (마르코브니코프).`, mol: v.inter[0].mol },
        ...(v.shift ? [{ t: '자리옮김', d: `${v.shift.kind === 'H' ? '1,2-하이드라이드' : '1,2-메틸'} 이동으로 더 안정한 양이온.`, mol: v.inter[1].mol }] : []),
        { t: spec.nucStep, d: spec.nucText }
      ];
    } else if (spec.cation) {
      const conj = conjDiene(mol, S);
      if (conj) {
        /* 양쪽 끝 중 더 안정한 알릴 양이온을 만드는 쪽에 H⁺ */
        let [c1, c2, c3, c4] = conj;
        if (classOf(mol, c3) + (carbonNbrs(mol, c4).length ? 0 : 0) > classOf(mol, c2)) [c1, c2, c3, c4] = [c4, c3, c2, c1];
        const m12 = work(mol); setBond(m12, c1, c2, 1); m12.atoms[c1].h += 1; graft(m12, c2, spec.nuc, 1, false);
        const m14 = work(mol); setBond(m14, c1, c2, 1); setBond(m14, c3, c4, 1); setBond(m14, c2, c3, 2); m14.atoms[c1].h += 1; graft(m14, c4, spec.nuc, 1, false);
        res.products.push(product(finish(m12)[0], 'major', { tag: '1,2-첨가 · 낮은 온도(−80 °C)에서 주생성물' }));
        res.products.push(product(finish(m14, [{ x: c1, a: c2, b: c3, y: c4, rel: 'trans' }])[0], 'major', { tag: '1,4-첨가 · 높은 온도(40 °C)에서 주생성물' }));
        res.mech = '짝지은 다이엔의 친전자성 첨가 (1,2 · 1,4)';
        res.steps = [
          { t: 'H⁺ 첨가', d: '말단 탄소에 H⁺ 가 첨가되어 알릴 양이온이 생성되며, 양전하는 공명에 의해 C2 와 C4 에 비편재화됩니다.' },
          { t: '두 자리 공격', d: `${spec.nuc === 'O' ? '물' : spec.nuc === 'OC' ? '메탄올' : '할로젠화 이온'}이 가까운 C2 를 공격하면 1,2-첨가, 먼 C4 를 공격하면 이중결합이 가운데로 옮겨 간 1,4-첨가.` }
        ];
        res.select.push('속도 조절(낮은 온도): 양전하가 더 큰 C2 에 빨리 붙는 1,2-생성물. 열역학 조절(높은 온도 · 오래): 더 치환된(안정한) 이중결합을 가진 1,4-생성물 (뷰타다이엔 + HBr: −80 °C 에서 1,2 가 약 80%, 40 °C 에서 1,4 가 약 85%).');
      } else {
        const m = work(mol);
        for (const { a, b: bb } of sites) {
          const [hi, lo] = moreSub(mol, a, bb) || [a, bb];
          setBond(m, a, bb, 1); m.atoms[lo].h += 1; graft(m, hi, spec.nuc, 1, false);
        }
        res.products.push(product(finish(m)[0], 'major', { tag: '전체 첨가' }));
        res.mech = spec.mech;
        res.steps = [{ t: '이중결합마다', d: '고립된 이중결합은 각각 독립적으로 반응합니다. 시약을 과량 사용하면 모두 마르코브니코프 배향으로 첨가됩니다 (자리옮김은 생략).' }];
      }
    } else {
      const m = work(mol);
      const n0 = mol.atoms.length;
      let faced = false, k = 0;
      for (const { a, b: bb } of sites) {
        k++;
        const ord = moreSub(mol, a, bb) || [a, bb];
        const [hi, lo] = spec.anti ? [ord[1], ord[0]] : ord;
        setBond(m, a, bb, spec.cleave ? 0 : 1);
        if (spec.cleave) { cut(m, a, bb); graft(m, a, 'O', 2, false); graft(m, bb, 'O', 2, false); continue; }
        if (spec.epoxide) { const o = graft(m, a, 'O', 1, false); addBond(m, bb, o, 1); m.atoms[o].h = 0; faceStereo(mol, m, a, bb, { [a]: 1, [bb]: 1 }, new Set(), n0, k); faced = true; continue; }
        if (spec.cyclo) { const c3 = graft(m, a, 'C', 1, false); addBond(m, bb, c3, 1); m.atoms[c3].h = 2; faceStereo(mol, m, a, bb, { [a]: 1, [bb]: 1 }, new Set(), n0, k); faced = true; continue; }
        const addedH = new Set();
        for (const [atom, f] of [[hi, spec.hi], [lo, spec.lo]]) { if (f === 'H') { m.atoms[atom].h += 1; addedH.add(atom); } else graft(m, atom, f, 1, false); }
        /* 한 번에 같은 면(syn) 또는 반대 면(anti)으로 붙는 반응만 배열이 정해진다 */
        if (spec.face) { faceStereo(mol, m, hi, lo, { [hi]: 1, [lo]: spec.face === 'anti' ? -1 : 1 }, addedH, n0, k); faced = true; }
      }
      const prods = finish(m);
      let mixed = false;
      prods.forEach(p => { const sf = faced ? settleFaces(p) : { rac: false }; mixed = mixed || sf.mixed; res.products.push(product(p, 'major', { tag: spec.tag, rac: sf.rac })); });
      if (mixed) res.select.push('고립된 이중결합은 독립적으로 반응하므로 각 이중결합에서 생긴 입체 배치는 서로 무관합니다. 따라서 여러 입체이성질체(부분입체이성질체 포함)의 혼합물이 생성됩니다 (구조식의 *).');
      res.steps = spec.steps;
      if (!one) res.select.push(`이중결합이 ${sites.length}개이며, 시약을 과량 사용해 모두 반응한 결과입니다.`);
    }
    res.select.push(...spec.select);
    res.modern.push(...(spec.modern || []));
    return res;
  };
}
const SPEC = {
  HBr: { cation: true, nuc: 'Br', mech: '친전자성 첨가 (마르코브니코프)', nucStep: 'Br⁻ 결합', nucText: '브로민화 이온이 탄소 양이온과 결합합니다.', select: ['위치: Br 은 더 치환된 탄소에 (마르코브니코프).', '입체: 평면 양이온 → 새 입체중심은 라세미.'] },
  HCl: { cation: true, nuc: 'Cl', mech: '친전자성 첨가 (마르코브니코프)', nucStep: 'Cl⁻ 결합', nucText: '염화 이온이 탄소 양이온과 결합합니다.', select: ['위치: Cl 은 더 치환된 탄소에.'] },
  MeOH: { cation: true, nuc: 'OC', mech: '산 촉매 알코올 첨가 (마르코브니코프)', nucStep: 'CH₃OH 결합 → H⁺ 이탈', nucText: '메탄올의 O 가 양이온 탄소에 붙고 H⁺ 를 잃어 에터가 됩니다.', select: ['위치: OCH₃ 는 더 치환된 탄소에.', '양이온을 거치므로 자리옮김이 일어날 수 있습니다.'] },
  simmons: { cyclo: true, mech: '시먼스–스미스 고리 프로페인화 (syn, 협동)', tag: '고리', steps: [{ t: '카베노이드', d: 'CH₂I₂ 와 Zn(Cu) 가 ICH₂ZnI 를 만듭니다. 자유 카벤이 아니라 카벤처럼 행동하는 "카베노이드".' }, { t: '두 σ 결합의 동시 형성', d: 'CH₂ 가 이중결합의 같은 면에서 두 탄소와 동시에 결합하여 사이클로프로페인이 생성됩니다 (나비형 전이 상태).' }], select: ['입체 특이적: cis 알켄 → cis 치환 사이클로프로페인, trans → trans.', '다이아조메테인 + 빛으로 만든 자유 카벤(:CH₂)은 C–H 에도 끼어들어 부반응이 많아, 시먼스–스미스 시약이 실험실 표준입니다.'], modern: [{ y: '현대', t: '키랄 리간드를 쓰는 비대칭 시먼스–스미스, 다이아조 화합물과 Rh · Cu 촉매 고리 프로페인화, 효소(조작한 사이토크롬 P450)로 한쪽 거울상 사이클로프로페인을 만드는 방법이 의약품 합성에 쓰입니다 (아널드, 2018 노벨상).' }] },
  H2O: { cation: true, nuc: 'O', mech: '산 촉매 수화 (마르코브니코프)', nucStep: '물 결합 → H⁺ 이탈', nucText: '물이 양이온에 붙고 H⁺ 를 잃어 알코올이 됩니다 (H⁺ 는 촉매로 되돌아감).', select: ['위치: OH 는 더 치환된 탄소에.', '양이온을 거치므로 자리옮김이 일어날 수 있습니다.'] },
  HBrROOR: { hi: 'H', lo: 'Br', anti: false, mech: '라디칼 첨가 (반마르코브니코프)', tag: '라디칼', steps: [{ t: '개시', d: '과산화물 RO–OR 이 빛 · 열로 균일 분해되어 RO· 가 생기고, HBr 의 수소를 추출하여 Br· 를 생성합니다.' }, { t: 'Br· 첨가', d: `Br· 가 ${b('수소가 더 많은 탄소')}에 첨가되어 더 안정한(더 치환된) 탄소 라디칼이 생성됩니다.` }, { t: '수소 원자 추출', d: '탄소 라디칼이 HBr 의 수소 원자를 추출하여 생성물과 Br· 를 만듭니다 (연쇄 전파).' }], select: ['위치: Br 은 덜 치환된 탄소에 (반마르코브니코프). HBr 만 이렇게 되고 HCl · HI 는 안 됩니다.'] },
  oxymerc: { hi: 'O', lo: 'H', mech: '옥시수은화–탈수은화 (마르코브니코프)', tag: '첨가', steps: [{ t: '머큐리늄 이온', d: 'Hg(OAc)₂ 가 이중결합과 삼원자 고리 머큐리늄 이온을 형성합니다. 자유 탄소 양이온을 거치지 않으므로 자리옮김이 없습니다.' }, { t: '물의 공격', d: '물이 더 치환된 탄소를 공격하여 고리를 엽니다.' }, { t: '탈수은화', d: 'NaBH₄ 가 C–Hg 를 C–H 로 바꿉니다.' }], select: ['위치: 마르코브니코프, 자리옮김 없음.'], modern: [{ y: '현대', t: '수은은 독성이 커서 요즘은 거의 쓰지 않습니다. 코발트 촉매와 실레인 · 산소를 쓰는 무카이야마 수화처럼 수은 없이 마르코브니코프 알코올을 얻는 방법이 쓰입니다.' }] },
  hydrobor: { face: 'syn', hi: 'H', lo: 'O', mech: '수소붕소화–산화 (반마르코브니코프, syn)', tag: '첨가', steps: [{ t: '수소붕소화', d: 'B–H 가 이중결합에 협동적으로 첨가됩니다. 부피 큰 붕소는 덜 치환된 탄소에, 수소는 더 치환된 탄소에 같은 면(syn)으로 결합합니다.' }, { t: '산화', d: 'H₂O₂ / NaOH 가 C–B 결합을 C–OH 로 바꿉니다 (배열 유지).' }], select: ['위치: OH 는 덜 치환된 탄소에 (반마르코브니코프).', '입체: H 와 OH 가 같은 쪽 (syn 첨가). 자리옮김 없음.'], modern: [{ y: '현대', t: '9-BBN · 다이사이아밀보레인 같은 부피 큰 보레인은 위치 선택성을 더 높입니다. 키랄 보레인(Brown)으로 한쪽 거울상 알코올만 얻을 수도 있습니다.' }] },
  Br2: { face: 'anti', hi: 'Br', lo: 'Br', mech: '할로젠 첨가 (anti)', tag: '첨가', steps: [{ t: '브로모늄 이온', d: 'Br₂ 가 이중결합과 반응하여 삼원자 고리 브로모늄 이온을 형성합니다.' }, { t: '후면 공격', d: 'Br⁻ 가 브로모늄 이온의 반대 면에서 공격하므로 두 Br 은 anti 로 첨가됩니다.' }], select: ['입체: anti 첨가. 고리 알켄이면 trans-1,2-다이브로모 생성물.'] },
  Cl2: { face: 'anti', hi: 'Cl', lo: 'Cl', mech: '할로젠 첨가 (anti)', tag: '첨가', steps: [{ t: '클로로늄 이온', d: 'Cl₂ 가 삼원자 고리 클로로늄 이온을 형성합니다.' }, { t: '후면 공격', d: 'Cl⁻ 가 반대 면에서 공격합니다 (anti 첨가).' }], select: ['입체: anti 첨가.'] },
  halohydrin: { face: 'anti', hi: 'O', lo: 'Br', mech: '할로하이드린 생성', tag: '첨가', steps: [{ t: '브로모늄 이온', d: '브로모늄 이온이 먼저 형성됩니다.' }, { t: '물의 공격', d: '용매로 과량 존재하는 물이 Br⁻ 대신, 부분 양전하가 더 큰 더 치환된 탄소를 후면에서 공격합니다.' }], select: ['위치: OH 는 더 치환된 탄소, Br 은 적은 탄소.', '입체: anti.'] },
  H2: { face: 'syn', hi: 'H', lo: 'H', mech: '촉매 수소화 (syn)', tag: '환원', steps: [{ t: '금속 표면', d: 'H₂ 와 알켄이 Pd 표면에 흡착합니다.' }, { t: '수소 전달', d: '금속 표면의 수소 원자 두 개가 같은 면에서 차례로 결합합니다 (syn 첨가).' }], select: ['벤젠 고리 · C=O 는 이 조건에서 거의 환원되지 않습니다.'], modern: [{ y: '2001', t: '키랄 로듐 · 루테늄 촉매로 한쪽 거울상만 만드는 비대칭 수소화로 놀스 · 노요리가 노벨 화학상을 받았습니다 (L-DOPA 합성 등).' }] },
  epox: { epoxide: true, mech: '에폭시화 (syn, 협동)', tag: '산화', steps: [{ t: '나비형 전이 상태', d: '과산(mCPBA)의 말단 산소가 C=C 의 두 탄소에 동시에 전달됩니다 (협동 반응).' }], select: ['입체: 알켄의 cis/trans 배치가 에폭사이드에 보존됩니다 (입체특이적).'], modern: [{ y: '2001', t: '알릴 알코올을 한쪽 거울상 에폭사이드로 바꾸는 샤플리스 비대칭 에폭시화가 노벨상(2001)을 받았고, 제이콥슨 · 시(Shi) 에폭시화로 넓어졌습니다.' }] },
  OsO4: { face: 'syn', hi: 'O', lo: 'O', mech: '다이하이드록시화 (syn)', tag: '산화', steps: [{ t: '고리형 오스뮴산 에스터', d: 'OsO₄ 의 두 산소가 이중결합의 같은 면에 결합하여 고리형 오스뮴산 에스터를 만듭니다.' }, { t: '가수분해', d: '가수분해로 1,2-다이올이 생성되며 두 OH 는 같은 면(syn)에 있습니다.' }], select: ['입체: syn. 고리 알켄이면 cis-다이올.'], modern: [{ y: '현대', t: 'OsO₄ 는 비싸고 독해서 소량 촉매로 쓰고 NMO 로 되살립니다 (업존 법). 샤플리스 비대칭 다이하이드록시화(AD-mix)도 널리 쓰입니다.' }] },
  ozone: { cleave: true, mech: '오존 분해', tag: '절단', steps: [{ t: '1차 오조나이드', d: 'O₃ 가 이중결합에 1,3-쌍극자 고리화 첨가하여 불안정한 1차 오조나이드(몰로조나이드)가 생성됩니다.' }, { t: '크리기 중간체', d: '1차 오조나이드가 카보닐 화합물과 크리기 중간체(카보닐 옥사이드)로 분해된 뒤 재결합하여 오조나이드가 됩니다.' }, { t: '환원 처리', d: '(CH₃)₂S 로 환원 처리하면 두 개의 카보닐 화합물이 생성됩니다.' }], select: ['C=C 가 절단되어 각 탄소가 C=O 가 됩니다. H 가 결합한 탄소 → 알데하이드, H 가 없는 탄소 → 케톤.'], modern: [{ y: '2012', t: '크리기 중간체(카보닐 옥사이드)를 기체 상태에서 직접 만들어 측정하는 데 성공했고, 대기 중 SO₂ 산화 등 대기 화학에서 생각보다 중요하다는 것이 밝혀졌습니다 (Welz 외, Science 2012).' }] }
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
      H2: ['촉매 수소화 (완전)', [{ t: '2당량 수소화', d: '알카인 → 알켄 → 알케인. Pd/C 에서는 알켄 단계에서 멈추지 않습니다.' }], []],
      lindlar: ['린들라 촉매 (cis 알켄)', [{ t: '피독 촉매', d: 'Pd/CaCO₃ 를 아세트산 납 · 퀴놀린으로 피독시켜 활성을 낮춘 촉매로, 알켄 단계에서 반응이 멈춥니다.' }, { t: 'syn 첨가', d: '두 수소가 같은 면에서 첨가되어 cis(Z) 알켄이 생성됩니다.' }], [{ y: '현대', t: '납을 쓰는 린들라 촉매 대신 니켈 붕소화물(P-2 Ni), 구리 · 철 촉매 반수소화처럼 독성이 적은 방법이 개발되고 있습니다.' }]],
      NaNH3: ['용해 금속 환원 (trans 알켄)', [{ t: '단일 전자 이동', d: 'Na 의 전자 이동과 NH₃ 의 양성자 공급이 번갈아 일어나 라디칼 음이온 → 바이닐 라디칼 → 바이닐 음이온을 거칩니다.' }, { t: 'trans', d: '바이닐 라디칼 · 음이온이 치환기가 서로 멀리 위치하는 trans 배치를 취하므로 (E) 알켄이 생성됩니다.' }], []],
      hydration: ['수화 (마르코브니코프) → 케톤', [{ t: '엔올', d: 'Hg²⁺ 촉매 하에서 물이 더 치환된 탄소에 첨가되어 엔올이 생성됩니다.' }, { t: '호변이성화', d: '엔올은 호변이성화하여 더 안정한 케토 형태가 됩니다. 말단 알카인에서는 메틸 케톤이 생성됩니다.' }], [{ y: '현대', t: '수은 대신 금(Au) 촉매로 알카인을 수화하는 방법이 2000년대 이후 널리 쓰입니다.' }]],
      hydrobor: ['수소붕소화–산화 → 알데하이드', [{ t: '부피 큰 보레인', d: '(sia)₂BH · 9-BBN 은 한 번만 첨가되며 붕소가 말단 탄소에 결합합니다.' }, { t: '엔올 → 알데하이드', d: '산화로 생긴 엔올이 호변이성화하여, 말단 알카인에서는 알데하이드가 생성됩니다.' }], []],
      alkylate: ['아세틸라이드 알킬화 (C–C 결합)', [{ t: '탈양성자화', d: 'NaNH₂ (NH₃ 의 pKa 약 36–38) 가 말단 C–H (pKa 약 25)를 탈양성자화하여 아세틸라이드 음이온을 만듭니다.' }, { t: 'SN2', d: '아세틸라이드가 CH₃I 를 SN2 로 공격하여 새 C–C 결합을 만듭니다. 2차 · 3차 할로젠화 알킬에서는 아세틸라이드가 강염기로 작용해 E2 가 우세합니다.' }], [{ y: '2002 · 2022', t: '말단 알카인은 구리 촉매로 아자이드와 트라이아졸 고리를 만듭니다 (CuAAC, "클릭 화학" — 샤플리스 · 멜달, 2002). 살아 있는 세포 안에서도 되는 생체 직교 반응(버토지)과 함께 2022 노벨 화학상.' }]],
      HBr2: ['HBr 2당량 첨가', [{ t: '마르코브니코프 첨가 2회', d: '첫 번째 HBr 첨가로 브로모알켄이 생기고, 두 번째 첨가에서 Br 이 같은 탄소에 결합하여 제미널 다이브로마이드가 생성됩니다.' }], []]
    }[kind];
    res.mech = T[0]; res.steps = T[1]; res.modern.push(...T[2]);
    if (kind === 'lindlar') res.select.push('입체: cis (Z) 알켄.');
    if (kind === 'NaNH3') res.select.push('입체: trans (E) 알켄.');
    if (kind === 'NaNH3' && ys.some(y => y.terminal)) res.select.push('주의: 말단 알카인(≡C–H)은 Na/NH₃ 에서 상당 부분 아세틸라이드 음이온이 되어 환원이 느립니다. 이 환원은 주로 내부 알카인에 씁니다 (말단이면 린들라 촉매).');
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
      NaBH4: ['수소화 음이온 첨가', [{ t: '하이드라이드 공격', d: 'BH₄⁻ 의 하이드라이드가 카보닐 탄소를 공격하여 알콕사이드가 생성됩니다.' }, { t: '양성자화', d: '용매(메탄올)가 알콕사이드를 양성자화하여 알코올이 생성됩니다.' }], ['알데하이드 → 1차 알코올, 케톤 → 2차 알코올.', 'NaBH₄ 는 에스터 · 산 · 아마이드를 거의 건드리지 않습니다 (화학 선택성).', '새 입체중심이 생기면 평면 C=O 의 양면에서 H⁻ 가 와서 라세미.']],
      LiAlH4: ['강한 수소화 음이온 환원', [{ t: '하이드라이드 공격', d: 'AlH₄⁻ 가 카보닐 탄소에 하이드라이드를 전달합니다. 에스터는 알콕사이드가 이탈해 알데하이드가 된 뒤 한 번 더 환원됩니다.' }, { t: '후처리', d: 'H₂O 로 처리하여 알코올 · 아민을 얻습니다.' }], ['에스터 → 1차 알코올 + 알코올(알콕시 쪽), 카복실산 → 1차 알코올, 아마이드 → 아민, 나이트릴 → 1차 아민.']],
      DIBAL: ['DIBAL-H 부분 환원', [{ t: '−78 °C', d: '저온에서 하이드라이드 하나만 전달되고 사면체 중간체가 안정하게 유지됩니다.' }, { t: '후처리', d: '수용액 후처리 단계에서 비로소 알데하이드가 생성됩니다 (과환원 없음).' }], ['에스터 → 알데하이드 + 알코올, 나이트릴 → 알데하이드.']],
      WK: ['볼프–키시너 환원 (C=O → CH₂)', [{ t: '하이드라존', d: 'H₂NNH₂ 가 카보닐 화합물과 하이드라존을 형성합니다.' }, { t: 'N₂ 방출', d: 'KOH 와 가열하면 N₂ 가 방출되며 CH₂ 로 환원됩니다.' }], ['카보닐기가 메틸렌(CH₂)으로 환원됩니다. 산에 민감한 기질에 적합하며, 산성 조건에서는 클레멘슨 환원(Zn(Hg), HCl)을 씁니다.']]
    }[reagent];
    res.mech = T[0]; res.steps = T[1]; res.select.push(...T[2]);
    if (reagent === 'NaBH4') res.modern.push({ y: '현대', t: 'CBS 촉매(옥사자보롤리딘)나 케톤 환원 효소(KRED)로 한쪽 거울상 알코올만 만드는 비대칭 환원이 의약품 생산의 표준이 되었습니다. 효소는 유도 진화로 산업 조건에 맞게 개량해 씁니다.' });
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
        products: [product(clone(mol), 'major', { tag: '기질 회수' }), product(rh, 'side', { tag: 'R–H' })],
        steps: [{ t: '산–염기 반응 우선', d: `그리냐르 시약은 매우 강한 염기이므로 기질의 ${b(acidic[0].why)} (산성 H)를 먼저 탈양성자화하여 ${label.replace('MgBr', 'H')} 가 되고, 시약이 소모됩니다.` }],
        select: ['OH · NH · COOH · 말단 알카인 C–H 가 있으면 보호기를 도입하거나 시약을 과량 사용해야 합니다.'], modern: [], warn: true
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
        { t: '탄소 친핵체', d: `C–Mg 결합에서 탄소는 부분 음전하를 띱니다 (${label}). 이 탄소가 카보닐 탄소를 공격하여 ${b('새 C–C 결합')}을 만듭니다.` },
        ...(sites.some(s => ['ester', 'acylhalide'].includes(s.kind)) ? [{ t: '2회 첨가', d: '에스터 · 산 염화물은 첫 첨가 후 이탈기가 떠나 케톤이 되고, 반응성이 더 큰 케톤에 두 번째 R 이 첨가되어 3차 알코올이 생성됩니다.' }] : []),
        { t: '산 처리', d: 'H₃O⁺ 로 알콕사이드를 양성자화하여 알코올을 얻습니다.' }
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
    steps: [{ t: '일라이드 공격', d: 'Ph₃P=CH₂ 의 탄소가 C=O 탄소를 공격합니다.' }, { t: '옥사포스페테인', d: 'P–O 결합을 포함한 사원자 고리(옥사포스페테인)가 형성된 뒤 분해되어 C=C 와 Ph₃P=O 가 생성됩니다.' }],
    select: ['카보닐 탄소 자리에만 C=C 가 생성됩니다 (위치 이성질체가 없음).', '안정화되지 않은 일라이드(Ph₃P=CHR, R = 알킬)는 주로 Z-알켄, 안정화된 일라이드(Ph₃P=CHCOOR 처럼 C=O 가 붙은 것)는 주로 E-알켄을 줍니다.'],
    modern: [{ y: '2013', t: '교과서에 흔히 그리던 베타인 중간체는 리튬염이 없으면 관찰되지 않습니다. 일라이드와 C=O 가 [2+2] 고리화 첨가로 직접 옥사포스페테인을 만든다는 것이 현재의 해석입니다 (Byrne · Gilheany 총설, Chem. Soc. Rev. 2013).' }]
  };
}

/* ── 카복실산 유도체 ─────────────────────────── */
function acyl(kind) {
  return (mol, S) => {
    const need = { fischer: ['acid'], socl2: ['acid'], water: ['acylhalide'], alcohol: ['acylhalide'], ammonia: ['acylhalide', 'ester'], methylamine: ['acylhalide'], sapon: ['ester'], esterHyd: ['ester'], nitrileHyd: ['nitrile'], amideHyd: ['amide'] }[kind];
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
        const nu = { water: 'O', alcohol: 'OC', ammonia: 'N', methylamine: 'NC', sapon: 'O', esterHyd: 'O', amideHyd: 'O' }[kind];
        graft(m, c, nu, 1, false);
      }
    }
    const prods = finish(m);
    const T = {
      fischer: ['피셔 에스터화 (평형)', [{ t: 'C=O 활성화', d: 'C=O 의 산소가 양성자화되어 카보닐 탄소의 친전자성이 커집니다.' }, { t: '사면체 중간체', d: '메탄올이 첨가된 뒤 물이 이탈합니다 (첨가–제거). ¹⁸O 표지 실험으로 에스터의 알콕시 산소가 알코올에서 유래함이 확인되었습니다.' }], ['평형 반응이므로 알코올을 과량 사용하거나 물을 제거해야 수율이 높아집니다.'], [{ y: '현대', t: '리페이스 같은 효소로 순한 조건에서 에스터를 만드는 생촉매 방법이 향료 · 의약품 산업에 쓰입니다. 효소를 실험실에서 진화시켜 원하는 반응에 맞추는 "유도 진화"로 아널드가 2018 노벨 화학상을 받았습니다.' }]],
      socl2: ['산 염화물 합성', [{ t: '클로로설파이트', d: 'OH 가 SOCl₂ 와 반응하여 좋은 이탈기(클로로설파이트)가 됩니다.' }, { t: 'Cl⁻ 첨가–제거', d: 'Cl⁻ 의 첨가–제거로 SO₂ 와 HCl 이 방출됩니다.' }], ['반응성이 가장 큰 산 유도체로, 다른 유도체 합성의 출발 물질입니다.'], []],
      water: ['가수분해', [{ t: '첨가–제거', d: '물이 카보닐 탄소에 첨가된 뒤 Cl⁻ 가 이탈합니다.' }], ['산 염화물은 물과 격렬히 반응합니다.'], []],
      alcohol: ['에스터 합성 (알코올 분해)', [{ t: '첨가–제거', d: '메탄올이 첨가된 뒤 Cl⁻ 가 이탈합니다. 피리딘이 생성된 HCl 을 중화합니다.' }], ['반응성: 산 염화물 > 산 무수물 > 에스터 ≈ 산 > 아마이드. 반응성이 큰 유도체에서 작은 유도체로만 쉽게 전환됩니다.'], []],
      ammonia: ['아마이드 합성 (아민 분해)', [{ t: '첨가–제거', d: 'NH₃ 가 카보닐 탄소를 공격한 뒤 이탈기가 떠납니다. 생성되는 HCl 을 중화하기 위해 NH₃ 를 2당량 사용합니다.' }], ['산 염화물 · 에스터 → 아마이드.'], [{ y: '현대', t: '의약품 · 펩타이드 합성에서는 산 염화물 대신 EDC · HATU 같은 커플링 시약으로 카복실산과 아민을 직접 축합합니다. 아마이드 결합 형성은 제약 산업에서 가장 많이 수행되는 반응입니다.' }]],
      methylamine: ['N-메틸 아마이드', [{ t: '첨가–제거', d: 'CH₃NH₂ 가 공격합니다.' }], [], []],
      sapon: ['비누화 (염기 가수분해)', [{ t: 'OH⁻ 공격', d: 'OH⁻ 가 카보닐 탄소에 첨가된 뒤 알콕사이드가 이탈합니다.' }, { t: '비가역 단계', d: '생성된 카복실산이 즉시 카복실레이트로 탈양성자화되어 반응이 비가역적으로 진행됩니다. 마지막에 H₃O⁺ 로 산성화합니다.' }], ['생성물: 카복실산 + 알코올. 트라이글리세라이드로부터 비누를 만드는 반응입니다.'], []],
      nitrileHyd: ['나이트릴 가수분해', [{ t: '아마이드 경유', d: '산 촉매 · 가열 조건에서 나이트릴 → 아마이드 → 카복실산 (+ NH₄⁺).' }], ['R–X 에 CN⁻ 를 도입한 뒤 가수분해하면 탄소가 하나 늘어난 카복실산을 얻습니다.'], []],
      esterHyd: ['에스터 가수분해 (산 촉매, 평형)', [{ t: 'C=O 활성화', d: 'C=O 가 양성자화된 뒤 물이 공격합니다.' }, { t: '알코올 이탈', d: '사면체 중간체에서 알코올이 이탈합니다 (피셔 에스터화의 역반응).' }], ['과량의 물이 있어야 평형이 산 · 알코올 쪽으로 이동합니다. 염기 조건(비누화)은 비가역적이어서 완결됩니다.'], []],
      amideHyd: ['아마이드 가수분해', [{ t: '반응성이 가장 낮은 유도체', d: '아마이드는 공명 안정화가 커서 진한 산과 장시간 가열이 필요합니다.' }], ['생성물: 카복실산 + 아민(암모니아).'], []]
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
    if (!free.length) return none('방향족 고리에 치환할 수소가 없습니다.');
    const E = { Br2: 'Br', Cl2: 'Cl', HNO3: '[N+](=O)[O-]', FCacyl: 'C(C)=O', FCalk: 'C', FCpr: 'C(C)C' }[kind];
    if ((kind === 'Br2' || kind === 'Cl2') && (S.alkenes.length || S.alkynes.length)) return none(`고리 밖에 이중 · 삼중결합이 있으면 ${kind === 'Br2' ? 'Br₂' : 'Cl₂'} 는 방향족 치환보다 다중결합 첨가가 훨씬 빠릅니다. ‘알켄 첨가’ 분류의 ${kind === 'Br2' ? 'Br₂' : 'Cl₂'} 를 참고하세요.`, { mech: '다른 반응이 우선' });
    const res = { products: [], steps: [], select: [], modern: [], sites: ring };
    if ((kind === 'FCacyl' || kind === 'FCalk' || kind === 'FCpr') && subs.some(x => x.d.w <= -2 || x.d.amine)) {
      const bad = subs.find(x => x.d.w <= -2 || x.d.amine);
      return none(bad.d.amine ? '아미노기(–NH₂)의 비공유 전자쌍이 AlCl₃ 와 먼저 착물을 형성하여 고리가 강하게 비활성화되므로 프리델–크래프츠 반응이 일어나지 않습니다.' : `고리에 ${bad.d.ko.split(' ')[0]} 같은 강한 비활성화기가 있으면 프리델–크래프츠 반응이 일어나지 않습니다.`, { mech: '반응 없음' });
    }
    /* 아닐린 + HNO₃/H₂SO₄: 센 산에서 –NH₃⁺ (메타 지시기) 가 섞인다 */
    const amine = subs.find(x => x.d.amine);
    if (kind === 'HNO3' && amine) {
      const n = ring.length, k0 = amine.k;
      const at = d => free.find(f => { const dd = Math.min(Math.abs(f.k - k0), n - Math.abs(f.k - k0)); return dd === d; });
      for (const [d, pct, role] of [[3, 51, 'major'], [2, 47, 'major'], [1, 2, 'minor']]) { const f = at(d); if (!f) continue; const m = work(mol); graft(m, f.r, E); res.products.push(product(finish(m)[0], role, { pct, tag: d === 2 ? 'NH₃⁺ 가 메타 지시' : 'EAS' })); }
      res.mech = '친전자성 방향족 치환 (강산 속 아닐린)';
      res.steps = [{ t: '양성자화', d: '진한 H₂SO₄ 에서 –NH₂ 는 대부분 –NH₃⁺ 로 양성자화되며, –NH₃⁺ 는 전자 끄는 메타 지시기입니다.' }, { t: '두 경로', d: '남은 –NH₂ 는 o/p, –NH₃⁺ 는 m 으로 지시하여 파라와 메타 생성물이 비슷한 비율로 생기고, 산화로 인한 타르상 부산물도 생깁니다.' }];
      res.select.push('아닐린 나이트로화: 파라 약 51% · 메타 약 47% · 오쏘 약 2%. 선택적으로 얻으려면 아세틸화(아세트아닐라이드)한 뒤 나이트로화하고 가수분해합니다.');
      return res;
    }
    /* 강한 활성화기(–NH₂ · –OH) + Br₂ · Cl₂: 빈 o/p 자리를 모두 할로젠화 */
    const strong = subs.find(x => x.d.w >= 3);
    if ((kind === 'Br2' || kind === 'Cl2') && strong) {
      const m = work(mol);
      const k0 = strong.k, n = ring.length;
      const targets = free.filter(f => { const d = Math.min(Math.abs(f.k - k0), n - Math.abs(f.k - k0)); return d === 1 || d === 3; });
      targets.forEach(f => graft(m, f.r, E));
      res.products.push(product(finish(m)[0], 'major', { tag: '다중 치환' }));
      res.mech = '친전자성 방향족 치환 (다중)';
      res.steps = [{ t: '강하게 활성화된 고리', d: `${strong.d.ko.split(' ')[0]} 는 고리에 전자를 강하게 공여하여, 루이스산 촉매 없이도 비어 있는 오쏘 · 파라 위치가 모두 ${kind === 'Br2' ? '브로민' : '염소'}화됩니다.` }];
      res.select.push('단일 치환체를 얻으려면 –NH₂ 를 아세틸화(–NHCOCH₃)하여 활성을 낮춘 뒤 반응시킵니다.');
      return res;
    }
    const best = free[0].score;
    if (kind === 'FCpr') {
      /* 1차 양이온 대신 1,2-하이드라이드 이동한 2차 양이온 → 아이소프로필 (주), 프로필 (부) */
      const f = free[0];
      for (const [frag, role, tag] of [['C(C)C', 'major', '자리옮김'], ['CCC', 'minor', '자리옮김 없음']]) { const m = work(mol); graft(m, f.r, frag); res.products.push(product(finish(m)[0], role, { tag })); }
      res.mech = '프리델–크래프츠 알킬화 (양이온 자리옮김)';
      res.steps = [
        { t: '탄소 양이온 생성', d: 'AlCl₃ 가 CH₃CH₂CH₂Cl 의 Cl 에 배위하여 1차 탄소 양이온 성격의 착물이 생성됩니다.' },
        { t: '1,2-하이드라이드 이동', d: '수소가 전자쌍과 함께 이동하여 더 안정한 2차 양이온 (CH₃)₂CH⁺ 가 생성됩니다.' },
        { t: 'EAS', d: '벤젠 고리가 2차 양이온을 공격한 뒤 H⁺ 가 이탈하여 아이소프로필벤젠(큐멘)이 주생성물이 됩니다.' }
      ];
      res.select.push('곧은 사슬 알킬벤젠은 아실화(자리옮김 없음) 후 볼프–키시너 · 클레멘슨 환원으로 합성합니다.', '알킬기는 고리를 활성화하므로 다중 알킬화가 일어나기 쉽습니다 (벤젠을 과량 사용).');
      res.modern.push({ y: '현대', t: '큐멘(페놀 · 아세톤의 원료)은 이제 벤젠 + 프로펜을 제올라이트 촉매로 반응시켜 대량 생산합니다.' });
      return res;
    }
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
      HNO3: ['NO₂⁺ (나이트로늄 이온)', 'H₂SO₄ 가 HNO₃ 를 양성자화하고 물이 이탈하여 NO₂⁺ 가 생성됩니다.'],
      FCacyl: ['아실륨 이온 CH₃C≡O⁺', 'AlCl₃ 가 CH₃COCl 의 Cl 을 끌어내어 아실륨 이온을 만듭니다 (자리옮김 없음).'], FCalk: ['CH₃⁺ (AlCl₃ 착물)', 'AlCl₃ 가 CH₃Cl 을 활성화합니다.']
    }[kind];
    res.mech = '친전자성 방향족 치환 (EAS)';
    res.steps = [
      { t: '친전자체 생성', d: `${T[1]} → ${b(T[0])}` },
      { t: '시그마 착물 (속도 결정 단계)', d: '고리의 π 전자가 친전자체를 공격하여 방향족성을 잃은 양이온(아레늄 이온, σ 착물)이 생성됩니다.' },
      { t: 'H⁺ 이탈', d: '염기가 H⁺ 를 제거하여 방향족성이 회복됩니다. 결과적으로 첨가가 아닌 치환이 일어납니다.' }
    ];
    if (subs.length) {
      res.select.push(`방향 지시: ${subs.map(x => x.d.ko).join(', ')}.`);
      if (top) res.select.push(`가장 강한 지시기 ${top.d.ko.split(' ')[0]} 가 치환 위치를 결정합니다${top.d.op ? ' — 입체 장애가 작은 파라가 주생성물, 오쏘가 부생성물' : ' — 메타'}.`);
    } else res.select.push('치환기가 없는 벤젠: 여섯 위치가 모두 동등합니다.');
    if (kind === 'FCalk') res.select.push('주의: 알킬기가 고리를 활성화하여 다중 알킬화가 일어나기 쉽고, 긴 할로젠화 알킬은 탄소 양이온 자리옮김을 겪습니다. 따라서 아실화 후 환원을 흔히 씁니다.');
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
      return { mech: '나이트로기 환원', sites: S.nitro.map(x => x.n), products: [product(finish(m)[0], 'major', { tag: '환원' })], steps: [{ t: '6전자 환원', d: 'H₂/Pd (또는 Fe · Sn + HCl) 가 –NO₂ 를 –NO, –NHOH 를 거쳐 –NH₂ 로 바꿉니다.' }], select: ['메타 지시기(–NO₂)가 오쏘 · 파라 지시기(–NH₂)로 바뀌므로 합성 순서 설계에 중요합니다.'], modern: [] };
    }
    if (kind === 'sideOx') {
      const sites = [];
      for (const { ring } of S.arenes) for (const r of ring) for (const { j } of mol.nb[r]) if (!ring.includes(j) && mol.atoms[j].el === 'C' && mol.nb[j].every(n => n.o === 1) && mol.atoms[j].h > 0) sites.push([r, j]);
      if (!sites.length) return none(S.arenes.length ? '벤질 탄소에 H 가 없어 (예: tert-뷰틸) 곁사슬이 산화되지 않습니다.' : '벤젠 고리가 없습니다.', { mech: '반응 없음' });
      for (const [r, j] of sites) {
        const dead = [...branchFrom(mol, j, r)];
        dead.forEach(d => { m.atoms[d].dead = true; });
        m.bonds.forEach(bd => { if (dead.includes(bd.a) || dead.includes(bd.b)) bd.dead = true; });
        m.atoms[r].h += 1;
        graft(m, r, 'C(=O)O');
      }
      return { mech: '곁사슬 산화', sites: sites.map(s => s[1]), products: [product(finish(m)[0], 'major', { tag: '산화' })], steps: [{ t: '벤질 C–H', d: '벤질 C–H 결합이 약하여 KMnO₄ 에 의해 산화됩니다. 곁사슬 길이와 관계없이 고리에 결합한 탄소만 남아 –COOH 가 됩니다.' }], select: ['조건: 벤질 탄소에 H 가 하나 이상.'], modern: [] };
    }
    if (kind === 'NBS') {
      const cand = S.benzylic.map(x => x.c).concat(mol.atoms.map((a, i) => i).filter(i => mol.atoms[i].el === 'C' && mol.atoms[i].h > 0 && mol.nb[i].every(n => n.o === 1) && carbonNbrs(mol, i).some(j => mol.nb[j].some(n => n.o === 2 && mol.atoms[n.j].el === 'C' && !mol.bonds[n.k].arom))));
      if (!cand.length) return none('벤질 · 알릴 위치의 C–H 가 없습니다.');
      cand.sort((p, q) => cationScore(mol, q) - cationScore(mol, p));
      graft(m, cand[0], 'Br');
      return { mech: '라디칼 치환 (벤질 · 알릴 자리)', sites: [cand[0]], products: [product(finish(m)[0], 'major', { tag: '라디칼' })], steps: [{ t: '낮은 농도의 Br₂', d: 'NBS 가 낮은 농도의 Br₂ 를 지속적으로 공급하므로 이중결합 첨가 대신 라디칼 치환이 일어납니다.' }, { t: '공명 안정 라디칼', d: '수소가 추출된 위치의 라디칼이 고리 · 이중결합과 공명하여 안정화됩니다.' }], select: ['알릴 라디칼은 양 끝이 공명하므로 이중결합이 이동한 생성물이 섞일 수 있습니다.'], modern: [] };
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
    if (!onlyCH) return none('이 계산은 알케인 · 사이클로알케인(C · H 와 단일결합만)에 적용됩니다. 벤질 · 알릴 위치는 NBS 를 참고하세요.');
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
        { t: '개시', d: `빛(hν)에 의해 ${X}₂ 가 균일 분해되어 ${X}· 두 개가 생성됩니다.` },
        { t: '전파', d: `${X}· 가 C–H 의 수소를 추출하여 탄소 라디칼이 생기고, 이 라디칼이 ${X}₂ 의 ${X} 를 추출하며 ${X}· 를 재생합니다.` },
        { t: '선택성 계산', d: `생성물 비 = (해당 종류 H 의 개수) × (상대 반응성). ${X === 'Cl' ? '염소화: 1차 : 2차 : 3차 = 1 : 3.8 : 5.0 (25 °C)' : '브로민화: 1차 : 2차 : 3차 = 1 : 82 : 1600 (125 °C)'}.` }
      ],
      select: [X === 'Br' ? '브로민화는 선택성이 매우 커서 가장 치환된 C–H 가 대부분 반응합니다 (하몬드 가설: 수소 추출 단계가 흡열 과정이므로 전이 상태가 라디칼과 닮음).' : '염소화는 빠르고 선택성이 작아 여러 생성물이 섞입니다.'],
      modern: [{ y: '2008 · 현대', t: '2008년 맥밀런 · 윤(Yoon) · 스티븐슨이 가시광선과 Ru · Ir 착물로 라디칼을 순하게 만드는 광산화환원 촉매를 보고한 뒤, 특정 C–H 만 골라 바꾸는 C–H 작용기화(HAT 촉매 · 금속 촉매)가 크게 발전했습니다. 할로젠 기체 없이도 알케인의 C–H 를 선택적으로 바꿀 수 있습니다.' }]
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
    if (!alphas.length) return none('α 탄소에 H 가 없어 엔올레이트를 만들 수 없습니다 (예: 벤즈알데하이드, 폼알데하이드). 다른 카보닐 화합물과의 교차 알돌에서는 친전자체로 쓸 수 있습니다.');
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
      /* 열역학적으로 안정한 쪽: β 탄소의 더 큰 치환기가 C=O 와 반대편 */
      const size = j => { const seen = new Set([C2, j]), q = [j]; while (q.length) { const i = q.pop(); for (const { j: k } of m.nb[i]) if (!seen.has(k) && !m.atoms[k].dead) { seen.add(k); q.push(k); } } return seen.size; };
      const q = carbonNbrs(m, C2, al).sort((u, v) => size(v) - size(u))[0];
      if (q !== undefined) extra = [{ x: c.c, a: al, b: C2, y: q, rel: 'trans' }];
    }
    const p = finish(m, extra)[0];
    return {
      mech: heat ? '알돌 축합 (가열 → 탈수)' : '알돌 첨가', sites: [c.c, al], products: [product(p, 'major', { tag: '알돌' })],
      steps: [
        { t: '엔올레이트', d: 'OH⁻ 가 α-수소를 제거하여 엔올레이트(탄소 친핵체)를 만듭니다.' },
        { t: 'C–C 결합 형성', d: '엔올레이트의 α 탄소가 다른 분자의 카보닐 탄소를 공격하여 β-하이드록시 카보닐 화합물이 생성됩니다.' },
        ...(heat ? [{ t: '탈수 (E1cB)', d: '가열하면 α-H 와 OH 가 제거되어 C=O 와 짝지은 α,β-불포화 카보닐 화합물(주로 E)이 생성됩니다.' }] : [])
      ],
      select: ['같은 분자 두 개가 결합한 자기 알돌 생성물로, 탄소 수가 두 배가 됩니다.', ...(c.kind === 'ketone' ? ['케톤의 알돌 첨가는 평형이 불리해 수율이 낮으며, 가열하여 탈수(축합)시키면 평형이 생성물 쪽으로 이동합니다.'] : []), '서로 다른 두 카보닐을 섞으면 네 가지 생성물이 생깁니다. 한쪽을 LDA 로 먼저 엔올레이트로 만들거나(방향성 알돌), α-H 가 없는 벤즈알데하이드를 짝으로 씁니다.'],
      modern: [{ y: '2000 · 2021', t: '아미노산 프롤린 하나로 한쪽 거울상 알돌 생성물을 얻는 유기 촉매 반응(List 외, 2000)이 "비대칭 유기촉매"를 열었고, 리스트 · 맥밀런이 2021 노벨 화학상을 받았습니다.' }]
    };
  };
}
function claisen(mol, S) {
  const es = S.carbonyls.filter(x => x.kind === 'ester');
  if (!es.length) return none('에스터가 없습니다.');
  const e = es[0];
  const alphas = carbonNbrs(mol, e.c).filter(j => mol.atoms[j].h >= 2);
  if (!alphas.length) return none('α 탄소에 H 가 둘 이상 필요합니다 (생성물의 산성 H 가 탈양성자화되며 평형이 생성물 쪽으로 이동하기 때문).');
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
    steps: [{ t: '에스터 엔올레이트', d: 'NaOEt 가 α-H 를 제거합니다.' }, { t: '첨가–제거', d: '엔올레이트가 다른 에스터의 카보닐 탄소를 공격한 뒤 알콕사이드가 이탈하여 β-케토 에스터가 생성됩니다.' }, { t: '구동력', d: '두 C=O 사이의 H (pKa 약 11)가 탈양성자화되면서 평형이 생성물 쪽으로 이동합니다. 마지막에 산으로 처리합니다.' }],
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
        if (bd && bd.o === 1 && !R.same(c2, c3) && R.of[c1] < 0 && R.of[c4] < 0) diene = diene || [c1, c2, c3, c4];
      }
    }
    if (!diene) return none('짝지은 다이엔 C=C–C=C 가 없습니다 (예: 뷰타-1,3-다이엔). 고리형 다이엔은 이중 고리 생성물이 되므로 여기서는 다루지 않습니다.');
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
        { t: 's-cis 다이엔', d: '다이엔은 두 이중결합이 같은 쪽을 향하는 s-cis 형태여야 반응합니다.' },
        { t: '두 σ 결합의 동시 형성', d: '다이엔 양 끝(C1 · C4)과 친다이엔체의 두 탄소 사이에 σ 결합 두 개가 동시에 형성되고, C2=C3 에 새 π 결합이 생겨 육원자 고리가 만들어집니다.' }
      ],
      select: ['친다이엔체의 cis/trans 배치가 생성물에 보존됩니다 (입체특이적).', '엔도 규칙: 고리 다이엔(사이클로펜타다이엔 등)과 C=O 가 붙은 친다이엔체에서는 C=O 가 다이엔 아래쪽을 향하는 엔도 생성물이 주로 생깁니다. 사슬 다이엔 · 단순 친다이엔체에서는 엔도 선택성이 작고, "이차 궤도 상호작용" 설명은 계산 연구에서 논쟁 중입니다.', ...(dp !== 'ethene' ? ['위치: 다이엔 C1 치환기 → "오쏘"(1,2), C2 치환기 → "파라"(1,4) 생성물이 주생성물.'] : ['에텐은 반응성이 낮아 높은 온도 · 압력이 필요합니다. C=O 같은 전자 끄는 기가 붙은 친다이엔체가 빠릅니다.'])],
      modern: [{ y: '2011', t: '자연에서 디엘스–알더 반응만 골라 촉매하는 효소(SpnF)가 처음 확인되었습니다 (Kim 외, Nature 2011). 이후 여러 "디엘스–알더레이스"가 발견되었습니다.' }]
    };
  };
}

/* ── 현대 C–C · C–N 결합 ───────────────────────── */
function coupling(kind) {
  return (mol, S) => {
    const sites = kind === 'suzuki' ? [...S.arylHalides, ...S.vinylHalides] : S.arylHalides;
    if (kind === 'metathesis') return metathesis(mol, S);
    if (!sites.length) return none(kind === 'suzuki' ? '방향족 · 바이닐 할로젠화물(sp² 탄소의 Br · I)이 없습니다.' : '방향족 할로젠화물(벤젠 고리의 Br · I)이 없습니다.');
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
      suzuki: ['스즈키 짝지음 (Pd)', '페닐보론산 PhB(OH)₂', [{ t: '산화적 첨가', d: 'Pd(0) 가 C–X 결합에 삽입되어 Ar–Pd(II)–X 가 생성됩니다.' }, { t: '금속 교환 (트랜스메탈화)', d: '염기로 활성화된 보론산의 페닐기가 Pd 로 이동합니다.' }, { t: '환원적 제거', d: '두 탄소 사이에 결합이 생기며 Ar–Ph 가 방출되고 Pd(0) 가 재생됩니다 (촉매 순환).' }], [{ y: '2010', t: '헥 · 네기시 · 스즈키가 Pd 촉매 교차 짝지음으로 노벨 화학상. 붕소 시약이 독성이 낮고 물에서도 되어 의약품 합성에서 가장 많이 쓰이는 C–C 결합 반응입니다.' }]],
      heck: ['헥 반응 (Pd)', '아크릴산 메틸 CH₂=CHCOOCH₃', [{ t: '산화적 첨가', d: 'Pd(0) 가 Ar–X 결합에 삽입됩니다.' }, { t: '이동 삽입', d: '알켄이 Pd–Ar 결합에 삽입되어 Ar 이 알켄의 말단 탄소에 결합합니다.' }, { t: 'β-수소 제거', d: 'β-수소 제거로 C=C 가 다시 생성되며 주로 trans(E) 입니다.' }], [{ y: '2010', t: '헥 반응도 2010 노벨상의 한 축입니다. 할로젠화 아릴과 알켄을 직접 잇습니다.' }]],
      sono: ['소노가시라 짝지음 (Pd/Cu)', '페닐아세틸렌', [{ t: 'Pd 순환', d: '산화적 첨가 → 구리 아세틸라이드에서 금속 교환 → 환원적 제거.' }], [{ y: '1975 · 현대', t: '다이아릴 알카인을 만드는 표준 방법. 유기 전자 재료 · 의약품에 널리 씁니다.' }]],
      buchwald: ['버크월드–하트위그 아민화 (Pd)', '다이메틸아민', [{ t: 'Pd 순환', d: 'Ar–X 에 Pd 가 산화적 첨가한 뒤 아민이 배위 · 탈양성자화되고, 환원적 제거로 Ar–N 결합이 형성됩니다.' }], [{ y: '1995 · 현대', t: '아릴 아민을 만드는 가장 일반적인 방법이 되었습니다 (예전엔 SNAr 이 되는 전자 부족한 고리만 가능).' }, { y: '2018', t: '교과서의 SNAr 은 마이젠하이머 중간체를 거친다고 배우지만, 많은 경우 한 단계 협동 메커니즘이라는 것이 동위원소 효과 측정으로 밝혀졌습니다 (Kwan · Jacobsen 외, Nature Chemistry 2018).' }]]
    }[kind];
    return { mech: T[0], sites: [s.c, s.x], products: [product(p, 'major', { tag: kind })], steps: T[2], select: [`짝지음 상대: ${T[1]}. 할로젠 반응성 I > Br > Cl (Cl 은 전자가 풍부한 리간드가 필요).`, ...(kind === 'heck' ? ['입체: 새 C=C 는 주로 E.'] : [])], modern: T[3] };
  };
}
function metathesis(mol, S) {
  const term = S.alkenes.filter(e => !e.ring).map(e => {
    const t = mol.atoms[e.a].h === 2 && carbonNbrs(mol, e.a, e.b).length === 0 ? e.a : mol.atoms[e.b].h === 2 && carbonNbrs(mol, e.b, e.a).length === 0 ? e.b : -1;
    return t < 0 ? null : { t, i: t === e.a ? e.b : e.a };
  }).filter(Boolean);
  if (!term.length) return none('말단 알켄(–CH=CH₂)이 없습니다. 복분해 계산은 말단 알켄에 적용됩니다.');
  const base = { mech: '올레핀 복분해 (그럽스 촉매)', steps: [{ t: '금속 카벤', d: 'Ru=CHR 촉매가 알켄과 [2+2] 고리화 첨가하여 메탈라사이클로뷰테인을 만듭니다.' }, { t: '역 [2+2] 분해', d: '메탈라사이클로뷰테인이 반대 방향으로 분해되며 알킬리덴이 교환됩니다. 에텐 기체가 빠져나가 평형이 생성물 쪽으로 이동합니다.' }], modern: [{ y: '2005', t: '쇼뱅 · 그럽스 · 슈록이 올레핀 복분해로 노벨 화학상. 고리 닫기 복분해(RCM)는 큰 고리 의약품 합성의 표준 도구가 되었습니다.' }] };
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
      return { ...base, mech: '고리 닫기 복분해 (RCM)', sites: [p.i, q.i], products: [product(prods[0], 'major', { tag: 'RCM' }), product(eth, 'side', { tag: '에텐' })], select: [`두 말단 알켄 사이의 거리가 ${size}원자 고리 형성에 적합하여 고리가 닫힙니다.`] };
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
  return { ...base, mech: '교차(자기) 복분해', sites: [x.i], products: [product(prods[0], 'major', { tag: '복분해' }), product(eth, 'side', { tag: '에텐' })], select: ['같은 알켄 두 분자가 알킬리덴을 교환하여 내부 C=C 가 생성됩니다 (주로 E).'] };
}
function pathLen(mol, u, v) {
  const d = new Map([[u, 0]]), q = [u];
  while (q.length) { const i = q.shift(); if (i === v) return d.get(i); for (const { j } of mol.nb[i]) if (!d.has(j)) { d.set(j, d.get(i) + 1); q.push(j); } }
  return 99;
}


/* ═══ 브루스 · 스미스의 나머지 핵심 반응 ═══════════════════ */
/* ── 에폭사이드 개환 ── */
function openEpoxideAt(mol, ep, at, nu) {
  const m = work(mol);
  m.atoms[at].key = true;
  cut(m, at, ep.o); m.atoms[ep.o].h += 1;
  let nuAtom;
  if (nu === 'H') { m.atoms[at].h += 1; m.atoms[at].nw = true; nuAtom = -1; }
  else nuAtom = graft(m, at, nu, 1, false);
  /* 뒤쪽 공격: 공격받은 탄소의 배열 반전 */
  if (chiralOK(mol, at)) { const chi = mol.atoms[at].chi; m.atoms[at] = { ...m.atoms[at], chi: { n: chi.n.map(j => j === ep.o ? nuAtom : j), s: -chi.s } }; }
  return finish(m)[0];
}
function epoxideOpen(kind) {
  return (mol, S) => {
    if (!S.epoxides.length) return none('에폭사이드(C–O–C 삼원자 고리)가 없습니다. 알켄에 mCPBA 를 먼저 반응시켜 만들 수 있습니다.');
    const ep = S.epoxides[0];
    const acid = kind === 'h3o' || kind === 'meoh_h';
    const nu = { h3o: 'O', meoh_h: 'OC', meo: 'OC', lah: 'H', grig: 'C' }[kind];
    const sa = cationScore(mol, ep.a), sb = cationScore(mol, ep.b);
    const [more, less] = sa >= sb ? [ep.a, ep.b] : [ep.b, ep.a];
    const res = { products: [], steps: [], select: [], modern: [], sites: [ep.a, ep.b, ep.o] };
    if (acid) {
      const gap = Math.abs(sa - sb);
      res.products.push(product(openEpoxideAt(mol, ep, more, nu), 'major', { tag: gap ? '더 치환된 쪽 공격' : '공격' }));
      /* 2차 · 1차처럼 차이가 작으면 반대쪽도 섞이고, 같으면(대칭) 두 탄소가 반반 */
      if (gap > 0 && gap <= 10) res.products.push(product(openEpoxideAt(mol, ep, less, nu), 'minor', { tag: '덜 치환된 쪽 공격' }));
      if (!gap) res.products.push(product(openEpoxideAt(mol, ep, less, nu), 'major', { tag: '공격' }));
      res.mech = '산 촉매 에폭사이드 개환 (SN1 성격의 SN2)';
      res.steps = [
        { t: '양성자화', d: '에폭사이드 산소가 양성자화되어 좋은 이탈기가 됩니다. C–O 결합이 늘어나며 더 치환된 탄소가 부분 양전하를 더 많이 가집니다.' },
        { t: '후면 공격', d: `${kind === 'h3o' ? '물' : '메탄올'}이 양전하를 더 많이 가진 ${b('더 치환된 탄소')}를 O 의 반대편(후면)에서 공격하므로 그 탄소의 배열이 반전됩니다 (anti).` }
      ];
    } else {
      res.products.push(product(openEpoxideAt(mol, ep, less, nu), 'major', { tag: sa === sb ? '공격' : '덜 치환된 쪽 공격' }));
      if (sa === sb) res.products.push(product(openEpoxideAt(mol, ep, more, nu), 'major', { tag: '공격' }));
      res.mech = { meo: 'SN2 에폭사이드 개환 (염기)', lah: 'SN2 에폭사이드 개환 (H⁻)', grig: 'SN2 에폭사이드 개환 (C–C 결합)' }[kind];
      res.steps = [
        { t: 'SN2 공격', d: `${{ meo: 'CH₃O⁻', lah: 'H⁻ (LiAlH₄)', grig: 'CH₃⁻ (CH₃MgBr)' }[kind]} 가 입체 장애가 적은 ${b('덜 치환된 탄소')}를 후면에서 공격합니다. 삼원자 고리의 고리 긴장(약 110 kJ/mol) 때문에 일반적으로 나쁜 이탈기인 알콕사이드가 이탈할 수 있습니다.` },
        { t: '양성자화', d: '산 처리로 알콕사이드를 양성자화합니다.' }
      ];
      if (kind === 'grig') res.select.push('그리냐르 시약 + 에폭사이드: 새 C–C 결합이 생기며 탄소가 두 개 늘어난 알코올이 생성됩니다.');
      if (kind === 'lah') res.select.push('H⁻ 가 덜 치환된 탄소를 공격하므로 OH 는 더 치환된 탄소에 남습니다 (마르코브니코프 배향의 알코올).');
    }
    res.select.unshift('위치선택성: 산성 조건 → 더 치환된 탄소 (부분 양전하 안정화), 염기성 · 강한 친핵체 → 덜 치환된 탄소 (SN2, 입체 장애).', '입체: 공격받은 탄소의 배열이 반전되어 두 치환기는 anti 관계이며, 고리 에폭사이드에서는 trans-1,2-이치환체가 생성됩니다.');
    res.modern.push({ y: '1997 · 현대', t: '제이콥슨의 (salen)Co 촉매 가수분해 분할(HKR)은 라세미 말단 에폭사이드에서 한쪽 거울상만 물과 반응시켜 두 거울상을 나눕니다. 에폭사이드 개환는 베타 차단제 같은 의약품의 1,2-아미노알코올을 만드는 대표 반응입니다.' });
    return res;
  };
}
/* ── 에터 절단 (HI) ── */
function etherCleave(mol, S) {
  if (!S.ethers.length) return none('에터(C–O–C)가 없습니다. (에스터 · 에폭사이드는 여기서 다루지 않습니다.)');
  const m = work(mol);
  let any = false;
  for (const { o, c1, c2 } of S.ethers) {
    const arom = [c1, c2].map(c => mol.nb[c].some(n => mol.bonds[n.k].arom));
    if (arom[0] && arom[1]) continue;
    let k = 0;
    for (const [c, ar] of [[c1, arom[0]], [c2, arom[1]]]) {
      if (ar) continue;
      cut(m, c, o); graft(m, c, 'I', 1, false); m.atoms[c].key = true; k++;
    }
    if (k === 2) m.atoms[o].dead = true; else m.atoms[o].h += k;
    any = true;
  }
  if (!any) return none('다이아릴 에터는 C(방향족)–O 결합이 끊어지지 않습니다.', { mech: '반응 없음' });
  const prods = finish(m).filter(p => p.atoms.length > 0);
  return {
    mech: '산성 에터 절단', sites: S.ethers.map(e => e.o), products: prods.map(p => product(p, 'major', { tag: 'HI' })),
    steps: [
      { t: '양성자화', d: 'HI 가 에터 산소를 양성자화하여 좋은 이탈기(알코올)를 만듭니다.' },
      { t: 'I⁻ 공격', d: '메틸 · 1차 탄소 쪽은 I⁻ 의 SN2 로, 3차 · 벤질 탄소 쪽은 탄소 양이온을 거치는 SN1 으로 절단됩니다.' },
      { t: '두 번째 절단', d: 'HI 가 과량이면 생성된 알코올도 아이오딘화 알킬로 전환됩니다. 방향족 C–O 결합은 끊어지지 않으므로 페놀이 남습니다.' }
    ],
    select: ['산의 세기 · 친핵성: HI > HBr ≫ HCl. 에터는 염기 · 산화제 · 환원제에 안정하여 용매로 쓰이지만 진한 HI · HBr 에 의해 절단됩니다.'],
    modern: [{ y: '현대', t: '아릴 메틸 에터(아니솔 류)의 메틸기를 제거해 페놀로 만들 때는 BBr₃ 가 표준 시약입니다 (천연물 · 의약품 합성).' }]
  };
}
/* ── 카보닐 첨가: 사이아노하이드린 · 아세탈 ── */
function cyanohydrin(mol, S) {
  const cs = S.carbonyls.filter(x => x.kind === 'aldehyde' || x.kind === 'ketone');
  if (!cs.length) return none('알데하이드 · 케톤이 없습니다.');
  const m = work(mol);
  for (const { c, f } of cs) { const O = f.oxo[0]; setBond(m, c, O, 1); m.atoms[O].h = 1; graft(m, c, 'C#N', 1, false); m.atoms[c].key = true; }
  return {
    mech: '사이아노하이드린 생성 (친핵성 첨가)', sites: cs.map(x => x.c), products: rolesByKey(finish(m), 'HCN'),
    steps: [{ t: 'CN⁻ 공격', d: '사이안화 이온이 카보닐 탄소를 공격하여 알콕사이드가 생성됩니다.' }, { t: '양성자화', d: 'HCN(또는 산)이 알콕사이드를 양성자화합니다. 가역 반응이므로 입체 장애가 큰 케톤에서는 평형이 불리합니다.' }],
    select: ['평면 C=O 의 양면에서 공격이 일어나므로 새 입체중심은 라세미입니다.', '가수분해하면 α-하이드록시산, LiAlH₄ 로 환원하면 β-아미노알코올이 되어 탄소 사슬을 하나 늘리는 방법으로 쓰입니다.'],
    modern: [{ y: '현대', t: '하이드록시나이트릴 분해효소(HNL)로 한쪽 거울상 사이아노하이드린만 만드는 방법이 산업에 쓰이고, 실험실에서는 독성이 큰 HCN 대신 TMSCN 을 흔히 씁니다.' }]
  };
}
function acetal(mol, S) {
  const cs = S.carbonyls.filter(x => x.kind === 'aldehyde' || x.kind === 'ketone');
  if (!cs.length) return none('알데하이드 · 케톤이 없습니다.');
  const m = work(mol);
  for (const { c, f } of cs) { const O = f.oxo[0]; m.atoms[O].dead = true; bondBetween(m, c, O).dead = true; graft(m, c, 'OC', 1, false); graft(m, c, 'OC', 1, false); m.atoms[c].key = true; }
  return {
    mech: '아세탈 생성 (산 촉매)', sites: cs.map(x => x.c), products: rolesByKey(finish(m), '아세탈'),
    steps: [
      { t: '헤미아세탈', d: '산 촉매 하에서 CH₃OH 가 C=O 에 첨가되어 헤미아세탈(한 탄소에 OH 와 OCH₃)이 생성됩니다.' },
      { t: '옥소카베늄 이온', d: 'OH 가 양성자화되어 물로 이탈하고, 이웃 산소의 비공유 전자쌍이 양전하를 안정화합니다.' },
      { t: '두 번째 CH₃OH', d: '두 번째 메탄올이 첨가되고 탈양성자화되어 아세탈이 생성됩니다.' }
    ],
    select: ['가역 반응입니다. 물을 제거하면(딘–스타크 장치) 아세탈이, 묽은 산 수용액에서는 카보닐 화합물이 생성됩니다.', '아세탈은 염기 · 그리냐르 시약 · LiAlH₄ 에 안정하므로 카보닐 보호기로 씁니다 (실제로는 에틸렌 글라이콜로 고리형 아세탈을 주로 만듦).'],
    modern: [{ y: '생화학', t: '포도당의 고리 구조는 분자 내 헤미아세탈이고, 녹말 · 셀룰로스의 글리코사이드 결합은 아세탈입니다.' }]
  };
}
/* ── 바이어–빌리거 산화 ── */
function baeyer(mol, S) {
  const ks = S.carbonyls.filter(x => x.kind === 'ketone' || x.kind === 'aldehyde');
  if (!ks.length) return none('케톤 · 알데하이드가 없습니다.');
  const { c, kind } = ks[0];
  const m = work(mol);
  m.atoms[c].key = true;
  if (kind === 'aldehyde') {
    m.atoms[c].h -= 1; graft(m, c, 'O', 1, false);
    return { mech: '바이어–빌리거 산화 (H 이동)', sites: [c], products: [product(finish(m)[0], 'major', { tag: '산화' })], steps: [{ t: 'H 이동', d: '알데하이드에서는 H 의 이동 적성이 가장 커서 카복실산이 생성됩니다.' }], select: ['이동 적성: H > 3차 > 2차 ≈ 페닐 > 1차 > 메틸.'], modern: [] };
  }
  const aryl = j => mol.nb[j].some(n => mol.bonds[n.k].arom);
  const apt = j => aryl(j) ? 3.1 : Math.min(4, classOf(mol, j));
  const groups = carbonNbrs(mol, c).sort((p, q) => apt(q) - apt(p));
  const g = groups[0];
  const o = graft(m, c, 'O', 1, false); m.atoms[o].h = 0;
  cut(m, c, g); addBond(m, o, g, 1);
  /* 옮겨 가는 탄소의 배열은 그대로 */
  if (chiralOK(mol, g)) { const chi = mol.atoms[g].chi; m.atoms[g] = { ...m.atoms[g], chi: { n: chi.n.map(j => j === c ? o : j), s: chi.s } }; }
  const lab = aryl(g) ? '페닐(아릴)' : ['', '메틸', '1차 알킬', '2차 알킬', '3차 알킬'][apt(g)];
  return {
    mech: '바이어–빌리거 산화 (케톤 → 에스터)', sites: [c, g], products: [product(finish(m)[0], 'major', { tag: '산화' })],
    steps: [
      { t: '크리기 중간체', d: '과산(mCPBA)이 카보닐 탄소에 첨가되어 사면체 중간체(크리기 중간체)를 만듭니다.' },
      { t: '1,2-이동', d: `카보닐 탄소의 치환기(${lab})가 인접한 산소로 1,2-이동하며 카복실레이트가 이탈합니다. 이동하는 탄소의 배열은 유지됩니다.` }
    ],
    select: [`이동 적성: H > 3차 > 2차 ≈ 페닐 > 1차 > 메틸 — 여기서는 ${lab} 쪽에 산소가 삽입됩니다.`, '케톤 → 에스터, 고리 케톤 → 고리가 한 원자 커진 락톤 (예: 사이클로헥산온 → ε-카프로락톤, 나일론 6 원료).'],
    modern: [{ y: '현대', t: 'mCPBA 대신 과산화수소 + 루이스산, 또는 바이어–빌리거 모노옥시제네이스(BVMO) 효소로 폐기물을 줄이고 한쪽 거울상 락톤을 만듭니다.' }]
  };
}
/* ── 길만 시약: 짝(1,4-) 첨가 · 산 염화물 → 케톤 ── */
function gilman(mol, S) {
  const m = work(mol);
  if (S.enones.length) {
    const e = S.enones[0];
    setBond(m, e.alpha, e.beta, 1); m.atoms[e.alpha].h += 1; graft(m, e.beta, 'C', 1, false); m.atoms[e.beta].key = true;
    return {
      mech: '짝지은 첨가 (1,4-첨가)', sites: [e.co, e.alpha, e.beta], products: rolesByKey(finish(m), '길만'),
      steps: [{ t: 'β 탄소 공격', d: '무른 친핵체인 (CH₃)₂CuLi 는 카보닐 탄소가 아닌 β 탄소를 공격하여 엔올레이트를 만듭니다.' }, { t: '양성자화', d: '산 처리로 엔올레이트가 양성자화되어 카보닐 화합물이 됩니다.' }],
      select: ['그리냐르 · 유기리튬(단단한 친핵체)은 C=O 에 직접(1,2-첨가), 길만 시약(무른 친핵체)은 β 탄소에(1,4-첨가) 첨가됩니다.', 'β 탄소가 새 입체중심이면 라세미.'],
      modern: [{ y: '현대', t: '구리 · 로듐 촉매와 키랄 리간드로 한쪽 거울상만 만드는 비대칭 짝지은 첨가(예: 페링하의 Cu 촉매 그리냐르 짝지은 첨가)가 널리 쓰입니다.' }]
    };
  }
  const ac = S.carbonyls.find(x => x.kind === 'acylhalide');
  if (ac) {
    const x = ac.f.halo[0]; m.atoms[x].dead = true; bondBetween(m, ac.c, x).dead = true; graft(m, ac.c, 'C', 1, false); m.atoms[ac.c].key = true;
    return { mech: '아실 치환 (산 염화물 → 케톤)', sites: [ac.c], products: rolesByKey(finish(m), '길만'), steps: [{ t: '단일 치환', d: '길만 시약은 산 염화물의 Cl 만 치환하고 케톤 단계에서 멈춥니다. 그리냐르 시약은 두 번 첨가되어 3차 알코올을 줍니다.' }], select: ['산 염화물 → 케톤.'], modern: [] };
  }
  return none('α,β-불포화 카보닐(C=C–C=O)이나 산 염화물이 없습니다. 길만 시약은 일반적으로 케톤 · 알데하이드의 C=O 에 첨가되지 않습니다.');
}
/* ── α-탄소: 브로민화 · 할로폼 · LDA 알킬화 ── */
function alphaBr(mol, S) {
  if (!S.alphaCO.length) return none('α-H 를 가진 알데하이드 · 케톤이 없습니다.');
  const x = S.alphaCO[0];
  const al = x.alphas.slice().sort((p, q) => mol.atoms[p].h - mol.atoms[q].h)[0];
  const m = work(mol); graft(m, al, 'Br'); m.atoms[al].key = true;
  return {
    mech: '산 촉매 α-할로젠화 (엔올 경유)', sites: [x.c, al], products: rolesByKey(finish(m), 'α-Br'),
    steps: [{ t: '엔올 (속도 결정 단계)', d: '산 촉매로 케톤이 엔올화됩니다. 더 치환된(열역학적으로 안정한) 엔올이 우세합니다.' }, { t: 'Br₂ 공격', d: '엔올의 C=C 가 Br₂ 를 공격하여 α-브로모 카보닐 화합물과 HBr 이 생성됩니다.' }],
    select: ['산성 조건에서는 한 번만 치환됩니다 (도입된 Br 이 다음 엔올화를 느리게 함). 엔올화가 속도 결정 단계이므로 속도는 [Br₂] 와 무관합니다.', '염기성 조건에서는 할로젠이 도입될수록 α-H 의 산성도가 커져 다중 치환되며, 메틸 케톤은 할로폼 반응을 합니다.'],
    modern: [{ y: '현대', t: '유기 촉매(키랄 아민의 엔아민 경유)로 한쪽 거울상의 α-할로젠화 · α-작용기화를 하는 방법이 2000년대 이후 발전했습니다 (2021 노벨상 분야).' }]
  };
}
function haloform(mol, S) {
  if (!S.methylKetones.length) return none('메틸 케톤(CH₃–C(=O)–R)이 없습니다. 할로폼 반응은 메틸 케톤에서만 일어납니다.');
  const { c } = S.methylKetones[0];
  const me = carbonNbrs(mol, c).find(j => mol.atoms[j].h === 3);
  const m = work(mol);
  m.atoms[me].dead = true; bondBetween(m, c, me).dead = true; graft(m, c, 'O', 1, false); m.atoms[c].key = true;
  const chi3 = parseSmiles('IC(I)I'); layout(chi3);
  return {
    mech: '할로폼 반응', sites: [c, me], products: [...rolesByKey(finish(m), '할로폼'), product(chi3, 'side', { tag: '노란색 침전' })],
    steps: [
      { t: 'α-아이오딘화 (3회)', d: 'OH⁻ 가 α-H 를 제거하고 엔올레이트가 I₂ 와 반응합니다. I 가 도입될수록 남은 α-H 의 산성도가 커져 CH₃ 가 CI₃ 로 바뀝니다.' },
      { t: 'C–C 절단', d: 'OH⁻ 가 C=O 를 공격하고 CI₃⁻ (세 I 의 전자 끄는 효과로 안정화된 이탈기)가 이탈합니다.' },
      { t: '산 처리', d: '카복실레이트가 카복실산이 되고, CHI₃(아이오도폼)는 노란색 고체로 침전합니다.' }
    ],
    select: ['메틸 케톤 CH₃C(=O)R → RCOOH (탄소 하나 적음) + CHI₃.', '아이오도폼 시험: 노란색 침전은 메틸 케톤 또는 CH₃CH(OH)– 구조의 알코올(먼저 산화됨)이 있음을 나타냅니다.'],
    modern: []
  };
}
function ldaAlkyl(mol, S) {
  const cand = S.carbonyls.filter(x => ['ketone', 'aldehyde', 'ester'].includes(x.kind)).map(x => ({ x, al: carbonNbrs(mol, x.c).filter(j => mol.atoms[j].h > 0 && mol.nb[j].every(n => n.o === 1) && !(x.kind === 'ester' && j === x.f.OR[0]?.c)) })).filter(y => y.al.length);
  if (!cand.length) return none('α-H 가 있는 케톤 · 에스터가 없습니다.');
  const { x, al } = cand[0];
  const target = al.slice().sort((p, q) => mol.atoms[q].h - mol.atoms[p].h)[0];
  const m = work(mol); graft(m, target, 'C'); m.atoms[target].key = true;
  return {
    mech: '엔올레이트 알킬화 (동역학적 조절)', sites: [x.c, target], products: rolesByKey(finish(m), 'LDA'),
    steps: [
      { t: '동역학적 엔올레이트', d: '−78 °C 에서 부피 큰 강염기 LDA (짝산 pKa 약 36)가 입체 장애가 작은(덜 치환된) α 탄소의 H 를 빠르고 비가역적으로 제거하여 정량적으로 엔올레이트를 만듭니다.' },
      { t: 'SN2 알킬화', d: '엔올레이트의 α 탄소가 CH₃I 를 SN2 로 공격하여 새 C–C 결합을 만듭니다.' }
    ],
    select: ['동역학적 조절(LDA, −78 °C) → 덜 치환된 α 탄소, 열역학적 조절(NaOEt 등 약한 염기 · 실온 · 평형) → 더 치환된 α 탄소.', 'SN2 이므로 할로젠화 알킬은 메틸 · 1차 · 벤질 · 알릴이 적합합니다.', ...(x.kind === 'aldehyde' ? ['알데하이드는 알돌 반응이 빨라 실제로는 엔아민(스토크)을 거쳐 알킬화합니다.'] : [])],
    modern: [{ y: '현대', t: '키랄 보조기(에번스 옥사졸리디논) · 키랄 상 이동 촉매로 α 탄소에 한쪽 거울상만 알킬화합니다.' }]
  };
}
/* ── 방향족: SNAr · 벤자인 · 다이아조늄 ── */
function ringOf(mol, c) { const R = rings(mol); return R.of[c] >= 0 ? R.list[R.of[c]] : null; }
/* 할로젠 자리 c 의 오쏘 · 파라에 NO₂ 가 있는가 */
function activatedSnAr(mol, c) {
  const ring = ringOf(mol, c); if (!ring) return false;
  const k = ring.indexOf(c), n = ring.length;
  return ring.some((r, i) => { const d = Math.min(Math.abs(i - k), n - Math.abs(i - k)); return (d === 1 || d === 3) && mol.nb[r].some(nb => mol.atoms[nb.j].el === 'N' && mol.atoms[nb.j].q === 1); });
}
function snar(mol, S) {
  if (!S.arylHalides.length) return none('방향족 할로젠화물(방향족 고리에 결합한 F · Cl · Br · I)이 없습니다.');
  const act = S.arylHalides.find(({ c }) => activatedSnAr(mol, c));
  if (!act) return none('할로젠의 오쏘 · 파라에 NO₂ 같은 강한 전자 끄는 기가 없어 SNAr 가 일어나지 않습니다. 활성화기가 없는 할로젠화 아릴은 NaNH₂ (벤자인 경로)를 참고하세요.', { mech: '반응 없음' });
  const m = work(mol);
  m.atoms[act.x].dead = true; bondBetween(m, act.c, act.x).dead = true; graft(m, act.c, 'OC', 1, false); m.atoms[act.c].key = true;
  return {
    mech: '친핵성 방향족 치환 (SNAr, 첨가–제거)', sites: [act.c, act.x], products: rolesByKey(finish(m), 'SNAr'),
    steps: [
      { t: '첨가 (속도 결정 단계)', d: 'CH₃O⁻ 가 할로젠이 결합한 탄소를 공격하여, 음전하가 고리와 오쏘 · 파라 위치의 NO₂ 로 비편재화된 마이젠하이머 착물이 생성됩니다.' },
      { t: '제거', d: '할로젠화 이온이 이탈하며 방향족성이 회복됩니다.' }
    ],
    select: ['NO₂ 가 할로젠의 오쏘 · 파라 위치에 있어야 음전하를 안정화할 수 있습니다 (메타 위치에서는 거의 진행되지 않음). NO₂ 가 많을수록 빠릅니다.', '이탈기 순서는 SN2 와 반대인 F > Cl ≈ Br > I 입니다. 첨가 단계가 속도 결정 단계이고, F 가 탄소의 친전자성을 가장 크게 높이기 때문입니다.'],
    modern: [{ y: '2018', t: '교과서는 마이젠하이머 중간체를 거친다고 가르치지만, 동위원소 효과 측정과 계산으로 많은 SNAr 가 한 단계 협동 메커니즘임이 밝혀졌습니다 (Kwan · Jacobsen 외, Nature Chemistry 2018). 중간체가 뚜렷한 것은 NO₂ 가 여럿이고 이탈기가 F 인 경우처럼 강하게 활성화된 경우입니다.' }]
  };
}
function benzyne(mol, S) {
  const ah = S.arylHalides.find(({ x }) => ['Cl', 'Br', 'I'].includes(mol.atoms[x].el));
  if (!ah) return none('방향족 고리에 결합한 Cl · Br · I 가 없습니다.');
  if (activatedSnAr(mol, ah.c)) {
    const m = work(mol); m.atoms[ah.x].dead = true; bondBetween(m, ah.c, ah.x).dead = true; graft(m, ah.c, 'N', 1, false); m.atoms[ah.c].key = true;
    return { mech: 'SNAr (벤자인 아님)', sites: [ah.c, ah.x], products: rolesByKey(finish(m), 'SNAr'), steps: [{ t: '더 빠른 경로 (SNAr)', d: 'NO₂ 가 할로젠의 o/p 위치에 있으면 NH₂⁻ 가 할로젠이 결합한 탄소를 직접 공격하는 SNAr 가 벤자인 경로보다 훨씬 빠르므로, NH₂ 는 원래 위치(ipso)에만 도입됩니다.' }], select: ['벤자인(자리가 섞임)은 활성화기가 없는 할로젠화 아릴에서 일어납니다.'], modern: [] };
  }
  const ring = ringOf(mol, ah.c);
  const orthos = mol.nb[ah.c].filter(n => ring.includes(n.j) && mol.atoms[n.j].h > 0).map(n => n.j);
  if (!orthos.length) return none('할로젠의 오쏘 탄소에 H 가 없어 벤자인이 생성될 수 없습니다.', { mech: '반응 없음' });
  const make = at => {
    const m = work(mol);
    m.atoms[ah.x].dead = true; bondBetween(m, ah.c, ah.x).dead = true;
    if (at === ah.c) graft(m, at, 'N', 1, false);
    else { m.atoms[ah.c].h += 1; graft(m, at, 'N'); }
    m.atoms[at].key = true;
    return finish(m)[0];
  };
  const list = [];
  for (const o of orthos) { list.push({ at: ah.c, w: 0.5 / orthos.length }); list.push({ at: o, w: 0.5 / orthos.length }); }
  const products = list.map(x => product(make(x.at), 'major', { pct: Math.round(x.w * 1000) / 10, tag: x.at === ah.c ? 'ipso 치환' : 'cine 치환' }));
  return {
    mech: '제거–첨가 (벤자인)', sites: [ah.c, ah.x, ...orthos], products,
    steps: [
      { t: '제거', d: 'NH₂⁻ 가 할로젠의 오쏘 H 를 제거하고 X⁻ 가 이탈하며 벤자인(고리 내의 굽은 삼중결합)이 생성됩니다.' },
      { t: '첨가', d: 'NH₂⁻ 가 삼중결합의 두 탄소 어느 쪽에도 첨가될 수 있어, NH₂ 가 원래 위치(ipso) 또는 이웃 위치(cine)에 도입됩니다.' }
    ],
    select: ['활성화기가 없는 할로젠화 아릴도 반응하지만 위치 이성질체가 섞입니다 (비율은 근삿값).', '¹⁴C 표지 클로로벤젠 실험(로버츠, 1953)으로 벤자인 중간체가 증명되었습니다.'],
    modern: [{ y: '현대', t: '치환된 아린에서 친핵체가 어느 쪽에 붙는지는 "아린 왜곡 모델"(가그 · 호크)로 예측합니다. 요즘은 순한 조건(코바야시 전구체 + 플루오라이드)에서 아린을 만들어 합성에 적극적으로 씁니다.' }]
  };
}
function sandmeyer(kind) {
  return (mol, S) => {
    if (!S.anilines.length) return none('방향족 고리에 결합한 –NH₂ (아닐린)가 없습니다. 나이트로기를 환원하여 만들 수 있습니다.');
    const { n, c } = S.anilines[0];
    const m = work(mol);
    m.atoms[n].dead = true; bondBetween(m, c, n).dead = true;
    const frag = { br: 'Br', cl: 'Cl', cn: 'C#N', oh: 'O', i: 'I', h: null }[kind];
    if (frag) graft(m, c, frag, 1, false); else { m.atoms[c].h += 1; m.atoms[c].nw = true; }
    m.atoms[c].key = true;
    const second = {
      br: 'Cu(I) 의 단일 전자 이동으로 N₂ 가 방출되며 아릴 라디칼이 생성되고, 구리로부터 Br 을 받습니다 (산드마이어 반응, 라디칼 메커니즘).',
      cl: 'Cu(I) 의 단일 전자 이동으로 N₂ 가 방출되며 아릴 라디칼이 생성되고, 구리로부터 Cl 을 받습니다 (산드마이어 반응).',
      cn: 'CuCN 을 쓰면 같은 라디칼 경로로 벤조나이트릴이 생성되며, 가수분해하면 벤조산이 됩니다.',
      oh: '수용액에서 가열하면 N₂ 가 방출되며 생긴 아릴 양이온에 물이 결합하여 페놀이 생성됩니다.',
      i: 'I⁻ 는 구리 촉매 없이도 다이아조늄 이온과 반응하여 아이오도벤젠을 줍니다.',
      h: 'H₃PO₂ 가 수소를 공급하여 N₂⁺ 자리가 H 로 치환됩니다. 방향 지시기로 도입했던 NH₂ 를 제거할 때 씁니다.'
    }[kind];
    return {
      mech: kind === 'h' ? '다이아조늄 환원 (탈아미노)' : kind === 'oh' || kind === 'i' ? '다이아조늄 치환' : '산드마이어 반응',
      sites: [c, n], products: rolesByKey(finish(m), '다이아조늄'),
      steps: [{ t: '다이아조화 (0–5 °C)', d: 'NaNO₂ 와 HCl 에서 생성된 NO⁺ 가 –NH₂ 와 반응하여 아렌다이아조늄 이온 Ar–N₂⁺ 가 생성됩니다. 분해를 막기 위해 0–5 °C 로 유지합니다.' }, { t: 'N₂ 이탈 · 치환', d: second }],
      select: ['N₂ 는 매우 좋은 이탈기이므로 NH₂ 를 Br · Cl · I · CN · OH · H 로 바꿀 수 있어, EAS 만으로는 얻기 어려운 치환 패턴(예: 1,3,5-트라이브로모벤젠)을 합성할 수 있습니다.'],
      modern: [{ y: '현대', t: '폭발 위험이 있는 다이아조늄염을 쌓아 두지 않도록 흐름 반응기(flow chemistry)에서 만들어 바로 쓰고, 구리를 촉매량만 쓰는 방법이 개발되었습니다.' }]
    };
  };
}

/* ── 목록 ────────────────────────────────────── */
export const CATS = [
  { id: 'sn', ko: '치환 · 제거', en: 'SN · E', sub: 'SN1 · SN2 · E1 · E2 · 안티-페리플래너' },
  { id: 'alc', ko: '알코올 · 에터', en: 'ALCOHOLS', sub: '할로젠화 · 탈수 · 산화 · 에폭사이드 · 에터 절단' },
  { id: 'ene', ko: '알켄 첨가', en: 'ALKENES', sub: '마르코브니코프 · syn · anti · 고리 프로페인화 · 절단' },
  { id: 'yne', ko: '알카인', en: 'ALKYNES', sub: '환원 · 수화 · 알킬화' },
  { id: 'co', ko: '카보닐', en: 'CARBONYL', sub: '환원 · 그리냐르 · 비티히 · 아세탈 · 짝지은 첨가' },
  { id: 'acyl', ko: '산 유도체', en: 'ACYL', sub: '첨가–제거 (친핵성 아실 치환)' },
  { id: 'alpha', ko: 'α-탄소', en: 'ENOLATES', sub: 'α-할로젠화 · 할로폼 · LDA · 알돌 · 클라이젠' },
  { id: 'aro', ko: '방향족', en: 'AROMATIC', sub: 'EAS · SNAr · 벤자인 · 다이아조늄' },
  { id: 'rad', ko: '라디칼', en: 'RADICAL', sub: '선택성 계산' },
  { id: 'cc', ko: 'C–C 결합', en: 'C–C BONDS', sub: '디엘스–알더 · Pd 짝지음 · 복분해' }
];
export const REACTIONS = [
  { id: 'nai', can: snCan('NaI'), cat: 'sn', label: 'NaI, 아세톤', note: '핀켈스타인', run: snE('NaI') },
  { id: 'nacn', can: snCan('NaCN'), cat: 'sn', label: 'NaCN, DMSO', note: '나이트릴 (탄소 1개 증가)', run: snE('NaCN') },
  { id: 'nh3', can: snCan('NH3'), cat: 'sn', label: 'NH₃ (과량)', note: '아민', run: snE('NH3') },
  { id: 'naoh', can: snCan('NaOH'), cat: 'sn', label: 'NaOH, H₂O', note: '강염기 · 강친핵체', run: snE('NaOH') },
  { id: 'naome', can: snCan('NaOMe'), cat: 'sn', label: 'NaOCH₃, CH₃OH', note: '강염기 · 강친핵체', run: snE('NaOMe') },
  { id: 'tbuok', can: snCan('tBuOK'), cat: 'sn', label: 't-BuOK, t-BuOH', note: '부피 큰 강염기', run: snE('tBuOK') },
  { id: 'h2o', can: snCan('H2O'), cat: 'sn', label: 'H₂O, 가열', note: '약한 친핵체 (가용매 분해)', run: snE('H2O') },
  { id: 'meoh', can: snCan('MeOH'), cat: 'sn', label: 'CH₃OH, 가열', note: '약한 친핵체', run: snE('MeOH') },
  { id: 'hbr_alc', cat: 'alc', label: 'HBr', note: 'OH → Br', run: alcoholToHalide('HBr') },
  { id: 'pbr3', cat: 'alc', label: 'PBr₃', note: 'OH → Br (SN2)', run: alcoholToHalide('PBr3') },
  { id: 'socl2', cat: 'alc', label: 'SOCl₂, 피리딘', note: 'OH → Cl (SN2)', run: alcoholToHalide('SOCl2') },
  { id: 'h2so4', cat: 'alc', label: 'H₂SO₄, 가열', note: '탈수 → 알켄', run: dehydrate },
  { id: 'pcc', cat: 'alc', label: 'PCC (또는 DMP)', note: '온화한 산화', run: oxidize(false) },
  { id: 'jones', cat: 'alc', label: 'CrO₃, H₂SO₄, H₂O', note: '존스 산화 (강한 산화)', run: oxidize(true) },
  { id: 'nah', cat: 'alc', label: '① NaH ② CH₃I', note: '윌리엄슨 에터', run: williamson },
  { id: 'epo_h3o', cat: 'alc', label: 'H₂O, H₂SO₄ (에폭사이드)', note: '산 촉매 · anti 다이올', run: epoxideOpen('h3o'), can: S => S.epoxides.length },
  { id: 'epo_meoh', cat: 'alc', label: 'CH₃OH, H₂SO₄ (에폭사이드)', note: '산 촉매 · 더 치환된 탄소', run: epoxideOpen('meoh_h'), can: S => S.epoxides.length },
  { id: 'epo_meo', cat: 'alc', label: 'NaOCH₃, CH₃OH (에폭사이드)', note: '염기 · 덜 치환된 탄소', run: epoxideOpen('meo'), can: S => S.epoxides.length },
  { id: 'epo_lah', cat: 'alc', label: '① LiAlH₄ ② H₂O (에폭사이드)', note: 'H⁻ · 덜 치환된 탄소', run: epoxideOpen('lah'), can: S => S.epoxides.length },
  { id: 'epo_grig', cat: 'alc', label: '① CH₃MgBr ② H₃O⁺ (에폭사이드)', note: 'C–C 결합 · 탄소 2개 증가', run: epoxideOpen('grig'), can: S => S.epoxides.length },
  { id: 'hi', cat: 'alc', label: 'HI (과량), 가열', note: '에터 절단', run: etherCleave, can: S => S.ethers.length },
  { id: 'hbr', cat: 'ene', label: 'HBr', note: '마르코브니코프', run: addAlkene('HBr') },
  { id: 'hcl', cat: 'ene', label: 'HCl', note: '마르코브니코프', run: addAlkene('HCl') },
  { id: 'hbrroor', cat: 'ene', label: 'HBr, ROOR', note: '반마르코브니코프', run: addAlkene('HBrROOR') },
  { id: 'hydration', cat: 'ene', label: 'H₂O, H₂SO₄', note: '수화 · 자리옮김 가능', run: addAlkene('H2O') },
  { id: 'ene_meoh', cat: 'ene', label: 'CH₃OH, H₂SO₄', note: '에터 (마르코브니코프)', run: addAlkene('MeOH') },
  { id: 'oxymerc', cat: 'ene', label: '① Hg(OAc)₂, H₂O ② NaBH₄', note: '마르코브니코프, 자리옮김 없음', run: addAlkene('oxymerc') },
  { id: 'hydrobor', cat: 'ene', label: '① BH₃·THF ② H₂O₂, NaOH', note: '반마르코브니코프 · syn', run: addAlkene('hydrobor') },
  { id: 'br2', cat: 'ene', label: 'Br₂, CH₂Cl₂', note: 'anti 첨가', run: addAlkene('Br2') },
  { id: 'cl2', cat: 'ene', label: 'Cl₂, CH₂Cl₂', note: 'anti 첨가', run: addAlkene('Cl2') },
  { id: 'halohydrin', cat: 'ene', label: 'Br₂, H₂O', note: '할로하이드린', run: addAlkene('halohydrin') },
  { id: 'h2pd', cat: 'ene', label: 'H₂, Pd/C', note: '수소화 · syn', run: addAlkene('H2') },
  { id: 'mcpba', cat: 'ene', label: 'mCPBA', note: '에폭시화', run: addAlkene('epox') },
  { id: 'simmons', cat: 'ene', label: 'CH₂I₂, Zn(Cu)', note: '시먼스–스미스 (syn)', run: addAlkene('simmons') },
  { id: 'oso4', cat: 'ene', label: 'OsO₄ (촉매), NMO', note: 'syn 다이올', run: addAlkene('OsO4') },
  { id: 'o3', cat: 'ene', label: '① O₃ ② (CH₃)₂S', note: '오존 분해', run: addAlkene('ozone') },
  { id: 'yne_h2', cat: 'yne', label: 'H₂ (2당량), Pd/C', note: '알케인까지 환원', run: alkyne('H2') },
  { id: 'lindlar', cat: 'yne', label: 'H₂, 린들라 촉매', note: 'cis 알켄', run: alkyne('lindlar') },
  { id: 'nanh3', cat: 'yne', label: 'Na, NH₃(l)', note: 'trans 알켄', run: alkyne('NaNH3') },
  { id: 'yne_hyd', cat: 'yne', label: 'H₂O, H₂SO₄, HgSO₄', note: '케톤 (마르코브니코프)', run: alkyne('hydration') },
  { id: 'yne_hb', cat: 'yne', label: '① (sia)₂BH ② H₂O₂, NaOH', note: '알데하이드', run: alkyne('hydrobor') },
  { id: 'yne_hbr', cat: 'yne', label: 'HBr (2당량)', note: '제미널 다이브로마이드', run: alkyne('HBr2') },
  { id: 'yne_alk', cat: 'yne', label: '① NaNH₂ ② CH₃I', note: 'C–C 결합', run: alkyne('alkylate') },
  { id: 'nabh4', cat: 'co', label: 'NaBH₄, CH₃OH', note: '알데하이드 · 케톤만', run: reduce('NaBH4') },
  { id: 'lialh4', cat: 'co', label: '① LiAlH₄ ② H₂O', note: '강한 환원', run: reduce('LiAlH4') },
  { id: 'dibal', cat: 'co', label: '① DIBAL-H, −78 °C ② H₂O', note: '에스터 → 알데하이드', run: reduce('DIBAL') },
  { id: 'wk', cat: 'co', label: 'H₂NNH₂, KOH, 가열', note: '볼프–키시너 (C=O → CH₂)', run: reduce('WK') },
  { id: 'mgme', cat: 'co', label: '① CH₃MgBr ② H₃O⁺', note: '그리냐르', run: grignard('C', 'CH₃MgBr') },
  { id: 'mget', cat: 'co', label: '① CH₃CH₂MgBr ② H₃O⁺', note: '그리냐르', run: grignard('CC', 'CH₃CH₂MgBr') },
  { id: 'mgph', cat: 'co', label: '① C₆H₅MgBr ② H₃O⁺', note: '그리냐르', run: grignard('c1ccccc1', 'C₆H₅MgBr') },
  { id: 'wittig', cat: 'co', label: 'Ph₃P=CH₂', note: '비티히', run: wittig },
  { id: 'hcn', cat: 'co', label: 'NaCN, HCl', note: '사이아노하이드린', run: cyanohydrin, can: S => S.carbonyls.some(c => c.kind === 'aldehyde' || c.kind === 'ketone') },
  { id: 'acetal', cat: 'co', label: 'CH₃OH (과량), H⁺, −H₂O', note: '아세탈 · 보호기', run: acetal, can: S => S.carbonyls.some(c => c.kind === 'aldehyde' || c.kind === 'ketone') },
  { id: 'bv', cat: 'co', label: 'mCPBA (케톤)', note: '바이어–빌리거', run: baeyer, can: S => S.carbonyls.some(c => c.kind === 'aldehyde' || c.kind === 'ketone') },
  { id: 'gilman', cat: 'co', label: '① (CH₃)₂CuLi ② H₃O⁺', note: '길만 · 1,4-첨가', run: gilman, can: S => S.enones.length || S.carbonyls.some(c => c.kind === 'acylhalide') },
  { id: 'fischer', cat: 'acyl', label: 'CH₃OH, H₂SO₄', note: '피셔 에스터화', run: acyl('fischer') },
  { id: 'socl2_acid', cat: 'acyl', label: 'SOCl₂', note: '산 → 산 염화물', run: acyl('socl2') },
  { id: 'acyl_h2o', cat: 'acyl', label: 'H₂O', note: '산 염화물 가수분해', run: acyl('water') },
  { id: 'acyl_meoh', cat: 'acyl', label: 'CH₃OH, 피리딘', note: '→ 에스터', run: acyl('alcohol') },
  { id: 'acyl_nh3', cat: 'acyl', label: 'NH₃', note: '→ 아마이드', run: acyl('ammonia') },
  { id: 'acyl_mena', cat: 'acyl', label: 'CH₃NH₂', note: '→ N-메틸 아마이드', run: acyl('methylamine') },
  { id: 'sapon', cat: 'acyl', label: '① NaOH, H₂O ② H₃O⁺', note: '비누화', run: acyl('sapon') },
  { id: 'ester_hyd', cat: 'acyl', label: 'H₃O⁺, 가열 (에스터)', note: '산 가수분해 · 평형', run: acyl('esterHyd'), can: S => S.carbonyls.some(c => c.kind === 'ester') },
  { id: 'nitrile_hyd', cat: 'acyl', label: 'H₃O⁺, 가열', note: '나이트릴 → 산', run: acyl('nitrileHyd') },
  { id: 'amide_hyd', cat: 'acyl', label: 'H₃O⁺, 오래 가열', note: '아마이드 → 산', run: acyl('amideHyd') },
  { id: 'br2fe', cat: 'aro', label: 'Br₂, FeBr₃', note: '브로민화', run: eas('Br2') },
  { id: 'cl2fe', cat: 'aro', label: 'Cl₂, FeCl₃', note: '염소화', run: eas('Cl2') },
  { id: 'hno3', cat: 'aro', label: 'HNO₃, H₂SO₄', note: '나이트로화', run: eas('HNO3') },
  { id: 'fcacyl', cat: 'aro', label: 'CH₃COCl, AlCl₃', note: '프리델–크래프츠 아실화', run: eas('FCacyl') },
  { id: 'fcalk', cat: 'aro', label: 'CH₃Cl, AlCl₃', note: '프리델–크래프츠 알킬화', run: eas('FCalk') },
  { id: 'fcpr', cat: 'aro', label: 'CH₃CH₂CH₂Cl, AlCl₃', note: '알킬화 · 양이온 자리옮김', run: eas('FCpr') },
  { id: 'snar', cat: 'aro', label: 'NaOCH₃, CH₃OH, 가열', note: 'SNAr (NO₂ 활성화)', run: snar, can: S => S.arylHalides.length },
  { id: 'benzyne', cat: 'aro', label: 'NaNH₂, NH₃(l)', note: '벤자인 (제거–첨가)', run: benzyne, can: S => S.arylHalides.length },
  { id: 'sand_br', cat: 'aro', label: '① NaNO₂, HCl ② CuBr', note: '산드마이어 → Br', run: sandmeyer('br'), can: S => S.anilines.length },
  { id: 'sand_cn', cat: 'aro', label: '① NaNO₂, HCl ② CuCN', note: '산드마이어 → CN', run: sandmeyer('cn'), can: S => S.anilines.length },
  { id: 'sand_oh', cat: 'aro', label: '① NaNO₂, H₂SO₄ ② H₂O, 가열', note: '다이아조늄 → 페놀', run: sandmeyer('oh'), can: S => S.anilines.length },
  { id: 'sand_i', cat: 'aro', label: '① NaNO₂, HCl ② KI', note: '다이아조늄 → I', run: sandmeyer('i'), can: S => S.anilines.length },
  { id: 'sand_h', cat: 'aro', label: '① NaNO₂, HCl ② H₃PO₂', note: '탈아미노화', run: sandmeyer('h'), can: S => S.anilines.length },
  { id: 'nitrored', cat: 'aro', label: 'H₂, Pd/C (또는 Fe, HCl)', note: 'NO₂ → NH₂', run: aromaticMisc('nitroRed') },
  { id: 'kmno4', cat: 'aro', label: 'KMnO₄, 가열', note: '곁사슬 → COOH', run: aromaticMisc('sideOx') },
  { id: 'nbs', cat: 'aro', label: 'NBS, hν', note: '벤질 · 알릴 브로민화', run: aromaticMisc('NBS') },
  { id: 'cl2hv', cat: 'rad', label: 'Cl₂, hν', note: '생성물 비율 계산', run: radical('Cl') },
  { id: 'br2hv', cat: 'rad', label: 'Br₂, hν', note: '생성물 비율 계산', run: radical('Br') },
  { id: 'alpha_br', cat: 'alpha', label: 'Br₂, CH₃COOH', note: 'α-브로민화 (산)', run: alphaBr, can: S => S.alphaCO.length },
  { id: 'haloform', cat: 'alpha', label: '① I₂ (과량), NaOH ② H₃O⁺', note: '할로폼 (메틸 케톤)', run: haloform, can: S => S.methylKetones.length },
  { id: 'lda', cat: 'alpha', label: '① LDA, THF, −78 °C ② CH₃I', note: '동역학적 알킬화', run: ldaAlkyl, can: S => S.alphaCO.length || S.carbonyls.some(c => c.kind === 'ester') },
  { id: 'aldol', cat: 'alpha', label: 'NaOH, H₂O (5 °C)', note: '알돌 첨가', run: aldol(false), can: S => S.alphaCO.length },
  { id: 'aldolheat', cat: 'alpha', label: 'NaOH, H₂O, 가열', note: '알돌 축합', run: aldol(true), can: S => S.alphaCO.length },
  { id: 'claisen', cat: 'alpha', label: '① NaOCH₂CH₃ ② H₃O⁺', note: '클라이젠 축합', run: claisen, can: S => S.carbonyls.some(c => c.kind === 'ester') },
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
  catch (e) { console.error(e); res = none('이 조합은 현재 계산할 수 없습니다 (' + e.message + ')'); }
  res.id = id; res.reaction = R;
  if (res.ok === undefined) res.ok = res.products.length > 0;
  const seen = new Map();
  const out = [];
  for (const p of res.products) {
    let nm = null, err = null, inorg = false;
    try { nm = nameMolecule(p.mol); } catch (e) { err = e.message; }
    /* 탄소 없는 작은 부산물 */
    if (!nm && p.mol.atoms.length === 1) { const INORG = { N: 'NH₃ (암모니아, 산성에서는 NH₄⁺)', O: 'H₂O (물)', Cl: 'HCl', Br: 'HBr', I: 'HI' }; const t = INORG[p.mol.atoms[0].el]; if (t) { err = t; inorg = true; } }
    const key = nm ? nm.nameEn : Math.random();
    if (seen.has(key)) {
      const q = seen.get(key);
      if (p.pct) q.pct = (q.pct || 0) + p.pct;
      if (p.role === 'major') q.role = 'major';
      continue;
    }
    p.name = nm; p.err = err; p.inorg = inorg;
    p.hl = new Set(p.mol.atoms.map((a, i) => a.nw ? i : -1).filter(i => i >= 0));
    seen.set(key, p);
    out.push(p);
  }
  /* 같은 반응에서 거울상 둘이 함께 나오면 하나로 합쳐 라세미로 */
  for (let i = 0; i < out.length; i++) for (let j = out.length - 1; j > i; j--) {
    const p = out[i], q = out[j];
    if (p.name && q.name && p.name.mirror && p.name.mirror.en === q.name.nameEn && p.role === q.role) {
      p.rac = true; if (q.pct) p.pct = (p.pct || 0) + q.pct;
      out.splice(j, 1);
    }
  }
  const rank = { major: 0, minor: 1, side: 2 };
  out.sort((a, b2) => (rank[a.role] - rank[b2.role]) || ((b2.pct || 0) - (a.pct || 0)));
  res.products = out;
  stereoNotes(mol, res);
  return res;
}
/* 생성물의 입체: 라세미 · 메소 · 부분입체 혼합, 기질 R/S → 생성물 R/S */
function stereoNotes(mol, res) {
  let sub = null;
  try { sub = nameMolecule(mol, { noNotes: true }); } catch { sub = null; }
  for (const p of res.products) {
    const n = p.name;
    if (!n || !n.centers || !n.centers.length) continue;
    const def = (n.rs ? n.rs.size : 0) + (n.pseudo ? n.pseudo.size : 0), undef = n.undef ? n.undef.length : 0;
    if (p.rac && def && !undef) {
      if (n.meso) p.stereoTag = '메소 (분자 내 대칭면 · 광학 비활성)';
      else if (n.relName && n.relName.kind === 'ring') p.stereoTag = `(±)-${n.relName.en} — 두 거울상 이성질체 1:1 (라세미 혼합물)`;
      else if (n.mirror) { p.stereoTag = '(±) 라세미 혼합물 — 거울상 이성질체와 1:1'; p.mirrorName = n.mirror; }
    } else if (undef && !def) p.stereoTag = undef === 1 ? '* 라세미 혼합물 (R : S = 1 : 1)' : '* 입체이성질체 혼합물';
    else if (undef && def) p.stereoTag = '* 새 입체중심의 두 배열이 모두 생성됨 (부분입체이성질체 혼합물)';
    if (p.role === 'major' && sub && sub.rs && sub.rs.size && def && sub.stereo && n.stereo && !p.stereoLine) {
      res.stereoLine = `기질 ${sub.nameEn.match(/^\([^)]*\)/) ? sub.nameEn.match(/^\([^)]*\)/)[0] : '(' + sub.stereo + ')'} → 주생성물 (${n.stereo})`;
    }
  }
}
/* 이 기질에 쓸 수 있는 반응인가 (메뉴에서 흐리게 표시) */
export function applicable(mol, S = scan(mol)) {
  const has = {
    sn: S.halides.length > 0, alc: S.alcohols.length + S.phenols.length > 0, ene: S.alkenes.length > 0, yne: S.alkynes.length > 0,
    co: S.carbonyls.length > 0, acyl: S.carbonyls.some(c => ['acid', 'acylhalide', 'ester', 'nitrile', 'amide'].includes(c.kind)), aro: S.arenes.length > 0,
    rad: mol.atoms.every(a => a.el === 'C') && mol.bonds.every(b2 => b2.o === 1),
    alpha: S.alphaCO.length > 0
  };
  const map = {};
  for (const r of REACTIONS) {
    let ok = r.can ? r.can(S, mol) : has[r.cat];
    if (r.id === 'nitrored') ok = S.nitro.length > 0;
    if (r.cat === 'cc') ok = r.id.startsWith('da') ? S.alkenes.length >= 2 : r.id === 'grubbs' ? S.alkenes.length > 0 : r.id === 'suzuki' ? S.arylHalides.length + S.vinylHalides.length > 0 : S.arylHalides.length > 0;
    if (['pcc', 'jones'].includes(r.id)) ok = S.alcohols.some(a => a.cls <= 2 && mol.atoms[a.c].h > 0) || (r.id === 'jones' && S.carbonyls.some(c => c.kind === 'aldehyde'));
    if (r.id === 'hbr_alc') ok = S.alcohols.length > 0;
    if (['pbr3', 'socl2'].includes(r.id)) ok = S.alcohols.some(a => a.cls <= 2);
    if (r.id === 'h2so4') ok = S.alcohols.some(a => betas(mol, a.c).length > 0);
    if (['mgme', 'mget', 'mgph'].includes(r.id)) ok = S.carbonyls.some(c => ['aldehyde', 'ketone', 'ester', 'acylhalide', 'nitrile'].includes(c.kind)) || S.acidic.length > 0;
    if (r.id === 'grubbs') ok = S.alkenes.some(e => !e.ring && [[e.a, e.b], [e.b, e.a]].some(([t, i]) => mol.atoms[t].h === 2 && carbonNbrs(mol, t, i).length === 0));
    if (r.id === 'nbs') ok = S.benzylic.length > 0 || mol.atoms.some((a, i) => a.el === 'C' && a.h > 0 && mol.nb[i].every(n => n.o === 1) && carbonNbrs(mol, i).some(j => mol.nb[j].some(n => n.o === 2 && mol.atoms[n.j].el === 'C' && !mol.bonds[n.k].arom)));
    if (['fcacyl', 'fcalk', 'fcpr', 'br2fe', 'cl2fe', 'hno3'].includes(r.id) && S.arenes.length) {
      const ring = S.arenes[0].ring, subs = [];
      ring.forEach(ra => { for (const { j } of mol.nb[ra]) if (!ring.includes(j)) subs.push(director(mol, ra, j, S.info)); });
      if (r.id.startsWith('fc')) ok = !subs.some(d => d.w <= -2 || d.amine);
      if (r.id === 'br2fe' || r.id === 'cl2fe') ok = !(S.alkenes.length || S.alkynes.length);
    }
    if (r.id === 'yne_alk') ok = S.alkynes.some(y => y.terminal);
    if (r.id === 'snar') ok = S.arylHalides.some(({ c }) => activatedSnAr(mol, c));
    if (r.id === 'benzyne') ok = S.arylHalides.some(({ c, x }) => ['Cl', 'Br', 'I'].includes(mol.atoms[x].el) && mol.nb[c].some(n => mol.atoms[n.j].h > 0 && mol.nb[n.j].some(q => mol.bonds[q.k].arom)));
    if (r.id === 'lda') ok = S.carbonyls.some(x => ['ketone', 'aldehyde', 'ester'].includes(x.kind) && carbonNbrs(mol, x.c).some(j => mol.atoms[j].h > 0 && mol.nb[j].every(n => n.o === 1)));
    if (r.id === 'claisen') ok = S.carbonyls.some(x => x.kind === 'ester' && carbonNbrs(mol, x.c).some(j => mol.atoms[j].h >= 2));
    if (r.id.startsWith('da_')) ok = !!conjDiene(mol, S);
    if (['nabh4', 'wk'].includes(r.id)) ok = S.carbonyls.some(c => c.kind === 'aldehyde' || c.kind === 'ketone');
    if (r.id === 'dibal') ok = S.carbonyls.some(c => c.kind === 'ester' || c.kind === 'nitrile');
    if (r.id === 'wittig') ok = S.carbonyls.some(c => c.kind === 'aldehyde' || c.kind === 'ketone');
    if (['fischer', 'socl2_acid'].includes(r.id)) ok = S.carbonyls.some(c => c.kind === 'acid');
    if (['acyl_h2o', 'acyl_meoh', 'acyl_mena'].includes(r.id)) ok = S.carbonyls.some(c => c.kind === 'acylhalide');
    if (r.id === 'acyl_nh3') ok = S.carbonyls.some(c => c.kind === 'acylhalide' || c.kind === 'ester');
    if (r.id === 'sapon') ok = S.carbonyls.some(c => c.kind === 'ester');
    if (r.id === 'nitrile_hyd') ok = S.carbonyls.some(c => c.kind === 'nitrile');
    if (r.id === 'amide_hyd') ok = S.carbonyls.some(c => c.kind === 'amide');
    if (r.id === 'kmno4') ok = S.benzylic.length > 0;
    map[r.id] = !!ok;
  }
  return map;
}
