import { doc, updateDoc } from 'firebase/firestore';
import { db, loadStorage } from '../config/firebase';
import { callNotion, ymd } from './notionSync';
import { COST_CATEGORIES, DOCUMENT_CATEGORIES } from './constants';
import { isScheduledCost } from './costs';
import { resolveAttachments } from './miniDoc';

/** 기록 종류 → Firestore 하위 컬렉션 이름 */
export const NOTION_COLLECTIONS = {
  plan: 'openPlans',
  task: 'openTasks',
  schedule: 'schedules',
  cost: 'costs',
  dailyLog: 'dailyLogs',
  document: 'documents',
};

const WEATHER_LABEL = { sunny: '맑음', cloudy: '흐림', rain: '우천', snow: '강설' };

const firstLine = (text = '') => {
  const line = String(text).split('\n').map(l => l.trim()).find(Boolean) || '현장 일지';
  return line.length > 40 ? `${line.slice(0, 40)}…` : line;
};

/** 본문이 바뀌었는지 비교하기 위한 짧은 지문 */
export function textHash(text = '') {
  let h = 5381;
  const s = String(text);
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

/**
 * 노션 표시용 정보만 기록에 덧붙임 (notionPageId 등).
 * 다른 저장 로직(사진 압축, 수정 시각 등)을 거치지 않도록 바로 고침.
 */
async function patchRecord(branchId, kind, id, data) {
  const name = NOTION_COLLECTIONS[kind];
  if (!db) {
    const key = `bb_${name}_${branchId}`;
    try {
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify(list.map(it => (it.id === id ? { ...it, ...data } : it))));
    } catch { /* 데모 저장소 사용 불가 */ }
    return;
  }
  await updateDoc(doc(db, 'branches', branchId, name, id), data);
}

/** 사이트 기록 → 노션에 보낼 내용 (본문이 있는 종류는 bodyHash도 함께) */
function toPayload(kind, r, stages = []) {
  const stageName = stages.find(s => s.id === r.stageId)?.name || '';
  switch (kind) {
    case 'plan': {
      const body = resolveAttachments(r.body || '', r.attachments, true);
      return {
        bodyHash: textHash(body),
        record: {
          title: r.title, status: r.status, assignee1: r.assignee1 || [], assignee2: r.assignee2 || [],
          dueDate: ymd(r.dueDate), body, author: r.updatedBy || r.createdBy || '',
        },
      };
    }
    case 'task': {
      const body = resolveAttachments(r.body || '', r.attachments, true);
      return {
        // 세부 내용이 생긴 항목만 노션 페이지 본문을 채움 (본문 없는 예전 항목은 그대로)
        bodyHash: body || r.notionBodyHash ? textHash(body) : undefined,
        record: {
          body,
          title: r.title, group: r.group || '', category: r.category || '',
          startDate: ymd(r.startDate), endDate: ymd(r.endDate), done: Boolean(r.done),
          assignee1: r.assignee1 || [], assignee2: r.assignee2 || [], memo: r.memo || '',
          files: (r.files || []).map(f => ({ name: f.name, url: f.url })),
        },
      };
    }
    case 'schedule':
      return {
        record: {
          title: r.title, stageName, startDate: ymd(r.startDate), endDate: ymd(r.endDate),
          done: r.status === 'completed' || r.status === 'complete', assignee: r.assignee || '', memo: r.memo || '',
        },
      };
    case 'cost':
      return {
        record: {
          title: r.title, stageName, amount: Number(r.amount) || 0, date: ymd(r.date),
          scheduled: isScheduledCost(r), categoryLabel: COST_CATEGORIES.find(c => c.id === r.category)?.label || '',
          vendor: r.vendor || '', assignee: r.assignee || '', memo: r.memo || '',
        },
      };
    case 'dailyLog': {
      const record = {
        // 제목이 없는 예전 일지는 작업 내용 첫 줄을 제목으로
        title: r.title || firstLine(r.summary),
        summary: r.summary, date: ymd(r.date), stageName, weatherLabel: WEATHER_LABEL[r.weather] || '',
        workersCount: r.workersCount || 0, author: r.author || '', issues: r.issues || '',
        equipmentUsed: r.equipmentUsed || '', photos: r.photos || [],
        entries: (r.entries || []).map(e => ({ timeTag: e.timeTag, time: e.time, summary: e.summary, issues: e.issues, photos: e.photos || [] })),
      };
      return {
        bodyHash: textHash(JSON.stringify(['v2', record.summary, record.equipmentUsed, record.issues, record.photos, record.entries])),
        record,
      };
    }
    case 'document': {
      const url = r.fileUrl || '';
      return {
        // 파일이 바뀌면 노션 페이지 안의 사진·링크도 새로
        bodyHash: textHash(url),
        record: {
          name: r.name || r.fileName || '', fileName: r.fileName || '', url, stageName,
          categoryLabel: DOCUMENT_CATEGORIES.find(c => c.id === r.category)?.label || '',
          requiredDoc: r.requiredDoc || '', memo: r.memo || '', date: ymd(r.createdAt),
          isImage: String(r.fileType || '').startsWith('image/') || r.category === 'photo',
        },
      };
    }
    default:
      throw new Error(`알 수 없는 기록 종류: ${kind}`);
  }
}

const isInline = (u) => String(u || '').startsWith('data:image/');
const UPLOAD_TIMEOUT_MS = 25000;

/**
 * 저장소를 켜기 전에 기록 안에 바로 넣어 둔 작은 사진(data:)을 저장소에 올리고 주소로 바꿈
 * → 노션은 주소가 있는 사진만 받을 수 있어서. 바뀐 주소는 사이트 기록에도 저장 (기록도 가벼워짐)
 * 저장소에 올리지 못하면 그 사진은 그대로 둠
 */
async function hostInlinePhotos(branchId, kind, record) {
  if (!db || (kind !== 'dailyLog' && kind !== 'plan')) return record;
  const inline = kind === 'dailyLog'
    ? [...(record.photos || []), ...(record.entries || []).flatMap(e => e.photos || [])].some(isInline)
    : Object.values(record.attachments || {}).some(a => isInline(a?.url));
  if (!inline) return record;

  const st = await loadStorage();
  if (!st) return record;
  const folder = kind === 'dailyLog' ? 'dailyLogs' : 'openPlans';
  let moved = 0;
  const host = async (url) => {
    if (!isInline(url)) return url;
    try {
      const ref = st.ref(st.storage, `branches/${branchId}/${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 9)}.jpg`);
      await Promise.race([
        st.uploadString(ref, url, 'data_url'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('시간 초과')), UPLOAD_TIMEOUT_MS)),
      ]);
      const hostedUrl = await st.getDownloadURL(ref);
      moved += 1;
      return hostedUrl;
    } catch {
      return url;
    }
  };

  let changes;
  if (kind === 'dailyLog') {
    const photos = await Promise.all((record.photos || []).map(host));
    const entries = await Promise.all((record.entries || []).map(async e => ({ ...e, photos: await Promise.all((e.photos || []).map(host)) })));
    changes = { photos, ...(record.entries ? { entries } : {}) };
  } else {
    const attachments = {};
    for (const [id, a] of Object.entries(record.attachments || {})) attachments[id] = { ...a, url: await host(a?.url) };
    changes = { attachments };
  }
  if (!moved) return record;
  await updateDoc(doc(db, 'branches', branchId, NOTION_COLLECTIONS[kind], record.id), changes).catch(() => {});
  return { ...record, ...changes };
}

// 한 번 확인한 지점의 노션 표 정보는 이번 접속 동안 기억 (매번 확인하지 않도록)
const ensured = new Map();

/** 지점 페이지와 표들이 노션에 있는지 확인하고, 정보가 바뀌었으면 지점 기록에 저장 */
export async function ensureBranchNotion(branch, updateBranch) {
  const cached = ensured.get(branch.id);
  if (cached && cached.name === branch.name) return cached.ids;
  const res = await callNotion('ensureBranch', { branch: { id: branch.id, name: branch.name }, ids: branch.notion || {} });
  if (res.skipped) return null;
  // 노션 쪽 정보(지점 페이지·표·자료 보관함·네모 칸 목차·보기 설정 버전)는 받은 그대로 지점 기록에 저장
  const { viewsError, layoutError, skipped, ...ids } = res;
  if (JSON.stringify(branch.notion || {}) !== JSON.stringify(ids)) {
    await updateBranch(branch.id, { notion: ids });
  }
  ensured.set(branch.id, { name: branch.name, ids, viewsError: [viewsError, layoutError].filter(Boolean).join(' / ') || null });
  return ids;
}

/**
 * 기록 하나를 노션으로 보냄. 결과(노션 페이지 번호 · 실패 이유)는 기록에 남김.
 * 실패해도 사이트 저장에는 영향 없음.
 */
export async function syncToNotion(kind, branch, record, { updateBranch, stages = [] }) {
  if (!record?.id) return { skipped: true };
  try {
    const ids = await ensureBranchNotion(branch, updateBranch);
    if (!ids) return { skipped: true };
    const hosted = await hostInlinePhotos(branch.id, kind, record);
    const { record: payload, bodyHash } = toPayload(kind, hosted, stages);
    const res = await callNotion('upsert', {
      kind,
      ids,
      record: { ...payload, notionPageId: record.notionPageId || null, bodyChanged: bodyHash ? bodyHash !== record.notionBodyHash : false },
    });
    await patchRecord(branch.id, kind, record.id, {
      notionPageId: res.pageId,
      notionError: null,
      notionSyncedAt: new Date().toISOString(),
      ...(bodyHash ? { notionBodyHash: bodyHash } : {}),
    });
    return { ok: true };
  } catch (err) {
    await patchRecord(branch.id, kind, record.id, { notionError: err.message }).catch(() => {});
    return { error: err.message };
  }
}

/** 사이트에서 지운 기록은 노션에서도 휴지통으로 */
export async function archiveNotionPage(pageId) {
  if (!pageId) return;
  try {
    await callNotion('archivePage', { pageId });
  } catch (err) {
    console.warn('노션 페이지 정리 실패:', err);
  }
}

/** 지점 하나의 기록을 전부 노션으로 (처음 연결할 때·실패분 다시 보내기) */
export async function syncBranchAll(branch, data, { updateBranch, onProgress, onlyUnsynced = false }) {
  // 보낼 기록이 없어도 지점 페이지·표·보기(상태별 보드 등)는 맞춰 둠
  let viewsError = null;
  try {
    await ensureBranchNotion(branch, updateBranch);
    viewsError = ensured.get(branch.id)?.viewsError || null;
  } catch { /* 각 기록을 보낼 때 다시 시도 */ }
  const jobs = [];
  Object.entries(NOTION_COLLECTIONS).forEach(([kind, name]) => {
    (data[name] || []).forEach(rec => {
      if (onlyUnsynced && rec.notionPageId && !rec.notionError) return;
      jobs.push({ kind, rec });
    });
  });
  let done = 0;
  let failed = 0;
  for (const job of jobs) {
    const res = await syncToNotion(job.kind, branch, job.rec, { updateBranch, stages: data.stages || [] });
    done += 1;
    if (res.error) failed += 1;
    onProgress?.({ done, total: jobs.length, failed });
  }
  return { total: jobs.length, failed, viewsError };
}
