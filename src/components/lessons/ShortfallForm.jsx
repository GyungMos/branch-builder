import { useState } from 'react';
import ModalPortal from '../common/ModalPortal';
import DateInput from '../common/DateInput';
import { SHORTFALL_CATEGORIES } from '../../utils/lessons';
import { toDateInputValue } from '../../utils/formatters';

/**
 * '부족했던 점' 메뉴에서 바로 적기·고치기 (현장 일지를 쓰지 않을 때)
 */
export default function ShortfallForm({ record, stages = [], defaultStageId = '', onSave, onDelete, onClose }) {
  const [title, setTitle] = useState(record?.title || '');
  const [detail, setDetail] = useState(record?.detail || '');
  const [category, setCategory] = useState(record?.category || '');
  const [stageId, setStageId] = useState(record ? (record.stageId || '') : defaultStageId);
  const [date, setDate] = useState(record?.date || toDateInputValue(new Date()));
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({ title: title.trim(), detail: detail.trim(), category, stageId: stageId || null, date: date || toDateInputValue(new Date()) });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal onClose={onClose}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 520 }} role="dialog" aria-label="부족했던 점">
        <div className="modal-header">
          <h2 className="modal-title">⚠ {record ? '부족했던 점 고치기' : '부족했던 점 적기'}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="sf-title">제목 *</label>
              <input id="sf-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 정화조 위치 미리 확인 못 함" required autoFocus />
            </div>
            <div className="form-group">
              <label htmlFor="sf-detail">상세 내용</label>
              <textarea id="sf-detail" rows={4} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="무엇이 문제였는지, 다음엔 언제·어떻게 챙길지" />
            </div>
            <div className="defect-form-grid">
              <div className="form-group">
                <label htmlFor="sf-cat">분야</label>
                <select id="sf-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">고르지 않음</option>
                  {SHORTFALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="sf-stage">어느 단계인가요?</label>
                <select id="sf-stage" value={stageId} onChange={(e) => setStageId(e.target.value)}>
                  <option value="">단계 미정</option>
                  {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>날짜</label>
              <DateInput value={date} onChange={setDate} />
            </div>
          </div>
          <div className="modal-footer">
            {record && onDelete && (
              <button type="button" className="btn btn-ghost" style={{ color: 'var(--color-error)', marginRight: 'auto' }}
                onClick={async () => { if (await onDelete(record.id)) onClose(); }}>지우기</button>
            )}
            <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !title.trim()}>{saving ? '저장 중…' : '저장'}</button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}
