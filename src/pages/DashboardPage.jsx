import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardData } from '../hooks/useDashboardData';
import { useBranches } from '../hooks/useFirestore';
import { formatCurrency, formatDate, getDDay, formatRelativeTime } from '../utils/formatters';
import { BRANCH_STATUS, COST_CATEGORIES } from '../utils/constants';
import BranchForm from '../components/branch/BranchForm';
import NeonIcon from '../components/common/NeonIcon';
import LocalDataSyncBanner from '../components/common/LocalDataSyncBanner';
import './DashboardPage.css';

export default function DashboardPage() {
  const navigate = useNavigate();
  const {
    loading,
    branchesSummary,
    upcomingSchedules,
    costByCategory,
    totalCost,
    avgCost,
    recentActivities,
    refetch,
  } = useDashboardData();

  const { addBranch } = useBranches();
  const [showAddModal, setShowAddModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  // 지점 필터링
  const filteredBranches = branchesSummary.filter(b => {
    if (statusFilter === 'all') return true;
    return b.status === statusFilter;
  });

  // KPI 계산
  const totalBranchesCount = branchesSummary.length;
  const progressBranchesCount = branchesSummary.filter(b => b.status === 'progress').length;
  const completedBranchesCount = branchesSummary.filter(b => b.status === 'complete').length;
  const planningBranchesCount = branchesSummary.filter(b => b.status === 'planning').length;

  const avgProgress = totalBranchesCount > 0
    ? Math.round(branchesSummary.reduce((sum, b) => sum + (b.progress || 0), 0) / totalBranchesCount)
    : 0;

  // 최대 비용 지점 (비율 계산용)
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
    <div className="page dashboard-page animate-fade-in" id="dashboard-page">
      <LocalDataSyncBanner onSynced={refetch} />
      {/* 상단 타이틀 & 컨트롤 */}
      <div className="dashboard-header">
        <div className="dashboard-title-group">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <NeonIcon name="dashboard" color="cyan" size="md" />
            <span>전체 지점 통합 대시보드</span>
          </h1>
          <p>모든 정비소 지점의 공정 현황, 누적 비용, 다가오는 일정을 한눈에 파악합니다.</p>
        </div>
        <div className="dashboard-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => refetch()} title="데이터 새로고침">
            <NeonIcon name="sync" size="xs" badge={false} /> 새로고침
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <NeonIcon name="building" size="xs" badge={false} /> 지점 목록 보기
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
            + 새 지점 추가
          </button>
        </div>
      </div>

      {/* 핵심 KPI 카드 요약 */}
      <div className="kpi-grid stagger-children">
        <div className="kpi-card" style={{ '--kpi-accent': '#10b981' }}>
          <NeonIcon name="building" color="emerald" size="md" />
          <div className="kpi-content">
            <div className="kpi-label">총 운영 및 오픈 지점</div>
            <div className="kpi-value">{totalBranchesCount} <span style={{ fontSize: 'var(--text-sm)', fontWeight: 400 }}>개소</span></div>
            <div className="kpi-sub">
              진행중 {progressBranchesCount} · 완료 {completedBranchesCount} · 계획 {planningBranchesCount}
            </div>
          </div>
        </div>

        <div className="kpi-card" style={{ '--kpi-accent': '#f59e0b' }}>
          <NeonIcon name="money" color="amber" size="md" />
          <div className="kpi-content">
            <div className="kpi-label">전체 누적 집행 비용</div>
            <div className="kpi-value">{formatCurrency(totalCost)}</div>
            <div className="kpi-sub">
              지점당 평균 {formatCurrency(avgCost)}
            </div>
          </div>
        </div>

        <div className="kpi-card" style={{ '--kpi-accent': '#3b82f6' }}>
          <NeonIcon name="calendar" color="blue" size="md" />
          <div className="kpi-content">
            <div className="kpi-label">다가오는 주요 일정</div>
            <div className="kpi-value">{upcomingSchedules.length} <span style={{ fontSize: 'var(--text-sm)', fontWeight: 400 }}>건</span></div>
            <div className="kpi-sub">
              D-Day 임박 및 이번 주 예정 일정
            </div>
          </div>
        </div>

        <div className="kpi-card" style={{ '--kpi-accent': '#06b6d4' }}>
          <NeonIcon name="dashboard" color="cyan" size="md" />
          <div className="kpi-content">
            <div className="kpi-label">전체 평균 공정률</div>
            <div className="kpi-value">{avgProgress}%</div>
            <div className="kpi-sub">
              공정 단계 기준 완료 진척도
            </div>
          </div>
        </div>
      </div>

      {totalBranchesCount === 0 && (
        <div className="card-static empty-state animate-fade-in-up" style={{ marginBottom: 'var(--space-xl)', textAlign: 'center', padding: 'var(--space-2xl)' }}>
          <NeonIcon name="building" color="emerald" size="xl" style={{ margin: '0 auto 12px' }} />
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 'var(--space-xs)' }}>등록된 지점이 없습니다</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', maxWidth: 460, margin: '0 auto var(--space-lg)' }}>
            첫 정비소 지점을 등록하여 부지 탐색부터 일정, 비용, 서류, 단계별 오픈 공정을 체계적으로 관리해보세요.
          </p>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <span>+</span> 첫 지점 등록하기
          </button>
        </div>
      )}

      {/* 대시보드 2단 레이아웃 (좌측: 지점 비교 & 비용 분석 / 우측: 통합 일정 & 최근 활동) */}
      <div className="dashboard-grid-layout">
        {/* 좌측 영역 */}
        <div className="dashboard-main-col">
          {/* 1. 지점별 오픈 현황 & 진행률 비교 */}
          <div className="dashboard-section">
            <div className="section-header">
              <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <NeonIcon name="building" color="emerald" size="xs" badge={true} />
                <span>지점별 진행 현황</span>
                <span className="section-badge">{filteredBranches.length}개 지점</span>
              </div>
              <div className="status-filter-group">
                <button
                  className={`status-filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('all')}
                >
                  전체 ({totalBranchesCount})
                </button>
                <button
                  className={`status-filter-btn ${statusFilter === 'progress' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('progress')}
                >
                  진행중 ({progressBranchesCount})
                </button>
                <button
                  className={`status-filter-btn ${statusFilter === 'planning' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('planning')}
                >
                  계획중 ({planningBranchesCount})
                </button>
                <button
                  className={`status-filter-btn ${statusFilter === 'complete' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('complete')}
                >
                  완료 ({completedBranchesCount})
                </button>
              </div>
            </div>

            {filteredBranches.length > 0 ? (
              <div className="branch-summary-grid">
                {filteredBranches.map(branch => (
                  <div
                    key={branch.id}
                    className="branch-summary-card"
                    onClick={() => navigate(`/branch/${branch.id}`)}
                    title="클릭하여 지점 상세로 이동"
                  >
                    <div className="branch-card-top">
                      <span className="branch-name">{branch.name}</span>
                      <span className={`badge badge-${BRANCH_STATUS[branch.status]?.color || 'neutral'}`}>
                        {BRANCH_STATUS[branch.status]?.label || '계획중'}
                      </span>
                    </div>

                    <div className="branch-address">{branch.address || '주소 미입력'}</div>

                    <div className="branch-stage-info">
                      <span className="stage-name" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <NeonIcon name="building" size="xs" color="emerald" badge={false} />
                        {branch.currentStage}
                      </span>
                      <span className="progress-pct">{branch.progress}%</span>
                    </div>

                    <div className="branch-progress-bar-bg">
                      <div
                        className="branch-progress-bar-fill"
                        style={{ width: `${branch.progress}%` }}
                      />
                    </div>

                    <div className="branch-card-stats">
                      <div>
                        누적 비용: <span className="branch-cost-highlight">{formatCurrency(branch.totalCost)}</span>
                      </div>
                      {branch.upcomingSchedules.length > 0 ? (
                        <div className="branch-upcoming-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <NeonIcon name="calendar" size="xs" color="blue" badge={false} />
                          <span>{branch.upcomingSchedules[0].title}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>일정 없음</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dashboard-empty">
                선택한 상태의 지점이 없습니다.
              </div>
            )}
          </div>

          {/* 2. 지점별 비용 분석 비교 */}
          <div className="dashboard-section">
            <div className="section-header">
              <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <NeonIcon name="money" color="amber" size="xs" badge={true} />
                <span>지점별 비용 집행 비교</span>
              </div>
              <span className="section-badge">총 {formatCurrency(totalCost)}</span>
            </div>

            {branchesSummary.some(b => b.totalCost > 0) ? (
              <div className="cost-ranking-list">
                {[...branchesSummary]
                  .sort((a, b) => b.totalCost - a.totalCost)
                  .map(branch => {
                    const pct = maxBranchCost > 0 ? Math.round((branch.totalCost / maxBranchCost) * 100) : 0;
                    return (
                      <div key={branch.id} className="cost-ranking-item" onClick={() => navigate(`/branch/${branch.id}`)} style={{ cursor: 'pointer' }}>
                        <div className="cost-ranking-header">
                          <span style={{ fontWeight: 600 }}>{branch.name}</span>
                          <span>
                            <strong style={{ color: 'var(--color-primary)' }}>{formatCurrency(branch.totalCost)}</strong>
                            {totalCost > 0 && (
                              <span style={{ color: 'var(--color-text-muted)', marginLeft: 6 }}>
                                ({Math.round((branch.totalCost / totalCost) * 100)}%)
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="cost-ranking-bar-bg">
                          <div className="cost-ranking-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="dashboard-empty">
                아직 등록된 비용 데이터가 없습니다.
              </div>
            )}

            {/* 카테고리별 비용 비중 카드 */}
            <div style={{ marginTop: 'var(--space-6)' }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <NeonIcon name="chart" color="cyan" size="xs" badge={true} />
                <span>전체 카테고리별 비용 집행 분포</span>
              </div>
              <div className="category-cost-grid">
                {COST_CATEGORIES.map(cat => {
                  const amount = costByCategory[cat.id] || 0;
                  const share = totalCost > 0 ? Math.round((amount / totalCost) * 100) : 0;
                  return (
                    <div key={cat.id} className="category-cost-card">
                      <div className="category-cost-card-top" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <NeonIcon name={cat.iconName || 'budget'} color={cat.color || 'emerald'} size="xs" badge={true} />
                        <span style={{ fontWeight: 600 }}>{cat.label}</span>
                      </div>
                      <div className="category-cost-card-amount">{formatCurrency(amount)}</div>
                      <div className="category-cost-card-share">비중 {share}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 우측 사이드바 영역 */}
        <div className="dashboard-side-col">
          {/* 3. 통합 다가오는 일정 */}
          <div className="dashboard-section">
            <div className="section-header">
              <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <NeonIcon name="calendar" color="blue" size="xs" badge={true} />
                <span>다가오는 전 지점 일정</span>
              </div>
              <span className="section-badge">{upcomingSchedules.length}건</span>
            </div>

            {upcomingSchedules.length > 0 ? (
              <div className="schedule-summary-list">
                {upcomingSchedules.map(sch => {
                  const dday = sch.endDate
                    ? getDDay(sch.endDate.toDate ? sch.endDate.toDate() : sch.endDate)
                    : (sch.startDate ? getDDay(sch.startDate.toDate ? sch.startDate.toDate() : sch.startDate) : null);
                  const isUrgent = dday && (dday.text === 'D-Day' || (dday.days >= 0 && dday.days <= 3));

                  return (
                    <div
                      key={sch.id}
                      className="schedule-summary-item"
                      onClick={() => navigate(`/branch/${sch.branchId}`)}
                      style={{ cursor: 'pointer' }}
                      title={`${sch.branchName} 상세 보기`}
                    >
                      <div className="schedule-item-main">
                        <span className="branch-tag">{sch.branchName}</span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="schedule-item-title">{sch.title}</div>
                          <div className="schedule-item-date" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span>{formatDate(sch.startDate?.toDate ? sch.startDate.toDate() : sch.startDate)}</span>
                            {sch.assignee && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                · <NeonIcon name="partner" size="xs" color="violet" badge={false} />
                                <span>{sch.assignee}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {dday && (
                        <span className={`badge ${isUrgent ? 'badge-danger' : 'badge-info'}`}>
                          {dday.text}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="dashboard-empty" style={{ padding: 'var(--space-4)' }}>
                예정된 일정이 없습니다.
              </div>
            )}
          </div>

          {/* 4. 최근 통합 활동 이력 */}
          <div className="dashboard-section">
            <div className="section-header">
              <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <NeonIcon name="history" color="violet" size="xs" badge={true} />
                <span>최근 활동 타임라인</span>
              </div>
            </div>

            {recentActivities.length > 0 ? (
              <div className="recent-activity-list">
                {recentActivities.map(act => (
                  <div key={act.id} className="recent-activity-item">
                    <div className="activity-icon-bullet">
                      {act.type?.includes('cost') ? <NeonIcon name="money" color="amber" size="xs" badge={true} /> :
                       act.type?.includes('schedule') ? <NeonIcon name="calendar" color="blue" size="xs" badge={true} /> :
                       act.type?.includes('stage') ? <NeonIcon name="building" color="emerald" size="xs" badge={true} /> :
                       act.type?.includes('doc') ? <NeonIcon name="document" color="violet" size="xs" badge={true} /> :
                       <NeonIcon name="log" color="cyan" size="xs" badge={true} />}
                    </div>
                    <div className="activity-text-group">
                      <div className="activity-text-line">
                        <span className="branch-tag" style={{ marginRight: 6 }}>{act.branchName}</span>
                        {act.description}
                      </div>
                      <div className="activity-meta-line">
                        {act.userName || '담당자'} · {formatRelativeTime(act.createdAt?.toDate ? act.createdAt.toDate() : act.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dashboard-empty" style={{ padding: 'var(--space-4)' }}>
                최근 활동 내역이 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 새 지점 추가 모달 */}
      {showAddModal && (
        <BranchForm
          onSubmit={handleAddBranch}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
