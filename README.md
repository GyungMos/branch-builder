# Branch Builder — 정비소 지점 오픈 기록

자동차 정비소 지점을 열 때 **임대차 계약 → 설계 → 인허가 → 착공 → 시공 → 준공 → 장비 설치 → 오픈**까지의
일정·비용·서류·현장 일지를 단계별로 기록하고, 다음 지점을 열 때 참고하기 위한 사이트입니다.

- 배포: Netlify (GitHub `main`에 올리면 자동 반영)
- 데이터: Firebase (Firestore = 기록, Storage = 사진·서류 파일, Auth = 로그인)
- `.env`에 Firebase 설정이 없으면 **데모 모드**로 동작하며 브라우저(localStorage)에만 저장됩니다.

## 실행

```bash
npm install
npm run dev      # 개발 서버
npm run build    # 배포용 빌드 (dist/)
```

## 화면 구성 (`src/pages`)

| 주소 | 화면 |
|---|---|
| `/dashboard` | 전체 지점 현황 — 이번 주 할 일, 지점별 지금 단계, 지급 예정 |
| `/` | 지점 목록 |
| `/branch/:id` | 지점 상세 — 탭: 단계별 기록·오픈 계획·오픈 준비·일정/현장 일지·비용 + 더보기(서류/사진·날짜순·장비·협력업체·활동이력) |
| `/branch/:id/report` | 단계별 보고서 (인쇄·PDF), `?stage=단계id`로 한 단계만 |
| `/compare` | 지점 비교 보고서 — 단계별 기간·비용, 다음 지점 메모 모음 |
| `/search?q=` | 통합 검색 |
| `/settings` | 설정 — 관리자·담당자 명단·직원 계정(아이디 로그인)·노션 연결 |

화면은 필요할 때만 내려받도록 나뉘어 있습니다 (`App.jsx`의 `lazy`).

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
  partners, equipments, compliance, logs(활동이력)
  config/budget     목표 예산
settings/members                  허용 계정 emails[] · 관리자 admins[] · 직원 staff[]
settings/people                   담당자 명단 names[]
```

노션으로 보낸 기록에는 `notionPageId`(노션 페이지 번호)가 붙고, 지점 문서에는 `notion`(노션 지점 페이지·표 번호)이 저장됩니다.

일정·비용·서류·일지는 `stageId`로 단계에 연결됩니다. 단계 이름이 달라도 `utils/constants.js`의
`DEFAULT_STAGES[].match` 규칙으로 표준 단계에 묶어 지점끼리 비교합니다.

## 주요 파일

- `utils/constants.js` — 표준 8단계, 단계별 기본 체크리스트·필수 서류
- `data/architectSchedule.js` — 설계사 표준 신축공정 19개 (시작일 기준으로 옮겨 등록: `utils/scheduleTemplates.js`)
- `components/branch/StageBook.jsx` — 단계별 기록 화면
- `utils/branchData.js` — 지점 데이터 한 번에 읽기, 지점 복사
- `utils/branchCompare.js` — 지점 비교 계산
- `utils/costs.js` — 지급 완료/예정 합계
- `utils/photoUpload.js` — 현장 사진 업로드 (고화질 → 실패 시 경량 사진)
- `firestore.rules`, `storage.rules` — 보안 규칙 (설정 화면의 허용 계정·관리자 목록을 사용, Firebase 콘솔에 게시해야 적용)

## 노션 연결 (사이트 → 노션 한 방향)

- 연결 프로그램: `netlify/functions/notion-sync.mjs` (Netlify Functions, `/.netlify/functions/notion-sync`)
- Netlify 환경 변수: `NOTION_TOKEN`(노션 연결 토큰, 비밀), `NOTION_PARENT_PAGE`(기록을 받을 노션 페이지 링크), `VITE_FIREBASE_PROJECT_ID`
- 노션 구조: 부모 페이지 └ 지점 페이지 ├ 오픈 계획 ├ 오픈 준비 스케줄 ├ 일정 ├ 비용(계좌번호 제외) └ 현장 일지
- 사이트에서 저장하면 자동 전송, 지우면 노션에서 휴지통으로. 노션에서 고친 내용은 사이트로 돌아오지 않고, 사이트에서 다시 저장하면 덮어써짐
- 설정 화면: '노션 연결 확인', '기존 기록 노션으로 보내기'

## 로그인

- 직원은 아이디로 로그인 → 내부적으로 `아이디@pw-archi.netlify.app` 계정 (`utils/loginId.js`)
- 직원 계정은 설정 화면에서 관리자가 만듦 (`utils/staffAccounts.js`). 실제 메일 주소가 아니라 비밀번호 찾기 메일은 받을 수 없음

## 디자인

- 색·간격·글자 크기는 `src/index.css`의 `--color-*`, `--space-*`, `--font-size-*` 변수를 사용합니다.
- 밝은/어두운 화면은 `[data-theme="light" | "dark"]`로 바뀝니다.
- `index.css` 끝의 "차분한 디자인" 구역이 아이콘 글로우 등 장식을 덮어씁니다.
