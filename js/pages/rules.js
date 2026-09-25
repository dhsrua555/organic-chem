/* 명명법: 다섯 단계를 예시 분자 하나로 따라가고, 우선순위 · 어근 · 벤젠 · 한글 이름 표를 붙인다 */
import { GROUP_INFO } from '../data.js';
import { drawMolecule } from '../draw.js';
import { molecule, tokensHTML, esc, getLang, onLang, store } from '../ui.js';

const b = s => `<b>${s}</b>`, code = s => `<code>${s}</code>`;
const STEMS = [['1', 'meth-', '메트 (메테인 · 메탄올)'], ['2', 'eth-', '에트 (에테인 · 에탄올)'], ['3', 'prop-', '프로프 (프로페인 · 프로판올)'], ['4', 'but-', '뷰트 (뷰테인 · 뷰탄올)'],
  ['5', 'pent-', '펜트'], ['6', 'hex-', '헥스'], ['7', 'hept-', '헵트'], ['8', 'oct-', '옥트'], ['9', 'non-', '논'], ['10', 'dec-', '데크']];

export function mount(root, app) {
  const EX = 'C=CC(C)O';
  function draw(smi, o = {}) { const m = molecule(smi); return { m, svg: drawMolecule(m.mol, m.res, Object.assign({ mode: store.get('drawMode', 'atoms') }, o)) }; }
  function nm(m) { return getLang() === 'ko' ? tokensHTML(m.res.ko) : tokensHTML(m.res.en); }
  function nm2(m) { return esc(getLang() === 'ko' ? m.res.nameEn : m.res.nameKo); }

  function render() {
    const ex = draw(EX);
    const ex0 = draw(EX, { chain: false, locants: false });
    const exChain = draw(EX, { locants: false });
    const pre = draw('CC(Br)CCl');
    const Z = draw('OC(=O)/C=C\\C(=O)O', { locants: false, chain: false }), E = draw('OC(=O)/C=C/C(=O)O', { locants: false, chain: false });
    /* R/S: 뷰탄-2-올 두 거울상, 중심 탄소에 CIP 순위 표시 */
    const rsPair = ['C[C@@H](O)CC', 'C[C@H](O)CC'].map(sm => { const m = molecule(sm); const c = [...m.res.rs.keys()][0]; return { m, svg: drawMolecule(m.mol, m.res, { mode: store.get('drawMode', 'atoms'), locants: false, chain: false, cip: c }) }; });
    const benz = ['Oc1ccccc1', 'Nc1ccccc1', 'OC(=O)c1ccccc1', 'O=Cc1ccccc1', 'N#Cc1ccccc1', 'NC(=O)c1ccccc1', 'COC(=O)c1ccccc1', 'Cc1ccccc1', 'COc1ccccc1', 'CC(=O)c1ccccc1'].map(sm => ({ sm, ...draw(sm, { locants: false }) }));
    const omp = [['Oc1ccccc1Cl', 'ortho'], ['Oc1cccc(Cl)c1', 'meta'], ['Oc1ccc(Cl)cc1', 'para']].map(([sm, w]) => ({ w, ...draw(sm) }));
    const len = draw('C=C(CC)C(C)=O');
    const rc = draw('CCCCCCCCc1ccccc1', { locants: false });
    const yne = draw('C=CC#C');
    root.innerHTML = `<section class="page">
      <div class="rules-hero">
        <p class="eyebrow"><span class="bar"></span>04 — NOMENCLATURE</p>
        <h1 class="title">NOMENCLATURE<small>명명법 다섯 단계</small></h1>
        <p class="lead">IUPAC 이름은 규칙을 정해진 순서대로 적용하면 하나로 정해집니다. 예시 분자 ${ex.m.res.nameEn.replace(/.*/, s => `<code>${esc(s)}</code>`)} 로 다섯 단계를 따라가 봅니다.</p>
        <p class="scroll-hint">SCROLL TO DISCOVER</p>
      </div>
      <div class="rule-steps">
        ${step(1, 'PRINCIPAL GROUP', '주 작용기 찾기', `<p>분자에 있는 작용기 중 <b>우선순위가 가장 높은 하나</b>가 이름 끝(접미사)을 차지합니다. 나머지는 모두 접두사가 됩니다.</p>
          <ul><li>카복실산 &gt; 에스터 &gt; 아마이드 &gt; 나이트릴 &gt; 알데하이드 &gt; 케톤 &gt; 알코올 &gt; 아민</li><li>할로젠 · 나이트로 · 에터 · 알킬은 언제나 접두사</li></ul>
          <p>예시에서는 OH(알코올)뿐이므로 접미사 <code>-ol</code>.</p>`, ex0)}
        ${step(2, 'PARENT CHAIN', '주사슬 고르기', `<p>주 작용기가 붙은 탄소를 품은 사슬 중에서 고릅니다.</p>
          <ul><li>주 작용기를 가장 많이 품을 것</li><li><b>가장 길 것</b> (IUPAC 2013. 옛 규칙은 이중결합 먼저)</li><li>길이가 같으면 이중결합을 품을 것 → 그다음 치환기가 많을 것</li></ul>
          <p>예시의 주사슬은 탄소 4개 → 어근 <code>but</code>. 이중결합이 있으니 <code>-ene</code>.</p>`, exChain)}
        ${step(3, 'NUMBERING', '번호 매기기', `<p>사슬 양 끝 중 어느 쪽부터 셀지는 다음 순서로 정합니다. 앞의 기준에서 갈리면 거기서 끝.</p>
          <ul><li>주 작용기에 가장 작은 번호</li><li>그다음 이중결합에 작은 번호</li><li>그다음 모든 접두사 번호 묶음이 작게 (처음 다른 자리에서 비교)</li><li>그래도 같으면 알파벳이 앞선 접두사에 작은 번호</li></ul>
          <p>OH 쪽부터 세면 OH=2, 이중결합=3 → <code>but-3-en-2-ol</code>. 반대로 세면 OH 가 3번이 되어 탈락.</p>`, ex)}
        ${step(4, 'PREFIXES', '접두사 붙이기', `<p>접두사는 <b>알파벳 순서</b>로 늘어놓고 각각 번호를 붙입니다.</p>
          <ul><li>같은 치환기가 여럿이면 di · tri · tetra (다이 · 트라이 · 테트라) — 알파벳 순서를 따질 때는 무시</li><li>치환기 안에 또 치환기가 있으면 괄호: 2-(hydroxymethyl)</li><li>번호와 글자 사이는 하이픈, 번호끼리는 쉼표</li></ul>
          <p>오른쪽: <b>b</b>romo 가 <b>c</b>hloro 보다 앞. 번호 묶음 {1,2} 는 어느 쪽에서 세어도 같아 <code>2-bromo-1-chloropropane</code>.</p>`, pre)}
        ${step(5, 'STEREO', '입체 표시 (E/Z · R/S)', `<p><b>E/Z</b> — 이중결합은 돌지 않아서 치환기 배치가 고정됩니다. 양 끝에서 CIP 우선순위가 높은 치환기끼리</p>
          <ul><li>같은 쪽이면 <b>Z</b> (zusammen, 함께), 반대쪽이면 <b>E</b> (entgegen, 반대)</li>
          <li>양쪽 탄소에 H 가 하나씩 있으면 <b>Z = cis</b>, <b>E = trans</b> 로 불러도 같습니다 (<code>cis-but-2-ene</code>). 치환기가 셋 이상이면 cis/trans 는 모호해서 E/Z 만 씁니다</li>
          <li>고리: 두 탄소에 치환기가 하나씩이면 고리의 같은 면 <b>cis</b>, 반대 면 <b>trans</b>. 고리는 돌 수 없어 서로 다른 화합물입니다. 1,4-이치환 사이클로헥세인처럼 R/S 가 없는 경우는 이름 앞에 <code>cis-</code> · <code>trans-</code></li></ul>
          <p><b>R/S</b> — 치환기 넷이 모두 다른 탄소(입체중심)는 거울상 두 가지가 있습니다.</p>
          <ul><li>CIP 순위: 붙은 원자의 원자번호가 큰 것이 ① (O > N > C > H). 같으면 그다음 원자들을 큰 것부터 비교, 이중결합의 원자는 두 번 셉니다</li>
          <li>가장 낮은 ④ (보통 H) 를 뒤로 보내고 ① → ② → ③ 이 시계 방향이면 <b>R</b>, 반대면 <b>S</b></li>
          <li>그림에서 쐐기(▲)는 앞으로, 빗금 쐐기는 뒤로 들어간 결합. H 가 앞으로 나와 있으면 보이는 방향을 거꾸로 읽습니다</li></ul>
          <p>이름 맨 앞에 번호 순서대로 한 괄호에: <code>(2R,3E)-pent-3-en-2-ol</code>. 입체 단위가 하나뿐이면 번호를 생략해 <code>(R)-butan-2-ol</code>. 분자 조립의 ‘R/S’ 도구로 배열을 뒤집어 볼 수 있습니다.</p>`, null, `<div class="pairs">${[Z, E, ...rsPair].map(x => `<div class="pair panel">${x.svg}<p class="pn">${nm(x.m)}</p><p>${nm2(x.m)}${x.m.common ? ' · ' + esc(x.m.common.ko) : ''}</p></div>`).join('')}</div>`)}
      </div>

      <div class="sec-h"><h2>Priority</h2><p>접미사 우선순위 한눈에</p></div>
      <div class="tbl-wrap panel"><table class="tbl"><thead><tr><th>순위</th><th>작용기</th><th>구조</th><th>사슬 접미사</th><th>고리</th><th>접두사</th></tr></thead><tbody>
        ${GROUP_INFO.map(g => `<tr${g.rank ? '' : ' class="sep"'}><td>${g.rank ? `<span class="n">${g.rank}</span>` : '—'}</td><td>${g.ko}</td><td class="m">${g.fg}</td><td class="m">${esc(g.suffix[0])}</td><td class="m">${esc(g.ring[0])}</td><td class="m">${esc(g.prefix[0])}</td></tr>`).join('')}
      </tbody></table></div>

      <div class="sec-h"><h2>Stems</h2><p>탄소 수 → 어근</p></div>
      <div class="tbl-wrap panel"><table class="tbl"><thead><tr><th>탄소</th><th>어근</th><th>한글</th></tr></thead><tbody>
        ${STEMS.map(([n, en, ko]) => `<tr><td class="m">${n}</td><td class="m">${en}</td><td>${ko}</td></tr>`).join('')}
      </tbody></table></div>

      <div class="sec-h"><h2>Benzene</h2><p>벤젠에 하나 붙으면 고유 이름이 모체가 됩니다</p></div>
      <div class="pairs">${benz.map(x => `<button class="pair panel ex" type="button" data-open="${esc(x.sm)}" style="grid-template-rows:auto auto">${x.svg}<p class="pn">${nm(x.m)}</p><p>${nm2(x.m)}${x.m.common ? ' · 관용명 ' + esc(x.m.common.ko) : ''}</p></button>`).join('')}</div>
      <p class="hint">둘 이상 붙으면 주 작용기 탄소가 1번이 되고, 나머지는 번호가 가장 작아지는 방향으로 셉니다. 두 개일 때 관용명은 o-(1,2) · m-(1,3) · p-(1,4).</p>
      <div class="pairs" style="margin-top:14px">${omp.map(x => `<div class="pair panel">${x.svg}<p class="pn">${nm(x.m)}</p><p>${x.w} · ${esc(x.m.common ? x.m.common.en : '')}</p></div>`).join('')}</div>

      <div class="sec-h"><h2>한글 이름</h2><p>대한화학회 표기 읽는 법</p></div>
      <div class="rule-step" style="border-top:0;padding-top:0">
        <div><ul>
          <li><b>-ane 과 모음 접미사</b>: 영어에서 e 가 빠지면 한글도 ‘-에인’ 이 ‘-안’ 으로: 메테인 → 메탄올, 프로페인 → 프로판-2-올. 자음 앞에서는 그대로: 프로페인-1,2-다이올, 에테인나이트릴.</li>
          <li><b>-oic acid → -산</b>: ethanoic acid = 에탄산, butanedioic acid = 뷰테인다이오산, benzoic acid = 벤조산.</li>
          <li><b>에스터는 순서가 반대</b>: methyl ethanoate = 에탄산 메틸.</li>
          <li><b>이중결합</b>: prop-2-en-1-ol = 프로프-2-엔-1-올, but-3-enoic acid = 뷰트-3-엔산.</li>
        </ul></div>
        <div><ul>
          <li><b>곱수</b>: di 다이 · tri 트라이 · tetra 테트라 · bis 비스.</li>
          <li><b>할로젠</b>: fluoro 플루오로 · chloro 클로로 · bromo 브로모 · iodo 아이오도.</li>
          <li><b>그 밖의 접두사</b>: hydroxy 하이드록시 · amino 아미노 · nitro 나이트로 · methoxy 메톡시 · oxo 옥소 · cyano 사이아노 · formyl 폼일.</li>
          <li>화면 아래 <b>EN · 한</b> 을 누르면 이름을 한글 먼저 보여 줍니다.</li>
        </ul></div>
      </div>

      <div class="sec-h"><h2>2013 vs 교과서</h2><p>규칙이 바뀐 곳</p></div>
      <div class="rule-step" style="border-top:0;padding-top:0">
        <div><p>IUPAC 2013 권고는 <b>사슬 길이를 이중결합보다 먼저</b> 봅니다. 대부분의 교과서(옛 규칙)는 이중결합을 품은 사슬을 먼저 골랐기 때문에 이름이 달라지는 분자가 있습니다.</p>
          <ul><li>2013: ${esc(len.m.res.nameEn)} (사슬 5개 + methylidene)</li><li>옛 규칙: ${esc(len.m.res.alt1993 ? len.m.res.alt1993.en : '')} (이중결합을 품은 사슬 4개)</li></ul>
          <p>고리와 사슬도 달라졌습니다. 2013 권고는 주 작용기 수가 같으면 ${b('고리를 모체')}로 합니다: ${code(esc(rc.m.res.nameEn))}. 옛 규칙은 탄소가 많은 쪽을 모체로 해 ${code(esc(rc.m.res.alt1993 ? rc.m.res.alt1993.en : ''))} 로 불렀습니다.</p>
          <p>이중결합과 삼중결합이 함께 있으면 둘을 합쳐 가장 작은 번호를 주고, 비기면 이중결합이 작은 번호를 받습니다: ${code(esc(yne.m.res.nameEn))}.</p>
          <p>이 앱은 2013 규칙으로 이름을 짓고, 두 규칙이 다르면 결과 아래에 옛 이름도 함께 알려 줍니다. 번호는 <code>propan-2-ol</code> 처럼 해당 자리 바로 앞에 씁니다 (옛 표기 2-propanol).</p></div>
        <div class="rule-ex panel">${len.svg}<p class="nm-line">${nm(len.m)}</p></div>
      </div>
    </section>`;
    root.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => app.go('build', { smiles: b.dataset.open })));
  }
  function step(n, en, ko, body, ex, custom) {
    return `<div class="rule-step"><span class="n">${n}</span><div><h3>${en}<small>${ko}</small></h3>${body}</div>
      ${custom || `<div class="rule-ex panel ticks">${ex.svg}<p class="nm-line">${nm(ex.m)}</p></div>`}</div>`;
  }
  app.setMol(molecule(EX));
  render();
  const off = onLang(render);
  return { unmount() { off(); } };
}
