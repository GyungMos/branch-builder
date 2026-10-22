import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useBranches } from './useFirestore';
import { loadBranchData } from '../utils/branchData';
import { buildAlerts } from '../utils/alerts';

const REFRESH_MS = 10 * 60 * 1000;
const ALERT_DAYS = 3;

/**
 * 사이트 안 알림: 기한이 지났거나 3일 안에 마감·시작·지급인 일
 * 확인한 알림은 이 기기에 기억해 두고, 새로 생긴 것만 숫자로 보여 줌
 */
export function useAlerts() {
  const { user, demoMode } = useAuth();
  const { branches } = useBranches();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const seenKey = `bb_alerts_seen_${user?.uid || 'demo'}`;
  const [seen, setSeen] = useState(() => {
    try { return JSON.parse(localStorage.getItem(seenKey) || '[]'); } catch { return []; }
  });

  const branchKey = branches.map(b => `${b.id}:${b.name}`).join('|');

  const refresh = useCallback(async () => {
    if (!branches.length) { setAlerts([]); return; }
    setLoading(true);
    try {
      const lists = { schedules: [], costs: [], openTasks: [], openPlans: [] };
      for (const b of branches) {
        const data = await loadBranchData(b.id, demoMode, Object.keys(lists));
        Object.keys(lists).forEach(n => {
          (data[n] || []).forEach(r => lists[n].push({ ...r, branchId: b.id, branchName: b.name }));
        });
      }
      setAlerts(buildAlerts(lists, { days: ALERT_DAYS }));
    } catch (err) {
      console.warn('알림 불러오기 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [branchKey, demoMode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  const unseen = useMemo(() => alerts.filter(a => !seen.includes(a.key)), [alerts, seen]);

  // 지금 보이는 알림을 모두 확인한 것으로 (지난 알림 기록은 지금 목록에 있는 것만 남김)
  const markAllSeen = useCallback(() => {
    const next = alerts.map(a => a.key);
    setSeen(next);
    try { localStorage.setItem(seenKey, JSON.stringify(next)); } catch { /* 저장 공간 없음 */ }
  }, [alerts, seenKey]);

  return { alerts, unseen, seen, loading, refresh, markAllSeen };
}
