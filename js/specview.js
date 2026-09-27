/* 스펙트럼 그림 (SVG): IR 투과율 곡선과 질량 스펙트럼 막대. 분광 페이지와 연습 문제가 함께 쓴다 */
import { irCurve, irT, STR_KO, PROC } from './chem/spectra.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const r1 = v => Math.round(v * 10) / 10;
/* 휴대폰: 가로로 밀지 않고 한눈에 보이도록 좁은 그림 (글자는 CSS 에서 키움) */
const dims = o => { const W = o.w || (typeof innerWidth === 'number' && innerWidth < 640 ? 440 : 760); return { W, L: W < 600 ? 40 : 50, RR: W - 14, narrow: W < 600 }; };

/* IR: opts.marks(번호 표시) · opts.sel(강조할 흡수 띠 번호) · opts.title */
export function irSVG(bands, opts = {}) {
  const { W, L, RR, narrow } = dims(opts);
  const T = narrow ? 74 : 58, B = narrow ? 278 : 262, H = B - T, HT = B + 56;
  const x = nu => L + (4000 - nu) / 3600 * (RR - L), y = t => T + (1 - t / 100) * H;
  const regs = [[4000, 2500, 'X–H 신축'], [2500, 2000, '삼중결합'], [2000, 1500, '이중결합'], [1500, 400, '지문 영역']];
  let s = `<svg class="chart ir${narrow ? ' narrow' : ''}" viewBox="0 0 ${W} ${HT}" role="img" aria-label="${esc(opts.title || 'IR 스펙트럼')}">`;
  regs.forEach(([a, b, t], i) => {
    s += `<rect class="ch-reg r${i}" x="${r1(x(a))}" y="${T}" width="${r1(x(b) - x(a))}" height="${H}"/>`;
    s += `<text class="ch-rt" x="${r1((x(a) + x(b)) / 2)}" y="16" text-anchor="middle">${t}</text>`;
  });
  s += `<line class="ch-fg" x1="${r1(x(1500))}" y1="${T - 6}" x2="${r1(x(1500))}" y2="${B}"/>`;
  for (const t of [0, 50, 100]) s += `<line class="ch-grid" x1="${L}" y1="${r1(y(t))}" x2="${RR}" y2="${r1(y(t))}"/><text class="ch-t" x="${L - 7}" y="${r1(y(t) + 4)}" text-anchor="end">${t}</text>`;
  for (let nu = 4000; nu >= 500; nu -= 500) s += `<line class="ch-tick" x1="${r1(x(nu))}" y1="${B}" x2="${r1(x(nu))}" y2="${B + 5}"/><text class="ch-t" x="${r1(x(nu))}" y="${B + 19}" text-anchor="middle">${nu}</text>`;
  s += `<text class="ch-ax" x="${(L + RR) / 2}" y="${HT - 8}" text-anchor="middle">파수 (cm⁻¹)</text><text class="ch-ax" transform="translate(12 ${(T + B) / 2}) rotate(-90)" text-anchor="middle">투과율 (%)</text>`;
  const pts = irCurve(bands).map(([nu, t]) => `${r1(x(nu))},${r1(y(t))}`);
  s += `<path class="ch-area" d="M${r1(x(4000))},${T} L${pts.join(' L')} L${r1(x(400))},${T} Z"/><polyline class="ch-line" points="${pts.join(' ')}"/>`;
  s += `<line class="ch-frame" x1="${L}" y1="${B}" x2="${RR}" y2="${B}"/><line class="ch-frame" x1="${L}" y1="${T}" x2="${L}" y2="${B}"/>`;
  if (opts.marks !== false) {
    const rows = narrow ? [28, 44, 60] : [28, 44], last = rows.map(() => -99);
    const order = bands.map((b, i) => i).sort((p, q) => x(bands[p].nu) - x(bands[q].nu));
    for (const i of order) {
      const b = bands[i], px = x(b.nu), dip = y(irT(bands, b.nu));
      let row = last.findIndex(v => px - v >= 19);
      if (row < 0) row = last.indexOf(Math.min(...last));
      last[row] = px;
      const my = rows[row];
      s += `<g class="ir-mk${opts.sel === i ? ' on' : ''}${b.diag ? '' : ' minor'}" data-band="${i}" tabindex="0" role="button" aria-label="${i + 1}번 흡수 띠 ${b.nu} cm⁻¹ ${esc(b.vib)} (${esc(b.grp)})">`
        + (opts.tips === false ? '' : `<title>${i + 1}. ${b.nu} cm⁻¹ · ${esc(b.vib)} · ${esc(b.grp)}</title>`)
        + `<line x1="${r1(px)}" y1="${my + 8}" x2="${r1(px)}" y2="${r1(Math.max(my + 8, dip - 3))}"/><circle cx="${r1(px)}" cy="${my}" r="8.5"/><text x="${r1(px)}" y="${my + 3.8}" text-anchor="middle">${i + 1}</text></g>`;
    }
  }
  return s + '</svg>';
}

/* 질량 스펙트럼: opts.mark(물음표로 표시할 m/z) · opts.sel(강조) · opts.tags(M⁺• · 기준 피크 글자) · opts.tips(마우스 설명) */
export function msSVG(ms, opts = {}) {
  const { W, L, RR, narrow } = dims(opts);
  const T = 34, B = 252, H = B - T;
  const show = ms.peaks.filter(p => p.rel >= 0.4);
  const minMz = Math.min(...show.map(p => p.mz));
  let lo = Math.max(0, Math.floor((minMz - 6) / 10) * 10), hi = Math.ceil((ms.M + 6) / 10) * 10;
  if (hi - lo < 50) lo = Math.max(0, hi - 50);
  const x = z => L + 8 + (z - lo) / (hi - lo) * (RR - L - 16), y = r => B - r / 100 * H;
  const bw = Math.max(1.6, Math.min(7, (RR - L) / (hi - lo) * 0.55));
  let s = `<svg class="chart ms${narrow ? ' narrow' : ''}" viewBox="0 0 ${W} 300" role="img" aria-label="${esc(opts.title || '질량 스펙트럼')}">`;
  for (const t of [0, 25, 50, 75, 100]) s += `<line class="ch-grid" x1="${L}" y1="${r1(y(t))}" x2="${RR}" y2="${r1(y(t))}"/><text class="ch-t" x="${L - 7}" y="${r1(y(t) + 4)}" text-anchor="end">${t}</text>`;
  const step = hi - lo > (narrow ? 80 : 160) ? (narrow && hi - lo > 160 ? 40 : 20) : 10;
  for (let z = Math.ceil(lo / step) * step; z <= hi; z += step) s += `<line class="ch-tick" x1="${r1(x(z))}" y1="${B}" x2="${r1(x(z))}" y2="${B + 5}"/><text class="ch-t" x="${r1(x(z))}" y="${B + 19}" text-anchor="middle">${z}</text>`;
  s += `<text class="ch-ax" x="${(L + RR) / 2}" y="292" text-anchor="middle">m/z</text><text class="ch-ax" transform="translate(12 ${(T + B) / 2}) rotate(-90)" text-anchor="middle">상대 세기 (%)</text>`;
  s += `<line class="ch-frame" x1="${L}" y1="${B}" x2="${RR}" y2="${B}"/><line class="ch-frame" x1="${L}" y1="${T - 10}" x2="${L}" y2="${B}"/>`;
  /* 막대 */
  for (const p of show) {
    const iso = p.main.off !== 0, isM = p.main.f.proc === 'M' && !iso;
    const cls = 'ms-bar' + (p === ms.base ? ' base' : '') + (isM ? ' m' : '') + (iso ? ' iso' : '') + (opts.mark === p.mz ? ' ask' : '') + (opts.sel === p.mz ? ' on' : '');
    const h = Math.max(1.2, p.rel / 100 * H);
    s += `<g class="${cls}" data-mz="${p.mz}">${opts.tips === false ? '' : `<title>m/z ${p.mz} · ${p.rel.toFixed(p.rel < 10 ? 1 : 0)}% · ${iso ? `동위원소 피크 (${esc(p.main.f.text)} 의 +${p.main.off})` : `${esc(p.main.f.text)} — ${esc(PROC[p.main.f.proc].ko)}`}</title>`}<rect x="${r1(x(p.mz) - bw / 2)}" y="${r1(B - h)}" width="${r1(bw)}" height="${r1(h)}"/><rect class="hit" x="${r1(x(p.mz) - 5)}" y="${T - 10}" width="10" height="${H + 10}"/></g>`;
  }
  /* 글자: 큰 피크부터, 겹치면 건너뜀 */
  const placed = [];
  /* 염소 · 브로민: M 과 M+2 를 한 글자로 (막대가 붙어 있어 따로 쓰면 겹친다) */
  const pair = ms.m2 > 20;
  const want = show.filter(p => (p.rel >= 7 && !(pair && p.mz === ms.M + 2)) || p.mz === ms.M || p === ms.base || opts.mark === p.mz).sort((a, b) => (b.mz === opts.mark) - (a.mz === opts.mark) || (b.mz === ms.M) - (a.mz === ms.M) || b.rel - a.rel);
  for (const p of want) {
    const isM = p.mz === ms.M, top = isM && pair ? Math.max(p.rel, (show.find(q => q.mz === ms.M + 2) || p).rel) : p.rel;
    const px = x(p.mz) + (isM && pair ? x(ms.M + 2) - x(ms.M) : 0) / 2, py = y(top) - 6;
    if (placed.some(q => Math.abs(q[0] - px) < (isM && pair ? 30 : 17) && Math.abs(q[1] - py) < 14)) continue;
    placed.push([px, py]);
    const ask = opts.mark === p.mz;
    s += `<text class="ms-lab${ask ? ' ask' : ''}" x="${r1(px)}" y="${r1(py)}" text-anchor="middle">${isM && pair ? `${p.mz} · ${p.mz + 2}` : p.mz}</text>`;
 if (ask) s += `<text class="ms-tag ask" x="${r1(px)}" y="${r1(py - 14)}" text-anchor="middle">?</text>`;
    else if (opts.tags !== false && isM) s += `<text class="ms-tag" x="${r1(px)}" y="${r1(py - 14)}" text-anchor="middle">${pair ? 'M⁺• · M+2' : 'M⁺•'}</text>`;
    else if (opts.tags !== false && p === ms.base) s += `<text class="ms-tag base" x="${r1(px)}" y="${r1(py - 14)}" text-anchor="middle">기준</text>`;
  }
  return s + '</svg>';
}

/* IR 흡수 띠 표 */
export function irTableHTML(bands, sel) {
  return `<div class="tbl-wrap"><table class="tbl sp-tbl"><thead><tr><th>번호</th><th>파수 cm⁻¹</th><th>진동</th><th>작용기</th><th>세기 · 모양</th></tr></thead><tbody>${bands.map((b, i) => `<tr data-band="${i}" tabindex="0"${sel === i ? ' class="on"' : ''}${b.diag ? '' : ' data-minor'}>
    <td><span class="n">${i + 1}</span></td><td class="m">${b.peaks.length > 1 ? b.peaks.map(p => p[0]).sort((p, q) => q - p).join(' · ') : b.nu}<small>${b.range[0]}–${b.range[1]}</small></td>
    <td>${esc(b.vib)}${b.note ? `<small>${esc(b.note)}</small>` : ''}</td><td>${esc(b.grp)}</td><td>${STR_KO[b.str]}${b.shape ? ' · ' + esc(b.shape) : ''}</td></tr>`).join('')}</tbody></table></div>`;
}
/* 질량 스펙트럼 이온 표 */
export function msTableHTML(ms, sel) {
  return `<div class="tbl-wrap"><table class="tbl sp-tbl"><thead><tr><th>m/z</th><th>상대 세기</th><th>이온</th><th>떨어진 조각</th><th>과정</th></tr></thead><tbody>${ms.ions.map(f => `<tr data-mz="${f.mz}" tabindex="0"${sel === f.mz ? ' class="on"' : ''}>
    <td class="m"><b>${f.mz}</b>${f.proc === 'M' ? '<small>M⁺•</small>' : `<small>M − ${ms.M - f.mz}</small>`}</td><td class="m">${f.rel < 1 ? f.rel.toFixed(1) : Math.round(f.rel)}%</td>
    <td class="m">${esc(f.text)}</td><td class="m">${f.lost ? esc(f.lost) : '—'}</td><td>${esc(PROC[f.proc].ko)}${f.from ? `<small>${esc(f.from)} 에서</small>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
}
