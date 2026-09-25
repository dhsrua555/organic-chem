/* 관용명 · 쓰임새. 열쇠는 이름 엔진이 만드는 IUPAC 영어 이름.
   [영어 관용명, 한글 관용명, 한 줄 설명] */
const TABLE = {
  'methanol': ['methyl alcohol', '메틸 알코올', '목정. 섭취 시 실명 · 사망을 일으키는 독성 알코올'],
  'ethanol': ['ethyl alcohol', '에틸 알코올', '술과 손소독제의 주성분'],
  'propan-2-ol': ['isopropyl alcohol', '아이소프로필 알코올', '소독용 알코올'],
  'propan-1-ol': ['propyl alcohol', '프로필 알코올', ''],
  '2-methylpropan-2-ol': ['tert-butyl alcohol', 'tert-뷰틸 알코올', '대표적인 3차 알코올'],
  'prop-2-en-1-ol': ['allyl alcohol', '알릴 알코올', ''],
  'ethane-1,2-diol': ['ethylene glycol', '에틸렌 글라이콜', '자동차 부동액, PET 원료'],
  'propane-1,2,3-triol': ['glycerol', '글리세롤', '트라이글리세라이드의 골격, 보습제'],
  'methanediol': ['methylene glycol', '메틸렌 글라이콜', '폼알데하이드가 물에 녹은 수화물'],
  'ethenol': ['vinyl alcohol', '바이닐 알코올', '호변이성화하여 아세트알데하이드로 존재'],
  'ethanal': ['acetaldehyde', '아세트알데하이드', '숙취의 원인 물질'],
  'propanal': ['propionaldehyde', '프로피온알데하이드', ''],
  'prop-2-enal': ['acrolein', '아크롤레인', '유지 과열 시 생성되는 자극성 물질'],
  'propan-2-one': ['acetone', '아세톤', '매니큐어 제거제'],
  'butan-2-one': ['methyl ethyl ketone', '메틸 에틸 케톤', '용매 (MEK)'],
  'pentane-2,4-dione': ['acetylacetone', '아세틸아세톤', '엔올 호변이성체 비율이 높은 1,3-다이케톤'],
  'ethanoic acid': ['acetic acid', '아세트산', '식초의 신맛'],
  'propanoic acid': ['propionic acid', '프로피온산', '식품 보존제'],
  'butanoic acid': ['butyric acid', '뷰티르산', '산패한 버터의 냄새 성분'],
  '2-methylpropanoic acid': ['isobutyric acid', '아이소뷰티르산', ''],
  'prop-2-enoic acid': ['acrylic acid', '아크릴산', '고흡수성 수지(기저귀)의 원료'],
  '2-methylprop-2-enoic acid': ['methacrylic acid', '메타크릴산', ''],
  '(E)-but-2-enoic acid': ['crotonic acid', '크로톤산', ''],
  '(Z)-but-2-enoic acid': ['isocrotonic acid', '아이소크로톤산', ''],
  '(Z)-but-2-enedioic acid': ['maleic acid', '말레산', 'cis 이성질체. 가열하면 탈수되어 고리형 산 무수물이 된다'],
  '(E)-but-2-enedioic acid': ['fumaric acid', '푸마르산', 'trans 이성질체. 시트르산 회로의 중간체'],
  'propanedioic acid': ['malonic acid', '말론산', ''],
  'butanedioic acid': ['succinic acid', '석신산', '호박산. 시트르산 회로의 중간체'],
  'pentanedioic acid': ['glutaric acid', '글루타르산', ''],
  '2-hydroxypropanoic acid': ['lactic acid', '젖산', '젖산 발효의 산물'],
  '2-hydroxyethanoic acid': ['glycolic acid', '글라이콜산', 'α-하이드록시산(AHA) 화장품 성분'],
  '2-aminoethanoic acid': ['glycine', '글라이신', '가장 단순한 아미노산'],
  '2-aminopropanoic acid': ['alanine', '알라닌', 'α-아미노산. 입체중심이 있어 L/D 이성질체가 존재'],
  '2-hydroxypropane-1,2,3-tricarboxylic acid': ['citric acid', '시트르산', '레몬의 신맛'],
  '3-oxobutanoic acid': ['acetoacetic acid', '아세토아세트산', '케톤체의 하나'],
  'methyl ethanoate': ['methyl acetate', '아세트산 메틸', '과일 향 용매'],
  'methyl prop-2-enoate': ['methyl acrylate', '아크릴산 메틸', ''],
  'methyl 2-methylprop-2-enoate': ['methyl methacrylate', '메타크릴산 메틸', '아크릴 수지(PMMA)의 단위체'],
  'ethanamide': ['acetamide', '아세트아마이드', ''],
  'prop-2-enamide': ['acrylamide', '아크릴아마이드', '고온 조리 시 생성되는 물질'],
  'ethanenitrile': ['acetonitrile', '아세토나이트릴', '실험실 용매'],
  'prop-2-enenitrile': ['acrylonitrile', '아크릴로나이트릴', '아크릴 섬유 · ABS 수지의 원료'],
  'propanedinitrile': ['malononitrile', '말로노나이트릴', ''],
  'chloromethane': ['methyl chloride', '염화 메틸', ''],
  'dichloromethane': ['methylene chloride', '염화 메틸렌', '실험실 용매'],
  'trichloromethane': ['chloroform', '클로로폼', '과거의 마취제, 용매'],
  'chloroethene': ['vinyl chloride', '염화 바이닐', 'PVC 의 단위체'],
  '1,1-dichloroethene': ['vinylidene chloride', '염화 바이닐리덴', '랩 필름(PVDC) 원료'],
  '3-chloroprop-1-ene': ['allyl chloride', '염화 알릴', ''],
  'methoxymethane': ['dimethyl ether', '다이메틸 에터', ''],
  'methoxyethane': ['ethyl methyl ether', '에틸 메틸 에터', ''],
  'methanamine': ['methylamine', '메틸아민', '생선 비린내 성분'],
  'ethanamine': ['ethylamine', '에틸아민', ''],
  'prop-2-en-1-amine': ['allylamine', '알릴아민', ''],
  '2-aminoethan-1-ol': ['ethanolamine', '에탄올아민', ''],
  'ethene': ['ethylene', '에틸렌', '식물 호르몬(과일 숙성), 폴리에틸렌 원료'],
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
  'methyl 2-hydroxybenzoate': ['methyl salicylate', '살리실산 메틸', '윈터그린 향 (파스)'],
  'methyl 4-hydroxybenzoate': ['methylparaben', '메틸파라벤', '화장품 방부제'],
  '2-hydroxybenzaldehyde': ['salicylaldehyde', '살리실알데하이드', ''],
  '4-methoxybenzaldehyde': ['p-anisaldehyde', 'p-아니스알데하이드', ''],
  '2-aminobenzoic acid': ['anthranilic acid', '안트라닐산', ''],
  '4-aminobenzoic acid': ['PABA', '파라아미노벤조산', '과거의 자외선 차단제 성분'],
  '4-aminophenol': ['p-aminophenol', 'p-아미노페놀', '해열제 아세트아미노펜의 원료'],
  '4-hydroxy-3-methoxybenzaldehyde': ['vanillin', '바닐린', '바닐라 향의 주성분'],
  '2-methoxyphenol': ['guaiacol', '과이어콜', '훈연 향 성분'],
  '3,4,5-trihydroxybenzoic acid': ['gallic acid', '갈산', '녹차 · 오배자의 떫은맛 성분'],
  '2-methyl-1,3,5-trinitrobenzene': ['TNT (trinitrotoluene)', '트라이나이트로톨루엔', '폭약'],
  '2,4,6-trinitrophenol': ['picric acid', '피크르산', '폭약 · 염료'],
  '4-methylbenzoic acid': ['p-toluic acid', 'p-톨루산', ''],
  'ethenylbenzene': ['styrene', '스타이렌', '폴리스타이렌(스티로폼)의 단위체'],
  '2-[4-(2-methylpropyl)phenyl]propanoic acid': ['ibuprofen', '이부프로펜', '진통 · 소염제'],
  '2-(acetyloxy)benzoic acid': ['aspirin', '아스피린', '해열진통제. 살리실산의 페놀성 OH 를 아세틸화한 에스터'],
  'N-(4-hydroxyphenyl)ethanamide': ['acetaminophen (paracetamol)', '아세트아미노펜', '해열 진통제'],
  '(E)-N-[(4-hydroxy-3-methoxyphenyl)methyl]-8-methylnon-6-enamide': ['capsaicin', '캡사이신', '고추의 매운맛'],
  '(E)-3,7-dimethylocta-2,6-dien-1-ol': ['geraniol', '제라니올', '장미 향'],
  '1-methyl-4-(prop-1-en-2-yl)cyclohex-1-ene': ['limonene', '리모넨', '귤 껍질 향'],
  '2-methyl-5-(prop-1-en-2-yl)cyclohex-2-en-1-one': ['carvone', '카본', '거울상 이성질체의 향이 다름: (R) 스피어민트 · (S) 캐러웨이'],
  '5-methyl-2-(propan-2-yl)cyclohexan-1-ol': ['menthol', '멘톨', '박하의 청량감 성분'],
  '4-(2-aminoethyl)benzene-1,2-diol': ['dopamine', '도파민', '신경전달물질'],
  'ethyl 4-aminobenzoate': ['benzocaine', '벤조카인', '국소 마취제'],
  'ethyl ethanoate': ['ethyl acetate', '아세트산 에틸', '매니큐어 제거제 · 과일 향 용매'],
  '3-methylbutyl ethanoate': ['isoamyl acetate', '아세트산 아이소아밀', '바나나 향'],
  'ethanoyl chloride': ['acetyl chloride', '아세틸 클로라이드', ''],
  'ethyne': ['acetylene', '아세틸렌', '산소-아세틸렌 용접의 연료'],
  'buta-1,3-diene': ['1,3-butadiene', '1,3-뷰타다이엔', '합성 고무의 원료'],
  '2-methylbuta-1,3-diene': ['isoprene', '아이소프렌', '천연 고무 · 테르펜의 단위'],
  'ethoxyethane': ['diethyl ether', '다이에틸 에터', '과거의 마취제, 용매'],
  '1,1′-biphenyl': ['biphenyl', '바이페닐', ''],
  'phenylmethanol': ['benzyl alcohol', '벤질 알코올', ''],
  '2-phenylethanoic acid': ['phenylacetic acid', '페닐아세트산', ''],
  'oxirane': ['ethylene oxide', '에틸렌 옥사이드', '소독 · 에틸렌 글라이콜 원료'],
  '2-methyloxirane': ['propylene oxide', '프로필렌 옥사이드', ''],
  '2-phenyloxirane': ['styrene oxide', '스타이렌 옥사이드', ''],
  'prop-2-yn-1-ol': ['propargyl alcohol', '프로파길 알코올', ''],
  'ethyl 3-oxobutanoate': ['ethyl acetoacetate', '아세토아세트산 에틸', '클라이젠 축합의 대표 생성물'],
  '(E)-but-2-enal': ['crotonaldehyde', '크로톤알데하이드', ''],
  '3-hydroxybutanal': ['aldol', '알돌', '알돌 반응의 명칭 유래 (aldehyde + alcohol)'],
  'methyl (E)-3-phenylprop-2-enoate': ['methyl cinnamate', '신남산 메틸', '딸기 향'],
  'propane-1,2-diol': ['propylene glycol', '프로필렌 글라이콜', '식품 · 화장품 보습제'],
  'N,N-dimethylaniline': ['N,N-dimethylaniline', 'N,N-다이메틸아닐린', ''],
  'cyclohexanol': ['cyclohexanol', '사이클로헥산올', '나일론 원료'],
  'methoxybenzene': ['anisole', '아니솔', ''],
  'methyl ethanoate': ['methyl acetate', '아세트산 메틸', '과일 향 용매']
};

const OMP = { 2: 'o', 3: 'm', 4: 'p' };
const BASE = { phenol: '페놀', aniline: '아닐린', 'benzoic acid': '벤조산', benzaldehyde: '벤즈알데하이드', benzonitrile: '벤조나이트릴', benzamide: '벤즈아마이드' };

/* res: nameMolecule 결과. 반환 { en, ko, note, omp } 또는 null */
/* 입체 표시 (2R,3E) 를 뺀 이름으로 찾고, 찾으면 앞에 R/S 를 붙여 준다 (아미노산은 L/D 도) */
const STEREO_RE = /\((?:\d*′*[EZRS],?)+\)-/g;
const LD = { alanine: { S: 'L', R: 'D' }, 'lactic acid': { S: 'L', R: 'D' } };
export function commonName(res) {
  const bare = res.nameEn.replace(STEREO_RE, '');
  const t = TABLE[res.nameEn] || TABLE[bare];
  if (t) {
    const rs = res.rs && res.rs.size ? [...res.rs.values()] : [];
    const st = res.nameEn !== bare && res.stereo && /[RS]/.test(res.stereo) ? `(${res.stereo})-` : '';
    const ld = rs.length === 1 && LD[t[0]] ? LD[t[0]][rs[0]] + '-' : '';
    return { en: (ld || st) + t[0], ko: (ld || st) + t[1], note: t[2] || '' };
  }
  if (res.kind === 'benzene') return ompName(res);
  return null;
}

/* 이치환 벤젠의 o-/m-/p- 이름: 접두사가 단순할 때만 */
function ompName(res) {
  const groups = res.prefixes || [];
  const locs = groups.flatMap(g => g.locs);
  if (groups.some(g => g.compound) || locs.some(l => typeof l !== 'number')) return null;
  const par = res.core.find(t => t.r === 'par');
  if (res.P && BASE[par.en] && locs.length === 1) {
    const rel = OMP[locs[0]];
    if (!rel) return null;
    return { en: `${rel}-${groups[0].en}${par.en}`, ko: `${rel}-${groups[0].ko}${BASE[par.en]}`, note: '', omp: true };
  }
  if (res.P || locs.length !== 2) return null;
  const sorted = locs.slice().sort((a, b) => a - b);
  const rel = OMP[sorted[1] - sorted[0] + 1] || (sorted[1] - sorted[0] === 5 ? 'o' : null);
  if (!rel) return null;
  if (groups.length === 1) return { en: `${rel}-di${groups[0].en}benzene`, ko: `${rel}-다이${groups[0].ko}벤젠`, note: '', omp: true };
  for (const [g, pen, pko] of [['methyl', 'toluene', '톨루엔'], ['methoxy', 'anisole', '아니솔']]) {
    const x = groups.find(q => q.en === g);
    if (x) { const o = groups.find(q => q !== x); return { en: `${rel}-${o.en}${pen}`, ko: `${rel}-${o.ko}${pko}`, note: '', omp: true }; }
  }
  return { en: `${rel}-${groups[0].en}${groups[1].en}benzene`, ko: `${rel}-${groups[0].ko}${groups[1].ko}벤젠`, note: '', omp: true };
}
