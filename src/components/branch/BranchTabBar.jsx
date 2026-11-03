import NeonIcon from '../common/NeonIcon';
import { TAB_GROUPS } from '../../constants/branchTabs';

/**
 * 지점 상세 왼쪽 메뉴 목록 (PC). 휴대폰은 MobileNav가 대신함
 * counts: { tabId: 숫자 } 메뉴 옆에 작게 보여 줄 개수 (예: 처리 안 된 하자)
 */
export default function BranchTabBar({ activeTab, onChange, counts = {} }) {
  return (
    <nav className="branch-side-nav" id="branch-tabs" aria-label="지점 메뉴">
      {TAB_GROUPS.map(({ group, tabs }) => (
        <div key={group} className="branch-side-group">
          <p className="branch-side-group-title">{group}</p>
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={`branch-side-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => onChange(tab.id)}
              id={`tab-${tab.id}`}
            >
              <NeonIcon name={tab.iconName} color={tab.color} size="sm" badge={false} />
              <span className="branch-side-label">{tab.label}</span>
              {counts[tab.id] > 0 && <span className="branch-side-count">{counts[tab.id]}</span>}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
