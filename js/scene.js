/* 배경 3D: 육각 격자 바닥, 수평선의 빛줄기, 떠다니는 점, 와이어프레임 분자.
   분자가 바뀔 때는 선이 가로 줄무늬로 풀렸다가(색수차) 새 분자로 다시 맺힌다. */
import * as THREE from './three.js';
import { embed3d } from './chem/geom3d.js';

const COL = {
  bg: 0x03060f, floor: 0x1d4fb8, streak: 0x9cc6ff, dust: 0x4d8dff,
  wire: new THREE.Color(0xd4e2ff), hetero: new THREE.Color(0x8cc8ff), pri: new THREE.Color(0x2f86ff)
};
const RAD = { H: 0.17, C: 0.28, N: 0.28, O: 0.27, F: 0.26, Cl: 0.36, Br: 0.4, I: 0.45 };

const VERT = `
attribute float aRand;
attribute vec3 color;
uniform float uT; uniform float uShift; uniform float uAlpha; uniform float uTime;
varying vec3 vColor; varying float vA;
void main(){
  float t = smoothstep(aRand * 0.45, aRand * 0.45 + 0.55, uT);
  /* 풀리는 방향은 분자 회전과 상관없이 화면의 가로 */
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float s = length(modelViewMatrix[0].xyz);
  mv.x += ((aRand - 0.5) * 22.0 * t + uShift * t) * s;
  mv.y = mix(mv.y, c.y + ((aRand - 0.5) * 2.4 - 0.4) * s, t * 0.75);
  mv.z = mix(mv.z, c.z, 0.75 * t);
  float f = 1.0 - t;
  vColor = color; vA = uAlpha * f * f * (0.35 + 0.65 * f);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
uniform vec3 uMask; varying vec3 vColor; varying float vA;
void main(){ gl_FragColor = vec4(vColor * uMask, vA); }`;

export function createScene(canvas, { low = false, reduce = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1.25 : 1.75));
  renderer.setClearColor(COL.bg, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(COL.bg, 0.05);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  camera.position.set(0, 1.1, 15);
  camera.lookAt(0, 0, 0);

  /* 육각 격자 바닥 */
  const floor = hexFloor(low ? 13 : 20, 1.25);
  floor.position.y = -3.6;
  scene.add(floor);
  /* 수평선 빛줄기 */
  const streaks = horizonStreaks(low ? 26 : 48);
  scene.add(streaks);
  /* 떠다니는 점 */
  const dust = dustField(low ? 220 : 520);
  scene.add(dust);

  const root = new THREE.Group();
  scene.add(root);
  const spin = new THREE.Group();
  root.add(spin);

  const state = { anchor: { x: -0.25, y: 0.02, scale: 1, dim: 1 }, cur: { x: -0.25, y: 0.02, scale: 1, dim: 1 }, motion: !reduce, drag: null, rotX: 0.28, rotY: 0, baseY: 0, phase: 0, vy: 0, mouse: [0, 0], live: [] };
  let W = 1, H = 1, last = performance.now(), running = true;

  function resize() {
    W = canvas.clientWidth || window.innerWidth; H = canvas.clientHeight || window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.fov = W / H < 0.8 ? 44 : 32;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  /* 화면 비율 좌표(-1..1)를 분자가 놓이는 평면(z=0)의 월드 좌표로 */
  const tmp = new THREE.Vector3();
  function anchorWorld(ax, ay) {
    tmp.set(ax, ay, 0.5).unproject(camera);
    const dir = tmp.sub(camera.position).normalize();
    const t = -camera.position.z / dir.z;
    return camera.position.clone().add(dir.multiplyScalar(t));
  }

  function makeWire(mol, res) {
    const g = embed3d(mol);
    const pri = res ? res.principalAtoms : new Set();
    const pos = [], col = [], rnd = [];
    const push = (a, b, c) => { pos.push(a[0], a[1], a[2], b[0], b[1], b[2]); col.push(c.r, c.g, c.b, c.r, c.g, c.b); rnd.push(Math.random(), Math.random()); };
    const colorOf = a => (a.heavy >= 0 && pri.has(a.heavy)) ? COL.pri : (a.el === 'C' || a.el === 'H') ? COL.wire : COL.hetero;
    /* 원자: 정이십면체 모서리 */
    const ico = { 0: edgesOf(new THREE.IcosahedronGeometry(1, 0)), 1: edgesOf(new THREE.IcosahedronGeometry(1, 1)) };
    g.atoms.forEach(a => {
      const r = RAD[a.el] || 0.34, e = ico[a.el === 'H' ? 0 : 1], c = colorOf(a);
      for (let k = 0; k < e.length; k += 6) push([a.p[0] + e[k] * r, a.p[1] + e[k + 1] * r, a.p[2] + e[k + 2] * r], [a.p[0] + e[k + 3] * r, a.p[1] + e[k + 4] * r, a.p[2] + e[k + 5] * r], c);
    });
    /* 결합: 육각기둥 선 (이중 · 삼중은 여러 가닥) */
    g.bonds.forEach(b => {
      const A = g.atoms[b.a], B = g.atoms[b.b];
      const d = sub(B.p, A.p), L = len(d), u = norm(d);
      const ra = (RAD[A.el] || 0.3) * 0.92, rb = (RAD[B.el] || 0.3) * 0.92;
      if (L <= ra + rb) return;
      const s = add(A.p, mul(u, ra)), e = add(B.p, mul(u, -rb));
      const n1 = perpTo(u, g, b), n2 = norm(cross(u, n1));
      const hot = (A.heavy >= 0 && pri.has(A.heavy)) && (B.heavy >= 0 && pri.has(B.heavy));
      const c = hot ? COL.pri : (A.el === 'H' || B.el === 'H') ? COL.wire.clone().multiplyScalar(0.7) : COL.wire;
      const strands = b.arom ? [0] : b.o === 1 ? [0] : b.o === 2 ? [-0.11, 0.11] : [-0.15, 0, 0.15];
      const rr = b.o === 1 && !b.arom ? 0.07 : 0.045;
      for (const off of strands) {
        const s2 = add(s, mul(n1, off)), e2 = add(e, mul(n1, off));
        const ring = k => { const t = Math.PI / 3 * k; return add(mul(n1, Math.cos(t) * rr), mul(n2, Math.sin(t) * rr)); };
        for (let k = 0; k < 6; k++) {
          const o = ring(k), o2 = ring(k + 1);
          push(add(s2, o), add(e2, o), c);
          push(add(s2, o), add(s2, o2), c);
          push(add(e2, o), add(e2, o2), c);
        }
      }
      if (b.arom && b.o === 2) {
        /* 벤젠 고리 안쪽 선 */
        const cen = g.atoms.filter(x => x.heavy >= 0 && x.heavy < 6).reduce((acc, x) => add(acc, x.p), [0, 0, 0]).map(x => x / 6);
        const mid = mul(add(A.p, B.p), 0.5), inw = norm(sub(cen, mid));
        push(add(add(s, mul(inw, 0.22)), mul(u, 0.12)), add(add(e, mul(inw, 0.22)), mul(u, -0.12)), c);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('aRand', new THREE.Float32BufferAttribute(rnd, 1));
    const group = new THREE.Group();
    const passes = [[1, 0, 0, -0.35], [0, 1, 0, 0], [0, 0, 1, 0.35]].map(([r, gg, bb, sh]) => {
      const m = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uT: { value: 1 }, uShift: { value: sh }, uAlpha: { value: 1 }, uTime: { value: 0 }, uMask: { value: new THREE.Vector3(r, gg, bb) } }
      });
      const ls = new THREE.LineSegments(geo, m);
      ls.frustumCulled = false;
      group.add(ls);
      return m;
    });
    /* 헤테로 원자 글자 */
    g.atoms.forEach(a => {
      if (a.el === 'C' || a.el === 'H') return;
      const sp = new THREE.Sprite(letterMat(a.el, a.heavy >= 0 && pri.has(a.heavy)));
      sp.position.set(a.p[0], a.p[1], a.p[2]);
      sp.scale.set(0.42, 0.42, 1);
      sp.renderOrder = 2;
      group.add(sp);
    });
    let radius = 0;
    g.atoms.forEach(a => { radius = Math.max(radius, len(a.p)); });
    return { group, passes, radius: radius + 0.6, t: 1, target: 0, speed: 1 };
  }

  function setMolecule(mol, res, { instant = false } = {}) {
    for (const w of state.live) { w.target = 1; w.speed = 1.6; }
    const w = makeWire(mol, res);
    w.t = instant || reduce ? 0 : 1; w.target = 0; w.delay = instant || reduce || !state.live.length ? 0 : 0.28; w.speed = 1.15;
    state.live.push(w);
    spin.add(w.group);
    state.fit = 4.3 / Math.max(3.2, w.radius);
  }

  function setAnchor(a) { Object.assign(state.anchor, a); }
  function setMotion(on) { state.motion = on && !reduce; }

  /* 끌어서 돌리기 (3D 보기에서만 캔버스가 이벤트를 받는다) */
  canvas.addEventListener('pointerdown', e => { state.drag = { x: e.clientX, y: e.clientY, rx: state.rotX, ry: state.rotY }; canvas.setPointerCapture(e.pointerId); });
  const release = () => { if (state.drag) { state.baseY = state.rotY - Math.sin(state.phase) * 0.85; } };
  canvas.addEventListener('pointermove', e => {
    if (!state.drag) return;
    state.rotY = state.drag.ry + (e.clientX - state.drag.x) * 0.008;
    state.rotX = Math.max(-1.2, Math.min(1.2, state.drag.rx + (e.clientY - state.drag.y) * 0.006));
  });
  const up = () => { release(); state.drag = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  window.addEventListener('pointermove', e => { state.mouse = [e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5]; }, { passive: true });

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const k = 1 - Math.pow(0.001, dt);
    const c = state.cur, a = state.anchor;
    c.x += (a.x - c.x) * k * 0.9; c.y += (a.y - c.y) * k * 0.9; c.scale += (a.scale - c.scale) * k; c.dim += (a.dim - c.dim) * k;
    const wp = anchorWorld(c.x, c.y);
    root.position.copy(wp);
    const s = (state.fit || 1) * c.scale;
    root.scale.setScalar(s);
    /* 평면 분자가 옆으로 누워 선 하나로 보이지 않도록 한 바퀴 돌리지 않고 좌우로 흔든다 */
    if (state.motion && !state.drag) { state.phase += dt * 0.32; state.rotY = state.baseY + Math.sin(state.phase) * 0.85; }
    const tx = state.motion ? state.mouse[1] * 0.12 : 0, ty = state.motion ? state.mouse[0] * 0.18 : 0;
    spin.rotation.x += (state.rotX + tx - spin.rotation.x) * k;
    spin.rotation.y += (state.rotY + ty - spin.rotation.y) * k;
    /* 분자 전환 */
    state.live = state.live.filter(w => {
      if (w.delay > 0) { w.delay -= dt; }
      else w.t += Math.sign(w.target - w.t) * Math.min(Math.abs(w.target - w.t), dt * w.speed);
      for (const m of w.passes) { m.uniforms.uT.value = w.t; m.uniforms.uAlpha.value = c.dim; }
      w.group.children.forEach(ch => { if (ch.isSprite) ch.material.opacity = Math.pow(1 - w.t, 3) * c.dim; });
      if (w.target === 1 && w.t >= 1) { spin.remove(w.group); w.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); return false; }
      return true;
    });
    /* 배경 움직임 */
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
  return { setMolecule, setAnchor, setMotion, resize, canvas };
}

/* ── 배경 조각 ──────────────────────────────────── */
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
  const mat = new THREE.LineBasicMaterial({ color: COL.floor, transparent: true, opacity: 0.42, fog: true });
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
    const tex = new THREE.CanvasTexture(c);
    letterCache[k] = tex;
  }
  return new THREE.SpriteMaterial({ map: letterCache[k], transparent: true, depthWrite: false, depthTest: false });
}
function edgesOf(geo) { const e = new THREE.EdgesGeometry(geo, 1); return Array.from(e.attributes.position.array); }

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/* 다중결합 가닥을 벌릴 방향: 이웃 원자가 있는 평면 안 */
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
