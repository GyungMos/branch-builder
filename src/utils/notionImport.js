import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, loadStorage } from '../config/firebase';
import { generateId } from './formatters';

/**
 * 노션에서 묶어 온 압축 파일(.zip: data.json + files/…) 읽기
 * 압축하지 않고 묶은(저장 방식) zip만 읽음 — 노션 자료 묶기 도구가 만든 파일 형식
 */
export async function readNotionBundle(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(buf.buffer);
  const dec = new TextDecoder();

  // 끝에서 중앙 목록 위치 찾기
  let end = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error('압축 파일을 읽지 못했어요. 노션 자료 묶음(.zip)이 맞는지 확인해 주세요.');
  const count = view.getUint16(end + 10, true);
  let p = view.getUint32(end + 16, true);

  const entries = {};
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error('압축 파일 목록이 올바르지 않아요.');
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen));
    if (method !== 0) throw new Error('압축된 zip은 읽을 수 없어요. 노션 자료 묶기 도구로 만든 파일을 골라 주세요.');
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    entries[name] = buf.subarray(start, start + size);
    p += 46 + nameLen + extraLen + commentLen;
  }
  if (!entries['data.json']) throw new Error('압축 파일 안에 data.json이 없어요.');
  const data = JSON.parse(dec.decode(entries['data.json']));
  return { data, entries };
}

const MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  pdf: 'application/pdf', xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
const mimeOf = (path, type) => type || MIME[String(path).split('.').pop().toLowerCase()] || 'application/octet-stream';

function bytesToDataUrl(bytes, type) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(bin)}`;
}

/**
 * 노션 자료를 새 지점으로 넣기
 * - 지점을 만들고, 사진·파일을 저장소에 올린 뒤, 오픈 계획·오픈 준비 기록을 만듦
 * - onProgress({ text, done, total })
 */
export async function importNotionBundle({ bundle, branchName, addBranch, demoMode, user, onProgress }) {
  const { data, entries } = bundle;
  const uid = user?.displayName || user?.email || '관리자';
  const created = await addBranch({
    name: branchName,
    address: '',
    description: '노션 「오픈 계획」에서 가져온 지점',
  });
  const branchId = created.id;

  // 1) 사진·파일 올리기
  const urls = {};
  const files = (data.files || []).filter(f => f.path && entries[f.path]);
  const st = demoMode ? null : await loadStorage();
  if (!demoMode && !st) throw new Error('파일 저장소에 연결하지 못했어요.');
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    onProgress?.({ text: `사진·파일 올리는 중 (${i + 1}/${files.length})`, done: i, total: files.length });
    const bytes = entries[f.path];
    const type = mimeOf(f.path, f.type);
    if (demoMode) {
      // 데모 화면은 브라우저 저장 공간이 작아서 작은 사진만 바로 넣음
      urls[f.key] = { url: bytes.length < 150000 ? bytesToDataUrl(bytes, type) : '', name: f.name, storagePath: null };
      continue;
    }
    const storagePath = `branches/${branchId}/notionImport/${f.path.split('/').pop()}`;
    const ref = st.ref(st.storage, storagePath);
    await st.uploadBytes(ref, bytes, { contentType: type });
    urls[f.key] = { url: await st.getDownloadURL(ref), name: f.name, storagePath };
  }

  const pick = (keys = []) => Object.fromEntries(keys.filter(k => urls[k]?.url).map(k => [k, { url: urls[k].url, name: urls[k].name }]));

  const plans = (data.plans || []).map(p => ({
    title: p.title, status: p.status, assignee1: p.assignee1 || [], assignee2: p.assignee2 || [],
    dueDate: p.dueDate || null, body: p.body || '', attachments: pick(p.keys), order: p.order ?? 0,
  }));
  const tasks = (data.tasks || []).map(t => ({
    title: t.title, group: t.group || '', category: t.category || '',
    startDate: t.startDate || null, endDate: t.endDate || null, done: Boolean(t.done),
    assignee1: t.assignee1 || [], assignee2: t.assignee2 || [], memo: t.memo || '',
    body: t.body || '', attachments: pick(t.keys),
    files: (t.fileKeys || []).filter(f => urls[f.key]?.url)
      .map(f => ({ id: generateId(), name: f.name, url: urls[f.key].url, storagePath: urls[f.key].storagePath })),
    order: t.order ?? 0,
  }));

  // 2) 기록 만들기
  const write = async (name, items, label) => {
    if (demoMode || !db) {
      const key = `bb_${name}_${branchId}`;
      const list = items.map(it => ({ ...it, id: generateId(), createdAt: new Date().toISOString(), createdBy: uid }));
      localStorage.setItem(key, JSON.stringify(list));
      return;
    }
    for (let i = 0; i < items.length; i++) {
      onProgress?.({ text: `${label} 넣는 중 (${i + 1}/${items.length})`, done: i, total: items.length });
      await addDoc(collection(db, 'branches', branchId, name), { ...items[i], createdAt: serverTimestamp(), createdBy: uid });
    }
  };
  await write('openPlans', plans, '오픈 계획');
  await write('openTasks', tasks, '오픈 준비');

  const people = [...new Set([...plans, ...tasks].flatMap(r => [...r.assignee1, ...r.assignee2]))];
  return { branchId, plans: plans.length, tasks: tasks.length, files: files.length, people };
}
