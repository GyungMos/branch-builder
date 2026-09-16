import { BRANCH_STATUS } from '../../utils/constants';
import { formatRelativeTime } from '../../utils/formatters';
import './BranchCard.css';

export default function BranchCard({ branch, onClick, onDelete }) {
  const status = BRANCH_STATUS[branch.status] || BRANCH_STATUS.planning;

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <div className="branch-card card" onClick={onClick} id={`branch-card-${branch.id}`}>
      <div className="branch-card-header">
        <div className="branch-card-info">
          <h3 className="branch-card-name">{branch.name}</h3>
          {branch.address && (
            <p className="branch-card-address">{branch.address}</p>
          )}
        </div>
        <span className={`badge badge-${status.color}`}>
          {status.label}
        </span>
      </div>

      {branch.description && (
        <p className="branch-card-desc">{branch.description}</p>
      )}

      <div className="branch-card-footer">
        <span className="branch-card-time">
          {branch.createdAt ? formatRelativeTime(branch.createdAt) : '방금 전'}
        </span>
        <button
          className="btn btn-ghost btn-sm branch-card-delete"
          onClick={handleDelete}
          aria-label="삭제"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
