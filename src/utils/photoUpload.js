import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';

/**
 * 캔버스를 사용해 이미지를 지정된 최대 가로폭과 품질로 리사이즈 및 압축
 */
export const compressImage = (file, maxWidth = 1200, quality = 0.75) => {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith('image/')) {
      resolve('');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target.result || '');
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };

      img.onerror = () => {
        resolve(e.target.result || '');
      };

      img.src = e.target.result;
    };

    reader.onerror = () => {
      resolve('');
    };

    reader.readAsDataURL(file);
  });
};

/**
 * 모바일 및 데스크톱에서 현장 사진을 Firebase Storage에 안전하게 업로드하고 다운로드 URL 반환.
 * Firebase Storage가 미연결이거나 오류 발생 시, Firestore 1MB 한도를 초과하지 않도록
 * 초경량(폭 500px, quality 0.5, 약 30KB) Base64로 fallback 처리합니다.
 */
export const uploadDailyLogPhoto = async (file, branchId = 'default') => {
  if (!file) return '';

  // 1단계: 선명도 유지 고화질 압축 (폭 1280px, 품질 0.75)
  const fullDataUrl = await compressImage(file, 1280, 0.75);
  if (!fullDataUrl) return '';

  // 2단계: Firebase Storage 시도 (성공 시 몇십 바이트의 짧은 HTTPS URL 반환)
  if (storage) {
    try {
      const randomStr = Math.random().toString(36).substring(2, 9);
      const storagePath = `branches/${branchId}/dailyLogs/${Date.now()}_${randomStr}.jpg`;
      const storageRef = ref(storage, storagePath);

      await uploadString(storageRef, fullDataUrl, 'data_url');
      const downloadUrl = await getDownloadURL(storageRef);
      return downloadUrl;
    } catch (err) {
      console.warn('Firebase Storage 업로드 실패, 초경량 Base64로 폴백:', err);
    }
  }

  // 3단계: Storage 사용 불가 시 Firestore 1MB 제한 보호를 위한 초경량 압축 (폭 500px, 품질 0.5)
  try {
    const miniDataUrl = await compressImage(file, 500, 0.5);
    return miniDataUrl || fullDataUrl;
  } catch {
    return fullDataUrl;
  }
};

/**
 * Firestore 전송 시 undefined 값으로 인한 'Unsupported field value: undefined' 에러 원천 방지
 */
export const sanitizeEntriesForFirestore = (entries = []) => {
  if (!Array.isArray(entries)) return [];

  return entries.map((entry) => ({
    id: entry.id || String(Date.now()),
    timeTag: (entry.timeTag || '오후 조치 / 추가 작업').trim(),
    time: entry.time || '',
    summary: (entry.summary || '').trim(),
    workersCount: Number(entry.workersCount) || 0,
    equipmentUsed: (entry.equipmentUsed || '').trim(),
    issues: (entry.issues || '').trim(),
    status: entry.status || 'resolved',
    photos: Array.isArray(entry.photos) ? entry.photos : [],
    author: entry.author || '현장 관리자',
    createdAt: entry.createdAt || new Date().toISOString(),
    ...(entry.updatedAt ? { updatedAt: entry.updatedAt } : {}),
  }));
};
