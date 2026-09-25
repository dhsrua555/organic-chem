/* 작용기 도감 · 첫 화면 슬라이드에 쓰는 글 */

/* 순서 = 이름 짓기 우선순위. gid: 분자 조립에서 붙이는 작용기, demo: 대표 분자 */
export const GROUP_INFO = [
  {
    id: 'acid', gid: 'COOH', en: 'CARBOXYLIC ACID', ko: '카복실산', fg: '–COOH', rank: 1,
    suffix: ['-oic acid', '-산', '에탄산 = ethanoic acid'], ring: ['-carboxylic acid', '고리에 붙으면: 벤젠 → benzoic acid'], prefix: ['carboxy-', '더 높은 순위가 없어 거의 쓰지 않음'],
    desc: '카보닐(C=O)과 하이드록시(–OH)가 한 탄소에 붙은 기. 물에서 H⁺ 를 내놓는 약산(pKa 약 4~5)이고, 두 분자가 수소 결합으로 짝을 지어 끓는점이 높습니다. 식초의 아세트산, 레몬의 시트르산, 근육의 젖산.',
    demo: 'OC(=O)c1ccccc1',
    examples: ['CC(=O)O', 'CC(O)C(=O)O', 'OC(=O)/C=C\C(=O)O', 'OC(=O)c1ccccc1O']
  },
  {
    id: 'ester', gid: 'COOCH3', en: 'ESTER', ko: '에스터', fg: '–COO–R', rank: 2,
    suffix: ['alkyl …-oate', '…산 알킬', 'methyl ethanoate = 에탄산 메틸'], ring: ['alkyl …carboxylate', '벤젠 → methyl benzoate'], prefix: ['methoxycarbonyl- / methoxy-oxo', '사슬 끝이면 3-methoxy-3-oxo…'],
    desc: '카복실산의 H 자리에 알킬기가 들어간 구조. 과일 · 꽃 향기의 주인공입니다. 영어 이름은 알킬기를 앞에 따로 쓰고(methyl) 산 부분을 -oate 로 바꾸며, 한글 이름은 순서가 반대라 “…산 메틸” 이 됩니다.',
    demo: 'COC(=O)c1ccccc1O',
    examples: ['CCOC(C)=O', 'C=C(C)C(=O)OC', 'COC(=O)c1ccccc1O', 'CC(C)CCOC(C)=O']
  },
  {
    id: 'acylhalide', gid: 'COCl', en: 'ACYL HALIDE', ko: '산 할로젠화물', fg: '–COCl', rank: 3,
    suffix: ['-oyl chloride', '-오일 클로라이드', 'ethanoyl chloride = 아세틸 클로라이드'], ring: ['-carbonyl chloride', '벤젠 → benzoyl chloride'], prefix: ['carbonochloridoyl- / chloro-oxo', ''],
    desc: 'C=O 탄소에 Cl 이 붙은 가장 반응성 큰 카복실산 유도체. 물 · 알코올 · 아민과 곧바로 반응해 산 · 에스터 · 아마이드가 됩니다 (첨가–제거). 카복실산에 SOCl₂ 를 넣어 만듭니다.',
    demo: 'O=C(Cl)c1ccccc1',
    examples: ['CC(=O)Cl', 'CCC(=O)Cl', 'O=C(Cl)c1ccccc1', 'ClC(=O)CCC(=O)Cl']
  },
  {
    id: 'amide', gid: 'CONH2', en: 'AMIDE', ko: '아마이드', fg: '–CONH₂', rank: 4,
    suffix: ['-amide', '-아마이드', 'ethanamide = 에탄아마이드'], ring: ['-carboxamide', '벤젠 → benzamide'], prefix: ['carbamoyl- / amino-oxo', ''],
    desc: 'C=O 탄소에 질소가 붙은 기. 단백질의 펩타이드 결합이 바로 아마이드입니다. N 의 비공유 전자쌍이 C=O 와 공명해서 염기성이 거의 없고, C–N 결합이 잘 돌지 않아 평면을 이룹니다.',
    demo: 'CC(=O)Nc1ccc(O)cc1',
    examples: ['CC(N)=O', 'C=CC(N)=O', 'CC(=O)N(C)C', 'CC(=O)Nc1ccc(O)cc1']
  },
  {
    id: 'nitrile', gid: 'CN', en: 'NITRILE', ko: '나이트릴', fg: '–C≡N', rank: 5,
    suffix: ['-nitrile', '-나이트릴', 'C≡N 의 탄소까지 사슬에 셈'], ring: ['-carbonitrile', '벤젠 → benzonitrile'], prefix: ['cyano-', 'C≡N 의 탄소는 사슬에서 뺌'],
    desc: '탄소–질소 삼중결합. 접미사 -nitrile 로 쓸 때는 C≡N 탄소를 사슬에 넣지만, 접두사 cyano 로 쓸 때는 그 탄소를 빼고 셉니다 — 그래서 NC–CH₂CH₂–COOH 는 3-cyanopropanoic acid 입니다. 가수분해하면 카복실산이 됩니다.',
    demo: 'C=CC#N',
    examples: ['CC#N', 'C=CC#N', 'OC(=O)CCC#N', 'N#Cc1ccc(cc1)[N+](=O)[O-]']
  },
  {
    id: 'aldehyde', gid: 'CHO', en: 'ALDEHYDE', ko: '알데하이드', fg: '–CHO', rank: 6,
    suffix: ['-al', '-알', '늘 1번이라 번호를 안 씀'], ring: ['-carbaldehyde', '벤젠 → benzaldehyde'], prefix: ['formyl- / oxo-', '사슬 안이면 oxo, 가지면 formyl'],
    desc: 'C=O 탄소에 H 가 하나 붙은 기. 사슬 끝에만 올 수 있어서 그 탄소가 늘 1번이고, 이름에 1을 쓰지 않습니다. 쉽게 산화되어 카복실산이 됩니다 (은거울 반응).',
    demo: 'COc1cc(C=O)ccc1O',
    examples: ['CC=O', 'C=CC=O', 'O=CC1CCCCC1', 'COc1cc(C=O)ccc1O']
  },
  {
    id: 'ketone', gid: 'COCH3', en: 'KETONE', ko: '케톤', fg: '>C=O', rank: 7,
    suffix: ['-one', '-온', 'propan-2-one = 아세톤'], ring: ['(고리 이름으로는 못 씀)', '벤젠 + 아세틸 → 1-phenylethan-1-one'], prefix: ['oxo- / acetyl-', ''],
    desc: 'C=O 탄소 양쪽이 모두 탄소인 기. 사슬 가운데 있어서 번호가 꼭 필요합니다. 분자 조립에서는 H 가 둘 있는 탄소에 =O 조각을 붙이거나 아세틸기(–COCH₃)를 붙여 케톤을 만듭니다. 벤젠에 붙인 아세틸기는 고리 이름에 접미사로 붙일 수 없어서 1-phenylethan-1-one 처럼 사슬이 모체가 됩니다.',
    demo: 'O=C1CCCCC1',
    examples: ['CC(C)=O', 'O=C1CCCCC1', 'CC(=O)CC(C)=O', 'CC(=O)c1ccc(Cl)cc1']
  },
  {
    id: 'alcohol', gid: 'OH', en: 'ALCOHOL', ko: '알코올 · 페놀', fg: '–OH', rank: 8,
    suffix: ['-ol', '-올', 'propan-2-ol'], ring: ['벤젠 → phenol', '페놀은 알코올보다 산성이 강함'], prefix: ['hydroxy-', ''],
    desc: '사슬 탄소에 –OH. 수소 결합 덕분에 같은 크기의 탄화수소보다 끓는점이 훨씬 높고 물에 잘 녹습니다. OH 가 붙은 탄소에 이웃한 탄소 수로 1차 · 2차 · 3차 알코올을 나눕니다. 이중결합 탄소에 붙으면 엔올 — 곧 케톤 · 알데하이드로 바뀝니다.',
    demo: 'CC(C)C1CCC(C)CC1O',
    examples: ['CCO', 'C=CCO', 'OCC(O)CO', 'CC(C)C1CCC(C)CC1O']
  },
  {
    id: 'amine', gid: 'NH2', en: 'AMINE', ko: '아민', fg: '–NH₂', rank: 9,
    suffix: ['-amine', '-아민', 'propan-1-amine'], ring: ['벤젠 → aniline', ''], prefix: ['amino-', '아미노산 = 아미노 + 카복실산'],
    desc: 'N 의 비공유 전자쌍 때문에 H⁺ 를 받는 염기입니다. 생선 비린내의 메틸아민, 벤젠에 붙으면 아닐린. 아미노산은 한 분자에 아민과 카복실산을 모두 가지며, 이름에서는 순위가 높은 산이 접미사, 아민은 amino- 접두사가 됩니다.',
    demo: 'NCCc1ccc(O)c(O)c1',
    examples: ['CN', 'CCN(CC)CC', 'CC(N)C(=O)O', 'NCCc1ccc(O)c(O)c1']
  },
  {
    id: 'alkyl', gid: 'CH3', en: 'ALKYL', ko: '알킬 (메틸)', fg: '–CH₃', rank: null,
    suffix: ['(접미사 없음)', ''], ring: ['벤젠 → methylbenzene (toluene)', ''], prefix: ['methyl-', ''],
    desc: '탄소와 수소만 있는 가지. 늘 접두사입니다. 사슬 끝에 붙이면 주사슬 자체가 길어지고 번호가 다시 매겨집니다 — 프로펜 끝의 H 를 CH₃ 로 바꾸면 but-1-ene, 가운데는 2-methylprop-1-ene. 고리와 사슬이 함께 있으면 2013 규칙은 고리를 모체로 합니다 (octylbenzene).',
    demo: 'CC(C)Cc1ccc(cc1)C(C)C(=O)O',
    examples: ['C=CCC', 'C=C(C)C', 'C/C=C/C', 'CC1=CCC(CC1)C(=C)C']
  },
  {
    id: 'ether', gid: 'OCH3', en: 'ETHER', ko: '에터', fg: '–O–R', rank: null,
    suffix: ['(접미사 없음)', ''], ring: ['벤젠 → methoxybenzene (anisole)', ''], prefix: ['methoxy- (alkoxy-)', ''],
    desc: '산소 양쪽에 탄소가 붙은 구조. 수소 결합을 줄 H 가 없어 끓는점이 낮고 반응성이 작아 용매로 많이 씁니다. 이름은 큰 쪽이 모체, 작은 쪽이 alkoxy 접두사입니다.',
    demo: 'CCOCC',
    examples: ['COC', 'CCOCC', 'COc1ccccc1', 'CC(C)(C)OC']
  },
  {
    id: 'halide', gid: 'Cl', en: 'HALIDE', ko: '할로젠화물', fg: '–F –Cl –Br –I', rank: null,
    suffix: ['(접미사 없음)', ''], ring: ['벤젠 → chlorobenzene', ''], prefix: ['fluoro- chloro- bromo- iodo-', ''],
    desc: '할로젠(F · Cl · Br · I) 은 늘 접두사입니다. 탄소–할로젠 결합이 극성이라 치환 · 제거 반응의 출발점이 됩니다. 염화 바이닐은 PVC, 클로로폼은 옛 마취제입니다.',
    demo: 'CCC(C)Br',
    examples: ['ClC(Cl)Cl', 'C=CCl', 'CCC(C)Br', 'Brc1ccc(Cl)cc1']
  },
  {
    id: 'nitro', gid: 'NO2', en: 'NITRO', ko: '나이트로', fg: '–NO₂', rank: null,
    suffix: ['(접미사 없음)', ''], ring: ['벤젠 → nitrobenzene', ''], prefix: ['nitro-', ''],
    desc: '질소가 산소 둘과 결합한 기(N⁺–O⁻ 공명). 전자를 강하게 끌어당기고 늘 접두사로 씁니다. TNT · 피크르산처럼 여러 개 붙으면 폭발성이 됩니다.',
    demo: 'Cc1c(cc(cc1[N+](=O)[O-])[N+](=O)[O-])[N+](=O)[O-]',
    examples: ['C[N+](=O)[O-]', '[O-][N+](=O)c1ccccc1', 'Oc1ccc(cc1)[N+](=O)[O-]', 'Oc1c(cc(cc1[N+](=O)[O-])[N+](=O)[O-])[N+](=O)[O-]']
  }
];

/* 첫 화면 슬라이드 */
export const SLIDES = [
  { route: 'build', n: '01', en: 'BUILD', ko: '분자 조립', mol: 'C=CCO',
    desc: '뼈대나 유명한 분자에서 시작해 원자를 눌러 작용기 · 탄소 · 고리를 이어 붙이세요. 큰 분자도 됩니다. 붙일 때마다 이름이 어떻게 바뀌는지 — 주사슬 · 번호 · 접두사까지 한 단계씩 풀어 드립니다.' },
  { route: 'react', n: '02', en: 'REACTIONS', ko: '반응 예측', mol: 'CCC(C)Br',
    desc: '기질과 시약을 고르면 주생성물 · 부생성물을 예측합니다. SN1 · SN2 · E1 · E2, 마르코브니코프, 방향 지시, 라디칼 선택성, 그리고 교과서 이후에 새로 알려진 것까지.' },
  { route: 'groups', n: '03', en: 'FUNCTIONAL GROUPS', ko: '작용기 도감', mol: 'OC(=O)c1ccccc1O',
    desc: '분자의 성질을 정하는 원자 묶음 열두 가지. 이름 끝을 차지하는 우선순위대로 정리하고, 같은 작용기를 여러 뼈대에 붙였을 때의 이름을 한눈에 비교합니다.' },
  { route: 'rules', n: '04', en: 'NOMENCLATURE', ko: '명명법 다섯 단계', mol: 'C=CC(C)O',
    desc: '주 작용기 → 주사슬 → 번호 → 접두사 → 입체. 이 다섯 단계면 교과서에 나오는 대부분의 이름을 스스로 지을 수 있습니다. 한글 이름 읽는 법도 함께.' },
  { route: 'quiz', n: '05', en: 'QUIZ', ko: '이름 · 반응 퀴즈', mol: 'COc1cc(C=O)ccc1O',
    desc: '구조를 보고 이름을, 이름을 보고 구조를, 반응을 보고 주생성물을 고르세요. 틀리면 어느 단계에서 갈렸는지 풀이를 보여 줍니다.' }
];

/* 교과서 이후: 반응 예측 페이지 아래 연표 (연도 · 제목 · 설명) */
export const TIMELINE = [
  { y: '1998', t: '녹색 화학 12원칙', d: '아나스타스 · 워너가 정리. 독성 시약(6가 크로뮴, 수은)을 덜 쓰고 폐기물을 줄이는 방향으로 실험실 반응이 바뀌어 왔습니다.' },
  { y: '2001', t: '비대칭 촉매 수소화 · 산화 (노벨상)', d: '놀스 · 노요리(키랄 금속 촉매 수소화), 샤플리스(비대칭 에폭시화 · 다이하이드록시화). 한쪽 거울상만 만드는 반응이 의약품 합성의 기본이 되었습니다.' },
  { y: '2005', t: '올레핀 복분해 (노벨상)', d: '쇼뱅 · 그럽스 · 슈록. 금속 카벤 촉매로 C=C 의 짝을 바꿉니다. 고리 닫기 복분해는 큰 고리 약물 합성의 표준 도구.' },
  { y: '2008', t: 'SN2 의 “라운드어바웃” 경로', d: '분자빔 실험에서 친핵체가 탄소 주위를 한 바퀴 돈 뒤 치환하는 경로가 관찰되었습니다 (Science).' },
  { y: '2008~', t: '빛 촉매 (광산화환원)', d: '가시광선과 Ru · Ir · 유기 염료 촉매로 라디칼을 순하게 만드는 방법이 폭발적으로 발전했습니다.' },
  { y: '2010', t: 'Pd 교차 짝지음 (노벨상)', d: '헥 · 네기시 · 스즈키. 할로젠화 아릴과 유기 붕소 · 아연 · 알켄을 잇는 C–C 결합 반응. 오늘날 의약품 합성에서 가장 많이 쓰이는 반응 중 하나입니다.' },
  { y: '2011', t: '디엘스–알더 효소', d: 'SpnF 가 [4+2] 고리 첨가만 골라 촉매한다는 것이 처음 확인되었습니다 (Nature).' },
  { y: '2012', t: '크리기 중간체 직접 관찰', d: '오존 분해의 중간체(카보닐 옥사이드)를 기체 상태에서 직접 측정했고, 대기 화학에서 중요하다는 것이 밝혀졌습니다 (Science).' },
  { y: '2013', t: 'IUPAC 명명법 새 권고', d: '“선호 IUPAC 이름(PIN)” 도입. 주사슬은 길이를 먼저 보고, 고리가 사슬보다 우선하며, propan-2-ol 처럼 번호를 해당 자리 앞에 씁니다. 이 앱의 이름은 이 권고를 따릅니다.' },
  { y: '2013', t: '비고전적 양이온의 X선 구조', d: '60년 넘게 논쟁하던 2-노보닐 양이온이 가교된(비고전적) 구조임이 결정 구조로 확인되었습니다 (Science).' },
  { y: '2013', t: '비티히 반응의 현대적 해석', d: '리튬염이 없으면 베타인을 거치지 않고 옥사포스페테인이 곧바로 생긴다는 해석이 정리되었습니다 (Chem. Soc. Rev.).' },
  { y: '2018', t: '효소의 방향성 진화 (노벨상)', d: '아널드. 효소를 인공적으로 진화시켜 새로운 반응 · 친환경 공정에 씁니다.' },
  { y: '2018', t: '협동 SNAr', d: '교과서의 마이젠하이머 중간체 경로와 달리, 많은 방향족 친핵성 치환이 한 단계로 일어난다는 것이 밝혀졌습니다 (Nature Chemistry).' },
  { y: '2021', t: '비대칭 유기 촉매 (노벨상)', d: '리스트 · 맥밀런. 금속 없이 프롤린 같은 작은 유기 분자로 거울상 선택적 반응(알돌 등)을 일으킵니다.' },
  { y: '2022', t: '클릭 화학 · 생체직교 화학 (노벨상)', d: '샤플리스 · 멜달 · 버토지. 구리 촉매 아자이드–알카인 고리 첨가로 분자를 레고처럼 확실하게 잇고, 살아 있는 세포 안에서도 반응시킵니다.' }
];
