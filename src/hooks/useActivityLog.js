import { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { generateId } from '../utils/formatters';

function getLocalLogs(branchId) {
  try {
    return JSON.parse(localStorage.getItem(`bb_logs_${branchId}`) || '[]');
  } catch { return []; }
}

function setLocalLogs(branchId, data) {
  localStorage.setItem(`bb_logs_${branchId}`, JSON.stringify(data));
}

export function useActivityLog(branchId) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, demoMode } = useAuth();

  useEffect(() => {
    if (!branchId) { setLogs([]); setLoading(false); return; }

    if (demoMode) {
      setLogs(getLocalLogs(branchId));
      setLoading(false);
      return;
    }

    if (!isFirebaseConfigured || !db) { setLoading(false); return; }

    const q = query(
      collection(db, 'branches', branchId, 'logs'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return unsubscribe;
  }, [branchId, demoMode]);

  const addLog = useCallback(async (action, detail = '') => {
    if (!branchId) return;

    const logEntry = {
      action,
      detail,
      userName: user?.displayName || user?.email || '관리자',
      createdAt: new Date().toISOString(),
    };

    if (demoMode) {
      const newLog = { id: generateId(), ...logEntry };
      const updated = [newLog, ...getLocalLogs(branchId)].slice(0, 100);
      setLocalLogs(branchId, updated);
      setLogs(updated);
      return;
    }

    if (!isFirebaseConfigured || !db) return;

    try {
      await addDoc(collection(db, 'branches', branchId, 'logs'), {
        ...logEntry,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Log write failed:', e);
    }
  }, [branchId, user, demoMode]);

  return { logs, loading, addLog };
}
