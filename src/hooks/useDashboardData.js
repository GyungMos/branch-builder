import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useBranches } from './useFirestore';
import { COST_CATEGORIES } from '../utils/constants';

function getLocalData(key) {
  try {
    return JSON.parse(localStorage.getItem(`bb_${key}`) || '[]');
  } catch {
    return [];
  }
}

export function useDashboardData() {
  const { user, demoMode } = useAuth();
  const { branches, loading: branchesLoading } = useBranches();
  const [dashboardData, setDashboardData] = useState({
    branchesSummary: [],
    upcomingSchedules: [],
    costByCategory: {},
    totalCost: 0,
    avgCost: 0,
    stageDistribution: {},
    recentActivities: [],
  });
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    if (!user && !demoMode) {
      setLoading(false);
      return;
    }

    if (branchesLoading) return;

    try {
      setLoading(true);
      const branchesSummary = [];
      const allSchedules = [];
      const allCosts = [];
      const allActivities = [];

      for (const branch of branches) {
        let stages = [];
        let schedules = [];
        let costs = [];
        let logs = [];
        let equipments = [];
        let partners = [];
        let budgetObj = { totalBudget: 0 };

        if (demoMode) {
          stages = getLocalData(`stages_${branch.id}`);
          schedules = getLocalData(`schedules_${branch.id}`);
          costs = getLocalData(`costs_${branch.id}`);
          logs = getLocalData(`logs_${branch.id}`);
          equipments = getLocalData(`equipments_${branch.id}`);
          partners = getLocalData(`partners_${branch.id}`);
          budgetObj = getLocalData(`budget_${branch.id}`, { totalBudget: 0 });
        } else {
          try {
            const stagesSnap = await getDocs(query(collection(db, 'branches', branch.id, 'stages'), orderBy('order', 'asc')));
            stages = stagesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            const schedulesSnap = await getDocs(query(collection(db, 'branches', branch.id, 'schedules'), orderBy('startDate', 'asc')));
            schedules = schedulesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            const costsSnap = await getDocs(query(collection(db, 'branches', branch.id, 'costs'), orderBy('date', 'desc')));
            costs = costsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            const logsSnap = await getDocs(query(collection(db, 'branches', branch.id, 'logs'), orderBy('createdAt', 'desc')));
            logs = logsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          } catch (e) {
            console.error(`Error fetching sub-collections for branch ${branch.id}:`, e);
          }
        }

        // 지점별 진행률 계산
        const completedStages = stages.filter(s => s.status === 'complete').length;
        const progress = stages.length > 0 ? Math.round((completedStages / stages.length) * 100) : 0;
        
        // 현재 진행 중인 단계 (없으면 첫 번째 대기 단계 또는 완료)
        const currentStageObj = stages.find(s => s.status === 'progress') ||
                               stages.find(s => s.status === 'waiting') ||
                               (stages.length > 0 ? stages[stages.length - 1] : null);
        const currentStageName = currentStageObj ? currentStageObj.name : '단계 미정';

        // 지점별 총 비용
        const branchTotalCost = costs.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

        // 지점별 카테고리 비용 집계
        const branchCostByCategory = {};
        costs.forEach(c => {
          const cat = c.category || 'etc';
          branchCostByCategory[cat] = (branchCostByCategory[cat] || 0) + (Number(c.amount) || 0);
        });

        // 일정에 지점 정보 추가
        schedules.forEach(s => {
          allSchedules.push({
            ...s,
            branchId: branch.id,
            branchName: branch.name,
          });
        });

        // 비용 누적
        costs.forEach(c => {
          allCosts.push({
            ...c,
            branchId: branch.id,
            branchName: branch.name,
          });
        });

        // 활동 로그 누적
        logs.forEach(l => {
          allActivities.push({
            ...l,
            branchId: branch.id,
            branchName: branch.name,
          });
        });

        // 다가오는 일정 2개 추출
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const branchUpcoming = schedules
          .filter(s => {
            const d = s.endDate ? new Date(s.endDate.toDate ? s.endDate.toDate() : s.endDate) :
                      (s.startDate ? new Date(s.startDate.toDate ? s.startDate.toDate() : s.startDate) : null);
            return d && d >= now;
          })
          .sort((a, b) => {
            const da = new Date(a.startDate.toDate ? a.startDate.toDate() : a.startDate);
            const db = new Date(b.startDate.toDate ? b.startDate.toDate() : b.startDate);
            return da - db;
          })
          .slice(0, 2);

        branchesSummary.push({
          id: branch.id,
          name: branch.name,
          address: branch.address,
          status: branch.status || 'planning',
          createdAt: branch.createdAt,
          progress,
          currentStage: currentStageName,
          totalCost: branchTotalCost,
          totalBudget: Number(budgetObj?.totalBudget) || 0,
          costByCategory: branchCostByCategory,
          stagesCount: stages.length,
          completedStagesCount: completedStages,
          upcomingSchedules: branchUpcoming,
          schedulesCount: schedules.length,
          equipmentsCount: equipments.length,
          installedEquipmentsCount: equipments.filter(eq => eq.installed).length,
          partnersCount: partners.length,
          property: branch.property || {},
        });
      }

      // 1. 전체 비용 및 카테고리별 집계
      const totalCost = allCosts.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
      const avgCost = branches.length > 0 ? Math.round(totalCost / branches.length) : 0;
      const totalBudget = branchesSummary.reduce((sum, b) => sum + (b.totalBudget || 0), 0);


      const costByCategory = {};
      COST_CATEGORIES.forEach(cat => { costByCategory[cat.id] = 0; });
      allCosts.forEach(c => {
        const cat = c.category || 'etc';
        costByCategory[cat] = (costByCategory[cat] || 0) + (Number(c.amount) || 0);
      });

      // 2. 전체 다가오는 일정 정렬
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const upcomingSchedules = allSchedules
        .filter(s => {
          const d = s.endDate ? new Date(s.endDate.toDate ? s.endDate.toDate() : s.endDate) :
                    (s.startDate ? new Date(s.startDate.toDate ? s.startDate.toDate() : s.startDate) : null);
          return d && d >= now;
        })
        .sort((a, b) => {
          const da = new Date(a.startDate.toDate ? a.startDate.toDate() : a.startDate);
          const db = new Date(b.startDate.toDate ? b.startDate.toDate() : b.startDate);
          return da - db;
        })
        .slice(0, 8); // 상위 8개

      // 3. 단계별 파이프라인 분포
      const stageDistribution = {};
      branchesSummary.forEach(b => {
        const stg = b.currentStage || '기타';
        stageDistribution[stg] = (stageDistribution[stg] || 0) + 1;
      });

      // 4. 최근 활동 정렬 (최신순 10개)
      const recentActivities = allActivities
        .sort((a, b) => {
          const ta = new Date(a.createdAt?.toDate ? a.createdAt.toDate() : a.createdAt || 0);
          const tb = new Date(b.createdAt?.toDate ? b.createdAt.toDate() : b.createdAt || 0);
          return tb - ta;
        })
        .slice(0, 10);

      setDashboardData({
        branchesSummary,
        upcomingSchedules,
        costByCategory,
        totalCost,
        avgCost,
        totalBudget,
        stageDistribution,
        recentActivities,
      });
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [branches, branchesLoading, user, demoMode]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return {
    loading: loading || branchesLoading,
    ...dashboardData,
    branchesCount: branches.length,
    refetch: fetchDashboardData,
  };
}
