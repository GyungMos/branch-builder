import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';

/**
 * Promise에 타임아웃을 적용하는 헬퍼 (무한 멈춤 원천 방지)
 */
const withTimeout = (promise, ms, fallbackValue) => {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallbackValue), ms)),
  ]);
};

/**
 * 캔버스를 사용해 이미지를 적절한 크기와 용량으로 즉시 리사이즈 및 압축 (최대 3초 타임아웃)
 * 가로 800px, quality 0.6 => 장당 30~50KB (Firestore 1MB 한도 내 15장 이상 거뜬히 수용)
 */
export const compressImage = (file, maxWidth = 800, quality = 0.6) => {
  return withTimeout(
    new Promise((resolve) => {
      if (!file) {
        resolve('');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (!result) {
          resolve('');
          return;
        }

        const img = new Image();
        img.onload = () => {
          try {
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
              resolve(typeof result === 'string' ? result : '');
              return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            const compressedUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(compressedUrl);
          } catch (err) {
            console.warn('Canvas 압축 오류, 원본으로 폴백:', err);
            resolve(typeof result === 'string' ? result : '');
          }
        };

        img.onerror = () => {
          resolve(typeof result === 'string' ? result : '');
        };

        img.src = result;
      };

      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    }),
    3500, // 최대 3.5초 안전 타임아웃
    ''
  );
};

/**
 * 모바일 및 데스크톱에서 현장 사진을 초고속으로 처리
 * 1. 브라우저에서 가로 800px, quality 0.6으로 초경량 압축 (약 30~50KB, 0.2초 소요)
 * 2. Firebase Storage가 사용 가능한 경우 2초 타임아웃으로 업로드 시도
 * 3. 2초 안에 안 끝나거나 Storage 권한 오류 발생 시, 멈추지 않고 즉시 압축된 초경량 Base64로 즉각 반환!
 */
export const uploadDailyLogPhoto = async (file, branchId = 'default') => {
  if (!file) return '';

  // 1단계: 초경량 고화질 압축 (30~50KB) - 1MB 한도 걱정 없는 안전한 크기
  const lightDataUrl = await compressImage(file, 800, 0.6);
  if (!lightDataUrl) return '';

  // 2단계: Firebase Storage 시도하되, 최대 2초만 기다림 (무한 대기 방지!)
  if (storage) {
    try {
      const storagePromise = (async () => {
        const randomStr = Math.random().toString(36).substring(2, 9);
        const storagePath = `branches/${branchId}/dailyLogs/${Date.now()}_${randomStr}.jpg`;
        const storageRef = ref(storage, storagePath);
        await uploadString(storageRef, lightDataUrl, 'data_url');
        return await getDownloadURL(storageRef);
      })();

      // 2초 이내에 완료되면 Storage URL 사용, 넘어가면 바로 lightDataUrl 사용
      const storageUrl = await withTimeout(storagePromise, 2000, null);
      if (storageUrl) {
        return storageUrl;
      }
    } catch (err) {
      console.warn('Firebase Storage 업로드 실패 또는 시간 초과, 초경량 Base64 사용:', err);
    }
  }

  // 3단계: 즉시 초경량 Base64 반환 (장당 30~50KB이므로 Firestore 1MB에 아무 문제 없음)
  return lightDataUrl;
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
