/**
 * 노션 연결 프로그램 (Netlify Functions)
 * 사이트 → 노션 한 방향으로만 기록을 보냄. 노션에서 고친 내용은 사이트로 돌아오지 않음.
 *
 * 필요한 Netlify 환경 변수
 *   NOTION_TOKEN              노션 '연결'의 API 토큰 (비밀 — 코드나 채팅에 넣지 않음)
 *   NOTION_PARENT_PAGE        기록을 받을 노션 페이지 링크 (연결 추가가 되어 있어야 함)
 *   VITE_FIREBASE_PROJECT_ID  로그인 토큰 확인용 Firebase 프로젝트 ID
 *
 * 노션 구조:  부모 페이지 └ 지점 페이지 ├ 오픈 계획 ├ 오픈 준비 스케줄 ├ 일정 ├ 비용 └ 현장 일지  (모두 표)
 */
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { parseMiniDoc, parseInline, splitLinks } from '../../src/utils/miniDoc.js';

const NOTION_VERSION = '2022-06-28';
const NOTION_API = 'https://api.notion.com/v1';
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

// ---------- 공통 ----------
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});

class NotionError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function notion(path, method = 'GET', body) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${NOTION_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429) {
      await sleep((Number(res.headers.get('retry-after')) || 1) * 1000);
      continue;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new NotionError(res.status, data.message || `노션 오류 ${res.status}`);
    return data;
  }
  throw new NotionError(429, '노션 요청이 너무 많아요. 잠시 후 다시 시도해 주세요.');
}

/** 링크·ID 어디서든 노션 페이지 ID(32자리)를 꺼냄 */
function pageIdFrom(value = '') {
  const clean = value.split('?')[0].replace(/-/g, '');
  const matches = clean.match(/[0-9a-f]{32}/gi);
  return matches ? matches[matches.length - 1] : null;
}

const str = (v) => (v === null || v === undefined ? '' : String(v));
const option = (s) => str(s).replace(/,/g, ' ').trim().slice(0, 100);
const isHttp = (u) => /^https?:\/\//.test(str(u));

function richText(text = '') {
  const out = [];
  splitLinks(str(text)).forEach(p => {
    for (let i = 0; i < p.text.length; i += 1900) {
      out.push({ type: 'text', text: { content: p.text.slice(i, i + 1900), link: p.url ? { url: p.url } : null } });
    }
  });
  return out.length ? out : [{ type: 'text', text: { content: '' } }];
}

// 오픈 계획 본문용: 글씨색·배경색·[이름](주소) 링크까지 노션 글자 꾸밈으로 옮김
// (노션은 한 글자에 색을 하나만 쓸 수 있어서 배경색이 있으면 배경색을 씀)
function docRichText(text = '') {
  const out = [];
  parseInline(str(text)).forEach(p => {
    const color = p.bg ? `${p.bg}_background` : (p.color || 'default');
    const link = isHttp(p.url) && p.url.length <= 2000 ? { url: p.url } : null;
    const content = !p.url || link ? p.text : `${p.text} (사이트에서 열기)`;
    for (let i = 0; i < content.length; i += 1900) {
      out.push({ type: 'text', text: { content: content.slice(i, i + 1900), link }, annotations: { color } });
    }
  });
  return out.length ? out : [{ type: 'text', text: { content: '' } }];
}

const title = (t) => ({ title: richText(str(t).slice(0, 2000) || '제목 없음') });
const text = (t) => ({ rich_text: richText(str(t)) });
const select = (v) => ({ select: option(v) ? { name: option(v) } : null });
const multi = (list) => ({ multi_select: (list || []).map(n => ({ name: option(n) })).filter(o => o.name) });
const checkbox = (v) => ({ checkbox: Boolean(v) });
const number = (v) => ({ number: Number.isFinite(Number(v)) && str(v) !== '' ? Number(v) : null });
function date(start, end) {
  if (!start) return { date: null };
  return { date: { start, end: end && end > start ? end : null } };
}

const block = (type, content) => ({ object: 'block', type, [type]: content });
const para = (t) => block('paragraph', { rich_text: richText(t) });
const heading = (t) => block('heading_3', { rich_text: richText(t) });
const image = (url) => block('image', { type: 'external', external: { url } });

function miniDocBlocks(blocks) {
  return blocks.map(b => {
    if (b.kind === 'image') {
      // 저장소 주소 사진만 노션에 사진으로 (본문에 바로 넣은 작은 사진은 노션이 받지 못함)
      return isHttp(b.url) && b.url.length <= 2000
        ? image(b.url)
        : para(`🖼 ${b.text || '사진'} (사진은 사이트에서 볼 수 있어요)`);
    }
    const type = {
      h1: 'heading_1', h2: 'heading_2', h3: 'heading_3',
      bullet: 'bulleted_list_item', number: 'numbered_list_item', todo: 'to_do', para: 'paragraph',
    }[b.kind];
    const content = { rich_text: docRichText(b.text) };
    if (b.kind === 'todo') content.checked = Boolean(b.checked);
    if (b.children?.length) content.children = miniDocBlocks(b.children);
    return block(type, content);
  });
}

// ---------- 기록 종류별 노션 표 ----------
const STATUS_LABEL = { todo: '시작 전', doing: '진행 중', done: '완료' };

const KINDS = {
  plan: {
    idKey: 'plansDbId',
    dbTitle: '오픈 계획',
    schema: {
      이름: { title: {} },
      상태: { select: { options: [
        { name: '시작 전', color: 'gray' }, { name: '진행 중', color: 'blue' }, { name: '완료', color: 'green' },
      ] } },
      담당자1: { multi_select: {} },
      담당자2: { multi_select: {} },
      종료일: { date: {} },
      작성자: { rich_text: {} },
    },
    properties: (r) => ({
      이름: title(r.title),
      상태: { select: { name: STATUS_LABEL[r.status] || '시작 전' } },
      담당자1: multi(r.assignee1),
      담당자2: multi(r.assignee2),
      종료일: date(r.dueDate),
      작성자: text(r.author),
    }),
    blocks: (r) => miniDocBlocks(parseMiniDoc(r.body || '')),
  },
  task: {
    idKey: 'tasksDbId',
    dbTitle: '오픈 준비 스케줄',
    schema: {
      세부항목: { title: {} },
      그룹: { select: {} },
      구분: { select: {} },
      완료일자: { date: {} },
      완료여부: { checkbox: {} },
      담당자1: { multi_select: {} },
      담당자2: { multi_select: {} },
      비고: { rich_text: {} },
      '파일과 미디어': { files: {} },
    },
    properties: (r) => ({
      세부항목: title(r.title),
      그룹: select(r.group),
      구분: select(r.category),
      완료일자: date(r.startDate, r.endDate),
      완료여부: checkbox(r.done),
      담당자1: multi(r.assignee1),
      담당자2: multi(r.assignee2),
      비고: text(r.memo),
      '파일과 미디어': {
        files: (r.files || []).filter(f => isHttp(f.url))
          .map(f => ({ name: str(f.name || '파일').slice(0, 100), type: 'external', external: { url: f.url } })),
      },
    }),
  },
  schedule: {
    idKey: 'schedulesDbId',
    dbTitle: '일정',
    schema: {
      일정: { title: {} },
      단계: { select: {} },
      기간: { date: {} },
      완료: { checkbox: {} },
      담당자: { rich_text: {} },
      메모: { rich_text: {} },
    },
    properties: (r) => ({
      일정: title(r.title),
      단계: select(r.stageName),
      기간: date(r.startDate, r.endDate),
      완료: checkbox(r.done),
      담당자: text(r.assignee),
      메모: text(r.memo),
    }),
  },
  cost: {
    idKey: 'costsDbId',
    dbTitle: '비용',
    schema: {
      항목: { title: {} },
      단계: { select: {} },
      금액: { number: { format: 'won' } },
      날짜: { date: {} },
      '지급 상태': { select: { options: [{ name: '지급 완료', color: 'green' }, { name: '지급 예정', color: 'orange' }] } },
      카테고리: { select: {} },
      거래처: { rich_text: {} },
      담당자: { rich_text: {} },
      메모: { rich_text: {} },
    },
    // 계좌번호는 보내지 않음
    properties: (r) => ({
      항목: title(r.title),
      단계: select(r.stageName),
      금액: number(r.amount),
      날짜: date(r.date),
      '지급 상태': { select: { name: r.scheduled ? '지급 예정' : '지급 완료' } },
      카테고리: select(r.categoryLabel),
      거래처: text(r.vendor),
      담당자: text(r.assignee),
      메모: text(r.memo),
    }),
  },
  dailyLog: {
    idKey: 'logsDbId',
    dbTitle: '현장 일지',
    schema: {
      작업내용: { title: {} },
      날짜: { date: {} },
      단계: { select: {} },
      날씨: { select: {} },
      인원: { number: {} },
      작성자: { rich_text: {} },
      이슈: { rich_text: {} },
    },
    properties: (r) => ({
      작업내용: title(r.summary),
      날짜: date(r.date),
      단계: select(r.stageName),
      날씨: select(r.weatherLabel),
      인원: number(r.workersCount),
      작성자: text(r.author),
      이슈: text(r.issues),
    }),
    blocks: (r) => {
      const out = [para(r.summary || '')];
      if (r.equipmentUsed) out.push(para(`투입 장비: ${r.equipmentUsed}`));
      if (r.issues) out.push(para(`특이사항·이슈: ${r.issues}`));
      (r.photos || []).filter(isHttp).forEach(u => out.push(image(u)));
      (r.entries || []).forEach(e => {
        out.push(heading(`${e.timeTag || '추가 작업'}${e.time ? ` (${e.time})` : ''}`));
        if (e.summary) out.push(para(e.summary));
        if (e.issues) out.push(para(`이슈: ${e.issues}`));
        (e.photos || []).filter(isHttp).forEach(u => out.push(image(u)));
      });
      return out;
    },
  },
  document: {
    idKey: 'docsDbId',
    dbTitle: '서류·사진',
    schema: {
      이름: { title: {} },
      단계: { select: {} },
      분류: { select: {} },
      필수서류: { rich_text: {} },
      파일: { files: {} },
      메모: { rich_text: {} },
      '올린 날짜': { date: {} },
    },
    properties: (r) => ({
      이름: title(r.name),
      단계: select(r.stageName),
      분류: select(r.categoryLabel),
      필수서류: text(r.requiredDoc),
      파일: {
        files: isHttp(r.url) && r.url.length <= 2000
          ? [{ name: str(r.fileName || r.name || '파일').slice(0, 100), type: 'external', external: { url: r.url } }]
          : [],
      },
      메모: text(r.memo),
      '올린 날짜': date(r.date),
    }),
    // 사진이면 페이지 안에 사진을, 그 밖의 파일은 바로 열 수 있는 링크를 넣음
    blocks: (r) => {
      if (!isHttp(r.url) || r.url.length > 2000) return [para('파일은 사이트에서 볼 수 있어요.')];
      if (r.isImage) return [image(r.url)];
      return [block('paragraph', {
        rich_text: [{ type: 'text', text: { content: `📎 ${str(r.fileName || r.name || '파일').slice(0, 1900)}`, link: { url: r.url } } }],
      })];
    },
  },
};

// ---------- 로그인 확인 ----------
async function verifyCaller(req) {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new NotionError(500, 'Netlify 환경 변수에 VITE_FIREBASE_PROJECT_ID가 없어요.');
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new NotionError(401, '로그인이 필요해요.');

  let claims;
  try {
    ({ payload: claims } = await jwtVerify(token, FIREBASE_JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    }));
  } catch {
    throw new NotionError(401, '로그인 확인에 실패했어요. 다시 로그인해 주세요.');
  }

  // 사이트 설정(settings/members)에 허용 계정 목록이 있으면 그 안에 있어야 함
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/settings/members`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.status === 404) return claims; // 아직 관리자를 정하기 전
  if (!res.ok) throw new NotionError(403, '사이트 사용 허용 계정인지 확인하지 못했어요.');
  const doc = await res.json();
  const emails = (doc.fields?.emails?.arrayValue?.values || []).map(v => (v.stringValue || '').toLowerCase());
  if (!emails.includes(str(claims.email).toLowerCase())) {
    throw new NotionError(403, '노션으로 보낼 권한이 없는 계정이에요. 관리자에게 문의하세요.');
  }
  return claims;
}

// ---------- 노션 구조 준비 ----------
async function getAlive(path) {
  try {
    const obj = await notion(path);
    return obj.archived || obj.in_trash ? null : obj;
  } catch (e) {
    if (e.status === 404 || e.status === 400) return null;
    throw e;
  }
}

async function ensureDatabase(dbId, parentPageId, dbTitle, schema) {
  const existing = dbId ? await getAlive(`/databases/${dbId}`) : null;
  if (existing) {
    // 노션에서 칸이 지워졌으면 다시 만들어 둠 (이름이 같은 칸은 건드리지 않음)
    const missing = Object.fromEntries(
      Object.entries(schema).filter(([name, def]) => !def.title && !existing.properties?.[name]),
    );
    if (Object.keys(missing).length) await notion(`/databases/${dbId}`, 'PATCH', { properties: missing });
    return dbId;
  }
  const created = await notion('/databases', 'POST', {
    parent: { type: 'page_id', page_id: parentPageId },
    title: [{ type: 'text', text: { content: dbTitle } }],
    is_inline: true,
    properties: schema,
  });
  return created.id;
}

async function ensureBranch({ branch, ids = {} }) {
  const parent = pageIdFrom(process.env.NOTION_PARENT_PAGE || '');
  if (!parent) throw new NotionError(500, 'Netlify 환경 변수 NOTION_PARENT_PAGE에 노션 페이지 링크를 넣어 주세요.');
  const name = str(branch?.name || '이름 없는 지점').slice(0, 200);

  let branchPageId = ids.branchPageId && (await getAlive(`/pages/${ids.branchPageId}`)) ? ids.branchPageId : null;
  if (branchPageId) {
    await notion(`/pages/${branchPageId}`, 'PATCH', { properties: { title: { title: richText(name) } } });
  } else {
    const page = await notion('/pages', 'POST', {
      parent: { page_id: parent },
      icon: { type: 'emoji', emoji: '🏗️' },
      properties: { title: { title: richText(name) } },
      children: [block('callout', {
        icon: { type: 'emoji', emoji: '🔁' },
        rich_text: richText('이 페이지는 지점 오픈 관리 사이트에서 자동으로 채워져요. 내용은 사이트에서 고쳐 주세요 (노션에서 고친 내용은 사이트에 반영되지 않고, 사이트에서 다시 저장하면 덮어써져요).'),
      })],
    });
    branchPageId = page.id;
  }

  const out = { branchPageId };
  for (const kind of Object.values(KINDS)) {
    out[kind.idKey] = await ensureDatabase(ids[kind.idKey], branchPageId, kind.dbTitle, kind.schema);
  }
  return out;
}

// ---------- 기록 보내기 ----------
async function createPage(databaseId, properties, blocks = []) {
  const page = await notion('/pages', 'POST', {
    parent: { database_id: databaseId },
    properties,
    children: blocks.slice(0, 100),
  });
  for (let i = 100; i < blocks.length; i += 100) {
    await notion(`/blocks/${page.id}/children`, 'PATCH', { children: blocks.slice(i, i + 100) });
  }
  return page.id;
}

/**
 * 기록 하나 보내기 { kind, ids, record }
 * - 처음이면 새 페이지, 이미 보낸 적 있으면 칸만 고침
 * - 본문(bodyChanged)이 바뀌면 예전 페이지는 휴지통으로 옮기고 새로 만듦 (블록을 하나씩 지우는 것보다 빠름)
 */
async function upsert({ kind, ids, record }) {
  const def = KINDS[kind];
  if (!def) throw new NotionError(400, `알 수 없는 기록 종류: ${kind}`);
  const dbId = ids?.[def.idKey];
  if (!dbId) throw new NotionError(400, '지점의 노션 표 정보가 없어요. 다시 시도해 주세요.');

  const properties = def.properties(record);
  const pageId = record.notionPageId || null;
  const replaceBody = Boolean(def.blocks) && (record.bodyChanged || !pageId);

  if (pageId && !replaceBody) {
    try {
      const page = await notion(`/pages/${pageId}`, 'PATCH', { properties });
      if (!page.archived && !page.in_trash) return { pageId };
    } catch (e) {
      if (e.status !== 404 && e.status !== 400) throw e;
    }
  }
  if (pageId && replaceBody) {
    await notion(`/pages/${pageId}`, 'PATCH', { archived: true }).catch(() => {});
  }
  return { pageId: await createPage(dbId, properties, def.blocks ? def.blocks(record) : []) };
}

async function archivePage({ pageId }) {
  if (!pageId) return { ok: true };
  await notion(`/pages/${pageId}`, 'PATCH', { archived: true }).catch(e => {
    if (e.status !== 404 && e.status !== 400) throw e;
  });
  return { ok: true };
}

async function ping() {
  const parent = pageIdFrom(process.env.NOTION_PARENT_PAGE || '');
  if (!parent) throw new NotionError(500, 'Netlify 환경 변수 NOTION_PARENT_PAGE에 노션 페이지 링크를 넣어 주세요.');
  try {
    const page = await notion(`/pages/${parent}`);
    const titleProp = Object.values(page.properties || {}).find(p => p.type === 'title');
    const pageTitle = (titleProp?.title || []).map(t => t.plain_text).join('') || '(제목 없음)';
    return { ok: true, parentTitle: pageTitle };
  } catch (e) {
    if (e.status === 404) {
      throw new NotionError(404, '노션 페이지를 찾지 못했어요. 페이지 링크가 맞는지, 그 페이지에 "Branch Builder 연동" 연결을 추가했는지 확인해 주세요.');
    }
    if (e.status === 401) throw new NotionError(401, '노션 토큰이 맞지 않아요. Netlify의 NOTION_TOKEN 값을 확인해 주세요.');
    throw e;
  }
}

const ACTIONS = { ping, ensureBranch, upsert, archivePage };

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST로만 요청할 수 있어요.' }, 405);
  try {
    if (!process.env.NOTION_TOKEN) throw new NotionError(500, 'Netlify 환경 변수에 NOTION_TOKEN이 없어요.');
    await verifyCaller(req);
    const body = await req.json().catch(() => ({}));
    const handler = ACTIONS[body.action];
    if (!handler) return json({ error: `알 수 없는 요청: ${body.action}` }, 400);
    return json(await handler(body));
  } catch (e) {
    console.error('notion-sync 오류:', e);
    return json({ error: e.message || '노션 연결 중 오류가 났어요.' }, e.status && e.status >= 400 ? e.status : 500);
  }
};

// 점검용 (Netlify는 default만 사용)
export { ACTIONS as _actions, pageIdFrom as _pageIdFrom };
