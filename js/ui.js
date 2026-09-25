/* 화면 곳곳에서 쓰는 작은 도구: 이름 토큰 → HTML, 분자 캐시, 저장소, 언어 */
import { build, formula, key as molKey } from './chem/mol.js';
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

/* 분자 + 이름 (같은 구조는 한 번만 계산) */
const cache = new Map();
export function molecule(scaf, subs) {
  const k = molKey(scaf, subs);
  if (!cache.has(k)) {
    const mol = build(scaf, subs);
    const res = nameMolecule(mol);
    const f = formula(mol);
    cache.set(k, { mol, res, f, common: commonName(res), key: k });
    if (cache.size > 800) cache.delete(cache.keys().next().value);
  }
  return cache.get(k);
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
