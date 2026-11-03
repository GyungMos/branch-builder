import { useState } from 'react';
import './Lessons.css';

/** 부족했던 점 제목: 상세 내용이 있으면 눌러서 펼쳐 봄 */
export default function ShortfallTitle({ title, detail, prefix = null }) {
  const [open, setOpen] = useState(false);
  if (!detail) return <span className="lessons-text">{prefix}{title}</span>;
  return (
    <div className="shortfall-title">
      <button type="button" className={`lessons-text shortfall-title-btn ${open ? 'open' : ''}`} aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {prefix}{title}
        <span className="shortfall-more">{open ? '접기 ▴' : '상세 ▾'}</span>
      </button>
      {open && <p className="shortfall-detail-view">{detail}</p>}
    </div>
  );
}
