import { useMemo, useState } from 'react';
import ModalPortal from '../common/ModalPortal';
import DateInput from '../common/DateInput';
import { formatDate, toDateInputValue } from '../../utils/formatters';
import {
  buildArchitectSchedule,
  ARCHITECT_SCHEDULE_COUNT,
  ARCHITECT_SCHEDULE_TOTAL_DAYS,
} from '../../utils/scheduleTemplates';

/**
 * 설계사 표준 신축공정 일정 불러오기: 시작일만 고르면 전체 일정이 자동 계산됨
 */
export default function ArchitectPresetModal({ stages, onApply, onClose }) {
  const [startDate, setStartDate] = useState(toDateInputValue(new Date()));
  const [saving, setSaving] = useState(false);
  const isValid = /^\d{4}-\d{2}-\d{2}$/.test(startDate); // 직접 입력 중인 날짜는 계산하지 않음

  const preview = useMemo(
    () => (isValid ? buildArchitectSchedule(startDate, stages) : []),
    [startDate, stages]
  );
  const lastEnd = preview.reduce((max, i) => (i.endDate > max ? i.endDate : max), '');

  const handleApply = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      await onApply(preview);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal onClose={onClose}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">표준 신축공정 일정 불러오기</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="text-secondary text-sm" style={{ marginBottom: 'var(--space-md)' }}>
            설계사무소 표준 {ARCHITECT_SCHEDULE_COUNT}개 공정(건축허가 → 착공접수 → 본공사·준공)을
            시작일 기준으로 자동 배치해요. 전체 약 {ARCHITECT_SCHEDULE_TOTAL_DAYS}일 걸리는 일정이에요.
          </p>
          <div className="form-group">
            <label htmlFor="preset-start">시작일 (허가도서 작성 시작일)</label>
            <DateInput id="preset-start" value={startDate} onChange={setStartDate} />
          </div>
          {isValid && (
            <div className="card-static" style={{ marginTop: 'var(--space-md)', fontSize: 'var(--font-size-sm)' }}>
              <div>첫 공정: <strong>{formatDate(startDate)}</strong></div>
              <div>마지막 공정(준공) 끝: <strong>{formatDate(lastEnd)}</strong></div>
              <div className="text-secondary" style={{ marginTop: 4 }}>
                공정마다 알맞은 단계(인허가·착공 준비·건축 시공·준공)에 자동으로 연결돼요. 불러온 뒤 날짜는 하나씩 고칠 수 있어요.
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>취소</button>
          <button className="btn btn-primary" onClick={handleApply} disabled={!isValid || saving}>
            {saving ? '등록 중…' : `${ARCHITECT_SCHEDULE_COUNT}개 일정 등록`}
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}
