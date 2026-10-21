import { useMemo, useState } from 'react';
import Timeline from '../schedule/Timeline';
import { PeopleTags } from '../common/PeoplePicker';
import NotionBadge from '../common/NotionBadge';
import { formatDateShort } from '../../utils/formatters';
import { OPEN_TASK_GROUPS } from '../../utils/constants';
import { PEOPLE_PALETTE } from '../../contexts/PeopleContext';
import './OpenTask.css';

const toDate = (v) => {
  if (!v) return null;
  const d = v.toDate ? v.toDate() : new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

function dateText(t) {
  const s = toDate(t.startDate);
  const e = toDate(t.endDate);
  if (!s) return '';
  return e && e.getTime() !== s.getTime() ? `${formatDateShort(s)} → ${formatDateShort(e)}` : formatDateShort(s);
}

/** 구분 태그 색 (구분 이름마다 고정) */
export function categoryColor(name = '') {
  let h = 7;
  for (let i = 0; i < name.length; i++) h = (h * 33 + name.charCodeAt(i)) | 0;
  return PEOPLE_PALETTE[Math.abs(h) % PEOPLE_PALETTE.length];
}

function Progress({ done, total }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <span className="task-progress-bar" aria-label={`완료 ${done}/${total}`}>
      <span className="task-progress-fill" style={{ width: `${pct}%` }} />
    </span>
  );
}

/**
 * 오픈 준비 스케줄 (노션 '구리OPEN 스케쥴'): 그룹별 목록 + 타임라인 보기
 */
export default function OpenTaskTable({ tasks, onAdd, onEdit, onToggleDone, onDelete, onImport, onRetryNotion }) {
  const [view, setView] = useState('table');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter(t => {
      if (onlyOpen && t.done) return false;
      if (!q) return true;
      return [t.title, t.group, t.category, t.memo, ...(t.assignee1 || []), ...(t.assignee2 || [])]
        .some(v => String(v || '').toLowerCase().includes(q));
    });
  }, [tasks, onlyOpen, query]);

  // 그룹 순서: 기본 그룹 순서 → 그 밖의 그룹은 처음 나온 순서
  const groups = useMemo(() => {
    const names = [];
    [...OPEN_TASK_GROUPS, ...tasks.map(t => t.group || '그룹 없음')].forEach(g => {
      if (!names.includes(g)) names.push(g);
    });
    return names
      .map(name => ({
        name,
        items: filtered.filter(t => (t.group || '그룹 없음') === name),
        all: tasks.filter(t => (t.group || '그룹 없음') === name),
      }))
      .filter(g => g.items.length > 0);
  }, [tasks, filtered]);

  const doneCount = tasks.filter(t => t.done).length;

  // 타임라인용: 날짜가 있는 항목만
  const timelineItems = filtered
    .filter(t => toDate(t.startDate))
    .map(t => ({
      id: t.id,
      title: t.title,
      startDate: t.startDate,
      endDate: t.endDate || t.startDate,
      status: t.done ? 'completed' : 'pending',
      assignee: [...(t.assignee1 || []), ...(t.assignee2 || [])].join(', '),
      memo: t.memo,
    }));
  const noDateCount = filtered.length - timelineItems.length;
  const byId = (item) => tasks.find(t => t.id === item.id);

  return (
    <div className="task-wrap">
      {tasks.length > 0 && (
        <div className="task-summary">
          <div className="task-summary-text">
            <strong>{doneCount}</strong> / {tasks.length} 완료
            <span className="task-summary-pct">{tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0}%</span>
          </div>
          <Progress done={doneCount} total={tasks.length} />
        </div>
      )}

      <div className="task-toolbar">
        <div className="seg-toggle" role="tablist" aria-label="보기 방식">
          <button type="button" role="tab" aria-selected={view === 'table'} className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}>목록</button>
          <button type="button" role="tab" aria-selected={view === 'timeline'} className={view === 'timeline' ? 'on' : ''} onClick={() => setView('timeline')}>타임라인</button>
        </div>
        <div className="task-search-wrap">
          <span className="task-search-icon" aria-hidden="true">⌕</span>
          <input type="search" className="task-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="항목·담당자 찾기" aria-label="찾기" />
        </div>
        <button type="button" className={`filter-pill ${onlyOpen ? 'on' : ''}`} aria-pressed={onlyOpen} onClick={() => setOnlyOpen(v => !v)}>
          미완료만
        </button>
        <span className="task-toolbar-spacer" />
        <button type="button" className="btn btn-secondary btn-sm" onClick={onImport}>다른 지점에서 가져오기</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => onAdd({})}>+ 항목 추가</button>
      </div>

      {tasks.length === 0 ? (
        <div className="task-empty">
          <div className="task-empty-icon" aria-hidden="true">☑</div>
          <p className="task-empty-title">아직 항목이 없어요</p>
          <p className="task-empty-desc">이전 지점에서 쓰던 항목을 <strong>다른 지점에서 가져오기</strong>로 한 번에 불러오면 편해요. 완료 체크·날짜는 비운 채로 들어와요.</p>
          <button type="button" className="btn btn-primary btn-sm" onClick={onImport}>다른 지점에서 가져오기</button>
        </div>
      ) : view === 'timeline' ? (
        <>
          {noDateCount > 0 && <p className="task-note">날짜가 없는 항목 {noDateCount}개는 목록에서 확인하세요.</p>}
          <Timeline
            schedules={timelineItems}
            stages={[]}
            onEdit={(item) => onEdit(byId(item))}
            onDelete={(id) => onDelete(tasks.find(t => t.id === id))}
            onToggleComplete={(item) => onToggleDone(byId(item))}
          />
        </>
      ) : groups.length === 0 ? (
        <p className="task-note">조건에 맞는 항목이 없어요.</p>
      ) : (
        groups.map(g => {
          const gDone = g.all.filter(t => t.done).length;
          return (
            <section key={g.name} className="task-group">
              <header className="task-group-head">
                <h3>{g.name}</h3>
                <span className="task-group-count">{gDone}/{g.all.length}</span>
                <Progress done={gDone} total={g.all.length} />
                <button type="button" className="task-group-add" onClick={() => onAdd({ group: g.name === '그룹 없음' ? '' : g.name })}>+ 추가</button>
              </header>

              <div className="task-list" role="table">
                <div className="task-row task-row-head" role="row">
                  <span role="columnheader" />
                  <span role="columnheader">세부항목</span>
                  <span role="columnheader">구분</span>
                  <span role="columnheader">완료일자</span>
                  <span role="columnheader">담당자1</span>
                  <span role="columnheader">담당자2</span>
                  <span role="columnheader">비고</span>
                </div>
                {g.items.map(t => (
                  <div
                    key={t.id}
                    role="row"
                    tabIndex={0}
                    className={`task-row ${t.done ? 'is-done' : ''}`}
                    onClick={() => onEdit(t)}
                    onKeyDown={(e) => { if (e.key === 'Enter') onEdit(t); }}
                  >
                    <span className="task-cell-check" role="cell" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className={`round-check ${t.done ? 'on' : ''}`}
                        aria-pressed={Boolean(t.done)}
                        aria-label={`${t.title} ${t.done ? '완료 취소' : '완료'}`}
                        onClick={() => onToggleDone(t)}
                      >
                        {t.done ? '✓' : ''}
                      </button>
                    </span>
                    <span className="task-cell-title" role="cell">
                      <span className="task-title-text">{t.title}</span>
                      {(t.files || []).length > 0 && <span className="task-file-count" title="첨부 파일">📎{t.files.length}</span>}
                      <NotionBadge record={t} compact onRetry={t.notionError ? () => onRetryNotion(t) : undefined} />
                    </span>
                    <span className="task-cell-cat" role="cell">
                      {t.category && <span className="cat-tag" style={{ '--cat': categoryColor(t.category) }}>{t.category}</span>}
                    </span>
                    <span className="task-cell-date" role="cell">{dateText(t)}</span>
                    <span className="task-cell-people" role="cell" data-label="담당자1"><PeopleTags names={t.assignee1 || []} /></span>
                    <span className="task-cell-people" role="cell" data-label="담당자2"><PeopleTags names={t.assignee2 || []} /></span>
                    <span className="task-cell-memo" role="cell">{t.memo}</span>
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
