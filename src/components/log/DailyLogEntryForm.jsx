import { useState, useRef } from 'react';
import NeonIcon from '../common/NeonIcon';
import ModalPortal from '../common/ModalPortal';
import { uploadDailyLogPhoto } from '../../utils/photoUpload';

const TAG_PRESETS = [
  { id: 'afternoon', label: '🛠️ 오후 추가 작업', icon: '🛠️' },
  { id: 'resolved', label: '✅ 문제 조치 / 해결', icon: '✅' },
  { id: 'night', label: '🌙 야간 / 잔여 공정', icon: '🌙' },
  { id: 'issue', label: '⚠️ 긴급 추가 이슈', icon: '⚠️' },
];

const STATUS_OPTIONS = [
  { id: 'resolved', label: '✅ 조치 완료 (정상 공정)', color: '#34d399' },
  { id: 'progress', label: '🔄 진행 / 양생 관찰 중', color: '#38bdf8' },
  { id: 'pending', label: '⏳ 추가 자재 / 일정 대기', color: '#fbbf24' },
];

export default function DailyLogEntryForm({
  onSubmit,
  onClose,
  initialData = null,
  targetLogDate = '',
  branchId = 'default',
}) {
  const isEdit = !!initialData;

  const now = new Date();
  const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const [timeTag, setTimeTag] = useState(initialData?.timeTag || '✅ 문제 조치 / 해결');
  const [time, setTime] = useState(initialData?.time || defaultTime);
  const [summary, setSummary] = useState(initialData?.summary || '');
  const [workersCount, setWorkersCount] = useState(
    initialData?.workersCount !== undefined && initialData?.workersCount !== null
      ? String(initialData.workersCount)
      : ''
  );
  const [equipmentUsed, setEquipmentUsed] = useState(initialData?.equipmentUsed || '');
  const [status, setStatus] = useState(initialData?.status || 'resolved');
  const [issues, setIssues] = useState(initialData?.issues || '');
  const [photos, setPhotos] = useState(Array.isArray(initialData?.photos) ? [...initialData.photos] : []);

  // 사진 업로드 진행 상태 (모바일 누락 방지 핵심)
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const summaryRef = useRef(null);

  // 모바일 사진 초고속 병렬 업로드 핸들러
  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploadingPhotos(true);
    setErrorMessage('');
    setUploadProgressText(`📸 사진 ${files.length}장 최적화 처리 중...`);

    try {
      const uploadPromises = files.map((file) => uploadDailyLogPhoto(file, branchId));
      const results = await Promise.all(uploadPromises);
      const validUrls = results.filter((url) => Boolean(url));

      if (validUrls.length > 0) {
        setPhotos((prev) => [...prev, ...validUrls]);
      }
    } catch (err) {
      console.warn('사진 처리 오류:', err);
    } finally {
      setUploadingPhotos(false);
      setUploadProgressText('');
      e.target.value = '';
    }
  };

  const handleRemovePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (uploadingPhotos) {
      alert('사진 업로드가 진행 중입니다. 잠시만 기다려 주세요.');
      return;
    }

    setErrorMessage('');

    if (!summary.trim()) {
      setErrorMessage('오후 진행 내용 또는 문제 조치 사항을 작성해 주세요.');
      summaryRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        timeTag: timeTag.trim(),
        time,
        summary: summary.trim(),
        workersCount: workersCount ? Number(workersCount) : 0,
        equipmentUsed: equipmentUsed.trim(),
        status,
        issues: issues.trim(),
        photos,
      });
      onClose();
    } catch (err) {
      console.error('추가 기록 저장 오류:', err);
      setErrorMessage(err.message || '저장 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalPortal onClose={onClose}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NeonIcon name="log" color="rose" size="sm" />
            <div>
              <h2 className="modal-title">
                {isEdit ? '오후 작업 / 조치 사항 수정' : '오후 추가 작업 및 조치 사항 기록'}
              </h2>
              {targetLogDate && (
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  📅 대상 일지: {targetLogDate}
                </div>
              )}
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
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

            {/* 기록 구분 선택 퀵 버튼 */}
            <div className="form-group">
              <label>기록 구분 태그</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {TAG_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`btn btn-sm ${timeTag === preset.label ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => setTimeTag(preset.label)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={timeTag}
                onChange={(e) => setTimeTag(e.target.value)}
                placeholder="직접 태그 입력 가능 (예: 15:30 배관 보강 완료)"
                required
              />
            </div>

            {/* 시간 및 조치 상태 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12 }}>
              <div className="form-group">
                <label htmlFor="entry-time">기록 시각</label>
                <input
                  id="entry-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>조치 / 진행 상태</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  style={{ fontSize: 12 }}
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 주요 조치 및 추가 작업 내용 */}
            <div className="form-group">
              <label htmlFor="entry-summary">오후 진행 내용 및 문제 조치 사항 *</label>
              <textarea
                ref={summaryRef}
                id="entry-summary"
                value={summary}
                onChange={(e) => {
                  setSummary(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="예: 오전에 발생했던 배관 균열 부위 신품 교체 후 몰탈 타설 완료. 누수 테스트 통과 및 정상 양생 시작."
                rows={3}
                required
                autoFocus
              />
            </div>

            {/* 추가 투입 인원 & 장비 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label htmlFor="entry-workers">추가 투입 인원 (명)</label>
                <input
                  id="entry-workers"
                  type="number"
                  value={workersCount}
                  onChange={(e) => setWorkersCount(e.target.value)}
                  placeholder="예: 2"
                  min="0"
                />
              </div>

              <div className="form-group">
                <label htmlFor="entry-equip">추가 장비 / 자재</label>
                <input
                  id="entry-equip"
                  type="text"
                  value={equipmentUsed}
                  onChange={(e) => setEquipmentUsed(e.target.value)}
                  placeholder="예: 보수용 배관 1본, 급결제"
                />
              </div>
            </div>

            {/* 추가 특이사항 / 잔여 이슈 */}
            <div className="form-group">
              <label htmlFor="entry-issues" style={{ color: '#fca5a5' }}>
                ⚠️ 추가 특이사항 / 후속 메모 (선택)
              </label>
              <input
                id="entry-issues"
                type="text"
                value={issues}
                onChange={(e) => setIssues(e.target.value)}
                placeholder="예: 내일 오전 09시 양생 경도 재확인 필요"
              />
            </div>

            {/* 조치 현장 사진 첨부 */}
            <div className="form-group">
              <label>📸 조치 현장 사진 첨부</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                disabled={uploadingPhotos}
                style={{ fontSize: 12 }}
              />

              {/* 사진 업로드 중 알림 바 */}
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
                      <img
                        src={src}
                        alt="조치 사진 미리보기"
                        style={{ width: 64, height: 64, borderRadius: 6, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.15)' }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(i)}
                        style={{
                          position: 'absolute', top: -5, right: -5, background: '#ef4444',
                          color: 'white', borderRadius: '50%', width: 20, height: 20,
                          border: 'none', fontSize: 11, cursor: 'pointer', lineHeight: '20px',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.5)'
                        }}
                        title="사진 삭제"
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
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading || uploadingPhotos}>
              취소
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || uploadingPhotos}
              style={{ minWidth: 140 }}
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
                isEdit ? '조치 사항 수정 저장' : '+ 조치 사항 등록'
              )}
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}
