import { useState } from 'react';
import NeonIcon from '../common/NeonIcon';
import ModalPortal from '../common/ModalPortal';
import DailyLogForm from './DailyLogForm';
import { formatDate } from '../../utils/formatters';
import './DailyLogList.css';

const WEATHER_ICONS = {
  sunny: '☀️ 맑음',
  cloudy: '⛅ 흐림',
  rain: '🌧️ 우천',
  snow: '❄️ 강설',
};

export default function DailyLogList({ dailyLogs, onAdd, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const handleSubmit = async (data) => {
    await onAdd(data);
    setShowForm(false);
  };

  return (
    <div className="daily-log-section animate-fade-in">
      <div className="daily-log-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <NeonIcon name="log" color="rose" size="md" />
          <div>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800 }}>현장 일일 작업일지 & 이슈 노트</h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
              현장에서 핸드폰으로 그날그날의 날씨, 작업 현황, 투입 인원 및 기상/자재 이슈를 기록합니다.
            </p>
          </div>
        </div>

        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <span>+</span> 오늘 일지 작성
        </button>
      </div>

      {dailyLogs.length > 0 ? (
        <div className="daily-log-timeline stagger-children">
          {dailyLogs.map(log => (
            <div key={log.id} className="daily-log-card">
              <div className="daily-log-dot" />

              <div className="daily-log-top">
                <div className="daily-log-date-badge">
                  <span>📅 {formatDate(log.date)}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginLeft: 6 }}>
                    {WEATHER_ICONS[log.weather] || '☀️ 맑음'}
                  </span>
                </div>
                {onDelete && (
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => onDelete(log.id)}
                    title="일지 삭제"
                    style={{ color: 'var(--color-error)' }}
                  >
                    🗑️
                  </button>
                )}
              </div>

              <div className="daily-log-summary">
                {log.summary}
              </div>

              <div className="daily-log-meta-bar">
                {log.workersCount > 0 && <span>👷 인원: {log.workersCount}명</span>}
                {log.equipmentUsed && <span>🚜 장비: {log.equipmentUsed}</span>}
                <span>✍️ 작성: {log.author || '현장 관리자'}</span>
              </div>

              {log.issues && (
                <div className="daily-log-issue-box">
                  <strong>⚠️ 특이사항/지연:</strong> {log.issues}
                </div>
              )}

              {log.photos && log.photos.length > 0 && (
                <div className="daily-log-photos-grid">
                  {log.photos.map((photo, i) => (
                    <img
                      key={i}
                      src={photo}
                      alt="현장 사진"
                      className="daily-log-photo-thumb"
                      onClick={() => setSelectedPhoto(photo)}
                      title="클릭하여 확대"
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card-static" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
          <NeonIcon name="log" color="rose" size="lg" style={{ margin: '0 auto var(--space-md)' }} />
          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', marginBottom: 4 }}>
            등록된 현장 일지가 없습니다.
          </div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-md)' }}>
            현장 작업 내용, 투입 인원, 자재 입고 이슈를 날짜별로 기록해 두면 사후 공정 분석에 매우 유용합니다.
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
            <span>+</span> 첫 현장 일지 작성하기
          </button>
        </div>
      )}

      {showForm && (
        <DailyLogForm
          onSubmit={handleSubmit}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* 사진 확대 모달 */}
      {selectedPhoto && (
        <ModalPortal onClose={() => setSelectedPhoto(null)}>
          <div className="lightbox-overlay" onClick={() => setSelectedPhoto(null)}>
            <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
              <img src={selectedPhoto} alt="확대 사진" style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 8 }} />
              <button className="lightbox-close" onClick={() => setSelectedPhoto(null)}>✕</button>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
