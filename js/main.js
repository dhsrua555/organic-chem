/* HEXA 유기화학: 부팅 · 경로(#home #build #groups #rules #quiz) · 메뉴 · 아래 HUD */
import { $, $$, store, getLang, setLang, mq } from './ui.js';
import { startFx } from './fx.js';
import { initReport } from './report.js';

const VERSION = 'v8 · 2026-09-26';

const reduce = mq('(prefers-reduced-motion: reduce)');
const low = mq('(pointer: coarse)') || Math.min(innerWidth, innerHeight) < 700;
const view = $('#view');
const loader = $('#loader');
const pct = $('#ld-pct');
let scene = null;

/* 로딩 표시: 실제 모듈을 불러오는 동안 숫자를 올린다 */
let shown = 0, target = 12;
const tick = () => { shown += (target - shown) * 0.2; pct.textContent = Math.round(shown); if (shown < 99.5) requestAnimationFrame(tick); };
requestAnimationFrame(tick);

const PAGES = {
  home: () => import('./pages/home.js'),
  build: () => import('./pages/build.js'),
  react: () => import('./pages/react.js'),
  groups: () => import('./pages/groups.js'),
  rules: () => import('./pages/rules.js'),
  quiz: () => import('./pages/quiz.js')
};

/* 페이지마다 3D 분자를 어디에 둘지 (화면 비율 좌표) */
function anchorFor(route, narrow = innerWidth < 900) {
  const A = {
    home: narrow ? { x: 0, y: 0.4, scale: 0.6, dim: 1 } : { x: -0.4, y: 0.0, scale: 0.9, dim: 1 },
    build: narrow ? { x: 0, y: 0.1, scale: 1.3, dim: 0.16 } : { x: -0.02, y: -0.28, scale: 1.8, dim: 0.18 },
    react: narrow ? { x: 0.45, y: -0.5, scale: 0.42, dim: 0.3 } : { x: 0.66, y: -0.45, scale: 0.5, dim: 0.5 },
    groups: narrow ? { x: 0.42, y: 0.6, scale: 0.42, dim: 0.6 } : { x: 0.62, y: 0.36, scale: 0.6, dim: 0.95 },
    rules: narrow ? { x: 0.42, y: 0.6, scale: 0.45, dim: 0.5 } : { x: 0.5, y: 0.34, scale: 0.8, dim: 0.85 },
    quiz: narrow ? { x: 0, y: 0.1, scale: 1.2, dim: 0.08 } : { x: -0.8, y: -0.45, scale: 0.75, dim: 0.22 }
  };
  return A[route] || A.home;
}

let current = null, currentRoute = null, navParams = null;
const app = {
  get scene() { return scene; },
  go(route, params) { navParams = params || null; if (location.hash === '#' + route) render(); else location.hash = route; },
  setMol(entry, opts) { if (scene && entry && entry.mol) scene.setMolecule(entry.mol, entry.res, opts || {}); },
  anchor(a) { if (scene) scene.setAnchor(Object.assign({}, anchorFor(currentRoute), a || {})); },
  focus3d(on) { document.body.classList.toggle('focus3d', !!on); }
};

function routeOf() {
  const h = (location.hash || '').replace('#', '');
  const base = h.split('-')[0];
  return { route: PAGES[base] ? base : 'home', sub: h.includes('-') ? h.slice(h.indexOf('-') + 1) : null };
}

async function render() {
  const { route, sub } = routeOf();
  const params = navParams || (sub ? { sub } : null);
  navParams = null;
  if (current && current.unmount) current.unmount();
  current = null;
  app.focus3d(false);
  closeMenu(false);
  const mod = await PAGES[route]();
  currentRoute = route;
  document.body.dataset.route = route;
  view.innerHTML = '';
  window.scrollTo(0, 0);
  if (scene) scene.setAnchor(anchorFor(route));
  current = mod.mount(view, app, params) || null;
  $$('.menu-list a').forEach(a => { if (a.getAttribute('href') === '#' + route) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const t = { home: 'HEXA 유기화학', build: '분자 조립 · HEXA', react: '반응 예측 · HEXA', groups: '작용기 도감 · HEXA', rules: '명명법 · HEXA', quiz: '퀴즈 · HEXA' }[route];
  document.title = t;
}

/* ── 메뉴 ─────────────────────── */
const menu = $('#menu'), menuBtn = $('#menu-btn'), menuLabel = $('#menu-label');
function buildBlocks() {
  const box = $('.menu-blocks');
  if (box.childElementCount) return;
  const n = low ? 26 : 60;
  let html = '';
  for (let i = 0; i < n; i++) {
    const w = 30 + Math.random() * 110, h = w * (0.35 + Math.random() * 0.3);
    html += `<i style="left:${(Math.random() * 100).toFixed(1)}%;top:${(Math.random() * 100).toFixed(1)}%;width:${w.toFixed(0)}px;height:${h.toFixed(0)}px;animation-delay:${(Math.random() * 3).toFixed(2)}s;opacity:${(0.3 + Math.random() * 0.7).toFixed(2)}"></i>`;
  }
  box.innerHTML = html;
}
function openMenu() {
  buildBlocks();
  menu.hidden = false;
  menuBtn.setAttribute('aria-expanded', 'true');
  menuLabel.textContent = 'CLOSE';
  if (scene) scene.setAnchor(Object.assign({}, anchorFor(currentRoute), { dim: 0.55 }));
  const first = $('.menu-list a', menu); if (first) first.focus();
}
function closeMenu(restore = true) {
  if (menu.hidden) return;
  menu.hidden = true;
  menuBtn.setAttribute('aria-expanded', 'false');
  menuLabel.textContent = 'MENU';
  if (restore && scene && currentRoute) scene.setAnchor(anchorFor(currentRoute));
  if (restore) menuBtn.focus();
}
menuBtn.addEventListener('click', () => menu.hidden ? openMenu() : closeMenu());
menu.addEventListener('click', e => { if (e.target === menu || e.target.closest('.menu-blocks')) closeMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) closeMenu(); });

/* ── 아래 HUD: 이름 언어 · 움직임 ─────── */
const langBtns = $$('.lang button');
function paintLang() { langBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === getLang()))); }
langBtns.forEach(b => b.addEventListener('click', () => { setLang(b.dataset.lang); paintLang(); }));
paintLang();
const motionBtn = $('#motion');
let motion = store.get('motion', !reduce);
function paintMotion() {
  motionBtn.setAttribute('aria-pressed', String(motion));
  motionBtn.setAttribute('aria-label', motion ? '배경 움직임 끄기' : '배경 움직임 켜기');
  if (scene) scene.setMotion(motion);
}
motionBtn.addEventListener('click', () => { motion = !motion; store.set('motion', motion); paintMotion(); });

/* ── 버그 제보함: 지금 페이지가 알려 주는 분자 · 반응 정보를 붙인다 ── */
initReport({ version: VERSION, context: () => Object.assign({ '페이지': '#' + (location.hash.replace('#', '') || 'home') }, current && current.report ? current.report() : {}) });

/* ── 부팅 ─────────────────────── */
async function boot() {
  startFx({ reduce });
  try {
    const { createScene } = await import('./scene.js');
    target = 70;
    scene = createScene($('#gl'), { low, reduce });
  } catch (e) {
    console.warn('3D 배경을 켜지 못했습니다:', e);
    $('#gl').style.display = 'none';
  }
  paintMotion();
  window.addEventListener('hashchange', render);
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (scene && currentRoute) scene.setAnchor(anchorFor(currentRoute)); }, 150); });
  /* 긴 글 페이지: 내려 읽기 시작하면 3D 분자를 흐리게 (글자와 겹치지 않도록) */
  let lastDim = 1;
  window.addEventListener('scroll', () => {
    if (!scene || !['groups', 'rules', 'react'].includes(currentRoute) || !menu.hidden) return;
    const f = Math.max(0.22, 1 - window.scrollY / 420);
    if (Math.abs(f - lastDim) < 0.02) return;
    lastDim = f;
    const a = anchorFor(currentRoute);
    scene.setAnchor(Object.assign({}, a, { dim: a.dim * f }));
  }, { passive: true });
  await render();
  target = 100;
  setTimeout(() => loader.classList.add('done'), reduce ? 0 : 650);
}
boot();
