import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useBranches } from '../hooks/useFirestore';
import { useAuth } from '../contexts/AuthContext';
import { loadBranchData } from '../utils/branchData';
import { BRANCH_STATUS, STAGE_STATUS } from '../utils/constants';
import { formatCurrency, formatDate, formatDateShort } from '../utils/formatters';
import './BranchReportPage.css';

const UNLINKED = '__unlinked__';
const LESSON_LABELS = { good: '잘된 점', bad: '아쉬운 점', next: '다음 지점에서는' };

function toDate(val) {
  if (!val) return null;
  const d = val.toDate ? val.toDate() : new Date(val);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function period(start, end) {
  if (!start) return '기간 미정';
  if (!end || start.getTime() === end.getTime()) return formatDate(start);
  return `${formatDate(start)} ~ ${formatDate(end)} (${Math.round((end - start) / 86400000) + 1}일)`;
}

const isDone = (s) => s.status === 'completed' || s.status === 'complete';
const isImage = (d) => d.fileType?.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(d.fileName || d.name || '');

/**
 * 단계별 보고서 (인쇄·PDF 저장용). ?stage=단계id 로 한 단계만 볼 수 있음
 */
export default function BranchReportPage() {
  const { branchId } = useParams();
  const [searchParams] = useSearchParams();
  const onlyStage = searchParams.get('stage');
  const { demoMode } = useAuth();
  const { branches, loading: branchesLoading } = useBranches();
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadBranchData(branchId, demoMode).then(d => { if (!cancelled) setData(d); });
    return () => { cancelled = true; };
  }, [branchId, demoMode]);

  const branch = branches.find(b => b.id === branchId);

  const sections = useMemo(() => {
    if (!data) return [];
    const stages = [...(data.stages || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    const ids = new Set(stages.map(s => s.id));
    const keyOf = (x) => (x.stageId && ids.has(x.stageId) ? x.stageId : UNLINKED);
    const make = (stage) => ({ stage, schedules: [], costs: [], documents: [], logs: [] });
    const map = Object.fromEntries(stages.map(s => [s.id, make(s)]));
    map[UNLINKED] = make(null);

    (data.schedules || []).forEach(s => map[keyOf(s)].schedules.push({ ...s, start: toDate(s.startDate), end: toDate(s.endDate) || toDate(s.startDate) }));
    (data.costs || []).forEach(c => map[keyOf(c)].costs.push({ ...c, when: toDate(c.date || c.createdAt) }));
    (data.documents || []).forEach(d => map[keyOf(d)].documents.push({ ...d, when: toDate(d.createdAt) }));

    const list = [...stages.map(s => map[s.id]), map[UNLINKED]];
    list.forEach(g => {
      g.schedules.sort((a, b) => (a.start || 0) - (b.start || 0));
      g.costs.sort((a, b) => (a.when || 0) - (b.when || 0));
      g.costTotal = g.costs.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
      const starts = g.schedules.map(s => s.start).filter(Boolean);
      const ends = g.schedules.map(s => s.end).filter(Boolean);
      g.start = starts.length ? new Date(Math.min(...starts)) : null;
      g.end = ends.length ? new Date(Math.max(...ends)) : null;
    });

    // 현장 일지: 고른 단계 우선, 단계 없는 일지는 단계 일정 기간으로 분류
    (data.dailyLogs || []).forEach(l => {
      const when = toDate(l.date);
      let g = l.stageId && ids.has(l.stageId) ? map[l.stageId] : null;
      if (!g && when) g = list.find(x => x.stage && x.start && when >= x.start && when <= (x.end || x.start));
      (g || map[UNLINKED]).logs.push({ ...l, when });
    });
    list.forEach(g => g.logs.sort((a, b) => (a.when || 0) - (b.when || 0)));

    return list.filter(g => g.stage || g.schedules.length || g.costs.length || g.documents.length || g.logs.length);
  }, [data]);

  if (!data || branchesLoading) {
    return <div className="loading-overlay"><div className="spinner spinner-lg" /></div>;
  }
  if (!branch) {
    return <div className="page"><div className="card-static">지점을 찾을 수 없어요. <Link to="/">지점 목록으로</Link></div></div>;
  }

  const shownSections = onlyStage ? sections.filter(g => g.stage?.id === onlyStage) : sections;
  const totalCost = (data.costs || []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const allStarts = sections.map(g => g.start).filter(Boolean);
  const allEnds = sections.map(g => g.end).filter(Boolean);
  const p = branch.property || {};

  return (
    <div className="page report-page">
      <div className="report-toolbar no-print">
        <Link to={`/branch/${branchId}`} className="btn btn-ghost btn-sm">← 지점으로 돌아가기</Link>
        {onlyStage && <Link to={`/branch/${branchId}/report`} className="btn btn-ghost btn-sm">전체 단계 보기</Link>}
        <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>인쇄 / PDF 저장</button>
      </div>
      <p className="report-tip no-print">인쇄 창에서 '대상'을 'PDF로 저장'으로 고르면 파일로 저장돼요.</p>

      <header className="report-head">
        <div className="report-kicker">{onlyStage ? '단계 보고서' : '지점 오픈 기록 보고서'}</div>
        <h1>{branch.name}{onlyStage && shownSections[0] ? ` — ${shownSections[0].stage.name}` : ''}</h1>
        {branch.address && <p>{branch.address}</p>}
        <dl className="report-facts">
          <div><dt>상태</dt><dd>{BRANCH_STATUS[branch.status]?.label || '계획중'}</dd></div>
          <div><dt>전체 기간</dt><dd>{allStarts.length ? period(new Date(Math.min(...allStarts)), new Date(Math.max(...allEnds))) : '—'}</dd></div>
          <div><dt>총 비용</dt><dd>{formatCurrency(totalCost)}</dd></div>
          <div><dt>출력일</dt><dd>{formatDate(new Date())}</dd></div>
        </dl>
        {!onlyStage && (p.landArea || p.deposit || p.monthlyRent || p.zoning) && (
          <p className="report-property">
            {p.landArea && <>대지 {p.landArea}㎡ · </>}
            {p.zoning && <>{p.zoning} · </>}
            {p.deposit && <>보증금 {formatCurrency(Number(p.deposit))} · </>}
            {p.monthlyRent && <>월 임대료 {formatCurrency(Number(p.monthlyRent))}</>}
          </p>
        )}
      </header>

      {shownSections.map((g, idx) => {
        const st = g.stage;
        const checklist = st?.checklist || [];
        const lessons = st?.lessons || {};
        const hasLessons = Object.keys(LESSON_LABELS).some(k => lessons[k]);
        return (
          <section key={st?.id || 'unlinked'} className="report-section">
            <h2>
              {st ? `${onlyStage ? '' : `${idx + 1}. `}${st.name}` : '단계 미지정 기록'}
              {st && <span className={`report-status ${st.status || 'waiting'}`}>{STAGE_STATUS[st.status || 'waiting']?.label}</span>}
            </h2>
            <p className="report-meta">
              기간 {period(g.start, g.end)} · 비용 {formatCurrency(g.costTotal)} · 일정 {g.schedules.filter(isDone).length}/{g.schedules.length} 완료
              {checklist.length > 0 && ` · 체크리스트 ${checklist.filter(c => c.done).length}/${checklist.length}`}
            </p>

            {checklist.length > 0 && (
              <ul className="report-checklist">
                {checklist.map(c => <li key={c.id} className={c.done ? 'done' : ''}>{c.done ? '☑' : '☐'} {c.text}</li>)}
              </ul>
            )}

            {g.schedules.length > 0 && (
              <table className="report-table">
                <caption>일정</caption>
                <thead><tr><th>공정</th><th>기간</th><th>담당</th><th>완료</th></tr></thead>
                <tbody>
                  {g.schedules.map(s => (
                    <tr key={s.id}>
                      <td>{s.title}{s.memo && <div className="report-sub">{s.memo}</div>}</td>
                      <td className="nowrap">{s.start ? formatDateShort(s.start) : '-'}{s.end && s.start && s.end.getTime() !== s.start.getTime() ? ` ~ ${formatDateShort(s.end)}` : ''}</td>
                      <td>{s.assignee || ''}</td>
                      <td className="center">{isDone(s) ? '✓' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {g.costs.length > 0 && (
              <table className="report-table">
                <caption>비용</caption>
                <thead><tr><th>날짜</th><th>내용</th><th>거래처</th><th className="right">금액</th></tr></thead>
                <tbody>
                  {g.costs.map(c => (
                    <tr key={c.id}>
                      <td className="nowrap">{c.when ? formatDateShort(c.when) : '-'}</td>
                      <td>{c.title}</td>
                      <td>{c.vendor || ''}</td>
                      <td className="right nowrap">{formatCurrency(Number(c.amount) || 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td colSpan={3}>합계</td><td className="right nowrap">{formatCurrency(g.costTotal)}</td></tr></tfoot>
              </table>
            )}

            {g.logs.length > 0 && (
              <div className="report-block">
                <h3>현장 일지</h3>
                <ul className="report-logs">
                  {g.logs.map(l => (
                    <li key={l.id}>
                      <strong>{l.when ? formatDateShort(l.when) : ''}</strong> {l.summary}
                      {l.workersCount ? ` (${l.workersCount}명)` : ''}
                      {l.issues && <div className="report-issue">이슈: {l.issues}</div>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {g.documents.length > 0 && (
              <div className="report-block">
                <h3>서류·사진</h3>
                <div className="report-docs">
                  {g.documents.map(d => (
                    <figure key={d.id}>
                      {isImage(d) && d.fileUrl ? <img src={d.fileUrl} alt={d.fileName || ''} /> : <span className="report-doc-icon">📄</span>}
                      <figcaption>{d.fileName || d.name}</figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            )}

            {hasLessons && (
              <div className="report-block report-lessons">
                <h3>다음 지점을 위한 메모</h3>
                {Object.entries(LESSON_LABELS).map(([k, label]) => lessons[k] ? (
                  <p key={k} className={k}><strong>{label}</strong> {lessons[k]}</p>
                ) : null)}
              </div>
            )}

            {st && !g.schedules.length && !g.costs.length && !g.logs.length && !g.documents.length && !checklist.length && !hasLessons && (
              <p className="report-sub">기록 없음</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
