import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useBranchNav } from '../../contexts/BranchNavContext';
import { useBranches } from '../../hooks/useFirestore';
import { useMembers } from '../../hooks/useSettings';
import { TAB_GROUPS } from '../../constants/branchTabs';
import { openDday } from '../../utils/openDate';
import { exportAllDataAsJSON } from '../../utils/backupRestore';
import { downloadCloudBackup } from '../../utils/cloudBackup';
import NeonIcon from '../common/NeonIcon';
import AlertBell from './AlertBell';
import './AppSidebar.css';

const COLLAPSE_KEY = 'bb_sidebar_collapsed';

/** 메뉴 한 줄: 아이콘 칸 + 이름 (+ 오른쪽 작은 표시) */
function Item({ icon, color = 'emerald', label, active, onClick, extra, small = false, collapsed }) {
  return (
    <button
      type="button"
      className={`sb-item ${active ? 'active' : ''} ${small ? 'small' : ''}`}
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-current={active ? 'page' : undefined}
    >
      <span className="sb-icon"><NeonIcon name={icon} color={color} size="sm" badge={false} /></span>
      {!collapsed && <span className="sb-label">{label}</span>}
      {!collapsed && extra}
    </button>
  );
}

/**
 * PC 화면 왼쪽 전체 메뉴: 로고 · 내 계정 · 메인 메뉴 · 지점(지금 지점은 펼쳐서 세부 메뉴) · 관리 · 아래쪽 백업/화면/로그아웃
 * 접기(<)를 누르면 아이콘만 남음 (이 기기에 기억)
 */
export default function AppSidebar() {
  const { user, logout, demoMode } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { branches } = useBranches();
  const { isAdmin } = useMembers();
  const { counts } = useBranchNav();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem(COLLAPSE_KEY);
      return saved === null ? window.innerWidth < 1100 : saved === '1';
    } catch { return false; }
  });
  const [backingUp, setBackingUp] = useState(false);
  const [folded, setFolded] = useState(null); // 지금 지점 세부 메뉴를 접어 둔 경우 그 지점 번호

  useEffect(() => {
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* 저장 공간 없음 */ }
  }, [collapsed]);

  useEffect(() => {
    document.body.classList.add('with-sidebar');
    return () => document.body.classList.remove('with-sidebar', 'sidebar-collapsed');
  }, []);

  const path = location.pathname;
  const branchMatch = /^\/branch\/([^/]+)/.exec(path);
  const currentBranchId = branchMatch ? branchMatch[1] : null;
  const currentTab = params.get('tab') || (path.endsWith('/timeline') ? 'timeline' : 'stages');
  const name = user?.displayName || user?.email?.split('@')[0] || '';
  const role = demoMode ? '데모' : isAdmin ? '관리자' : '직원';

  const backup = async () => {
    if (demoMode) {
      const r = exportAllDataAsJSON();
      if (!r.success) alert('백업 생성 중 오류가 발생했습니다: ' + r.error);
      return;
    }
    setBackingUp(true);
    try {
      await downloadCloudBackup();
    } catch (err) {
      alert('백업 파일을 만들지 못했어요: ' + err.message);
    } finally {
      setBackingUp(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <aside className={`app-sidebar ${collapsed ? 'collapsed' : ''}`} aria-label="전체 메뉴">
      <div className="sb-brand">
        <button type="button" className="sb-logo" onClick={() => navigate('/dashboard')} title="대시보드">
          <span className="sb-logo-tile"><NeonIcon name="building" color="emerald" size="sm" badge={false} /></span>
          {!collapsed && (
            <span className="sb-logo-text">
              <strong>Branch Builder</strong>
              <small>지점 오픈 관리</small>
            </span>
          )}
        </button>
        <button type="button" className="sb-collapse" onClick={() => setCollapsed(c => !c)} aria-label={collapsed ? '메뉴 펼치기' : '메뉴 접기'} title={collapsed ? '메뉴 펼치기' : '메뉴 접기'}>
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      <div className="sb-user">
        <div className="sb-user-row">
          <span className="sb-avatar" aria-hidden="true">{name.slice(0, 1) || '?'}</span>
          {!collapsed && (
            <span className="sb-user-text">
              <strong>{name}</strong>
              <small>{demoMode ? '이 기기에만 저장' : '클라우드 연동'}</small>
            </span>
          )}
          {!collapsed && user && <AlertBell />}
        </div>
        {!collapsed && (
          <div className="sb-user-chip">
            <span className="sb-user-id">{user?.email || '데모 계정'}</span>
            <span className={`sb-role ${isAdmin || demoMode ? 'admin' : ''}`}>{role}</span>
          </div>
        )}
        {collapsed && user && <div className="sb-collapsed-bell"><AlertBell /></div>}
      </div>

      <nav className="sb-scroll">
        <p className="sb-section">{collapsed ? '·' : '메인'}</p>
        <Item collapsed={collapsed} icon="dashboard" color="cyan" label="대시보드" active={path === '/dashboard'} onClick={() => navigate('/dashboard')} />
        <Item collapsed={collapsed} icon="building" label="지점 목록" active={path === '/'} onClick={() => navigate('/')} />
        <Item collapsed={collapsed} icon="chart" color="violet" label="지점 비교" active={path === '/compare'} onClick={() => navigate('/compare')} />
        <Item collapsed={collapsed} icon="search" color="cyan" label="통합 검색" active={path === '/search'} onClick={() => navigate('/search')} />

        <p className="sb-section">{collapsed ? '·' : `지점 (${branches.length})`}</p>
        {branches.map(b => {
          const here = b.id === currentBranchId;
          const open = here && folded !== b.id;
          const dday = openDday(b);
          return (
            <div key={b.id} className={`sb-branch ${open ? 'open' : ''}`}>
              <Item
                collapsed={collapsed}
                icon="home"
                color={here ? 'cyan' : 'emerald'}
                label={b.name}
                active={here && (collapsed || !open)}
                // 지금 지점을 다시 누르면 세부 메뉴 접기/펼치기, 다른 지점은 그 지점으로 이동
                onClick={() => {
                  if (here) setFolded(f => (f === b.id ? null : b.id));
                  else { setFolded(null); navigate(`/branch/${b.id}`); }
                }}
                extra={<>
                  {dday && <span className={`sb-dday ${dday.days < 0 ? 'late' : dday.days <= 14 ? 'soon' : ''}`}>{dday.label}</span>}
                  <span className="sb-caret">{open ? '▾' : '▸'}</span>
                </>}
              />
              {open && !collapsed && (
                <div className="sb-sub">
                  {TAB_GROUPS.map(({ group, tabs }) => (
                    <div key={group} className="sb-sub-group">
                      <p className="sb-sub-title">{group}</p>
                      {tabs.map(t => (
                        <Item
                          key={t.id}
                          small
                          icon={t.iconName}
                          color={t.color}
                          label={t.label}
                          active={currentTab === t.id}
                          onClick={() => navigate(`/branch/${b.id}?tab=${t.id}`)}
                          extra={counts[t.id] > 0 ? <span className="sb-count">{counts[t.id]}</span> : null}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <p className="sb-section">{collapsed ? '·' : '관리'}</p>
        <Item collapsed={collapsed} icon="settings" color="cyan" label="설정" active={path === '/settings' && !['trash', 'backup'].includes(params.get('tab'))} onClick={() => navigate('/settings')} />
        <Item collapsed={collapsed} icon="trash" color="rose" label="휴지통" active={path === '/settings' && params.get('tab') === 'trash'} onClick={() => navigate('/settings?tab=trash')} />
        {(isAdmin && !demoMode) && (
          <Item collapsed={collapsed} icon="sync" label="자동 백업" active={path === '/settings' && params.get('tab') === 'backup'} onClick={() => navigate('/settings?tab=backup')} />
        )}
      </nav>

      <div className="sb-bottom">
        <div className="sb-bottom-row">
          <button type="button" className="sb-btn" onClick={backup} title="전체 기록을 파일로 내려받기">
            <NeonIcon name="download" color="emerald" size="xs" badge={false} />
            {!collapsed && <span>{backingUp ? '모으는 중…' : '백업'}</span>}
          </button>
          <button type="button" className="sb-btn" onClick={toggleTheme} title="밝게/어둡게">
            <NeonIcon name={theme === 'dark' ? 'sun' : 'moon'} color={theme === 'dark' ? 'amber' : 'cyan'} size="xs" badge={false} />
            {!collapsed && <span>{theme === 'dark' ? '라이트' : '다크'}</span>}
          </button>
        </div>
        <button type="button" className="sb-logout" onClick={handleLogout} title="로그아웃">{collapsed ? '⎋' : '로그아웃'}</button>
      </div>
    </aside>
  );
}
