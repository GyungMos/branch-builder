import { useMemo } from 'react';
import { formatDate, formatDateShort, getDDay } from '../../utils/formatters';
import NeonIcon from '../common/NeonIcon';
import './Timeline.css';

// 1주차당 가로 폭 (28px) -> 1달(4주)은 112px로 기존 대비 1/4로 대폭 슬림화!
const WEEK_WIDTH = 28;
const MONTH_WIDTH = WEEK_WIDTH * 4; // 112px

/**
 * 날짜를 기준 시작 년/월로부터의 '누적 주차 인덱스'로 변환
 * 1일~7일: 1주(0), 8일~14일: 2주(1), 15일~21일: 3주(2), 22일~말일: 4주(3)
 */
function getWeekIndex(dateObj, minYear, minMonth) {
  if (!dateObj) return 0;
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  if (isNaN(d.getTime())) return 0;

  const yearDiff = d.getFullYear() - minYear;
  const monthDiff = d.getMonth() - minMonth;
  const totalMonths = yearDiff * 12 + monthDiff;

  const day = d.getDate();
  let weekInMonth = 0;
  if (day <= 7) weekInMonth = 0;
  else if (day <= 14) weekInMonth = 1;
  else if (day <= 21) weekInMonth = 2;
  else weekInMonth = 3;

  return Math.max(0, totalMonths * 4 + weekInMonth);
}

export default function Timeline({ schedules = [], stages = [], onEdit, onDelete }) {
  const timelineData = useMemo(() => {
    if (schedules.length === 0) return null;

    const items = schedules.map(s => {
      const start = s.startDate?.toDate ? s.startDate.toDate() : new Date(s.startDate);
      const end = s.endDate?.toDate ? s.endDate.toDate() : (s.endDate ? new Date(s.endDate) : start);
      const stage = stages.find(st => st.id === s.stageId);
      return { ...s, startDate: start, endDate: end, stageName: stage?.name };
    });

    items.sort((a, b) => a.startDate - b.startDate);

    const rawMinDate = new Date(Math.min(...items.map(i => i.startDate)));
    const rawMaxDate = new Date(Math.max(...items.map(i => i.endDate)));

    // 시작 월의 1일, 종료 월의 말일 기준으로 월 단위 그리드 생성
    const minYear = rawMinDate.getFullYear();
    const minMonth = rawMinDate.getMonth(); // 0-indexed

    const maxYear = rawMaxDate.getFullYear();
    const maxMonth = rawMaxDate.getMonth();

    // 표시할 월 목록 생성 (최소 6개월 확보)
    const months = [];
    const curr = new Date(minYear, minMonth, 1);
    const end = new Date(maxYear, maxMonth, 1);

    while (curr <= end || months.length < 6) {
      const y = curr.getFullYear();
      const m = curr.getMonth(); // 0-11
      const mStr = String(m + 1).padStart(2, '0');
      const label = `${y}년 ${m + 1}월`;
      const shortLabel = `${m + 1}월`;

      months.push({
        year: y,
        month: m,
        label,
        shortLabel,
        key: `${y}-${mStr}`,
        monthIndex: months.length,
      });

      curr.setMonth(curr.getMonth() + 1);
      if (months.length >= 18) break; // 최대 18개월 제한
    }

    const totalWeeksCount = months.length * 4;
    const totalChartWidth = totalWeeksCount * WEEK_WIDTH;

    return {
      items,
      minYear,
      minMonth,
      months,
      totalWeeksCount,
      totalChartWidth,
    };
  }, [schedules, stages]);

  if (!timelineData || timelineData.items.length === 0) {
    return (
      <div className="empty-state">
        <NeonIcon name="calendar" size="lg" color="cyan" badge={true} style={{ margin: '0 auto 12px' }} />
        <div className="empty-state-title">일정이 없습니다</div>
        <div className="empty-state-desc">일정을 추가하면 주차별 컴팩트 타임라인에서 한눈에 확인할 수 있습니다</div>
      </div>
    );
  }

  const { items, minYear, minMonth, months, totalWeeksCount, totalChartWidth } = timelineData;

  const today = new Date();
  const todayWeekCol = getWeekIndex(today, minYear, minMonth);
  const isTodayVisible = todayWeekCol >= 0 && todayWeekCol < totalWeeksCount;

  const stageColors = [
    '#06b6d4', '#10b981', '#8b5cf6', '#f59e0b',
    '#ec4899', '#14b8a6', '#f97316', '#6366f1',
  ];

  return (
    <div className="timeline-container compact-week-timeline" id="timeline">
      {/* 상단 컴팩트 안내 바 */}
      <div className="compact-timeline-info-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <NeonIcon name="timeline" size="xs" color="cyan" badge={false} />
          <span className="compact-timeline-badge">주차별 컴팩트 간트차트</span>
          <span className="compact-timeline-sub">
            (월별 가로 폭을 대폭 축소하여 <strong>1주·2주·3주·4주</strong> 단위로 한 화면에 정돈)
          </span>
        </div>
        <span className="compact-timeline-tip">
          1칸 = 1주일 (1달 = 4칸 / 112px)
        </span>
      </div>

      <div className="timeline-scroll">
        <div className="timeline-chart compact-chart" style={{ width: `${totalChartWidth + 180}px`, minWidth: '100%' }}>
          
          {/* 헤더 영역 (좌측 빈 영역 180px + 우측 월/주차 헤더) */}
          <div className="timeline-compact-header-wrap">
            <div className="timeline-header-label-col">
              <span>작업 공정명</span>
            </div>

            <div className="timeline-header-grid-col" style={{ width: `${totalChartWidth}px` }}>
              {/* 1단: 월 헤더 (112px씩) */}
              <div className="timeline-compact-months-row">
                {months.map((m, idx) => (
                  <div
                    key={m.key}
                    className="timeline-compact-month-cell"
                    style={{ width: `${MONTH_WIDTH}px` }}
                  >
                    <span>{m.label}</span>
                  </div>
                ))}
              </div>

              {/* 2단: 1주, 2주, 3주, 4주 주차 헤더 (28px씩) */}
              <div className="timeline-compact-weeks-row">
                {months.map((m) => (
                  <div key={`weeks-${m.key}`} className="timeline-month-weeks-group" style={{ width: `${MONTH_WIDTH}px` }}>
                    <div className="timeline-week-sub-cell" style={{ width: `${WEEK_WIDTH}px` }}>1주</div>
                    <div className="timeline-week-sub-cell" style={{ width: `${WEEK_WIDTH}px` }}>2주</div>
                    <div className="timeline-week-sub-cell" style={{ width: `${WEEK_WIDTH}px` }}>3주</div>
                    <div className="timeline-week-sub-cell" style={{ width: `${WEEK_WIDTH}px` }}>4주</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 오늘 표시 세로선 */}
          {isTodayVisible && (
            <div
              className="timeline-compact-today-line"
              style={{ left: `${180 + todayWeekCol * WEEK_WIDTH + WEEK_WIDTH / 2}px` }}
            >
              <div className="timeline-compact-today-badge">오늘</div>
            </div>
          )}

          {/* 공정 행 목록 */}
          <div className="timeline-bars compact-bars">
            {items.map((item, i) => {
              const startCol = getWeekIndex(item.startDate, minYear, minMonth);
              const endCol = getWeekIndex(item.endDate || item.startDate, minYear, minMonth);
              const spanCols = Math.max(1, endCol - startCol + 1);

              const leftPx = startCol * WEEK_WIDTH;
              const widthPx = Math.max(spanCols * WEEK_WIDTH - 4, 16); // 여백 감안

              const stageIndex = stages.findIndex(s => s.id === item.stageId);
              const color = stageColors[stageIndex >= 0 ? stageIndex % stageColors.length : i % stageColors.length];

              // 날짜 포맷 (M/D 형식: 예 3/1, 6/30)
              const formatShortMD = (d) => {
                if (!d) return '';
                const date = d instanceof Date ? d : (d.toDate ? d.toDate() : new Date(d));
                return `${date.getMonth() + 1}/${date.getDate()}`;
              };

              const startText = formatShortMD(item.startDate);
              const endText = formatShortMD(item.endDate || item.startDate);
              const isSameDate = item.startDate && item.endDate && item.startDate.getTime() === item.endDate.getTime();

              return (
                <div key={item.id} className="timeline-row compact-row">
                  {/* 좌측 공정명 라벨 (라이트모드/다크모드 완벽 대응) */}
                  <div className="timeline-bar-label compact-label">
                    <span className="timeline-bar-title" title={item.title}>{item.title}</span>
                    {item.stageName && <span className="timeline-bar-stage">{item.stageName}</span>}
                  </div>

                  {/* 우측 주차별 그리드 영역 & 바 & 시작일/종료일 */}
                  <div className="timeline-bar-area compact-bar-area" style={{ width: `${totalChartWidth}px` }}>
                    {/* 세로 배경 눈금선 그리드 (월별 / 주차별) */}
                    <div className="timeline-grid-background">
                      {months.map((m) => (
                        <div key={`grid-m-${m.key}`} className="timeline-grid-month-block" style={{ width: `${MONTH_WIDTH}px` }}>
                          <div className="timeline-grid-week-col" style={{ width: `${WEEK_WIDTH}px` }} />
                          <div className="timeline-grid-week-col" style={{ width: `${WEEK_WIDTH}px` }} />
                          <div className="timeline-grid-week-col" style={{ width: `${WEEK_WIDTH}px` }} />
                          <div className="timeline-grid-week-col" style={{ width: `${WEEK_WIDTH}px` }} />
                        </div>
                      ))}
                    </div>

                    {/* 공정 막대 (Bar) */}
                    <div
                      className="timeline-bar compact-bar"
                      style={{
                        left: `${leftPx + 2}px`,
                        width: `${widthPx}px`,
                        backgroundColor: color,
                      }}
                      title={`${item.title}\n기간: ${formatDate(item.startDate)} ~ ${formatDate(item.endDate)}\n단계: ${item.stageName || '-'}`}
                    >
                      <span className="timeline-bar-text compact-bar-text">
                        {item.title}
                      </span>
                    </div>

                    {/* 공정 막대 아래 시작일/종료일 날짜 표기 (사용자 2번째 이미지 요청 사항) */}
                    <div
                      className="compact-bar-dates-track"
                      style={{
                        left: `${leftPx + 2}px`,
                        width: `${widthPx}px`,
                      }}
                    >
                      {widthPx >= 68 ? (
                        <>
                          <span className="compact-date-badge start-badge" title={`시작일: ${formatDate(item.startDate)}`}>
                            {startText}
                          </span>
                          <span className="compact-date-badge end-badge" title={`종료일: ${formatDate(item.endDate)}`}>
                            {endText}
                          </span>
                        </>
                      ) : (
                        <span className="compact-date-badge center-badge" title={`${formatDate(item.startDate)} ~ ${formatDate(item.endDate)}`}>
                          {isSameDate ? startText : `${startText}~${endText}`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 우측 액션 버튼 */}
                  <div className="timeline-bar-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => onEdit(item)}
                      title="수정"
                    >
                      <NeonIcon name="edit" size="xs" badge={false} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => { if (window.confirm('이 일정을 삭제하시겠습니까?')) onDelete(item.id); }}
                      title="삭제"
                      style={{ color: 'var(--color-error)' }}
                    >
                      <NeonIcon name="trash" size="xs" color="rose" badge={false} />
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
                  <button className="btn btn-ghost btn-sm" onClick={() => onEdit(item)} title="수정">
                    <NeonIcon name="edit" size="xs" badge={false} />
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => { if (window.confirm('이 일정을 삭제하시겠습니까?')) onDelete(item.id); }}
                    title="삭제"
                    style={{ color: 'var(--color-error)' }}
                  >
                    <NeonIcon name="trash" size="xs" color="rose" badge={false} />
                  </button>
                </div>
              </div>
              <div className="timeline-list-item-meta">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <NeonIcon name="calendar" size="xs" badge={false} />
                  {formatDateShort(item.startDate)}{item.endDate && item.endDate.getTime() !== item.startDate.getTime() ? ` ~ ${formatDateShort(item.endDate)}` : ''}
                </span>
                {item.stageName && <span className="badge badge-info">{item.stageName}</span>}
              </div>
              {item.assignee && (
                <div className="timeline-list-item-meta">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <NeonIcon name="partner" size="xs" badge={false} />
                    {item.assignee}
                  </span>
                </div>
              )}
              {item.memo && <p className="text-secondary text-sm">{item.memo}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
