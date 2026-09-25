/* 명명 과정(단계별), 명명 변화, 참고 사항 문장. 결과는 짧은 HTML 조각 (내용은 모두 앱이 만든 글) */
import { CLASS, PRI } from './name.js';

const SUFFIX_OF = {
  acid: ['-oic acid', '-산'], ester: ['-oate', '-산'], acylhalide: ['-oyl chloride', '-오일 클로라이드'], amide: ['-amide', '-아마이드'],
  nitrile: ['-nitrile', '-나이트릴'], aldehyde: ['-al', '-알'], ketone: ['-one', '-온'], alcohol: ['-ol', '-올'], amine: ['-amine', '-아민']
};
const RING_SUFFIX = { acid: '-carboxylic acid', ester: '-carboxylate', acylhalide: '-carbonyl chloride', amide: '-carboxamide', nitrile: '-carbonitrile', aldehyde: '-carbaldehyde' };
const PREFIX_OF = {
  acid: 'carboxy', ester: 'alkoxycarbonyl', acylhalide: 'carbonochloridoyl', amide: 'carbamoyl', nitrile: 'cyano', aldehyde: 'formyl / oxo',
  ketone: 'oxo', alcohol: 'hydroxy', amine: 'amino'
};
const STEMS = ['', 'meth', 'eth', 'prop', 'but', 'pent', 'hex', 'hept', 'oct', 'non', 'dec', 'undec', 'dodec', 'tridec', 'tetradec', 'pentadec', 'hexadec', 'heptadec', 'octadec', 'nonadec', 'icos'];
const STEMS_KO = ['', '메트', '에트', '프로프', '뷰트', '펜트', '헥스', '헵트', '옥트', '논', '데크', '운데크', '도데크', '트라이데크', '테트라데크', '펜타데크', '헥사데크', '헵타데크', '옥타데크', '노나데크', '아이코스'];
const b = s => `<b>${s}</b>`;
const code = s => `<code>${s}</code>`;

/* 조사: 앞말의 받침에 맞춰 이/가 · 은/는 · 을/를 · (으)로. 숫자는 한국어 읽기로 판단 */
const DIGIT_BATCHIM = { 0: 1, 1: 2, 2: 0, 3: 1, 4: 0, 5: 0, 6: 1, 7: 2, 8: 2, 9: 0 };
function batchim(word) {
  const ch = String(word).replace(/[^가-힣0-9]+$/u, '').slice(-1);
  if (/[0-9]/.test(ch)) return DIGIT_BATCHIM[ch];
  const c = ch.charCodeAt(0) - 0xac00;
  if (c < 0 || c > 11171) return 0;
  const f = c % 28;
  return f === 0 ? 0 : f === 8 ? 2 : 1;
}
export function jo(word, kind) {
  const t = batchim(word);
  const P = { 이: ['가', '이'], 은: ['는', '은'], 을: ['를', '을'], 로: ['로', '으로'] }[kind];
  if (kind === '로') return t === 1 ? P[1] : P[0];
  return t ? P[1] : P[0];
}

export function steps(mol, res) {
  if (res.kind === 'chain') return chainSteps(res);
  return ringSteps(res);
}

function classLine(res) {
  const others = [...res.present].filter(c => c !== res.P).sort((a, c) => PRI[a] - PRI[c]);
  if (!res.P) return '접미사로 표시할 작용기(카복실산 · 에스터 · 알데하이드 · 케톤 · 알코올 · 아민 등)가 없으므로 모든 치환기를 접두사로 나타냅니다.';
  let t = `우선순위가 가장 높은 작용기는 ${b(CLASS[res.P].ko)}(${code(CLASS[res.P].fg)})이며, 주 작용기로서 접미사로 표시됩니다.`;
  if (others.length) t += ` 우선순위가 낮은 나머지 작용기(${others.map(c => CLASS[c].ko).join(' · ')})는 접두사(${others.map(c => PREFIX_OF[c].split(' / ')[0] + '-').join(', ')})로 나타냅니다.`;
  return t;
}

const PARENT_WHY = {
  nP: '주 작용기를 가장 많이 포함하는 부분을 모체로 선택합니다.',
  cls: '주 작용기 수가 같으면 고리를 모체로 합니다 (IUPAC 2013). 1993 규칙에서는 탄소 수가 많은 쪽을 모체로 했습니다.',
  ringVsChain: '(1993 규칙) 고리와 사슬 가운데 탄소 수가 많은 쪽을 모체로 합니다.',
  nRings: '고리가 더 많은 고리 집합(바이페닐)이 단일 고리보다 우선합니다.',
  len: '가장 긴 사슬(가장 큰 고리)을 선택합니다 (IUPAC 2013: 사슬 길이가 불포화도보다 우선).',
  mult: '길이가 같으면 다중결합을 더 많이 포함하는 사슬을 선택합니다.',
  len2: '(1993 규칙) 다중결합을 최대로 포함하는 사슬을 먼저 선택하고, 그다음 길이를 비교합니다.',
  dbl: '다중결합 수도 같으면 이중결합이 더 많은 사슬을 선택합니다.',
  pLoc: '주 작용기에 더 낮은 위치번호가 주어지는 사슬을 선택합니다.', multLoc: '다중결합에 더 낮은 위치번호가 주어지는 사슬을 선택합니다.', dblLoc: '이중결합에 더 낮은 위치번호가 주어지는 사슬을 선택합니다.',
  nPre: '길이와 불포화도가 같으면 치환기가 더 많은 사슬을 선택합니다.', preLoc: '치환기 위치번호 집합이 더 낮은 사슬을 선택합니다.', alpha: '알파벳순으로 먼저 오는 치환기에 낮은 위치번호가 주어지는 사슬을 선택합니다.'
};
function chainSteps(res) {
  const out = [];
  out.push({ k: '주 작용기', t: classLine(res) + (res.P ? ` → 접미사 ${code(res.tri ? '-(tri)' + (RING_SUFFIX[res.P] || '').slice(1) : SUFFIX_OF[res.P][0])}` : '') });
  if (res.tri) out[0].t += ` 같은 작용기가 ${res.pLocs.length}개이므로 해당 탄소를 주사슬에 포함하지 않고 ${code('-tricarboxylic acid')} 형식으로 명명합니다.`;
  const n = res.n;
  let t = `주사슬 탄소 ${b(n + '개')} → 어근 ${code(STEMS[n] || n)} (${STEMS_KO[n] || ''}).`;
  if (res.why.chain && PARENT_WHY[res.why.chain]) t += ' ' + PARENT_WHY[res.why.chain];
  if (res.enes.length || res.ynes.length) t += ` 주사슬의 다중결합: ${res.enes.length ? `이중결합 ${res.enes.length}개(${code('-ene')})` : ''}${res.enes.length && res.ynes.length ? ' · ' : ''}${res.ynes.length ? `삼중결합 ${res.ynes.length}개(${code('-yne')})` : ''}.`;
  out.push({ k: '주사슬', t });
  out.push({ k: '위치번호', t: numberingText(res) });
  out.push({ k: '접두사', t: prefixText(res) });
  if (res.stereo || res.centers.length) out.push({ k: '입체 표시', t: stereoText(res) });
  return out;
}

function numberingText(res) {
  const w = res.why.num;
  if (res.parent.type === 'chain' && res.n === 1) return '탄소가 하나이므로 위치번호가 필요하지 않습니다.';
  if (res.noLocs && res.parent.type !== 'chain') return '치환기가 하나이고 고리의 모든 위치가 동등하므로 위치번호를 생략합니다.';
  if (res.noLocs) return '가능한 위치가 모두 동등하므로 위치번호를 생략합니다.';
  if (res.P && !res.tri && res.parent.type === 'chain' && ['acid', 'ester', 'amide', 'nitrile', 'aldehyde', 'acylhalide'].includes(res.P))
    return `${code(CLASS[res.P].fg)} 탄소는 사슬 말단에 있으므로 ${b('C1')} 이 되며, 이 위치번호 1은 이름에서 생략합니다.${w === 'multLoc' || w === 'dblLoc' ? ' 다음으로 다중결합에 낮은 위치번호를 줍니다.' : ''}`;
  const map = {
    pLoc: `주 작용기에 가장 낮은 위치번호를 줍니다 → ${b(res.pLocs.join(','))}.`,
    multLoc: `${res.P ? '주 작용기의 위치번호가 같으므로 ' : ''}다중결합(이중 · 삼중결합 전체)에 낮은 위치번호를 줍니다.`,
    dblLoc: '다중결합의 위치번호 집합이 같으므로 이중결합에 더 낮은 위치번호를 줍니다.',
    nPre: '', preLoc: '치환기 위치번호 집합이 가장 낮아지도록 번호를 매깁니다 (첫 번째 차이점 규칙).',
    alpha: '위치번호 집합이 같으므로 알파벳순으로 먼저 오는 치환기에 낮은 위치번호를 줍니다.',
    esterAlpha: '위치번호가 모두 같으므로 알파벳순으로 먼저 오는 에스터 알킬기가 낮은 위치번호의 카복실레이트에 대응하도록 번호를 매깁니다.',
    sym: '어느 방향으로 번호를 매겨도 같은 이름이 됩니다.'
  };
  return map[w] || '위치번호 집합이 가장 낮아지도록 번호를 매깁니다.';
}
function prefixText(res) {
  if (!res.prefixes.length) return '접두사로 나타낼 치환기가 없습니다.';
  const list = res.prefixes.map(p => `${res.noLocs && p.locs.every(l => typeof l === 'number') ? '' : p.locs.map(l => typeof l === 'number' && l % 1 ? Math.floor(l) + '′' : l).join(',') + '-'}${p.en}`);
  let t = `치환기 접두사를 알파벳순으로 배열합니다: ${list.map(code).join(' → ')}.`;
  if (res.prefixes.some(p => p.locs.length > 1)) t += ' 같은 치환기가 여러 개이면 배수 접두사(di-, tri-, tetra-)를 붙이며, 알파벳순을 정할 때 배수 접두사는 고려하지 않습니다.';
  if (res.prefixes.some(p => p.compound)) t += ' 복합 치환기(예: hydroxymethyl)는 괄호 안 이름 전체의 첫 글자로 알파벳순을 정합니다.';
  if (res.prefixes.some(p => p.locs.some(l => typeof l === 'string'))) t += ` 위치 기호 ${code('N-')} 은 질소 원자에 결합한 치환기를 나타냅니다.`;
  return t;
}
function stereoText(res) {
  const out = [];
  const ez = (res.stereo || '').split(',').filter(x => /[EZ]$/.test(x));
  const rs = (res.stereo || '').split(',').filter(x => /[RS]$/.test(x));
  if (ez.length) {
    out.push(ez.length > 1 || rs.length ? `각 이중결합의 배치를 위치번호와 함께 E/Z 로 표시합니다 (${b(ez.join(','))}). 양 끝에서 CIP 우선순위가 높은 치환기가 같은 쪽이면 Z, 반대쪽이면 E 입니다.`
      : `이중결합 양 끝에서 CIP 우선순위가 높은 치환기가 ${ez[0].endsWith('Z') ? '같은 쪽에 있으므로 ' + b('Z') + '(zusammen)' : '반대쪽에 있으므로 ' + b('E') + '(entgegen)'}입니다.`);
  }
  if (res.pseudo && res.pseudo.size) out.push(`소문자 ${b('r · s')} 는 의사비대칭 중심(pseudoasymmetric center)을 나타냅니다. 구성이 같은 두 치환기가 각각 R · S 배열을 가지면 CIP 규칙 5 에 따라 R 치환기를 우선하며, 이 표시는 거울상에서도 바뀌지 않습니다.`);
  if (rs.length) out.push(`각 입체중심의 네 치환기에 CIP 우선순위 ①–④ 를 매기고, 최저 순위 ④ 를 관찰자 반대쪽에 두었을 때 ① → ② → ③ 이 시계 방향이면 ${b('R')}, 반시계 방향이면 ${b('S')} 입니다 (${b(rs.join(','))}). 입체 표시는 위치번호 순으로 한 괄호에 모아 이름 앞에 둡니다.`);
  const undef = res.undef ? res.undef.length : 0;
  if (undef) out.push(`배열이 지정되지 않은 입체중심 ${undef}개(구조식의 *)는 입체 표시 없이 명명했습니다.`);
  if (res.meso) out.push(`입체중심이 있어도 분자 내 대칭면이 있어 거울상과 포개어지므로 ${b('메소')} 화합물입니다.`);
  return out.join(' ');
}

function ringSteps(res) {
  const out = [];
  const par = res.core.find(x => x.r === 'par');
  const pt = res.parent;
  let t;
  if (res.kind === 'biphenyl') t = `두 벤젠 고리가 단일결합으로 직접 연결되어 있으므로 ${code('1,1′-biphenyl')} 을 모체로 합니다. 한 고리는 1–6, 다른 고리는 1′–6′ 으로 번호를 매깁니다.`;
  else if (res.kind === 'benzene') {
    if (!res.P) t = `접미사로 표시할 작용기가 없으므로 모체는 ${code('benzene')} 입니다.`;
    else if (res.pLocs.length === 1) t = `${classLine(res)} 일치환 벤젠 유도체이므로 보존명 ${b(par.en)}(${par.ko})${jo(par.ko, '을')} 모체로 쓰며, 주 작용기가 결합한 탄소가 ${b('C1')} 입니다.`;
    else t = `${classLine(res)} 같은 작용기가 ${res.pLocs.length}개이므로 ${code('benzene-' + res.pLocs.join(',') + '-…')} 형식으로 위치번호와 함께 명명합니다.`;
  } else if (pt.rtype === 'oxirane') t = `산소를 포함한 삼원자 고리(에폭사이드)의 모체는 ${code('oxirane')} 입니다. 헤테로고리는 탄소 고리 · 사슬보다 우선하며, O 가 1번입니다.`;
  else {
    t = `고리 탄소 ${b(pt.size + '개')} → ${code('cyclo' + STEMS[pt.size])}.`;
    if (res.P) t += ' ' + classLine(res);
    if (res.P && RING_SUFFIX[res.P]) t += ` 고리에 결합한 ${CLASS[res.P].ko}의 탄소는 고리에 포함할 수 없으므로 접미사 ${code(RING_SUFFIX[res.P])} 를 씁니다.`;
    if (res.enes.length) t += ` 고리 내 이중결합은 ${code('-ene')} 으로 나타내며, 가능한 한 이중결합 탄소가 C1 · C2 가 되도록 번호를 매깁니다.`;
  }
  if (res.why.chain && PARENT_WHY[res.why.chain] && res.kind !== 'biphenyl') t += ' ' + PARENT_WHY[res.why.chain];
  out.push({ k: '모체', t });
  out.push({ k: '위치번호', t: numberingText(res) });
  out.push({ k: '접두사', t: prefixText(res) });
  if (res.kind === 'benzene') {
    const locs = res.prefixes.flatMap(p => p.locs).filter(l => typeof l === 'number');
    const all = res.P && res.pLocs.length === 1 ? [1, ...locs] : res.P ? res.pLocs.concat(locs) : locs;
    if (all.length === 2) {
      const d = Math.abs(all[0] - all[1]);
      const rel = { 1: ['ortho (o-)', '1,2-위치'], 2: ['meta (m-)', '1,3-위치'], 3: ['para (p-)', '1,4-위치'] }[Math.min(d, 6 - d)];
      if (rel) out.push({ k: 'o · m · p', t: `두 치환기는 ${b(rel[0])} 관계입니다 (${rel[1]}). 관용명에서는 위치번호 대신 o-, m-, p- 를 씁니다.` });
    }
  }
  if (res.stereo || res.centers.length) out.push({ k: '입체 표시', t: stereoText(res) });
  return out;
}

/* 이전 결과 → 현재 결과: 바뀐 점 (최대 4줄). 편집기에서는 원자 번호가 이어지므로 같은 원자끼리 비교 */
export function diff(prevMol, prev, mol, cur) {
  if (!prev || !cur) return [];
  const out = [];
  if (prev.nameEn === cur.nameEn) return out;
  if (prev.P !== cur.P) {
    if (!prev.P) out.push(`주 작용기 ${b(CLASS[cur.P].ko)}${jo(CLASS[cur.P].ko, '이')} 도입되어 접미사 ${code(SUFFIX_OF[cur.P][0])}(${SUFFIX_OF[cur.P][1]})${jo(SUFFIX_OF[cur.P][1], '이')} 붙습니다.`);
    else if (!cur.P) out.push(`주 작용기가 없어져 탄화수소 어미(${code('-ane')} · ${code('-ene')} · ${code('-yne')})로 명명합니다.`);
    else if (PRI[cur.P] < PRI[prev.P]) out.push(`${b(CLASS[cur.P].ko)}의 우선순위가 ${CLASS[prev.P].ko}보다 높아 새 주 작용기가 되었고, ${CLASS[prev.P].ko}${jo(CLASS[prev.P].ko, '은')} 접두사 ${code(PREFIX_OF[prev.P].split(' / ')[0] + '-')}로 바뀌었습니다.`);
    else out.push(`주 작용기가 ${CLASS[prev.P].ko}에서 ${b(CLASS[cur.P].ko)}${jo(CLASS[cur.P].ko, '로')} 바뀌었습니다.`);
  } else if (cur.P && prev.pLocs.length !== cur.pLocs.length) {
    out.push(`주 작용기 수가 ${prev.pLocs.length}개에서 ${b(cur.pLocs.length + '개')}로 바뀌어 배수 접두사(di-, tri-)가 달라집니다.`);
  }
  const pk = prev.parent.type, ck = cur.parent.type;
  if (pk !== ck) out.push(ck === 'chain' ? `주 작용기가 사슬에 있으므로 모체가 고리에서 ${b('사슬')}${jo('사슬', '로')} 바뀌었습니다.` : `모체가 ${b('고리')}${jo('고리', '로')} 바뀌었습니다.`);
  else if (ck === 'chain' && prev.n !== cur.n) out.push(`주사슬 탄소 ${prev.n} → ${b(cur.n + '개')} (${code(STEMS[prev.n])} → ${code(STEMS[cur.n])}).`);
  if (pk === 'chain' && ck === 'chain') {
    if (flipped(prevMol, prev, mol, cur)) out.push('새 치환기(작용기)에 낮은 위치번호를 주기 위해 번호를 매기는 방향이 반대가 되었습니다.');
    const pe = prev.enes.concat(prev.ynes).join(','), ce = cur.enes.concat(cur.ynes).join(',');
    if (pe && ce && pe !== ce) out.push(`이에 따라 다중결합의 위치번호도 ${pe}에서 ${b(ce)}${jo(ce, '로')} 바뀝니다.`);
  }
  /* 입체: 새로 생긴 입체중심 · 뒤집힌 배열 · 새 E/Z */
  const ezOf = r => (r.stereo || '').split(',').filter(x => /[EZ]$/.test(x)).join(',');
  if (!ezOf(prev) && ezOf(cur)) out.push(`이중결합 양 끝의 치환기가 달라져 기하 이성질이 생기므로 ${b('(' + ezOf(cur) + ')')} 를 표시합니다.`);
  /* 고리 cis/trans 바뀜 */
  const ctKey = r => (r.ct || []).map(x => x.atoms.join('-') + x.rel).join();
  if ((prev.ct || []).length && ctKey(prev) !== ctKey(cur)) {
    const moved = (cur.ct || []).filter(x => (prev.ct || []).some(y => y.atoms.join() === x.atoms.join() && y.rel !== x.rel));
    if (moved.length) out.push(`고리 위 두 치환기의 상대 배치가 바뀌었습니다: ${moved.map(x => b((x.rel === 'cis' ? 'trans → cis' : 'cis → trans'))).join(', ')}.`);
  } else if (!(prev.ct || []).length && (cur.ct || []).length) out.push(`고리 치환기가 두 개가 되어 ${b('cis/trans')} 이성질체가 존재합니다 (현재 ${b(cur.ct[0].rel)}).`);
  const pc = new Set(prev.centers || []), newC = (cur.centers || []).filter(c => !pc.has(c));
  if (newC.length && cur.rs) out.push(`네 치환기가 모두 다른 새 입체중심이 생겼습니다 → ${newC.map(c => (cur.locLabel && cur.locLabel.get(c) ? 'C' + cur.locLabel.get(c) : '원자 ' + (c + 1)) + ' ' + b(cur.rs.get(c) || (cur.pseudo && cur.pseudo.get(c)) || '*')).join(', ')}. 쐐기 결합으로 배열을 지정했으며, ‘R/S’ 도구로 반전할 수 있습니다.`);
  if (prev.rs && cur.rs) {
    const flippedC = [...cur.rs].filter(([c, d]) => prev.rs.has(c) && prev.rs.get(c) !== d && prevMol.atoms[c] && mol.atoms[c] && prevMol.atoms[c].chi && mol.atoms[c].chi && prevMol.atoms[c].chi.s !== mol.atoms[c].chi.s);
    if (flippedC.length) out.push(`입체중심의 배열을 반전했습니다: ${flippedC.map(([c, d]) => `${b(prev.rs.get(c) + ' → ' + d)}`).join(', ')}.`);
    const keptButRenamed = [...cur.rs].filter(([c, d]) => prev.rs.has(c) && prev.rs.get(c) !== d && prevMol.atoms[c] && mol.atoms[c] && prevMol.atoms[c].chi && mol.atoms[c].chi && prevMol.atoms[c].chi.s === mol.atoms[c].chi.s && prevMol.atoms[c].chi.n.join() === mol.atoms[c].chi.n.join());
    if (keptButRenamed.length) out.push(`공간 배치는 같지만 치환기의 CIP 우선순위가 바뀌어 표시가 ${keptButRenamed.map(([c, d]) => b(prev.rs.get(c) + ' → ' + d)).join(', ')} 로 달라졌습니다. R/S 는 우선순위에 따른 표시이므로 기하 배치가 같아도 바뀔 수 있습니다.`);
  }
  const pp = new Set(prev.prefixes.map(p => p.en)), cp = new Set(cur.prefixes.map(p => p.en));
  const added = [...cp].filter(x => !pp.has(x)), removed = [...pp].filter(x => !cp.has(x));
  if (added.length) out.push(`새 접두사: ${added.map(code).join(', ')}.`);
  if (removed.length) out.push(`제거된 접두사: ${removed.map(code).join(', ')}.`);
  return out.slice(0, 4);
}
function flipped(pm, prev, m, cur) {
  const common = [];
  for (const [a, la] of prev.pos) {
    if (!cur.pos.has(a) || !pm.atoms[a] || !m.atoms[a] || pm.atoms[a].el !== m.atoms[a].el) continue;
    common.push([a, la, cur.pos.get(a)]);
  }
  if (common.length < 2) return false;
  common.sort((x, y) => x[1] - y[1]);
  const [x, y] = [common[0], common[common.length - 1]];
  return Math.sign(y[1] - x[1]) !== Math.sign(y[2] - x[2]);
}

/* 참고 사항 → 사람이 읽는 문장 */
export function noteText(n) {
  switch (n.type) {
    case 'enol': return { tone: 'warn', t: `${b('엔올(enol)')}: 이중결합 탄소에 OH 가 결합한 구조로, 케토–엔올 호변이성에 의해 대부분 케토 형태${n.keto ? ` ${code(n.keto.nameEn)}(${n.keto.nameKo})${jo(n.keto.nameKo, '로')}` : '로'} 존재합니다.` };
    case 'ynol': return { tone: 'warn', t: `${b('이놀(ynol)')}: 삼중결합 탄소에 OH 가 결합한 구조로, 엔올보다 훨씬 불안정하여 케텐(C=C=O)으로 빠르게 호변이성화합니다. 일반 조건에서는 단리되지 않습니다.` };
    case 'ynamine': return { tone: 'warn', t: `${b('이나민(ynamine)')}: 삼중결합 탄소에 N–H 가 결합하면 케텐이민(C=C=N)으로 쉽게 호변이성화합니다. 질소에 H 가 없는 N,N-다이알킬 이나민은 합성에 사용됩니다.` };
    case 'enamine': return { tone: 'warn', t: `${b('엔아민')}: 이중결합 탄소에 NH₂ 가 결합한 1차 엔아민은 이민(C=N) 형태로 쉽게 호변이성화합니다.` };
    case 'gemdiol': return { tone: 'warn', t: `${b('제미널 다이올(수화물)')}: 대부분 탈수되어 카보닐 화합물로 존재합니다.` };
    case 'halohydrin': return { tone: 'warn', t: `${b('α-할로알코올')}(같은 탄소에 OH 와 할로젠): HX 가 제거되어 카보닐 화합물이 되기 쉬운 불안정한 구조입니다.` };
    case 'hemiaminal': return { tone: 'warn', t: `${b('헤미아미날')}(같은 탄소에 OH 와 NH₂): 탈수되어 이민이 되기 쉬운 불안정한 구조입니다.` };
    case 'hemiacetal': return { tone: 'warn', t: `${b('헤미아세탈')}: 분자 간 헤미아세탈은 평형상 알데하이드 · 케톤과 알코올 쪽으로 쉽게 분해됩니다.` };
    case 'chiral': {
      const def = n.rs ? n.rs.size : 0;
      if (n.meso) return { tone: 'info', t: `${b('메소 화합물')}: 입체중심이 ${def}개 있지만 분자 내 대칭면 때문에 거울상과 포개어집니다 (광학 비활성).` };
      if (def) return { tone: 'info', t: `${b('입체중심 ' + n.atoms.length + '개')}: 구조식의 R · S 는 각 탄소의 절대 배열입니다. 굵은 쐐기는 지면 앞쪽, 점선 쐐기는 지면 뒤쪽을 향하는 결합입니다. ‘R/S’ 도구로 배열을 반전할 수 있습니다.${n.mirror ? ` 거울상 이성질체: ${code(n.mirror.en)}.` : ''}` };
      return { tone: 'info', t: `${b('입체중심 ' + n.atoms.length + '개')}(구조식의 *): 배열이 지정되지 않은 구조로, 각 중심에 R · S 두 배열이 가능합니다.` };
    }
    case 'ez': return { tone: 'info', t: `${b('기하 이성질')}: 이중결합은 회전이 제한되어 치환기 배치가 고정됩니다. 현재 배치는 ${b(n.desc)} 이며, ‘E/Z’ 도구로 반대 이성질체로 바꿀 수 있습니다.` };
    case 'rule1993': return { tone: 'info', t: `${b('1993 규칙과의 차이')}: 2013 권고 이전 규칙(여러 교과서의 기준)으로는 ${code(n.en)}(${n.ko})${jo(n.ko, '로')} 명명합니다.` };
    default: return null;
  }
}
