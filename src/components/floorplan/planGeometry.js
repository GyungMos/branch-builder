import { scaledPoints, lShapePoints, lStairPoints, stairArm } from './planShapes';
import { isBeam, isOverhead, NO_COLLIDE_KINDS, recommendedLux, isVertical } from './planLibrary';

/** 배치도 계산 도구 (단위 mm) */

const rad = (deg) => (deg * Math.PI) / 180;

/** 비품 안쪽 좌표 → 배치도 좌표 (flip: 좌우 뒤집기, rot: 돌린 각도) */
export function toWorld(item, p) {
  const a = rad(item.rot || 0);
  const cos = Math.cos(a); const sin = Math.sin(a);
  const px = item.flip ? -p.x : p.x;
  return { x: item.x + px * cos - p.y * sin, y: item.y + px * sin + p.y * cos };
}

export function toLocal(item, p) {
  const a = rad(-(item.rot || 0));
  const dx = p.x - item.x; const dy = p.y - item.y;
  const lx = dx * Math.cos(a) - dy * Math.sin(a);
  return { x: item.flip ? -lx : lx, y: dx * Math.sin(a) + dy * Math.cos(a) };
}

/** 화면에 그릴 때 쓰는 transform 글자 */
export const itemTransform = (it) => `translate(${it.x} ${it.y}) rotate(${it.rot || 0})${it.flip ? ' scale(-1 1)' : ''}`;

const rectPts = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

/** 비품 몸체 모양 (세계 좌표 점들). shrink: 안쪽으로 줄이는 값(맞닿은 것은 겹침으로 안 보게) */
export function bodyPolygon(item, shrink = 0) {
  const hw = Math.max(1, item.w / 2 - shrink); const hd = Math.max(1, item.d / 2 - shrink);
  let local;
  if (item.shape === 'poly' && item.points?.length >= 3) {
    const pts = scaledPoints(item);
    const fx = hw / (item.w / 2); const fy = hd / (item.d / 2);
    local = pts.map(p => ({ x: p.x * fx, y: p.y * fy }));
  } else if (item.shape === 'lshape') {
    local = lShapePoints(hw * 2, hd * 2, item.arm ? item.arm - shrink * 2 : undefined);
  } else if (item.shape === 'stairsL') {
    local = lStairPoints(hw * 2, hd * 2, Math.max(1, stairArm(item) - shrink * 2));
  } else {
    local = rectPts(-hw, -hd, hw, hd);
  }
  return local.map(p => toWorld(item, p));
}

export function hasClearance(item) {
  const c = item.clear || {};
  return (c.f || 0) + (c.b || 0) + (c.l || 0) + (c.r || 0) > 0;
}

/** 작업 공간까지 넣은 바깥 네모 (로컬 좌표) */
export function clearanceLocalRect(item) {
  const c = item.clear || {};
  return { x0: -item.w / 2 - (c.l || 0), y0: -item.d / 2 - (c.b || 0), x1: item.w / 2 + (c.r || 0), y1: item.d / 2 + (c.f || 0) };
}

export function clearancePolygon(item, shrink = 0) {
  const r = clearanceLocalRect(item);
  return rectPts(r.x0 + shrink, r.y0 + shrink, r.x1 - shrink, r.y1 - shrink).map(p => toWorld(item, p));
}

export function wallPolygon(wall, shrink = 0) {
  const dx = wall.x2 - wall.x1; const dy = wall.y2 - wall.y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * Math.max(1, wall.t / 2 - shrink); const ny = (dx / len) * Math.max(1, wall.t / 2 - shrink);
  const ux = (dx / len) * shrink; const uy = (dy / len) * shrink;
  return [
    { x: wall.x1 + ux + nx, y: wall.y1 + uy + ny }, { x: wall.x2 - ux + nx, y: wall.y2 - uy + ny },
    { x: wall.x2 - ux - nx, y: wall.y2 - uy - ny }, { x: wall.x1 + ux - nx, y: wall.y1 + uy - ny },
  ];
}

export function aabb(points) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  points.forEach(p => { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); });
  return { x0, y0, x1, y1 };
}

const boxesTouch = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

function segCross(p1, p2, p3, p4) {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (d === 0) return false;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  return t > 0 && t < 1 && u > 0 && u < 1;
}

export function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]; const b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** 두 모양이 겹치는지 (오목한 모양도 됨) */
export function polygonsOverlap(a, b) {
  if (!boxesTouch(aabb(a), aabb(b))) return false;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      if (segCross(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true;
    }
  }
  return pointInPolygon(a[0], b) || pointInPolygon(b[0], a);
}

/** 받침 따라 조사 고르기: josa('리프트', '이가') → '리프트가' */
export function josa(word = '', pair = '이가') {
  const m = String(word).match(/[가-힣0-9a-zA-Z](?=[^가-힣0-9a-zA-Z]*$)/);
  let has = false;
  if (m) {
    const ch = m[0];
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) has = (code - 0xac00) % 28 !== 0;
    else if (/[0-9]/.test(ch)) has = '01367'.includes(ch) || ch === '8';
    else has = /[lmnr]/i.test(ch);
  }
  return word + (has ? pair[0] : pair[1]);
}

const TOUCH = 15; // 15mm 이하로 맞닿은 것은 겹침으로 안 봄

const collides = (it) => !NO_COLLIDE_KINDS.includes(it.kind);

/**
 * 경고 찾기
 * - overlap: 비품끼리 겹침 / wall: 비품이 벽과 겹침 / clear: 다른 비품·벽이 작업 공간을 막음 / height: 층고 부족
 */
export function findWarnings(items = [], walls = [], { ceiling, vehicleH = 1800, margin = 200, levelH } = {}) {
  const out = [];
  const underStairs = [];
  const list = items.filter(collides);
  const body = new Map(list.map(it => [it.id, bodyPolygon(it, TOUCH)]));
  const clear = new Map(list.filter(it => hasClearance(it) && !it.hideClear).map(it => [it.id, clearancePolygon(it, TOUCH)]));
  // 보(머리 위 가로대)는 바닥 비품과 겹쳐도 되므로 벽 검사에서 빼고, 아래에서 높이만 봄
  const wallPolys = walls.filter(w => !isOverhead(w)).map(w => ({ w, p: wallPolygon(w, TOUCH) }));
  const label = (it) => it.name || '비품';

  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (a.kind === 'arch' && b.kind === 'arch') continue;
      // 차는 리프트 위에 올라가는 게 맞으므로 차와 리프트 사이는 검사 안 함
      if ((a.kind === 'car' && b.lift) || (b.kind === 'car' && a.lift)) continue;
      if (polygonsOverlap(body.get(a.id), body.get(b.id))) {
        // 아래가 빈 계단 밑에 들어간 비품은 겹침이 아니라 높이로 봄
        const st = a.openUnder && !isVertical(b) ? a : b.openUnder && !isVertical(a) ? b : null;
        if (st) { underStairs.push({ st, it: st === a ? b : a }); continue; }
        out.push({ type: 'overlap', ids: [a.id, b.id], text: `${josa(label(a), '과와')} ${josa(label(b))} 겹쳐요` });
        continue;
      }
      if (clear.has(a.id) && b.kind !== 'arch' && polygonsOverlap(clear.get(a.id), body.get(b.id))) {
        out.push({ type: 'clear', ids: [a.id, b.id], text: `${josa(label(b))} ${label(a)}의 작업 공간을 막아요` });
      } else if (clear.has(b.id) && a.kind !== 'arch' && polygonsOverlap(clear.get(b.id), body.get(a.id))) {
        out.push({ type: 'clear', ids: [b.id, a.id], text: `${josa(label(a))} ${label(b)}의 작업 공간을 막아요` });
      }
    }
    if (a.kind === 'arch') continue;
    const hitWall = wallPolys.find(({ p }) => polygonsOverlap(body.get(a.id), p));
    if (hitWall) {
      out.push({ type: 'wall', ids: [a.id], wallId: hitWall.w.id, text: `${josa(label(a))} 벽과 겹쳐요` });
    } else if (clear.has(a.id)) {
      const blocked = wallPolys.find(({ p }) => polygonsOverlap(clear.get(a.id), p));
      if (blocked) out.push({ type: 'clear', ids: [a.id], wallId: blocked.w.id, text: `벽 때문에 ${label(a)}의 작업 공간이 모자라요` });
    }
  }

  // 뚫린 곳(계단 구멍) 위에 놓인 비품
  items.filter(v => v.kind === 'void').forEach(v => {
    const vp = bodyPolygon(v, TOUCH);
    list.forEach(it => {
      if (polygonsOverlap(vp, body.get(it.id))) out.push({ type: 'overlap', ids: [it.id, v.id], text: `${josa(label(it))} 뚫린 곳 위에 있어요${label(v).startsWith('뚫린 곳') ? '' : ` (${label(v)})`}` });
    });
  });

  // 아래가 빈 계단: 그 밑에 넣은 비품 높이가 계단 아랫면보다 높으면
  underStairs.forEach(({ st, it }) => {
    const h = (Number(it.h) || 0) + (Number(it.elev) || 0);
    if (!h) return;
    const min = minStairUnderside(st, it, levelH || ceiling || 3500);
    if (min !== null && h > min) {
      out.push({ type: 'height', ids: [it.id, st.id], text: `${label(it)}: 높이 ${fmtM(h)} > 계단 아래 ${fmtM(min)} (더 안쪽으로 넣거나 낮은 것으로)` });
    }
  });

  // 보 아래 높이: 리프트를 올리고 차를 얹었을 때(또는 높은 비품이) 보 아래에 닿는지
  walls.filter(isOverhead).forEach(bm => {
    const top = Number(bm.h) || ceiling;
    if (isBeam(bm) && !top) return;
    const bottom = isBeam(bm) ? top - (Number(bm.depth) || Number(bm.t) || 0) : Number(bm.base);
    const bp = wallPolygon(bm);
    list.forEach(it => {
      const need = neededHeight(it, vehicleH, margin);
      if (need && need > bottom && polygonsOverlap(bp, body.get(it.id))) {
        out.push({ type: 'height', ids: [it.id], wallId: bm.id, text: `${label(it)}: 필요한 높이 ${fmtM(need)} > ${isBeam(bm) ? '보' : '벽'} 아래 ${fmtM(bottom)}` });
      }
    });
  });

  if (ceiling) {
    list.forEach(it => {
      const need = neededHeight(it, vehicleH, margin);
      if (need && need > ceiling) {
        out.push({ type: 'height', ids: [it.id], text: `${label(it)}: 필요한 높이 ${fmtM(need)} > 층고 ${fmtM(ceiling)}` });
      }
    });
  }
  return out;
}

/** 이 비품에 필요한 천장 높이 (리프트는 최대로 올렸을 때 + 차 높이 + 여유) */
export function neededHeight(it, vehicleH = 1800, margin = 200) {
  const own = Number(it.h) || 0;
  const lifted = it.lift ? Number(it.lift) + vehicleH + margin : 0;
  return Math.max(own, lifted) || 0;
}

/** 길이는 모두 mm로 (예: 4,500mm) */
export const fmtMm = (mm) => `${Math.round(Number(mm) || 0).toLocaleString('ko-KR')}mm`;
export const fmtM = fmtMm;
export const fmtLen = fmtMm;

/** 면적: ㎡ 와 평 */
export function areaText(wmm, dmm) {
  const m2 = (wmm * dmm) / 1e6;
  return `${m2.toFixed(1)}㎡ (${(m2 * 0.3025).toFixed(1)}평)`;
}

/**
 * 끌어 옮길 때 다른 비품·벽 모서리에 붙이기
 * box: 옮기는 비품의 바깥 네모, targets: 다른 것들의 바깥 네모들, tol: 붙는 거리(mm)
 * 돌려주는 값: { dx, dy, guides: [{x}|{y}] }
 */
export function snapToEdges(box, targets, tol) {
  let best = { x: null, y: null };
  const xs = [box.x0, box.x1, (box.x0 + box.x1) / 2];
  const ys = [box.y0, box.y1, (box.y0 + box.y1) / 2];
  targets.forEach(t => {
    const txs = [t.x0, t.x1, (t.x0 + t.x1) / 2];
    const tys = [t.y0, t.y1, (t.y0 + t.y1) / 2];
    const nearY = box.y1 > t.y0 - tol * 40 && box.y0 < t.y1 + tol * 40;
    const nearX = box.x1 > t.x0 - tol * 40 && box.x0 < t.x1 + tol * 40;
    if (nearY) {
      xs.forEach(x => txs.forEach(tx => {
        const d = tx - x;
        if (Math.abs(d) <= tol && (best.x === null || Math.abs(d) < Math.abs(best.x.d))) best.x = { d, at: tx };
      }));
    }
    if (nearX) {
      ys.forEach(y => tys.forEach(ty => {
        const d = ty - y;
        if (Math.abs(d) <= tol && (best.y === null || Math.abs(d) < Math.abs(best.y.d))) best.y = { d, at: ty };
      }));
    }
  });
  const guides = [];
  if (best.x) guides.push({ x: best.x.at });
  if (best.y) guides.push({ y: best.y.at });
  return { dx: best.x ? best.x.d : 0, dy: best.y ? best.y.d : 0, guides };
}

/**
 * 고른 비품에서 위·아래·왼쪽·오른쪽으로 가장 가까운 벽·비품까지 거리
 * 돌려주는 값: [{ x1,y1,x2,y2, len }]
 */
export function nearestGaps(box, others, maxLen = 15000) {
  const res = [];
  const cy = (box.y0 + box.y1) / 2; const cx = (box.x0 + box.x1) / 2;
  let left = null; let right = null; let up = null; let down = null;
  others.forEach(o => {
    const overlapY = o.y0 < box.y1 && o.y1 > box.y0;
    const overlapX = o.x0 < box.x1 && o.x1 > box.x0;
    if (overlapY) {
      if (o.x1 <= box.x0 + 1) { const g = box.x0 - o.x1; if (g <= maxLen && (left === null || g < left.g)) left = { g, at: o.x1, y: clampMid(o.y0, o.y1, box.y0, box.y1, cy) }; }
      if (o.x0 >= box.x1 - 1) { const g = o.x0 - box.x1; if (g <= maxLen && (right === null || g < right.g)) right = { g, at: o.x0, y: clampMid(o.y0, o.y1, box.y0, box.y1, cy) }; }
    }
    if (overlapX) {
      if (o.y1 <= box.y0 + 1) { const g = box.y0 - o.y1; if (g <= maxLen && (up === null || g < up.g)) up = { g, at: o.y1, x: clampMid(o.x0, o.x1, box.x0, box.x1, cx) }; }
      if (o.y0 >= box.y1 - 1) { const g = o.y0 - box.y1; if (g <= maxLen && (down === null || g < down.g)) down = { g, at: o.y0, x: clampMid(o.x0, o.x1, box.x0, box.x1, cx) }; }
    }
  });
  if (left && left.g > 5) res.push({ x1: left.at, y1: left.y, x2: box.x0, y2: left.y, len: left.g });
  if (right && right.g > 5) res.push({ x1: box.x1, y1: right.y, x2: right.at, y2: right.y, len: right.g });
  if (up && up.g > 5) res.push({ x1: up.x, y1: up.at, x2: up.x, y2: box.y0, len: up.g });
  if (down && down.g > 5) res.push({ x1: down.x, y1: box.y1, x2: down.x, y2: down.at, len: down.g });
  return res;
}

function clampMid(a0, a1, b0, b1, fallback) {
  const lo = Math.max(a0, b0); const hi = Math.min(a1, b1);
  return lo < hi ? (lo + hi) / 2 : fallback;
}

export const itemBox = (it) => aabb(bodyPolygon(it));
export const wallBox = (w) => aabb(wallPolygon(w));

/** 배치 전체를 감싸는 네모 (화면 맞추기·그림 내려받기) */
export function planBounds(plan, bgBox) {
  const pts = [];
  (plan.items || []).forEach(it => pts.push(...clearancePolygon(it)));
  (plan.walls || []).forEach(w => pts.push(...wallPolygon(w)));
  (plan.dims || []).forEach(d => pts.push({ x: d.x1, y: d.y1 }, { x: d.x2, y: d.y2 }));
  (plan.lines || []).forEach(l => pts.push(...(l.pts || [])));
  if (bgBox) pts.push({ x: bgBox.x0, y: bgBox.y0 }, { x: bgBox.x1, y: bgBox.y1 });
  if (!pts.length) return { x0: -5000, y0: -5000, x1: 15000, y1: 10000 };
  return aabb(pts);
}

/**
 * 계단·경사로가 층 높이(H)에 맞는지 계산 (참고용)
 * - 단높이 180mm 이하, 단너비 260mm 이상 (판매·근린생활시설 기준)
 * - 높이 3,000mm 넘는 일자 계단은 중간에 1,200mm 계단참
 * - 차량 직선 경사로 기울기 17% 이하
 */
export const STAIR_RULE = { rise: 180, going: 260, landingOver: 3000, landing: 1200, rampMax: 0.17 };

export function stairInfo(item, H) {
  if (!H) return null;
  if (item.shape === 'ramp') {
    const slope = H / Math.max(1, item.d);
    return { ramp: true, slope, need: Math.ceil(H / STAIR_RULE.rampMax / 100) * 100, have: item.d, ok: slope <= STAIR_RULE.rampMax + 1e-9 };
  }
  const n = Math.ceil(H / STAIR_RULE.rise);
  const rise = H / n;
  const g = STAIR_RULE.going;
  let need = null; let have = null;
  if (item.shape === 'stairs') {
    need = (n - 1) * g + (H > STAIR_RULE.landingOver ? STAIR_RULE.landing : 0);
    have = item.d;
  } else if (item.shape === 'stairsU') {
    const sw = stairArm(item);
    need = (Math.ceil(n / 2) - 1) * g + Math.max(sw, STAIR_RULE.landing);
    have = item.d;
  } else if (item.shape === 'stairsL') {
    const sw = stairArm(item);
    need = (n - 2) * g;
    have = (item.d - sw) + (item.w - sw);
  }
  return { n, rise, need, have, ok: need === null || have >= need };
}

/**
 * 구역 밝기(평균 조도) 어림 계산: 구역 안 조명 밝기(lm) 합 × 이용률 0.6 × 보수율 0.8 ÷ 넓이(㎡)
 * 정확한 값은 조명 설계가 필요하지만, 모자라거나 넘치는지 가늠하는 데 써요.
 */
export function zoneLighting(zone, items = []) {
  const poly = bodyPolygon(zone);
  const lights = items.filter(it => it.kind === 'light' && pointInPolygon({ x: it.x, y: it.y }, poly));
  const lm = lights.reduce((s, it) => s + (Number(it.lm) || 0), 0);
  const watt = lights.reduce((s, it) => s + (Number(it.watt) || 0), 0);
  const area = (zone.w * zone.d) / 1e6;
  const lux = area > 0 ? Math.round((lm * 0.6 * 0.8) / area) : 0;
  const need = zone.luxTarget || recommendedLux(zone.name);
  return { count: lights.length, lm, watt, area, lux, need, ok: lux >= need * 0.9 };
}

/* ───────── 아래가 빈 계단: 계단 아랫면 높이 ───────── */
const STAIR_STRUCT = 250; // 디딤판·계단 구조 두께(어림)

/** 계단 시작점(바닥)부터 걸어 올라간 거리로 높이를 어림해 아랫면 높이(mm). 계단 밑이 아니면 null */
export function stairUndersideAt(st, p, H) {
  const l = toLocal(st, p);
  const hw = st.w / 2; const hd = st.d / 2;
  if (Math.abs(l.x) > hw + 1 || Math.abs(l.y) > hd + 1) return null;
  let s; let total;
  if (st.shape === 'stairs') {
    total = st.d; s = hd - l.y;
  } else if (st.shape === 'stairsL') {
    const sw = stairArm(st); const runA = st.d - sw; const runB = st.w - sw;
    total = runA + sw + runB;
    if (l.x >= hw - sw && l.y >= -hd + sw) s = hd - l.y;
    else if (l.x >= hw - sw) s = runA + sw / 2;
    else if (l.y < -hd + sw) s = runA + sw + (hw - sw - l.x);
    else return null; // ㄱ자 안쪽 빈 모서리
  } else if (st.shape === 'stairsU') {
    const sw = stairArm(st); const L = Math.min(sw, st.d * 0.4); const run = st.d - L;
    total = run * 2 + L;
    if (l.y < -hd + L) s = run + L / 2;
    else if (l.x >= hw - sw) s = hd - l.y;
    else if (l.x <= -hw + sw) s = run + L + (l.y - (-hd + L));
    else return null; // 가운데 틈
  } else {
    return null;
  }
  return Math.max(0, (H * Math.min(total, Math.max(0, s))) / total - STAIR_STRUCT);
}

/** 비품이 차지하는 자리 중 계단 아랫면이 가장 낮은 곳 (모서리·변 가운데·가운데를 봄) */
export function minStairUnderside(st, item, H) {
  const pts = bodyPolygon(item);
  const samples = [...pts, { x: item.x, y: item.y }, ...pts.map((p, i) => ({ x: (p.x + pts[(i + 1) % pts.length].x) / 2, y: (p.y + pts[(i + 1) % pts.length].y) / 2 }))];
  let min = null;
  samples.forEach(p => { const u = stairUndersideAt(st, p, H); if (u !== null && (min === null || u < min)) min = u; });
  return min;
}

/** 높이 h(mm)인 물건이 계단 시작점에서 몇 mm 안쪽(걸어 올라가는 길 기준)부터 들어가는지 */
export function stairDistanceForHeight(st, h, H) {
  let total = st.d;
  if (st.shape === 'stairsL') { const sw = stairArm(st); total = (st.d - sw) + sw + (st.w - sw); }
  if (st.shape === 'stairsU') { const sw = stairArm(st); const L = Math.min(sw, st.d * 0.4); total = (st.d - L) * 2 + L; }
  return Math.round(((h + STAIR_STRUCT) / H) * total);
}
