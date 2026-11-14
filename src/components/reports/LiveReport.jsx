import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadBranchData } from '../../utils/branchData';
import {
  PERIODS, periodRange, buildBranchReport, sumReports, branchReportText, allReportText,
} from '../../utils/branchReport';
import { formatCurrency, formatDateShort } from '../../utils/formatters';
import './LiveReport.css';

/**
 * 자동 종합 보고서: 사이트 곳곳의 기록을 지금 내용 그대로 모아 한 장으로
 * - branchId = 'all' 이면 전체 지점, 아니면 지점 하나
 * - onSnapshot(제목, 본문, 지점id) → 지금 내용을 보고서함에 날짜와 함께 남김
 */

const won = (n) => formatCurrency(n || 0);
/** 큰 금액을 짧게: 1억 2,300만 원 / 6,530만 원 */
const wonShort = (n) => {
  const v = Math.round(Number(n) || 0);
  if (Math.abs(v) < 10000) return won(v);
  const eok = Math.trunc(v / 100000000); const man = Math.round((v % 100000000) / 10000);
  if (eok) return `${eok}억${man ? ` ${man.toLocaleString()}만` : ''} 원`;
  return `${man.toLocaleString()}만 원`;
};
const short = (d) => (d ? formatDateShort(d) : '-');
const todayText = () => new Date().toISOString().slice(0, 10);

function Bar({ value, max, tone = 'accent' }) {
  const p = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return <span className={`lr-bar lr-bar-${tone}`}><span style={{ width: `${p}%` }} /></span>;
}

function Kpi({ label, value, sub, tone }) {
  return (
    <div className={`lr-kpi${tone ? ` lr-kpi-${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

function Section({ title, count, more, children }) {
  return (
    <section className="lr-sec">
      <div className="lr-sec-head">
        <h3>{title}{count !== undefined && <em>{count}</em>}</h3>
        {more && <Link className="lr-more no-print" to={more}>자세히 →</Link>}
      </div>
      {children}
    </section>
  );
}

const Empty = ({ children = '없어요.' }) => <p className="lr-empty">{children}</p>;

export default function LiveReport({ branchId, branches, demoMode, onOpenBranch, onSnapshot }) {
  const [period, setPeriod] = useState('30');
  const [data, setData] = useState(null); // { [지점id]: 기록 }
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const targets = useMemo(() => (branchId === 'all' ? branches : branches.filter(b => b.id === branchId)), [branchId, branches]);
  const targetKey = targets.map(b => b.id).join(',');

  useEffect(() => {
    let alive = true;
    setData(null); setError('');
    Promise.all(targets.map(async b => [b.id, await loadBranchData(b.id, demoMode)]))
      .then(rows => { if (alive) setData(Object.fromEntries(rows)); })
      .catch(err => { if (alive) setError(err.message || '기록을 불러오지 못했어요.'); });
    return () => { alive = false; };
  }, [targetKey, demoMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const range = periodRange(period);
  const reports = useMemo(
    () => (data ? targets.map(b => buildBranchReport(b, data[b.id] || {}, range)) : []),
    [data, targets, range.from, range.to], // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (error) return <div className="lr-paper"><p className="lr-error">{error}</p></div>;
  if (!targets.length) return <div className="lr-paper"><Empty>지점이 없어요.</Empty></div>;
  if (!data) return <div className="lr-paper lr-loading">기록을 모으는 중…</div>;

  const isAll = branchId === 'all';
  const totals = sumReports(reports);
  const title = isAll ? '전체 지점 종합 보고서' : `${reports[0].branch.name} 종합 보고서`;

  const snapshot = async () => {
    setSaving(true);
    try {
      const body = isAll ? allReportText(reports, totals, range) : branchReportText(reports[0], range);
      await onSnapshot({
        title: `${isAll ? '전체 지점' : reports[0].branch.name} 종합 보고 (${todayText()})`,
        body,
        branchId: isAll ? null : reports[0].branch.id,
        category: isAll ? 'meeting' : 'branch',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="lr-paper">
      <div className="lr-actions no-print">
        <div className="lr-periods">
          {PERIODS.map(p => <button key={p.id} type="button" className={`filter-pill${period === p.id ? ' on' : ''}`} onClick={() => setPeriod(p.id)}>{p.label}</button>)}
        </div>
        <span className="lr-gap" />
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>인쇄·PDF 저장</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={snapshot} disabled={saving}>{saving ? '남기는 중…' : '지금 내용으로 보고서 남기기'}</button>
      </div>

      <header className="lr-head">
        <span className="lr-tag">자동 종합 보고서</span>
        <h2>{title}</h2>
        <p>기준일 {todayText()} · '이 기간에 한 일'은 {range.label}{range.from ? ` (${range.from} ~ ${range.to})` : ''} · 사이트 기록을 열 때마다 새로 모아요.</p>
      </header>

      {isAll ? <AllView reports={reports} totals={totals} onOpenBranch={onOpenBranch} /> : <BranchView r={reports[0]} range={range} />}

      <footer className="lr-foot">Branch Builder 보고서함 · 자동 종합 보고서 · {todayText()}</footer>
    </article>
  );
}

/* ───────── 전체 지점 ───────── */
function AllView({ reports, totals, onOpenBranch }) {
  const alerts = reports.flatMap(r => r.alerts.map(a => ({ ...a, branch: r.branch.name, branchId: r.branch.id })));
  const overdue = alerts.filter(a => a.overdue);
  const soon = alerts.filter(a => !a.overdue);
  const payments = reports.flatMap(r => r.money.upcomingPayments.map(p => ({ ...p, branch: r.branch.name })))
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  const maxPaid = Math.max(1, ...reports.map(r => r.money.paid + r.money.scheduled));

  return (
    <>
      <div className="lr-kpis">
        <Kpi label="지점" value={`${totals.branches}곳`} sub={Object.entries(totals.byStatus).map(([k, v]) => `${k} ${v}`).join(' · ')} />
        <Kpi label="지급한 비용" value={wonShort(totals.paid)} sub={totals.budget ? `예산 ${wonShort(totals.budget)}의 ${Math.round((totals.paid / totals.budget) * 100)}%` : '예산 미입력'} />
        <Kpi label="지급 예정" value={wonShort(totals.scheduled)} sub={`${payments.length}건`} />
        <Kpi label="늦어진 일" value={`${totals.overdue}건`} tone={totals.overdue ? 'bad' : 'ok'} />
        <Kpi label="처리 안 된 하자" value={`${totals.defectsOpen}건`} tone={totals.defectsOpen ? 'warn' : 'ok'} />
      </div>

      <Section title="지점별 한눈에" count={reports.length}>
        <div className="lr-table-wrap">
          <table className="lr-table">
            <thead>
              <tr><th>지점</th><th>상태</th><th>지금 단계</th><th>단계 진행</th><th>오픈</th><th className="num">지급</th><th className="num">지급 예정</th><th>예산 사용</th><th className="num">늦어진 일</th><th className="num">하자</th></tr>
            </thead>
            <tbody>
              {reports.map(r => (
                <tr key={r.branch.id} className="lr-click" onClick={() => onOpenBranch(r.branch.id)}>
                  <td><strong>{r.branch.name}</strong></td>
                  <td>{r.branch.statusLabel}</td>
                  <td>{r.flow.current?.name || (r.flow.total ? '모두 완료' : '단계 없음')}</td>
                  <td><span className="lr-inline"><Bar value={r.flow.done} max={r.flow.total} /> {r.flow.done}/{r.flow.total}</span></td>
                  <td>{r.branch.dday ? `${r.branch.targetOpenDate} (${r.branch.dday.label})` : (r.branch.targetOpenDate || '-')}</td>
                  <td className="num">{won(r.money.paid)}</td>
                  <td className="num">{r.money.scheduled ? won(r.money.scheduled) : '-'}</td>
                  <td>{r.money.budget ? <span className="lr-inline"><Bar value={r.money.paid} max={r.money.budget} tone={r.money.usage > 100 ? 'bad' : 'accent'} /> {r.money.usage}%</span> : '-'}</td>
                  <td className={`num${r.alerts.some(a => a.overdue) ? ' lr-bad' : ''}`}>{r.alerts.filter(a => a.overdue).length}</td>
                  <td className="num">{r.defects.open.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="lr-note no-print">줄을 누르면 그 지점 종합 보고서로 가요.</p>
      </Section>

      <Section title="지점별 비용" count={won(totals.paid + totals.scheduled)}>
        <ul className="lr-bars">
          {reports.map(r => (
            <li key={r.branch.id}>
              <span className="lr-bars-name">{r.branch.name}</span>
              <span className="lr-stack">
                <span className="lr-stack-paid" style={{ width: `${(r.money.paid / maxPaid) * 100}%` }} />
                <span className="lr-stack-sched" style={{ width: `${(r.money.scheduled / maxPaid) * 100}%` }} />
              </span>
              <span className="lr-bars-val">{won(r.money.paid)}{r.money.scheduled ? ` + 예정 ${won(r.money.scheduled)}` : ''}</span>
            </li>
          ))}
        </ul>
        <p className="lr-legend"><i className="lr-dot-paid" /> 지급 <i className="lr-dot-sched" /> 지급 예정</p>
      </Section>

      <Section title="늦어진 일" count={overdue.length}>
        {overdue.length ? <AlertList list={overdue} withBranch /> : <Empty>늦어진 일이 없어요.</Empty>}
      </Section>
      <Section title="7일 안에 할 일" count={soon.length}>
        {soon.length ? <AlertList list={soon} withBranch /> : <Empty />}
      </Section>
      <Section title="지급 예정" count={payments.length}>
        {payments.length ? (
          <ul className="lr-list">
            {payments.map((p, i) => <li key={i}><span className="lr-date">{p.date || '날짜 없음'}</span><span className="lr-chip">{p.branch}</span> {p.title}{p.vendor ? ` (${p.vendor})` : ''}<b className="lr-right">{won(p.amount)}</b></li>)}
          </ul>
        ) : <Empty />}
      </Section>
    </>
  );
}

function AlertList({ list, withBranch }) {
  return (
    <ul className="lr-list">
      {list.map((a, i) => (
        <li key={i} className={a.overdue ? 'lr-bad-row' : ''}>
          <span className={`lr-badge${a.overdue ? ' bad' : ''}`}>{a.badge}</span>
          {withBranch && <span className="lr-chip">{a.branch}</span>} {a.title}
        </li>
      ))}
    </ul>
  );
}

/* ───────── 지점 하나 ───────── */
function BranchView({ r, range }) {
  const b = r.branch;
  const link = (tab) => `/branch/${b.id}?tab=${tab}`;
  const m = r.money;
  const maxCat = Math.max(1, ...m.byCategory.map(c => Math.max(c.paid + c.scheduled, c.budget)));
  const overdueCount = r.alerts.filter(a => a.overdue).length;

  return (
    <>
      <div className="lr-kpis">
        <Kpi label="지금 단계" value={r.flow.current?.name || (r.flow.total ? '모두 완료' : '단계 없음')} sub={`단계 ${r.flow.done}/${r.flow.total} 완료 (${r.flow.percent}%)`} />
        <Kpi label="목표 오픈일" value={b.targetOpenDate || '미정'} sub={b.dday?.label || b.statusLabel} tone={b.dday && b.dday.days < 0 ? 'bad' : undefined} />
        <Kpi label="지급한 비용" value={wonShort(m.paid)} sub={m.budget ? `예산 ${wonShort(m.budget)}의 ${m.usage}%` : '예산 미입력'} tone={m.budget && m.usage > 100 ? 'bad' : undefined} />
        <Kpi label="지급 예정" value={wonShort(m.scheduled)} sub={m.remain !== null ? `예산 남은 돈 ${wonShort(m.remain)}` : `${m.upcomingPayments.length}건`} tone={m.remain !== null && m.remain < 0 ? 'bad' : undefined} />
        <Kpi label="늦어진 일" value={`${overdueCount}건`} tone={overdueCount ? 'bad' : 'ok'} />
        <Kpi label="오픈 준비" value={`${r.tasks.done}/${r.tasks.total}`} sub={r.tasks.total ? `${Math.round((r.tasks.done / r.tasks.total) * 100)}% 끝남` : '등록 없음'} />
      </div>

      <Section title="주의할 일 (늦어진 일 · 7일 안에 할 일)" count={r.alerts.length}>
        {r.alerts.length ? <AlertList list={r.alerts} /> : <Empty>급한 일이 없어요.</Empty>}
      </Section>

      <Section title="업무 흐름 (단계별)" count={`${r.flow.done}/${r.flow.total}`} more={link('stages')}>
        {r.flow.stages.length ? (
          <>
            <ol className="lr-flow">
              {r.flow.stages.map(s => <li key={s.id} className={`lr-step lr-step-${s.status}`}><span>{s.name}</span><small>{s.statusLabel}</small></li>)}
            </ol>
            <div className="lr-table-wrap">
              <table className="lr-table">
                <thead><tr><th>단계</th><th>상태</th><th>기간</th><th>일정</th><th>체크리스트</th><th className="num">지급</th><th>빠진 서류</th></tr></thead>
                <tbody>
                  {r.flow.stages.map(s => (
                    <tr key={s.id} className={r.flow.current?.id === s.id ? 'lr-current' : ''}>
                      <td><strong>{s.name}</strong></td>
                      <td><span className={`lr-status lr-status-${s.status}`}>{s.statusLabel}</span></td>
                      <td>{s.start ? `${short(s.start)} ~ ${short(s.end)}` : '-'}</td>
                      <td>{s.schedules ? `${s.schedulesDone}/${s.schedules}` : '-'}</td>
                      <td>{s.checklist ? `${s.checklistDone}/${s.checklist}` : '-'}</td>
                      <td className="num">{s.paid ? won(s.paid) : '-'}{s.scheduled ? <small className="lr-sub"> +예정 {won(s.scheduled)}</small> : null}</td>
                      <td>{s.docsMissing.length ? <span className="lr-warn">{s.docsMissing.join(', ')}</span> : (s.docsTotal ? '✓' : '-')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : <Empty>단계가 아직 없어요.</Empty>}
      </Section>

      <Section title="비용" count={won(m.paid + m.scheduled)} more={link('cost')}>
        {m.byCategory.length ? (
          <ul className="lr-bars">
            {m.byCategory.map(c => (
              <li key={c.id}>
                <span className="lr-bars-name">{c.label}</span>
                <span className="lr-stack">
                  <span className="lr-stack-paid" style={{ width: `${(c.paid / maxCat) * 100}%` }} />
                  <span className="lr-stack-sched" style={{ width: `${(c.scheduled / maxCat) * 100}%` }} />
                  {c.budget > 0 && <span className="lr-stack-budget" style={{ left: `${Math.min(100, (c.budget / maxCat) * 100)}%` }} title={`예산 ${won(c.budget)}`} />}
                </span>
                <span className="lr-bars-val">{won(c.paid)}{c.scheduled ? ` + 예정 ${won(c.scheduled)}` : ''}{c.budget ? ` / 예산 ${won(c.budget)}` : ''}</span>
              </li>
            ))}
          </ul>
        ) : <Empty>비용 기록이 없어요.</Empty>}
        <p className="lr-legend"><i className="lr-dot-paid" /> 지급 <i className="lr-dot-sched" /> 지급 예정 <i className="lr-dot-budget" /> 예산</p>
        <div className="lr-cols">
          <div>
            <h4>{range.label} 지급 <em>{won(m.periodPaidSum)}</em></h4>
            {m.periodPaid.length ? (
              <ul className="lr-list">{m.periodPaid.map((c, i) => <li key={i}><span className="lr-date">{c.date}</span>{c.title}{c.vendor ? ` (${c.vendor})` : ''}<b className="lr-right">{won(c.amount)}</b></li>)}</ul>
            ) : <Empty>이 기간에 지급한 비용이 없어요.</Empty>}
          </div>
          <div>
            <h4>지급 예정 <em>{m.upcomingPayments.length}건</em></h4>
            {m.upcomingPayments.length ? (
              <ul className="lr-list">{m.upcomingPayments.map((c, i) => <li key={i} className={c.left !== null && c.left < 0 ? 'lr-bad-row' : ''}><span className="lr-date">{c.date || '날짜 없음'}</span>{c.title}<b className="lr-right">{won(c.amount)}</b></li>)}</ul>
            ) : <Empty />}
          </div>
        </div>
        {m.topCosts.length > 0 && (
          <>
            <h4>큰 비용 5건</h4>
            <ul className="lr-list">{m.topCosts.map((c, i) => <li key={i}><span className="lr-date">{c.date}</span>{c.title}{c.vendor ? ` (${c.vendor})` : ''}<b className="lr-right">{won(c.amount)}</b></li>)}</ul>
          </>
        )}
      </Section>

      <Section title={`${range.label}에 한 일`} count={r.schedule.doneInPeriod.length + r.logs.length} more={link('dailylog')}>
        {r.schedule.doneInPeriod.length || r.logs.length ? (
          <ul className="lr-list">
            {r.schedule.doneInPeriod.map((s, i) => <li key={`s${i}`}><span className="lr-date">{s.date}</span><span className="lr-chip ok">일정 끝냄</span> {s.title}</li>)}
            {r.logs.map((l, i) => <li key={`l${i}`}><span className="lr-date">{l.date}</span><span className="lr-chip">현장 일지</span> {l.summary || '(내용 없음)'}{l.photos ? ` · 사진 ${l.photos}장` : ''}</li>)}
          </ul>
        ) : <Empty>이 기간에 끝낸 일정이나 현장 일지가 없어요.</Empty>}
      </Section>

      <Section title="앞으로 2주 일정" count={r.schedule.upcoming.length} more={link('schedule')}>
        {r.schedule.upcoming.length ? (
          <ul className="lr-list">{r.schedule.upcoming.map((s, i) => <li key={i}><span className="lr-date">{s.start}</span>{s.title}{s.end && s.end !== s.start ? ` (~${s.end})` : ''}</li>)}</ul>
        ) : <Empty />}
        {r.schedule.afterOpen.length > 0 && <p className="lr-warn">목표 오픈일보다 늦게 끝나는 일정 {r.schedule.afterOpen.length}건: {r.schedule.afterOpen.map(s => s.title).join(', ')}</p>}
      </Section>

      <div className="lr-cols">
        <Section title="오픈 준비" count={`${r.tasks.done}/${r.tasks.total}`} more={link('tasks')}>
          {r.tasks.groups.length ? (
            <ul className="lr-bars lr-bars-small">
              {r.tasks.groups.map(g => <li key={g.group}><span className="lr-bars-name">{g.group}</span><Bar value={g.done} max={g.total} tone="ok" /><span className="lr-bars-val">{g.done}/{g.total}</span></li>)}
            </ul>
          ) : <Empty>등록된 오픈 준비가 없어요.</Empty>}
          {r.tasks.overdue.length > 0 && <AlertList list={r.tasks.overdue.map(t => ({ title: t.title, badge: `${t.due} 마감 지남`, overdue: true }))} />}
        </Section>
        <Section title="오픈 계획" count={`할 일 ${r.plans.todo} · 진행 ${r.plans.doing} · 끝 ${r.plans.done}`} more={link('plans')}>
          {r.plans.open.length ? (
            <ul className="lr-list">{r.plans.open.map((p, i) => <li key={i}><span className={`lr-chip${p.status === '진행 중' ? ' ok' : ''}`}>{p.status}</span> {p.title}{p.due ? <span className="lr-right lr-date">{p.due}까지</span> : null}</li>)}</ul>
          ) : <Empty>안 끝난 오픈 계획이 없어요.</Empty>}
        </Section>
      </div>

      <div className="lr-cols">
        <Section title="하자·A/S" count={`처리 안 됨 ${r.defects.open.length} / ${r.defects.total}`} more={link('defects')}>
          {r.defects.open.length ? (
            <ul className="lr-list">{r.defects.open.map((d, i) => <li key={i}><span className="lr-date">{d.reported}</span><span className={`lr-chip${d.status === '처리 중' ? ' ok' : ' warn'}`}>{d.status}</span> {d.title}{d.location ? ` (${d.location})` : ''}</li>)}</ul>
          ) : <Empty>처리 안 된 하자가 없어요.</Empty>}
          {r.defects.cost > 0 && <p className="lr-note">수리비 합계 {won(r.defects.cost)}</p>}
        </Section>
        <Section title="인허가·법정 시설" count={`완료 ${r.compliance.fit} / ${r.compliance.total}`} more={link('equipment')}>
          {r.compliance.pending.length ? (
            <ul className="lr-list">{r.compliance.pending.map((c, i) => <li key={i}><span className="lr-chip">{c.status}</span> {c.title}</li>)}</ul>
          ) : <Empty>{r.compliance.total ? '모두 끝났어요.' : '등록된 항목이 없어요.'}</Empty>}
        </Section>
      </div>

      <div className="lr-cols">
        <Section title="빠진 필수 서류" count={r.docs.missing.length} more={link('documents')}>
          {r.docs.missing.length ? (
            <ul className="lr-list">{r.docs.missing.map((d, i) => <li key={i}><span className="lr-chip">{d.stage}</span> {d.name}</li>)}</ul>
          ) : <Empty>빠진 필수 서류가 없어요. (올린 서류 {r.docs.total}개)</Empty>}
        </Section>
        <Section title="부족했던 점" count={`전체 ${r.shortfalls.total}`} more={link('lessons')}>
          {r.shortfalls.recent.length ? (
            <ul className="lr-list">{r.shortfalls.recent.map((s, i) => <li key={i}><span className="lr-date">{s.date}</span>{s.category && <span className="lr-chip">{s.category}</span>} {s.title}</li>)}</ul>
          ) : <Empty>{range.label}에 새로 적은 부족했던 점이 없어요.</Empty>}
        </Section>
      </div>
    </>
  );
}
