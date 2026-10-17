import { DEFAULT_ARCHITECT_SCHEDULE } from '../data/architectSchedule';
import { toDateInputValue } from './formatters';

// 표준 일정표는 수원 이목점 실제 일정(첫 공정 시작일 기준)으로 작성됨 → 이 날짜를 0일로 보고 상대 일수로 변환
const TEMPLATE_BASE_DATE = DEFAULT_ARCHITECT_SCHEDULE
  .map(i => i.startDate)
  .sort()[0];

const DAY = 24 * 60 * 60 * 1000;

function parseYmd(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(fromStr, toStr) {
  return Math.round((parseYmd(toStr) - parseYmd(fromStr)) / DAY);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// 표준 일정 구분 → 지점 단계 (단계 이름으로 찾음)
function findStageId(item, stages) {
  const byName = (re) => stages.find(s => re.test(s.name))?.id || null;
  if (item.category === '건축허가') return byName(/인허가|허가/);
  if (item.category === '착공접수') return byName(/착공/);
  if (/준공|사용승인/.test(item.title)) return byName(/준공|사용승인/) || byName(/시공|공사/);
  return byName(/시공|공사/);
}

/**
 * 시작일 기준으로 표준 신축공정 일정을 만든다.
 * 이목점 날짜가 들어간 메모(예: '허가접수 7/21')는 다른 지점에 맞지 않아 뺀다.
 */
export function buildArchitectSchedule(startDateStr, stages = []) {
  const start = parseYmd(startDateStr);
  return DEFAULT_ARCHITECT_SCHEDULE.map(item => {
    const startOffset = daysBetween(TEMPLATE_BASE_DATE, item.startDate);
    const length = daysBetween(item.startDate, item.endDate);
    const s = addDays(start, startOffset);
    const e = addDays(s, length);
    const milestone = /\d+\s*\/\s*\d+/.test(item.milestoneText || '') ? '' : (item.milestoneText || '');
    return {
      title: item.title,
      startDate: toDateInputValue(s),
      endDate: toDateInputValue(e),
      category: item.category,
      milestoneText: milestone,
      color: item.color,
      memo: item.note,
      stageId: findStageId(item, stages),
    };
  });
}

export const ARCHITECT_SCHEDULE_COUNT = DEFAULT_ARCHITECT_SCHEDULE.length;
export const ARCHITECT_SCHEDULE_TOTAL_DAYS = Math.max(
  ...DEFAULT_ARCHITECT_SCHEDULE.map(i => daysBetween(TEMPLATE_BASE_DATE, i.endDate))
);
