import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { bodyPolygon, wallPolygon, aabb } from './planGeometry';
import { scaledPoints, lShapePoints, stairArm, shade, hProfilePoints, rectPoints } from './planShapes';
import { isVertical, defaultLevelHeight, wallTypeOf, libraryByKey, steelProfile } from './planLibrary';
import { fileUrl } from './planFiles';
import { loadModelScene, faceTexture, fitModel } from './modelTools';
import { hasFaces } from './planLibrary';

/**
 * 배치도 3D 보기
 * - 배치도 좌표(mm, 오른쪽 x · 아래쪽 y)를 3D(m, 오른쪽 x · 위 y · 앞쪽 z)로 옮김: (x, y) → (x, 높이, y)
 * - 층마다 바닥 높이 = 아래층 층고를 모두 더한 값
 * - 문·창·셔터가 벽 위에 있으면 그 자리 벽을 뚫음
 */

const M = 0.001;
const GLASS = '#bae6fd';
const OPENING_SHAPES = ['door', 'door2', 'sliding', 'shutter', 'window', 'glassdoor', 'autodoor'];
const TABLE_SHAPES = ['desk', 'table4', 'bench'];

export function levelElevations(levels) {
  let e = 0;
  return levels.map((l, i) => {
    const h = l.ceiling || defaultLevelHeight(i);
    const r = { elev: e, h };
    e += h;
    return r;
  });
}

/* ───────── 재질·무늬 ───────── */
function makeKit() {
  const mats = new Map();
  const texs = new Map();
  const mat = (color, extra = {}) => {
    const key = `${color}|${JSON.stringify(extra)}`;
    if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...extra }));
    return mats.get(key);
  };
  const glass = (color = GLASS) => mat(color, { transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
  const see = (color, opacity = 0.45) => mat(color, { transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
  const floorTex = (f) => {
    const key = `${f.type}|${f.color}`;
    if (texs.has(key)) return texs.get(key);
    const S = 256;
    const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const g = cv.getContext('2d');
    const c = f.color || '#d9d4c7';
    const line = shade(c, -0.3);
    g.fillStyle = c; g.fillRect(0, 0, S, S);
    g.strokeStyle = line;
    if (f.type === 'tile') {
      g.lineWidth = 4; g.strokeRect(0, 0, S, S);
    } else if (f.type === 'carpet') {
      g.lineWidth = 3; g.strokeRect(0, 0, S / 2, S / 2); g.strokeRect(S / 2, S / 2, S / 2, S / 2); g.strokeRect(S / 2, 0, S / 2, S / 2); g.strokeRect(0, S / 2, S / 2, S / 2);
      g.globalAlpha = 0.35; g.lineWidth = 2;
      for (let k = 1; k < 4; k++) {
        const v = (S / 2) * (k / 4);
        g.beginPath(); g.moveTo(0, v); g.lineTo(S / 2, v); g.moveTo(S / 2, S / 2 + v); g.lineTo(S, S / 2 + v);
        g.moveTo(S / 2 + v, 0); g.lineTo(S / 2 + v, S / 2); g.moveTo(v, S / 2); g.lineTo(v, S); g.stroke();
      }
    } else if (f.type === 'wood') {
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, 1); g.lineTo(S, 1); g.moveTo(0, S / 2); g.lineTo(S, S / 2);
      g.moveTo(1, 0); g.lineTo(1, S / 2); g.moveTo(S / 2, S / 2); g.lineTo(S / 2, S); g.stroke();
      g.globalAlpha = 0.3; g.lineWidth = 2;
      g.beginPath(); g.moveTo(S * 0.1, S * 0.25); g.lineTo(S * 0.45, S * 0.25); g.moveTo(S * 0.6, S * 0.72); g.lineTo(S * 0.9, S * 0.72); g.stroke();
    } else if (f.type === 'concrete') {
      g.fillStyle = line; g.globalAlpha = 0.35;
      for (let k = 0; k < 40; k++) { g.beginPath(); g.arc((k * 97) % S, (k * 53) % S, 2 + (k % 3), 0, Math.PI * 2); g.fill(); }
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    texs.set(key, t);
    return t;
  };
  const dispose = () => { mats.forEach(m => m.dispose()); texs.forEach(t => t.dispose()); };
  return { mat, glass, see, floorTex, dispose };
}

/* ───────── 기본 도형 (단위 mm, 그룹 안쪽 좌표: 앞쪽 = +z) ───────── */
function box(g, w, h, d, x, y0, z, material, shadow = true) {
  if (w <= 0 || h <= 0 || d <= 0) return null;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w * M, h * M, d * M), material);
  m.position.set(x * M, (y0 + h / 2) * M, z * M);
  m.castShadow = shadow; m.receiveShadow = true;
  g.add(m);
  return m;
}
function cyl(g, r, h, x, y0, z, material, sx = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r * M, r * M, h * M, 28), material);
  m.position.set(x * M, (y0 + h / 2) * M, z * M);
  m.scale.set(sx, 1, sz);
  m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  return m;
}
/** 바닥 모양(점들)을 위로 뽑아 올림. holes: 구멍 모양들 */
function extrude(g, pts, h, y0, material, holes = []) {
  const toShape = (ps, S = THREE.Shape) => new S(ps.map(p => new THREE.Vector2(p.x * M, -p.y * M)));
  const shape = toShape(pts);
  holes.forEach(hp => shape.holes.push(toShape(hp, THREE.Path)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h * M, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, material);
  m.position.y = y0 * M;
  m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  return m;
}

function carModel(g, w, d, h, y0, color, kit) {
  const body = kit.mat(color, { roughness: 0.35, metalness: 0.4 });
  const dark = kit.mat('#1f2937', { roughness: 0.9 });
  const win = kit.mat('#334155', { roughness: 0.15, metalness: 0.3 });
  box(g, w, h * 0.42, d, 0, y0 + h * 0.15, 0, body);
  box(g, w * 0.86, h * 0.4, d * 0.5, 0, y0 + h * 0.57, -d * 0.04, win);
  [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
    const wh = cyl(g, 330, 220, sx * (w / 2 - 110), 0, sz * (d / 2 - 850), dark);
    wh.rotation.z = Math.PI / 2;
    wh.position.y = (y0 + 330) * M;
  });
}

/** 계단 한 칸 (solid: 바닥까지 꽉 찬 콘크리트 / 아니면 얇은 디딤판) */
function step(g, x0, x1, z0, z1, top, material, solid) {
  const w = Math.abs(x1 - x0); const d = Math.abs(z1 - z0);
  if (solid) box(g, w, top, d, (x0 + x1) / 2, 0, (z0 + z1) / 2, material);
  else box(g, w, 50, d, (x0 + x1) / 2, top - 50, (z0 + z1) / 2, material);
}

function buildStairs(g, it, H, kit) {
  const { w, d } = it; const hw = w / 2; const hd = d / 2;
  const mat = kit.mat(it.color || '#94a3b8');
  const solid = it.key !== 'stairsSteel';
  const n = Math.max(3, Math.ceil(H / 180));
  const top = (k) => (H * k) / n;
  if (it.shape === 'stairs') {
    for (let i = 0; i < n; i++) step(g, -hw, hw, hd - (d * i) / n, hd - (d * (i + 1)) / n, top(i + 1), mat, solid);
    return;
  }
  if (it.shape === 'stairsU') {
    const sw = stairArm(it); const L = Math.min(sw, d * 0.4);
    const n1 = Math.ceil(n / 2); const run = d - L;
    for (let i = 0; i < n1 - 1; i++) step(g, hw - sw, hw, hd - (run * i) / (n1 - 1), hd - (run * (i + 1)) / (n1 - 1), top(i + 1), mat, solid);
    step(g, -hw, hw, -hd, -hd + L, top(n1), mat, solid);
    const n2 = n - n1;
    for (let j = 0; j < n2; j++) step(g, -hw, -hw + sw, -hd + L + (run * j) / n2, -hd + L + (run * (j + 1)) / n2, top(n1 + j + 1), mat, solid);
    return;
  }
  if (it.shape === 'stairsL') {
    const sw = stairArm(it); const runA = d - sw; const runB = w - sw;
    const nA = Math.max(1, Math.round(((n - 1) * runA) / (runA + runB))); const nB = n - 1 - nA;
    for (let i = 0; i < nA; i++) step(g, hw - sw, hw, hd - (runA * i) / nA, hd - (runA * (i + 1)) / nA, top(i + 1), mat, solid);
    step(g, hw - sw, hw, -hd, -hd + sw, top(nA + 1), mat, solid);
    for (let j = 0; j < nB; j++) step(g, hw - sw - (runB * j) / nB, hw - sw - (runB * (j + 1)) / nB, -hd, -hd + sw, top(nA + 2 + j), mat, solid);
    return;
  }
  if (it.shape === 'stairsSpiral') {
    const r = Math.min(w, d) / 2; const span = (330 * Math.PI) / 180; const dt = span / n;
    cyl(g, 80, H, 0, 0, 0, kit.mat(shade(it.color || '#94a3b8', -0.3)));
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r * M, r * M, 50 * M, 10, 1, false, i * dt, dt * 1.02), mat);
      m.position.y = (top(i + 1) - 25) * M;
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
    }
  }
}

/** 3D 모델 파일(GLB) 비품: 읽는 동안은 흐린 상자, 다 읽으면 크기에 맞춰 바꿔 끼움 */
function buildModelItem(it, ctx) {
  const g = new THREE.Group();
  const ph = box(g, it.w, it.h || 800, it.d, 0, 0, 0, ctx.kit.see(it.color || '#94a3b8', 0.25), false);
  loadModelScene(it.model.url).then(src => {
    const obj = fitModel(src, { w: it.w, d: it.d, h: it.h, rot: it.modelRot || 0 });
    g.remove(ph); ph.geometry.dispose();
    g.add(obj);
  }).catch(err => {
    console.warn('3D 모델 읽기 실패', err);
    ph.material = ctx.kit.see('#ef4444', 0.35);
    ctx.onModelError?.(it.name);
  });
  return g;
}

/** 사진 상자: 면마다 사진을 붙인 상자 (사진이 없는 면은 색) */
function buildPhotoBox(it, ctx) {
  const g = new THREE.Group();
  const f = it.faces || {};
  const plain = ctx.kit.mat(it.color || '#cbd5e1');
  const face = (url) => (url ? new THREE.MeshStandardMaterial({ map: faceTexture(url), roughness: 0.8 }) : plain);
  // 상자 면 순서: 오른쪽(+x), 왼쪽(-x), 위, 아래, 앞(+z), 뒤(-z)
  const mats = [face(f.right), face(f.left), face(f.top), plain, face(f.front), face(f.back)];
  const bh = it.h || 1000;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(it.w * M, bh * M, it.d * M), mats);
  mesh.position.y = (bh / 2) * M;
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.userData.ownMaterials = mats.filter(x => x !== plain);
  g.add(mesh);
  return g;
}

function buildItem(src, ctx) {
  if (src.model?.url) return buildModelItem(src, ctx);
  if (hasFaces(src)) return buildPhotoBox(src, ctx);
  // 3D 모양 빌리기: 크기·색은 그대로, 모양만 목록 비품처럼
  const lib = src.look ? libraryByKey(src.look) : null;
  const it = lib ? { ...src, shape: lib.shape, key: lib.key, arm: src.arm ?? lib.arm, lift: src.lift ?? lib.lift } : src;
  const { kit, H, showCar, vehicleH } = ctx;
  const g = new THREE.Group();
  const { w, d } = it; const hw = w / 2; const hd = d / 2;
  const c = it.color || '#94a3b8';
  const m = kit.mat(c);
  const h = it.h || 0;
  const darker = kit.mat(shade(c, -0.35));
  const metal = kit.mat('#d1d5db', { metalness: 0.7, roughness: 0.3 });
  const rubber = kit.mat('#1f2937', { roughness: 0.95 });
  const seam = kit.mat(shade(c, -0.45));
  const wheel = (x, z, r = 50, y = 0) => { const wh = cyl(g, r, r * 0.8, x, 0, z, rubber); wh.rotation.z = Math.PI / 2; wh.position.y = (y + r) * M; };
  switch (it.shape) {
    case 'cabinet': {
      const ch = h || 1800;
      if (it.key === 'toolbox') {
        // 롤 캐비닛: 서랍 여러 칸 + 바퀴
        box(g, w, ch - 120, d, 0, 120, 0, m);
        const n = 6;
        for (let k = 1; k < n; k++) box(g, w - 40, 10, 12, 0, 120 + ((ch - 160) * k) / n, hd + 2, seam, false);
        for (let k = 0; k < n; k++) box(g, w * 0.55, 22, 25, 0, 120 + ((ch - 160) * (k + 0.55)) / n, hd + 14, metal, false);
        [-1, 1].forEach(sx => [-1, 1].forEach(sz => wheel(sx * (hw - 70), sz * (hd - 70), 55)));
      } else {
        box(g, w, ch, d, 0, 0, 0, m);
        const doors = w > 650 ? 2 : 1;
        if (doors === 2) box(g, 10, ch - 60, 12, 0, 30, hd + 2, seam, false);
        const hx = doors === 2 ? [-60, 60] : [hw - 80];
        hx.forEach(x => box(g, 22, Math.min(220, ch * 0.2), 25, x, ch * 0.45, hd + 14, metal, false));
        box(g, w, 60, d + 10, 0, 0, 0, seam, false);
      }
      break;
    }
    case 'locker': {
      const ch = h || 1800; const cols = Math.max(1, Math.round(w / 300)); const rows = ch > 1200 ? 2 : 1;
      box(g, w, ch, d, 0, 0, 0, m);
      for (let k = 1; k < cols; k++) box(g, 10, ch - 40, 12, -hw + (w * k) / cols, 20, hd + 2, seam, false);
      for (let r = 1; r < rows; r++) box(g, w - 20, 10, 12, 0, (ch * r) / rows, hd + 2, seam, false);
      for (let k = 0; k < cols; k++) {
        for (let r = 0; r < rows; r++) {
          const x = -hw + (w * (k + 0.5)) / cols; const y0 = (ch * r) / rows;
          box(g, 18, 90, 22, x + w / cols / 2 - 50, y0 + ch / rows * 0.45, hd + 12, metal, false);
          [0, 1, 2].forEach(v => box(g, w / cols * 0.5, 12, 6, x, y0 + ch / rows - 150 - v * 35, hd + 4, seam, false));
        }
      }
      break;
    }
    case 'tirechanger': {
      const th = h || 1900; const baseH = 850; const tz = d * 0.08;
      box(g, w * 0.72, baseH, d * 0.78, 0, 0, d * 0.02, m);
      cyl(g, Math.min(w, d) * 0.33, 60, 0, baseH, tz, darker);
      [0, 1, 2, 3].forEach(k => { const a = (k * Math.PI) / 2; box(g, 70, 60, 70, Math.cos(a) * Math.min(w, d) * 0.25, baseH + 60, tz + Math.sin(a) * Math.min(w, d) * 0.25, metal); });
      const colZ = -hd + 110;
      box(g, 150, th - baseH, 150, 0, baseH, colZ, m);
      box(g, 110, 110, tz - colZ + 60, 0, th - 160, (colZ + tz) / 2, m);
      box(g, 70, 600, 70, 0, th - 760, tz, metal);
      box(g, 120, 80, 160, 0, th - 840, tz, darker);
      [-1, 0, 1].forEach(k => box(g, 90, 40, 140, k * 130, 0, hd - 40, rubber));
      break;
    }
    case 'balancer': {
      const bx = hw - w * 0.24;
      box(g, w * 0.48, 950, d * 0.7, bx, 0, 0, m);
      const shaft = cyl(g, 25, w * 0.3, 0, 0, 0, metal); shaft.rotation.z = Math.PI / 2; shaft.position.set((bx - w * 0.24 - w * 0.15) * M, 650 * M, 0);
      const tire = cyl(g, 320, 210, 0, 0, 0, rubber); tire.rotation.z = Math.PI / 2; tire.position.set((-hw + w * 0.2) * M, 650 * M, 0);
      const rim = cyl(g, 190, 220, 0, 0, 0, metal); rim.rotation.z = Math.PI / 2; rim.position.set((-hw + w * 0.2) * M, 650 * M, 0);
      box(g, w * 0.42, 50, 700, -hw + w * 0.2, 1080, 0, kit.see(c, 0.6));
      box(g, w * 0.36, 300, 50, bx, 1100, -d * 0.2, kit.mat('#111827', { roughness: 0.3 }));
      break;
    }
    case 'compressor': {
      const r = Math.min(d * 0.4, 320); const len = w * 0.88;
      const tank = cyl(g, r, len, 0, 0, 0, m); tank.rotation.z = Math.PI / 2; tank.position.y = (r + 130) * M;
      [-1, 1].forEach(sx => box(g, 120, 130, d * 0.7, sx * len * 0.35, 0, 0, darker));
      box(g, w * 0.32, 300, d * 0.55, -w * 0.15, r * 2 + 130, 0, darker);
      cyl(g, 120, 260, w * 0.2, r * 2 + 130, 0, metal);
      break;
    }
    case 'cart': {
      if (it.key === 'jack') {
        box(g, w * 0.6, 220, d * 0.7, 0, 90, d * 0.1, m);
        [-1, 1].forEach(sx => wheel(sx * w * 0.25, hd - 150, 70));
        [-1, 1].forEach(sx => wheel(sx * w * 0.25, -hd * 0.3, 70));
        const handle = box(g, 40, 40, d * 0.55, 0, 0, 0, metal);
        handle.rotation.x = 0.7; handle.position.set(0, 600 * M, (-hd + d * 0.15) * M);
      } else {
        const ch = h || 900;
        [0, 1, 2].forEach(k => { const y = 150 + ((ch - 200) * k) / 2; box(g, w, 30, d, 0, y, 0, m); box(g, w, 60, 15, 0, y, hd - 8, m); box(g, w, 60, 15, 0, y, -hd + 8, m); });
        [-1, 1].forEach(sx => [-1, 1].forEach(sz => { box(g, 30, ch - 100, 30, sx * (hw - 20), 100, sz * (hd - 20), darker); wheel(sx * (hw - 40), sz * (hd - 40), 45); }));
        box(g, 30, 30, d * 0.8, hw + 40, ch - 30, 0, metal);
      }
      break;
    }
    case 'counter': {
      const ch = h || 1050; const light = kit.mat(shade(c, 0.35));
      box(g, w, ch, 120, 0, 0, hd - 60, m);
      box(g, w + 40, 30, 320, 0, ch - 30, hd - 160, light);
      box(g, w, 750, d - 140, 0, 0, -70, light);
      break;
    }
    case 'sink2': {
      const ch = h || 850; const white = kit.mat('#f8fafc', { roughness: 0.25 });
      box(g, w, ch - 40, d - 20, 0, 0, -10, m);
      box(g, w, 40, d, 0, ch - 40, 0, white);
      [-1, 1].forEach(sx => {
        cyl(g, Math.min(220, d * 0.35), 8, sx * w / 4, ch, d * 0.05, kit.mat('#cbd5e1'), 1.3, 1);
        box(g, 30, 180, 30, sx * w / 4, ch, -hd + 70, metal);
      });
      break;
    }
    case 'bench': {
      const th = h || 900;
      box(g, w, 50, d, 0, th - 50, 0, kit.mat(shade(c, 0.2)));
      [-1, 1].forEach(sx => [-1, 1].forEach(sz => box(g, 60, th - 50, 60, sx * (hw - 50), 0, sz * (hd - 50), darker)));
      box(g, w - 100, 30, d - 100, 0, 180, 0, darker);
      box(g, 200, 160, 180, hw - 200, th, hd - 120, kit.mat('#475569', { metalness: 0.5 }));
      break;
    }
    case 'roundbox': {
      const bh = h || 800; const r = Math.min(w, d, bh) * 0.15;
      const mesh = new THREE.Mesh(new RoundedBoxGeometry(w * M, bh * M, d * M, 4, r * M), m);
      mesh.position.y = (bh / 2) * M; mesh.castShadow = true; mesh.receiveShadow = true;
      g.add(mesh);
      break;
    }
    case 'circle': {
      if (it.key === 'extinguisher') {
        const red = kit.mat('#dc2626', { roughness: 0.4 });
        cyl(g, Math.min(w, d) * 0.3, (h || 600) * 0.8, 0, 0, 0, red);
        box(g, 60, 90, 60, 0, (h || 600) * 0.8, 0, rubber);
        box(g, 140, 20, 30, 40, (h || 600) * 0.8 + 70, 0, metal);
      } else if (it.key === 'oildrain') {
        const th = h || 1700;
        cyl(g, hw * 0.75, th * 0.45, 0, 0, 0, m);
        cyl(g, 30, th * 0.4, 0, th * 0.45, 0, metal);
        const funnel = new THREE.Mesh(new THREE.CylinderGeometry(hw * M, 60 * M, 220 * M, 24, 1, true), kit.mat('#f59e0b', { side: THREE.DoubleSide }));
        funnel.position.y = (th * 0.85 + 110) * M; funnel.castShadow = true;
        g.add(funnel);
        [0, 1, 2].forEach(k => { const a = (k * Math.PI * 2) / 3; wheel(Math.cos(a) * hw * 0.6, Math.sin(a) * hw * 0.6, 40); });
      } else {
        cyl(g, hw, h || 800, 0, 0, 0, m, 1, d / w);
      }
      break;
    }
    case 'box': {
      const bh = h || 800;
      if (it.key === 'fridge') {
        box(g, w, bh, d, 0, 0, 0, m);
        if (w > 800) box(g, 10, bh - 40, 12, 0, 20, hd + 2, seam, false);
        else box(g, w - 20, 10, 12, 0, bh * 0.62, hd + 2, seam, false);
        (w > 800 ? [-60, 60] : [hw - 70]).forEach(x => box(g, 22, 300, 30, x, bh * 0.4, hd + 15, metal, false));
      } else if (it.key === 'water') {
        box(g, w, bh * 0.78, d, 0, 0, 0, m);
        cyl(g, w * 0.38, bh * 0.22, 0, bh * 0.78, 0, kit.see('#38bdf8', 0.55));
        box(g, 100, 60, 40, 0, bh * 0.5, hd + 20, metal);
      } else if (it.key === 'coffee') {
        box(g, w, 900, d, 0, 0, 0, kit.mat('#a16207'));
        box(g, w * 0.5, 420, d * 0.7, -w * 0.15, 900, -d * 0.05, kit.mat('#1f2937', { roughness: 0.4, metalness: 0.3 }));
        cyl(g, 45, 100, w * 0.3, 900, 0, kit.mat('#f8fafc'));
      } else if (it.key === 'pillar_sign') {
        ['#3b82f6', '#22c55e', '#f59e0b'].forEach((col, k) => {
          const bw = w / 3 - 20; const x = -hw + (w * (k + 0.5)) / 3;
          box(g, bw, bh - 60, d, x, 0, 0, kit.mat(col));
          box(g, bw + 10, 60, d + 10, x, bh - 60, 0, kit.mat(shade(col, -0.3)));
        });
      } else {
        box(g, w, bh, d, 0, 0, 0, m);
      }
      break;
    }
    case 'lift2': {
      const lh = h || 3800; const armY = showCar ? (it.lift || 1800) : 100;
      [-1, 1].forEach(sx => box(g, 300, lh, 350, sx * (hw - 150), 0, 0, m));
      box(g, w - 600, 25, 300, 0, 0, 0, darker);
      [-1, 1].forEach(sx => [-1, 1].forEach(sz => box(g, hw * 0.55, 70, 110, sx * (hw - 300 - hw * 0.275), armY, sz * 380, darker)));
      if (showCar) carModel(g, 1850, 4800, vehicleH || 1450, armY + 70, '#94a3b8', kit);
      break;
    }
    case 'lift4': {
      const lh = h || 2400; const runY = showCar ? (it.lift || 1800) : 150;
      [-1, 1].forEach(sx => [-1, 1].forEach(sz => box(g, 250, lh, 250, sx * (hw - 125), 0, sz * (hd - 125), m)));
      [-1, 1].forEach(sz => box(g, w, 200, 250, 0, lh - 200, sz * (hd - 125), m));
      const rw = Math.min(650, w * 0.22);
      [-1, 1].forEach(sx => box(g, rw, 150, d - 600, sx * (hw - 300 - rw / 2), runY, 0, darker));
      if (showCar) carModel(g, 1850, 4800, vehicleH || 1450, runY + 150, '#94a3b8', kit);
      break;
    }
    case 'scissor': {
      const y = showCar ? (it.lift || 1800) : 0;
      [-1, 1].forEach(sx => box(g, 600, 120, d, sx * (hw - 300), y, 0, m));
      if (showCar && y > 300) [-1, 1].forEach(sx => box(g, 120, y, 120, sx * (hw - 300), 0, 0, darker));
      if (showCar) carModel(g, 1850, 4800, vehicleH || 1450, y + 120, '#94a3b8', kit);
      break;
    }
    case 'car':
      carModel(g, w, d, h || 1450, 0, c, kit);
      break;
    case 'stairs': case 'stairsU': case 'stairsL': case 'stairsSpiral':
      buildStairs(g, it, H, kit);
      break;
    case 'elevator': {
      const s = kit.see(c, 0.35);
      box(g, w, H, 100, 0, 0, -hd + 50, s, false);
      [-1, 1].forEach(sx => box(g, 100, H, d, sx * (hw - 50), 0, 0, s, false));
      const door = w * 0.56;
      [-1, 1].forEach(sx => box(g, (w - door) / 2, H, 100, sx * (hw - (w - door) / 4), 0, hd - 50, s, false));
      box(g, door, Math.max(0, H - 2300), 100, 0, 2300, hd - 50, s, false);
      box(g, w * 0.8, Math.min(2400, H - 100), d * 0.8, 0, 0, 0, kit.mat(shade(c, 0.55)));
      break;
    }
    case 'ramp': {
      const L = Math.hypot(d, H); const a = Math.atan2(H, d);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w * M, 200 * M, L * M), m);
      slab.rotation.x = a;
      slab.position.set(0, (H / 2 - 100) * M, 0);
      slab.castShadow = true; slab.receiveShadow = true;
      g.add(slab);
      break;
    }
    case 'door': case 'door2': case 'sliding': {
      const dh = h || 2100;
      box(g, w, dh, 45, 0, 0, 0, kit.mat(c, { roughness: 0.6 }));
      if (it.shape === 'door2') box(g, 20, dh, 60, 0, 0, 0, darker);
      break;
    }
    case 'glassdoor': case 'autodoor': case 'glasspanel': {
      const dh = h || (it.shape === 'glasspanel' ? 2400 : 2100);
      box(g, w, dh, 25, 0, 0, 0, kit.glass(), false);
      box(g, w, 50, Math.max(d, 60), 0, dh - 50, 0, kit.mat(shade(c, -0.2)));
      if (it.shape === 'autodoor') box(g, w + 200, 300, 250, 0, dh, 0, kit.mat('#64748b'));
      break;
    }
    case 'window':
      box(g, w, h || 1200, 25, 0, 0, 0, kit.glass(), false);
      box(g, w, 40, Math.max(d, 80), 0, 0, 0, kit.mat('#cbd5e1'));
      break;
    case 'shutter':
      box(g, w, 450, d, 0, (h || 4000), 0, kit.mat(shade(c, -0.1)));
      break;
    case 'column':
      box(g, w, H, d, 0, 0, 0, kit.mat('#a8a29e'));
      break;
    case 'hbeam': {
      // H빔 기둥: 단면 그대로 층고까지 + 바닥 베이스 플레이트
      const p = steelProfile('hbeam', w, d, it.prof);
      extrude(g, hProfilePoints(w, d, p.tw, p.tf), h || H, 0, kit.mat(c, { metalness: 0.55, roughness: 0.4 }));
      box(g, w + 120, 20, d + 120, 0, 0, 0, darker);
      break;
    }
    case 'sqpipe': {
      const p = steelProfile('sqpipe', w, d, it.prof);
      const t = Math.min(p.t, w / 3, d / 3);
      extrude(g, rectPoints(w, d), h || H, 0, kit.mat(c, { metalness: 0.55, roughness: 0.4 }), [rectPoints(w - 2 * t, d - 2 * t)]);
      box(g, w + 80, 12, d + 80, 0, 0, 0, darker);
      break;
    }
    case 'tv':
      box(g, w, h || 830, Math.max(d, 60), 0, 0, 0, kit.mat('#111827', { roughness: 0.3 }));
      break;
    case 'trench': case 'drain':
      box(g, w, 12, d, 0, 0, 0, kit.mat('#475569', { metalness: 0.5, roughness: 0.4 }), false);
      break;
    case 'desk': case 'table4': {
      const th = h || 720;
      box(g, w, 40, d, 0, th - 40, 0, m);
      [-1, 1].forEach(sx => [-1, 1].forEach(sz => box(g, 50, th - 40, 50, sx * (hw - 60), 0, sz * (hd - 60), darker)));
      break;
    }
    case 'roundtable':
      cyl(g, hw, 40, 0, (h || 720) - 40, 0, m, 1, d / w);
      cyl(g, 60, (h || 720) - 40, 0, 0, 0, darker);
      break;
    case 'chair': {
      const seat = 450;
      box(g, w * 0.9, 60, d * 0.85, 0, seat - 60, d * 0.05, m);
      box(g, w * 0.9, Math.max(200, (h || 900) - seat), 60, 0, seat, -hd + 60, m);
      cyl(g, 30, seat - 60, 0, 0, 0, darker);
      break;
    }
    case 'sofa': {
      const sh = h || 800;
      box(g, w, 420, d, 0, 0, 0, m);
      box(g, w, sh, d * 0.22, 0, 0, -hd + d * 0.11, m);
      [-1, 1].forEach(sx => box(g, Math.min(180, w * 0.12), 620, d, sx * (hw - Math.min(90, w * 0.06)), 0, 0, m));
      break;
    }
    case 'toilet': {
      const white = kit.mat('#f8fafc', { roughness: 0.3 });
      box(g, w, h || 800, d * 0.28, 0, 0, -hd + d * 0.14, white);
      cyl(g, w * 0.45, 400, 0, 0, d * 0.12, white, 1, (d * 0.7) / (w * 0.9));
      break;
    }
    case 'urinal':
      box(g, w, (h || 650), d, 0, 450, 0, kit.mat('#f8fafc', { roughness: 0.3 }));
      break;
    case 'sink':
      box(g, w, 180, d, 0, (h || 850) - 180, 0, kit.mat('#f8fafc', { roughness: 0.3 }));
      break;
    case 'shower':
      box(g, w, 80, d, 0, 0, 0, kit.mat('#f1f5f9'));
      box(g, w, h || 2000, d, 0, 80, 0, kit.glass(), false);
      break;
    case 'stall': case 'stallA': {
      const ph = h || 2100; const p = kit.mat(shade(c, -0.08));
      box(g, w, ph, 30, 0, 0, -hd + 15, p);
      [-1, 1].forEach(sx => box(g, 30, ph - 150, d, sx * (hw - 15), 150, 0, p));
      box(g, w * 0.3, ph - 150, 30, -hw + w * 0.15, 150, hd - 15, p);
      const white = kit.mat('#f8fafc', { roughness: 0.3 });
      box(g, 400, 800, 200, 0, 0, -hd + 130, white);
      cyl(g, 180, 400, 0, 0, -hd + 450, white, 1, 1.4);
      break;
    }
    case 'shelf': {
      const sh = h || 2100; const levels = 4;
      [-1, 1].forEach(sx => [-1, 1].forEach(sz => box(g, 50, sh, 50, sx * (hw - 25), 0, sz * (hd - 25), darker)));
      for (let k = 0; k < levels; k++) box(g, w, 30, d, 0, 150 + ((sh - 200) * k) / (levels - 1), 0, m);
      break;
    }
    case 'circle':
      cyl(g, hw, h || 800, 0, 0, 0, m, 1, d / w);
      break;
    case 'lshape':
      extrude(g, lShapePoints(w, d, it.arm), h || 900, 0, m);
      break;
    case 'poly':
      extrude(g, scaledPoints(it), h || 800, 0, m);
      break;
    case 'image': {
      const bh = h || 800;
      const tex = new THREE.TextureLoader().load(it.img);
      tex.colorSpace = THREE.SRGBColorSpace;
      const side = kit.mat(c);
      const topMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w * M, bh * M, d * M), [side, side, topMat, side, side, side]);
      mesh.position.y = (bh / 2) * M;
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.userData.ownMaterials = [topMat, tex];
      g.add(mesh);
      break;
    }
    default: {
      if (TABLE_SHAPES.includes(it.shape)) break;
      box(g, w, h || 800, d, 0, 0, 0, m);
    }
  }
  return g;
}

/* ───────── 벽 (문·창 자리는 뚫기) ───────── */
function wallOpenings(wall, items) {
  const dx = wall.x2 - wall.x1; const dy = wall.y2 - wall.y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len; const uy = dy / len;
  const wallAng = Math.atan2(dy, dx);
  const out = [];
  items.forEach(it => {
    if (!OPENING_SHAPES.includes(it.shape)) return;
    const rx = it.x - wall.x1; const ry = it.y - wall.y1;
    const s = rx * ux + ry * uy;
    const n = Math.abs(rx * -uy + ry * ux);
    const itAng = ((it.rot || 0) * Math.PI) / 180;
    if (n > wall.t / 2 + Math.max(it.d / 2, 100) || s < -it.w / 2 || s > len + it.w / 2) return;
    if (Math.abs(Math.sin(itAng - wallAng)) > 0.2) return;
    const isWin = it.shape === 'window';
    const bottom = isWin ? (it.elev ?? 900) : 0;
    const top = isWin ? bottom + (it.h || 1200) : (it.h || (it.shape === 'shutter' ? 4000 : 2100));
    out.push({ s0: s - it.w / 2, s1: s + it.w / 2, bottom, top });
  });
  return out.sort((a, b) => a.s0 - b.s0);
}

function buildWall(wall, items, H, kit) {
  const g = new THREE.Group();
  const type = wall.type || 'concrete';
  const wt = wallTypeOf(type);
  const dx = wall.x2 - wall.x1; const dy = wall.y2 - wall.y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return g;
  const t = wall.t || 200;
  const Hw = wall.h || H;
  g.position.set(wall.x1 * M, 0, wall.y1 * M);
  g.rotation.y = -Math.atan2(dy, dx);

  // 보(H빔·각파이프): 단면을 벽 길이만큼 뽑아 머리 위(윗면 = 보 높이 또는 층고)에 걸침
  if (wt.beam) {
    const depth = Number(wall.depth) || t;
    const top = Number(wall.h) || H;
    let outer; let holes = [];
    if (wt.beam === 'hbeam') {
      const p = steelProfile('hbeam', t, depth);
      outer = hProfilePoints(t, depth, p.tw, p.tf);
    } else {
      const p = steelProfile('sqpipe', t, depth);
      const th = Math.min(p.t, t / 3, depth / 3);
      outer = rectPoints(t, depth);
      holes = [rectPoints(t - 2 * th, depth - 2 * th)];
    }
    const toV = (pts) => pts.map(p => new THREE.Vector2(p.x * M, p.y * M));
    const shape = new THREE.Shape(toV(outer));
    holes.forEach(hp => shape.holes.push(new THREE.Path(toV(hp))));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: len * M, bevelEnabled: false });
    geo.rotateY(Math.PI / 2); // 뽑는 방향(+z)을 벽 길이 방향(+x)으로
    const mesh = new THREE.Mesh(geo, kit.mat(wall.color || wt.color || '#475569', { metalness: 0.55, roughness: 0.4 }));
    mesh.position.y = (top - depth / 2) * M;
    mesh.castShadow = true; mesh.receiveShadow = true;
    g.add(mesh);
    g.userData.label = `${wt.short} (아래 ${((top - depth) / 1000).toFixed(2)}m)`;
    return g;
  }
  const glassy = type === 'glass' || type === 'curtain';
  const solid = glassy ? kit.glass() : kit.mat(wall.color || (type === 'light' ? (wt.color || '#d6d3d1') : '#e7e5e4'), { roughness: 0.9 });
  const frame = kit.mat(wall.color || (glassy ? '#64748b' : '#a8a29e'));
  // 벽 길이 방향 = 그룹의 +x, 두께 방향 = z
  const piece = (s0, s1, y0, y1) => {
    if (s1 - s0 < 5 || y1 - y0 < 5) return;
    const mesh = box(g, s1 - s0, y1 - y0, t, (s0 + s1) / 2, y0, 0, solid, !glassy);
    if (mesh && glassy) mesh.renderOrder = 2;
  };
  const start = -t / 2; const end = len + t / 2;
  let cur = start;
  wallOpenings(wall, items).forEach(o => {
    const a = Math.max(start, o.s0); const b = Math.min(end, o.s1);
    if (b <= a) return;
    piece(cur, a, 0, Hw);
    piece(a, b, 0, Math.min(o.bottom, Hw));
    piece(a, b, Math.min(o.top, Hw), Hw);
    cur = Math.max(cur, b);
  });
  piece(cur, end, 0, Hw);
  if (glassy) {
    box(g, len + t, 60, t + 20, len / 2, 0, 0, frame);
    box(g, len + t, 60, t + 20, len / 2, Hw - 60, 0, frame);
    const step = type === 'curtain' ? 1200 : 0;
    if (step) for (let s = step; s < len - 100; s += step) box(g, 60, Hw, t + 20, s, 0, 0, frame);
  }
  g.userData.label = wt.short;
  return g;
}

/* ───────── 한 층 ───────── */
function buildLevel(L, i, levels, el, opts, kit) {
  const g = new THREE.Group();
  const { elev: E, h: H } = el[i];
  g.position.y = E * M;
  const pts = [
    ...L.walls.flatMap(w => wallPolygon(w)),
    ...(L.walls.length ? [] : L.items.filter(it => it.kind !== 'text').flatMap(it => bodyPolygon(it))),
  ];
  // 바닥판 (2층부터). 아래층 계단·승강기 자리와 이 층 '뚫린 곳'은 구멍
  if (pts.length) {
    const b = aabb(pts);
    const outline = [{ x: b.x0, y: b.y0 }, { x: b.x1, y: b.y0 }, { x: b.x1, y: b.y1 }, { x: b.x0, y: b.y1 }];
    const inside = (bb) => bb.x0 > b.x0 + 20 && bb.y0 > b.y0 + 20 && bb.x1 < b.x1 - 20 && bb.y1 < b.y1 - 20;
    const overlaps = (a, c) => a.x0 < c.x1 && a.x1 > c.x0 && a.y0 < c.y1 && a.y1 > c.y0;
    const holes = [];
    const holeBoxes = [];
    const addHole = (poly) => {
      const bb = aabb(poly);
      if (!inside(bb) || holeBoxes.some(x => overlaps(x, bb))) return;
      holes.push(poly); holeBoxes.push(bb);
    };
    if (i > 0) levels[i - 1].items.filter(isVertical).forEach(it => addHole(bodyPolygon(it)));
    L.items.filter(it => it.kind === 'void').forEach(it => addHole(bodyPolygon(it)));
    if (i > 0) extrude(g, outline, 200, -200, kit.mat('#d4d4d8', { roughness: 0.95 }), holes);
    else extrude(g, outline, 30, -25, kit.mat('#d6d3d1', { roughness: 0.95 }), holes);
  }
  // 바닥 마감
  L.items.filter(it => it.kind === 'zone').forEach(z => {
    const f = z.floor;
    let material;
    if (f?.type) {
      if (f.type === 'epoxy') material = kit.mat(f.color || '#6f9a7a', { roughness: 0.3 });
      else {
        const base = kit.floorTex(f);
        const tex = base.clone(); tex.needsUpdate = true;
        let rx; let ry;
        if (f.type === 'tile') { rx = z.w / (f.tw || 600); ry = z.d / (f.td || 600); }
        else if (f.type === 'carpet') { rx = z.w / ((f.tw || 500) * 2); ry = z.d / ((f.td || 500) * 2); }
        else if (f.type === 'wood') { rx = z.w / 1200; ry = z.d / 360; }
        else { rx = z.w / 1000; ry = z.d / 1000; }
        tex.repeat.set(rx, ry);
        tex.offset.set(0, (Math.ceil(ry) - ry) % 1);
        material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
        material.userData.own = true;
      }
    } else {
      material = kit.mat(z.color || '#10b981', { transparent: true, opacity: 0.18, depthWrite: false });
    }
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(z.w * M, z.d * M), material);
    plane.rotation.x = -Math.PI / 2;
    const zg = new THREE.Group();
    zg.position.set(z.x * M, 6 * M, z.y * M);
    zg.rotation.y = -((z.rot || 0) * Math.PI) / 180;
    if (z.flip) zg.scale.x = -1;
    plane.receiveShadow = true;
    zg.add(plane);
    zg.userData.label = `${z.name} (바닥)`;
    g.add(zg);
  });
  // 벽
  L.walls.forEach(w => g.add(buildWall(w, L.items, H, kit)));
  // 비품
  L.items.forEach(it => {
    if (['zone', 'text', 'void'].includes(it.kind)) return;
    const ig = buildItem(it, { kit, H, showCar: opts.showCar, vehicleH: opts.vehicleH, onModelError: opts.onModelError });
    ig.position.set(it.x * M, (it.elev || 0) * M, it.y * M);
    ig.rotation.y = -((it.rot || 0) * Math.PI) / 180;
    if (it.flip) ig.scale.x = -1;
    ig.userData.label = it.name;
    g.add(ig);
  });
  g.userData.levelName = L.name;
  return g;
}

function disposeTree(obj) {
  obj.traverse(o => {
    if (o.userData?.shared) return; // 3D 모델 파일: 모양을 여러 비품이 같이 씀
    if (o.geometry) o.geometry.dispose();
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    ms.forEach(m => { if (m.userData?.own) { m.map?.dispose(); m.dispose(); } });
    (o.userData?.ownMaterials || []).forEach(x => x.dispose?.());
  });
}

const VIEWS = [
  { id: 'iso', label: '비스듬히' },
  { id: 'top', label: '위에서' },
  { id: 'front', label: '앞에서' },
  { id: 'side', label: '옆에서' },
];

export default function Plan3D({ levels, currentId, vehicleH, title, onClose }) {
  const wrapRef = useRef(null);
  const tipRef = useRef(null);
  const three = useRef(null);
  const [upTo, setUpTo] = useState(levels.length - 1);
  const [showCar, setShowCar] = useState(false);
  const [err, setErr] = useState('');
  const [modelErrs, setModelErrs] = useState([]);

  // 처음 한 번: 화면·카메라·빛
  useEffect(() => {
    const el = wrapRef.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    } catch {
      setErr('이 기기에서는 3D 화면을 열 수 없어요. (그래픽 기능이 꺼져 있어요)');
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e9eef4');
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.495;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a94a6, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    scene.add(sun); scene.add(sun.target);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#cfd8e3', roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.03; ground.receiveShadow = true;
    scene.add(ground);
    const grid = new THREE.GridHelper(1, 1, 0x94a3b8, 0xcbd5e1);
    scene.add(grid);

    const resize = () => {
      const w = el.clientWidth || 800; const h = el.clientHeight || 500;
      renderer.setSize(w, h);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(el);

    let raf = 0;
    const loop = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); };
    loop();

    // 가리키는 것 이름 보여주기
    const ray = new THREE.Raycaster(); const mouse = new THREE.Vector2();
    let last = 0;
    const onMove = (e) => {
      const now = performance.now();
      if (now - last < 60 || !three.current?.root) return;
      last = now;
      const r = renderer.domElement.getBoundingClientRect();
      mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(mouse, camera);
      const hit = ray.intersectObjects(three.current.root.children, true)[0];
      let o = hit?.object; let label = '';
      while (o && !label) { label = o.userData?.label || ''; o = o.parent; }
      const tip = tipRef.current;
      if (!tip) return;
      if (label) { tip.textContent = label; tip.style.display = 'block'; tip.style.left = `${e.clientX - r.left + 12}px`; tip.style.top = `${e.clientY - r.top + 12}px`; } else tip.style.display = 'none';
    };
    renderer.domElement.addEventListener('pointermove', onMove);

    three.current = { renderer, scene, camera, controls, sun, ground, grid, root: null, kit: null, fitted: false };
    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      renderer.domElement.removeEventListener('pointermove', onMove);
      const t = three.current;
      if (t?.root) { disposeTree(t.root); t.kit?.dispose(); }
      ground.geometry.dispose(); ground.material.dispose(); grid.dispose?.();
      controls.dispose(); renderer.dispose();
      renderer.domElement.remove();
      three.current = null;
    };
  }, []);

  // 배치가 바뀌면 다시 세우기
  useEffect(() => {
    const t = three.current;
    if (!t) return;
    if (t.root) { t.scene.remove(t.root); disposeTree(t.root); t.kit?.dispose(); }
    const kit = makeKit();
    const el = levelElevations(levels);
    const root = new THREE.Group();
    levels.forEach((L, i) => { if (i <= upTo) root.add(buildLevel(L, i, levels, el, { showCar, vehicleH, onModelError: (name) => setModelErrs(e => (e.includes(name) ? e : [...e, name])) }, kit)); });
    t.scene.add(root);
    t.root = root; t.kit = kit;
    // 땅·격자·그림자 범위 맞추기
    const bb = new THREE.Box3().setFromObject(root);
    if (!bb.isEmpty()) {
      const size = bb.getSize(new THREE.Vector3()); const c = bb.getCenter(new THREE.Vector3());
      const R = Math.max(size.x, size.z, 8) + 12;
      t.ground.scale.set(R * 2, R * 2, 1); t.ground.position.set(c.x, -0.03, c.z);
      t.scene.remove(t.grid); t.grid.dispose?.();
      t.grid = new THREE.GridHelper(Math.ceil(R * 2), Math.ceil(R * 2), 0x94a3b8, 0xd5dde7);
      t.grid.position.set(Math.round(c.x), -0.02, Math.round(c.z));
      t.scene.add(t.grid);
      t.sun.position.set(c.x + R * 0.6, c.y + R * 1.2, c.z + R * 0.9);
      t.sun.target.position.copy(c);
      const cam = t.sun.shadow.camera;
      cam.left = -R; cam.right = R; cam.top = R; cam.bottom = -R; cam.near = 0.5; cam.far = R * 4;
      cam.updateProjectionMatrix();
      t.bb = bb;
      if (!t.fitted) { setView('iso'); t.fitted = true; }
    }
  }, [levels, upTo, showCar, vehicleH]); // eslint-disable-line react-hooks/exhaustive-deps

  const setView = (id) => {
    const t = three.current;
    if (!t?.bb) return;
    const size = t.bb.getSize(new THREE.Vector3()); const c = t.bb.getCenter(new THREE.Vector3());
    const r = Math.max(size.x, size.y, size.z, 6);
    const dist = r * 1.25;
    const pos = {
      iso: [c.x + dist * 0.75, c.y + dist * 0.8, c.z + dist * 0.95],
      top: [c.x, c.y + dist * 1.6, c.z + 0.01],
      front: [c.x, c.y + r * 0.25, c.z + dist * 1.3],
      side: [c.x + dist * 1.3, c.y + r * 0.25, c.z],
    }[id];
    t.camera.position.set(...pos);
    t.controls.target.copy(c);
    t.controls.update();
  };

  const savePng = () => {
    const t = three.current;
    if (!t) return;
    t.renderer.render(t.scene, t.camera);
    const a = document.createElement('a');
    a.href = t.renderer.domElement.toDataURL('image/png');
    a.download = `${title || '배치도'}_3D.png`;
    a.click();
  };

  const cur = levels.findIndex(l => l.id === currentId);

  return (
    <div className="fp-3d">
      <div ref={wrapRef} className="fp-3d-canvas" />
      <div ref={tipRef} className="fp-3d-tip" />
      {err && <div className="fp-3d-err">{err}</div>}
      {modelErrs.length > 0 && <div className="fp-3d-warn">3D 모델 파일을 못 읽었어요: {modelErrs.join(', ')} (빨간 상자로 보여요. 파일이 GLB인지, 인터넷 연결을 확인해 주세요)</div>}
      <div className="fp-3d-bar">
        <div className="fp-btn-row">
          {levels.length > 1 && levels.map((l, i) => (
            <button key={l.id} type="button" className={`filter-pill${upTo === i ? ' on' : ''}`} onClick={() => setUpTo(i)}>
              {i === levels.length - 1 ? '전체' : `${l.name}까지`}{i === cur ? ' ●' : ''}
            </button>
          ))}
        </div>
        <div className="fp-btn-row">
          {VIEWS.map(v => <button key={v.id} type="button" className="filter-pill" onClick={() => setView(v.id)}>{v.label}</button>)}
          <label className="fp-check"><input type="checkbox" checked={showCar} onChange={(e) => setShowCar(e.target.checked)} /> 리프트 올린 모습</label>
          <button type="button" className="btn btn-secondary btn-sm" onClick={savePng}>3D 그림 저장</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>2D로</button>
        </div>
      </div>
      <p className="fp-3d-hint">끌어서 돌리기 · 오른쪽 버튼(두 손가락)으로 옮기기 · 휠로 키우고 줄이기. 문·창·셔터를 벽 위에 놓으면 그 자리가 뚫려 보여요.</p>
    </div>
  );
}
