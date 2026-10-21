// 직원은 이메일 대신 아이디로 로그인 → 내부적으로 '아이디@사이트주소' 이메일 계정으로 바꿔서 사용
// (실제 메일이 오가는 주소가 아니라서 '비밀번호 찾기' 메일은 받을 수 없음)
export const STAFF_EMAIL_DOMAIN = 'pw-archi.netlify.app';

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,29}$/;

/** 로그인 칸에 입력한 값 → Firebase 로그인 이메일 (@가 있으면 이메일 그대로) */
export function toLoginEmail(input) {
  const v = (input || '').trim().toLowerCase();
  if (!v) return '';
  return v.includes('@') ? v : `${v}@${STAFF_EMAIL_DOMAIN}`;
}

/** 이메일 → 화면에 보여줄 아이디 (직원 계정이면 아이디만) */
export function displayLoginId(email) {
  const e = (email || '').toLowerCase();
  return e.endsWith(`@${STAFF_EMAIL_DOMAIN}`) ? e.slice(0, -(STAFF_EMAIL_DOMAIN.length + 1)) : e;
}

/** 새 직원 아이디 검사: 영문 소문자·숫자·.-_ 2~30자 */
export function validateLoginId(id) {
  const v = (id || '').trim().toLowerCase();
  if (!ID_PATTERN.test(v)) return '아이디는 영문 소문자·숫자로 2~30자로 정해 주세요 (예: hong, kim01)';
  return '';
}
