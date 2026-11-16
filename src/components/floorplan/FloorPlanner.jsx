import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ItemShape, FloorFill, polygonPath, shade } from './planShapes';
import {
  WALL_TYPES, wallTypeOf, STAIR_SHAPES, isVertical, defaultLevelHeight, isBeam, MEP_LINE_TYPES, mepLineTypeOf, ROOF_MATERIALS,
} from './planLibrary';
import {
  bodyPolygon, clearancePolygon, clearanceLocalRect, findWarnings, hasClearance, itemBox, wallBox, nearestGaps,
  snapToEdges, aabb, toLocal, toWorld, itemTransform, fmtLen, areaText, planBounds,
} from './planGeometry';
import { loadBgImage, saveBgImage, fileToPlanImage, isPdf, pdfPageCount, rememberBgImage } from './planImages';
import { LibraryPanel, InspectorPanel, PlanSettingsPanel, ChecksPanel } from './PlanPanels';
import CustomItemModal from './CustomItemModal';
import { generateId } from '../../utils/formatters';

const GRID = 50; // 옮길 때 50mm 단위로 맞춤
const HISTORY_MAX = 60;

const TOOLS = [
  { id: 'select', label: '고르기·옮기기', hint: '비품을 끌어 옮겨요. 빈 곳을 끌면 화면이 움직이고, 휠(두 손가락)로 키우고 줄여요. Shift를 누르고 누르면 여러 개를 골라요.' },
  { id: 'wall', label: '벽·보 그리기', hint: '벽(또는 보)이 꺾이는 곳을 차례로 누르세요. 보는 기둥을 누르면 기둥 가운데에 붙어요. 마지막 점에서 두 번 누르거나 Esc·오른쪽 버튼으로 끝내요. 가로·세로는 저절로 똑바로 맞춰져요.' },
  { id: 'roof', label: '지붕 그리기', hint: '지붕(또는 캐노피) 크기만큼 네모를 끌어서 그려요. 오른쪽 칸에서 처마 높이·경사·재료를 정해요. 기둥 밖으로 내밀면 처마가 돼요.' },
  { id: 'line', label: '전기·배관 선', hint: '전기 배선·에어 배관·급수·배수·가스 길을 차례로 눌러 그려요. 마지막 점에서 두 번 누르거나 Esc로 끝내요. 길이가 물량으로 모여요.' },
  { id: 'zone', label: '구역(방) 그리기', hint: '네모를 끌어서 그리면 넓이(㎡·평)가 나와요. 정비동, 고객 대기실, 화장실처럼 이름을 붙이세요.' },
  { id: 'measure', label: '줄자(치수)', hint: '두 점을 누르면 길이가 나오고 치수선으로 남아요. 치수선을 눌러 지울 수 있어요.' },
  { id: 'poly', label: '점 찍어 모양 만들기', hint: '모서리를 차례로 누르고, 첫 점을 다시 누르거나 두 번 눌러 끝내면 그 모양대로 비품이 만들어져요.' },
  { id: 'calibrate', label: '축척 맞추기', hint: '도면에서 길이를 아는 곳(벽 끝~끝, 치수선 등)의 양 끝을 차례로 누르고 실제 길이를 적으세요.' },
];

const emptyPlan = () => ({ items: [], walls: [], dims: [], lines: [], bg: null, ceiling: null, vehicleH: 1800, wallT: 200 });

const clean = (v) => JSON.parse(JSON.stringify(v));

/** 한 층에 따로 저장하는 것 */
const pickLevel = (p) => ({ items: p.items || [], walls: p.walls || [], dims: p.dims || [], lines: p.lines || [], bg: p.bg || null, ceiling: p.ceiling || null, slab: p.slab || 'auto' });

const Plan3D = lazy(() => import('./Plan3D'));

const snapV = (v, step = GRID) => Math.round(v / step) * step;

/** 벽 끝점: 앞 점과 거의 가로·세로면 똑바로 */
function orthoSnap(p, from, z) {
  if (!from) return p;
  const dx = p.x - from.x; const dy = p.y - from.y;
  const ang = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
  const near = (a, b) => Math.abs(a - b) < 6;
  if (near(ang, 0) || near(ang, 180)) return { x: p.x, y: from.y };
  if (near(ang, 90)) return { x: from.x, y: p.y };
  return p;
}

export function makeItem(tpl, at = { x: 0, y: 0 }) {
  const it = {
    id: generateId(),
    key: tpl.key || null,
    name: tpl.name || '비품',
    shape: tpl.shape || 'box',
    kind: tpl.kind || 'equip',
    w: Number(tpl.w) || 1000,
    d: Number(tpl.d) || 1000,
    h: Number(tpl.h) || 0,
    clear: { f: 0, b: 0, l: 0, r: 0, ...(tpl.clear || {}) },
    color: tpl.color || '#94a3b8',
    x: snapV(at.x), y: snapV(at.y), rot: tpl.rot || 0,
  };
  if (tpl.lift) it.lift = tpl.lift;
  if (tpl.elev) it.elev = tpl.elev;
  if (tpl.prof) it.prof = { ...tpl.prof };
  // 조명 밝기·전력, 지붕 모양, 불투명 자동문
  ['lm', 'watt', 'roofType', 'rise', 'material', 'opaque', 'ceilH', 'openUnder', 'railColor', 'postColor', 'noRail'].forEach(k => { if (tpl[k] !== undefined) it[k] = tpl[k]; });
  // 3D 모습: 모양 빌리기 / 사진 상자 / 3D 모델 파일
  if (tpl.look) it.look = tpl.look;
  if (tpl.faces) it.faces = { ...tpl.faces };
  if (tpl.model) { it.model = { ...tpl.model }; it.modelRot = tpl.modelRot || 0; }
  if (tpl.floor) it.floor = { ...tpl.floor };
  if (tpl.points) { it.points = tpl.points; it.baseW = tpl.baseW || it.w; it.baseD = tpl.baseD || it.d; }
  if (tpl.img) it.img = tpl.img;
  if (tpl.arm) it.arm = tpl.arm;
  if (tpl.equipId) it.equipId = tpl.equipId;
  if (tpl.tplId) it.tplId = tpl.tplId;
  return it;
}

/** 아래층 비춰 보기: 벽과 계단·기둥·승강기만 흐리게 */
function LevelGhost({ level, z }) {
  if (!level) return null;
  return (
    <g className="fp-ui fp-ghost" opacity={0.28} pointerEvents="none">
      {level.walls.map(w => <path key={w.id} d={polygonPath(wallPolygonFor(w))} fill="var(--fp-wall)" />)}
      {level.items.filter(it => isVertical(it) || it.kind === 'column').map(it => (
        <g key={it.id} transform={itemTransform(it)}><ItemShape item={it} z={z} /></g>
      ))}
    </g>
  );
}

const isLiftShape = (s) => ['lift2', 'lift4', 'scissor'].includes(s);

/** 크기 조절 손잡이 8개 (sx·sy: 비품 안쪽에서 어느 쪽 변인지, 앞=아래 +y) */
const RESIZE_HANDLES = [
  { id: 'se', sx: 1, sy: 1, cursor: 'nwse-resize' },
  { id: 'nw', sx: -1, sy: -1, cursor: 'nwse-resize' },
  { id: 'ne', sx: 1, sy: -1, cursor: 'nesw-resize' },
  { id: 'sw', sx: -1, sy: 1, cursor: 'nesw-resize' },
  { id: 'n', sx: 0, sy: -1, cursor: 'ns-resize' },
  { id: 's', sx: 0, sy: 1, cursor: 'ns-resize' },
  { id: 'e', sx: 1, sy: 0, cursor: 'ew-resize' },
  { id: 'w', sx: -1, sy: 0, cursor: 'ew-resize' },
];

const PlanItem = memo(function PlanItem({ item, z, warn, showClear, showCar, showFloor = true, showLightRange, levelH, selected }) {
  const fs = 12 / z;
  if (item.kind === 'roof') {
    // 지붕: 머리 위라 점선·빗금. 테두리와 이름표를 눌러야 고름 (안쪽은 아래 비품을 누를 수 있게)
    const hw = item.w / 2; const hd = item.d / 2;
    const c = item.color || '#94a3b8';
    const pid = `fp-roof-${item.id}`;
    const step = Math.max(300, 18 / z);
    const typeLabel = { flat: '평지붕', mono: '한쪽 경사', gable: '양쪽 경사' }[item.roofType] || '지붕';
    return (
      <g transform={itemTransform(item)}>
        <defs>
          <pattern id={pid} width={step} height={step} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path d={`M0,0 V${step}`} stroke={c} strokeWidth={Math.max(4, 1 / z)} strokeOpacity={0.35} />
          </pattern>
        </defs>
        <rect x={-hw} y={-hd} width={item.w} height={item.d} fill={`url(#${pid})`} stroke="none" pointerEvents="none" />
        <g pointerEvents="none"><ItemShape item={item} z={z} /></g>
        <rect data-role="item" data-id={item.id} x={-hw} y={-hd} width={item.w} height={item.d} fill="none" stroke="transparent" strokeWidth={14} vectorEffect="non-scaling-stroke" style={{ cursor: 'move' }} />
        <g data-role="item" data-id={item.id} transform={item.flip ? 'scale(-1 1)' : undefined} style={{ cursor: 'move' }}>
          <text x={0} y={-hd + fs * 1.6} textAnchor="middle" fontSize={fs * 1.1} fontWeight={800} fill={c === '#e5e7eb' ? 'var(--fp-text)' : c} stroke="var(--fp-bg)" strokeWidth={fs * 0.3} paintOrder="stroke">
            {item.name} · {typeLabel} · 처마 {fmtLen(item.h || 0)}
          </text>
        </g>
        {selected && <rect x={-hw} y={-hd} width={item.w} height={item.d} fill="none" stroke="var(--color-accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
      </g>
    );
  }
  if (item.kind === 'light' && showLightRange) {
    // 조명이 비추는 범위(어림): 붙은 높이의 0.7배 반지름
    const mount = Number(item.elev) || Number(item.ceilMount) || levelH || 3000;
    return (
      <g>
        <circle cx={item.x} cy={item.y} r={mount * 0.7} fill="#fde047" fillOpacity={0.12} stroke="#eab308" strokeOpacity={0.4} strokeDasharray="4 4" strokeWidth={1} vectorEffect="non-scaling-stroke" pointerEvents="none" />
        <PlanItem item={item} z={z} warn={warn} showClear={showClear} selected={selected} />
      </g>
    );
  }
  if (item.kind === 'zone') {
    const hw = item.w / 2; const hd = item.d / 2;
    return (
      <g transform={itemTransform(item)}>
        {showFloor && item.floor?.type
          ? <FloorFill item={item} z={z} />
          : <rect x={-hw} y={-hd} width={item.w} height={item.d} fill={item.color} fillOpacity={0.1} stroke="none" pointerEvents="none" />}
        <rect x={-hw} y={-hd} width={item.w} height={item.d} fill="none" stroke={item.color} strokeWidth={selected ? 2.4 : 1.6} strokeDasharray="8 5" vectorEffect="non-scaling-stroke" pointerEvents="none" />
        {/* 테두리와 이름표를 눌러야 고름 (안쪽을 끌면 화면이 움직이게) */}
        <rect data-role="item" data-id={item.id} x={-hw} y={-hd} width={item.w} height={item.d} fill="none" stroke="transparent" strokeWidth={14} vectorEffect="non-scaling-stroke" style={{ cursor: 'move' }} />
        <g data-role="item" data-id={item.id} transform={item.flip ? 'scale(-1 1)' : undefined} style={{ cursor: 'move' }}>
          <text x={0} y={-fs * 0.2} textAnchor="middle" fontSize={fs * 1.25} fontWeight={800} fill={item.color} stroke="var(--fp-bg)" strokeWidth={fs * 0.3} paintOrder="stroke">{item.name}</text>
          <text x={0} y={fs * 1.3} textAnchor="middle" fontSize={fs} fontWeight={600} fill="var(--fp-text)" stroke="var(--fp-bg)" strokeWidth={fs * 0.3} paintOrder="stroke">{areaText(item.w, item.d)}</text>
        </g>
      </g>
    );
  }
  if (item.kind === 'text') {
    return (
      <g transform={`translate(${item.x} ${item.y}) rotate(${item.rot || 0})`} data-role="item" data-id={item.id} style={{ cursor: 'move' }}>
        <rect x={-item.w / 2} y={-item.d / 2} width={item.w} height={item.d} fill="transparent" />
        <text data-keep-size="1" x={0} y={0} textAnchor="middle" dominantBaseline="central" fontSize={item.d * 0.8} fontWeight={700} fill={item.color === '#e2e8f0' ? 'var(--fp-text)' : item.color}>{item.name}</text>
      </g>
    );
  }
  const r = clearanceLocalRect(item);
  const outline = warn === 'red' ? '#ef4444' : warn === 'amber' ? '#f59e0b' : null;
  const showLabel = Math.min(item.w, item.d) * z > 26;
  return (
    <g>
      <g transform={itemTransform(item)}>
        {showClear && hasClearance(item) && !item.hideClear && (
          <rect x={r.x0} y={r.y0} width={r.x1 - r.x0} height={r.y1 - r.y0} fill={outline || item.color} fillOpacity={outline ? 0.12 : 0.06}
            stroke={outline || item.color} strokeOpacity={0.55} strokeDasharray="3 4" strokeWidth={1} vectorEffect="non-scaling-stroke" pointerEvents="none" />
        )}
        <g data-role="item" data-id={item.id} style={{ cursor: item.locked ? 'default' : 'move' }}>
          <ItemShape item={item} />
          {item.openUnder && (
            <g pointerEvents="none">
              <rect x={-item.w / 2} y={-item.d / 2} width={item.w} height={item.d} fill="none" stroke={item.color || '#94a3b8'} strokeWidth={1.4} strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
              <text x={0} y={item.d / 2 - fs * 0.8} textAnchor="middle" fontSize={fs * 0.9} fontWeight={700} fill={item.color || '#94a3b8'} stroke="var(--fp-bg)" strokeWidth={fs * 0.25} paintOrder="stroke"
                transform={item.flip ? 'scale(-1 1)' : undefined}>아래 빈 공간</text>
            </g>
          )}
          {/* 누르기 쉽게 몸체 전체를 덮는 투명 판 */}
          <rect x={-item.w / 2} y={-item.d / 2} width={item.w} height={item.d} fill="transparent" />
        </g>
        {showCar && isLiftShape(item.shape) && (
          <g opacity={0.55} pointerEvents="none">
            <ItemShape item={{ shape: 'car', w: 1850, d: 4800, color: '#94a3b8' }} />
          </g>
        )}
      </g>
      {outline && (
        <path d={polygonPath(bodyPolygon(item))} fill="none" stroke={outline} strokeWidth={2.6} vectorEffect="non-scaling-stroke" pointerEvents="none" />
      )}
      {item.kind !== 'arch' && (
        <text data-small={showLabel ? undefined : '1'} style={showLabel ? undefined : { display: 'none' }} x={item.x} y={item.y} textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight={700}
          fill="var(--fp-text)" stroke="var(--fp-bg)" strokeWidth={fs * 0.28} paintOrder="stroke" pointerEvents="none">
          {item.name}
        </text>
      )}
    </g>
  );
});

/** 벽 그리기: 일반 벽 / 가벽 / 유리벽 / 통유리 외벽 */
const WallShape = memo(function WallShape({ wall, selected, z }) {
  const type = wall.type || 'concrete';
  const pts = wallPolygonFor(wall);
  const d = polygonPath(pts);
  const sel = { stroke: 'var(--color-accent)', strokeWidth: 2.5 };
  const common = { 'data-role': 'wall', 'data-id': wall.id, d, vectorEffect: 'non-scaling-stroke', style: { cursor: 'move' } };
  const c = wall.color || wallTypeOf(type).color || 'var(--fp-wall)';
  if (isBeam(wall)) {
    // 보: 머리 위에 걸리는 것이라 점선으로 (바닥 비품과 겹쳐도 됨)
    return (
      <g>
        <path {...common} fill={c} fillOpacity={0.12} stroke={selected ? sel.stroke : c} strokeWidth={selected ? sel.strokeWidth : 1.3} strokeDasharray="10 6" />
        <path d={`M${wall.x1},${wall.y1} L${wall.x2},${wall.y2}`} stroke={c} strokeWidth={1} strokeDasharray="14 4 2 4" fill="none" vectorEffect="non-scaling-stroke" pointerEvents="none" />
      </g>
    );
  }
  if (type === 'glass' || type === 'curtain') {
    const dx = wall.x2 - wall.x1; const dy = wall.y2 - wall.y1;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len; const uy = dy / len; const nx = -uy * (wall.t / 2); const ny = ux * (wall.t / 2);
    // 통유리 외벽은 1,200mm마다 세로 틀(멀리언)
    const n = type === 'curtain' ? Math.max(1, Math.round(len / 1200)) : 0;
    const mull = Array.from({ length: Math.max(0, n - 1) }, (_, i) => {
      const k = (len / n) * (i + 1);
      const px = wall.x1 + ux * k; const py = wall.y1 + uy * k;
      return `M${px + nx},${py + ny} L${px - nx},${py - ny}`;
    }).join(' ');
    return (
      <g>
        <path {...common} fill="#bae6fd" fillOpacity={0.5} stroke={selected ? sel.stroke : c} strokeWidth={selected ? sel.strokeWidth : 1.3} />
        <path d={`M${wall.x1},${wall.y1} L${wall.x2},${wall.y2}${mull ? ` ${mull}` : ''}`} stroke={c} strokeWidth={type === 'curtain' ? 1.4 : 1} fill="none" vectorEffect="non-scaling-stroke" pointerEvents="none" />
      </g>
    );
  }
  const body = type === 'light' ? (
    <>
      <path {...common} fill={c} fillOpacity={0.45} stroke={selected ? sel.stroke : c} strokeWidth={selected ? sel.strokeWidth : 1.3} />
      <path d={`M${wall.x1},${wall.y1} L${wall.x2},${wall.y2}`} stroke={c} strokeWidth={1} strokeDasharray="6 4" fill="none" vectorEffect="non-scaling-stroke" pointerEvents="none" />
    </>
  ) : <path {...common} fill={c} stroke={selected ? sel.stroke : c} strokeWidth={selected ? sel.strokeWidth : 1} />;
  return (
    <g>
      {body}
      <WallFaces wall={wall} z={z} selected={selected} />
    </g>
  );
});

/**
 * 벽면 꾸미기 표시: A면(벽을 그린 방향의 한쪽)·B면에 페인트 색 줄, 그 바깥에 루바(나무) 줄
 * 고른 벽에는 어느 쪽이 A·B인지 글자로 보여줌
 */
function WallFaces({ wall, z, selected }) {
  const faces = wall.faces || {};
  const dx = wall.x2 - wall.x1; const dy = wall.y2 - wall.y1;
  const len = Math.hypot(dx, dy);
  if (len < 1 || (!selected && !faces.a && !faces.b)) return null;
  const nx = -dy / len; const ny = dx / len;
  const t = wall.t || 200;
  const band = (sign, from, to) => {
    const o0 = sign * (t / 2 + from); const o1 = sign * (t / 2 + to);
    return `M${wall.x1 + nx * o0},${wall.y1 + ny * o0} L${wall.x2 + nx * o0},${wall.y2 + ny * o0} L${wall.x2 + nx * o1},${wall.y2 + ny * o1} L${wall.x1 + nx * o1},${wall.y1 + ny * o1} Z`;
  };
  const sp = Math.max(20, 2.5 / z); const sw = Math.max(35, 4.5 / z);
  return (
    <g pointerEvents="none">
      {['a', 'b'].map(side => {
        const f = faces[side];
        if (!f) return null;
        const sign = side === 'a' ? 1 : -1;
        const paintW = f.paint ? sp : 0;
        return (
          <g key={side}>
            {f.paint && <path d={band(sign, 0, sp)} fill={f.paint} stroke={shade(f.paint, -0.3)} strokeWidth={0.6} vectorEffect="non-scaling-stroke" />}
            {f.wainscot && (
              <path d={band(sign, paintW, paintW + sw)} fill={f.wainscot.color || '#b08968'} fillOpacity={0.9}
                stroke={shade(f.wainscot.color || '#b08968', -0.4)} strokeWidth={1} strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
            )}
          </g>
        );
      })}
      {selected && ['a', 'b'].map(side => {
        const sign = side === 'a' ? 1 : -1;
        const off = sign * (t / 2 + sp + sw + 12 / z);
        return (
          <text key={side} className="fp-ui" x={(wall.x1 + wall.x2) / 2 + nx * off} y={(wall.y1 + wall.y2) / 2 + ny * off}
            textAnchor="middle" dominantBaseline="central" fontSize={13 / z} fontWeight={800}
            fill="var(--color-accent)" stroke="var(--fp-bg)" strokeWidth={3 / z} paintOrder="stroke">{side.toUpperCase()}면</text>
        );
      })}
    </g>
  );
}

/** 전기·배관 선: 종류별 색·선 모양, 전체 길이 표시 */
const polyLen = (pts = []) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0), 0);
const MepLine = memo(function MepLine({ line, z, selected }) {
  const lt = mepLineTypeOf(line.type);
  const pts = line.pts || [];
  if (pts.length < 2) return null;
  const d = `M${pts.map(p => `${p.x},${p.y}`).join(' L')}`;
  const fs = 11 / z;
  // 가장 긴 구간 가운데에 이름·길이
  let best = 1; let bl = 0;
  pts.forEach((p, i) => { if (i) { const l = Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y); if (l > bl) { bl = l; best = i; } } });
  const a = pts[best - 1]; const b = pts[best];
  return (
    <g>
      <path d={d} fill="none" stroke="transparent" strokeWidth={14} vectorEffect="non-scaling-stroke" data-role="line" data-id={line.id} style={{ cursor: 'pointer' }} />
      <path d={d} fill="none" stroke={selected ? 'var(--color-accent)' : lt.color} strokeWidth={selected ? 3.2 : 2.2} strokeDasharray={lt.dash || undefined}
        strokeLinejoin="round" vectorEffect="non-scaling-stroke" pointerEvents="none" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3 / z} fill={lt.color} pointerEvents="none" />)}
      <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - fs * 0.6} textAnchor="middle" fontSize={fs} fontWeight={700} fill={lt.color}
        stroke="var(--fp-bg)" strokeWidth={fs * 0.3} paintOrder="stroke" pointerEvents="none">{lt.label} {fmtLen(polyLen(pts))}</text>
    </g>
  );
});

function DimLine({ x1, y1, x2, y2, z, color = 'var(--fp-dim)', label, selected, id }) {
  const fs = 11 / z;
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 1) return null;
  const nx = -(y2 - y1) / len; const ny = (x2 - x1) / len;
  const tick = 6 / z;
  const mx = (x1 + x2) / 2; const my = (y1 + y2) / 2;
  let ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  if (ang > 90 || ang < -90) ang += 180;
  return (
    <g data-role={id ? 'dim' : undefined} data-id={id} style={id ? { cursor: 'pointer' } : undefined}>
      {id && <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={12} vectorEffect="non-scaling-stroke" />}
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={selected ? 2.4 : 1.3} vectorEffect="non-scaling-stroke" />
      <line x1={x1 - nx * tick} y1={y1 - ny * tick} x2={x1 + nx * tick} y2={y1 + ny * tick} stroke={color} strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
      <line x1={x2 - nx * tick} y1={y2 - ny * tick} x2={x2 + nx * tick} y2={y2 + ny * tick} stroke={color} strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
      <text x={mx} y={my} transform={`rotate(${ang} ${mx} ${my}) translate(0 ${-fs * 0.6})`} textAnchor="middle" fontSize={fs} fontWeight={800}
        fill={color} stroke="var(--fp-bg)" strokeWidth={fs * 0.3} paintOrder="stroke">{label || fmtLen(len)}</text>
    </g>
  );
}

export default function FloorPlanner({
  layout, onSave, branch, branchId, demoMode, equipments = [], myLibrary = [], onSaveTemplate, onRemoveTemplate,
}) {
  // 층: 예전 배치안(층 없이 저장된 것)은 '1층' 하나로 읽음
  const init = useMemo(() => {
    const src = clean({
      levels: Array.isArray(layout.levels) && layout.levels.length ? layout.levels : null,
      items: layout.items || [], walls: layout.walls || [], dims: layout.dims || [], bg: layout.bg || null, ceiling: layout.ceiling || null,
    });
    const levels = (src.levels || [{ id: 'L1', name: '1층', items: src.items, walls: src.walls, dims: src.dims, bg: src.bg, ceiling: src.ceiling }])
      .map((l, i) => ({ id: l.id || generateId(), name: l.name || `${i + 1}층`, items: l.items || [], walls: l.walls || [], dims: l.dims || [], lines: l.lines || [], bg: l.bg || null, ceiling: l.ceiling || null, slab: l.slab || 'auto' }));
    if (!levels[0].ceiling && branch?.property?.floorHeight) levels[0].ceiling = Math.round(Number(branch.property.floorHeight) * 1000);
    return { levels, vehicleH: layout.vehicleH || 1800, wallT: layout.wallT || 200 };
  }, [layout.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const initial = useMemo(() => ({ ...emptyPlan(), ...pickLevel(init.levels[0]), vehicleH: init.vehicleH, wallT: init.wallT }), [init]);

  const [plan, setPlanState] = useState(initial);
  const planRef = useRef(initial);
  const [levels, setLevelsState] = useState(init.levels); // 지금 층은 plan 쪽이 최신
  const levelsRef = useRef(init.levels);
  const setLevels = (next) => { levelsRef.current = next; setLevelsState(next); };
  const [lvId, setLvIdState] = useState(init.levels[0].id);
  const lvIdRef = useRef(init.levels[0].id);
  const histMap = useRef({});
  const hist = useRef({ past: [], future: [] });
  const [histTick, setHistTick] = useState(0);
  const setPlan = useCallback((next) => { planRef.current = next; setPlanState(next); }, []);
  const commit = useCallback((next, prev = planRef.current) => {
    hist.current.past.push(prev);
    if (hist.current.past.length > HISTORY_MAX) hist.current.past.shift();
    hist.current.future = [];
    setPlan(next);
    setHistTick(t => t + 1);
  }, [setPlan]);
  const apply = useCallback((fn) => commit(fn(planRef.current)), [commit]);
  const undo = useCallback(() => {
    const prev = hist.current.past.pop();
    if (!prev) return;
    hist.current.future.push(planRef.current);
    setPlan(prev); setHistTick(t => t + 1);
  }, [setPlan]);
  const redo = useCallback(() => {
    const next = hist.current.future.pop();
    if (!next) return;
    hist.current.past.push(planRef.current);
    setPlan(next); setHistTick(t => t + 1);
  }, [setPlan]);

  /** 모든 층 (지금 층은 편집 중인 내용으로) */
  const allLevels = useCallback(() => levelsRef.current.map(l => (l.id === lvIdRef.current ? { ...l, ...pickLevel(planRef.current) } : l)), []);

  // 자동 저장 (바뀌고 1초 뒤). 층은 levels 안에 모두 넣고, 예전 칸(items 등)은 비움
  const [saveState, setSaveState] = useState('saved');
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return undefined; }
    setSaveState('dirty');
    const t = setTimeout(async () => {
      setSaveState('saving');
      try {
        await onSave(clean({ levels: allLevels(), vehicleH: plan.vehicleH, wallT: plan.wallT, items: [], walls: [], dims: [], bg: null, ceiling: null }));
        setSaveState('saved');
      } catch (err) {
        console.error('배치도 저장 실패', err);
        setSaveState('error');
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [plan, levels]); // eslint-disable-line react-hooks/exhaustive-deps

  // 층 바꾸기·더하기·지우기
  const switchLevel = (id, merged = allLevels()) => {
    setLevels(merged);
    if (id === lvIdRef.current) return;
    histMap.current[lvIdRef.current] = hist.current;
    hist.current = histMap.current[id] || { past: [], future: [] };
    const L = merged.find(l => l.id === id);
    if (!L) return;
    lvIdRef.current = id; setLvIdState(id);
    setPlan({ ...planRef.current, ...pickLevel(L) });
    setHistTick(t => t + 1);
    setSel({ kind: null, ids: [] }); setDraft(null); setToolState('select'); setGuides([]);
  };
  const addLevel = () => {
    const merged = allLevels();
    const top = merged[merged.length - 1];
    const copy = top.walls.length && window.confirm(`${top.name}의 벽·기둥을 새 층에 그대로 가져올까요?\n(바깥벽이 같으면 '확인', 빈 층으로 시작하려면 '취소')`);
    const L = {
      id: generateId(), name: `${merged.length + 1}층`, dims: [], bg: null, ceiling: null,
      walls: copy ? top.walls.map(w => ({ ...clean(w), id: generateId() })) : [],
      items: copy ? top.items.filter(it => it.kind === 'column').map(it => ({ ...clean(it), id: generateId() })) : [],
    };
    switchLevel(L.id, [...merged, L]);
  };
  const renameLevel = () => {
    const cur = levelsRef.current.find(l => l.id === lvIdRef.current);
    const name = window.prompt('층 이름 (예: 2층, 지하 1층, 옥상)', cur?.name || '');
    if (!name || !name.trim()) return;
    setLevels(allLevels().map(l => (l.id === lvIdRef.current ? { ...l, name: name.trim() } : l)));
  };
  const deleteLevel = () => {
    const merged = allLevels();
    if (merged.length < 2) return;
    const cur = merged.find(l => l.id === lvIdRef.current);
    if (!window.confirm(`'${cur.name}'을(를) 지울까요? 이 층에 놓은 것이 모두 사라지고 되돌릴 수 없어요.`)) return;
    const rest = merged.filter(l => l.id !== cur.id);
    delete histMap.current[cur.id];
    hist.current = histMap.current[rest[0].id] || { past: [], future: [] };
    lvIdRef.current = rest[0].id; setLvIdState(rest[0].id);
    setLevels(rest);
    setPlan({ ...planRef.current, ...pickLevel(rest[0]) });
    setHistTick(t => t + 1);
    setSel({ kind: null, ids: [] });
  };
  /** 고른 비품을 바로 위층 같은 자리에 (계단이면 '뚫린 곳'으로) */
  const copyUp = (it) => {
    const merged = allLevels();
    const i = merged.findIndex(l => l.id === lvIdRef.current);
    const up = merged[i + 1];
    if (!up) return;
    const isStair = STAIR_SHAPES.includes(it.shape) || it.shape === 'ramp';
    const copy = isStair
      ? { ...makeItem({ name: `뚫린 곳 · ${it.name}`, shape: 'void', kind: 'void', w: it.w, d: it.d, color: '#94a3b8' }), x: it.x, y: it.y, rot: it.rot || 0, flip: it.flip || false }
      : { ...clean(it), id: generateId(), locked: false };
    setLevels(merged.map(l => (l.id === up.id ? { ...l, items: [...l.items, copy] } : l)));
    alert(`${up.name}에 ${isStair ? '뚫린 곳(계단 구멍)을' : `'${it.name}'을(를)`} 같은 자리에 놓았어요.`);
  };

  // 도면 그림
  const [bgUrl, setBgUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    setBgUrl(null);
    if (plan.bg?.ref) loadBgImage(plan.bg.ref, demoMode).then(u => { if (alive) setBgUrl(u); }).catch(() => {});
    return () => { alive = false; };
  }, [plan.bg?.ref?.id, demoMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const bgBox = plan.bg ? { x0: plan.bg.x, y0: plan.bg.y, x1: plan.bg.x + plan.bg.w * plan.bg.mmPerPx, y1: plan.bg.y + plan.bg.h * plan.bg.mmPerPx } : null;

  // 화면
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 560 });
  const [view, setViewState] = useState({ x: -2000, y: -2000, z: 0.05 });
  const viewRef = useRef(view);
  const setView = useCallback((v) => { viewRef.current = v; setViewState(v); }, []);
  const [full, setFull] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [full]);

  const fitView = useCallback((p = planRef.current) => {
    const el = wrapRef.current;
    if (!el) return;
    const bb = p.bg ? { x0: p.bg.x, y0: p.bg.y, x1: p.bg.x + p.bg.w * p.bg.mmPerPx, y1: p.bg.y + p.bg.h * p.bg.mmPerPx } : null;
    const b = planBounds(p, bb);
    const W = el.clientWidth || 800; const H = el.clientHeight || 560;
    const bw = Math.max(2000, b.x1 - b.x0); const bh = Math.max(2000, b.y1 - b.y0);
    const z = Math.min(W / bw, H / bh) * 0.9;
    setView({ z, x: (b.x0 + b.x1) / 2 - W / z / 2, y: (b.y0 + b.y1) / 2 - H / z / 2 });
  }, [setView]);

  useEffect(() => { requestAnimationFrame(() => fitView(initial)); }, [initial, fitView]);
  useEffect(() => { const t = setTimeout(() => fitView(), 50); return () => clearTimeout(t); }, [full]); // eslint-disable-line react-hooks/exhaustive-deps
  // 크게 보기: 화면 전환 효과(애니메이션)가 덮개를 안쪽에 가두지 않게 잠시 끔
  useEffect(() => {
    document.body.classList.toggle('fp-fullscreen-on', full);
    return () => document.body.classList.remove('fp-fullscreen-on');
  }, [full]);

  const zoomAt = useCallback((factor, cx, cy) => {
    const v = viewRef.current;
    const z = Math.min(2, Math.max(0.004, v.z * factor));
    const wx = v.x + cx / v.z; const wy = v.y + cy / v.z;
    setView({ z, x: wx - cx / z, y: wy - cy / z });
  }, [setView]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt, full]);

  // 도구·고르기
  const [tool, setToolState] = useState('select');
  const [draft, setDraftState] = useState(null); // 그리는 중인 점들
  const draftRef = useRef(null); // 손을 빨리 움직여도 최신 점을 읽도록
  const setDraft = (v) => { draftRef.current = v; setDraftState(v); };
  const [cursor, setCursor] = useState(null);
  const [sel, setSel] = useState({ kind: null, ids: [] });
  const [guides, setGuides] = useState([]);
  const [opts, setOpts] = useState({ snap: true, clear: true, car: false, gaps: true, grid: true, floor: true, below: true, roof: true, mep: true, lightRange: false });
  const [lineType, setLineType] = useState('elec'); // 새로 그릴 전기·배관 선 종류
  const [view3d, setView3d] = useState(false);
  const [wallType, setWallType] = useState('concrete'); // 새로 그릴 벽 종류
  const [customOpen, setCustomOpen] = useState(null);
  const [calibInput, setCalibInput] = useState('');
  const [bgBusy, setBgBusy] = useState('');
  const setTool = (t) => { setToolState(t); setDraft(null); setGuides([]); if (t !== 'select') setSel({ kind: null, ids: [] }); };

  const selectedItems = sel.kind === 'item' ? plan.items.filter(it => sel.ids.includes(it.id)) : [];
  const selectedWall = sel.kind === 'wall' ? plan.walls.find(w => w.id === sel.ids[0]) : null;
  const selectedDim = sel.kind === 'dim' ? plan.dims.find(d => d.id === sel.ids[0]) : null;
  const selectedLine = sel.kind === 'line' ? (plan.lines || []).find(l => l.id === sel.ids[0]) : null;

  const warnings = useMemo(() => findWarnings(plan.items, plan.walls, { ceiling: plan.ceiling, vehicleH: plan.vehicleH, levelH: plan.ceiling || defaultLevelHeight(Math.max(0, levels.findIndex(l => l.id === lvId))) }), [plan.items, plan.walls, plan.ceiling, plan.vehicleH, levels, lvId]);
  const warnMap = useMemo(() => {
    const m = new Map();
    warnings.forEach(w => {
      const lvl = w.type === 'overlap' || w.type === 'wall' ? 'red' : 'amber';
      const tgt = w.type === 'clear' ? w.ids.slice(-1) : w.ids;
      tgt.forEach(id => { if (m.get(id) !== 'red') m.set(id, lvl); });
    });
    return m;
  }, [warnings]);

  const toW = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    const v = viewRef.current;
    return { x: v.x + (e.clientX - r.left) / v.z, y: v.y + (e.clientY - r.top) / v.z };
  };

  const placeAt = useCallback((tpl, at) => {
    const v = viewRef.current;
    const p = at || { x: v.x + (wrapRef.current?.clientWidth || 800) / v.z / 2, y: v.y + (wrapRef.current?.clientHeight || 560) / v.z / 2 };
    const it = makeItem(tpl, p);
    commit({ ...planRef.current, items: [...planRef.current.items, it] });
    setToolState('select'); setDraft(null);
    setSel({ kind: 'item', ids: [it.id] });
    return it;
  }, [commit]);

  // 끌기 처리
  const drag = useRef(null);
  const pointers = useRef(new Map());

  const otherBoxes = (excludeIds) => [
    ...planRef.current.items.filter(it => !excludeIds.includes(it.id) && !['zone', 'text'].includes(it.kind)).map(itemBox),
    ...planRef.current.walls.filter(w => !isBeam(w)).map(wallBox),
  ];

  const finishPath = (override) => {
    const draft = override || draftRef.current;
    if (!draft?.pts) return;
    if (tool === 'line' && draft.pts.length >= 2) {
      const lt = mepLineTypeOf(lineType);
      const line = { id: generateId(), type: lt.type, pts: draft.pts.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) })), h: lt.h };
      commit({ ...planRef.current, lines: [...(planRef.current.lines || []), line] });
    }
    if (tool === 'wall' && draft.pts.length >= 2) {
      const t = wallType === 'concrete' ? (planRef.current.wallT || 200) : wallTypeOf(wallType).t;
      const walls = [];
      for (let i = 1; i < draft.pts.length; i++) {
        const a = draft.pts[i - 1]; const b = draft.pts[i];
        if (Math.hypot(b.x - a.x, b.y - a.y) > 50) walls.push({ id: generateId(), x1: a.x, y1: a.y, x2: b.x, y2: b.y, t, ...(wallType !== 'concrete' ? { type: wallType } : {}), ...(wallTypeOf(wallType).beam ? { depth: wallTypeOf(wallType).depth } : {}) });
      }
      if (walls.length) commit({ ...planRef.current, walls: [...planRef.current.walls, ...walls] });
    }
    if (tool === 'poly' && draft.pts.length >= 3) {
      const b = aabb(draft.pts);
      const cx = (b.x0 + b.x1) / 2; const cy = (b.y0 + b.y1) / 2;
      const w = Math.round(b.x1 - b.x0); const d = Math.round(b.y1 - b.y0);
      const points = draft.pts.map(p => ({ x: Math.round(p.x - cx), y: Math.round(p.y - cy) }));
      const it = { ...makeItem({ name: '새 비품', shape: 'poly', w, d, points, baseW: w, baseD: d, color: '#8b5cf6' }, { x: cx, y: cy }), x: cx, y: cy };
      commit({ ...planRef.current, items: [...planRef.current.items, it] });
      setToolState('select');
      setSel({ kind: 'item', ids: [it.id] });
    }
    setDraft(null);
  };

  const onPointerDown = (e) => {
    const draft = draftRef.current;
    if (e.button === 1) e.preventDefault();
    if (e.button === 2) { finishPath(); return; }
    try { svgRef.current.setPointerCapture(e.pointerId); } catch { /* 손가락을 이미 뗀 경우 */ }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      drag.current = { type: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), startPlan: drag.current?.startPlan };
      if (drag.current.startPlan) setPlan(drag.current.startPlan);
      return;
    }
    const w = toW(e);
    const z = viewRef.current.z;
    const sp = (p) => (opts.snap ? { x: snapV(p.x), y: snapV(p.y) } : p);

    if (tool === 'calibrate') {
      if (!draft?.p1 || draft.p2) setDraft({ p1: w });
      else { setDraft({ ...draft, p2: w }); setCalibInput(''); }
      return;
    }
    if (tool === 'measure') {
      if (!draft?.p1) setDraft({ p1: sp(w) });
      else {
        const p2 = orthoSnap(sp(w), draft.p1, z);
        if (Math.hypot(p2.x - draft.p1.x, p2.y - draft.p1.y) > 20) {
          commit({ ...planRef.current, dims: [...planRef.current.dims, { id: generateId(), x1: draft.p1.x, y1: draft.p1.y, x2: p2.x, y2: p2.y }] });
        }
        setDraft(null);
      }
      return;
    }
    if (tool === 'wall' || tool === 'poly' || tool === 'line') {
      const pts = draft?.pts || [];
      const last = pts[pts.length - 1];
      let p = sp(w);
      // 다른 벽 끝점에 붙이기
      if (tool === 'wall') {
        const tol = 12 / z;
        planRef.current.walls.forEach(wl => [[wl.x1, wl.y1], [wl.x2, wl.y2]].forEach(([x, y]) => { if (Math.hypot(x - w.x, y - w.y) < tol) p = { x, y }; }));
        // 보는 기둥 가운데에 붙이기 (기둥 크기 안을 누르면 가운데로)
        if (wallTypeOf(wallType).beam) {
          planRef.current.items.filter(it => it.kind === 'column').forEach(it => {
            if (Math.hypot(it.x - w.x, it.y - w.y) < Math.max(tol, Math.max(it.w, it.d) / 2 + 4 / z)) p = { x: it.x, y: it.y };
          });
        }
      }
      p = orthoSnap(p, last, z);
      if (pts.length >= 3 && tool === 'poly' && Math.hypot(p.x - pts[0].x, p.y - pts[0].y) < 14 / z) { finishPath(); return; }
      if (e.detail >= 2 && pts.length >= 1) { finishPath({ pts: last && Math.hypot(p.x - last.x, p.y - last.y) > 50 ? [...pts, p] : pts }); return; }
      if (last && Math.hypot(p.x - last.x, p.y - last.y) < 20) return;
      setDraft({ pts: [...pts, p] });
      return;
    }
    if (tool === 'zone' || tool === 'roof') {
      drag.current = { type: 'zone', start: sp(w), roof: tool === 'roof' };
      setDraft({ rect: { x0: sp(w).x, y0: sp(w).y, x1: sp(w).x, y1: sp(w).y } });
      return;
    }

    // 고르기 도구
    const target = e.target.closest?.('[data-role]');
    const role = target?.dataset.role; const id = target?.dataset.id;
    const startPlan = planRef.current;
    if (role === 'rotate' || role === 'resize') {
      const it = startPlan.items.find(x => x.id === id);
      if (it) drag.current = { type: role, id, startPlan, it, moved: false, h: target.dataset.h || 'se' };
      return;
    }
    if (role === 'wallEnd') {
      drag.current = { type: 'wallEnd', id, end: target.dataset.end, startPlan, moved: false };
      return;
    }
    if (role === 'item') {
      const it = startPlan.items.find(x => x.id === id);
      let ids = sel.kind === 'item' ? sel.ids : [];
      if (e.shiftKey) ids = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
      else if (!ids.includes(id)) ids = [id];
      setSel({ kind: 'item', ids });
      const movable = ids.filter(x => !startPlan.items.find(i => i.id === x)?.locked);
      if (it && !it.locked && movable.length) drag.current = { type: 'move', ids: movable, start: w, startPlan, moved: false };
      else drag.current = { type: 'pan', sx: e.clientX, sy: e.clientY, v: viewRef.current, moved: true };
      return;
    }
    if (role === 'wall') {
      setSel({ kind: 'wall', ids: [id] });
      drag.current = { type: 'wallMove', id, start: w, startPlan, moved: false };
      return;
    }
    if (role === 'dim') {
      setSel({ kind: 'dim', ids: [id] });
      return;
    }
    if (role === 'line') {
      setSel({ kind: 'line', ids: [id] });
      return;
    }
    drag.current = { type: 'pan', sx: e.clientX, sy: e.clientY, v: viewRef.current, moved: false, shift: e.shiftKey };
  };

  const onPointerMove = (e) => {
    const draft = draftRef.current;
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const w = toW(e);
    const z = viewRef.current.z;
    if (tool !== 'select') {
      let p = opts.snap && tool !== 'calibrate' ? { x: snapV(w.x), y: snapV(w.y) } : w;
      const last = draft?.pts?.[draft.pts.length - 1] || (tool === 'measure' ? draft?.p1 : null);
      if (tool !== 'calibrate') p = orthoSnap(p, last, z);
      setCursor(p);
    }
    const dr = drag.current;
    if (!dr) return;

    if (dr.type === 'pinch') {
      const pts = [...pointers.current.values()];
      if (pts.length < 2) return;
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const r = svgRef.current.getBoundingClientRect();
      zoomAt(dist / dr.dist, (pts[0].x + pts[1].x) / 2 - r.left, (pts[0].y + pts[1].y) / 2 - r.top);
      dr.dist = dist;
      return;
    }
    if (dr.type === 'pan') {
      const dx = e.clientX - dr.sx; const dy = e.clientY - dr.sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) dr.moved = true;
      setView({ ...viewRef.current, x: dr.v.x - dx / dr.v.z, y: dr.v.y - dy / dr.v.z });
      return;
    }
    if (dr.type === 'zone') {
      const p = opts.snap ? { x: snapV(w.x), y: snapV(w.y) } : w;
      setDraft({ rect: { x0: Math.min(dr.start.x, p.x), y0: Math.min(dr.start.y, p.y), x1: Math.max(dr.start.x, p.x), y1: Math.max(dr.start.y, p.y) } });
      return;
    }
    const sp = dr.startPlan;
    if (dr.type === 'move') {
      let dx = w.x - dr.start.x; let dy = w.y - dr.start.y;
      if (!dr.moved && Math.hypot(dx, dy) * z < 3) return;
      dr.moved = true;
      const moving = sp.items.filter(it => dr.ids.includes(it.id));
      const lead = moving[0];
      if (opts.snap && lead) {
        dx = snapV(lead.x + dx) - lead.x; dy = snapV(lead.y + dy) - lead.y;
      }
      let g = [];
      if (opts.snap && moving.length) {
        const box = aabb(moving.flatMap(it => bodyPolygon(it)));
        const shifted = { x0: box.x0 + dx, x1: box.x1 + dx, y0: box.y0 + dy, y1: box.y1 + dy };
        const s = snapToEdges(shifted, otherBoxes(dr.ids), 10 / z);
        dx += s.dx; dy += s.dy; g = s.guides;
      }
      setGuides(g);
      setPlan({ ...sp, items: sp.items.map(it => (dr.ids.includes(it.id) ? { ...it, x: it.x + dx, y: it.y + dy } : it)) });
      return;
    }
    if (dr.type === 'rotate') {
      const it = dr.it;
      let a = (Math.atan2(w.y - it.y, w.x - it.x) * 180) / Math.PI + 90;
      a = ((a % 360) + 360) % 360;
      const near90 = Math.round(a / 90) * 90;
      a = Math.abs(a - near90) < 6 ? near90 : (e.shiftKey ? a : Math.round(a / 5) * 5);
      a %= 360;
      dr.moved = true;
      setPlan({ ...sp, items: sp.items.map(x => (x.id === it.id ? { ...x, rot: a } : x)) });
      return;
    }
    if (dr.type === 'resize') {
      // 끄는 손잡이 쪽 변만 움직이고 반대쪽 변은 그대로 (비품 안쪽 좌표에서 계산 → 돌려 놓아도 맞음)
      const it = dr.it;
      const h = RESIZE_HANDLES.find(x => x.id === dr.h) || RESIZE_HANDLES[0];
      const p = toLocal(it, w);
      const step = opts.snap ? 10 : 1;
      const r = (v) => Math.round(v / step) * step;
      let x0 = -it.w / 2; let x1 = it.w / 2; let y0 = -it.d / 2; let y1 = it.d / 2;
      if (h.sx > 0) x1 = Math.max(x0 + 50, x0 + r(p.x - x0));
      if (h.sx < 0) x0 = Math.min(x1 - 50, x1 - r(x1 - p.x));
      if (h.sy > 0) y1 = Math.max(y0 + 50, y0 + r(p.y - y0));
      if (h.sy < 0) y0 = Math.min(y1 - 50, y1 - r(y1 - p.y));
      let nw = x1 - x0; let nd = y1 - y0;
      // 모서리 + Shift: 가로·세로 비율 그대로
      if (e.shiftKey && h.sx && h.sy) {
        const k = Math.max(nw / it.w, nd / it.d);
        nw = Math.max(50, r(it.w * k)); nd = Math.max(50, r(it.d * k));
        if (h.sx > 0) x1 = x0 + nw; else x0 = x1 - nw;
        if (h.sy > 0) y1 = y0 + nd; else y0 = y1 - nd;
      }
      const c = toWorld(it, { x: (x0 + x1) / 2, y: (y0 + y1) / 2 });
      dr.moved = true;
      setGuides([]);
      setPlan({ ...sp, items: sp.items.map(x => (x.id === it.id ? { ...x, w: nw, d: nd, x: c.x, y: c.y } : x)) });
      return;
    }
    if (dr.type === 'wallEnd') {
      const wl = sp.walls.find(x => x.id === dr.id);
      if (!wl) return;
      const other = dr.end === '1' ? { x: wl.x2, y: wl.y2 } : { x: wl.x1, y: wl.y1 };
      let p = opts.snap ? { x: snapV(w.x), y: snapV(w.y) } : w;
      sp.walls.forEach(o => { if (o.id !== wl.id) [[o.x1, o.y1], [o.x2, o.y2]].forEach(([x, y]) => { if (Math.hypot(x - w.x, y - w.y) < 12 / z) p = { x, y }; }); });
      p = orthoSnap(p, other, z);
      dr.moved = true;
      setPlan({ ...sp, walls: sp.walls.map(x => (x.id !== wl.id ? x : dr.end === '1' ? { ...x, x1: p.x, y1: p.y } : { ...x, x2: p.x, y2: p.y })) });
      return;
    }
    if (dr.type === 'wallMove') {
      let dx = w.x - dr.start.x; let dy = w.y - dr.start.y;
      if (!dr.moved && Math.hypot(dx, dy) * z < 3) return;
      if (opts.snap) { dx = snapV(dx); dy = snapV(dy); }
      dr.moved = true;
      setPlan({ ...sp, walls: sp.walls.map(x => (x.id === dr.id ? { ...x, x1: x.x1 + dx, y1: x.y1 + dy, x2: x.x2 + dx, y2: x.y2 + dy } : x)) });
    }
  };

  const onPointerUp = (e) => {
    const draft = draftRef.current;
    pointers.current.delete(e.pointerId);
    const dr = drag.current;
    if (dr?.type === 'pinch') { if (pointers.current.size === 0) drag.current = null; return; }
    drag.current = null;
    setGuides([]);
    if (!dr) return;
    if (dr.type === 'pan' && !dr.moved && !dr.shift) setSel({ kind: null, ids: [] });
    if (dr.type === 'zone') {
      const r = draft?.rect;
      setDraft(null);
      if (dr.roof && r && r.x1 - r.x0 > 300 && r.y1 - r.y0 > 300) {
        // 지붕: 처마 높이 = 층고(없으면 4,500mm), 한쪽 경사 5%
        const n = planRef.current.items.filter(i => i.kind === 'roof').length + 1;
        const d = r.y1 - r.y0;
        const it = {
          ...makeItem({ name: `지붕 ${n}`, shape: 'roof', kind: 'roof', w: r.x1 - r.x0, d, color: ROOF_MATERIALS[0].color }, { x: 0, y: 0 }),
          x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2,
          roofType: 'mono', rise: Math.round((d * 0.05) / 10) * 10, material: 'panel', h: planRef.current.ceiling || 4500,
        };
        commit({ ...planRef.current, items: [...planRef.current.items, it] });
        setToolState('select');
        setSel({ kind: 'item', ids: [it.id] });
        return;
      }
      if (r && r.x1 - r.x0 > 300 && r.y1 - r.y0 > 300) {
        const n = planRef.current.items.filter(i => i.kind === 'zone').length + 1;
        const it = { ...makeItem({ name: `구역 ${n}`, shape: 'zone', kind: 'zone', w: r.x1 - r.x0, d: r.y1 - r.y0, color: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4'][(n - 1) % 5] }, { x: 0, y: 0 }), x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 };
        commit({ ...planRef.current, items: [it, ...planRef.current.items] });
        setToolState('select');
        setSel({ kind: 'item', ids: [it.id] });
      }
      return;
    }
    if (dr.startPlan && dr.moved && planRef.current !== dr.startPlan) commit(planRef.current, dr.startPlan);
  };

  /**
   * 치수 자동: 건물 전체 가로·세로, 기둥 간격(가로 줄·세로 줄), 벽마다 길이를 치수선으로
   * - 자동으로 그린 치수선은 auto 표시 → 다시 누르면 새로 그리고, '자동 치수 지우기'로 한 번에 지움
   */
  const makeAutoDims = () => {
    const p = planRef.current;
    const walls = p.walls.filter(w => !isBeam(w));
    const cols = p.items.filter(it => it.kind === 'column');
    const pts = [...walls.flatMap(w => [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }]), ...cols.map(c => ({ x: c.x, y: c.y }))];
    if (pts.length < 2) { alert('치수를 그릴 벽이나 기둥이 없어요. 벽이나 기둥을 먼저 놓아 주세요.'); return; }
    const b = aabb(pts);
    const cx = (b.x0 + b.x1) / 2; const cy = (b.y0 + b.y1) / 2;
    const out = [];
    const add = (x1, y1, x2, y2) => { if (Math.hypot(x2 - x1, y2 - y1) >= 300) out.push({ id: generateId(), x1, y1, x2, y2, auto: true }); };
    // 전체 크기 (가장 바깥)
    add(b.x0, b.y0 - 2700, b.x1, b.y0 - 2700);
    add(b.x0 - 2700, b.y0, b.x0 - 2700, b.y1);
    // 기둥 간격
    if (cols.length >= 2) {
      const uniq = (arr) => arr.sort((a, c) => a - c).filter((v, i, a) => i === 0 || v - a[i - 1] > 50);
      const xs = uniq(cols.map(c => Math.round(c.x)));
      const ys = uniq(cols.map(c => Math.round(c.y)));
      for (let i = 1; i < xs.length; i++) add(xs[i - 1], b.y0 - 1800, xs[i], b.y0 - 1800);
      for (let i = 1; i < ys.length; i++) add(b.x0 - 1800, ys[i - 1], b.x0 - 1800, ys[i]);
    }
    // 벽마다 길이 (건물 바깥쪽으로 띄워서)
    walls.forEach(w => {
      const dx = w.x2 - w.x1; const dy = w.y2 - w.y1; const len = Math.hypot(dx, dy);
      if (len < 500) return;
      let nx = -dy / len; let ny = dx / len;
      if (nx * ((w.x1 + w.x2) / 2 - cx) + ny * ((w.y1 + w.y2) / 2 - cy) < 0) { nx = -nx; ny = -ny; }
      const off = (w.t || 200) / 2 + 600;
      add(w.x1 + nx * off, w.y1 + ny * off, w.x2 + nx * off, w.y2 + ny * off);
    });
    commit({ ...p, dims: [...p.dims.filter(d => !d.auto), ...out] });
  };

  // 단추·키보드로 하는 일
  const updateItems = useCallback((ids, patch) => {
    apply(p => ({ ...p, items: p.items.map(it => (ids.includes(it.id) ? { ...it, ...(typeof patch === 'function' ? patch(it) : patch) } : it)) }));
  }, [apply]);

  const deleteSelection = useCallback(() => {
    if (!sel.ids.length) return;
    if (sel.kind === 'item') apply(p => ({ ...p, items: p.items.filter(it => !sel.ids.includes(it.id) || it.locked) }));
    if (sel.kind === 'wall') apply(p => ({ ...p, walls: p.walls.filter(w => !sel.ids.includes(w.id)) }));
    if (sel.kind === 'dim') apply(p => ({ ...p, dims: p.dims.filter(d => !sel.ids.includes(d.id)) }));
    if (sel.kind === 'line') apply(p => ({ ...p, lines: (p.lines || []).filter(l => !sel.ids.includes(l.id)) }));
    setSel({ kind: null, ids: [] });
  }, [sel, apply]);

  const duplicateSelection = useCallback(() => {
    if (sel.kind !== 'item' || !sel.ids.length) return;
    const copies = planRef.current.items.filter(it => sel.ids.includes(it.id)).map(it => ({ ...clean(it), id: generateId(), x: it.x + 500, y: it.y + 500, locked: false }));
    apply(p => ({ ...p, items: [...p.items, ...copies] }));
    setSel({ kind: 'item', ids: copies.map(c => c.id) });
  }, [sel, apply]);

  const rotateSelection = useCallback((deg) => {
    if (sel.kind !== 'item') return;
    updateItems(sel.ids, it => ({ rot: (((it.rot || 0) + deg) % 360 + 360) % 360 }));
  }, [sel, updateItems]);

  useEffect(() => {
    const onKey = (e) => {
      const draft = draftRef.current;
      const tag = (e.target.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable) return;
      if (document.body.classList.contains('modal-open')) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (ctrl && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (ctrl && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelection(); return; }
      if (e.key === 'Escape') {
        if (draft?.pts?.length >= 2) finishPath();
        else { setDraft(null); if (tool !== 'select') setToolState('select'); else setSel({ kind: null, ids: [] }); }
        return;
      }
      if (e.key === 'Enter' && draft?.pts) { finishPath(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (sel.ids.length) { e.preventDefault(); deleteSelection(); } return; }
      if (e.key.toLowerCase() === 'r' && !ctrl) { rotateSelection(e.shiftKey ? -90 : 90); return; }
      const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (arrows[e.key] && sel.kind === 'item') {
        e.preventDefault();
        const step = e.shiftKey ? 100 : 10;
        const [ax, ay] = arrows[e.key];
        updateItems(sel.ids.filter(id => !planRef.current.items.find(i => i.id === id)?.locked), it => ({ x: it.x + ax * step, y: it.y + ay * step }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // 도면 올리기
  const fileRef = useRef(null);
  const onPickBg = async (file) => {
    if (!file) return;
    try {
      let page = 1;
      if (isPdf(file)) {
        setBgBusy('PDF를 읽는 중…');
        const n = await pdfPageCount(file);
        if (n > 1) {
          const ans = window.prompt(`PDF가 ${n}쪽이에요. 몇 쪽을 쓸까요? (1~${n})`, '1');
          if (ans === null) { setBgBusy(''); return; }
          page = Math.min(n, Math.max(1, parseInt(ans, 10) || 1));
        }
      }
      setBgBusy('도면을 넣는 중…');
      const img = await fileToPlanImage(file, page);
      const ref = await saveBgImage(branchId, demoMode, { ...img, name: file.name });
      rememberBgImage(ref, img.dataUrl);
      const old = planRef.current.bg;
      const mmPerPx = old?.calibrated && old.w ? (old.w * old.mmPerPx) / img.w : 30000 / img.w;
      const next = { ...planRef.current, bg: { ref, name: file.name, w: img.w, h: img.h, x: old?.x ?? 0, y: old?.y ?? 0, mmPerPx, opacity: old?.opacity ?? 0.7, calibrated: Boolean(old?.calibrated), hidden: false } };
      commit(next);
      setBgUrl(img.dataUrl);
      setBgBusy('');
      fitView(next);
      if (!next.bg.calibrated) setTool('calibrate');
    } catch (err) {
      setBgBusy('');
      alert(err.message || '도면을 넣지 못했어요.');
    }
  };

  const applyCalibration = () => {
    const draft = draftRef.current;
    const realMm = parseFloat(String(calibInput).replace(/,/g, '')); // 실제 길이(mm)
    if (!draft?.p1 || !draft?.p2 || !realMm || !plan.bg) return;
    const dw = Math.hypot(draft.p2.x - draft.p1.x, draft.p2.y - draft.p1.y);
    if (dw < 1) return;
    const k = realMm / dw;
    const bg = plan.bg; const o = draft.p1;
    // 첫 점을 기준으로 도면만 늘이거나 줄임
    const next = { ...plan, bg: { ...bg, mmPerPx: bg.mmPerPx * k, x: o.x + (bg.x - o.x) * k, y: o.y + (bg.y - o.y) * k, calibrated: true } };
    commit(next);
    setDraft(null); setToolState('select');
    fitView(next);
  };

  // 그림으로 내려받기 / 인쇄
  const renderPng = async () => {
    const svg = svgRef.current;
    const b = planBounds(planRef.current, plan.bg && !plan.bg.hidden ? bgBox : null);
    const pad = 800;
    const vb = { x: b.x0 - pad, y: b.y0 - pad, w: b.x1 - b.x0 + pad * 2, h: b.y1 - b.y0 + pad * 2 };
    const scale = Math.min(4000 / vb.w, 4000 / vb.h);
    const W = Math.round(vb.w * scale); const H = Math.round(vb.h * scale);
    const clone = svg.cloneNode(true);
    clone.querySelectorAll('.fp-ui').forEach(n => n.remove());
    clone.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    clone.setAttribute('width', W); clone.setAttribute('height', H);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    // 글자 크기를 그림 크기에 맞게 다시 계산
    const k = (viewRef.current.z / scale) * 2.4;
    clone.querySelectorAll('[data-small]').forEach(n => n.removeAttribute('style'));
    clone.querySelectorAll('text').forEach(t => {
      if (t.closest('[data-keep-size]')) return;
      const f = parseFloat(t.getAttribute('font-size'));
      if (f) t.setAttribute('font-size', f * k);
      const sw = parseFloat(t.getAttribute('stroke-width'));
      if (sw) t.setAttribute('stroke-width', sw * k);
    });
    let str = new XMLSerializer().serializeToString(clone);
    str = str.replaceAll('var(--fp-bg)', '#ffffff').replaceAll('var(--fp-text)', '#0f172a').replaceAll('var(--fp-wall)', '#334155')
      .replaceAll('var(--fp-dim)', '#0f766e').replaceAll('var(--fp-grid)', '#e2e8f0').replaceAll('var(--fp-grid2)', '#cbd5e1');
    const img = new Image();
    const url = URL.createObjectURL(new Blob([str], { type: 'image/svg+xml;charset=utf-8' }));
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const c = document.createElement('canvas');
    c.width = W; c.height = H + 90;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 90);
    URL.revokeObjectURL(url);
    ctx.fillStyle = '#0f172a'; ctx.font = 'bold 36px sans-serif';
    ctx.fillText(`${branch?.name || ''} 배치도 · ${layout.name || ''}`, 30, 50);
    ctx.font = '22px sans-serif'; ctx.fillStyle = '#475569';
    ctx.fillText(`${new Date().toLocaleDateString('ko-KR')} · 격자 한 칸 ${gridStep.toLocaleString()}mm`, 30, 80);
    return c.toDataURL('image/png');
  };

  const downloadPng = async () => {
    try {
      const data = await renderPng();
      const a = document.createElement('a');
      a.href = data; a.download = `${branch?.name || '지점'}_배치도_${layout.name || ''}.png`;
      a.click();
    } catch (err) {
      console.error(err);
      alert('그림을 만들지 못했어요.');
    }
  };

  const printPlan = async () => {
    try {
      const data = await renderPng();
      const win = window.open('', '_blank');
      if (!win) { alert('새 창이 막혀 있어요. 그림 저장으로 내려받아 인쇄해 주세요.'); return; }
      win.document.write(`<!doctype html><title>배치도</title><style>@page{size:landscape;margin:10mm}body{margin:0}img{width:100%;height:auto}</style><img src="${data}" onload="setTimeout(()=>print(),200)">`);
      win.document.close();
    } catch {
      alert('인쇄 화면을 만들지 못했어요.');
    }
  };

  // 화면 그리기
  const z = view.z;
  const vw = size.w / z; const vh = size.h / z;
  const gridStep = z * 1000 >= 18 ? 1000 : 5000;
  const single = selectedItems.length === 1 ? selectedItems[0] : null;
  const gaps = useMemo(() => {
    if (!opts.gaps || !single || ['zone', 'text', 'roof', 'light'].includes(single.kind)) return [];
    return nearestGaps(itemBox(single), [
      ...plan.items.filter(it => it.id !== single.id && !['zone', 'text', 'roof', 'light'].includes(it.kind)).map(itemBox),
      ...plan.walls.filter(w => !isBeam(w)).map(wallBox),
    ]);
  }, [opts.gaps, single, plan.items, plan.walls]);

  const zones = plan.items.filter(it => it.kind === 'zone');
  // 아래가 빈 계단은 먼저 그려서, 그 밑에 넣은 비품이 위에 보이게
  const others = plan.items.filter(it => it.kind !== 'zone' && it.kind !== 'roof').sort((a, b) => (b.openUnder ? 1 : 0) - (a.openUnder ? 1 : 0));
  const roofs = plan.items.filter(it => it.kind === 'roof');
  const levelHNow = plan.ceiling || defaultLevelHeight(Math.max(0, levels.findIndex(l => l.id === lvId)));
  const toolInfo = TOOLS.find(t => t.id === tool);
  const lvIndex = Math.max(0, levels.findIndex(l => l.id === lvId));
  const below = lvIndex > 0 ? levels[lvIndex - 1] : null;
  const above = levels[lvIndex + 1] || null;
  const levelH = plan.ceiling || defaultLevelHeight(lvIndex);
  const levels3d = useMemo(() => (view3d ? allLevels() : null), [view3d, plan, levels, allLevels]);

  return (
    <div className={`fp-editor${full ? ' fp-full' : ''}`}>
      <div className="fp-levels">
        <span className="fp-levels-label">층</span>
        {levels.map(l => (
          <button key={l.id} type="button" className={`filter-pill${l.id === lvId ? ' on' : ''}`} onClick={() => switchLevel(l.id)}>{l.name}</button>
        ))}
        <button type="button" className="btn btn-ghost btn-sm" onClick={addLevel}>+ 층 더하기</button>
        {levels.length > 1 && (
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={renameLevel}>층 이름</button>
            <button type="button" className="btn btn-ghost btn-sm fp-danger-text" onClick={deleteLevel}>이 층 지우기</button>
          </>
        )}
        <button type="button" className={`btn btn-sm fp-3d-btn ${view3d ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView3d(v => !v)}>{view3d ? '2D로 돌아가기' : '3D로 보기'}</button>
      </div>
      <div className="fp-toolbar">
        <div className="fp-tool-group">
          {TOOLS.map(t => (
            <button key={t.id} type="button" className={`filter-pill${tool === t.id ? ' on' : ''}`} onClick={() => setTool(t.id)}
              disabled={t.id === 'calibrate' && !plan.bg}>{t.label}</button>
          ))}
        </div>
        <div className="fp-tool-group">
          <button type="button" className="fp-icon-btn" onClick={undo} disabled={!hist.current.past.length} title="되돌리기 (Ctrl+Z)">↶</button>
          <button type="button" className="fp-icon-btn" onClick={redo} disabled={!hist.current.future.length} title="다시 하기 (Ctrl+Y)">↷</button>
          <button type="button" className="fp-icon-btn" onClick={() => zoomAt(1.25, size.w / 2, size.h / 2)} title="크게">＋</button>
          <button type="button" className="fp-icon-btn" onClick={() => zoomAt(0.8, size.w / 2, size.h / 2)} title="작게">－</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => fitView()}>화면 맞추기</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFull(f => !f)}>{full ? '작게 보기' : '크게 보기'}</button>
          <span className={`fp-save fp-save-${saveState}`} data-hist={histTick}>
            {saveState === 'saved' ? '저장됨' : saveState === 'error' ? '저장 실패' : '저장 중…'}
          </span>
        </div>
      </div>
      <div className="fp-toolbar fp-toolbar-sub">
        <div className="fp-tool-group">
          {[['snap', '붙이기·격자 맞춤'], ['clear', '작업 공간 보기'], ['gaps', '거리 보기'], ['car', '리프트에 차 올려 보기'], ['floor', '바닥 마감 보기'], ['roof', '지붕 보기'], ['mep', '전기·배관 보기'], ['lightRange', '조명 범위 보기'], ...(below ? [['below', `아래층(${below.name}) 비춰 보기`]] : []), ['grid', '격자']].map(([k, label]) => (
            <label key={k} className="fp-check">
              <input type="checkbox" checked={opts[k]} onChange={(e) => setOpts(o => ({ ...o, [k]: e.target.checked }))} /> {label}
            </label>
          ))}
        </div>
        <div className="fp-tool-group">
          <button type="button" className="btn btn-secondary btn-sm" onClick={makeAutoDims} title="벽 길이·건물 전체 크기·기둥 간격 치수선을 한 번에 그려요">치수 자동</button>
          {plan.dims.some(d => d.auto) && <button type="button" className="btn btn-ghost btn-sm" onClick={() => apply(p => ({ ...p, dims: p.dims.filter(d => !d.auto) }))}>자동 치수 지우기</button>}
          <button type="button" className="btn btn-secondary btn-sm" onClick={downloadPng}>그림 저장</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={printPlan}>인쇄</button>
        </div>
      </div>
      <p className={`fp-hint${tool !== 'select' ? ' fp-hint-tool' : ''}`}>{toolInfo?.hint}</p>
      {tool === 'line' && (
        <div className="fp-wall-types">
          <span>그릴 선:</span>
          {MEP_LINE_TYPES.map(lt => (
            <button key={lt.type} type="button" className={`filter-pill${lineType === lt.type ? ' on' : ''}`} onClick={() => setLineType(lt.type)}>
              <i className="fp-line-dot" style={{ background: lt.color }} /> {lt.label}
            </button>
          ))}
        </div>
      )}
      {tool === 'wall' && (
        <div className="fp-wall-types">
          <span>그릴 벽·보:</span>
          {WALL_TYPES.map(wt => (
            <button key={wt.type} type="button" className={`filter-pill${wallType === wt.type ? ' on' : ''}`} onClick={() => setWallType(wt.type)}>
              {wt.short} <small>{wt.type === 'concrete' ? (plan.wallT || 200) : wt.t}mm</small>
            </button>
          ))}
        </div>
      )}

      <div className="fp-body">
        <LibraryPanel
          onPick={(tpl) => placeAt(tpl)}
          onCustom={() => setCustomOpen({})}
          myLibrary={myLibrary}
          onRemoveTemplate={onRemoveTemplate}
          equipments={equipments}
          items={plan.items}
        />

        <div className="fp-canvas-wrap" ref={wrapRef}
          onDragOver={(e) => { if (e.dataTransfer.types.includes('text/fp-item')) e.preventDefault(); }}
          onDrop={(e) => {
            const raw = e.dataTransfer.getData('text/fp-item');
            if (!raw) return;
            e.preventDefault();
            placeAt(JSON.parse(raw), toW(e));
          }}
        >
          <svg ref={svgRef} className={`fp-canvas fp-tool-${tool}`} width={size.w} height={size.h}
            viewBox={`${view.x} ${view.y} ${vw} ${vh}`}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
            onPointerLeave={() => setCursor(null)}
            onContextMenu={(e) => e.preventDefault()}
          >
            <defs>
              <pattern id={`fp-grid-${layout.id}`} width={gridStep} height={gridStep} patternUnits="userSpaceOnUse">
                <path d={`M${gridStep},0 L0,0 0,${gridStep}`} fill="none" stroke="var(--fp-grid)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              </pattern>
            </defs>
            <rect className="fp-ui" x={view.x} y={view.y} width={vw} height={vh} fill="var(--fp-bg)" />
            {opts.grid && <rect x={view.x - 50000} y={view.y - 50000} width={vw + 100000} height={vh + 100000} fill={`url(#fp-grid-${layout.id})`} pointerEvents="none" />}
            {plan.bg && bgUrl && !plan.bg.hidden && (
              <image href={bgUrl} x={plan.bg.x} y={plan.bg.y} width={plan.bg.w * plan.bg.mmPerPx} height={plan.bg.h * plan.bg.mmPerPx}
                opacity={plan.bg.opacity ?? 0.7} preserveAspectRatio="none" pointerEvents="none" />
            )}

            {opts.below && below && <LevelGhost level={below} z={z} />}

            {zones.map(it => (
              <PlanItem key={it.id} item={it} z={z} showFloor={opts.floor} selected={sel.ids.includes(it.id)} />
            ))}

            {plan.walls.map(wl => (
              <WallShape key={wl.id} wall={wl} z={z} selected={sel.ids.includes(wl.id)} />
            ))}

            {others.map(it => (
              <PlanItem key={it.id} item={it} z={z} warn={warnMap.get(it.id)} showClear={opts.clear} showCar={opts.car}
                showLightRange={opts.lightRange} levelH={levelHNow} selected={sel.ids.includes(it.id)} />
            ))}

            {/* 전기·배관 선 */}
            {opts.mep && (plan.lines || []).map(l => <MepLine key={l.id} line={l} z={z} selected={sel.ids.includes(l.id)} />)}

            {/* 지붕 (머리 위라 맨 위에) */}
            {opts.roof && roofs.map(it => (
              <PlanItem key={it.id} item={it} z={z} selected={sel.ids.includes(it.id)} />
            ))}

            {plan.dims.map(d => (
              <DimLine key={d.id} id={d.id} {...d} z={z} selected={sel.ids.includes(d.id)} />
            ))}

            {/* 고른 것 표시 */}
            <g className="fp-ui">
              {selectedItems.map(it => (
                <path key={it.id} d={polygonPath(it.kind === 'zone' || it.kind === 'text' ? clearancePolygon({ ...it, clear: {} }) : bodyPolygon(it))}
                  fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeDasharray="6 3" vectorEffect="non-scaling-stroke" pointerEvents="none" />
              ))}
              {single && !single.locked && (() => {
                const top = toWorld(single, { x: 0, y: -single.d / 2 });
                const handle = toWorld(single, { x: 0, y: -single.d / 2 - 30 / z });
                // 크기 조절 손잡이: 네 모서리 + (충분히 크게 보이면) 네 변 가운데. 끄는 쪽만 늘고 반대쪽은 그대로
                const big = Math.min(single.w, single.d) * z > 46;
                const handles = RESIZE_HANDLES.filter(h => big || h.id.length === 2);
                return (
                  <g>
                    <line x1={top.x} y1={top.y} x2={handle.x} y2={handle.y} stroke="var(--color-accent)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                    <circle data-role="rotate" data-id={single.id} cx={handle.x} cy={handle.y} r={8 / z} fill="var(--fp-bg)" stroke="var(--color-accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" style={{ cursor: 'grab' }} />
                    {handles.map(h => {
                      const p = toWorld(single, { x: (h.sx * single.w) / 2, y: (h.sy * single.d) / 2 });
                      const s = (h.id.length === 2 ? 12 : 10) / z;
                      return (
                        <rect key={h.id} data-role="resize" data-id={single.id} data-h={h.id} x={p.x - s / 2} y={p.y - s / 2} width={s} height={s}
                          fill={h.id.length === 2 ? 'var(--color-accent)' : 'var(--fp-bg)'} stroke="var(--color-accent)" strokeWidth={1.5} vectorEffect="non-scaling-stroke"
                          style={{ cursor: h.cursor }} />
                      );
                    })}
                  </g>
                );
              })()}
              {selectedWall && [['1', selectedWall.x1, selectedWall.y1], ['2', selectedWall.x2, selectedWall.y2]].map(([end, x, y]) => (
                <circle key={end} data-role="wallEnd" data-id={selectedWall.id} data-end={end} cx={x} cy={y} r={8 / z} fill="var(--fp-bg)" stroke="var(--color-accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" style={{ cursor: 'crosshair' }} />
              ))}
              {selectedWall && (
                <DimLine x1={selectedWall.x1} y1={selectedWall.y1} x2={selectedWall.x2} y2={selectedWall.y2} z={z} color="var(--color-accent)" />
              )}
              {gaps.map((g, i) => (
                <DimLine key={i} {...g} z={z} color="#0ea5e9" />
              ))}
              {guides.map((g, i) => (g.x !== undefined
                ? <line key={i} x1={g.x} y1={view.y} x2={g.x} y2={view.y + vh} stroke="#ec4899" strokeWidth={1} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" pointerEvents="none" />
                : <line key={i} x1={view.x} y1={g.y} x2={view.x + vw} y2={g.y} stroke="#ec4899" strokeWidth={1} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" pointerEvents="none" />))}

              {/* 그리는 중 */}
              {draft?.rect && (
                <g pointerEvents="none">
                  <rect x={draft.rect.x0} y={draft.rect.y0} width={draft.rect.x1 - draft.rect.x0} height={draft.rect.y1 - draft.rect.y0} fill="#10b981" fillOpacity={0.1} stroke="#10b981" strokeDasharray="6 4" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                  <text x={(draft.rect.x0 + draft.rect.x1) / 2} y={(draft.rect.y0 + draft.rect.y1) / 2} textAnchor="middle" fontSize={13 / z} fontWeight={800} fill="var(--fp-text)">
                    {fmtLen(draft.rect.x1 - draft.rect.x0)} × {fmtLen(draft.rect.y1 - draft.rect.y0)} · {areaText(draft.rect.x1 - draft.rect.x0, draft.rect.y1 - draft.rect.y0)}
                  </text>
                </g>
              )}
              {draft?.pts && (
                <g pointerEvents="none">
                  <polyline points={[...draft.pts, ...(cursor ? [cursor] : [])].map(p => `${p.x},${p.y}`).join(' ')} fill={tool === 'poly' ? '#8b5cf6' : 'none'} fillOpacity={0.12}
                    stroke={tool === 'wall' ? (wallTypeOf(wallType).color || 'var(--fp-wall)') : tool === 'line' ? mepLineTypeOf(lineType).color : '#8b5cf6'} strokeWidth={tool === 'wall' ? Math.max(2, (wallType === 'concrete' ? (plan.wallT || 200) : wallTypeOf(wallType).t) * z) : 2} strokeOpacity={0.7} vectorEffect="non-scaling-stroke" />
                  {draft.pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={5 / z} fill={i === 0 && tool === 'poly' ? '#8b5cf6' : 'var(--fp-bg)'} stroke="#8b5cf6" strokeWidth={2} vectorEffect="non-scaling-stroke" />)}
                  {cursor && draft.pts.length > 0 && (
                    <DimLine x1={draft.pts[draft.pts.length - 1].x} y1={draft.pts[draft.pts.length - 1].y} x2={cursor.x} y2={cursor.y} z={z} color="#8b5cf6" />
                  )}
                </g>
              )}
              {(tool === 'measure' || tool === 'calibrate') && draft?.p1 && (draft.p2 || cursor) && (
                <g pointerEvents="none">
                  <DimLine x1={draft.p1.x} y1={draft.p1.y} x2={(draft.p2 || cursor).x} y2={(draft.p2 || cursor).y} z={z} color={tool === 'calibrate' ? '#ec4899' : 'var(--fp-dim)'}
                    label={tool === 'calibrate' ? '실제 길이?' : undefined} />
                </g>
              )}
              {(tool === 'calibrate' || tool === 'measure') && draft?.p1 && <circle cx={draft.p1.x} cy={draft.p1.y} r={5 / z} fill="#ec4899" pointerEvents="none" />}
              {cursor && tool !== 'select' && (
                <g pointerEvents="none">
                  <line x1={cursor.x - 14 / z} y1={cursor.y} x2={cursor.x + 14 / z} y2={cursor.y} stroke="#ec4899" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                  <line x1={cursor.x} y1={cursor.y - 14 / z} x2={cursor.x} y2={cursor.y + 14 / z} stroke="#ec4899" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                </g>
              )}
            </g>
          </svg>

          <div className="fp-scale-bar" aria-hidden="true">
            <span style={{ width: Math.max(20, z * (z * 1000 > 40 ? 1000 : 5000)) }} />
            {z * 1000 > 40 ? '1,000mm' : '5,000mm'}
          </div>

          {!plan.bg && !plan.items.length && !plan.walls.length && (
            <div className="fp-empty">
              <strong>도면을 올리거나, 벽을 그리거나, 비품을 바로 놓아 보세요.</strong>
              <div className="fp-empty-actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => fileRef.current?.click()}>도면 올리기 (그림·PDF)</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTool('wall')}>벽 그리기</button>
              </div>
              <span>도면 없이 시작하려면 오른쪽 '건물 크기로 벽 만들기'를 써도 돼요.</span>
            </div>
          )}

          {draft?.pts && draft.pts.length >= (tool === 'poly' ? 3 : 2) && (
            <button id="fp-finish-path" type="button" className="btn btn-primary btn-sm fp-finish" onClick={() => finishPath()}>
              {tool === 'wall' ? '벽 그리기 끝내기' : tool === 'line' ? '선 그리기 끝내기' : '모양 완성'}
            </button>
          )}

          {tool === 'calibrate' && draft?.p2 && (
            <div className="fp-float-form" onPointerDown={(e) => e.stopPropagation()}>
              <label htmlFor="fp-calib">두 점 사이 실제 길이</label>
              <div className="fp-inline">
                <input id="fp-calib" type="number" inputMode="decimal" step="1" min="0" autoFocus value={calibInput}
                  onChange={(e) => setCalibInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') applyCalibration(); }} placeholder="예: 12500" />
                <span>mm</span>
              </div>
              <div className="fp-inline">
                <button type="button" className="btn btn-primary btn-sm" onClick={applyCalibration} disabled={!calibInput}>맞추기</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft(null)}>다시 찍기</button>
              </div>
            </div>
          )}

          {plan.bg && !plan.bg.calibrated && tool !== 'calibrate' && (
            <button type="button" className="fp-banner" onClick={() => setTool('calibrate')}>
              ⚠ 도면 축척을 아직 안 맞췄어요. 눌러서 맞추면 비품이 실제 크기로 보여요.
            </button>
          )}
          {bgBusy && <div className="fp-busy">{bgBusy}</div>}
          {view3d && levels3d && (
            <Suspense fallback={<div className="fp-3d fp-3d-loading">3D 화면을 준비하는 중…</div>}>
              <Plan3D levels={levels3d} currentId={lvId} vehicleH={plan.vehicleH} title={`${branch?.name || ''} ${layout.name || ''}`.trim()} onClose={() => setView3d(false)} />
            </Suspense>
          )}
        </div>

        <div className="fp-side">
          {sel.kind ? (
            <InspectorPanel
              sel={sel}
              items={selectedItems}
              wall={selectedWall}
              dim={selectedDim}
              line={selectedLine}
              onLine={(patch) => apply(p => ({ ...p, lines: (p.lines || []).map(l => (l.id === selectedLine.id ? { ...l, ...patch } : l)) }))}
              allItems={plan.items}
              equipments={equipments}
              ceiling={plan.ceiling}
              levelH={levelH}
              levelName={levels[lvIndex]?.name}
              aboveName={above?.name}
              onCopyUp={copyUp}
              demoMode={demoMode}
              vehicleH={plan.vehicleH}
              onItems={(ids, patch) => updateItems(ids, patch)}
              onWall={(patch) => apply(p => ({ ...p, walls: p.walls.map(w => (w.id === selectedWall.id ? { ...w, ...patch } : w)) }))}
              onAllWalls={(patch) => apply(p => ({ ...p, walls: p.walls.map(w => (isBeam(w) || ['glass', 'curtain'].includes(w.type) ? w : { ...w, ...patch })) }))}
              onDelete={deleteSelection}
              onDuplicate={duplicateSelection}
              onRotate={rotateSelection}
              onSaveTemplate={onSaveTemplate}
              onClose={() => setSel({ kind: null, ids: [] })}
              onAlign={(mode) => apply(p => ({ ...p, items: alignItems(p.items, sel.ids, mode) }))}
            />
          ) : (
            <PlanSettingsPanel
              isUpper={lvIndex > 0}
              plan={plan}
              levelName={levels.length > 1 ? levels[lvIndex]?.name : ''}
              levelH={levelH}
              onPlan={(patch) => apply(p => ({ ...p, ...patch }))}
              onPickBg={() => fileRef.current?.click()}
              onCalibrate={() => setTool('calibrate')}
              onRoom={(wm, dm, t) => {
                const W = wm; const D = dm; // mm
                const v = viewRef.current;
                const ox = snapV(v.x + size.w / v.z / 2 - W / 2, 1000); const oy = snapV(v.y + size.h / v.z / 2 - D / 2, 1000);
                const c = [[ox, oy], [ox + W, oy], [ox + W, oy + D], [ox, oy + D]];
                const walls = c.map((p, i) => ({ id: generateId(), x1: p[0], y1: p[1], x2: c[(i + 1) % 4][0], y2: c[(i + 1) % 4][1], t }));
                const next = { ...planRef.current, walls: [...planRef.current.walls, ...walls], wallT: t };
                commit(next);
                fitView(next);
              }}
            />
          )}
          <ChecksPanel
            warnings={warnings}
            items={plan.items}
            walls={plan.walls}
            lines={plan.lines || []}
            equipments={equipments}
            onFocus={(w) => {
              setSel({ kind: 'item', ids: w.ids.slice(0, 2) });
              const it = plan.items.find(i => i.id === w.ids[0]);
              if (it) setView({ ...viewRef.current, x: it.x - size.w / viewRef.current.z / 2, y: it.y - size.h / viewRef.current.z / 2 });
            }}
            onPlaceEquipment={(tpl) => placeAt(tpl)}
          />
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*,application/pdf,.pdf" hidden
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; onPickBg(f); }} />

      {customOpen && (
        <CustomItemModal
          demoMode={demoMode}
          onClose={() => setCustomOpen(null)}
          onDrawOnCanvas={() => { setCustomOpen(null); setTool('poly'); }}
          onCreate={(tpl, saveToLibrary) => {
            setCustomOpen(null);
            placeAt(tpl);
            if (saveToLibrary) onSaveTemplate?.(tpl);
          }}
        />
      )}
    </div>
  );
}

function wallPolygonFor(wl) {
  const dx = wl.x2 - wl.x1; const dy = wl.y2 - wl.y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (wl.t / 2); const ny = (dx / len) * (wl.t / 2);
  // 모서리가 비지 않게 양 끝을 두께 절반만큼 늘림
  const ex = (dx / len) * (wl.t / 2); const ey = (dy / len) * (wl.t / 2);
  return [
    { x: wl.x1 - ex + nx, y: wl.y1 - ey + ny }, { x: wl.x2 + ex + nx, y: wl.y2 + ey + ny },
    { x: wl.x2 + ex - nx, y: wl.y2 + ey - ny }, { x: wl.x1 - ex - nx, y: wl.y1 - ey - ny },
  ];
}

/** 여러 개 고른 비품 줄 맞추기·같은 간격 */
function alignItems(items, ids, mode) {
  const sel = items.filter(it => ids.includes(it.id) && !it.locked);
  if (sel.length < 2) return items;
  const boxes = new Map(sel.map(it => [it.id, itemBox(it)]));
  const all = aabb(sel.flatMap(it => bodyPolygon(it)));
  const patch = new Map();
  if (mode === 'left') sel.forEach(it => patch.set(it.id, { x: it.x + (all.x0 - boxes.get(it.id).x0) }));
  if (mode === 'right') sel.forEach(it => patch.set(it.id, { x: it.x + (all.x1 - boxes.get(it.id).x1) }));
  if (mode === 'top') sel.forEach(it => patch.set(it.id, { y: it.y + (all.y0 - boxes.get(it.id).y0) }));
  if (mode === 'bottom') sel.forEach(it => patch.set(it.id, { y: it.y + (all.y1 - boxes.get(it.id).y1) }));
  if (mode === 'hcenter') sel.forEach(it => patch.set(it.id, { y: (all.y0 + all.y1) / 2 }));
  if (mode === 'vcenter') sel.forEach(it => patch.set(it.id, { x: (all.x0 + all.x1) / 2 }));
  if (mode === 'hspace' || mode === 'vspace') {
    const horiz = mode === 'hspace';
    const sorted = [...sel].sort((a, b) => (horiz ? boxes.get(a.id).x0 - boxes.get(b.id).x0 : boxes.get(a.id).y0 - boxes.get(b.id).y0));
    const total = sorted.reduce((s, it) => s + (horiz ? boxes.get(it.id).x1 - boxes.get(it.id).x0 : boxes.get(it.id).y1 - boxes.get(it.id).y0), 0);
    const span = horiz ? all.x1 - all.x0 : all.y1 - all.y0;
    const gap = (span - total) / (sorted.length - 1);
    let cur = horiz ? all.x0 : all.y0;
    sorted.forEach(it => {
      const b = boxes.get(it.id);
      if (horiz) { patch.set(it.id, { x: it.x + (cur - b.x0) }); cur += b.x1 - b.x0 + gap; } else { patch.set(it.id, { y: it.y + (cur - b.y0) }); cur += b.y1 - b.y0 + gap; }
    });
  }
  return items.map(it => (patch.has(it.id) ? { ...it, ...patch.get(it.id) } : it));
}

// 배치안 비교 화면(LayoutCompare)에서 같은 모양으로 그리려고 내보냄
export { PlanItem, WallShape, MepLine, DimLine };
