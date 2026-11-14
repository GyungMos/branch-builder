import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSubcollection } from '../hooks/useSubcollection';
import { useBranches } from '../hooks/useFirestore';
import { useAuth } from '../contexts/AuthContext';
import { useCanDelete } from '../hooks/useSettings';
import MiniDocView from '../components/common/MiniDocView';
import RichDocEditor from '../components/common/RichDocEditor';
import { uploadDocPhoto } from '../utils/fileUpload';
import { generateId } from '../utils/formatters';
import { SITE_REPORTS, REPORT_CATEGORIES, categoryLabel } from '../data/siteReports';
import LiveReport from '../components/reports/LiveReport';
import './ReportsPage.css';

/**
 * 보고서함: 사이트 점검·지점 보고·회의 기록을 모아 두고 보고서 모양으로 보기·인쇄
 * - 직원이 쓴 보고서: branches/_shared/reports (모든 지점이 같이 봄, 지우기는 관리자만)
 * - 사이트 개발 기록: data/siteReports.js (읽기만)
 */

const BODY_LIMIT = 900 * 1024;
const today = () => new Date().toISOString().slice(0, 10);

function toDateText(r) {
  if (r.date) return r.date;
  const t = r.createdAt?.toDate ? r.createdAt.toDate() : r.createdAt ? new Date(r.createdAt) : null;
  return t && !Number.isNaN(t.getTime()) ? t.toISOString().slice(0, 10) : '';
}

/** 본문 첫 줄들로 짧은 소개 만들기 */
function summaryOf(r) {
  if (r.summary) return r.summary;
  const text = String(r.body || '')
    .split('\n')
    .map(l => l.replace(/^#+\s*|^[-*•]\s*|^\d+[.)]\s*|^\[[ xX]\]\s*/, '').replace(/\{\{[^:}]+:([^}]*)\}\}/g, '$1').replace(/!\[[^\]]*\]\([^)]*\)/g, '').trim())
    .filter(Boolean)
    .join(' ');
  return text.length > 90 ? `${text.slice(0, 90)}…` : text;
}

export default function ReportsPage() {
  const { demoMode } = useAuth();
  const canDelete = useCanDelete();
  const { branches } = useBranches();
  const { items, loading, add, update, remove } = useSubcollection('_shared', 'reports');
  const [params, setParams] = useSearchParams();
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null); // null | { ...보고서 } (id 없으면 새로 쓰기)

  const all = useMemo(() => [...SITE_REPORTS, ...items]
    .map(r => ({ ...r, dateText: toDateText(r) }))
    .sort((a, b) => b.dateText.localeCompare(a.dateText)), [items]);

  const list = all.filter(r => (cat === 'all' || r.category === cat)
    && (!q.trim() || `${r.title} ${r.body || ''} ${r.author || r.createdBy || ''}`.includes(q.trim())));

  const openId = params.get('id');
  // 'all' 또는 지점 id → 자동 종합 보고서. PC에서 아무것도 안 골랐으면 전체 지점 종합을 바로 보여줌
  const wide = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 901px)').matches;
  const live = params.get('live') || (!openId && !editing && wide && branches.length ? 'all' : null);
  const current = live ? null : all.find(r => r.id === openId) || null;
  const open = (id) => { setEditing(null); setParams(id ? { id } : {}); };
  const openLive = (id) => { setEditing(null); setParams({ live: id }); };

  // 자동 종합 보고서를 지금 내용 그대로 보고서함에 남기기
  const snapshot = async ({ title, body, branchId, category }) => {
    const created = await add({ title, body, branchId: branchId || null, category, date: today(), author: '', attachments: {}, auto: true });
    open(created.id);
  };

  const branchName = (id) => branches.find(b => b.id === id)?.name || '';

  const save = async (data) => {
    if (editing?.id && !editing.builtIn) {
      await update(editing.id, data);
      setEditing(null);
      open(editing.id);
    } else {
      const created = await add(data);
      setEditing(null);
      open(created.id);
    }
  };

  const del = async (r) => {
    if (!canDelete) { alert('보고서 지우기는 관리자만 할 수 있어요.'); return; }
    if (!window.confirm(`'${r.title}' 보고서를 지울까요? 휴지통에서 되살릴 수 있어요.`)) return;
    await remove(r.id);
    open(null);
  };

  return (
    <div className="page reports-page">
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">보고서함</h1>
          <p className="text-secondary">사이트 점검, 지점 보고, 회의 내용을 보고서로 모아 두고 언제든 다시 보거나 인쇄해요.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => { setParams({}); setEditing({ category: 'branch', date: today(), title: '', body: '' }); }}>+ 새 보고서</button>
      </div>

      <div className={`rp-layout${current || editing || live ? ' rp-has-detail' : ''}`}>
        <aside className="rp-list no-print">
          <div className="rp-live">
            <div className="rp-live-head">
              <strong>자동 종합 보고서</strong>
              <small>일정·비용·할 일·일지·하자를 지금 내용 그대로 한 장에</small>
            </div>
            <button type="button" className={`rp-live-btn rp-live-all${live === 'all' ? ' on' : ''}`} onClick={() => openLive('all')}>
              <span>전체 지점 종합</span><em>{branches.length}곳</em>
            </button>
            <div className="rp-live-branches">
              {branches.map(b => (
                <button key={b.id} type="button" className={`rp-live-btn${live === b.id ? ' on' : ''}`} onClick={() => openLive(b.id)}>{b.name}</button>
              ))}
            </div>
          </div>
          <div className="rp-saved-head">남겨 둔 보고서</div>
          <input className="rp-search" type="search" placeholder="보고서 찾기" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="rp-cats">
            <button type="button" className={`filter-pill${cat === 'all' ? ' on' : ''}`} onClick={() => setCat('all')}>전체 {all.length}</button>
            {REPORT_CATEGORIES.map(c => {
              const n = all.filter(r => r.category === c.id).length;
              return n ? <button key={c.id} type="button" className={`filter-pill${cat === c.id ? ' on' : ''}`} onClick={() => setCat(c.id)}>{c.label} {n}</button> : null;
            })}
          </div>
          {loading && <p className="text-secondary">불러오는 중…</p>}
          {!loading && !list.length && <p className="text-secondary">{q ? '찾는 보고서가 없어요.' : '아직 보고서가 없어요.'}</p>}
          <ul className="rp-cards">
            {list.map(r => (
              <li key={r.id}>
                <button type="button" className={`rp-card${current?.id === r.id ? ' on' : ''}`} onClick={() => open(r.id)}>
                  <span className="rp-card-top">
                    <span className={`rp-cat rp-cat-${r.category || 'etc'}`}>{categoryLabel(r.category)}</span>
                    <span className="rp-date">{r.dateText}</span>
                  </span>
                  <strong>{r.title || '제목 없음'}</strong>
                  <small>{summaryOf(r)}</small>
                  <span className="rp-meta">{r.builtIn ? '사이트 개발 기록' : (r.author || r.createdBy || '')}{r.branchId ? ` · ${branchName(r.branchId)}` : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="rp-detail">
          {editing ? (
            <ReportEditor
              key={editing.id || 'new'}
              report={editing}
              branches={branches}
              demoMode={demoMode}
              onCancel={() => setEditing(null)}
              onSave={save}
            />
          ) : live ? (
            <>
              <button type="button" className="btn btn-ghost btn-sm rp-back rp-live-back no-print" onClick={() => open(null)}>← 목록</button>
              <LiveReport
                key={live}
                branchId={live}
                branches={branches}
                demoMode={demoMode}
                onOpenBranch={(id) => openLive(id)}
                onSnapshot={snapshot}
              />
            </>
          ) : current ? (
            <ReportView
              report={current}
              branchName={branchName(current.branchId)}
              canDelete={canDelete}
              onBack={() => open(null)}
              onEdit={() => setEditing(current)}
              onCopy={() => setEditing({ ...current, id: undefined, builtIn: false, title: `${current.title} (복사)`, date: today() })}
              onDelete={() => del(current)}
            />
          ) : (
            <div className="rp-empty no-print">
              <strong>왼쪽에서 보고서를 고르세요.</strong>
              <span>'자동 종합 보고서'는 업무 흐름·비용·할 일을 지금 내용 그대로 한 장에 모아 보여줘요.</span>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => openLive('all')}>전체 지점 종합 보고서 보기</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ReportView({ report: r, branchName, canDelete, onBack, onEdit, onCopy, onDelete }) {
  return (
    <article className="rp-paper">
      <div className="rp-actions no-print">
        <button type="button" className="btn btn-ghost btn-sm rp-back" onClick={onBack}>← 목록</button>
        <span className="rp-actions-gap" />
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>인쇄·PDF 저장</button>
        {r.builtIn
          ? <button type="button" className="btn btn-secondary btn-sm" onClick={onCopy}>복사해서 고쳐 쓰기</button>
          : <button type="button" className="btn btn-secondary btn-sm" onClick={onEdit}>고치기</button>}
        {!r.builtIn && canDelete && <button type="button" className="btn btn-ghost btn-sm rp-danger" onClick={onDelete}>지우기</button>}
      </div>
      <header className="rp-head">
        <span className={`rp-cat rp-cat-${r.category || 'etc'}`}>{categoryLabel(r.category)}</span>
        <h2>{r.title || '제목 없음'}</h2>
        <dl className="rp-info">
          <div><dt>날짜</dt><dd>{r.dateText || '-'}</dd></div>
          <div><dt>작성</dt><dd>{r.builtIn ? r.author : (r.author || r.createdBy || '-')}</dd></div>
          {branchName && <div><dt>지점</dt><dd>{branchName}</dd></div>}
        </dl>
        {r.summary && <p className="rp-summary">{r.summary}</p>}
      </header>
      <div className="rp-body">
        <MiniDocView text={r.body || ''} attachments={r.attachments || {}} />
      </div>
      <footer className="rp-foot">Branch Builder 보고서함 · {r.dateText}</footer>
    </article>
  );
}

function ReportEditor({ report, branches, demoMode, onCancel, onSave }) {
  const [title, setTitle] = useState(report.title || '');
  const [category, setCategory] = useState(report.category || 'branch');
  const [date, setDate] = useState(report.date || today());
  const [branchId, setBranchId] = useState(report.branchId || '');
  const [author, setAuthor] = useState(report.author || '');
  const [body, setBody] = useState(report.body || '');
  const [attachments, setAttachments] = useState(report.attachments || {});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const editorRef = useRef(null);
  const photoRef = useRef(null);

  const addPhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setBusy('사진 넣는 중…'); setError('');
    try {
      const added = {};
      for (const f of files) {
        const id = generateId();
        const name = f.name.replace(/\.[^.]+$/, '').replace(/[[\]()]/g, ' ').trim() || '사진';
        const url = await uploadDocPhoto(f, { branchId: branchId || '_shared', demoMode });
        added[id] = { url, name };
        editorRef.current?.image(id, url, name);
      }
      setAttachments(prev => ({ ...prev, ...added }));
    } catch (err) {
      setError(err.message || '사진을 넣지 못했어요.');
    } finally {
      setBusy('');
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { setError('제목을 적어 주세요.'); return; }
    const used = Object.fromEntries(Object.entries(attachments).filter(([id]) => body.includes(`(att:${id})`)));
    if (body.length + JSON.stringify(used).length > BODY_LIMIT) { setError('내용이 너무 커요. 본문 사진 몇 장을 빼고 저장해 주세요.'); return; }
    setBusy('저장하는 중…');
    try {
      await onSave({ title: title.trim(), category, date, branchId: branchId || null, author: author.trim(), body, attachments: used });
    } catch (err) {
      setError(err.message || '저장하지 못했어요.');
      setBusy('');
    }
  };

  return (
    <form className="rp-paper rp-editor" onSubmit={submit}>
      <div className="rp-actions">
        <strong>{report.id ? '보고서 고치기' : '새 보고서'}</strong>
        <span className="rp-actions-gap" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>닫기</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={Boolean(busy)}>{busy === '저장하는 중…' ? busy : '저장'}</button>
      </div>
      <label className="rp-field rp-title-field">
        <span>제목</span>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 구리점 착공 전 현장 점검 보고" autoFocus />
      </label>
      <div className="rp-row">
        <label className="rp-field">
          <span>분류</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {REPORT_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label className="rp-field">
          <span>날짜</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="rp-field">
          <span>지점 (있으면)</span>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">지점 없음</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label className="rp-field">
          <span>작성자</span>
          <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="비우면 로그인한 이름" />
        </label>
      </div>
      <div className="rp-field">
        <span>내용</span>
        <div className="rp-tools">
          <button type="button" className="btn btn-secondary btn-sm" onMouseDown={(e) => e.preventDefault()} onClick={() => { editorRef.current?.saveRange(); photoRef.current?.click(); }} disabled={Boolean(busy)}>사진 넣기</button>
          <small>줄 맨 앞에 # 를 치고 띄어쓰면 제목, - 를 치면 목록, [ ] 를 치면 할 일 칸이 돼요.</small>
        </div>
        <input ref={photoRef} type="file" accept="image/*" multiple hidden onChange={addPhotos} />
        <RichDocEditor ref={editorRef} initialValue={report.body || ''} attachments={report.attachments || {}} onChange={setBody}
          placeholder={'보고할 내용을 적어 주세요.\n예) # 현장 상황  →  - 바닥 타설 끝남  →  [ ] 다음 주 전기 점검'} />
      </div>
      {busy && busy !== '저장하는 중…' && <p className="text-secondary">{busy}</p>}
      {error && <p className="rp-error" role="alert">{error}</p>}
    </form>
  );
}
