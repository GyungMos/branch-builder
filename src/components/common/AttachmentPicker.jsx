import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { uploadAttachment } from '../../utils/fileUpload';
import './AttachmentPicker.css';

const isImage = (f) => /\.(jpe?g|png|gif|webp|heic|bmp)$/i.test(f?.name || '') || String(f?.url || '').startsWith('data:image');

/**
 * 사진·파일 붙이기 (영수증·견적서·계약서 등): 사진 찍기 / 파일 고르기, 붙인 것 목록과 빼기
 * files: [{ id, name, url, storagePath }]
 */
export default function AttachmentPicker({ files = [], onChange, branchId, folder, label = '사진·파일 첨부' }) {
  const { demoMode } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const add = async (e) => {
    const list = Array.from(e.target.files || []);
    e.target.value = '';
    if (!list.length) return;
    setUploading(true);
    setError('');
    try {
      const uploaded = [];
      for (const f of list) uploaded.push(await uploadAttachment(f, { branchId, folder, demoMode }));
      onChange([...files, ...uploaded]);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="attach-picker">
      <span className="attach-label">{label}</span>
      {files.length > 0 && (
        <ul className="attach-list">
          {files.map(f => (
            <li key={f.id || f.url}>
              <a href={f.url} target="_blank" rel="noreferrer" title={f.name}>
                {isImage(f) ? <img src={f.url} alt={f.name} /> : <span className="attach-icon" aria-hidden="true">📄</span>}
                <span className="attach-name">{f.name}</span>
              </a>
              <button type="button" className="attach-remove" aria-label={`${f.name} 빼기`} onClick={() => onChange(files.filter(x => x !== f))}>✕</button>
            </li>
          ))}
        </ul>
      )}
      <div className="attach-buttons">
        <label className={`btn btn-secondary btn-sm ${uploading ? 'disabled' : ''}`}>
          📷 사진 찍기
          <input type="file" accept="image/*" capture="environment" onChange={add} disabled={uploading} hidden />
        </label>
        <label className={`btn btn-secondary btn-sm ${uploading ? 'disabled' : ''}`}>
          📎 파일 고르기
          <input type="file" multiple onChange={add} disabled={uploading} hidden />
        </label>
        {uploading && <span className="attach-status">올리는 중…</span>}
      </div>
      {error && <p className="attach-error">{error}</p>}
    </div>
  );
}

/** 목록에서 보여 줄 작은 첨부 표시 (사진은 작은 그림, 파일은 📄) */
export function AttachmentChips({ files = [] }) {
  if (!files.length) return null;
  return (
    <span className="attach-chips">
      {files.map(f => (
        <a key={f.id || f.url} href={f.url} target="_blank" rel="noreferrer" title={f.name} onClick={(e) => e.stopPropagation()}>
          {isImage(f) ? <img src={f.url} alt={f.name} /> : <span aria-hidden="true">📄</span>}
        </a>
      ))}
    </span>
  );
}
