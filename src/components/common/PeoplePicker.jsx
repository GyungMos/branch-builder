import { useEffect, useRef, useState } from 'react';
import { usePeopleContext } from '../../contexts/PeopleContext';
import './PeoplePicker.css';

/**
 * 담당자 태그 (노션 담당자 칸처럼 색 배경 + 이름, 둥근 알약 모양)
 * onRemove가 있으면 오른쪽에 × 단추
 */
export function PersonTag({ name, onRemove, color, size }) {
  const { colorOf } = usePeopleContext();
  return (
    <span className={`person-tag ${size === 'sm' ? 'sm' : ''}`} style={{ '--av': color || colorOf(name) }}>
      <span className="person-tag-name">{name}</span>
      {onRemove && (
        <button type="button" className="person-tag-remove" onClick={(e) => { e.stopPropagation(); onRemove(); }} aria-label={`${name} 빼기`}>×</button>
      )}
    </span>
  );
}

/**
 * 담당자 고르기 (펼침 목록): 고른 사람만 색 태그로 보이고, '+'를 누르면 명단이 펼쳐짐
 * 명단에서 빠진 이름이 이미 들어 있으면 그대로 보여주고 빼기만 가능
 */
export default function PeoplePicker({ names = [], value = [], onChange, placeholder = '+ 담당자 추가' }) {
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
      {value.map(name => <PersonTag key={name} name={name} onRemove={() => toggle(name)} />)}
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
                <button key={name} type="button" role="option" aria-selected={on} className={`people-option ${on ? 'on' : ''}`} onClick={() => toggle(name)}>
                  <PersonTag name={name} />
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

/** 담당자 표시 (카드·표 안): 색 태그. max를 넘으면 '+N' */
export function PeopleTags({ names = [], max }) {
  if (!names.length) return null;
  const shown = max ? names.slice(0, max) : names;
  return (
    <span className="people-tags" title={names.join(', ')}>
      {shown.map(n => <PersonTag key={n} name={n} size="sm" />)}
      {max && names.length > max && <span className="person-tag sm more">+{names.length - max}</span>}
    </span>
  );
}
