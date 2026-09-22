import { useMemo, useState } from 'react';
import NeonIcon from '../common/NeonIcon';
import { formatDateShort } from '../../utils/formatters';
import './MasterScheduleTable.css';

// 설계사 표준 신축공사 업무 일정표 프리셋 (수원 장안구 이목동 신축공사 실무 양식 100% 일치)
export const DEFAULT_ARCHITECT_SCHEDULE = [
  // 1. 건축허가
  {
    id: 'arch-1',
    category: '건축허가',
    categoryTheme: 'coral',
    title: '1. 허가도서 작성 및 허가접수',
    startDate: '2026-07-20',
    endDate: '2026-08-07',
    milestoneText: '허가접수 7/21',
    color: '#ef4444',
    note: '- 장안구청 건축과',
  },
  {
    id: 'arch-2',
    category: '건축허가',
    categoryTheme: 'coral',
    title: '2. 유관부서 협의',
    startDate: '2026-08-01',
    endDate: '2026-08-14',
    milestoneText: '',
    color: '#ef4444',
    note: '- 인허가 기간은 관련부서 일정에 의하여 변경될 수 있음',
  },
  {
    id: 'arch-3',
    category: '건축허가',
    categoryTheme: 'coral',
    title: '3. 협의의견 검토 및 보완',
    startDate: '2026-08-01',
    endDate: '2026-08-14',
    milestoneText: '',
    color: '#ef4444',
    note: '',
  },
  {
    id: 'arch-4',
    category: '건축허가',
    categoryTheme: 'coral',
    title: '4. 건축허가 완료',
    startDate: '2026-08-08',
    endDate: '2026-08-14',
    milestoneText: '허가완료 8/4',
    color: '#ef4444',
    note: '- 제세공과금(등록면허세, 국민주택채권)\n- 설계,감리계약서 6/17',
  },

  // 2. 착공접수
  {
    id: 'arch-5',
    category: '착공접수',
    categoryTheme: 'sky',
    title: '1. 착공 관련 회의 (건축주, 시공자, 설계자)',
    startDate: '2026-08-08',
    endDate: '2026-08-14',
    milestoneText: '8/12 회의',
    color: '#0284c7',
    note: '',
  },
  {
    id: 'arch-6',
    category: '착공접수',
    categoryTheme: 'sky',
    title: '2. 도로점용허가 (보차도점용 - 차량 진출입로)',
    startDate: '2026-08-15',
    endDate: '2026-09-07',
    milestoneText: '안전건설과/녹지과',
    color: '#f59e0b',
    note: '- 보차도점용허가(장안구청 안전건설과)\n- 가로수 수목 이식·제거 협의(녹지과)',
  },
  {
    id: 'arch-7',
    category: '착공접수',
    categoryTheme: 'sky',
    title: '3. 공사도면작성',
    startDate: '2026-08-08',
    endDate: '2026-08-21',
    milestoneText: '',
    color: '#0284c7',
    note: '',
  },
  {
    id: 'arch-8',
    category: '착공접수',
    categoryTheme: 'sky',
    title: '4. 시공사 선정 / 시공사 착공서류 준비',
    startDate: '2026-08-15',
    endDate: '2026-09-14',
    milestoneText: '시공사선정 착공서류준비',
    color: '#ef4444',
    note: '- 시공사선정 일정에 따라 착공접수시기 변경될 수 있음',
  },
  {
    id: 'arch-9',
    category: '착공접수',
    categoryTheme: 'sky',
    title: '5. 경계측량 / 지반조사',
    startDate: '2026-08-15',
    endDate: '2026-09-14',
    milestoneText: '경계측량실시/지반조사',
    color: '#0284c7',
    note: '- 경계측량성과도\n- 지반조사보고서',
  },
  {
    id: 'arch-10',
    category: '착공접수',
    categoryTheme: 'sky',
    title: '6. 착공접수',
    startDate: '2026-09-15',
    endDate: '2026-09-21',
    milestoneText: '착공접수',
    color: '#0284c7',
    note: '',
  },

  // 3. 착공 및 준공
  {
    id: 'arch-11',
    category: '착공 및 준공',
    categoryTheme: 'emerald',
    title: '1. 토목공사',
    startDate: '2026-09-22',
    endDate: '2026-10-07',
    milestoneText: '기초 및 PIT타설',
    color: '#84cc16',
    note: '- 공사일정은 시공사 선정후 세부조정 필요함',
  },
  {
    id: 'arch-12',
    category: '착공 및 준공',
    categoryTheme: 'emerald',
    title: '2. 철근콘크리트공사',
    startDate: '2026-10-01',
    endDate: '2026-10-21',
    milestoneText: '2층바닥타설',
    color: '#84cc16',
    note: '',
  },
  {
    id: 'arch-13',
    category: '착공 및 준공',
    categoryTheme: 'emerald',
    title: '3. 철골공사',
    startDate: '2026-10-15',
    endDate: '2026-10-28',
    milestoneText: '',
    color: '#84cc16',
    note: '',
  },
  {
    id: 'arch-14',
    category: '착공 및 준공',
    categoryTheme: 'emerald',
    title: '4. 외벽 / 지붕 판넬공사',
    startDate: '2026-10-22',
    endDate: '2026-11-14',
    milestoneText: '',
    color: '#84cc16',
    note: '',
  },
  {
    id: 'arch-15',
    category: '착공 및 준공',
    categoryTheme: 'emerald',
    title: '5. 창호공사',
    startDate: '2026-11-08',
    endDate: '2026-11-21',
    milestoneText: '',
    color: '#84cc16',
    note: '',
  },
  {
    id: 'arch-16',
    category: '착공 및 준공',
    categoryTheme: 'emerald',
    title: '6. 기계 / 전기 설비 공사',
    startDate: '2026-10-08',
    endDate: '2026-11-28',
    milestoneText: '',
    color: '#84cc16',
    note: '',
  },
  {
    id: 'arch-17',
    category: '착공 및 준공',
    categoryTheme: 'emerald',
    title: '7. 수장공사 / 방수공사',
    startDate: '2026-11-15',
    endDate: '2026-12-14',
    milestoneText: '',
    color: '#84cc16',
    note: '',
  },
  {
    id: 'arch-18',
    category: '착공 및 준공',
    categoryTheme: 'emerald',
    title: '8. 부대토목공사',
    startDate: '2026-12-01',
    endDate: '2026-12-21',
    milestoneText: '',
    color: '#84cc16',
    note: '',
  },
  {
    id: 'arch-19',
    category: '착공 및 준공',
    categoryTheme: 'emerald',
    title: '9. 준공준비 / 준공 (사용승인)',
    startDate: '2026-12-01',
    endDate: '2027-01-21',
    milestoneText: '준공준비 / 접수 / 완료',
    color: '#84cc16',
    note: '- 준공제출 서류 준비일정에 따라 준공(사용승인) 완료시기 변경될 수 있음',
  },
];

/**
 * 특정 Date 객체로부터 'YYYY-MM'과 '주차 (1~4)' 인덱스를 추출
 * 1일~7일: 1주차, 8일~14일: 2주차, 15일~21일: 3주차, 22일~말일: 4주차 (실무 표준 4주 그리드)
 */
function getMonthAndWeek(dateObj) {
  if (!dateObj) return null;
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  if (isNaN(d.getTime())) return null;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const monthKey = `${year}-${month}`;
  const day = d.getDate();

  let week = 1;
  if (day <= 7) week = 1;
  else if (day <= 14) week = 2;
  else if (day <= 21) week = 3;
  else week = 4;

  return { monthKey, week, year, monthNumber: d.getMonth() + 1 };
}

export default function MasterScheduleTable({
  schedules = [],
  stages = [],
  onEdit,
  onDelete,
  onAddPreset,
}) {
  // 실제 표시할 데이터 조합:
  // 사용자가 이미 등록한 schedules가 있다면 이를 분석하여 표시하고,
  // 없을 경우 설계사 표준 일정표를 바로 미리보기 형태로 렌더링
  const rawList = useMemo(() => {
    if (schedules && schedules.length > 0) {
      return schedules.map(s => {
        const start = s.startDate?.toDate ? s.startDate.toDate() : new Date(s.startDate);
        const end = s.endDate?.toDate ? s.endDate.toDate() : (s.endDate ? new Date(s.endDate) : start);
        const stage = stages.find(st => st.id === s.stageId);

        // 카테고리 추론 (단계명 또는 제목에 기반)
        let category = s.category || stage?.name || '일반 공정';
        let categoryTheme = 'sky';
        if (category.includes('허가') || category.includes('설계') || category.includes('인허가')) {
          category = '건축허가';
          categoryTheme = 'coral';
        } else if (category.includes('착공접수') || category.includes('도면') || category.includes('측량')) {
          category = '착공접수';
          categoryTheme = 'sky';
        } else if (category.includes('토목') || category.includes('준공') || category.includes('공사') || category.includes('착공 및 준공')) {
          category = '착공 및 준공';
          categoryTheme = 'emerald';
        }

        return {
          id: s.id,
          category,
          categoryTheme,
          title: s.title,
          startDate: start,
          endDate: end,
          milestoneText: s.milestoneText || s.assignee || '',
          color: s.color || (categoryTheme === 'coral' ? '#ef4444' : categoryTheme === 'emerald' ? '#84cc16' : '#0284c7'),
          note: s.memo || s.note || '',
        };
      });
    }
    return DEFAULT_ARCHITECT_SCHEDULE;
  }, [schedules, stages]);

  // 그리드에 표시할 월(Month) 목록 생성 (기본: 2026-07 ~ 2027-01 등 7개월, 4주차씩 총 28개 주차 컬럼)
  const timelineMonths = useMemo(() => {
    const defaultMonths = [
      { key: '2026-07', label: '2026년 07월' },
      { key: '2026-08', label: '08월' },
      { key: '2026-09', label: '09월' },
      { key: '2026-10', label: '10월' },
      { key: '2026-11', label: '11월' },
      { key: '2026-12', label: '12월' },
      { key: '2027-01', label: '2027년 1월' },
    ];

    // 데이터가 있는 경우 최소/최대 월 계산
    const dates = [];
    rawList.forEach(item => {
      if (item.startDate) dates.push(new Date(item.startDate));
      if (item.endDate) dates.push(new Date(item.endDate));
    });

    if (dates.length === 0) return defaultMonths;

    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));

    const months = [];
    const curr = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

    // 최소 6개월 이상 표시되도록 확보
    while (curr <= end || months.length < 6) {
      const year = curr.getFullYear();
      const mNum = curr.getMonth() + 1;
      const key = `${year}-${String(mNum).padStart(2, '0')}`;
      const label = (months.length === 0 || mNum === 1) ? `${year}년 ${String(mNum).padStart(2, '0')}월` : `${String(mNum).padStart(2, '0')}월`;
      months.push({ key, label, year, monthNumber: mNum });
      curr.setMonth(curr.getMonth() + 1);
      if (months.length >= 12) break; // 최대 12개월 제한
    }

    return months;
  }, [rawList]);

  // 전체 주차 컬럼(Flat Array): [ { monthKey, week, colIndex } ]
  const totalWeeks = useMemo(() => {
    const list = [];
    let idx = 0;
    timelineMonths.forEach(m => {
      for (let w = 1; w <= 4; w++) {
        list.push({
          monthKey: m.key,
          week: w,
          colIndex: idx++,
        });
      }
    });
    return list;
  }, [timelineMonths]);

  // 대분류별 그룹핑 (건축허가, 착공접수, 착공 및 준공 등)
  const groupedData = useMemo(() => {
    const groups = {};
    rawList.forEach(item => {
      const cat = item.category || '공정 일정';
      if (!groups[cat]) {
        groups[cat] = {
          categoryName: cat,
          theme: item.categoryTheme || 'sky',
          items: [],
        };
      }
      groups[cat].items.push(item);
    });
    return Object.values(groups);
  }, [rawList]);

  // 아이템의 시작주차(startColIndex)와 종료주차(endColIndex) 계산
  const calculateItemSpan = (item) => {
    const startInfo = getMonthAndWeek(item.startDate);
    const endInfo = getMonthAndWeek(item.endDate || item.startDate);

    if (!startInfo) return null;

    let startCol = totalWeeks.findIndex(w => w.monthKey === startInfo.monthKey && w.week === startInfo.week);
    let endCol = endInfo ? totalWeeks.findIndex(w => w.monthKey === endInfo.monthKey && w.week === endInfo.week) : startCol;

    if (startCol === -1) {
      // 시작일이 표시 월보다 이전인 경우 첫번째 컬럼으로
      startCol = 0;
    }
    if (endCol === -1) {
      // 종료일이 표시 월보다 이후인 경우 마지막 컬럼으로
      endCol = totalWeeks.length - 1;
    }

    if (endCol < startCol) endCol = startCol;

    return {
      startCol,
      span: endCol - startCol + 1,
    };
  };

  const isDefaultPreset = schedules.length === 0;

  return (
    <div className="architect-gantt-wrapper" id="architect-gantt">
      {/* 마스터 스케줄 상단 정보 바 */}
      <div className="architect-gantt-header-card">
        <div className="architect-header-title-wrap">
          <span className="architect-badge">설계사 표준 마스터 공정표</span>
          <h4 className="architect-project-title">
            신축공사 주차별(1~4주) 업무 공정 일정표
          </h4>
          <span className="architect-project-sub">
            월별 4주차 컴팩트 그리드로 가로 스크롤 없이 신축 전 공정을 한눈에 파악합니다.
          </span>
        </div>

        <div className="architect-header-actions">
          {isDefaultPreset && onAddPreset && (
            <button
              type="button"
              className="btn btn-primary btn-sm architect-preset-btn"
              onClick={onAddPreset}
              title="설계사 표준 19개 공정 데이터를 내 일정으로 바로 불러와 등록합니다"
            >
              <NeonIcon name="sync" size="xs" color="cyan" badge={false} />
              <span>표준 공정 템플릿 불러오기</span>
            </button>
          )}
        </div>
      </div>

      {/* 설계사 스타일 마스터 테이블 */}
      <div className="architect-table-scroll-container">
        <table className="architect-table">
          <thead>
            {/* 1단 헤더: 작업 분류 | 월별 헤더 (4칸 병합) | 비고 */}
            <tr className="architect-head-row-top">
              <th colSpan="2" className="col-category-header">
                작업 분류
              </th>
              {timelineMonths.map((m, mIdx) => (
                <th key={m.key || mIdx} colSpan="4" className="col-month-header">
                  {m.label}
                </th>
              ))}
              <th className="col-note-header" rowSpan="2">
                비고
              </th>
            </tr>

            {/* 2단 헤더: 각 월 하위의 1, 2, 3, 4 주차 헤더 */}
            <tr className="architect-head-row-bottom">
              <th className="col-sub-type">구분</th>
              <th className="col-sub-name">세부 작업 공정명</th>
              {totalWeeks.map((w, wIdx) => (
                <th key={wIdx} className={`col-week-cell ${w.week === 1 ? 'week-month-start' : ''}`}>
                  {w.week}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {groupedData.map((group, gIdx) => {
              const rowCount = group.items.length;

              return group.items.map((item, rIdx) => {
                const spanInfo = calculateItemSpan(item);

                return (
                  <tr key={item.id || `${gIdx}-${rIdx}`} className="architect-body-row">
                    {/* 대분류 세로 병합 셀 (Rowspan) */}
                    {rIdx === 0 && (
                      <td
                        rowSpan={rowCount}
                        className={`architect-category-cell theme-${group.theme}`}
                      >
                        <div className="architect-vertical-text">
                          {group.categoryName}
                        </div>
                      </td>
                    )}

                    {/* 세부 공정명 */}
                    <td className="architect-task-name-cell" title={item.title}>
                      <span className="task-title-text">{item.title}</span>
                      {onEdit && (
                        <button
                          type="button"
                          className="architect-inline-edit-btn"
                          onClick={() => onEdit(item)}
                          title="일정 수정"
                        >
                          <NeonIcon name="edit" size="xs" badge={false} />
                        </button>
                      )}
                    </td>

                    {/* 주차별 그리드 셀들 (28칸) */}
                    {totalWeeks.map((week, cIdx) => {
                      const isCovered = spanInfo && cIdx >= spanInfo.startCol && cIdx < (spanInfo.startCol + spanInfo.span);
                      const isFirstCovered = spanInfo && cIdx === spanInfo.startCol;
                      const isMonthStart = week.week === 1;

                      return (
                        <td
                          key={cIdx}
                          className={`architect-grid-cell ${isMonthStart ? 'week-month-start' : ''} ${isCovered ? 'active-grid-cell' : ''}`}
                        >
                          {/* 막대(Bar) 렌더링 - 시작 컬럼에서 가로 span만큼 절대/상대 위치로 펼쳐짐 */}
                          {isFirstCovered && (
                            <div
                              className={`architect-bar theme-${group.theme}`}
                              style={{
                                width: `calc(${spanInfo.span * 100}% + ${(spanInfo.span - 1) * 1}px)`,
                                backgroundColor: item.color || undefined,
                              }}
                              title={`${item.title} (${formatDateShort(item.startDate)} ~ ${formatDateShort(item.endDate)})\n${item.milestoneText || ''}`}
                            >
                              {item.milestoneText && (
                                <span className="architect-bar-milestone-text">
                                  {item.milestoneText}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* 비고 컬럼 */}
                    <td className="architect-note-cell">
                      <span className="architect-note-text">{item.note || '-'}</span>
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>

      {/* 범례 및 안내 */}
      <div className="architect-gantt-footer">
        <div className="architect-legend-wrap">
          <span className="legend-item">
            <span className="legend-dot coral" />
            <span>건축허가 (인허가/심의)</span>
          </span>
          <span className="legend-item">
            <span className="legend-dot sky" />
            <span>착공접수 (점용/측량/시공사)</span>
          </span>
          <span className="legend-item">
            <span className="legend-dot emerald" />
            <span>착공 및 준공 (본공사/사용승인)</span>
          </span>
        </div>
        <span className="architect-footer-tip">
          💡 각 행의 연필 아이콘을 클릭하여 일자 및 마일스톤 비고를 바로 수정할 수 있습니다.
        </span>
      </div>
    </div>
  );
}
