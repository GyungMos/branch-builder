import { useMemo, useState } from 'react';
import {
  PLAN_CATEGORIES, PLAN_LIBRARY, ITEM_COLORS, guessLibraryFromName, FLOOR_TYPES, floorTypeOf, WALL_TYPES, wallTypeOf, WALL_COLORS, isVertical, hasFaces, STEEL_SIZES, steelProfile, PAINT_COLORS, LOUVER_COLORS, ROOF_TYPES, ROOF_MATERIALS, MEP_LINE_TYPES, mepLineTypeOf, STAIR_SHAPES, STAIR_COLOR_DEFAULTS, STAIR_COLORS, RAIL_COLORS, POST_COLORS,
} from './planLibrary';
import { LookSelect, FacePhotos, ModelPicker, inspectModel } from './Plan3DInputs';
import { ShapeThumb, stairArm } from './planShapes';
import { areaText, fmtM, neededHeight, stairInfo, zoneLighting, stairDistanceForHeight, josa } from './planGeometry';

/** 색 고르기: 자주 쓰는 색 + 직접 고르기 */
function ColorPicker({ value, colors, onChange, onReset, resetLabel = '기본 색' }) {
  const custom = value && !colors.includes(value);
  return (
    <div className="fp-colors">
      {colors.map(c => (
        <button key={c} type="button" className={`fp-color${value === c ? ' on' : ''}`} style={{ background: c }} onClick={() => onChange(c)} aria-label={c} title={c} />
      ))}
      <label className={`fp-color fp-color-custom${custom ? ' on' : ''}`} title="직접 고르기" style={custom ? { background: value } : undefined}>
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value || '') ? value : '#888888'} onChange={(e) => onChange(e.target.value)} aria-label="색 직접 고르기" />
      </label>
      {onReset && <button type="button" className="btn btn-ghost btn-sm" onClick={onReset}>{resetLabel}</button>}
    </div>
  );
}

/** 타일 장수 (여유 5%) */
export function tileCount(w, d, tw, td) {
  if (!tw || !td) return 0;
  return Math.ceil(Number((((w * d) / (tw * td)) * 1.05).toFixed(4)));
}

/** 숫자 칸 (mm) */
function Num({ label, value, onChange, unit = 'mm', step = 10, min = 0 }) {
  return (
    <label className="fp-num">
      <span>{label}</span>
      <span className="fp-num-box">
        <input type="number" inputMode="decimal" step={step} min={min} value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
        <em>{unit}</em>
      </span>
    </label>
  );
}

const tplOf = (it) => ({
  key: it.key, name: it.name, shape: it.shape, kind: it.kind, w: it.w, d: it.d, h: it.h, lift: it.lift, clear: it.clear,
  color: it.color, points: it.points, baseW: it.baseW, baseD: it.baseD, img: it.img, arm: it.arm, elev: it.elev,
  look: it.look, faces: it.faces, model: it.model, modelRot: it.modelRot, prof: it.prof,
  lm: it.lm, watt: it.watt, roofType: it.roofType, rise: it.rise, material: it.material, opaque: it.opaque, openUnder: it.openUnder,
  railColor: it.railColor, postColor: it.postColor, noRail: it.noRail,
});

/* ───────── 왼쪽: 비품 목록 ───────── */
export function LibraryPanel({ onPick, onCustom, myLibrary, onRemoveTemplate, equipments, items }) {
  const [cat, setCat] = useState('repair');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(true);

  const list = useMemo(() => {
    const s = q.trim();
    if (s) {
      return [...PLAN_LIBRARY, ...myLibrary.map(m => ({ ...m, cat: 'mine' }))].filter(x => x.name.includes(s));
    }
    if (cat === 'mine') return myLibrary.map(m => ({ ...m, cat: 'mine' }));
    if (cat === 'ledger') return [];
    return PLAN_LIBRARY.filter(x => x.cat === cat);
  }, [cat, q, myLibrary]);

  const placedCount = (equipId) => items.filter(i => i.equipId === equipId).length;

  return (
    <aside className={`fp-lib${open ? '' : ' fp-closed'}`}>
      <div className="fp-panel-head">
        <strong>비품 목록</strong>
        <button type="button" className="btn btn-ghost btn-sm fp-collapse" onClick={() => setOpen(o => !o)}>{open ? '접기' : '펼치기'}</button>
      </div>
      {open && (
        <>
          <input className="fp-search" type="search" placeholder="찾기: 리프트, 세면대…" value={q} onChange={(e) => setQ(e.target.value)} />
          {!q && (
            <div className="fp-cats">
              {PLAN_CATEGORIES.map(c => (
                <button key={c.id} type="button" className={`filter-pill${cat === c.id ? ' on' : ''}`} onClick={() => setCat(c.id)}>{c.label}</button>
              ))}
              <button type="button" className={`filter-pill${cat === 'mine' ? ' on' : ''}`} onClick={() => setCat('mine')}>내 비품 {myLibrary.length ? myLibrary.length : ''}</button>
              <button type="button" className={`filter-pill${cat === 'ledger' ? ' on' : ''}`} onClick={() => setCat('ledger')}>장비 대장 {equipments.length ? equipments.length : ''}</button>
            </div>
          )}
          <button type="button" className="btn btn-secondary btn-sm fp-custom-btn" onClick={onCustom}>+ 직접 만들기</button>
          <p className="fp-lib-tip">누르면 화면 가운데에 놓이고, PC에서는 끌어다 원하는 곳에 놓을 수 있어요.</p>

          {cat === 'ledger' && !q ? (
            <div className="fp-lib-list">
              {!equipments.length && <p className="fp-muted">'업체·시설 → 장비·시설 인허가'에 등록한 장비가 여기 보여요.</p>}
              {equipments.map(eq => {
                const base = guessLibraryFromName(eq.name) || { shape: 'box', w: 1000, d: 1000, color: '#64748b', clear: { f: 600 } };
                const tpl = { ...base, key: base.key, name: eq.name, equipId: eq.id };
                const n = placedCount(eq.id); const need = Number(eq.quantity) || 1;
                return (
                  <button key={eq.id} type="button" className="fp-lib-item" onClick={() => onPick(tpl)}
                    draggable onDragStart={(e) => e.dataTransfer.setData('text/fp-item', JSON.stringify(tpl))}>
                    <ShapeThumb item={tpl} />
                    <span className="fp-lib-name">{eq.name}<small>{eq.modelNumber || ''}</small></span>
                    <span className={`fp-count${n >= need ? ' ok' : ''}`}>{n}/{need}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="fp-lib-list">
              {cat === 'mine' && !q && !myLibrary.length && <p className="fp-muted">직접 만든 비품을 '내 비품'에 저장하면 다른 지점 배치에서도 다시 쓸 수 있어요.</p>}
              {list.map(tpl => (
                <div key={tpl.id || tpl.key} className="fp-lib-row">
                  <button type="button" className="fp-lib-item" onClick={() => onPick({ ...tpl, tplId: tpl.id })} title={tpl.tip || ''}
                    draggable onDragStart={(e) => e.dataTransfer.setData('text/fp-item', JSON.stringify({ ...tpl, tplId: tpl.id }))}>
                    <ShapeThumb item={tpl} />
                    <span className="fp-lib-name">{tpl.name}<small>{tpl.kind === 'text' ? '글자' : `${tpl.w}×${tpl.d}`}</small></span>
                  </button>
                  {tpl.cat === 'mine' && (
                    <button type="button" className="fp-x" title="내 비품에서 빼기" onClick={() => { if (window.confirm(`'${tpl.name}'을(를) 내 비품에서 뺄까요? (이미 놓은 것은 그대로예요)`)) onRemoveTemplate?.(tpl.id); }}>✕</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </aside>
  );
}

/* ───────── 오른쪽: 고른 것 고치기 ───────── */
export function InspectorPanel({
  sel, items, wall, dim, equipments, ceiling, vehicleH, levelH, levelName, aboveName, onCopyUp, demoMode, onAllWalls, line, onLine, allItems = [],
  onItems, onWall, onDelete, onDuplicate, onRotate, onSaveTemplate, onClose, onAlign,
}) {
  if (sel.kind === 'wall' && wall) {
    const len = Math.round(Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1));
    const setLen = (v) => {
      if (!v || v < 50) return;
      const k = v / (len || 1);
      onWall({ x2: wall.x1 + (wall.x2 - wall.x1) * k, y2: wall.y1 + (wall.y2 - wall.y1) * k });
    };
    const wt = wallTypeOf(wall.type);
    return (
      <section className="fp-panel">
        <div className="fp-panel-head"><strong>{wt.short}</strong><button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>닫기</button></div>
        <div className="fp-label">벽 종류 <small>(바꾸면 두께도 보통 값으로 바뀌어요)</small></div>
        <div className="fp-btn-row">
          {WALL_TYPES.map(t => (
            <button key={t.type} type="button" className={`filter-pill${wt.type === t.type ? ' on' : ''}`}
              onClick={() => onWall({ type: t.type === 'concrete' ? null : t.type, t: t.t, color: null, depth: t.beam ? t.depth : null })}>{t.short}</button>
          ))}
        </div>
        {wt.beam ? (
          <>
            <label className="fp-field">
              <span>규격</span>
              <select value={(STEEL_SIZES[wt.beam] || []).find(s => s.w === wall.t && s.d === (wall.depth || wall.t))?.id || ''}
                onChange={(e) => { const s = STEEL_SIZES[wt.beam].find(x => x.id === e.target.value); if (s) onWall({ t: s.w, depth: s.d }); }}>
                <option value="">직접 적은 크기</option>
                {(STEEL_SIZES[wt.beam] || []).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            <div className="fp-grid2">
              <Num label="길이" value={len} onChange={setLen} />
              <Num label="단면 폭" value={wall.t} onChange={(v) => v && onWall({ t: v })} />
              <Num label="단면 높이" value={wall.depth || wall.t} onChange={(v) => v && onWall({ depth: v })} />
              <Num label="보 윗면 높이" value={wall.h || ''} onChange={(v) => onWall({ h: v || null })} />
            </div>
            <p className="fp-muted">
              보 윗면 높이를 비우면 층고{ceiling ? `(${fmtM(ceiling)})` : ''}에 붙여요.
              {(Number(wall.h) || ceiling) ? ` 보 아래 높이는 ${fmtM((Number(wall.h) || ceiling) - (wall.depth || wall.t))}예요. 리프트를 올렸을 때 닿는지 점검에서 같이 봐요.` : ' 층고를 넣으면 리프트가 보 아래에 닿는지 점검해요.'}
            </p>
          </>
        ) : (
          <>
            <div className="fp-grid2">
              <Num label="길이" value={len} onChange={setLen} />
              <Num label="두께" value={wall.t} onChange={(v) => v && onWall({ t: v })} />
              <Num label="높이" value={wall.h || ''} onChange={(v) => onWall({ h: v || null })} />
            </div>
            <p className="fp-muted">높이를 비워 두면 층고까지로 봐요. (3D로 볼 때 써요)</p>
          </>
        )}
        <div className="fp-label">{wt.type === 'glass' || wt.type === 'curtain' ? '유리 틀 색' : wt.beam ? '보 색(도장)' : '벽 색 (도면·벽 두께 면)'}</div>
        <ColorPicker value={wall.color || wt.color || ''} colors={WALL_COLORS} onChange={(c) => onWall({ color: c })} onReset={wall.color ? () => onWall({ color: null }) : null} />
        {!wt.beam && wt.type !== 'glass' && wt.type !== 'curtain' && <WallFaceEditor key={wall.id} wall={wall} onWall={onWall} onAllWalls={onAllWalls} />}
        <p className="fp-muted">양 끝 동그라미를 끌어 길이·방향을 바꿔요.</p>
        <button type="button" className="btn btn-danger btn-sm" onClick={onDelete}>{wt.beam ? '보 지우기' : '벽 지우기'}</button>
      </section>
    );
  }
  if (sel.kind === 'line' && line) {
    return <LineEditor line={line} onLine={onLine} onDelete={onDelete} onClose={onClose} />;
  }
  if (sel.kind === 'dim' && dim) {
    return (
      <section className="fp-panel">
        <div className="fp-panel-head"><strong>치수선</strong><button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>닫기</button></div>
        <p>{fmtM(Math.hypot(dim.x2 - dim.x1, dim.y2 - dim.y1))}</p>
        <button type="button" className="btn btn-danger btn-sm" onClick={onDelete}>치수선 지우기</button>
      </section>
    );
  }
  if (!items.length) return null;
  const ids = items.map(i => i.id);

  if (items.length > 1) {
    return (
      <section className="fp-panel">
        <div className="fp-panel-head"><strong>{items.length}개 고름</strong><button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>닫기</button></div>
        <div className="fp-label">줄 맞추기</div>
        <div className="fp-btn-row">
          {[['left', '왼쪽'], ['vcenter', '가로 가운데'], ['right', '오른쪽'], ['top', '위'], ['hcenter', '세로 가운데'], ['bottom', '아래']].map(([m, l]) => (
            <button key={m} type="button" className="filter-pill" onClick={() => onAlign(m)}>{l}</button>
          ))}
        </div>
        <div className="fp-label">같은 간격으로</div>
        <div className="fp-btn-row">
          <button type="button" className="filter-pill" onClick={() => onAlign('hspace')}>가로 간격 같게</button>
          <button type="button" className="filter-pill" onClick={() => onAlign('vspace')}>세로 간격 같게</button>
        </div>
        <div className="fp-btn-row">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onRotate(90)}>90° 돌리기</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onDuplicate}>복사</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onItems(ids, { locked: !items.every(i => i.locked) })}>{items.every(i => i.locked) ? '잠금 풀기' : '잠그기'}</button>
          <button type="button" className="btn btn-danger btn-sm" onClick={onDelete}>지우기</button>
        </div>
      </section>
    );
  }

  const it = items[0];
  const set = (patch) => onItems(ids, patch);
  const isZone = it.kind === 'zone'; const isText = it.kind === 'text'; const isRoof = it.kind === 'roof';
  const need = neededHeight(it, vehicleH);
  const setClear = (k, v) => set({ clear: { ...(it.clear || {}), [k]: v || 0 } });

  return (
    <section className="fp-panel">
      <div className="fp-panel-head"><strong>{isZone ? '구역' : isText ? '글자' : '비품'}</strong><button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>닫기</button></div>
      <label className="fp-field">
        <span>{isText ? '글자' : '이름'}</span>
        <input type="text" value={it.name || ''} onChange={(e) => set(isText ? { name: e.target.value, w: Math.max(300, e.target.value.length * it.d * 0.85) } : { name: e.target.value })} />
      </label>
      {isText ? (
        <Num label="글자 크기" value={it.d} onChange={(v) => v && set({ d: v, w: Math.max(300, (it.name || '').length * v * 0.85) })} />
      ) : (
        <div className="fp-grid2">
          <Num label="가로" value={Math.round(it.w)} onChange={(v) => v && set({ w: v })} />
          <Num label="세로" value={Math.round(it.d)} onChange={(v) => v && set({ d: v })} />
          {!isZone && !isRoof && <Num label="높이" value={it.h || ''} onChange={(v) => set({ h: v || 0 })} />}
          {it.shape === 'lshape' && <Num label="팔 두께" value={it.arm || Math.round(Math.min(it.w, it.d) / 2)} onChange={(v) => v && set({ arm: v })} />}
          {(it.shape === 'stairsL' || it.shape === 'stairsU') && <Num label="계단 폭" value={Math.round(stairArm(it))} onChange={(v) => v && set({ arm: v })} />}
        </div>
      )}
      {(it.shape === 'hbeam' || it.shape === 'sqpipe') && (
        <>
          <label className="fp-field">
            <span>규격</span>
            <select value={STEEL_SIZES[it.shape].find(s => s.w === it.w && s.d === it.d)?.id || ''}
              onChange={(e) => {
                const s = STEEL_SIZES[it.shape].find(x => x.id === e.target.value);
                if (!s) return;
                const kindLabel = it.shape === 'hbeam' ? 'H빔 기둥' : '각파이프 기둥';
                const auto = !it.name || /^(H빔|각파이프) 기둥/.test(it.name);
                set({ w: s.w, d: s.d, prof: it.shape === 'hbeam' ? { tw: s.tw, tf: s.tf } : { t: s.t }, ...(auto ? { name: `${kindLabel} ${s.label.split(' ')[0]}` } : {}) });
              }}>
              <option value="">직접 적은 크기</option>
              {STEEL_SIZES[it.shape].map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <div className="fp-grid2">
            {it.shape === 'hbeam' ? (
              <>
                <Num label="웨브 두께" step={0.5} value={steelProfile('hbeam', it.w, it.d, it.prof).tw} onChange={(v) => v && set({ prof: { ...steelProfile('hbeam', it.w, it.d, it.prof), tw: v } })} />
                <Num label="플랜지 두께" step={0.5} value={steelProfile('hbeam', it.w, it.d, it.prof).tf} onChange={(v) => v && set({ prof: { ...steelProfile('hbeam', it.w, it.d, it.prof), tf: v } })} />
              </>
            ) : (
              <Num label="두께" step={0.1} value={steelProfile('sqpipe', it.w, it.d, it.prof).t} onChange={(v) => v && set({ prof: { t: v } })} />
            )}
          </div>
          <p className="fp-muted">높이를 비우면 그 층 층고까지 올라가요. H빔은 R 키(90° 돌리기)로 방향을 바꿔요.</p>
        </>
      )}
      {isVertical(it) && <StairCheck it={it} levelH={levelH} levelName={levelName} />}
      {['stairs', 'stairsL', 'stairsU'].includes(it.shape) && <StairUnder it={it} set={set} levelH={levelH} />}
      {isVertical(it) && aboveName && onCopyUp && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onCopyUp(it)}>
          {it.shape === 'elevator' ? `${aboveName}에도 같은 자리에 놓기` : `${aboveName}에 뚫린 곳(계단 구멍) 표시`}
        </button>
      )}
      {isZone && <p className="fp-area">넓이 {areaText(it.w, it.d)}</p>}
      {isZone && <FloorEditor it={it} set={set} />}
      {isZone && <ZoneCeilingLight it={it} set={set} allItems={allItems} />}
      {isRoof && <RoofEditor it={it} set={set} levelH={levelH} />}
      {it.kind === 'light' && (
        <>
          <div className="fp-grid2">
            <Num label="밝기" unit="lm" step={100} value={it.lm || ''} onChange={(v) => set({ lm: v || 0 })} />
            <Num label="전력" unit="W" step={1} value={it.watt || ''} onChange={(v) => set({ watt: v || 0 })} />
          </div>
          <p className="fp-muted">'바닥에서 띄운 높이'를 비우면 구역 천장 높이(없으면 층고)에 붙어요. 구역을 고르면 그 방 밝기(lux)를 계산해 줘요.</p>
        </>
      )}
      {!isZone && !isText && !isRoof && (it.elev !== undefined || ['arch', 'light', 'mount', 'mep'].includes(it.kind)) && (
        <Num label="바닥에서 띄운 높이" value={it.elev || ''} onChange={(v) => set({ elev: v || 0 })} />
      )}

      <div className="fp-label">돌리기 · 뒤집기 <small>(지금 {Math.round(it.rot || 0)}°)</small></div>
      <div className="fp-btn-row">
        <button type="button" className="filter-pill" onClick={() => onRotate(-90)}>↺ 90°</button>
        <button type="button" className="filter-pill" onClick={() => onRotate(90)}>↻ 90°</button>
        <button type="button" className="filter-pill" onClick={() => onRotate(-15)}>↺ 15°</button>
        <button type="button" className="filter-pill" onClick={() => onRotate(15)}>↻ 15°</button>
        {!isText && <button type="button" className="filter-pill" onClick={() => set({ flip: !it.flip })}>좌우 뒤집기</button>}
      </div>

      {!isZone && !isText && !isRoof && (
        <>
          <div className="fp-label">비워 둘 작업 공간 <small>(앞=아래쪽, 돌리면 같이 돌아요)</small></div>
          <div className="fp-grid2">
            <Num label="앞" value={it.clear?.f || 0} onChange={(v) => setClear('f', v)} />
            <Num label="뒤" value={it.clear?.b || 0} onChange={(v) => setClear('b', v)} />
            <Num label="왼쪽" value={it.clear?.l || 0} onChange={(v) => setClear('l', v)} />
            <Num label="오른쪽" value={it.clear?.r || 0} onChange={(v) => setClear('r', v)} />
          </div>
        </>
      )}

      {it.lift !== undefined && (
        <>
          <Num label="최대 들어올림 높이" value={it.lift} onChange={(v) => set({ lift: v || 0 })} />
          <p className={`fp-height${ceiling && need > ceiling ? ' bad' : ''}`}>
            필요한 층고 {fmtM(need)}{ceiling ? ` / 지금 층고 ${fmtM(ceiling)}` : ' (오른쪽 칸에 층고를 넣으면 비교해요)'}
          </p>
        </>
      )}

      {STAIR_SHAPES.includes(it.shape) ? <StairColors it={it} set={set} /> : (
        <>
          <div className="fp-label">{isZone ? '테두리·이름 색' : '색'}</div>
          <ColorPicker value={it.color} colors={ITEM_COLORS} onChange={(c) => set({ color: c })} />
        </>
      )}

      {!isZone && !isText && !isRoof && it.kind !== 'void' && <Item3DSection key={it.id} it={it} set={set} demoMode={demoMode} />}

      {!isZone && !isText && !isRoof && equipments.length > 0 && (
        <label className="fp-field">
          <span>장비 대장과 잇기</span>
          <select value={it.equipId || ''} onChange={(e) => set({ equipId: e.target.value || null })}>
            <option value="">잇지 않음</option>
            {equipments.map(eq => <option key={eq.id} value={eq.id}>{eq.name}{eq.modelNumber ? ` (${eq.modelNumber})` : ''}</option>)}
          </select>
        </label>
      )}

      <label className="fp-field">
        <span>메모</span>
        <input type="text" value={it.memo || ''} onChange={(e) => set({ memo: e.target.value })} placeholder="예: 바닥 앵커 위치 확인" />
      </label>

      <div className="fp-btn-row">
        <label className="fp-check"><input type="checkbox" checked={Boolean(it.locked)} onChange={(e) => set({ locked: e.target.checked })} /> 잠그기(안 움직이게)</label>
        {!isZone && !isText && !isRoof && (
          <label className="fp-check"><input type="checkbox" checked={Boolean(it.hideClear)} onChange={(e) => set({ hideClear: e.target.checked })} /> 작업 공간 검사 안 함</label>
        )}
      </div>
      <div className="fp-btn-row">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onDuplicate}>복사</button>
        {!isZone && !isText && !isRoof && onSaveTemplate && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { onSaveTemplate(tplOf(it)); alert(`'${it.name}'을(를) 내 비품에 저장했어요.`); }}>내 비품에 저장</button>
        )}
        <button type="button" className="btn btn-danger btn-sm" onClick={onDelete} disabled={it.locked}>지우기</button>
      </div>
      <p className="fp-muted fp-keys">단축키: 화살표 10mm(Shift 100mm) 옮기기 · R 돌리기 · Ctrl+D 복사 · Delete 지우기 · Ctrl+Z 되돌리기</p>
    </section>
  );
}

/* 전기·배관 선 */
function LineEditor({ line, onLine, onDelete, onClose }) {
  const lt = mepLineTypeOf(line.type);
  const pts = line.pts || [];
  const len = pts.reduce((s, q, i) => (i ? s + Math.hypot(q.x - pts[i - 1].x, q.y - pts[i - 1].y) : 0), 0);
  return (
    <section className="fp-panel">
      <div className="fp-panel-head"><strong>{lt.label}</strong><button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>닫기</button></div>
      <div className="fp-label">종류</div>
      <div className="fp-btn-row">
        {MEP_LINE_TYPES.map(t => (
          <button key={t.type} type="button" className={`filter-pill${t.type === lt.type ? ' on' : ''}`} onClick={() => onLine({ type: t.type, h: t.h })}>
            <i className="fp-line-dot" style={{ background: t.color }} /> {t.label}
          </button>
        ))}
      </div>
      <p className="fp-area">길이 {fmtM(len)} · 꺾인 곳 {Math.max(0, pts.length - 2)}개</p>
      <Num label="지나가는 높이" step={100} value={line.h ?? lt.h} onChange={(v) => onLine({ h: v ?? 0 })} />
      <p className="fp-muted">3D에서 이 높이로 지나가요. (전기 배선·에어 배관은 보통 천장 쪽, 급수·배수는 바닥 쪽)</p>
      <button type="button" className="btn btn-danger btn-sm" onClick={onDelete}>선 지우기</button>
    </section>
  );
}

/* 구역 천장 높이·밝기(조도) */
function ZoneCeilingLight({ it, set, allItems }) {
  const L = zoneLighting(it, allItems);
  return (
    <div className="fp-3d-sec">
      <div className="fp-label">천장·조명</div>
      <div className="fp-grid2">
        <Num label="천장 높이" step={50} value={it.ceilH || ''} onChange={(v) => set({ ceilH: v || null })} />
        <Num label="목표 밝기" unit="lux" step={50} value={it.luxTarget || L.need} onChange={(v) => set({ luxTarget: v || null })} />
      </div>
      <p className="fp-muted">천장 높이를 적으면 이 방 조명이 그 높이에 붙고, 3D에서 천장판이 보여요. 비우면 층고까지 뚫린 공간이에요.</p>
      <div className={`fp-stair-box${L.count && L.ok ? '' : ' bad'}`}>
        <strong>밝기(평균 조도) 어림</strong>
        {L.count ? (
          <>
            <div>조명 {L.count}개 · {L.lm.toLocaleString()}lm · {L.watt.toLocaleString()}W</div>
            <div>약 {L.lux.toLocaleString()} lux / 목표 {L.need.toLocaleString()} lux {L.ok ? '✓' : '— 모자라요'}</div>
          </>
        ) : <div>이 구역 안에 놓은 조명이 없어요. '조명·전기·배관'에서 조명을 놓아 보세요.</div>}
        <small className="fp-muted">정비 작업 500 · 사무 400 · 대기실 200 · 화장실·창고 150 lux가 기준이에요. 구역 이름으로 목표를 짐작해요.</small>
      </div>
    </div>
  );
}

/* 지붕: 모양·처마 높이·경사·재료 */
function RoofEditor({ it, set, levelH }) {
  const type = it.roofType || 'flat';
  const slope = it.d ? Math.round(((it.rise || 0) / (type === 'gable' ? it.d / 2 : it.d)) * 1000) / 10 : 0;
  return (
    <div className="fp-3d-sec">
      <div className="fp-label">지붕 모양</div>
      <div className="fp-btn-row">
        {ROOF_TYPES.map(t => (
          <button key={t.id} type="button" className={`filter-pill${type === t.id ? ' on' : ''}`} title={t.tip || ''}
            onClick={() => set({ roofType: t.id, rise: t.id === 'flat' ? 0 : (it.rise || Math.round(((t.id === 'gable' ? it.d / 2 : it.d) * 0.05) / 10) * 10) })}>{t.label}</button>
        ))}
      </div>
      <div className="fp-grid2">
        <Num label="처마 높이" step={50} value={it.h || ''} onChange={(v) => set({ h: v || 0 })} />
        {type !== 'flat' && <Num label="경사로 오르는 높이" step={10} value={it.rise || 0} onChange={(v) => set({ rise: v ?? 0 })} />}
      </div>
      <p className="fp-muted">
        {type === 'flat' ? '평평한 지붕이에요.' : `기울기 약 ${slope}% · 가장 높은 곳 ${fmtM((it.h || 0) + (it.rise || 0))}`}
        {type === 'mono' ? ' 뒤쪽(위)이 높아요. 돌리기로 방향을 바꿔요.' : ''}
        {!it.h && levelH ? ` 처마 높이를 비우면 3D에서는 층고(${fmtM(levelH)})로 봐요.` : ''}
      </p>
      <div className="fp-label">재료</div>
      <div className="fp-btn-row">
        {ROOF_MATERIALS.map(m => (
          <button key={m.id} type="button" className={`filter-pill${(it.material || 'panel') === m.id ? ' on' : ''}`} onClick={() => set({ material: m.id, color: m.color })}>{m.label}</button>
        ))}
      </div>
    </div>
  );
}

/* 벽면 꾸미기: 면(A·B)마다 페인트 색, 아래쪽 루바(나무 판) */
function WallFaceEditor({ wall, onWall, onAllWalls }) {
  const [side, setSide] = useState('a');
  const faces = wall.faces || {};
  const f = faces[side] || {};
  const write = (nf) => {
    const clean = Object.fromEntries(Object.entries(nf).filter(([, v]) => v !== null && v !== undefined));
    onWall({ faces: { ...faces, [side]: Object.keys(clean).length ? clean : null } });
  };
  const setF = (patch) => write({ ...f, ...patch });
  const w = f.wainscot || null;
  const setW = (patch) => setF({ wainscot: { h: 1200, color: '#c8a273', pitch: 100, ...(w || {}), ...patch } });
  const dot = (s) => (faces[s] ? ' ●' : '');
  return (
    <div className="fp-3d-sec">
      <div className="fp-label">벽면 꾸미기 <small>(도면에 보이는 A면·B면 글자로 어느 쪽인지 확인)</small></div>
      <div className="fp-btn-row">
        <button type="button" className={`filter-pill${side === 'a' ? ' on' : ''}`} onClick={() => setSide('a')}>A면{dot('a')}</button>
        <button type="button" className={`filter-pill${side === 'b' ? ' on' : ''}`} onClick={() => setSide('b')}>B면{dot('b')}</button>
      </div>
      <div className="fp-label">페인트 색</div>
      <ColorPicker value={f.paint || ''} colors={PAINT_COLORS} onChange={(c) => setF({ paint: c })} onReset={f.paint ? () => setF({ paint: null }) : null} resetLabel="칠 안 함" />
      <label className="fp-check"><input type="checkbox" checked={Boolean(w)} onChange={(e) => setF({ wainscot: e.target.checked ? { h: 1200, color: '#c8a273', pitch: 100 } : null })} /> 아래쪽 루바(나무 판) 두르기</label>
      {w && (
        <>
          <div className="fp-grid2">
            <Num label="루바 높이" step={50} value={w.h} onChange={(v) => v && setW({ h: v })} />
            <Num label="판 한 장 폭" step={10} value={w.pitch || 100} onChange={(v) => v && setW({ pitch: v })} />
          </div>
          <div className="fp-label">루바 색</div>
          <ColorPicker value={w.color} colors={LOUVER_COLORS} onChange={(c) => setW({ color: c })} />
          <p className="fp-muted">문·창 자리는 비우고 둘러요. 보통 바닥에서 900~1,200mm 높이까지 둘러요.</p>
        </>
      )}
      <div className="fp-btn-row">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onWall({ faces: { a: faces[side] || null, b: faces[side] || null } })}>양쪽 면 같게</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { if (window.confirm('이 벽의 꾸미기(A면·B면)를 모든 벽에 똑같이 적용할까요? (유리벽·보는 빼요)')) onAllWalls({ faces: wall.faces || null }); }}>모든 벽에 같게</button>
      </div>
      <p className="fp-muted">'건물 크기로 벽 만들기'로 만든 벽은 A면이 건물 안쪽이에요.</p>
    </div>
  );
}

/* 3D 모습: 3D 모델 파일 > 면 사진 > 모양 빌리기 > 기본 모양 순서로 보여요 */
function Item3DSection({ it, set, demoMode }) {
  const [open, setOpen] = useState(Boolean(it.model || hasFaces(it) || it.look));
  const [busy, setBusy] = useState('');
  const mode = it.model ? 'model' : hasFaces(it) ? 'photo' : it.look ? 'look' : 'basic';

  const addModel = ({ model, info }) => {
    set({
      model, modelRot: 0,
      prevShape: it.shape, prevImg: it.img || null,
      ...(info.top ? { shape: 'image', img: info.top } : {}),
      ...(!it.h && info.h ? { h: info.h } : {}),
    });
  };
  const removeModel = () => set({ model: null, modelRot: 0, shape: it.prevShape || 'box', img: it.prevImg || null, prevShape: null, prevImg: null });
  const rotateModel = async () => {
    const rot = ((it.modelRot || 0) + 90) % 360;
    setBusy('돌리는 중…');
    try {
      const info = await inspectModel(it.model.url, rot);
      set({ modelRot: rot, w: it.d, d: it.w, ...(info.top ? { img: info.top } : {}) });
    } catch {
      set({ modelRot: rot, w: it.d, d: it.w });
    } finally {
      setBusy('');
    }
  };
  const fitToModel = async () => {
    setBusy('크기 읽는 중…');
    try {
      const info = await inspectModel(it.model.url, it.modelRot || 0);
      if (info.w > 0) set({ w: info.w, d: info.d, h: info.h });
    } catch { alert('모델 크기를 읽지 못했어요.'); } finally { setBusy(''); }
  };

  return (
    <div className="fp-3d-sec">
      <button type="button" className="fp-3d-sec-head" onClick={() => setOpen(o => !o)}>
        <span>3D 모습</span>
        <small>{{ model: '3D 모델 파일', photo: '사진 상자', look: '모양 빌림', basic: '기본' }[mode]}</small>
        <em>{open ? '접기' : '펼치기'}</em>
      </button>
      {open && (
        <>
          <div className="fp-label">3D 모델 파일 (가장 정확해요)</div>
          {it.model ? (
            <>
              <p className="fp-muted">{it.model.name}{it.model.size ? ` · ${(it.model.size / 1048576).toFixed(1)}MB` : ''} · {it.modelRot || 0}° 돌림</p>
              <div className="fp-btn-row">
                <button type="button" className="filter-pill" onClick={rotateModel} disabled={Boolean(busy)}>모델 앞쪽 90° 돌리기</button>
                <button type="button" className="filter-pill" onClick={fitToModel} disabled={Boolean(busy)}>크기를 모델대로</button>
                <button type="button" className="btn btn-ghost btn-sm fp-danger-text" onClick={removeModel}>모델 빼기</button>
              </div>
              {busy && <small className="fp-muted">{busy}</small>}
              <p className="fp-muted">높이를 비우면 모델 비율대로, 적으면 가로·세로·높이에 맞춰 늘이거나 줄여요.</p>
            </>
          ) : (
            <ModelPicker demoMode={demoMode} onPicked={addModel} />
          )}

          <div className="fp-label">면 사진 (사진 상자)</div>
          <FacePhotos faces={it.faces || {}} onChange={(faces) => set({ faces })} demoMode={demoMode} />
          {hasFaces(it) && it.model && <p className="fp-muted">3D 모델 파일이 있으면 모델이 먼저 보여요.</p>}

          <label className="fp-field">
            <span>3D 모양 빌리기</span>
            <LookSelect value={it.look} onChange={(look) => set({ look })} emptyLabel="빌리지 않음 (원래 모양)" />
          </label>
          {(it.model || hasFaces(it)) && it.look && <p className="fp-muted">모델·사진이 있으면 그것이 먼저 보여요.</p>}
        </>
      )}
    </div>
  );
}

/* 계단 색: 계단 / 손잡이 / 기둥 따로 */
function StairColors({ it, set }) {
  return (
    <div className="fp-3d-sec">
      <div className="fp-label">계단 색 <small>(디딤판·챌판·옆판)</small></div>
      <ColorPicker value={it.color} colors={STAIR_COLORS} onChange={(c) => set({ color: c })} />
      <label className="fp-check"><input type="checkbox" checked={!it.noRail} onChange={(e) => set({ noRail: !e.target.checked })} /> 난간 달기</label>
      {!it.noRail && (
        <>
          <div className="fp-label">손잡이 색 <small>(난간 위쪽 잡는 부분)</small></div>
          <ColorPicker value={it.railColor || STAIR_COLOR_DEFAULTS.rail} colors={RAIL_COLORS} onChange={(c) => set({ railColor: c })} />
          <div className="fp-label">기둥 색 <small>(난간 세로 기둥·계단참 받침 기둥)</small></div>
          <ColorPicker value={it.postColor || STAIR_COLOR_DEFAULTS.post} colors={POST_COLORS} onChange={(c) => set({ postColor: c })} />
        </>
      )}
      <p className="fp-muted">색은 3D 보기에서 보여요. 2D 도면에는 계단 색만 보여요.</p>
    </div>
  );
}

/* 계단 아래: 막힘 / 빈 공간 (빈 공간이면 아래에 비품을 넣을 수 있음) */
function StairUnder({ it, set, levelH }) {
  const H = levelH || 3500;
  const at = (h) => stairDistanceForHeight(it, h, H);
  return (
    <div className="fp-3d-sec">
      <div className="fp-label">계단 아래</div>
      <div className="fp-btn-row">
        <button type="button" className={`filter-pill${!it.openUnder ? ' on' : ''}`} onClick={() => set({ openUnder: false })}>막힘</button>
        <button type="button" className={`filter-pill${it.openUnder ? ' on' : ''}`} onClick={() => set({ openUnder: true })}>빈 공간 (수납·냉장고 자리)</button>
      </div>
      {it.openUnder ? (
        <>
          <p className="fp-muted">계단 아래에 냉장고·정수기·수납장을 놓아도 겹침 경고가 나지 않고, 물건 높이가 계단 아랫면보다 높으면 알려줘요.</p>
          <ul className="fp-under-list">
            {[['정수기', 1300], ['냉장고', 1800], ['수납장', 2000]].map(([n, h]) => (
              <li key={n}>높이 {fmtM(h)} {josa(n, '은는')} 계단 시작점에서 약 <b>{fmtM(at(h))}</b> 안쪽부터 들어가요</li>
            ))}
          </ul>
          <p className="fp-muted">시작점 = 계단을 오르기 시작하는 쪽(화살표 시작). 길이는 오르는 길을 따라 잰 값이에요.</p>
        </>
      ) : <p className="fp-muted">아래가 막힌 계단이에요. 아래에 비품을 넣으려면 '빈 공간'으로 바꾸세요.</p>}
    </div>
  );
}

/* 계단·경사로 계산 (참고용) */
function StairCheck({ it, levelH, levelName }) {
  if (it.shape === 'elevator') {
    return <p className="fp-muted">승강로는 {levelName || '이 층'} 층고({fmtM(levelH)})만큼 올라가요. 위층에도 놓으면 3D에서 이어져 보여요.</p>;
  }
  const info = stairInfo(it, levelH);
  if (!info) return null;
  const pct = (v) => `${(v * 100).toFixed(1)}%`;
  return (
    <div className={`fp-stair-box${info.ok ? '' : ' bad'}`}>
      <strong>{info.ramp ? '경사로 계산' : '계단 계산'}</strong> <small>({levelName || '이 층'} 층고 {fmtM(levelH)} 기준)</small>
      {info.ramp ? (
        <>
          <div>기울기 {pct(info.slope)} {info.ok ? '✓' : '— 17%보다 가팔라요'}</div>
          {!info.ok && <div>필요한 길이 약 {fmtM(info.need)} (지금 {fmtM(info.have)})</div>}
        </>
      ) : (
        <>
          <div>단 {info.n}개 · 단높이 {Math.round(info.rise)}mm</div>
          {info.need !== null && (
            <div>{info.ok ? `길이 넉넉해요 (필요 ${fmtM(info.need)} / 지금 ${fmtM(info.have)})` : `오르는 길이가 모자라요: 필요 ${fmtM(info.need)} / 지금 ${fmtM(info.have)}`}</div>
          )}
        </>
      )}
      <small className="fp-muted">{info.ramp ? '주차장법 직선 경사로 17% 이하 기준이에요.' : '단높이 180mm 이하·단너비 260mm 이상, 높이 3,000mm가 넘으면 계단참 기준이에요.'} 용도에 따라 기준이 달라 설계사무소 확인이 필요해요.</small>
    </div>
  );
}

/* 구역 바닥 마감: 종류·타일 크기·색 */
function FloorEditor({ it, set }) {
  const f = it.floor || null;
  const ft = f ? floorTypeOf(f.type) : null;
  const pick = (type) => {
    if (!type) { set({ floor: null }); return; }
    const t = floorTypeOf(type);
    const size = t.sizes?.[Math.min(2, t.sizes.length - 1)];
    set({ floor: { type, color: f?.type === type ? f.color : t.colors[Math.min(1, t.colors.length - 1)], ...(size ? { tw: size[0], td: size[1] } : {}) } });
  };
  const setF = (patch) => set({ floor: { ...f, ...patch } });
  const n = f && ft?.sizes ? tileCount(it.w, it.d, f.tw, f.td) : 0;
  return (
    <>
      <div className="fp-label">바닥 마감</div>
      <div className="fp-btn-row">
        <button type="button" className={`filter-pill${!f ? ' on' : ''}`} onClick={() => pick(null)}>안 정함</button>
        {FLOOR_TYPES.map(t => (
          <button key={t.type} type="button" className={`filter-pill${f?.type === t.type ? ' on' : ''}`} onClick={() => pick(t.type)}>{t.label}</button>
        ))}
      </div>
      {f && ft && (
        <>
          {ft.sizes && (
            <>
              <div className="fp-btn-row">
                {ft.sizes.map(([a, b]) => (
                  <button key={`${a}x${b}`} type="button" className={`filter-pill${f.tw === a && f.td === b ? ' on' : ''}`} onClick={() => setF({ tw: a, td: b })}>{a}×{b}</button>
                ))}
                {ft.sizes.some(([a, b]) => a !== b) && (
                  <button type="button" className="filter-pill" onClick={() => setF({ tw: f.td, td: f.tw })} title="타일 방향 바꾸기">가로·세로 바꾸기</button>
                )}
              </div>
              <div className="fp-grid2">
                <Num label="타일 가로" value={f.tw} onChange={(v) => v && setF({ tw: v })} />
                <Num label="타일 세로" value={f.td} onChange={(v) => v && setF({ td: v })} />
              </div>
              <p className="fp-area">타일 약 {n.toLocaleString()}장 <small>(여유 5% 포함)</small></p>
            </>
          )}
          <div className="fp-label">바닥 색</div>
          <ColorPicker value={f.color} colors={ft.colors} onChange={(c) => setF({ color: c })} />
        </>
      )}
    </>
  );
}

/* ───────── 오른쪽: 아무것도 안 골랐을 때 (도면·층고·건물) ───────── */
export function PlanSettingsPanel({ plan, levelName, levelH, onPlan, onPickBg, onCalibrate, onRoom }) {
  const [roomW, setRoomW] = useState('');
  const [roomD, setRoomD] = useState('');
  const bg = plan.bg;
  return (
    <section className="fp-panel">
      <div className="fp-panel-head"><strong>{levelName ? `${levelName} 도면` : '도면'}</strong></div>
      {bg ? (
        <>
          <p className="fp-muted">{bg.name || '도면'} · {bg.calibrated ? `가로 ${fmtM(bg.w * bg.mmPerPx)}로 맞춤` : '축척 안 맞춤'}</p>
          <div className="fp-btn-row">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onCalibrate}>축척 맞추기</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onPickBg}>도면 바꾸기</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onPlan({ bg: { ...bg, hidden: !bg.hidden } })}>{bg.hidden ? '도면 보이기' : '도면 숨기기'}</button>
          </div>
          <label className="fp-field">
            <span>도면 진하기 {Math.round((bg.opacity ?? 0.7) * 100)}%</span>
            <input type="range" min="0.1" max="1" step="0.05" value={bg.opacity ?? 0.7} onChange={(e) => onPlan({ bg: { ...bg, opacity: Number(e.target.value) } })} />
          </label>
          <button type="button" className="btn btn-ghost btn-sm fp-danger-text" onClick={() => { if (window.confirm('도면을 뺄까요? (비품·벽은 그대로예요)')) onPlan({ bg: null }); }}>도면 빼기</button>
        </>
      ) : (
        <>
          <p className="fp-muted">설계사무소 도면을 그림(JPG·PNG)이나 PDF로 올려요. 캐드 파일(DWG)은 PDF로 받아 주세요.</p>
          <button type="button" className="btn btn-primary btn-sm" onClick={onPickBg}>도면 올리기</button>
        </>
      )}

      <div className="fp-panel-head fp-sub"><strong>{levelName ? `${levelName} 층고` : '층고 확인'}</strong></div>
      <div className="fp-grid2">
        <Num label="층고" unit="mm" step={50} value={plan.ceiling || ''} onChange={(v) => onPlan({ ceiling: v || null })} />
        <Num label="가장 높은 차" unit="mm" step={50} value={plan.vehicleH || 1800} onChange={(v) => onPlan({ vehicleH: v || 1800 })} />
      </div>
      <p className="fp-muted">리프트를 끝까지 올리고 차를 얹었을 때 천장(보·배관·조명 포함)에 닿지 않는지 봐요. 여유 200mm를 더해요.</p>
      {!plan.ceiling && <p className="fp-muted">층고를 안 적으면 계단 계산과 3D는 {fmtM(levelH)}로 봐요.</p>}

      <div className="fp-panel-head fp-sub"><strong>건물 크기로 벽 만들기</strong></div>
      <div className="fp-grid2">
        <Num label="가로" step={100} value={roomW} onChange={(v) => setRoomW(v ?? '')} />
        <Num label="세로" step={100} value={roomD} onChange={(v) => setRoomD(v ?? '')} />
        <Num label="벽 두께" value={plan.wallT || 200} onChange={(v) => onPlan({ wallT: v || 200 })} />
      </div>
      <button type="button" className="btn btn-secondary btn-sm" disabled={!roomW || !roomD} onClick={() => { onRoom(Number(roomW), Number(roomD), plan.wallT || 200); setRoomW(''); setRoomD(''); }}>네모 벽 만들기</button>
    </section>
  );
}

/* ───────── 오른쪽 아래: 점검(경고)·개수 세기 ───────── */
export function ChecksPanel({ warnings, items, walls = [], lines = [], equipments, onFocus, onPlaceEquipment }) {
  const lightRows = useMemo(() => items.filter(i => i.kind === 'zone').map(z => ({ z, L: zoneLighting(z, items) })).filter(r => r.L.count), [items]);
  const lineSum = useMemo(() => MEP_LINE_TYPES.map(t => ({ t, len: lines.filter(l => (l.type || 'elec') === t.type).reduce((s, l) => s + (l.pts || []).reduce((a, q, i, arr) => (i ? a + Math.hypot(q.x - arr[i - 1].x, q.y - arr[i - 1].y) : 0), 0), 0) })).filter(r => r.len > 0), [lines]);
  const finishes = useMemo(() => {
    const m = new Map();
    items.filter(i => i.kind === 'zone' && i.floor?.type).forEach(z => {
      const ft = floorTypeOf(z.floor.type);
      const key = ft?.sizes ? `${ft.label} ${z.floor.tw}×${z.floor.td}` : (ft?.label || '바닥');
      const cur = m.get(key) || { area: 0, tiles: 0, sized: Boolean(ft?.sizes) };
      cur.area += (z.w * z.d) / 1e6;
      if (ft?.sizes) cur.tiles += tileCount(z.w, z.d, z.floor.tw, z.floor.td);
      m.set(key, cur);
    });
    return [...m.entries()];
  }, [items]);
  const wallSum = useMemo(() => {
    const m = new Map();
    walls.forEach(w => {
      const k = wallTypeOf(w.type).short;
      m.set(k, (m.get(k) || 0) + Math.hypot(w.x2 - w.x1, w.y2 - w.y1) / 1000);
    });
    return [...m.entries()];
  }, [walls]);
  const [tab, setTab] = useState('warn');
  const counts = useMemo(() => {
    const m = new Map();
    items.filter(i => !['zone', 'text', 'roof'].includes(i.kind)).forEach(i => {
      const k = i.name || '비품';
      m.set(k, (m.get(k) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);
  const zones = items.filter(i => i.kind === 'zone');
  const zoneTotal = zones.reduce((s, z) => s + (z.w * z.d) / 1e6, 0);
  const ledger = equipments.map(eq => ({ eq, need: Number(eq.quantity) || 1, placed: items.filter(i => i.equipId === eq.id).length }));
  const missing = ledger.filter(l => l.placed < l.need);

  return (
    <section className="fp-panel">
      <div className="fp-btn-row">
        <button type="button" className={`filter-pill${tab === 'warn' ? ' on' : ''}`} onClick={() => setTab('warn')}>점검 {warnings.length ? `⚠ ${warnings.length}` : '✓'}</button>
        <button type="button" className={`filter-pill${tab === 'count' ? ' on' : ''}`} onClick={() => setTab('count')}>개수·넓이</button>
      </div>
      {tab === 'warn' && (
        warnings.length ? (
          <ul className="fp-warn-list">
            {warnings.map((w, i) => (
              <li key={i}>
                <button type="button" className={`fp-warn fp-warn-${w.type}`} onClick={() => onFocus(w)}>
                  <b>{{ overlap: '겹침', wall: '벽', clear: '작업 공간', height: '높이' }[w.type]}</b>{w.text}
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="fp-ok">겹치거나 작업 공간을 막는 곳이 없어요.</p>
      )}
      {tab === 'warn' && missing.length > 0 && (
        <div className="fp-missing">
          <div className="fp-label">장비 대장에 있는데 아직 안 놓은 장비</div>
          {missing.map(({ eq, need, placed }) => (
            <button key={eq.id} type="button" className="fp-missing-item" onClick={() => {
              const base = guessLibraryFromName(eq.name) || { shape: 'box', w: 1000, d: 1000, color: '#64748b', clear: { f: 600 } };
              onPlaceEquipment({ ...base, name: eq.name, equipId: eq.id });
            }}>
              {eq.name} <span>{placed}/{need}대</span> <em>+ 놓기</em>
            </button>
          ))}
        </div>
      )}
      {tab === 'count' && (
        <>
          {counts.length ? (
            <table className="fp-table">
              <tbody>
                {counts.map(([name, n]) => <tr key={name}><td>{name}</td><td>{n}개</td></tr>)}
              </tbody>
            </table>
          ) : <p className="fp-muted">아직 놓은 비품이 없어요.</p>}
          {zones.length > 0 && (
            <>
              <div className="fp-label">구역 넓이</div>
              <table className="fp-table">
                <tbody>
                  {zones.map(z => <tr key={z.id}><td>{z.name}</td><td>{areaText(z.w, z.d)}</td></tr>)}
                  <tr className="fp-total"><td>합계</td><td>{zoneTotal.toFixed(1)}㎡ ({(zoneTotal * 0.3025).toFixed(1)}평)</td></tr>
                </tbody>
              </table>
            </>
          )}
          {finishes.length > 0 && (
            <>
              <div className="fp-label">바닥 마감</div>
              <table className="fp-table">
                <tbody>
                  {finishes.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v.area.toFixed(1)}㎡{v.sized ? ` · 약 ${v.tiles.toLocaleString()}장` : ''}</td></tr>)}
                </tbody>
              </table>
            </>
          )}
          {lightRows.length > 0 && (
            <>
              <div className="fp-label">방별 밝기 (어림)</div>
              <table className="fp-table">
                <tbody>
                  {lightRows.map(({ z, L }) => <tr key={z.id} className={L.ok ? '' : 'fp-bad-row'}><td>{z.name}</td><td>{L.lux.toLocaleString()} / {L.need.toLocaleString()} lux{L.ok ? '' : ' ⚠'}</td></tr>)}
                </tbody>
              </table>
            </>
          )}
          {lineSum.length > 0 && (
            <>
              <div className="fp-label">전기·배관 길이</div>
              <table className="fp-table">
                <tbody>
                  {lineSum.map(({ t, len }) => <tr key={t.type}><td><i className="fp-line-dot" style={{ background: t.color }} /> {t.label}</td><td>{Math.round(len).toLocaleString()}mm</td></tr>)}
                </tbody>
              </table>
            </>
          )}
          {wallSum.length > 0 && (
            <>
              <div className="fp-label">벽 길이</div>
              <table className="fp-table">
                <tbody>
                  {wallSum.map(([k, v]) => <tr key={k}><td>{k}</td><td>{Math.round(v * 1000).toLocaleString()}mm</td></tr>)}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </section>
  );
}
