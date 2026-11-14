import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import NeonIcon from '../common/NeonIcon';
import { BRANCH_MENUS, MOBILE_MENUS, menuOfView } from '../../constants/branchTabs';
import './MobileNav.css';

export default function MobileNav({ activeTab, onTabChange }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const isDetailPage = location.pathname.startsWith('/branch/');

  // 지점 상세 페이지: 자주 쓰는 메뉴 5개 + '전체 메뉴' (메뉴 8개를 위로 펼침)
  if (isDetailPage && onTabChange) {
    const current = menuOfView(activeTab);
    const inBar = MOBILE_MENUS.some(m => m.id === current.id);
    const select = (menu) => { onTabChange(menu.views[0].id); setMoreOpen(false); };

    return (
      <>
        {moreOpen && (
          <>
            <div className="mobile-more-backdrop" onClick={() => setMoreOpen(false)} />
            <div className="mobile-more-sheet" role="menu">
              {BRANCH_MENUS.map(m => (
                <button
                  key={m.id}
                  type="button"
                  role="menuitem"
                  className={current.id === m.id ? 'active' : ''}
                  onClick={() => select(m)}
                  id={`mobile-menu-${m.id}`}
                >
                  <NeonIcon name={m.iconName} color={m.color} size="sm" badge={false} />
                  <span>{m.label}</span>
                  {m.views.length > 1 && <span className="mobile-more-sub">{m.views.map(v => v.label).join(' · ')}</span>}
                </button>
              ))}
            </div>
          </>
        )}
        <nav className="mobile-nav" id="mobile-nav">
          {MOBILE_MENUS.map(m => (
            <button
              key={m.id}
              className={`mobile-nav-item ${current.id === m.id ? 'active' : ''}`}
              onClick={() => select(m)}
              id={`mobile-tab-${m.id}`}
            >
              <span className="mobile-nav-icon">
                <NeonIcon name={m.iconName} color={m.color} size="sm" badge={false} />
              </span>
              <span className="mobile-nav-label">{m.shortLabel}</span>
            </button>
          ))}
          <button
            className={`mobile-nav-item ${!inBar || moreOpen ? 'active' : ''}`}
            onClick={() => setMoreOpen(o => !o)}
            aria-expanded={moreOpen}
            id="mobile-tab-more"
          >
            <span className="mobile-nav-icon mobile-nav-more-icon" aria-hidden="true">☰</span>
            <span className="mobile-nav-label">{!inBar ? current.shortLabel : '전체 메뉴'}</span>
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
        className={`mobile-nav-item ${location.pathname === '/reports' ? 'active' : ''}`}
        onClick={() => navigate('/reports')}
      >
        <span className="mobile-nav-icon">
          <NeonIcon name="document" color="cyan" size="sm" badge={false} />
        </span>
        <span className="mobile-nav-label">보고서함</span>
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
