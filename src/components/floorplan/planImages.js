import { collection, doc, getDoc } from 'firebase/firestore';
import { addDoc } from '../../utils/offlineWrite';
import { db } from '../../config/firebase';
import { generateId } from '../../utils/formatters';

/**
 * 배치도 도면 그림
 * - 도면은 파일 저장소 없이도 되도록 줄인 그림을 기록 하나(branches/{지점}/layoutImages/{번호})에 따로 넣음
 *   (기록 하나는 1MB까지라 900KB 아래로 줄임)
 * - PDF는 고른 쪽을 그림으로 바꿔서 넣음
 */
const MAX_CHARS = 900 * 1024;

const loadImg = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('그림을 읽지 못했어요.'));
  img.src = src;
});

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = reject;
  r.readAsDataURL(file);
});

let pdfjsPromise = null;
async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    });
  }
  return pdfjsPromise;
}

export const isPdf = (file) => file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name));

/** PDF 쪽 수 */
export async function pdfPageCount(file) {
  const pdfjs = await loadPdfjs();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  return pdf.numPages;
}

async function pdfToCanvas(file, pageNo = 1) {
  const pdfjs = await loadPdfjs();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const page = await pdf.getPage(Math.min(Math.max(1, pageNo), pdf.numPages));
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(4, 3200 / Math.max(base.width, base.height));
  const vp = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
  return canvas;
}

/** 큰 그림을 기록에 들어갈 크기로 줄이기 */
function shrinkToLimit(source, srcW, srcH, { maxSide = 2600, limit = MAX_CHARS, type = 'image/jpeg' } = {}) {
  let side = maxSide;
  for (let tries = 0; tries < 8; tries++) {
    const k = Math.min(1, side / Math.max(srcW, srcH));
    const w = Math.round(srcW * k); const h = Math.round(srcH * k);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    if (type === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
    ctx.drawImage(source, 0, 0, w, h);
    for (const q of [0.82, 0.7, 0.58]) {
      const url = c.toDataURL(type, q);
      if (url.length <= limit) return { dataUrl: url, w, h };
    }
    side *= 0.8;
  }
  throw new Error('그림이 너무 커서 줄이지 못했어요.');
}

/** 도면 파일(그림 또는 PDF) → { dataUrl, w, h } */
export async function fileToPlanImage(file, pageNo = 1) {
  if (isPdf(file)) {
    const canvas = await pdfToCanvas(file, pageNo);
    return shrinkToLimit(canvas, canvas.width, canvas.height);
  }
  if (!file.type.startsWith('image/')) throw new Error('그림(JPG·PNG) 또는 PDF 파일만 올릴 수 있어요.');
  const img = await loadImg(await readAsDataUrl(file));
  return shrinkToLimit(img, img.naturalWidth, img.naturalHeight);
}

/** 비품 그림(위에서 본 그림) → 작게 줄인 그림 (바탕이 투명하면 그대로) */
export async function fileToItemImage(file) {
  const img = await loadImg(await readAsDataUrl(file));
  try {
    return shrinkToLimit(img, img.naturalWidth, img.naturalHeight, { maxSide: 600, limit: 120 * 1024, type: 'image/webp' });
  } catch {
    return shrinkToLimit(img, img.naturalWidth, img.naturalHeight, { maxSide: 500, limit: 120 * 1024 });
  }
}

/** 사진 상자 한 면 사진 → 작은 JPG (한 면 80KB 아래) */
export async function fileToFaceImage(file, { maxSide = 640, limit = 80 * 1024 } = {}) {
  if (!file.type.startsWith('image/')) throw new Error('사진(JPG·PNG) 파일만 올릴 수 있어요.');
  const img = await loadImg(await readAsDataUrl(file));
  return shrinkToLimit(img, img.naturalWidth, img.naturalHeight, { maxSide, limit });
}

const localKey = (branchId) => `bb_layoutImages_${branchId}`;

/** 도면 그림 저장 → { branchId, id } */
export async function saveBgImage(branchId, demoMode, { dataUrl, w, h, name }) {
  if (demoMode || !db) {
    const list = JSON.parse(localStorage.getItem(localKey(branchId)) || '[]');
    const id = generateId();
    list.push({ id, data: dataUrl, w, h, name });
    try {
      localStorage.setItem(localKey(branchId), JSON.stringify(list));
    } catch {
      throw new Error('이 브라우저 저장 공간이 모자라 도면을 넣지 못했어요.');
    }
    return { branchId, id };
  }
  const ref = await addDoc(collection(db, 'branches', branchId, 'layoutImages'), {
    data: dataUrl, w, h, name: name || '', createdAt: new Date().toISOString(),
  });
  return { branchId, id: ref.id };
}

const cache = new Map();

/** 도면 그림 불러오기 → dataUrl */
export async function loadBgImage(ref, demoMode) {
  if (!ref?.id) return null;
  const key = `${ref.branchId}/${ref.id}`;
  if (cache.has(key)) return cache.get(key);
  let data = null;
  if (demoMode || !db) {
    const list = JSON.parse(localStorage.getItem(localKey(ref.branchId)) || '[]');
    data = list.find(x => x.id === ref.id)?.data || null;
  } else {
    const snap = await getDoc(doc(db, 'branches', ref.branchId, 'layoutImages', ref.id));
    data = snap.exists() ? snap.data().data : null;
  }
  if (data) cache.set(key, data);
  return data;
}

export function rememberBgImage(ref, dataUrl) {
  if (ref?.id) cache.set(`${ref.branchId}/${ref.id}`, dataUrl);
}
