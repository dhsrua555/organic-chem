/* 관용명 · 쓰임새. 열쇠는 이름 엔진이 만드는 IUPAC 영어 이름.
   [영어 관용명, 한글 관용명, 한 줄 설명] */
const TABLE = {
  'methanol': ['methyl alcohol', '메틸 알코올', '목정. 마시면 실명 · 사망할 수 있는 독성 알코올'],
  'ethanol': ['ethyl alcohol', '에틸 알코올', '술과 손소독제의 주성분'],
  'propan-2-ol': ['isopropyl alcohol', '아이소프로필 알코올', '소독용 알코올 솜의 성분'],
  'propan-1-ol': ['propyl alcohol', '프로필 알코올', ''],
  '2-methylpropan-2-ol': ['tert-butyl alcohol', 'tert-뷰틸 알코올', '3차 알코올: OH 가 붙은 탄소에 탄소 셋'],
  'prop-2-en-1-ol': ['allyl alcohol', '알릴 알코올', ''],
  'ethane-1,2-diol': ['ethylene glycol', '에틸렌 글라이콜', '자동차 부동액, PET 원료'],
  'propane-1,2,3-triol': ['glycerol', '글리세롤', '지방(트라이글리세라이드)의 뼈대, 보습제'],
  'methanediol': ['methylene glycol', '메틸렌 글라이콜', '폼알데하이드가 물에 녹은 수화물'],
  'ethenol': ['vinyl alcohol', '바이닐 알코올', '곧바로 아세트알데하이드로 바뀐다'],
  'ethanal': ['acetaldehyde', '아세트알데하이드', '숙취의 원인 물질'],
  'propanal': ['propionaldehyde', '프로피온알데하이드', ''],
  'prop-2-enal': ['acrolein', '아크롤레인', '기름을 태울 때 나는 매운 냄새'],
  'propan-2-one': ['acetone', '아세톤', '매니큐어 제거제'],
  'butan-2-one': ['methyl ethyl ketone', '메틸 에틸 케톤', '용매 (MEK)'],
  'pentane-2,4-dione': ['acetylacetone', '아세틸아세톤', '엔올 형태가 많이 섞여 있는 다이케톤'],
  'ethanoic acid': ['acetic acid', '아세트산', '식초의 신맛'],
  'propanoic acid': ['propionic acid', '프로피온산', '빵 방부제'],
  'butanoic acid': ['butyric acid', '뷰티르산', '상한 버터 냄새'],
  '2-methylpropanoic acid': ['isobutyric acid', '아이소뷰티르산', ''],
  'prop-2-enoic acid': ['acrylic acid', '아크릴산', '고흡수성 수지(기저귀)의 원료'],
  '2-methylprop-2-enoic acid': ['methacrylic acid', '메타크릴산', ''],
  '(E)-but-2-enoic acid': ['crotonic acid', '크로톤산', ''],
  '(Z)-but-2-enoic acid': ['isocrotonic acid', '아이소크로톤산', ''],
  '(Z)-but-2-enedioic acid': ['maleic acid', '말레산', 'cis 형. 가열하면 물이 빠져 고리 무수물이 된다'],
  '(E)-but-2-enedioic acid': ['fumaric acid', '푸마르산', 'trans 형. 시트르산 회로의 중간체'],
  'propanedioic acid': ['malonic acid', '말론산', ''],
  'butanedioic acid': ['succinic acid', '석신산', '호박산. 시트르산 회로의 중간체'],
  'pentanedioic acid': ['glutaric acid', '글루타르산', ''],
  '2-hydroxypropanoic acid': ['lactic acid', '젖산', '근육 운동 · 요구르트 발효의 산물'],
  '2-hydroxyethanoic acid': ['glycolic acid', '글라이콜산', '각질 제거 화장품'],
  '2-aminoethanoic acid': ['glycine', '글라이신', '가장 단순한 아미노산'],
  '2-aminopropanoic acid': ['alanine', '알라닌', '아미노산. 입체중심이 있어 L/D 가 있다'],
  '2-hydroxypropane-1,2,3-tricarboxylic acid': ['citric acid', '시트르산', '레몬의 신맛'],
  '3-oxobutanoic acid': ['acetoacetic acid', '아세토아세트산', '케톤체의 하나'],
  'methyl ethanoate': ['methyl acetate', '아세트산 메틸', '과일 향 용매'],
  'methyl prop-2-enoate': ['methyl acrylate', '아크릴산 메틸', ''],
  'methyl 2-methylprop-2-enoate': ['methyl methacrylate', '메타크릴산 메틸', '아크릴 수지(PMMA)의 단위체'],
  'ethanamide': ['acetamide', '아세트아마이드', ''],
  'prop-2-enamide': ['acrylamide', '아크릴아마이드', '감자를 고온에서 튀길 때 생기는 물질'],
  'ethanenitrile': ['acetonitrile', '아세토나이트릴', '실험실 용매'],
  'prop-2-enenitrile': ['acrylonitrile', '아크릴로나이트릴', '아크릴 섬유 · ABS 수지의 원료'],
  'propanedinitrile': ['malononitrile', '말로노나이트릴', ''],
  'chloromethane': ['methyl chloride', '염화 메틸', ''],
  'dichloromethane': ['methylene chloride', '염화 메틸렌', '실험실 용매'],
  'trichloromethane': ['chloroform', '클로로폼', '옛 마취제, 용매'],
  'chloroethene': ['vinyl chloride', '염화 바이닐', 'PVC 의 단위체'],
  '1,1-dichloroethene': ['vinylidene chloride', '염화 바이닐리덴', '랩 필름(PVDC) 원료'],
  '3-chloroprop-1-ene': ['allyl chloride', '염화 알릴', ''],
  'methoxymethane': ['dimethyl ether', '다이메틸 에터', ''],
  'methoxyethane': ['ethyl methyl ether', '에틸 메틸 에터', ''],
  'methanamine': ['methylamine', '메틸아민', '생선 비린내'],
  'ethanamine': ['ethylamine', '에틸아민', ''],
  'prop-2-en-1-amine': ['allylamine', '알릴아민', ''],
  '2-aminoethan-1-ol': ['ethanolamine', '에탄올아민', ''],
  'ethene': ['ethylene', '에틸렌', '과일을 익히는 식물 호르몬, 폴리에틸렌 원료'],
  'prop-1-ene': ['propylene', '프로필렌', '폴리프로필렌 원료'],
  'but-1-ene': ['1-butylene', '1-뷰틸렌', ''],
  '2-methylprop-1-ene': ['isobutylene', '아이소뷰틸렌', ''],
  '2-methylpropane': ['isobutane', '아이소뷰테인', '라이터 가스'],
  '2,2-dimethylpropane': ['neopentane', '네오펜테인', ''],
  'methylbenzene': ['toluene', '톨루엔', '페인트 · 접착제 용매'],
  'methoxybenzene': ['anisole', '아니솔', ''],
  '1-phenylethan-1-one': ['acetophenone', '아세토페논', ''],
  '1,2-dimethylbenzene': ['o-xylene', 'o-자일렌', ''],
  '1,3-dimethylbenzene': ['m-xylene', 'm-자일렌', ''],
  '1,4-dimethylbenzene': ['p-xylene', 'p-자일렌', 'PET 원료(테레프탈산)의 출발 물질'],
  '1,3,5-trimethylbenzene': ['mesitylene', '메시틸렌', ''],
  '2-methylphenol': ['o-cresol', 'o-크레졸', ''],
  '3-methylphenol': ['m-cresol', 'm-크레졸', ''],
  '4-methylphenol': ['p-cresol', 'p-크레졸', ''],
  '2-methylaniline': ['o-toluidine', 'o-톨루이딘', ''],
  '3-methylaniline': ['m-toluidine', 'm-톨루이딘', ''],
  '4-methylaniline': ['p-toluidine', 'p-톨루이딘', ''],
  '4-methoxyaniline': ['p-anisidine', 'p-아니시딘', ''],
  'benzene-1,2-diol': ['catechol', '카테콜', ''],
  'benzene-1,3-diol': ['resorcinol', '레조르시놀', ''],
  'benzene-1,4-diol': ['hydroquinone', '하이드로퀴논', '미백 연고 성분'],
  'benzene-1,2,3-triol': ['pyrogallol', '피로갈롤', ''],
  'benzene-1,4-diamine': ['p-phenylenediamine', 'p-페닐렌다이아민', '염색약 성분'],
  'benzene-1,2-dicarboxylic acid': ['phthalic acid', '프탈산', ''],
  'benzene-1,3-dicarboxylic acid': ['isophthalic acid', '아이소프탈산', ''],
  'benzene-1,4-dicarboxylic acid': ['terephthalic acid', '테레프탈산', 'PET 병의 원료'],
  'dimethyl benzene-1,4-dicarboxylate': ['dimethyl terephthalate', '테레프탈산 다이메틸', ''],
  '2-hydroxybenzoic acid': ['salicylic acid', '살리실산', '아스피린의 원료, 여드름 약'],
  'methyl 2-hydroxybenzoate': ['methyl salicylate', '살리실산 메틸', '파스 냄새(윈터그린 향)'],
  'methyl 4-hydroxybenzoate': ['methylparaben', '메틸파라벤', '화장품 방부제'],
  '2-hydroxybenzaldehyde': ['salicylaldehyde', '살리실알데하이드', ''],
  '4-methoxybenzaldehyde': ['p-anisaldehyde', 'p-아니스알데하이드', ''],
  '2-aminobenzoic acid': ['anthranilic acid', '안트라닐산', ''],
  '4-aminobenzoic acid': ['PABA', '파라아미노벤조산', '옛 자외선 차단제 성분'],
  '4-aminophenol': ['p-aminophenol', 'p-아미노페놀', '해열제 아세트아미노펜의 원료'],
  '4-hydroxy-3-methoxybenzaldehyde': ['vanillin', '바닐린', '바닐라 향의 주성분'],
  '2-methoxyphenol': ['guaiacol', '과이어콜', '훈제 향'],
  '3,4,5-trihydroxybenzoic acid': ['gallic acid', '갈산', '녹차 · 오배자의 떫은맛 성분'],
  '2-methyl-1,3,5-trinitrobenzene': ['TNT (trinitrotoluene)', '트라이나이트로톨루엔', '폭약'],
  '2,4,6-trinitrophenol': ['picric acid', '피크르산', '노란 폭약 · 염료'],
  '4-methylbenzoic acid': ['p-toluic acid', 'p-톨루산', ''],
  'ethenylbenzene': ['styrene', '스타이렌', '']
};

const OMP = { 1: ['o', 'o'], 2: ['m', 'm'], 3: ['p', 'p'] };
const PARENT = {
  acid: ['benzoic acid', '벤조산'], ester: ['benzoate', '벤조산'], amide: ['benzamide', '벤즈아마이드'], nitrile: ['benzonitrile', '벤조나이트릴'],
  aldehyde: ['benzaldehyde', '벤즈알데하이드'], alcohol: ['phenol', '페놀'], amine: ['aniline', '아닐린'], ketone: ['acetophenone', '아세토페논']
};
const PFX = {
  CH3: ['methyl', '메틸'], OCH3: ['methoxy', '메톡시'], F: ['fluoro', '플루오로'], Cl: ['chloro', '클로로'], Br: ['bromo', '브로모'], I: ['iodo', '아이오도'],
  NO2: ['nitro', '나이트로'], COOCH3: ['methoxycarbonyl', '메톡시카보닐'], CONH2: ['carbamoyl', '카바모일'], CN: ['cyano', '사이아노'], CHO: ['formyl', '폼일'],
  COCH3: ['acetyl', '아세틸'], OH: ['hydroxy', '하이드록시'], NH2: ['amino', '아미노'], COOH: ['carboxy', '카복시']
};
const CLS = { COOH: 'acid', COOCH3: 'ester', CONH2: 'amide', CN: 'nitrile', CHO: 'aldehyde', COCH3: 'ketone', OH: 'alcohol', NH2: 'amine' };

/* res: nameMolecule 결과. 반환 { en, ko, note, omp } 또는 null */
export function commonName(res) {
  const t = TABLE[res.nameEn];
  if (t) return { en: t[0], ko: t[1], note: t[2] || '' };
  if (res.kind === 'benzene') return ompName(res);
  return null;
}

/* 이치환 벤젠의 o-/m-/p- 이름 */
function ompName(res) {
  const pos = res.gid.map((g, i) => [g, i]).filter(([g]) => g);
  if (pos.length !== 2) return null;
  const d = Math.abs(pos[0][1] - pos[1][1]), rel = OMP[Math.min(d, 6 - d)];
  const [a, b] = [pos[0][0], pos[1][0]];
  const pre = (en, ko) => ({ en: `${rel[0]}-${en}`, ko: `${rel[1]}-${ko}`, note: '', omp: true });
  if (res.P && res.k === 1) {
    const other = CLS[a] === res.P ? b : a;
    const [pen, pko] = PARENT[res.P];
    const [xen, xko] = PFX[other];
    if (res.P === 'ester') return { en: `methyl ${rel[0]}-${xen}benzoate`, ko: `${rel[1]}-${xko}벤조산 메틸`, note: '', omp: true };
    return pre(xen + pen, xko + pko);
  }
  if (res.P) return null;
  if (a === b) return pre(`di${PFX[a][0]}benzene`, `다이${PFX[a][1]}벤젠`);
  for (const [g, pen, pko] of [['CH3', 'toluene', '톨루엔'], ['OCH3', 'anisole', '아니솔']]) {
    if (a === g || b === g) { const o = a === g ? b : a; return pre(PFX[o][0] + pen, PFX[o][1] + pko); }
  }
  const [x, y] = [PFX[a], PFX[b]].sort((p, q) => p[0] < q[0] ? -1 : 1);
  return pre(x[0] + y[0] + 'benzene', x[1] + y[1] + '벤젠');
}
