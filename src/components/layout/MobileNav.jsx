import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import NeonIcon from '../common/NeonIcon';
import { PRIMARY_TABS, MORE_TABS } from '../../constants/branchTabs';
import './MobileNav.css';

export default function MobileNav({ activeTab, onTabChange }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const isDetailPage = location.pathname.startsWith('/branch/');

  // 지점 상세 페이지: 자주 쓰는 탭 4개 + '더보기' (나머지 탭은 위로 펼쳐지는 목록)
  if (isDetailPage && onTabChange) {
    const activeMore = MORE_TABS.find(t => t.id === activeTab);
    const select = (id) => { onTabChange(id); setMoreOpen(false); };

    return (
      <>
        {moreOpen && (
          <>
            <div className="mobile-more-backdrop" onClick={() => setMoreOpen(false)} />
            <div className="mobile-more-sheet" role="menu">
              {MORE_TABS.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  role="menuitem"
                  className={activeTab === tab.id ? 'active' : ''}
                  onClick={() => select(tab.id)}
                  id={`mobile-tab-${tab.id}`}
                >
                  <NeonIcon name={tab.iconName} color={tab.color} size="sm" badge={false} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
        <nav className="mobile-nav" id="mobile-nav">
          {PRIMARY_TABS.map(tab => (
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
            className={`mobile-nav-item ${activeMore || moreOpen ? 'active' : ''}`}
            onClick={() => setMoreOpen(o => !o)}
            aria-expanded={moreOpen}
            id="mobile-tab-more"
          >
            <span className="mobile-nav-icon mobile-nav-more-icon" aria-hidden="true">⋯</span>
            <span className="mobile-nav-label">{activeMore ? activeMore.shortLabel : '더보기'}</span>
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
    </nav>
  );
}
