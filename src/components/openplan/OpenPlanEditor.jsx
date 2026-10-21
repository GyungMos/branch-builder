import { useRef, useState } from 'react';
import ModalPortal from '../common/ModalPortal';
import DateInput from '../common/DateInput';
import PeoplePicker from '../common/PeoplePicker';
import MiniDocView from '../common/MiniDocView';
import NotionBadge from '../common/NotionBadge';
import { PLAN_COLUMNS } from './OpenPlanBoard';
import { usePeopleContext } from '../../contexts/PeopleContext';
import { toDateInputValue } from '../../utils/formatters';

// 본문 도구 단추: 지금 줄 앞에 표시를 넣음
const TOOLS = [
  { label: '제목', prefix: '# ', title: '큰 제목' },
  { label: '소제목', prefix: '## ', title: '작은 제목' },
  { label: '• 목록', prefix: '- ', title: '점 목록' },
  { label: '1. 번호', prefix: '1. ', title: '번호 목록' },
  { label: '☐ 할 일', prefix: '[ ] ', title: '체크 목록' },
  { label: '→ 들여쓰기', prefix: '  ', title: '바로 위 목록의 하위 항목' },
];

/**
 * 오픈 계획 카드 세부 페이지 (노션 카드 안쪽과 같은 구성: 상태 · 담당자1·2 · 종료일 · 본문)
 */
export default function OpenPlanEditor({ plan, defaultStatus = 'todo', people, onSave, onDelete, onRetryNotion, onClose }) {
  const isNew = !plan?.id;
  const { statusColor } = usePeopleContext();
  const [title, setTitle] = useState(plan?.title || '');
  const [status, setStatus] = useState(plan?.status || defaultStatus);
  const [assignee1, setAssignee1] = useState(plan?.assignee1 || []);
  const [assignee2, setAssignee2] = useState(plan?.assignee2 || []);
  const [dueDate, setDueDate] = useState(toDateInputValue(plan?.dueDate));
  const [body, setBody] = useState(plan?.body || '');
  const [mode, setMode] = useState(isNew || !plan?.body ? 'edit' : 'view');
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef(null);

  const dirty = isNew
    || title !== (plan.title || '') || status !== (plan.status || 'todo') || body !== (plan.body || '')
    || dueDate !== toDateInputValue(plan.dueDate)
    || JSON.stringify(assignee1) !== JSON.stringify(plan.assignee1 || [])
    || JSON.stringify(assignee2) !== JSON.stringify(plan.assignee2 || []);

  const handleClose = () => {
    if (dirty && title.trim() && !window.confirm('저장하지 않은 내용이 있어요. 닫을까요?')) return;
    onClose();
  };

  const insertPrefix = (prefix) => {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const lineStart = body.lastIndexOf('\n', start - 1) + 1;
    const next = body.slice(0, lineStart) + prefix + body.slice(lineStart);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + prefix.length;
    });
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
          <div className="plan-editor-top">
            <span className="plan-editor-kicker">{isNew ? '새 오픈 계획' : '오픈 계획'}</span>
            <button type="button" className="modal-close" onClick={handleClose} aria-label="닫기">✕</button>
          </div>

          <div className="modal-body plan-editor-body">
            <input
              className="plan-editor-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목 없음"
              aria-label="제목"
              required
              autoFocus={isNew}
            />
            {!title && <p className="plan-editor-hint">예: 2. 인허가 및 행정 · 11.07_구리남양주 회의록</p>}

            <div className="plan-props">
              <div className="plan-prop">
                <span className="plan-prop-label"><span className="plan-prop-icon">◐</span>상태</span>
                <div className="plan-status-group" role="radiogroup" aria-label="상태">
                  {PLAN_COLUMNS.map(c => (
                    <button key={c.id} type="button" role="radio" aria-checked={status === c.id}
                      className={`status-pill ${status === c.id ? 'selected' : 'muted'}`}
                      style={{ '--st': statusColor(c.id) }}
                      onClick={() => setStatus(c.id)}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="plan-prop">
                <span className="plan-prop-label"><span className="plan-prop-icon">👤</span>담당자1</span>
                <PeoplePicker names={people} value={assignee1} onChange={setAssignee1} />
              </div>
              <div className="plan-prop">
                <span className="plan-prop-label"><span className="plan-prop-icon">👥</span>담당자2</span>
                <PeoplePicker names={people} value={assignee2} onChange={setAssignee2} />
              </div>
              <div className="plan-prop">
                <span className="plan-prop-label"><span className="plan-prop-icon">📅</span>종료일</span>
                <div className="plan-prop-date"><DateInput id="plan-due" value={dueDate} onChange={setDueDate} placeholder="날짜 없음" /></div>
              </div>
              {!isNew && (plan.notionPageId || plan.notionError) && (
                <div className="plan-prop">
                  <span className="plan-prop-label"><span className="plan-prop-icon">N</span>노션</span>
                  <NotionBadge record={plan} onRetry={onRetryNotion} />
                </div>
              )}
            </div>

            <div className="plan-body-head">
              {mode === 'edit' ? (
                <div className="plan-tools" role="toolbar" aria-label="본문 도구">
                  {TOOLS.map(t => (
                    <button key={t.label} type="button" title={t.title} onClick={() => insertPrefix(t.prefix)}>{t.label}</button>
                  ))}
                </div>
              ) : <span className="plan-body-label">본문</span>}
              <div className="seg-toggle" role="tablist">
                <button type="button" role="tab" aria-selected={mode === 'edit'} className={mode === 'edit' ? 'on' : ''} onClick={() => setMode('edit')}>작성</button>
                <button type="button" role="tab" aria-selected={mode === 'view'} className={mode === 'view' ? 'on' : ''} onClick={() => setMode('view')}>미리보기</button>
              </div>
            </div>

            {mode === 'edit' ? (
              <textarea
                ref={bodyRef}
                className="plan-body-input"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={14}
                placeholder={'내용을 자유롭게 적어 주세요.\n\n# 1. 자동차관리사업 신규 등록\n- 링크 : https://www.guri.go.kr/...\n1. 구비서류\n  - 자동차관리사업 등록 신청서\n  - 사업장 위치도 및 평면도'}
              />
            ) : (
              <div className="plan-body-view"><MiniDocView text={body} /></div>
            )}
          </div>

          <div className="modal-footer plan-editor-foot">
            {!isNew && (
              <button
                type="button"
                className="btn btn-ghost plan-delete"
                onClick={() => { if (window.confirm('이 항목을 지울까요? 노션에서도 휴지통으로 옮겨져요.')) onDelete(plan); }}
              >
                삭제
              </button>
            )}
            {dirty && !isNew && <span className="plan-dirty">변경 사항 있음</span>}
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
