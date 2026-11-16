/**
 * 비품을 위에서 본 모양으로 그리기
 * - 비품 가운데가 (0,0), 가로 w, 세로 d (단위 mm)
 * - 위쪽(-y)이 '뒤'(벽에 붙는 쪽), 아래쪽(+y)이 '앞'(사람이 쓰는 쪽)
 * - 선 굵기는 화면을 키우고 줄여도 같게 (non-scaling-stroke)
 */

import { useId } from 'react';
import { steelProfile } from './planLibrary';

const NS = { vectorEffect: 'non-scaling-stroke' };

/** 색을 밝게(+)·어둡게(-) */
export function shade(hex = '#888888', amt = 0) {
  const n = String(hex).replace('#', '');
  const v = n.length === 3 ? n.split('').map(ch => ch + ch).join('') : n.padEnd(6, '0');
  const ch = [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16) || 0);
  const out = ch.map(x => Math.round(amt >= 0 ? x + (255 - x) * amt : x * (1 + amt)));
  return `#${out.map(x => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('')}`;
}

export function isDarkColor(hex = '#888888') {
  const n = String(hex).replace('#', '');
  const v = n.length === 3 ? n.split('').map(ch => ch + ch).join('') : n.padEnd(6, '0');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16) || 0);
  return r * 0.299 + g * 0.587 + b * 0.114 < 120;
}

/**
 * 바닥 마감 무늬 (구역 안쪽을 채움)
 * - 타일·카펫은 구역 왼쪽 위 모서리부터 줄눈이 시작
 * - 너무 작게 보일 때는 줄눈을 빼고 색만 칠함
 */
export function FloorFill({ item, z = 0.05, opacity = 0.85 }) {
  const rid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const f = item.floor;
  if (!f?.type) return null;
  const hw = item.w / 2; const hd = item.d / 2;
  const c = f.color || '#d9d4c7';
  const g = shade(c, isDarkColor(c) ? 0.35 : -0.3);
  const sw = Math.max(3, 0.9 / z);
  const pid = `fpf${rid}`;
  let pat = null;
  if (f.type === 'tile' || f.type === 'carpet') {
    const tw = Number(f.tw) || 600; const td = Number(f.td) || 600;
    if (Math.min(tw, td) * z >= 4) {
      if (f.type === 'tile') {
        pat = (
          <pattern id={pid} x={-hw} y={-hd} width={tw} height={td} patternUnits="userSpaceOnUse">
            <rect width={tw} height={td} fill={c} />
            <path d={`M0,0 H${tw} M0,0 V${td}`} stroke={g} strokeWidth={sw} fill="none" />
          </pattern>
        );
      } else {
        // 카펫 타일: 결 방향을 한 칸씩 엇갈리게
        const st = (x0, y0, horiz) => [0.25, 0.5, 0.75].map(k => (horiz ? `M${x0},${y0 + td * k} h${tw}` : `M${x0 + tw * k},${y0} v${td}`)).join(' ');
        pat = (
          <pattern id={pid} x={-hw} y={-hd} width={tw * 2} height={td * 2} patternUnits="userSpaceOnUse">
            <rect width={tw * 2} height={td * 2} fill={c} />
            <path d={`${st(0, 0, true)} ${st(tw, td, true)} ${st(tw, 0, false)} ${st(0, td, false)}`} stroke={g} strokeWidth={sw * 0.6} strokeOpacity={0.5} fill="none" />
            <path d={`M0,0 H${tw * 2} M0,${td} H${tw * 2} M0,0 V${td * 2} M${tw},0 V${td * 2}`} stroke={g} strokeWidth={sw} fill="none" />
          </pattern>
        );
      }
    }
  } else if (f.type === 'wood') {
    const pw = 1200; const ph = 180;
    if (ph * z >= 3) {
      pat = (
        <pattern id={pid} x={-hw} y={-hd} width={pw} height={ph * 2} patternUnits="userSpaceOnUse">
          <rect width={pw} height={ph * 2} fill={c} />
          <path d={`M0,0 H${pw} M0,${ph} H${pw} M0,0 V${ph} M${pw / 2},${ph} V${ph * 2}`} stroke={g} strokeWidth={sw * 0.8} fill="none" />
          <path d={`M${pw * 0.1},${ph * 0.5} h${pw * 0.3} M${pw * 0.6},${ph * 1.45} h${pw * 0.25}`} stroke={g} strokeWidth={sw * 0.5} strokeOpacity={0.45} fill="none" />
        </pattern>
      );
    }
  } else if (f.type === 'concrete') {
    if (600 * z >= 6) {
      const r = Math.max(8, 0.9 / z);
      pat = (
        <pattern id={pid} x={-hw} y={-hd} width={600} height={600} patternUnits="userSpaceOnUse">
          <rect width={600} height={600} fill={c} />
          {[[90, 120], [380, 60], [250, 300], [520, 420], [130, 480], [440, 230]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={r} fill={g} fillOpacity={0.5} />)}
        </pattern>
      );
    }
  }
  return (
    <g pointerEvents="none">
      {pat && <defs>{pat}</defs>}
      <rect x={-hw} y={-hd} width={item.w} height={item.d} fill={pat ? `url(#${pid})` : c} fillOpacity={opacity} />
      {f.type === 'epoxy' && <rect x={-hw} y={-hd} width={item.w} height={item.d} fill={shade(c, 0.3)} fillOpacity={0.15} />}
    </g>
  );
}

function Outline({ w, d, r = 0, color, fillOpacity = 0.28 }) {
  return (
    <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={r} ry={r}
      fill={color} fillOpacity={fillOpacity} stroke={color} strokeWidth={1.6} {...NS} />
  );
}

const line = (color, extra = {}) => ({ stroke: color, strokeWidth: 1.2, fill: 'none', ...NS, ...extra });

export function polygonPath(points = []) {
  if (!points.length) return '';
  return `M${points.map(p => `${p.x},${p.y}`).join(' L')} Z`;
}

/** ㄱ자 모양 점 (가로 w, 세로 d, 팔 두께 t) */
export function lShapePoints(w, d, t) {
  const tt = Math.min(t || Math.min(w, d) / 2, w, d);
  const x0 = -w / 2; const y0 = -d / 2;
  return [
    { x: x0, y: y0 }, { x: x0 + w, y: y0 }, { x: x0 + w, y: y0 + tt },
    { x: x0 + tt, y: y0 + tt }, { x: x0 + tt, y: y0 + d }, { x: x0, y: y0 + d },
  ];
}

/** 가운데가 (0,0)인 네모 점 */
export const rectPoints = (w, d) => [{ x: -w / 2, y: -d / 2 }, { x: w / 2, y: -d / 2 }, { x: w / 2, y: d / 2 }, { x: -w / 2, y: d / 2 }];

/** H빔 단면: 폭 w(플랜지), 높이 d, 웨브 두께 tw, 플랜지 두께 tf. 플랜지가 위·아래(±y), 웨브가 가운데 세로 */
export function hProfilePoints(w, d, tw, tf) {
  const hw = w / 2; const hd = d / 2;
  const a = Math.min(tw, w * 0.5) / 2; const f = Math.min(tf, d * 0.3);
  return [
    { x: -hw, y: -hd }, { x: hw, y: -hd }, { x: hw, y: -hd + f }, { x: a, y: -hd + f },
    { x: a, y: hd - f }, { x: hw, y: hd - f }, { x: hw, y: hd }, { x: -hw, y: hd },
    { x: -hw, y: hd - f }, { x: -a, y: hd - f }, { x: -a, y: -hd + f }, { x: -hw, y: -hd + f },
  ];
}

/** 계단 폭 (ㄱ자·ㄷ자) */
export function stairArm(item) {
  const { w, d } = item;
  const def = item.shape === 'stairsU' ? (w - 100) / 2 : Math.min(w, d) * 0.3;
  return Math.max(300, Math.min(item.arm || def, item.shape === 'stairsU' ? w / 2 : Math.min(w, d) * 0.9));
}

/** ㄱ자 계단 테두리: 오른쪽으로 올라가 위쪽에서 왼쪽으로 꺾임 */
export function lStairPoints(w, d, sw) {
  const hw = w / 2; const hd = d / 2;
  return [
    { x: -hw, y: -hd }, { x: hw, y: -hd }, { x: hw, y: hd }, { x: hw - sw, y: hd },
    { x: hw - sw, y: -hd + sw }, { x: -hw, y: -hd + sw },
  ];
}

/** 계단 디딤판 선 (x0~x1 폭, y0→y1 방향으로 n칸) */
const treads = (x0, x1, y0, y1, n, vertical = false) => Array.from({ length: Math.max(0, n - 1) }, (_, i) => {
  const t = y0 + ((y1 - y0) * (i + 1)) / n;
  return vertical ? `M${t},${x0} V${x1}` : `M${x0},${t} H${x1}`;
}).join(' ');

/** 올라가는 방향 화살표 (점 여러 개를 잇고 끝에 화살촉) */
function UpArrow({ pts, c, size }) {
  if (pts.length < 2) return null;
  const a = pts[pts.length - 2]; const b = pts[pts.length - 1];
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const h1 = { x: b.x - size * Math.cos(ang - 0.5), y: b.y - size * Math.sin(ang - 0.5) };
  const h2 = { x: b.x - size * Math.cos(ang + 0.5), y: b.y - size * Math.sin(ang + 0.5) };
  return (
    <g>
      <circle cx={pts[0].x} cy={pts[0].y} r={size * 0.25} fill={c} />
      <path d={`M${pts.map(p => `${p.x},${p.y}`).join(' L')} M${h1.x},${h1.y} L${b.x},${b.y} L${h2.x},${h2.y}`} stroke={c} strokeWidth={1.6} fill="none" vectorEffect="non-scaling-stroke" />
    </g>
  );
}

export function ItemShape({ item, z = 0.05 }) {
  const { w, d } = item;
  const c = item.color || '#94a3b8';
  const hw = w / 2; const hd = d / 2;
  const m = Math.min(w, d);

  switch (item.shape) {
    case 'lift2': {
      const col = Math.min(450, w * 0.15);
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} fill={c} fillOpacity={0.08} stroke={c} strokeDasharray="6 4" strokeWidth={1} {...NS} />
          <rect x={-hw} y={-col / 2 - d * 0.1} width={col} height={col * 1.4} fill={c} fillOpacity={0.7} stroke={c} {...NS} />
          <rect x={hw - col} y={-col / 2 - d * 0.1} width={col} height={col * 1.4} fill={c} fillOpacity={0.7} stroke={c} {...NS} />
          {/* 들어올림 팔 */}
          <path d={`M${-hw + col},${0} L${-hw * 0.25},${-hd * 0.85} M${-hw + col},${0} L${-hw * 0.25},${hd * 0.85} M${hw - col},0 L${hw * 0.25},${-hd * 0.85} M${hw - col},0 L${hw * 0.25},${hd * 0.85}`} {...line(c, { strokeWidth: 2 })} />
        </g>
      );
    }
    case 'lift4': {
      const post = Math.min(350, w * 0.1);
      const rw = Math.min(600, w * 0.2);
      return (
        <g>
          <Outline w={w} d={d} color={c} fillOpacity={0.06} />
          <rect x={-hw + post * 0.6} y={-hd + post} width={rw} height={d - post * 2} fill={c} fillOpacity={0.35} stroke={c} {...NS} />
          <rect x={hw - post * 0.6 - rw} y={-hd + post} width={rw} height={d - post * 2} fill={c} fillOpacity={0.35} stroke={c} {...NS} />
          {[[-hw, -hd], [hw - post, -hd], [-hw, hd - post], [hw - post, hd - post]].map(([x, y], i) => (
            <rect key={i} x={x} y={y} width={post} height={post} fill={c} fillOpacity={0.85} stroke={c} {...NS} />
          ))}
          <path d={`M0,${hd - post * 0.4} l${-post},${-post} M0,${hd - post * 0.4} l${post},${-post}`} {...line(c)} />
        </g>
      );
    }
    case 'scissor': {
      const rw = w * 0.3;
      return (
        <g>
          <rect x={-hw} y={-hd} width={rw} height={d} fill={c} fillOpacity={0.35} stroke={c} strokeWidth={1.6} {...NS} />
          <rect x={hw - rw} y={-hd} width={rw} height={d} fill={c} fillOpacity={0.35} stroke={c} strokeWidth={1.6} {...NS} />
          <path d={`M${-hw},${-hd} L${-hw + rw},${hd} M${-hw + rw},${-hd} L${-hw},${hd} M${hw - rw},${-hd} L${hw},${hd} M${hw},${-hd} L${hw - rw},${hd}`} {...line(c)} />
        </g>
      );
    }
    case 'tirechanger':
      return (
        <g>
          <Outline w={w} d={d} r={m * 0.12} color={c} />
          <circle cx={0} cy={hd * 0.15} r={m * 0.32} {...line(c, { strokeWidth: 2 })} />
          <circle cx={0} cy={hd * 0.15} r={m * 0.08} fill={c} {...NS} />
          <rect x={-m * 0.08} y={-hd} width={m * 0.16} height={d * 0.35} fill={c} fillOpacity={0.8} {...NS} />
        </g>
      );
    case 'balancer':
      return (
        <g>
          <Outline w={w} d={d} r={m * 0.1} color={c} />
          <rect x={-hw * 0.2} y={-hd} width={hw * 1.2} height={d * 0.55} fill={c} fillOpacity={0.4} stroke={c} {...NS} />
          <circle cx={-hw * 0.55} cy={hd * 0.15} r={m * 0.28} {...line(c, { strokeWidth: 2 })} />
          <path d={`M${-hw * 0.55},${hd * 0.15} L${-hw * 0.2},${hd * 0.15}`} {...line(c, { strokeWidth: 2 })} />
        </g>
      );
    case 'compressor':
      return (
        <g>
          <Outline w={w} d={d} r={m * 0.08} color={c} />
          <circle cx={-hw * 0.45} cy={0} r={m * 0.3} {...line(c)} />
          <path d={`M${-hw * 0.45 - m * 0.2},0 h${m * 0.4} M${-hw * 0.45},${-m * 0.2} v${m * 0.4}`} {...line(c)} />
          <path d={`M${hw * 0.1},${-hd * 0.6} h${hw * 0.7} M${hw * 0.1},${-hd * 0.2} h${hw * 0.7} M${hw * 0.1},${hd * 0.2} h${hw * 0.7} M${hw * 0.1},${hd * 0.6} h${hw * 0.7}`} {...line(c)} />
        </g>
      );
    case 'bench':
      return (
        <g>
          <Outline w={w} d={d} color={c} />
          <path d={`M${-hw},${-hd + d * 0.25} H${hw}`} {...line(c)} />
          <rect x={-hw * 0.8} y={-hd + d * 0.04} width={w * 0.12} height={d * 0.16} fill={c} fillOpacity={0.6} {...NS} />
        </g>
      );
    case 'cart':
      return (
        <g>
          <Outline w={w} d={d} r={m * 0.12} color={c} />
          <rect x={-hw * 0.75} y={-hd * 0.6} width={w * 0.75} height={d * 0.6} {...line(c)} />
          <path d={`M${-hw * 0.75},0 h${w * 0.75}`} {...line(c)} />
        </g>
      );
    case 'car': {
      const r = w * 0.28;
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} rx={r} ry={r} fill={c} fillOpacity={0.3} stroke={c} strokeWidth={1.6} {...NS} />
          {/* 앞유리·뒷유리 */}
          <path d={`M${-hw * 0.78},${hd * 0.32} Q0,${hd * 0.18} ${hw * 0.78},${hd * 0.32} L${hw * 0.7},${hd * 0.58} Q0,${hd * 0.5} ${-hw * 0.7},${hd * 0.58} Z`} fill={c} fillOpacity={0.5} {...line(c)} />
          <path d={`M${-hw * 0.72},${-hd * 0.5} Q0,${-hd * 0.42} ${hw * 0.72},${-hd * 0.5} L${hw * 0.66},${-hd * 0.68} Q0,${-hd * 0.62} ${-hw * 0.66},${-hd * 0.68} Z`} fill={c} fillOpacity={0.5} {...line(c)} />
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy], i) => (
            <rect key={i} x={sx * hw - (sx > 0 ? w * 0.06 : 0) - (sx < 0 ? w * 0.02 : 0)} y={sy * hd * 0.66 - d * 0.06} width={w * 0.08} height={d * 0.12} rx={w * 0.02} fill={c} fillOpacity={0.9} {...NS} />
          ))}
          <path d={`M0,${hd * 0.92} l${-w * 0.08},${-d * 0.04} M0,${hd * 0.92} l${w * 0.08},${-d * 0.04}`} {...line(c)} />
        </g>
      );
    }
    case 'toilet': {
      const tank = d * 0.25;
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={tank} rx={m * 0.05} fill={c} fillOpacity={0.6} stroke="#64748b" strokeWidth={1.4} {...NS} />
          <ellipse cx={0} cy={-hd + tank + (d - tank) / 2} rx={hw * 0.9} ry={(d - tank) / 2} fill={c} fillOpacity={0.6} stroke="#64748b" strokeWidth={1.4} {...NS} />
          <ellipse cx={0} cy={-hd + tank + (d - tank) / 2 + d * 0.03} rx={hw * 0.55} ry={(d - tank) / 2 * 0.6} {...line('#64748b')} />
        </g>
      );
    }
    case 'stall':
    case 'stallA': {
      const t = 40;
      const tw = Math.min(400, w * 0.35); const td = Math.min(700, d * 0.4);
      const door = Math.min(item.shape === 'stallA' ? 1000 : 700, w - 100);
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} fill={c} fillOpacity={0.12} {...NS} />
          <path d={`M${-hw},${hd} V${-hd} H${hw} V${hd}`} {...line('#64748b', { strokeWidth: 2.4 })} />
          <path d={`M${-hw},${hd} H${-hw + (w - door) / 2} M${hw - (w - door) / 2},${hd} H${hw}`} {...line('#64748b', { strokeWidth: 2.4 })} />
          {/* 변기 */}
          <rect x={-tw / 2} y={-hd + t} width={tw} height={td * 0.25} fill="#e2e8f0" stroke="#64748b" {...NS} />
          <ellipse cx={0} cy={-hd + t + td * 0.25 + td * 0.375} rx={tw * 0.45} ry={td * 0.375} fill="#e2e8f0" stroke="#64748b" {...NS} />
          {/* 문 열리는 모양 (바깥쪽) */}
          <path d={`M${-door / 2},${hd} L${-door / 2},${hd + door} A${door},${door} 0 0 0 ${door / 2},${hd}`} {...line('#f59e0b', { strokeDasharray: '4 3' })} />
          {item.shape === 'stallA' && <path d={`M${hw - 80},${-hd + d * 0.3} V${hd - d * 0.25}`} {...line('#64748b', { strokeWidth: 2 })} />}
        </g>
      );
    }
    case 'urinal':
      return (
        <g>
          <path d={`M${-hw},${-hd} H${hw} V${-hd + d * 0.3} Q${hw},${hd} 0,${hd} Q${-hw},${hd} ${-hw},${-hd + d * 0.3} Z`} fill={c} fillOpacity={0.6} stroke="#64748b" strokeWidth={1.4} {...NS} />
          <ellipse cx={0} cy={hd * 0.1} rx={hw * 0.55} ry={hd * 0.5} {...line('#64748b')} />
        </g>
      );
    case 'sink':
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} rx={m * 0.1} fill={c} fillOpacity={0.6} stroke="#64748b" strokeWidth={1.4} {...NS} />
          <ellipse cx={0} cy={hd * 0.12} rx={hw * 0.7} ry={hd * 0.62} {...line('#64748b')} />
          <circle cx={0} cy={-hd * 0.72} r={m * 0.05} fill="#64748b" />
        </g>
      );
    case 'sink2':
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} fill={c} fillOpacity={0.6} stroke="#64748b" strokeWidth={1.4} {...NS} />
          {[-w / 4, w / 4].map((cx, i) => (
            <g key={i}>
              <ellipse cx={cx} cy={hd * 0.12} rx={Math.min(w / 4 * 0.75, hd * 0.9)} ry={hd * 0.6} {...line('#64748b')} />
              <circle cx={cx} cy={-hd * 0.72} r={d * 0.04} fill="#64748b" />
            </g>
          ))}
        </g>
      );
    case 'shower':
      return (
        <g>
          <Outline w={w} d={d} color={c} fillOpacity={0.5} />
          <path d={`M${-hw},${-hd} L${hw},${hd} M${hw},${-hd} L${-hw},${hd}`} {...line('#64748b', { strokeDasharray: '4 3' })} />
          <circle cx={0} cy={0} r={m * 0.06} fill="#64748b" />
        </g>
      );
    case 'desk':
      return (
        <g>
          <Outline w={w} d={d} color={c} fillOpacity={0.45} />
          <rect x={-w * 0.12} y={-hd + d * 0.08} width={w * 0.24} height={d * 0.06} fill="#475569" {...NS} />
        </g>
      );
    case 'chair':
      return (
        <g>
          <rect x={-hw * 0.82} y={-hd * 0.6} width={w * 0.82} height={d * 0.8} rx={m * 0.15} fill={c} fillOpacity={0.45} stroke={c} strokeWidth={1.4} {...NS} />
          <rect x={-hw} y={hd * 0.55} width={w} height={d * 0.2} rx={m * 0.08} fill={c} fillOpacity={0.75} stroke={c} {...NS} />
        </g>
      );
    case 'roundtable': {
      const r = m / 2;
      return (
        <g>
          <circle cx={0} cy={0} r={r} fill={c} fillOpacity={0.45} stroke={c} strokeWidth={1.6} {...NS} />
          {[0, 90, 180, 270].map(a => (
            <rect key={a} x={-220} y={r + 60} width={440} height={380} rx={80} transform={`rotate(${a})`} fill="#475569" fillOpacity={0.4} stroke="#475569" {...NS} />
          ))}
        </g>
      );
    }
    case 'table4': {
      const n = Math.max(1, Math.round(w / 1100));
      const cw = Math.min(450, (w / n) * 0.7);
      return (
        <g>
          <Outline w={w} d={d} color={c} fillOpacity={0.45} />
          {Array.from({ length: n }, (_, i) => -hw + (w / n) * (i + 0.5)).map((cx, i) => (
            <g key={i}>
              <rect x={cx - cw / 2} y={-hd - 420} width={cw} height={380} rx={80} fill="#475569" fillOpacity={0.4} stroke="#475569" {...NS} />
              <rect x={cx - cw / 2} y={hd + 40} width={cw} height={380} rx={80} fill="#475569" fillOpacity={0.4} stroke="#475569" {...NS} />
            </g>
          ))}
        </g>
      );
    }
    case 'sofa': {
      const back = d * 0.25; const arm = Math.min(200, w * 0.12);
      const seats = Math.max(1, Math.round((w - arm * 2) / 650));
      const sw = (w - arm * 2) / seats;
      return (
        <g>
          <Outline w={w} d={d} r={m * 0.1} color={c} fillOpacity={0.35} />
          <path d={`M${-hw + arm},${-hd + back} H${hw - arm} M${-hw + arm},${-hd + back} V${hd} M${hw - arm},${-hd + back} V${hd}`} {...line(c)} />
          {Array.from({ length: seats - 1 }, (_, i) => -hw + arm + sw * (i + 1)).map((x, i) => (
            <path key={i} d={`M${x},${-hd + back} V${hd}`} {...line(c)} />
          ))}
        </g>
      );
    }
    case 'receptionW': {
      // 위에서 본 카운터: 앞쪽(아래) 파란 윗판 · 왼쪽 이어지는 띠 · 오른쪽 기둥 · 뒤쪽 책상과 서랍
      const capD = d * (250 / 800); const ret = w * (150 / 2400); const pR = w * (100 / 2400);
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} fill="#e5e7eb" fillOpacity={0.6} stroke={c} strokeWidth={1.4} {...NS} />
          <rect x={-hw} y={hd - capD} width={w} height={capD} fill={c} fillOpacity={0.85} {...NS} />
          <rect x={-hw} y={-hd} width={ret} height={d - capD} fill={c} fillOpacity={0.85} {...NS} />
          <rect x={hw - pR} y={-hd} width={pR} height={d - capD} fill="#f8fafc" stroke={c} strokeWidth={1} {...NS} />
          {[1, 2, 3, 4].map(k => <path key={k} d={`M${-hw + ret + ((w - ret - pR) * k) / 5},${-hd} v${d * 0.5}`} {...line(c, { strokeDasharray: '4 3', strokeWidth: 0.8 })} />)}
        </g>
      );
    }
    case 'counter':
      return (
        <g>
          <Outline w={w} d={d} color={c} fillOpacity={0.45} />
          <path d={`M${-hw},${hd - d * 0.3} H${hw}`} {...line(c)} />
        </g>
      );
    case 'tv':
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} fill={c} fillOpacity={0.9} stroke={c} {...NS} />
          <path d={`M${-hw * 0.6},${hd} L${-hw},${hd + w * 0.5} M${hw * 0.6},${hd} L${hw},${hd + w * 0.5}`} {...line(c, { strokeDasharray: '3 4' })} />
        </g>
      );
    case 'cabinet':
      return (
        <g>
          <Outline w={w} d={d} color={c} fillOpacity={0.4} />
          <path d={`M0,${-hd} V${hd} M${-hw},${-hd} L0,${hd} M${hw},${-hd} L0,${hd}`} {...line(c, { strokeWidth: 0.9 })} />
        </g>
      );
    case 'shelf': {
      const n = Math.max(2, Math.round(w / 900));
      return (
        <g>
          <Outline w={w} d={d} color={c} fillOpacity={0.3} />
          {Array.from({ length: n - 1 }, (_, i) => -hw + (w / n) * (i + 1)).map((x, i) => (
            <path key={i} d={`M${x},${-hd} V${hd}`} {...line(c)} />
          ))}
          <path d={`M${-hw},${-hd} L${hw},${hd}`} {...line(c, { strokeWidth: 0.8, strokeDasharray: '4 4' })} />
        </g>
      );
    }
    case 'locker':
      return (
        <g>
          <Outline w={w} d={d} color={c} fillOpacity={0.4} />
          {[-w / 6, w / 6].map((x, i) => <path key={i} d={`M${x},${-hd} V${hd}`} {...line(c)} />)}
        </g>
      );
    case 'door': {
      // 여닫이문: 경첩은 왼쪽(좌우 뒤집기로 오른쪽), 열리는 쪽은 앞(아래) 또는 뒤(위)
      const sg = item.swingBack ? -1 : 1; const e = sg * hd; const sw = sg > 0 ? 0 : 1;
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} fill="var(--fp-bg)" stroke="none" />
          <path d={`M${-hw},${-hd} V${hd} M${hw},${-hd} V${hd}`} {...line(c, { strokeWidth: 2 })} />
          <path d={`M${-hw},${e} V${e + sg * w}`} {...line(item.leafColor && item.leafColor !== '#f8fafc' ? item.leafColor : c, { strokeWidth: 2.6 })} />
          <path d={`M${-hw},${e + sg * w} A${w},${w} 0 0 ${sw} ${hw},${e}`} {...line(c, { strokeDasharray: '4 3' })} />
        </g>
      );
    }
    case 'door2': {
      const h2 = w / 2;
      const sg = item.swingBack ? -1 : 1; const e = sg * hd; const sw = sg > 0 ? 0 : 1;
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} fill="var(--fp-bg)" stroke="none" />
          <path d={`M${-hw},${-hd} V${hd} M${hw},${-hd} V${hd}`} {...line(c, { strokeWidth: 2 })} />
          <path d={`M${-hw},${e} V${e + sg * h2} M${hw},${e} V${e + sg * h2}`} {...line(c, { strokeWidth: 2.2 })} />
          <path d={`M${-hw},${e + sg * h2} A${h2},${h2} 0 0 ${sw} 0,${e} A${h2},${h2} 0 0 ${sw} ${hw},${e + sg * h2}`} {...line(c, { strokeDasharray: '4 3' })} />
        </g>
      );
    }
    case 'sliding':
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} fill="var(--fp-bg)" stroke="none" />
          <path d={`M${-hw},${-hd} V${hd} M${hw},${-hd} V${hd}`} {...line(c, { strokeWidth: 2 })} />
          <rect x={-hw} y={-d * 0.15} width={w * 0.6} height={d * 0.3} fill={c} fillOpacity={0.6} stroke={c} {...NS} />
          <path d={`M${-hw * 0.1},${hd * 1.6} H${hw * 0.9} l${-w * 0.06},${-w * 0.04}`} {...line(c)} />
        </g>
      );
    case 'shutter':
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} fill="var(--fp-bg)" stroke="none" />
          <rect x={-hw} y={-hd} width={w} height={d} fill={c} fillOpacity={0.25} stroke={c} strokeWidth={1.6} strokeDasharray="10 5" {...NS} />
          <path d={`M0,${hd + 400} v${900} m-250,-250 l250,250 l250,-250 M0,${-hd - 400} v${-900} m-250,250 l250,-250 l250,250`} {...line(c, { strokeWidth: 1.6 })} />
        </g>
      );
    case 'window':
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} fill="var(--fp-bg)" stroke={c} strokeWidth={1.6} {...NS} />
          <path d={`M${-hw},0 H${hw}`} {...line(c)} />
        </g>
      );
    case 'column':
      return <rect x={-hw} y={-hd} width={w} height={d} fill={c} fillOpacity={0.9} stroke={c} strokeWidth={1.4} {...NS} />;
    case 'hbeam': {
      const p = steelProfile('hbeam', w, d, item.prof);
      return (
        <g>
          {/* 바닥판(베이스 플레이트) 자리 흐리게 + H 단면 */}
          <rect x={-hw} y={-hd} width={w} height={d} fill={c} fillOpacity={0.08} stroke="none" />
          <path d={polygonPath(hProfilePoints(w, d, p.tw, p.tf))} fill={c} fillOpacity={0.95} stroke={c} strokeWidth={1} {...NS} />
        </g>
      );
    }
    case 'sqpipe': {
      const p = steelProfile('sqpipe', w, d, item.prof);
      const t = Math.min(p.t, w / 3, d / 3);
      return (
        <path d={`${polygonPath(rectPoints(w, d))} ${polygonPath(rectPoints(w - 2 * t, d - 2 * t))}`} fillRule="evenodd"
          fill={c} fillOpacity={0.95} stroke={c} strokeWidth={1} {...NS} />
      );
    }
    case 'stairs': {
      const n = Math.max(3, Math.round(d / 280));
      return (
        <g>
          <Outline w={w} d={d} color={c} fillOpacity={0.2} />
          {Array.from({ length: n - 1 }, (_, i) => -hd + (d / n) * (i + 1)).map((y, i) => (
            <path key={i} d={`M${-hw},${y} H${hw}`} {...line(c)} />
          ))}
          <path d={`M0,${hd * 0.85} V${-hd * 0.8} l${-w * 0.1},${w * 0.1} M0,${-hd * 0.8} l${w * 0.1},${w * 0.1}`} {...line(c, { strokeWidth: 1.6 })} />
        </g>
      );
    }
    case 'circle':
      return <ellipse cx={0} cy={0} rx={hw} ry={hd} fill={c} fillOpacity={0.35} stroke={c} strokeWidth={1.6} {...NS} />;
    case 'roundbox':
      return <Outline w={w} d={d} r={m * 0.18} color={c} fillOpacity={0.35} />;
    case 'lshape':
      return <path d={polygonPath(lShapePoints(w, d, item.arm))} fill={c} fillOpacity={0.35} stroke={c} strokeWidth={1.6} {...NS} />;
    case 'poly':
      return <path d={polygonPath(scaledPoints(item))} fill={c} fillOpacity={0.35} stroke={c} strokeWidth={1.6} {...NS} />;
    case 'image':
      return (
        <g>
          {item.img && <image href={item.img} x={-hw} y={-hd} width={w} height={d} preserveAspectRatio="none" />}
          <rect x={-hw} y={-hd} width={w} height={d} fill="none" stroke={c} strokeWidth={1} strokeDasharray="4 3" {...NS} />
        </g>
      );
    case 'stairsU': {
      const sw = stairArm(item); const L = Math.min(sw, d * 0.4);
      const n = Math.max(3, Math.round((d - L) / 260));
      return (
        <g>
          <Outline w={w} d={d} color={c} fillOpacity={0.12} />
          <rect x={hw - sw} y={-hd + L} width={sw} height={d - L} fill={c} fillOpacity={0.18} stroke={c} strokeWidth={1.2} {...NS} />
          <rect x={-hw} y={-hd + L} width={sw} height={d - L} fill={c} fillOpacity={0.18} stroke={c} strokeWidth={1.2} {...NS} />
          <path d={`${treads(hw - sw, hw, -hd + L, hd, n)} ${treads(-hw, -hw + sw, -hd + L, hd, n)}`} {...line(c, { strokeWidth: 0.9 })} />
          <UpArrow c={c} size={Math.min(sw, 600) * 0.4} pts={[{ x: hw - sw / 2, y: hd - 200 }, { x: hw - sw / 2, y: -hd + L / 2 }, { x: -hw + sw / 2, y: -hd + L / 2 }, { x: -hw + sw / 2, y: hd * 0.5 }]} />
        </g>
      );
    }
    case 'stairsL': {
      const sw = stairArm(item);
      const nA = Math.max(2, Math.round((d - sw) / 260)); const nB = Math.max(2, Math.round((w - sw) / 260));
      return (
        <g>
          <path d={polygonPath(lStairPoints(w, d, sw))} fill={c} fillOpacity={0.18} stroke={c} strokeWidth={1.4} {...NS} />
          <path d={`M${hw - sw},${-hd} V${-hd + sw} M${hw - sw},${-hd + sw} H${hw}`} {...line(c, { strokeWidth: 1 })} />
          <path d={`${treads(hw - sw, hw, -hd + sw, hd, nA)} ${treads(-hd, -hd + sw, -hw, hw - sw, nB, true)}`} {...line(c, { strokeWidth: 0.9 })} />
          <UpArrow c={c} size={Math.min(sw, 600) * 0.4} pts={[{ x: hw - sw / 2, y: hd - 200 }, { x: hw - sw / 2, y: -hd + sw / 2 }, { x: -hw + 300, y: -hd + sw / 2 }]} />
        </g>
      );
    }
    case 'stairsSpiral': {
      const r = Math.min(w, d) / 2; const r0 = r * 0.15; const n = 12; const span = 330;
      const pt = (deg, rr) => ({ x: rr * Math.cos((deg * Math.PI) / 180), y: rr * Math.sin((deg * Math.PI) / 180) });
      const arcR = r * 0.62; const a0 = 90; const a1 = 90 - span * 0.85;
      const arcPts = Array.from({ length: 12 }, (_, i) => pt(a0 + ((a1 - a0) * i) / 11, arcR));
      return (
        <g>
          <ellipse cx={0} cy={0} rx={r} ry={r} fill={c} fillOpacity={0.15} stroke={c} strokeWidth={1.4} {...NS} />
          <circle cx={0} cy={0} r={r0} fill={c} fillOpacity={0.6} stroke={c} {...NS} />
          <path d={Array.from({ length: n + 1 }, (_, i) => { const a = 90 - (span * i) / n; const p0 = pt(a, r0); const p1 = pt(a, r); return `M${p0.x},${p0.y} L${p1.x},${p1.y}`; }).join(' ')} {...line(c, { strokeWidth: 0.9 })} />
          <UpArrow c={c} size={r * 0.22} pts={arcPts} />
        </g>
      );
    }
    case 'elevator': {
      const ix = w * 0.1; const iy = d * 0.1;
      return (
        <g>
          <Outline w={w} d={d} color={c} fillOpacity={0.12} />
          <rect x={-hw + ix} y={-hd + iy} width={w - ix * 2} height={d - iy * 2} fill="none" stroke={c} strokeWidth={1.2} {...NS} />
          <path d={`M${-hw + ix},${-hd + iy} L${hw - ix},${hd - iy} M${hw - ix},${-hd + iy} L${-hw + ix},${hd - iy}`} {...line(c, { strokeWidth: 0.9 })} />
          <path d={`M${-w * 0.28},${hd} H${w * 0.28}`} {...line(c, { strokeWidth: 3.2 })} />
        </g>
      );
    }
    case 'ramp': {
      const step = Math.max(1500, d / 10); const ch = Math.min(w * 0.3, 900);
      const marks = [];
      for (let y = hd - step; y > -hd + step * 0.5; y -= step) marks.push(`M${-ch},${y + ch * 0.6} L0,${y} L${ch},${y + ch * 0.6}`);
      return (
        <g>
          <Outline w={w} d={d} color={c} fillOpacity={0.18} />
          <path d={`M${-hw + w * 0.08},${-hd} V${hd} M${hw - w * 0.08},${-hd} V${hd}`} {...line(c, { strokeDasharray: '8 6' })} />
          <path d={marks.join(' ')} {...line(c, { strokeWidth: 1.6 })} />
        </g>
      );
    }
    case 'reel': {
      // 호스 릴: 둥근 감개 + 감긴 줄
      const r = Math.min(w, d) / 2;
      return (
        <g>
          <Outline w={w} d={d} color={c} fillOpacity={0.15} />
          <circle cx={0} cy={0} r={r * 0.85} fill={c} fillOpacity={0.3} stroke={c} strokeWidth={1.4} {...NS} />
          <circle cx={0} cy={0} r={r * 0.45} fill="none" stroke={c} strokeWidth={1} {...NS} />
          <path d={`M${r * 0.85},0 Q${hw},${hd} ${hw * 0.6},${hd}`} {...line(c, { strokeDasharray: '4 3' })} />
        </g>
      );
    }
    case 'roller': {
      // 브레이크 테스터: 좌우 바퀴 자리마다 롤러 두 줄
      const pw = w * 0.32;
      return (
        <g>
          <Outline w={w} d={d} color={c} fillOpacity={0.15} />
          {[-1, 1].map(sx => (
            <g key={sx}>
              <rect x={sx * (hw - pw / 2) - pw / 2} y={-hd + d * 0.1} width={pw} height={d * 0.8} fill={c} fillOpacity={0.25} stroke={c} {...NS} />
              {[-0.2, 0.2].map(k => <path key={k} d={`M${sx * (hw - pw / 2) - pw / 2},${k * d} h${pw}`} {...line(c, { strokeWidth: 2.4 })} />)}
            </g>
          ))}
        </g>
      );
    }
    case 'crane': {
      // 엔진 크레인: ㄷ자 다리 + 기둥 + 붐
      return (
        <g>
          <path d={`M${-hw},${hd} V${-hd * 0.6} H${hw} V${hd}`} {...line(c, { strokeWidth: 2.4 })} />
          <rect x={-w * 0.08} y={-hd * 0.75} width={w * 0.16} height={w * 0.16} fill={c} {...NS} />
          <path d={`M0,${-hd * 0.6} V${hd * 0.7}`} {...line(c, { strokeWidth: 3 })} />
          <circle cx={0} cy={hd * 0.75} r={w * 0.06} fill="none" stroke={c} strokeWidth={1.4} {...NS} />
        </g>
      );
    }
    case 'evcharger':
      return (
        <g>
          <Outline w={w} d={d} r={m * 0.15} color={c} fillOpacity={0.35} />
          <path d={`M${w * 0.06},${-hd * 0.6} L${-w * 0.12},${hd * 0.05} H${w * 0.08} L${-w * 0.06},${hd * 0.65}`} {...line(c, { strokeWidth: 2 })} />
        </g>
      );
    case 'kiosk':
      return (
        <g>
          <Outline w={w} d={d} r={m * 0.1} color={c} fillOpacity={0.3} />
          <rect x={-hw * 0.75} y={hd * 0.15} width={w * 0.75} height={d * 0.3} fill="#38bdf8" fillOpacity={0.6} stroke={c} {...NS} />
        </g>
      );
    case 'benchseat': {
      const n = Math.max(1, Math.round(w / 560));
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d * 0.22} fill={c} fillOpacity={0.6} stroke={c} {...NS} />
          {Array.from({ length: n }, (_, i) => (
            <rect key={i} x={-hw + (w / n) * i + 20} y={-hd + d * 0.25} width={w / n - 40} height={d * 0.7} rx={40} fill={c} fillOpacity={0.3} stroke={c} {...NS} />
          ))}
        </g>
      );
    }
    case 'sign':
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} fill={c} fillOpacity={0.7} stroke={c} {...NS} />
          <path d={`M${-hw},${hd + 120} H${hw}`} {...line(c, { strokeDasharray: '6 4' })} />
        </g>
      );
    case 'pylon':
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} fill={c} fillOpacity={0.5} stroke={c} strokeWidth={1.6} {...NS} />
          <path d={`M${-hw * 0.6},0 H${hw * 0.6}`} {...line('#ffffff', { strokeWidth: 2 })} />
        </g>
      );
    case 'fence': {
      const n = Math.max(1, Math.round(w / 1000));
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} fill={c} fillOpacity={0.35} stroke={c} {...NS} />
          {Array.from({ length: n + 1 }, (_, i) => <circle key={i} cx={-hw + (w / n) * i} cy={0} r={Math.max(d, 40)} fill={c} />)}
        </g>
      );
    }
    case 'parking':
      return (
        <g>
          <path d={`M${-hw},${-hd} V${hd} M${hw},${-hd} V${hd} M${-hw},${-hd} H${hw}`} stroke={c === '#e5e7eb' ? '#94a3b8' : c} strokeWidth={2.4} fill="none" {...NS} />
          <path d={`M${-hw * 0.3},${hd * 0.5} L0,${hd * 0.2} L${hw * 0.3},${hd * 0.5}`} {...line('#94a3b8')} />
        </g>
      );
    case 'light':
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} fill="#fef9c3" fillOpacity={0.9} stroke={c} strokeWidth={1.4} {...NS} />
          <path d={`M${-hw},${-hd} L${hw},${hd} M${hw},${-hd} L${-hw},${hd}`} {...line(c, { strokeWidth: 1 })} />
        </g>
      );
    case 'lightline':
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} rx={d / 2} fill="#fef9c3" stroke={c} strokeWidth={1.4} {...NS} />
          <path d={`M${-hw},0 H${hw}`} {...line(c, { strokeWidth: 1 })} />
        </g>
      );
    case 'lightround':
      return (
        <g>
          <ellipse cx={0} cy={0} rx={hw} ry={hd} fill="#fef9c3" stroke={c} strokeWidth={1.4} {...NS} />
          <path d={`M${-hw * 0.7},${-hd * 0.7} L${hw * 0.7},${hd * 0.7} M${hw * 0.7},${-hd * 0.7} L${-hw * 0.7},${hd * 0.7}`} {...line(c, { strokeWidth: 1 })} />
        </g>
      );
    case 'outlet':
      return (
        <g>
          <path d={`M${-hw},${hd} A${hw},${hw} 0 0 1 ${hw},${hd} Z`} fill={c} fillOpacity={0.25} stroke={c} strokeWidth={1.4} {...NS} />
          <path d={`M${-hw},${hd} H${hw} M${-hw * 0.3},${hd - hw * 0.5} v${-hw * 0.3} M${hw * 0.3},${hd - hw * 0.5} v${-hw * 0.3}`} {...line(c, { strokeWidth: 1.4 })} />
        </g>
      );
    case 'switchsym':
      return (
        <g>
          <circle cx={0} cy={0} r={Math.min(hw, hd) * 0.8} fill={c} fillOpacity={0.25} stroke={c} strokeWidth={1.4} {...NS} />
          <path d={`M0,0 L${hw * 1.4},${-hd * 1.4}`} {...line(c, { strokeWidth: 1.4 })} />
        </g>
      );
    case 'aircock':
      return (
        <g>
          <circle cx={0} cy={0} r={Math.min(hw, hd)} fill="#dbeafe" stroke={c} strokeWidth={1.6} {...NS} />
          <text x={0} y={0} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(w, d) * 0.7} fontWeight={800} fill={c}>A</text>
        </g>
      );
    case 'faucet':
      return (
        <g>
          <circle cx={0} cy={0} r={Math.min(hw, hd)} fill="#dcfce7" stroke={c} strokeWidth={1.6} {...NS} />
          <path d={`M${-hw * 0.6},0 H${hw * 0.6} M0,${-hd * 0.6} V${hd * 0.6}`} {...line(c, { strokeWidth: 1.6 })} />
        </g>
      );
    case 'roof':
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} fill={c} fillOpacity={0.15} stroke={c} strokeWidth={1.4} strokeDasharray="8 5" {...NS} />
          {item.roofType === 'gable' && <path d={`M${-hw},0 H${hw}`} {...line(c, { strokeWidth: 1.6 })} />}
          {item.roofType !== 'gable' && item.roofType !== 'flat' && <path d={`M0,${-hd * 0.6} V${hd * 0.6} m${-w * 0.05},${-w * 0.05} l${w * 0.05},${w * 0.05} l${w * 0.05},${-w * 0.05}`} {...line(c)} />}
        </g>
      );
    case 'photobox':
      return (
        <g>
          {item.faces?.top
            ? <image href={item.faces.top} x={-hw} y={-hd} width={w} height={d} preserveAspectRatio="none" />
            : <rect x={-hw} y={-hd} width={w} height={d} fill={c} fillOpacity={0.35} />}
          <rect x={-hw} y={-hd} width={w} height={d} fill="none" stroke={c} strokeWidth={1.6} {...NS} />
          {/* 앞(사진 '앞' 면) 표시 */}
          <path d={`M${-hw},${hd} H${hw}`} {...line(c, { strokeWidth: 3.2 })} />
        </g>
      );
    case 'void':
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} fill={c} fillOpacity={0.08} stroke={c} strokeWidth={1.4} strokeDasharray="8 5" {...NS} />
          <path d={`M${-hw},${-hd} L${hw},${hd} M${hw},${-hd} L${-hw},${hd}`} {...line(c, { strokeDasharray: '8 5' })} />
        </g>
      );
    case 'zone':
      return (
        <g>
          {item.floor?.type ? <FloorFill item={item} z={z} opacity={1} /> : <rect x={-hw} y={-hd} width={w} height={d} fill={c} fillOpacity={0.12} />}
          <rect x={-hw} y={-hd} width={w} height={d} fill="none" stroke={c} strokeWidth={1.4} strokeDasharray="6 4" {...NS} />
        </g>
      );
    case 'glasspanel':
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} fill="#bae6fd" fillOpacity={0.55} stroke={c} strokeWidth={1.4} {...NS} />
          <path d={`M${-hw},0 H${hw}`} {...line(c, { strokeOpacity: 0.7 })} />
        </g>
      );
    case 'glassdoor': {
      const sg = item.swingBack ? -1 : 1; const e = sg * hd; const sw = sg > 0 ? 0 : 1;
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} fill="var(--fp-bg)" stroke="none" />
          <path d={`M${-hw},${-hd} V${hd} M${hw},${-hd} V${hd}`} {...line(c, { strokeWidth: 2 })} />
          <rect x={-hw} y={sg > 0 ? hd : -hd - w} width={Math.max(20, d * 0.35)} height={w} fill="#bae6fd" fillOpacity={0.6} stroke={c} strokeWidth={1.4} {...NS} />
          <path d={`M${-hw},${e + sg * w} A${w},${w} 0 0 ${sw} ${hw},${e}`} {...line(c, { strokeDasharray: '4 3' })} />
        </g>
      );
    }
    case 'autodoor1': {
      // 편개 자동문: 문짝 하나가 오른쪽(벽 쪽)으로 열림. 점선 = 문짝이 들어가는 자리
      const pt = Math.max(20, d * 0.25);
      const a = w * 0.06;
      const leaf = item.opaque ? c : '#bae6fd';
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} fill="var(--fp-bg)" stroke="none" />
          <path d={`M${-hw},${-hd} V${hd} M${hw},${-hd} V${hd}`} {...line(c, { strokeWidth: 2 })} />
          <rect x={-hw} y={-pt / 2} width={w} height={pt} fill={leaf} fillOpacity={item.opaque ? 0.45 : 0.65} stroke={c} strokeWidth={1.4} {...NS} />
          <rect x={hw} y={-pt / 2 - pt} width={w} height={pt} fill="none" stroke={c} strokeWidth={1} strokeDasharray="5 4" {...NS} />
          <path d={`M${-w * 0.2},${hd + w * 0.12} H${w * 0.3} l${-a},${-a * 0.6} M${w * 0.3},${hd + w * 0.12} l${-a},${a * 0.6}`} {...line(c)} />
        </g>
      );
    }
    case 'autodoor': {
      const pt = Math.max(20, d * 0.25);
      const a = w * 0.05;
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} fill="var(--fp-bg)" stroke="none" />
          <path d={`M${-hw},${-hd} V${hd} M${hw},${-hd} V${hd}`} {...line(c, { strokeWidth: 2 })} />
          <rect x={-hw} y={-pt} width={hw} height={pt} fill="#bae6fd" fillOpacity={0.65} stroke={c} strokeWidth={1.4} {...NS} />
          <rect x={0} y={0} width={hw} height={pt} fill="#bae6fd" fillOpacity={0.65} stroke={c} strokeWidth={1.4} {...NS} />
          {/* 양쪽으로 열리는 화살표 */}
          <path d={`M${-w * 0.08},${hd + w * 0.12} H${-w * 0.38} l${a},${-a * 0.6} M${-w * 0.38},${hd + w * 0.12} l${a},${a * 0.6} M${w * 0.08},${hd + w * 0.12} H${w * 0.38} l${-a},${-a * 0.6} M${w * 0.38},${hd + w * 0.12} l${-a},${a * 0.6}`} {...line(c)} />
        </g>
      );
    }
    case 'trench': {
      const long = w >= d; const L = long ? w : d;
      const n = Math.min(80, Math.max(4, Math.round(L / 120)));
      const bars = Array.from({ length: n - 1 }, (_, i) => -L / 2 + (L / n) * (i + 1));
      return (
        <g>
          <Outline w={w} d={d} color={c} fillOpacity={0.3} />
          <path d={bars.map(v => (long ? `M${v},${-hd} V${hd}` : `M${-hw},${v} H${hw}`)).join(' ')} {...line(c, { strokeWidth: 0.8 })} />
        </g>
      );
    }
    case 'drain':
      return (
        <g>
          <Outline w={w} d={d} color={c} fillOpacity={0.3} />
          <path d={[-1, 0, 1].map(k => `M${(k * w) / 4},${-hd} V${hd} M${-hw},${(k * d) / 4} H${hw}`).join(' ')} {...line(c, { strokeWidth: 0.8 })} />
        </g>
      );
    case 'text':
      return null;
    case 'box':
    default:
      return <Outline w={w} d={d} color={c} fillOpacity={0.35} />;
  }
}

/** 점으로 그린 모양: 처음 그린 크기(baseW/baseD)에서 지금 크기(w/d)로 늘이거나 줄임 */
export function scaledPoints(item) {
  const pts = item.points || [];
  const sx = item.baseW ? item.w / item.baseW : 1;
  const sy = item.baseD ? item.d / item.baseD : 1;
  return pts.map(p => ({ x: p.x * sx, y: p.y * sy }));
}

/** 목록에 보여 줄 작은 그림 */
export function ShapeThumb({ item, size = 40 }) {
  const pad = Math.max(item.w, item.d) * 0.12;
  const s = Math.max(item.w, item.d) + pad * 2;
  return (
    <svg width={size} height={size} viewBox={`${-s / 2} ${-s / 2} ${s} ${s}`} className="fp-thumb" aria-hidden="true">
      {item.shape === 'text'
        ? <text x={0} y={0} textAnchor="middle" dominantBaseline="central" fontSize={s * 0.5} fill="currentColor">가</text>
        : <ItemShape item={item} z={size / s} />}
    </svg>
  );
}
