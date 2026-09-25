/* 퀴즈: 구조 → 이름 / 이름 → 구조 / 반응 → 주생성물 / R · S 판정.
   오답 보기는 조각 자리를 옮기거나 바꾼 "진짜 다른 분자", 반응에서는 다른 시약 · 다른 방향의 생성물 */
import { TEMPLATES, fromSmiles, attach } from '../chem/edit.js';
import { steps } from '../chem/explain.js';
import { REACTIONS, predict, applicable } from '../chem/reactions.js';
import { drawMolecule } from '../draw.js';
import { defineMissing, flipCenter, stereoInfo, stereoSites } from '../chem/stereo.js';
import { centerHTML } from '../rsview.js';
import { entry, tokensHTML, esc, store, getLang, onLang, pick, shuffle } from '../ui.js';

const UNSTABLE = ['enol', 'enamine', 'gemdiol', 'halohydrin', 'hemiaminal', 'hemiacetal'];
const POOL = ['OH', 'OH', 'OH', 'COOH', 'COOH', 'CHO', 'NH2', 'NH2', 'CH3', 'CH3', 'CH3', 'CH3', 'Cl', 'Cl', 'Br', 'NO2', 'OCH3', 'COCH3', 'CN', 'COOCH3', 'CONH2', 'F', 'oxo', 'C2H5', 'vinyl', 'phenyl'];
const BASES = TEMPLATES.filter(t => t.kind === 'base');
const RX_SUBS = ['CCC(C)Br', 'CC(C)(C)Br', 'CCCBr', 'CC(C)C(C)Br', 'BrCc1ccccc1', 'CC(O)CC', 'CCCO', 'CC(C)(C)O', 'OC1CCCCC1', 'CC=C', 'CC(C)=CC', 'C1=CCCCC1', 'CC(C)(C)C=C',
  'CCC#C', 'CC#CC', 'CCC=O', 'CC(=O)c1ccccc1', 'O=C1CCCCC1', 'CCOC(C)=O', 'CCC#N', 'CC(=O)O', 'CC(=O)Cl', 'c1ccccc1', 'Cc1ccccc1', 'COc1ccccc1', '[O-][N+](=O)c1ccccc1', 'CCC', 'CC(C)C', 'CC=O', 'C=CC=C', 'Brc1ccccc1',
  'CC1CO1', 'CC1(C)CO1', 'COc1ccccc1', 'CC=CC(C)=O', 'CC(=O)CC', 'Nc1ccccc1', 'Clc1ccc(cc1)[N+](=O)[O-]', 'Cc1ccc(Cl)cc1', 'CC(C)=O'];

/* R/S 문제용: 입체중심이 하나인 쉬운 분자들 (배열은 문제마다 무작위로 뒤집는다) */
const RS_EASY = ['C[C@@H](O)CC', 'C[C@H](Br)CC', 'C[C@H](N)C(=O)O', 'C[C@@H](O)C(=O)O', 'O[C@@H](c1ccccc1)C', 'CC[C@@H](C)CO', 'C[C@H](Cl)C=C', 'ClC[C@@H](O)C',
  'C[C@@H](C#N)CC', 'OC[C@H](O)C=O', 'CC(C)[C@@H](C)Br', 'C[C@@H]1CCCCC1=O', 'CC[C@H](C)C(=O)O', 'C[C@@H](F)CCl', 'CC[C@@H](O)C=C', 'N[C@@H](Cc1ccccc1)C(=O)O', 'C[C@H](OC)CC=O', 'CC(=O)[C@@H](C)CC'];
/* cis/trans 문제용 고리 */
const CT_RINGS = ['CC1CCC(C)CC1', 'CC1CCCCC1C', 'CC1CCC(O)CC1', 'CC1CC(C)C1', 'CC(C)(C)C1CCC(O)CC1', 'CC1CCC(Cl)CC1', 'OC1CCCC1Br', 'CC1CC1C', 'OC(=O)C1CCC(C)CC1', 'CC1CCCC(C)C1'];
function randomCT() {
  for (let t = 0; t < 60; t++) {
    let m = defineMissing(fromSmiles(pick(CT_RINGS)));
    for (const c of stereoSites(m)) if (Math.random() < 0.5) { const r = flipCenter(m, c); if (r.mol) m = r.mol; }
    const e = entry(m);
    const ct = e.res && e.res.ct && e.res.ct.find(x => x.n === 2);
    if (ct) return { rs: true, ct: true, e, center: null, answer: ct.rel, pair: ct.atoms };
  }
  return null;
}
function randomRS(level) {
  if (Math.random() < 0.3) { const q = randomCT(); if (q) return q; }
  for (let t = 0; t < 400; t++) {
    let m;
    if (level === 'easy') m = fromSmiles(pick(RS_EASY));
    else {
      m = fromSmiles(pick(BASES).smi);
      const k = 2 + Math.floor(Math.random() * 3);
      for (let j = 0; j < k; j++) {
        const at = m.atoms.map((a, i) => i).filter(i => m.atoms[i].h > 0 && m.atoms[i].el === 'C');
        const r = attach(m, pick(at), pick(POOL)); if (r.mol) m = r.mol;
      }
      if (!stereoInfo(m).centers.length) continue;
    }
    m = defineMissing(m);
    for (const c of stereoInfo(m).centers) if (Math.random() < 0.5) { const r = flipCenter(m, c); if (r.mol) m = r.mol; }
    const e = entry(m);
    if (!e.res || !e.res.rs || !e.res.rs.size || (level !== 'easy' && !ok(e))) continue;
    const c = pick([...e.res.rs.keys()]);
    return { rs: true, e, center: c, answer: e.res.rs.get(c) };
  }
  return null;
}
function ok(e) { return e.res && !(e.res.notes || []).some(n => UNSTABLE.includes(n.type)) && !e.res.alt1993 && e.res.nameEn.length <= 48; }
function replay(base, recipe) {
  let m = fromSmiles(base);
  for (const [i, f] of recipe) { if (!m.atoms[i]) return null; const r = attach(m, i, f); if (!r.mol) return null; m = r.mol; }
  return m;
}
function randomQ(level) {
  for (let t = 0; t < 300; t++) {
    const base = pick(BASES).smi;
    const k = level === 'easy' ? 1 + (Math.random() < 0.5 ? 1 : 0) : 2 + Math.floor(Math.random() * 3);
    const recipe = [];
    let m = fromSmiles(base);
    for (let j = 0; j < k; j++) {
      const at = m.atoms.map((a, i) => i).filter(i => m.atoms[i].h > 0 && m.atoms[i].el === 'C');
      const i = pick(at), f = pick(POOL);
      const r = attach(m, i, f); if (!r.mol) continue;
      recipe.push([i, f]); m = r.mol;
    }
    if (!recipe.length) continue;
    const e = entry(m);
    if (!ok(e)) continue;
    return { base, recipe, e };
  }
  return null;
}
function distractors(q) {
  const out = new Map();
  const add = m => { if (!m) return; const e = entry(m); if (ok(e) && e.res.nameEn !== q.e.res.nameEn && !out.has(e.res.nameEn)) out.set(e.res.nameEn, { e }); };
  for (let t = 0; t < 60 && out.size < 8; t++) {
    const rec = q.recipe.map(x => x.slice());
    const k = Math.floor(Math.random() * rec.length);
    const r = Math.random();
    if (r < 0.5) { const n = fromSmiles(q.base).atoms.length + k * 2; rec[k][0] = Math.floor(Math.random() * Math.max(2, n)); }
    else if (r < 0.85) rec[k][1] = pick(POOL);
    else { add(replay(pick(BASES).smi, rec)); continue; }
    add(replay(q.base, rec));
  }
  return shuffle([...out.values()]).slice(0, 3);
}
function randomReact() {
  for (let t = 0; t < 80; t++) {
    const smi = pick(RX_SUBS);
    const mol = fromSmiles(smi);
    const okMap = applicable(mol);
    const ids = REACTIONS.filter(r => okMap[r.id]).map(r => r.id);
    if (!ids.length) continue;
    const rid = pick(ids);
    const res = predict(mol, rid);
    const major = res.ok && res.products.find(p => p.role === 'major' && p.name);
    if (!major || res.warn) continue;
    const opts = new Map([[major.name.nameEn, { e: { mol: major.mol, res: major.name } }]]);
    const addP = p => { if (p && p.name && !opts.has(p.name.nameEn) && p.role !== 'side') opts.set(p.name.nameEn, { e: { mol: p.mol, res: p.name } }); };
    res.products.forEach(addP);
    for (const other of shuffle(ids.filter(x => x !== rid))) {
      if (opts.size >= 4) break;
      const r2 = predict(mol, other);
      if (r2.ok) addP(r2.products.find(p => p.role === 'major'));
    }
    const sub = entry(mol);
    if (opts.size < 4 && sub.res && !opts.has(sub.res.nameEn)) opts.set(sub.res.nameEn, { e: sub, same: true });
    if (opts.size < 3) continue;
    const list = [...opts.values()].slice(0, 4);
    const correct = list[0];
    return { react: true, smi, rid, res, sub, e: correct.e, correct, opts: shuffle(list) };
  }
  return null;
}

export function mount(root, app, params) {
  const S = { mode: (params && params.mode) || store.get('quizMode', 'name'), level: store.get('quizLevel', 'easy'), score: store.get('quizScore2', { right: 0, total: 0, streak: 0, best: 0 }), q: null, opts: [], done: false, chosen: null };
  root.innerHTML = `<section class="page"><div class="quiz">
    <p class="eyebrow"><span class="bar"></span>05 — QUIZ</p>
    <h1 class="title">QUIZ<small>이름 · 반응 퀴즈</small></h1>
    <div class="q-bar">
      <div class="seg" role="group" aria-label="문제 방식"><button type="button" data-mode="name">구조 → 이름</button><button type="button" data-mode="struct">이름 → 구조</button><button type="button" data-mode="react">반응 예측</button><button type="button" data-mode="rs">R / S</button></div>
      <div class="seg" role="group" aria-label="난이도"><button type="button" data-level="easy">조각 1–2개</button><button type="button" data-level="hard">2–4개</button></div>
      <p class="score" aria-live="polite"></p>
    </div>
    <div class="q-card panel ticks"></div>
  </div></section>`;
  const card = root.querySelector('.q-card');
  const mode = () => store.get('drawMode', 'atoms');

  function paintBar() {
    root.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === S.mode)));
    root.querySelectorAll('[data-level]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.level === S.level)); });
    root.querySelector('.seg[aria-label="난이도"]').hidden = S.mode === 'react';
    const [le, lh] = root.querySelectorAll('[data-level]');
    le.textContent = S.mode === 'rs' ? '입체중심 하나' : '조각 1–2개'; lh.textContent = S.mode === 'rs' ? '큰 분자' : '2–4개';
    const s = S.score;
    root.querySelector('.score').innerHTML = `<span>맞힘 <b>${s.right}</b> / ${s.total}</span><span>연속 <b>${s.streak}</b></span><span>최고 <b>${s.best}</b></span>`;
  }
  const nameOf = e => getLang() === 'ko' ? e.res.nameKo : e.res.nameEn;
  const small = e => drawMolecule(e.mol, e.res, { mode: mode(), locants: false, chain: false, compact: true });

  function next() {
    S.done = false; S.chosen = null;
    if (S.mode === 'rs') {
      const q = randomRS(S.level);
      if (!q) { card.innerHTML = '<p>문제를 만들지 못했습니다. 다시 눌러 주세요.</p>'; return; }
      S.q = q; S.opts = q.ct ? [{ k: 'cis' }, { k: 'trans' }] : [{ k: 'R' }, { k: 'S' }];
      q.correct = S.opts.find(o => o.k === q.answer);
      app.setMol(q.e);
    } else if (S.mode === 'react') {
      const q = randomReact();
      if (!q) { card.innerHTML = '<p>문제를 만들지 못했습니다. 다시 눌러 주세요.</p>'; return; }
      S.q = q; S.opts = q.opts;
      app.setMol(q.sub);
    } else {
      const q = randomQ(S.level);
      if (!q) { card.innerHTML = '<p>문제를 만들지 못했습니다.</p>'; return; }
      S.q = q; S.opts = shuffle([{ e: q.e }, ...distractors(q)]);
      S.q.correct = S.opts.find(o => o.e === q.e);
      app.setMol(q.e);
    }
    draw();
  }
  function drawRS() {
    const q = S.q, chosen = S.chosen, e = q.e;
    const loc = e.res.locLabel && e.res.locLabel.get(q.center);
    const pic = drawMolecule(e.mol, e.res, { mode: mode(), locants: S.done, chain: false, compact: true, mark: q.center, rsLabels: S.done, ctLabels: S.done, cip: S.done && !q.ct ? q.center : null });
    const SUB = { R: 'rectus · 시계 방향', S: 'sinister · 시계 반대 방향', cis: '두 치환기가 고리의 같은 면', trans: '두 치환기가 고리의 반대 면' };
    const opts = S.opts.map((o, i) => {
      const cls = !S.done ? '' : o === q.correct ? ' right' : o === chosen ? ' wrong' : '';
      return `<button class="q-opt rs${cls}" type="button" data-i="${i}" ${S.done ? 'disabled' : ''}><span class="k">${i + 1}</span><b>${o.k}</b><small>${SUB[o.k]}</small></button>`;
    }).join('');
    let fb = '';
    if (S.done) {
      const right = chosen === q.correct;
      const why = q.ct
        ? `<div class="rs-card panel"><p class="rs-how">두 치환기의 결합이 ${q.answer === 'cis' ? '둘 다 쐐기이거나 둘 다 빗금 쐐기 → 고리의 같은 면 → <b>cis</b>' : '하나는 쐐기, 하나는 빗금 쐐기 → 고리의 반대 면 → <b>trans</b>'}. 고리는 돌 수 없어서 cis 와 trans 는 서로 다른 화합물(부분입체이성질체)입니다.${e.res.ringCT && e.res.ringCT.plain ? ' 이 경우 두 탄소는 R/S 입체중심이 아니어서 이름에 cis-/trans- 를 붙입니다.' : ''}</p></div>`
        : `<div class="rs-card panel">${centerHTML(e.mol, q.center, c => e.res.locLabel && e.res.locLabel.get(c))}</div>`;
      fb = `<div class="q-feedback"><p class="q-verdict ${right ? 'ok' : 'no'}"><b>${right ? '정답' : '아쉽게도 오답'}</b> — ${q.ct ? '' : (loc ? 'C' + loc : '표시한 탄소') + '는 '}<b>${q.answer}</b> · ${esc(e.res.relName && q.ct ? e.res.relName.en : e.res.nameEn)}</p>
        ${why}
        <div class="q-actions"><button class="btn solid" type="button" id="q-next">다음 문제</button><button class="btn" type="button" id="q-open">분자 조립에서 열기</button></div></div>`;
    }
    const prompt = q.ct ? '고리 위 두 치환기는 cis 일까 trans 일까? 쐐기(▲)는 앞으로, 빗금 쐐기는 뒤로 들어간 결합입니다.' : '점선 원으로 표시한 탄소의 배열은? 쐐기(▲)는 앞으로, 빗금 쐐기는 뒤로 들어간 결합입니다.';
    card.innerHTML = `<p class="q-prompt">${prompt}</p><div class="q-struct">${pic}</div><div class="q-opts">${opts}</div>` + fb;
    card.querySelectorAll('.q-opt').forEach(b => b.addEventListener('click', () => answer(S.opts[+b.dataset.i])));
    if (S.done) {
      card.querySelector('#q-next').addEventListener('click', next);
      card.querySelector('#q-open').addEventListener('click', () => app.go('build', { mol: e.mol }));
      card.querySelector('#q-next').focus({ preventScroll: true });
    }
  }
  function draw() {
    if (S.mode === 'rs') return drawRS();
    const q = S.q, keys = ['A', 'B', 'C', 'D'], chosen = S.chosen;
    let head;
    if (S.mode === 'react') head = `<p class="q-prompt">주생성물은?</p><div class="q-rx">${small(q.sub)}<div class="rx-arrow"><span class="rx-reagent">${q.res.reaction.label}</span><svg viewBox="0 0 120 16" aria-hidden="true"><path d="M2 8h112M104 2l10 6-10 6"/></svg></div><span class="q-what">?</span></div>`;
    else if (S.mode === 'name') head = `<p class="q-prompt">이 분자의 IUPAC 이름은?</p><div class="q-struct">${small(q.e)}</div>`;
    else head = `<p class="q-prompt">이 이름의 구조는?</p><p class="q-name">${tokensHTML(getLang() === 'ko' ? q.e.res.ko : q.e.res.en)}</p>`;
    const opts = S.opts.map((o, i) => {
      const cls = !S.done ? '' : o === q.correct ? ' right' : o === chosen ? ' wrong' : '';
      const cap = S.done ? `<span class="q-cap">${esc(nameOf(o.e))}${o.same ? ' (반응 없음)' : ''}</span>` : '';
      return S.mode === 'name'
        ? `<button class="q-opt${cls}" type="button" data-i="${i}" ${S.done ? 'disabled' : ''}><span class="k">${keys[i]}</span>${esc(nameOf(o.e))}</button>`
        : `<button class="q-opt pic${cls}" type="button" data-i="${i}" ${S.done ? 'disabled' : ''} aria-label="보기 ${keys[i]}"><span class="k">${keys[i]}</span>${small(o.e)}${cap}</button>`;
    }).join('');
    let fb = '';
    if (S.done) {
      const right = chosen === q.correct;
      const verdict = `<p class="q-verdict ${right ? 'ok' : 'no'}"><b>${right ? '정답' : '아쉽게도 오답'}</b> — ${esc(q.correct.e.res.nameEn)} · ${esc(q.correct.e.res.nameKo)}</p>`;
      if (S.mode === 'react') {
        const r = q.res;
        fb = `<div class="q-feedback">${verdict}<p class="note">${esc(r.mech || '')}</p>
          <ol class="steps" style="padding:0">${(r.steps || []).map(s => `<li><div><span class="sk">${esc(s.t)}</span>${s.d}</div></li>`).join('')}</ol>
          ${r.select && r.select.length ? `<ul class="sel">${r.select.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
          <div class="q-actions"><button class="btn solid" type="button" id="q-next">다음 문제</button><button class="btn" type="button" id="q-open">반응 예측에서 열기</button></div></div>`;
      } else {
        const st = steps(q.e.mol, q.e.res);
        fb = `<div class="q-feedback">${verdict}
          ${!right && chosen ? `<p class="note">고른 보기는 ${esc(chosen.e.res.nameEn)} — 작용기 자리나 종류가 다른 분자입니다.</p>` : ''}
          <ol class="steps" style="padding:0">${st.map(s => `<li><div><span class="sk">${s.k}</span>${s.t}</div></li>`).join('')}</ol>
          <div class="q-actions"><button class="btn solid" type="button" id="q-next">다음 문제</button><button class="btn" type="button" id="q-open">분자 조립에서 열기</button></div></div>`;
      }
    }
    card.innerHTML = head + `<div class="q-opts">${opts}</div>` + fb;
    card.querySelectorAll('.q-opt').forEach(b => b.addEventListener('click', () => answer(S.opts[+b.dataset.i])));
    if (S.done) {
      card.querySelector('#q-next').addEventListener('click', next);
      card.querySelector('#q-open').addEventListener('click', () => S.mode === 'react' ? app.go('react', { smiles: q.smi, rid: q.rid }) : app.go('build', { mol: q.e.mol }));
      card.querySelector('#q-next').focus({ preventScroll: true });
    }
  }
  function answer(o) {
    if (S.done) return;
    S.done = true; S.chosen = o;
    const s = S.score;
    s.total++;
    if (o === S.q.correct) { s.right++; s.streak++; s.best = Math.max(s.best, s.streak); } else s.streak = 0;
    store.set('quizScore2', s);
    if (S.mode === 'react') app.setMol(S.q.correct.e);
    paintBar(); draw();
  }
  root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { S.mode = b.dataset.mode; store.set('quizMode', S.mode); paintBar(); next(); }));
  root.querySelectorAll('[data-level]').forEach(b => b.addEventListener('click', () => { S.level = b.dataset.level; store.set('quizLevel', S.level); paintBar(); next(); }));
  const off = onLang(() => draw());
  paintBar(); next();
  return { unmount() { off(); } };
}
