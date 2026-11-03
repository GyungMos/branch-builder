import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import NeonIcon from '../common/NeonIcon';
import { BRANCH_TABS, MOBILE_TABS, TAB_GROUPS } from '../../constants/branchTabs';
import './MobileNav.css';

export default function MobileNav({ activeTab, onTabChange }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const isDetailPage = location.pathname.startsWith('/branch/');

  // 지점 상세 페이지: 자주 쓰는 메뉴 5개 + '전체 메뉴' (모든 메뉴를 묶음별로 위로 펼침)
  if (isDetailPage && onTabChange) {
    const inBar = MOBILE_TABS.some(t => t.id === activeTab);
    const current = BRANCH_TABS.find(t => t.id === activeTab);
    const select = (id) => { onTabChange(id); setMoreOpen(false); };

    return (
      <>
        {moreOpen && (
          <>
            <div className="mobile-more-backdrop" onClick={() => setMoreOpen(false)} />
            <div className="mobile-more-sheet" role="menu">
              {TAB_GROUPS.map(({ group, tabs }) => (
                <div key={group} className="mobile-more-group">
                  <p className="mobile-more-group-title">{group}</p>
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      role="menuitem"
                      className={activeTab === tab.id ? 'active' : ''}
                      onClick={() => select(tab.id)}
                      id={`mobile-menu-${tab.id}`}
                    >
                      <NeonIcon name={tab.iconName} color={tab.color} size="sm" badge={false} />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
        <nav className="mobile-nav" id="mobile-nav">
          {MOBILE_TABS.map(tab => (
            <button
              key={tab.id}
              className={`mobile-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => select(tab.id)}
              id={`mobile-tab-${tab.id}`}
            >
              <span className="mobile-nav-icon">
                <NeonIcon name={tab.iconName} color={tab.color} size="sm" badge={false} />
              </span>
              <span className="mobile-nav-label">{tab.shortLabel}</span>
            </button>
          ))}
          <button
            className={`mobile-nav-item ${!inBar || moreOpen ? 'active' : ''}`}
            onClick={() => setMoreOpen(o => !o)}
            aria-expanded={moreOpen}
            id="mobile-tab-more"
          >
            <span className="mobile-nav-icon mobile-nav-more-icon" aria-hidden="true">☰</span>
            <span className="mobile-nav-label">{!inBar && current ? current.shortLabel : '전체 메뉴'}</span>
          </button>
        </nav>
      </>
    );
  }

  // 메인 페이지
  return (
    <nav className="mobile-nav" id="mobile-nav-main">
      <button
        className={`mobile-nav-item ${location.pathname === '/' ? 'active' : ''}`}
        onClick={() => navigate('/')}
      >
        <span className="mobile-nav-icon">
          <NeonIcon name="building" color="emerald" size="sm" badge={false} />
        </span>
        <span className="mobile-nav-label">지점 목록</span>
      </button>
      <button
        className={`mobile-nav-item ${location.pathname === '/dashboard' ? 'active' : ''}`}
        onClick={() => navigate('/dashboard')}
      >
        <span className="mobile-nav-icon">
          <NeonIcon name="dashboard" color="cyan" size="sm" badge={false} />
        </span>
        <span className="mobile-nav-label">대시보드</span>
      </button>
      <button
        className={`mobile-nav-item ${location.pathname === '/compare' ? 'active' : ''}`}
        onClick={() => navigate('/compare')}
      >
        <span className="mobile-nav-icon">
          <NeonIcon name="chart" color="amber" size="sm" badge={false} />
        </span>
        <span className="mobile-nav-label">지점 비교</span>
      </button>
      <button
        className={`mobile-nav-item ${location.pathname === '/settings' ? 'active' : ''}`}
        onClick={() => navigate('/settings')}
      >
        <span className="mobile-nav-icon">
          <NeonIcon name="settings" color="cyan" size="sm" badge={false} />
        </span>
        <span className="mobile-nav-label">설정</span>
      </button>
    </nav>
  );
}
