import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { bodyPolygon, wallPolygon, aabb, pointInPolygon } from './planGeometry';
import { scaledPoints, lShapePoints, stairArm, shade, hProfilePoints, rectPoints } from './planShapes';
import { isVertical, defaultLevelHeight, wallTypeOf, libraryByKey, steelProfile, mepLineTypeOf, isBeam } from './planLibrary';
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
const OPENING_SHAPES = ['door', 'door2', 'sliding', 'shutter', 'window', 'glassdoor', 'autodoor', 'autodoor1'];
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
  /** 루바(세로 나무 판) 무늬: 한 칸 = 판 하나 */
  const louverTex = (color) => {
    const key = `louver|${color}`;
    if (texs.has(key)) return texs.get(key);
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256;
    const g = cv.getContext('2d');
    g.fillStyle = color; g.fillRect(0, 0, 64, 256);
    g.fillStyle = shade(color, 0.12); g.fillRect(6, 0, 10, 256);
    g.fillStyle = shade(color, -0.45); g.fillRect(0, 0, 5, 256);
    g.globalAlpha = 0.18; g.fillStyle = shade(color, -0.3);
    for (let y = 20; y < 256; y += 37) g.fillRect(20, y, 30, 2);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    texs.set(key, t);
    return t;
  };
  const dispose = () => { mats.forEach(m => m.dispose()); texs.forEach(t => t.dispose()); };
  return { mat, glass, see, floorTex, louverTex, dispose };
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

/** 계단 색: 계단(디딤판·챌판·옆판) / 손잡이 / 기둥(난간 세로 기둥·계단참 받침) */
const STAIR_DEFAULT_COLORS = { rail: '#a47148', post: '#374151' };
function stairMats(it, kit) {
  const steel = it.key === 'stairsSteel';
  return {
    color: it.color || (it.openUnder ? '#c8a273' : '#94a3b8'),
    railM: kit.mat(it.railColor || (steel ? '#374151' : STAIR_DEFAULT_COLORS.rail), { metalness: 0.3, roughness: 0.45 }),
    postM: kit.mat(it.postColor || STAIR_DEFAULT_COLORS.post, { metalness: 0.5, roughness: 0.4 }),
    railOn: !it.noRail,
  };
}

/** 기울어진 막대(옆판·손잡이): 오르는 방향으로 a0→a1, 높이 y0→y1 */
function slopeBar(g, { axis, a0, a1, y0, y1, cPos, h, thick, yOff, mat }) {
  const run = Math.abs(a1 - a0); const L = Math.hypot(run, y1 - y0);
  const ang = Math.atan2(y1 - y0, run);
  const geo = axis === 'z' ? new THREE.BoxGeometry(thick * M, h * M, L * M) : new THREE.BoxGeometry(L * M, h * M, thick * M);
  const m = new THREE.Mesh(geo, mat);
  const yMid = (y0 + y1) / 2 + yOff;
  if (axis === 'z') { m.rotation.x = a1 < a0 ? ang : -ang; m.position.set(cPos * M, yMid * M, ((a0 + a1) / 2) * M); } else { m.rotation.z = a1 > a0 ? ang : -ang; m.position.set(((a0 + a1) / 2) * M, yMid * M, cPos * M); }
  m.castShadow = true; m.receiveShadow = true;
  g.add(m);
}

/** 난간: 세로 기둥(기둥 색) + 위쪽 손잡이(손잡이 색) */
function flightRail(g, { axis, a0, a1, y0, y1, cPos, count, railM, postM }) {
  slopeBar(g, { axis, a0, a1, y0, y1, cPos, h: 50, thick: 60, yOff: 920, mat: railM });
  const posts = Math.max(2, Math.round(count / 2));
  for (let k = 0; k <= posts; k++) {
    const f = k / posts; const a = a0 + (a1 - a0) * f; const y = y0 + (y1 - y0) * f;
    if (axis === 'z') box(g, 30, 900, 30, cPos, y, a, postM); else box(g, 30, 900, 30, a, y, cPos, postM);
  }
}

/**
 * 아래가 빈 계단 한 줄(한 번에 오르는 구간): 디딤판 + 챌판 + 양옆 옆판(계단 받침) + 한쪽 난간
 * axis 'z': z방향으로 a0→a1 오르고 x는 c0~c1 / axis 'x': x방향으로 a0→a1 오르고 z는 c0~c1
 * rail: 난간을 둘 쪽 ('c0' | 'c1' | null)
 */
function openFlight(g, { axis, a0, a1, c0, c1, y0, y1, count, kit, color, steel, rail, railM, postM }) {
  const tread = kit.mat(color, { roughness: 0.6 });
  const side = kit.mat(shade(color, -0.2), { roughness: 0.6 });
  const riserM = kit.mat(shade(color, 0.15), { roughness: 0.7 });
  const rise = (y1 - y0) / count;
  const at = (a, c, w, h, len, y, mat) => (axis === 'z'
    ? box(g, w, h, len, c, y, a, mat)
    : box(g, len, h, w, a, y, c, mat));
  const width = Math.abs(c1 - c0); const cm = (c0 + c1) / 2;
  for (let i = 0; i < count; i++) {
    const t0 = a0 + ((a1 - a0) * i) / count; const t1 = a0 + ((a1 - a0) * (i + 1)) / count;
    const top = y0 + rise * (i + 1);
    at((t0 + t1) / 2, cm, width, 40, Math.abs(t1 - t0), top - 40, tread);
    if (!steel) at(t0, cm, width, Math.max(10, rise - 40), 20, top - rise, riserM);
  }
  // 옆판(계단 받침): 양쪽
  [c0, c1].forEach(cPos => slopeBar(g, { axis, a0, a1, y0, y1, cPos: cPos + (cPos === Math.min(c0, c1) ? 20 : -20), h: steel ? 200 : 300, thick: 40, yOff: -120, mat: side }));
  if (rail && railM) {
    const cPos = rail === 'c0' ? c0 + (c0 < c1 ? 30 : -30) : c1 + (c1 < c0 ? 30 : -30);
    flightRail(g, { axis, a0, a1, y0, y1, cPos, count, railM, postM });
  }
}

function buildStairs(g, it, H, kit) {
  const { w, d } = it; const hw = w / 2; const hd = d / 2;
  const sm = stairMats(it, kit);
  const mat = kit.mat(sm.color);
  const solid = it.key !== 'stairsSteel';
  const n = Math.max(3, Math.ceil(H / 180));
  const top = (k) => (H * k) / n;
  const railM = sm.railOn ? sm.railM : null;
  const { postM } = sm;
  const rail = (opt) => { if (railM) flightRail(g, { ...opt, railM, postM }); };
  // 아래가 빈 계단(나무·철골): 디딤판·챌판·옆판만, 밑은 비워 둠
  if ((it.openUnder || it.key === 'stairsSteel') && it.shape !== 'stairsSpiral') {
    const { color } = sm;
    const steel = it.key === 'stairsSteel';
    const common = { kit, color, steel, railM, postM };
    if (it.shape === 'stairs') {
      openFlight(g, { ...common, axis: 'z', a0: hd, a1: -hd, c0: -hw, c1: hw, y0: 0, y1: H, count: n, rail: 'c0' });
      return;
    }
    if (it.shape === 'stairsL') {
      const sw = stairArm(it); const runA = d - sw; const runB = w - sw;
      const nA = Math.max(1, Math.round(((n - 1) * runA) / (runA + runB))); const nB = n - 1 - nA;
      const yL = top(nA + 1);
      openFlight(g, { ...common, axis: 'z', a0: hd, a1: -hd + sw, c0: hw - sw, c1: hw, y0: 0, y1: top(nA), count: nA, rail: 'c0' });
      box(g, sw, 150, sw, hw - sw / 2, yL - 150, -hd + sw / 2, kit.mat(shade(color, -0.1)));
      box(g, 100, yL - 150, 100, hw - sw + 50, 0, -hd + sw - 50, postM);
      if (nB > 0) openFlight(g, { ...common, axis: 'x', a0: hw - sw, a1: -hw, c0: -hd, c1: -hd + sw, y0: yL, y1: H, count: nB, rail: 'c1' });
      return;
    }
    if (it.shape === 'stairsU') {
      const sw = stairArm(it); const L = Math.min(sw, d * 0.4);
      const n1 = Math.ceil(n / 2); const yL = top(n1);
      openFlight(g, { ...common, axis: 'z', a0: hd, a1: -hd + L, c0: hw - sw, c1: hw, y0: 0, y1: top(n1 - 1), count: n1 - 1, rail: 'c0' });
      box(g, w, 150, L, 0, yL - 150, -hd + L / 2, kit.mat(shade(color, -0.1)));
      [-1, 1].forEach(sx => box(g, 100, yL - 150, 100, sx * (hw - 50), 0, -hd + L - 50, postM));
      openFlight(g, { ...common, axis: 'z', a0: -hd + L, a1: hd, c0: -hw, c1: -hw + sw, y0: yL, y1: H, count: n - n1, rail: 'c1' });
      return;
    }
  }
  // 아래가 막힌 계단: 꽉 찬 계단 + 한쪽 난간
  if (it.shape === 'stairs') {
    for (let i = 0; i < n; i++) step(g, -hw, hw, hd - (d * i) / n, hd - (d * (i + 1)) / n, top(i + 1), mat, solid);
    rail({ axis: 'z', a0: hd, a1: -hd, y0: 0, y1: H, cPos: -hw + 30, count: n });
    return;
  }
  if (it.shape === 'stairsU') {
    const sw = stairArm(it); const L = Math.min(sw, d * 0.4);
    const n1 = Math.ceil(n / 2); const run = d - L;
    for (let i = 0; i < n1 - 1; i++) step(g, hw - sw, hw, hd - (run * i) / (n1 - 1), hd - (run * (i + 1)) / (n1 - 1), top(i + 1), mat, solid);
    step(g, -hw, hw, -hd, -hd + L, top(n1), mat, solid);
    const n2 = n - n1;
    for (let j = 0; j < n2; j++) step(g, -hw, -hw + sw, -hd + L + (run * j) / n2, -hd + L + (run * (j + 1)) / n2, top(n1 + j + 1), mat, solid);
    rail({ axis: 'z', a0: hd, a1: -hd + L, y0: 0, y1: top(n1 - 1), cPos: hw - sw + 30, count: n1 - 1 });
    rail({ axis: 'z', a0: -hd + L, a1: hd, y0: top(n1), y1: H, cPos: -hw + sw - 30, count: n2 });
    return;
  }
  if (it.shape === 'stairsL') {
    const sw = stairArm(it); const runA = d - sw; const runB = w - sw;
    const nA = Math.max(1, Math.round(((n - 1) * runA) / (runA + runB))); const nB = n - 1 - nA;
    for (let i = 0; i < nA; i++) step(g, hw - sw, hw, hd - (runA * i) / nA, hd - (runA * (i + 1)) / nA, top(i + 1), mat, solid);
    step(g, hw - sw, hw, -hd, -hd + sw, top(nA + 1), mat, solid);
    for (let j = 0; j < nB; j++) step(g, hw - sw - (runB * j) / nB, hw - sw - (runB * (j + 1)) / nB, -hd, -hd + sw, top(nA + 2 + j), mat, solid);
    rail({ axis: 'z', a0: hd, a1: -hd + sw, y0: 0, y1: top(nA), cPos: hw - sw + 30, count: nA });
    if (nB > 0) rail({ axis: 'x', a0: hw - sw, a1: -hw, y0: top(nA + 1), y1: H, cPos: -hd + sw - 30, count: nB });
    return;
  }
  if (it.shape === 'stairsSpiral') {
    const r = Math.min(w, d) / 2; const span = (330 * Math.PI) / 180; const dt = span / n;
    cyl(g, 80, H, 0, 0, 0, postM);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r * M, r * M, 50 * M, 10, 1, false, i * dt, dt * 1.02), mat);
      m.position.y = (top(i + 1) - 25) * M;
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
      // 바깥쪽 난간 기둥
      if (railM) {
        const a = i * dt + dt / 2;
        box(g, 30, 900, 30, Math.sin(a) * (r - 40), top(i + 1), Math.cos(a) * (r - 40), postM);
      }
    }
    // 바깥쪽 손잡이: 기둥 위를 잇는 짧은 막대들
    if (railM) {
      for (let i = 0; i < n - 1; i++) {
        const a1 = i * dt + dt / 2; const a2 = a1 + dt;
        const p1 = new THREE.Vector3(Math.sin(a1) * (r - 40) * M, (top(i + 1) + 920) * M, Math.cos(a1) * (r - 40) * M);
        const p2 = new THREE.Vector3(Math.sin(a2) * (r - 40) * M, (top(i + 2) + 920) * M, Math.cos(a2) * (r - 40) * M);
        const seg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, p1.distanceTo(p2)), railM);
        seg.position.copy(p1).add(p2).multiplyScalar(0.5);
        seg.lookAt(p2);
        g.add(seg);
      }
    }
  }
}

/**
 * 접수 카운터(로고형): 도면 치수 그대로 (가로 2,400 · 깊이 800 · 높이 1,125)
 * - 앞(손님 쪽, +z): 왼쪽 파란 기둥 80 · 흰 앞판(로고) · 오른쪽 파란 기둥 100, 아래 스테인리스 걸레받이
 * - 위: 파란 윗판 깊이 250 · 두께 150, 왼쪽은 150 폭으로 뒤까지 이어짐, 윗판 아래 LED
 * - 뒤(직원 쪽, -z): 높이 775 책상 상판(대리석 무늬), 상판 아래 서랍 줄(가운데는 빈칸), 윗판 밑 수납칸 3칸
 * 크기를 바꾸면 비율에 맞춰 늘거나 줄어요.
 */
function receptionLogoTexture() {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512;
  const x = cv.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 1024, 512);
  // 간단한 엠블럼: 위쪽 휘어진 띠 + 굵은 W + 아래 밑줄 (실제 로고 그림을 올리면 그걸로 바뀜)
  x.strokeStyle = '#1e3a8a'; x.lineCap = 'round';
  x.lineWidth = 26; x.beginPath(); x.ellipse(512, 250, 210, 95, 0, Math.PI * 1.08, Math.PI * 1.92); x.stroke();
  x.fillStyle = '#1e3a8a'; x.font = 'italic 900 210px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('W', 512, 285);
  x.beginPath(); x.ellipse(512, 400, 230, 14, 0, 0, Math.PI * 2); x.fill();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function marbleTexture(color) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 512;
  const x = cv.getContext('2d');
  x.fillStyle = color; x.fillRect(0, 0, 512, 512);
  x.strokeStyle = 'rgba(80,80,90,0.18)'; x.lineWidth = 2;
  for (let k = 0; k < 14; k++) {
    x.beginPath();
    let px = (k * 73) % 512; let py = 0;
    x.moveTo(px, py);
    while (py < 512) { px += Math.sin(py / 40 + k) * 18; py += 24; x.lineTo(px, py); }
    x.stroke();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  return t;
}

function buildReception(g, it, kit) {
  const W = it.w || 2400; const D = it.d || 800; const H = it.h || 1125;
  const sx = W / 2400; const sz = D / 800; const sy = H / 1125;
  const hw = W / 2; const hd = D / 2;
  const pL = 80 * sx; const pR = 100 * sx;           // 왼쪽·오른쪽 기둥(옆판) 두께
  const capH = 150 * sy; const capD = 250 * sz; const retW = 150 * sx;
  const deskY = Math.min(775 * sy, H - capH - 150); const deskT = 25;
  const kick = 100 * sy; const post = 80 * sz;        // 걸레받이 높이, 앞 기둥 깊이
  const frontZ = hd - post; const frontT = 25;
  const blue = kit.mat(it.color || '#1d4ed8', { roughness: 0.3, metalness: 0.1 });
  const white = kit.mat(it.panelColor || '#f8fafc', { roughness: 0.45 });
  const steel = kit.mat('#cbd5e1', { metalness: 0.75, roughness: 0.25 });
  const inner0 = -hw + pL; const inner1 = hw - pR; const innerW = inner1 - inner0; const ix = (inner0 + inner1) / 2;

  // 옆판(흰색) + 앞쪽 파란 기둥
  box(g, pL, H - capH, D - post, -hw + pL / 2, 0, (frontZ - hd) / 2, white);
  box(g, pL, H - capH, post, -hw + pL / 2, 0, hd - post / 2, blue);
  box(g, pR, H - capH, D - post, hw - pR / 2, 0, (frontZ - hd) / 2, white);
  box(g, pR, H - capH, post, hw - pR / 2, 0, hd - post / 2, blue);

  // 앞판: 앞면에 로고 그림
  const logoTex = it.logoImg ? faceTexture(it.logoImg) : receptionLogoTexture();
  const logoMat = new THREE.MeshStandardMaterial({ map: logoTex, roughness: 0.45 });
  logoMat.userData.own = !it.logoImg;
  const ph = H - capH - kick;
  const panel = new THREE.Mesh(new THREE.BoxGeometry(innerW * M, ph * M, frontT * M), [white, white, white, white, logoMat, white]);
  panel.position.set(ix * M, (kick + ph / 2) * M, (frontZ - frontT / 2) * M);
  panel.castShadow = true; panel.receiveShadow = true;
  g.add(panel);
  // 걸레받이(스테인리스)
  box(g, innerW, kick, 20, ix, 0, frontZ - frontT - 10, steel);

  // 파란 윗판 + 왼쪽 이어지는 부분
  box(g, W, capH, capD, 0, H - capH, hd - capD / 2, blue);
  box(g, retW, capH, D - capD, -hw + retW / 2, H - capH, (-hd + (hd - capD)) / 2, blue);
  // 윗판 아래 LED
  box(g, innerW, 12, 25, ix, H - capH - 12, frontZ + 15, kit.mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 1 }), false);

  // 직원 쪽 책상 상판 (대리석 무늬)
  const deskMat = new THREE.MeshStandardMaterial({ map: marbleTexture(it.deskColor || '#d4d4d8'), roughness: 0.35 });
  deskMat.userData.own = true;
  const deskD = (frontZ - frontT) - (-hd);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(innerW * M, deskT * M, deskD * M), deskMat);
  desk.position.set(ix * M, (deskY - deskT / 2) * M, (-hd + deskD / 2) * M);
  desk.castShadow = true; desk.receiveShadow = true;
  g.add(desk);
  // 책상 위 전선 구멍
  [-0.33, 0, 0.33].forEach(k => cyl(g, 30, 4, ix + innerW * k, deskY, hd - capD - 60, kit.mat('#1f2937')));

  // 윗판 밑 수납칸 3칸: 칸막이 2개 + 칸 바닥
  const cubZ0 = hd - capD; const cubZ1 = frontZ - frontT;
  if (cubZ1 > cubZ0) {
    [1 / 3, 2 / 3].forEach(k => box(g, 18, H - capH - deskY, cubZ1 - cubZ0, inner0 + innerW * k, deskY, (cubZ0 + cubZ1) / 2, white));
    box(g, innerW, 18, cubZ1 - cubZ0, ix, deskY, (cubZ0 + cubZ1) / 2, white);
  }

  // 상판 아래 서랍 줄: 5칸 중 가운데는 비움, 손잡이
  const drH = 115 * sy; const drD = Math.min(450 * sz, deskD - 100);
  const knob = kit.mat('#9ca3af', { metalness: 0.6, roughness: 0.3 });
  for (let k = 0; k < 5; k++) {
    const x0 = inner0 + (innerW * k) / 5; const x1 = inner0 + (innerW * (k + 1)) / 5;
    if (k === 2) { box(g, x1 - x0, 18, drD, (x0 + x1) / 2, deskY - deskT - drH, -hd + drD / 2, white); continue; }
    box(g, x1 - x0 - 6, drH, drD, (x0 + x1) / 2, deskY - deskT - drH, -hd + drD / 2, white);
    cyl(g, 14, 12, (x0 + x1) / 2, deskY - deskT - drH / 2, -hd - 6, knob).rotation.x = Math.PI / 2;
  }
}

/**
 * 여닫이문(한쪽·양쪽·유리): 문틀 + 문짝 + 손잡이
 * - 경첩은 왼쪽(-x), 좌우 뒤집기면 오른쪽 / 열리는 쪽은 앞(+z), swingBack이면 뒤(-z)
 * - open3d면 75° 열린 모습 (어느 쪽으로 열리는지 보기 좋게)
 */
function buildSwingDoor(g, it, kit, glass) {
  const { w, d } = it; const hw = w / 2;
  const dh = it.h || 2100; const fr = 50;
  const frame = kit.mat(shade(it.leafColor || '#c8a273', -0.25), { roughness: 0.6 });
  const leafM = glass ? kit.glass() : kit.mat(it.leafColor || '#c8a273', { roughness: 0.55 });
  const metal = kit.mat('#d1d5db', { metalness: 0.7, roughness: 0.3 });
  const T = Math.max(d, 100) + 20;
  box(g, fr, dh, T, -hw + fr / 2, 0, 0, frame);
  box(g, fr, dh, T, hw - fr / 2, 0, 0, frame);
  box(g, w, fr, T, 0, dh - fr, 0, frame);
  const sg = it.swingBack ? -1 : 1;
  const ang = it.open3d ? (75 * Math.PI) / 180 : 0;
  const leaves = it.shape === 'door2'
    ? [{ x: -hw + fr, dir: 1, lw: w / 2 - fr }, { x: hw - fr, dir: -1, lw: w / 2 - fr }]
    : [{ x: -hw + fr, dir: 1, lw: w - fr * 2 }];
  leaves.forEach(({ x, dir, lw }) => {
    const pivot = new THREE.Group();
    pivot.position.set(x * M, 0, 0);
    const lt = glass ? 12 : 40;
    const leaf = box(pivot, lw - 4, dh - fr - 10, lt, (dir * lw) / 2, 5, 0, leafM, !glass);
    if (leaf && glass) leaf.renderOrder = 2;
    if (glass) {
      // 유리문: 위아래 테두리
      box(pivot, lw, 60, 30, (dir * lw) / 2, 5, 0, frame);
      box(pivot, lw, 60, 30, (dir * lw) / 2, dh - fr - 65, 0, frame);
    }
    // 손잡이 (양쪽 면으로 튀어나옴)
    box(pivot, 20, glass ? 400 : 140, lt + 90, dir * (lw - 70), glass ? 800 : 980, 0, metal);
    pivot.rotation.y = -dir * sg * ang;
    g.add(pivot);
  });
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
    case 'receptionW':
      buildReception(g, it, kit);
      break;
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
    case 'door': case 'door2':
      buildSwingDoor(g, it, kit, false);
      break;
    case 'sliding': {
      const dh = h || 2100;
      box(g, w, dh, 45, 0, 0, 0, kit.mat(it.leafColor || c, { roughness: 0.6 }));
      break;
    }
    case 'glassdoor':
      buildSwingDoor(g, it, kit, true);
      break;
    case 'autodoor': case 'glasspanel': case 'autodoor1': {
      const dh = h || (it.shape === 'glasspanel' ? 2400 : 2100);
      const leaf = it.opaque ? kit.mat(c, { roughness: 0.5 }) : kit.glass();
      if (it.shape === 'autodoor') {
        // 양개: 문짝 둘 + 가운데 틈
        [-1, 1].forEach(sx => box(g, w / 2 - 10, dh, 25, sx * (w / 4), 0, 0, leaf, false));
      } else {
        box(g, w, dh, 25, 0, 0, 0, leaf, false);
      }
      box(g, w, 50, Math.max(d, 60), 0, dh - 50, 0, kit.mat(shade(c, -0.2)));
      // 자동문 위 구동부(무목) 상자
      if (it.shape === 'autodoor') box(g, w + 200, 300, 250, 0, dh, 0, kit.mat('#64748b'));
      if (it.shape === 'autodoor1') box(g, w * 2 + 100, 300, 250, w / 2, dh, 0, kit.mat('#64748b'));
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
    case 'light': case 'lightline': case 'lightround': {
      // 조명: 빛나는 판 (실제 빛 계산은 하지 않고 밝게만)
      const glow = kit.mat('#fffbeb', { emissive: '#fde68a', emissiveIntensity: 0.9, roughness: 0.4 });
      const lh = Math.max(30, h || 40);
      if (it.shape === 'lightround') cyl(g, hw, lh, 0, 0, 0, glow, 1, d / w);
      else box(g, w, lh, d, 0, 0, 0, glow, false);
      break;
    }
    case 'outlet': case 'switchsym': case 'aircock': case 'faucet':
      box(g, w, h || 120, Math.max(d, 30), 0, 0, 0, kit.mat(it.shape === 'aircock' ? '#dbeafe' : it.shape === 'faucet' ? '#dcfce7' : '#f8fafc'));
      box(g, w * 0.5, (h || 120) * 0.4, 12, 0, (h || 120) * 0.3, Math.max(d, 30) / 2, kit.mat(c));
      break;
    case 'reel': {
      const r = Math.min(w, h || w) / 2;
      const reel = cyl(g, r, d, 0, 0, 0, m); reel.rotation.x = Math.PI / 2; reel.position.y = r * M;
      box(g, w, 40, 40, 0, r * 2, -d / 2 + 20, darker);
      break;
    }
    case 'roller': {
      box(g, w, 15, d, 0, 0, 0, kit.mat('#475569', { metalness: 0.4 }), false);
      const pw = w * 0.32;
      [-1, 1].forEach(sx => [-0.2, 0.2].forEach(k => {
        const r = cyl(g, 110, pw, 0, 0, 0, kit.mat('#9ca3af', { metalness: 0.6, roughness: 0.3 }));
        r.rotation.z = Math.PI / 2; r.position.set(sx * (hw - pw / 2) * M, 20 * M, k * d * M);
      }));
      break;
    }
    case 'crane': {
      const ch = h || 2000;
      box(g, 100, 100, d, -hw + 50, 0, 0, m); box(g, 100, 100, d, hw - 50, 0, 0, m);
      box(g, w, 100, 100, 0, 0, -hd + 50, m);
      box(g, 120, ch, 120, 0, 0, -hd + 150, m);
      const boom = box(g, 100, 100, d * 0.85, 0, 0, 0, m);
      if (boom) { boom.rotation.x = -0.35; boom.position.set(0, (ch - 150) * M, (-hd + 150 + d * 0.4) * M); }
      box(g, 40, 400, 40, 0, ch - 900, hd * 0.6, kit.mat('#9ca3af', { metalness: 0.6 }));
      break;
    }
    case 'evcharger': {
      const eh = h || 1600;
      box(g, w, eh, d, 0, 0, 0, kit.mat(c, { roughness: 0.4 }));
      box(g, w * 0.6, eh * 0.18, 12, 0, eh * 0.62, d / 2, kit.mat('#111827', { roughness: 0.2 }));
      break;
    }
    case 'kiosk': {
      const kh = h || 1600;
      box(g, w * 0.6, kh * 0.6, d * 0.6, 0, 0, 0, m);
      const scr = box(g, w, kh * 0.4, 60, 0, kh * 0.55, d * 0.1, kit.mat('#0f172a', { roughness: 0.2 }));
      if (scr) scr.rotation.x = -0.25;
      break;
    }
    case 'benchseat': {
      const n = Math.max(1, Math.round(w / 560));
      box(g, w, 60, d * 0.15, 0, 0, -hd + d * 0.1, darker);
      for (let i = 0; i < n; i++) {
        const x = -hw + (w / n) * (i + 0.5);
        box(g, w / n - 40, 60, d * 0.75, x, 420, d * 0.05, m);
        box(g, w / n - 40, (h || 800) - 480, 50, x, 480, -hd + d * 0.2, m);
      }
      [-1, 1].forEach(sx => box(g, 60, 420, d * 0.6, sx * (hw - 60), 0, 0, darker));
      break;
    }
    case 'sign':
      box(g, w, h || 1000, Math.max(d, 80), 0, 0, 0, kit.mat(c, { emissive: c, emissiveIntensity: 0.25, roughness: 0.4 }));
      break;
    case 'pylon': {
      const ph = h || 5000;
      box(g, w * 0.25, ph * 0.6, d * 0.6, 0, 0, 0, kit.mat('#94a3b8', { metalness: 0.4 }));
      box(g, w, ph * 0.4, d, 0, ph * 0.6, 0, kit.mat(c, { emissive: c, emissiveIntensity: 0.25 }));
      break;
    }
    case 'fence': {
      const fh = h || 1100; const n = Math.max(1, Math.round(w / 1000));
      for (let i = 0; i <= n; i++) cyl(g, 30, fh, -hw + (w / n) * i, 0, 0, m);
      [0.35, 0.9].forEach(k => box(g, w, 40, 40, 0, fh * k, 0, m));
      break;
    }
    case 'parking': {
      const lineM = kit.mat('#f8fafc', { roughness: 0.8 });
      box(g, 100, 8, d, -hw + 50, 0, 0, lineM, false); box(g, 100, 8, d, hw - 50, 0, 0, lineM, false);
      box(g, w, 8, 100, 0, 0, -hd + 50, lineM, false);
      break;
    }
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
    g.userData.label = `${wt.short} (아래 ${Math.round(top - depth).toLocaleString()}mm)`;
    return g;
  }
  const glassy = type === 'glass' || type === 'curtain';
  const solid = glassy ? kit.glass() : kit.mat(wall.color || (type === 'light' ? (wt.color || '#d6d3d1') : '#e7e5e4'), { roughness: 0.9 });
  const frame = kit.mat(wall.color || (glassy ? '#64748b' : '#a8a29e'));
  // 벽 길이 방향 = 그룹의 +x, 두께 방향 = z (A면 = +z 쪽, B면 = -z 쪽)
  // 벽면 꾸미기: 면마다 페인트 색, 아래쪽 루바(나무 판)
  const faces = glassy ? {} : (wall.faces || {});
  const faceMat = (f) => (f?.paint ? kit.mat(f.paint, { roughness: 0.85 }) : solid);
  const mats = glassy ? solid : [solid, solid, solid, solid, faceMat(faces.a), faceMat(faces.b)];
  const louver = (s0, s1, y1, side) => {
    const f = faces[side];
    const wh = Math.min(Number(f?.wainscot?.h) || 0, y1);
    if (!f?.wainscot || wh < 50) return;
    const lenS = s1 - s0;
    const tex = kit.louverTex(f.wainscot.color || '#b08968').clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(1, lenS / (Number(f.wainscot.pitch) || 100)), 1);
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 });
    m.userData.own = true;
    const sz = side === 'a' ? 1 : -1;
    box(g, lenS, wh, 18, (s0 + s1) / 2, 0, sz * (t / 2 + 9), m);
    // 위쪽 마감 몰딩
    box(g, lenS, 30, 30, (s0 + s1) / 2, wh - 15, sz * (t / 2 + 15), kit.mat(shade(f.wainscot.color || '#b08968', -0.25)));
  };
  const piece = (s0, s1, y0, y1) => {
    if (s1 - s0 < 5 || y1 - y0 < 5) return;
    const mesh = box(g, s1 - s0, y1 - y0, t, (s0 + s1) / 2, y0, 0, mats, !glassy);
    if (mesh && glassy) mesh.renderOrder = 2;
    if (!glassy && y0 === 0) { louver(s0, s1, y1, 'a'); louver(s0, s1, y1, 'b'); }
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
  // 바닥판 범위: 보(H빔·각파이프 보)는 머리 위라 빼고 진짜 벽만. 벽이 없으면 비품(지붕·글자 빼고)
  const realWalls = L.walls.filter(w => !isBeam(w));
  const pts = [
    ...realWalls.flatMap(w => wallPolygon(w)),
    ...(realWalls.length ? [] : L.items.filter(it => !['text', 'roof'].includes(it.kind)).flatMap(it => bodyPolygon(it))),
  ];
  // 바닥판. 아래층 계단·승강기 자리와 이 층 '뚫린 곳'은 구멍
  // 2층부터는 층마다 범위를 고름: auto = 벽 전체를 감싸는 네모, zones = 이 층 구역 모양대로만, none = 없음
  const slabMode = i > 0 ? (L.slab || 'auto') : 'auto';
  const holeSrc = [
    ...(i > 0 ? levels[i - 1].items.filter(isVertical) : []),
    ...L.items.filter(it => it.kind === 'void'),
  ].map(it => bodyPolygon(it));
  const overlaps = (a, c) => a.x0 < c.x1 && a.x1 > c.x0 && a.y0 < c.y1 && a.y1 > c.y0;
  const makeSlab = (outline) => {
    const b = aabb(outline);
    const inside = (bb) => bb.x0 > b.x0 + 20 && bb.y0 > b.y0 + 20 && bb.x1 < b.x1 - 20 && bb.y1 < b.y1 - 20;
    const holes = []; const holeBoxes = [];
    holeSrc.forEach(poly => {
      const bb = aabb(poly);
      if (!inside(bb) || holeBoxes.some(x => overlaps(x, bb))) return;
      holes.push(poly); holeBoxes.push(bb);
    });
    if (i > 0) extrude(g, outline, 200, -200, kit.mat('#d4d4d8', { roughness: 0.95 }), holes);
    else extrude(g, outline, 30, -25, kit.mat('#d6d3d1', { roughness: 0.95 }), holes);
  };
  if (slabMode === 'zones') {
    L.items.filter(it => it.kind === 'zone').forEach(z => makeSlab(bodyPolygon(z)));
  } else if (slabMode !== 'none' && pts.length) {
    const b = aabb(pts);
    makeSlab([{ x: b.x0, y: b.y0 }, { x: b.x1, y: b.y0 }, { x: b.x1, y: b.y1 }, { x: b.x0, y: b.y1 }]);
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
  // 구역 천장 (천장 높이를 적은 방)
  const zones = L.items.filter(z => z.kind === 'zone');
  const zoneCeil = (it) => {
    const z = zones.find(zz => zz.ceilH && pointInPolygon({ x: it.x, y: it.y }, bodyPolygon(zz)));
    return z ? Number(z.ceilH) : null;
  };
  if (opts.showCeil) {
    zones.filter(z => z.ceilH).forEach(z => {
      const cg = new THREE.Group();
      cg.position.set(z.x * M, Number(z.ceilH) * M, z.y * M);
      cg.rotation.y = -((z.rot || 0) * Math.PI) / 180;
      box(cg, z.w, 20, z.d, 0, 0, 0, kit.mat('#f8fafc', { transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }), false);
      cg.userData.label = `${z.name} 천장 (${Math.round(z.ceilH).toLocaleString()}mm)`;
      g.add(cg);
    });
  }

  // 전기·배관 선: 종류별 색 관
  if (opts.showMep) {
    (L.lines || []).forEach(line => {
      const lt = mepLineTypeOf(line.type);
      const y = Math.max(30, Number(line.h ?? lt.h) || 0);
      const mat = kit.mat(lt.color, { roughness: 0.5 });
      const pts = line.pts || [];
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]; const b = pts[i];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (len < 1) continue;
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(25 * M, 25 * M, len * M, 10), mat);
        pipe.position.set(((a.x + b.x) / 2) * M, y * M, ((a.y + b.y) / 2) * M);
        pipe.rotation.z = Math.PI / 2; // 눕혀서 x 방향으로
        const wrap = new THREE.Group();
        wrap.position.copy(pipe.position); pipe.position.set(0, 0, 0);
        wrap.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
        wrap.add(pipe);
        wrap.userData.label = `${lt.label} (높이 ${Math.round(y).toLocaleString()}mm)`;
        g.add(wrap);
      }
    });
  }

  // 지붕
  if (opts.showRoof) L.items.filter(it => it.kind === 'roof').forEach(it => g.add(buildRoof(it, H, kit)));

  // 비품
  L.items.forEach(it => {
    if (['zone', 'text', 'void', 'roof'].includes(it.kind)) return;
    const ig = buildItem(it, { kit, H, showCar: opts.showCar, vehicleH: opts.vehicleH, onModelError: opts.onModelError });
    // 조명은 높이를 안 적었으면 천장(구역 천장 높이 → 층고) 바로 아래에
    const y = it.kind === 'light' && !it.elev ? (zoneCeil(it) || H) - (it.h || 40) - 10 : (it.elev || 0);
    ig.position.set(it.x * M, y * M, it.y * M);
    ig.rotation.y = -((it.rot || 0) * Math.PI) / 180;
    if (it.flip) ig.scale.x = -1;
    ig.userData.label = it.name;
    g.add(ig);
  });
  g.userData.levelName = L.name;
  return g;
}

/** 지붕: 평지붕 / 한쪽 경사(뒤쪽이 높음) / 양쪽 경사(가운데가 높음) */
function buildRoof(it, H, kit) {
  const g = new THREE.Group();
  const eave = Number(it.h) || H;
  const rise = it.roofType === 'flat' ? 0 : Math.max(0, Number(it.rise) || 0);
  const mat = it.material === 'poly'
    ? kit.mat(it.color || '#bae6fd', { transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide, roughness: 0.2 })
    : kit.mat(it.color || '#e5e7eb', { side: THREE.DoubleSide, roughness: 0.6, metalness: it.material === 'steel' ? 0.4 : 0.1 });
  const T = it.material === 'panel' ? 75 : 30;
  g.position.set(it.x * M, 0, it.y * M);
  g.rotation.y = -((it.rot || 0) * Math.PI) / 180;
  if (it.flip) g.scale.x = -1;
  const slab = (depth, angle, cz, cy) => {
    const L = Math.hypot(depth, depth * Math.tan(angle));
    const m = new THREE.Mesh(new THREE.BoxGeometry(it.w * M, T * M, L * M), mat);
    m.rotation.x = angle;
    m.position.set(0, cy * M, cz * M);
    m.castShadow = it.material !== 'poly'; m.receiveShadow = true;
    g.add(m);
  };
  if (it.roofType === 'gable' && rise > 0) {
    const half = it.d / 2; const a = Math.atan2(rise, half);
    slab(half, a, half / 2, eave + rise / 2);       // 앞쪽 반: 앞(처마)에서 가운데(용마루)로 올라감
    slab(half, -a, -half / 2, eave + rise / 2);     // 뒤쪽 반
  } else {
    const a = Math.atan2(rise, it.d);
    slab(it.d, a, 0, eave + rise / 2);              // 한쪽 경사: 뒤쪽(-z)이 높음
  }
  g.userData.label = `${it.name} (처마 ${Math.round(eave).toLocaleString()}mm${rise ? ` · 최고 ${Math.round(eave + rise).toLocaleString()}mm` : ''})`;
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
  const [showRoof, setShowRoof] = useState(true);
  const [showCeil, setShowCeil] = useState(true);
  const [showMep, setShowMep] = useState(true);
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
    levels.forEach((L, i) => { if (i <= upTo) root.add(buildLevel(L, i, levels, el, { showCar, showRoof, showCeil, showMep, vehicleH, onModelError: (name) => setModelErrs(e => (e.includes(name) ? e : [...e, name])) }, kit)); });
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
  }, [levels, upTo, showCar, showRoof, showCeil, showMep, vehicleH]); // eslint-disable-line react-hooks/exhaustive-deps

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
          <label className="fp-check"><input type="checkbox" checked={showRoof} onChange={(e) => setShowRoof(e.target.checked)} /> 지붕</label>
          <label className="fp-check"><input type="checkbox" checked={showCeil} onChange={(e) => setShowCeil(e.target.checked)} /> 천장</label>
          <label className="fp-check"><input type="checkbox" checked={showMep} onChange={(e) => setShowMep(e.target.checked)} /> 전기·배관</label>
          <button type="button" className="btn btn-secondary btn-sm" onClick={savePng}>3D 그림 저장</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>2D로</button>
        </div>
      </div>
      <p className="fp-3d-hint">끌어서 돌리기 · 오른쪽 버튼(두 손가락)으로 옮기기 · 휠로 키우고 줄이기. 문·창·셔터를 벽 위에 놓으면 그 자리가 뚫려 보여요.</p>
    </div>
  );
}
