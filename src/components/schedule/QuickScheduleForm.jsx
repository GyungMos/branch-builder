import { useState } from 'react';
import ModalPortal from '../common/ModalPortal';
import NeonIcon from '../common/NeonIcon';
import DateInput from '../common/DateInput';

export default function QuickScheduleForm({ schedule, stages, onSubmit, onClose }) {
  const isEdit = Boolean(schedule);
  const [title, setTitle] = useState(schedule?.title || '');
  const [startDate, setStartDate] = useState(
    schedule?.startDate
      ? (typeof schedule.startDate === 'string' ? schedule.startDate : new Date(schedule.startDate).toISOString().split('T')[0])
      : new Date().toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    schedule?.endDate
      ? (typeof schedule.endDate === 'string' ? schedule.endDate : new Date(schedule.endDate).toISOString().split('T')[0])
      : ''
  );
  const [stageId, setStageId] = useState(schedule?.stageId || '');
  const [assignee, setAssignee] = useState(schedule?.assignee || '');
  const [memo, setMemo] = useState(schedule?.memo || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !startDate) return;
    setLoading(true);
    try {
      await onSubmit({
        title: title.trim(),
        startDate,
        endDate: endDate || startDate,
        stageId: stageId || null,
        assignee: assignee.trim(),
        memo: memo.trim(),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalPortal onClose={onClose}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal" id="schedule-form-modal">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NeonIcon name="calendar" color="blue" size="sm" />
            <h2 className="modal-title">{isEdit ? '일정 수정' : '일정 추가'}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="schedule-title">일정명 *</label>
              <input
                id="schedule-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 현장 답사, 착공일"
                required
                autoFocus
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="schedule-start">시작일 *</label>
                <DateInput
                  id="schedule-start"
                  value={startDate}
                  onChange={setStartDate}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="schedule-end">종료일</label>
                <DateInput
                  id="schedule-end"
                  value={endDate}
                  onChange={setEndDate}
                  min={startDate}
                />
              </div>
            </div>

            {stages.length > 0 && (
              <div className="form-group">
                <label htmlFor="schedule-stage">연결 단계</label>
                <select id="schedule-stage" value={stageId} onChange={(e) => setStageId(e.target.value)}>
                  <option value="">선택 안함</option>
                  {stages.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="schedule-assignee">담당자</label>
              <input
                id="schedule-assignee"
                type="text"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="예: 김대리, 박과장"
              />
            </div>

            <div className="form-group">
              <label htmlFor="schedule-memo">메모</label>
              <textarea
                id="schedule-memo"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="메모를 입력하세요"
                rows={2}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !title.trim()}>
              {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : (isEdit ? '수정' : '추가')}
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}
