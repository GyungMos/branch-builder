import { useState } from 'react';
import ModalPortal from '../common/ModalPortal';
import DateInput from '../common/DateInput';
import PeoplePicker from '../common/PeoplePicker';
import NotionBadge from '../common/NotionBadge';
import MiniDocView from '../common/MiniDocView';
import { useAuth } from '../../contexts/AuthContext';
import { toDateInputValue } from '../../utils/formatters';
import { uploadAttachment } from '../../utils/fileUpload';

const isYmd = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');

/**
 * 오픈 준비 스케줄 항목 작성·수정 (노션 '구리OPEN 스케쥴'의 칸과 같음)
 */
export default function OpenTaskForm({ task, defaults = {}, branchId, people, groups, categories, onSave, onDelete, onRetryNotion, onClose }) {
  const { demoMode } = useAuth();
  const isNew = !task?.id;
  const [group, setGroup] = useState(task?.group ?? defaults.group ?? '');
  const [category, setCategory] = useState(task?.category ?? '');
  const [title, setTitle] = useState(task?.title ?? '');
  const [startDate, setStartDate] = useState(toDateInputValue(task?.startDate));
  const [endDate, setEndDate] = useState(toDateInputValue(task?.endDate));
  const [done, setDone] = useState(Boolean(task?.done));
  const [assignee1, setAssignee1] = useState(task?.assignee1 || []);
  const [assignee2, setAssignee2] = useState(task?.assignee2 || []);
  const [memo, setMemo] = useState(task?.memo ?? '');
  const [files, setFiles] = useState(task?.files || []);
  const [body, setBody] = useState(task?.body ?? '');
  const [bodyMode, setBodyMode] = useState(task?.body ? 'view' : 'edit');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleFiles = async (e) => {
    const list = Array.from(e.target.files || []);
    e.target.value = '';
    if (!list.length) return;
    setUploading(true);
    setError('');
    try {
      const uploaded = [];
      for (const f of list) uploaded.push(await uploadAttachment(f, { branchId, folder: 'openTasks', demoMode }));
      setFiles(prev => [...prev, ...uploaded]);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (startDate && !isYmd(startDate)) { setError('완료일자(시작)를 YYYY-MM-DD 형식으로 입력해 주세요.'); return; }
    if (endDate && !isYmd(endDate)) { setError('완료일자(끝)를 YYYY-MM-DD 형식으로 입력해 주세요.'); return; }
    setSaving(true);
    try {
      await onSave({
        group: group.trim(),
        category: category.trim(),
        title: title.trim(),
        startDate: startDate || null,
        endDate: endDate && endDate >= startDate ? endDate : null,
        done,
        assignee1,
        assignee2,
        memo: memo.trim(),
        files,
        body,
        // 본문 속 사진·파일 주소 (노션에서 가져온 항목). 본문에서 지운 것은 뺌
        attachments: Object.fromEntries(Object.entries(task?.attachments || {}).filter(([id]) => body.includes(`(att:${id})`))),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal onClose={onClose}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal modal-lg">
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <h2 className="modal-title">{isNew ? '오픈 준비 항목 추가' : '오픈 준비 항목 수정'}</h2>
            <button type="button" className="modal-close" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="task-title">세부항목 *</label>
              <input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 간판, 공구 구입, 화재보험" required autoFocus={isNew} />
            </div>

            <button
              type="button"
              className="task-done-check"
              aria-pressed={done}
              onClick={() => setDone(v => !v)}
              style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit' }}
            >
              <span className={`round-check ${done ? 'on' : ''}`} aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{done ? '✓' : ''}</span>
              <span>{done ? '완료됨' : '완료로 표시'}</span>
            </button>

            <div className="task-form-grid">
              <div className="form-group">
                <label htmlFor="task-group">그룹</label>
                <input id="task-group" list="task-group-options" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="골라도 되고 새로 써도 돼요" />
                <datalist id="task-group-options">{groups.map(g => <option key={g} value={g} />)}</datalist>
              </div>
              <div className="form-group">
                <label htmlFor="task-category">구분</label>
                <input id="task-category" list="task-category-options" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="예: 본부, 현장, 사무실" />
                <datalist id="task-category-options">{categories.map(c => <option key={c} value={c} />)}</datalist>
              </div>
              <div className="form-group">
                <label htmlFor="task-start">완료일자 (시작)</label>
                <DateInput id="task-start" value={startDate} onChange={setStartDate} />
              </div>
              <div className="form-group">
                <label htmlFor="task-end">완료일자 (끝 · 하루면 비워두기)</label>
                <DateInput id="task-end" value={endDate} onChange={setEndDate} />
              </div>
              <div className="form-group">
                <label>담당자1</label>
                <PeoplePicker names={people} value={assignee1} onChange={setAssignee1} />
              </div>
              <div className="form-group">
                <label>담당자2</label>
                <PeoplePicker names={people} value={assignee2} onChange={setAssignee2} />
              </div>
              <div className="form-group full">
                <label htmlFor="task-memo">비고</label>
                <textarea id="task-memo" rows={3} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 견적 3곳 비교 후 결정" />
              </div>
              <div className="form-group full">
                <div className="task-body-head">
                  <label htmlFor="task-body">세부 내용</label>
                  <div className="seg-toggle" role="tablist">
                    <button type="button" role="tab" aria-selected={bodyMode === 'edit'} className={bodyMode === 'edit' ? 'on' : ''} onClick={() => setBodyMode('edit')}>편집</button>
                    <button type="button" role="tab" aria-selected={bodyMode === 'view'} className={bodyMode === 'view' ? 'on' : ''} onClick={() => setBodyMode('view')}>미리보기</button>
                  </div>
                </div>
                {bodyMode === 'edit' ? (
                  <textarea id="task-body" rows={6} value={body} onChange={(e) => setBody(e.target.value)}
                    placeholder={'진행 방법·필요 서류 등을 자세히 적어 두세요.\n- 주체 : 구리시청\n- 필요서류 : 정비업허가신청서, 법인인감'} />
                ) : (
                  <div className="task-body-view"><MiniDocView text={body} attachments={task?.attachments} /></div>
                )}
              </div>
              <div className="form-group full">
                <label>파일과 미디어</label>
                {files.length > 0 && (
                  <ul className="task-file-list">
                    {files.map(f => (
                      <li key={f.id || f.url}>
                        <a href={f.url} target="_blank" rel="noreferrer">📎 {f.name}</a>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFiles(prev => prev.filter(x => x !== f))}>빼기</button>
                      </li>
                    ))}
                  </ul>
                )}
                <label className="btn btn-secondary btn-sm task-file-btn">
                  {uploading ? '올리는 중…' : '+ 파일 올리기'}
                  <input type="file" multiple onChange={handleFiles} disabled={uploading} hidden />
                </label>
              </div>
            </div>
            {!isNew && (task.notionPageId || task.notionError) && (
              <p><NotionBadge record={task} onRetry={onRetryNotion} /></p>
            )}
            {error && <p className="task-form-error">{error}</p>}
          </div>
          <div className="modal-footer">
            {!isNew && (
              <button type="button" className="btn btn-ghost plan-delete"
                onClick={() => { if (window.confirm('이 항목을 지울까요? 노션에서도 휴지통으로 옮겨져요.')) onDelete(task); }}>
                삭제
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
            <button type="submit" className="btn btn-primary" disabled={saving || uploading || !title.trim()}>
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}
