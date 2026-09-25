/* 첫 화면: 네 장의 슬라이드. 왼쪽엔 3D 분자, 오른쪽엔 제목 · 설명 · ENTER */
import { SLIDES } from '../data.js';
import { molecule, formulaText, esc, getLang } from '../ui.js';

const ARROW = d => `<svg viewBox="0 0 68 68" aria-hidden="true"><polygon class="hx" points="34,2 62,18 62,50 34,66 6,50 6,18"/><path class="ar" d="${d > 0 ? 'M22 34h24M40 28l6 6-6 6' : 'M46 34H22M28 28l-6 6 6 6'}"/></svg>`;

export function mount(root, app) {
  let i = 0, lock = 0;
  root.innerHTML = `<section class="home" aria-roledescription="carousel" aria-label="HEXA 둘러보기">
    <p class="pager" aria-hidden="true"><b id="pg-a">01</b><i></i><span id="pg-b">02</span></p>
    <button class="hexbtn prev" type="button" aria-label="이전 슬라이드">${ARROW(-1)}</button>
    <div class="slide"><div class="slide-text" id="st" aria-live="polite"></div></div>
    <button class="hexbtn next" type="button" aria-label="다음 슬라이드">${ARROW(1)}</button>
    <div class="slide-dots" role="tablist" aria-label="슬라이드">${SLIDES.map((s, k) => `<button type="button" role="tab" aria-label="${s.ko}" data-k="${k}"></button>`).join('')}</div>
  </section>`;
  const st = root.querySelector('#st');
  const dots = [...root.querySelectorAll('.slide-dots button')];

  function show(k) {
    i = (k + SLIDES.length) % SLIDES.length;
    const s = SLIDES[i];
    const m = molecule(s.mol);
    const nm = getLang() === 'ko' ? m.res.nameKo : m.res.nameEn;
    st.classList.remove('slide-anim'); void st.offsetWidth; st.classList.add('slide-anim');
    st.innerHTML = `<h1 class="title">${s.en}<small>${s.ko}</small></h1>
      <p class="slide-desc">${esc(s.desc)}</p>
      <p class="slide-cap"><span>표시 분자</span><b>${esc(nm)}</b><span>${formulaText(m.f)}</span>${m.common ? `<span>${esc(m.common.ko)}</span>` : ''}</p>
      <a class="enter" href="#${s.route}"><span>ENTER</span></a>`;
    root.querySelector('#pg-a').textContent = s.n;
    root.querySelector('#pg-b').textContent = SLIDES[(i + 1) % SLIDES.length].n;
    dots.forEach((d, k) => d.setAttribute('aria-current', String(k === i)));
    app.setMol(m);
  }
  const step = d => { const now = Date.now(); if (now < lock) return; lock = now + 700; show(i + d); };
  root.querySelector('.prev').addEventListener('click', () => step(-1));
  root.querySelector('.next').addEventListener('click', () => step(1));
  dots.forEach(d => d.addEventListener('click', () => show(+d.dataset.k)));
  const onKey = e => {
    if (e.target.closest('input, textarea, select') || !document.getElementById('menu').hidden) return;
    if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1);
  };
  const onWheel = e => { if (Math.abs(e.deltaY) > 24 && !e.ctrlKey) step(e.deltaY > 0 ? 1 : -1); };
  let tx = null;
  const onTs = e => { tx = e.touches[0].clientX; };
  const onTe = e => { if (tx === null) return; const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1); tx = null; };
  document.addEventListener('keydown', onKey);
  root.addEventListener('wheel', onWheel, { passive: true });
  root.addEventListener('touchstart', onTs, { passive: true });
  root.addEventListener('touchend', onTe);
  show(0);
  return {
    unmount() { document.removeEventListener('keydown', onKey); }
  };
}
