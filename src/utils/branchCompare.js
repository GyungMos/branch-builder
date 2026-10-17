import { DEFAULT_STAGES } from './constants';
import { isScheduledCost } from './costs';

const DAY = 86400000;

function toDate(val) {
  if (!val) return null;
  const d = val.toDate ? val.toDate() : new Date(val);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function isDone(s) {
  return s.status === 'completed' || s.status === 'complete';
}

/** 단계 이름 → 표준 단계 순번(0~7), 못 찾으면 -1 */
export function standardIndexOf(stageName) {
  const exact = DEFAULT_STAGES.findIndex(s => s.name === stageName);
  if (exact >= 0) return exact;
  return DEFAULT_STAGES.findIndex(s => s.match?.test(stageName));
}

/**
 * 지점 하나의 표준 단계별 통계
 * 기간: 그 단계에 연결된 일정의 가장 빠른 시작일 ~ 가장 늦은 종료일 (일수, 시작·종료일 포함)
 */
export function computeBranchStageStats(data) {
  const stages = data.stages || [];
  const rows = DEFAULT_STAGES.map(() => ({
    stageIds: [], status: null, start: null, end: null,
    cost: 0, schedules: 0, schedulesDone: 0, lessons: [],
  }));
  const other = { stageIds: [], cost: 0 };

  const stageRow = {};
  [...stages].sort((a, b) => (a.order || 0) - (b.order || 0)).forEach(st => {
    const idx = standardIndexOf(st.name);
    // 같은 표준 단계에 두 개가 걸리면 둘 다 합산
    const row = idx >= 0 ? rows[idx] : other;
    row.stageIds.push(st.id);
    stageRow[st.id] = row;
    if (idx >= 0) {
      const rank = { complete: 3, progress: 2, waiting: 1 };
      if (!row.status || (rank[st.status] || 0) < (rank[row.status] || 0)) row.status = st.status || 'waiting';
      const l = st.lessons;
      if (l && (l.good || l.bad || l.next)) row.lessons.push(l);
    }
  });

  let firstStart = null;
  let lastEnd = null;
  (data.schedules || []).forEach(s => {
    const start = toDate(s.startDate);
    const end = toDate(s.endDate) || start;
    if (start && (!firstStart || start < firstStart)) firstStart = start;
    if (end && (!lastEnd || end > lastEnd)) lastEnd = end;
    const row = stageRow[s.stageId];
    if (!row || row === other) return;
    row.schedules += 1;
    if (isDone(s)) row.schedulesDone += 1;
    if (start && (!row.start || start < row.start)) row.start = start;
    if (end && (!row.end || end > row.end)) row.end = end;
  });

  let totalCost = 0;
  let unlinkedCost = 0;
  (data.costs || []).forEach(c => {
    if (isScheduledCost(c)) return; // 지급 예정은 비교에서 제외
    const amt = Number(c.amount) || 0;
    totalCost += amt;
    const row = stageRow[c.stageId];
    if (!row) unlinkedCost += amt;
    else row.cost += amt;
  });

  rows.forEach(r => {
    r.days = r.start && r.end ? Math.round((r.end - r.start) / DAY) + 1 : null;
  });

  return {
    rows,
    otherCost: other.cost,
    unlinkedCost,
    totalCost,
    totalDays: firstStart && lastEnd ? Math.round((lastEnd - firstStart) / DAY) + 1 : null,
    firstStart,
    lastEnd,
  };
}

/** 값이 있는 지점들만으로 평균 (없으면 null) */
export function average(values) {
  const list = values.filter(v => typeof v === 'number' && v > 0);
  if (!list.length) return null;
  return Math.round(list.reduce((a, b) => a + b, 0) / list.length);
}
