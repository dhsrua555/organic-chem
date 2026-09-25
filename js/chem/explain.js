/* 이름 풀이(단계별), "무엇이 바뀌었나", 주의 사항 문장. 결과는 짧은 HTML 조각 (내용은 모두 앱이 만든 글) */
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
  if (!res.P) return '접미사가 될 작용기(산 · 에스터 · 알데하이드 · 케톤 · 알코올 · 아민 …)가 없습니다. 치환기는 모두 접두사로 앞에 붙습니다.';
  let t = `이 분자에서 우선순위가 가장 높은 작용기는 ${b(CLASS[res.P].ko)}(${code(CLASS[res.P].fg)})입니다. 그래서 이름 끝(접미사)을 차지합니다.`;
  if (others.length) t += ` 나머지 작용기(${others.map(c => CLASS[c].ko).join(' · ')})는 순위가 낮아 접두사(${others.map(c => PREFIX_OF[c].split(' / ')[0]).join(', ')})로 앞에 붙습니다.`;
  return t;
}

const PARENT_WHY = {
  nP: '주 작용기를 가장 많이 품은 부분을 모체로 고릅니다.',
  cls: '고리와 사슬이 비기면 고리가 모체입니다 (IUPAC 2013). 옛 교과서는 탄소 수가 많은 쪽을 모체로 했습니다.',
  ringVsChain: '(옛 규칙) 고리와 사슬 중 탄소가 더 많은 쪽을 모체로 합니다.',
  nRings: '고리가 둘 이어진 바이페닐이 고리 하나보다 우선합니다.',
  len: '가장 긴 사슬(큰 고리)을 고릅니다 (IUPAC 2013: 길이가 이중결합보다 먼저).',
  mult: '길이가 같으면 다중결합(이중 · 삼중)을 더 많이 품은 쪽.',
  len2: '(옛 규칙) 다중결합을 먼저 품고, 그다음 가장 긴 사슬.',
  dbl: '다중결합 수도 같으면 이중결합이 더 많은 쪽.',
  pLoc: '주 작용기 번호가 더 작아지는 쪽.', multLoc: '다중결합 번호가 더 작아지는 쪽.', dblLoc: '이중결합 번호가 더 작아지는 쪽.',
  nPre: '길이 · 불포화가 같으면 치환기가 더 많은 사슬.', preLoc: '치환기 번호가 더 작아지는 사슬.', alpha: '알파벳이 앞선 치환기가 작은 번호를 받는 사슬.'
};
function chainSteps(res) {
  const out = [];
  out.push({ k: '주 작용기', t: classLine(res) + (res.P ? ` → 접미사 ${code(res.tri ? '-(tri)' + (RING_SUFFIX[res.P] || '').slice(1) : SUFFIX_OF[res.P][0])}` : '') });
  if (res.tri) out[0].t += ` 같은 작용기가 ${res.pLocs.length}개라 그 탄소들을 사슬에 넣지 않고 ${code('-tricarboxylic acid')} 처럼 셉니다.`;
  const n = res.n;
  let t = `탄소 ${b(n + '개')} → 어근 ${code(STEMS[n] || n)} (${STEMS_KO[n] || ''}).`;
  if (res.why.chain && PARENT_WHY[res.why.chain]) t += ' ' + PARENT_WHY[res.why.chain];
  if (res.enes.length || res.ynes.length) t += ` 사슬에 ${res.enes.length ? `이중결합 ${res.enes.length}개(${code('-ene')})` : ''}${res.enes.length && res.ynes.length ? ' · ' : ''}${res.ynes.length ? `삼중결합 ${res.ynes.length}개(${code('-yne')})` : ''}.`;
  out.push({ k: '주사슬', t });
  out.push({ k: '번호', t: numberingText(res) });
  out.push({ k: '접두사', t: prefixText(res) });
  if (res.stereo || res.centers.length) out.push({ k: '입체', t: stereoText(res) });
  return out;
}

function numberingText(res) {
  const w = res.why.num;
  if (res.parent.type === 'chain' && res.n === 1) return '탄소가 하나라 번호가 필요 없습니다.';
  if (res.noLocs && res.parent.type !== 'chain') return '치환기가 하나라 고리의 어느 자리든 같아 번호를 생략합니다.';
  if (res.noLocs) return '치환기가 하나뿐이고 자리가 모두 같아 번호를 생략합니다.';
  if (res.P && !res.tri && res.parent.type === 'chain' && ['acid', 'ester', 'amide', 'nitrile', 'aldehyde', 'acylhalide'].includes(res.P))
    return `${code(CLASS[res.P].fg)}의 탄소가 사슬 끝에 있으므로 그 탄소가 ${b('1번')}입니다. 접미사 번호 1은 이름에 쓰지 않습니다.${w === 'multLoc' || w === 'dblLoc' ? ' 그다음 이중 · 삼중결합에 작은 번호.' : ''}`;
  const map = {
    pLoc: `주 작용기가 붙은 탄소에 가장 작은 번호가 가도록 셉니다 → ${b(res.pLocs.join(','))}.`,
    multLoc: `${res.P ? '주 작용기 번호가 같아서, ' : ''}다중결합(이중 · 삼중 모두)에 작은 번호가 가는 쪽으로 셉니다.`,
    dblLoc: '다중결합 번호 묶음이 같아서, 이중결합이 더 작은 번호를 받는 쪽으로 셉니다.',
    nPre: '', preLoc: '치환기 번호 묶음이 가장 작아지는 쪽으로 셉니다 (처음 다른 자리에서 작은 쪽이 이김).',
    alpha: '양쪽 번호 묶음이 같아서, 알파벳이 앞선 치환기가 작은 번호를 받도록 셉니다.',
    esterAlpha: '번호가 모두 같아서, 알파벳이 앞선 에스터 알킬기가 작은 번호의 카복실레이트에 오도록 셉니다.',
    sym: '어느 쪽에서 세어도 같은 이름이 나옵니다.'
  };
  return map[w] || '가장 작은 번호 묶음이 되도록 셉니다.';
}
function prefixText(res) {
  if (!res.prefixes.length) return '붙일 접두사가 없습니다.';
  const list = res.prefixes.map(p => `${res.noLocs && p.locs.every(l => typeof l === 'number') ? '' : p.locs.map(l => typeof l === 'number' && l % 1 ? Math.floor(l) + '′' : l).join(',') + '-'}${p.en}`);
  let t = `알파벳 순서로 늘어놓습니다: ${list.map(code).join(' → ')}.`;
  if (res.prefixes.some(p => p.locs.length > 1)) t += ' 같은 치환기가 여럿이면 di · tri · tetra 를 붙이되, 알파벳 순서를 따질 때는 이 수 접두사를 무시합니다.';
  if (res.prefixes.some(p => p.compound)) t += ' 괄호 속 치환기(예: hydroxymethyl)는 괄호 안 이름 전체의 첫 글자로 순서를 정합니다.';
  if (res.prefixes.some(p => p.locs.some(l => typeof l === 'string'))) t += ` ${code('N-')} 은 질소에 붙은 치환기라는 뜻입니다.`;
  return t;
}
function stereoText(res) {
  const out = [];
  if (res.stereo) {
    const multi = res.stereo.includes(',');
    out.push(multi ? `이중결합마다 E/Z 를 번호와 함께 적습니다 (${b(res.stereo)}). 양 끝에서 CIP 우선순위가 높은 치환기끼리 같은 쪽이면 Z, 반대쪽이면 E.`
      : `이중결합 양 끝에서 CIP 우선순위(원자번호)가 높은 치환기끼리 ${res.stereo === 'Z' ? '같은 쪽 → ' + b('Z') + ' (zusammen)' : '반대쪽 → ' + b('E') + ' (entgegen)'}입니다.`);
  }
  if (res.centers.length) out.push(`치환기 넷이 모두 다른 탄소(입체중심, 그림의 *)가 ${res.centers.length}개 있어 거울상 이성질체(R/S)가 존재합니다. 여기서는 R/S 를 정하지 않은 이름입니다.`);
  return out.join(' ');
}

function ringSteps(res) {
  const out = [];
  const par = res.core.find(x => x.r === 'par');
  const pt = res.parent;
  let t;
  if (res.kind === 'biphenyl') t = `벤젠 고리 둘이 곧바로 이어져 있어 ${code('1,1′-biphenyl')} 을 모체로 씁니다. 한쪽 고리는 1~6, 다른 쪽은 1′~6′ 로 번호를 매깁니다.`;
  else if (res.kind === 'benzene') {
    if (!res.P) t = `접미사가 될 작용기가 없어 모체는 ${code('benzene')} 입니다.`;
    else if (res.pLocs.length === 1) t = `${classLine(res)} 벤젠에 하나 붙으면 고유 이름 ${b(par.en)}(${par.ko})${jo(par.ko, '을')} 모체로 쓰고, 그 탄소가 ${b('1번')}입니다.`;
    else t = `${classLine(res)} 같은 작용기가 ${res.pLocs.length}개라 ${code('benzene-' + res.pLocs.join(',') + '-…')} 처럼 번호와 함께 씁니다.`;
  } else if (pt.rtype === 'oxirane') t = `산소가 든 3원자 고리(에폭사이드)는 ${code('oxirane')} 이 모체입니다. 헤테로원자 고리가 탄소 고리 · 사슬보다 우선하고, O 가 1번입니다.`;
  else {
    t = `고리 탄소 ${b(pt.size + '개')} → ${code('cyclo' + STEMS[pt.size])}.`;
    if (res.P) t += ' ' + classLine(res);
    if (res.P && RING_SUFFIX[res.P]) t += ` 고리에 붙은 ${CLASS[res.P].ko}는 탄소를 고리에 넣을 수 없어 ${code(RING_SUFFIX[res.P])} 로 붙입니다.`;
    if (res.enes.length) t += ` 고리 안 이중결합은 ${code('-ene')} (번호 1 · 2 가 이중결합에 가도록).`;
  }
  if (res.why.chain && PARENT_WHY[res.why.chain] && res.kind !== 'biphenyl') t += ' ' + PARENT_WHY[res.why.chain];
  out.push({ k: '모체', t });
  out.push({ k: '번호', t: numberingText(res) });
  out.push({ k: '접두사', t: prefixText(res) });
  if (res.kind === 'benzene') {
    const locs = res.prefixes.flatMap(p => p.locs).filter(l => typeof l === 'number');
    const all = res.P && res.pLocs.length === 1 ? [1, ...locs] : res.P ? res.pLocs.concat(locs) : locs;
    if (all.length === 2) {
      const d = Math.abs(all[0] - all[1]);
      const rel = { 1: ['ortho (o-)', '1,2 — 이웃'], 2: ['meta (m-)', '1,3 — 한 칸 건너'], 3: ['para (p-)', '1,4 — 마주 봄'] }[Math.min(d, 6 - d)];
      if (rel) out.push({ k: 'o · m · p', t: `두 치환기가 ${b(rel[0])} 관계입니다 (${rel[1]}). 관용명에서는 번호 대신 o- · m- · p- 를 씁니다.` });
    }
  }
  if (res.stereo || res.centers.length) out.push({ k: '입체', t: stereoText(res) });
  return out;
}

/* 이전 결과 → 현재 결과: 바뀐 점 (최대 4줄). 편집기에서는 원자 번호가 이어지므로 같은 원자끼리 비교 */
export function diff(prevMol, prev, mol, cur) {
  if (!prev || !cur) return [];
  const out = [];
  if (prev.nameEn === cur.nameEn) return out;
  if (prev.P !== cur.P) {
    if (!prev.P) out.push(`주 작용기가 생겼습니다: ${b(CLASS[cur.P].ko)}. 이름 끝에 접미사 ${code(SUFFIX_OF[cur.P][0])}(${SUFFIX_OF[cur.P][1]})${jo(SUFFIX_OF[cur.P][1], '이')} 붙습니다.`);
    else if (!cur.P) out.push(`주 작용기가 없어져 이름이 탄화수소 이름(${code('-ane')} · ${code('-ene')} · ${code('-yne')})으로 끝납니다.`);
    else if (PRI[cur.P] < PRI[prev.P]) out.push(`${b(CLASS[cur.P].ko)}${jo(CLASS[cur.P].ko, '이')} ${CLASS[prev.P].ko}보다 순위가 높아 접미사를 차지했습니다. ${CLASS[prev.P].ko}${jo(CLASS[prev.P].ko, '은')} 이제 접두사 ${code(PREFIX_OF[prev.P].split(' / ')[0])}입니다.`);
    else out.push(`주 작용기가 ${CLASS[prev.P].ko}에서 ${b(CLASS[cur.P].ko)}${jo(CLASS[cur.P].ko, '로')} 바뀌었습니다.`);
  } else if (cur.P && prev.pLocs.length !== cur.pLocs.length) {
    out.push(`같은 주 작용기가 ${prev.pLocs.length}개에서 ${b(cur.pLocs.length + '개')}가 되어 di · tri 를 붙입니다.`);
  }
  const pk = prev.parent.type, ck = cur.parent.type;
  if (pk !== ck) out.push(ck === 'chain' ? `모체가 고리에서 ${b('사슬')}${jo('사슬', '로')} 바뀌었습니다 — 주 작용기가 사슬 쪽에 있기 때문입니다.` : `모체가 ${b('고리')}${jo('고리', '로')} 바뀌었습니다.`);
  else if (ck === 'chain' && prev.n !== cur.n) out.push(`주사슬 탄소 ${prev.n} → ${b(cur.n + '개')} (${code(STEMS[prev.n])} → ${code(STEMS[cur.n])}).`);
  if (pk === 'chain' && ck === 'chain') {
    if (flipped(prevMol, prev, mol, cur)) out.push('번호를 매기는 방향이 반대 끝으로 바뀌었습니다 — 새 치환기 · 작용기 쪽이 더 작은 번호를 받기 때문입니다.');
    const pe = prev.enes.concat(prev.ynes).join(','), ce = cur.enes.concat(cur.ynes).join(',');
    if (pe && ce && pe !== ce) out.push(`그래서 다중결합 위치 번호도 ${pe}에서 ${b(ce)}${jo(ce, '로')} 바뀝니다.`);
  }
  if (!prev.stereo && cur.stereo) out.push(`이중결합 양쪽 치환기가 달라져 ${b('(' + cur.stereo + ')')} 표시가 붙습니다.`);
  const pp = new Set(prev.prefixes.map(p => p.en)), cp = new Set(cur.prefixes.map(p => p.en));
  const added = [...cp].filter(x => !pp.has(x)), removed = [...pp].filter(x => !cp.has(x));
  if (added.length) out.push(`새 접두사: ${added.map(code).join(', ')}.`);
  if (removed.length) out.push(`빠진 접두사: ${removed.map(code).join(', ')}.`);
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

/* 주의 사항 → 사람이 읽는 문장 */
export function noteText(n) {
  switch (n.type) {
    case 'enol': return { tone: 'warn', t: `${b('엔올(enol)')}: 이중결합 탄소에 OH 가 붙은 구조는 불안정해서 곧바로 케토 형태${n.keto ? ` ${code(n.keto.nameEn)}(${n.keto.nameKo})${jo(n.keto.nameKo, '로')}` : '로'} 바뀝니다 (케토–엔올 호변 이성질).` };
    case 'enamine': return { tone: 'warn', t: `${b('엔아민')}: 이중결합 탄소에 NH₂ 가 붙은 구조는 이민(C=N) 형태로 쉽게 바뀝니다.` };
    case 'gemdiol': return { tone: 'warn', t: `${b('같은 탄소에 OH 둘(수화물)')}: 대부분 물이 빠져 카보닐(C=O)이 됩니다.` };
    case 'halohydrin': return { tone: 'warn', t: `${b('같은 탄소에 OH 와 할로젠')}: HX 가 빠져 카보닐(C=O)이 되기 쉬운 불안정한 구조입니다.` };
    case 'hemiaminal': return { tone: 'warn', t: `${b('같은 탄소에 OH 와 NH₂')}: 물이 빠져 이민이 되기 쉬운 불안정한 구조입니다.` };
    case 'hemiacetal': return { tone: 'warn', t: `${b('헤미아세탈')}: 같은 탄소의 OH 와 OR 은 쉽게 풀려 알데하이드 · 케톤과 알코올로 돌아갑니다.` };
    case 'chiral': return { tone: 'info', t: `${b('입체중심 ' + n.atoms.length + '개')}: 치환기 넷이 모두 다른 탄소(그림의 *)가 있어 거울상 이성질체 두 가지(R/S)가 있습니다.` };
    case 'ez': return { tone: 'info', t: `${b('기하 이성질')}: 이중결합은 돌 수 없어 치환기 배치가 고정됩니다. 지금 모양은 ${b(n.desc)}입니다. 도구의 ‘E/Z 뒤집기’로 이중결합을 누르면 반대 이성질체가 됩니다.` };
    case 'rule1993': return { tone: 'info', t: `${b('규칙 차이')}: 2013 권고 이전(대부분의 교과서) 규칙으로는 ${code(n.en)}(${n.ko})${jo(n.ko, '로')} 부릅니다.` };
    default: return null;
  }
}
