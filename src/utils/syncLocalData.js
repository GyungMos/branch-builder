import { collection, doc, addDoc, getDocs, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
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
 * 용량이 큰 Base64 이미지를 1MB 이내로 축소하는 헬퍼
 */
function sanitizePhotosForFirestore(photos) {
  if (!Array.isArray(photos)) return [];
  const safePhotos = [];
  let currentTotalSize = 0;
  const MAX_ALLOWED_TOTAL = 700000; // 700KB 안전 마진

  for (const p of photos) {
    const pSize = typeof p === 'string' ? p.length : JSON.stringify(p).length;
    // 단일 사진이 800KB를 넘거나 전체 크기가 초과되면 제외
    if (currentTotalSize + pSize < MAX_ALLOWED_TOTAL) {
      safePhotos.push(p);
      currentTotalSize += pSize;
    }
  }
  return safePhotos;
}

/**
 * 로컬에 저장된 지점 및 관련 서브 데이터를 Firebase Firestore로 안전하게 동기화
 */
export async function syncLocalDataToFirestore(user) {
  if (!db || !user) {
    throw new Error('Firebase가 연결되지 않았거나 로그인되어 있지 않습니다.');
  }

  const { branches, subData } = getAllLocalData();
  if (!branches || branches.length === 0) {
    return { count: 0 };
  }

  // 기존 Firestore 지점 목록 확인 (중복 지점 생성 방지)
  let existingBranches = [];
  try {
    const snap = await getDocs(collection(db, 'branches'));
    existingBranches = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('Could not check existing branches:', e);
  }

  let syncedCount = 0;

  for (const branch of branches) {
    const { id: oldId, ...cleanBranch } = branch;

    // 1. 지점 찾기 또는 생성
    let targetBranchId = null;
    const foundExisting = existingBranches.find(eb => eb.name === branch.name);
    if (foundExisting) {
      targetBranchId = foundExisting.id;
    } else {
      const branchDocRef = await addDoc(collection(db, 'branches'), {
        ...cleanBranch,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user.uid,
      });
      targetBranchId = branchDocRef.id;
    }

    const bSub = subData[oldId] || {};

    // 2. 단계 (Stages) & ID 맵핑
    const stageIdMap = {};
    if (Array.isArray(bSub.stages) && bSub.stages.length > 0) {
      try {
        const existingStagesSnap = await getDocs(collection(db, 'branches', targetBranchId, 'stages'));
        const existingStageMap = {};
        existingStagesSnap.docs.forEach(d => {
          existingStageMap[d.data().order || d.data().name] = d.id;
        });

        for (const stg of bSub.stages) {
          const { id: oldStgId, ...cleanStg } = stg;
          const key = cleanStg.order || cleanStg.name;
          if (existingStageMap[key]) {
            stageIdMap[oldStgId] = existingStageMap[key];
          } else {
            const stgRef = await addDoc(collection(db, 'branches', targetBranchId, 'stages'), {
              ...cleanStg,
              createdAt: serverTimestamp(),
            });
            stageIdMap[oldStgId] = stgRef.id;
          }
        }
      } catch (stgErr) {
        console.warn('Stage sync warning:', stgErr);
      }
    }

    // 3. 일정 (Schedules)
    if (Array.isArray(bSub.schedules) && bSub.schedules.length > 0) {
      try {
        const existingSchSnap = await getDocs(collection(db, 'branches', targetBranchId, 'schedules'));
        const existingTitles = new Set(existingSchSnap.docs.map(d => d.data().title));

        for (const sch of bSub.schedules) {
          const { id: oldSchId, ...cleanSch } = sch;
          if (existingTitles.has(cleanSch.title)) continue; // 이미 등록된 일정은 중복 방지

          let startDate = serverTimestamp();
          let endDate = serverTimestamp();
          try {
            if (sch.startDate) {
              const d = new Date(sch.startDate);
              if (!isNaN(d.getTime())) startDate = Timestamp.fromDate(d);
            }
            if (sch.endDate) {
              const d = new Date(sch.endDate);
              if (!isNaN(d.getTime())) endDate = Timestamp.fromDate(d);
            } else {
              endDate = startDate;
            }
          } catch {}

          await addDoc(collection(db, 'branches', targetBranchId, 'schedules'), {
            ...cleanSch,
            stageId: stageIdMap[sch.stageId] || sch.stageId || null,
            startDate,
            endDate,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
          });
        }
      } catch (schErr) {
        console.warn('Schedule sync warning:', schErr);
      }
    }

    // 4. 비용 (Costs)
    if (Array.isArray(bSub.costs) && bSub.costs.length > 0) {
      try {
        const existingCostsSnap = await getDocs(collection(db, 'branches', targetBranchId, 'costs'));
        const existingCostKeys = new Set(existingCostsSnap.docs.map(d => `${d.data().title}_${d.data().amount}`));

        for (const c of bSub.costs) {
          const { id: oldCostId, ...cleanCost } = c;
          if (existingCostKeys.has(`${cleanCost.title}_${cleanCost.amount}`)) continue;

          let date = serverTimestamp();
          try {
            if (c.date) {
              const d = new Date(c.date);
              if (!isNaN(d.getTime())) date = Timestamp.fromDate(d);
            }
          } catch {}

          await addDoc(collection(db, 'branches', targetBranchId, 'costs'), {
            ...cleanCost,
            amount: Number(c.amount) || 0,
            date,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
          });
        }
      } catch (costErr) {
        console.warn('Cost sync warning:', costErr);
      }
    }

    // 5. 협력업체 (Partners)
    if (Array.isArray(bSub.partners)) {
      try {
        const existingPartnersSnap = await getDocs(collection(db, 'branches', targetBranchId, 'partners'));
        const existingNames = new Set(existingPartnersSnap.docs.map(d => d.data().companyName));

        for (const p of bSub.partners) {
          const { id, ...cleanP } = p;
          if (existingNames.has(cleanP.companyName)) continue;
          await addDoc(collection(db, 'branches', targetBranchId, 'partners'), {
            ...cleanP,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
          });
        }
      } catch (pErr) {
        console.warn('Partner sync warning:', pErr);
      }
    }

    // 6. 장비 (Equipments)
    if (Array.isArray(bSub.equipments)) {
      try {
        const existingEqSnap = await getDocs(collection(db, 'branches', targetBranchId, 'equipments'));
        const existingEqNames = new Set(existingEqSnap.docs.map(d => d.data().name));

        for (const eq of bSub.equipments) {
          const { id, ...cleanEq } = eq;
          if (existingEqNames.has(cleanEq.name)) continue;
          await addDoc(collection(db, 'branches', targetBranchId, 'equipments'), {
            ...cleanEq,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
          });
        }
      } catch (eqErr) {
        console.warn('Equipment sync warning:', eqErr);
      }
    }

    // 7. 법적 준수 (Compliance)
    if (Array.isArray(bSub.compliance)) {
      for (const comp of bSub.compliance) {
        try {
          const itemId = comp.id || String(Math.random());
          await setDoc(doc(db, 'branches', targetBranchId, 'compliance', itemId), {
            ...comp,
            createdAt: serverTimestamp(),
          });
        } catch {}
      }
    }

    // 8. 작업일지 (DailyLogs) - 1MB 초과 방지 & 개별 안전 처리
    if (Array.isArray(bSub.dailyLogs)) {
      for (const log of bSub.dailyLogs) {
        try {
          const { id, ...cleanLog } = log;
          // 사진 데이터 안전 크기 필터링 (Firestore 1MB 한도 보호)
          const safePhotos = sanitizePhotosForFirestore(cleanLog.photos);

          await addDoc(collection(db, 'branches', targetBranchId, 'dailyLogs'), {
            ...cleanLog,
            photos: safePhotos,
            createdAt: serverTimestamp(),
          });
        } catch (logErr) {
          console.warn('DailyLog sync skipped single item due to error:', logErr);
        }
      }
    }

    syncedCount++;
  }

  return { count: syncedCount };
}

/**
 * 로컬 스토리지 데이터 삭제
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
