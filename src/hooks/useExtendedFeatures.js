import { useState, useEffect } from 'react';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, setDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { generateId } from '../utils/formatters';
import { COMPLIANCE_TEMPLATES } from '../utils/complianceTemplates';

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
    const sanitizedData = {
      date: data.date || new Date().toISOString().split('T')[0],
      weather: data.weather || 'sunny',
      summary: (data.summary || '').trim(),
      workersCount: Number(data.workersCount) || 0,
      equipmentUsed: (data.equipmentUsed || '').trim(),
      issues: (data.issues || '').trim(),
      photos: Array.isArray(data.photos) ? data.photos : [],
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

  return { dailyLogs, loading, addDailyLog, deleteDailyLog };
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
