/* 이름 풀이(단계별)와 "무엇이 바뀌었나" 문장. 결과는 짧은 HTML 조각 (내용은 모두 앱이 만든 글) */
import { CLASS, PRI } from './name.js';
import { GROUPS } from './mol.js';

const SUFFIX_OF = {
  acid: ['-oic acid', '-산'], ester: ['-oate', '-산 …'], amide: ['-amide', '-아마이드'], nitrile: ['-nitrile', '-나이트릴'],
  aldehyde: ['-al', '-알'], ketone: ['-one', '-온'], alcohol: ['-ol', '-올'], amine: ['-amine', '-아민']
};
const PREFIX_OF = {
  acid: 'carboxy', ester: 'methoxycarbonyl / alkoxy-oxo', amide: 'carbamoyl / amino-oxo', nitrile: 'cyano', aldehyde: 'formyl / oxo',
  ketone: 'oxo / acetyl', alcohol: 'hydroxy', amine: 'amino'
};
const STEMS = ['', 'meth', 'eth', 'prop', 'but', 'pent', 'hex', 'hept', 'oct', 'non', 'dec'];
const STEMS_KO = ['', '메트', '에트', '프로프', '뷰트', '펜트', '헥스', '헵트', '옥트', '논', '데크'];
const b = s => `<b>${s}</b>`;
const code = s => `<code>${s}</code>`;
const sub = s => String(s).replace(/(\d)/g, '<sub>$1</sub>');

/* 조사: 앞말의 받침에 맞춰 이/가 · 은/는 · 을/를 · (으)로. 숫자는 한국어 읽기로 판단 */
const DIGIT_BATCHIM = { 0: 1, 1: 2, 2: 0, 3: 1, 4: 0, 5: 0, 6: 1, 7: 2, 8: 2, 9: 0 }; /* 0 없음 · 1 받침 · 2 ㄹ받침 */
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

/* 사슬에 들어간 작용기 탄소 (붙인 COOH · CHO · CH3 … 의 탄소) */
function groupCarbonsInChain(mol, res) {
  const out = [];
  for (const c of res.chain || []) {
    const a = mol.atoms[c];
    if (a.src.kind === 'grp' && a.src.k === 0) out.push(GROUPS[a.src.gid].label);
    else if (a.src.kind === 'grp') out.push(GROUPS[a.src.gid].label + ' 의 끝');
  }
  return [...new Set(out)];
}

export function steps(mol, res) {
  return res.kind === 'benzene' ? benzeneSteps(mol, res) : chainSteps(mol, res);
}

function classLine(res) {
  const others = [...res.present].filter(c => c !== res.P).sort((a, b) => PRI[a] - PRI[b]);
  if (!res.P) return '접미사가 될 작용기(산 · 알데하이드 · 케톤 · 알코올 · 아민 …)가 없습니다. 치환기는 모두 접두사로 앞에 붙습니다.';
  let t = `이 분자에서 우선순위가 가장 높은 작용기는 ${b(CLASS[res.P].ko)}(${code(CLASS[res.P].fg)})입니다. 그래서 이름 끝(접미사)을 차지합니다.`;
  if (others.length) t += ` 나머지 작용기(${others.map(c => CLASS[c].ko).join(' · ')})는 순위가 낮아 접두사(${others.map(c => PREFIX_OF[c].split(' / ')[0]).join(', ')})로 앞에 붙습니다.`;
  return t;
}

const CHAIN_WHY = {
  nP: '주 작용기를 가장 많이 품은 사슬을 고릅니다.',
  len: '가장 긴 사슬을 고릅니다 (IUPAC 2013 권고: 길이가 이중결합보다 먼저).',
  ene: '길이가 같으면 이중결합을 품은 사슬을 고릅니다.',
  pLoc: '주 작용기 번호가 더 작아지는 사슬을 고릅니다.',
  eneLoc: '이중결합 번호가 더 작아지는 사슬을 고릅니다.',
  nPre: '길이 · 불포화가 같으면 치환기가 더 많은 사슬을 고릅니다.',
  preLoc: '치환기 번호가 더 작아지는 사슬을 고릅니다.',
  alpha: '알파벳이 앞서는 치환기가 작은 번호를 받는 사슬을 고릅니다.'
};

function chainSteps(mol, res) {
  const out = [];
  out.push({ k: '주 작용기', t: classLine(res) + (res.P ? ` → 접미사 ${code(res.tri ? '-carboxylic acid 계열' : SUFFIX_OF[res.P][0])}` : '') });
  if (res.tri) out[0].t += ` 같은 작용기가 ${res.pLocs.length}개라서 그 탄소들은 사슬에 넣지 않고 ${code('-tri' + (res.P === 'acid' ? 'carboxylic acid' : '…'))} 처럼 셉니다.`;
  const n = res.n;
  let t = `탄소 ${b(n + '개')} → 어근 ${code(STEMS[n] || n)} (${STEMS_KO[n] || ''}).`;
  const g = groupCarbonsInChain(mol, res);
  if (g.length) t += ` 붙인 ${g.map(x => code(sub(x))).join(', ')}의 탄소도 사슬에 들어가 사슬이 길어졌습니다.`;
  if (res.why.chain && CHAIN_WHY[res.why.chain]) t += ' ' + CHAIN_WHY[res.why.chain];
  if (res.enes.length) t += ` 이중결합이 있어 ${code('-ene')} 을 씁니다.`;
  out.push({ k: '주사슬', t });
  out.push({ k: '번호', t: numberingText(res) });
  out.push({ k: '접두사', t: prefixText(res) });
  if (res.stereo || res.centers.length) out.push({ k: '입체', t: stereoText(res) });
  return out;
}

function numberingText(res) {
  const w = res.why.num;
  if (res.n === 1) return '탄소가 하나라 번호가 필요 없습니다.';
  if (res.noLocs) return '치환기가 하나뿐이고 자리가 모두 같아 번호를 생략합니다.';
  if (res.P && !res.tri && ['acid', 'ester', 'amide', 'nitrile', 'aldehyde'].includes(res.P))
    return `${code(CLASS[res.P].fg)}의 탄소가 사슬 끝에 있으므로 그 탄소가 ${b('1번')}입니다. 접미사 번호 1은 이름에 쓰지 않습니다.`;
  const map = {
    pLoc: `주 작용기가 붙은 탄소에 가장 작은 번호가 가도록 셉니다 → ${b(res.pLocs.join(','))}.`,
    eneLoc: `${res.P ? '주 작용기 번호가 같아서, ' : ''}이중결합에 작은 번호가 가는 쪽으로 셉니다 → ${code('-' + res.enes.join(',') + '-ene')}.`,
    nPre: '', preLoc: `치환기 번호 묶음이 가장 작아지는 쪽으로 셉니다 (처음 다른 자리에서 작은 쪽이 이김).`,
    alpha: `양쪽 번호 묶음이 같아서, 알파벳이 앞선 치환기가 작은 번호를 받도록 셉니다.`,
    sym: '어느 끝에서 세어도 같은 이름이 나옵니다.'
  };
  return map[w] || '가장 작은 번호 묶음이 되도록 셉니다.';
}

function prefixText(res) {
  if (!res.prefixes.length) return '붙일 접두사가 없습니다.';
  const list = res.prefixes.map(p => `${res.noLocs ? '' : p.locs.join(',') + '-'}${p.en}`);
  let t = `알파벳 순서로 늘어놓습니다: ${list.map(code).join(' → ')}.`;
  if (res.prefixes.some(p => p.locs.length > 1)) t += ' 같은 치환기가 여럿이면 di · tri · tetra 를 붙이되, 알파벳 순서를 따질 때는 이 수 접두사를 무시합니다.';
  if (res.prefixes.some(p => p.compound)) t += ' 괄호 속 치환기(예: hydroxymethyl)는 괄호 안 이름 전체의 첫 글자로 순서를 정합니다.';
  return t;
}

function stereoText(res) {
  const out = [];
  if (res.stereo) out.push(`이중결합 양 끝에서 CIP 우선순위(원자번호)가 높은 치환기끼리 ${res.stereo === 'Z' ? '같은 쪽 → ' + b('Z') + ' (zusammen)' : '반대쪽 → ' + b('E') + ' (entgegen)'}입니다.`);
  if (res.centers.length) out.push(`치환기 넷이 모두 다른 탄소(입체중심)가 ${res.centers.length}개 있어 거울상 이성질체(R/S)가 존재합니다. 여기서는 R/S 를 정하지 않은 이름입니다.`);
  return out.join(' ');
}

function benzeneSteps(mol, res) {
  const out = [];
  let t;
  if (!res.P) t = `접미사가 될 작용기가 없어 모체는 ${code('benzene')} 입니다.`;
  else if (res.P === 'ketone') t = `케톤(아세틸기)은 고리 탄소에 ${code('=O')}가 붙은 것이 아니라서 고리 이름에 접미사로 붙일 수 없습니다. 그래서 ${code('ethan-1-one')} 이 모체가 되고 벤젠 고리는 ${code(res.k === 1 ? 'phenyl' : 'phenylene')} 치환기가 됩니다.`;
  else if (res.k === 1) { const par = res.core.find(x => x.r === 'par'); t = `${classLine(res)} 벤젠에 하나 붙으면 고유 이름 ${b(par.en)}(${par.ko})${jo(par.ko, '을')} 모체로 쓰고, 그 탄소가 ${b('1번')}입니다.`; }
  else t = `${classLine(res)} 같은 작용기가 ${res.k}개라 ${code('benzene-' + res.pLocs.join(',') + '-…')} 처럼 번호와 함께 씁니다.`;
  out.push({ k: '모체', t });
  const w = res.why.num;
  const nsub = res.gid.filter(Boolean).length;
  let nt;
  if (nsub <= 1) nt = '치환기가 하나면 여섯 자리가 모두 같아 번호를 쓰지 않습니다.';
  else if (w === 'pLoc') nt = `주 작용기들이 가장 작은 번호(${b(res.pLocs.join(','))})를 받도록 고리를 돕니다.`;
  else if (w === 'preLoc') nt = `1번에서 시작해 치환기 번호 묶음이 가장 작아지는 방향(시계/반시계)으로 셉니다 → ${b(allLocs(res))}.`;
  else if (w === 'alpha') nt = `번호 묶음이 같아서, 알파벳이 앞선 치환기에 작은 번호가 가도록 셉니다 → ${b(allLocs(res))}.`;
  else nt = '어느 방향으로 세어도 같은 이름이 나옵니다.';
  out.push({ k: '번호', t: nt });
  out.push({ k: '접두사', t: prefixText(res) });
  if (nsub === 2) {
    const pos = res.gid.map((g, i) => g ? i : -1).filter(i => i >= 0);
    const d = Math.min(Math.abs(pos[0] - pos[1]), 6 - Math.abs(pos[0] - pos[1]));
    const rel = { 1: ['ortho (o-)', '1,2 — 이웃'], 2: ['meta (m-)', '1,3 — 한 칸 건너'], 3: ['para (p-)', '1,4 — 마주 봄'] }[d];
    out.push({ k: 'o · m · p', t: `두 치환기가 ${b(rel[0])} 관계입니다 (${rel[1]}). 관용명에서는 번호 대신 o- · m- · p- 를 씁니다.` });
  }
  return out;
}
function allLocs(res) { return res.prefixes.flatMap(p => p.locs).concat(res.P && res.k === 1 ? [1] : res.pLocs || []).sort((a, b) => a - b).join(','); }

/* 이전 결과 → 현재 결과: 바뀐 점 (최대 4줄) */
export function diff(prevMol, prev, mol, cur) {
  if (!prev) return [];
  const out = [];
  if (prev.nameEn === cur.nameEn) return out;
  if (prev.P !== cur.P) {
    if (!prev.P) out.push(`주 작용기가 생겼습니다: ${b(CLASS[cur.P].ko)}. 이름 끝에 접미사 ${code(SUFFIX_OF[cur.P][0])}(${SUFFIX_OF[cur.P][1]})${jo(SUFFIX_OF[cur.P][1].replace(' …', ''), '이')} 붙습니다.`);
    else if (!cur.P) out.push(`주 작용기가 없어져 이름이 사슬 이름(${code('-ane')} · ${code('-ene')})으로 끝납니다.`);
    else if (PRI[cur.P] < PRI[prev.P]) out.push(`${b(CLASS[cur.P].ko)}${jo(CLASS[cur.P].ko, '이')} ${CLASS[prev.P].ko}보다 순위가 높아 접미사를 차지했습니다. ${CLASS[prev.P].ko}${jo(CLASS[prev.P].ko, '은')} 이제 접두사 ${code(PREFIX_OF[prev.P].split(' / ')[0])}입니다.`);
    else out.push(`주 작용기가 ${CLASS[prev.P].ko}에서 ${b(CLASS[cur.P].ko)}${jo(CLASS[cur.P].ko, '로')} 바뀌었습니다.`);
  } else if (cur.P && (prev.pLocs || []).length !== (cur.pLocs || []).length) {
    out.push(`같은 주 작용기가 ${(prev.pLocs || []).length}개에서 ${b((cur.pLocs || []).length + '개')}가 되어 di · tri 를 붙입니다.`);
  }
  if (prev.kind === 'chain' && cur.kind === 'chain') {
    if (prev.n !== cur.n) out.push(`주사슬 탄소 ${prev.n} → ${b(cur.n + '개')} (${code(STEMS[prev.n])} → ${code(STEMS[cur.n])}).`);
    const flip = directionFlipped(prevMol, prev, mol, cur);
    if (flip) out.push('번호를 매기는 방향이 반대 끝으로 바뀌었습니다 — 새 치환기 쪽이 더 작은 번호를 받기 때문입니다.');
    const pe = prev.enes.join(','), ce = cur.enes.join(',');
    if (pe && ce && pe !== ce) out.push(`그래서 이중결합 위치 번호도 ${pe}에서 ${b(ce)}${jo(ce, '로')} 바뀝니다.`);
    if (!prev.stereo && cur.stereo) out.push(`이중결합 양쪽이 모두 달라져 ${b('(' + cur.stereo + ')')} 표시가 붙습니다.`);
  }
  const pp = new Set(prev.prefixes.map(p => p.en)), cp = new Set(cur.prefixes.map(p => p.en));
  const added = [...cp].filter(x => !pp.has(x)), removed = [...pp].filter(x => !cp.has(x));
  if (added.length) out.push(`새 접두사: ${added.map(code).join(', ')}.`);
  if (removed.length) out.push(`빠진 접두사: ${removed.map(code).join(', ')}.`);
  return out.slice(0, 4);
}

/* 뼈대 탄소들의 번호 순서가 뒤집혔는가 */
function directionFlipped(prevMol, prev, mol, cur) {
  const loc = (m, r, i) => r.pos && r.pos.get(i);
  const sc = mol.atoms.map((a, i) => i).filter(i => mol.atoms[i].src.kind === 'scaf');
  if (sc.length < 2 || prevMol.scaf !== mol.scaf) return false;
  const a = sc[0], z = sc[sc.length - 1];
  const p1 = loc(prevMol, prev, a), p2 = loc(prevMol, prev, z), c1 = loc(mol, cur, a), c2 = loc(mol, cur, z);
  if ([p1, p2, c1, c2].some(v => v === undefined)) return false;
  return Math.sign(p2 - p1) !== Math.sign(c2 - c1);
}

/* 주의 사항 → 사람이 읽는 문장 */
export function noteText(n) {
  switch (n.type) {
    case 'enol': return { tone: 'warn', t: `${b('엔올(enol)')}: 이중결합 탄소에 OH 가 붙은 구조는 불안정해서 곧바로 케토 형태${n.keto ? ` ${code(n.keto.nameEn)}(${n.keto.nameKo})${jo(n.keto.nameKo, '로')}` : '로'} 바뀝니다 (케토–엔올 호변 이성질).` };
    case 'enamine': return { tone: 'warn', t: `${b('엔아민')}: 이중결합 탄소에 NH₂ 가 붙은 구조는 이민(C=N) 형태로 쉽게 바뀝니다.` };
    case 'gemdiol': return { tone: 'warn', t: `${b('같은 탄소에 OH 둘(수화물)')}: 대부분 물이 빠져 카보닐(C=O)이 됩니다.` };
    case 'halohydrin': return { tone: 'warn', t: `${b('같은 탄소에 OH 와 할로젠')}: HX 가 빠져 카보닐(C=O)이 되기 쉬운 불안정한 구조입니다.` };
    case 'hemiaminal': return { tone: 'warn', t: `${b('같은 탄소에 OH 와 NH₂')}: 물이 빠져 이민이 되기 쉬운 불안정한 구조입니다.` };
    case 'hemiacetal': return { tone: 'warn', t: `${b('헤미아세탈')}: 같은 탄소의 OH 와 OCH₃ 는 쉽게 풀려 알데하이드 · 케톤과 메탄올로 돌아갑니다.` };
    case 'chiral': return { tone: 'info', t: `${b('입체중심 ' + n.atoms.length + '개')}: 치환기 넷이 모두 다른 탄소가 있어 거울상 이성질체 두 가지(R/S)가 있습니다.` };
    case 'ez': return { tone: 'info', t: `${b('기하 이성질')}: 이중결합은 돌 수 없어 치환기 배치가 고정됩니다. 지금 모양은 ${b(n.desc)}입니다. 반대쪽 H 자리에 붙이면 ${n.desc === 'E' ? 'Z' : 'E'} 가 됩니다.` };
    case 'rule1993': return { tone: 'info', t: `${b('규칙 차이')}: 2013 권고 이전(대부분의 교과서) 규칙은 이중결합을 품은 사슬을 먼저 골라 ${code(n.en)}(${n.ko})${jo(n.ko, '로')} 부릅니다.` };
    default: return null;
  }
}
