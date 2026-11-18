# Branch Builder — 정비소 지점 오픈 기록

자동차 정비소 지점을 열 때 **임대차 계약 → 설계 → 인허가 → 착공 → 시공 → 준공 → 장비 설치 → 오픈**까지의
일정·비용·서류·현장 일지를 단계별로 기록하고, 다음 지점을 열 때 참고하기 위한 사이트입니다.

- 배포: Netlify (GitHub `main`에 올리면 자동 반영)
- 데이터: Firebase (Firestore = 기록, Storage = 사진·서류·3D 파일·백업, Auth = 로그인)
- `.env`에 Firebase 설정이 없으면 **데모 모드**로 동작하며 브라우저(localStorage)에만 저장됩니다.

## 실행

```bash
npm install
npm run dev      # 개발 서버
npm run build    # 배포용 빌드 (dist/)
```

> 폴더 경로에 한글이 있으면 이 컴퓨터(Windows)에서 `npm run build`가 멈출 수 있습니다.
> Netlify에는 영향이 없고, 로컬 확인은 `npx vite build --outDir <영문 경로>`로 하면 됩니다.

## 화면 구성 (`src/pages`)

| 주소 | 화면 |
|---|---|
| `/dashboard` | 전체 지점 현황 — 이번 주 할 일, 지점별 지금 단계, 지급 예정 |
| `/` | 지점 목록 |
| `/branch/:id` | 지점 상세 (메뉴 9개, 아래 표) |
| `/branch/:id/report` | 단계별 보고서 (인쇄·PDF), `?stage=단계id`로 한 단계만 |
| `/compare` | 지점 비교 보고서 — 단계별 기간·비용, 다음 지점 메모 모음 |
| `/reports` | **보고서함** — 사이트 점검·지점 보고·회의 기록을 보고서로 모아 보기·쓰기·인쇄 (`?id=`로 바로 열기) |
| `/search?q=` | 통합 검색 |
| `/settings` | 설정 — 관리자·담당자 명단·직원 계정·노션 연결·휴지통·자동 백업 |

지점 상세 메뉴 (`src/constants/branchTabs.js`):

| 메뉴 | 안의 화면 |
|---|---|
| 단계별 기록 | 단계별 체크리스트·서류·잘한 점/아쉬운 점 |
| 할 일 | 오픈 준비 스케줄, 오픈 계획 카드 |
| 일정 | 일정표, 날짜순 모아 보기, 활동이력 |
| 현장 일지 | 날짜별 현장 일지·사진 |
| 부족했던 점 | 다음 지점을 위한 아쉬운 점 기록 |
| 비용·예산 | 비용 목록, 목표 예산 |
| 배치도 | 도면 위 리프트·장비·비품 배치(2D), 층(1·2·3층), 3D 보기 |
| 서류·사진 | 서류·사진 모음 |
| 업체·시설 | 협력업체, 장비·시설 인허가, 하자·A/S |

화면은 필요할 때만 내려받도록 나뉘어 있습니다 (`App.jsx`의 `lazy`). PDF 읽기(pdfjs)와 3D(three.js)도 쓸 때만 불러옵니다.

## 데이터 구조 (Firestore)

```
branches/{지점id}                 지점 정보 (이름, 주소, 상태, property=부지·임대 조건)
  stages/{id}       단계: name, order, status(waiting|progress|complete), checklist[], lessons{good,bad,next}, docsNotNeeded[]
  schedules/{id}    일정: title, startDate, endDate, stageId, status(completed=완료)
  costs/{id}        비용: title, amount, date, stageId, paymentStatus(paid|scheduled=지급 예정)
  documents/{id}    서류·사진: name, fileUrl, stageId, requiredDoc(필수 서류 이름)
  dailyLogs/{id}    현장 일지: date, summary, photos[], entries[], stageId
  openPlans/{id}    오픈 계획 카드: title, status(todo|doing|done), assignee1[], assignee2[], dueDate, body(간단 문서 형식)
  openTasks/{id}    오픈 준비 스케줄: group, category, title, startDate, endDate, done, assignee1[], assignee2[], memo, files[]
  shortfalls/{id}   부족했던 점
  defects/{id}      하자·A/S
  layouts/{id}      배치도 배치안: name, levels[{id, name, ceiling, bg, items[], walls[], dims[]}], vehicleH, wallT
  layoutImages/{id} 배치도 도면 그림 (900KB 아래로 줄여 따로 저장)
  partners, equipments, compliance
  trash/{id}        휴지통 (30일 뒤 정리), logs/{id} 활동이력
  config/budget     목표 예산
branches/_shared                  모든 지점이 같이 쓰는 기록 (지점 문서는 없고 아래 기록만 있음)
  layoutLibrary/{id}  배치도 '내 비품' (직접 만든 비품)
  reports/{id}        보고서함: title, category(site|branch|meeting|etc), date, branchId, author, body, attachments
  trash/{id}          위 두 기록의 휴지통
settings/members                  허용 계정 emails[] · 관리자 admins[] · 직원 staff[]
settings/people                   담당자 명단 names[]
```

- 일정·비용·서류·일지는 `stageId`로 단계에 연결됩니다. 단계 이름이 달라도 `utils/constants.js`의
  `DEFAULT_STAGES[].match` 규칙으로 표준 단계에 묶어 지점끼리 비교합니다.
- 노션으로 보낸 기록에는 `notionPageId`(노션 페이지 번호)가 붙고, 지점 문서에는 `notion`(노션 지점 페이지·표 번호)이 저장됩니다.
- Storage: `branches/{지점}/…`(사진·서류), `branches/_shared/planFiles/…`(배치도 3D 모델·면 사진), `backups/…`(자동 백업)

## 주요 파일

- `utils/constants.js` — 표준 8단계, 단계별 기본 체크리스트·필수 서류
- `data/architectSchedule.js` — 설계사 표준 신축공정 19개 (시작일 기준으로 옮겨 등록: `utils/scheduleTemplates.js`)
- `data/siteReports.js` — 보고서함의 분류와 '사이트 개발 기록' 보고서 (사이트를 고칠 때 여기에 보고서를 더함)
- `components/branch/StageBook.jsx` — 단계별 기록 화면
- `components/floorplan/` — 배치도 (`FloorPlanner.jsx` 편집기, `planLibrary.js` 비품 목록·벽·바닥·계단 종류, `Plan3D.jsx` 3D 보기)
- `components/common/RichDocEditor.jsx`, `MiniDocView.jsx`, `utils/miniDoc.js` — 오픈 계획·보고서 본문 편집·보기 (간단 문서 형식)
- `utils/branchData.js` — 지점 데이터 한 번에 읽기, 지점 복사
- `utils/branchCompare.js` — 지점 비교 계산
- `utils/costs.js` — 지급 완료/예정 합계
- `utils/photoUpload.js`, `utils/fileUpload.js` — 사진·파일 업로드 (고화질 → 실패 시 경량 사진)
- `utils/cloudBackup.js`, `utils/trash.js` — 자동 백업, 휴지통
- `firestore.rules`, `storage.rules` — 보안 규칙 (설정 화면의 허용 계정·관리자 목록을 사용, Firebase 콘솔에 게시해야 적용)

## 배치도 (2D·3D)

- 도면(그림·PDF)을 올리고 두 점으로 축척을 맞춘 뒤 비품을 실제 크기(mm)로 배치. 겹침·작업 공간·층고·뚫린 곳 경고
- 바닥 마감(타일·에폭시·마루·카펫·콘크리트), 벽 종류(일반·가벽·유리벽·통유리 외벽), 색 자유 선택
- 길이 표시는 모두 mm (`planGeometry.js`의 `fmtMm`). 건물 크기·축척 맞추기 입력도 mm
- 지붕 그리기: 네모로 끌어 그림. 평지붕·한쪽 경사·양쪽 경사, 처마 높이·오르는 높이·재료(샌드위치 패널·칼라강판·폴리카보네이트). 캐노피는 비품 목록 '건물·외부'
- 천장·조명: 구역에 천장 높이·목표 밝기, 조명(lm·W)을 놓으면 방별 평균 조도 어림(`zoneLighting`), '조명 범위 보기'
- 전기·배관 선: 전기 배선·에어 배관·급수·배수·가스를 선으로 그림(층마다 `lines`), 길이가 '개수·넓이'에 모임, 3D에서 높이에 맞춰 관으로
- 치수 자동: 건물 전체·기둥 간격·벽 길이 치수선을 한 번에 (자동 치수는 `auto` 표시, 한 번에 지우기)
- 배치안 비교(`LayoutCompare.jsx`): 두 안을 같은 층끼리 나란히 그리고 비품·리프트·넓이·벽·조명·경고 수 차이
- 벽면 꾸미기: 벽의 A면·B면(고른 벽에 글자로 표시)마다 페인트 색, 아래쪽 루바(나무 판, 높이·판 폭·색). '모든 벽에 같게'. 3D에서 문·창 자리는 비우고 둘러짐
- 크기 조절: 고른 비품의 네 모서리(크게 보이면 네 변 가운데도)를 끌면 그쪽만 늘고 반대쪽은 그대로. 모서리 + Shift는 비율 유지
- 자동문: 양개 1800·2400, 편개 1200, 불투명 편개 1000 ('문·창·기둥' 묶음)
- 판넬 벽: 벽 종류 '판넬 벽', 벽마다 '아래 띄운 높이'(보 위 판넬처럼 아래가 뚫림)와 '지붕까지 채우기'(같은 층 지붕 경사를 따라 박공 세모까지)
- 3D에서 고르기·끌어 옮기기·90° 돌리기(지금 층 비품), 2D에서 고른 비품·바닥·벽은 '3D에서 보기'로 바로 확대
- 철골: H빔·각파이프 기둥(규격표 `STEEL_SIZES`, 단면 그대로 2D·3D), '벽·보 그리기'의 H빔 보·각파이프 보(머리 위, 점선). 리프트+차 높이가 보 아래에 닿으면 경고
- 층 나누기(1층·2층·3층 …), 계단 종류(일자·ㄷ자·ㄱ자·나선형·철골)·승강기·차량 경사로, 계단 길이 계산(참고용)
- 3D 보기: 직접 만든 비품은 '3D 모양 빌리기', '사진으로 입체'(앞·뒤·좌·우·위 사진), '3D 모델 파일(.glb)'로 모양을 살림
- 축선(기둥 중심선): 간격을 적으면 X1·X2… / Y1·Y2… 일점쇄선·동그라미 이름·치수 (층마다 `axes`). 벽·구역 그릴 때 축선·교차점에 붙음, '교차점에 기둥 놓기', 고른 비품은 가까운 축선에서 거리(고치면 옮겨짐)
- 꼭짓점 구역(ㄱ·ㄷ자): 구역의 `points`. 꼭짓점 끌기, 변 가운데 마름모 끌어 꼭짓점 더하기, 변 길이 고치기(그 변 끝쪽이 같이 밀림). '방향·길이로 구역 만들기'(우 25200 하 12000 좌 25200). 넓이·타일·조도·3D 바닥 모두 그 모양대로(`zoneArea`)
- 문·창은 벽 가까이 끌면 벽 가운데 줄에 붙고 벽 방향으로 돌아감(Alt는 안 붙음), '가까운 벽에 맞추기' (`snapToWall`)
- 소방·안전 묶음: 소화기(분말·CO₂·K급·자동확산), EV 질식소화포, 화재감지기, 비상구 표시, 구급함, 절연매트, 대피 집결지·배터리 격리구역(구역), '대피 경로' 선(화살표). 소화기는 제조년월·최근 점검일로 🔴 교체 필요(내용연수 지남) / 🟡 주의(1년 안 교체·점검 31일 지남) — '점검' 칸 '소방 점검'
- 배치도 종류(겹쳐 보기): 전체 / 장비 배치도 / 소화기 위치도 / 전기·동력 배치도 / 안전·대피 동선도. 평면(벽·구역·문·계단·기둥)은 늘 보이고 다른 종류는 흐리게, 그림 저장 제목·파일 이름에 종류 이름 (`layerOf`)
- 3D 화면은 Storage 파일을 사이트 주소 `/fbfiles/…`로 읽음 (브라우저의 CORS 제한을 피하는 프록시. `netlify.toml`, `vite.config.js`에 우리 저장소만 통과하도록 설정)

## 보고서함

- **자동 종합 보고서** (`components/reports/LiveReport.jsx`, 계산은 `utils/branchReport.js`): 단계·일정·비용·예산·오픈 준비·오픈 계획·현장 일지·하자·인허가·서류·부족했던 점을
  지금 기록 그대로 모아 '전체 지점 종합'과 '지점별 종합'으로 보여줌 (`/reports?live=all`, `/reports?live=지점id`). PC에서 보고서함을 열면 전체 지점 종합이 먼저 보임
- '지금 내용으로 보고서 남기기': 그 순간의 종합 보고서를 간단 문서 형식 글로 바꿔 보고서함에 날짜와 함께 저장 (회의·주간 보고 기록용)
- 직원이 쓴 보고서는 `branches/_shared/reports`에 저장 (허용 계정 누구나 쓰기·고치기, 지우기는 관리자만 → 휴지통)
- '사이트 개발 기록' 보고서는 `src/data/siteReports.js`에 코드와 함께 저장되어 사이트에서는 읽기만 (복사해서 고쳐 쓰기는 됨)
- 보고서를 열고 '인쇄·PDF 저장'을 누르면 보고서 종이만 인쇄됨

## 노션 연결 (사이트 → 노션 한 방향)

- 연결 프로그램: `netlify/functions/notion-sync.mjs` (Netlify Functions, `/.netlify/functions/notion-sync`)
- Netlify 환경 변수: `NOTION_TOKEN`(노션 연결 토큰, 비밀), `NOTION_PARENT_PAGE`(기록을 받을 노션 페이지 링크), `VITE_FIREBASE_PROJECT_ID`
- 노션 구조: 부모 페이지 └ 지점 페이지 ├ 오픈 계획 ├ 오픈 준비 스케줄 ├ 일정 ├ 비용(계좌번호 제외) ├ 현장 일지 ├ 부족했던 점 └ 하자·A/S
- 사이트에서 저장하면 자동 전송, 지우면 노션에서 휴지통으로. 노션에서 고친 내용은 사이트로 돌아오지 않고, 사이트에서 다시 저장하면 덮어써짐
- 설정 화면: '노션 연결 확인', '기존 기록 노션으로 보내기'

## AI 비서

- 오른쪽 아래 '+ 새 기록' → AI 비서. 말로 적으면 일정·오픈 계획·일지 등을 '추가 제안'으로 만들어 주고, 저장은 사이트에서 확인 후
- 연결 프로그램: `netlify/functions/ai-assistant.mjs` (Claude Haiku/Opus)
- Netlify 환경 변수: `ANTHROPIC_API_KEY`(비밀), `VITE_FIREBASE_PROJECT_ID`
- 로그인한 허용 계정만 사용 가능 (서버에서 Firebase 로그인과 `settings/members` 확인)

## 로그인

- 직원은 아이디로 로그인 → 내부적으로 `아이디@pw-archi.netlify.app` 계정 (`utils/loginId.js`)
- 직원 계정은 설정 화면에서 관리자가 만듦 (`utils/staffAccounts.js`). 실제 메일 주소가 아니라 비밀번호 찾기 메일은 받을 수 없음

## 디자인

- 색·간격·글자 크기는 `src/index.css`의 `--color-*`, `--space-*`, `--font-size-*` 변수를 사용합니다.
- 밝은/어두운 화면은 `[data-theme="light" | "dark"]`로 바뀝니다.
- 골라 보기 버튼·상태 표시는 `filter-pill`(알약 + 같은 색 얇은 테두리 + 연한 바탕) 모양으로 통일되어 있습니다.
- `index.css` 끝의 "차분한 디자인" 구역이 아이콘 글로우 등 장식을 덮어씁니다.
