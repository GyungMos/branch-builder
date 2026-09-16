import { formatRelativeTime } from '../../utils/formatters';
import './ActivityLog.css';

const ACTION_ICONS = {
  branch_update: '✏️',
  stage_add: '📋',
  stage_update: '🔄',
  stage_delete: '🗑️',
  schedule_add: '📅',
  schedule_update: '📅',
  schedule_delete: '🗑️',
  cost_add: '💰',
  cost_update: '💰',
  cost_delete: '🗑️',
  document_upload: '📁',
  document_delete: '🗑️',
  checklist_toggle: '✅',
};

export default function ActivityLog({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📝</div>
        <div className="empty-state-title">활동 내역이 없습니다</div>
        <div className="empty-state-desc">데이터를 추가하거나 수정하면 이력이 기록됩니다</div>
      </div>
    );
  }

  // 날짜별 그룹핑
  const grouped = {};
  logs.forEach(log => {
    const date = new Date(log.createdAt?.toDate ? log.createdAt.toDate() : log.createdAt);
    const dateKey = date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(log);
  });

  return (
    <div className="activity-log" id="activity-log">
      {Object.entries(grouped).map(([dateKey, dateLogs]) => (
        <div key={dateKey} className="log-date-group">
          <div className="log-date-header">{dateKey}</div>
          <div className="log-items">
            {dateLogs.map(log => (
              <div key={log.id} className="log-item">
                <span className="log-icon">{ACTION_ICONS[log.action] || '📌'}</span>
                <div className="log-content">
                  <span className="log-detail">{log.detail}</span>
                  <span className="log-meta">
                    {log.userName} · {formatRelativeTime(log.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
