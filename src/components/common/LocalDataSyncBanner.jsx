import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { syncLocalDataToFirestore, downloadLocalBackup, clearLocalData } from '../../utils/syncLocalData';
import NeonIcon from './NeonIcon';
import './LocalDataSyncBanner.css';

export default function LocalDataSyncBanner({ onSynced }) {
  const { user, demoMode } = useAuth();
  const [localCount, setLocalCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // 데모 모드가 아니고, 로그인된 상태일 때만 로컬 데이터 체크
    if (!demoMode && user) {
      try {
        const raw = localStorage.getItem('bb_branches');
        const list = raw ? JSON.parse(raw) : [];
        if (Array.isArray(list) && list.length > 0) {
          setLocalCount(list.length);
        }
      } catch {
        setLocalCount(0);
      }
    }
  }, [user, demoMode]);

  if (demoMode || !user || localCount === 0 || dismissed) {
    return null;
  }

  const handleSync = async () => {
    try {
      setSyncing(true);
      const res = await syncLocalDataToFirestore(user);
      clearLocalData();
      setLocalCount(0);
      alert(`🎉 ${res.count}개 지점의 데이터가 클라우드로 성공적으로 동기화되었습니다!\n이제 PC에서도 동일하게 확인하실 수 있습니다.`);
      if (onSynced) onSynced();
      window.location.reload();
    } catch (err) {
      console.error('Sync failed:', err);
      alert('동기화 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="sync-banner animate-fade-in-up">
      <div className="sync-banner-content">
        <div className="sync-banner-icon">
          <NeonIcon name="chart" color="cyan" size="sm" />
        </div>
        <div className="sync-banner-text">
          <div className="sync-banner-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <NeonIcon name="sync" size="xs" color="cyan" badge={false} />
            <span>이 기기에 저장된 이전 지점 데이터({localCount}개)를 발견했습니다!</span>
          </div>
          <div className="sync-banner-desc">
            모바일에서 등록하셨던 지점과 일정을 클라우드로 동기화하면 <strong>PC와 모바일 어디서나 실시간으로 연동</strong>됩니다.
          </div>
        </div>
      </div>

      <div className="sync-banner-actions">
        <button
          className="btn btn-primary btn-sm sync-btn-primary"
          onClick={handleSync}
          disabled={syncing}
        >
          {syncing ? '동기화 중...' : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <NeonIcon name="upload" size="xs" color="emerald" badge={false} />
              <span>클라우드로 동기화</span>
            </span>
          )}
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={downloadLocalBackup}
          title="로컬 데이터를 파일로 저장"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <NeonIcon name="download" size="xs" color="cyan" badge={false} />
          <span>파일 백업</span>
        </button>
        <button
          className="btn-ghost btn-icon sync-close-btn"
          onClick={() => setDismissed(true)}
          aria-label="닫기"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
