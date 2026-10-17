import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBranches } from '../hooks/useFirestore';
import { useAuth } from '../contexts/AuthContext';
import { loadBranchData } from '../utils/branchData';
import { computeBranchStageStats, average } from '../utils/branchCompare';
import { DEFAULT_STAGES, STAGE_STATUS } from '../utils/constants';
import { formatCurrency, formatDateShort } from '../utils/formatters';
import './ComparePage.css';

const LESSON_LABELS = { good: '잘된 점', bad: '아쉬운 점', next: '다음 지점에서는' };

function Cell({ row }) {
  if (!row || (!row.days && !row.cost && !row.status)) return <span className="cmp-empty">—</span>;
  return (
    <div className="cmp-cell">
      <span className="cmp-days">{row.days ? `${row.days}일` : '기간 없음'}</span>
      <span className="cmp-cost">{row.cost ? formatCurrency(row.cost) : '비용 없음'}</span>
      {row.status && <span className={`cmp-status ${row.status}`}>{STAGE_STATUS[row.status]?.label || row.status}</span>}
    </div>
  );
}

/**
 * 지점 비교 보고서: 표준 단계별로 지점마다 걸린 기간·쓴 비용을 나란히 비교하고,
 * 각 지점이 남긴 '다음 지점을 위한 메모'를 단계별로 모아 보여줌
 */
export default function ComparePage() {
  const { demoMode } = useAuth();
  const { branches, loading: branchesLoading } = useBranches();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(() => new Set());

  useEffect(() => {
    if (branchesLoading) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const result = {};
      await Promise.all(branches.map(async b => {
        const data = await loadBranchData(b.id, demoMode, ['stages', 'schedules', 'costs']);
        result[b.id] = computeBranchStageStats(data);
      }));
      if (!cancelled) {
        setStats(result);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [branches, branchesLoading, demoMode]);

  const shown = useMemo(
    () => branches.filter(b => !hidden.has(b.id) && stats[b.id]),
    [branches, hidden, stats]
  );

  const toggle = (id) => setHidden(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  if (loading || branchesLoading) {
    return <div className="loading-overlay"><div className="spinner spinner-lg" /></div>;
  }

  const lessonsByStage = DEFAULT_STAGES.map((std, i) => ({
    name: std.name,
    items: shown.flatMap(b => (stats[b.id].rows[i].lessons || []).map(l => ({ branch: b, lessons: l }))),
  })).filter(g => g.items.length > 0);

  return (
    <div className="page compare-page">
      <div className="compare-header">
        <div>
          <h1 className="page-title">지점 비교 보고서</h1>
          <p className="text-secondary">
            단계마다 걸린 기간과 쓴 비용을 지점끼리 비교해요. 다음 지점의 예산과 일정을 잡을 때 참고하세요.
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm no-print" onClick={() => window.print()}>
          인쇄 / PDF 저장
        </button>
      </div>

      {branches.length === 0 ? (
        <div className="card-static">등록된 지점이 없어요.</div>
      ) : (
        <>
          <div className="compare-branch-toggles no-print" aria-label="비교할 지점">
            {branches.map(b => (
              <label key={b.id} className={`cmp-toggle ${hidden.has(b.id) ? '' : 'on'}`}>
                <input type="checkbox" checked={!hidden.has(b.id)} onChange={() => toggle(b.id)} />
                <span>{b.name}</span>
              </label>
            ))}
          </div>

          <div className="compare-table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th scope="col" className="cmp-stage-col">단계</th>
                  {shown.map(b => (
                    <th key={b.id} scope="col">
                      <Link to={`/branch/${b.id}`} className="cmp-branch-link">{b.name}</Link>
                    </th>
                  ))}
                  {shown.length > 1 && <th scope="col" className="cmp-avg-col">평균 (완료 단계)</th>}
                </tr>
              </thead>
              <tbody>
                {DEFAULT_STAGES.map((std, i) => {
                  // 평균은 실제로 끝난(완료) 단계만으로 계산 → 계획만 잡힌 지점이 섞이지 않게
                  const doneRows = shown.map(b => stats[b.id].rows[i]).filter(r => r.status === 'complete');
                  const avgDays = average(doneRows.map(r => r.days));
                  const avgCost = average(doneRows.map(r => r.cost));
                  return (
                    <tr key={std.name}>
                      <th scope="row" className="cmp-stage-col">
                        <span className="cmp-stage-num">{i + 1}</span>{std.name}
                      </th>
                      {shown.map(b => (
                        <td key={b.id}><Cell row={stats[b.id].rows[i]} /></td>
                      ))}
                      {shown.length > 1 && (
                        <td className="cmp-avg-col">
                          {avgDays || avgCost ? (
                            <div className="cmp-cell">
                              <span className="cmp-days">{avgDays ? `${avgDays}일` : '—'}</span>
                              <span className="cmp-cost">{avgCost ? formatCurrency(avgCost) : '—'}</span>
                              <span className="cmp-range">완료 {doneRows.length}곳 기준</span>
                            </div>
                          ) : <span className="cmp-empty">—</span>}
                        </td>
                      )}
                    </tr>
                  );
                })}
                <tr className="cmp-sub-row">
                  <th scope="row" className="cmp-stage-col">단계 없는 비용</th>
                  {shown.map(b => (
                    <td key={b.id}>
                      {stats[b.id].unlinkedCost + stats[b.id].otherCost
                        ? formatCurrency(stats[b.id].unlinkedCost + stats[b.id].otherCost)
                        : <span className="cmp-empty">—</span>}
                    </td>
                  ))}
                  {shown.length > 1 && <td className="cmp-avg-col" />}
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" className="cmp-stage-col">전체</th>
                  {shown.map(b => {
                    const s = stats[b.id];
                    return (
                      <td key={b.id}>
                        <div className="cmp-cell">
                          <span className="cmp-days">{s.totalDays ? `${s.totalDays}일` : '기간 없음'}</span>
                          <span className="cmp-cost">{formatCurrency(s.totalCost)}</span>
                          {s.firstStart && (
                            <span className="cmp-range">{formatDateShort(s.firstStart)} ~ {formatDateShort(s.lastEnd)}</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  {shown.length > 1 && <td className="cmp-avg-col" />}
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="compare-note">
            · 기간은 각 단계에 연결된 일정의 첫 시작일부터 마지막 종료일까지예요. 단계를 고르지 않은 일정은 빠져요.<br />
            · 평균은 '완료'로 표시된 단계만으로 계산해요. 계획만 잡힌 일정은 평균에 넣지 않아요.<br />
            · 단계 이름이 표준과 다르면 비슷한 이름끼리 묶어요.
          </p>

          <section className="compare-lessons">
            <h2>단계별 "다음 지점을 위한 메모" 모음</h2>
            {lessonsByStage.length === 0 ? (
              <p className="text-secondary">
                아직 남긴 메모가 없어요. 지점 → 단계별 기록 → 각 단계 맨 아래에서 남길 수 있어요.
              </p>
            ) : (
              lessonsByStage.map(g => (
                <div key={g.name} className="compare-lesson-group">
                  <h3>{g.name}</h3>
                  {g.items.map(({ branch, lessons }, idx) => (
                    <div key={`${branch.id}-${idx}`} className="compare-lesson-card">
                      <div className="compare-lesson-branch">{branch.name}</div>
                      {Object.entries(LESSON_LABELS).map(([key, label]) => (
                        lessons[key] ? (
                          <p key={key} className={`compare-lesson-line ${key}`}>
                            <strong>{label}</strong> {lessons[key]}
                          </p>
                        ) : null
                      ))}
                    </div>
                  ))}
                </div>
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}
