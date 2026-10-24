import { auth } from '../config/firebase';

/**
 * AI 비서 서버(Netlify Functions /ai-assistant)에 부탁하기
 * model: 'haiku'(빠른 모드, 기본) | 'opus'(정밀 모드)
 * 돌려받는 것: { proposals: [{ kind, input }], reply, model }
 */
export async function askAssistant({ message, model = 'haiku', context }) {
  // 개발 화면 시험용 (실제 사이트 빌드에서는 빠짐): window.__aiMock 이 있으면 그 답을 씀
  if (import.meta.env.DEV && typeof window !== 'undefined' && window.__aiMock) {
    return window.__aiMock({ message, model, context });
  }
  const user = auth?.currentUser;
  if (!user) throw new Error('데모 화면에서는 AI 비서를 쓸 수 없어요. 실제 사이트에서 로그인한 뒤 써 주세요.');
  const token = await user.getIdToken();
  const res = await fetch('/.netlify/functions/ai-assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message, model, context }),
  });
  let body = {};
  try { body = await res.json(); } catch { /* 응답이 JSON이 아닐 때 (시간 초과 등) */ }
  if (!res.ok) {
    if (res.status === 502 || res.status === 504) throw new Error('AI가 답하는 데 너무 오래 걸렸어요. 조금 짧게 나눠서 다시 부탁해 주세요.');
    throw new Error(body.error || `AI 비서 오류 (${res.status})`);
  }
  return body;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** AI에게 같이 알려 줄 오늘 날짜 (한국 시간 기준 이 기기 날짜) */
export function todayInfo() {
  const d = new Date();
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { today: ymd, weekday: WEEKDAYS[d.getDay()] };
}
