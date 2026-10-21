import { useMemo, useState } from 'react';
import Timeline from '../schedule/Timeline';
import { PeopleTags } from '../common/PeoplePicker';
import NotionBadge from '../common/NotionBadge';
import { formatDateShort } from '../../utils/formatters';
import { OPEN_TASK_GROUPS } from '../../utils/constants';
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

/**
 * 오픈 준비 스케줄 (노션 '구리OPEN 스케쥴'): 그룹별 표 + 타임라인 보기
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
      .map(name => ({ name, items: filtered.filter(t => (t.group || '그룹 없음') === name), all: tasks.filter(t => (t.group || '그룹 없음') === name) }))
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
    <div className="task-table-wrap">
      <div className="task-toolbar">
        <div className="task-view-toggle" role="tablist">
          <button type="button" role="tab" aria-selected={view === 'table'} className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}>표</button>
          <button type="button" role="tab" aria-selected={view === 'timeline'} className={view === 'timeline' ? 'on' : ''} onClick={() => setView('timeline')}>타임라인</button>
        </div>
        <span className="task-progress">완료 {doneCount} / {tasks.length}</span>
        <input type="search" className="task-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="항목·담당자 찾기" aria-label="찾기" />
        <label className="task-only-open">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> 미완료만
        </label>
        <span className="task-toolbar-spacer" />
        <button type="button" className="btn btn-secondary btn-sm" onClick={onImport}>다른 지점에서 가져오기</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => onAdd({})}>+ 항목 추가</button>
      </div>

      {tasks.length === 0 ? (
        <div className="task-empty">
          <p>아직 항목이 없어요.</p>
          <p className="text-secondary text-sm">이전 지점에서 쓰던 항목을 <strong>"다른 지점에서 가져오기"</strong>로 한 번에 불러오면 편해요 (체크·날짜는 비운 채로).</p>
        </div>
      ) : view === 'timeline' ? (
        <>
          {noDateCount > 0 && <p className="task-note">날짜가 없는 항목 {noDateCount}개는 표에서 확인하세요.</p>}
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
        groups.map(g => (
          <section key={g.name} className="task-group">
            <header className="task-group-head">
              <h3>{g.name}</h3>
              <span className="task-group-count">{g.all.filter(t => t.done).length} / {g.all.length}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onAdd({ group: g.name === '그룹 없음' ? '' : g.name })}>+ 추가</button>
            </header>
            <div className="task-table-scroll">
              <table className="task-table">
                <thead>
                  <tr>
                    <th className="col-done">완료</th>
                    <th>세부항목</th>
                    <th>구분</th>
                    <th>완료일자</th>
                    <th>담당자1</th>
                    <th>담당자2</th>
                    <th>비고</th>
                    <th>파일</th>
                  </tr>
                </thead>
                <tbody>
                  {g.items.map(t => (
                    <tr key={t.id} className={t.done ? 'is-done' : ''} onClick={() => onEdit(t)}>
                      <td className="col-done" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={Boolean(t.done)} onChange={() => onToggleDone(t)} aria-label={`${t.title} 완료`} />
                      </td>
                      <td className="col-title">
                        <span>{t.title}</span>
                        <NotionBadge record={t} onRetry={t.notionError ? () => onRetryNotion(t) : undefined} />
                      </td>
                      <td>{t.category && <span className="task-cat">{t.category}</span>}</td>
                      <td className="col-date">{dateText(t)}</td>
                      <td><PeopleTags names={t.assignee1 || []} /></td>
                      <td><PeopleTags names={t.assignee2 || []} /></td>
                      <td className="col-memo">{t.memo}</td>
                      <td className="col-files">{(t.files || []).length ? `📎 ${(t.files || []).length}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
