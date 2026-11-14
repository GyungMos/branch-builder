import { buildAlerts, toDay } from './alerts';
import { sumPaid, sumScheduled, isScheduledCost, daysUntilDue } from './costs';
import { openDday, schedulesAfterOpen } from './openDate';
import { requiredDocStatus } from './requiredDocs';
import { COST_CATEGORIES, STAGE_STATUS, BRANCH_STATUS, OPEN_TASK_GROUPS } from './constants';
import { formatCurrency, formatDateShort, toDateInputValue } from './formatters';

/**
 * 종합 보고서 계산 (여기저기 나뉜 기록을 한 번에)
 * - 지점 하나: 업무 흐름(단계) · 일정 · 오픈 준비 · 오픈 계획 · 비용 · 현장 일지 · 하자 · 인허가 · 서류 · 부족했던 점
 * - 기간(from~to): '이 기간에 한 일'(끝낸 일정·지급한 비용·현장 일지·접수된 하자)을 고를 때만 씀
 */

const DAY = 86400000;
const ymd = (v) => toDateInputValue(v) || '';
const isDone = (s) => s.status === 'completed' || s.status === 'complete';
const inRange = (v, from, to) => {
  const d = ymd(v);
  return Boolean(d) && (!from || d >= from) && (!to || d <= to);
};
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

export const PERIODS = [
  { id: '7', label: '최근 7일', days: 7 },
  { id: '30', label: '최근 30일', days: 30 },
  { id: 'month', label: '이번 달' },
  { id: 'all', label: '전체 기간' },
];

/** 기간 고르기 → { from, to, label } (YYYY-MM-DD) */
export function periodRange(id) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const to = ymd(today);
  if (id === 'all') return { from: '', to: '', label: '전체 기간' };
  if (id === 'month') return { from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), to, label: '이번 달' };
  const p = PERIODS.find(x => x.id === id) || PERIODS[0];
  return { from: ymd(new Date(today.getTime() - (p.days - 1) * DAY)), to, label: p.label };
}

/** 지점 하나 종합 */
export function buildBranchReport(branch, data, { from = '', to = '' } = {}) {
  const stages = [...(data.stages || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  const schedules = data.schedules || [];
  const costs = data.costs || [];
  const docs = data.documents || [];
  const openTasks = data.openTasks || [];
  const openPlans = data.openPlans || [];
  const defects = data.defects || [];
  const logs = data.dailyLogs || [];
  const compliance = data.compliance || [];
  const shortfalls = data.shortfalls || [];
  const today = toDay(new Date());

  // 업무 흐름: 단계별
  const stageRows = stages.map(st => {
    const sch = schedules.filter(s => s.stageId === st.id);
    const starts = sch.map(s => toDay(s.startDate)).filter(Boolean);
    const ends = sch.map(s => toDay(s.endDate) || toDay(s.startDate)).filter(Boolean);
    const cl = st.checklist || [];
    // 필수 서류는 시작했거나 끝난 단계만 확인 (아직 대기 중인 단계는 빼고)
    const req = (st.status || 'waiting') === 'waiting' ? [] : requiredDocStatus(st, docs.filter(d => d.stageId === st.id)).filter(r => !r.notNeeded);
    const stCosts = costs.filter(c => c.stageId === st.id);
    return {
      id: st.id,
      name: st.name,
      status: st.status || 'waiting',
      statusLabel: STAGE_STATUS[st.status || 'waiting']?.label || '대기',
      start: starts.length ? new Date(Math.min(...starts)) : null,
      end: ends.length ? new Date(Math.max(...ends)) : null,
      schedules: sch.length,
      schedulesDone: sch.filter(isDone).length,
      checklist: cl.length,
      checklistDone: cl.filter(i => i.done).length,
      paid: sumPaid(stCosts),
      scheduled: sumScheduled(stCosts),
      docsMissing: req.filter(r => !r.done).map(r => r.name),
      docsTotal: req.length,
      lessons: st.lessons || null,
    };
  });
  const stagesDone = stageRows.filter(s => s.status === 'complete').length;
  const current = stageRows.find(s => s.status === 'progress') || stageRows.find(s => s.status !== 'complete') || null;

  // 비용
  const paid = sumPaid(costs);
  const scheduled = sumScheduled(costs);
  const budgetTotal = Number(data.budget?.totalBudget) || 0;
  const catBudgets = data.budget?.categoryBudgets || {};
  const byCategory = COST_CATEGORIES.map(c => {
    const list = costs.filter(x => (x.category || 'etc') === c.id);
    return { id: c.id, label: c.label, paid: sumPaid(list), scheduled: sumScheduled(list), budget: Number(catBudgets[c.id]) || 0, count: list.length };
  }).filter(r => r.paid || r.scheduled || r.budget);
  const upcomingPayments = costs.filter(isScheduledCost)
    .map(c => ({ title: c.title, amount: Number(c.amount) || 0, date: ymd(c.date), vendor: c.vendor || '', left: daysUntilDue(c) }))
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  const periodPaid = costs.filter(c => !isScheduledCost(c) && inRange(c.date, from, to))
    .map(c => ({ title: c.title, amount: Number(c.amount) || 0, date: ymd(c.date), vendor: c.vendor || '', category: COST_CATEGORIES.find(x => x.id === c.category)?.label || '기타' }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const topCosts = costs.filter(c => !isScheduledCost(c))
    .map(c => ({ title: c.title, amount: Number(c.amount) || 0, date: ymd(c.date), vendor: c.vendor || '' }))
    .sort((a, b) => b.amount - a.amount).slice(0, 5);

  // 일정
  const overdueSchedules = schedules.filter(s => !isDone(s) && (toDay(s.endDate) || toDay(s.startDate)) && (toDay(s.endDate) || toDay(s.startDate)) < today);
  const next14 = new Date(today.getTime() + 14 * DAY);
  const upcomingSchedules = schedules
    .filter(s => !isDone(s) && toDay(s.startDate) && toDay(s.startDate) >= today && toDay(s.startDate) <= next14)
    .map(s => ({ title: s.title, start: ymd(s.startDate), end: ymd(s.endDate) }))
    .sort((a, b) => a.start.localeCompare(b.start));
  const doneInPeriod = schedules.filter(s => isDone(s) && inRange(s.endDate || s.startDate, from, to))
    .map(s => ({ title: s.title, date: ymd(s.endDate || s.startDate) }))
    .sort((a, b) => b.date.localeCompare(a.date));

  // 오픈 준비 (그룹별)
  const groups = [...new Set([...OPEN_TASK_GROUPS, ...openTasks.map(t => t.group).filter(Boolean)])];
  const taskGroups = groups.map(g => {
    const list = openTasks.filter(t => (t.group || '기타') === g);
    return { group: g, total: list.length, done: list.filter(t => t.done).length };
  }).filter(g => g.total);
  const overdueTasks = openTasks.filter(t => !t.done && (toDay(t.endDate) || toDay(t.startDate)) && (toDay(t.endDate) || toDay(t.startDate)) < today)
    .map(t => ({ title: t.title, due: ymd(t.endDate || t.startDate), people: [...(t.assignee1 || []), ...(t.assignee2 || [])] }));

  // 오픈 계획
  const plans = { todo: 0, doing: 0, done: 0 };
  openPlans.forEach(p => { plans[p.status === 'done' ? 'done' : p.status === 'doing' ? 'doing' : 'todo'] += 1; });
  const openPlanList = openPlans.filter(p => p.status !== 'done')
    .map(p => ({ title: p.title, status: p.status === 'doing' ? '진행 중' : '할 일', due: ymd(p.dueDate), people: [...(p.assignee1 || []), ...(p.assignee2 || [])] }))
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));

  // 현장 일지
  const recentLogs = logs.filter(l => inRange(l.date || l.createdAt, from, to))
    .map(l => ({ date: ymd(l.date || l.createdAt), summary: l.summary || (l.entries || []).map(e => e.text || e.content || '').filter(Boolean).join(' · ') || '', photos: (l.photos || []).length }))
    .sort((a, b) => b.date.localeCompare(a.date));

  // 하자·A/S
  const defectCount = { open: 0, doing: 0, done: 0 };
  defects.forEach(d => { defectCount[d.status === 'done' ? 'done' : d.status === 'doing' ? 'doing' : 'open'] += 1; });
  const openDefects = defects.filter(d => d.status !== 'done')
    .map(d => ({ title: d.title, location: d.location || '', reported: ymd(d.reportedDate), status: d.status === 'doing' ? '처리 중' : '접수', partner: d.partner || '' }))
    .sort((a, b) => (a.reported || '').localeCompare(b.reported || ''));
  const defectCost = defects.reduce((s, d) => s + (Number(d.repairCost) || 0), 0);

  // 인허가·법정 시설
  const comp = { waiting: 0, in_progress: 0, fit: 0 };
  compliance.forEach(c => { comp[c.status === 'fit' ? 'fit' : c.status === 'in_progress' ? 'in_progress' : 'waiting'] += 1; });
  const compPending = compliance.filter(c => c.status !== 'fit').map(c => ({ title: c.title, status: c.status === 'in_progress' ? '진행 중' : '대기' }));

  // 서류
  const docsMissing = stageRows.flatMap(s => s.docsMissing.map(n => ({ stage: s.name, name: n })));

  // 주의할 일 (늦어진 것 + 7일 안에 할 것)
  const tag = (list) => list.map(x => ({ ...x, branchId: branch.id, branchName: branch.name }));
  const alerts = buildAlerts({ schedules: tag(schedules), costs: tag(costs), openTasks: tag(openTasks), openPlans: tag(openPlans), defects: tag(defects) }, { days: 7 })
    .map(a => ({ title: a.title, badge: a.badge, overdue: a.kind === 'overdue', type: a.type }));

  return {
    branch: {
      id: branch.id,
      name: branch.name || '지점',
      address: branch.address || '',
      status: branch.status || 'planning',
      statusLabel: BRANCH_STATUS[branch.status]?.label || '계획중',
      targetOpenDate: branch.targetOpenDate || '',
      dday: openDday(branch),
    },
    flow: { stages: stageRows, done: stagesDone, total: stageRows.length, percent: pct(stagesDone, stageRows.length), current },
    money: {
      paid, scheduled, budget: budgetTotal,
      remain: budgetTotal ? budgetTotal - paid - scheduled : null,
      usage: pct(paid, budgetTotal),
      byCategory, upcomingPayments, periodPaid, periodPaidSum: periodPaid.reduce((s, c) => s + c.amount, 0), topCosts,
    },
    schedule: {
      total: schedules.length, done: schedules.filter(isDone).length,
      overdue: overdueSchedules.map(s => ({ title: s.title, due: ymd(s.endDate || s.startDate) })),
      upcoming: upcomingSchedules,
      afterOpen: schedulesAfterOpen(branch, schedules).map(s => ({ title: s.title, end: ymd(s.endDate || s.startDate) })),
      doneInPeriod,
    },
    tasks: { total: openTasks.length, done: openTasks.filter(t => t.done).length, groups: taskGroups, overdue: overdueTasks },
    plans: { ...plans, total: openPlans.length, open: openPlanList },
    logs: recentLogs,
    defects: { ...defectCount, total: defects.length, open: openDefects, cost: defectCost },
    compliance: { ...comp, total: compliance.length, pending: compPending },
    docs: { total: docs.length, missing: docsMissing },
    shortfalls: {
      total: shortfalls.length,
      recent: shortfalls.filter(s => inRange(s.date || s.createdAt, from, to)).map(s => ({ title: s.title, category: s.category || '', date: ymd(s.date || s.createdAt) })),
    },
    equipments: (data.equipments || []).length,
    alerts,
  };
}

/** 전체 지점 합계 */
export function sumReports(reports) {
  const t = { branches: reports.length, paid: 0, scheduled: 0, budget: 0, overdue: 0, defectsOpen: 0, byStatus: {} };
  reports.forEach(r => {
    t.paid += r.money.paid; t.scheduled += r.money.scheduled; t.budget += r.money.budget;
    t.overdue += r.alerts.filter(a => a.overdue).length;
    t.defectsOpen += r.defects.open.length;
    t.byStatus[r.branch.statusLabel] = (t.byStatus[r.branch.statusLabel] || 0) + 1;
  });
  return t;
}

/* ───────── 보고서로 남기기: 간단 문서 형식 글로 ───────── */
const won = (n) => formatCurrency(n || 0);
const short = (d) => (d ? formatDateShort(d) : '-');

export function branchReportText(r, period) {
  const L = [];
  const b = r.branch;
  L.push(`# ${b.name} 종합 보고`);
  L.push(`- 상태: ${b.statusLabel}${b.targetOpenDate ? ` · 목표 오픈일 ${b.targetOpenDate}${b.dday ? ` (${b.dday.label})` : ''}` : ''}`);
  L.push(`- 지금 단계: ${r.flow.current ? `${r.flow.current.name} (${r.flow.current.statusLabel})` : (r.flow.total ? '모든 단계 완료' : '단계 없음')} · 단계 ${r.flow.done}/${r.flow.total} 완료 (${r.flow.percent}%)`);
  L.push(`- 비용: 지급 ${won(r.money.paid)} · 지급 예정 ${won(r.money.scheduled)}${r.money.budget ? ` · 예산 ${won(r.money.budget)} 중 ${r.money.usage}% 사용` : ''}`);
  L.push(`- 기간: ${period.label}${period.from ? ` (${period.from} ~ ${period.to})` : ''}`);
  if (r.alerts.length) {
    L.push('## 주의할 일');
    r.alerts.forEach(a => L.push(`- ${a.overdue ? '{{red:' : ''}${a.title} — ${a.badge}${a.overdue ? '}}' : ''}`));
  }
  L.push('## 업무 흐름 (단계별)');
  r.flow.stages.forEach((s, i) => {
    L.push(`${i + 1}. ${s.name} — ${s.statusLabel}${s.start ? ` · ${short(s.start)}~${short(s.end)}` : ''} · 일정 ${s.schedulesDone}/${s.schedules} · 지급 ${won(s.paid)}`);
    if (s.docsMissing.length) L.push(`  - {{orange:빠진 서류: ${s.docsMissing.join(', ')}}}`);
  });
  L.push('## 비용');
  r.money.byCategory.forEach(c => L.push(`- ${c.label}: 지급 ${won(c.paid)}${c.scheduled ? ` · 예정 ${won(c.scheduled)}` : ''}${c.budget ? ` · 예산 ${won(c.budget)}` : ''}`));
  if (r.money.periodPaid.length) {
    L.push(`### 이 기간에 지급 (${won(r.money.periodPaidSum)})`);
    r.money.periodPaid.forEach(c => L.push(`- ${c.date} ${c.title}${c.vendor ? ` (${c.vendor})` : ''} · ${won(c.amount)}`));
  }
  if (r.money.upcomingPayments.length) {
    L.push('### 지급 예정');
    r.money.upcomingPayments.forEach(c => L.push(`- ${c.date || '날짜 없음'} ${c.title} · ${won(c.amount)}`));
  }
  if (r.schedule.doneInPeriod.length || r.logs.length) {
    L.push('## 이 기간에 한 일');
    r.schedule.doneInPeriod.forEach(s => L.push(`[x] ${s.date} ${s.title}`));
    r.logs.forEach(l => L.push(`- ${l.date} 현장 일지: ${l.summary || '(내용 없음)'}`));
  }
  if (r.schedule.upcoming.length) {
    L.push('## 앞으로 2주 일정');
    r.schedule.upcoming.forEach(s => L.push(`[ ] ${s.start} ${s.title}`));
  }
  if (r.tasks.total) {
    L.push(`## 오픈 준비 ${r.tasks.done}/${r.tasks.total}`);
    r.tasks.groups.forEach(g => L.push(`- ${g.group}: ${g.done}/${g.total}`));
  }
  if (r.plans.open.length) {
    L.push('## 오픈 계획 (안 끝난 것)');
    r.plans.open.forEach(p => L.push(`- [${p.status}] ${p.title}${p.due ? ` · ${p.due}까지` : ''}`));
  }
  if (r.defects.open.length) {
    L.push(`## 하자·A/S 처리 안 된 것 ${r.defects.open.length}건`);
    r.defects.open.forEach(d => L.push(`- ${d.reported} ${d.title}${d.location ? ` (${d.location})` : ''} · ${d.status}`));
  }
  if (r.compliance.pending.length) {
    L.push('## 인허가·법정 시설 (안 끝난 것)');
    r.compliance.pending.forEach(c => L.push(`- ${c.title} · ${c.status}`));
  }
  return L.join('\n');
}

export function allReportText(reports, totals, period) {
  const L = [];
  L.push('# 전체 지점 종합 보고');
  L.push(`- 지점 ${totals.branches}곳 · ${Object.entries(totals.byStatus).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  L.push(`- 비용: 지급 ${won(totals.paid)} · 지급 예정 ${won(totals.scheduled)}${totals.budget ? ` · 예산 합계 ${won(totals.budget)}` : ''}`);
  L.push(`- 늦어진 일 ${totals.overdue}건 · 처리 안 된 하자 ${totals.defectsOpen}건 · 기간: ${period.label}`);
  L.push('## 지점별');
  reports.forEach(r => {
    L.push(`- ${r.branch.name} (${r.branch.statusLabel}) — 지금 단계 ${r.flow.current?.name || (r.flow.total ? '완료' : '없음')} · ${r.flow.percent}% · 지급 ${won(r.money.paid)}${r.branch.dday ? ` · 오픈 ${r.branch.dday.label}` : ''}`);
    r.alerts.filter(a => a.overdue).slice(0, 5).forEach(a => L.push(`  - {{red:${a.title} — ${a.badge}}}`));
  });
  return L.join('\n');
}
