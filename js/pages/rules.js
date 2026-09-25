/* 명명법: 다섯 단계를 예시 분자 하나로 한 단계씩 따라가고, 우선순위 · 어근 · 벤젠 · 한글 이름 · 2013 규칙은 탭으로 골라 본다 */
import { GROUP_INFO } from '../data.js';
import { drawMolecule } from '../draw.js';
import { molecule, tokensHTML, esc, getLang, onLang, store, tabsHTML, tabNow, drawMode } from '../ui.js';

const b = s => `<b>${s}</b>`, code = s => `<code>${s}</code>`;
const STEMS = [['1', 'meth-', '메트 (메테인 · 메탄올)'], ['2', 'eth-', '에트 (에테인 · 에탄올)'], ['3', 'prop-', '프로프 (프로페인 · 프로판올)'], ['4', 'but-', '뷰트 (뷰테인 · 뷰탄올)'],
  ['5', 'pent-', '펜트'], ['6', 'hex-', '헥스'], ['7', 'hept-', '헵트'], ['8', 'oct-', '옥트'], ['9', 'non-', '논'], ['10', 'dec-', '데크']];
const STEP_KO = ['주 작용기', '주사슬', '위치번호', '접두사', '입체 표시'];

export function mount(root, app) {
  const EX = 'C=CC(C)O';
  function draw(smi, o = {}) { const m = molecule(smi); return { m, svg: drawMolecule(m.mol, m.res, Object.assign({ mode: drawMode() }, o)) }; }
  function nm(m) { return getLang() === 'ko' ? tokensHTML(m.res.ko) : tokensHTML(m.res.en); }
  function nm2(m) { return esc(getLang() === 'ko' ? m.res.nameEn : m.res.nameKo); }

  function render() {
    const ex = draw(EX);
    const ex0 = draw(EX, { chain: false, locants: false });
    const exChain = draw(EX, { locants: false });
    const pre = draw('CC(Br)CCl');
    const Z = draw('OC(=O)/C=C\\C(=O)O', { locants: false, chain: false }), E = draw('OC(=O)/C=C/C(=O)O', { locants: false, chain: false });
    /* R/S: 뷰탄-2-올 두 거울상, 중심 탄소에 CIP 순위 표시 */
    const rsPair = ['C[C@@H](O)CC', 'C[C@H](O)CC'].map(sm => { const m = molecule(sm); const c = [...m.res.rs.keys()][0]; return { m, svg: drawMolecule(m.mol, m.res, { mode: drawMode(), locants: false, chain: false, cip: c }) }; });
    const benz = ['Oc1ccccc1', 'Nc1ccccc1', 'OC(=O)c1ccccc1', 'O=Cc1ccccc1', 'N#Cc1ccccc1', 'NC(=O)c1ccccc1', 'COC(=O)c1ccccc1', 'Cc1ccccc1', 'COc1ccccc1', 'CC(=O)c1ccccc1'].map(sm => ({ sm, ...draw(sm, { locants: false }) }));
    const omp = [['Oc1ccccc1Cl', 'ortho'], ['Oc1cccc(Cl)c1', 'meta'], ['Oc1ccc(Cl)cc1', 'para']].map(([sm, w]) => ({ w, ...draw(sm) }));
    const len = draw('C=C(CC)C(C)=O');
    const rc = draw('CCCCCCCCc1ccccc1', { locants: false });
    const yne = draw('C=CC#C');

    const steps = [
      step(1, 'PRINCIPAL GROUP', '주 작용기 결정', `<p>화합물에 있는 작용기 가운데 <b>우선순위가 가장 높은 것</b>이 주 작용기(IUPAC: 주특성기, principal characteristic group)가 되어 접미사로 표시되고, 나머지는 모두 접두사로 나타냅니다.</p>
          <ul><li>카복실산 &gt; 에스터 &gt; 산 할로젠화물 &gt; 아마이드 &gt; 나이트릴 &gt; 알데하이드 &gt; 케톤 &gt; 알코올 &gt; 아민</li><li>할로젠 · 나이트로 · 에터(알콕시) · 알킬은 항상 접두사</li></ul>
          <p>예제에는 알코올(OH)만 있으므로 접미사는 <code>-ol</code> 입니다. 전체 우선순위는 ‘우선순위’ 탭에 정리했습니다.</p>`, ex0),
      step(2, 'PARENT CHAIN', '주사슬 선택', `<p>주 작용기가 결합한 탄소를 포함하는 사슬 가운데서 다음 기준을 차례로 적용합니다.</p>
          <ul><li>주 작용기를 가장 많이 포함할 것</li><li><b>가장 길 것</b> (IUPAC 2013. 1993 규칙은 다중결합 수를 먼저 봄)</li><li>길이가 같으면 다중결합이 많을 것 → 그다음 치환기가 많을 것</li></ul>
          <p>예제의 주사슬은 탄소 4개이므로 어근은 <code>but</code>, 이중결합이 있으므로 어미는 <code>-ene</code> 입니다.</p>`, exChain),
      step(3, 'NUMBERING', '위치번호 부여', `<p>번호를 매길 방향은 다음 기준을 차례로 적용해 정하며, 앞 기준에서 결정되면 뒤 기준은 보지 않습니다.</p>
          <ul><li>주 작용기에 가장 낮은 위치번호</li><li>다중결합에 낮은 위치번호 (같으면 이중결합 우선)</li><li>접두사 위치번호 집합이 가장 낮게 (첫 번째 차이점 규칙)</li><li>그래도 같으면 알파벳순으로 먼저 오는 접두사에 낮은 위치번호</li></ul>
          <p>OH 쪽부터 번호를 매기면 OH = 2, 이중결합 = 3 → <code>but-3-en-2-ol</code>. 반대 방향은 OH 가 3번이 되므로 채택하지 않습니다.</p>`, ex),
      step(4, 'PREFIXES', '접두사 배열', `<p>치환기 접두사는 <b>알파벳순</b>으로 배열하고 각각 위치번호를 붙입니다.</p>
          <ul><li>같은 치환기가 여러 개이면 배수 접두사 di- · tri- · tetra- (다이 · 트라이 · 테트라)를 붙이며, 알파벳순을 정할 때는 고려하지 않음</li><li>치환기 안에 다시 치환기가 있는 복합 치환기는 괄호로 묶음: 2-(hydroxymethyl)</li><li>위치번호와 문자 사이는 하이픈, 위치번호끼리는 쉼표</li></ul>
          <p>예: <b>b</b>romo 가 <b>c</b>hloro 보다 앞에 옵니다. 위치번호 집합 {1,2} 는 어느 방향에서도 같으므로 알파벳순으로 먼저 오는 bromo 에 낮은 번호를 주어 <code>2-bromo-1-chloropropane</code> 이 됩니다.</p>`, pre),
      step(5, 'STEREO', '입체 표시 (E/Z · R/S · cis/trans)', `<p><b>E/Z</b> — 이중결합은 회전이 제한되어 치환기 배치가 고정됩니다. 양 끝 탄소에서 CIP 우선순위가 높은 치환기가</p>
          <ul><li>같은 쪽에 있으면 <b>Z</b> (zusammen), 반대쪽에 있으면 <b>E</b> (entgegen)</li>
          <li>양 끝 탄소에 H 가 하나씩 있으면 <b>Z = cis</b>, <b>E = trans</b> 입니다 (<code>cis-but-2-ene</code>). 삼치환 이상의 이중결합은 cis/trans 기준이 모호하므로 E/Z 로만 표시합니다</li>
          <li>고리: 두 고리 탄소에 치환기가 하나씩 있으면 같은 면은 <b>cis</b>, 반대 면은 <b>trans</b>. 고리 결합은 자유 회전이 불가능하므로 두 배치는 서로 다른 부분입체이성질체입니다. 1,4-이치환 사이클로헥세인처럼 CIP 입체중심이 없으면 이름 앞에 <code>cis-</code> · <code>trans-</code> 를 붙입니다</li></ul>
          <p><b>R/S</b> — 네 치환기가 모두 다른 sp³ 탄소(입체중심)에는 두 가지 절대 배열이 있습니다.</p>
          <ul><li>CIP 우선순위: 입체중심에 직접 결합한 원자의 원자번호가 클수록 우선합니다 (O &gt; N &gt; C &gt; H). 같으면 다음 원자 집합을 비교하며, 다중결합 원자는 중복 원자로 계산합니다</li>
          <li>최저 순위 ④(보통 H)를 관찰자 반대쪽에 두고 ① → ② → ③ 이 시계 방향이면 <b>R</b>, 반시계 방향이면 <b>S</b></li>
          <li>구조식에서 굵은 쐐기는 지면 앞쪽, 점선 쐐기는 지면 뒤쪽을 향하는 결합입니다. ④ 가 앞쪽을 향하면 보이는 회전 방향을 반대로 읽습니다</li>
          <li>구성이 같은 두 치환기가 각각 R · S 배열을 가지면 그 탄소는 <b>의사비대칭 중심</b>(pseudoasymmetric center)이며 소문자 <b>r · s</b> 로 표시합니다 (CIP 규칙 5: R 치환기 우선)</li></ul>
          <p>입체 표시는 위치번호 순으로 한 괄호에 모아 이름 앞에 둡니다: <code>(2R,3E)-pent-3-en-2-ol</code>. 입체 단위가 하나이면 위치번호를 생략합니다: <code>(R)-butan-2-ol</code>. 편집기의 ‘R/S’ 도구로 배열을 반전할 수 있습니다.</p>`, null, `<div class="pairs">${[Z, E, ...rsPair].map(x => `<div class="pair panel">${x.svg}<p class="pn">${nm(x.m)}</p><p>${nm2(x.m)}${x.m.common ? ' · ' + esc(x.m.common.ko) : ''}</p></div>`).join('')}</div>`)
    ];

    const prio = `<p class="tab-lead">작용기 우선순위 (IUPAC 2013). 위에 있을수록 우선하여 접미사로 표시됩니다.</p>
      <div class="tbl-wrap panel"><table class="tbl"><thead><tr><th>순위</th><th>작용기</th><th>구조</th><th>사슬 접미사</th><th>고리</th><th>접두사</th></tr></thead><tbody>
        ${GROUP_INFO.map(g => `<tr${g.rank ? '' : ' class="sep"'}><td>${g.rank ? `<span class="n">${g.rank}</span>` : '—'}</td><td>${g.ko}</td><td class="m">${g.fg}</td><td class="m">${esc(g.suffix[0])}</td><td class="m">${esc(g.ring[0])}</td><td class="m">${esc(g.prefix[0])}</td></tr>`).join('')}
      </tbody></table></div>`;
    const stems = `<p class="tab-lead">탄소 수에 따른 어근</p>
      <div class="tbl-wrap panel"><table class="tbl"><thead><tr><th>탄소</th><th>어근</th><th>한글</th></tr></thead><tbody>
        ${STEMS.map(([n, en, ko]) => `<tr><td class="m">${n}</td><td class="m">${en}</td><td>${ko}</td></tr>`).join('')}
      </tbody></table></div>`;
    const benzH = `<p class="tab-lead">일치환 벤젠 유도체는 보존명(retained name)을 모체로 씁니다. 선택하면 구조식 편집기에서 엽니다.</p>
      <div class="pairs">${benz.map(x => `<button class="pair panel ex" type="button" data-open="${esc(x.sm)}" style="grid-template-rows:auto auto">${x.svg}<p class="pn">${nm(x.m)}</p><p>${nm2(x.m)}${x.m.common ? ' · 관용명 ' + esc(x.m.common.ko) : ''}</p></button>`).join('')}</div>
      <p class="hint">치환기가 둘 이상이면 주 작용기가 결합한 탄소가 C1 이 되고, 나머지 위치번호가 가장 낮아지는 방향으로 번호를 매깁니다. 이치환체의 관용명에서는 o-(1,2) · m-(1,3) · p-(1,4) 를 씁니다.</p>
      <div class="pairs" style="margin-top:14px">${omp.map(x => `<div class="pair panel">${x.svg}<p class="pn">${nm(x.m)}</p><p>${x.w} · ${esc(x.m.common ? x.m.common.en : '')}</p></div>`).join('')}</div>`;
    const koH = `<p class="tab-lead">대한화학회 한글 표기법</p>
      <div class="rule-step" style="border-top:0;padding-top:0">
        <div><ul>
          <li><b>-ane 과 모음으로 시작하는 접미사</b>: 영어에서 e 가 생략되면 한글도 ‘-에인’ 이 ‘-안’ 이 됩니다: 메테인 → 메탄올, 프로페인 → 프로판-2-올. 자음 앞에서는 생략하지 않습니다: 프로페인-1,2-다이올, 에테인나이트릴.</li>
          <li><b>-oic acid → -산</b>: ethanoic acid = 에탄산, butanedioic acid = 뷰테인다이오산, benzoic acid = 벤조산.</li>
          <li><b>에스터는 어순이 반대</b>: methyl ethanoate = 에탄산 메틸.</li>
          <li><b>이중결합</b>: prop-2-en-1-ol = 프로프-2-엔-1-올, but-3-enoic acid = 뷰트-3-엔산.</li>
        </ul></div>
        <div><ul>
          <li><b>배수 접두사</b>: di 다이 · tri 트라이 · tetra 테트라 · bis 비스.</li>
          <li><b>할로젠</b>: fluoro 플루오로 · chloro 클로로 · bromo 브로모 · iodo 아이오도.</li>
          <li><b>그 밖의 접두사</b>: hydroxy 하이드록시 · amino 아미노 · nitro 나이트로 · methoxy 메톡시 · oxo 옥소 · cyano 사이아노 · formyl 폼일.</li>
          <li>화면 아래 <b>EN · 한</b> 으로 영문 · 한글 이름의 표시 순서를 바꿀 수 있습니다.</li>
        </ul></div>
      </div>`;
    const y2013 = `<p class="tab-lead">IUPAC 2013 권고와 1993 규칙의 차이</p>
      <div class="rule-step" style="border-top:0;padding-top:0">
        <div><p>IUPAC 2013 권고는 주사슬을 정할 때 <b>사슬 길이를 불포화도보다 우선</b>합니다. 1993 규칙(여러 교과서의 기준)은 다중결합을 최대로 포함하는 사슬을 먼저 택했으므로 이름이 달라지는 화합물이 있습니다.</p>
          <ul><li>2013: ${esc(len.m.res.nameEn)} (탄소 5개 사슬 + methylidene)</li><li>1993: ${esc(len.m.res.alt1993 ? len.m.res.alt1993.en : '')} (이중결합을 포함하는 탄소 4개 사슬)</li></ul>
          <p>고리와 사슬 사이의 모체 선택도 바뀌었습니다. 2013 권고는 주 작용기 수가 같으면 ${b('고리를 모체')}로 합니다: ${code(esc(rc.m.res.nameEn))}. 1993 규칙에서는 탄소 수가 많은 쪽을 모체로 하여 ${code(esc(rc.m.res.alt1993 ? rc.m.res.alt1993.en : ''))} 로 명명했습니다.</p>
          <p>이중결합과 삼중결합이 함께 있으면 다중결합 전체에 가장 낮은 위치번호를 주고, 선택의 여지가 있으면 이중결합에 낮은 위치번호를 줍니다: ${code(esc(yne.m.res.nameEn))}.</p>
          <p>이 도구는 2013 규칙으로 명명하며, 두 규칙의 결과가 다르면 1993 규칙의 이름을 함께 표시합니다. 위치번호는 <code>propan-2-ol</code> 처럼 해당 부분 바로 앞에 씁니다 (1979 표기: 2-propanol).</p></div>
        <div class="rule-ex panel">${len.svg}<p class="nm-line">${nm(len.m)}</p></div>
      </div>`;

    root.innerHTML = `<section class="page rules">
      <div class="rules-hero">
        <p class="eyebrow"><span class="bar"></span>04 — NOMENCLATURE</p>
        <h1 class="title">NOMENCLATURE<small>IUPAC 명명법</small></h1>
        <p class="lead">IUPAC 이름은 명명 규칙을 정해진 순서로 적용하면 하나로 결정됩니다. 예제 ${ex.m.res.nameEn.replace(/.*/, s => `<code>${esc(s)}</code>`)} 에 명명 절차 다섯 단계를 차례로 적용합니다. 우선순위 · 어근 등의 표는 아래 탭에 있습니다.</p>
      </div>
      ${tabsHTML('rules', [
        { id: 'steps', label: '명명 절차', html: tabsHTML('rstep', steps.map((h, i) => ({ id: String(i + 1), label: `${i + 1} ${STEP_KO[i]}`, html: h + stepNav(i) }))) },
        { id: 'prio', label: '우선순위', html: prio },
        { id: 'stems', label: '어근', html: stems },
        { id: 'benz', label: '벤젠 유도체', html: benzH },
        { id: 'ko', label: '한글 표기', html: koH },
        { id: 'y2013', label: '2013 · 1993 규칙', html: y2013 }
      ], 'steps')}
    </section>`;
    root.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => app.go('build', { smiles: b.dataset.open })));
  }
  function step(n, en, ko, body, ex, custom) {
    return `<div class="rule-step"><span class="n">${n}</span><div><h3>${en}<small>${ko}</small></h3>${body}</div>
      ${custom || `<div class="rule-ex panel ticks">${ex.svg}<p class="nm-line">${nm(ex.m)}</p></div>`}</div>`;
  }
  function stepNav(i) {
    return `<div class="step-nav">${i > 0 ? `<button class="btn" type="button" data-goto="rstep:${i}">← ${i} ${STEP_KO[i - 1]}</button>` : '<span></span>'}${i < 4 ? `<button class="btn solid" type="button" data-goto="rstep:${i + 2}">다음: ${i + 2} ${STEP_KO[i + 1]} →</button>` : `<button class="btn solid" type="button" data-goto="rules:prio">우선순위 표 →</button>`}</div>`;
  }
  app.setMol(molecule(EX));
  render();
  const off = onLang(render);
  return { unmount() { off(); }, report: () => ({ '보던 탭': [tabNow(root, 'rules'), tabNow(root, 'rstep')].filter(Boolean).join(' · ') }) };
}
