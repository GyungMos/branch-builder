import { useRef } from 'react';
import NeonIcon from './NeonIcon';
import './DateInput.css';

// 숫자만 추출하여 YYYY-MM-DD 자동 하이픈 마스킹
function formatToDateString(val) {
  if (!val) return '';
  // 이미 Date 인스턴스거나 타임스탬프인 경우
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  const digits = String(val).replace(/[^0-9]/g, '').slice(0, 8);
  if (digits.length <= 4) {
    return digits;
  } else if (digits.length <= 6) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  } else {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
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
  const hiddenPickerRef = useRef(null);

  // 텍스트 직접 입력 시 자동 마스킹
  const handleTextChange = (e) => {
    const rawVal = e.target.value;
    const formatted = formatToDateString(rawVal);
    if (onChange) {
      onChange(formatted);
    }
  };

  // 캘린더 팝업에서 날짜 선택 시
  const handlePickerChange = (e) => {
    const selectedDate = e.target.value; // YYYY-MM-DD
    if (selectedDate && onChange) {
      onChange(selectedDate);
    }
  };

  // 캘린더 아이콘 클릭 시 네이티브 날짜 피커 열기
  const handleOpenPicker = () => {
    if (hiddenPickerRef.current) {
      try {
        if (typeof hiddenPickerRef.current.showPicker === 'function') {
          hiddenPickerRef.current.showPicker();
        } else {
          hiddenPickerRef.current.focus();
        }
      } catch {
        hiddenPickerRef.current.focus();
      }
    }
  };

  // 현재 유효한 YYYY-MM-DD인지 확인하여 피커의 기본값으로 세팅
  const validPickerValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';

  return (
    <div className={`date-input-wrapper ${className}`} style={style}>
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

      {/* 우측 캘린더 버튼 */}
      <button
        type="button"
        className="date-input-calendar-btn"
        onClick={handleOpenPicker}
        title="달력에서 날짜 선택"
        tabIndex={-1}
      >
        <NeonIcon name="calendar" color="blue" size="sm" badge={false} />
      </button>

      {/* 숨겨진 네이티브 데이트 피커 */}
      <input
        type="date"
        ref={hiddenPickerRef}
        className="date-input-hidden-picker"
        value={validPickerValue}
        onChange={handlePickerChange}
        min={min}
        max={max}
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
