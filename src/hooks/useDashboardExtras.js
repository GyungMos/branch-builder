import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { loadBranchData } from '../utils/branchData';
import { collectLessons } from '../utils/lessons';
import { buildLessonAlerts } from '../utils/alerts';

/**
 * 대시보드용: 모든 지점의 처리 안 된 하자·A/S, 지금 단계에서 챙길 이전 지점 부족했던 점
 */
export function useDashboardExtras(branches = []) {
  const { demoMode } = useAuth();
  const [state, setState] = useState({ loading: true, openDefects: [], lessonAlerts: [], shortfallTotal: 0 });
  const key = branches.map(b => `${b.id}:${b.name}:${b.status}:${Object.keys(b.lessonChecks || {}).length}`).join('|');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const openDefects = [];
      const withLessons = [];
      for (const b of branches) {
        const data = await loadBranchData(b.id, demoMode, ['defects', 'dailyLogs', 'stages', 'shortfalls']);
        (data.defects || []).filter(d => d.status !== 'done')
          .forEach(d => openDefects.push({ ...d, branchId: b.id, branchName: b.name }));
        withLessons.push({
          ...b,
          stages: data.stages || [],
          lessons: collectLessons({ branchId: b.id, branchName: b.name, dailyLogs: data.dailyLogs, stages: data.stages, shortfalls: data.shortfalls }),
        });
      }
      if (cancelled) return;
      openDefects.sort((a, b) => String(a.reportedDate || '').localeCompare(String(b.reportedDate || '')));
      setState({
        loading: false,
        openDefects,
        lessonAlerts: buildLessonAlerts(withLessons),
        shortfallTotal: withLessons.reduce((n, b) => n + b.lessons.length, 0),
      });
    })().catch(err => {
      console.warn('대시보드 하자·부족했던 점 불러오기 실패:', err);
      if (!cancelled) setState(s => ({ ...s, loading: false }));
    });
    return () => { cancelled = true; };
  }, [key, demoMode]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
