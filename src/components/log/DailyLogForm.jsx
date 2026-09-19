import { useState, useEffect, useRef } from 'react';
import NeonIcon from '../common/NeonIcon';
import ModalPortal from '../common/ModalPortal';
import { uploadDailyLogPhoto } from '../../utils/photoUpload';

const WEATHER_OPTIONS = [
  { id: 'sunny', icon: '☀️', label: '맑음' },
  { id: 'cloudy', icon: '⛅', label: '흐림' },
  { id: 'rain', icon: '🌧️', label: '우천' },
  { id: 'snow', icon: '❄️', label: '강설' },
];

const DRAFT_KEY = 'bb_dailylog_draft';

export default function DailyLogForm({ onSubmit, onClose, initialData = null, branchId = 'default' }) {
  const isEdit = !!initialData;
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [weather, setWeather] = useState(initialData?.weather || 'sunny');
  const [summary, setSummary] = useState(initialData?.summary || '');
  const [workersCount, setWorkersCount] = useState(
    initialData?.workersCount !== undefined && initialData?.workersCount !== null
      ? String(initialData.workersCount)
      : ''
  );
  const [equipmentUsed, setEquipmentUsed] = useState(initialData?.equipmentUsed || '');
  const [issues, setIssues] = useState(initialData?.issues || '');
  const [photos, setPhotos] = useState(Array.isArray(initialData?.photos) ? [...initialData.photos] : []);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [restoredDraft, setRestoredDraft] = useState(false);

  const summaryRef = useRef(null);

  // 1. 신규 작성 시에만 임시 보관본(Draft) 복원
  useEffect(() => {
    if (isEdit) return;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.summary || draft.workersCount || draft.equipmentUsed || draft.issues) {
          if (draft.date) setDate(draft.date);
          if (draft.weather) setWeather(draft.weather);
          if (draft.summary) setSummary(draft.summary);
          if (draft.workersCount) setWorkersCount(draft.workersCount);
          if (draft.equipmentUsed) setEquipmentUsed(draft.equipmentUsed);
          if (draft.issues) setIssues(draft.issues);
          if (Array.isArray(draft.photos)) setPhotos(draft.photos);
          setRestoredDraft(true);
        }
      }
    } catch {
      // ignore
    }
  }, [isEdit]);

  // 2. 신규 작성 시에만 작성 중인 내용 실시간 임시 보관
  useEffect(() => {
    if (isEdit) return;
    if (!summary && !workersCount && !equipmentUsed && !issues) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        date,
        weather,
        summary,
        workersCount,
        equipmentUsed,
        issues,
        photos,
        updatedAt: Date.now(),
      }));
    } catch {
      // quota exceeded ignore
    }
  }, [isEdit, date, weather, summary, workersCount, equipmentUsed, issues, photos]);

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploadingPhotos(true);
    setErrorMessage('');
    const newUploaded = [];

    for (let i = 0; i < files.length; i++) {
      setUploadProgressText(`📸 사진 업로드 및 최적화 중 (${i + 1} / ${files.length})...`);
      try {
        const uploadedUrl = await uploadDailyLogPhoto(files[i], branchId);
        if (uploadedUrl) {
          newUploaded.push(uploadedUrl);
        }
      } catch (err) {
        console.warn('사진 업로드 실패:', err);
      }
    }

    if (newUploaded.length > 0) {
      setPhotos(prev => [...prev, ...newUploaded]);
    }

    setUploadingPhotos(false);
    setUploadProgressText('');
    e.target.value = '';
  };

  const handleRemovePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // 닫기 시 안전 확인 (실수로 닫혀 내용이 날아가는 현상 방지)
  const handleSafeClose = () => {
    if (isEdit) {
      const isChanged =
        summary !== (initialData?.summary || '') ||
        date !== (initialData?.date || '') ||
        weather !== (initialData?.weather || 'sunny') ||
        workersCount !== (initialData?.workersCount ? String(initialData.workersCount) : '') ||
        equipmentUsed !== (initialData?.equipmentUsed || '') ||
        issues !== (initialData?.issues || '') ||
        photos.length !== (initialData?.photos?.length || 0);

      if (isChanged) {
        const confirmed = window.confirm('수정 중인 내용이 있습니다. 저장하지 않고 닫으시겠습니까?');
        if (!confirmed) return;
      }
    } else if (summary.trim() || workersCount || equipmentUsed || issues) {
      const confirmed = window.confirm(
        '작성 중인 일지 내용이 있습니다. 창을 닫으시겠습니까?\n\n(작성하신 내용은 임시 보관되어 다시 열 때 복원됩니다)'
      );
      if (!confirmed) return;
    }
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (uploadingPhotos) {
      alert('사진 업로드가 진행 중입니다. 잠시만 기다려 주세요.');
      return;
    }

    // 필수 항목 검사 및 명확한 피드백
    if (!summary.trim()) {
      setErrorMessage('오늘 진행한 주요 공정 내용을 작성해 주세요.');
      summaryRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        date,
        weather,
        summary: summary.trim(),
        workersCount: workersCount ? Number(workersCount) : 0,
        equipmentUsed: equipmentUsed.trim(),
        issues: issues.trim(),
        photos,
      });

      // 저장 성공 시 임시 보관본 청소 (신규 작성인 경우에만)
      if (!isEdit) {
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.error('일지 저장 오류:', err);
      setErrorMessage('일지 저장 중 오류가 발생했습니다: ' + (err.message || '다시 시도해 주세요.'));
      alert('일지 저장 중 오류가 발생했습니다: ' + (err.message || '다시 시도해 주세요.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalPortal onClose={handleSafeClose}>
      <div className="modal-backdrop" onClick={handleSafeClose} />
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NeonIcon name="log" color="rose" size="sm" />
            <h2 className="modal-title">
              {isEdit ? '현장 일일 작업일지 수정' : '현장 일일 작업일지 작성'}
            </h2>
          </div>
          <button type="button" className="modal-close" onClick={handleSafeClose} aria-label="닫기">✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* 임시 보관본 복원 안내 (신규 작성 시에만) */}
            {!isEdit && restoredDraft && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px',
                fontSize: 12,
                color: '#34d399',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>💾 이전에 작성 중이던 일지 내용이 복원되었습니다.</span>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem(DRAFT_KEY);
                    setSummary('');
                    setWorkersCount('');
                    setEquipmentUsed('');
                    setIssues('');
                    setPhotos([]);
                    setRestoredDraft(false);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-secondary)',
                    fontSize: 11,
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  초기화
                </button>
              </div>
            )}

            {/* 에러 메시지 알림 */}
            {errorMessage && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                fontSize: 13,
                color: '#f87171',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span>⚠️ {errorMessage}</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label htmlFor="log-date">작업 일자 *</label>
                <input
                  id="log-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>날씨 *</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {WEATHER_OPTIONS.map(w => (
                    <button
                      key={w.id}
                      type="button"
                      className={`btn btn-sm ${weather === w.id ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setWeather(w.id)}
                      style={{ flex: 1, padding: '4px 6px', fontSize: 13 }}
                    >
                      {w.icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="log-summary">오늘 진행한 주요 공정 내용 *</label>
              <textarea
                ref={summaryRef}
                id="log-summary"
                value={summary}
                onChange={(e) => {
                  setSummary(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="예: 2주식 리프트 바닥 앙카 타설 완료, 천장 LED 조명 배선 작업 진행"
                rows={3}
                required
                autoFocus
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label htmlFor="log-workers">투입 인원 (명)</label>
                <input
                  id="log-workers"
                  type="number"
                  value={workersCount}
                  onChange={(e) => setWorkersCount(e.target.value)}
                  placeholder="예: 4"
                  min="0"
                />
              </div>

              <div className="form-group">
                <label htmlFor="log-equip">투입 중장비 / 공구</label>
                <input
                  id="log-equip"
                  type="text"
                  value={equipmentUsed}
                  onChange={(e) => setEquipmentUsed(e.target.value)}
                  placeholder="예: 미니굴삭기 1대, 용접기"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="log-issues" style={{ color: '#f87171' }}>⚠️ 특이사항 / 지연 이슈 (선택)</label>
              <input
                id="log-issues"
                type="text"
                value={issues}
                onChange={(e) => setIssues(e.target.value)}
                placeholder="예: 오후 갑작스런 우천으로 외부 도색 작업 내일로 연기"
              />
            </div>

            {/* 현장 사진 첨부 */}
            <div className="form-group">
              <label>📸 현장 사진 첨부</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                disabled={uploadingPhotos}
                style={{ fontSize: 12 }}
              />

              {uploadingPhotos && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 8,
                  padding: '8px 12px',
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12,
                  color: '#38bdf8'
                }}>
                  <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  <span>{uploadProgressText}</span>
                </div>
              )}

              {photos.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {photos.map((src, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img src={src} alt="현장 미리보기" style={{ width: 64, height: 64, borderRadius: 6, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.15)' }} />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(i)}
                        style={{
                          position: 'absolute', top: -5, right: -5, background: '#ef4444',
                          color: 'white', borderRadius: '50%', width: 20, height: 20,
                          border: 'none', fontSize: 11, cursor: 'pointer', lineHeight: '20px',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.5)'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={handleSafeClose} disabled={loading || uploadingPhotos}>
              취소
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || uploadingPhotos}
              style={{ minWidth: 120 }}
            >
              {loading ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  저장 중...
                </span>
              ) : uploadingPhotos ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  사진 준비 중...
                </span>
              ) : (
                isEdit ? '수정 내용 저장' : '일지 저장'
              )}
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}
