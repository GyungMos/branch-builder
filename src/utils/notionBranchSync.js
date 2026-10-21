import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { callNotion, ymd } from './notionSync';
import { COST_CATEGORIES } from './constants';
import { isScheduledCost } from './costs';

/** 기록 종류 → Firestore 하위 컬렉션 이름 */
export const NOTION_COLLECTIONS = {
  plan: 'openPlans',
  task: 'openTasks',
  schedule: 'schedules',
  cost: 'costs',
  dailyLog: 'dailyLogs',
};

const WEATHER_LABEL = { sunny: '맑음', cloudy: '흐림', rain: '우천', snow: '강설' };

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
      const body = r.body || '';
      return {
        bodyHash: textHash(body),
        record: {
          title: r.title, status: r.status, assignee1: r.assignee1 || [], assignee2: r.assignee2 || [],
          dueDate: ymd(r.dueDate), body, author: r.updatedBy || r.createdBy || '',
        },
      };
    }
    case 'task':
      return {
        record: {
          title: r.title, group: r.group || '', category: r.category || '',
          startDate: ymd(r.startDate), endDate: ymd(r.endDate), done: Boolean(r.done),
          assignee1: r.assignee1 || [], assignee2: r.assignee2 || [], memo: r.memo || '',
          files: (r.files || []).map(f => ({ name: f.name, url: f.url })),
        },
      };
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
        summary: r.summary, date: ymd(r.date), stageName, weatherLabel: WEATHER_LABEL[r.weather] || '',
        workersCount: r.workersCount || 0, author: r.author || '', issues: r.issues || '',
        equipmentUsed: r.equipmentUsed || '', photos: r.photos || [],
        entries: (r.entries || []).map(e => ({ timeTag: e.timeTag, time: e.time, summary: e.summary, issues: e.issues, photos: e.photos || [] })),
      };
      return {
        bodyHash: textHash(JSON.stringify([record.summary, record.equipmentUsed, record.issues, record.photos, record.entries])),
        record,
      };
    }
    default:
      throw new Error(`알 수 없는 기록 종류: ${kind}`);
  }
}

// 한 번 확인한 지점의 노션 표 정보는 이번 접속 동안 기억 (매번 확인하지 않도록)
const ensured = new Map();

/** 지점 페이지와 표들이 노션에 있는지 확인하고, 정보가 바뀌었으면 지점 기록에 저장 */
export async function ensureBranchNotion(branch, updateBranch) {
  const cached = ensured.get(branch.id);
  if (cached && cached.name === branch.name) return cached.ids;
  const res = await callNotion('ensureBranch', { branch: { id: branch.id, name: branch.name }, ids: branch.notion || {} });
  if (res.skipped) return null;
  const { branchPageId, plansDbId, tasksDbId, schedulesDbId, costsDbId, logsDbId } = res;
  const ids = { branchPageId, plansDbId, tasksDbId, schedulesDbId, costsDbId, logsDbId };
  if (JSON.stringify(branch.notion || {}) !== JSON.stringify(ids)) {
    await updateBranch(branch.id, { notion: ids });
  }
  ensured.set(branch.id, { name: branch.name, ids });
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
    const { record: payload, bodyHash } = toPayload(kind, record, stages);
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
  return { total: jobs.length, failed };
}
