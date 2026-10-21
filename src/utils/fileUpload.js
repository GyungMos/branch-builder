import { loadStorage } from '../config/firebase';
import { compressImage } from './photoUpload';
import { generateId } from './formatters';

const UPLOAD_TIMEOUT_MS = 25000;
// 저장소 없이 문서에 바로 넣는 파일 최대 크기 (데모 화면 전용)
const DEMO_FILE_LIMIT = 700 * 1024;

// 한 번 실패하면 이번 접속 동안은 사진을 바로 작은 사진으로 넣음 (매번 오래 기다리지 않게)
let storageFailed = false;

const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error('시간 초과')), ms)),
]);

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = reject;
  r.readAsDataURL(file);
});

export const STORAGE_OFF_MESSAGE = '파일 저장소(Storage)가 아직 켜져 있지 않아 파일을 올릴 수 없어요. 사진은 작게 줄여서 넣을 수 있어요.';

/**
 * 파일을 저장소에 올리고 { id, name, url, storagePath } 를 돌려줌
 * 저장소가 꺼져 있거나 응답이 없으면 STORAGE_OFF_MESSAGE 오류
 */
export async function uploadAttachment(file, { branchId, folder, demoMode }) {
  if (demoMode) {
    if (file.size > DEMO_FILE_LIMIT) throw new Error('데모 화면에서는 700KB 이하 파일만 올릴 수 있어요.');
    return { id: generateId(), name: file.name, url: await readAsDataUrl(file), storagePath: null };
  }
  const st = await loadStorage();
  if (!st) throw new Error(STORAGE_OFF_MESSAGE);
  const path = `branches/${branchId}/${folder}/${Date.now()}_${generateId()}_${file.name}`;
  try {
    const ref = st.ref(st.storage, path);
    await withTimeout(st.uploadBytes(ref, file), UPLOAD_TIMEOUT_MS);
    return { id: generateId(), name: file.name, url: await st.getDownloadURL(ref), storagePath: path };
  } catch {
    storageFailed = true;
    throw new Error(STORAGE_OFF_MESSAGE);
  }
}

/**
 * 본문에 넣을 사진: 저장소가 되면 고화질로 올린 주소, 안 되면 작게 줄인 사진을 본문에 바로 넣음
 */
export async function uploadDocPhoto(file, { branchId, demoMode }) {
  const light = await compressImage(file, 900, 0.6, 12000);
  if (!demoMode && !storageFailed) {
    try {
      const high = await compressImage(file, 1600, 0.82, 12000);
      const st = await loadStorage();
      if (st && (high || light)) {
        const path = `branches/${branchId}/openPlans/${Date.now()}_${generateId()}.jpg`;
        const ref = st.ref(st.storage, path);
        await withTimeout(st.uploadString(ref, high || light, 'data_url'), UPLOAD_TIMEOUT_MS);
        return await st.getDownloadURL(ref);
      }
    } catch {
      storageFailed = true;
      // 저장소가 꺼져 있으면 아래 작은 사진 사용
    }
  }
  if (!light) throw new Error('사진을 읽지 못했어요.');
  return light;
}
