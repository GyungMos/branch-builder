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
// match: 기존 지점의 단계 이름을 표준 단계에 맞출 때 같은 단계로 볼 이름 규칙
export const DEFAULT_STAGES = [
  {
    name: '임대차 계약', order: 1, match: /임대|토지|부지|계약/,
    checklist: ['등기부등본·건축물대장 확인', '용도지역·정비업 가능 여부 확인', '임대차계약서 작성', '렌트프리 기간 협의'],
    requiredDocs: ['임대차계약서', '등기부등본', '건축물대장·토지대장'],
  },
  {
    name: '설계', order: 2, match: /설계/,
    checklist: ['설계사무소 선정·계약', '정비동 배치(리프트 수·층고) 확정', '도면 확정'],
    requiredDocs: ['설계계약서', '감리계약서', '확정 도면'],
  },
  {
    name: '인허가', order: 3, match: /인허가|허가/,
    checklist: ['건축허가 접수', '유관부서 협의·보완', '건축허가 완료(제세공과금 납부)'],
    requiredDocs: ['건축허가서', '제세공과금 영수증'],
  },
  {
    name: '착공 준비', order: 4, match: /착공/,
    checklist: ['시공사 계약', '착공 신고', '도로점용허가(차량 진출입로)'],
    requiredDocs: ['공사계약서', '착공신고필증', '도로점용허가서'],
  },
  {
    name: '건축 시공', order: 5, match: /시공|골조|공사/,
    checklist: ['골조 공사', '전기·급배수·오수 설비', '마감 공사', '감리 검측'],
    requiredDocs: ['기성 세금계산서', '감리 검측 기록'],
  },
  {
    name: '준공(사용승인)', order: 6, match: /준공|사용승인/,
    checklist: ['사용승인 신청', '사용승인 완료', '건축물대장 등재 확인'],
    requiredDocs: ['사용승인서', '건축물대장(신규)'],
  },
  {
    name: '장비 설치', order: 7, match: /장비/,
    checklist: ['리프트 반입·설치', '컴프레서·에어 배관', '장비 시운전·안전검사'],
    requiredDocs: ['장비 구매계약서', '리프트 안전검사 성적서', '장비 보증서'],
  },
  {
    name: '오픈 준비', order: 8, match: /오픈|개업/,
    checklist: ['자동차관리사업(정비업) 등록', '간판·인테리어', '직원 채용·교육', '오픈 홍보'],
    requiredDocs: ['자동차관리사업 등록증', '사업자등록증', '영업배상책임보험 증권'],
  },
];

// 오픈 준비 스케줄 기본 그룹·구분 (노션 '구리OPEN 스케쥴' 기준, 새 값은 입력하면 자동으로 추가됨)
export const OPEN_TASK_GROUPS = ['인허가 및 행정절차', '업체 및 물품준비', '인력 및 교육', '오픈 프로모션', '사전점검 및 오픈'];
export const OPEN_TASK_CATEGORIES = ['본부', '현장', '사무실', '정비', '고객대기실', '집기', '홍보', '교육'];
