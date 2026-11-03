import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { loadBranchData } from '../utils/branchData';
import { collectLessons } from '../utils/lessons';

/**
 * 다른 지점들에서 모인 '부족했던 점' (현장 일지 칸 + 단계별 기록의 아쉬운 점·다음 지점 메모)
 * 지금 보고 있는 지점은 빼고 모음
 */
export function usePreviousLessons(branches = [], currentBranchId) {
  const { demoMode } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const others = branches.filter(b => b.id !== currentBranchId);
  const key = others.map(b => `${b.id}:${b.name}`).join('|');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const all = [];
      for (const b of others) {
        try {
          const data = await loadBranchData(b.id, demoMode, ['dailyLogs', 'stages']);
          all.push(...collectLessons({ branchId: b.id, branchName: b.name, dailyLogs: data.dailyLogs, stages: data.stages }));
        } catch (err) {
          console.warn(`${b.name} 부족했던 점 불러오기 실패:`, err);
        }
      }
      if (!cancelled) {
        setItems(all);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [key, demoMode]); // eslint-disable-line react-hooks/exhaustive-deps

  return { items, loading };
}
