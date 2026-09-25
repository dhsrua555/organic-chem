/* 화면 전체 커서 효과: 커서를 느리게 따라오는 육각 조준선, 누른 자리에서 퍼지는 육각 물결.
   손가락 입력 · 움직임 줄이기 설정에서는 조준선을 끄고 물결만 짧게 */
const HEX = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 2l15.6 9v18L20 38 4.4 29V11z"/></svg>';

export function startFx({ reduce }) {
  const fine = window.matchMedia && matchMedia('(pointer: fine)').matches;
  const layer = document.createElement('div');
  layer.className = 'fx-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);

  /* 물결 */
  window.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    const r = document.createElement('div');
    r.className = 'ripple' + (reduce ? ' still' : '');
    r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
    r.innerHTML = HEX + HEX;
    layer.appendChild(r);
    setTimeout(() => r.remove(), reduce ? 300 : 900);
  }, { passive: true });

  if (!fine || reduce) return;
  /* 조준선 */
  const ret = document.createElement('div');
  ret.className = 'reticle';
  ret.innerHTML = HEX + '<i></i>';
  layer.appendChild(ret);
  let x = -100, y = -100, tx = -100, ty = -100, big = 0, bigT = 0, seen = false, last = performance.now();
  const hot = el => !!(el && el.closest && el.closest('button, a, [role="button"], [data-atom], [data-bond], summary, input, select'));
  window.addEventListener('pointermove', e => {
    tx = e.clientX; ty = e.clientY;
    if (!seen) { x = tx; y = ty; seen = true; ret.style.opacity = '1'; }
    bigT = hot(e.target) ? 1 : 0;
  }, { passive: true });
  document.addEventListener('pointerleave', () => { ret.style.opacity = '0'; seen = false; });
  window.addEventListener('pointerdown', () => { ret.classList.add('press'); }, { passive: true });
  window.addEventListener('pointerup', () => { ret.classList.remove('press'); }, { passive: true });
  const tick = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const k = 1 - Math.pow(0.0005, dt);
    x += (tx - x) * k; y += (ty - y) * k;
    big += (bigT - big) * Math.min(1, dt * 12);
    const s = 1 + big * 0.6;
    ret.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) scale(${s.toFixed(3)}) rotate(${(big * 30).toFixed(1)}deg)`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
