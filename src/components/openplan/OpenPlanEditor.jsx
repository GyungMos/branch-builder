import { useLayoutEffect, useRef, useState } from 'react';
import ModalPortal from '../common/ModalPortal';
import DateInput from '../common/DateInput';
import PeoplePicker from '../common/PeoplePicker';
import MiniDocView from '../common/MiniDocView';
import NotionBadge from '../common/NotionBadge';
import { PLAN_COLUMNS } from './OpenPlanBoard';
import { usePeopleContext } from '../../contexts/PeopleContext';
import { useAuth } from '../../contexts/AuthContext';
import { toDateInputValue, generateId } from '../../utils/formatters';
import { DOC_COLORS } from '../../utils/miniDoc';
import { uploadAttachment, uploadDocPhoto } from '../../utils/fileUpload';

// 본문 도구 단추: 지금 줄 앞에 표시를 넣음
const TOOLS = [
  { label: '제목', prefix: '# ', title: '큰 제목' },
  { label: '소제목', prefix: '## ', title: '작은 제목' },
  { label: '• 목록', prefix: '- ', title: '점 목록' },
  { label: '1. 번호', prefix: '1. ', title: '번호 목록' },
  { label: '☐ 할 일', prefix: '[ ] ', title: '체크 목록' },
  { label: '→ 들여쓰기', prefix: '  ', title: '바로 위 목록의 하위 항목' },
];

// 본문 글자 수 한도 (사진을 본문에 바로 넣을 때 저장 한도 1MB를 넘지 않게)
const BODY_LIMIT = 900000;

const cleanLabel = (s) => String(s).replace(/[[\]]/g, '');

// 작성 칸에서 색을 보여줄 표시들: 색 {{..:..}} · 링크 [..](..) · 사진 ![..](..)
const MARK_RE = /\{\{([a-z,-]+):([^\n]*?)\}\}|!?\[[^\]\n]*\]\([^\s)]+\)/g;

function colorClasses(spec) {
  return spec.split(',').map(s => (s.startsWith('bg-') ? s : `tc-${s}`)).join(' ');
}

/** 작성 칸 뒤에 깔리는 색 입힌 글자 (글자 폭이 바뀌지 않게 색만 바꿈) */
function HighlightedBody({ text }) {
  const out = [];
  let last = 0;
  let key = 0;
  text.replace(MARK_RE, (whole, spec, inner, offset) => {
    if (offset > last) out.push(text.slice(last, offset));
    if (spec !== undefined) {
      out.push(<span key={key++} className="mark-sign">{`{{${spec}:`}</span>);
      out.push(<span key={key++} className={colorClasses(spec)}>{inner}</span>);
      out.push(<span key={key++} className="mark-sign">{'}}'}</span>);
    } else {
      out.push(<span key={key++} className="mark-link">{whole}</span>);
    }
    last = offset + whole.length;
    return whole;
  });
  out.push(text.slice(last));
  // 마지막 줄이 비어 있어도 높이가 맞도록
  out.push('​');
  return out;
}

/** 글씨색·배경색 고르기 */
function ColorMenu({ kind, onPick }) {
  return (
    <div className="doc-menu doc-color-menu" role="menu" aria-label={kind === 'bg' ? '배경색' : '글씨색'}>
      {DOC_COLORS.map(c => (
        <button
          key={c.id}
          type="button"
          role="menuitem"
          className="doc-color-item"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(kind === 'bg' ? `bg-${c.id}` : c.id)}
        >
          <span className={`doc-swatch ${kind === 'bg' ? `bg-${c.id}` : `tc-${c.id}`}`}>가</span>
          {c.label}
        </button>
      ))}
    </div>
  );
}

/** 링크 넣기 */
function LinkMenu({ initialLabel, onInsert, onCancel }) {
  const [label, setLabel] = useState(initialLabel);
  const [url, setUrl] = useState('');
  const u = url.trim();
  const ok = /^https?:\/\/\S+$/.test(u) || /^www\.\S+$/.test(u);
  const submit = () => {
    if (ok) onInsert(label.trim(), u.startsWith('www.') ? `https://${u}` : u);
  };
  return (
    <div className="doc-menu doc-link-menu" role="dialog" aria-label="링크 넣기">
      <label>
        보일 이름
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="예: 구리시청 안내 페이지" />
      </label>
      <label>
        주소
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          inputMode="url"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
        />
      </label>
      <div className="doc-link-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>취소</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={!ok} onClick={submit}>넣기</button>
      </div>
    </div>
  );
}

/**
 * 오픈 계획 카드 세부 페이지 (노션 카드 안쪽과 같은 구성: 상태 · 담당자1·2 · 종료일 · 본문)
 */
export default function OpenPlanEditor({ plan, defaultStatus = 'todo', branchId, people, onSave, onDelete, onRetryNotion, onClose }) {
  const isNew = !plan?.id;
  const { demoMode } = useAuth();
  const { statusColor } = usePeopleContext();
  const [title, setTitle] = useState(plan?.title || '');
  const [status, setStatus] = useState(plan?.status || defaultStatus);
  const [assignee1, setAssignee1] = useState(plan?.assignee1 || []);
  const [assignee2, setAssignee2] = useState(plan?.assignee2 || []);
  const [dueDate, setDueDate] = useState(toDateInputValue(plan?.dueDate));
  const [body, setBody] = useState(plan?.body || '');
  // 사진·파일 주소는 본문 밖에 따로 두고, 본문에는 (att:번호)만 적음 (긴 주소가 본문에 보이지 않게)
  const [attachments, setAttachments] = useState(plan?.attachments || {});
  const [mode, setMode] = useState(isNew || !plan?.body ? 'edit' : 'view');
  const [saving, setSaving] = useState(false);
  const [menu, setMenu] = useState(null); // color | bg | link
  const [uploading, setUploading] = useState('');
  const [error, setError] = useState('');
  const bodyRef = useRef(null);
  const selRef = useRef({ start: 0, end: 0 });
  const photoRef = useRef(null);
  const fileRef = useRef(null);

  // 작성 칸이 글 길이에 맞춰 늘어나게 (뒤에 깔린 색 글자와 줄이 어긋나지 않도록 칸 안 스크롤 없앰)
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el || mode !== 'edit') return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [body, mode]);

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

  // 도구를 누르기 전 본문에서 고른 위치를 기억
  const rememberSelection = () => {
    const el = bodyRef.current;
    if (el) selRef.current = { start: el.selectionStart, end: el.selectionEnd };
  };

  const focusAt = (start, end = start) => {
    requestAnimationFrame(() => {
      const el = bodyRef.current;
      if (!el) return;
      el.focus();
      el.selectionStart = start;
      el.selectionEnd = end;
    });
  };

  // 고른 글자를 색 표시로 감쌈 (고른 글자가 없으면 '글자'를 넣고 골라 둠)
  const wrapColor = (spec) => {
    setMenu(null);
    const { start, end } = selRef.current;
    const picked = body.slice(start, end) || '글자';
    const open = `{{${spec}:`;
    setBody(body.slice(0, start) + open + picked + '}}' + body.slice(end));
    focusAt(start + open.length, start + open.length + picked.length);
  };

  // 지금 위치에 글자 넣기 (block이면 따로 한 줄로)
  const insertText = (text, block = false) => {
    const { start, end } = selRef.current;
    const before = body.slice(0, start);
    const after = body.slice(end);
    const pre = block && before && !before.endsWith('\n') ? '\n' : '';
    const post = block && !after.startsWith('\n') ? '\n' : '';
    const head = before + pre + text + post;
    setBody(head + after);
    selRef.current = { start: head.length, end: head.length };
    focusAt(head.length);
  };

  const openMenu = (name) => {
    rememberSelection();
    setMenu(m => (m === name ? null : name));
  };

  const handleUpload = async (e, kind) => {
    const list = Array.from(e.target.files || []);
    e.target.value = '';
    if (!list.length) return;
    setError('');
    setUploading(kind === 'photo' ? '사진 넣는 중…' : '파일 올리는 중…');
    try {
      const lines = [];
      const added = {};
      for (const f of list) {
        const id = generateId();
        if (kind === 'photo') {
          const name = cleanLabel(f.name.replace(/\.[^.]+$/, ''));
          added[id] = { url: await uploadDocPhoto(f, { branchId, demoMode }), name };
          lines.push(`![${name}](att:${id})`);
        } else {
          const up = await uploadAttachment(f, { branchId, folder: 'openPlans', demoMode });
          added[id] = { url: up.url, name: up.name, storagePath: up.storagePath };
          lines.push(`📎 [${cleanLabel(up.name)}](att:${id})`);
        }
      }
      setAttachments(prev => ({ ...prev, ...added }));
      insertText(lines.join('\n'), true);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading('');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    // 본문에서 지운 사진·파일은 같이 뺌
    const used = Object.fromEntries(Object.entries(attachments).filter(([id]) => body.includes(`(att:${id})`)));
    if (body.length + JSON.stringify(used).length > BODY_LIMIT) {
      setError('내용이 너무 커요 (본문에 바로 넣은 사진이 많아요). 사진 몇 장을 빼고 저장해 주세요.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        status,
        assignee1,
        assignee2,
        dueDate: /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : null,
        body,
        attachments: used,
      });
    } finally {
      setSaving(false);
    }
  };

  // 도구 단추를 눌러도 본문에서 고른 글자가 풀리지 않게
  const keepSelection = (e) => e.preventDefault();

  return (
    <ModalPortal onClose={handleClose}>
      <div className="modal-backdrop" onClick={handleClose} />
      <div className="modal modal-lg plan-editor">
        <form onSubmit={handleSave}>
          <div className="plan-editor-top">
            <span className="plan-editor-kicker">{isNew ? '새 오픈 계획' : '오픈 계획 편집'}</span>
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
                  <span className="plan-tools-sep" aria-hidden="true" />
                  <button type="button" title="고른 글자의 색" className={menu === 'color' ? 'on' : ''}
                    onMouseDown={keepSelection} onClick={() => openMenu('color')}>
                    <span className="tool-a tool-a-color">가</span> 글씨색 ▾
                  </button>
                  <button type="button" title="고른 글자의 배경색" className={menu === 'bg' ? 'on' : ''}
                    onMouseDown={keepSelection} onClick={() => openMenu('bg')}>
                    <span className="tool-a tool-a-bg">가</span> 배경색 ▾
                  </button>
                  <button type="button" title="링크 넣기" className={menu === 'link' ? 'on' : ''}
                    onMouseDown={keepSelection} onClick={() => openMenu('link')}>
                    🔗 링크
                  </button>
                  <button type="button" title="사진 넣기" disabled={Boolean(uploading)}
                    onMouseDown={keepSelection} onClick={() => { rememberSelection(); setMenu(null); photoRef.current?.click(); }}>
                    🖼 사진
                  </button>
                  <button type="button" title="파일 넣기" disabled={Boolean(uploading)}
                    onMouseDown={keepSelection} onClick={() => { rememberSelection(); setMenu(null); fileRef.current?.click(); }}>
                    📎 파일
                  </button>
                  <input ref={photoRef} type="file" accept="image/*" multiple hidden onChange={(e) => handleUpload(e, 'photo')} />
                  <input ref={fileRef} type="file" multiple hidden onChange={(e) => handleUpload(e, 'file')} />

                  {(menu === 'color' || menu === 'bg') && <ColorMenu kind={menu} onPick={wrapColor} />}
                  {menu === 'link' && (
                    <LinkMenu
                      initialLabel={body.slice(selRef.current.start, selRef.current.end)}
                      onCancel={() => setMenu(null)}
                      onInsert={(label, url) => {
                        setMenu(null);
                        insertText(label ? `[${cleanLabel(label)}](${url})` : url);
                      }}
                    />
                  )}
                </div>
              ) : <span className="plan-body-label">본문</span>}
              <div className="seg-toggle" role="tablist">
                <button type="button" role="tab" aria-selected={mode === 'edit'} className={mode === 'edit' ? 'on' : ''} onClick={() => setMode('edit')}>{isNew ? '작성' : '편집'}</button>
                <button type="button" role="tab" aria-selected={mode === 'view'} className={mode === 'view' ? 'on' : ''} onClick={() => { setMode('view'); setMenu(null); }}>미리보기</button>
              </div>
            </div>

            {mode === 'edit' ? (
              <div className="plan-body-editor">
                {/* 글자 뒤에 같은 내용을 색까지 입혀 깔아서, 작성 중에도 글씨색·배경색이 보이게 함 */}
                <div className="plan-body-input plan-body-mirror minidoc" aria-hidden="true">
                  <HighlightedBody text={body} />
                </div>
                <textarea
                  ref={bodyRef}
                  className="plan-body-input plan-body-typing"
                  spellCheck={false}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onSelect={rememberSelection}
                  onBlur={rememberSelection}
                  rows={14}
                  placeholder={'내용을 자유롭게 적어 주세요.\n\n# 1. 자동차관리사업 신규 등록\n- 링크 : https://www.guri.go.kr/...\n1. 구비서류\n  - 자동차관리사업 등록 신청서\n  - 사업장 위치도 및 평면도'}
                />
              </div>
            ) : (
              <div className="plan-body-view"><MiniDocView text={body} attachments={attachments} /></div>
            )}
            {mode === 'edit' && (
              <p className="plan-body-tip">
                {uploading || '글자를 고른 뒤 글씨색·배경색을 누르면 색이 들어가요. 실제 모양은 미리보기에서 볼 수 있어요.'}
              </p>
            )}
            {error && <p className="plan-body-error" role="alert">{error}</p>}
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
            <button type="submit" className="btn btn-primary" disabled={saving || Boolean(uploading) || !title.trim() || !dirty}>
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}
