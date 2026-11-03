// 지점 상세 메뉴: PC는 왼쪽 메뉴 목록(묶음별), 휴대폰은 아래 막대(mobile) + '전체 메뉴'
export const BRANCH_TABS = [
  { id: 'stages', label: '단계별 기록', shortLabel: '단계별', iconName: 'building', color: 'emerald', group: '공사 기록' },
  { id: 'plans', label: '오픈 계획', shortLabel: '오픈계획', iconName: 'dashboard', color: 'cyan', group: '공사 기록' },
  { id: 'tasks', label: '오픈 준비', shortLabel: '오픈준비', iconName: 'check', color: 'emerald', group: '공사 기록', mobile: true },
  { id: 'schedule', label: '일정', shortLabel: '일정', iconName: 'calendar', color: 'blue', group: '공사 기록', mobile: true },
  { id: 'dailylog', label: '현장 일지', shortLabel: '일지', iconName: 'edit', color: 'emerald', group: '공사 기록', mobile: true },
  { id: 'lessons', label: '부족했던 점', shortLabel: '부족한점', iconName: 'alert', color: 'amber', group: '공사 기록', mobile: true },
  { id: 'cost', label: '비용/예산', shortLabel: '비용', iconName: 'money', color: 'amber', group: '돈·자료', mobile: true },
  { id: 'documents', label: '서류/사진', shortLabel: '서류/사진', iconName: 'document', color: 'emerald', group: '돈·자료' },
  { id: 'partner', label: '협력업체', shortLabel: '협력업체', iconName: 'partner', color: 'coral', group: '업체·시설' },
  { id: 'equipment', label: '장비/시설인허가', shortLabel: '장비', iconName: 'equipment', color: 'violet', group: '업체·시설' },
  { id: 'defects', label: '하자·A/S', shortLabel: '하자·A/S', iconName: 'alert', color: 'rose', group: '업체·시설' },
  { id: 'timeline', label: '날짜순 타임라인', shortLabel: '날짜순', iconName: 'timeline', color: 'cyan', group: '모아 보기' },
  { id: 'log', label: '활동이력', shortLabel: '활동이력', iconName: 'history', color: 'rose', group: '모아 보기' },
];

export const MOBILE_TABS = BRANCH_TABS.filter(t => t.mobile);

/** 묶음별 목록 [{ group, tabs }] */
export const TAB_GROUPS = BRANCH_TABS.reduce((out, tab) => {
  const g = out.find(x => x.group === tab.group);
  if (g) g.tabs.push(tab);
  else out.push({ group: tab.group, tabs: [tab] });
  return out;
}, []);
