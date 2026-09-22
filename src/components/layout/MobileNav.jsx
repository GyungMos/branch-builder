import { useLocation, useNavigate } from 'react-router-dom';
import NeonIcon from '../common/NeonIcon';
import './MobileNav.css';

export default function MobileNav({ activeTab, onTabChange }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isDetailPage = location.pathname.startsWith('/branch/');

  // 지점 상세 페이지일 때의 탭
  if (isDetailPage && onTabChange) {
    const detailTabs = [
      { id: 'timeline', label: '타임라인', iconName: 'timeline', color: 'cyan' },
      { id: 'overview', label: '개요/제원', iconName: 'building', color: 'emerald' },
      { id: 'schedule', label: '일정/일지', iconName: 'calendar', color: 'blue' },
      { id: 'cost', label: '비용/예산', iconName: 'money', color: 'amber' },
      { id: 'equipment', label: '장비/시설', iconName: 'equipment', color: 'violet' },
      { id: 'partner', label: '협력업체', iconName: 'partner', color: 'coral' },
      { id: 'documents', label: '서류/사진', iconName: 'document', color: 'emerald' },
      { id: 'log', label: '활동이력', iconName: 'history', color: 'rose' },
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
            <span className="mobile-nav-icon">
              <NeonIcon name={tab.iconName} color={tab.color} size="sm" badge={false} />
            </span>
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
    </nav>
  );
}
