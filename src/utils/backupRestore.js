/**
 * Branch Builder - 전체 데이터 백업 및 복원 유틸리티
 * 로컬스토리지 및 오프라인/데모 데이터를 안전하게 JSON 파일로 내보내고 불러옵니다.
 */

// 전체 데이터 JSON 내보내기 (백업)
export function exportAllDataAsJSON() {
  try {
    const backupData = {
      app: 'Branch Builder',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      data: {},
    };

    let keyCount = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('bb_')) {
        try {
          const val = localStorage.getItem(key);
          backupData.data[key] = JSON.parse(val);
          keyCount++;
        } catch {
          backupData.data[key] = localStorage.getItem(key);
        }
      }
    }

    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const dateStr = new Date().toISOString().split('T')[0];
    const link = document.createElement('a');
    link.href = url;
    link.download = `branch_builder_backup_${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true, keyCount };
  } catch (error) {
    console.error('Failed to export data:', error);
    return { success: false, error: error.message };
  }
}

// JSON 파일로부터 데이터 복원
export function importDataFromJSON(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('파일이 선택되지 않았습니다.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result;
        if (typeof content !== 'string') {
          throw new Error('파일 내용을 읽을 수 없습니다.');
        }

        const parsed = JSON.parse(content);
        if (!parsed.data || typeof parsed.data !== 'object') {
          throw new Error('유효한 Branch Builder 백업 파일이 아닙니다.');
        }

        let restoredCount = 0;
        Object.entries(parsed.data).forEach(([key, val]) => {
          if (key.startsWith('bb_')) {
            localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
            restoredCount++;
          }
        });

        resolve({
          success: true,
          restoredCount,
          exportedAt: parsed.exportedAt,
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('파일 읽기 오류가 발생했습니다.'));
    reader.readAsText(file);
  });
}
