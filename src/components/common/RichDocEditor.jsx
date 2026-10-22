import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { parseMiniDoc, parseInline, resolveAttachments, safeUrl } from '../../utils/miniDoc';
import './RichDocEditor.css';

/**
 * 노션처럼 바로 꾸며지는 본문 편집기
 * - 보이는 그대로 편집하고, 저장할 때는 지금까지 쓰던 간단 문서 형식(# · - · {{red:글자}} …)으로 바꿔 둠
 *   → 노션 보내기·검색·미리보기는 그대로 동작
 */

// 편집기에서 쓰는 색 (밝은·어두운 화면 모두에서 읽히는 중간 색)
export const EDITOR_COLORS = {
  gray: '#8a8f98', brown: '#a27763', orange: '#e07b39', yellow: '#c99a06', green: '#2e9d5b',
  blue: '#2f7fe0', purple: '#8b5cf6', pink: '#d6409f', red: '#e5484d',
};
export const EDITOR_BGS = {
  gray: 'rgba(155, 154, 151, 0.3)', brown: 'rgba(186, 133, 111, 0.3)', orange: 'rgba(245, 158, 11, 0.3)',
  yellow: 'rgba(234, 179, 8, 0.32)', green: 'rgba(34, 197, 94, 0.28)', blue: 'rgba(59, 130, 246, 0.28)',
  purple: 'rgba(139, 92, 246, 0.28)', pink: 'rgba(236, 72, 153, 0.28)', red: 'rgba(239, 68, 68, 0.28)',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------- 저장 글 → 편집 화면 ----------
function inlineHtml(text, attachments) {
  return parseInline(text).map(p => {
    let html = esc(p.text);
    const style = [p.color && EDITOR_COLORS[p.color] ? `color: ${EDITOR_COLORS[p.color]}` : '', p.bg && EDITOR_BGS[p.bg] ? `background-color: ${EDITOR_BGS[p.bg]}` : '']
      .filter(Boolean).join('; ');
    if (p.url) {
      const shown = resolveAttachments(`(${p.url})`, attachments).slice(1, -1);
      html = `<a href="${esc(shown)}" data-href="${esc(p.url)}" target="_blank" rel="noreferrer">${html}</a>`;
    }
    return style ? `<span style="${style}">${html}</span>` : html;
  }).join('');
}

function blocksHtml(blocks, attachments) {
  let out = '';
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    const listKind = b.kind === 'bullet' ? 'ul' : b.kind === 'number' ? 'ol' : b.kind === 'todo' ? 'todo' : (b.kind === 'para' && b.nested) ? 'plain' : null;
    if (listKind) {
      const items = [];
      while (i < blocks.length) {
        const c = blocks[i];
        const k = c.kind === 'bullet' ? 'ul' : c.kind === 'number' ? 'ol' : c.kind === 'todo' ? 'todo' : (c.kind === 'para' && c.nested) ? 'plain' : null;
        if (k !== listKind) break;
        items.push(c);
        i++;
      }
      const tag = listKind === 'ol' ? 'ol' : 'ul';
      const cls = listKind === 'todo' ? ' class="todo-list"' : listKind === 'plain' ? ' class="plain-list"' : '';
      out += `<${tag}${cls}>${items.map(it => {
        const kids = it.children?.length ? blocksHtml(it.children.map(ch => ({ ...ch, nested: true })), attachments) : '';
        const checked = it.kind === 'todo' ? ` data-checked="${it.checked ? 'true' : 'false'}"` : '';
        return `<li${checked}>${inlineHtml(it.text, attachments) || '<br>'}${kids}</li>`;
      }).join('')}</${tag}>`;
      continue;
    }
    if (b.kind === 'image') {
      const src = resolveAttachments(`(${b.url})`, attachments).slice(1, -1);
      out += `<figure contenteditable="false" data-src="${esc(b.url)}" data-alt="${esc(b.text || '')}"><img src="${esc(src)}" alt="${esc(b.text || '사진')}"></figure>`;
    } else if (b.kind === 'h1' || b.kind === 'h2' || b.kind === 'h3') {
      const tag = { h1: 'h2', h2: 'h3', h3: 'h4' }[b.kind];
      out += `<${tag}>${inlineHtml(b.text, attachments)}</${tag}>`;
    } else {
      out += `<p>${inlineHtml(b.text, attachments) || '<br>'}</p>`;
    }
    i++;
  }
  return out;
}

/** 빈 줄도 문단으로 살려서 편집 화면을 만듦 */
export function docToHtml(text = '', attachments = {}) {
  const parts = [];
  let chunk = [];
  const flush = () => {
    if (chunk.length) parts.push(blocksHtml(parseMiniDoc(chunk.join('\n')), attachments));
    chunk = [];
  };
  String(text).replace(/\r\n/g, '\n').split('\n').forEach(line => {
    if (line.trim()) chunk.push(line);
    else { flush(); parts.push('<p><br></p>'); }
  });
  flush();
  const html = parts.join('').replace(/^(<p><br><\/p>)+/, '');
  return html || '<p><br></p>';
}

// ---------- 편집 화면 → 저장 글 ----------
function rgbOf(value) {
  const m = String(value || '').match(/rgba?\(([^)]+)\)/);
  if (m) return m[1].split(',').slice(0, 3).map(n => Number(n.trim()));
  const h = String(value || '').match(/^#([0-9a-f]{6})$/i);
  if (h) return [0, 2, 4].map(k => parseInt(h[1].slice(k, k + 2), 16));
  return null;
}

function nearest(value, table) {
  const rgb = rgbOf(value);
  if (!rgb) return null;
  let best = null;
  let bestDist = Infinity;
  Object.entries(table).forEach(([id, c]) => {
    const t = rgbOf(c);
    const d = Math.hypot(rgb[0] - t[0], rgb[1] - t[1], rgb[2] - t[2]);
    if (d < bestDist) { bestDist = d; best = id; }
  });
  return bestDist < 60 ? best : null;
}

function styleOf(el, base) {
  const next = { ...base };
  if (el.style?.color) next.color = nearest(el.style.color, EDITOR_COLORS) || next.color;
  if (el.style?.backgroundColor) next.bg = nearest(el.style.backgroundColor, EDITOR_BGS) || next.bg;
  if (el.getAttribute?.('color')) next.color = nearest(el.getAttribute('color'), EDITOR_COLORS) || next.color;
  (el.className && typeof el.className === 'string' ? el.className.split(/\s+/) : []).forEach(c => {
    if (c.startsWith('tc-')) next.color = c.slice(3);
    if (c.startsWith('bg-')) next.bg = c.slice(3);
  });
  return next;
}

const BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'FIGURE', 'BLOCKQUOTE', 'PRE', 'TABLE']);

/** 줄 안의 글자를 [{ text, color, bg, href }] 조각으로 */
function collectInline(node, style, out) {
  node.childNodes.forEach(n => {
    if (n.nodeType === 3) {
      out.push({ ...style, text: n.nodeValue.replace(/​/g, '') });
    } else if (n.nodeType === 1) {
      if (n.tagName === 'BR') out.push({ ...style, text: '\n' });
      else if (n.tagName === 'UL' || n.tagName === 'OL') { /* 하위 목록은 따로 */ }
      else if (n.tagName === 'A') {
        const href = n.getAttribute('data-href') || n.getAttribute('href') || '';
        const s = styleOf(n, style);
        out.push({ ...s, text: n.textContent, href });
      } else if (n.tagName === 'IMG' || n.tagName === 'FIGURE') { /* 줄 안 사진은 무시 */ }
      else collectInline(n, styleOf(n, style), out);
    }
  });
  return out;
}

function specOf(s) {
  return [s.color, s.bg ? `bg-${s.bg}` : ''].filter(Boolean).join(',');
}

function inlineText(node) {
  const segs = collectInline(node, {}, []);
  // 같은 꾸밈끼리 합치기
  const merged = [];
  segs.forEach(s => {
    const last = merged[merged.length - 1];
    if (last && !s.href && !last.href && specOf(last) === specOf(s)) last.text += s.text;
    else merged.push({ ...s });
  });
  return merged.map(s => {
    if (!s.text) return '';
    return s.text.split('\n').map(piece => {
      if (!piece) return '';
      let t = s.href ? `[${piece.replace(/[[\]]/g, '')}](${s.href.startsWith('att:') ? s.href : safeUrl(s.href)})` : piece;
      const spec = specOf(s);
      if (spec && piece.trim()) t = `{{${spec}:${t}}}`;
      return t;
    }).join('\n');
  }).join('');
}

/** 사진 한 줄 (편집기 사진 칸 → ![이름](주소)) */
function figureLine(f) {
  const src = f.getAttribute('data-src') || f.querySelector('img')?.getAttribute('src') || '';
  if (!src) return '';
  return `![${(f.getAttribute('data-alt') || '').replace(/[[\]]/g, '')}](${src})`;
}

/** 다른 줄 안에 끼어 들어간 사진도 잃지 않게 그 줄 아래로 꺼냄 */
function pushFigures(el, lines) {
  el.querySelectorAll('figure').forEach(f => {
    const l = figureLine(f);
    if (l) lines.push(l);
  });
}

function listLines(list, depth, lines) {
  const isTodo = list.classList.contains('todo-list');
  const isPlain = list.classList.contains('plain-list');
  const ordered = list.tagName === 'OL';
  Array.from(list.children).forEach(li => {
    if (li.tagName === 'UL' || li.tagName === 'OL') { listLines(li, depth + 1, lines); return; }
    if (li.tagName !== 'LI') return;
    const prefix = isTodo ? (li.getAttribute('data-checked') === 'true' ? '[x] ' : '[ ] ') : isPlain ? '' : ordered ? '1. ' : '- ';
    const text = inlineText(li).split('\n');
    lines.push('  '.repeat(depth) + prefix + text[0]);
    text.slice(1).filter(t => t.trim()).forEach(t => lines.push('  '.repeat(depth + 1) + t));
    li.querySelectorAll(':scope > figure').forEach(f => { const l = figureLine(f); if (l) lines.push(l); });
    Array.from(li.children).forEach(ch => { if (ch.tagName === 'UL' || ch.tagName === 'OL') listLines(ch, depth + 1, lines); });
  });
}

const HEADING_PREFIX = { H1: '# ', H2: '# ', H3: '## ', H4: '### ', H5: '### ', H6: '### ' };

function blockLines(node, lines) {
  Array.from(node.childNodes).forEach(n => {
    if (n.nodeType === 3) {
      if (n.nodeValue.trim()) lines.push(n.nodeValue.trim());
      return;
    }
    if (n.nodeType !== 1) return;
    const tag = n.tagName;
    if (tag === 'UL' || tag === 'OL') listLines(n, 0, lines);
    else if (tag === 'FIGURE') {
      const l = figureLine(n);
      if (l) lines.push(l);
    } else if (tag === 'IMG') {
      const src = n.getAttribute('src');
      if (src && !src.startsWith('data:')) lines.push(`![](${src})`);
    } else if ((tag === 'DIV' || tag === 'BLOCKQUOTE') && Array.from(n.children).some(c => BLOCK_TAGS.has(c.tagName))) {
      blockLines(n, lines);
    } else if (BLOCK_TAGS.has(tag)) {
      const t = inlineText(n);
      const prefix = HEADING_PREFIX[tag] || '';
      if (t.trim()) t.split('\n').forEach((l, i) => lines.push((i === 0 ? prefix : '') + l));
      else if (!n.querySelector('figure')) lines.push('');
      pushFigures(n, lines);
    } else {
      const t = inlineText({ childNodes: [n] });
      if (t.trim()) lines.push(t);
    }
  });
}

export function htmlToDoc(root) {
  const lines = [];
  blockLines(root, lines);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ---------- 편집기 ----------
const RichDocEditor = forwardRef(function RichDocEditor({ initialValue, attachments, onChange, placeholder }, ref) {
  const boxRef = useRef(null);
  const savedRange = useRef(null);

  // 처음 열 때만 화면을 채움 (입력할 때마다 다시 그리면 커서가 튐)
  useEffect(() => {
    const el = boxRef.current;
    el.innerHTML = docToHtml(initialValue, attachments);
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* 지원 안 함 */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const emit = () => onChange?.(htmlToDoc(boxRef.current));

  const saveRange = () => {
    const sel = window.getSelection();
    if (sel.rangeCount && boxRef.current.contains(sel.anchorNode)) savedRange.current = sel.getRangeAt(0).cloneRange();
  };

  const restoreRange = () => {
    const el = boxRef.current;
    el.focus();
    const sel = window.getSelection();
    if (savedRange.current && el.contains(savedRange.current.startContainer)) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    } else if (!el.contains(sel.anchorNode)) {
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
    }
  };

  const exec = (cmd, value) => {
    restoreRange();
    document.execCommand('styleWithCSS', false, true);
    document.execCommand(cmd, false, value);
    saveRange();
    emit();
  };

  const currentBlock = () => {
    const sel = window.getSelection();
    let n = sel.anchorNode;
    while (n && n !== boxRef.current) {
      if (n.nodeType === 1 && BLOCK_TAGS.has(n.tagName)) return n;
      n = n.parentNode;
    }
    return null;
  };

  const toggleTodo = () => {
    restoreRange();
    let block = currentBlock();
    let list = block?.closest?.('ul, ol');
    if (!list || !boxRef.current.contains(list)) {
      document.execCommand('insertUnorderedList');
      block = currentBlock();
      list = block?.closest?.('ul, ol');
    }
    if (list) {
      list.classList.toggle('todo-list');
      list.querySelectorAll(':scope > li').forEach(li => { if (!li.hasAttribute('data-checked')) li.setAttribute('data-checked', 'false'); });
    }
    saveRange();
    emit();
  };

  // 사진·파일은 고른 글자를 덮어쓰지 않고, 지금 줄 바로 아래 새 줄로 넣음
  const insertBlock = (html) => {
    const el = boxRef.current;
    restoreRange();
    let line = window.getSelection().anchorNode;
    while (line && line.parentNode !== el) line = line.parentNode;
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    const nodes = Array.from(tpl.content.childNodes);
    if (line && line !== el) line.after(...nodes);
    else el.append(...nodes);
    // 커서를 넣은 것 아래 빈 줄로
    const after = nodes[nodes.length - 1];
    const r = document.createRange();
    r.selectNodeContents(after);
    r.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    savedRange.current = r.cloneRange();
    emit();
  };

  useImperativeHandle(ref, () => ({
    saveRange,
    selectedText: () => savedRange.current?.toString() || '',
    heading: (level) => exec('formatBlock', level ? `h${level + 1}` : 'p'),
    bullet: () => exec('insertUnorderedList'),
    number: () => exec('insertOrderedList'),
    todo: toggleTodo,
    indent: () => exec('indent'),
    outdent: () => exec('outdent'),
    color: (id) => exec('foreColor', EDITOR_COLORS[id]),
    background: (id) => exec('hiliteColor', EDITOR_BGS[id]),
    clearColor: () => exec('removeFormat'),
    link: (label, url) => {
      restoreRange();
      const sel = window.getSelection();
      const text = sel.toString() || label || url;
      document.execCommand('insertHTML', false, `<a href="${esc(url)}" data-href="${esc(url)}" target="_blank" rel="noreferrer">${esc(text)}</a>&nbsp;`);
      saveRange();
      emit();
    },
    image: (key, url, name) => insertBlock(`<figure contenteditable="false" data-src="att:${esc(key)}" data-alt="${esc(name || '')}"><img src="${esc(url)}" alt="${esc(name || '사진')}"></figure><p><br></p>`),
    file: (key, url, name) => insertBlock(`<p>📎 <a href="${esc(url)}" data-href="att:${esc(key)}" target="_blank" rel="noreferrer">${esc(name)}</a></p><p><br></p>`),
    focus: () => boxRef.current?.focus(),
  }));

  // 노션처럼: 줄 맨 앞에 '# ', '- ', '1. ', '[] ' 를 치면 바로 제목·목록·할 일로
  const onKeyDown = (e) => {
    if (e.key === 'Tab') {
      const inList = currentBlock()?.closest?.('li');
      if (inList) {
        e.preventDefault();
        document.execCommand(e.shiftKey ? 'outdent' : 'indent');
        emit();
      }
      return;
    }
    if (e.key !== ' ') return;
    const block = currentBlock();
    if (!block || block.tagName === 'LI') return;
    const t = block.textContent;
    const map = { '#': ['formatBlock', 'h2'], '##': ['formatBlock', 'h3'], '###': ['formatBlock', 'h4'], '-': ['insertUnorderedList'], '*': ['insertUnorderedList'], '1.': ['insertOrderedList'], '[]': ['todo'] };
    const hit = map[t];
    if (!hit) return;
    e.preventDefault();
    block.innerHTML = '<br>';
    const r = document.createRange();
    r.setStart(block, 0);
    r.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    savedRange.current = r.cloneRange();
    if (hit[0] === 'todo') toggleTodo();
    else { document.execCommand(hit[0], false, hit[1]); emit(); }
  };

  // 할 일 네모 누르면 체크
  const onMouseDown = (e) => {
    const li = e.target.closest?.('ul.todo-list > li');
    if (!li) return;
    const rect = li.getBoundingClientRect();
    if (e.clientX - rect.left < 26) {
      e.preventDefault();
      li.setAttribute('data-checked', li.getAttribute('data-checked') === 'true' ? 'false' : 'true');
      emit();
    }
  };

  // 붙여넣기는 글자만 (다른 곳의 복잡한 꾸밈이 섞이지 않게)
  const onPaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    emit();
  };

  return (
    <div
      ref={boxRef}
      className="rich-editor minidoc"
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label="본문"
      data-placeholder={placeholder}
      spellCheck={false}
      onInput={emit}
      onKeyDown={onKeyDown}
      onKeyUp={saveRange}
      onMouseUp={saveRange}
      onMouseDown={onMouseDown}
      onBlur={saveRange}
      onPaste={onPaste}
    />
  );
});

export default RichDocEditor;
