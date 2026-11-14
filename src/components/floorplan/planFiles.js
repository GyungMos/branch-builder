import { loadStorage } from '../../config/firebase';
import { generateId } from '../../utils/formatters';

/**
 * 배치도 비품에 붙이는 파일 (3D 모델 GLB, 사진 상자 면 사진)
 * - 파일 저장소(Storage)의 branches/_shared/planFiles 에 올림 → 모든 지점이 '내 비품'으로 같이 씀
 * - 데모 화면·저장소가 꺼진 경우: 작은 파일만 기록 안에 바로 넣음(dataURL)
 * - 3D 화면은 그림·모델을 WebGL로 읽어서 다른 주소(저장소)면 막힐 수 있음(CORS)
 *   → 사이트 주소의 /fbfiles/ 로 돌려서 읽음 (netlify.toml·vite.config.js 의 프록시)
 */

const STORAGE_HOST = 'https://firebasestorage.googleapis.com/';
export const MODEL_MAX = 20 * 1024 * 1024;
const MODEL_DEMO_MAX = 1.5 * 1024 * 1024;

const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error('시간 초과')), ms)),
]);

const readAsDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = reject;
  r.readAsDataURL(blob);
});

/** 3D 화면에서 읽을 주소 (저장소 주소는 같은 사이트 주소로) */
export function fileUrl(url) {
  if (!url) return url;
  if (url.startsWith(STORAGE_HOST)) return `/fbfiles/${url.slice(STORAGE_HOST.length)}`;
  return url;
}

async function uploadToStorage(data, { name, contentType, timeout = 60000 }) {
  const st = await loadStorage();
  if (!st) return null;
  const path = `branches/_shared/planFiles/${Date.now()}_${generateId()}_${name}`;
  const ref = st.ref(st.storage, path);
  if (typeof data === 'string') await withTimeout(st.uploadString(ref, data, 'data_url'), timeout);
  else await withTimeout(st.uploadBytes(ref, data, { contentType }), timeout);
  return { url: await st.getDownloadURL(ref), path };
}

/** 3D 모델 파일(.glb) 올리기 → { url, name, size } */
export async function uploadModelFile(file, demoMode) {
  if (!/\.glb$/i.test(file.name)) throw new Error('3D 모델은 .glb 파일만 올릴 수 있어요. (.gltf·.obj·.fbx·.skp는 Blender 등에서 GLB로 바꿔 주세요)');
  if (file.size > MODEL_MAX) throw new Error(`파일이 너무 커요 (${(file.size / 1048576).toFixed(1)}MB). 20MB 아래로 줄여 주세요.`);
  if (!demoMode) {
    try {
      const r = await uploadToStorage(file, { name: file.name.replace(/[^\w.-]/g, '_'), contentType: 'model/gltf-binary', timeout: 120000 });
      if (r) return { url: r.url, path: r.path, name: file.name, size: file.size };
    } catch (err) {
      console.warn('모델 올리기 실패', err);
    }
    if (file.size > MODEL_DEMO_MAX) throw new Error('파일 저장소에 올리지 못했어요. 인터넷 연결이나 저장소(Storage) 설정을 확인해 주세요.');
  } else if (file.size > MODEL_DEMO_MAX) {
    throw new Error('데모 화면에서는 1.5MB 아래 모델만 넣을 수 있어요.');
  }
  return { url: await readAsDataUrl(file), path: null, name: file.name, size: file.size };
}

/** 사진 상자 면 사진(작게 줄인 dataURL) 올리기 → 주소 */
export async function uploadFaceImage(dataUrl, demoMode) {
  if (demoMode) return dataUrl;
  try {
    const r = await uploadToStorage(dataUrl, { name: 'face.jpg' });
    if (r) return r.url;
  } catch (err) {
    console.warn('사진 올리기 실패 — 기록 안에 바로 넣음', err);
  }
  return dataUrl;
}
