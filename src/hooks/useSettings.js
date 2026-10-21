import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';

/**
 * 사이트 전체 설정 (Firestore settings/{이름} 문서 하나씩)
 * - settings/people  : { names: [] }                     담당자 명단 (계정과 별개, 외부 협력자도 가능)
 * - settings/members : { emails: [], admins: [], staff: [] }  사이트 사용 허용 계정 · 관리자 · 직원 계정 목록
 * 데모 모드에서는 브라우저 저장소(bb_settings_{이름}) 사용
 */
function useSettingsDoc(name) {
  const { demoMode, user } = useAuth();
  const [data, setData] = useState(null);
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const localKey = `bb_settings_${name}`;

  useEffect(() => {
    if (!user) return undefined;
    if (demoMode) {
      // 데모: 같은 설정을 쓰는 다른 화면 조각도 바로 최신 값을 보도록 변경 알림을 구독
      const load = () => {
        try {
          const raw = localStorage.getItem(localKey);
          setData(raw ? JSON.parse(raw) : null);
          setExists(Boolean(raw));
        } catch {
          setData(null);
        }
        setLoading(false);
      };
      load();
      const onChange = (e) => { if (e.detail === name) load(); };
      window.addEventListener('bb-settings-change', onChange);
      return () => window.removeEventListener('bb-settings-change', onChange);
    }
    return onSnapshot(doc(db, 'settings', name), (snap) => {
      setExists(snap.exists());
      setData(snap.exists() ? snap.data() : null);
      setLoading(false);
    }, (err) => {
      console.error(`설정(${name}) 불러오기 실패:`, err);
      setLoading(false);
    });
  }, [name, demoMode, user, localKey]);

  const save = useCallback(async (next) => {
    if (demoMode) {
      const merged = { ...(JSON.parse(localStorage.getItem(localKey) || 'null') || {}), ...next };
      localStorage.setItem(localKey, JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent('bb-settings-change', { detail: name }));
      return;
    }
    await setDoc(doc(db, 'settings', name), next, { merge: true });
  }, [demoMode, name, localKey]);

  return { data, exists, loading, save };
}

/** 담당자 명단 */
export function usePeople() {
  const { data, loading, save } = useSettingsDoc('people');
  const names = data?.names || [];
  const colors = data?.colors || {};
  const saveNames = (next) => save({ names: next });
  // 사람별 색 { 이름: '#색' }
  const saveColor = (name, color) => save({ colors: { ...colors, [name]: color } });
  // 오픈 계획 상태 색 { todo, doing, done }
  const statusColors = data?.statusColors || {};
  const saveStatusColor = (id, color) => save({ statusColors: { ...statusColors, [id]: color } });
  return { names, colors, statusColors, loading, saveNames, saveColor, saveStatusColor };
}

/** 사이트 사용 계정 · 관리자 */
export function useMembers() {
  const { user } = useAuth();
  const { data, exists, loading, save } = useSettingsDoc('members');
  const emails = data?.emails || [];
  const admins = data?.admins || [];
  const staff = data?.staff || [];
  const myEmail = (user?.email || '').toLowerCase();

  return {
    loading,
    emails,
    admins,
    staff,
    // 아직 관리자가 정해지지 않음 → 처음 '관리자로 시작'을 누른 계정이 관리자
    needsBootstrap: !loading && (!exists || admins.length === 0),
    isAdmin: admins.map(e => e.toLowerCase()).includes(myEmail),
    bootstrap: () => save({
      emails: Array.from(new Set([...emails, myEmail])),
      admins: [myEmail],
      staff,
    }),
    save: (next) => save({ emails, admins, staff, ...next }),
  };
}
