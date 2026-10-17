import {
  collection, doc, getDocs, getDoc, addDoc, setDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { generateId, toDateInputValue } from './formatters';

// 지점 하위 데이터 (Firestore: branches/{id}/{이름}, 로컬: bb_{이름}_{id})
export const BRANCH_COLLECTIONS = [
  'stages', 'schedules', 'costs', 'documents', 'dailyLogs', 'partners', 'equipments', 'compliance',
];

function readLocal(key, fallback = []) {
  try {
    const v = localStorage.getItem(`bb_${key}`);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key, data) {
  localStorage.setItem(`bb_${key}`, JSON.stringify(data));
}

/** 지점 하나의 하위 데이터를 한 번에 읽기 (보고서·복사용, 실시간 아님) */
export async function loadBranchData(branchId, demoMode, names = BRANCH_COLLECTIONS) {
  const out = {};
  if (demoMode || !db) {
    names.forEach(n => { out[n] = readLocal(`${n}_${branchId}`); });
    out.budget = readLocal(`budget_${branchId}`, null);
    return out;
  }
  await Promise.all(names.map(async n => {
    try {
      const snap = await getDocs(collection(db, 'branches', branchId, n));
      out[n] = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    } catch (err) {
      console.error(`지점 ${branchId}의 ${n} 불러오기 실패:`, err);
      out[n] = [];
    }
  }));
  try {
    const b = await getDoc(doc(db, 'branches', branchId, 'config', 'budget'));
    out.budget = b.exists() ? b.data() : null;
  } catch {
    out.budget = null;
  }
  return out;
}

function strip(item, extraKeys = []) {
  const copy = { ...item };
  ['id', 'createdAt', 'updatedAt', 'createdBy', '_offline', ...extraKeys].forEach(k => { delete copy[k]; });
  return copy;
}

function toYmd(val) {
  return toDateInputValue(val);
}

function shiftYmd(ymd, days) {
  if (!ymd) return ymd;
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return toDateInputValue(dt);
}

/**
 * 기존 지점의 준비 자료를 새 지점으로 복사
 * options: { stages, partners, equipments, compliance, budget, schedules, scheduleStart(YYYY-MM-DD) }
 * - 단계: 체크리스트는 모두 '안 함'으로, 상태는 대기, 메모(교훈)는 복사 안 함
 * - 일정: 원래 첫 일정 시작일을 새 시작일로 옮겨 같은 간격으로 배치, 모두 미완료
 */
export async function copyBranchSetup({ source, targetBranchId, options, demoMode, user }) {
  const uid = user?.uid || 'anonymous';
  const stageIdMap = {};
  const summary = { stages: 0, partners: 0, equipments: 0, compliance: 0, schedules: 0, budget: false };

  const addItems = async (name, items) => {
    if (!items.length) return [];
    if (demoMode || !db) {
      const created = items.map(it => ({ ...it, id: generateId(), createdAt: new Date().toISOString() }));
      writeLocal(`${name}_${targetBranchId}`, [...readLocal(`${name}_${targetBranchId}`), ...created]);
      return created.map(c => c.id);
    }
    const ids = [];
    for (const it of items) {
      const ref = await addDoc(collection(db, 'branches', targetBranchId, name), {
        ...it,
        createdAt: serverTimestamp(),
        createdBy: uid,
      });
      ids.push(ref.id);
    }
    return ids;
  };

  if (options.stages) {
    const stages = [...(source.stages || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    const items = stages.map(s => ({
      ...strip(s, ['lessons']),
      status: 'waiting',
      checklist: (s.checklist || []).map(c => ({ ...c, done: false })),
    }));
    const ids = await addItems('stages', items);
    stages.forEach((s, i) => { stageIdMap[s.id] = ids[i]; });
    summary.stages = ids.length;
  }

  if (options.partners) {
    summary.partners = (await addItems('partners', (source.partners || []).map(p => strip(p)))).length;
  }

  if (options.equipments) {
    const items = (source.equipments || []).map(e => ({
      ...strip(e, ['orderDate', 'deliveryDate', 'installDate', 'arrivalDate']),
      installed: false,
      tested: false,
    }));
    summary.equipments = (await addItems('equipments', items)).length;
  }

  if (options.compliance) {
    const items = (source.compliance || []).map(c => ({ ...strip(c), status: 'waiting', memo: '' }));
    if (demoMode || !db) {
      writeLocal(`compliance_${targetBranchId}`, (source.compliance || []).map((c, i) => ({ ...items[i], id: c.id })));
    } else {
      // 법정 항목은 템플릿 id를 문서 id로 그대로 사용 (상태 변경 시 id로 찾음)
      for (let i = 0; i < items.length; i++) {
        await setDoc(doc(db, 'branches', targetBranchId, 'compliance', source.compliance[i].id), {
          ...items[i],
          createdAt: serverTimestamp(),
        });
      }
    }
    summary.compliance = items.length;
  }

  if (options.budget && source.budget) {
    const budget = { ...source.budget };
    if (demoMode || !db) writeLocal(`budget_${targetBranchId}`, budget);
    else await setDoc(doc(db, 'branches', targetBranchId, 'config', 'budget'), budget, { merge: true });
    summary.budget = true;
  }

  if (options.schedules && options.scheduleStart && (source.schedules || []).length) {
    const list = source.schedules
      .map(s => ({ s, start: toYmd(s.startDate), end: toYmd(s.endDate) || toYmd(s.startDate) }))
      .filter(x => x.start)
      .sort((a, b) => (a.start < b.start ? -1 : 1));
    const [by, bm, bd] = list[0].start.split('-').map(Number);
    const [ny, nm, nd] = options.scheduleStart.split('-').map(Number);
    const shift = Math.round((new Date(ny, nm - 1, nd) - new Date(by, bm - 1, bd)) / 86400000);

    const items = list.map(({ s, start, end }) => {
      const startDate = shiftYmd(start, shift);
      const endDate = shiftYmd(end, shift);
      return {
        ...strip(s, ['status', 'startDate', 'endDate']),
        stageId: s.stageId ? (stageIdMap[s.stageId] || null) : null,
        status: 'pending',
        startDate: demoMode || !db ? startDate : Timestamp.fromDate(new Date(startDate)),
        endDate: demoMode || !db ? endDate : Timestamp.fromDate(new Date(endDate)),
      };
    });
    summary.schedules = (await addItems('schedules', items)).length;
  }

  return summary;
}
