/**
 * 배치도 비품 목록
 * - 크기 단위는 모두 mm (w: 가로, d: 세로(깊이), h: 높이)
 * - 크기는 흔히 쓰는 값. 실제로 사는 모델은 납품업체 사양서를 보고 고쳐 쓰면 됨
 * - clear: 비품 둘레에 비워 둬야 하는 작업 공간 { f: 앞(아래쪽), b: 뒤(위쪽), l: 왼쪽, r: 오른쪽 }
 * - kind: equip(일반 비품·장비, 겹침 검사함) / arch(문·창·셔터: 벽 안에 놓여 벽 겹침은 검사 안 함)
 *         column(기둥) / zone(구역) / text(글자) / floor(트렌치·배수구처럼 바닥에 묻힌 것: 겹침 검사 안 함)
 * - elev: 바닥에서 띄운 높이(mm, 창·벽걸이용). 나중에 3D로 볼 때 씀
 * - lift: 리프트 최대 들어올림 높이(mm) → 층고 확인에 씀
 */

export const PLAN_CATEGORIES = [
  { id: 'repair', label: '정비 장비' },
  { id: 'wc', label: '화장실·위생' },
  { id: 'office', label: '사무·고객 공간' },
  { id: 'storage', label: '수납' },
  { id: 'arch', label: '문·창·기둥' },
  { id: 'vertical', label: '계단·승강기' },
  { id: 'steel', label: 'H빔·각파이프' },
  { id: 'finish', label: '바닥·유리' },
  { id: 'etc', label: '기타' },
];

export const PLAN_LIBRARY = [
  // 정비 장비
  { key: 'lift2', cat: 'repair', name: '2주식 리프트', shape: 'lift2', w: 3400, d: 1100, h: 3800, lift: 1900, clear: { f: 2400, b: 2400, l: 500, r: 500 }, color: '#3b82f6', tip: '기둥 두 개짜리. 앞뒤 작업 공간은 차가 들어갈 자리예요.' },
  { key: 'lift4', cat: 'repair', name: '4주식 리프트', shape: 'lift4', w: 3300, d: 5800, h: 2400, lift: 1800, clear: { f: 1500, b: 800, l: 800, r: 800 }, color: '#3b82f6' },
  { key: 'scissor', cat: 'repair', name: '가위식(시저) 리프트', shape: 'scissor', w: 2100, d: 4800, h: 300, lift: 1850, clear: { f: 1200, b: 800, l: 800, r: 800 }, color: '#3b82f6' },
  { key: 'align', cat: 'repair', name: '휠얼라인먼트 리프트', shape: 'lift4', w: 3500, d: 6500, h: 2400, lift: 1800, clear: { f: 2500, b: 800, l: 900, r: 900 }, color: '#6366f1', tip: '앞쪽 작업 공간에 카메라 기둥이 들어가요.' },
  { key: 'tirechanger', cat: 'repair', name: '타이어 탈착기', shape: 'tirechanger', w: 1000, d: 900, h: 1900, clear: { f: 900, b: 300, l: 600, r: 600 }, color: '#0ea5e9' },
  { key: 'balancer', cat: 'repair', name: '휠 밸런서', shape: 'balancer', w: 1300, d: 1000, h: 1600, clear: { f: 900, b: 300, l: 500, r: 500 }, color: '#0ea5e9' },
  { key: 'compressor', cat: 'repair', name: '에어 컴프레서', shape: 'compressor', w: 1300, d: 700, h: 1500, clear: { f: 800, b: 500, l: 500, r: 500 }, color: '#64748b', tip: '소음·열 때문에 벽과 떨어뜨려 두는 게 좋아요.' },
  { key: 'bench', cat: 'repair', name: '작업대', shape: 'bench', w: 1800, d: 750, h: 900, clear: { f: 900 }, color: '#78716c' },
  { key: 'toolcart', cat: 'repair', name: '공구 카트', shape: 'cart', w: 750, d: 450, h: 900, clear: {}, color: '#ef4444' },
  { key: 'oildrain', cat: 'repair', name: '폐유 수거기', shape: 'circle', w: 600, d: 600, h: 1700, clear: {}, color: '#a16207' },
  { key: 'jack', cat: 'repair', name: '미션 잭 / 플로어 잭', shape: 'cart', w: 600, d: 1400, h: 400, clear: {}, color: '#ef4444' },
  { key: 'car', cat: 'repair', name: '차량(승용)', shape: 'car', w: 1850, d: 4800, h: 1450, clear: { l: 700, r: 700 }, color: '#94a3b8', kind: 'car', tip: '문을 열 자리(양옆 0.7m)까지 작업 공간으로 잡았어요.' },
  { key: 'suv', cat: 'repair', name: '차량(SUV)', shape: 'car', w: 1950, d: 5000, h: 1800, clear: { l: 700, r: 700 }, color: '#94a3b8', kind: 'car' },

  // 화장실·위생
  { key: 'toilet', cat: 'wc', name: '대변기(양변기)', shape: 'toilet', w: 400, d: 700, h: 800, clear: { f: 600, l: 150, r: 150 }, color: '#e2e8f0', tip: '뒤쪽(위)을 벽에 붙여 놓아요.' },
  { key: 'stall', cat: 'wc', name: '대변기 칸(문 포함)', shape: 'stall', w: 1000, d: 1500, h: 2100, clear: { f: 900 }, color: '#e2e8f0', tip: '칸막이·문까지 들어간 크기예요.' },
  { key: 'stallA', cat: 'wc', name: '장애인 화장실', shape: 'stallA', w: 1600, d: 2000, h: 2100, clear: { f: 1400 }, color: '#e2e8f0', tip: '안쪽 1.6m × 2.0m 이상(장애인 편의시설 기준). 문 앞 1.4m 비워 두기.' },
  { key: 'urinal', cat: 'wc', name: '소변기', shape: 'urinal', w: 400, d: 350, h: 650, clear: { f: 600, l: 175, r: 175 }, color: '#e2e8f0', tip: '옆 작업 공간까지 붙여 놓으면 가운데끼리 75cm 간격이 돼요.' },
  { key: 'sink', cat: 'wc', name: '세면대', shape: 'sink', w: 550, d: 450, h: 850, clear: { f: 600, l: 100, r: 100 }, color: '#e2e8f0' },
  { key: 'sinkcounter', cat: 'wc', name: '세면대(카운터 2구)', shape: 'sink2', w: 1400, d: 550, h: 850, clear: { f: 700 }, color: '#e2e8f0' },
  { key: 'mopsink', cat: 'wc', name: '청소용 싱크', shape: 'sink', w: 500, d: 450, h: 600, clear: { f: 600 }, color: '#cbd5e1' },
  { key: 'shower', cat: 'wc', name: '샤워 부스', shape: 'shower', w: 900, d: 900, h: 2000, clear: { f: 600 }, color: '#e2e8f0' },
  { key: 'dryer', cat: 'wc', name: '핸드 드라이어', shape: 'box', w: 300, d: 200, h: 300, elev: 1000, clear: { f: 500 }, color: '#cbd5e1' },

  // 사무·고객
  { key: 'desk', cat: 'office', name: '책상(1400)', shape: 'desk', w: 1400, d: 700, h: 720, clear: { f: 900 }, color: '#d6b98c' },
  { key: 'desk12', cat: 'office', name: '책상(1200)', shape: 'desk', w: 1200, d: 600, h: 720, clear: { f: 900 }, color: '#d6b98c' },
  { key: 'chair', cat: 'office', name: '의자', shape: 'chair', w: 550, d: 550, h: 900, clear: {}, color: '#475569' },
  { key: 'roundtable', cat: 'office', name: '원형 상담 테이블', shape: 'roundtable', w: 900, d: 900, h: 720, clear: { f: 600, b: 600, l: 600, r: 600 }, color: '#d6b98c' },
  { key: 'table4', cat: 'office', name: '4인 테이블', shape: 'table4', w: 1200, d: 800, h: 720, clear: { f: 600, b: 600 }, color: '#d6b98c' },
  { key: 'meeting', cat: 'office', name: '회의 테이블(6~8인)', shape: 'table4', w: 2400, d: 1000, h: 720, clear: { f: 700, b: 700, l: 600, r: 600 }, color: '#d6b98c' },
  { key: 'sofa3', cat: 'office', name: '소파(3인)', shape: 'sofa', w: 2000, d: 850, h: 800, clear: { f: 500 }, color: '#8b5cf6' },
  { key: 'sofa1', cat: 'office', name: '소파(1인)', shape: 'sofa', w: 900, d: 850, h: 800, clear: { f: 500 }, color: '#8b5cf6' },
  { key: 'counter', cat: 'office', name: '접수 카운터', shape: 'counter', w: 2000, d: 700, h: 1050, clear: { f: 1200, b: 900 }, color: '#d6b98c', tip: '앞(손님 쪽) 1.2m, 뒤(직원 쪽) 0.9m 비워 두기.' },
  { key: 'water', cat: 'office', name: '정수기', shape: 'box', w: 350, d: 450, h: 1300, clear: { f: 500 }, color: '#7dd3fc' },
  { key: 'coffee', cat: 'office', name: '커피 머신 대', shape: 'box', w: 800, d: 500, h: 900, clear: { f: 600 }, color: '#a16207' },
  { key: 'fridge', cat: 'office', name: '냉장고', shape: 'box', w: 700, d: 700, h: 1800, clear: { f: 700 }, color: '#cbd5e1' },
  { key: 'tv', cat: 'office', name: 'TV(벽걸이 65인치)', shape: 'tv', w: 1450, d: 100, h: 830, elev: 1200, clear: { f: 2500 }, color: '#1e293b' },

  // 수납
  { key: 'cabinet', cat: 'storage', name: '캐비닛', shape: 'cabinet', w: 900, d: 450, h: 1800, clear: { f: 700 }, color: '#94a3b8' },
  { key: 'lowcabinet', cat: 'storage', name: '낮은 수납장', shape: 'cabinet', w: 1200, d: 450, h: 800, clear: { f: 600 }, color: '#94a3b8' },
  { key: 'toolbox', cat: 'storage', name: '공구함(롤 캐비닛)', shape: 'cabinet', w: 700, d: 470, h: 1000, clear: { f: 700 }, color: '#ef4444' },
  { key: 'shelf', cat: 'storage', name: '부품 선반', shape: 'shelf', w: 1800, d: 600, h: 2100, clear: { f: 900 }, color: '#78716c' },
  { key: 'tirerack', cat: 'storage', name: '타이어 랙', shape: 'shelf', w: 2000, d: 600, h: 2000, clear: { f: 900 }, color: '#475569' },
  { key: 'locker', cat: 'storage', name: '사물함(6칸)', shape: 'locker', w: 900, d: 500, h: 1800, clear: { f: 700 }, color: '#94a3b8' },

  // 문·창·기둥
  { key: 'door', cat: 'arch', name: '여닫이문(900)', shape: 'door', w: 900, d: 150, h: 2100, clear: { f: 900 }, color: '#f59e0b', kind: 'arch', tip: '벽 위에 놓고, 문이 열리는 쪽(작업 공간)이 아래로 가요. 돌리기로 방향을 바꿔요.' },
  { key: 'door2', cat: 'arch', name: '양개문(1800)', shape: 'door2', w: 1800, d: 150, h: 2100, clear: { f: 900 }, color: '#f59e0b', kind: 'arch' },
  { key: 'sliding', cat: 'arch', name: '미닫이문(900)', shape: 'sliding', w: 900, d: 150, h: 2100, clear: { f: 400 }, color: '#f59e0b', kind: 'arch' },
  { key: 'shutter', cat: 'arch', name: '정비동 셔터(3.5m)', shape: 'shutter', w: 3500, d: 250, h: 4000, clear: { f: 2000, b: 2000 }, color: '#f59e0b', kind: 'arch', tip: 'h(높이)는 셔터가 열린 높이예요. 차가 드나드는 길을 앞뒤로 잡았어요.' },
  { key: 'shutter4', cat: 'arch', name: '정비동 셔터(4.5m)', shape: 'shutter', w: 4500, d: 250, h: 4000, clear: { f: 2000, b: 2000 }, color: '#f59e0b', kind: 'arch' },
  { key: 'window', cat: 'arch', name: '창문(1200)', shape: 'window', w: 1200, d: 150, h: 1200, elev: 900, clear: {}, color: '#38bdf8', kind: 'arch' },
  { key: 'window24', cat: 'arch', name: '큰 창(2400)', shape: 'window', w: 2400, d: 150, h: 1500, elev: 600, clear: {}, color: '#38bdf8', kind: 'arch' },
  { key: 'column4', cat: 'arch', name: '기둥(400각)', shape: 'column', w: 400, d: 400, h: 0, clear: {}, color: '#475569', kind: 'column' },
  { key: 'column6', cat: 'arch', name: '기둥(600각)', shape: 'column', w: 600, d: 600, h: 0, clear: {}, color: '#475569', kind: 'column' },

  // H빔·각파이프 (기둥. 높이 0 = 그 층 층고까지. 보는 '벽 그리기'에서 'H빔 보·각파이프 보'를 골라 기둥 사이를 이어요)
  { key: 'hcol200', cat: 'steel', name: 'H빔 기둥 H-200×200', shape: 'hbeam', w: 200, d: 200, prof: { tw: 8, tf: 12 }, h: 0, clear: {}, color: '#475569', kind: 'column', tip: '오른쪽 칸 ‘규격’에서 H-150·250·300 등으로 바꿀 수 있어요. R 키로 돌리면 방향이 바뀌어요.' },
  { key: 'hcol250', cat: 'steel', name: 'H빔 기둥 H-250×250', shape: 'hbeam', w: 250, d: 250, prof: { tw: 9, tf: 14 }, h: 0, clear: {}, color: '#475569', kind: 'column' },
  { key: 'hcol300', cat: 'steel', name: 'H빔 기둥 H-300×300', shape: 'hbeam', w: 300, d: 300, prof: { tw: 10, tf: 15 }, h: 0, clear: {}, color: '#475569', kind: 'column' },
  { key: 'sqcol100', cat: 'steel', name: '각파이프 기둥 □100×100', shape: 'sqpipe', w: 100, d: 100, prof: { t: 3.2 }, h: 0, clear: {}, color: '#64748b', kind: 'column', tip: '캐노피·가벽 틀·작은 지붕 기둥에 많이 써요. 규격은 오른쪽 칸에서 바꿔요.' },
  { key: 'sqcol150', cat: 'steel', name: '각파이프 기둥 □150×150', shape: 'sqpipe', w: 150, d: 150, prof: { t: 6 }, h: 0, clear: {}, color: '#64748b', kind: 'column' },
  { key: 'sqcol75', cat: 'steel', name: '각파이프 기둥 □75×75', shape: 'sqpipe', w: 75, d: 75, prof: { t: 3.2 }, h: 0, clear: {}, color: '#64748b', kind: 'column' },

  // 계단·승강기 (층을 잇는 것. 높이 0 = 그 층 층고만큼)
  { key: 'stairs', cat: 'vertical', name: '일자 계단', shape: 'stairs', w: 1200, d: 4500, h: 0, clear: { f: 1200 }, color: '#94a3b8', tip: '화살표 쪽으로 올라가요. 오른쪽 칸에서 층고에 맞는 길이인지 계산해 줘요.' },
  { key: 'stairsU', cat: 'vertical', name: 'ㄷ자 계단(되돌림)', shape: 'stairsU', w: 2500, d: 4500, arm: 1200, h: 0, clear: { f: 1200 }, color: '#94a3b8', tip: '건물 안 계단실에 가장 많이 써요. 오른쪽으로 올라가 계단참에서 돌아 왼쪽으로 올라가요.' },
  { key: 'stairsL', cat: 'vertical', name: 'ㄱ자 계단', shape: 'stairsL', w: 4200, d: 4200, arm: 1200, h: 0, clear: { f: 1200 }, color: '#94a3b8', tip: '벽 모서리를 따라 꺾이는 계단이에요. 좌우 뒤집기로 꺾이는 방향을 바꿔요.' },
  { key: 'stairsSpiral', cat: 'vertical', name: '나선형 계단', shape: 'stairsSpiral', w: 2000, d: 2000, h: 0, clear: { f: 900 }, color: '#94a3b8', tip: '자리를 적게 차지하지만 물건을 들고 다니기 어려워요. 사무실·창고용 보조 계단으로 써요.' },
  { key: 'stairsSteel', cat: 'vertical', name: '외부 철골 계단', shape: 'stairs', w: 1000, d: 4500, h: 0, clear: { f: 1000 }, color: '#64748b', tip: '건물 바깥 벽에 붙이는 철골 계단이에요.' },
  { key: 'elevator', cat: 'vertical', name: '승강기(사람용)', shape: 'elevator', w: 2100, d: 2300, h: 0, clear: { f: 1500 }, color: '#6366f1', tip: '승강로(벽 안쪽) 크기예요. 문 앞 1.5m 비워 두기.' },
  { key: 'carElevator', cat: 'vertical', name: '차량용 승강기', shape: 'elevator', w: 3200, d: 6200, h: 0, clear: { f: 6000 }, color: '#6366f1', tip: '2·3층에 정비동을 둘 때 써요. 앞에 차가 돌아 나올 자리를 넉넉히 잡았어요.' },
  { key: 'ramp', cat: 'vertical', name: '차량 경사로', shape: 'ramp', w: 3500, d: 24000, h: 0, clear: {}, color: '#64748b', tip: '화살표 쪽으로 올라가요. 직선 경사로는 기울기 17% 이하(주차장법)라 층고 4m면 길이 약 24m가 필요해요.' },
  { key: 'void', cat: 'vertical', name: '뚫린 곳(계단 구멍)', shape: 'void', kind: 'void', w: 1200, d: 4500, h: 0, clear: {}, color: '#94a3b8', tip: '위층에서 아래층 계단 자리를 표시해요. 이 위에 비품을 놓으면 경고해요.' },

  // 바닥·유리
  { key: 'f_tile', cat: 'finish', name: '바닥 타일 구역', shape: 'zone', kind: 'zone', w: 4000, d: 3000, color: '#64748b', floor: { type: 'tile', color: '#d9d4c7', tw: 600, td: 600 }, tip: '놓은 뒤 크기를 바꾸고, 오른쪽 칸에서 타일 크기·색을 골라요. 필요한 타일 장수도 나와요.' },
  { key: 'f_epoxy', cat: 'finish', name: '에폭시 바닥 구역', shape: 'zone', kind: 'zone', w: 8000, d: 6000, color: '#64748b', floor: { type: 'epoxy', color: '#6f9a7a' }, tip: '정비동 바닥에 많이 써요.' },
  { key: 'f_deco', cat: 'finish', name: '데코타일 구역', shape: 'zone', kind: 'zone', w: 4000, d: 3000, color: '#64748b', floor: { type: 'tile', color: '#c9b79c', tw: 450, td: 450 } },
  { key: 'f_wood', cat: 'finish', name: '마루 바닥 구역', shape: 'zone', kind: 'zone', w: 4000, d: 3000, color: '#64748b', floor: { type: 'wood', color: '#c8a273' } },
  { key: 'f_carpet', cat: 'finish', name: '카펫 타일 구역', shape: 'zone', kind: 'zone', w: 4000, d: 3000, color: '#64748b', floor: { type: 'carpet', color: '#6b7280', tw: 500, td: 500 } },
  { key: 'trench', cat: 'finish', name: '트렌치(배수로)', shape: 'trench', w: 3000, d: 300, h: 0, clear: {}, color: '#64748b', kind: 'floor', tip: '바닥에 묻힌 배수로예요. 차·리프트와 겹쳐도 경고하지 않아요.' },
  { key: 'drain', cat: 'finish', name: '바닥 배수구', shape: 'drain', w: 300, d: 300, h: 0, clear: {}, color: '#64748b', kind: 'floor' },
  { key: 'glasspanel', cat: 'finish', name: '유리 칸막이(1m)', shape: 'glasspanel', w: 1000, d: 60, h: 2400, clear: {}, color: '#38bdf8', kind: 'arch', tip: '길게 늘여 쓰세요. 벽 그리기에서 ‘유리벽’을 골라 그려도 돼요.' },
  { key: 'glassdoor', cat: 'finish', name: '강화유리 여닫이문(900)', shape: 'glassdoor', w: 900, d: 100, h: 2100, clear: { f: 900 }, color: '#0ea5e9', kind: 'arch' },
  { key: 'autodoor', cat: 'finish', name: '유리 자동문(양개 1800)', shape: 'autodoor', w: 1800, d: 150, h: 2100, clear: { f: 1200, b: 1200 }, color: '#0ea5e9', kind: 'arch', tip: '고객 출입구. 앞뒤 1.2m 비워 두기.' },
  { key: 'glasswin', cat: 'finish', name: '통유리창(3000)', shape: 'window', w: 3000, d: 150, h: 2400, elev: 100, clear: {}, color: '#38bdf8', kind: 'arch' },

  // 기타
  { key: 'extinguisher', cat: 'etc', name: '소화기', shape: 'circle', w: 300, d: 300, h: 600, clear: { f: 500 }, color: '#ef4444' },
  { key: 'pillar_sign', cat: 'etc', name: '분리수거함', shape: 'box', w: 1200, d: 500, h: 1000, clear: { f: 600 }, color: '#22c55e' },
  { key: 'text', cat: 'etc', name: '글자 메모', shape: 'text', w: 2000, d: 500, h: 0, clear: {}, color: '#e2e8f0', kind: 'text' },
];

export const libraryByKey = (key) => PLAN_LIBRARY.find(x => x.key === key);

/** 층을 잇는 것 (계단·승강기·경사로): 위층 바닥에 구멍이 생김 */
export const STAIR_SHAPES = ['stairs', 'stairsU', 'stairsL', 'stairsSpiral'];
export const isVertical = (it) => STAIR_SHAPES.includes(it.shape) || it.shape === 'elevator' || it.shape === 'ramp';

/** 층 높이를 안 적었을 때 쓰는 값 */
export const defaultLevelHeight = (index) => (index === 0 ? 4500 : 3500);

/** 직접 만들기에서 고를 기본 모양 */
export const BASIC_SHAPES = [
  { shape: 'box', label: '네모' },
  { shape: 'roundbox', label: '둥근 네모' },
  { shape: 'circle', label: '원' },
  { shape: 'lshape', label: 'ㄱ자(L자)' },
];

/** 장비 대장 이름으로 비품 모양 짐작 */
export function guessLibraryFromName(name = '') {
  const n = name.replace(/\s/g, '');
  if (/얼라인/.test(n)) return libraryByKey('align');
  if (/4주|사주|4포스트/.test(n)) return libraryByKey('lift4');
  if (/2주|이주|2포스트/.test(n)) return libraryByKey('lift2');
  if (/시저|가위/.test(n)) return libraryByKey('scissor');
  if (/리프트/.test(n)) return libraryByKey('lift2');
  if (/탈착/.test(n)) return libraryByKey('tirechanger');
  if (/밸런/.test(n)) return libraryByKey('balancer');
  if (/컴프|콤프/.test(n)) return libraryByKey('compressor');
  if (/작업대|벤치/.test(n)) return libraryByKey('bench');
  if (/공구함|롤캐비/.test(n)) return libraryByKey('toolbox');
  if (/카트/.test(n)) return libraryByKey('toolcart');
  if (/선반|랙/.test(n)) return libraryByKey('shelf');
  if (/폐유|오일/.test(n)) return libraryByKey('oildrain');
  if (/잭/.test(n)) return libraryByKey('jack');
  return null;
}

/** 구역(방) 색 */
export const ZONE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#64748b'];

export const ITEM_COLORS = ['#3b82f6', '#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#d6b98c', '#a47148', '#94a3b8', '#475569', '#1f2937', '#e2e8f0', '#ffffff'];

/**
 * 바닥 마감 (구역에 입힘)
 * - tile·carpet: tw×td 크기 줄눈 무늬, 필요한 장수 계산
 * - colors: 많이 쓰는 색 (직접 고르기도 됨)
 */
export const FLOOR_TYPES = [
  { type: 'tile', label: '타일', sizes: [[300, 300], [450, 450], [600, 600], [600, 1200], [800, 800]], colors: ['#f1f0ec', '#d9d4c7', '#c9b79c', '#a8a29e', '#6b6b6b', '#2f3136'] },
  { type: 'epoxy', label: '에폭시', colors: ['#6f9a7a', '#4f7d63', '#9ca3af', '#6b7280', '#5b8db8', '#c2b280'] },
  { type: 'wood', label: '마루', colors: ['#e3caa5', '#c8a273', '#a47148', '#6b4f3a'] },
  { type: 'carpet', label: '카펫 타일', sizes: [[500, 500]], colors: ['#6b7280', '#3f4a5a', '#8b7d6b', '#4b5563'] },
  { type: 'concrete', label: '콘크리트', colors: ['#b8b8b2', '#9a9a94', '#7d7d78'] },
];
export const floorTypeOf = (type) => FLOOR_TYPES.find(f => f.type === type);

/** 벽 종류 */
export const WALL_TYPES = [
  { type: 'concrete', label: '일반 벽(콘크리트·블록)', short: '일반 벽', t: 200, color: null },
  { type: 'light', label: '가벽(경량 칸막이)', short: '가벽', t: 100, color: '#a8a29e' },
  { type: 'glass', label: '유리벽(유리 칸막이)', short: '유리벽', t: 100, color: '#38bdf8' },
  { type: 'curtain', label: '통유리 외벽(커튼월)', short: '통유리 외벽', t: 150, color: '#0ea5e9' },
  // 보: 바닥이 아니라 머리 위(천장 쪽)에 걸리는 가로대. t = 단면 폭, depth = 단면 높이, h = 보 윗면 높이(비우면 층고)
  { type: 'beamH', label: 'H빔 보 (머리 위)', short: 'H빔 보', t: 200, depth: 200, color: '#475569', beam: 'hbeam' },
  { type: 'beamSq', label: '각파이프 보 (머리 위)', short: '각파이프 보', t: 100, depth: 100, color: '#64748b', beam: 'sqpipe' },
];
export const wallTypeOf = (type) => WALL_TYPES.find(w => w.type === type) || WALL_TYPES[0];
/** 보(머리 위 가로대)인지: 바닥 비품과 겹쳐도 경고하지 않고, 높이만 봄 */
export const isBeam = (w) => Boolean(wallTypeOf(w?.type).beam);

/**
 * 철골 규격 (KS 많이 쓰는 것, mm)
 * - H빔: H-높이×폭×웨브 두께(tw)×플랜지 두께(tf)
 * - 각파이프: □가로×세로×두께(t)
 */
export const STEEL_SIZES = {
  hbeam: [
    { id: 'H100', label: 'H-100×100', w: 100, d: 100, tw: 6, tf: 8 },
    { id: 'H125', label: 'H-125×125', w: 125, d: 125, tw: 6.5, tf: 9 },
    { id: 'H150', label: 'H-150×150', w: 150, d: 150, tw: 7, tf: 10 },
    { id: 'H200', label: 'H-200×200', w: 200, d: 200, tw: 8, tf: 12 },
    { id: 'H250', label: 'H-250×250', w: 250, d: 250, tw: 9, tf: 14 },
    { id: 'H300', label: 'H-300×300', w: 300, d: 300, tw: 10, tf: 15 },
    { id: 'H350', label: 'H-350×350', w: 350, d: 350, tw: 12, tf: 19 },
    { id: 'H400', label: 'H-400×400', w: 400, d: 400, tw: 13, tf: 21 },
    { id: 'H300x150', label: 'H-300×150 (보용)', w: 150, d: 300, tw: 6.5, tf: 9 },
    { id: 'H400x200', label: 'H-400×200 (보용)', w: 200, d: 400, tw: 8, tf: 13 },
  ],
  sqpipe: [
    { id: 'S50', label: '□50×50×2.3', w: 50, d: 50, t: 2.3 },
    { id: 'S75', label: '□75×75×3.2', w: 75, d: 75, t: 3.2 },
    { id: 'S100', label: '□100×100×3.2', w: 100, d: 100, t: 3.2 },
    { id: 'S125', label: '□125×125×4.5', w: 125, d: 125, t: 4.5 },
    { id: 'S150', label: '□150×150×6.0', w: 150, d: 150, t: 6 },
    { id: 'S200', label: '□200×200×8.0', w: 200, d: 200, t: 8 },
    { id: 'R50x100', label: '□50×100×2.3 (직사각)', w: 50, d: 100, t: 2.3 },
    { id: 'R100x200', label: '□100×200×4.5 (직사각)', w: 100, d: 200, t: 4.5 },
  ],
};

/** 단면 두께 찾기 (규격표에 없으면 크기로 짐작) */
export function steelProfile(kind, w, d, prof) {
  if (prof && (prof.tw || prof.t)) return prof;
  const hit = (STEEL_SIZES[kind] || []).find(s => s.w === w && s.d === d);
  if (hit) return kind === 'hbeam' ? { tw: hit.tw, tf: hit.tf } : { t: hit.t };
  const m = Math.min(w, d);
  return kind === 'hbeam' ? { tw: Math.max(5, Math.round(m * 0.045)), tf: Math.max(7, Math.round(m * 0.065)) } : { t: Math.max(2, Math.round(m * 0.04 * 10) / 10) };
}
export const WALL_COLORS = ['#334155', '#64748b', '#a8a29e', '#d6d3d1', '#f5f5f4', '#b45309', '#38bdf8', '#0ea5e9'];

/** 사진 상자: 면마다 사진 (3D에서 상자 겉에 붙임) */
export const FACE_KEYS = [
  { key: 'front', label: '앞' },
  { key: 'back', label: '뒤' },
  { key: 'left', label: '왼쪽' },
  { key: 'right', label: '오른쪽' },
  { key: 'top', label: '위' },
];
export const hasFaces = (it) => Boolean(it?.faces && FACE_KEYS.some(f => it.faces[f.key]));

/** 3D 모양 빌리기에서 고를 수 있는 것 */
export const LOOK_OPTIONS = PLAN_LIBRARY.filter(x => !['zone', 'text', 'void'].includes(x.kind) && !['trench', 'drain'].includes(x.shape));
