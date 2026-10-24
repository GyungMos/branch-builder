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

  const once = async () => {
    const res = await fetch('/.netlify/functions/ai-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message, model, context }),
    });
    let body = null;
    try { body = await res.json(); } catch { /* 응답이 JSON이 아닐 때 (Netlify가 시간 초과로 끊음) */ }
    // 시간 초과: AI 쪽이 늦었거나(code: timeout) Netlify가 끊음(JSON 아님)
    const timedOut = (res.status === 504 && body?.code === 'timeout') || (!body && (res.status === 502 || res.status === 504));
    return { res, body, timedOut };
  };

  // 처음 부탁은 준비 시간 때문에 늦을 수 있어서, 시간 초과면 한 번 더 자동으로 시도
  let r = await once();
  if (r.timedOut) r = await once();
  if (r.timedOut) throw new Error('AI가 답하는 데 너무 오래 걸렸어요. 부탁을 두세 개로 나눠서 다시 해 주세요.');
  if (!r.res.ok) throw new Error(r.body?.error || `AI 비서 오류 (${r.res.status})`);
  return r.body;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** AI에게 같이 알려 줄 오늘 날짜 (한국 시간 기준 이 기기 날짜) */
export function todayInfo() {
  const d = new Date();
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { today: ymd, weekday: WEEKDAYS[d.getDay()] };
}
