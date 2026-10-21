import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import NeonIcon from './NeonIcon';
import './DateInput.css';

// 숫자만 추출하여 YYYY-MM-DD 자동 하이픈 마스킹
function formatToDateString(val) {
  if (!val) return '';
  if (val instanceof Date) return ymd(val);
  const digits = String(val).replace(/[^0-9]/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseYmd(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '')) return null;
  const [y, m, d] = v.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? null : date;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const POPOVER_WIDTH = 300;
const POPOVER_HEIGHT = 380;

/**
 * 달력 팝업 (입체감 있는 카드, 오늘은 포인트 색, 고른 날은 테두리)
 * 화면 맨 위에 띄워서 창(모달) 안에서도 잘리지 않음
 */
function CalendarPopover({ anchorRef, value, min, max, onPick, onClose }) {
  const selected = parseYmd(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = selected || today;
  const [view, setView] = useState({ y: start.getFullYear(), m: start.getMonth() });
  const [mode, setMode] = useState('days'); // days | months
  const [pos, setPos] = useState(null);
  const popRef = useRef(null);
  const minD = parseYmd(min);
  const maxD = parseYmd(max);

  // 입력칸 바로 아래(공간이 없으면 위)에 위치. 휴대폰에서 작성 창이 아래에서 올라오는 동안에도
  // 입력칸을 따라가도록 열려 있는 동안 위치를 계속 맞추고, 화면 밖으로 나가지 않게 함
  useLayoutEffect(() => {
    let frame;
    let last = '';
    const place = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (r) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const left = Math.max(8, Math.min(r.left, vw - POPOVER_WIDTH - 8));
        const below = r.bottom + 6;
        const above = r.top - POPOVER_HEIGHT - 6;
        let top = below + POPOVER_HEIGHT > vh && above > 8 ? above : below;
        top = Math.max(8, Math.min(top, vh - POPOVER_HEIGHT - 8));
        const key = `${top}|${left}`;
        if (key !== last) {
          last = key;
          setPos({ top, left });
        }
      }
      frame = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(frame);
  }, [anchorRef]);

  useEffect(() => {
    const onDown = (e) => {
      if (popRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [anchorRef, onClose]);

  const move = (delta) => setView(v => {
    const d = new Date(v.y, v.m + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const first = new Date(view.y, view.m, 1);
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(view.y, view.m, d));

  const disabled = (d) => (minD && d < minD) || (maxD && d > maxD);
  const same = (a, b) => a && b && a.getTime() === b.getTime();

  if (!pos) return null;

  return createPortal(
    <div
      ref={popRef}
      className="cal-pop"
      style={{ top: pos.top, left: pos.left, width: POPOVER_WIDTH }}
      role="dialog"
      aria-label="날짜 고르기"
    >
      <div className="cal-head">
        <button type="button" className="cal-nav" onClick={() => (mode === 'days' ? move(-1) : setView(v => ({ ...v, y: v.y - 1 })))} aria-label={mode === 'days' ? '이전 달' : '이전 해'}>‹</button>
        <button type="button" className="cal-title" onClick={() => setMode(m => (m === 'days' ? 'months' : 'days'))}>
          {mode === 'days' ? `${view.y}년 ${view.m + 1}월` : `${view.y}년`} <span className="cal-caret">▾</span>
        </button>
        <button type="button" className="cal-nav" onClick={() => (mode === 'days' ? move(1) : setView(v => ({ ...v, y: v.y + 1 })))} aria-label={mode === 'days' ? '다음 달' : '다음 해'}>›</button>
      </div>

      {mode === 'days' ? (
        <>
          <div className="cal-week">
            {WEEKDAYS.map((w, i) => <span key={w} className={i === 0 ? 'sun' : i === 6 ? 'sat' : ''}>{w}</span>)}
          </div>
          <div className="cal-grid">
            {cells.map((d, i) => {
              if (!d) return <span key={`e${i}`} />;
              const isToday = same(d, today);
              const isSel = same(d, selected);
              const dow = d.getDay();
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled(d)}
                  className={[
                    'cal-day',
                    isToday ? 'today' : '',
                    isSel ? 'selected' : '',
                    dow === 0 ? 'sun' : dow === 6 ? 'sat' : '',
                  ].join(' ')}
                  aria-pressed={isSel}
                  aria-label={`${d.getMonth() + 1}월 ${d.getDate()}일${isToday ? ' (오늘)' : ''}`}
                  onClick={() => onPick(ymd(d))}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="cal-months">
          {Array.from({ length: 12 }, (_, m) => (
            <button
              key={m}
              type="button"
              className={`cal-month ${m === view.m ? 'on' : ''} ${view.y === today.getFullYear() && m === today.getMonth() ? 'now' : ''}`}
              onClick={() => { setView(v => ({ ...v, m })); setMode('days'); }}
            >
              {m + 1}월
            </button>
          ))}
        </div>
      )}

      <div className="cal-foot">
        <button type="button" className="cal-chip" onClick={() => onPick(ymd(today))}>오늘</button>
        {value && <button type="button" className="cal-chip ghost" onClick={() => onPick('')}>지우기</button>}
      </div>
    </div>,
    document.body,
  );
}

export default function DateInput({
  id,
  name,
  value = '',
  onChange,
  placeholder = 'YYYY-MM-DD (예: 2026-08-08)',
  required = false,
  min,
  max,
  style = {},
  className = '',
  autoFocus = false,
}) {
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);

  // 텍스트 직접 입력 시 자동 마스킹
  const handleTextChange = (e) => {
    onChange?.(formatToDateString(e.target.value));
  };

  return (
    <div ref={wrapRef} className={`date-input-wrapper ${open ? 'open' : ''} ${className}`} style={style}>
      <input
        type="text"
        id={id}
        name={name}
        className="date-input-field"
        value={value}
        onChange={handleTextChange}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        maxLength={10}
        inputMode="numeric"
      />

      <button
        type="button"
        className="date-input-calendar-btn"
        onClick={() => setOpen(o => !o)}
        title="달력에서 날짜 선택"
        aria-label="달력 열기"
        aria-expanded={open}
      >
        <NeonIcon name="calendar" color="blue" size="sm" badge={false} />
      </button>

      {open && (
        <CalendarPopover
          anchorRef={wrapRef}
          value={value}
          min={min}
          max={max}
          onPick={(v) => { onChange?.(v); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
