import { useEffect, useState } from 'react';
import './QuickAddButton.css';

/**
 * 오른쪽 아래 '+' 버튼 하나: 누르면 자주 쓰는 작성 메뉴가 위로 펼쳐짐 (어느 메뉴에서든, PC·휴대폰)
 * actions: [{ id, icon, label, onClick, tone }] — 첫 번째가 버튼에 가장 가까이(맨 아래) 놓임
 */
export default function QuickAddButton({ actions = [] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const run = (a) => {
    setOpen(false);
    a.onClick();
  };

  return (
    <div className={`quick-add ${open ? 'open' : ''}`}>
      {open && <div className="quick-add-backdrop" onClick={() => setOpen(false)} />}
      {open && (
        <ul className="quick-add-menu" role="menu">
          {[...actions].reverse().map(a => (
            <li key={a.id}>
              <button type="button" role="menuitem" className={`quick-add-item ${a.tone || ''}`} onClick={() => run(a)}>
                <span className="quick-add-icon" aria-hidden="true">{a.icon}</span>
                <span>{a.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="quick-add-btn"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={open ? '닫기' : '빠르게 적기'}
        id="fab-quick-add"
      >
        <span className="quick-add-plus" aria-hidden="true">+</span>
        <span className="quick-add-text">빠르게 적기</span>
      </button>
    </div>
  );
}
