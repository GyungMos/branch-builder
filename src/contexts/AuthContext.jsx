import { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../config/firebase';

const AuthContext = createContext();

// 데모 유저 (Firebase 미설정 시)
const DEMO_USER = {
  uid: 'demo-user',
  email: 'demo@branchbuilder.app',
  displayName: '관리자',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(!isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      // Firebase 미설정 → 데모 모드 자동 로그인
      console.info('🔧 Firebase 미설정 → 데모 모드로 동작합니다');
      setDemoMode(true);
      setUser(DEMO_USER);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (email, password) => {
    if (demoMode) {
      setUser(DEMO_USER);
      return { user: DEMO_USER };
    }
    return signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email, password, displayName) => {
    if (demoMode) {
      setUser({ ...DEMO_USER, displayName: displayName || DEMO_USER.displayName });
      return { user: DEMO_USER };
    }
    const result = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(result.user, { displayName });
    }
    return result;
  };

  const logout = async () => {
    if (demoMode) {
      setUser(null);
      return;
    }
    return signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, demoMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
