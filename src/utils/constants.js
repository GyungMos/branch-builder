// 서류 카테고리
export const DOCUMENT_CATEGORIES = [
  { id: 'contract', label: '계약서', icon: '📝', iconName: 'document', color: 'cyan' },
  { id: 'permit', label: '인허가', icon: '📋', iconName: 'permit', color: 'violet' },
  { id: 'blueprint', label: '도면/설계', icon: '📐', iconName: 'design', color: 'blue' },
  { id: 'photo', label: '사진', icon: '📸', iconName: 'photo', color: 'rose' },
  { id: 'receipt', label: '영수증/세금계산서', icon: '🧾', iconName: 'money', color: 'emerald' },
  { id: 'etc', label: '기타', icon: '📁', iconName: 'etc', color: 'slate' },
];

// 비용 카테고리
export const COST_CATEGORIES = [
  { id: 'land', label: '토지/임대', icon: '🏗️', iconName: 'land', color: 'emerald' },
  { id: 'design', label: '설계', icon: '📐', iconName: 'design', color: 'blue' },
  { id: 'permit', label: '인허가', icon: '📋', iconName: 'permit', color: 'violet' },
  { id: 'construction', label: '건축/시공', icon: '🔨', iconName: 'construction', color: 'amber' },
  { id: 'equipment', label: '장비/설비', icon: '⚙️', iconName: 'equipment', color: 'cyan' },
  { id: 'interior', label: '인테리어', icon: '🎨', iconName: 'interior', color: 'rose' },
  { id: 'etc', label: '기타', icon: '📦', iconName: 'etc', color: 'slate' },
];

// 단계 상태
export const STAGE_STATUS = {
  waiting: { label: '대기', color: 'waiting', icon: '⏳' },
  progress: { label: '진행중', color: 'progress', icon: '🔄' },
  complete: { label: '완료', color: 'complete', icon: '✅' },
};

// 지점 상태
export const BRANCH_STATUS = {
  planning: { label: '계획중', color: 'info' },
  progress: { label: '진행중', color: 'warning' },
  complete: { label: '완료', color: 'success' },
  paused: { label: '일시중지', color: 'neutral' },
};

// 기본 단계 템플릿
export const DEFAULT_STAGES = [
  { name: '토지 탐색/계약', order: 1 },
  { name: '설계', order: 2 },
  { name: '인허가', order: 3 },
  { name: '건축/시공', order: 4 },
  { name: '장비 설치', order: 5 },
  { name: '오픈 준비', order: 6 },
  { name: '오픈/운영', order: 7 },
];
