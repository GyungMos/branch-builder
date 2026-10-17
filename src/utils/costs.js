// 비용 지급 상태: 'paid'(지급 완료, 기본값) | 'scheduled'(지급 예정, date = 지급 예정일)
export function isScheduledCost(cost) {
  return cost?.paymentStatus === 'scheduled';
}

/** 실제로 지급한 비용 합계 (지급 예정은 제외) */
export function sumPaid(costs = []) {
  return costs.reduce((sum, c) => (isScheduledCost(c) ? sum : sum + (Number(c.amount) || 0)), 0);
}

/** 지급 예정 비용 합계 */
export function sumScheduled(costs = []) {
  return costs.reduce((sum, c) => (isScheduledCost(c) ? sum + (Number(c.amount) || 0) : sum), 0);
}

/** 지급 예정일까지 남은 날 (지났으면 음수), 날짜 없으면 null */
export function daysUntilDue(cost) {
  if (!cost?.date) return null;
  const d = cost.date.toDate ? cost.date.toDate() : new Date(cost.date);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

/** 지급 예정 배지 문구 */
export function dueLabel(cost) {
  const days = daysUntilDue(cost);
  if (days === null) return '지급 예정';
  if (days < 0) return `지급일 ${-days}일 지남`;
  if (days === 0) return '오늘 지급';
  return `지급 예정 D-${days}`;
}
