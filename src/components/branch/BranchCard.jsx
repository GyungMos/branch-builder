import { useNavigate } from 'react-router-dom';
import { BRANCH_STATUS } from '../../utils/constants';
import { formatRelativeTime, formatCurrency } from '../../utils/formatters';
import NeonIcon from '../common/NeonIcon';
import './BranchCard.css';

export default function BranchCard({ branch, onClick, onDelete }) {
  const navigate = useNavigate();
  const status = BRANCH_STATUS[branch.status] || BRANCH_STATUS.planning;

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete();
  };

  const handleTimelineClick = (e) => {
    e.stopPropagation();
    navigate(`/branch/${branch.id}/timeline`);
  };

  const progress = branch.progress !== undefined ? branch.progress : 0;

  return (
    <div className="branch-card card" onClick={onClick} id={`branch-card-${branch.id}`}>
      <div className="branch-card-header">
        <div className="branch-card-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NeonIcon name="building" color="emerald" size="sm" badge={false} />
            <h3 className="branch-card-name">{branch.name}</h3>
          </div>
          {branch.address && (
            <p className="branch-card-address" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <NeonIcon name="pin" size="xs" color="rose" badge={false} />
              <span>{branch.address}</span>
            </p>
          )}
        </div>
        <span className={`badge badge-${status.color}`}>
          {status.label}
        </span>
      </div>

      {branch.description && (
        <p className="branch-card-desc">{branch.description}</p>
      )}

      {/* 공정 진행률 바 (있을 때) */}
      {progress > 0 && (
        <div className="branch-card-progress-box">
          <div className="branch-card-progress-header">
            <span className="text-xs text-secondary">공정 진행률</span>
            <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--color-accent)' }}>{progress}%</span>
          </div>
          <div className="progress-bar" style={{ height: 4 }}>
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* 하단 푸터 & 퀵 액션 */}
      <div className="branch-card-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="branch-card-time text-xs text-tertiary">
            {branch.createdAt ? formatRelativeTime(branch.createdAt) : '방금 전'}
          </span>
          {branch.totalCost > 0 && (
            <span className="badge badge-subtle tabular-nums text-xs" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24' }}>
              {formatCurrency(branch.totalCost)}
            </span>
          )}
        </div>

        <div className="branch-card-actions" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            className="btn btn-secondary btn-sm branch-card-timeline-btn"
            onClick={handleTimelineClick}
            title="타임라인 피드로 직행"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', fontSize: 11 }}
          >
            <NeonIcon name="timeline" color="cyan" size="sm" badge={false} />
            <span>타임라인</span>
          </button>
          <button
            className="btn btn-ghost btn-sm branch-card-delete"
            onClick={handleDelete}
            aria-label="지점 삭제"
            title="지점 삭제"
            style={{ padding: '4px' }}
          >
            <NeonIcon name="trash" color="rose" size="sm" badge={false} />
          </button>
        </div>
      </div>
    </div>
  );
}
