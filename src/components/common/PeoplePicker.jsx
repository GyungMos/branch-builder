import { useEffect, useRef, useState } from 'react';
import { usePeopleContext } from '../../contexts/PeopleContext';
import './PeoplePicker.css';

/** 이름표 동그라미 글자: 한글 세 글자 이름은 뒤 두 글자(홍우), 영문은 머리글자(KH) */
function initialsOf(name = '') {
  const n = name.trim();
  if (/^[가-힣]{3,4}$/.test(n)) return n.slice(-2);
  if (/^[가-힣]{1,2}$/.test(n)) return n;
  const words = n.split(/\s+/).filter(Boolean);
  if (words.length > 1) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

/** 사람 동그라미 (이름 글자 + 사람마다 고정된 색 — 설정의 담당자 명단에서 정함) */
export function Avatar({ name, size = 'sm', color }) {
  const { colorOf } = usePeopleContext();
  return (
    <span className={`avatar avatar-${size}`} style={{ '--av': color || colorOf(name) }} aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}

/**
 * 담당자 고르기 (펼침 목록): 고른 사람만 색 이름표로 보이고, '+'를 누르면 명단이 펼쳐짐
 * 명단에서 빠진 이름이 이미 들어 있으면 그대로 보여주고 빼기만 가능
 */
export default function PeoplePicker({ names = [], value = [], onChange, placeholder = '+ 담당자 추가' }) {
  const { colorOf } = usePeopleContext();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const toggle = (name) => {
    onChange(value.includes(name) ? value.filter(v => v !== name) : [...value, name]);
  };

  const filtered = names.filter(n => n.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="people-picker" ref={wrapRef}>
      {value.map(name => (
        <span key={name} className="person-chip" style={{ '--av': colorOf(name) }}>
          <Avatar name={name} />
          <span className="person-chip-name">{name}</span>
          <button type="button" className="person-chip-remove" onClick={() => toggle(name)} aria-label={`${name} 빼기`}>×</button>
        </span>
      ))}
      <button type="button" className="people-add" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="listbox">
        {value.length ? '+' : placeholder}
      </button>

      {open && (
        <div className="people-popover" role="listbox" aria-multiselectable="true">
          {names.length > 6 && (
            <input
              className="people-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름 찾기"
              autoFocus
            />
          )}
          {names.length === 0 ? (
            <p className="people-popover-empty">설정 → 담당자 명단에서 이름을 먼저 추가해 주세요.</p>
          ) : (
            filtered.map(name => {
              const on = value.includes(name);
              return (
                <button key={name} type="button" role="option" aria-selected={on} className={`people-option ${on ? 'on' : ''}`}
                  style={{ '--av': colorOf(name) }} onClick={() => toggle(name)}>
                  <Avatar name={name} />
                  <span>{name}</span>
                  <span className="people-option-check">{on ? '✓' : ''}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/** 담당자 표시 (카드·표 안): 색 동그라미 + 이름 (compact: 동그라미만 겹쳐서) */
export function PeopleTags({ names = [], compact = false }) {
  const { colorOf } = usePeopleContext();
  if (!names.length) return null;
  if (compact) {
    return (
      <span className="avatar-stack" title={names.join(', ')}>
        {names.slice(0, 4).map(n => <Avatar key={n} name={n} />)}
        {names.length > 4 && <span className="avatar avatar-sm avatar-more">+{names.length - 4}</span>}
      </span>
    );
  }
  return (
    <span className="people-tags">
      {names.map(n => (
        <span key={n} className="people-tag" style={{ '--av': colorOf(n) }}><Avatar name={n} size="xs" />{n}</span>
      ))}
    </span>
  );
}
