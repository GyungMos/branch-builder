// 날짜 포맷
export function formatDate(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatDateShort(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

export function formatDateInput(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  return d.toISOString().split('T')[0];
}

// 금액 포맷
export function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '₩0';
  return '₩' + Number(amount).toLocaleString('ko-KR');
}

// 파일 크기 포맷
export function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// 상대 시간 포맷
export function formatRelativeTime(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  const now = new Date();
  const diff = now - d;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 30) return formatDate(d);
  if (days > 0) return `${days}일 전`;
  if (hours > 0) return `${hours}시간 전`;
  if (minutes > 0) return `${minutes}분 전`;
  return '방금 전';
}

// ID 생성
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// D-Day 계산
export function getDDay(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));

  if (diff === 0) return { days: 0, label: 'D-Day', isPast: false };
  if (diff > 0) return { days: diff, label: `D-${diff}`, isPast: false };
  return { days: Math.abs(diff), label: `D+${Math.abs(diff)}`, isPast: true };
}
