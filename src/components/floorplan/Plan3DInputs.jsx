import { useRef, useState } from 'react';
import { PLAN_CATEGORIES, LOOK_OPTIONS, FACE_KEYS } from './planLibrary';
import { fileToFaceImage } from './planImages';
import { uploadFaceImage, uploadModelFile } from './planFiles';

/** 3D 모델 살펴보기 (3D 도구는 필요할 때만 불러옴) */
export async function inspectModel(url, rot = 0) {
  const { analyzeModel } = await import('./modelTools');
  return analyzeModel(url, rot);
}

/** 3D 모양 빌리기: 목록 비품 모양으로 3D에 보이기 */
export function LookSelect({ value, onChange, emptyLabel = '고르지 않음 (상자로 보여요)' }) {
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{emptyLabel}</option>
      {PLAN_CATEGORIES.map(c => {
        const list = LOOK_OPTIONS.filter(x => x.cat === c.id);
        if (!list.length) return null;
        return (
          <optgroup key={c.id} label={c.label}>
            {list.map(x => <option key={x.key} value={x.key}>{x.name}</option>)}
          </optgroup>
        );
      })}
    </select>
  );
}

/** 사진 상자: 앞·뒤·왼쪽·오른쪽·위 사진 */
export function FacePhotos({ faces = {}, onChange, demoMode }) {
  const [busy, setBusy] = useState('');
  const inputs = useRef({});
  const pick = async (key, file) => {
    if (!file) return;
    setBusy(key);
    try {
      const img = await fileToFaceImage(file);
      const url = await uploadFaceImage(img.dataUrl, demoMode);
      onChange({ ...faces, [key]: url });
    } catch (err) {
      alert(err.message || '사진을 넣지 못했어요.');
    } finally {
      setBusy('');
    }
  };
  return (
    <div className="fp-faces">
      {FACE_KEYS.map(f => (
        <div key={f.key} className={`fp-face fp-face-${f.key}`}>
          <button type="button" className="fp-face-btn" onClick={() => inputs.current[f.key]?.click()} disabled={Boolean(busy)}
            style={faces[f.key] ? { backgroundImage: `url("${faces[f.key]}")` } : undefined} title={`${f.label} 사진 넣기`}>
            {busy === f.key ? '…' : faces[f.key] ? '' : `+ ${f.label}`}
          </button>
          {faces[f.key] && <button type="button" className="fp-face-x" onClick={() => onChange({ ...faces, [f.key]: null })} aria-label={`${f.label} 사진 빼기`}>✕</button>}
          <span>{f.label}</span>
          <input ref={el => { inputs.current[f.key] = el; }} type="file" accept="image/*" hidden
            onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; pick(f.key, file); }} />
        </div>
      ))}
    </div>
  );
}

/** 3D 모델 파일(.glb) 고르기 → 올리고 크기·위에서 본 그림까지 */
export function ModelPicker({ demoMode, onPicked, label = '3D 모델 파일(.glb) 고르기' }) {
  const [busy, setBusy] = useState('');
  const ref = useRef(null);
  const pick = async (file) => {
    if (!file) return;
    try {
      setBusy(`올리는 중… (${(file.size / 1048576).toFixed(1)}MB)`);
      const model = await uploadModelFile(file, demoMode);
      setBusy('모양을 살피는 중…');
      const info = await inspectModel(model.url);
      onPicked({ model, info });
    } catch (err) {
      alert(err.message || '3D 모델을 넣지 못했어요. GLB 파일인지 확인해 주세요.');
    } finally {
      setBusy('');
    }
  };
  return (
    <div className="fp-model-pick">
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => ref.current?.click()} disabled={Boolean(busy)}>{busy || label}</button>
      <input ref={ref} type="file" accept=".glb,model/gltf-binary" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; pick(f); }} />
    </div>
  );
}
