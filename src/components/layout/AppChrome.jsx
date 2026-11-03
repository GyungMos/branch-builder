import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useMembers } from '../../hooks/useSettings';
import { autoBackupIfDue } from '../../utils/cloudBackup';
import Header from './Header';
import AppSidebar from './AppSidebar';

const DESKTOP = '(min-width: 769px)';

function useIsDesktop() {
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia(DESKTOP).matches);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const on = () => setDesktop(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return desktop;
}

/**
 * 화면 틀: PC는 왼쪽 전체 메뉴, 휴대폰은 위쪽 머리말 (+ 아래쪽 메뉴 막대는 각 화면에서)
 * 관리자가 열면 일주일에 한 번 자동 백업
 */
export default function AppChrome() {
  const desktop = useIsDesktop();
  const { user, demoMode } = useAuth();
  const { isAdmin } = useMembers();
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    if (demoMode || !user || !isAdmin) return;
    autoBackupIfDue().catch(err => console.warn('자동 백업 실패:', err));
  }, [demoMode, user, isAdmin]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (!desktop) return <Header />;
  return (
    <>
      <AppSidebar />
      {!online && !demoMode && (
        <div className="sb-offline" role="status">인터넷이 끊겼어요. 지금 쓰는 내용은 이 기기에 먼저 저장되고, 연결되면 자동으로 올라가요.</div>
      )}
    </>
  );
}
