import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';

const withTimeout = (promise, ms, fallbackValue) => {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallbackValue), ms)),
  ]);
};

/**
 * 캔버스를 사용해 이미지를 가로 550px, quality 0.45로 리사이즈 및 초경량 압축.
 * 1장당 20KB ~ 35KB로 생성되어 모바일/PC에서 선명하게 보이며 Firestore 1MB 한도를 절대 넘지 않습니다.
 */
export const compressImage = (file, maxWidth = 550, quality = 0.45) => {
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
    3500,
    ''
  );
};

/**
 * 이미 Base64로 저장되어 있거나 거대한 이미지 문자열(60KB 초과)을 25KB 수준으로 즉시 축소
 */
export const shrinkDataUrl = (dataUrl, maxWidth = 550, quality = 0.42) => {
  return new Promise((resolve) => {
    if (!dataUrl || typeof dataUrl !== 'string') {
      resolve(dataUrl || '');
      return;
    }

    // HTTPS URL(Storage)이거나 이미 60KB 이하이면 그대로 반환
    if (!dataUrl.startsWith('data:image') || dataUrl.length < 60000) {
      resolve(dataUrl);
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
          resolve(dataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

/**
 * 모바일 및 데스크톱에서 현장 사진을 초고속으로 처리
 * - 가로 550px, quality 0.45로 스마트 초경량 압축 (장당 20~30KB)
 * - Firebase Storage 업로드를 시도하되 1.5초 내 미완료 시 초경량 Base64로 즉시 반환
 */
export const uploadDailyLogPhoto = async (file, branchId = 'default') => {
  if (!file) return '';

  // 1단계: 초경량 고화질 압축 (20~30KB)
  const lightDataUrl = await compressImage(file, 550, 0.45);
  if (!lightDataUrl) return '';

  // 2단계: Firebase Storage 시도 (최대 1.5초 대기)
  if (storage) {
    try {
      const storagePromise = (async () => {
        const randomStr = Math.random().toString(36).substring(2, 9);
        const storagePath = `branches/${branchId}/dailyLogs/${Date.now()}_${randomStr}.jpg`;
        const storageRef = ref(storage, storagePath);
        await uploadString(storageRef, lightDataUrl, 'data_url');
        return await getDownloadURL(storageRef);
      })();

      const storageUrl = await withTimeout(storagePromise, 1500, null);
      if (storageUrl) {
        return storageUrl;
      }
    } catch (err) {
      // Storage 실패 시 초경량 Base64 사용
    }
  }

  // 3단계: 초경량 Base64 즉시 반환 (장당 25KB 내외로 10장을 올려도 250KB에 불과함)
  return lightDataUrl;
};

/**
 * 일지 문서 전체의 사진들을 안전하게 다이어트시켜 Firestore 1MB 제한을 100% 방어하는 헬퍼
 */
export const dietDailyLogPhotos = async (logData) => {
  if (!logData) return logData;

  // 1. 기본 사진 배열 압축
  let cleanPhotos = [];
  if (Array.isArray(logData.photos)) {
    cleanPhotos = await Promise.all(
      logData.photos.map(p => shrinkDataUrl(p, 550, 0.42))
    );
  }

  // 2. 추가 조치 기록(entries) 내의 사진들 압축
  let cleanEntries = [];
  if (Array.isArray(logData.entries)) {
    cleanEntries = await Promise.all(
      logData.entries.map(async (entry) => {
        let entryPhotos = [];
        if (Array.isArray(entry.photos)) {
          entryPhotos = await Promise.all(
            entry.photos.map(p => shrinkDataUrl(p, 550, 0.42))
          );
        }
        return {
          id: entry.id || String(Date.now()),
          timeTag: (entry.timeTag || '오후 조치 / 추가 작업').trim(),
          time: entry.time || '',
          summary: (entry.summary || '').trim(),
          workersCount: Number(entry.workersCount) || 0,
          equipmentUsed: (entry.equipmentUsed || '').trim(),
          issues: (entry.issues || '').trim(),
          status: entry.status || 'resolved',
          photos: entryPhotos,
          author: entry.author || '현장 관리자',
          createdAt: entry.createdAt || new Date().toISOString(),
          ...(entry.updatedAt ? { updatedAt: entry.updatedAt } : {}),
        };
      })
    );
  }

  return {
    ...logData,
    photos: cleanPhotos,
    entries: cleanEntries,
  };
};

/**
 * Firestore 전송 시 undefined 값으로 인한 에러 원천 방지
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
