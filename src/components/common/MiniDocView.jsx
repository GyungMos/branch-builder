import { parseMiniDoc, parseInline, resolveAttachments } from '../../utils/miniDoc';
import ZoomableImage from './ZoomableImage';
import './MiniDocView.css';

function Inline({ text }) {
  return parseInline(text).map((p, i) => {
    const cls = [p.color ? `tc-${p.color}` : '', p.bg ? `bg-${p.bg}` : ''].join(' ').trim() || undefined;
    return p.url
      ? <a key={i} className={cls} href={p.url} target="_blank" rel="noreferrer" download={p.url.startsWith('data:') ? p.text : undefined}>{p.text}</a>
      : <span key={i} className={cls}>{p.text}</span>;
  });
}

function renderList(items, depth = 0) {
  // 같은 종류가 이어지는 항목끼리 ul/ol로 묶음
  const out = [];
  let group = null;
  items.forEach((b, i) => {
    const listKind = b.kind === 'number' ? 'ol' : (b.kind === 'bullet' || b.kind === 'todo') ? 'ul' : null;
    if (listKind) {
      if (!group || group.kind !== listKind) {
        group = { kind: listKind, items: [] };
        out.push(group);
      }
      group.items.push(b);
    } else {
      group = null;
      out.push({ kind: 'single', block: b, key: i });
    }
  });

  return out.map((g, gi) => {
    if (g.kind === 'single') {
      const b = g.block;
      if (b.kind === 'image') {
        return (
          <figure key={`${depth}-${gi}`} className="minidoc-image">
            <ZoomableImage src={b.url} alt={b.text || '사진'} />
            {b.text && <figcaption>{b.text}</figcaption>}
          </figure>
        );
      }
      const Tag = b.kind === 'h1' ? 'h2' : b.kind === 'h2' ? 'h3' : b.kind === 'h3' ? 'h4' : 'p';
      return <Tag key={`${depth}-${gi}`}><Inline text={b.text} /></Tag>;
    }
    const ListTag = g.kind;
    return (
      <ListTag key={`${depth}-${gi}`}>
        {g.items.map((b, i) => (
          <li key={i} className={b.kind === 'todo' ? `todo ${b.checked ? 'checked' : ''}` : ''}>
            {b.kind === 'todo' && <span className="todo-box">{b.checked ? '☑' : '☐'}</span>}
            <Inline text={b.text} />
            {b.children && renderList(b.children, depth + 1)}
          </li>
        ))}
      </ListTag>
    );
  });
}

/** 오픈 계획 본문 보기 (attachments: 본문 속 att:번호 → 사진·파일 주소) */
export default function MiniDocView({ text, attachments }) {
  const blocks = parseMiniDoc(resolveAttachments(text, attachments));
  if (!blocks.length) return <p className="minidoc-empty">아직 작성한 내용이 없어요.</p>;
  return <div className="minidoc">{renderList(blocks)}</div>;
}
