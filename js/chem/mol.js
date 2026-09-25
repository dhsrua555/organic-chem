/* 분자 모형: 뼈대(메테인 ~ 벤젠)의 H 자리에 작용기를 붙여 원자 · 결합 그래프를 만든다.
   원자는 무거운 원자만 두고 수소는 개수(h)로 센다. 좌표는 2D 그림 단위(결합 길이 ≈ 1). */

export const ELEMENTS = {
  H: { z: 1, m: 1.008, ko: '수소' },
  C: { z: 6, m: 12.011, ko: '탄소' },
  N: { z: 7, m: 14.007, ko: '질소' },
  O: { z: 8, m: 15.999, ko: '산소' },
  F: { z: 9, m: 18.998, ko: '플루오린' },
  Cl: { z: 17, m: 35.45, ko: '염소' },
  Br: { z: 35, m: 79.904, ko: '브로민' },
  I: { z: 53, m: 126.904, ko: '아이오딘' }
};

/* 작용기: 붙는 원자가 0번. atoms: [원소, 수소 수, 전하], bonds: [a, b, 차수]
   label/rev: 오른쪽 · 왼쪽으로 뻗을 때의 축약 표기 (숫자는 아래첨자로 그린다) */
export const GROUPS = {
  OH: { atoms: [['O', 1]], bonds: [], label: 'OH', rev: 'HO', ko: '하이드록시기', cls: 'alcohol' },
  NH2: { atoms: [['N', 2]], bonds: [], label: 'NH2', rev: 'H2N', ko: '아미노기', cls: 'amine' },
  CHO: { atoms: [['C', 1], ['O', 0]], bonds: [[0, 1, 2]], label: 'CHO', rev: 'OHC', ko: '폼일기', cls: 'aldehyde' },
  COCH3: { atoms: [['C', 0], ['O', 0], ['C', 3]], bonds: [[0, 1, 2], [0, 2, 1]], label: 'COCH3', rev: 'H3COC', ko: '아세틸기', cls: 'ketone' },
  COOH: { atoms: [['C', 0], ['O', 0], ['O', 1]], bonds: [[0, 1, 2], [0, 2, 1]], label: 'COOH', rev: 'HOOC', ko: '카복시기', cls: 'acid' },
  COOCH3: { atoms: [['C', 0], ['O', 0], ['O', 0], ['C', 3]], bonds: [[0, 1, 2], [0, 2, 1], [2, 3, 1]], label: 'COOCH3', rev: 'H3COOC', ko: '메톡시카보닐기', cls: 'ester' },
  CONH2: { atoms: [['C', 0], ['O', 0], ['N', 2]], bonds: [[0, 1, 2], [0, 2, 1]], label: 'CONH2', rev: 'H2NOC', ko: '카바모일기', cls: 'amide' },
  CN: { atoms: [['C', 0], ['N', 0]], bonds: [[0, 1, 3]], label: 'CN', rev: 'NC', ko: '사이아노기', cls: 'nitrile' },
  CH3: { atoms: [['C', 3]], bonds: [], label: 'CH3', rev: 'H3C', ko: '메틸기', cls: 'alkyl' },
  OCH3: { atoms: [['O', 0], ['C', 3]], bonds: [[0, 1, 1]], label: 'OCH3', rev: 'H3CO', ko: '메톡시기', cls: 'ether' },
  NO2: { atoms: [['N', 0, 1], ['O', 0], ['O', 0, -1]], bonds: [[0, 1, 2], [0, 2, 1]], label: 'NO2', rev: 'O2N', ko: '나이트로기', cls: 'nitro' },
  F: { atoms: [['F', 0]], bonds: [], label: 'F', rev: 'F', ko: '플루오로기', cls: 'halide' },
  Cl: { atoms: [['Cl', 0]], bonds: [], label: 'Cl', rev: 'Cl', ko: '클로로기', cls: 'halide' },
  Br: { atoms: [['Br', 0]], bonds: [], label: 'Br', rev: 'Br', ko: '브로모기', cls: 'halide' },
  I: { atoms: [['I', 0]], bonds: [], label: 'I', rev: 'I', ko: '아이오도기', cls: 'halide' }
};
export const GROUP_ORDER = ['COOH', 'COOCH3', 'CONH2', 'CN', 'CHO', 'COCH3', 'OH', 'NH2', 'CH3', 'OCH3', 'NO2', 'F', 'Cl', 'Br', 'I'];
export const MAX_GROUPS = 4;

const R = d => d * Math.PI / 180;
const dirv = deg => [Math.cos(R(deg)), Math.sin(R(deg))];

/* 뼈대: 탄소 좌표(y 는 위가 +), 결합, H 자리(방향 각도). 사슬은 루이스 구조식처럼 가로로 편다 */
const S = 1.5; /* 사슬의 C–C 간격: 위아래 축약 표기가 서로 닿지 않게 넉넉히 */
function hexRing() {
  const atoms = [], bonds = [], sites = [];
  for (let i = 0; i < 6; i++) {
    const a = 90 - 60 * i;
    atoms.push({ el: 'C', x: Math.cos(R(a)), y: Math.sin(R(a)) });
    bonds.push([i, (i + 1) % 6, i % 2 === 0 ? 2 : 1]);
    sites.push({ atom: i, dir: a });
  }
  return { atoms, bonds, sites, ring: [0, 1, 2, 3, 4, 5] };
}
export const SCAFFOLDS = {
  methane: {
    en: 'methane', ko: '메테인', formula: 'CH4', atoms: [{ el: 'C', x: 0, y: 0 }], bonds: [],
    sites: [{ atom: 0, dir: 90 }, { atom: 0, dir: 0 }, { atom: 0, dir: 270 }, { atom: 0, dir: 180 }]
  },
  ethane: {
    en: 'ethane', ko: '에테인', formula: 'C2H6', atoms: [{ el: 'C', x: 0, y: 0 }, { el: 'C', x: S, y: 0 }], bonds: [[0, 1, 1]],
    sites: [{ atom: 0, dir: 90 }, { atom: 0, dir: 180 }, { atom: 0, dir: 270 }, { atom: 1, dir: 90 }, { atom: 1, dir: 0 }, { atom: 1, dir: 270 }]
  },
  ethene: {
    en: 'ethene', ko: '에텐', formula: 'C2H4', atoms: [{ el: 'C', x: 0, y: 0 }, { el: 'C', x: 1.3, y: 0 }], bonds: [[0, 1, 2]],
    sites: [{ atom: 0, dir: 150 }, { atom: 0, dir: 210 }, { atom: 1, dir: 30 }, { atom: 1, dir: 330 }]
  },
  propane: {
    en: 'propane', ko: '프로페인', formula: 'C3H8', atoms: [{ el: 'C', x: 0, y: 0 }, { el: 'C', x: S, y: 0 }, { el: 'C', x: 2 * S, y: 0 }], bonds: [[0, 1, 1], [1, 2, 1]],
    sites: [{ atom: 0, dir: 90 }, { atom: 0, dir: 180 }, { atom: 0, dir: 270 }, { atom: 1, dir: 90 }, { atom: 1, dir: 270 }, { atom: 2, dir: 90 }, { atom: 2, dir: 0 }, { atom: 2, dir: 270 }]
  },
  propene: {
    en: 'propene', ko: '프로펜', formula: 'C3H6',
    atoms: [{ el: 'C', x: 0, y: 0 }, { el: 'C', x: 1.3, y: 0 }, { el: 'C', x: 1.3 + 1.4 * Math.cos(R(-60)), y: 1.4 * Math.sin(R(-60)) }],
    bonds: [[0, 1, 2], [1, 2, 1]],
    sites: [{ atom: 0, dir: 150 }, { atom: 0, dir: 210 }, { atom: 1, dir: 60 }, { atom: 2, dir: 20 }, { atom: 2, dir: 290 }, { atom: 2, dir: 200 }]
  },
  benzene: Object.assign({ en: 'benzene', ko: '벤젠', formula: 'C6H6' }, hexRing())
};
export const SCAFFOLD_ORDER = ['methane', 'ethane', 'ethene', 'propane', 'propene', 'benzene'];

/* 자리 번호: 뼈대마다 0부터. 사람이 읽는 이름표(예: C1 위)는 그림 쪽에서 만든다 */
export function siteCount(scaf) { return SCAFFOLDS[scaf].sites.length; }

/* subs: { 자리번호: 작용기 id } → 분자 */
export function build(scaf, subs = {}) {
  const def = SCAFFOLDS[scaf];
  const atoms = [], bonds = [];
  def.atoms.forEach((a, i) => atoms.push({ el: a.el, h: 0, q: 0, x: a.x, y: a.y, src: { kind: 'scaf', i } }));
  def.bonds.forEach(([a, b, o]) => bonds.push({ a, b, o, arom: !!def.ring }));
  const sites = def.sites.map((s, i) => {
    const d = dirv(s.dir), c = def.atoms[s.atom];
    return { i, atom: s.atom, dir: s.dir, x: c.x + d[0], y: c.y + d[1], group: subs[i] || null, gAtom: -1 };
  });
  for (const s of sites) {
    if (!s.group) { atoms[s.atom].h++; continue; }
    const g = GROUPS[s.group];
    const base = atoms.length;
    const pos = groupCoords(g, s);
    g.atoms.forEach(([el, h, q], k) => atoms.push({ el, h, q: q || 0, x: pos[k][0], y: pos[k][1], src: { kind: 'grp', site: s.i, gid: s.group, k } }));
    g.bonds.forEach(([a, b, o]) => bonds.push({ a: base + a, b: base + b, o }));
    bonds.push({ a: s.atom, b: base, o: 1 });
    s.gAtom = base;
  }
  const nb = atoms.map(() => []);
  bonds.forEach((b, k) => { nb[b.a].push({ j: b.b, o: b.o, k }); nb[b.b].push({ j: b.a, o: b.o, k }); });
  return { scaf, subs: { ...subs }, atoms, bonds, sites, nb, ring: def.ring || null };
}

/* 작용기 안쪽 원자의 대략적인 2D 좌표 (분자 파일 · 3D 초기값용) */
function groupCoords(g, s) {
  const out = [[s.x, s.y]];
  const n = g.atoms.length;
  for (let k = 1; k < n; k++) {
    const b = g.bonds.find(([a, c]) => c === k);
    const parent = b ? b[0] : 0;
    const p = out[parent];
    const side = k % 2 === 0 ? -60 : 60;
    const d = dirv(s.dir + side);
    out.push([p[0] + d[0], p[1] + d[1]]);
  }
  return out;
}

export function countGroups(subs) { return Object.values(subs).filter(Boolean).length; }

/* 분자식 (힐 순서) · 몰질량 */
export function formula(mol) {
  const cnt = {};
  for (const a of mol.atoms) { cnt[a.el] = (cnt[a.el] || 0) + 1; if (a.h) cnt.H = (cnt.H || 0) + a.h; }
  const keys = Object.keys(cnt).filter(k => k !== 'C' && k !== 'H').sort();
  const order = (cnt.C ? ['C', 'H'] : ['H']).filter(k => cnt[k]).concat(keys);
  const parts = order.map(k => [k, cnt[k]]);
  let mass = 0;
  for (const [k, n] of parts) mass += ELEMENTS[k].m * n;
  return { parts, text: parts.map(([k, n]) => k + (n > 1 ? n : '')).join(''), mass, count: cnt };
}

/* 불포화도 (고리 + π 결합 수) */
export function unsaturation(mol) {
  const c = formula(mol).count;
  const X = (c.F || 0) + (c.Cl || 0) + (c.Br || 0) + (c.I || 0);
  return ((2 * (c.C || 0) + 2 + (c.N || 0) - (c.H || 0) - X) / 2);
}

/* 검증용 MOL 파일 (2D 좌표, 케쿨레 결합) */
export function molblock(mol) {
  const L = ['', '  hexa', ''];
  L.push(`${String(mol.atoms.length).padStart(3)}${String(mol.bonds.length).padStart(3)}  0  0  0  0  0  0  0  0999 V2000`);
  for (const a of mol.atoms) L.push(`${a.x.toFixed(4).padStart(10)}${a.y.toFixed(4).padStart(10)}${'0.0000'.padStart(10)} ${a.el.padEnd(3)} 0  0  0  0  0  0  0  0  0  0  0  0`);
  for (const b of mol.bonds) L.push(`${String(b.a + 1).padStart(3)}${String(b.b + 1).padStart(3)}${String(b.o).padStart(3)}  0`);
  const ch = mol.atoms.map((a, i) => [i + 1, a.q]).filter(([, q]) => q);
  if (ch.length) L.push(`M  CHG${String(ch.length).padStart(3)}` + ch.map(([i, q]) => `${String(i).padStart(4)}${String(q).padStart(4)}`).join(''));
  L.push('M  END');
  return L.join('\n');
}

/* 구조를 한 줄로 적은 열쇠 (같은 분자인지 비교할 때 이름 대신 쓴다) */
export function key(scaf, subs) {
  return scaf + ':' + Object.keys(subs).filter(k => subs[k]).sort((a, b) => a - b).map(k => k + '=' + subs[k]).join(',');
}
