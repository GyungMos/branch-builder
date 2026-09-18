import { collection, doc, addDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * 로컬 스토리지에 저장된 모든 branch-builder 데이터 가져오기
 */
export function getAllLocalData() {
  const result = {
    branches: [],
    subData: {},
  };

  try {
    const rawBranches = localStorage.getItem('bb_branches');
    if (rawBranches) {
      result.branches = JSON.parse(rawBranches);
    }

    for (const b of result.branches) {
      const bId = b.id;
      result.subData[bId] = {
        stages: JSON.parse(localStorage.getItem(`bb_stages_${bId}`) || '[]'),
        schedules: JSON.parse(localStorage.getItem(`bb_schedules_${bId}`) || '[]'),
        costs: JSON.parse(localStorage.getItem(`bb_costs_${bId}`) || '[]'),
        partners: JSON.parse(localStorage.getItem(`bb_partners_${bId}`) || '[]'),
        equipments: JSON.parse(localStorage.getItem(`bb_equipments_${bId}`) || '[]'),
        compliance: JSON.parse(localStorage.getItem(`bb_compliance_${bId}`) || '[]'),
        dailyLogs: JSON.parse(localStorage.getItem(`bb_dailyLogs_${bId}`) || '[]'),
        budget: JSON.parse(localStorage.getItem(`bb_budget_${bId}`) || '{"totalBudget":0}'),
      };
    }
  } catch (err) {
    console.error('Error reading local data:', err);
  }

  return result;
}

/**
 * 로컬 데이터를 JSON 파일로 다운로드 (백업용)
 */
export function downloadLocalBackup() {
  const data = getAllLocalData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `branch_builder_backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 로컬에 저장된 지점 및 관련 서브 데이터를 Firebase Firestore로 동기화
 */
export async function syncLocalDataToFirestore(user) {
  if (!db || !user) {
    throw new Error('Firebase가 연결되지 않았거나 로그인되어 있지 않습니다.');
  }

  const { branches, subData } = getAllLocalData();
  if (!branches || branches.length === 0) {
    return { count: 0 };
  }

  let syncedCount = 0;

  for (const branch of branches) {
    const { id: oldId, ...cleanBranch } = branch;

    // 1. 지점 생성
    const branchDocRef = await addDoc(collection(db, 'branches'), {
      ...cleanBranch,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: user.uid,
    });
    const newBranchId = branchDocRef.id;

    const bSub = subData[oldId] || {};

    // 2. 단계 (Stages)
    if (Array.isArray(bSub.stages)) {
      for (const stg of bSub.stages) {
        const { id, ...cleanStg } = stg;
        await addDoc(collection(db, 'branches', newBranchId, 'stages'), {
          ...cleanStg,
          createdAt: serverTimestamp(),
        });
      }
    }

    // 3. 일정 (Schedules)
    if (Array.isArray(bSub.schedules)) {
      for (const sch of bSub.schedules) {
        const { id, ...cleanSch } = sch;
        const startDate = sch.startDate ? Timestamp.fromDate(new Date(sch.startDate)) : serverTimestamp();
        const endDate = sch.endDate ? Timestamp.fromDate(new Date(sch.endDate)) : startDate;
        await addDoc(collection(db, 'branches', newBranchId, 'schedules'), {
          ...cleanSch,
          startDate,
          endDate,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
        });
      }
    }

    // 4. 비용 (Costs)
    if (Array.isArray(bSub.costs)) {
      for (const c of bSub.costs) {
        const { id, ...cleanCost } = c;
        const date = c.date ? Timestamp.fromDate(new Date(c.date)) : serverTimestamp();
        await addDoc(collection(db, 'branches', newBranchId, 'costs'), {
          ...cleanCost,
          amount: Number(c.amount) || 0,
          date,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
        });
      }
    }

    // 5. 협력업체 (Partners)
    if (Array.isArray(bSub.partners)) {
      for (const p of bSub.partners) {
        const { id, ...cleanP } = p;
        await addDoc(collection(db, 'branches', newBranchId, 'partners'), {
          ...cleanP,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
        });
      }
    }

    // 6. 장비 (Equipments)
    if (Array.isArray(bSub.equipments)) {
      for (const eq of bSub.equipments) {
        const { id, ...cleanEq } = eq;
        await addDoc(collection(db, 'branches', newBranchId, 'equipments'), {
          ...cleanEq,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
        });
      }
    }

    // 7. 법적 준수 (Compliance)
    if (Array.isArray(bSub.compliance)) {
      for (const comp of bSub.compliance) {
        const itemId = comp.id || String(Math.random());
        await setDoc(doc(db, 'branches', newBranchId, 'compliance', itemId), {
          ...comp,
          createdAt: serverTimestamp(),
        });
      }
    }

    // 8. 작업일지 (DailyLogs)
    if (Array.isArray(bSub.dailyLogs)) {
      for (const log of bSub.dailyLogs) {
        const { id, ...cleanLog } = log;
        await addDoc(collection(db, 'branches', newBranchId, 'dailyLogs'), {
          ...cleanLog,
          createdAt: serverTimestamp(),
        });
      }
    }

    syncedCount++;
  }

  return { count: syncedCount };
}

/**
 * 로컬 스토리지 데이터 백업 삭제
 */
export function clearLocalData() {
  const rawBranches = localStorage.getItem('bb_branches');
  if (rawBranches) {
    try {
      const branches = JSON.parse(rawBranches);
      for (const b of branches) {
        const bId = b.id;
        localStorage.removeItem(`bb_stages_${bId}`);
        localStorage.removeItem(`bb_schedules_${bId}`);
        localStorage.removeItem(`bb_costs_${bId}`);
        localStorage.removeItem(`bb_partners_${bId}`);
        localStorage.removeItem(`bb_equipments_${bId}`);
        localStorage.removeItem(`bb_compliance_${bId}`);
        localStorage.removeItem(`bb_dailyLogs_${bId}`);
        localStorage.removeItem(`bb_budget_${bId}`);
      }
    } catch {}
  }
  localStorage.removeItem('bb_branches');
}
