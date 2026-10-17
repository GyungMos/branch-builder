// 지점 상세 탭: 자주 쓰는 4개(primary)는 바로 보이고, 나머지는 '더보기'에 모음
export const BRANCH_TABS = [
  { id: 'stages', label: '단계별 기록', shortLabel: '단계별', iconName: 'building', color: 'emerald', primary: true },
  { id: 'schedule', label: '일정/현장 일지', shortLabel: '일정/일지', iconName: 'calendar', color: 'blue', primary: true },
  { id: 'cost', label: '비용/예산', shortLabel: '비용', iconName: 'money', color: 'amber', primary: true },
  { id: 'documents', label: '서류/사진', shortLabel: '서류/사진', iconName: 'document', color: 'emerald', primary: true },
  { id: 'timeline', label: '날짜순 타임라인', shortLabel: '날짜순', iconName: 'timeline', color: 'cyan', primary: false },
  { id: 'equipment', label: '장비/시설인허가', shortLabel: '장비', iconName: 'equipment', color: 'violet', primary: false },
  { id: 'partner', label: '협력업체', shortLabel: '협력업체', iconName: 'partner', color: 'coral', primary: false },
  { id: 'log', label: '활동이력', shortLabel: '활동이력', iconName: 'history', color: 'rose', primary: false },
];

export const PRIMARY_TABS = BRANCH_TABS.filter(t => t.primary);
export const MORE_TABS = BRANCH_TABS.filter(t => !t.primary);
