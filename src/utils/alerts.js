import { formatCurrency, formatDateShort } from './formatters';
import { daysUntilDue, isScheduledCost } from './costs';

const DAY = 86400000;

export function toDay(v) {
  if (!v) return null;
  const d = v.toDate ? v.toDate() : new Date(v);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

const isScheduleDone = (s) => s.status === 'completed' || s.status === 'complete';

/**
 * 챙길 일 모으기: 기한이 지났거나 days일 안에 시작·마감·지급인 것
 * 모든 기록에는 branchId·branchName이 붙어 있어야 함
 * kind: overdue(지남) | start | end | payment  —  type: schedule | payment | task | plan
 */
export function buildAlerts({ schedules = [], costs = [], openTasks = [], openPlans = [] }, { days = 7 } = {}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const until = new Date(today.getTime() + days * DAY);
  const inWindow = (d) => d && d >= today && d <= until;
  const ago = (d) => `${Math.round((today - d) / DAY)}일 지남`;
  const out = [];

  schedules.forEach(s => {
    if (isScheduleDone(s)) return;
    const start = toDay(s.startDate);
    const end = toDay(s.endDate) || start;
    if (!start) return;
    const base = { key: `s-${s.branchId}-${s.id}`, type: 'schedule', title: s.title, branchId: s.branchId, branchName: s.branchName, tab: 'schedule', people: s.assignee ? [s.assignee] : [] };
    if (end < today) out.push({ ...base, kind: 'overdue', when: end, badge: ago(end) });
    else if (inWindow(start)) out.push({ ...base, kind: 'start', when: start, badge: start.getTime() === today.getTime() ? '오늘 시작' : `${formatDateShort(start)} 시작` });
    else if (inWindow(end)) out.push({ ...base, kind: 'end', when: end, badge: end.getTime() === today.getTime() ? '오늘 마감' : `${formatDateShort(end)} 마감` });
  });

  costs.filter(isScheduledCost).forEach(c => {
    const left = daysUntilDue(c);
    if (left === null || left > days) return;
    out.push({
      key: `c-${c.branchId}-${c.id}`,
      type: 'payment',
      kind: left < 0 ? 'overdue' : 'payment',
      when: toDay(c.date),
      title: `${c.title} · ${formatCurrency(Number(c.amount) || 0)}`,
      branchId: c.branchId,
      branchName: c.branchName,
      tab: 'cost',
      people: c.assignee ? [c.assignee] : [],
      badge: left < 0 ? `지급일 ${-left}일 지남` : left === 0 ? '오늘 지급' : `지급 D-${left}`,
    });
  });

  // 오픈 준비: 완료일자(끝이 있으면 끝)까지 끝내야 할 일
  openTasks.forEach(t => {
    if (t.done) return;
    const due = toDay(t.endDate) || toDay(t.startDate);
    if (!due) return;
    const base = { key: `t-${t.branchId}-${t.id}`, type: 'task', title: `[오픈 준비] ${t.title}`, branchId: t.branchId, branchName: t.branchName, tab: 'tasks', people: [...(t.assignee1 || []), ...(t.assignee2 || [])] };
    if (due < today) out.push({ ...base, kind: 'overdue', when: due, badge: ago(due) });
    else if (inWindow(due)) out.push({ ...base, kind: 'end', when: due, badge: due.getTime() === today.getTime() ? '오늘 마감' : `${formatDateShort(due)} 마감` });
  });

  // 오픈 계획: 종료일까지 '완료'가 아니면
  openPlans.forEach(p => {
    if (p.status === 'done') return;
    const due = toDay(p.dueDate);
    if (!due) return;
    const base = { key: `p-${p.branchId}-${p.id}`, type: 'plan', title: `[오픈 계획] ${p.title}`, branchId: p.branchId, branchName: p.branchName, tab: 'plans', people: [...(p.assignee1 || []), ...(p.assignee2 || [])] };
    if (due < today) out.push({ ...base, kind: 'overdue', when: due, badge: ago(due) });
    else if (inWindow(due)) out.push({ ...base, kind: 'end', when: due, badge: due.getTime() === today.getTime() ? '오늘 마감' : `${formatDateShort(due)} 마감` });
  });

  const rank = { overdue: 0, start: 1, end: 1, payment: 1 };
  return out.sort((a, b) => (rank[a.kind] - rank[b.kind]) || ((a.when || 0) - (b.when || 0)));
}
