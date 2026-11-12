/**
 * 지점 메뉴 8개. 메뉴 하나에 화면(views)이 여러 개면 메뉴 안 위쪽에서 바꿔 봄
 * - 주소의 ?tab= 에는 화면 이름(view id)이 들어감 → 예전 주소(tab=plans, tab=partner 등)도 그대로 열림
 * - mobile: 휴대폰 아래 막대에 바로 보이는 메뉴 (나머지는 '전체 메뉴')
 */
export const BRANCH_MENUS = [
  { id: 'stages', label: '단계별 기록', shortLabel: '단계별', iconName: 'building', color: 'emerald', views: [{ id: 'stages', label: '단계별 기록' }] },
  {
    id: 'todo', label: '할 일', shortLabel: '할 일', iconName: 'check', color: 'emerald', mobile: true,
    views: [{ id: 'tasks', label: '오픈 준비' }, { id: 'plans', label: '오픈 계획' }],
  },
  {
    id: 'schedule', label: '일정', shortLabel: '일정', iconName: 'calendar', color: 'emerald', mobile: true,
    views: [{ id: 'schedule', label: '일정표' }, { id: 'timeline', label: '날짜순 모아 보기' }, { id: 'log', label: '활동이력' }],
  },
  { id: 'dailylog', label: '현장 일지', shortLabel: '일지', iconName: 'edit', color: 'emerald', mobile: true, views: [{ id: 'dailylog', label: '현장 일지' }] },
  { id: 'lessons', label: '부족했던 점', shortLabel: '부족한점', iconName: 'alert', color: 'amber', mobile: true, views: [{ id: 'lessons', label: '부족했던 점' }] },
  { id: 'cost', label: '비용·예산', shortLabel: '비용', iconName: 'money', color: 'emerald', mobile: true, views: [{ id: 'cost', label: '비용·예산' }] },
  { id: 'documents', label: '서류·사진', shortLabel: '서류', iconName: 'document', color: 'emerald', views: [{ id: 'documents', label: '서류·사진' }] },
  {
    id: 'facility', label: '업체·시설', shortLabel: '업체·시설', iconName: 'partner', color: 'emerald',
    views: [{ id: 'partner', label: '협력업체' }, { id: 'equipment', label: '장비·시설 인허가' }, { id: 'defects', label: '하자·A/S' }],
  },
];

/** 모든 화면 이름 (주소 확인용) */
export const BRANCH_VIEWS = BRANCH_MENUS.flatMap(m => m.views.map(v => ({ ...v, menuId: m.id })));
export const MOBILE_MENUS = BRANCH_MENUS.filter(m => m.mobile);

/** 화면 이름 → 그 화면이 들어 있는 메뉴 */
export const menuOfView = (viewId) => BRANCH_MENUS.find(m => m.views.some(v => v.id === viewId)) || BRANCH_MENUS[0];

/** 메뉴 옆 숫자: 그 메뉴 안 화면들의 숫자 합 (counts: { 화면 이름: 숫자 }) */
export const menuCount = (menu, counts = {}) => menu.views.reduce((n, v) => n + (counts[v.id] || 0), 0);
