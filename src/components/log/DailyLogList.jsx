import { useState, useEffect } from 'react';
import NeonIcon from '../common/NeonIcon';
import ModalPortal from '../common/ModalPortal';
import DailyLogForm from './DailyLogForm';
import DailyLogEntryForm from './DailyLogEntryForm';
import { formatDate } from '../../utils/formatters';
import './DailyLogList.css';

const WEATHER_CONFIG = {
  sunny: { label: '맑음', iconName: 'sun', color: 'amber' },
  cloudy: { label: '흐림', iconName: 'cloud', color: 'cyan' },
  rain: { label: '우천', iconName: 'rain', color: 'blue' },
  snow: { label: '강설', iconName: 'snow', color: 'cyan' },
};

const STATUS_BADGES = {
  resolved: { label: '조치 완료', iconName: 'check', color: 'emerald', className: 'status-resolved' },
  progress: { label: '진행 중', iconName: 'sync', color: 'cyan', className: 'status-progress' },
  pending: { label: '대기 중', iconName: 'history', color: 'amber', className: 'status-pending' },
};

export default function DailyLogList({
  branchId = 'default',
  dailyLogs = [],
  onAdd,
  onUpdate,
  onDelete,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingLog, setEditingLog] = useState(null);

  // 오후 작업 / 조치 사항 모달 상태
  const [entryModal, setEntryModal] = useState({
    isOpen: false,
    logId: null,
    targetLogDate: '',
    initialData: null,
  });

  // 사진 뷰어 상태
  const [viewer, setViewer] = useState({
    isOpen: false,
    items: [], // [{ url, label, summary, date }]
    currentIndex: 0,
  });

  const handleAddSubmit = async (data) => {
    if (onAdd) {
      await onAdd(data);
    }
    setShowForm(false);
  };

  const handleEditSubmit = async (data) => {
    if (onUpdate && editingLog) {
      await onUpdate(editingLog.id, data);
    }
    setEditingLog(null);
  };

  const handleEntrySubmit = async (entryData) => {
    if (!entryModal.logId) return;
    if (entryModal.initialData) {
      if (onUpdateEntry) {
        await onUpdateEntry(entryModal.logId, entryModal.initialData.id, entryData);
      }
    } else {
      if (onAddEntry) {
        await onAddEntry(entryModal.logId, entryData);
      }
    }
    setEntryModal({ isOpen: false, logId: null, targetLogDate: '', initialData: null });
  };

  // 특정 일지의 모든 사진(오전 + 오후 추가 조치들)을 통합 배열로 생성
  const buildPhotoList = (log) => {
    const list = [];
    if (Array.isArray(log.photos)) {
      log.photos.forEach((url, i) => {
        list.push({
          url,
          label: `[오전/기본 현황] 사진 ${i + 1}`,
          summary: log.summary,
          date: log.date,
        });
      });
    }
    if (Array.isArray(log.entries)) {
      log.entries.forEach(entry => {
        if (Array.isArray(entry.photos)) {
          entry.photos.forEach((url, i) => {
            list.push({
              url,
              label: `[${entry.timeTag || '오후 조치'}] 사진 ${i + 1}`,
              summary: entry.summary,
              date: log.date,
            });
          });
        }
      });
    }
    return list;
  };

  // 사진 클릭 시 통합 뷰어 오픈
  const openViewer = (log, targetUrl) => {
    const allPhotos = buildPhotoList(log);
    if (!allPhotos.length) return;
    const initialIndex = allPhotos.findIndex(p => p.url === targetUrl);
    setViewer({
      isOpen: true,
      items: allPhotos,
      currentIndex: initialIndex >= 0 ? initialIndex : 0,
    });
  };

  const closeViewer = () => {
    setViewer(prev => ({ ...prev, isOpen: false }));
  };

  const prevPhoto = () => {
    setViewer(prev => {
      const len = prev.items.length;
      if (len <= 1) return prev;
      return {
        ...prev,
        currentIndex: (prev.currentIndex - 1 + len) % len,
      };
    });
  };

  const nextPhoto = () => {
    setViewer(prev => {
      const len = prev.items.length;
      if (len <= 1) return prev;
      return {
        ...prev,
        currentIndex: (prev.currentIndex + 1) % len,
      };
    });
  };

  const selectPhoto = (idx) => {
    setViewer(prev => ({
      ...prev,
      currentIndex: idx,
    }));
  };

  // 뷰어 열림 상태에서 키보드 좌우 방향키로 사진 넘기기
  useEffect(() => {
    if (!viewer.isOpen) return;
    const handleKeyNav = (e) => {
      if (e.key === 'ArrowLeft') {
        prevPhoto();
      } else if (e.key === 'ArrowRight') {
        nextPhoto();
      }
    };
    window.addEventListener('keydown', handleKeyNav);
    return () => window.removeEventListener('keydown', handleKeyNav);
  }, [viewer.isOpen, viewer.items.length]);

  const handleDeleteLog = async (id, dateStr) => {
    if (window.confirm(`${dateStr} 현장 일지를 삭제하시겠습니까?\n작성된 오후 추가 조치 내역과 현장 사진도 모두 함께 삭제됩니다.`)) {
      try {
        await onDelete(id);
      } catch (err) {
        alert('삭제 중 오류가 발생했습니다: ' + err.message);
      }
    }
  };

  const handleDeleteEntry = async (logId, entryId) => {
    if (window.confirm('이 조치 사항 기록을 삭제하시겠습니까?')) {
      try {
        await onDeleteEntry(logId, entryId);
      } catch (err) {
        alert('조치 사항 삭제 중 오류가 발생했습니다: ' + err.message);
      }
    }
  };

  return (
    <div className="daily-log-section animate-fade-in" id="daily-log-section">
      {/* 일지 섹션 헤더 */}
      <div className="daily-log-header">
        <div className="daily-log-title-wrap">
          <NeonIcon name="log" color="rose" size="md" />
          <div>
            <h3 className="daily-log-title">현장 일일 작업일지 & 이슈 노트</h3>
            <p className="daily-log-desc">
              오전에 작성한 작업 내용과 발생 이슈를 보존하면서, 오후에 진행한 조치 사항 및 추가 작업을 이어서 기록합니다.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setEditingLog(null);
            setIsFormOpen(true);
          }}
          id="btn-new-daily-log"
        >
          + 오늘 일지 작성
        </button>
      </div>

      {/* 일지 목록 피드 */}
      {dailyLogs.length > 0 ? (
        <div className="daily-log-feed">
          {dailyLogs.map(log => {
            const hasEntries = Array.isArray(log.entries) && log.entries.length > 0;
            const weatherConf = WEATHER_CONFIG[log.weather] || WEATHER_CONFIG.sunny;

            return (
              <div key={log.id} className="daily-log-card" id={`daily-log-${log.id}`}>
                {/* 카드 상단 날짜 및 기본 액션 */}
                <div className="daily-log-top">
                  <div className="daily-log-date-badge">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <NeonIcon name="calendar" size="xs" color="cyan" badge={false} />
                      {formatDate(log.date)}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <NeonIcon name={weatherConf.iconName} size="xs" color={weatherConf.color} badge={false} />
                      <span>{weatherConf.label}</span>
                    </span>
                    {log.updatedAt && (
                      <span className="daily-log-edited-tag" title="수정됨">
                        (수정됨)
                      </span>
                    )}
                  </div>

                  <div className="daily-log-actions">
                    {onUpdate && (
                      <button
                        className="btn-ghost btn-sm daily-log-edit-btn"
                        onClick={() => setEditingLog(log)}
                        title="기본 일지 내용 수정"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                      >
                        <NeonIcon name="edit" size="xs" badge={false} />
                        <span>기본 일지 수정</span>
                      </button>
                    )}
                    {onDelete && (
                      <button
                        className="btn-ghost btn-sm daily-log-delete-btn"
                        onClick={() => {
                          if (window.confirm('해당 일지와 모든 오후 조치 기록이 완전히 삭제됩니다. 삭제하시겠습니까?')) {
                            onDelete(log.id);
                          }
                        }}
                        title="일지 전체 삭제"
                        style={{ color: 'var(--color-error)' }}
                      >
                        <NeonIcon name="trash" size="xs" color="rose" badge={false} />
                      </button>
                    )}
                  </div>
                </div>

                {/* 1차: 오전 / 기초 작업 현황 블록 */}
                <div className={`daily-log-block base-block ${log.photos && log.photos.length > 0 ? 'has-photos-layout' : ''}`}>
                  <div className="daily-log-block-header">
                    <span className="daily-log-block-tag morning-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <NeonIcon name="history" size="xs" color="cyan" badge={false} />
                      [오전 / 기본 작업 현황]
                    </span>
                  </div>

                  <div className="daily-log-body-split">
                    {/* 좌측 컬럼: 작업 내용 & 인포 칩 & 특이사항 */}
                    <div className="daily-log-info-col">
                      <div className="daily-log-summary">
                        {log.summary}
                      </div>

                      <div className="daily-log-meta-bar">
                        {log.workersCount > 0 && (
                          <span className="daily-log-meta-chip">
                            <NeonIcon name="partner" size="xs" color="cyan" badge={false} />
                            <span>작업 인원: <strong>{log.workersCount}명</strong></span>
                          </span>
                        )}
                        {log.equipmentUsed && (
                          <span className="daily-log-meta-chip">
                            <NeonIcon name="equipment" size="xs" color="violet" badge={false} />
                            <span>투입 장비: <strong>{log.equipmentUsed}</strong></span>
                          </span>
                        )}
                        <span className="daily-log-meta-chip">
                          <NeonIcon name="edit" size="xs" color="emerald" badge={false} />
                          <span>작성자: <strong>{log.author || '현장 관리자'}</strong></span>
                        </span>
                      </div>

                      {log.issues && (
                        <div className="daily-log-issue-box">
                          <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <NeonIcon name="alert" size="xs" color="amber" badge={false} />
                            발생 특이사항 / 지연:
                          </strong>
                          <span className="daily-log-issue-text">{log.issues}</span>
                        </div>
                      )}
                    </div>

                    {/* 우측 컬럼: 현장 사진 와이드 갤러리 프리뷰 */}
                    {log.photos && log.photos.length > 0 && (
                      <div className="daily-log-photos-col">
                        <div className="daily-log-photos-label">
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <NeonIcon name="photo" size="xs" color="rose" badge={false} />
                            오전 현장 사진 ({log.photos.length}장)
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>* 클릭 시 큰 화면 뷰어</span>
                        </div>
                        <div className="daily-log-photos-grid">
                          {log.photos.map((photo, i) => (
                            <div
                              key={i}
                              className="daily-log-photo-item"
                              onClick={() => openViewer(log, photo)}
                              title={`사진 ${i + 1} 크게 보기 (클릭)`}
                            >
                              <img src={photo} alt={`현장 사진 ${i + 1}`} className="daily-log-photo-thumb" />
                              <span className="daily-log-photo-overlay-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <NeonIcon name="search" size="xs" color="cyan" badge={false} />
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2차: 오후 추가 작업 & 조치 사항 타임라인 (이전 기록 보존 + 누적 갱신) */}
                {hasEntries && (
                  <div className="daily-log-entries-timeline">
                    {log.entries.map((entry, idx) => {
                      const statusBadge = STATUS_BADGES[entry.status] || STATUS_BADGES.resolved;
                      const entryHasPhotos = entry.photos && entry.photos.length > 0;

                      return (
                        <div key={entry.id || idx} className={`daily-log-entry-card ${entryHasPhotos ? 'has-photos-layout' : ''}`}>
                          <div className="daily-log-entry-line-dot" />

                          <div className="daily-log-entry-top">
                            <div className="daily-log-entry-header-left">
                              <span className="daily-log-entry-tag">
                                {entry.timeTag || '오후 조치 / 추가 작업'}
                              </span>
                              {entry.time && (
                                <span className="daily-log-entry-time" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <NeonIcon name="history" size="xs" color="cyan" badge={false} />
                                  {entry.time}
                                </span>
                              )}
                              <span className={`daily-log-entry-status-badge ${statusBadge.className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <NeonIcon name={statusBadge.iconName} size="xs" color={statusBadge.color} badge={false} />
                                <span>{statusBadge.label}</span>
                              </span>
                            </div>

                            <div className="daily-log-entry-actions">
                              <button
                                type="button"
                                className="btn-edit-entry"
                                onClick={() => setEntryModal({
                                  isOpen: true,
                                  logId: log.id,
                                  targetLogDate: log.date,
                                  initialData: entry,
                                })}
                                title="조치 내용 수정"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              >
                                <NeonIcon name="edit" size="xs" color="cyan" badge={false} />
                                <span>수정</span>
                              </button>
                              <button
                                type="button"
                                className="btn-del-entry"
                                onClick={() => handleDeleteEntry(log.id, entry.id)}
                                title="삭제"
                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <NeonIcon name="trash" size="xs" color="danger" badge={false} />
                              </button>
                            </div>
                          </div>

                          <div className="daily-log-body-split">
                            {/* 좌측: 작업 요약 및 메타 칩 */}
                            <div className="daily-log-info-col">
                              <div className="daily-log-entry-summary">{entry.summary}</div>

                              <div className="daily-log-meta-bar">
                                {entry.workersCount && (
                                  <span className="daily-log-meta-chip">
                                    <NeonIcon name="partner" size="xs" color="cyan" badge={false} />
                                    <span>추가인원: <strong>{entry.workersCount}명</strong></span>
                                  </span>
                                )}
                                {entry.equipmentUsed && (
                                  <span className="daily-log-meta-chip">
                                    <NeonIcon name="equipment" size="xs" color="emerald" badge={false} />
                                    <span>장비/자재: <strong>{entry.equipmentUsed}</strong></span>
                                  </span>
                                )}
                                {entry.author && (
                                  <span className="daily-log-meta-chip">
                                    <NeonIcon name="edit" size="xs" color="amber" badge={false} />
                                    <span>담당: <strong>{entry.author}</strong></span>
                                  </span>
                                )}
                              </div>

                              {entry.issues && (
                                <div className="daily-log-issue-box">
                                  <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                    <NeonIcon name="alert" size="xs" color="rose" badge={false} />
                                    추가 메모:
                                  </strong>
                                  <span className="daily-log-issue-text">{entry.issues}</span>
                                </div>
                              )}
                            </div>

                            {/* 우측: 조치 현장 사진 */}
                            {entryHasPhotos && (
                              <div className="daily-log-photos-col">
                                <div className="daily-log-photos-label">
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                    <NeonIcon name="photo" size="xs" color="rose" badge={false} />
                                    조치 현장 사진 ({entry.photos.length}장)
                                  </span>
                                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>* 클릭 시 큰 화면 뷰어</span>
                                </div>
                                <div className="daily-log-photos-grid">
                                  {entry.photos.map((photo, pIdx) => (
                                    <div
                                      key={pIdx}
                                      className="daily-log-photo-item"
                                      onClick={() => openViewer(log, photo)}
                                      title={`조치 사진 ${pIdx + 1} 크게 보기 (클릭)`}
                                    >
                                      <img src={photo} alt={`조치 사진 ${pIdx + 1}`} className="daily-log-photo-thumb" />
                                      <span className="daily-log-photo-overlay-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <NeonIcon name="search" size="xs" color="cyan" badge={false} />
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 카드 하단: 오후 추가 작업 / 조치 사항 등록 버튼 */}
                <div className="daily-log-footer-actions">
                  <button
                    type="button"
                    className="btn-add-entry"
                    onClick={() => setEntryModal({
                      isOpen: true,
                      logId: log.id,
                      targetLogDate: log.date,
                      initialData: null,
                    })}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <NeonIcon name="plus" size="xs" color="cyan" badge={false} />
                    <span>오후 작업 / 문제 조치 사항 이어서 추가</span>
                  </button>
                </div>
              </div>
            );
          })}
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

      {/* 기본 일지 신규 작성 모달 */}
      {showForm && (
        <DailyLogForm
          branchId={branchId}
          onSubmit={handleAddSubmit}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* 기본 일지 수정 모달 */}
      {editingLog && (
        <DailyLogForm
          branchId={branchId}
          initialData={editingLog}
          onSubmit={handleEditSubmit}
          onClose={() => setEditingLog(null)}
        />
      )}

      {/* 오후 작업 / 조치 사항 등록 및 수정 모달 */}
      {entryModal.isOpen && (
        <DailyLogEntryForm
          branchId={branchId}
          initialData={entryModal.initialData}
          targetLogDate={entryModal.targetLogDate}
          onSubmit={handleEntrySubmit}
          onClose={() => setEntryModal({ isOpen: false, logId: null, targetLogDate: '', initialData: null })}
        />
      )}

      {/* 고화질 사진 뷰어 라이트박스 & 좌우 슬라이더 & 하단 썸네일 리스트 */}
      {viewer.isOpen && viewer.items.length > 0 && (
        <ModalPortal onClose={closeViewer}>
          <div className="log-lightbox-overlay" onClick={closeViewer}>
            <div className="log-lightbox-container" onClick={(e) => e.stopPropagation()}>
              {/* 상단 컨트롤 헤더 */}
              <div className="log-lightbox-header">
                <div className="log-lightbox-title-wrap">
                  <span className="log-lightbox-date" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <NeonIcon name="calendar" size="xs" color="cyan" badge={false} />
                    <span>{formatDate(viewer.items[viewer.currentIndex]?.date)}</span>
                  </span>
                  <span className="log-lightbox-stage-tag">{viewer.items[viewer.currentIndex]?.label}</span>
                  <span className="log-lightbox-summary">{viewer.items[viewer.currentIndex]?.summary}</span>
                </div>
                <div className="log-lightbox-header-right">
                  <span className="log-lightbox-counter">
                    {viewer.currentIndex + 1} / {viewer.items.length}
                  </span>
                  <button
                    type="button"
                    className="log-lightbox-close"
                    onClick={closeViewer}
                    title="닫기 (Esc)"
                    aria-label="닫기"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* 중앙 이미지 스테이지 & 좌우 이동 버튼 */}
              <div className="log-lightbox-stage">
                {viewer.items.length > 1 && (
                  <button
                    type="button"
                    className="log-lightbox-nav prev"
                    onClick={prevPhoto}
                    title="이전 사진 (←)"
                    aria-label="이전 사진"
                  >
                    ‹
                  </button>
                )}

                <div className="log-lightbox-img-wrapper">
                  <img
                    src={viewer.items[viewer.currentIndex]?.url}
                    alt={`현장 사진 ${viewer.currentIndex + 1}`}
                    className="log-lightbox-main-img"
                  />
                </div>

                {viewer.items.length > 1 && (
                  <button
                    type="button"
                    className="log-lightbox-nav next"
                    onClick={nextPhoto}
                    title="다음 사진 (→)"
                    aria-label="다음 사진"
                  >
                    ›
                  </button>
                )}
              </div>

              {/* 하단 썸네일 스트립 (리스트업) */}
              {viewer.items.length > 1 && (
                <div className="log-lightbox-thumbs-bar">
                  <div className="log-lightbox-thumbs-list">
                    {viewer.items.map((item, idx) => (
                      <button
                        type="button"
                        key={idx}
                        className={`log-lightbox-thumb-btn ${idx === viewer.currentIndex ? 'active' : ''}`}
                        onClick={() => selectPhoto(idx)}
                        title={`${item.label} (클릭하여 이동)`}
                      >
                        <img src={item.url} alt={`썸네일 ${idx + 1}`} />
                        <span className="log-lightbox-thumb-num">{idx + 1}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
