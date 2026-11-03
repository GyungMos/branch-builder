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
 * 지점마다 '지금 단계'에서 아직 적용 안 한 이전 지점 부족했던 점 (지점당 알림 하나)
 * branches: [{ id, name, status, lessonChecks, stages, lessons }] — lessons는 그 지점에서 나온 부족했던 점
 */
export function buildLessonAlerts(branches = []) {
  const out = [];
  branches.forEach(b => {
    if (b.status === 'complete' || b.status === 'paused') return;
    const sorted = [...(b.stages || [])].sort((x, y) => (x.order || 0) - (y.order || 0));
    const now = (sorted.find(s => s.status === 'progress') || sorted.find(s => s.status === 'waiting'))?.name;
    if (!now) return;
    const checks = b.lessonChecks || {};
    const open = branches
      .filter(o => o.id !== b.id)
      .flatMap(o => o.lessons || [])
      .filter(it => it.stageName === now && !checks[it.key]);
    if (!open.length) return;
    out.push({
      key: `l-${b.id}-${now}-${open.length}`,
      type: 'lesson',
      kind: 'lesson',
      title: `[부족했던 점] 지금 단계(${now})에서 챙길 것 ${open.length}개`,
      branchId: b.id,
      branchName: b.name,
      tab: 'lessons',
      people: [],
      badge: '미리 챙기기',
    });
  });
  return out;
}

/**
 * 챙길 일 모으기: 기한이 지났거나 days일 안에 시작·마감·지급인 것
 * 모든 기록에는 branchId·branchName이 붙어 있어야 함
 * kind: overdue(지남) | start | end | payment  —  type: schedule | payment | task | plan
 */
export function buildAlerts({ schedules = [], costs = [], openTasks = [], openPlans = [], defects = [] }, { days = 7 } = {}) {
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

  // 하자·A/S: 접수하고 7일이 지나도록 완료가 아니면
  defects.forEach(d => {
    if (d.status === 'done') return;
    const at = toDay(d.reportedDate);
    if (!at || today - at < 7 * DAY) return;
    out.push({
      key: `d-${d.branchId}-${d.id}`, type: 'defect', kind: 'overdue', when: at,
      title: `[하자] ${d.title}`, branchId: d.branchId, branchName: d.branchName, tab: 'defects',
      people: [], badge: `${Math.round((today - at) / DAY)}일째 처리 안 됨`,
    });
  });

  const rank = { overdue: 0, start: 1, end: 1, payment: 1, lesson: 2 };
  return out.sort((a, b) => (rank[a.kind] - rank[b.kind]) || ((a.when || 0) - (b.when || 0)));
}
