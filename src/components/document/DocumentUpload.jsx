import { useState, useRef } from 'react';
import { DOCUMENT_CATEGORIES } from '../../utils/constants';
import './DocumentUpload.css';

export default function DocumentUpload({ stages, onUpload, onClose }) {
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('etc');
  const [stageId, setStageId] = useState('');
  const [memo, setMemo] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      if (!name) setName(selected.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(file, {
        name: name.trim() || file.name,
        category,
        stageId: stageId || null,
        memo: memo.trim(),
      }, (p) => setProgress(p));
      onClose();
    } catch (err) {
      console.error('Upload error:', err);
      setUploading(false);
    }
  };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal" id="document-upload-modal">
        <div className="modal-header">
          <h2 className="modal-title">📁 서류 업로드</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* 파일 선택 영역 */}
            {!file ? (
              <div className="upload-area">
                <div className="upload-buttons">
                  <button
                    type="button"
                    className="upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <span className="upload-btn-icon">📎</span>
                    <span>파일 선택</span>
                  </button>
                  <button
                    type="button"
                    className="upload-btn"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <span className="upload-btn-icon">📷</span>
                    <span>사진 촬영</span>
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.hwp,.dwg"
                  style={{ display: 'none' }}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  onChange={handleFileChange}
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                />
                <p className="upload-hint">이미지, PDF, 문서, 도면 파일 업로드 가능</p>
              </div>
            ) : (
              <div className="upload-preview">
                <div className="upload-file-info">
                  <span className="upload-file-icon">
                    {file.type?.startsWith('image/') ? '🖼️' : '📄'}
                  </span>
                  <div>
                    <div className="upload-file-name">{file.name}</div>
                    <div className="text-xs text-tertiary">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setFile(null); setName(''); }}>
                    변경
                  </button>
                </div>
                {uploading && (
                  <div className="upload-progress">
                    <div className="progress-bar">
                      <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-xs text-accent">{Math.round(progress)}%</span>
                  </div>
                )}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="doc-name">서류명</label>
              <input
                id="doc-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="서류 이름을 입력하세요"
              />
            </div>

            <div className="form-group">
              <label htmlFor="doc-category">카테고리</label>
              <select id="doc-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                {DOCUMENT_CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
                ))}
              </select>
            </div>

            {stages.length > 0 && (
              <div className="form-group">
                <label htmlFor="doc-stage">연결 단계</label>
                <select id="doc-stage" value={stageId} onChange={(e) => setStageId(e.target.value)}>
                  <option value="">선택 안함</option>
                  {stages.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="doc-memo">메모</label>
              <textarea
                id="doc-memo"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="메모를 입력하세요"
                rows={2}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
            <button type="submit" className="btn btn-primary" disabled={!file || uploading}>
              {uploading
                ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                : '업로드'
              }
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
