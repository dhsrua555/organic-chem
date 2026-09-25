/* 배경 3D: 육각 격자 바닥, 수평선 빛줄기, 떠다니는 점, 와이어프레임 분자.
   - 분자가 바뀌면 가로 줄무늬로 풀렸다가(색수차) 새 분자로 맺힌다
   - 마우스 가까운 원자는 바깥으로 들리며 빛나고 작은 이름표가 붙는다 (igloo.inc 의 블록 반응을 분자에 옮김)
   - 누르면 충격파로 원자가 튀었다 돌아오고 바닥에 육각 물결, 길게 누르면 분자가 벌어진다(분해도)
   - 3D 보기: 끌어서 회전, 휠 · 두 손가락으로 확대 · 축소, 두 번 눌러 처음 모양
   - 빠르게 여러 번 바꾸면 마지막 분자만 만들고, 사라지는 분자는 하나만 남겨 짧게 전환한다 (렉 방지).
     가만히 있을 때는 색수차 세 겹 대신 한 겹만 그린다 */
import * as THREE from './three.js';
import { embed3d } from './chem/geom3d.js';
import { rings } from './chem/core.js';

const COL = {
  bg: 0x03060f, floor: new THREE.Color(0x1d4fb8), glow: new THREE.Color(0x6fb2ff), streak: 0x9cc6ff, dust: 0x4d8dff,
  wire: new THREE.Color(0xd4e2ff), hetero: new THREE.Color(0x8cc8ff), pri: new THREE.Color(0x2f86ff), hl: new THREE.Color(0x5fe0b4)
};
const RAD = { H: 0.17, C: 0.28, N: 0.28, O: 0.27, F: 0.26, Cl: 0.36, Br: 0.4, I: 0.45 };
const MAXA = 200;

const VERT = `
attribute float aRand; attribute float aAtom; attribute vec3 color;
uniform float uT; uniform float uShift; uniform float uAlpha; uniform vec4 uDisp[${MAXA}];
varying vec3 vColor; varying float vA;
void main(){
  float t = smoothstep(aRand * 0.45, aRand * 0.45 + 0.55, uT);
  vec3 pos = position; float g = 0.0;
  int ai = int(aAtom + 0.5);
  if (aAtom >= 0.0 && ai < ${MAXA}) { vec4 d = uDisp[ai]; pos += d.xyz; g = d.w; }
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float s = length(modelViewMatrix[0].xyz);
  mv.x += ((aRand - 0.5) * 22.0 * t + uShift * t) * s;
  mv.y = mix(mv.y, c.y + ((aRand - 0.5) * 2.4 - 0.4) * s, t * 0.75);
  mv.z = mix(mv.z, c.z, 0.75 * t);
  float f = 1.0 - t;
  vColor = mix(color, vec3(0.8, 0.93, 1.0), clamp(g, 0.0, 1.0)) * (1.0 + g * 0.9);
  vA = uAlpha * f * f * (0.35 + 0.65 * f);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `uniform vec3 uMask; varying vec3 vColor; varying float vA; void main(){ gl_FragColor = vec4(vColor * uMask, vA); }`;

const FLOOR_VERT = `
uniform vec3 uMouse; uniform float uTime; uniform vec4 uRip[4];
varying float vGlow; varying float vFog;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  float d = distance(w.xz, uMouse.xz);
  float g = exp(-d * d / 10.0) * uMouse.y;
  for (int i = 0; i < 4; i++) {
    vec4 r = uRip[i];
    float age = uTime - r.z;
    if (r.w > 0.0 && age > 0.0 && age < 3.0) {
      float rad = age * 9.0;
      float dd = distance(w.xz, r.xy);
      g += exp(-pow((dd - rad) / 0.9, 2.0)) * (1.0 - age / 3.0) * r.w;
    }
  }
  vGlow = g;
  vec4 mv = viewMatrix * w;
  float z = -mv.z;
  vFog = 1.0 - exp(-0.0025 * z * z);
  gl_Position = projectionMatrix * mv;
}`;
const FLOOR_FRAG = `
uniform vec3 uBase; uniform vec3 uGlow; uniform vec3 uBg; varying float vGlow; varying float vFog;
void main(){ vec3 c = uBase * 0.42 + uGlow * clamp(vGlow, 0.0, 1.6); gl_FragColor = vec4(mix(c, uBg, clamp(vFog, 0.0, 1.0)), 1.0); }`;

export function createScene(canvas, { low = false, reduce = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1.25 : 1.75));
  renderer.setClearColor(COL.bg, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(COL.bg, 0.05);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  camera.position.set(0, 1.1, 15);
  camera.lookAt(0, 0, 0);

  const floor = hexFloor(low ? 13 : 20, 1.25);
  floor.position.y = -3.6;
  scene.add(floor);
  const streaks = horizonStreaks(low ? 26 : 48);
  scene.add(streaks);
  const dust = dustField(low ? 220 : 520);
  scene.add(dust);

  const root = new THREE.Group();
  scene.add(root);
  const spin = new THREE.Group();
  root.add(spin);

  const state = {
    anchor: { x: -0.25, y: 0.02, scale: 1, dim: 1 }, cur: { x: -0.25, y: 0.02, scale: 1, dim: 1 },
    motion: !reduce, drag: null, rotX: 0.28, rotY: 0, baseY: 0, phase: 0, mouse: [0, 0], px: [-9999, -9999], moved: 0,
    live: [], zoom: 1, zoomT: 1, focus: false, explode: 0, explodeT: 0, hold: null, rippleIdx: 0, showH: true
  };
  let W = 1, H = 1, last = performance.now(), running = true;
  let current = null; /* 지금 맺혀 있는 분자 (원자 반응용) */
  const hud = document.createElement('div');
  hud.className = 'atom-hud'; hud.setAttribute('aria-hidden', 'true');
  document.body.appendChild(hud);

  function resize() {
    W = canvas.clientWidth || window.innerWidth; H = canvas.clientHeight || window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.fov = W / H < 0.8 ? 44 : 32;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  const tmp = new THREE.Vector3();
  function anchorWorld(ax, ay) {
    tmp.set(ax, ay, 0.5).unproject(camera);
    const dir = tmp.sub(camera.position).normalize();
    const t = -camera.position.z / dir.z;
    return camera.position.clone().add(dir.multiplyScalar(t));
  }

  function makeWire(mol, res, opts = {}) {
    const g = embedCached(mol);
    const R = rings(mol);
    const pri = res ? res.principalAtoms || new Set() : new Set();
    const hl = opts.hl || new Set();
    const showH = state.showH;
    const pos = [], col = [], rnd = [], owner = [];
    const push = (a, b, c, oa, ob) => { pos.push(a[0], a[1], a[2], b[0], b[1], b[2]); col.push(c.r, c.g, c.b, c.r, c.g, c.b); rnd.push(Math.random(), Math.random()); owner.push(oa, ob); };
    const colorOf = a => (a.heavy >= 0 && pri.has(a.heavy)) ? COL.pri : (a.heavy >= 0 && hl.has(a.heavy)) ? COL.hl : (a.el === 'C' || a.el === 'H') ? COL.wire : COL.hetero;
    const ico = icoEdges();
    const idx = [];
    g.atoms.forEach((a, i) => {
      if (a.el === 'H' && !showH) return;
      const id = i < MAXA ? i : -1;
      idx[i] = id;
      const r = RAD[a.el] || 0.34, e = ico[a.el === 'H' ? 0 : 1], c = colorOf(a);
      for (let k = 0; k < e.length; k += 6) push([a.p[0] + e[k] * r, a.p[1] + e[k + 1] * r, a.p[2] + e[k + 2] * r], [a.p[0] + e[k + 3] * r, a.p[1] + e[k + 4] * r, a.p[2] + e[k + 5] * r], c, id, id);
    });
    g.bonds.forEach(b => {
      const A = g.atoms[b.a], B = g.atoms[b.b];
      if (!showH && (A.el === 'H' || B.el === 'H')) return;
      const d = sub(B.p, A.p), L = len(d), u = norm(d);
      const ra = (RAD[A.el] || 0.3) * 0.92, rb = (RAD[B.el] || 0.3) * 0.92;
      if (L <= ra + rb) return;
      const s = add(A.p, mul(u, ra)), e = add(B.p, mul(u, -rb));
      const n1 = perpTo(u, g, b), n2 = norm(cross(u, n1));
      const hot = (A.heavy >= 0 && pri.has(A.heavy)) && (B.heavy >= 0 && pri.has(B.heavy));
      const hlb = (A.heavy >= 0 && hl.has(A.heavy)) && (B.heavy >= 0 && hl.has(B.heavy));
      const c = hot ? COL.pri : hlb ? COL.hl : (A.el === 'H' || B.el === 'H') ? COL.wire.clone().multiplyScalar(0.7) : COL.wire;
      const strands = b.arom || b.o === 1 ? [0] : b.o === 2 ? [-0.11, 0.11] : [-0.15, 0, 0.15];
      const rr = b.o === 1 && !b.arom ? 0.07 : 0.045;
      const oa = idx[b.a] ?? -1, ob = idx[b.b] ?? -1;
      for (const off of strands) {
        const s2 = add(s, mul(n1, off)), e2 = add(e, mul(n1, off));
        const ring = k => { const t = Math.PI / 3 * k; return add(mul(n1, Math.cos(t) * rr), mul(n2, Math.sin(t) * rr)); };
        for (let k = 0; k < 6; k++) {
          const o = ring(k), o2 = ring(k + 1);
          push(add(s2, o), add(e2, o), c, oa, ob);
          push(add(s2, o), add(s2, o2), c, oa, oa);
          push(add(e2, o), add(e2, o2), c, ob, ob);
        }
      }
      if (b.arom && b.o === 2 && b.a < mol.atoms.length && b.b < mol.atoms.length && R.of[b.a] >= 0) {
        const ringAtoms = R.list[R.of[b.a]];
        const cen = ringAtoms.reduce((acc, x) => add(acc, g.atoms[x].p), [0, 0, 0]).map(x => x / ringAtoms.length);
        const mid = mul(add(A.p, B.p), 0.5), inw = norm(sub(cen, mid));
        push(add(add(s, mul(inw, 0.22)), mul(u, 0.12)), add(add(e, mul(inw, 0.22)), mul(u, -0.12)), c, oa, ob);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('aRand', new THREE.Float32BufferAttribute(rnd, 1));
    geo.setAttribute('aAtom', new THREE.Float32BufferAttribute(owner, 1));
    const group = new THREE.Group();
    const disp = Array.from({ length: MAXA }, () => new THREE.Vector4(0, 0, 0, 0));
    const passes = [[1, 0, 0, -0.35], [0, 1, 0, 0], [0, 0, 1, 0.35]].map(([r, gg, bb, sh]) => {
      const m = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uT: { value: 1 }, uShift: { value: sh }, uAlpha: { value: 1 }, uDisp: { value: disp }, uMask: { value: new THREE.Vector3(r, gg, bb) } }
      });
      const ls = new THREE.LineSegments(geo, m);
      ls.frustumCulled = false;
      group.add(ls);
      return m;
    });
    const sprites = [], mats = new Map();
    const matFor = (el, hot) => { const k = el + (hot ? '*' : ''); if (!mats.has(k)) mats.set(k, letterMat(el, hot)); return mats.get(k); };
    g.atoms.forEach((a, i) => {
      if (a.el === 'C' || a.el === 'H') return;
      const sp = new THREE.Sprite(matFor(a.el, a.heavy >= 0 && pri.has(a.heavy)));
      sp.position.set(a.p[0], a.p[1], a.p[2]);
      sp.scale.set(0.42, 0.42, 1);
      sp.renderOrder = 2;
      sp.userData.atom = i;
      group.add(sp);
      sprites.push(sp);
    });
    let radius = 0;
    g.atoms.forEach(a => { radius = Math.max(radius, len(a.p)); });
    /* 원자별 움직임 상태 */
    const phys = g.atoms.map((a, i) => ({ i, p: new THREE.Vector3(...a.p), d: new THREE.Vector3(), v: new THREE.Vector3(), glow: 0, el: a.el, heavy: a.heavy, hyb: hybOf(g, i) }));
    return { group, passes, sprites, disp, phys, radius: radius + 0.6, t: 1, target: 0, speed: 1, mol, res };
  }

  /* 분자 바꾸기: 바로 만들지 않고 다음 틈에 (연달아 바뀌면 마지막 것만) */
  let pending = null, pendTimer = 0, lastChange = -1e9, burstCount = 0;
  function setMolecule(mol, res, opts = {}) {
    state.last = { mol, res, opts };
    pending = state.last;
    const now = performance.now();
    const gap = now - lastChange;
    lastChange = now;
    burstCount = gap < 700 ? burstCount + 1 : 0;
    clearTimeout(pendTimer);
    if (opts.instant || !current) { flush(false); return; }
    /* 빠르게 연달아 누르면 잠깐 기다렸다가 마지막 분자만 */
    pendTimer = setTimeout(() => flush(burstCount > 0), burstCount > 0 ? 120 : 0);
  }
  function flush(rapid) {
    if (!pending) return;
    const { mol, res, opts } = pending;
    pending = null;
    let w;
    try { w = makeWire(mol, res, opts); } catch (e) { console.warn(e); return; }
    const quick = rapid || !state.motion;
    /* 이미 사라지는 중인 분자는 바로 치우고, 지금 분자 하나만 풀려 사라지게 */
    state.live = state.live.filter(o => {
      if (o.target === 1 || quick && o !== current) { dispose(o); return false; }
      return true;
    });
    for (const o of state.live) { o.target = 1; o.speed = quick ? 3.2 : 1.6; }
    const inst = opts.instant || reduce;
    w.t = inst ? 0 : quick ? 0.6 : 1; w.target = 0; w.delay = inst || quick || !state.live.length ? 0 : 0.28; w.speed = quick ? 2.4 : 1.15;
    state.live.push(w);
    spin.add(w.group);
    state.fit = 4.3 / Math.max(3.2, w.radius);
    current = w;
  }
  /* 버퍼만 비운다. 재질(셰이더)은 모든 분자가 같은 프로그램을 쓰므로 지우지 않는다 — 지우면 다음 분자에서 셰이더를 다시 컴파일해 멈칫한다 */
  function dispose(w) {
    spin.remove(w.group);
    w.group.traverse(o => { if (o.geometry && !o.isSprite) o.geometry.dispose(); });
  }
  function setAnchor(a) { Object.assign(state.anchor, a); }
  function setMotion(on) { state.motion = on && !reduce; }

  /* ── 3D 보기 조작 ── */
  const pointers = new Map();
  let pinch = null;
  canvas.addEventListener('pointerdown', e => {
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    canvas.setPointerCapture(e.pointerId);
    if (pointers.size === 1) state.drag = { x: e.clientX, y: e.clientY, rx: state.rotX, ry: state.rotY };
    if (pointers.size === 2) { const [p, q] = [...pointers.values()]; pinch = { d: Math.hypot(p[0] - q[0], p[1] - q[1]), z: state.zoomT }; state.drag = null; }
  });
  canvas.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && pointers.size === 2) { const [p, q] = [...pointers.values()]; zoomTo(pinch.z * Math.hypot(p[0] - q[0], p[1] - q[1]) / pinch.d); return; }
    if (!state.drag) return;
    state.rotY = state.drag.ry + (e.clientX - state.drag.x) * 0.008;
    state.rotX = Math.max(-1.4, Math.min(1.4, state.drag.rx + (e.clientY - state.drag.y) * 0.006));
  });
  const up = e => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (state.drag) state.baseY = state.rotY - Math.sin(state.phase) * 0.85;
    state.drag = null;
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { if (!state.focus) return; e.preventDefault(); zoomTo(state.zoomT * Math.exp(-e.deltaY * 0.0012)); }, { passive: false });
  canvas.addEventListener('dblclick', () => reset());
  function zoomTo(z) { state.zoomT = Math.max(0.45, Math.min(3.5, z)); }
  function reset() { state.zoomT = 1; state.rotX = 0.28; state.rotY = 0; state.baseY = 0; state.phase = 0; }
  function setFocus(on) { state.focus = on; if (!on) reset(); }
  function setShowH(on) { state.showH = on; if (state.last) { const { mol, res, opts } = state.last; setMolecule(mol, res, { ...opts, instant: true }); } }

  /* ── 마우스 · 클릭 효과 ── */
  const fine = !(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  window.addEventListener('pointermove', e => {
    state.mouse = [e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5];
    state.px = [e.clientX, e.clientY];
    state.moved = performance.now();
  }, { passive: true });
  const isUI = el => el && el.closest && el.closest('button, a, input, select, textarea, label, [role="button"], [data-atom], [data-bond], .panel, .q-opt, .hud, .menu');
  window.addEventListener('pointerdown', e => {
    if (reduce) return;
    const ui = isUI(e.target) && e.target !== canvas;
    burst(e.clientX, e.clientY, ui ? 0.35 : 1);
    if (!ui) state.hold = { t: performance.now(), id: e.pointerId };
  }, { passive: true });
  window.addEventListener('pointerup', () => { state.hold = null; state.explodeT = 0; }, { passive: true });
  window.addEventListener('pointercancel', () => { state.hold = null; state.explodeT = 0; }, { passive: true });

  const rip = Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, -99, 0));
  floor.material.uniforms.uRip.value = rip;
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 3.6), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  function floorPoint(x, y) {
    ndc.set(x / W * 2 - 1, -(y / H) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null;
  }
  function burst(x, y, strength) {
    const now = performance.now() / 1000;
    const fp = floorPoint(x, y);
    if (fp) { rip[state.rippleIdx % 4].set(fp.x, fp.z, now, 1.2 * strength); state.rippleIdx++; }
    if (!current) return;
    for (const a of current.phys) {
      const s = screenOf(a);
      if (!s) continue;
      const d = Math.hypot(s[0] - x, s[1] - y);
      const k = strength * 5.5 / (1 + d / 160);
      const dir = a.p.clone().normalize();
      if (!isFinite(dir.x)) dir.set(0, 1, 0);
      a.v.addScaledVector(dir, k);
      a.v.z += k * 0.3;
      a.glow = Math.min(1.4, a.glow + strength * 0.9 / (1 + d / 220));
    }
  }
  const v3 = new THREE.Vector3();
  function screenOf(a) {
    v3.copy(a.p).add(a.d);
    v3.applyMatrix4(current.group.matrixWorld);
    v3.project(camera);
    if (v3.z > 1) return null;
    return [(v3.x + 1) / 2 * W, (1 - v3.y) / 2 * H];
  }
  /* 원자 이름표 (가까운 몇 개만) */
  const tags = [];
  function tagFor(k) {
    if (!tags[k]) { const d = document.createElement('div'); d.className = 'ahud'; d.innerHTML = '<i></i><span></span>'; hud.appendChild(d); tags[k] = d; }
    return tags[k];
  }
  function drawTags(list) {
    for (let k = 0; k < tags.length; k++) if (!list[k]) tags[k].style.opacity = '0';
    list.forEach((it, k) => {
      const d = tagFor(k);
      d.style.opacity = String(Math.min(1, it.a.glow * 1.4 * current.passes[1].uniforms.uAlpha.value));
      d.style.transform = `translate(${it.s[0].toFixed(1)}px, ${it.s[1].toFixed(1)}px)`;
      const label = it.a.el === 'H' ? 'H' : `${it.a.el}${it.a.heavy + 1}`;
      const text = `${label} · ${it.a.hyb}`;
      const span = d.querySelector('span');
      if (span.textContent !== text) span.textContent = text;
    });
  }

  function physics(dt, now) {
    if (!current) return;
    const w = current;
    const mouseActive = fine && !reduce && now - state.moved < 2500;
    const R = 150;
    const ex = state.explode;
    const near = [];
    for (const a of w.phys) {
      let s = null, prox = 0;
      if (mouseActive || ex > 0.01) s = screenOf(a);
      if (mouseActive && s) { const d = Math.hypot(s[0] - state.px[0], s[1] - state.px[1]); prox = Math.max(0, 1 - d / R); prox *= prox; }
      const dir = a.p.clone(); const L = dir.length() || 1; dir.divideScalar(L);
      const target = dir.multiplyScalar(prox * 0.75 + ex * (0.35 + L * 0.45));
      /* 스프링 */
      a.v.addScaledVector(target.sub(a.d), 60 * dt);
      a.v.multiplyScalar(Math.exp(-9 * dt));
      a.d.addScaledVector(a.v, dt);
      a.glow += (Math.max(prox, ex * 0.6) - a.glow) * Math.min(1, dt * 6);
      if (a.i < MAXA) w.disp[a.i].set(a.d.x, a.d.y, a.d.z, a.glow);
      if (s && a.glow > 0.18 && (a.el !== 'H' || ex > 0.5)) near.push({ a, s });
    }
    for (const sp of w.sprites) { const a = w.phys[sp.userData.atom]; sp.position.copy(a.p).add(a.d); }
    near.sort((p, q) => q.a.glow - p.a.glow);
    drawTags(near.slice(0, ex > 0.5 ? 16 : 6));
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const k = 1 - Math.pow(0.001, dt);
    const c = state.cur, a = state.anchor;
    c.x += (a.x - c.x) * k * 0.9; c.y += (a.y - c.y) * k * 0.9; c.scale += (a.scale - c.scale) * k; c.dim += (a.dim - c.dim) * k;
    state.zoom += (state.zoomT - state.zoom) * Math.min(1, dt * 8);
    /* 길게 누르면 분해도 */
    if (state.hold && now - state.hold.t > 280) state.explodeT = 1;
    state.explode += (state.explodeT - state.explode) * Math.min(1, dt * 5);
    root.position.copy(anchorWorld(c.x, c.y));
    root.scale.setScalar((state.fit || 1) * c.scale * state.zoom);
    if (state.motion && !state.drag) { state.phase += dt * 0.32; state.rotY = state.baseY + Math.sin(state.phase) * 0.85; }
    const tx = state.motion && !state.focus ? state.mouse[1] * 0.12 : 0, ty = state.motion && !state.focus ? state.mouse[0] * 0.18 : 0;
    spin.rotation.x += (state.rotX + tx - spin.rotation.x) * k;
    spin.rotation.y += (state.rotY + ty - spin.rotation.y) * k;
    root.updateMatrixWorld(true);
    state.live = state.live.filter(w => {
      if (w.delay > 0) w.delay -= dt;
      else w.t += Math.sign(w.target - w.t) * Math.min(Math.abs(w.target - w.t), dt * w.speed);
      for (const m of w.passes) { m.uniforms.uT.value = w.t; m.uniforms.uAlpha.value = c.dim; }
      /* 다 맺힌 뒤에는 세 겹(빨 · 초 · 파)이 한자리에 겹치므로 한 겹을 흰색으로 */
      const still = w.t < 1e-3;
      if (still !== w.still) {
        w.still = still;
        w.passes[0].uniforms.uMask.value.set(1, still ? 1 : 0, still ? 1 : 0);
        w.group.children.forEach((ch, i) => { if (ch.isLineSegments && i > 0) ch.visible = !still; });
      }
      w.group.children.forEach(ch => { if (ch.isSprite) ch.material.opacity = Math.pow(1 - w.t, 3) * c.dim; });
      if (w.target === 1 && w.t >= 1) { dispose(w); return false; }
      return true;
    });
    physics(dt, now);
    /* 바닥: 커서 아래 빛, 물결 */
    const fu = floor.material.uniforms;
    fu.uTime.value = now / 1000;
    if (fine && state.motion && now - state.moved < 4000) {
      const fp = floorPoint(state.px[0], state.px[1]);
      if (fp) fu.uMouse.value.set(fp.x, Math.min(1, fu.uMouse.value.y + dt * 2), fp.z);
    } else fu.uMouse.value.y = Math.max(0, fu.uMouse.value.y - dt);
    if (state.motion) {
      floor.position.z = (now * 0.0004) % (1.25 * Math.sqrt(3));
      streaks.material.uniforms.uTime.value = now * 0.001;
      dust.rotation.y = now * 0.00002;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) { last = performance.now(); requestAnimationFrame(frame); }
  });
  return {
    setMolecule, setAnchor, setMotion, resize, canvas, setFocus, setShowH,
    zoomIn: () => zoomTo(state.zoomT * 1.25), zoomOut: () => zoomTo(state.zoomT / 1.25), reset,
    burst: (x, y, s = 1) => burst(x, y, s)
  };
}

function hybOf(g, i) {
  const a = g.atoms[i];
  if (a.el === 'H') return 's';
  const bs = g.bonds.filter(b => b.a === i || b.b === i);
  if (bs.some(b => b.arom)) return 'sp²';
  const pi = bs.reduce((s, b) => s + (b.o - 1), 0);
  if (a.el === 'O' || a.el === 'N') { if (pi) return 'sp²'; return 'sp³'; }
  if (a.el !== 'C') return '';
  return pi >= 2 ? 'sp' : pi === 1 ? 'sp²' : 'sp³';
}

/* ── 배경 조각 ── */
function hexFloor(R, s) {
  const pos = [], seen = new Set();
  const h = Math.sqrt(3) * s;
  for (let q = -R; q <= R; q++) for (let r = Math.max(-R, -q - R); r <= Math.min(R, -q + R); r++) {
    const cx = s * 1.5 * q, cz = h * (r + q / 2);
    const pts = [];
    for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k; pts.push([cx + s * Math.cos(a), cz + s * Math.sin(a)]); }
    for (let k = 0; k < 6; k++) {
      const p = pts[k], n = pts[(k + 1) % 6];
      const key = [p, n].map(x => x.map(v => v.toFixed(2)).join(',')).sort().join('|');
      if (seen.has(key)) continue; seen.add(key);
      pos.push(p[0], 0, p[1], n[0], 0, n[1]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const mat = new THREE.ShaderMaterial({
    vertexShader: FLOOR_VERT, fragmentShader: FLOOR_FRAG,
    uniforms: { uMouse: { value: new THREE.Vector3(0, 0, 0) }, uTime: { value: 0 }, uRip: { value: [] }, uBase: { value: COL.floor }, uGlow: { value: COL.glow }, uBg: { value: new THREE.Color(COL.bg) } }
  });
  return new THREE.LineSegments(geo, mat);
}
function horizonStreaks(n) {
  const pos = [], ph = [];
  for (let i = 0; i < n; i++) {
    const y = (Math.random() - 0.5) * 0.5, z = -8 - Math.random() * 10, p = Math.random() * 10, span = 18 + Math.random() * 30, x0 = (Math.random() - 0.5) * 30;
    const seg = 60;
    for (let k = 0; k < seg; k++) {
      const x1 = x0 - span / 2 + span * k / seg, x2 = x0 - span / 2 + span * (k + 1) / seg;
      pos.push(x1, y, z, x2, y, z); ph.push(p, p);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aPh', new THREE.Float32BufferAttribute(ph, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(COL.streak) } },
    vertexShader: `attribute float aPh; uniform float uTime; varying float vA;
      void main(){ vec3 p = position; p.y += sin(p.x * 0.35 + aPh + uTime * 0.6) * 0.18 + sin(p.x * 1.3 + aPh * 2.0) * 0.05;
      vA = 0.16 * (1.0 - smoothstep(6.0, 22.0, abs(p.x))); gl_Position = projectionMatrix * modelViewMatrix * vec4(p + vec3(0.0, -1.2, 0.0), 1.0); }`,
    fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(uColor, vA); }`
  });
  return new THREE.LineSegments(geo, mat);
}
function dustField(n) {
  const pos = [];
  for (let i = 0; i < n; i++) pos.push((Math.random() - 0.5) * 60, -3 + Math.random() * 14, -30 + Math.random() * 40);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: COL.dust, size: 2, sizeAttenuation: false, transparent: true, opacity: 0.55, fog: true }));
}
const letterCache = {};
function letterMat(el, hot) {
  const k = el + (hot ? '*' : '');
  if (!letterCache[k]) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = hot ? '#6fb2ff' : '#bcd8ff';
    x.font = '500 34px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(el, 32, 34);
    letterCache[k] = new THREE.CanvasTexture(c);
  }
  return new THREE.SpriteMaterial({ map: letterCache[k], transparent: true, depthWrite: false, depthTest: false });
}
let ICO = null;
function icoEdges() {
  if (!ICO) ICO = { 0: edgesOf(new THREE.IcosahedronGeometry(1, 0)), 1: edgesOf(new THREE.IcosahedronGeometry(1, 1)) };
  return ICO;
}
/* 같은 분자(되돌리기 · 다시 고르기)는 3D 좌표를 다시 계산하지 않는다 */
const EMBED = new Map();
function embedCached(mol) {
  const k = JSON.stringify([mol.atoms.map(a => [a.el, a.h, a.q || 0, a.chi ? a.chi.n.join('.') + ':' + a.chi.s : 0, Math.round(a.x * 4), Math.round(a.y * 4)]), mol.bonds.map(b => [b.a, b.b, b.o])]);
  if (EMBED.has(k)) { const v = EMBED.get(k); EMBED.delete(k); EMBED.set(k, v); return v; }
  const g = embed3d(mol);
  EMBED.set(k, g);
  if (EMBED.size > 40) EMBED.delete(EMBED.keys().next().value);
  return g;
}
function edgesOf(geo) { const e = new THREE.EdgesGeometry(geo, 1); return Array.from(e.attributes.position.array); }
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function perpTo(u, g, b) {
  const A = g.atoms[b.a];
  const other = g.bonds.find(x => (x.a === b.a && x.b !== b.b) || (x.b === b.a && x.a !== b.b));
  if (other) {
    const j = other.a === b.a ? other.b : other.a;
    const w = sub(g.atoms[j].p, A.p);
    const p = sub(w, mul(u, w[0] * u[0] + w[1] * u[1] + w[2] * u[2]));
    if (len(p) > 1e-3) return norm(p);
  }
  const t = Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  return norm(cross(u, t));
}
