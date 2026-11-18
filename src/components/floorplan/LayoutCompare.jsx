import { useMemo, useState } from 'react';
import ModalPortal from '../common/ModalPortal';
import { PlanItem, WallShape, MepLine, DimLine } from './FloorPlanner';
import { planBounds, findWarnings, zoneLighting, zoneArea } from './planGeometry';
import { isBeam, defaultLevelHeight } from './planLibrary';

/**
 * 배치안 비교: 두 배치안(같은 층끼리)을 나란히 그리고, 숫자로 차이를 보여줌
 * - 도면 그림(배경)은 빼고 벽·구역·비품·선만 그림
 */

/** 예전 배치안(층 없음)도 '1층' 하나로 */
export function levelsOf(layout) {
  if (Array.isArray(layout?.levels) && layout.levels.length) return layout.levels;
  return [{ id: 'L1', name: '1층', items: layout?.items || [], walls: layout?.walls || [], dims: layout?.dims || [], lines: [], ceiling: layout?.ceiling || null }];
}

const segLen = (pts = []) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0), 0);
const wallLen = (w) => Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
const NOT_EQUIP = ['zone', 'text', 'void', 'roof', 'light', 'mep', 'floor'];

/** 배치안 한 층 숫자 정리 */
export function layoutStats(level, { vehicleH = 1800, index = 0 } = {}) {
  const items = level.items || [];
  const walls = level.walls || [];
  const ceiling = level.ceiling || defaultLevelHeight(index);
  const zones = items.filter(i => i.kind === 'zone');
  const warnings = findWarnings(items, walls, { ceiling, vehicleH, levelH: ceiling });
  const lights = items.filter(i => i.kind === 'light');
  const lightRows = zones.map(z => zoneLighting(z, items)).filter(r => r.count);
  return [
    { key: 'equip', label: '비품·장비 수', value: items.filter(i => !NOT_EQUIP.includes(i.kind)).length, unit: '개' },
    { key: 'lift', label: '리프트 수', value: items.filter(i => i.lift !== undefined).length, unit: '대', better: 'more' },
    { key: 'column', label: '기둥 수', value: items.filter(i => i.kind === 'column').length, unit: '개' },
    { key: 'door', label: '문·셔터 수', value: items.filter(i => /door|shutter|sliding/.test(i.shape || '')).length, unit: '개' },
    { key: 'area', label: '구역 넓이 합계', value: Math.round(zones.reduce((s, z) => s + zoneArea(z) / 1e6, 0) * 10) / 10, unit: '㎡' },
    { key: 'floor', label: '바닥 마감 넓이', value: Math.round(zones.filter(z => z.floor?.type).reduce((s, z) => s + zoneArea(z) / 1e6, 0) * 10) / 10, unit: '㎡' },
    { key: 'wall', label: '벽 길이', value: Math.round(walls.filter(w => !isBeam(w)).reduce((s, w) => s + wallLen(w), 0)), unit: 'mm' },
    { key: 'beam', label: '보 길이', value: Math.round(walls.filter(isBeam).reduce((s, w) => s + wallLen(w), 0)), unit: 'mm' },
    { key: 'lines', label: '전기·배관 길이', value: Math.round((level.lines || []).reduce((s, l) => s + segLen(l.pts), 0)), unit: 'mm' },
    { key: 'lights', label: '조명 수 · 전력', value: lights.length, unit: '개', extra: `${lights.reduce((s, l) => s + (Number(l.watt) || 0), 0).toLocaleString()}W` },
    { key: 'dark', label: '밝기가 모자란 방', value: lightRows.filter(r => !r.ok).length, unit: '곳', better: 'less' },
    { key: 'warn', label: '점검 경고', value: warnings.length, unit: '건', better: 'less' },
    { key: 'overlap', label: '겹침·벽 겹침', value: warnings.filter(w => w.type === 'overlap' || w.type === 'wall').length, unit: '건', better: 'less' },
    { key: 'height', label: '높이 부족(층고·보)', value: warnings.filter(w => w.type === 'height').length, unit: '건', better: 'less' },
  ];
}

/** 읽기 전용 미리보기 */
export function PlanPreview({ level, width = 520, height = 380 }) {
  const b = planBounds(level, null);
  const pad = 1000;
  const vb = { x: b.x0 - pad, y: b.y0 - pad, w: b.x1 - b.x0 + pad * 2, h: b.y1 - b.y0 + pad * 2 };
  const z = Math.min(width / vb.w, height / vb.h);
  const items = level.items || [];
  const zones = items.filter(i => i.kind === 'zone');
  const others = items.filter(i => i.kind !== 'zone' && i.kind !== 'roof');
  return (
    <svg className="fp-cmp-svg" viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height }} pointerEvents="none">
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="var(--fp-bg)" />
      {zones.map(it => <PlanItem key={it.id} item={it} z={z} />)}
      {(level.walls || []).map(w => <WallShape key={w.id} wall={w} z={z} />)}
      {others.map(it => <PlanItem key={it.id} item={it} z={z} showClear={false} />)}
      {(level.lines || []).map(l => <MepLine key={l.id} line={l} z={z} />)}
      {(level.dims || []).map(d => <DimLine key={d.id} {...d} z={z} />)}
    </svg>
  );
}

export default function LayoutCompare({ layouts, initialA, vehicleH, onClose, onOpen }) {
  const [aId, setAId] = useState(initialA || layouts[0]?.id);
  const [bId, setBId] = useState(() => layouts.find(l => l.id !== (initialA || layouts[0]?.id))?.id || layouts[0]?.id);
  const [lvIdx, setLvIdx] = useState(0);
  const A = layouts.find(l => l.id === aId) || layouts[0];
  const B = layouts.find(l => l.id === bId) || layouts[1] || layouts[0];
  const la = levelsOf(A); const lb = levelsOf(B);
  const maxLv = Math.max(la.length, lb.length);
  const lvA = la[Math.min(lvIdx, la.length - 1)];
  const lvB = lb[Math.min(lvIdx, lb.length - 1)];
  const sa = useMemo(() => layoutStats(lvA, { vehicleH: A.vehicleH || vehicleH, index: lvIdx }), [lvA, A, vehicleH, lvIdx]);
  const sb = useMemo(() => layoutStats(lvB, { vehicleH: B.vehicleH || vehicleH, index: lvIdx }), [lvB, B, vehicleH, lvIdx]);

  const fmt = (r) => `${r.value.toLocaleString()}${r.unit}${r.extra ? ` · ${r.extra}` : ''}`;
  const diffCls = (ra, rb) => {
    if (!ra.better || ra.value === rb.value) return '';
    const bBetter = ra.better === 'less' ? rb.value < ra.value : rb.value > ra.value;
    return bBetter ? 'good' : 'bad';
  };

  const pick = (value, setter, other) => (
    <select value={value} onChange={(e) => setter(e.target.value)}>
      {layouts.map(l => <option key={l.id} value={l.id} disabled={l.id === other && layouts.length > 1}>{l.name || '배치안'}</option>)}
    </select>
  );

  return (
    <ModalPortal onClose={onClose}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal fp-cmp-modal">
        <div className="modal-header">
          <h2 className="modal-title">배치안 비교</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {maxLv > 1 && (
            <div className="fp-btn-row">
              {Array.from({ length: maxLv }, (_, i) => (
                <button key={i} type="button" className={`filter-pill${lvIdx === i ? ' on' : ''}`} onClick={() => setLvIdx(i)}>{la[i]?.name || lb[i]?.name || `${i + 1}층`}</button>
              ))}
            </div>
          )}
          <div className="fp-cmp-cols">
            {[[A, lvA, aId, setAId, bId, 'A'], [B, lvB, bId, setBId, aId, 'B']].map(([L, lv, id, setter, other, tag]) => (
              <div key={tag} className="fp-cmp-col">
                <div className="fp-cmp-head">
                  <span className="fp-cmp-tag">{tag}</span>
                  {pick(id, setter, other)}
                  <small>{lv?.name}</small>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpen(L.id)}>이 안 열기</button>
                </div>
                <PlanPreview level={lv || { items: [], walls: [] }} />
              </div>
            ))}
          </div>
          <table className="fp-table fp-cmp-table">
            <thead><tr><th>항목</th><th>A · {A.name}</th><th>B · {B.name}</th><th>차이(B−A)</th></tr></thead>
            <tbody>
              {sa.map((ra, i) => {
                const rb = sb[i];
                const diff = rb.value - ra.value;
                return (
                  <tr key={ra.key}>
                    <td>{ra.label}</td>
                    <td>{fmt(ra)}</td>
                    <td>{fmt(rb)}</td>
                    <td className={`fp-cmp-diff ${diffCls(ra, rb)}`}>{diff === 0 ? '같음' : `${diff > 0 ? '+' : ''}${(Math.round(diff * 10) / 10).toLocaleString()}${ra.unit}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="fp-muted">초록은 B가 나은 것, 빨강은 A가 나은 것이에요. 도면 그림(배경)은 비교 화면에서 빼고 그려요.</p>
        </div>
      </div>
    </ModalPortal>
  );
}
