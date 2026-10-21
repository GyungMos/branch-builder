/**
 * 오픈 계획 본문용 간단 문서 형식 (사이트 화면과 노션 변환이 같은 규칙을 씀)
 *   # 큰 제목 / ## 제목 / ### 작은 제목
 *   - 점 목록 (• 또는 * 도 가능)
 *   1. 번호 목록
 *   [ ] 할 일 / [x] 끝낸 일
 *   줄 앞에 띄어쓰기 2칸 이상 → 바로 위 목록의 하위 항목
 *   ![사진 이름](주소) 한 줄 → 사진
 *   [보일 이름](주소) → 링크, http로 시작하는 주소는 자동으로 링크
 *   {{red:글자}} 글씨색 · {{bg-yellow:글자}} 배경색 · {{red,bg-yellow:글자}} 둘 다
 */

// 노션과 같은 색 이름 (노션으로 보낼 때 그대로 씀)
export const DOC_COLORS = [
  { id: 'gray', label: '회색' },
  { id: 'brown', label: '갈색' },
  { id: 'orange', label: '주황' },
  { id: 'yellow', label: '노랑' },
  { id: 'green', label: '초록' },
  { id: 'blue', label: '파랑' },
  { id: 'purple', label: '보라' },
  { id: 'pink', label: '분홍' },
  { id: 'red', label: '빨강' },
];
const COLOR_IDS = DOC_COLORS.map(c => c.id);

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
    if ((m = line.match(/^!\[([^\]]*)\]\((\S+)\)$/))) {
      block = { kind: 'image', text: m[1], url: m[2] };
    } else if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
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
    if (indent >= 2 && nestable && block.kind !== 'image') {
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

const INLINE_RE = /\{\{([a-z,-]+):([\s\S]*?)\}\}|\[([^\]]+)\]\(([^\s)]+)\)/g;

/**
 * 한 줄 글자를 [{ text, url?, color?, bg? }] 조각으로 나눔
 * (색 표시 {{...}}, 링크 [이름](주소), 그냥 적은 주소)
 */
export function parseInline(text = '', style = {}) {
  const src = String(text);
  const out = [];
  let last = 0;
  const plain = (s) => splitLinks(s).forEach(p => out.push({ ...style, ...p }));

  src.replace(INLINE_RE, (whole, spec, inner, label, url, offset) => {
    if (offset > last) plain(src.slice(last, offset));
    if (spec !== undefined) {
      const next = { ...style };
      spec.split(',').forEach(s => {
        if (s.startsWith('bg-') && COLOR_IDS.includes(s.slice(3))) next.bg = s.slice(3);
        else if (COLOR_IDS.includes(s)) next.color = s;
      });
      out.push(...parseInline(inner, next));
    } else {
      out.push({ ...style, text: label, url });
    }
    last = offset + whole.length;
    return whole;
  });
  if (last < src.length) plain(src.slice(last));
  return out;
}

/** 검색·미리보기용: 사진 줄과 색 표시를 뺀 글자만 */
export function plainMiniDoc(text = '') {
  return String(text).split('\n')
    .filter(l => !/^\s*!\[[^\]]*\]\(\S+\)\s*$/.test(l))
    .map(l => parseInline(l).map(p => p.text).join(''))
    .join('\n');
}

/**
 * 본문 속 첨부 표시 (att:번호) → 실제 주소
 * forNotion이면 노션이 받을 수 없는 사이트 안 사진(data:)은 'site:'로 바꿔 짧게 보냄
 */
export function resolveAttachments(text = '', attachments = {}, forNotion = false) {
  return String(text).replace(/\(att:([A-Za-z0-9_-]+)\)/g, (_m, id) => {
    const url = attachments?.[id]?.url;
    if (!url) return '(missing:)';
    if (forNotion && !/^https?:\/\//.test(url)) return '(site:)';
    return `(${url})`;
  });
}
