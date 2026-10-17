import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase 설정 - 환경변수에서 읽어옴
// .env 파일에 아래 값들을 설정하세요:
// VITE_FIREBASE_API_KEY=your-api-key
// VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
// VITE_FIREBASE_PROJECT_ID=your-project-id
// VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
// VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
// VITE_FIREBASE_APP_ID=your-app-id

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Firebase가 설정되어 있는지 확인
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== 'your-api-key-here' &&
  firebaseConfig.projectId
);

let app = null;
let auth = null;
let db = null;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    console.warn('Firebase 초기화 실패:', error.message);
  }
}

/**
 * 사진·서류 저장소(Storage)는 업로드·삭제할 때만 필요해서 그때 내려받음 (첫 로딩을 가볍게)
 * Firebase 미설정이면 null
 */
let storageModulePromise = null;
export function loadStorage() {
  if (!app) return Promise.resolve(null);
  if (!storageModulePromise) {
    storageModulePromise = import('firebase/storage')
      .then(mod => ({ ...mod, storage: mod.getStorage(app) }))
      .catch(err => {
        console.warn('Storage 불러오기 실패:', err);
        storageModulePromise = null;
        return null;
      });
  }
  return storageModulePromise;
}

export { auth, db };
export default app;
