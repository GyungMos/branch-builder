import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardData } from '../hooks/useDashboardData';
import { useBranches } from '../hooks/useFirestore';
import { formatCurrency, formatRelativeTime } from '../utils/formatters';
import { BRANCH_STATUS, COST_CATEGORIES } from '../utils/constants';
import { daysUntilDue } from '../utils/costs';
import { buildAlerts } from '../utils/alerts';
import BranchForm from '../components/branch/BranchForm';
import LocalDataSyncBanner from '../components/common/LocalDataSyncBanner';
import './DashboardPage.css';

/**
 * 전체 지점 대시보드: '이번 주 할 일'과 '지점별 지금 단계' 중심으로 단순화
 */
export default function DashboardPage() {
  const navigate = useNavigate();
  const {
    loading,
    branchesSummary,
    allSchedules = [],
    scheduledPayments = [],
    allOpenTasks = [],
    allOpenPlans = [],
    costByCategory,
    totalCost,
    recentActivities,
    refetch,
  } = useDashboardData();

  const { addBranch } = useBranches();
  const [showAddModal, setShowAddModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  // 이번 주 할 일: 기한 지난 것 + 7일 안에 시작·마감·지급인 일정·지급 예정·오픈 준비·오픈 계획
  const weekTasks = useMemo(
    () => buildAlerts({ schedules: allSchedules, costs: scheduledPayments, openTasks: allOpenTasks, openPlans: allOpenPlans }, { days: 7 }),
    [allSchedules, scheduledPayments, allOpenTasks, allOpenPlans],
  );

  const filteredBranches = branchesSummary.filter(b => statusFilter === 'all' || b.status === statusFilter);
  const countBy = (st) => branchesSummary.filter(b => b.status === st).length;
  const scheduledTotal = scheduledPayments.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const overdueCount = weekTasks.filter(t => t.kind === 'overdue').length;
  const maxBranchCost = Math.max(...branchesSummary.map(b => b.totalCost), 1);

  const handleAddBranch = async (data) => {
    try {
      await addBranch(data);
      setShowAddModal(false);
      refetch();
    } catch (err) {
      console.error('Failed to add branch:', err);
    }
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  return (
    <div className="page dashboard-page" id="dashboard-page">
      <LocalDataSyncBanner onSynced={refetch} />

      <div className="dashboard-header">
        <div className="dashboard-title-group">
          <h1>전체 지점 현황</h1>
          <p className="dash-summary-line">
            지점 {branchesSummary.length}곳 (진행중 {countBy('progress')} · 계획 {countBy('planning')} · 완료 {countBy('complete')})
            {' · '}쓴 비용 {formatCurrency(totalCost)}
            {scheduledPayments.length > 0 && <> · 지급 예정 {formatCurrency(scheduledTotal)}</>}
          </p>
        </div>
        <div className="dashboard-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/compare')}>지점 비교 보고서</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>+ 새 지점 추가</button>
        </div>
      </div>

      {branchesSummary.length === 0 ? (
        <div className="card-static empty-state" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 'var(--space-xs)' }}>등록된 지점이 없습니다</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
            첫 정비소 지점을 등록하고 임대차 계약부터 오픈까지 단계별로 기록해 보세요.
          </p>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ 첫 지점 등록하기</button>
        </div>
      ) : (
        <div className="dashboard-grid-layout">
          <div className="dashboard-main-col">
            {/* 1. 이번 주 할 일 */}
            <section className="dashboard-section">
              <div className="section-header">
                <h2 className="section-title">이번 주 할 일</h2>
                <span className={`section-badge ${overdueCount ? 'warn' : ''}`}>
                  {weekTasks.length}건{overdueCount ? ` · 지난 것 ${overdueCount}건` : ''}
                </span>
              </div>
              {weekTasks.length === 0 ? (
                <div className="dashboard-empty">이번 주에 챙길 일정·지급·오픈 준비가 없어요.</div>
              ) : (
                <ul className="week-task-list">
                  {weekTasks.map(t => (
                    <li key={t.key}>
                      <button type="button" className={`week-task ${t.kind}`} onClick={() => navigate(`/branch/${t.branchId}?tab=${t.tab}`)}>
                        <span className="branch-tag">{t.branchName}</span>
                        <span className="week-task-title">{t.title}</span>
                        <span className="week-task-badge">{t.badge}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 2. 지점별 지금 단계 */}
            <section className="dashboard-section">
              <div className="section-header">
                <h2 className="section-title">지점별 지금 단계</h2>
                <div className="status-filter-group">
                  {[['all', `전체 ${branchesSummary.length}`], ['progress', `진행중 ${countBy('progress')}`], ['planning', `계획중 ${countBy('planning')}`], ['complete', `완료 ${countBy('complete')}`]].map(([key, label]) => (
                    <button key={key} className={`status-filter-btn ${statusFilter === key ? 'active' : ''}`} onClick={() => setStatusFilter(key)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredBranches.length > 0 ? (
                <div className="branch-summary-grid">
                  {filteredBranches.map(branch => (
                    <button
                      type="button"
                      key={branch.id}
                      className="branch-summary-card"
                      onClick={() => navigate(`/branch/${branch.id}`)}
                    >
                      <div className="branch-card-top">
                        <span className="branch-name">{branch.name}</span>
                        <span className={`badge badge-${BRANCH_STATUS[branch.status]?.color || 'neutral'}`}>
                          {BRANCH_STATUS[branch.status]?.label || '계획중'}
                        </span>
                      </div>
                      <div className="branch-stage-info">
                        <span className="stage-name">지금: <strong>{branch.currentStage}</strong></span>
                        <span className="progress-pct">{branch.completedStagesCount}/{branch.stagesCount} 단계</span>
                      </div>
                      <div className="branch-progress-bar-bg">
                        <div className="branch-progress-bar-fill" style={{ width: `${branch.progress}%` }} />
                      </div>
                      {branch.openTasksCount > 0 && (
                        <div className="branch-open-progress">
                          <span className="branch-open-label">오픈 준비 <strong>{branch.openTasksDone}/{branch.openTasksCount}</strong></span>
                          <span className="branch-open-bar" aria-hidden="true">
                            <span style={{ width: `${Math.round((branch.openTasksDone / branch.openTasksCount) * 100)}%` }} />
                          </span>
                          <span className="branch-open-pct">{Math.round((branch.openTasksDone / branch.openTasksCount) * 100)}%</span>
                        </div>
                      )}
                      {branch.openPlansCount > 0 && (
                        <div className="branch-open-plans">오픈 계획 진행 중 {branch.openPlansDoing} · 완료 {branch.openPlansDone}/{branch.openPlansCount}</div>
                      )}
                      <div className="branch-card-stats">
                        <span>쓴 비용 {formatCurrency(branch.totalCost)}</span>
                        <span className="branch-next">
                          {branch.upcomingSchedules.length > 0 ? `다음: ${branch.upcomingSchedules[0].title}` : '다음 일정 없음'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="dashboard-empty">선택한 상태의 지점이 없습니다.</div>
              )}
            </section>

            {/* 3. 비용 분석 (필요할 때 펼쳐 보기) */}
            <details className="dashboard-section dashboard-details">
              <summary className="section-title">비용 분석 펼쳐 보기</summary>
              <div className="cost-ranking-list" style={{ marginTop: 'var(--space-md)' }}>
                {[...branchesSummary].sort((a, b) => b.totalCost - a.totalCost).map(branch => (
                  <div key={branch.id} className="cost-ranking-item">
                    <div className="cost-ranking-header">
                      <span style={{ fontWeight: 600 }}>{branch.name}</span>
                      <strong>{formatCurrency(branch.totalCost)}</strong>
                    </div>
                    <div className="cost-ranking-bar-bg">
                      <div className="cost-ranking-bar-fill" style={{ width: `${Math.round((branch.totalCost / maxBranchCost) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="category-cost-grid" style={{ marginTop: 'var(--space-lg)' }}>
                {COST_CATEGORIES.map(cat => {
                  const amount = costByCategory[cat.id] || 0;
                  const share = totalCost > 0 ? Math.round((amount / totalCost) * 100) : 0;
                  return (
                    <div key={cat.id} className="category-cost-card">
                      <div className="category-cost-card-top"><span style={{ fontWeight: 600 }}>{cat.label}</span></div>
                      <div className="category-cost-card-amount">{formatCurrency(amount)}</div>
                      <div className="category-cost-card-share">비중 {share}%</div>
                    </div>
                  );
                })}
              </div>
            </details>
          </div>

          <div className="dashboard-side-col">
            {/* 지급 예정 전체 */}
            <section className="dashboard-section">
              <div className="section-header">
                <h2 className="section-title">지급 예정</h2>
                <span className="section-badge">{scheduledPayments.length}건 · {formatCurrency(scheduledTotal)}</span>
              </div>
              {scheduledPayments.length > 0 ? (
                <ul className="week-task-list">
                  {scheduledPayments.slice(0, 8).map(c => {
                    const days = daysUntilDue(c);
                    return (
                      <li key={`${c.branchId}-${c.id}`}>
                        <button type="button" className={`week-task ${days !== null && days < 0 ? 'overdue' : 'payment'}`} onClick={() => navigate(`/branch/${c.branchId}?tab=cost`)}>
                          <span className="branch-tag">{c.branchName}</span>
                          <span className="week-task-title">{c.title} · {formatCurrency(Number(c.amount) || 0)}</span>
                          <span className="week-task-badge">
                            {days === null ? '날짜 없음' : days < 0 ? `${-days}일 지남` : days === 0 ? '오늘' : `D-${days}`}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="dashboard-empty">지급 예정인 비용이 없어요. 비용을 넣을 때 '지급 예정'을 고르면 여기에 모여요.</div>
              )}
            </section>

            {/* 최근 활동 */}
            <section className="dashboard-section">
              <div className="section-header">
                <h2 className="section-title">최근 활동</h2>
              </div>
              {recentActivities.length > 0 ? (
                <ul className="recent-activity-plain">
                  {recentActivities.map(act => (
                    <li key={act.id}>
                      <span className="branch-tag">{act.branchName}</span> {act.detail || act.description}
                      <div className="activity-meta-line">
                        {act.userName || '담당자'} · {formatRelativeTime(act.createdAt?.toDate ? act.createdAt.toDate() : act.createdAt)}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="dashboard-empty">최근 활동 내역이 없습니다.</div>
              )}
            </section>
          </div>
        </div>
      )}

      {showAddModal && (
        <BranchForm
          onSubmit={handleAddBranch}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
