/**
 * AI 비서 (Netlify Functions → /.netlify/functions/ai-assistant)
 * 사이트 직원이 적은 문장을 오픈 계획·오픈 준비·일정·현장 일지에 넣을 "제안"으로 바꿔 돌려줌
 * - 저장은 하지 않음: 사이트에서 미리보기를 확인하고 [추가]를 눌러야 저장됨
 * - 기본은 빠른 모드(Claude Haiku 5.5), 어려운 문장은 정밀 모드(Claude Opus 5.5)
 * - Netlify 환경 변수 ANTHROPIC_API_KEY 필요 (사이트 화면에는 절대 보내지 않음)
 */
import Anthropic from '@anthropic-ai/sdk';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const MODELS = {
  haiku: 'claude-haiku-5-5',
  opus: 'claude-opus-5-5',
};

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const str = (v) => (v === null || v === undefined ? '' : String(v));

// ---------- 로그인 확인 (노션 연결과 같은 방식: 사이트 허용 계정만) ----------
async function verifyCaller(req) {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new HttpError(500, 'Netlify 환경 변수에 VITE_FIREBASE_PROJECT_ID가 없어요.');
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, '로그인이 필요해요.');

  let claims;
  try {
    ({ payload: claims } = await jwtVerify(token, FIREBASE_JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    }));
  } catch {
    throw new HttpError(401, '로그인 확인에 실패했어요. 다시 로그인해 주세요.');
  }

  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/settings/members`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.status === 404) return claims;
  if (!res.ok) throw new HttpError(403, '사이트 사용 허용 계정인지 확인하지 못했어요.');
  const doc = await res.json();
  const emails = (doc.fields?.emails?.arrayValue?.values || []).map(v => (v.stringValue || '').toLowerCase());
  if (!emails.includes(str(claims.email).toLowerCase())) {
    throw new HttpError(403, 'AI 비서를 쓸 권한이 없는 계정이에요. 관리자에게 문의하세요.');
  }
  return claims;
}

// ---------- AI가 쓸 수 있는 도구 (모두 '추가 제안'만, 저장은 사이트에서) ----------
const people = { type: 'array', items: { type: 'string' }, description: '담당자 이름들. 담당자 명단에 있는 이름으로 적고, 없으면 빈 배열' };
const date = (what) => ({ type: 'string', description: `${what} (YYYY-MM-DD). 말하지 않았으면 빈 문자열` });

const TOOLS = [
  {
    name: 'add_open_plan',
    description: "'오픈 계획'에 카드 하나를 추가 제안. 큰 할 일, 회의록, 진행 계획처럼 본문이 있는 카드.",
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '카드 제목' },
        status: { type: 'string', enum: ['todo', 'doing', 'done'], description: 'todo=시작 전, doing=진행 중, done=완료. 말이 없으면 todo' },
        assignee1: people,
        assignee2: people,
        due_date: date('종료일'),
        body: { type: 'string', description: '본문. 줄마다 하나씩, 목록은 "- " 로 시작. 말한 내용만 정리하고 지어내지 말 것. 없으면 빈 문자열' },
      },
      required: ['title', 'status', 'assignee1', 'assignee2', 'due_date', 'body'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_open_task',
    description: "'오픈 준비 스케줄'에 준비 항목 하나를 추가 제안. 사업자등록, 간판, 공구 구입처럼 체크해 나가는 준비 항목.",
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '세부항목 이름' },
        group: { type: 'string', description: '그룹. 그룹 목록 중 가장 맞는 것, 애매하면 빈 문자열' },
        category: { type: 'string', description: '구분. 구분 목록 중 맞는 것, 없으면 빈 문자열' },
        start_date: date('완료일자(시작)'),
        end_date: date('완료일자(끝). 하루짜리면 빈 문자열'),
        done: { type: 'boolean', description: '이미 끝낸 일이면 true' },
        assignee1: people,
        assignee2: people,
        memo: { type: 'string', description: '비고. 없으면 빈 문자열' },
      },
      required: ['title', 'group', 'category', 'start_date', 'end_date', 'done', 'assignee1', 'assignee2', 'memo'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_schedule',
    description: "'일정'에 하나를 추가 제안. 공사·작업처럼 시작일~끝날이 있는 일. 'X일~Y일 OO 작업'은 보통 일정 하나(기간)로.",
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '일정 이름' },
        start_date: date('시작일'),
        end_date: date('끝날. 하루짜리면 시작일과 같게'),
        stage: { type: 'string', description: '단계 목록 중 맞는 단계 이름, 애매하면 빈 문자열' },
        assignee: { type: 'string', description: '담당자(업체·사람). 없으면 빈 문자열' },
        memo: { type: 'string', description: '메모. 없으면 빈 문자열' },
      },
      required: ['title', 'start_date', 'end_date', 'stage', 'assignee', 'memo'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_daily_log',
    description: "'현장 일지' 하루치를 추가 제안. 그날 현장에서 한 작업 기록. 여러 날을 일지로 달라고 하면 날짜마다 하나씩(최대 31개).",
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        date: date('일지 날짜'),
        title: { type: 'string', description: '짧은 일지 제목 (예: 마당 바닥 공구리)' },
        summary: { type: 'string', description: '그날 진행한 작업 내용' },
        weather: { type: 'string', enum: ['sunny', 'cloudy', 'rain', 'snow'], description: '날씨. 말이 없으면 sunny' },
        workers_count: { type: 'integer', description: '투입 인원. 말이 없으면 0' },
        equipment_used: { type: 'string', description: '투입 장비. 없으면 빈 문자열' },
        issues: { type: 'string', description: '특이사항·이슈. 없으면 빈 문자열' },
        stage: { type: 'string', description: '단계 목록 중 맞는 단계 이름, 애매하면 빈 문자열' },
      },
      required: ['date', 'title', 'summary', 'weather', 'workers_count', 'equipment_used', 'issues', 'stage'],
      additionalProperties: false,
    },
  },
];

const list = (items) => (items?.length ? items.map(s => `- ${s}`).join('\n') : '(없음)');

function systemPrompt(ctx) {
  return `너는 자동차 정비소 지점 오픈을 관리하는 사이트의 기록 도우미야. 직원이 한국어로 부탁하면 알맞은 도구를 불러 '추가할 기록'을 제안해.
제안은 바로 저장되지 않고, 직원이 미리보기에서 확인한 뒤 저장해.

지금 지점: ${str(ctx.branchName) || '(이름 없음)'}
오늘: ${str(ctx.today)} (${str(ctx.weekday)}요일, 한국 시간)

담당자 명단:
${list(ctx.people)}

오픈 준비 그룹 목록:
${list(ctx.groups)}

오픈 준비 구분 목록:
${list(ctx.categories)}

단계 목록:
${list(ctx.stages)}

규칙:
- 어디에 넣을지: 큰 할 일·회의록·계획은 오픈 계획, 체크해 나가는 준비 항목은 오픈 준비, 기간이 있는 공사·작업은 일정, 그날 현장에서 한 일은 현장 일지.
- 한 문장에 여러 개를 부탁하면 도구를 여러 번 불러서 하나씩 제안해.
- "내일", "다음 주 화요일", "11월 3일~7일" 같은 날짜는 오늘을 기준으로 YYYY-MM-DD로 바꿔. 연도를 말하지 않으면 오늘과 가장 가까운 앞날로.
- 담당자는 명단의 이름과 맞춰 적어 (예: "홍우 씨" → 김홍우).
- 말하지 않은 내용은 지어내지 말고 빈 값으로 둬.
- 무엇을 넣을지 정말 알 수 없으면 도구를 부르지 말고, 무엇이 필요한지 한두 문장으로 짧게 물어봐.
- 도구를 부른 뒤에는 무엇을 제안했는지 한 줄로 짧게 말해. 기록을 지우거나 고치는 일은 할 수 없어.`;
}

async function ask({ message, model, context }) {
  if (!process.env.ANTHROPIC_API_KEY) throw new HttpError(500, 'Netlify 환경 변수에 ANTHROPIC_API_KEY가 없어요.');
  const text = str(message).trim().slice(0, 2000);
  if (!text) throw new HttpError(400, '부탁할 내용을 적어 주세요.');
  const modelId = MODELS[model] || MODELS.haiku;

  const client = new Anthropic();
  const params = {
    model: modelId,
    max_tokens: 8000,
    system: systemPrompt(context || {}),
    tools: TOOLS,
    // 빠른 모드는 조금 더 생각, 정밀 모드는 모델이 강하니 응답 시간을 줄이려고 낮게
    output_config: { effort: modelId === MODELS.haiku ? 'medium' : 'low' },
    messages: [{ role: 'user', content: text }],
  };

  let response;
  try {
    response = modelId === MODELS.opus
      // 정밀 모드: 안전 판단으로 드물게 거절되면 다른 모델이 같은 부탁을 자동으로 이어 받음
      ? await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
      : await client.messages.create(params);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new HttpError(500, 'Anthropic API 키가 맞지 않아요. Netlify의 ANTHROPIC_API_KEY를 확인해 주세요.');
    if (err instanceof Anthropic.RateLimitError) throw new HttpError(429, 'AI 요청이 너무 많아요. 잠시 후 다시 해 주세요.');
    if (err instanceof Anthropic.APIError) throw new HttpError(502, `AI 연결 오류 (${err.status}). 잠시 후 다시 해 주세요.`);
    throw err;
  }

  if (response.stop_reason === 'refusal') {
    return { proposals: [], reply: '이 부탁은 처리할 수 없어요. 문장을 바꿔서 다시 해 주세요.', model };
  }

  const proposals = [];
  let reply = '';
  for (const block of response.content) {
    if (block.type === 'tool_use' && TOOLS.some(t => t.name === block.name)) {
      proposals.push({ kind: block.name, input: block.input });
    } else if (block.type === 'text') {
      reply += block.text;
    }
  }
  if (response.stop_reason === 'max_tokens' && !proposals.length) {
    reply = '내용이 너무 길어서 다 정리하지 못했어요. 나눠서 부탁해 주세요.';
  }
  return { proposals: proposals.slice(0, 40), reply: reply.trim(), model, usage: response.usage };
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST로만 요청할 수 있어요.' }, 405);
  try {
    await verifyCaller(req);
    const body = await req.json().catch(() => ({}));
    return json(await ask(body));
  } catch (e) {
    console.error('ai-assistant 오류:', e);
    return json({ error: e.message || 'AI 비서 오류가 났어요.' }, e.status && e.status >= 400 ? e.status : 500);
  }
};
