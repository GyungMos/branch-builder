import { useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useBranches } from '../../hooks/useFirestore';
import { exportAllDataAsJSON, importDataFromJSON } from '../../utils/backupRestore';
import NeonIcon from '../common/NeonIcon';
import './Header.css';

export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout, demoMode } = useAuth();
  const { branches } = useBranches();
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef(null);

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

  // 현재 상세 지점 ID 추출
  const pathParts = location.pathname.split('/');
  const currentBranchId = isDetailPage ? pathParts[2] : null;
  const isTimelineView = isDetailPage && location.pathname.endsWith('/timeline');

  const handleBranchSwitch = (e) => {
    const targetId = e.target.value;
    if (!targetId) return;
    if (isTimelineView) {
      navigate(`/branch/${targetId}/timeline`);
    } else {
      navigate(`/branch/${targetId}`);
    }
  };

  // 백업 다운로드
  const handleExportBackup = () => {
    const result = exportAllDataAsJSON();
    if (result.success) {
      alert(`총 ${result.keyCount}개 데이터 항목이 성공적으로 백업 파일(JSON)로 저장되었습니다.`);
    } else {
      alert('백업 생성 중 오류가 발생했습니다: ' + result.error);
    }
  };

  // 복원 업로드
  const handleImportFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('기존 데이터에 백업 파일의 내용을 복원하시겠습니까?')) {
      e.target.value = '';
      return;
    }

    try {
      const res = await importDataFromJSON(file);
      alert(`총 ${res.restoredCount}개의 데이터 항목이 복원되었습니다. 페이지를 새로고침합니다.`);
      window.location.reload();
    } catch (err) {
      alert('데이터 복원 실패: ' + err.message);
    } finally {
      e.target.value = '';
    }
  };

  return (
    <header className="header" id="main-header">
      <div className="header-inner">
        <div className="header-left">
          {isDetailPage && (
            <button className="btn-ghost btn-icon header-back" onClick={() => navigate('/')} aria-label="뒤로가기" title="지점 목록으로">
              ←
            </button>
          )}
          <div className="header-logo" onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <NeonIcon name="building" color="emerald" size="sm" />
            <span className="header-logo-text">Branch Builder</span>
          </div>

          {/* 지점 상세일 때: 지점 빠른 전환 셀렉터 */}
          {isDetailPage && branches.length > 0 && (
            <div className="header-branch-switcher">
              <span className="header-branch-switcher-label text-xs text-tertiary">지점 전환:</span>
              <select
                className="header-branch-select"
                value={currentBranchId || ''}
                onChange={handleBranchSwitch}
                title="다른 지점으로 즉시 이동"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

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
          {/* 데이터 백업 & 복원 도구 */}
          <div className="header-backup-tools">
            <button
              className="btn btn-secondary btn-sm header-backup-btn"
              onClick={handleExportBackup}
              title="전체 지점 데이터 JSON 백업 다운로드"
            >
              <NeonIcon name="download" color="emerald" size="sm" badge={false} />
              <span>백업</span>
            </button>
            <button
              className="btn btn-secondary btn-sm header-backup-btn"
              onClick={() => fileInputRef.current?.click()}
              title="백업 파일(JSON) 불러와 데이터 복원"
            >
              <NeonIcon name="upload" color="cyan" size="sm" badge={false} />
              <span>복원</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".json"
              onChange={handleImportFileChange}
            />
          </div>

          <button
            className="btn-ghost btn-icon theme-toggle"
            onClick={toggleTheme}
            aria-label="테마 전환"
            id="theme-toggle"
            title="테마 전환"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {theme === 'dark' ? (
              <NeonIcon name="sun" size="xs" color="amber" badge={false} />
            ) : (
              <NeonIcon name="moon" size="xs" color="cyan" badge={false} />
            )}
          </button>
          
          {demoMode ? (
            <span
              className="sync-status-badge badge-demo"
              title="Firebase 미설정 - 현재 기기(로컬)에만 저장됩니다"
              style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '12px', background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', border: '1px solid rgba(234, 179, 8, 0.3)', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'default' }}
            >
              <NeonIcon name="document" size="xs" color="amber" badge={false} />
              <span>로컬 저장</span>
            </span>
          ) : (
            <span
              className="sync-status-badge badge-cloud"
              title="Firebase 클라우드 연동 완료 - 모든 기기에서 실시간 동기화됩니다"
              style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'default' }}
            >
              <NeonIcon name="sync" size="xs" color="emerald" badge={false} />
              <span>클라우드 연동</span>
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

