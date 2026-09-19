import { useState, useEffect } from 'react';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, setDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { generateId } from '../utils/formatters';
import { COMPLIANCE_TEMPLATES } from '../utils/complianceTemplates';
import { sanitizeEntriesForFirestore, dietDailyLogPhotos } from '../utils/photoUpload';

function getLocalData(key, defaultVal = []) {
  try {
    const val = localStorage.getItem(`bb_${key}`);
    return val ? JSON.parse(val) : defaultVal;
  } catch {
    return defaultVal;
  }
}

function setLocalData(key, data) {
  localStorage.setItem(`bb_${key}`, JSON.stringify(data));
}

// ==========================================
// 1. 👥 협력업체 / 거래처 연락망 (Partners)
// ==========================================
export function usePartners(branchId) {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const { demoMode, user } = useAuth();

  useEffect(() => {
    if (!branchId) { setPartners([]); setLoading(false); return; }

    if (demoMode) {
      setPartners(getLocalData(`partners_${branchId}`, []));
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'branches', branchId, 'partners'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPartners(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsubscribe;
  }, [branchId, demoMode]);

  const addPartner = async (data) => {
    if (demoMode) {
      const newPartner = {
        ...data,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      const updated = [newPartner, ...partners];
      setLocalData(`partners_${branchId}`, updated);
      setPartners(updated);
      return { id: newPartner.id };
    }
    try {
      return await addDoc(collection(db, 'branches', branchId, 'partners'), {
        ...data,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || 'anonymous',
      });
    } catch (err) {
      console.warn('Firestore addPartner failed, fallback to local:', err);
      const newPartner = {
        ...data,
        id: generateId(),
        createdAt: new Date().toISOString(),
        _offline: true,
      };
      const updated = [newPartner, ...partners];
      setLocalData(`partners_${branchId}`, updated);
      setPartners(updated);
      return { id: newPartner.id, fallback: true };
    }
  };

  const updatePartner = async (partnerId, data) => {
    if (demoMode) {
      const updated = partners.map(p => p.id === partnerId ? { ...p, ...data } : p);
      setLocalData(`partners_${branchId}`, updated);
      setPartners(updated);
      return;
    }
    return updateDoc(doc(db, 'branches', branchId, 'partners', partnerId), data);
  };

  const deletePartner = async (partnerId) => {
    if (demoMode) {
      const updated = partners.filter(p => p.id !== partnerId);
      setLocalData(`partners_${branchId}`, updated);
      setPartners(updated);
      return;
    }
    return deleteDoc(doc(db, 'branches', branchId, 'partners', partnerId));
  };

  return { partners, loading, addPartner, updatePartner, deletePartner };
}

// ==========================================
// 2. 🏛️ 정비업 법정 시설/인허가 대장 (Compliance)
// ==========================================
export function useCompliance(branchId) {
  const [complianceItems, setComplianceItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { demoMode, user } = useAuth();

  useEffect(() => {
    if (!branchId) { setComplianceItems([]); setLoading(false); return; }

    if (demoMode) {
      const local = getLocalData(`compliance_${branchId}`, []);
      // 없으면 기본 전문정비업 템플릿으로 초기화
      if (local.length === 0) {
        const initial = COMPLIANCE_TEMPLATES.specialized.items;
        setLocalData(`compliance_${branchId}`, initial);
        setComplianceItems(initial);
      } else {
        setComplianceItems(local);
      }
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'branches', branchId, 'compliance'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setComplianceItems(items);
      setLoading(false);
    });
    return unsubscribe;
  }, [branchId, demoMode]);

  const loadTemplate = async (templateKey = 'specialized') => {
    const template = COMPLIANCE_TEMPLATES[templateKey];
    if (!template) return;

    if (demoMode) {
      setLocalData(`compliance_${branchId}`, template.items);
      setComplianceItems(template.items);
      return;
    }

    // Firebase
    for (const item of template.items) {
      await setDoc(doc(db, 'branches', branchId, 'compliance', item.id), {
        ...item,
        createdAt: serverTimestamp(),
      });
    }
  };

  const updateItemStatus = async (itemId, newStatus, memo = '') => {
    if (demoMode) {
      const updated = complianceItems.map(item =>
        item.id === itemId ? { ...item, status: newStatus, memo: memo !== undefined ? memo : item.memo } : item
      );
      setLocalData(`compliance_${branchId}`, updated);
      setComplianceItems(updated);
      return;
    }
    const updateData = { status: newStatus };
    if (memo !== undefined) updateData.memo = memo;
    return updateDoc(doc(db, 'branches', branchId, 'compliance', itemId), updateData);
  };

  const addItem = async (data) => {
    if (demoMode) {
      const newItem = {
        ...data,
        id: generateId(),
        status: data.status || 'waiting',
      };
      const updated = [...complianceItems, newItem];
      setLocalData(`compliance_${branchId}`, updated);
      setComplianceItems(updated);
      return { id: newItem.id };
    }
    try {
      return await addDoc(collection(db, 'branches', branchId, 'compliance'), {
        ...data,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || 'anonymous',
      });
    } catch (err) {
      console.warn('Firestore compliance addItem failed, fallback to local:', err);
      const newItem = {
        ...data,
        id: generateId(),
        status: data.status || 'waiting',
        _offline: true,
      };
      const updated = [...complianceItems, newItem];
      setLocalData(`compliance_${branchId}`, updated);
      setComplianceItems(updated);
      return { id: newItem.id, fallback: true };
    }
  };

  const deleteItem = async (itemId) => {
    if (demoMode) {
      const updated = complianceItems.filter(i => i.id !== itemId);
      setLocalData(`compliance_${branchId}`, updated);
      setComplianceItems(updated);
      return;
    }
    return deleteDoc(doc(db, 'branches', branchId, 'compliance', itemId));
  };

  const fitCount = complianceItems.filter(i => i.status === 'fit').length;
  const progressPercent = complianceItems.length > 0 ? Math.round((fitCount / complianceItems.length) * 100) : 0;

  return { complianceItems, loading, loadTemplate, updateItemStatus, addItem, deleteItem, fitCount, progressPercent };
}

// ==========================================
// 3. ⚙️ 정비 장비 및 리프트 설비 대장 (Equipment)
// ==========================================
export function useEquipments(branchId) {
  const [equipments, setEquipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const { demoMode, user } = useAuth();

  useEffect(() => {
    if (!branchId) { setEquipments([]); setLoading(false); return; }

    if (demoMode) {
      setEquipments(getLocalData(`equipments_${branchId}`, []));
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'branches', branchId, 'equipments'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEquipments(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsubscribe;
  }, [branchId, demoMode]);

  const addEquipment = async (data) => {
    if (demoMode) {
      const newEquip = {
        ...data,
        id: generateId(),
        installed: false,
        tested: false,
        createdAt: new Date().toISOString(),
      };
      const updated = [newEquip, ...equipments];
      setLocalData(`equipments_${branchId}`, updated);
      setEquipments(updated);
      return { id: newEquip.id };
    }
    try {
      return await addDoc(collection(db, 'branches', branchId, 'equipments'), {
        ...data,
        installed: false,
        tested: false,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || 'anonymous',
      });
    } catch (err) {
      console.warn('Firestore addEquipment failed, fallback to local:', err);
      const newEquip = {
        ...data,
        id: generateId(),
        installed: false,
        tested: false,
        createdAt: new Date().toISOString(),
        _offline: true,
      };
      const updated = [newEquip, ...equipments];
      setLocalData(`equipments_${branchId}`, updated);
      setEquipments(updated);
      return { id: newEquip.id, fallback: true };
    }
  };

  const updateEquipment = async (equipId, data) => {
    if (demoMode) {
      const updated = equipments.map(eq => eq.id === equipId ? { ...eq, ...data } : eq);
      setLocalData(`equipments_${branchId}`, updated);
      setEquipments(updated);
      return;
    }
    return updateDoc(doc(db, 'branches', branchId, 'equipments', equipId), data);
  };

  const deleteEquipment = async (equipId) => {
    if (demoMode) {
      const updated = equipments.filter(eq => eq.id !== equipId);
      setLocalData(`equipments_${branchId}`, updated);
      setEquipments(updated);
      return;
    }
    return deleteDoc(doc(db, 'branches', branchId, 'equipments', equipId));
  };

  const totalEquipmentCost = equipments.reduce((sum, eq) => sum + (Number(eq.totalPrice) || (Number(eq.unitPrice) * (Number(eq.quantity) || 1)) || 0), 0);
  const installedCount = equipments.filter(eq => eq.installed).length;

  return { equipments, loading, addEquipment, updateEquipment, deleteEquipment, totalEquipmentCost, installedCount };
}

// ==========================================
// 4. 📝 현장 일일 작업일지 & 이슈 노트 (DailyLog)
// ==========================================
export function useDailyLogs(branchId) {
  const [dailyLogs, setDailyLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { demoMode, user } = useAuth();

  useEffect(() => {
    if (!branchId) { setDailyLogs([]); setLoading(false); return; }

    if (demoMode) {
      setDailyLogs(getLocalData(`dailyLogs_${branchId}`, []));
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'branches', branchId, 'dailyLogs'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDailyLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsubscribe;
  }, [branchId, demoMode]);

  const addDailyLog = async (data) => {
    const slimData = await dietDailyLogPhotos(data);
    const sanitizedData = {
      date: slimData.date || new Date().toISOString().split('T')[0],
      weather: slimData.weather || 'sunny',
      summary: (slimData.summary || '').trim(),
      workersCount: Number(slimData.workersCount) || 0,
      equipmentUsed: (slimData.equipmentUsed || '').trim(),
      issues: (slimData.issues || '').trim(),
      photos: Array.isArray(slimData.photos) ? slimData.photos : [],
      entries: sanitizeEntriesForFirestore(Array.isArray(slimData.entries) ? slimData.entries : []),
      author: user?.displayName || user?.email || '현장 관리자',
    };

    if (demoMode || !db) {
      const newLog = {
        ...sanitizedData,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      const updated = [newLog, ...dailyLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
      setLocalData(`dailyLogs_${branchId}`, updated);
      setDailyLogs(updated);
      return { id: newLog.id };
    }

    try {
      const docRef = await addDoc(collection(db, 'branches', branchId, 'dailyLogs'), {
        ...sanitizedData,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || 'anonymous',
      });
      return { id: docRef.id };
    } catch (err) {
      console.warn('Firestore addDailyLog failed, falling back to localStorage:', err);
      const fallbackLog = {
        ...sanitizedData,
        id: generateId(),
        createdAt: new Date().toISOString(),
        _offline: true,
      };
      const updated = [fallbackLog, ...dailyLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
      setLocalData(`dailyLogs_${branchId}`, updated);
      setDailyLogs(updated);
      return { id: fallbackLog.id, fallback: true };
    }
  };

  const updateDailyLog = async (logId, data) => {
    const existingLog = dailyLogs.find(l => l.id === logId);
    // 문서 내의 모든 사진(기존 사진 포함)을 20~30KB 수준으로 안전하게 압축
    const slimData = await dietDailyLogPhotos(data);

    const sanitizedData = {
      date: slimData.date || existingLog?.date || new Date().toISOString().split('T')[0],
      weather: slimData.weather || existingLog?.weather || 'sunny',
      summary: (slimData.summary !== undefined ? slimData.summary : (existingLog?.summary || '')).trim(),
      workersCount: slimData.workersCount !== undefined ? Number(slimData.workersCount) : (existingLog?.workersCount || 0),
      equipmentUsed: (slimData.equipmentUsed !== undefined ? slimData.equipmentUsed : (existingLog?.equipmentUsed || '')).trim(),
      issues: (slimData.issues !== undefined ? slimData.issues : (existingLog?.issues || '')).trim(),
      photos: Array.isArray(slimData.photos) ? slimData.photos : (existingLog?.photos || []),
      entries: sanitizeEntriesForFirestore(Array.isArray(slimData.entries) ? slimData.entries : (existingLog?.entries || [])),
      updatedAt: new Date().toISOString(),
    };

    if (demoMode || !db) {
      const updated = dailyLogs
        .map(l => (l.id === logId ? { ...l, ...sanitizedData } : l))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      setLocalData(`dailyLogs_${branchId}`, updated);
      setDailyLogs(updated);
      return { id: logId };
    }

    try {
      const docRef = doc(db, 'branches', branchId, 'dailyLogs', logId);
      await updateDoc(docRef, {
        ...sanitizedData,
        updatedAt: serverTimestamp(),
      });
      return { id: logId };
    } catch (err) {
      console.error('Firestore updateDailyLog failed:', err);
      const updated = dailyLogs
        .map(l => (l.id === logId ? { ...l, ...sanitizedData, _offline: true } : l))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      setLocalData(`dailyLogs_${branchId}`, updated);
      setDailyLogs(updated);
      throw new Error('클라우드 저장 중 오류가 발생했습니다: ' + (err.message || '다시 시도해 주세요.'));
    }
  };

  // 📝 일지 내 오후 추가 작업 / 조치 사항 (Entry) 추가
  const addDailyLogEntry = async (logId, entryData) => {
    const targetLog = dailyLogs.find(l => l.id === logId);
    if (!targetLog) return;

    const now = new Date();
    const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newEntry = {
      id: generateId(),
      timeTag: (entryData.timeTag || '오후 조치 / 추가 작업').trim(),
      time: entryData.time || timeString,
      summary: (entryData.summary || '').trim(),
      workersCount: Number(entryData.workersCount) || 0,
      equipmentUsed: (entryData.equipmentUsed || '').trim(),
      issues: (entryData.issues || '').trim(),
      status: entryData.status || 'resolved',
      photos: Array.isArray(entryData.photos) ? entryData.photos : [],
      author: user?.displayName || user?.email || '현장 관리자',
      createdAt: now.toISOString(),
    };

    const currentEntries = Array.isArray(targetLog.entries) ? targetLog.entries : [];
    const updatedEntries = [...currentEntries, newEntry];

    return await updateDailyLog(logId, {
      ...targetLog,
      entries: updatedEntries,
    });
  };

  // 📝 일지 내 추가 작업 / 조치 사항 (Entry) 수정
  const updateDailyLogEntry = async (logId, entryId, entryData) => {
    const targetLog = dailyLogs.find(l => l.id === logId);
    if (!targetLog) return;

    const currentEntries = Array.isArray(targetLog.entries) ? targetLog.entries : [];
    const updatedEntries = currentEntries.map(entry => {
      if (entry.id !== entryId) return entry;
      return {
        ...entry,
        timeTag: (entryData.timeTag !== undefined ? entryData.timeTag : entry.timeTag).trim(),
        time: entryData.time || entry.time,
        summary: (entryData.summary !== undefined ? entryData.summary : entry.summary).trim(),
        workersCount: entryData.workersCount !== undefined ? Number(entryData.workersCount) : entry.workersCount,
        equipmentUsed: entryData.equipmentUsed !== undefined ? (entryData.equipmentUsed || '').trim() : entry.equipmentUsed,
        issues: entryData.issues !== undefined ? (entryData.issues || '').trim() : entry.issues,
        status: entryData.status || entry.status || 'resolved',
        photos: Array.isArray(entryData.photos) ? entryData.photos : (entry.photos || []),
        updatedAt: new Date().toISOString(),
      };
    });

    return await updateDailyLog(logId, {
      ...targetLog,
      entries: updatedEntries,
    });
  };

  // 📝 일지 내 추가 작업 / 조치 사항 (Entry) 삭제
  const deleteDailyLogEntry = async (logId, entryId) => {
    const targetLog = dailyLogs.find(l => l.id === logId);
    if (!targetLog) return;

    const currentEntries = Array.isArray(targetLog.entries) ? targetLog.entries : [];
    const updatedEntries = currentEntries.filter(entry => entry.id !== entryId);

    return await updateDailyLog(logId, {
      ...targetLog,
      entries: updatedEntries,
    });
  };

  const deleteDailyLog = async (logId) => {
    if (demoMode || !db) {
      const updated = dailyLogs.filter(l => l.id !== logId);
      setLocalData(`dailyLogs_${branchId}`, updated);
      setDailyLogs(updated);
      return;
    }
    try {
      await deleteDoc(doc(db, 'branches', branchId, 'dailyLogs', logId));
    } catch (err) {
      console.warn('Firestore deleteDailyLog failed, removing from local state:', err);
      const updated = dailyLogs.filter(l => l.id !== logId);
      setLocalData(`dailyLogs_${branchId}`, updated);
      setDailyLogs(updated);
    }
  };

  return {
    dailyLogs,
    loading,
    addDailyLog,
    updateDailyLog,
    deleteDailyLog,
    addDailyLogEntry,
    updateDailyLogEntry,
    deleteDailyLogEntry,
  };
}

// ==========================================
// 5. 💰 목표 예산 관리 (Budget)
// ==========================================
export function useBranchBudget(branchId, totalCost = 0) {
  const [budget, setBudget] = useState({
    totalBudget: 0,
    categoryBudgets: {},
  });
  const { demoMode } = useAuth();

  useEffect(() => {
    if (!branchId) return;
    if (demoMode) {
      setBudget(getLocalData(`budget_${branchId}`, { totalBudget: 0, categoryBudgets: {} }));
      return;
    }
    const unsubscribe = onSnapshot(doc(db, 'branches', branchId, 'config', 'budget'), (snap) => {
      if (snap.exists()) setBudget(snap.data());
    });
    return unsubscribe;
  }, [branchId, demoMode]);

  const updateBudget = async (newBudget) => {
    if (demoMode) {
      setLocalData(`budget_${branchId}`, newBudget);
      setBudget(newBudget);
      return;
    }
    return setDoc(doc(db, 'branches', branchId, 'config', 'budget'), newBudget, { merge: true });
  };

  const totalBudget = Number(budget.totalBudget) || 0;
  const usagePercent = totalBudget > 0 ? Math.round((totalCost / totalBudget) * 100) : 0;
  const remainingBudget = totalBudget - totalCost;
  const isOverBudget = totalBudget > 0 && totalCost > totalBudget;

  return {
    budget,
    totalBudget,
    usagePercent,
    remainingBudget,
    isOverBudget,
    updateBudget,
  };
}
