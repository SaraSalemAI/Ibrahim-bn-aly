// ELIZA — The Machine That Listened
// Deterministic 3D motion-graphics renderer. window.renderAt(t) draws the frame at time t (seconds).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

const W = 1920, H = 1080;
const TL = await (await fetch('./timeline.json')).json();
await Promise.all(['400 40px Inter', '500 40px Inter', '600 40px Inter', '700 40px Inter', '800 40px Inter',
  '700 40px "DejaVu Sans Mono"', '400 40px "DejaVu Sans"'].map(f => document.fonts.load(f)));
const FONT = await new Promise(r => new FontLoader().load('./node_modules/three/examples/fonts/helvetiker_bold.typeface.json', r));
const photoTex = await new THREE.TextureLoader().loadAsync('./assets/sara.png');
photoTex.colorSpace = THREE.SRGBColorSpace;

// ---------- math helpers ----------
const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ss = (a, b, x) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const eio = x => { x = cl(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const eout = x => 1 - Math.pow(1 - cl(x), 3);
const eob = x => { x = cl(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const lerp = (a, b, t) => a + (b - a) * t;
const fadeIO = (t, a, b, d = .6) => Math.min(ss(a, a + d, t), 1 - ss(b - d, b, t));
let seed = 12345;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const glow = (hex, k = 3) => new THREE.Color(hex).multiplyScalar(k);
const COL = { cyan: 0x3de8ff, violet: 0x8b5cf6, green: 0x5dff9d, amber: 0xffb547, pink: 0xff5fa2, white: 0xffffff };
const HEX = { cyan: '#3de8ff', violet: '#a78bfa', green: '#5dff9d', amber: '#ffb547', pink: '#ff6fae' };

// ---------- renderer ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.NoToneMapping;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x03050d);
scene.fog = new THREE.FogExp2(0x03050d, 0.018);
const camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 400);
scene.add(camera);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.7, 0.5, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- shared assets ----------
const dotTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t;
})();
function points(n, fn, { size = .08, color = 0xffffff, k = 1, opacity = 1, additive = true } = {}) {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const p = fn(i, c);
    pos.set([p[0], p[1], p[2]], i * 3);
    const cc = p[3] ?? new THREE.Color(color).multiplyScalar(k);
    col.set([cc.r, cc.g, cc.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size, map: dotTex, vertexColors: true, transparent: true, opacity, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true });
  const pts = new THREE.Points(g, m); pts.userData.base = pos.slice(); return pts;
}
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .45, metalness: .3, ...o });
const basic = (color, o = {}) => new THREE.MeshBasicMaterial({ color, ...o });
const emis = (hex, k = 3, o = {}) => new THREE.MeshBasicMaterial({ color: glow(hex, k), toneMapped: false, ...o });
function setOpacity(obj, a) {
  obj.visible = a > .002;
  obj.traverse(o => {
    if (!o.material) return;
    for (const m of [].concat(o.material)) {
      if (m.userData.baseOpacity === undefined) m.userData.baseOpacity = m.opacity;
      m.transparent = true; m.opacity = m.userData.baseOpacity * a;
    }
  });
}

// ---------- 2D canvas drawing helpers ----------
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }
function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const w of para.split(' ')) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
    }
    out.push(line);
  }
  return out;
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function glassBox(ctx, w, h, acc, r = 30) {
  rr(ctx, 8, 8, w - 16, h - 16, r);
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, 'rgba(22,34,68,0.90)'); g.addColorStop(1, 'rgba(7,12,30,0.90)');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = hexA(acc, .75); ctx.stroke();
  // top sheen
  ctx.save(); ctx.clip();
  const s = ctx.createLinearGradient(0, 0, 0, h * .5);
  s.addColorStop(0, 'rgba(255,255,255,.08)'); s.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = s; ctx.fillRect(0, 0, w, h * .5); ctx.restore();
}
// generic info card: {kicker,title,body,accent,ts,bs,center,mono}
function drawCard(ctx, w, h, o) {
  const acc = o.accent || HEX.cyan;
  glassBox(ctx, w, h, acc);
  const pad = o.pad ?? 56; let y = pad + 6;
  ctx.textBaseline = 'top'; ctx.textAlign = o.center ? 'center' : 'left';
  const x = o.center ? w / 2 : pad + 18;
  if (!o.center) { ctx.fillStyle = acc; rr(ctx, 30, pad, 8, h - pad * 2, 4); ctx.fill(); }
  if (o.kicker) {
    ctx.font = `700 ${o.ks || 32}px Inter`; ctx.letterSpacing = '5px'; ctx.fillStyle = acc;
    ctx.fillText(o.kicker.toUpperCase(), x, y); y += (o.ks || 32) * 1.8; ctx.letterSpacing = '0px';
  }
  if (o.title) {
    const ts = o.ts || 78; ctx.font = `800 ${ts}px Inter`; ctx.fillStyle = '#ffffff';
    for (const l of wrap(ctx, o.title, w - pad * 2 - 30)) { ctx.fillText(l, x, y); y += ts * 1.18; }
    y += ts * .3;
  }
  if (o.body) {
    const bs = o.bs || 46; ctx.font = o.mono ? `700 ${bs}px "DejaVu Sans Mono"` : `500 ${bs}px Inter, "DejaVu Sans"`;
    ctx.fillStyle = 'rgba(214,226,255,.88)';
    for (const l of wrap(ctx, o.body, w - pad * 2 - 30)) { ctx.fillText(l, x, y); y += bs * 1.42; }
  }
  if (o.measure) return y + pad + (o.foot ? 50 : 0);
  if (o.foot) {
    ctx.font = `600 24px Inter`; ctx.fillStyle = hexA(acc, .8); ctx.letterSpacing = '3px';
    ctx.fillText(o.foot.toUpperCase(), x, h - pad - 18); ctx.letterSpacing = '0px';
  }
}

// a plane mesh whose texture is a canvas; redraw(key, ...args) only repaints on change
function panel(wpx, hpx, worldW, draw, { hud = false, side = THREE.DoubleSide } = {}) {
  const cv = document.createElement('canvas'); cv.width = wpx; cv.height = hpx;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side, toneMapped: false,
    depthTest: !hud, fog: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(worldW, worldW * hpx / wpx), mat);
  if (hud) m.renderOrder = 20;
  let key = null;
  m.redraw = (k, ...a) => { if (k === key) return; key = k; ctx.clearRect(0, 0, wpx, hpx); draw(ctx, wpx, hpx, ...a); tex.needsUpdate = true; };
  return m;
}
const _mc = document.createElement('canvas').getContext('2d');
const cardPanel = (o, wpx = 1100, hpx = 560, worldW = 2.9, opt) => { hpx = Math.ceil(drawCard(_mc, wpx, 4000, { ...o, measure: true }) + 10); const p = panel(wpx, hpx, worldW, (c, w, h) => drawCard(c, w, h, o), opt); p.redraw('init'); return p; };

// ---------- global environment ----------
const env = new THREE.Group(); scene.add(env);
seed = 99;
const stars = points(5000, () => {
  const r = 90 + rnd() * 120, th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1);
  const c = new THREE.Color().setHSL(.55 + rnd() * .2, .6, .7).multiplyScalar(.6 + rnd() * 1.4);
  return [r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * .6 + 10, r * Math.sin(ph) * Math.sin(th), c];
}, { size: .9 });
env.add(stars);
const dust = points(900, () => {
  const c = new THREE.Color(rnd() < .5 ? COL.cyan : COL.violet).multiplyScalar(.5 + rnd());
  return [(rnd() - .5) * 60, (rnd() - .5) * 26, (rnd() - .5) * 60, c];
}, { size: .07, opacity: .8 });
env.add(dust);
const grid = new THREE.GridHelper(400, 200, 0x1d5f8a, 0x0f2a48);
grid.material.transparent = true; grid.material.opacity = .35; grid.position.y = -4; env.add(grid);
scene.add(new THREE.AmbientLight(0x8fa4d8, .55));
const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(6, 10, 8); scene.add(key);
const rim = new THREE.DirectionalLight(0x7a6bff, 1.0); rim.position.set(-8, 4, -6); scene.add(rim);

// ---------- scene utilities ----------
const local = (S, i, k = 'start') => S.lines[i][k] - S.start;
const appear = (S, i, lt, d = .7, off = -.1) => eout((lt - local(S, i) - off) / d);
// time-keyed camera path: keys [[t,[px,py,pz],[lx,ly,lz]], ...]
const _p = new THREE.Vector3(), _l = new THREE.Vector3();
function camPath(keys, lt, dur = 1.8) {
  let p = keys[0][1], l = keys[0][2];
  for (let i = 1; i < keys.length; i++) {
    const [t, pp, ll, d] = keys[i];
    const k = eio((lt - t) / (d ?? dur));
    if (k <= 0) break;
    p = p.map((v, j) => lerp(v, pp[j], k)); l = l.map((v, j) => lerp(v, ll[j], k));
  }
  _p.set(...p); _l.set(...l);
  // gentle handheld drift for life
  _p.x += Math.sin(lt * .31) * .08; _p.y += Math.sin(lt * .23 + 1) * .06;
  camera.position.copy(_p); camera.lookAt(_l);
}
function hudCard(scn, o, x, y, w = 2.95, size = [1100, 560]) {
  const p = cardPanel(o, size[0], size[1], w, { hud: true });
  p.geometry.computeBoundingBox(); const hh = p.geometry.boundingBox.max.y;
  p.position.set(x, y + .9 - hh, -6); p.rotation.y = x > 0 ? -.12 : x < 0 ? .12 : 0;
  scn.hud.add(p); setOpacity(p, 0); return p;
}
// show HUD card for a line window [line a start, line b start)
function showBetween(p, S, lt, a, b) {
  const t0 = local(S, a) - .2, t1 = b === undefined ? S.end - S.start : local(S, b) - .1;
  const k = fadeIO(lt, t0, t1, .55);
  setOpacity(p, k);
  p.scale.setScalar(.92 + .08 * eob(cl((lt - t0) / .7)));
  p.position.y = p.userData.y0 ?? (p.userData.y0 = p.position.y);
  p.position.y = p.userData.y0 + Math.sin(lt * .8 + p.userData.y0) * .03;
}
function newScene() { const g = new THREE.Group(), hud = new THREE.Group(); scene.add(g); camera.add(hud); return { g, hud }; }
function text3D(str, size, mat, { depth = .3, bevel = true, center = true } = {}) {
  const geo = new TextGeometry(str, { font: FONT, size, depth, curveSegments: 6, bevelEnabled: bevel,
    bevelThickness: size * .04, bevelSize: size * .025, bevelSegments: 3 });
  if (center) { geo.computeBoundingBox(); const b = geo.boundingBox; geo.translate(-(b.max.x + b.min.x) / 2, -(b.max.y + b.min.y) / 2, -depth / 2); }
  return new THREE.Mesh(geo, mat);
}

// ---------- reusable props ----------
function drawScreen(ctx, w, h, rows, cursor, header = 'ELIZA  ·  MIT PROJECT MAC  ·  IBM 7094 / CTSS') {
  const g = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w * .7);
  g.addColorStop(0, '#062414'); g.addColorStop(1, '#010703');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  ctx.font = '700 22px "DejaVu Sans Mono"'; ctx.fillStyle = 'rgba(93,255,157,.45)'; ctx.fillText(header, 40, 30);
  ctx.fillStyle = 'rgba(93,255,157,.25)'; ctx.fillRect(40, 64, w - 80, 2);
  ctx.font = '700 30px "DejaVu Sans Mono"';
  const out = [];
  for (const r of rows) {
    const pre = r.k === 'U' ? '> ' : '';
    const ls = wrap(ctx, pre + r.text, w - 90);
    ls.forEach((l, i) => out.push({ k: r.k, l, last: i === ls.length - 1 && r.typing }));
    out.push({ k: 'gap', l: '' });
  }
  const maxRows = 15; const vis = out.slice(Math.max(0, out.length - maxRows));
  let y = 92;
  ctx.shadowBlur = 14;
  for (const r of vis) {
    if (r.k !== 'gap') {
      ctx.fillStyle = r.k === 'E' ? '#7dffb2' : '#e6fff0'; ctx.shadowColor = r.k === 'E' ? '#2bff7a' : '#a8ffd0';
      ctx.fillText(r.l, 40, y);
    }
    y += r.k === 'gap' ? 14 : 40;
  }
  if (cursor) { // block cursor after last text
    const last = vis.filter(r => r.k !== 'gap').pop();
    const cx = 40 + (last ? ctx.measureText(last.l).width + 6 : 0), cy = y - 14 - 40;
    ctx.fillStyle = '#7dffb2'; ctx.fillRect(cx, Math.max(92, cy) + 2, 18, 32);
  }
  ctx.shadowBlur = 0;
  for (let yy = 0; yy < h; yy += 4) { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(0, yy, w, 2); }
  const v = ctx.createRadialGradient(w / 2, h / 2, h * .35, w / 2, h / 2, w * .75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.7)'); ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
}
function screenState(events, lt) {
  const rows = []; let typing = false;
  for (const e of events) {
    if (lt < e.t0) break;
    const k = cl((lt - e.t0) / Math.max(.01, e.t1 - e.t0));
    const n = Math.floor(e.text.length * k);
    rows.push({ k: e.k, text: e.text.slice(0, n), typing: k < 1 });
    if (k < 1) typing = true;
  }
  return { rows, typing };
}
function makeCRT() {
  const g = new THREE.Group();
  const shell = std(0xd3cab1, { roughness: .6, metalness: .05 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(4.6, 3.7, 3.4, 6, .28), shell); body.position.set(0, 0, -1.3); g.add(body);
  const back = new THREE.Mesh(new RoundedBoxGeometry(3.4, 2.7, 2.2, 4, .3), shell); back.position.set(0, 0, -3.4); g.add(back);
  const bezel = new THREE.Mesh(new RoundedBoxGeometry(4.0, 3.15, .25, 4, .14), std(0x15171c, { roughness: .35 })); bezel.position.set(0, .1, .42); g.add(bezel);
  const scr = panel(1024, 768, 3.55, drawScreen); scr.position.set(0, .1, .56); g.add(scr);
  const glare = new THREE.Mesh(new THREE.PlaneGeometry(3.55, 2.66), new THREE.MeshBasicMaterial({ color: 0x9fffd0, transparent: true, opacity: .05, blending: THREE.AdditiveBlending, depthWrite: false }));
  glare.position.set(0, .1, .58); g.add(glare);
  const badge = new THREE.Mesh(new THREE.BoxGeometry(.7, .12, .05), emis(COL.green, 2)); badge.position.set(1.5, -1.5, .32); g.add(badge);
  const kb = new THREE.Mesh(new RoundedBoxGeometry(4.6, .32, 1.7, 4, .1), shell); kb.position.set(0, -1.72, 1.55); kb.rotation.x = .1; g.add(kb);
  const keys = new THREE.InstancedMesh(new RoundedBoxGeometry(.28, .12, .28, 2, .04), std(0x3a3a40, { roughness: .7 }), 52);
  const m4 = new THREE.Matrix4(); let n = 0;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 13; c++) { m4.makeTranslation(-1.95 + c * .325 + r * .08, 0, -.5 + r * .33); keys.setMatrixAt(n++, m4); }
  keys.position.set(0, -1.5, 1.55); keys.rotation.x = .1; g.add(keys);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(16, .3, 7), std(0x2b1d14, { roughness: .5, metalness: .1 })); desk.position.set(0, -2.05, 0); g.add(desk);
  const glowL = new THREE.PointLight(0x40ff90, 6, 9, 1.6); glowL.position.set(0, .2, 2.4); g.add(glowL);
  g.screen = scr; g.keys = keys;
  return g;
}
// particle bust (head + shoulders) of a person
function makeBust(n = 7000, colA = COL.cyan, colB = COL.violet) {
  seed = 4242;
  return points(n, (i) => {
    let x, y, z; const u = rnd();
    if (u < .55) { // cranium + face
      const th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1);
      x = .78 * Math.sin(ph) * Math.cos(th); y = .98 * Math.cos(ph); z = .88 * Math.sin(ph) * Math.sin(th);
      if (y < -.2) { x *= .82 + (y + .2) * .3; z *= .9; } // jaw taper
      if (z > .55 && Math.abs(x) < .12 && y > -.35 && y < .2) z += .12; // nose
      y += 1.6;
    } else if (u < .65) { // neck
      const th = rnd() * Math.PI * 2; x = .36 * Math.cos(th); z = .36 * Math.sin(th); y = .5 + rnd() * .5;
    } else { // shoulders / chest
      const th = rnd() * Math.PI * 2, ph = rnd() * Math.PI * .5;
      x = 1.8 * Math.sin(ph) * Math.cos(th); z = .75 * Math.sin(ph) * Math.sin(th); y = .5 - 1.1 * (1 - Math.cos(ph)) - .2;
    }
    const k = cl((y + 1.2) / 3.2);
    const c = new THREE.Color(colB).lerp(new THREE.Color(colA), k).multiplyScalar(1.1 + rnd() * .9);
    return [x, y - 1, z, c];
  }, { size: .045 });
}

// ======================================================================
// SCENES
// ======================================================================
const SCENES = {};

// ---- cold open: the terminal ----
SCENES.terminal = (S) => {
  const s = newScene();
  const crt = makeCRT(); s.g.add(crt);
  const words = ['boyfriend', 'depressed', 'always', 'alike', 'unhappy', 'mother', 'feel', 'help', 'why', 'alone', 'listen', 'understand'];
  const floaters = words.map((w, i) => {
    const p = panel(512, 128, 1.6, (c, ww, hh) => {
      c.font = '700 64px "DejaVu Sans Mono"'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.shadowColor = '#2bff7a'; c.shadowBlur = 20; c.fillStyle = '#9dffc8'; c.fillText(w.toUpperCase(), ww / 2, hh / 2);
    }); p.redraw(1); s.g.add(p); setOpacity(p, 0); return p;
  });
  s.update = (lt) => {
    const st = screenState(S.screen, lt);
    crt.screen.redraw(JSON.stringify(st.rows) + (Math.floor(lt * 2.2) % 2 || st.typing), st.rows, st.typing || Math.floor(lt * 2.2) % 2 === 0);
    const t4 = local(S, 4);
    camPath([[0, [0, .1, 4.3], [0, .1, .5]],
      [t4 - 1.5, [0, .5, 8.5], [0, .1, 0], 6],
      [local(S, 6), [5.5, 2.2, 8.5], [0, .3, 0], 6],
      [local(S, 7), [-3.5, 1.4, 10.5], [0, .6, 0], 7]], lt);
    floaters.forEach((p, i) => {
      const t0 = t4 + 1 + i * 1.6, age = lt - t0;
      const k = fadeIO(age, 0, 7, 1.2);
      setOpacity(p, k * .9);
      p.position.set(Math.sin(i * 2.3) * 2.6 + Math.sin(age * .4 + i) * .3, .2 + age * .45, .8 + Math.cos(i * 1.7) * 1.5);
      p.lookAt(camera.position);
    });
  };
  return s;
};

// ---- title ----
SCENES.title = (S) => {
  const s = newScene();
  const mat = std(0xbfe9ff, { metalness: .85, roughness: .22, emissive: new THREE.Color(COL.cyan).multiplyScalar(.25) });
  const letters = 'ELIZA'.split('').map((ch, i) => { const m = text3D(ch, 2.1, mat, { depth: .6 }); m.position.x = (i - 2) * 2.05; s.g.add(m); return m; });
  letters[3].position.x -= .05; // kerning tweak
  const line = new THREE.Mesh(new THREE.BoxGeometry(10.5, .04, .04), emis(COL.cyan, 4)); line.position.y = -1.65; s.g.add(line);
  const sub = panel(2000, 260, 10, (c, w, h) => {
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '800 92px Inter'; c.letterSpacing = '22px'; c.fillStyle = '#ffffff'; c.fillText('THE MACHINE THAT LISTENED', w / 2, 90);
    c.font = '500 40px Inter'; c.letterSpacing = '6px'; c.fillStyle = '#9fd8ff';
    c.fillText('The ELIZA Effect  ·  1966 to the Future of AI', w / 2, 200);
  }); sub.redraw(1); sub.position.y = -2.55; s.g.add(sub);
  const by = panel(1400, 120, 5, (c, w, h) => {
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '600 44px Inter'; c.letterSpacing = '10px';
    c.fillStyle = '#ffb547'; c.fillText('PREPARED BY SARA SALEM', w / 2, h / 2);
  }); by.redraw(1); by.position.y = -3.55; s.g.add(by);
  seed = 7;
  const burst = points(1400, () => {
    const th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1);
    const c = new THREE.Color(rnd() < .6 ? COL.cyan : COL.violet).multiplyScalar(2 + rnd() * 2);
    return [Math.sin(ph) * Math.cos(th), Math.cos(ph) * .6, Math.sin(ph) * Math.sin(th), c];
  }, { size: .09 });
  s.g.add(burst);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(6.5, .02, 8, 200), emis(COL.violet, 3)); ring.rotation.x = Math.PI / 2.3; s.g.add(ring);
  const sweep = new THREE.PointLight(0xffffff, 60, 12, 1.5); s.g.add(sweep);
  s.update = (lt) => {
    camPath([[0, [0, .4, 19], [0, -.6, 0]], [.2, [0, .2, 13.5], [0, -.8, 0], 8]], lt);
    letters.forEach((m, i) => {
      const k = eob((lt - .1 - i * .12) / .9);
      m.position.z = lerp(-30, 0, eout((lt - .1 - i * .12) / .9));
      m.position.y = Math.sin(lt * 1.2 + i * .7) * .06;
      m.rotation.y = (1 - k) * 2.5 + Math.sin(lt * .6 + i) * .05;
      setOpacity(m, cl((lt - i * .12) / .3));
    });
    line.scale.x = eout((lt - 1.0) / 1.2) + .001;
    setOpacity(sub, ss(1.3, 2.2, lt)); sub.position.y = -2.55 - (1 - eout((lt - 1.3) / 1)) * .4;
    setOpacity(by, ss(2.4, 3.2, lt));
    const bk = (lt - .95) / 3.5;
    burst.visible = bk > 0 && bk < 1;
    burst.scale.setScalar(.5 + eout(bk) * 14); burst.material.opacity = 1 - cl(bk);
    ring.scale.setScalar(.6 + eout((lt - .9) / 2) * .6); setOpacity(ring, fadeIO(lt, .9, S.end - S.start, 1) * .8);
    ring.rotation.z = lt * .2;
    sweep.position.set(lerp(-9, 9, ss(1.2, 4.5, lt)), 1.5, 3);
  };
  return s;
};

// ---- chapter 1: biography timeline ----
SCENES.biography = (S) => {
  const s = newScene();
  const cards = [
    { kicker: '1923 · Berlin', title: 'Joseph Weizenbaum', body: 'Born in Berlin, Germany. Future MIT professor, computer pioneer, and the creator of ELIZA.', foot: '1923 – 2008' },
    { kicker: '1936 · Escape', title: 'A New Life in America', body: 'As Nazi persecution grew, his Jewish family fled Germany and settled in Detroit, Michigan.', accent: HEX.violet },
    { kicker: '1950s · General Electric', title: 'Building ERMA', body: 'After studying mathematics at Wayne State University, he helped GE build ERMA, a pioneering banking computer.', accent: HEX.amber },
    { kicker: '1963 · MIT', title: 'Joining MIT', body: 'He joins the Massachusetts Institute of Technology at the dawn of interactive computing.', accent: HEX.green },
  ];
  const X = [0, 7.5, 15, 22.5];
  const cps = cards.map((o, i) => {
    const p = cardPanel(o, 1100, 600, 4.2); p.position.set(X[i], .9, 0); s.g.add(p); setOpacity(p, 0);
    const node = new THREE.Mesh(new THREE.SphereGeometry(.18, 24, 16), emis([COL.cyan, COL.violet, COL.amber, COL.green][i], 4)); node.position.set(X[i], -1.6, 0); s.g.add(node);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, 1.2, 8), emis(COL.cyan, 2)); beam.position.set(X[i], -1.0, 0); s.g.add(beam);
    const yr = text3D(o.kicker.split(' ')[0], .75, std(0x9fdcff, { metalness: .9, roughness: .25, emissive: new THREE.Color(0x0a2a44) }), { depth: .25 });
    yr.position.set(X[i], 2.95, -.8); s.g.add(yr);
    return { p, node, beam, yr };
  });
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 1, 8), emis(COL.cyan, 3)); rail.rotation.z = Math.PI / 2; rail.position.y = -1.6; s.g.add(rail);
  // wireframe globe with Berlin -> Detroit arc
  const globe = new THREE.Group(); globe.position.set(11, .5, -14); s.g.add(globe);
  const R = 5;
  globe.add(new THREE.Mesh(new THREE.IcosahedronGeometry(R, 4), new THREE.MeshBasicMaterial({ color: 0x1a6aa0, wireframe: true, transparent: true, opacity: .28 })));
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(R * .985, 48, 32), new THREE.MeshBasicMaterial({ color: 0x041226, transparent: true, opacity: .85 })));
  const ll = (lat, lon) => { const p = lat * Math.PI / 180, l = lon * Math.PI / 180; return new THREE.Vector3(R * Math.cos(p) * Math.cos(l), R * Math.sin(p), -R * Math.cos(p) * Math.sin(l)); };
  const A = ll(52.5, 13.4), B = ll(42.3, -83.0);
  const mid = A.clone().add(B).multiplyScalar(.5).normalize().multiplyScalar(R * 1.45);
  const curve = new THREE.QuadraticBezierCurve3(A, mid, B);
  const arcGeo = new THREE.TubeGeometry(curve, 120, .06, 8, false);
  const arc = new THREE.Mesh(arcGeo, emis(COL.amber, 4)); globe.add(arc);
  const cityA = new THREE.Mesh(new THREE.SphereGeometry(.16, 16, 12), emis(COL.pink, 5)); cityA.position.copy(A); globe.add(cityA);
  const cityB = new THREE.Mesh(new THREE.SphereGeometry(.16, 16, 12), emis(COL.green, 5)); cityB.position.copy(B); globe.add(cityB);
  globe.rotation.y = -1.1;
  s.update = (lt) => {
    const idx = S.lines.map((l, i) => i).filter(i => lt >= local(S, i) - .4).pop() ?? 0;
    const keys = [[0, [-2, 1.2, 12], [0, .6, 0]]];
    for (let i = 0; i < 4; i++) keys.push([local(S, i) - .6, [X[i] + 1.4, 1.2, 8.2], [X[i] + .2, .7, 0], 1.6]);
    camPath(keys, lt);
    cps.forEach(({ p, node, beam, yr }, i) => {
      const k = appear(S, i, lt, .9, .3);
      setOpacity(p, k * (i === idx ? 1 : .55)); p.scale.setScalar(.9 + .1 * eob(k));
      node.scale.setScalar(k * (1 + .25 * Math.sin(lt * 3 + i)));
      beam.scale.y = k + .001; setOpacity(yr, k);
      yr.rotation.y = Math.sin(lt * .7 + i) * .25;
    });
    const span = 22.5 + 8;
    const rk = lerp(.12, 1, cl((lt) / (S.end - S.start - 3)));
    rail.scale.y = span * rk; rail.position.x = -4 + span * rk / 2;
    const ak = ss(local(S, 1), local(S, 1) + 4, lt);
    arcGeo.setDrawRange(0, Math.floor(arcGeo.index.count * ak / 3) * 3 + 0);
    globe.rotation.y = -1.1 + lt * .03;
    setOpacity(globe, .95);
  };
  return s;
};

// ---- chapter 2: the mainframe room ----
SCENES.mainframe = (S) => {
  const s = newScene();
  const cab = std(0x26303f, { roughness: .5, metalness: .4 });
  const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), 6 * 96);
  let li = 0; const m4 = new THREE.Matrix4();
  const reels = [];
  const reelTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#20252e'; x.beginPath(); x.arc(128, 128, 126, 0, 7); x.fill();
    x.fillStyle = '#5b3a1a'; x.beginPath(); x.arc(128, 128, 110, 0, 7); x.fill();
    x.fillStyle = '#c9d2df'; x.beginPath(); x.arc(128, 128, 48, 0, 7); x.fill();
    x.fillStyle = '#20252e'; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; x.beginPath(); x.arc(128 + Math.cos(a) * 80, 128 + Math.sin(a) * 80, 17, 0, 7); x.fill(); }
    x.beginPath(); x.arc(128, 128, 14, 0, 7); x.fill(); x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 2; for (let r = 60; r < 110; r += 7) { x.beginPath(); x.arc(128, 128, r, 0, 7); x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  for (let i = 0; i < 8; i++) {
    const x = -14 + i * 4;
    const b = new THREE.Mesh(new RoundedBoxGeometry(3.2, 5.2, 1.6, 3, .08), cab); b.position.set(x, -1.4, -3); s.g.add(b);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(3.0, .06, .02), emis(COL.cyan, 2)); strip.position.set(x, 1.05, -2.18); s.g.add(strip);
    if (i % 2 === 0) { // tape drive
      for (const yy of [.2, -1.3]) {
        const r = new THREE.Mesh(new THREE.CircleGeometry(.62, 48), new THREE.MeshStandardMaterial({ map: reelTex, roughness: .5 }));
        r.position.set(x, yy, -2.17); s.g.add(r); reels.push(r);
      }
      const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.4), new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: .06 }));
      win.position.set(x, -.55, -2.15); s.g.add(win);
    } else { // console of lamps
      for (let r = 0; r < 8; r++) for (let c = 0; c < 12; c++) { m4.makeTranslation(x - 1.2 + c * .22, .5 - r * .25, -2.17); lamps.setMatrixAt(li++, m4); }
    }
  }
  lamps.count = li; s.g.add(lamps);
  // teletype terminal in front
  const tty = new THREE.Group(); tty.position.set(10, -3.2, -.5); s.g.add(tty);
  tty.add(new THREE.Mesh(new RoundedBoxGeometry(2.2, 1.0, 1.6, 3, .1), std(0x8c9bb0)));
  const paper = panel(512, 640, 1.4, (c, w, h) => {
    c.fillStyle = '#f1ecd9'; c.fillRect(0, 0, w, h);
    c.font = '700 26px "DejaVu Sans Mono"'; c.fillStyle = '#1e2430';
    ['HOW DO YOU DO.', 'PLEASE TELL ME', 'YOUR PROBLEM.', '', 'I need some help.', '', 'WHAT WOULD IT MEAN', 'TO YOU IF YOU GOT', 'SOME HELP?'].forEach((l, i) => c.fillText(l, 30, 60 + i * 46));
  }); paper.redraw(1); paper.position.set(0, 1.25, -.4); paper.rotation.x = -.15; tty.add(paper);
  const room = new THREE.PointLight(0x66aaff, 30, 30, 1.5); room.position.set(0, 4, 4); s.g.add(room);
  // HUD cards
  const c0 = hudCard(s, { kicker: 'MIT · Project MAC', title: 'Time-sharing (CTSS)', body: 'Many users share one computer and converse with it in real time through typewriter terminals.' }, 1.9, .6);
  const c1 = hudCard(s, { kicker: '1964 – 1966', title: 'IBM 7094 + MAD-SLIP', body: 'Weizenbaum writes ELIZA using SLIP, the list-processing language he created himself.', accent: HEX.violet }, 1.9, .6);
  const c2 = hudCard(s, { kicker: 'The Name', title: 'Eliza Doolittle', body: 'The flower girl in George Bernard Shaw\'s Pygmalion (1913), taught to speak like a lady. Polish mistaken for depth.', accent: HEX.pink }, -1.9, .5);
  const journal = panel(900, 1160, 2.2, (c, w, h) => {
    c.fillStyle = '#f3efe4'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#8a1c1c'; c.fillRect(0, 0, w, 210);
    c.fillStyle = '#fff'; c.font = '800 46px Inter'; c.textAlign = 'center';
    c.fillText('COMMUNICATIONS', w / 2, 90); c.font = '600 34px Inter'; c.fillText('OF THE ACM', w / 2, 150);
    c.fillStyle = '#333'; c.font = '600 28px Inter'; c.fillText('Volume 9 · Number 1 · January 1966', w / 2, 270);
    c.fillStyle = '#111'; c.font = '800 70px Inter'; c.fillText('ELIZA', w / 2, 420);
    c.font = '500 34px Inter';
    ['A Computer Program For the', 'Study of Natural Language', 'Communication Between', 'Man and Machine'].forEach((l, i) => c.fillText(l, w / 2, 500 + i * 50));
    c.font = 'italic 600 34px Inter'; c.fillStyle = '#8a1c1c'; c.fillText('Joseph Weizenbaum', w / 2, 760);
    c.fillStyle = '#c9c1ad'; for (let i = 0; i < 7; i++) c.fillRect(110, 840 + i * 40, w - 220, 12);
  }, { hud: true }); journal.redraw(1); journal.position.set(-1.6, .1, -6); journal.rotation.y = .25; s.hud.add(journal); setOpacity(journal, 0);
  const c3 = hudCard(s, { kicker: 'Published', title: 'ELIZA goes public', body: 'Communications of the ACM, January 1966.', accent: HEX.amber }, 1.7, .2, 2.4, [1100, 460]);
  const spot = new THREE.SpotLight(0xffe0b0, 0, 30, .35, .5, 1); spot.position.set(-2, 8, 6); spot.target.position.set(-2, -1, -2); s.g.add(spot, spot.target);
  s.update = (lt) => {
    camPath([[0, [-12, 1.5, 9], [-8, -.5, -3]],
      [.3, [-4, 1, 9], [-2, -.6, -3], 10],
      [local(S, 1) - .5, [-2, -.2, 6], [1, -1, -3], 4],
      [local(S, 2) - .5, [4, 1.5, 8], [5, -1, -3], 4],
      [local(S, 3) - .5, [8, .5, 6], [6, -1.6, 0], 4]], lt);
    showBetween(c0, S, lt, 0, 1); showBetween(c1, S, lt, 1, 2); showBetween(c2, S, lt, 2, 3);
    showBetween(c3, S, lt, 3); showBetween(journal, S, lt, 3);
    reels.forEach((r, i) => { r.rotation.z = -lt * (i % 2 ? 1.7 : 2.3) * (Math.floor(lt / 3 + i) % 3 === 0 ? .2 : 1); });
    const c = new THREE.Color(); const f = Math.floor(lt * 6);
    for (let i = 0; i < li; i++) {
      const on = hash(i * 13.7 + f * 1.31) > .55;
      c.set(on ? (hash(i) > .8 ? COL.amber : hash(i) > .4 ? 0xff5050 : COL.green) : 0x202830).multiplyScalar(on ? 3 : 1);
      lamps.setColorAt(i, c);
    }
    lamps.instanceColor.needsUpdate = true;
    spot.intensity = 200 * fadeIO(lt, local(S, 2), local(S, 3), .8);
  };
  return s;
};

// ---- chapter 3: the DOCTOR conversation ----
function drawBubble(ctx, w, h, k, text) {
  const E = k === 'E';
  rr(ctx, 10, 10, w - 20, h - 40, 34);
  if (E) { ctx.fillStyle = 'rgba(2,20,10,.92)'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#5dff9d'; ctx.stroke(); }
  else { const g = ctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#6d3ff0'); g.addColorStop(1, '#9b6bff'); ctx.fillStyle = g; ctx.fill(); }
  ctx.beginPath(); // tail
  if (E) { ctx.moveTo(w - 90, h - 32); ctx.lineTo(w - 40, h - 4); ctx.lineTo(w - 130, h - 32); ctx.fillStyle = '#5dff9d'; }
  else { ctx.moveTo(90, h - 32); ctx.lineTo(40, h - 4); ctx.lineTo(130, h - 32); ctx.fillStyle = '#7a4bf5'; }
  ctx.fill();
  ctx.font = E ? '700 52px "DejaVu Sans Mono"' : '600 58px Inter';
  ctx.fillStyle = E ? '#9dffc8' : '#fff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const ls = wrap(ctx, text, w - 110);
  ls.forEach((l, i) => ctx.fillText(l, 52, (h - 30) / 2 + 14 + (i - (ls.length - 1) / 2) * 64));
  ctx.font = '800 20px Inter'; ctx.letterSpacing = '4px'; ctx.fillStyle = E ? '#5dff9d' : 'rgba(255,255,255,.75)';
  ctx.textBaseline = 'top'; ctx.fillText(E ? 'ELIZA' : 'PATIENT', 52, 24); ctx.letterSpacing = '0px';
}
SCENES.chat = (S) => {
  const s = newScene();
  const dlg = S.lines.map((l, i) => ({ ...l, i })).filter(l => l.s !== 'N');
  const bubbles = dlg.map((l, j) => {
    const p = panel(1300, 300, 4.8, drawBubble); s.g.add(p);
    p.position.set(l.s === 'E' ? 1.4 : -1.4, -j * 1.25, (j % 2) * .3);
    setOpacity(p, 0); return { p, l };
  });
  // the hidden machinery: a lattice of rule cards
  const rules = [];
  const ruleTexts = ['MY → YOUR', 'I AM → YOU ARE', '(0) I AM (1)', 'HOW LONG HAVE YOU BEEN (1)?', 'MOTHER → FAMILY', 'ALWAYS → SPECIFIC EXAMPLE', 'PLEASE GO ON.', 'WHY DO YOU SAY (1)?', 'YOU → I', 'DREAM → WHAT DOES IT SUGGEST'];
  seed = 31;
  for (let i = 0; i < 26; i++) {
    const t = ruleTexts[i % ruleTexts.length];
    const p = panel(640, 120, 2.4, (c, w, h) => {
      rr(c, 4, 4, w - 8, h - 8, 16); c.fillStyle = 'rgba(4,30,16,.85)'; c.fill(); c.strokeStyle = '#2bff7a'; c.lineWidth = 3; c.stroke();
      c.font = '700 34px "DejaVu Sans Mono"'; c.fillStyle = '#7dffb2'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, w / 2, h / 2);
    }); p.redraw(1);
    p.position.set((rnd() - .5) * 16, 2 - rnd() * 11, -4 - rnd() * 6); s.g.add(p); setOpacity(p, 0); rules.push(p);
  }
  const brain = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 2), new THREE.MeshBasicMaterial({ color: glow(COL.violet, 1.6), wireframe: true, transparent: true, opacity: .35, toneMapped: false }));
  brain.position.set(5.5, 1, -6); s.g.add(brain);
  const c0 = hudCard(s, { kicker: 'The DOCTOR Script', title: 'Rogerian Therapy', body: 'Pioneered by psychologist Carl Rogers: reflect the client\'s own words back to them, without judgment.' }, 1.9, .55);
  const c1 = hudCard(s, { kicker: 'The Perfect Disguise', title: 'Know nothing. Seem wise.', body: 'A Rogerian therapist can ask about anything without needing to know anything about the world.', accent: HEX.violet }, 1.9, .55);
  const c8 = hudCard(s, { kicker: 'Behind the curtain', title: 'Just rules', body: 'Every “empathetic” reply came from a keyword and a template.', accent: HEX.green }, 1.9, .9, 2.5, [1100, 470]);
  s.update = (lt) => {
    const last = bubbles.filter(b => lt >= local(S, b.l.i) - .2).length - 1;
    const yFocus = last < 0 ? 1 : -Math.max(0, last - 1.2) * 1.25;
    const yc = lt < local(S, 2) ? 1.2 : yFocus;
    camPath([[0, [-3, 3.5, 11], [0, 0, -2]], [local(S, 2) - .8, [-1.5, .5, 8.5], [0, -1, 0], 2]], lt);
    camera.position.y += (yc - .5) * ss(local(S, 2) - .8, local(S, 2) + 1, lt);
    camera.lookAt(_l.x, _l.y + (yc - .5) * ss(local(S, 2) - .8, local(S, 2) + 1, lt) - .5, _l.z);
    bubbles.forEach(({ p, l }, j) => {
      const t0 = local(S, l.i), d = l.end - l.start;
      const k = eob(cl((lt - t0 + .15) / .5));
      const n = Math.ceil(l.t.length * cl((lt - t0 + .1) / (d * .85)));
      const txt = (l.s === 'E' ? l.t.toUpperCase() : l.t).slice(0, n);
      p.redraw(txt, l.s, txt);
      const dim = 1 - .6 * ss(local(S, 8), local(S, 8) + 1.5, lt);
      setOpacity(p, cl(k) * dim); p.scale.setScalar(.6 + .4 * k);
    });
    const rk = ss(local(S, 8) - .3, local(S, 8) + 2, lt);
    rules.forEach((p, i) => { setOpacity(p, rk * (.5 + .5 * hash(i))); p.position.z += Math.sin(lt + i) * .002; });
    brain.rotation.set(lt * .1, lt * .17, 0);
    showBetween(c0, S, lt, 0, 1); showBetween(c1, S, lt, 1, 2); showBetween(c8, S, lt, 8);
  };
  return s;
};

// ---- chapter 4: how ELIZA worked (pipeline) ----
SCENES.pipeline = (S) => {
  const s = newScene();
  const names = [['1', 'KEYWORD'], ['2', 'DECOMPOSE'], ['3', 'SWAP PRONOUNS'], ['4', 'REASSEMBLE']];
  const accents = [COL.cyan, COL.violet, COL.amber, COL.green], ah = [HEX.cyan, HEX.violet, HEX.amber, HEX.green];
  const X = [-6.3, -2.1, 2.1, 6.3];
  const nodes = names.map(([n, name], i) => {
    const g = new THREE.Group(); g.position.set(X[i], 0, 0); s.g.add(g);
    const box = new THREE.Mesh(new RoundedBoxGeometry(3.3, 2.0, .7, 4, .2), std(0x0c1426, { metalness: .6, roughness: .3, emissive: new THREE.Color(accents[i]), emissiveIntensity: .05 }));
    g.add(box);
    const lab = panel(800, 480, 3.0, (c, w, h, on) => {
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = '800 150px Inter'; c.fillStyle = on ? ah[i] : hexA(ah[i], .5); c.shadowColor = ah[i]; c.shadowBlur = on ? 40 : 0;
      c.fillText(n, w / 2, 170); c.shadowBlur = 0;
      c.font = '800 64px Inter'; c.letterSpacing = '6px'; c.fillStyle = on ? '#fff' : 'rgba(255,255,255,.6)';
      c.fillText(name, w / 2, 350);
    }); lab.position.z = .37; g.add(lab);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.75, .03, 8, 80), emis(accents[i], 4)); ring.scale.y = .62; g.add(ring);
    return { g, box, lab, ring };
  });
  for (let i = 0; i < 3; i++) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 0.9, 8), emis(COL.cyan, 2.5)); tube.rotation.z = Math.PI / 2; tube.position.set((X[i] + X[i + 1]) / 2, 0, 0); s.g.add(tube);
  }
  // input & output
  const io = (txt, k) => panel(1200, 220, 4.4, (c, w, h, t) => {
    glassBox(c, w, h, k === 'in' ? HEX.violet : HEX.green, 40);
    c.font = k === 'in' ? '700 64px Inter' : '700 50px "DejaVu Sans Mono"'; c.fillStyle = k === 'in' ? '#fff' : '#9dffc8';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, w / 2, h / 2 + 6);
  });
  const inP = io('', 'in'); inP.position.set(-4.2, -2.6, .5); inP.redraw(1, '“I am unhappy.”'); s.g.add(inP);
  const outP = io('', 'out'); outP.position.set(4.2, -2.6, .5); s.g.add(outP);
  const token = new THREE.Mesh(new THREE.SphereGeometry(.12, 20, 14), emis(COL.white, 2.5)); s.g.add(token);
  seed = 5;
  const flow = points(500, () => [(rnd() - .5) * 13, (rnd() - .5) * .25, (rnd() - .5) * .25], { size: .06, color: COL.cyan, k: 2.5 }); s.g.add(flow);
  const det = [
    { kicker: 'Step 1', title: 'Find the keyword', body: 'Input:  “I am unhappy.”\nRanked keywords:  MOTHER · ALWAYS · I AM · YOU …\nMatch  →  I AM', accent: HEX.cyan },
    { kicker: 'Step 2', title: 'Decompose by pattern', body: 'Pattern:  (0)  I AM  (1)\nSlot (1)  =  “unhappy”', accent: HEX.violet, mono: false },
    { kicker: 'Step 3', title: 'Swap the pronouns', body: 'I → YOU      MY → YOUR\nME → YOU     AM → ARE', accent: HEX.amber },
    { kicker: 'Step 4', title: 'Reassemble a template', body: 'Template:  HOW LONG HAVE YOU BEEN (1)?\nOutput:  HOW LONG HAVE YOU BEEN UNHAPPY?', accent: HEX.green },
  ].map((o, i) => { const p = cardPanel(o, 1300, 600, 4.6); p.position.set(X[i], 2.85, .3); s.g.add(p); setOpacity(p, 0); return p; });
  const fb = cardPanel({ kicker: 'No keyword?', title: 'Fallbacks & memory', body: 'PLEASE GO ON.   ·   TELL ME MORE.\nMemory:  DOES THAT HAVE ANYTHING TO DO WITH THE FACT THAT YOUR BOYFRIEND MADE YOU COME HERE?', accent: HEX.pink }, 1500, 620, 6.4);
  fb.position.set(0, 3.4, 1.2); s.g.add(fb); setOpacity(fb, 0);
  const big = document.getElementById('big');
  s.update = (lt) => {
    const keys = [[0, [0, 1.5, 19], [0, .6, 0]]];
    for (let i = 0; i < 4; i++) keys.push([local(S, i + 1) - .6, [X[i] * .9, 2.0, 10.5], [X[i], 1.25, 0], 1.5]);
    keys.push([local(S, 5) - .6, [0, 2.5, 13], [0, 1.6, 0], 2]);
    keys.push([local(S, 6) - .6, [0, 6.5, 21], [0, 2.8, 0], 3]);
    camPath(keys, lt);
    let active = -1; for (let i = 0; i < 4; i++) if (lt >= local(S, i + 1) - .3 && lt < local(S, 5) - .3) active = i;
    nodes.forEach((n, i) => {
      const on = i === active || (i < active);
      n.lab.redraw(String(i === active) + on, on || i === active);
      n.box.material.emissiveIntensity = i === active ? .35 + .1 * Math.sin(lt * 6) : on ? .12 : .04;
      n.ring.visible = i === active; n.ring.rotation.z = lt;
      n.g.position.y = i === active ? .15 * eout((lt - local(S, i + 1)) / .5) : 0;
    });
    det.forEach((p, i) => showBetween(p, S, lt, i + 1, i + 2));
    showBetween(fb, S, lt, 5, 6);
    setOpacity(outP, ss(local(S, 4) + 2, local(S, 4) + 3, lt));
    outP.redraw(1, 'HOW LONG HAVE YOU BEEN UNHAPPY?');
    // token travels input -> nodes -> output
    const tx = active < 0 ? (lt < local(S, 1) ? -9 : 9) : lerp(X[Math.max(0, active - 1)] , X[active], eio((lt - local(S, active + 1)) / 1.2));
    token.position.set(active < 0 && lt > local(S, 5) ? 6.3 : tx, -1.25, .6);
    token.visible = lt > local(S, 1) - .3 && lt < local(S, 5);
    const pos = flow.geometry.attributes.position, b = flow.userData.base;
    for (let i = 0; i < pos.count; i++) pos.setX(i, ((b[i * 3] + lt * 2.2 + 6.5) % 13) - 6.5);
    pos.needsUpdate = true;
    big.innerHTML = 'No understanding. <span class="hl">Just patterns.</span>';
    big.style.opacity = fadeIO(lt, local(S, 6) + .4, S.end - S.start - .2, .6);
  };
  s.leave = () => { big.style.opacity = 0; };
  return s;
};

// ---- chapter 5: the secretary ----
SCENES.secretary = (S) => {
  const s = newScene();
  const crt = makeCRT(); crt.scale.setScalar(.8); s.g.add(crt);
  // chair
  const chairM = std(0x2a2f3a, { roughness: .7 });
  const chair = new THREE.Group(); chair.position.set(0, -2.9, 5.2); s.g.add(chair);
  chair.add(new THREE.Mesh(new RoundedBoxGeometry(2, .3, 2, 3, .1), chairM));
  const cb = new THREE.Mesh(new RoundedBoxGeometry(2, 2.4, .3, 3, .1), chairM); cb.position.set(0, 1.2, .9); cb.rotation.x = -.1; chair.add(cb);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 1.2), chairM); leg.position.y = -.7; chair.add(leg);
  // door with light behind
  const door = new THREE.Group(); door.position.set(-7, -1, -4); s.g.add(door);
  const frameM = std(0x3a3f4a);
  for (const [x, y, w, h] of [[-1.2, 0, .2, 6], [1.2, 0, .2, 6], [0, 3, 2.6, .2]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, .4), frameM); f.position.set(x, y, 0); door.add(f); }
  const lightPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 5.8), emis(0xffd9a0, 2.2)); lightPlane.position.set(0, 0, -.1); door.add(lightPlane);
  const leafPivot = new THREE.Group(); leafPivot.position.set(-1.1, 0, 0); door.add(leafPivot);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(2.2, 5.8, .12), std(0x5a4636, { roughness: .6 })); leaf.position.set(1.1, 0, 0); leafPivot.add(leaf);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 14), std(0x0d1220, { roughness: .9 })); wall.position.set(0, 1, -4.25); s.g.add(wall);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(3.2, 9, 48, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: .07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  cone.position.set(0, 3.5, .5); s.g.add(cone);
  const spot = new THREE.SpotLight(0xffe2b0, 55, 20, .5, .6, 1); spot.position.set(0, 8, .5); spot.target.position.set(0, -2, .5); s.g.add(spot, spot.target);
  const doorLight = new THREE.PointLight(0xffc880, 0, 18, 1.2); doorLight.position.set(-7, 0, -2); s.g.add(doorLight);
  const c1 = hudCard(s, { kicker: 'She knew', title: 'It was just a program.', body: 'She had watched Weizenbaum build ELIZA for months.', accent: HEX.amber }, 1.9, .7, 2.5, [1100, 470]);
  const c2 = hudCard(s, { kicker: 'The request', title: '“Please leave the room.”', body: 'After only a few exchanges, she wanted to be alone with the machine.', accent: HEX.pink }, 1.9, .7, 2.5, [1100, 500]);
  const c3 = hudCard(s, { kicker: 'Others followed', title: '“Is this private?”', body: 'Users worried about privacy. Psychiatrists imagined automated therapy.', accent: HEX.violet }, 1.9, .7, 2.5, [1100, 500]);
  const quote = panel(1700, 760, 6.4, (c, w, h) => {
    glassBox(c, w, h, HEX.cyan, 36);
    c.font = '800 220px Inter'; c.fillStyle = hexA(HEX.cyan, .5); c.textBaseline = 'top'; c.fillText('“', 50, 10);
    c.font = 'italic 600 54px Inter'; c.fillStyle = '#fff';
    wrap(c, 'What I had not realized is that extremely short exposures to a relatively simple computer program could induce powerful delusional thinking in quite normal people.', w - 260)
      .forEach((l, i) => c.fillText(l, 150, 120 + i * 76));
    c.font = '700 32px Inter'; c.fillStyle = HEX.cyan; c.letterSpacing = '4px';
    c.fillText('— JOSEPH WEIZENBAUM, 1976', 150, h - 110); c.letterSpacing = '0px';
  }, { hud: true }); quote.redraw(1); quote.position.set(0, .55, -6); s.hud.add(quote); setOpacity(quote, 0);
  const big = document.getElementById('big');
  s.update = (lt) => {
    const st = screenState(S.screen, lt);
    crt.screen.redraw(JSON.stringify(st.rows) + (Math.floor(lt * 2.2) % 2), st.rows, st.typing || Math.floor(lt * 2.2) % 2 === 0);
    camPath([[0, [7, 3, 13], [0, -.5, 0]], [.2, [3.5, 1.5, 9], [-.5, -.4, 0], 9],
      [local(S, 2) - .5, [5.5, 2.2, 10], [-3, -.3, -1], 4],
      [local(S, 4) - 1, [0, .6, 7.5], [0, .2, 0], 4]], lt);
    leafPivot.rotation.y = -1.25 * eio((lt - local(S, 2) - 2.5) / 2.5);
    doorLight.intensity = 60 * ss(local(S, 2) + 2.5, local(S, 2) + 5, lt);
    big.innerHTML = 'The moment that <span class="hl">changed everything</span>';
    big.style.opacity = fadeIO(lt, .3, local(S, 1) - .2, .5);
    showBetween(c1, S, lt, 1, 2); showBetween(c2, S, lt, 2, 3); showBetween(c3, S, lt, 3, 4); showBetween(quote, S, lt, 4);
  };
  s.hideCap = (lt) => lt > local(S, 4) + 1.2;
  s.leave = () => { big.style.opacity = 0; };
  return s;
};

// ---- chapter 6: the ELIZA effect (mirror) ----
SCENES.mirror = (S) => {
  const s = newScene();
  const mirror = new Reflector(new THREE.PlaneGeometry(5.2, 7), { clipBias: .003, textureWidth: 1024, textureHeight: 1380, color: 0x8899aa });
  mirror.position.set(0, 0, -2); s.g.add(mirror);
  const fm = emis(COL.cyan, 1.5);
  for (const [x, y, w, h] of [[-2.7, 0, .14, 7.3], [2.7, 0, .14, 7.3], [0, 3.6, 5.5, .14], [0, -3.6, 5.5, .14]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, .14), fm); b.position.set(x, y, -1.95); s.g.add(b);
  }
  const outer = new THREE.Mesh(new RoundedBoxGeometry(6.2, 8.0, .3, 4, .3), std(0x0b1020, { metalness: .9, roughness: .3 })); outer.position.set(0, 0, -2.2); s.g.add(outer);
  const bust = makeBust(); bust.position.set(0, -.6, 2); bust.rotation.y = Math.PI; s.g.add(bust);
  const title = text3D('THE ELIZA EFFECT', .62, std(0xd8f4ff, { metalness: .8, roughness: .25, emissive: new THREE.Color(0x0b3355) }), { depth: .18 });
  title.position.set(0, 4.25, -1.6); s.g.add(title);
  const lab = (t, acc) => { const p = panel(900, 200, 3.2, (c, w, h) => { glassBox(c, w, h, acc, 30); c.font = '800 60px Inter'; c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, w / 2, h / 2 + 4); }); p.redraw(1); s.g.add(p); setOpacity(p, 0); return p; };
  const lm = lab('MACHINE  →  words', HEX.green); lm.position.set(-5.2, 1.8, -1.2); lm.rotation.y = .35;
  const lh = lab('YOU  →  meaning', HEX.violet); lh.position.set(5.2, 1.8, -1.2); lh.rotation.y = -.35;
  const c1 = hudCard(s, { kicker: 'Definition', title: 'The ELIZA Effect', body: 'Our tendency to read understanding, intention and emotion into a machine\'s output — far beyond what it actually does.' }, 1.95, .5, 2.6, [1100, 600]);
  const c3 = hudCard(s, { kicker: 'Named & popularized by', title: 'Douglas Hofstadter', body: 'Cognitive scientist, Fluid Concepts and Creative Analogies (1995): even shallow symbol shuffling can feel deep.', accent: HEX.amber }, 1.95, .5, 2.6, [1100, 600]);
  const beams = new THREE.Group(); s.g.add(beams);
  for (let i = 0; i < 18; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, 3.6, 4), emis(i % 2 ? COL.cyan : COL.violet, 3));
    b.rotation.x = Math.PI / 2; b.position.set((hash(i) - .5) * 2.6, (hash(i + 9) - .5) * 2.4 + .6, 0); beams.add(b);
  }
  s.update = (lt) => {
    camPath([[0, [6, 3, 12], [0, 1.6, -2]], [.2, [2.8, 1.4, 9], [0, 1.1, -2], 10],
      [local(S, 2) - .5, [0, 1.5, 11], [0, .8, -2], 4], [local(S, 3) - .5, [-3, 1.3, 8.5], [0, .6, -2], 5]], lt);
    bust.rotation.y = Math.PI + Math.sin(lt * .4) * .25;
    bust.material.opacity = .9 + .1 * Math.sin(lt * 3);
    title.scale.setScalar(eob(cl((lt - .3) / .9)) + .001);
    setOpacity(title, ss(.2, 1, lt));
    const bk = ss(local(S, 2), local(S, 2) + 1.2, lt);
    setOpacity(lm, bk * fadeIO(lt, local(S, 2), local(S, 3) + 1.5, .6));
    setOpacity(lh, bk * fadeIO(lt, local(S, 2), local(S, 3) + 1.5, .6));
    beams.children.forEach((b, i) => { const ph = (lt * .8 + hash(i)) % 1; b.position.z = lerp(1.6, -1.9, ph); b.scale.y = .2 + .5 * Math.sin(ph * Math.PI); setOpacity(b, bk * Math.sin(ph * Math.PI)); });
    showBetween(c1, S, lt, 1, 2); showBetween(c3, S, lt, 3);
  };
  return s;
};

// ---- chapter 7: psychology ----
SCENES.psychology = (S) => {
  const s = newScene();
  // A: electrical outlet that looks like a face
  const A = new THREE.Group(); A.position.set(-7, .3, 0); s.g.add(A);
  A.add(new THREE.Mesh(new RoundedBoxGeometry(2.4, 3.4, .3, 4, .3), std(0xf2efe8, { roughness: .35, metalness: 0 })));
  const slotM = std(0x111111);
  for (const x of [-.45, .45]) { const sl = new THREE.Mesh(new RoundedBoxGeometry(.18, .6, .1, 2, .05), slotM); sl.position.set(x, .5, .16); A.add(sl); }
  const mouth = new THREE.Mesh(new THREE.CylinderGeometry(.26, .26, .1, 32, 1, false, 0, Math.PI), slotM); mouth.rotation.set(Math.PI / 2, 0, Math.PI / 2); mouth.position.set(0, -.55, .16); A.add(mouth);
  // B: projection
  const B = new THREE.Group(); B.position.set(0, .3, -3); s.g.add(B);
  const mind = new THREE.Mesh(new THREE.IcosahedronGeometry(.7, 3), emis(COL.violet, 2.5)); mind.position.set(-2.4, 0, 1.5); B.add(mind);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(1.7, 4.2, 40, 1, true), new THREE.MeshBasicMaterial({ color: glow(COL.violet, 1), transparent: true, opacity: .12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.rotation.z = Math.PI / 2; beam.position.set(-.3, 0, .9); beam.rotation.y = .3; B.add(beam);
  const scr = panel(1000, 640, 3.6, (c, w, h) => {
    glassBox(c, w, h, HEX.violet, 20);
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '800 70px Inter';
    [['hopes', HEX.cyan], ['fears', HEX.pink], ['feelings', HEX.amber]].forEach(([t, col], i) => { c.fillStyle = col; c.fillText(t, w / 2, 170 + i * 150); });
  }); scr.redraw(1); scr.position.set(1.8, 0, 0); scr.rotation.y = -.4; B.add(scr);
  // C: computer with hearts
  const Cg = new THREE.Group(); Cg.position.set(7, .3, 0); s.g.add(Cg);
  Cg.add(new THREE.Mesh(new RoundedBoxGeometry(3.4, 2.4, .5, 4, .12), std(0x1a2030)));
  const cs = panel(900, 560, 3.0, (c, w, h) => {
    c.fillStyle = '#0a1830'; c.fillRect(0, 0, w, h); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '800 80px Inter'; c.fillStyle = '#fff'; c.fillText('Thank you,', w / 2, h / 2 - 60);
    c.fillStyle = HEX.cyan; c.fillText('computer!', w / 2, h / 2 + 50);
  }); cs.redraw(1); cs.position.z = .26; Cg.add(cs);
  const st = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, 1), std(0x1a2030)); st.position.y = -1.6; Cg.add(st);
  const heart = new THREE.Shape(); heart.moveTo(0, .25); heart.bezierCurveTo(0, .25, -.05, 0, -.25, 0); heart.bezierCurveTo(-.55, 0, -.55, .35, -.55, .35);
  heart.bezierCurveTo(-.55, .55, -.35, .77, 0, .95); heart.bezierCurveTo(.35, .77, .55, .55, .55, .35); heart.bezierCurveTo(.55, .35, .55, 0, .25, 0); heart.bezierCurveTo(.1, 0, 0, .25, 0, .25);
  const hg = new THREE.ExtrudeGeometry(heart, { depth: .15, bevelEnabled: true, bevelSize: .04, bevelThickness: .04, bevelSegments: 2 }); hg.center(); hg.rotateZ(Math.PI);
  const hearts = [...Array(6)].map((_, i) => { const m = new THREE.Mesh(hg, emis(COL.pink, 2.5)); m.scale.setScalar(.45); Cg.add(m); return m; });
  // D: language waveform
  const bars = new THREE.InstancedMesh(new RoundedBoxGeometry(.18, 1, .18, 2, .06), emis(COL.cyan, 2.5), 64); bars.position.set(0, -1.2, 4); s.g.add(bars);
  const m4 = new THREE.Matrix4();
  const intro = hudCard(s, { kicker: 'Why we fall for it', title: 'Three forces', body: 'Anthropomorphism  ·  Projection  ·  The Media Equation' }, 0, 1.15, 3.2, [1300, 420]);
  const cA = hudCard(s, { kicker: '1 · Anthropomorphism', title: 'We see humans everywhere', body: 'Faces in clouds, cars and electrical outlets, and minds in machines.' }, 1.95, .6);
  const cB = hudCard(s, { kicker: '2 · Projection', title: 'We fill the gaps', body: 'Vague replies become mirrors for our own hopes, fears and feelings.', accent: HEX.violet }, 1.95, .6);
  const cC = hudCard(s, { kicker: '3 · The Media Equation', title: 'Computers as social actors', body: 'Reeves & Nass (1996): we are polite to computers and trust them, even when we know better.', accent: HEX.pink }, -1.95, .6);
  const cD = hudCard(s, { kicker: 'The strongest trigger', title: 'Language', body: 'For all of human history, only other minds could talk back.', accent: HEX.amber }, 1.95, .8, 2.5, [1100, 480]);
  s.update = (lt) => {
    camPath([[0, [0, 3, 18], [0, 0, 0]], [local(S, 1) - .6, [-4.6, .8, 6.5], [-7.2, .3, 0], 2],
      [local(S, 2) - .6, [2.5, 1.2, 6.5], [-.5, .2, -2.5], 2], [local(S, 3) - .6, [4.2, .8, 6.5], [7.3, .3, 0], 2],
      [local(S, 4) - .6, [0, 1.5, 12], [0, -.5, 3], 2]], lt);
    A.rotation.y = Math.sin(lt * .5) * .25; mind.rotation.y = lt * .5;
    beam.material.opacity = .1 + .04 * Math.sin(lt * 4);
    Cg.rotation.y = Math.sin(lt * .4) * .2;
    hearts.forEach((h, i) => { const ph = (lt * .35 + i / 6) % 1; h.position.set(Math.sin(i * 2.1) * 1.3, 1.4 + ph * 2.4, .6); h.rotation.y = lt * 2 + i; setOpacity(h, Math.sin(ph * Math.PI)); });
    const wk = ss(local(S, 4) - .5, local(S, 4) + 1, lt);
    for (let i = 0; i < 64; i++) {
      const x = (i - 31.5) * .26, a = Math.abs(Math.sin(i * .37 + lt * 5) * Math.sin(i * .11 - lt * 2.3)) * 2.2 * Math.exp(-Math.pow((i - 31.5) / 22, 2));
      m4.compose(new THREE.Vector3(x, a * wk / 2, 0), new THREE.Quaternion(), new THREE.Vector3(1, a * wk + .02, 1)); bars.setMatrixAt(i, m4);
    }
    bars.instanceMatrix.needsUpdate = true;
    showBetween(intro, S, lt, 0, 1); showBetween(cA, S, lt, 1, 2); showBetween(cB, S, lt, 2, 3); showBetween(cC, S, lt, 3, 4); showBetween(cD, S, lt, 4);
  };
  return s;
};

// ---- chapter 8: the creator's warning (book + scale) ----
SCENES.book = (S) => {
  const s = newScene();
  const cover = panel(900, 1260, 1, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#0f2347'); g.addColorStop(1, '#060c1c'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#ffb547'; c.lineWidth = 6; c.strokeRect(40, 40, w - 80, h - 80);
    c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = '800 92px Inter';
    ['COMPUTER', 'POWER', 'AND HUMAN', 'REASON'].forEach((l, i) => c.fillText(l, w / 2, 260 + i * 110));
    c.font = 'italic 500 46px Inter'; c.fillStyle = '#ffd38a'; c.fillText('From Judgment', w / 2, 780); c.fillText('to Calculation', w / 2, 840);
    c.font = '700 48px Inter'; c.fillStyle = '#9fd8ff'; c.fillText('JOSEPH WEIZENBAUM', w / 2, 1060); c.font = '600 36px Inter'; c.fillText('1976', w / 2, 1130);
  }); cover.redraw(1);
  const coverTex = cover.material.map;
  const book = new THREE.Mesh(new RoundedBoxGeometry(3, 4.2, .55, 2, .04), [
    std(0xf0e9d8), std(0x0f2347), std(0xf0e9d8), std(0xf0e9d8), new THREE.MeshStandardMaterial({ map: coverTex, roughness: .5 }), std(0x0f2347)]);
  s.g.add(book);
  // balance scale
  const sc = new THREE.Group(); sc.position.set(0, -.6, 0); s.g.add(sc);
  const gold = std(0xd6a740, { metalness: .9, roughness: .25 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.1, .14, 4.2, 16), gold); post.position.y = -.1; sc.add(post);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, .25, 32), gold); base.position.y = -2.2; sc.add(base);
  const beamG = new THREE.Group(); beamG.position.y = 2; sc.add(beamG);
  beamG.add(new THREE.Mesh(new THREE.BoxGeometry(6, .12, .12), gold));
  const pans = [-1, 1].map(sx => {
    const pg = new THREE.Group(); pg.position.x = 3 * sx; beamG.add(pg);
    const str = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, 1.6), gold); str.position.y = -.8; pg.add(str);
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(.9, .6, .15, 32), gold); pan.position.y = -1.6; pg.add(pan);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(sx < 0 ? .45 : .32, 24, 16), emis(sx < 0 ? COL.amber : COL.cyan, 3)); orb.position.y = -1.2; pg.add(orb);
    const lab = panel(800, 180, 2.6, (c, w, h) => { glassBox(c, w, h, sx < 0 ? HEX.amber : HEX.cyan, 30); c.font = '800 64px Inter'; c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.letterSpacing = '6px'; c.fillText(sx < 0 ? 'JUDGMENT' : 'CALCULATION', w / 2, h / 2 + 4); });
    lab.redraw(1); lab.position.set(0, -2.6, .3); pg.add(lab);
    return pg;
  });
  const c0 = hudCard(s, { kicker: 'From creator to critic', title: 'An unlikely skeptic', body: 'ELIZA\'s success turned Weizenbaum into one of AI\'s first great critics.', accent: HEX.amber }, 1.9, .6, 2.6, [1100, 500]);
  const c4 = hudCard(s, { kicker: 'Then & now', title: 'Dismissed then. Prophetic now.', body: 'His questions shape today\'s debates on AI in care, justice and society.', accent: HEX.cyan }, 1.9, .9, 2.6, [1100, 520]);
  const big = document.getElementById('big');
  s.update = (lt) => {
    const sk = ss(local(S, 3) - .6, local(S, 3) + .6, lt);
    camPath([[0, [3, 1, 11], [0, 0, 0]], [.3, [1.5, .5, 8.5], [0, 0, 0], 8], [local(S, 3) - .6, [0, .6, 13], [0, -1.1, 0], 2]], lt);
    const bk = 1 - sk;
    book.position.set(-1.6 * (1 - ss(local(S, 1) - .5, local(S, 1) + 1, lt)) - 0, .2 + Math.sin(lt * .9) * .1, 0);
    book.rotation.set(Math.sin(lt * .5) * .1, -.5 + Math.sin(lt * .3) * .45 + (1 - eout(lt / 2)) * 3, Math.sin(lt * .4) * .05);
    book.scale.setScalar(Math.max(.001, bk)); setOpacity(book, bk);
    sc.scale.setScalar(Math.max(.001, eob(sk))); sc.visible = sk > 0;
    beamG.rotation.z = -.22 * eio((lt - local(S, 3) - 1.5) / 2.5) + Math.sin(lt * 1.3) * .015;
    pans.forEach(p => { p.rotation.z = -beamG.rotation.z; });
    sc.rotation.y = Math.sin(lt * .3) * .25;
    showBetween(c0, S, lt, 0, 1); showBetween(c4, S, lt, 4);
    big.innerHTML = 'Just because a computer <span class="hl">can</span> do something,<br>does not mean it <span class="hl">should</span>.';
    big.style.opacity = fadeIO(lt, local(S, 2) - .2, local(S, 3) - .3, .5);
  };
  s.leave = () => { big.style.opacity = 0; };
  return s;
};

// ---- chapter 9: ELIZA's children (helix) ----
SCENES.helix = (S) => {
  const s = newScene();
  const R = 3.2, dy = 2.6, dth = 1.15;
  const ms = [
    ['1966', 'ELIZA', 'Keywords & templates · MIT', HEX.green],
    ['1972', 'PARRY', 'Kenneth Colby\'s simulated paranoid patient. Talked with ELIZA over ARPANET.', HEX.pink],
    ['1995', 'A.L.I.C.E.', 'Richard Wallace\'s rule-based bot · three-time Loebner Prize winner', HEX.amber],
    ['2011', 'Siri', 'The conversation moves into our phones', HEX.violet],
    ['2014', 'Alexa', 'The conversation moves into our homes', HEX.cyan],
    ['2022', 'ChatGPT', 'Large language model · ~100 million users in ~2 months', HEX.green],
  ];
  const pts = [], pts2 = [];
  for (let i = 0; i <= 120; i++) { const t = i / 120 * 6.6 - .3, th = t * dth, y = t * dy; pts.push(new THREE.Vector3(Math.cos(th) * R, y, Math.sin(th) * R)); pts2.push(new THREE.Vector3(-Math.cos(th) * R, y, -Math.sin(th) * R)); }
  s.g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, .05, 8), emis(COL.cyan, 2.6)));
  s.g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts2), 400, .05, 8), emis(COL.violet, 2.6)));
  for (let i = 0; i < 40; i++) {
    const t = i / 40 * 6.6 - .3, th = t * dth, y = t * dy;
    const r = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 2 * R, 6), new THREE.MeshBasicMaterial({ color: 0x3a5a9a, transparent: true, opacity: .5 }));
    r.position.y = y; r.rotation.z = Math.PI / 2; r.rotation.y = -th; s.g.add(r);
  }
  const items = ms.map(([yr, name, desc, acc], i) => {
    const th = i * dth, y = i * dy, P = new THREE.Vector3(Math.cos(th) * R, y, Math.sin(th) * R);
    const node = new THREE.Mesh(new THREE.SphereGeometry(.28, 24, 16), emis(parseInt(acc.slice(1), 16), 4)); node.position.copy(P); s.g.add(node);
    const p = cardPanel({ kicker: yr, title: name, body: desc, accent: acc, ts: 72 }, 1000, 520, 3.4);
    p.position.copy(P.clone().multiplyScalar(1.85)); p.position.y = y + 1.5; s.g.add(p); setOpacity(p, 0);
    return { node, p, th, y };
  });
  // ELIZA <-> PARRY link pulse
  const link = new THREE.Mesh(new THREE.SphereGeometry(.12, 12, 8), emis(COL.white, 6)); s.g.add(link);
  // neural cloud for the LLM era
  seed = 77;
  const cloudN = 260, cloudPos = [];
  const cloud = points(cloudN, () => { const v = [(rnd() - .5) * 9, 5 * dy + 1.5 + (rnd() - .5) * 5, (rnd() - .5) * 9]; cloudPos.push(v); return v; }, { size: .14, color: COL.cyan, k: 3 });
  s.g.add(cloud);
  const segs = [];
  for (let i = 0; i < cloudN; i++) for (let j = i + 1; j < cloudN; j++) {
    const a = cloudPos[i], b = cloudPos[j], d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    if (d < 1.5) segs.push(...a, ...b);
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));
  const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: glow(COL.violet, 1.5), transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false })); s.g.add(lines);
  // which milestone is current, by line
  const when = [local(S, 0), local(S, 1), local(S, 2), local(S, 3), local(S, 3) + 3.6, local(S, 4)];
  s.update = (lt) => {
    let cur = 0; when.forEach((w, i) => { if (lt >= w - .5) cur = i; });
    // continuous camera: interpolate along helix parameter
    let f = 0; for (let i = 1; i < when.length; i++) f += eio((lt - when[i] + .8) / 2.2);
    const th = f * dth + .35, y = f * dy;
    const extra = ss(when[5] + 6, when[5] + 12, lt);
    camera.position.set(Math.cos(th) * (15 + extra * 5), y + 2.6 + extra * 2, Math.sin(th) * (15 + extra * 5));
    camera.lookAt(0, y + 1.6 + extra * 1.5, 0);
    items.forEach((it, i) => {
      const k = eout((lt - when[i] + .3) / .8);
      setOpacity(it.p, k * (i === cur ? 1 : .35)); it.p.quaternion.copy(camera.quaternion);
      it.node.scale.setScalar(.001 + k * (1 + (i === cur ? .3 * Math.sin(lt * 4) : 0)));
    });
    const lk = (lt - local(S, 1) - 4) / 2.5;
    link.visible = lk > 0 && lk < 4;
    const ph = ((lk % 1) + 1) % 1, A = items[0].node.position, B = items[1].node.position;
    link.position.lerpVectors(Math.floor(lk) % 2 ? B : A, Math.floor(lk) % 2 ? A : B, ph);
    const ck = ss(when[5] + .5, when[5] + 3, lt);
    cloud.material.opacity = ck; lines.material.opacity = ck * .35; cloud.rotation.y = lines.rotation.y = lt * .08;
  };
  return s;
};

// ---- chapter 10: the effect today (bars) ----
SCENES.bars = (S) => {
  const s = newScene();
  const data = [['GPT-4.5', 'with persona', 73, COL.cyan, HEX.cyan], ['LLaMa-3.1', 'with persona', 56, COL.violet, HEX.violet], ['ELIZA', '1966', 23, COL.green, HEX.green], ['GPT-4o', 'no persona', 21, 0x7d8aa8, '#9aa6c4']];
  const chart = new THREE.Group(); chart.position.y = 1.6; s.g.add(chart);
  const plat = new THREE.Mesh(new RoundedBoxGeometry(12, .3, 4, 3, .1), std(0x0c1426, { metalness: .7, roughness: .3 })); plat.position.y = -2.6; chart.add(plat);
  const bars = data.map(([n, sub, v, col, hx], i) => {
    const x = (i - 1.5) * 2.8;
    const m = new THREE.Mesh(new RoundedBoxGeometry(1.5, 1, 1.5, 3, .08), std(col, { emissive: new THREE.Color(col), emissiveIntensity: .35, metalness: .3, roughness: .35 }));
    m.position.set(x, -2.45, 0); chart.add(m);
    const lab = panel(700, 300, 2.4, (c, w, h) => { c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '800 70px Inter'; c.fillStyle = '#fff'; c.fillText(n, w / 2, 110); c.font = '500 44px Inter'; c.fillStyle = hx; c.fillText(sub, w / 2, 200); });
    lab.redraw(1); lab.position.set(x, -3.45, 2.05); chart.add(lab); m.userData.lab = lab;
    const val = panel(500, 220, 1.7, (c, w, h, t) => { c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '800 140px Inter'; c.fillStyle = hx; c.shadowColor = hx; c.shadowBlur = 30; c.fillText(t, w / 2, h / 2); });
    chart.add(val);
    return { m, val, v, x };
  });
  const head = panel(1800, 260, 8, (c, w, h) => { c.textAlign = 'center'; c.font = '800 80px Inter'; c.fillStyle = '#fff'; c.fillText('Judged to be human', w / 2, 100); c.font = '500 46px Inter'; c.fillStyle = '#9fd8ff'; c.fillText('Three-party Turing test · Jones & Bergen · UC San Diego · 2025', w / 2, 190); });
  head.redraw(1); head.position.set(0, 5.0, -1); chart.add(head);
  const sent = text3D('SENTIENT?', 1.3, std(0xffc2dd, { metalness: .8, roughness: .25, emissive: new THREE.Color(COL.pink).multiplyScalar(.35) }), { depth: .4 }); sent.position.set(-1.8, 1.2, -2); s.g.add(sent);
  const c0 = hudCard(s, { kicker: 'Today', title: 'Smarter machines, stronger illusion', body: 'The more fluent the system, the more powerful the ELIZA effect becomes.' }, 1.9, .6, 2.6, [1100, 560]);
  const c1 = hudCard(s, { kicker: '2022 · Google LaMDA', title: '“It\'s sentient.”', body: 'An engineer\'s public claim. Google rejected it, and he was later dismissed.', accent: HEX.pink }, 1.9, .6, 2.6, [1100, 520]);
  const c4 = hudCard(s, { kicker: 'AI companions', title: 'Comfort, with caveats', body: '✓ Support for loneliness & stress\n✗ Dependence   ✗ Privacy\n✗ Risks for vulnerable users', accent: HEX.amber }, 1.9, .55, 2.6, [1100, 600]);
  // phone with chat bubbles for companions
  const phone = new THREE.Group(); phone.position.set(-2.5, .5, 0); s.g.add(phone);
  phone.add(new THREE.Mesh(new RoundedBoxGeometry(2.2, 4.4, .25, 4, .3), std(0x111522, { metalness: .8, roughness: .3 })));
  const ps = panel(600, 1200, 2.0, (c, w, h) => {
    c.fillStyle = '#0b1530'; c.fillRect(0, 0, w, h);
    const bub = (y, txt, me) => { c.font = '600 38px Inter'; const ls = wrap(c, txt, 380); const bh = ls.length * 48 + 40; rr(c, me ? w - 460 : 40, y, 420, bh, 28); c.fillStyle = me ? '#7a4bf5' : '#1e2b4f'; c.fill(); c.fillStyle = '#fff'; c.textBaseline = 'top'; ls.forEach((l, i) => c.fillText(l, (me ? w - 440 : 60), y + 20 + i * 48)); return y + bh + 30; };
    let y = 120; y = bub(y, 'Rough day today...', true); y = bub(y, 'I\'m here for you. Want to talk about it?', false); y = bub(y, 'You always understand me.', true); bub(y, '♥', false);
  }); ps.redraw(1); ps.position.z = .13; phone.add(ps);
  s.update = (lt) => {
    const t2 = local(S, 2), t3 = local(S, 3), t4 = local(S, 4);
    camPath([[0, [0, 1, 14], [0, 0, 0]], [t2 - .8, [0, 2, 16], [0, 1, 0], 2], [t3 - .3, [2.4, 2.6, 14], [1.2, 1.4, 0], 2.5], [t4 - .6, [1, .8, 11], [-1.5, .4, 0], 2]], lt);
    const bk = fadeIO(lt, t2 - .5, t4, .6);
    setOpacity(head, bk); setOpacity(plat, bk);
    const sk = fadeIO(lt, .3, t2 - .4, .8); setOpacity(sent, sk); sent.rotation.y = -.25 + Math.sin(lt * .6) * .25; sent.position.y = 1.2 + Math.sin(lt * .9) * .15;
    bars.forEach((b, i) => {
      const g = eout((lt - t2 - .4 - i * .25) / 1.8);
      const hgt = Math.max(.01, b.v / 100 * 7 * g);
      b.m.scale.y = hgt; b.m.position.y = -2.45 + hgt / 2; setOpacity(b.m, bk); setOpacity(b.m.userData.lab, bk);
      b.val.position.set(b.x, -2.45 + hgt + .55, .2); b.val.redraw(Math.round(b.v * g), Math.round(b.v * g) + '%'); setOpacity(b.val, bk * cl(g * 3));
      b.m.material.emissiveIntensity = i === 2 ? .35 + 1.2 * ss(t3, t3 + 1, lt) * (.7 + .3 * Math.sin(lt * 5)) : .35;
    });
    const pk = ss(t4 - .3, t4 + 1, lt);
    setOpacity(phone, pk); phone.visible = pk > 0; phone.rotation.y = .35 + Math.sin(lt * .5) * .15; phone.position.y = .3 + Math.sin(lt) * .1;
    showBetween(c0, S, lt, 0, 1); showBetween(c1, S, lt, 1, 2); showBetween(c4, S, lt, 4);
  };
  return s;
};

// ---- chapter 11: rediscovery (printout) ----
SCENES.printout = (S) => {
  const s = newScene();
  const codeLines = ['(MY  =  YOUR  2', '   ((0 YOUR 0 (/FAMILY) 0)', '      (TELL ME MORE ABOUT YOUR FAMILY)', '(I AM  =  YOU ARE', '   ((0 I AM 0)', '      (HOW LONG HAVE YOU BEEN 4 ?)', '      (DO YOU BELIEVE IT NORMAL TO BE 4 ?))', '(ALWAYS  1', '   ((0)', '      (CAN YOU THINK OF A SPECIFIC EXAMPLE)))', '(NONE', '   ((0) (PLEASE GO ON)', '        (I AM NOT SURE I UNDERSTAND YOU FULLY)))'];
  const sheets = [];
  for (let i = 0; i < 7; i++) {
    const p = panel(800, 520, 4, (c, w, h) => {
      c.fillStyle = '#f4f1e6'; c.fillRect(0, 0, w, h);
      for (let r = 0; r < 13; r++) if (r % 2 === 0) { c.fillStyle = 'rgba(120,190,140,.28)'; c.fillRect(0, r * 40, w, 40); }
      c.fillStyle = '#d7d2c2'; for (let y = 20; y < h; y += 40) { c.beginPath(); c.arc(18, y, 7, 0, 7); c.fill(); c.beginPath(); c.arc(w - 18, y, 7, 0, 7); c.fill(); }
      c.font = '700 22px "DejaVu Sans Mono"'; c.fillStyle = '#26303a'; c.textBaseline = 'middle';
      for (let r = 0; r < 12; r++) c.fillText(codeLines[(i * 5 + r) % codeLines.length], 52, 20 + r * 40 + 20);
      c.font = '700 18px Inter'; c.fillStyle = 'rgba(40,40,40,.5)'; c.fillText(`DOCTOR SCRIPT (ILLUSTRATION) · PAGE ${i + 1}`, 52, h - 14);
    }, { side: THREE.DoubleSide });
    p.redraw(1); s.g.add(p); sheets.push(p);
  }
  const box = new THREE.Group(); box.position.set(-3.2, -3.1, 0); s.g.add(box);
  const card = std(0x9c7a4f, { roughness: .9, metalness: 0 });
  box.add(new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.6, 3), card));
  const lbl = panel(600, 160, 2, (c, w, h) => { c.fillStyle = '#efe6cf'; c.fillRect(0, 0, w, h); c.font = '800 46px Inter'; c.fillStyle = '#333'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('MIT ARCHIVES', w / 2, 60); c.font = '600 32px Inter'; c.fillText('WEIZENBAUM PAPERS', w / 2, 118); });
  lbl.redraw(1); lbl.position.set(0, 0, 1.51); box.add(lbl);
  const crt = makeCRT(); crt.scale.setScalar(.55); crt.position.set(3.2, -2.2, -1); crt.rotation.y = -.35; s.g.add(crt);
  const ev = [{ k: 'E', text: 'HOW DO YOU DO.  PLEASE TELL ME YOUR PROBLEM.', t0: local(S, 2) + 2.5, t1: local(S, 2) + 4.5 }];
  const c0 = hudCard(s, { kicker: 'Lost for decades', title: 'Where was the code?', body: 'Only the published paper and later re-creations survived in public.', accent: HEX.violet }, 1.95, .7, 2.5, [1100, 500]);
  const c1 = hudCard(s, { kicker: '2021 · MIT archives', title: 'Original code found', body: 'Printouts of Weizenbaum\'s original MAD-SLIP source code turn up among his papers.', accent: HEX.amber }, 1.95, .7, 2.5, [1100, 520]);
  const c2 = hudCard(s, { kicker: '2025 · Reanimated', title: 'ELIZA runs again', body: 'Restored on an emulated IBM 7094 running CTSS, the very system it was born on.', accent: HEX.green }, 1.95, .7, 2.5, [1100, 520]);
  s.update = (lt) => {
    const u = ss(local(S, 1) - .5, local(S, 1) + 6, lt);
    sheets.forEach((p, i) => {
      const k = cl(u * 7 - i);
      const fold = (i % 2 ? -1 : 1) * lerp(1.45, .32, eio(k));
      const y = -2.2 + k * (i * .45 + .2);
      p.position.set(-3.2 + Math.sin(i * .9) * .05, y + 1.3, (i % 2 ? .35 : -.35) * (1 - k * .5) + i * .02);
      p.rotation.set(-Math.PI / 2 + fold * .9 + k * (Math.PI / 2 - .25), Math.sin(lt * .3 + i) * .04, 0);
      setOpacity(p, cl(u * 7 - i + 1));
    });
    const st = screenState(ev, lt);
    crt.screen.redraw(JSON.stringify(st.rows) + (Math.floor(lt * 2.2) % 2), st.rows, Math.floor(lt * 2.2) % 2 === 0, 'ELIZA  ·  EMULATED IBM 7094  ·  CTSS  ·  2025');
    camPath([[0, [-1, 2, 13], [0, 0, 0]], [.3, [.5, 1.5, 11], [-.5, .3, 0], 6], [local(S, 1), [1, 2.5, 11], [-.5, 1.0, 0], 6], [local(S, 2) - .3, [1.5, .5, 9], [3, -1.2, -1], 3]], lt);
    showBetween(c0, S, lt, 0, 1); showBetween(c1, S, lt, 1, 2); showBetween(c2, S, lt, 2);
  };
  return s;
};

// ---- chapter 12: the future ----
SCENES.future = (S) => {
  const s = newScene();
  seed = 202;
  const N = 22, towers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), std(0x0d1630, { metalness: .6, roughness: .35 }), N * N);
  const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(1.02, .06, 1.02), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), N * N);
  const m4 = new THREE.Matrix4(), c = new THREE.Color(); let n = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = (i - N / 2) * 1.8, z = (j - N / 2) * 1.8 - 6; if ((Math.abs(x) < 4 && z > -9) || (Math.abs(x) < 8.5 && z > -2.5)) continue;
    const h = .5 + Math.pow(rnd(), 2.2) * 7;
    m4.compose(new THREE.Vector3(x, -4 + h / 2, z), new THREE.Quaternion(), new THREE.Vector3(1.1, h, 1.1)); towers.setMatrixAt(n, m4);
    m4.makeTranslation(x, -4 + h, z); caps.setMatrixAt(n, m4); c.set([COL.cyan, COL.violet, COL.pink, COL.cyan][Math.floor(rnd() * 4)]).multiplyScalar(2.5); caps.setColorAt(n, c); n++;
  }
  towers.count = caps.count = n; s.g.add(towers, caps);
  const traffic = points(700, () => { const along = rnd() < .5; const lane = (Math.floor(rnd() * N) - N / 2) * 1.8 + .9; return along ? [lane, -3.9, (rnd() - .5) * 40 - 6] : [(rnd() - .5) * 40, -3.9, lane - 6]; }, { size: .12, color: COL.amber, k: 3 });
  s.g.add(traffic);
  // core + orbiting capabilities
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 4), emis(COL.cyan, 2.2)); core.position.set(0, 1, -3); s.g.add(core);
  const coreWire = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), new THREE.MeshBasicMaterial({ color: glow(COL.violet, 2), wireframe: true, toneMapped: false })); core.add(coreWire);
  const caps4 = ['VOICE', 'EMOTION', 'MEMORY', 'AGENTS'].map((t, i) => { const p = panel(520, 150, 1.9, (cc, w, h) => { glassBox(cc, w, h, [HEX.cyan, HEX.pink, HEX.violet, HEX.amber][i], 40); cc.font = '800 56px Inter'; cc.letterSpacing = '6px'; cc.fillStyle = '#fff'; cc.textAlign = 'center'; cc.textBaseline = 'middle'; cc.fillText(t, w / 2, h / 2 + 3); }); p.redraw(1); s.g.add(p); setOpacity(p, 0); return p; });
  // four pillars
  const P = [['TRANSPARENCY', 'Always know when you are talking to a machine. The EU AI Act now requires it for many systems.', HEX.cyan, COL.cyan],
    ['AI LITERACY', 'Understanding how these systems work is our best defense against misplaced trust.', HEX.violet, COL.violet],
    ['HONEST DESIGN', 'No fake feelings to drive engagement, especially with children and vulnerable people.', HEX.pink, COL.pink],
    ['HUMAN JUDGMENT', 'In medicine, law and education, AI supports people; it does not replace their responsibility.', HEX.amber, COL.amber]];
  const PX = [-5.4, -1.8, 1.8, 5.4];
  const pillars = P.map(([t, b, hx, col], i) => {
    const g = new THREE.Group(); g.position.set(PX[i], -4, 0); s.g.add(g);
    const col3 = new THREE.Mesh(new THREE.CylinderGeometry(.55, .65, 1, 6), std(0x0e1830, { emissive: new THREE.Color(col), emissiveIntensity: .25, metalness: .6, roughness: .3 })); g.add(col3);
    const top = new THREE.Mesh(new THREE.TorusGeometry(.6, .05, 8, 6), emis(col, 4)); top.rotation.x = Math.PI / 2; g.add(top);
    const lab = panel(800, 160, 2.8, (cc, w, h) => { cc.font = '800 64px Inter'; cc.letterSpacing = '5px'; cc.fillStyle = hx; cc.shadowColor = hx; cc.shadowBlur = 20; cc.textAlign = 'center'; cc.textBaseline = 'middle'; cc.fillText(t, w / 2, h / 2); }); lab.redraw(1); g.add(lab);
    const card = hudCard(s, { kicker: `Principle ${i + 1}`, title: ['Transparency', 'AI Literacy', 'Honest Design', 'Human Judgment'][i], body: b, accent: hx }, i < 2 ? 1.95 : -1.95, .65, 2.6, [1100, 560]);
    return { g, col3, top, lab, card };
  });
  const c1 = hudCard(s, { kicker: 'What\'s next', title: 'Closer, warmer, always on', body: 'Every one of these features makes the ELIZA effect stronger.', accent: HEX.pink }, 1.95, .7, 2.6, [1100, 470]);
  const big = document.getElementById('big');
  s.update = (lt) => {
    const t3 = local(S, 3);
    const keys = [[0, [0, 9, 26], [0, 0, -6]], [.2, [6, 4, 13], [0, 1, -3], 3], [local(S, 1) - .5, [0, 2.2, 8.5], [0, 1, -3], 3], [local(S, 2) - .5, [0, 3, 17], [0, 0, -2], 2.5]];
    for (let i = 0; i < 4; i++) { const o = i < 2 ? 2.1 : -2.1; keys.push([local(S, 3 + i) - .5, [PX[i] * .4 + o, 1.6, 10.5], [PX[i] + o, .4, 0], 1.6]); }
    camPath(keys, lt);
    core.rotation.set(lt * .2, lt * .3, 0); coreWire.rotation.set(-lt * .3, lt * .1, 0);
    core.scale.setScalar(1 - ss(t3 - 1, t3, lt) * .6 + .06 * Math.sin(lt * 3));
    caps4.forEach((p, i) => {
      const a = lt * .5 + i * Math.PI / 2;
      p.position.set(Math.cos(a) * 3.2, 1 + Math.sin(a * 2) * .4, -3 + Math.sin(a) * 3.2); p.quaternion.copy(camera.quaternion);
      setOpacity(p, ss(local(S, 1) + i * .9, local(S, 1) + i * .9 + .6, lt) * (1 - ss(t3 - 1, t3, lt)));
    });
    pillars.forEach((p, i) => {
      const k = eout((lt - local(S, 3 + i) + .3) / 1.4);
      const h = Math.max(.001, 2.6 * k);
      p.col3.scale.y = h; p.col3.position.y = h / 2; p.top.position.y = h; p.lab.position.y = h + .6;
      p.lab.quaternion.copy(camera.quaternion); setOpacity(p.lab, k);
      const active = lt >= local(S, 3 + i) - .3 && (i === 3 || lt < local(S, 4 + i) - .3);
      p.col3.material.emissiveIntensity = active ? .8 + .2 * Math.sin(lt * 5) : .25;
      showBetween(p.card, S, lt, 3 + i, i < 3 ? 4 + i : undefined);
    });
    const pos = traffic.geometry.attributes.position, b = traffic.userData.base;
    for (let i = 0; i < pos.count; i++) { if (i % 2) pos.setZ(i, ((b[i * 3 + 2] + 26 + lt * 3) % 40) - 26); else pos.setX(i, ((b[i * 3] + 20 + lt * 3) % 40) - 20); }
    pos.needsUpdate = true;
    showBetween(c1, S, lt, 1, 2);
    big.innerHTML = 'The future depends on <span class="hl">four principles</span>';
    big.style.opacity = fadeIO(lt, local(S, 2) - .2, t3 - .3, .4);
  };
  s.leave = () => { big.style.opacity = 0; };
  return s;
};

// ---- final thoughts ----
SCENES.closing = (S) => {
  const s = newScene();
  const crt = makeCRT(); crt.position.set(0, 0, -2); s.g.add(crt);
  const bust = makeBust(8000, COL.amber, COL.pink); bust.position.set(0, -.3, 5.2); bust.rotation.y = Math.PI; bust.scale.setScalar(1.1); s.g.add(bust);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.4, .03, 8, 120), emis(COL.amber, 4)); halo.position.set(0, 1.35, 5.2); halo.rotation.x = Math.PI / 2; s.g.add(halo);
  const big = document.getElementById('big');
  const msgs = [[1, 2, 'We are <span class="hl">wired for connection</span>.'], [2, 3, 'Wise enough to <span class="hl">know the difference</span>.'], [3, 4, 'The most important intelligence<br>is still <span class="hl">the human one</span>.']];
  s.update = (lt) => {
    const st = screenState(S.screen, lt);
    crt.screen.redraw(JSON.stringify(st.rows) + (Math.floor(lt * 2.2) % 2), st.rows, st.typing || Math.floor(lt * 2.2) % 2 === 0);
    camPath([[0, [0, .3, 3], [0, .1, -1.5]], [local(S, 1) - 1, [5, 2.5, 13], [0, .3, 1.5], 7], [local(S, 3) - .5, [-4, 2, 12], [0, .8, 4], 6]], lt);
    const hk = ss(local(S, 3), local(S, 3) + 2, lt);
    bust.material.size = .045 + .02 * hk; halo.scale.setScalar(.6 + hk * .6 + .03 * Math.sin(lt * 3)); setOpacity(halo, hk);
    bust.rotation.y = Math.PI + Math.sin(lt * .3) * .2;
    let o = 0, html = '';
    for (const [a, b, h] of msgs) { const k = fadeIO(lt, local(S, a) + .5, b < S.lines.length ? local(S, b) - .2 : S.end - S.start - .3, .5); if (k > o) { o = k; html = h; } }
    big.innerHTML = html; big.style.opacity = o;
  };
  s.leave = () => { big.style.opacity = 0; };
  return s;
};

// ---- outro: prepared by Sara Salem ----
SCENES.outro = (S) => {
  const s = newScene();
  const ar = 233 / 627, ph = 5.0;
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(ph * ar, ph), new THREE.MeshBasicMaterial({ map: photoTex, transparent: true, toneMapped: false, depthWrite: false }));
  photo.position.set(2.8, -.6, 0); s.g.add(photo);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, .35, 64), std(0x0e1830, { metalness: .8, roughness: .25 })); ped.position.set(2.8, -3.3, 0); s.g.add(ped);
  const pedGlow = new THREE.Mesh(new THREE.TorusGeometry(1.62, .04, 8, 120), emis(COL.cyan, 4)); pedGlow.rotation.x = Math.PI / 2; pedGlow.position.set(2.8, -3.12, 0); s.g.add(pedGlow);
  const rings = [0, 1, 2].map(i => { const r = new THREE.Mesh(new THREE.TorusGeometry(2.2 + i * .35, .015, 6, 160), emis([COL.cyan, COL.violet, COL.amber][i], 3)); r.position.set(2.8, -.6, 0); s.g.add(r); return r; });
  seed = 9;
  const motes = points(500, () => { const a = rnd() * Math.PI * 2, r = 1.6 + rnd() * 2.5; return [2.8 + Math.cos(a) * r, -3 + rnd() * 6, Math.sin(a) * r]; }, { size: .06, color: COL.cyan, k: 2.5 });
  s.g.add(motes);
  const name = panel(1600, 900, 6.2, (c, w, h) => {
    c.textAlign = 'left'; c.textBaseline = 'top';
    c.font = '700 44px Inter'; c.letterSpacing = '14px'; c.fillStyle = '#ffb547'; c.fillText('PREPARED BY', 0, 120);
    c.letterSpacing = '0px'; c.font = '800 190px Inter';
    const g = c.createLinearGradient(0, 0, 1300, 0); g.addColorStop(0, '#3de8ff'); g.addColorStop(1, '#b18cff'); c.fillStyle = g;
    c.shadowColor = 'rgba(61,232,255,.5)'; c.shadowBlur = 40; c.fillText('Sara Salem', 0, 200); c.shadowBlur = 0;
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(0, 450, 900, 3);
    c.font = '600 54px Inter'; c.fillStyle = '#fff'; c.fillText('Thank you for watching', 0, 500);
    c.font = '500 34px Inter'; c.fillStyle = 'rgba(200,220,255,.75)';
    c.fillText('ELIZA · The Machine That Listened', 0, 590);
  }); name.redraw(1); name.position.set(-3.0, .1, 0); s.g.add(name);
  const src = panel(2400, 120, 11, (c, w, h) => { c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '500 34px Inter'; c.fillStyle = 'rgba(190,210,240,.65)';
    c.fillText('Sources: Weizenbaum (1966, 1976) · Reeves & Nass (1996) · Hofstadter (1995) · Jones & Bergen (2025) · Lane et al., “ELIZA Reanimated” (2025)', w / 2, h / 2); });
  src.redraw(1); src.position.set(0, -4.1, .5); s.g.add(src);
  s.update = (lt) => {
    camPath([[0, [-1.5, .4, 15], [0, -.4, 0]], [.1, [.6, -.1, 11.2], [0, -.5, 0], 9]], lt);
    const pk = eout((lt - .4) / 1.6);
    photo.position.y = -.6 - (1 - pk) * .8; setOpacity(photo, pk);
    photo.position.x = 2.8; photo.lookAt(camera.position.x * .3 + 2.8 * .7, photo.position.y, camera.position.z);
    rings.forEach((r, i) => { r.rotation.set(Math.PI / 2 + .25 + Math.sin(lt * .5 + i * 2) * .18, Math.sin(lt * .3 + i) * .15, lt * (.2 + i * .1)); setOpacity(r, pk * .7); });
    pedGlow.material.color.copy(glow(COL.cyan, 3 + Math.sin(lt * 3)));
    motes.rotation.y = lt * .15; motes.material.opacity = pk;
    setOpacity(name, ss(1.2, 2.4, lt)); name.position.x = -3.0 - (1 - eout((lt - 1.2) / 1.5)) * .8;
    setOpacity(src, ss(3, 4, lt) * .9);
  };
  return s;
};

// ======================================================================
// build all scenes
// ======================================================================
const built = TL.scenes.map(S => { const b = SCENES[S.visual](S); b.S = S; b.g.visible = b.hud.visible = false; return b; });

// ---------- overlay elements ----------
const $ = id => document.getElementById(id);
const chapterEl = $('chapter'), capEl = $('cap'), progFill = document.querySelector('#prog .fill');
const fadeEl = $('fade'), flashEl = $('flash'), brandEl = $('brand');
for (const S of TL.scenes) if (S.chapter) { const d = document.createElement('div'); d.className = 'tick'; d.style.left = (S.start / TL.duration * 100) + '%'; $('prog').appendChild(d); }
const grainCv = $('grain'), gctx = grainCv.getContext('2d'), gimg = gctx.createImageData(960, 540);
let capKey = '';
function drawGrain(f) {
  let x = (f * 2654435761) >>> 0; const d = gimg.data;
  for (let i = 0; i < d.length; i += 4) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; const v = (x >>> 0) & 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  gctx.putImageData(gimg, 0, 0);
}
function overlays(t, S, lt) {
  // chapter badge
  if (S.chapter) {
    const [num, ...rest] = S.chapter.split(' · ');
    chapterEl.querySelector('.num').textContent = rest.length ? num : '';
    chapterEl.querySelector('.name').textContent = rest.length ? rest.join(' · ') : num;
    const k = eout((lt - .25) / .8);
    chapterEl.style.opacity = k * (1 - ss(S.end - S.start - .5, S.end - S.start, lt));
    chapterEl.style.transform = `translateX(${(1 - k) * -40}px)`;
  } else chapterEl.style.opacity = 0;
  brandEl.style.opacity = ['title', 'outro'].includes(S.id) || (S.id === 'cold_open' && lt < 30) ? 0 : 1;
  // captions with word-by-word highlight
  let line = null;
  for (const s2 of TL.scenes) for (const l of s2.lines) if (t >= l.start - .08 && t <= l.end + .35) line = l;
  if (S.id === 'title' || S.id === 'outro' || current?.hideCap?.(lt)) line = null;
  if (line) {
    const words = line.t.split(' ');
    const total = line.t.length, p = cl((t - line.start) / (line.end - line.start)) * total;
    let acc = 0, html = '';
    words.forEach((w, i) => { const st = acc; acc += w.length + 1; html += `<span class="${p >= acc - 1 ? 'on' : p >= st ? 'now' : ''}">${line.s === 'E' ? w.toUpperCase() : w}</span>${i < words.length - 1 ? ' ' : ''}`; });
    const k = line.t + '|' + html;
    if (k !== capKey) { capKey = k; capEl.className = line.s; capEl.querySelector('.spk').className = 'spk ' + line.s; capEl.querySelector('.spk').textContent = line.s === 'E' ? 'ELIZA' : line.s === 'U' ? 'PATIENT' : ''; capEl.querySelector('.spk').style.display = line.s === 'N' ? 'none' : 'inline-block'; capEl.querySelector('.txt').innerHTML = html; }
    capEl.style.opacity = Math.min(ss(line.start - .08, line.start + .12, t), 1 - ss(line.end + .15, line.end + .35, t));
  } else capEl.style.opacity = 0;
  progFill.style.width = (t / TL.duration * 100) + '%';
  // scene transitions: dip to black around each boundary, plus fade in/out of the film
  let f = 1 - ss(0, 1.2, t);
  for (const s2 of TL.scenes) if (s2.start > 0) f = Math.max(f, 1 - cl(Math.abs(t - s2.start) / .38));
  f = Math.max(f, ss(TL.duration - 1.6, TL.duration - .1, t));
  fadeEl.style.opacity = f;
  // light flash when the title slams in
  const ti = TL.scenes.find(x => x.id === 'title');
  flashEl.style.opacity = .85 * Math.max(0, 1 - Math.abs(t - ti.start - .95) / .35);
}

let current = null;
window.renderAt = (t, frame = 0) => {
  const b = built.find(x => t >= x.S.start && t < x.S.end) || built[built.length - 1];
  if (current !== b) { if (current) { current.g.visible = current.hud.visible = false; current.leave?.(); } b.g.visible = b.hud.visible = true; current = b; }
  const lt = t - b.S.start;
  env.rotation.y = t * .004; dust.rotation.y = t * .02; dust.position.y = Math.sin(t * .1) * .5;
  grid.visible = !['outro', 'title', 'helix'].includes(b.S.id);
  b.update(lt, t);
  overlays(t, b.S, lt);
  drawGrain(frame);
  composer.render();
};
window.TL = TL;
window.ready = true;
