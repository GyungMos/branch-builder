import { toDateInputValue } from './formatters';

const DAY = 86400000;
const atMidnight = (ymd) => {
  const d = new Date(`${ymd}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
};

/** 목표 오픈일까지 남은 날 { date, days, label } (오픈일이 없거나 지점이 끝났으면 null) */
export function openDday(branch) {
  const ymd = branch?.targetOpenDate;
  const date = ymd && atMidnight(ymd);
  if (!date || branch.status === 'complete') return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((date - today) / DAY);
  const label = days > 0 ? `D-${days}` : days === 0 ? 'D-day' : `${-days}일 지남`;
  return { date: ymd, days, label };
}

/** 목표 오픈일보다 늦게 끝나는, 아직 안 끝난 일정 */
export function schedulesAfterOpen(branch, schedules = []) {
  const ymd = branch?.targetOpenDate;
  if (!ymd) return [];
  return schedules.filter(s => {
    if (s.status === 'completed' || s.status === 'complete') return false;
    const end = toDateInputValue(s.endDate || s.startDate);
    return end && end > ymd;
  });
}
