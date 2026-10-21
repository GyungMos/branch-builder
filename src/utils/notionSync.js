import { auth } from '../config/firebase';

/**
 * 노션 연결 프로그램(Netlify Functions /notion-sync) 호출.
 * 로그인한 사람의 Firebase 토큰을 함께 보내서, 연결 프로그램이 '사이트 직원의 요청'인지 확인함.
 * 데모 모드(Firebase 미설정)에서는 보내지 않음.
 */
export async function callNotion(action, payload = {}) {
  const user = auth?.currentUser;
  if (!user) return { skipped: true, reason: '데모 모드이거나 로그인 전이라 노션으로 보내지 않았어요.' };
  const token = await user.getIdToken();
  const res = await fetch('/.netlify/functions/notion-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...payload }),
  });
  let body = {};
  try { body = await res.json(); } catch { /* 응답이 JSON이 아닐 때 */ }
  if (!res.ok) {
    throw new Error(body.error || `노션 연결 오류 (${res.status})`);
  }
  return body;
}

/** 노션에 보낼 때 필요한 날짜 문자열 'YYYY-MM-DD' */
export function ymd(val) {
  if (!val) return null;
  if (typeof val === 'string') return val.slice(0, 10);
  const d = val.toDate ? val.toDate() : new Date(val);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
