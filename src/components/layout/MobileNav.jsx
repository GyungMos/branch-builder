import { useLocation, useNavigate } from 'react-router-dom';
import './MobileNav.css';

export default function MobileNav({ activeTab, onTabChange }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isDetailPage = location.pathname.startsWith('/branch/');

  // 지점 상세 페이지일 때의 탭
  if (isDetailPage && onTabChange) {
    const detailTabs = [
      { id: 'overview', label: '개요/제원', icon: '🏢' },
      { id: 'schedule', label: '일정/일지', icon: '📅' },
      { id: 'cost', label: '비용/예산', icon: '💰' },
      { id: 'equipment', label: '장비/시설', icon: '⚙️' },
      { id: 'partner', label: '협력업체', icon: '👥' },
      { id: 'documents', label: '서류/사진', icon: '📁' },
      { id: 'log', label: '이력', icon: '⚡' },
    ];

    return (
      <nav className="mobile-nav" id="mobile-nav" style={{ overflowX: 'auto', justifyContent: 'flex-start', padding: '0 8px' }}>
        {detailTabs.map(tab => (
          <button
            key={tab.id}
            className={`mobile-nav-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            id={`mobile-tab-${tab.id}`}
            style={{ minWidth: 54, flexShrink: 0 }}
          >
            <span className="mobile-nav-icon">{tab.icon}</span>
            <span className="mobile-nav-label" style={{ fontSize: 10 }}>{tab.label}</span>
          </button>
        ))}
      </nav>
    );
  }

  // 메인 페이지
  return (
    <nav className="mobile-nav" id="mobile-nav-main">
      <button
        className={`mobile-nav-item ${location.pathname === '/' ? 'active' : ''}`}
        onClick={() => navigate('/')}
      >
        <span className="mobile-nav-icon">🏢</span>
        <span className="mobile-nav-label">지점</span>
      </button>
    </nav>
  );
}
