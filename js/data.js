/* 작용기 도감 · 첫 화면 슬라이드에 쓰는 글 */

/* 순서 = 이름 짓기 우선순위. gid: 분자 조립에서 붙이는 작용기, demo: 대표 분자 */
export const GROUP_INFO = [
  {
    id: 'acid', gid: 'COOH', en: 'CARBOXYLIC ACID', ko: '카복실산', fg: '–COOH', rank: 1,
    suffix: ['-oic acid', '-산', '에탄산 = ethanoic acid'], ring: ['-carboxylic acid', '고리에 붙으면: 벤젠 → benzoic acid'], prefix: ['carboxy-', '더 높은 순위가 없어 거의 쓰지 않음'],
    desc: '카보닐(C=O)과 하이드록시(–OH)가 한 탄소에 붙은 기. 물에서 H⁺ 를 내놓는 약산(pKa 약 4~5)이고, 두 분자가 수소 결합으로 짝을 지어 끓는점이 높습니다. 식초의 아세트산, 레몬의 시트르산, 근육의 젖산.',
    demo: ['benzene', { 0: 'COOH' }],
    examples: [['methane', { 0: 'COOH' }], ['ethane', { 0: 'COOH', 1: 'OH' }], ['ethene', { 0: 'COOH', 2: 'COOH' }], ['benzene', { 0: 'COOH', 1: 'OH' }]]
  },
  {
    id: 'ester', gid: 'COOCH3', en: 'ESTER', ko: '에스터', fg: '–COO–R', rank: 2,
    suffix: ['alkyl …-oate', '…산 알킬', 'methyl ethanoate = 에탄산 메틸'], ring: ['alkyl …carboxylate', '벤젠 → methyl benzoate'], prefix: ['methoxycarbonyl- / methoxy-oxo', '사슬 끝이면 3-methoxy-3-oxo…'],
    desc: '카복실산의 H 자리에 알킬기가 들어간 구조. 과일 · 꽃 향기의 주인공입니다. 영어 이름은 알킬기를 앞에 따로 쓰고(methyl) 산 부분을 -oate 로 바꾸며, 한글 이름은 순서가 반대라 “…산 메틸” 이 됩니다.',
    demo: ['benzene', { 0: 'COOCH3', 1: 'OH' }],
    examples: [['methane', { 0: 'COOCH3' }], ['ethene', { 0: 'COOCH3', 1: 'CH3' }], ['benzene', { 0: 'COOCH3', 1: 'OH' }], ['benzene', { 0: 'COOCH3', 3: 'OH' }]]
  },
  {
    id: 'amide', gid: 'CONH2', en: 'AMIDE', ko: '아마이드', fg: '–CONH₂', rank: 3,
    suffix: ['-amide', '-아마이드', 'ethanamide = 에탄아마이드'], ring: ['-carboxamide', '벤젠 → benzamide'], prefix: ['carbamoyl- / amino-oxo', ''],
    desc: 'C=O 탄소에 질소가 붙은 기. 단백질의 펩타이드 결합이 바로 아마이드입니다. N 의 비공유 전자쌍이 C=O 와 공명해서 염기성이 거의 없고, C–N 결합이 잘 돌지 않아 평면을 이룹니다.',
    demo: ['ethene', { 0: 'CONH2' }],
    examples: [['methane', { 0: 'CONH2' }], ['ethene', { 0: 'CONH2' }], ['benzene', { 0: 'CONH2' }], ['methane', { 0: 'COOH', 1: 'CONH2' }]]
  },
  {
    id: 'nitrile', gid: 'CN', en: 'NITRILE', ko: '나이트릴', fg: '–C≡N', rank: 4,
    suffix: ['-nitrile', '-나이트릴', 'C≡N 의 탄소까지 사슬에 셈'], ring: ['-carbonitrile', '벤젠 → benzonitrile'], prefix: ['cyano-', 'C≡N 의 탄소는 사슬에서 뺌'],
    desc: '탄소–질소 삼중결합. 접미사 -nitrile 로 쓸 때는 C≡N 탄소를 사슬에 넣지만, 접두사 cyano 로 쓸 때는 그 탄소를 빼고 셉니다 — 그래서 NC–CH₂CH₂–COOH 는 3-cyanopropanoic acid 입니다. 가수분해하면 카복실산이 됩니다.',
    demo: ['ethene', { 0: 'CN' }],
    examples: [['methane', { 0: 'CN' }], ['ethene', { 0: 'CN' }], ['ethane', { 0: 'COOH', 3: 'CN' }], ['benzene', { 0: 'CN', 3: 'NO2' }]]
  },
  {
    id: 'aldehyde', gid: 'CHO', en: 'ALDEHYDE', ko: '알데하이드', fg: '–CHO', rank: 5,
    suffix: ['-al', '-알', '늘 1번이라 번호를 안 씀'], ring: ['-carbaldehyde', '벤젠 → benzaldehyde'], prefix: ['formyl- / oxo-', '사슬 안이면 oxo, 가지면 formyl'],
    desc: 'C=O 탄소에 H 가 하나 붙은 기. 사슬 끝에만 올 수 있어서 그 탄소가 늘 1번이고, 이름에 1을 쓰지 않습니다. 쉽게 산화되어 카복실산이 됩니다 (은거울 반응).',
    demo: ['benzene', { 0: 'CHO', 2: 'OCH3', 3: 'OH' }],
    examples: [['methane', { 0: 'CHO' }], ['ethene', { 0: 'CHO' }], ['propene', { 3: 'CHO' }], ['benzene', { 0: 'CHO', 2: 'OCH3', 3: 'OH' }]]
  },
  {
    id: 'ketone', gid: 'COCH3', en: 'KETONE', ko: '케톤', fg: '>C=O', rank: 6,
    suffix: ['-one', '-온', 'propan-2-one = 아세톤'], ring: ['(고리 이름으로는 못 씀)', '벤젠 + 아세틸 → 1-phenylethan-1-one'], prefix: ['oxo- / acetyl-', ''],
    desc: 'C=O 탄소 양쪽이 모두 탄소인 기. 사슬 가운데 있어서 번호가 꼭 필요합니다. 이 앱에서는 아세틸기(–COCH₃)를 붙여 케톤을 만듭니다. 벤젠에 붙인 아세틸기는 고리 이름에 접미사로 붙일 수 없어서 1-phenylethan-1-one 처럼 사슬이 모체가 됩니다.',
    demo: ['methane', { 0: 'COCH3' }],
    examples: [['methane', { 0: 'COCH3' }], ['ethene', { 0: 'COCH3' }], ['methane', { 0: 'COCH3', 1: 'COCH3' }], ['benzene', { 0: 'COCH3', 3: 'Cl' }]]
  },
  {
    id: 'alcohol', gid: 'OH', en: 'ALCOHOL', ko: '알코올 · 페놀', fg: '–OH', rank: 7,
    suffix: ['-ol', '-올', 'propan-2-ol'], ring: ['벤젠 → phenol', '페놀은 알코올보다 산성이 강함'], prefix: ['hydroxy-', ''],
    desc: '사슬 탄소에 –OH. 수소 결합 덕분에 같은 크기의 탄화수소보다 끓는점이 훨씬 높고 물에 잘 녹습니다. OH 가 붙은 탄소에 이웃한 탄소 수로 1차 · 2차 · 3차 알코올을 나눕니다. 이중결합 탄소에 붙으면 엔올 — 곧 케톤 · 알데하이드로 바뀝니다.',
    demo: ['propene', { 3: 'OH' }],
    examples: [['ethane', { 0: 'OH' }], ['propene', { 3: 'OH' }], ['propane', { 0: 'OH', 3: 'OH', 5: 'OH' }], ['benzene', { 0: 'OH', 3: 'Cl' }]]
  },
  {
    id: 'amine', gid: 'NH2', en: 'AMINE', ko: '아민', fg: '–NH₂', rank: 8,
    suffix: ['-amine', '-아민', 'propan-1-amine'], ring: ['벤젠 → aniline', ''], prefix: ['amino-', '아미노산 = 아미노 + 카복실산'],
    desc: 'N 의 비공유 전자쌍 때문에 H⁺ 를 받는 염기입니다. 생선 비린내의 메틸아민, 벤젠에 붙으면 아닐린. 아미노산은 한 분자에 아민과 카복실산을 모두 가지며, 이름에서는 순위가 높은 산이 접미사, 아민은 amino- 접두사가 됩니다.',
    demo: ['ethane', { 0: 'COOH', 1: 'NH2' }],
    examples: [['methane', { 0: 'NH2' }], ['propene', { 3: 'NH2' }], ['ethane', { 0: 'COOH', 1: 'NH2' }], ['benzene', { 0: 'NH2', 3: 'CH3' }]]
  },
  {
    id: 'alkyl', gid: 'CH3', en: 'ALKYL', ko: '알킬 (메틸)', fg: '–CH₃', rank: null,
    suffix: ['(접미사 없음)', ''], ring: ['벤젠 → methylbenzene (toluene)', ''], prefix: ['methyl-', ''],
    desc: '탄소와 수소만 있는 가지. 늘 접두사입니다. 사슬 끝에 붙이면 주사슬 자체가 길어지고 번호가 다시 매겨집니다 — 프로펜 끝의 H 를 CH₃ 로 바꾸면 but-1-ene, 가운데는 2-methylprop-1-ene.',
    demo: ['benzene', { 0: 'CH3', 1: 'NO2', 3: 'NO2', 5: 'NO2' }],
    examples: [['propene', { 3: 'CH3' }], ['propene', { 2: 'CH3' }], ['propene', { 0: 'CH3' }], ['benzene', { 0: 'CH3', 2: 'CH3', 4: 'CH3' }]]
  },
  {
    id: 'ether', gid: 'OCH3', en: 'ETHER', ko: '에터', fg: '–O–R', rank: null,
    suffix: ['(접미사 없음)', ''], ring: ['벤젠 → methoxybenzene (anisole)', ''], prefix: ['methoxy- (alkoxy-)', ''],
    desc: '산소 양쪽에 탄소가 붙은 구조. 수소 결합을 줄 H 가 없어 끓는점이 낮고 반응성이 작아 용매로 많이 씁니다. 이름은 큰 쪽이 모체, 작은 쪽이 alkoxy 접두사입니다.',
    demo: ['benzene', { 0: 'OCH3' }],
    examples: [['methane', { 0: 'OCH3' }], ['ethane', { 0: 'OCH3' }], ['benzene', { 0: 'OCH3' }], ['benzene', { 0: 'OH', 1: 'OCH3' }]]
  },
  {
    id: 'halide', gid: 'Cl', en: 'HALIDE', ko: '할로젠화물', fg: '–F –Cl –Br –I', rank: null,
    suffix: ['(접미사 없음)', ''], ring: ['벤젠 → chlorobenzene', ''], prefix: ['fluoro- chloro- bromo- iodo-', ''],
    desc: '할로젠(F · Cl · Br · I) 은 늘 접두사입니다. 탄소–할로젠 결합이 극성이라 치환 · 제거 반응의 출발점이 됩니다. 염화 바이닐은 PVC, 클로로폼은 옛 마취제입니다.',
    demo: ['ethene', { 0: 'Cl' }],
    examples: [['methane', { 0: 'Cl', 1: 'Cl', 2: 'Cl' }], ['ethene', { 0: 'Cl' }], ['propene', { 3: 'Cl' }], ['benzene', { 0: 'Br', 3: 'Cl' }]]
  },
  {
    id: 'nitro', gid: 'NO2', en: 'NITRO', ko: '나이트로', fg: '–NO₂', rank: null,
    suffix: ['(접미사 없음)', ''], ring: ['벤젠 → nitrobenzene', ''], prefix: ['nitro-', ''],
    desc: '질소가 산소 둘과 결합한 기(N⁺–O⁻ 공명). 전자를 강하게 끌어당기고 늘 접두사로 씁니다. TNT · 피크르산처럼 여러 개 붙으면 폭발성이 됩니다.',
    demo: ['benzene', { 0: 'OH', 1: 'NO2', 3: 'NO2', 5: 'NO2' }],
    examples: [['methane', { 0: 'NO2' }], ['benzene', { 0: 'NO2' }], ['benzene', { 0: 'OH', 3: 'NO2' }], ['benzene', { 0: 'OH', 1: 'NO2', 3: 'NO2', 5: 'NO2' }]]
  }
];

/* 첫 화면 슬라이드 */
export const SLIDES = [
  { route: 'build', n: '01', en: 'BUILD', ko: '분자 조립', mol: ['propene', { 3: 'OH' }],
    desc: '벤젠 고리나 프로펜 사슬의 H 자리를 눌러 작용기를 붙여 보세요. 붙일 때마다 어떤 물질이 되는지, 이름이 왜 그렇게 바뀌는지 — 주사슬 · 번호 · 접두사까지 한 단계씩 풀어 드립니다.' },
  { route: 'groups', n: '02', en: 'FUNCTIONAL GROUPS', ko: '작용기 도감', mol: ['benzene', { 0: 'COOH', 1: 'OH' }],
    desc: '분자의 성질을 정하는 원자 묶음 열두 가지. 이름 끝을 차지하는 우선순위대로 정리하고, 같은 작용기를 여러 뼈대에 붙였을 때의 이름을 한눈에 비교합니다.' },
  { route: 'rules', n: '03', en: 'NOMENCLATURE', ko: '명명법 다섯 단계', mol: ['propene', { 3: 'OH', 4: 'CH3' }],
    desc: '주 작용기 → 주사슬 → 번호 → 접두사 → 입체. 이 다섯 단계면 교과서에 나오는 대부분의 이름을 스스로 지을 수 있습니다. 한글 이름 읽는 법도 함께.' },
  { route: 'quiz', n: '04', en: 'QUIZ', ko: '이름 맞히기', mol: ['benzene', { 0: 'CHO', 2: 'OCH3', 3: 'OH' }],
    desc: '구조를 보고 이름을, 이름을 보고 구조를 고르세요. 틀리면 어느 단계에서 갈렸는지 풀이를 보여 줍니다.' }
];

export const SCAF_KO = { methane: '메테인', ethane: '에테인', ethene: '에텐', propane: '프로페인', propene: '프로펜', benzene: '벤젠' };
export const SCAF_FORMULA = { methane: 'CH4', ethane: 'C2H6', ethene: 'C2H4', propane: 'C3H8', propene: 'C3H6', benzene: 'C6H6' };
