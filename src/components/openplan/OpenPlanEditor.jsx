import { useState } from 'react';
import ModalPortal from '../common/ModalPortal';
import DateInput from '../common/DateInput';
import PeoplePicker from '../common/PeoplePicker';
import MiniDocView from '../common/MiniDocView';
import NotionBadge from '../common/NotionBadge';
import { PLAN_COLUMNS } from './OpenPlanBoard';
import { toDateInputValue } from '../../utils/formatters';

const BODY_HELP = '# 제목   - 점 목록   1. 번호 목록   [ ] 할 일   (줄 앞 띄어쓰기 2칸 = 하위 항목, 주소는 자동 링크)';

/**
 * 오픈 계획 카드 세부 페이지 (노션 카드 안쪽과 같은 구성: 상태 · 담당자1·2 · 종료일 · 본문)
 */
export default function OpenPlanEditor({ plan, defaultStatus = 'todo', people, onSave, onDelete, onRetryNotion, onClose }) {
  const isNew = !plan?.id;
  const [title, setTitle] = useState(plan?.title || '');
  const [status, setStatus] = useState(plan?.status || defaultStatus);
  const [assignee1, setAssignee1] = useState(plan?.assignee1 || []);
  const [assignee2, setAssignee2] = useState(plan?.assignee2 || []);
  const [dueDate, setDueDate] = useState(toDateInputValue(plan?.dueDate));
  const [body, setBody] = useState(plan?.body || '');
  const [mode, setMode] = useState(isNew || !plan?.body ? 'edit' : 'view');
  const [saving, setSaving] = useState(false);

  const dirty = isNew
    || title !== (plan.title || '') || status !== (plan.status || 'todo') || body !== (plan.body || '')
    || dueDate !== toDateInputValue(plan.dueDate)
    || JSON.stringify(assignee1) !== JSON.stringify(plan.assignee1 || [])
    || JSON.stringify(assignee2) !== JSON.stringify(plan.assignee2 || []);

  const handleClose = () => {
    if (dirty && title.trim() && !window.confirm('저장하지 않은 내용이 있어요. 닫을까요?')) return;
    onClose();
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        status,
        assignee1,
        assignee2,
        dueDate: /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : null,
        body,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal onClose={handleClose}>
      <div className="modal-backdrop" onClick={handleClose} />
      <div className="modal modal-lg plan-editor">
        <form onSubmit={handleSave}>
          <div className="modal-header">
            <input
              className="plan-editor-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목 (예: 2. 인허가 및 행정, 11.07_구리남양주 회의록)"
              aria-label="제목"
              required
              autoFocus={isNew}
            />
            <button type="button" className="modal-close" onClick={handleClose}>✕</button>
          </div>

          <div className="modal-body">
            <dl className="plan-props">
              <div>
                <dt>상태</dt>
                <dd>
                  <div className="plan-status-toggle" role="radiogroup" aria-label="상태">
                    {PLAN_COLUMNS.map(c => (
                      <button key={c.id} type="button" role="radio" aria-checked={status === c.id}
                        className={`btn btn-sm ${status === c.id ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setStatus(c.id)}>{c.label}</button>
                    ))}
                  </div>
                </dd>
              </div>
              <div>
                <dt>담당자1</dt>
                <dd><PeoplePicker names={people} value={assignee1} onChange={setAssignee1} /></dd>
              </div>
              <div>
                <dt>담당자2</dt>
                <dd><PeoplePicker names={people} value={assignee2} onChange={setAssignee2} /></dd>
              </div>
              <div>
                <dt>종료일</dt>
                <dd style={{ maxWidth: 260 }}><DateInput id="plan-due" value={dueDate} onChange={setDueDate} /></dd>
              </div>
              {!isNew && (plan.notionPageId || plan.notionError) && (
                <div>
                  <dt>노션</dt>
                  <dd><NotionBadge record={plan} onRetry={onRetryNotion} /></dd>
                </div>
              )}
            </dl>

            <div className="plan-body-head">
              <span className="plan-body-label">본문</span>
              <div className="plan-body-tabs" role="tablist">
                <button type="button" role="tab" aria-selected={mode === 'edit'} className={mode === 'edit' ? 'on' : ''} onClick={() => setMode('edit')}>작성</button>
                <button type="button" role="tab" aria-selected={mode === 'view'} className={mode === 'view' ? 'on' : ''} onClick={() => setMode('view')}>미리보기</button>
              </div>
            </div>
            {mode === 'edit' ? (
              <>
                <textarea
                  className="plan-body-input"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={16}
                  placeholder={'# 1. 자동차관리사업 신규 등록\n- 링크 : https://www.guri.go.kr/...\n1. 구비서류\n  - 자동차관리사업 등록 신청서\n  - 사업장 위치도 및 평면도\n2. 수수료\n  - 20,000원'}
                />
                <p className="plan-body-help">{BODY_HELP}</p>
              </>
            ) : (
              <div className="plan-body-view"><MiniDocView text={body} /></div>
            )}
          </div>

          <div className="modal-footer">
            {!isNew && (
              <button
                type="button"
                className="btn btn-ghost plan-delete"
                onClick={() => { if (window.confirm('이 항목을 지울까요? 노션에서도 휴지통으로 옮겨져요.')) onDelete(plan); }}
              >
                삭제
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={handleClose}>닫기</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !title.trim() || !dirty}>
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}
