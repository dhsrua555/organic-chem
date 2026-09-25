/* 작용기 도감 · 첫 화면 슬라이드에 쓰는 글 */

/* 순서 = 이름 짓기 우선순위. gid: 분자 조립에서 붙이는 작용기, demo: 대표 분자 */
export const GROUP_INFO = [
  {
    id: 'acid', gid: 'COOH', en: 'CARBOXYLIC ACID', ko: '카복실산', fg: '–COOH', rank: 1,
    suffix: ['-oic acid', '-산', '에탄산 = ethanoic acid'], ring: ['-carboxylic acid', '고리에 붙으면: 벤젠 → benzoic acid'], prefix: ['carboxy-', '더 높은 순위가 없어 거의 쓰지 않음'],
    desc: '카보닐기(C=O)와 하이드록시기(–OH)가 같은 탄소에 결합한 작용기. 수용액에서 H⁺ 를 내놓는 약산(pKa 약 4–5)이며, 수소 결합으로 이량체를 이루어 끓는점이 높습니다. 예: 아세트산(식초), 시트르산, 젖산.',
    demo: 'OC(=O)c1ccccc1',
    examples: ['CC(=O)O', 'CC(O)C(=O)O', 'OC(=O)/C=C\\C(=O)O', 'OC(=O)c1ccccc1O']
  },
  {
    id: 'ester', gid: 'COOCH3', en: 'ESTER', ko: '에스터', fg: '–COO–R', rank: 2,
    suffix: ['alkyl …-oate', '…산 알킬', 'methyl ethanoate = 에탄산 메틸'], ring: ['alkyl …carboxylate', '벤젠 → methyl benzoate'], prefix: ['methoxycarbonyl- / methoxy-oxo', '사슬 끝이면 3-methoxy-3-oxo…'],
    desc: '카복실산의 산성 수소가 알킬기로 치환된 유도체. 과일 · 꽃 향의 주성분입니다. 영어 이름은 알킬기를 별도의 단어로 앞에 쓰고(methyl) 산 부분을 -oate 로 바꾸며, 한글 이름은 어순이 반대여서 “…산 메틸” 이 됩니다.',
    demo: 'COC(=O)c1ccccc1O',
    examples: ['CCOC(C)=O', 'C=C(C)C(=O)OC', 'COC(=O)c1ccccc1O', 'CC(C)CCOC(C)=O']
  },
  {
    id: 'acylhalide', gid: 'COCl', en: 'ACYL HALIDE', ko: '산 할로젠화물', fg: '–COCl', rank: 3,
    suffix: ['-oyl chloride', '-오일 클로라이드', 'ethanoyl chloride = 아세틸 클로라이드'], ring: ['-carbonyl chloride', '벤젠 → benzoyl chloride'], prefix: ['carbonochloridoyl- / chloro-oxo', ''],
    desc: '아실기에 할로젠이 결합한, 반응성이 가장 큰 카복실산 유도체. 물 · 알코올 · 아민과 친핵성 아실 치환(첨가–제거)으로 빠르게 반응해 산 · 에스터 · 아마이드를 줍니다. 카복실산과 SOCl₂ 로 합성합니다.',
    demo: 'O=C(Cl)c1ccccc1',
    examples: ['CC(=O)Cl', 'CCC(=O)Cl', 'O=C(Cl)c1ccccc1', 'ClC(=O)CCC(=O)Cl']
  },
  {
    id: 'amide', gid: 'CONH2', en: 'AMIDE', ko: '아마이드', fg: '–CONH₂', rank: 4,
    suffix: ['-amide', '-아마이드', 'ethanamide = 에탄아마이드'], ring: ['-carboxamide', '벤젠 → benzamide'], prefix: ['carbamoyl- / amino-oxo', ''],
    desc: '카보닐 탄소에 질소가 결합한 작용기. 단백질의 펩타이드 결합이 아마이드입니다. 질소의 비공유 전자쌍이 C=O 와 공명하여 염기성이 매우 약하고, C–N 결합의 회전이 제한되어 평면 구조를 이룹니다.',
    demo: 'CC(=O)Nc1ccc(O)cc1',
    examples: ['CC(N)=O', 'C=CC(N)=O', 'CC(=O)N(C)C', 'CC(=O)Nc1ccc(O)cc1']
  },
  {
    id: 'nitrile', gid: 'CN', en: 'NITRILE', ko: '나이트릴', fg: '–C≡N', rank: 5,
    suffix: ['-nitrile', '-나이트릴', 'C≡N 의 탄소까지 사슬에 셈'], ring: ['-carbonitrile', '벤젠 → benzonitrile'], prefix: ['cyano-', 'C≡N 의 탄소는 사슬에서 뺌'],
    desc: '탄소–질소 삼중결합을 가진 작용기. 접미사 -nitrile 을 쓸 때는 C≡N 탄소를 주사슬에 포함하지만, 접두사 cyano- 를 쓸 때는 포함하지 않습니다. 따라서 NC–CH₂CH₂–COOH 는 3-cyanopropanoic acid 입니다. 가수분해하면 카복실산이 됩니다.',
    demo: 'C=CC#N',
    examples: ['CC#N', 'C=CC#N', 'OC(=O)CCC#N', 'N#Cc1ccc(cc1)[N+](=O)[O-]']
  },
  {
    id: 'aldehyde', gid: 'CHO', en: 'ALDEHYDE', ko: '알데하이드', fg: '–CHO', rank: 6,
    suffix: ['-al', '-알', '늘 1번이라 번호를 안 씀'], ring: ['-carbaldehyde', '벤젠 → benzaldehyde'], prefix: ['formyl- / oxo-', '사슬 안이면 oxo, 가지면 formyl'],
    desc: '카보닐 탄소에 수소가 하나 결합한 작용기. 사슬 말단에만 올 수 있으므로 그 탄소가 항상 C1 이며, 위치번호 1은 이름에서 생략합니다. 쉽게 산화되어 카복실산이 됩니다 (톨렌스 시험의 은거울 반응).',
    demo: 'COc1cc(C=O)ccc1O',
    examples: ['CC=O', 'C=CC=O', 'O=CC1CCCCC1', 'COc1cc(C=O)ccc1O']
  },
  {
    id: 'ketone', gid: 'COCH3', en: 'KETONE', ko: '케톤', fg: '>C=O', rank: 7,
    suffix: ['-one', '-온', 'propan-2-one = 아세톤'], ring: ['(고리 이름으로는 못 씀)', '벤젠 + 아세틸 → 1-phenylethan-1-one'], prefix: ['oxo- / acetyl-', ''],
    desc: '카보닐 탄소 양쪽에 모두 탄소가 결합한 작용기. 사슬 내부에 있으므로 위치번호가 필요합니다. 편집기에서는 수소가 두 개인 탄소에 =O 를 도입하거나 아세틸기(–COCH₃)를 붙여 만듭니다. 벤젠에 결합한 아세틸기는 고리 접미사로 나타낼 수 없어 1-phenylethan-1-one 처럼 사슬이 모체가 됩니다.',
    demo: 'O=C1CCCCC1',
    examples: ['CC(C)=O', 'O=C1CCCCC1', 'CC(=O)CC(C)=O', 'CC(=O)c1ccc(Cl)cc1']
  },
  {
    id: 'alcohol', gid: 'OH', en: 'ALCOHOL', ko: '알코올 · 페놀', fg: '–OH', rank: 8,
    suffix: ['-ol', '-올', 'propan-2-ol'], ring: ['벤젠 → phenol', '페놀은 알코올보다 산성이 강함'], prefix: ['hydroxy-', ''],
    desc: 'sp³ 탄소에 결합한 하이드록시기(–OH). 수소 결합 때문에 비슷한 분자량의 탄화수소보다 끓는점이 높고 물에 잘 녹습니다. OH 가 결합한 탄소에 붙은 탄소 수에 따라 1차 · 2차 · 3차 알코올로 분류합니다. 이중결합 탄소에 결합하면 엔올이며, 호변이성에 의해 케톤 · 알데하이드로 존재합니다.',
    demo: 'CC(C)C1CCC(C)CC1O',
    examples: ['CCO', 'C=CCO', 'OCC(O)CO', 'CC(C)C1CCC(C)CC1O']
  },
  {
    id: 'amine', gid: 'NH2', en: 'AMINE', ko: '아민', fg: '–NH₂', rank: 9,
    suffix: ['-amine', '-아민', 'propan-1-amine'], ring: ['벤젠 → aniline', ''], prefix: ['amino-', '아미노산 = 아미노 + 카복실산'],
    desc: '질소의 비공유 전자쌍으로 H⁺ 를 받는 유기 염기. 메틸아민, 아닐린(벤젠 유도체) 등이 대표적입니다. 아미노산은 아민과 카복실산을 함께 가지며, 명명 시 우선순위가 높은 산이 접미사, 아민은 접두사 amino- 가 됩니다.',
    demo: 'NCCc1ccc(O)c(O)c1',
    examples: ['CN', 'CCN(CC)CC', 'CC(N)C(=O)O', 'NCCc1ccc(O)c(O)c1']
  },
  {
    id: 'alkyl', gid: 'CH3', en: 'ALKYL', ko: '알킬 (메틸)', fg: '–CH₃', rank: null,
    suffix: ['(접미사 없음)', ''], ring: ['벤젠 → methylbenzene (toluene)', ''], prefix: ['methyl-', ''],
    desc: '탄소와 수소로만 이루어진 치환기로, 항상 접두사로 나타냅니다. 사슬 말단에 도입하면 주사슬이 길어져 번호가 새로 매겨집니다(프로펜 말단 → but-1-ene, 가운데 → 2-methylprop-1-ene). 고리와 사슬이 함께 있으면 IUPAC 2013 규칙에서는 고리가 모체입니다 (octylbenzene).',
    demo: 'CC(C)Cc1ccc(cc1)C(C)C(=O)O',
    examples: ['C=CCC', 'C=C(C)C', 'C/C=C/C', 'CC1=CCC(CC1)C(=C)C']
  },
  {
    id: 'ether', gid: 'OCH3', en: 'ETHER', ko: '에터', fg: '–O–R', rank: null,
    suffix: ['(접미사 없음)', ''], ring: ['벤젠 → methoxybenzene (anisole)', ''], prefix: ['methoxy- (alkoxy-)', ''],
    desc: '산소 원자 양쪽에 탄소가 결합한 구조(C–O–C). 수소 결합 주개가 없어 끓는점이 낮고 반응성이 작아 용매로 널리 쓰입니다. 치환 명명에서는 큰 쪽이 모체, 작은 쪽이 접두사 alkoxy- 가 됩니다.',
    demo: 'CCOCC',
    examples: ['COC', 'CCOCC', 'COc1ccccc1', 'CC(C)(C)OC']
  },
  {
    id: 'halide', gid: 'Cl', en: 'HALIDE', ko: '할로젠화물', fg: '–F –Cl –Br –I', rank: null,
    suffix: ['(접미사 없음)', ''], ring: ['벤젠 → chlorobenzene', ''], prefix: ['fluoro- chloro- bromo- iodo-', ''],
    desc: '할로젠(F · Cl · Br · I)은 항상 접두사로 나타냅니다. 탄소–할로젠 결합이 극성이어서 친핵성 치환 · 제거 반응의 기질이 됩니다. 예: 염화 바이닐(PVC 단량체), 클로로폼(과거의 마취제).',
    demo: 'CCC(C)Br',
    examples: ['ClC(Cl)Cl', 'C=CCl', 'CCC(C)Br', 'Brc1ccc(Cl)cc1']
  },
  {
    id: 'nitro', gid: 'NO2', en: 'NITRO', ko: '나이트로', fg: '–NO₂', rank: null,
    suffix: ['(접미사 없음)', ''], ring: ['벤젠 → nitrobenzene', ''], prefix: ['nitro-', ''],
    desc: '질소가 산소 두 개와 결합한 작용기(N⁺–O⁻ 공명). 강한 전자 끄는 기이며 항상 접두사로 나타냅니다. TNT · 피크르산처럼 여러 개 결합하면 폭발성을 띱니다.',
    demo: 'Cc1c(cc(cc1[N+](=O)[O-])[N+](=O)[O-])[N+](=O)[O-]',
    examples: ['C[N+](=O)[O-]', '[O-][N+](=O)c1ccccc1', 'Oc1ccc(cc1)[N+](=O)[O-]', 'Oc1c(cc(cc1[N+](=O)[O-])[N+](=O)[O-])[N+](=O)[O-]']
  }
];

/* 첫 화면 슬라이드 */
export const SLIDES = [
  { route: 'build', n: '01', en: 'BUILD', ko: '구조식 편집기', mol: 'C=CCO',
    desc: '기본 골격이나 대표 화합물에서 출발해 치환기 · 탄소 · 고리를 도입합니다. 구조가 바뀔 때마다 IUPAC 이름이 어떻게 달라지는지 주사슬 선택, 위치번호, 접두사, 입체 표시(R/S · E/Z)까지 단계별로 제시합니다.' },
  { route: 'react', n: '02', en: 'REACTIONS', ko: '반응 예측', mol: 'C[C@@H](Br)CC',
    desc: '기질과 시약을 고르면 주생성물과 부생성물을 예측합니다. SN1 · SN2 · E1 · E2(안티-페리플래너), 마르코브니코프 규칙, syn · anti 첨가, 에폭사이드 개환, 엔올레이트, 방향족 치환을 다루며, 반응마다 메커니즘과 최근 연구를 함께 제시합니다.' },
  { route: 'groups', n: '03', en: 'FUNCTIONAL GROUPS', ko: '작용기와 우선순위', mol: 'OC(=O)c1ccccc1O',
    desc: '화합물의 성질과 반응성을 결정하는 작용기 열두 가지를 명명 우선순위 순으로 정리하고, 같은 작용기가 여러 골격에 도입될 때의 이름을 비교합니다.' },
  { route: 'rules', n: '04', en: 'NOMENCLATURE', ko: 'IUPAC 명명법', mol: 'C=CC(C)O',
    desc: '주 작용기 → 주사슬 → 위치번호 → 접두사 → 입체 표시. IUPAC 2013 권고안의 명명 절차를 예제 분자에 단계별로 적용하고, 대한화학회 한글 표기법을 함께 정리합니다.' },
  { route: 'quiz', n: '05', en: 'PRACTICE', ko: '연습 문제', mol: 'COc1cc(C=O)ccc1O',
    desc: '명명 · 반응 · 입체화학 · 작용기 네 분야를 세부 주제별로 연습합니다. 오답에는 명명 과정과 반응 메커니즘 해설이 따릅니다.' }
];

/* 교과서 이후: 반응 예측 페이지 아래 연표 (연도 · 제목 · 설명) */

