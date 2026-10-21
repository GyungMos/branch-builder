import { parseMiniDoc, splitLinks } from '../../utils/miniDoc';
import './MiniDocView.css';

function Inline({ text }) {
  return splitLinks(text).map((p, i) => (p.url
    ? <a key={i} href={p.url} target="_blank" rel="noreferrer">{p.text}</a>
    : <span key={i}>{p.text}</span>));
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

/** 오픈 계획 본문 보기 */
export default function MiniDocView({ text }) {
  const blocks = parseMiniDoc(text);
  if (!blocks.length) return <p className="minidoc-empty">아직 작성한 내용이 없어요.</p>;
  return <div className="minidoc">{renderList(blocks)}</div>;
}
