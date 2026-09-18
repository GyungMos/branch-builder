import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import NeonIcon from '../common/NeonIcon';
import './Header.css';

export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout, demoMode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const isDetailPage = location.pathname.startsWith('/branch/');
  const isDashboard = location.pathname === '/dashboard';
  const isBranchList = location.pathname === '/';

  return (
    <header className="header" id="main-header">
      <div className="header-inner">
        <div className="header-left">
          {isDetailPage && (
            <button className="btn-ghost btn-icon header-back" onClick={() => navigate('/')} aria-label="뒤로가기">
              ←
            </button>
          )}
          <div className="header-logo" onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NeonIcon name="building" color="emerald" size="sm" />
            <span className="header-logo-text">Branch Builder</span>
          </div>

          <nav className="header-nav">
            <button
              className={`header-nav-btn ${isDashboard ? 'active' : ''}`}
              onClick={() => navigate('/dashboard')}
              id="nav-dashboard-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <NeonIcon name="dashboard" color={isDashboard ? 'cyan' : 'emerald'} size="sm" badge={false} />
              <span>대시보드</span>
            </button>
            <button
              className={`header-nav-btn ${isBranchList ? 'active' : ''}`}
              onClick={() => navigate('/')}
              id="nav-branches-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <NeonIcon name="building" color={isBranchList ? 'cyan' : 'emerald'} size="sm" badge={false} />
              <span>지점 목록</span>
            </button>
          </nav>
        </div>

        <div className="header-right">
          <button
            className="btn-ghost btn-icon theme-toggle"
            onClick={toggleTheme}
            aria-label="테마 전환"
            id="theme-toggle"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          
          {demoMode ? (
            <span
              className="sync-status-badge badge-demo"
              title="Firebase 미설정 - 현재 기기(로컬)에만 저장됩니다"
              style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '12px', background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', border: '1px solid rgba(234, 179, 8, 0.3)', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'default' }}
            >
              🟡 로컬 저장
            </span>
          ) : (
            <span
              className="sync-status-badge badge-cloud"
              title="Firebase 클라우드 연동 완료 - 모든 기기에서 실시간 동기화됩니다"
              style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'default' }}
            >
              🟢 클라우드 연동
            </span>
          )}

          {user && (
            <div className="header-user">
              <span className="header-user-name">{user.displayName || user.email?.split('@')[0]}</span>
              <button className="btn-ghost btn-sm" onClick={handleLogout} id="logout-btn">
                로그아웃
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

