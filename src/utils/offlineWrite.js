import {
  addDoc as fbAddDoc, updateDoc as fbUpdateDoc, deleteDoc as fbDeleteDoc, setDoc as fbSetDoc, doc,
} from 'firebase/firestore';

/**
 * 현장처럼 인터넷이 약하거나 끊긴 곳에서도 저장 버튼이 멈추지 않게 하는 저장 함수들
 * - Firestore는 저장 내용을 먼저 이 기기(휴대폰)에 담아 두고, 연결되면 알아서 서버로 올림
 * - 그런데 기본 함수는 서버가 받았다고 답할 때까지 기다려서, 연결이 없으면 '저장 중…'에서 멈춤
 * - 그래서 연결이 없거나 답이 늦으면 기다리지 않고 바로 넘어감 (내용은 화면과 기기에 이미 반영됨)
 */
const WAIT_MS = 8000;

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

function settle(promise) {
  promise.catch(err => console.warn('저장 실패 (연결되면 다시 시도하지 않는 오류):', err));
  if (offline()) return Promise.resolve();
  return Promise.race([promise, new Promise(resolve => setTimeout(resolve, WAIT_MS))]);
}

/** 새 기록 추가: 번호(id)를 먼저 정해 두고 저장 → 연결이 없어도 바로 번호를 돌려줌 */
export async function addDoc(collectionRef, data) {
  const ref = doc(collectionRef);
  await settle(fbSetDoc(ref, data));
  return ref;
}

export const updateDoc = (ref, ...args) => settle(fbUpdateDoc(ref, ...args));
export const deleteDoc = (ref) => settle(fbDeleteDoc(ref));
export const setDoc = (ref, ...args) => settle(fbSetDoc(ref, ...args));
