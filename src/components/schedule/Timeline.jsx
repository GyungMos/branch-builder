import { useMemo } from 'react';
import { formatDate, formatDateShort, getDDay } from '../../utils/formatters';
import './Timeline.css';

export default function Timeline({ schedules, stages, onEdit, onDelete }) {
  const timelineData = useMemo(() => {
    if (schedules.length === 0) return null;

    const items = schedules.map(s => {
      const start = s.startDate?.toDate ? s.startDate.toDate() : new Date(s.startDate);
      const end = s.endDate?.toDate ? s.endDate.toDate() : (s.endDate ? new Date(s.endDate) : start);
      const stage = stages.find(st => st.id === s.stageId);
      return { ...s, startDate: start, endDate: end, stageName: stage?.name };
    });

    items.sort((a, b) => a.startDate - b.startDate);

    const minDate = new Date(Math.min(...items.map(i => i.startDate)));
    const maxDate = new Date(Math.max(...items.map(i => i.endDate)));

    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 7);

    const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));

    const months = [];
    const current = new Date(minDate);
    current.setDate(1);
    while (current <= maxDate) {
      const offset = Math.ceil((current - minDate) / (1000 * 60 * 60 * 24));
      months.push({
        label: current.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short' }),
        offset: Math.max(0, offset),
      });
      current.setMonth(current.getMonth() + 1);
    }

    return { items, minDate, maxDate, totalDays, months };
  }, [schedules, stages]);

  if (!timelineData || timelineData.items.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📅</div>
        <div className="empty-state-title">일정이 없습니다</div>
        <div className="empty-state-desc">일정을 추가하면 타임라인에서 한눈에 확인할 수 있습니다</div>
      </div>
    );
  }

  const { items, minDate, totalDays, months } = timelineData;
  const dayWidth = 12;
  const timelineWidth = totalDays * dayWidth;

  const today = new Date();
  const todayOffset = Math.ceil((today - minDate) / (1000 * 60 * 60 * 24));

  const stageColors = [
    '#10b981', '#06b6d4', '#8b5cf6', '#f59e0b',
    '#ec4899', '#14b8a6', '#f97316', '#6366f1',
  ];

  return (
    <div className="timeline-container" id="timeline">
      <div className="timeline-scroll">
        <div className="timeline-chart" style={{ width: `${timelineWidth}px`, minWidth: '100%' }}>
          <div className="timeline-months">
            {months.map((m, i) => (
              <div key={i} className="timeline-month" style={{ left: `${m.offset * dayWidth}px` }}>
                {m.label}
              </div>
            ))}
          </div>

          {todayOffset >= 0 && todayOffset <= totalDays && (
            <div className="timeline-today" style={{ left: `${todayOffset * dayWidth}px` }}>
              <div className="timeline-today-line" />
              <span className="timeline-today-label">오늘</span>
            </div>
          )}

          <div className="timeline-bars">
            {items.map((item, i) => {
              const startOffset = Math.ceil((item.startDate - minDate) / (1000 * 60 * 60 * 24));
              const duration = Math.max(1, Math.ceil((item.endDate - item.startDate) / (1000 * 60 * 60 * 24)));
              const stageIndex = stages.findIndex(s => s.id === item.stageId);
              const color = stageColors[stageIndex >= 0 ? stageIndex % stageColors.length : i % stageColors.length];

              return (
                <div key={item.id} className="timeline-row">
                  <div className="timeline-bar-label">
                    <span className="timeline-bar-title">{item.title}</span>
                    {item.stageName && <span className="timeline-bar-stage">{item.stageName}</span>}
                  </div>
                  <div className="timeline-bar-area" style={{ width: `${timelineWidth}px` }}>
                    <div
                      className="timeline-bar"
                      style={{
                        left: `${startOffset * dayWidth}px`,
                        width: `${Math.max(duration * dayWidth, 8)}px`,
                        backgroundColor: color,
                      }}
                      title={`${item.title}\n${formatDate(item.startDate)} ~ ${formatDate(item.endDate)}`}
                    >
                      <span className="timeline-bar-text">{item.title}</span>
                    </div>
                  </div>
                  <div className="timeline-bar-actions">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => onEdit(item)}
                      title="수정"
                    >
                      ✏️
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => { if (window.confirm('이 일정을 삭제하시겠습니까?')) onDelete(item.id); }}
                      title="삭제"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 모바일 리스트 뷰 */}
      <div className="timeline-list-mobile">
        {items.map(item => {
          const dday = getDDay(item.startDate);
          return (
            <div key={item.id} className="timeline-list-item card-static">
              <div className="timeline-list-item-header">
                <div>
                  <h4>{item.title}</h4>
                  {dday && <span className={`dday-badge ${dday.isPast ? 'past' : dday.days <= 7 ? 'soon' : ''}`}>{dday.label}</span>}
                </div>
                <div className="timeline-list-item-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => onEdit(item)}>✏️</button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => { if (window.confirm('이 일정을 삭제하시겠습니까?')) onDelete(item.id); }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <div className="timeline-list-item-meta">
                <span>📅 {formatDateShort(item.startDate)}{item.endDate && item.endDate.getTime() !== item.startDate.getTime() ? ` ~ ${formatDateShort(item.endDate)}` : ''}</span>
                {item.stageName && <span className="badge badge-info">{item.stageName}</span>}
              </div>
              {item.assignee && <div className="timeline-list-item-meta"><span>👤 {item.assignee}</span></div>}
              {item.memo && <p className="text-secondary text-sm">{item.memo}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
