import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { auth, db, loadStorage } from '../config/firebase';
import { generateId } from './formatters';

/**
 * 휴지통: 지운 기록을 30일 동안 보관했다가 되살릴 수 있게 함
 * - 서버: branches/{지점}/trash/{번호}  { path, collection, data, deletedAt, deletedBy }
 * - 데모(브라우저 저장소): bb_trash_{지점}
 * 지점 자체는 지우면 deletedAt 표시만 하고 목록에서 숨김 (useBranches)
 */
export const TRASH_DAYS = 30;

const COLLECTION_LABEL = {
  stages: '단계', schedules: '일정', costs: '비용', documents: '서류·사진', dailyLogs: '현장 일지',
  partners: '협력업체', equipments: '장비', compliance: '인허가 항목', openPlans: '오픈 계획', openTasks: '오픈 준비',
  defects: '하자·A/S',
};
export const trashLabel = (coll) => COLLECTION_LABEL[coll] || coll;

/** 기록에서 보여 줄 이름 */
export const trashTitle = (data = {}) => data.title || data.name || data.companyName || data.fileName
  || (data.date ? `${String(data.date).slice(0, 10)} 일지` : '') || '(이름 없음)';

const readLocal = (key) => {
  try { return JSON.parse(localStorage.getItem(`bb_${key}`) || '[]'); } catch { return []; }
};
const writeLocal = (key, v) => localStorage.setItem(`bb_${key}`, JSON.stringify(v));

const who = () => auth?.currentUser?.displayName || auth?.currentUser?.email || '관리자';

/** 데모: 지운 기록을 휴지통에 넣기 */
export function trashLocal(branchId, coll, record) {
  if (!record) return;
  const list = readLocal(`trash_${branchId}`);
  list.unshift({ id: generateId(), collection: coll, data: record, deletedAt: new Date().toISOString(), deletedBy: '관리자' });
  writeLocal(`trash_${branchId}`, list);
}

/** 서버: 지우기 직전에 휴지통으로 옮겨 둠 (실패해도 지우기는 계속) */
export async function trashBeforeDelete(ref) {
  const parts = ref.path.split('/');
  if (parts.length !== 4 || parts[0] !== 'branches' || parts[2] === 'trash' || parts[2] === 'logs') return;
  try {
    const snap = await Promise.race([getDoc(ref), new Promise(r => setTimeout(() => r(null), 5000))]);
    if (!snap?.exists()) return;
    await setDoc(doc(collection(db, 'branches', parts[1], 'trash')), {
      path: ref.path,
      collection: parts[2],
      data: snap.data(),
      deletedAt: serverTimestamp(),
      deletedBy: who(),
    });
  } catch (err) {
    console.warn('휴지통에 넣지 못했어요:', err);
  }
}

const toMillis = (v) => (v?.toMillis ? v.toMillis() : new Date(v || 0).getTime());

/** 휴지통 목록 (최근에 지운 것부터) */
export async function listTrash(branches, demoMode) {
  const out = [];
  for (const b of branches) {
    if (demoMode || !db) {
      readLocal(`trash_${b.id}`).forEach(t => out.push({ ...t, branchId: b.id, branchName: b.name }));
    } else {
      try {
        const snap = await getDocs(collection(db, 'branches', b.id, 'trash'));
        snap.docs.forEach(d => out.push({ ...d.data(), id: d.id, branchId: b.id, branchName: b.name }));
      } catch (err) {
        console.warn(`${b.name} 휴지통 불러오기 실패:`, err);
      }
    }
  }
  return out.sort((a, b) => toMillis(b.deletedAt) - toMillis(a.deletedAt));
}

/** 노션 연결 표시는 빼고 되살림 (노션 페이지는 지울 때 보관 처리됐으므로, '안 보낸 것 보내기'로 새로 보냄) */
const withoutNotion = (data) => Object.fromEntries(Object.entries(data || {}).filter(([k]) => !k.startsWith('notion')));

/** 되살리기 */
export async function restoreTrash(item, demoMode) {
  const data = withoutNotion(item.data);
  if (demoMode || !db) {
    const key = `${item.collection}_${item.branchId}`;
    const list = readLocal(key).filter(r => r.id !== data.id);
    writeLocal(key, [data, ...list]);
    writeLocal(`trash_${item.branchId}`, readLocal(`trash_${item.branchId}`).filter(t => t.id !== item.id));
    return;
  }
  const path = item.path || `branches/${item.branchId}/${item.collection}/${data.id || generateId()}`;
  const { id: _id, ...rest } = data; // eslint-disable-line no-unused-vars
  await setDoc(doc(db, path), rest);
  await deleteDoc(doc(db, 'branches', item.branchId, 'trash', item.id));
}

/** 완전히 지우기 (서류 파일도 저장소에서 지움) */
export async function purgeTrash(item, demoMode) {
  if (demoMode || !db) {
    writeLocal(`trash_${item.branchId}`, readLocal(`trash_${item.branchId}`).filter(t => t.id !== item.id));
    return;
  }
  const storagePath = item.data?.storagePath;
  if (storagePath) {
    try {
      const st = await loadStorage();
      if (st) await st.deleteObject(st.ref(st.storage, storagePath));
    } catch (err) {
      console.warn('저장소 파일 지우기 실패:', err);
    }
  }
  await deleteDoc(doc(db, 'branches', item.branchId, 'trash', item.id));
}

/** 30일 지난 것 정리 (관리자가 휴지통을 열 때) */
export async function purgeOld(items, demoMode) {
  const limit = Date.now() - TRASH_DAYS * 86400000;
  const old = items.filter(t => toMillis(t.deletedAt) && toMillis(t.deletedAt) < limit);
  for (const t of old) await purgeTrash(t, demoMode);
  return items.filter(t => !old.includes(t));
}

export const daysLeft = (item) => {
  const ms = toMillis(item.deletedAt);
  if (!ms) return TRASH_DAYS;
  return Math.max(0, TRASH_DAYS - Math.floor((Date.now() - ms) / 86400000));
};
