import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth, createUserWithEmailAndPassword, updateProfile, signOut,
} from 'firebase/auth';
import { firebaseConfig } from '../config/firebase';
import { toLoginEmail } from './loginId';

/**
 * 관리자가 직원 계정을 만듦.
 * 지금 로그인한 관리자 계정이 바뀌지 않도록, 별도의 임시 Firebase 앱에서 계정을 만들고 바로 정리함.
 */
export async function createStaffAccount({ name, loginId, password }) {
  const email = toLoginEmail(loginId);
  const temp = initializeApp(firebaseConfig, `staff-create-${Date.now()}`);
  try {
    const tempAuth = getAuth(temp);
    const cred = await createUserWithEmailAndPassword(tempAuth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await signOut(tempAuth);
    return { uid: cred.user.uid, email };
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') throw new Error('이미 있는 아이디예요. 다른 아이디를 정해 주세요.');
    if (err.code === 'auth/weak-password') throw new Error('비밀번호는 6자리 이상으로 정해 주세요.');
    if (err.code === 'auth/invalid-email') throw new Error('아이디 형식이 올바르지 않아요.');
    throw err;
  } finally {
    await deleteApp(temp).catch(() => {});
  }
}
