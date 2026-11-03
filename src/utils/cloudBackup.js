import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db, loadStorage } from '../config/firebase';
import { BRANCH_COLLECTIONS } from './branchData';

/**
 * 서버(Firebase)에 있는 전체 기록 백업
 * - 지점(지운 지점 포함) + 지점 아래 모든 기록 + 휴지통·활동이력 + 예산 + 설정(계정·담당자)
 * - 파일(사진·서류)은 주소만 담김 (파일 자체는 저장소에 그대로 있음)
 * - 매주 한 번 관리자가 사이트를 열면 저장소 backups/ 에 자동으로 만들어 둠 (최근 12개만 남김)
 */
const AUTO_DAYS = 7;
const KEEP = 12;
const FOLDER = 'backups';

// Firestore 날짜(Timestamp)는 { __time: 'ISO 날짜' }로
const replacer = (key, value) => {
  if (value && typeof value === 'object' && typeof value.toDate === 'function') {
    return { __time: value.toDate().toISOString() };
  }
  return value;
};

async function readCollection(path) {
  try {
    const snap = await getDocs(collection(db, ...path));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn(`백업: ${path.join('/')} 읽기 실패`, err);
    return [];
  }
}

/** 전체 기록을 하나의 JSON 글로 */
export async function buildCloudBackup(onProgress) {
  const branches = await readCollection(['branches']);
  const out = { app: 'Branch Builder', kind: 'cloud', version: 2, exportedAt: new Date().toISOString(), branches: [], settings: {} };
  for (const [i, b] of branches.entries()) {
    onProgress?.(`${b.name || b.id} (${i + 1}/${branches.length})`);
    const entry = { ...b, data: {} };
    for (const n of [...BRANCH_COLLECTIONS, 'trash', 'logs']) {
      entry.data[n] = await readCollection(['branches', b.id, n]);
    }
    try {
      const budget = await getDoc(doc(db, 'branches', b.id, 'config', 'budget'));
      entry.data.budget = budget.exists() ? budget.data() : null;
    } catch { entry.data.budget = null; }
    out.branches.push(entry);
  }
  for (const name of ['members', 'people']) {
    try {
      const s = await getDoc(doc(db, 'settings', name));
      out.settings[name] = s.exists() ? s.data() : null;
    } catch { out.settings[name] = null; }
  }
  return JSON.stringify(out, replacer, 1);
}

const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
};

/** 내 컴퓨터로 내려받기 */
export function downloadText(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadCloudBackup(onProgress) {
  const text = await buildCloudBackup(onProgress);
  downloadText(text, `branch_builder_전체백업_${stamp()}.json`);
  return text.length;
}

/** 저장소에 있는 백업 목록 (최근 것부터) [{ name, date, path }] */
export async function listBackups() {
  const st = await loadStorage();
  if (!st) throw new Error('파일 저장소(Storage)가 켜져 있지 않아요.');
  const res = await st.listAll(st.ref(st.storage, FOLDER));
  return res.items
    .map(r => ({ name: r.name, path: r.fullPath, ref: r }))
    .sort((a, b) => b.name.localeCompare(a.name));
}

export async function backupUrl(item) {
  const st = await loadStorage();
  return st.getDownloadURL(item.ref);
}

/** 저장소에 백업 하나 만들기 (오래된 것은 KEEP개만 남기고 정리) */
export async function saveBackupToStorage(onProgress) {
  const st = await loadStorage();
  if (!st) throw new Error('파일 저장소(Storage)가 켜져 있지 않아요.');
  const text = await buildCloudBackup(onProgress);
  const ref = st.ref(st.storage, `${FOLDER}/backup_${stamp()}.json`);
  await st.uploadString(ref, text, 'raw', { contentType: 'application/json' });
  try {
    const list = await listBackups();
    for (const old of list.slice(KEEP)) await st.deleteObject(old.ref);
  } catch (err) {
    console.warn('오래된 백업 정리 실패:', err);
  }
  return text.length;
}

const nameDate = (name) => {
  const m = /backup_(\d{4})-(\d{2})-(\d{2})/.exec(name || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

/** 관리자가 사이트를 열면: 마지막 백업이 7일 넘었으면 조용히 새로 만듦 (하루 한 번만 확인) */
export async function autoBackupIfDue() {
  const checkKey = 'bb_backup_checked';
  const today = new Date().toISOString().slice(0, 10);
  try {
    if (localStorage.getItem(checkKey) === today) return null;
    localStorage.setItem(checkKey, today);
  } catch { /* 저장 공간 없음 */ }
  const list = await listBackups();
  const last = list.length ? nameDate(list[0].name) : null;
  if (last && Date.now() - last.getTime() < AUTO_DAYS * 86400000) return null;
  return saveBackupToStorage();
}
