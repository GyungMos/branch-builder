/**
 * 오픈 계획 본문용 간단 문서 형식 (사이트 화면과 노션 변환이 같은 규칙을 씀)
 *   # 큰 제목 / ## 제목 / ### 작은 제목
 *   - 점 목록 (• 또는 * 도 가능)
 *   1. 번호 목록
 *   [ ] 할 일 / [x] 끝낸 일
 *   줄 앞에 띄어쓰기 2칸 이상 → 바로 위 목록의 하위 항목
 *   http로 시작하는 주소는 자동으로 링크
 */
export function parseMiniDoc(text = '') {
  const blocks = [];
  let lastTop = null;

  String(text).replace(/\r\n/g, '\n').split('\n').forEach(raw => {
    const expanded = raw.replace(/\t/g, '  ');
    const indent = expanded.length - expanded.trimStart().length;
    const line = expanded.trim();
    if (!line) {
      lastTop = null;
      return;
    }

    let m;
    let block;
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      block = { kind: `h${m[1].length}`, text: m[2] };
    } else if ((m = line.match(/^\[( |x|X)\]\s*(.*)$/))) {
      block = { kind: 'todo', checked: m[1].toLowerCase() === 'x', text: m[2] };
    } else if ((m = line.match(/^[-*•]\s+(.*)$/))) {
      block = { kind: 'bullet', text: m[1] };
    } else if ((m = line.match(/^\d+[.)]\s+(.*)$/))) {
      block = { kind: 'number', text: m[1] };
    } else {
      block = { kind: 'para', text: line };
    }

    const nestable = lastTop && ['bullet', 'number', 'todo'].includes(lastTop.kind);
    if (indent >= 2 && nestable) {
      (lastTop.children ||= []).push(block);
    } else {
      blocks.push(block);
      lastTop = block;
    }
  });

  return blocks;
}

const URL_RE = /(https?:\/\/[^\s)]+)/g;

/** 글자 속 주소를 [{ text, url }] 조각으로 나눔 */
export function splitLinks(text = '') {
  const parts = [];
  let last = 0;
  String(text).replace(URL_RE, (url, _g, offset) => {
    if (offset > last) parts.push({ text: text.slice(last, offset) });
    parts.push({ text: url, url });
    last = offset + url.length;
    return url;
  });
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
