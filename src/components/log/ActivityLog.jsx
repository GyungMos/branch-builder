import { formatRelativeTime } from '../../utils/formatters';
import NeonIcon from '../common/NeonIcon';
import './ActivityLog.css';

const ACTION_NEON_CONFIG = {
  branch_update: { name: 'edit', color: 'cyan' },
  stage_add: { name: 'document', color: 'emerald' },
  stage_update: { name: 'sync', color: 'cyan' },
  stage_delete: { name: 'trash', color: 'rose' },
  schedule_add: { name: 'calendar', color: 'blue' },
  schedule_update: { name: 'calendar', color: 'blue' },
  schedule_delete: { name: 'trash', color: 'rose' },
  cost_add: { name: 'money', color: 'amber' },
  cost_update: { name: 'money', color: 'amber' },
  cost_delete: { name: 'trash', color: 'rose' },
  document_upload: { name: 'document', color: 'violet' },
  document_delete: { name: 'trash', color: 'rose' },
  checklist_toggle: { name: 'check', color: 'emerald' },
};

export default function ActivityLog({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <NeonIcon name="log" size="lg" color="amber" badge={true} />
        </div>
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
            {dateLogs.map(log => {
              const iconCfg = ACTION_NEON_CONFIG[log.action] || { name: 'pin', color: 'cyan' };
              return (
                <div key={log.id} className="log-item" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flexShrink: 0 }}>
                    <NeonIcon name={iconCfg.name} color={iconCfg.color} size="xs" badge={true} />
                  </div>
                  <div className="log-content">
                    <span className="log-detail">{log.detail}</span>
                    <span className="log-meta">
                      {log.userName} · {formatRelativeTime(log.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
