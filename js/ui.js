/* 화면 곳곳에서 쓰는 작은 도구: 이름 토큰 → HTML, 분자 캐시, 저장소, 언어 */
import { parseSmiles, formula, toSmiles } from './chem/core.js';
import { layout } from './chem/layout.js';
import { nameMolecule } from './chem/name.js';
import { commonName } from './chem/common.js';

export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* 저장소: 막혀 있어도 앱은 돌아간다 */
export const store = {
  get(k, d) { try { const v = localStorage.getItem('hexa:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('hexa:' + k, JSON.stringify(v)); } catch { /* 저장 안 됨 */ } }
};

/* 구조식 표기: 'skeletal' 골격 구조식(기본) / 'atoms' 축약 구조식 (모든 탄소에 CH₃ · CH₂ 표시) */
export const drawMode = () => store.get('drawMode2', 'skeletal');
export const setDrawMode = m => store.set('drawMode2', m);

/* 이름 표기 언어 (EN 먼저 / 한글 먼저) */
let lang = store.get('lang', 'en');
const langSubs = new Set();
export const getLang = () => lang;
export function setLang(l) { lang = l; store.set('lang', l); langSubs.forEach(f => f(l)); }
export function onLang(f) { langSubs.add(f); return () => langSubs.delete(f); }

/* 이름 토큰 → 역할별 색 span. 하이픈 · 쉼표 뒤에서 줄바꿈 허용 */
export function tokensHTML(toks) {
  return toks.map(t => `<span class="t-${t.r}">${esc(t.s).replace(/([-,])/g, '$1<wbr>')}</span>`).join('');
}
export function namePair(res) {
  const main = lang === 'ko' ? res.ko : res.en, sub = lang === 'ko' ? res.nameEn : res.nameKo;
  return { mainHTML: tokensHTML(main), sub, main: lang === 'ko' ? res.nameKo : res.nameEn };
}

/* 분자 + 이름. SMILES 로 부르면 한 번만 계산해 둔다 */
const cache = new Map();
export function molecule(smi) {
  if (!cache.has(smi)) {
    const mol = parseSmiles(smi); layout(mol);
    cache.set(smi, entry(mol, smi));
    if (cache.size > 600) cache.delete(cache.keys().next().value);
  }
  return cache.get(smi);
}
/* 이미 좌표가 있는 분자 → 이름 · 분자식 (이름을 못 지으면 err) */
export function entry(mol, key) {
  let res = null, err = null;
  try { res = nameMolecule(mol); } catch (e) { err = e.message || String(e); }
  return { mol, res, err, f: formula(mol), common: res ? commonName(res) : null, key: key || toSmiles(mol) };
}

export function formulaHTML(f) { return f.parts.map(([el, n]) => el + (n > 1 ? `<sub>${n}</sub>` : '')).join(''); }
export function formulaText(f) { const s = '₀₁₂₃₄₅₆₇₈₉'; return f.parts.map(([el, n]) => el + (n > 1 ? String(n).replace(/\d/g, d => s[d]) : '')).join(''); }

/* 무작위 (시드 없이) */
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* 클립보드: 안 되면 글자를 선택해 둔다 */
export async function copyText(text, node) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    if (node) { const r = document.createRange(); r.selectNodeContents(node); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    return false;
  }
}

export const mq = s => !!(window.matchMedia && matchMedia(s).matches);

/* ── 보기 탭: 한 번에 한 칸만 펼친다. 고른 탭은 key 마다 기억한다.
   items: [{ id, label, n(작은 숫자), html }] — 비어 있는 칸은 빠진다. fallback: 기억한 탭이 없을 때 고를 탭 ── */
export function tabsHTML(key, items, fallback) {
  const list = items.filter(t => t && t.html);
  if (!list.length) return '';
  let sel = store.get('tab:' + key, null);
  if (!list.some(t => t.id === sel)) sel = list.some(t => t.id === fallback) ? fallback : list[0].id;
  const bar = `<div class="tab-bar" role="tablist">${list.map(t => `<button type="button" role="tab" id="tb-${key}-${t.id}" aria-controls="tp-${key}-${t.id}" aria-selected="${t.id === sel}" tabindex="${t.id === sel ? 0 : -1}" data-tab="${t.id}">${t.label}${t.n ? `<span class="tab-n">${t.n}</span>` : ''}</button>`).join('')}</div>`;
  return `<div class="tabs" data-key="${key}">${bar}${list.map(t => `<div class="tab-panel" role="tabpanel" id="tp-${key}-${t.id}" aria-labelledby="tb-${key}-${t.id}" data-panel="${t.id}"${t.id === sel ? '' : ' hidden'}>${t.html}</div>`).join('')}</div>`;
}
/* 지금 펼친 탭 (root 안의 key 탭) */
export function tabNow(root, key) {
  const b = root.querySelector(`.tabs[data-key="${key}"] > .tab-bar [aria-selected="true"]`);
  return b ? b.dataset.tab : null;
}
function selectTab(btn, focus) {
  const bar = btn.closest('.tab-bar'), box = bar.parentElement, key = box.dataset.key, id = btn.dataset.tab;
  bar.querySelectorAll('[data-tab]').forEach(b => { const on = b === btn; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
  for (const p of box.children) if (p.classList.contains('tab-panel')) p.hidden = p.dataset.panel !== id;
  store.set('tab:' + key, id);
  if (focus) btn.focus();
  box.dispatchEvent(new CustomEvent('tabchange', { bubbles: true, detail: { key, id } }));
}
/* 다른 곳의 버튼으로 탭 열기: data-goto="key:id" */
export function openTab(key, id, scroll) {
  const b = document.querySelector(`.tabs[data-key="${key}"] > .tab-bar [data-tab="${id}"]`);
  if (!b) return;
  selectTab(b);
  if (scroll) b.closest('.tabs').scrollIntoView({ behavior: mq('(prefers-reduced-motion: reduce)') ? 'auto' : 'smooth', block: 'start' });
}
document.addEventListener('click', e => {
  const b = e.target.closest('.tab-bar > [data-tab]');
  if (b) { selectTab(b); return; }
  const g = e.target.closest('[data-goto]');
  if (g) { const [key, id] = g.dataset.goto.split(':'); openTab(key, id, true); }
});
document.addEventListener('keydown', e => {
  const b = e.target.closest && e.target.closest('.tab-bar > [data-tab]');
  if (!b) return;
  const all = [...b.parentElement.children], i = all.indexOf(b);
  const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: all.length - 1 }[e.key];
  if (j === undefined) return;
  e.preventDefault();
  selectTab(all[(j + all.length) % all.length], true);
});

/* 최근 오류 몇 개 (버그 제보에 붙인다) */
export const recentErrors = [];
const keepErr = m => { recentErrors.push(String(m).replace(/\s+/g, ' ').slice(0, 300)); if (recentErrors.length > 5) recentErrors.shift(); };
window.addEventListener('error', e => keepErr((e.message || e.error) + (e.filename ? ` @${e.filename.split('/').pop()}:${e.lineno}` : '')));
window.addEventListener('unhandledrejection', e => keepErr('promise: ' + ((e.reason && (e.reason.message || e.reason)) || '')));
