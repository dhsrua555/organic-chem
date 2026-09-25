/* 퀴즈: 구조 → 이름 / 이름 → 구조. 오답 보기는 작용기 자리를 옮기거나 바꾼 "진짜 다른 분자" 의 이름이다 */
import { SCAFFOLDS } from '../chem/mol.js';
import { steps } from '../chem/explain.js';
import { drawMolecule } from '../draw.js';
import { molecule, tokensHTML, esc, store, getLang, onLang, pick, shuffle } from '../ui.js';

const UNSTABLE = ['enol', 'enamine', 'gemdiol', 'halohydrin', 'hemiaminal', 'hemiacetal'];
const POOL = ['OH', 'OH', 'OH', 'COOH', 'COOH', 'CHO', 'NH2', 'NH2', 'CH3', 'CH3', 'CH3', 'Cl', 'Cl', 'Br', 'NO2', 'OCH3', 'COCH3', 'CN', 'COOCH3', 'CONH2', 'F', 'I'];
const SCAF_W = ['benzene', 'benzene', 'benzene', 'propene', 'propene', 'propane', 'propane', 'ethene', 'ethane', 'methane'];

function ok(m) {
  return !(m.res.notes || []).some(n => UNSTABLE.includes(n.type)) && !m.res.alt1993 && m.res.nameEn.length <= 46;
}
function randomQ(level) {
  for (let t = 0; t < 200; t++) {
    const scaf = pick(SCAF_W), n = SCAFFOLDS[scaf].sites.length;
    const k = level === 'easy' ? 1 + (Math.random() < 0.55 ? 1 : 0) : 2 + Math.floor(Math.random() * 3);
    if (k > n) continue;
    const sites = shuffle([...Array(n).keys()]).slice(0, k);
    const subs = {}; sites.forEach(s => { subs[s] = pick(POOL); });
    if (level === 'easy' && Object.values(subs).filter(g => g === 'CH3').length > 1) continue;
    const m = molecule(scaf, subs);
    if (!ok(m) || (level === 'easy' && !m.res.prefixes.length && !m.res.P)) continue;
    return { scaf, subs, m };
  }
  return { scaf: 'propene', subs: { 3: 'OH' }, m: molecule('propene', { 3: 'OH' }) };
}
/* 헷갈리기 쉬운 이웃: 자리 옮기기 · 작용기 바꾸기 · 뼈대 바꾸기 */
function distractors(q) {
  const out = new Map(), n = SCAFFOLDS[q.scaf].sites.length;
  const add = (scaf, subs) => { const m = molecule(scaf, subs); if (m.res.nameEn !== q.m.res.nameEn && ok(m) && !out.has(m.res.nameEn)) out.set(m.res.nameEn, { scaf, subs, m }); };
  const keys = Object.keys(q.subs).map(Number);
  for (let t = 0; t < 60 && out.size < 8; t++) {
    const r = Math.random();
    const subs = { ...q.subs };
    const k = pick(keys);
    if (r < 0.5) { const free = [...Array(n).keys()].filter(i => !(i in subs)); if (!free.length) continue; const g = subs[k]; delete subs[k]; subs[pick(free)] = g; add(q.scaf, subs); }
    else if (r < 0.8) { subs[k] = pick(POOL); add(q.scaf, subs); }
    else {
      const alt = { propane: 'propene', propene: 'propane', ethane: 'ethene', ethene: 'ethane' }[q.scaf];
      if (!alt) continue;
      const m2 = {}; for (const [s, g] of Object.entries(subs)) if (+s < SCAFFOLDS[alt].sites.length) m2[s] = g;
      add(alt, m2);
    }
  }
  return shuffle([...out.values()]).slice(0, 3);
}

export function mount(root, app) {
  const S = { mode: store.get('quizMode', 'name'), level: store.get('quizLevel', 'easy'), score: store.get('quizScore', { right: 0, total: 0, streak: 0, best: 0 }), q: null, opts: [], done: false };
  root.innerHTML = `<section class="page"><div class="quiz">
    <p class="eyebrow"><span class="bar"></span>04 — QUIZ</p>
    <h1 class="title">QUIZ<small>이름 맞히기</small></h1>
    <div class="q-bar">
      <div class="seg" role="group" aria-label="문제 방식"><button type="button" data-mode="name">구조 → 이름</button><button type="button" data-mode="struct">이름 → 구조</button></div>
      <div class="seg" role="group" aria-label="난이도"><button type="button" data-level="easy">작용기 1–2개</button><button type="button" data-level="hard">2–4개</button></div>
      <p class="score" aria-live="polite"></p>
    </div>
    <div class="q-card panel ticks"></div>
  </div></section>`;
  const card = root.querySelector('.q-card');

  function paintBar() {
    root.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === S.mode)));
    root.querySelectorAll('[data-level]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.level === S.level)));
    const s = S.score;
    root.querySelector('.score').innerHTML = `<span>맞힘 <b>${s.right}</b> / ${s.total}</span><span>연속 <b>${s.streak}</b></span><span>최고 <b>${s.best}</b></span>`;
  }
  const nameOf = m => getLang() === 'ko' ? m.res.nameKo : m.res.nameEn;
  const small = m => drawMolecule(m.mol, m.res, { hideH: true, locants: false, chain: false, compact: true });

  function next() {
    S.q = randomQ(S.level);
    S.opts = shuffle([S.q, ...distractors(S.q)]);
    S.done = false; S.chosen = null;
    app.setMol(S.q.m);
    draw();
  }
  function draw() {
    const chosen = S.chosen, q = S.q, keys = ['A', 'B', 'C', 'D'];
    const head = S.mode === 'name'
      ? `<p class="q-prompt">이 분자의 IUPAC 이름은?</p><div class="q-struct">${small(q.m)}</div>`
      : `<p class="q-prompt">이 이름의 구조는?</p><p class="q-name">${tokensHTML(getLang() === 'ko' ? q.m.res.ko : q.m.res.en)}</p>`;
    const opts = S.opts.map((o, i) => {
      const cls = !S.done ? '' : o === q ? ' right' : o === chosen ? ' wrong' : '';
      return S.mode === 'name'
        ? `<button class="q-opt${cls}" type="button" data-i="${i}" ${S.done ? 'disabled' : ''}><span class="k">${keys[i]}</span>${esc(nameOf(o.m))}</button>`
        : `<button class="q-opt pic${cls}" type="button" data-i="${i}" ${S.done ? 'disabled' : ''} aria-label="보기 ${keys[i]}"><span class="k">${keys[i]}</span>${small(o.m)}</button>`;
    }).join('');
    let fb = '';
    if (S.done) {
      const right = chosen === q;
      const st = steps(q.m.mol, q.m.res);
      fb = `<div class="q-feedback">
        <p class="q-verdict ${right ? 'ok' : 'no'}"><b>${right ? '정답' : '아쉽게도 오답'}</b> — ${esc(q.m.res.nameEn)} · ${esc(q.m.res.nameKo)}${q.m.common ? ` (${esc(q.m.common.ko)})` : ''}</p>
        ${!right && chosen ? `<p class="note">고른 보기는 ${esc(chosen.m.res.nameEn)} — 작용기 자리나 종류가 다른 분자입니다.</p>` : ''}
        <ol class="steps" style="padding:0">${st.map(s => `<li><div><span class="sk">${s.k}</span>${s.t}</div></li>`).join('')}</ol>
        <div class="q-actions"><button class="btn solid" type="button" id="q-next">다음 문제</button><button class="btn" type="button" id="q-open">분자 조립에서 열기</button></div>
      </div>`;
    }
    card.innerHTML = head + `<div class="q-opts">${opts}</div>` + fb;
    card.querySelectorAll('.q-opt').forEach(b => b.addEventListener('click', () => answer(S.opts[+b.dataset.i])));
    if (S.done) {
      card.querySelector('#q-next').addEventListener('click', next);
      card.querySelector('#q-open').addEventListener('click', () => app.go('build', { scaf: q.scaf, subs: q.subs }));
      card.querySelector('#q-next').focus({ preventScroll: true });
    }
  }
  function answer(o) {
    if (S.done) return;
    S.done = true; S.chosen = o;
    const s = S.score;
    s.total++;
    if (o === S.q) { s.right++; s.streak++; s.best = Math.max(s.best, s.streak); } else s.streak = 0;
    store.set('quizScore', s);
    paintBar(); draw();
  }
  root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { S.mode = b.dataset.mode; store.set('quizMode', S.mode); paintBar(); next(); }));
  root.querySelectorAll('[data-level]').forEach(b => b.addEventListener('click', () => { S.level = b.dataset.level; store.set('quizLevel', S.level); paintBar(); next(); }));
  const off = onLang(() => draw());
  paintBar(); next();
  return { unmount() { off(); } };
}
