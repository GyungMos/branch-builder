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

// 기본 단계 템플릿 (임대차계약 → 준공 → 장비 설치 → 오픈 순서, 단계별 기본 체크리스트 포함)
export const DEFAULT_STAGES = [
  {
    name: '임대차 계약', order: 1,
    checklist: ['등기부등본·건축물대장 확인', '용도지역·정비업 가능 여부 확인', '임대차계약서 작성', '렌트프리 기간 협의'],
  },
  {
    name: '설계', order: 2,
    checklist: ['설계사무소 선정·계약', '정비동 배치(리프트 수·층고) 확정', '도면 확정'],
  },
  {
    name: '인허가', order: 3,
    checklist: ['건축허가 접수', '유관부서 협의·보완', '건축허가 완료(제세공과금 납부)'],
  },
  {
    name: '착공 준비', order: 4,
    checklist: ['시공사 계약', '착공 신고', '도로점용허가(차량 진출입로)'],
  },
  {
    name: '건축 시공', order: 5,
    checklist: ['골조 공사', '전기·급배수·오수 설비', '마감 공사', '감리 검측'],
  },
  {
    name: '준공(사용승인)', order: 6,
    checklist: ['사용승인 신청', '사용승인 완료', '건축물대장 등재 확인'],
  },
  {
    name: '장비 설치', order: 7,
    checklist: ['리프트 반입·설치', '컴프레서·에어 배관', '장비 시운전·안전검사'],
  },
  {
    name: '오픈 준비', order: 8,
    checklist: ['자동차관리사업(정비업) 등록', '간판·인테리어', '직원 채용·교육', '오픈 홍보'],
  },
];
