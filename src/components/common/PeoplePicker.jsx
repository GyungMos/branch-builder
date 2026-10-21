import './PeoplePicker.css';

/**
 * 담당자 명단에서 여러 명 고르기 (눌러서 선택/해제)
 * 명단에 없는 이름이 이미 들어 있으면(예: 명단에서 지운 사람) 그대로 보여주고 해제만 가능
 */
export default function PeoplePicker({ names = [], value = [], onChange, emptyHint = '설정 → 담당자 명단에서 이름을 먼저 추가해 주세요.' }) {
  const selected = new Set(value);
  const all = [...names, ...value.filter(v => !names.includes(v))];

  const toggle = (name) => {
    const next = selected.has(name) ? value.filter(v => v !== name) : [...value, name];
    onChange(next);
  };

  if (!all.length) return <p className="people-picker-empty">{emptyHint}</p>;

  return (
    <div className="people-picker" role="group">
      {all.map(name => (
        <button
          key={name}
          type="button"
          className={`people-chip ${selected.has(name) ? 'on' : ''}`}
          aria-pressed={selected.has(name)}
          onClick={() => toggle(name)}
        >
          {selected.has(name) ? '✓ ' : ''}{name}
        </button>
      ))}
    </div>
  );
}

/** 담당자 이름 표시 (카드·표 안) */
export function PeopleTags({ names = [] }) {
  if (!names.length) return null;
  return (
    <span className="people-tags">
      {names.map(n => <span key={n} className="people-tag">{n}</span>)}
    </span>
  );
}
