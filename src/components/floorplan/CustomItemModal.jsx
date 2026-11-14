import { useState } from 'react';
import ModalPortal from '../common/ModalPortal';
import { BASIC_SHAPES, PLAN_LIBRARY, ITEM_COLORS, hasFaces } from './planLibrary';
import { ShapeThumb } from './planShapes';
import { fileToItemImage } from './planImages';
import { LookSelect, FacePhotos, ModelPicker } from './Plan3DInputs';

const MODES = [
  { id: 'basic', label: '기본 모양' },
  { id: 'borrow', label: '비슷한 모양 빌리기' },
  { id: 'draw', label: '점 찍어 그리기' },
  { id: 'image', label: '그림 올리기' },
  { id: 'photo', label: '사진으로 입체' },
  { id: 'model', label: '3D 모델 파일' },
];

/**
 * 직접 만들기: 기본 모양 / 있는 모양 빌리기 / 점 찍어 그리기 / 위에서 본 그림 /
 * 사진으로 입체(앞·뒤·옆·위 사진을 상자에 붙임) / 3D 모델 파일(GLB)
 */
export default function CustomItemModal({ onClose, onCreate, onDrawOnCanvas, demoMode }) {
  const [mode, setMode] = useState('basic');
  const [look, setLook] = useState(null);
  const [faces, setFaces] = useState({});
  const [model, setModel] = useState(null);
  const [name, setName] = useState('');
  const [shape, setShape] = useState('box');
  const [borrow, setBorrow] = useState('sink');
  const [w, setW] = useState(1000);
  const [d, setD] = useState(600);
  const [h, setH] = useState('');
  const [front, setFront] = useState(600);
  const [color, setColor] = useState('#8b5cf6');
  const [img, setImg] = useState(null);
  const [imgRatio, setImgRatio] = useState(1);
  const [busy, setBusy] = useState(false);
  const [save, setSave] = useState(true);

  const base = mode === 'borrow' ? PLAN_LIBRARY.find(x => x.key === borrow) : null;
  const preview = {
    shape: mode === 'image' || mode === 'model' ? 'image' : mode === 'photo' ? 'photobox' : mode === 'borrow' ? base?.shape : shape,
    w: Number(w) || 1000, d: Number(d) || 600, color: mode === 'borrow' ? base?.color : color, img, faces,
  };

  const onModel = ({ model: m, info }) => {
    setModel(m);
    setImg(info.top || null);
    if (info.w > 0 && info.d > 0) { setW(info.w); setD(info.d); setH(info.h || ''); }
    if (!name) setName(m.name.replace(/\.[^.]+$/, ''));
  };

  const pickBorrow = (key) => {
    const b = PLAN_LIBRARY.find(x => x.key === key);
    setBorrow(key);
    if (b) { setW(b.w); setD(b.d); setColor(b.color); setFront(b.clear?.f || 0); if (!name) setName(b.name); }
  };

  const onImage = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await fileToItemImage(file);
      setImg(r.dataUrl);
      setImgRatio(r.h / r.w);
      setD(Math.round((Number(w) || 1000) * (r.h / r.w)));
      if (!name) setName(file.name.replace(/\.[^.]+$/, ''));
    } catch (err) {
      alert(err.message || '그림을 읽지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (mode === 'draw') { onDrawOnCanvas(); return; }
    const tpl = {
      name: name.trim() || '새 비품',
      shape: preview.shape || 'box',
      w: Number(w) || 1000,
      d: Number(d) || 600,
      h: Number(h) || (base?.h || 0),
      color: preview.color || color,
      clear: mode === 'borrow' && base ? { ...base.clear, f: Number(front) || 0 } : { f: Number(front) || 0 },
      kind: base?.kind || 'equip',
    };
    if (base?.lift) tpl.lift = base.lift;
    if (mode === 'image') {
      if (!img) { alert('그림을 먼저 골라 주세요.'); return; }
      tpl.img = img;
    }
    if (mode === 'borrow') tpl.look = borrow;
    if ((mode === 'basic' || mode === 'image') && look) tpl.look = look;
    if (mode === 'photo') {
      if (!hasFaces({ faces })) { alert('사진을 한 장 이상 넣어 주세요.'); return; }
      tpl.faces = faces;
      tpl.h = Number(h) || 1000;
    }
    if (mode === 'model') {
      if (!model) { alert('3D 모델 파일을 먼저 골라 주세요.'); return; }
      tpl.model = model; tpl.modelRot = 0;
      tpl.shape = img ? 'image' : 'box';
      if (img) tpl.img = img;
    }
    onCreate(tpl, save);
  };

  return (
    <ModalPortal onClose={onClose}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal fp-modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h2 className="modal-title">직접 만들기</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="fp-btn-row">
              {MODES.map(m => (
                <button key={m.id} type="button" className={`filter-pill${mode === m.id ? ' on' : ''}`} onClick={() => setMode(m.id)}>{m.label}</button>
              ))}
            </div>

            {mode === 'draw' ? (
              <div className="fp-draw-help">
                <p>배치도 위에서 모서리를 차례로 눌러 테두리를 그려요. 실제 크기 그대로 그려지니 도면 축척을 먼저 맞춰 두면 좋아요.</p>
                <ol>
                  <li>모서리를 하나씩 누르기 (가로·세로는 저절로 똑바로)</li>
                  <li>첫 점을 다시 누르거나 '모양 완성' 누르기</li>
                  <li>오른쪽 칸에서 이름·색 정하고 '내 비품에 저장'</li>
                </ol>
              </div>
            ) : (
              <>
                {mode === 'basic' && (
                  <div className="fp-btn-row">
                    {BASIC_SHAPES.map(s => (
                      <button key={s.shape} type="button" className={`fp-shape-pick${shape === s.shape ? ' on' : ''}`} onClick={() => setShape(s.shape)}>
                        <ShapeThumb item={{ shape: s.shape, w: 1000, d: 700, color }} size={44} />
                        <span>{s.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                {mode === 'borrow' && (
                  <label className="fp-field">
                    <span>어떤 모양을 빌릴까요?</span>
                    <select value={borrow} onChange={(e) => pickBorrow(e.target.value)}>
                      {PLAN_LIBRARY.filter(x => x.kind !== 'text').map(x => <option key={x.key} value={x.key}>{x.name}</option>)}
                    </select>
                  </label>
                )}
                {mode === 'image' && (
                  <div className="fp-field">
                    <span>위에서 본 그림 (제조사 카탈로그·사양서의 평면 그림)</span>
                    <input type="file" accept="image/*" onChange={(e) => onImage(e.target.files?.[0])} />
                    {busy && <small>그림을 줄이는 중…</small>}
                  </div>
                )}
                {mode === 'photo' && (
                  <div className="fp-field">
                    <span>면마다 사진을 넣으면 3D에서 상자 겉에 붙어요. 정면에서 반듯하게 찍고, 비품만 보이게 잘라 넣으면 가장 비슷해요. 없는 면은 색으로 칠해요.</span>
                    <FacePhotos faces={faces} onChange={setFaces} demoMode={demoMode} />
                  </div>
                )}
                {mode === 'model' && (
                  <div className="fp-field">
                    <span>제조사에서 받은 3D 파일이나 SketchUp 3D Warehouse·Sketchfab 같은 곳에서 받은 모델을 GLB로 올려요. 크기는 파일에서 읽어 채우니 사양서와 다르면 고쳐 주세요.</span>
                    <ModelPicker demoMode={demoMode} onPicked={onModel} label={model ? `다른 파일 고르기 (지금: ${model.name})` : undefined} />
                    {model && <small>{model.name} · {(model.size / 1048576).toFixed(1)}MB</small>}
                  </div>
                )}
                {(mode === 'basic' || mode === 'image') && (
                  <label className="fp-field">
                    <span>3D에서 보일 모양 (고르면 크기·색은 그대로, 모양만 그 비품처럼)</span>
                    <LookSelect value={look} onChange={setLook} />
                  </label>
                )}

                <label className="fp-field">
                  <span>이름</span>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 벽걸이 세면대, ㄷ자 카운터" />
                </label>
                <div className="fp-grid2">
                  <label className="fp-num"><span>가로</span><span className="fp-num-box"><input type="number" min="50" step="10" value={w} onChange={(e) => { setW(e.target.value); if (mode === 'image' && img) setD(Math.round(Number(e.target.value) * imgRatio)); }} /><em>mm</em></span></label>
                  <label className="fp-num"><span>세로</span><span className="fp-num-box"><input type="number" min="50" step="10" value={d} onChange={(e) => setD(e.target.value)} /><em>mm</em></span></label>
                  <label className="fp-num"><span>높이</span><span className="fp-num-box"><input type="number" min="0" step="10" value={h} onChange={(e) => setH(e.target.value)} placeholder={mode === 'photo' ? '1000' : '몰라도 됨'} /><em>mm</em></span></label>
                  <label className="fp-num"><span>앞 작업 공간</span><span className="fp-num-box"><input type="number" min="0" step="50" value={front} onChange={(e) => setFront(e.target.value)} /><em>mm</em></span></label>
                </div>
                {mode !== 'borrow' && mode !== 'image' && mode !== 'model' && (
                  <div className="fp-colors">
                    {ITEM_COLORS.map(c => <button key={c} type="button" className={`fp-color${color === c ? ' on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />)}
                    <label className={`fp-color fp-color-custom${ITEM_COLORS.includes(color) ? '' : ' on'}`} title="직접 고르기" style={ITEM_COLORS.includes(color) ? undefined : { background: color }}>
                      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="색 직접 고르기" />
                    </label>
                  </div>
                )}
                <div className="fp-preview">
                  <ShapeThumb item={preview} size={120} />
                  <span>{Number(w) || 0} × {Number(d) || 0} mm</span>
                </div>
                <label className="fp-check"><input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} /> 내 비품에 저장 (다른 지점 배치에서도 쓰기)</label>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>닫기</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{mode === 'draw' ? '배치도에서 그리기' : '만들어 놓기'}</button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}
