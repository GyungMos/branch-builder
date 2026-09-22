import { useState, useMemo, useEffect } from 'react';
import NeonIcon from '../common/NeonIcon';
import ModalPortal from '../common/ModalPortal';
import { formatDate, formatDateShort, formatCurrency, formatFileSize, getDDay } from '../../utils/formatters';
import './BranchTimelineFeed.css';

// 날짜를 YYYY-MM-DD 문자열 및 Date 객체로 안전하게 정규화하는 헬퍼
function normalizeDate(val) {
  if (!val) return null;
  let d;
  if (val instanceof Date) {
    d = val;
  } else if (typeof val === 'object' && typeof val.toDate === 'function') {
    d = val.toDate();
  } else if (typeof val === 'string' || typeof val === 'number') {
    d = new Date(val);
  } else {
    return null;
  }
  if (isNaN(d.getTime())) return null;

  // YYYY-MM-DD
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  return { dateStr, dateObj: d };
}

const WEATHER_CONFIG = {
  sunny: { label: '맑음', iconName: 'sun', color: 'amber' },
  cloudy: { label: '흐림', iconName: 'cloud', color: 'cyan' },
  rain: { label: '우천', iconName: 'rain', color: 'blue' },
  snow: { label: '강설', iconName: 'snow', color: 'cyan' },
};

export default function BranchTimelineFeed({
  branch,
  stages = [],
  schedules = [],
  dailyLogs = [],
  costs = [],
  documents = [],
  equipments = [],
  logs = [],
  onOpenScheduleForm,
  onOpenCostForm,
  onOpenDailyLogForm,
}) {
  // 1. 상태 관리
  const [activeFilter, setActiveFilter] = useState('all'); // all | dailyLog | photos | schedule | cost | document | equipment
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('desc'); // desc (최신순) | asc (공사진행순)

  // 사진 라이트박스 뷰어 상태
  const [lightbox, setLightbox] = useState({
    isOpen: false,
    photos: [], // [{ url, label, summary, date }]
    currentIndex: 0,
  });

  // 2. 모든 데이터 소스를 날짜 기반 통일 피드 아이템으로 변환
  const allTimelineItems = useMemo(() => {
    const items = [];

    // (A) 현장 일일 일지 (Daily Logs)
    dailyLogs.forEach(log => {
      const norm = normalizeDate(log.date);
      if (!norm) return;

      // 일지 내 모든 사진 수집 (오전 기본 사진 + 오후 추가 조치 사진들)
      const allPhotos = [];
      if (Array.isArray(log.photos)) {
        log.photos.forEach((url, i) => {
          if (url) allPhotos.push({ url, label: `오전 현황 사진 ${i + 1}`, summary: log.summary, date: norm.dateStr });
        });
      }
      if (Array.isArray(log.entries)) {
        log.entries.forEach(entry => {
          if (Array.isArray(entry.photos)) {
            entry.photos.forEach((url, i) => {
              if (url) allPhotos.push({ url, label: `[${entry.timeTag || '추가작업'}] 사진 ${i + 1}`, summary: entry.summary, date: norm.dateStr });
            });
          }
        });
      }

      // 검색 텍스트 생성
      const entriesText = (log.entries || []).map(e => `${e.summary || ''} ${e.workType || ''} ${e.issues || ''}`).join(' ');
      const searchStr = `${log.summary || ''} ${log.equipmentUsed || ''} ${log.issues || ''} ${log.author || ''} ${entriesText}`;

      items.push({
        id: `dailyLog_${log.id}`,
        itemType: 'dailyLog',
        dateStr: norm.dateStr,
        dateObj: norm.dateObj,
        title: log.summary ? `[현장 일지] ${log.summary}` : '[현장 일지] 작업 내용',
        raw: log,
        photos: allPhotos,
        hasPhotos: allPhotos.length > 0,
        searchStr: searchStr.toLowerCase(),
      });
    });

    // (B) 공정 일정 (Schedules)
    schedules.forEach(sc => {
      const startNorm = normalizeDate(sc.startDate);
      if (!startNorm) return;
      const endNorm = normalizeDate(sc.endDate) || startNorm;
      const stage = stages.find(s => s.id === sc.stageId);

      items.push({
        id: `schedule_${sc.id}`,
        itemType: 'schedule',
        dateStr: startNorm.dateStr,
        dateObj: startNorm.dateObj,
        title: `[공정 일정] ${sc.title}`,
        stageName: stage?.name || '',
        endDateStr: endNorm.dateStr,
        raw: sc,
        photos: [],
        hasPhotos: false,
        searchStr: `${sc.title || ''} ${stage?.name || ''} ${sc.assignee || ''} ${sc.status || ''}`.toLowerCase(),
      });
    });

    // (C) 공사 비용 지출 (Costs)
    costs.forEach(c => {
      const norm = normalizeDate(c.date || c.createdAt);
      if (!norm) return;
      const stage = stages.find(s => s.id === c.stageId);

      const photos = [];
      if (c.receiptUrl) {
        photos.push({ url: c.receiptUrl, label: `영수증/증빙 (${c.title})`, summary: `${formatCurrency(c.amount)}`, date: norm.dateStr });
      }

      const bank = c.bankName || c.bankInfo?.bank || '';
      const account = c.accountNumber || c.bankInfo?.account || '';
      const holder = c.accountHolder || c.bankInfo?.holder || '';
      const memoText = c.memo || c.notes || '';
      const vendorText = c.vendor || c.accountHolder || c.assignee || '';

      items.push({
        id: `cost_${c.id}`,
        itemType: 'cost',
        dateStr: norm.dateStr,
        dateObj: norm.dateObj,
        title: `[지출] ${c.title}`,
        stageName: stage?.name || '',
        amount: c.amount || 0,
        vendor: vendorText,
        bankInfo: bank ? { bank, account, holder } : null,
        notes: memoText,
        raw: c,
        photos,
        hasPhotos: photos.length > 0,
        searchStr: `${c.title || ''} ${vendorText} ${memoText} ${bank} ${account} ${holder}`.toLowerCase(),
      });
    });

    // (D) 인허가 및 계약 서류 / 사진 (Documents)
    documents.forEach(doc => {
      const norm = normalizeDate(doc.createdAt);
      if (!norm) return;

      const isImage = doc.fileType?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(doc.fileName || '');
      const photos = [];
      if (isImage && (doc.downloadUrl || doc.thumbnailUrl)) {
        photos.push({ url: doc.downloadUrl || doc.thumbnailUrl, label: doc.fileName, summary: doc.category || '현장 서류/사진', date: norm.dateStr });
      }

      items.push({
        id: `doc_${doc.id}`,
        itemType: 'document',
        dateStr: norm.dateStr,
        dateObj: norm.dateObj,
        title: `[서류/파일] ${doc.fileName || '서류'}`,
        raw: doc,
        photos,
        hasPhotos: photos.length > 0,
        searchStr: `${doc.fileName || ''} ${doc.category || ''}`.toLowerCase(),
      });
    });

    // (E) 정비 장비 입고 및 설치 (Equipments)
    equipments.forEach(eq => {
      const norm = normalizeDate(eq.installDate || eq.arrivalDate || eq.createdAt);
      if (!norm) return;

      items.push({
        id: `equip_${eq.id}`,
        itemType: 'equipment',
        dateStr: norm.dateStr,
        dateObj: norm.dateObj,
        title: `[장비] ${eq.name || '정비 장비'}`,
        raw: eq,
        photos: [],
        hasPhotos: false,
        searchStr: `${eq.name || ''} ${eq.modelName || ''} ${eq.vendor || ''}`.toLowerCase(),
      });
    });

    return items;
  }, [dailyLogs, schedules, costs, documents, equipments, stages]);

  // 3. 통계 계산 (KPI Banner)
  const metrics = useMemo(() => {
    // 총 기록된 고유 날짜 수
    const uniqueDates = new Set(allTimelineItems.map(i => i.dateStr));
    // 총 사진 장수
    let totalPhotos = 0;
    allTimelineItems.forEach(i => {
      totalPhotos += i.photos.length;
    });
    // 총 집행 비용
    const totalCostAmount = costs.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    // 총 일지 수
    const totalDailyLogs = dailyLogs.length;

    return {
      totalDays: uniqueDates.size,
      totalPhotos,
      totalCostAmount,
      totalDailyLogs,
      totalSchedules: schedules.length,
    };
  }, [allTimelineItems, costs, dailyLogs, schedules]);

  // 4. 필터링 및 검색 적용
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return allTimelineItems.filter(item => {
      // (1) 카테고리 필터
      if (activeFilter === 'photos') {
        if (!item.hasPhotos) return false;
      } else if (activeFilter !== 'all') {
        if (item.itemType !== activeFilter) return false;
      }

      // (2) 검색어 필터
      if (q) {
        if (!item.searchStr.includes(q) && !item.title.toLowerCase().includes(q) && !item.dateStr.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [allTimelineItems, activeFilter, searchQuery]);

  // 5. 날짜별 그룹핑 (Date Groups) 및 정렬
  const groupedTimeline = useMemo(() => {
    const map = new Map();

    filteredItems.forEach(item => {
      if (!map.has(item.dateStr)) {
        map.set(item.dateStr, {
          dateStr: item.dateStr,
          dateObj: item.dateObj,
          items: [],
          photos: [],
          totalCost: 0,
        });
      }
      const group = map.get(item.dateStr);
      group.items.push(item);
      if (item.photos && item.photos.length > 0) {
        group.photos.push(...item.photos);
      }
      if (item.itemType === 'cost' && item.amount) {
        group.totalCost += Number(item.amount);
      }
    });

    const groups = Array.from(map.values());

    // 정렬 (최신순 vs 공사진행순)
    groups.sort((a, b) => {
      return sortOrder === 'desc'
        ? b.dateObj.getTime() - a.dateObj.getTime()
        : a.dateObj.getTime() - b.dateObj.getTime();
    });

    // 각 그룹 내부 아이템들도 정렬 (일정 -> 일지 -> 사진/비용 -> 서류 -> 장비)
    const typePriority = { schedule: 1, dailyLog: 2, cost: 3, equipment: 4, document: 5 };
    groups.forEach(g => {
      g.items.sort((a, b) => (typePriority[a.itemType] || 99) - (typePriority[b.itemType] || 99));
    });

    return groups;
  }, [filteredItems, sortOrder]);

  // 6. 월별 빠른 점프 목록 (Months List)
  const monthChips = useMemo(() => {
    const monthsSet = new Set();
    groupedTimeline.forEach(g => {
      const yyyymm = g.dateStr.substring(0, 7); // "YYYY-MM"
      monthsSet.add(yyyymm);
    });
    return Array.from(monthsSet).map(ym => {
      const [y, m] = ym.split('-');
      return {
        key: ym,
        label: `${y}년 ${parseInt(m, 10)}월`,
      };
    });
  }, [groupedTimeline]);

  const handleMonthJump = (monthKey) => {
    const targetGroup = groupedTimeline.find(g => g.dateStr.startsWith(monthKey));
    if (targetGroup) {
      const el = document.getElementById(`timeline-group-${targetGroup.dateStr}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  // 7. 사진 라이트박스 열기
  const handlePhotoClick = (photosList, initialIndex = 0) => {
    setLightbox({
      isOpen: true,
      photos: photosList,
      currentIndex: initialIndex,
    });
  };

  // 키보드로 라이트박스 탐색
  useEffect(() => {
    if (!lightbox.isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') {
        setLightbox(prev => ({
          ...prev,
          currentIndex: (prev.currentIndex + 1) % prev.photos.length,
        }));
      } else if (e.key === 'ArrowLeft') {
        setLightbox(prev => ({
          ...prev,
          currentIndex: (prev.currentIndex - 1 + prev.photos.length) % prev.photos.length,
        }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightbox.isOpen]);

  // 인쇄 모드
  const handlePrint = () => {
    window.print();
  };

  // 오늘 날짜
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="branch-timeline-feed" id="branch-timeline-feed">
      {/* 1. 상단 통계 & KPI 요약 배너 */}
      <div className="timeline-metrics-banner animate-fade-in">
        <div className="timeline-metric-item">
          <NeonIcon name="calendar" color="emerald" size="md" />
          <div className="timeline-metric-info">
            <div className="timeline-metric-value">{metrics.totalDays} <span style={{ fontSize: 13, fontWeight: 500 }}>일</span></div>
            <div className="timeline-metric-label">총 기록 일수</div>
          </div>
        </div>

        <div className="timeline-metric-item">
          <NeonIcon name="log" color="blue" size="md" />
          <div className="timeline-metric-info">
            <div className="timeline-metric-value">{metrics.totalDailyLogs} <span style={{ fontSize: 13, fontWeight: 500 }}>건</span></div>
            <div className="timeline-metric-label">현장 일일 일지</div>
          </div>
        </div>

        <div className="timeline-metric-item">
          <NeonIcon name="photo" color="rose" size="md" />
          <div className="timeline-metric-info">
            <div className="timeline-metric-value">{metrics.totalPhotos} <span style={{ fontSize: 13, fontWeight: 500 }}>장</span></div>
            <div className="timeline-metric-label">현장 공사 사진</div>
          </div>
        </div>

        <div className="timeline-metric-item">
          <NeonIcon name="money" color="amber" size="md" />
          <div className="timeline-metric-info">
            <div className="timeline-metric-value">{formatCurrency(metrics.totalCostAmount)}</div>
            <div className="timeline-metric-label">누적 집행 공사비</div>
          </div>
        </div>
      </div>

      {/* 2. 제어 툴바 (검색, 필터, 정렬, 퀵 액션) */}
      <div className="timeline-toolbar">
        <div className="timeline-toolbar-top">
          {/* 검색창 */}
          <div className="timeline-search-box">
            <span className="timeline-search-icon" style={{ display: 'flex', alignItems: 'center' }}>
              <NeonIcon name="search" size="xs" color="cyan" badge={false} />
            </span>
            <input
              type="text"
              className="timeline-search-input"
              placeholder="작업 내용, 자재명, 거래처 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              id="timeline-search-input"
            />
            {searchQuery && (
              <button
                className="timeline-search-clear"
                onClick={() => setSearchQuery('')}
                title="검색어 지우기"
              >
                ✕
              </button>
            )}
          </div>

          {/* 우측 정렬 및 액션 버튼들 */}
          <div className="timeline-toolbar-actions">
            {/* 정렬 토글 버튼 */}
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              id="timeline-sort-toggle-btn"
              title="시간순 정렬 변경"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <NeonIcon name="history" size="xs" badge={false} />
              <span>{sortOrder === 'desc' ? '최신순 (최근부터)' : '공사진행순 (과거부터)'}</span>
            </button>

            {/* 감리 보고서 인쇄 버튼 */}
            <button
              className="btn btn-secondary btn-sm"
              onClick={handlePrint}
              id="timeline-print-btn"
              title="공사 타임라인 감리 보고서 인쇄/PDF 저장"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <NeonIcon name="document" size="xs" badge={false} />
              <span>인쇄 / 보고서</span>
            </button>

            {/* 퀵 일지 작성 바로가기 */}
            {onOpenDailyLogForm && (
              <button
                className="btn btn-primary btn-sm"
                onClick={onOpenDailyLogForm}
                id="timeline-quick-log-btn"
              >
                + 새 일지 작성
              </button>
            )}
          </div>
        </div>

        {/* 필터 칩 목록 */}
        <div className="timeline-filter-chips">
          <button
            className={`timeline-filter-chip ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            <span>전체 자료</span>
            <span className="timeline-filter-badge">{allTimelineItems.length}</span>
          </button>
          <button
            className={`timeline-filter-chip ${activeFilter === 'dailyLog' ? 'active' : ''}`}
            onClick={() => setActiveFilter('dailyLog')}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <NeonIcon name="log" color="blue" size="xs" badge={false} />
              현장 일지
            </span>
            <span className="timeline-filter-badge">{dailyLogs.length}</span>
          </button>
          <button
            className={`timeline-filter-chip ${activeFilter === 'photos' ? 'active' : ''}`}
            onClick={() => setActiveFilter('photos')}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <NeonIcon name="photo" color="rose" size="xs" badge={false} />
              현장 사진
            </span>
            <span className="timeline-filter-badge">{metrics.totalPhotos}</span>
          </button>
          <button
            className={`timeline-filter-chip ${activeFilter === 'schedule' ? 'active' : ''}`}
            onClick={() => setActiveFilter('schedule')}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <NeonIcon name="calendar" color="cyan" size="xs" badge={false} />
              공정 일정
            </span>
            <span className="timeline-filter-badge">{schedules.length}</span>
          </button>
          <button
            className={`timeline-filter-chip ${activeFilter === 'cost' ? 'active' : ''}`}
            onClick={() => setActiveFilter('cost')}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <NeonIcon name="money" color="amber" size="xs" badge={false} />
              비용/지출
            </span>
            <span className="timeline-filter-badge">{costs.length}</span>
          </button>
          <button
            className={`timeline-filter-chip ${activeFilter === 'document' ? 'active' : ''}`}
            onClick={() => setActiveFilter('document')}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <NeonIcon name="document" color="violet" size="xs" badge={false} />
              서류/인허가
            </span>
            <span className="timeline-filter-badge">{documents.length}</span>
          </button>
          <button
            className={`timeline-filter-chip ${activeFilter === 'equipment' ? 'active' : ''}`}
            onClick={() => setActiveFilter('equipment')}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <NeonIcon name="equipment" color="cyan" size="xs" badge={false} />
              장비 대장
            </span>
            <span className="timeline-filter-badge">{equipments.length}</span>
          </button>
        </div>

        {/* 월별 빠른 점프 칩 (월이 2개 이상일 때) */}
        {monthChips.length > 1 && (
          <div className="timeline-month-chips">
            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginRight: 4 }}>월별 바로가기:</span>
            {monthChips.map(m => (
              <button
                key={m.key}
                className="timeline-month-chip"
                onClick={() => handleMonthJump(m.key)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <NeonIcon name="calendar" size="xs" badge={false} />
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. 타임라인 메인 트리 피드 */}
      {groupedTimeline.length === 0 ? (
        <div className="timeline-empty-state animate-fade-in">
          <div className="timeline-empty-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <NeonIcon name="document" size="lg" color="cyan" badge={true} />
          </div>
          <div className="timeline-empty-title">표시할 타임라인 자료가 없습니다</div>
          <div className="timeline-empty-desc">
            {searchQuery
              ? `"${searchQuery}" 검색 결과와 일치하는 일지나 일정이 없습니다.`
              : '일정이나 현장 작업일지, 공사비 등을 입력하면 날짜순으로 정돈된 타임라인이 자동으로 구성됩니다.'}
          </div>
          {onOpenDailyLogForm && (
            <button className="btn btn-primary" onClick={onOpenDailyLogForm} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <NeonIcon name="log" size="xs" color="blue" badge={false} />
              <span>첫 현장 일지 작성하기</span>
            </button>
          )}
        </div>
      ) : (
        <div className="timeline-tree-container">
          {groupedTimeline.map((group) => {
            const isToday = group.dateStr === todayStr;
            const ddayObj = getDDay(group.dateObj);

            return (
              <div
                key={group.dateStr}
                className="timeline-date-group animate-fade-in"
                id={`timeline-group-${group.dateStr}`}
              >
                {/* 날짜 헤더 노드 */}
                <div className="timeline-date-node">
                  <div className="timeline-node-pin">
                    <div className="timeline-node-pin-inner" />
                  </div>
                  <div className="timeline-date-title-box">
                    <span className="timeline-date-text">
                      {formatDate(group.dateObj)}
                    </span>
                    {isToday && (
                      <span className="timeline-day-badge today">오늘 (Today)</span>
                    )}
                    {ddayObj && !isToday && (
                      <span className="timeline-day-badge">{ddayObj.label}</span>
                    )}
                    <span className="timeline-date-counts">
                      총 {group.items.length}건 기록
                      {group.photos.length > 0 && ` · 사진 ${group.photos.length}장`}
                      {group.totalCost > 0 && ` · 지출 ${formatCurrency(group.totalCost)}`}
                    </span>
                  </div>
                </div>

                {/* 해당 날짜의 카드 리스트 */}
                <div className="timeline-cards-list">
                  {group.items.map((item) => (
                    <TimelineCard
                      key={item.id}
                      item={item}
                      onPhotoClick={handlePhotoClick}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. 사진 라이트박스 뷰어 모달 */}
      {lightbox.isOpen && (
        <ModalPortal onClose={() => setLightbox(prev => ({ ...prev, isOpen: false }))}>
          <div
            className="timeline-lightbox-overlay"
            onClick={() => setLightbox(prev => ({ ...prev, isOpen: false }))}
          >
            <button
              className="timeline-lightbox-close"
              onClick={() => setLightbox(prev => ({ ...prev, isOpen: false }))}
              title="닫기 (ESC)"
            >
              ✕
            </button>

            {lightbox.photos.length > 1 && (
              <>
                <button
                  className="timeline-lightbox-nav-btn prev"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightbox(prev => ({
                      ...prev,
                      currentIndex: (prev.currentIndex - 1 + prev.photos.length) % prev.photos.length,
                    }));
                  }}
                  title="이전 사진 (←)"
                >
                  ‹
                </button>
                <button
                  className="timeline-lightbox-nav-btn next"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightbox(prev => ({
                      ...prev,
                      currentIndex: (prev.currentIndex + 1) % prev.photos.length,
                    }));
                  }}
                  title="다음 사진 (→)"
                >
                  ›
                </button>
              </>
            )}

            <div
              className="timeline-lightbox-content"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={lightbox.photos[lightbox.currentIndex]?.url}
                alt={lightbox.photos[lightbox.currentIndex]?.label || '현장 사진'}
                className="timeline-lightbox-img"
              />
              <div className="timeline-lightbox-caption">
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                  {lightbox.photos[lightbox.currentIndex]?.label}
                  {lightbox.photos.length > 1 && ` (${lightbox.currentIndex + 1} / ${lightbox.photos.length})`}
                </div>
                {lightbox.photos[lightbox.currentIndex]?.summary && (
                  <div style={{ opacity: 0.85, fontSize: 13 }}>
                    {lightbox.photos[lightbox.currentIndex]?.summary}
                  </div>
                )}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}

// 개별 타임라인 카드 서브 컴포넌트
function TimelineCard({ item, onPhotoClick }) {
  const { itemType, raw, photos } = item;

  // 1. 현장 일일 일지 카드
  if (itemType === 'dailyLog') {
    return (
      <div className="timeline-card dailyLog" id={item.id}>
        <div className="timeline-card-header">
          <div className="timeline-card-tag-group">
            <span className="timeline-card-type-tag dailyLog" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <NeonIcon name="log" size="xs" color="blue" badge={false} />
              현장 일지
            </span>
            {raw.weather && (
              <span className="timeline-meta-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <NeonIcon
                  name={WEATHER_CONFIG[raw.weather]?.iconName || 'sun'}
                  size="xs"
                  color={WEATHER_CONFIG[raw.weather]?.color || 'amber'}
                  badge={false}
                />
                <span>{WEATHER_CONFIG[raw.weather]?.label || raw.weather}</span>
              </span>
            )}
            {raw.workersCount > 0 && (
              <span className="timeline-meta-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <NeonIcon name="partner" size="xs" color="cyan" badge={false} />
                {raw.workersCount}명 출역
              </span>
            )}
            {raw.equipmentUsed && (
              <span className="timeline-meta-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <NeonIcon name="equipment" size="xs" color="violet" badge={false} />
                {raw.equipmentUsed}
              </span>
            )}
          </div>
          {raw.author && (
            <span className="timeline-card-time">작성자: {raw.author}</span>
          )}
        </div>

        {raw.summary && (
          <div className="timeline-card-title">{raw.summary}</div>
        )}

        {/* 특이사항 / 현장 이슈 */}
        {raw.issues && (
          <div className="timeline-card-issues-box">
            <NeonIcon name="alert" size="xs" color="amber" badge={false} />
            <div><strong>현장 특이사항 / 안전 이슈:</strong> {raw.issues}</div>
          </div>
        )}

        {/* 시간대별 세부 조치 (오전/오후 entries) */}
        {Array.isArray(raw.entries) && raw.entries.length > 0 && (
          <div className="timeline-sub-entries">
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
              <NeonIcon name="history" size="xs" color="cyan" badge={false} />
              <span>시간대별 세부 작업 및 추가 조치 ({raw.entries.length}건)</span>
            </div>
            {raw.entries.map((entry, idx) => (
              <div key={entry.id || idx} className="timeline-sub-entry-item">
                <div className="timeline-sub-entry-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="timeline-sub-entry-tag">{entry.timeTag || '오후 조치'}</span>
                    {entry.workType && <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>[{entry.workType}]</span>}
                  </div>
                  {entry.status && (
                    <span style={{ fontSize: 11, color: entry.status === 'resolved' ? '#22c55e' : '#f59e0b' }}>
                      {entry.status === 'resolved' ? '조치 완료' : '진행중'}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>{entry.summary}</div>
              </div>
            ))}
          </div>
        )}

        {/* 사진 그리드 */}
        {photos && photos.length > 0 && (
          <div className="timeline-photo-grid">
            {photos.map((p, idx) => (
              <div
                key={idx}
                className="timeline-photo-thumb-wrapper"
                onClick={() => onPhotoClick(photos, idx)}
                title="클릭하여 고화질 확대 보기"
              >
                <img src={p.url} alt={p.label} className="timeline-photo-thumb" loading="lazy" />
                <span className="timeline-photo-count-badge">사진 {idx + 1}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 2. 공정 일정 카드
  if (itemType === 'schedule') {
    const isDone = raw.status === 'completed' || raw.status === 'complete' || raw.progress === 100;
    const isOngoing = raw.status === 'in_progress' || raw.status === 'progress';

    return (
      <div className="timeline-card schedule" id={item.id}>
        <div className="timeline-card-header">
          <div className="timeline-card-tag-group">
            <span className="timeline-card-type-tag schedule" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <NeonIcon name="calendar" size="xs" color="cyan" badge={false} />
              공정 일정
            </span>
            {item.stageName && (
              <span className="timeline-meta-chip">공정: {item.stageName}</span>
            )}
            <span className={`timeline-meta-chip ${isDone ? 'done' : isOngoing ? 'ongoing' : ''}`}>
              {isDone ? '완료' : isOngoing ? '진행중' : '예정'}
            </span>
          </div>
          {raw.assignee && (
            <span className="timeline-card-time">담당: {raw.assignee}</span>
          )}
        </div>

        <div className="timeline-card-title">{raw.title}</div>
        <div className="timeline-card-body" style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
          기간: {item.dateStr} ~ {item.endDateStr || item.dateStr}
          {raw.description && ` · ${raw.description}`}
        </div>
      </div>
    );
  }

  // 3. 공사 비용 지출 카드
  if (itemType === 'cost') {
    return (
      <div className="timeline-card cost" id={item.id}>
        <div className="timeline-card-header">
          <div className="timeline-card-tag-group">
            <span className="timeline-card-type-tag cost" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <NeonIcon name="money" size="xs" color="amber" badge={false} />
              비용 지출
            </span>
            {item.stageName && (
              <span className="timeline-meta-chip">공정: {item.stageName}</span>
            )}
          </div>
          {raw.paidBy && (
            <span className="timeline-card-time">결제자: {raw.paidBy}</span>
          )}
        </div>

        <div className="timeline-card-title">{raw.title}</div>

        <div className="timeline-cost-amount-row">
          <span className="timeline-cost-amount">{formatCurrency(item.amount)}</span>
          {item.vendor && (
            <span className="timeline-cost-vendor">지급처/담당: <strong>{item.vendor}</strong></span>
          )}
        </div>

        {(item.notes || item.bankInfo?.bank) && (
          <div className="timeline-cost-details-box">
            {item.bankInfo?.bank && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <NeonIcon name="bank" size="xs" color="blue" badge={false} />
                {item.bankInfo.bank} {item.bankInfo.account} ({item.bankInfo.holder})
              </span>
            )}
            {item.notes && <span>비고: {item.notes}</span>}
          </div>
        )}

        {/* 영수증/세금계산서 증빙 사진 */}
        {photos && photos.length > 0 && (
          <div className="timeline-photo-grid" style={{ marginTop: 8 }}>
            {photos.map((p, idx) => (
              <div
                key={idx}
                className="timeline-photo-thumb-wrapper"
                onClick={() => onPhotoClick(photos, idx)}
                title="영수증/세금계산서 증빙 확대 보기"
                style={{ width: 90, height: 90 }}
              >
                <img src={p.url} alt={p.label} className="timeline-photo-thumb" loading="lazy" />
                <span className="timeline-photo-count-badge">증빙</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 4. 인허가 및 계약 서류 / 사진 카드
  if (itemType === 'document') {
    return (
      <div className="timeline-card document" id={item.id}>
        <div className="timeline-card-header">
          <div className="timeline-card-tag-group">
            <span className="timeline-card-type-tag document" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <NeonIcon name="document" size="xs" color="violet" badge={false} />
              서류 / 파일
            </span>
            {raw.category && (
              <span className="timeline-meta-chip">{raw.category}</span>
            )}
          </div>
          {raw.fileSize && (
            <span className="timeline-card-time">{formatFileSize(raw.fileSize)}</span>
          )}
        </div>

        <div className="timeline-card-title">{raw.fileName || '서류 파일'}</div>

        {raw.downloadUrl && (
          <div style={{ marginTop: 6 }}>
            <a
              href={raw.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <NeonIcon name="download" size="xs" badge={false} />
              <span>파일 다운로드 / 확인</span>
            </a>
          </div>
        )}

        {photos && photos.length > 0 && (
          <div className="timeline-photo-grid">
            {photos.map((p, idx) => (
              <div
                key={idx}
                className="timeline-photo-thumb-wrapper"
                onClick={() => onPhotoClick(photos, idx)}
                title="사진 확대 보기"
              >
                <img src={p.url} alt={p.label} className="timeline-photo-thumb" loading="lazy" />
                <span className="timeline-photo-count-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <NeonIcon name="search" size="xs" color="cyan" badge={false} />
                  <span>확대</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 5. 정비 장비 입고 및 설치 대장 카드
  if (itemType === 'equipment') {
    return (
      <div className="timeline-card equipment" id={item.id}>
        <div className="timeline-card-header">
          <div className="timeline-card-tag-group">
            <span className="timeline-card-type-tag equipment" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <NeonIcon name="equipment" size="xs" color="cyan" badge={false} />
              장비 대장
            </span>
            <span className="timeline-meta-chip">
              {raw.status === 'installed' ? '설치 완료' : raw.status === 'delivered' ? '입고 완료' : '주문/배송'}
            </span>
          </div>
        </div>

        <div className="timeline-card-title">{raw.name} {raw.modelName && `(${raw.modelName})`}</div>
        <div className="timeline-card-body" style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
          공급처: {raw.vendor || '-'} {raw.cost ? ` · 단가: ${formatCurrency(raw.cost)}` : ''}
        </div>
      </div>
    );
  }

  return null;
}
