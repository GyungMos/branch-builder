import { useState, useEffect, useCallback } from 'react';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, isFirebaseConfigured } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { generateId } from '../utils/formatters';

// ========== 로컬 스토리지 헬퍼 (데모 모드용) ==========
function getLocalData(key) {
  try {
    return JSON.parse(localStorage.getItem(`bb_${key}`) || '[]');
  } catch { return []; }
}

function setLocalData(key, data) {
  localStorage.setItem(`bb_${key}`, JSON.stringify(data));
}

// ========== Branches ==========
export function useBranches() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, demoMode } = useAuth();

  useEffect(() => {
    if (!user) { setBranches([]); setLoading(false); return; }

    if (demoMode) {
      setBranches(getLocalData('branches'));
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'branches'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBranches(data);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching branches:', error);
      setLoading(false);
    });
    return unsubscribe;
  }, [user, demoMode]);

  const addBranch = async (branchData) => {
    if (demoMode) {
      const newBranch = {
        ...branchData,
        id: generateId(),
        status: 'planning',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'demo-user',
      };
      const updated = [newBranch, ...branches];
      setLocalData('branches', updated);
      setBranches(updated);
      return { id: newBranch.id };
    }
    return addDoc(collection(db, 'branches'), {
      ...branchData,
      status: 'planning',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: user.uid,
    });
  };

  const updateBranch = async (branchId, data) => {
    if (demoMode) {
      const updated = branches.map(b =>
        b.id === branchId ? { ...b, ...data, updatedAt: new Date().toISOString() } : b
      );
      setLocalData('branches', updated);
      setBranches(updated);
      return;
    }
    return updateDoc(doc(db, 'branches', branchId), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  };

  const deleteBranch = async (branchId) => {
    if (demoMode) {
      const updated = branches.filter(b => b.id !== branchId);
      setLocalData('branches', updated);
      setBranches(updated);
      // 관련 서브데이터 삭제
      localStorage.removeItem(`bb_stages_${branchId}`);
      localStorage.removeItem(`bb_schedules_${branchId}`);
      localStorage.removeItem(`bb_costs_${branchId}`);
      localStorage.removeItem(`bb_documents_${branchId}`);
      return;
    }
    return deleteDoc(doc(db, 'branches', branchId));
  };

  return { branches, loading, addBranch, updateBranch, deleteBranch };
}

// ========== Stages (Sub-collection) ==========
export function useStages(branchId) {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const { demoMode } = useAuth();

  useEffect(() => {
    if (!branchId) { setStages([]); setLoading(false); return; }

    if (demoMode) {
      setStages(getLocalData(`stages_${branchId}`));
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'branches', branchId, 'stages'),
      orderBy('order', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setStages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return unsubscribe;
  }, [branchId, demoMode]);

  const addStage = async (stageData) => {
    if (demoMode) {
      const newStage = {
        ...stageData,
        id: generateId(),
        status: 'waiting',
        createdAt: new Date().toISOString(),
      };
      const updated = [...stages, newStage].sort((a, b) => a.order - b.order);
      setLocalData(`stages_${branchId}`, updated);
      setStages(updated);
      return { id: newStage.id };
    }
    return addDoc(collection(db, 'branches', branchId, 'stages'), {
      ...stageData,
      status: 'waiting',
      createdAt: serverTimestamp(),
    });
  };

  const updateStage = async (stageId, data) => {
    if (demoMode) {
      const updated = stages.map(s => s.id === stageId ? { ...s, ...data } : s);
      setLocalData(`stages_${branchId}`, updated);
      setStages(updated);
      return;
    }
    return updateDoc(doc(db, 'branches', branchId, 'stages', stageId), data);
  };

  const deleteStage = async (stageId) => {
    if (demoMode) {
      const updated = stages.filter(s => s.id !== stageId);
      setLocalData(`stages_${branchId}`, updated);
      setStages(updated);
      return;
    }
    return deleteDoc(doc(db, 'branches', branchId, 'stages', stageId));
  };

  return { stages, loading, addStage, updateStage, deleteStage };
}

// ========== Schedules ==========
export function useSchedules(branchId) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, demoMode } = useAuth();

  useEffect(() => {
    if (!branchId) { setSchedules([]); setLoading(false); return; }

    if (demoMode) {
      setSchedules(getLocalData(`schedules_${branchId}`));
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'branches', branchId, 'schedules'),
      orderBy('startDate', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSchedules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return unsubscribe;
  }, [branchId, demoMode]);

  const addSchedule = async (scheduleData) => {
    if (demoMode) {
      const newSchedule = {
        ...scheduleData,
        id: generateId(),
        startDate: scheduleData.startDate,
        endDate: scheduleData.endDate || scheduleData.startDate,
        createdBy: 'demo-user',
        createdAt: new Date().toISOString(),
      };
      const updated = [...schedules, newSchedule].sort((a, b) =>
        new Date(a.startDate) - new Date(b.startDate)
      );
      setLocalData(`schedules_${branchId}`, updated);
      setSchedules(updated);
      return { id: newSchedule.id };
    }
    return addDoc(collection(db, 'branches', branchId, 'schedules'), {
      ...scheduleData,
      startDate: Timestamp.fromDate(new Date(scheduleData.startDate)),
      endDate: scheduleData.endDate ? Timestamp.fromDate(new Date(scheduleData.endDate)) : null,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    });
  };

  const updateSchedule = async (scheduleId, data) => {
    if (demoMode) {
      const updated = schedules.map(s => s.id === scheduleId ? { ...s, ...data } : s);
      setLocalData(`schedules_${branchId}`, updated);
      setSchedules(updated);
      return;
    }
    const updateData = { ...data };
    if (data.startDate) updateData.startDate = Timestamp.fromDate(new Date(data.startDate));
    if (data.endDate) updateData.endDate = Timestamp.fromDate(new Date(data.endDate));
    return updateDoc(doc(db, 'branches', branchId, 'schedules', scheduleId), updateData);
  };

  const deleteSchedule = async (scheduleId) => {
    if (demoMode) {
      const updated = schedules.filter(s => s.id !== scheduleId);
      setLocalData(`schedules_${branchId}`, updated);
      setSchedules(updated);
      return;
    }
    return deleteDoc(doc(db, 'branches', branchId, 'schedules', scheduleId));
  };

  return { schedules, loading, addSchedule, updateSchedule, deleteSchedule };
}

// ========== Costs ==========
export function useCosts(branchId) {
  const [costs, setCosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, demoMode } = useAuth();

  useEffect(() => {
    if (!branchId) { setCosts([]); setLoading(false); return; }

    if (demoMode) {
      setCosts(getLocalData(`costs_${branchId}`));
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'branches', branchId, 'costs'),
      orderBy('date', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return unsubscribe;
  }, [branchId, demoMode]);

  const addCost = async (costData) => {
    if (demoMode) {
      const newCost = {
        ...costData,
        id: generateId(),
        amount: Number(costData.amount),
        date: costData.date,
        createdBy: 'demo-user',
        createdAt: new Date().toISOString(),
      };
      const updated = [newCost, ...costs];
      setLocalData(`costs_${branchId}`, updated);
      setCosts(updated);
      return { id: newCost.id };
    }
    return addDoc(collection(db, 'branches', branchId, 'costs'), {
      ...costData,
      amount: Number(costData.amount),
      date: Timestamp.fromDate(new Date(costData.date)),
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    });
  };

  const updateCost = async (costId, data) => {
    if (demoMode) {
      const updated = costs.map(c => c.id === costId ? { ...c, ...data } : c);
      setLocalData(`costs_${branchId}`, updated);
      setCosts(updated);
      return;
    }
    const updateData = { ...data };
    if (data.amount) updateData.amount = Number(data.amount);
    if (data.date) updateData.date = Timestamp.fromDate(new Date(data.date));
    return updateDoc(doc(db, 'branches', branchId, 'costs', costId), updateData);
  };

  const deleteCost = async (costId) => {
    if (demoMode) {
      const updated = costs.filter(c => c.id !== costId);
      setLocalData(`costs_${branchId}`, updated);
      setCosts(updated);
      return;
    }
    return deleteDoc(doc(db, 'branches', branchId, 'costs', costId));
  };

  const totalCost = costs.reduce((sum, c) => sum + (c.amount || 0), 0);

  return { costs, loading, addCost, updateCost, deleteCost, totalCost };
}

// ========== Documents ==========
export function useDocuments(branchId) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, demoMode } = useAuth();

  useEffect(() => {
    if (!branchId) { setDocuments([]); setLoading(false); return; }

    if (demoMode) {
      setDocuments(getLocalData(`documents_${branchId}`));
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'branches', branchId, 'documents'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDocuments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return unsubscribe;
  }, [branchId, demoMode]);

  const uploadDocument = useCallback(async (file, metadata, onProgress) => {
    if (demoMode) {
      // 데모 모드: 파일을 Base64 데이터 URL로 저장
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            onProgress((e.loaded / e.total) * 100);
          }
        };
        reader.onload = () => {
          const newDoc = {
            ...metadata,
            id: generateId(),
            fileUrl: reader.result,
            storagePath: null,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            createdBy: 'demo-user',
            createdAt: new Date().toISOString(),
          };
          const updated = [newDoc, ...documents];
          setLocalData(`documents_${branchId}`, updated);
          setDocuments(updated);
          if (onProgress) onProgress(100);
          resolve({ id: newDoc.id });
        };
        reader.readAsDataURL(file);
      });
    }

    const fileId = generateId();
    const ext = file.name.split('.').pop();
    const storagePath = `branches/${branchId}/documents/${fileId}.${ext}`;
    const storageRef = ref(storage, storagePath);
    
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
        },
        (error) => reject(error),
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          const docRef = await addDoc(collection(db, 'branches', branchId, 'documents'), {
            ...metadata,
            fileUrl: downloadUrl,
            storagePath,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
          });
          resolve(docRef);
        }
      );
    });
  }, [branchId, user, demoMode, documents]);

  const deleteDocument = async (docId, storagePath) => {
    if (demoMode) {
      const updated = documents.filter(d => d.id !== docId);
      setLocalData(`documents_${branchId}`, updated);
      setDocuments(updated);
      return;
    }
    if (storagePath) {
      try {
        await deleteObject(ref(storage, storagePath));
      } catch (e) {
        console.warn('Storage delete failed:', e);
      }
    }
    return deleteDoc(doc(db, 'branches', branchId, 'documents', docId));
  };

  return { documents, loading, uploadDocument, deleteDocument };
}
