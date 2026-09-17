import { useState } from 'react';
import NeonIcon from '../common/NeonIcon';
import ModalPortal from '../common/ModalPortal';

const WEATHER_OPTIONS = [
  { id: 'sunny', icon: '☀️', label: '맑음' },
  { id: 'cloudy', icon: '⛅', label: '흐림' },
  { id: 'rain', icon: '🌧️', label: '우천' },
  { id: 'snow', icon: '❄️', label: '강설' },
];

export default function DailyLogForm({ onSubmit, onClose }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [weather, setWeather] = useState('sunny');
  const [summary, setSummary] = useState('');
  const [workersCount, setWorkersCount] = useState('');
  const [equipmentUsed, setEquipmentUsed] = useState('');
  const [issues, setIssues] = useState('');
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setPhotos(prev => [...prev, reader.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemovePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!summary.trim()) return;

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
    } catch (err) {
      console.error(err);
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
            <h2 className="modal-title">현장 일일 작업일지 작성</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
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
                id="log-summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
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
                style={{ fontSize: 12 }}
              />
              {photos.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {photos.map((src, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img src={src} alt="현장 미리보기" style={{ width: 60, height: 60, borderRadius: 6, objectFit: 'cover' }} />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(i)}
                        style={{
                          position: 'absolute', top: -4, right: -4, background: '#ef4444',
                          color: 'white', borderRadius: '50%', width: 18, height: 18,
                          border: 'none', fontSize: 10, cursor: 'pointer', lineHeight: '18px'
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
            <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !summary.trim()}>
              {loading ? '등록 중...' : '일지 저장'}
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}
