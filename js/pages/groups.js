/* 작용기 도감: 왼쪽 목록(우선순위 순), 오른쪽 상세 — 접미사 · 접두사는 늘 보이고, 예시 · 여러 뼈대에 붙인 이름은 탭으로 */
import { GROUP_INFO } from '../data.js';
import { TEMPLATES, attach } from '../chem/edit.js';
import { drawMolecule } from '../draw.js';
import { molecule, entry, esc, getLang, onLang, store, tabsHTML } from '../ui.js';

const BASES = TEMPLATES.filter(t => t.kind === 'base');

export function mount(root, app, params) {
  let cur = GROUP_INFO.findIndex(g => g.id === (params && params.sub));
  if (cur < 0) cur = 0;
  root.innerHTML = `<section class="page"><div class="groups">
    <nav class="g-list panel ticks" aria-label="작용기 목록">
      <h2 class="lbl">접미사가 되는 작용기 · 우선순위 순</h2><ol>${GROUP_INFO.filter(g => g.rank).map(itemHTML).join('')}</ol>
      <h2 class="lbl">접두사로만 쓰는 것</h2><ol>${GROUP_INFO.filter(g => !g.rank).map(itemHTML).join('')}</ol>
    </nav>
    <article class="g-detail" aria-live="polite"></article>
  </div></section>`;
  function itemHTML(g) {
    const k = GROUP_INFO.indexOf(g);
    return `<li><button type="button" data-k="${k}"><span class="n">${g.rank || '·'}</span><span>${g.ko}</span><span class="f">${g.fg.split(' ')[0]}</span></button></li>`;
  }
  const detail = root.querySelector('.g-detail');
  const attachCache = new Map();
  function attachRows(gid) {
    if (attachCache.has(gid)) return attachCache.get(gid);
    const rows = [], seen = new Set();
    for (const t of BASES) {
      const base = molecule(t.smi).mol;
      base.atoms.forEach((a, i) => {
        if (!a.h) return;
        const r = attach(base, i, gid);
        if (!r.mol) return;
        const e = entry(r.mol);
        if (!e.res || seen.has(e.res.nameEn)) return;
        seen.add(e.res.nameEn);
        rows.push({ t, e });
      });
    }
    attachCache.set(gid, rows);
    return rows;
  }

  function show(k, scroll) {
    cur = k;
    const g = GROUP_INFO[k], ko = getLang() === 'ko';
    root.querySelectorAll('.g-list button').forEach(b => b.setAttribute('aria-current', String(+b.dataset.k === k)));
    app.setMol(molecule(g.demo));
    const nm = m => ko ? m.res.nameKo : m.res.nameEn, nm2 = m => ko ? m.res.nameEn : m.res.nameKo;
    const ex = g.examples.map(s => ({ s, m: molecule(s) }));
    const rows = attachRows(g.gid);
    const mode = store.get('drawMode', 'atoms');
    detail.innerHTML = `
      <div class="g-hero">
        <p class="eyebrow"><span class="bar"></span>03 — FUNCTIONAL GROUPS${g.rank ? ` · 우선순위 ${g.rank}` : ''}</p>
        <h1 class="title">${g.en}<small>${g.ko}</small></h1>
        <p class="g-fg">${g.fg}</p>
        <p class="g-desc">${esc(g.desc)}</p>
        <p class="scroll-hint">SCROLL TO DISCOVER</p>
      </div>
      <div class="facts">
        <div class="fact"><span class="n">1</span><h3>사슬 접미사</h3><p>${esc(g.suffix[0])}<small>${esc([g.suffix[1], g.suffix[2]].filter(Boolean).join(' · '))}</small></p></div>
        <div class="fact"><span class="n">2</span><h3>고리에 붙을 때</h3><p>${esc(g.ring[0])}<small>${esc(g.ring[1] || '')}</small></p></div>
        <div class="fact"><span class="n">3</span><h3>접두사</h3><p>${esc(g.prefix[0])}<small>${esc(g.prefix[1] || '')}</small></p></div>
      </div>
      ${tabsHTML('grp', [{ id: 'ex', label: '예시 분자', n: ex.length, html: `<p class="tab-lead">눌러서 분자 조립에서 열기</p>
      <div class="ex-grid">${ex.map((x, i) => `<button class="ex" type="button" data-ex="${i}"><span class="exs">${drawMolecule(x.m.mol, x.m.res, { mode, locants: false, chain: false, compact: true })}</span>
        <span><span class="exn">${esc(nm(x.m))}</span><span class="exk">${esc(nm2(x.m))}</span>${x.m.common ? `<span class="exc">${esc(x.m.common.ko)}${x.m.common.note ? ' — ' + esc(x.m.common.note) : ''}</span>` : ''}</span></button>`).join('')}</div>` },
      { id: 'attach', label: '뼈대에 붙이기', n: rows.length, html: `<p class="tab-lead">${g.fg.split(' ')[0]} 하나를 기본 뼈대의 원자마다 붙이면 — 같은 작용기도 어디에 붙느냐에 따라 이름이 달라집니다</p>
      <div class="tbl-wrap panel"><table class="tbl"><thead><tr><th>뼈대</th><th>IUPAC 이름</th><th>${ko ? 'English' : '한글'}</th><th>관용명</th></tr></thead><tbody>
        ${rows.map((x, i) => `<tr><td>${x.t.ko}</td><td class="m"><button class="link" type="button" data-row="${i}">${esc(nm(x.e))}</button></td><td>${esc(nm2(x.e))}</td><td>${x.e.common ? esc(x.e.common.ko) : '<span style="color:var(--muted)">—</span>'}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="hint">프로펜의 끝 탄소(=CH₂)에 붙이면 CH₃ 와 같은 쪽(Z) · 반대쪽(E) 두 가지가 생깁니다 (분자 조립의 ‘E/Z’ 도구로 뒤집기). 사슬을 늘리는 작용기(COOH, CHO, CN …)를 붙이면 그 탄소까지 주사슬에 들어가 어근이 바뀝니다.</p>` }], 'ex')}`;
    detail.querySelectorAll('[data-ex]').forEach(b => b.addEventListener('click', () => app.go('build', { smiles: ex[+b.dataset.ex].s, focusGroup: g.gid })));
    detail.querySelectorAll('[data-row]').forEach(b => b.addEventListener('click', () => app.go('build', { mol: rows[+b.dataset.row].e.mol, focusGroup: g.gid })));
    if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  root.querySelector('.g-list').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) { show(+b.dataset.k, innerWidth < 900); history.replaceState(null, '', '#groups-' + GROUP_INFO[+b.dataset.k].id); } });
  const off = onLang(() => show(cur));
  show(cur);
  return { unmount() { off(); }, report: () => ({ '작용기': GROUP_INFO[cur].id }) };
}
