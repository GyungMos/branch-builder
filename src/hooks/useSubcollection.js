import { useEffect, useState, useCallback } from 'react';
import {
  collection, doc, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { addDoc, updateDoc, deleteDoc } from '../utils/offlineWrite';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { generateId } from '../utils/formatters';

function readLocal(key) {
  try {
    return JSON.parse(localStorage.getItem(`bb_${key}`) || '[]');
  } catch {
    return [];
  }
}

function writeLocal(key, data) {
  localStorage.setItem(`bb_${key}`, JSON.stringify(data));
}

const sortItems = (list) => [...list].sort((a, b) => {
  const oa = a.order ?? Number.MAX_SAFE_INTEGER;
  const ob = b.order ?? Number.MAX_SAFE_INTEGER;
  if (oa !== ob) return oa - ob;
  const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
  const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
  return ta - tb;
});

/**
 * 지점 하위 기록(branches/{id}/{name}) 읽기·추가·수정·삭제 공통 훅
 * 데모 모드(Firebase 미설정)에서는 브라우저 저장소(bb_{name}_{branchId}) 사용
 */
export function useSubcollection(branchId, name) {
  const { user, demoMode } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const localKey = `${name}_${branchId}`;

  useEffect(() => {
    if (!branchId) return undefined;
    if (demoMode) {
      setItems(sortItems(readLocal(localKey)));
      setLoading(false);
      return undefined;
    }
    const unsubscribe = onSnapshot(collection(db, 'branches', branchId, name), (snap) => {
      setItems(sortItems(snap.docs.map(d => ({ ...d.data(), id: d.id }))));
      setLoading(false);
    }, (err) => {
      console.error(`${name} 불러오기 실패:`, err);
      setLoading(false);
    });
    return unsubscribe;
  }, [branchId, name, demoMode, localKey]);

  const add = useCallback(async (data) => {
    if (demoMode) {
      const item = { ...data, id: generateId(), createdAt: new Date().toISOString(), createdBy: user?.displayName || '관리자' };
      const next = sortItems([...readLocal(localKey), item]);
      writeLocal(localKey, next);
      setItems(next);
      return item;
    }
    const ref = await addDoc(collection(db, 'branches', branchId, name), {
      ...data,
      createdAt: serverTimestamp(),
      createdBy: user?.displayName || user?.email || '관리자',
    });
    return { ...data, id: ref.id };
  }, [demoMode, branchId, name, localKey, user]);

  const update = useCallback(async (id, data) => {
    if (demoMode) {
      const next = sortItems(readLocal(localKey).map(it => (it.id === id ? { ...it, ...data, updatedAt: new Date().toISOString() } : it)));
      writeLocal(localKey, next);
      setItems(next);
      return;
    }
    await updateDoc(doc(db, 'branches', branchId, name, id), { ...data, updatedAt: serverTimestamp() });
  }, [demoMode, branchId, name, localKey]);

  const remove = useCallback(async (id) => {
    if (demoMode) {
      const next = readLocal(localKey).filter(it => it.id !== id);
      writeLocal(localKey, next);
      setItems(next);
      return;
    }
    await deleteDoc(doc(db, 'branches', branchId, name, id));
  }, [demoMode, branchId, name, localKey]);

  return { items, loading, add, update, remove };
}
