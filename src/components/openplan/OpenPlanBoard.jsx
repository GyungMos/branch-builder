import { useState } from 'react';
import { PeopleTags } from '../common/PeoplePicker';
import NotionBadge from '../common/NotionBadge';
import { formatDateShort } from '../../utils/formatters';
import './OpenPlan.css';

export const PLAN_COLUMNS = [
  { id: 'todo', label: '시작 전' },
  { id: 'doing', label: '진행 중' },
  { id: 'done', label: '완료' },
];

const toDate = (v) => {
  if (!v) return null;
  const d = v.toDate ? v.toDate() : new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * 오픈 계획 보드 (노션 '구리남양주점 오픈 계획'과 같은 모양)
 * 카드를 다른 칸으로 끌어 놓거나, 카드를 눌러 세부 내용을 작성
 */
export default function OpenPlanBoard({ plans, onOpen, onCreate, onMove }) {
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);

  return (
    <div className="plan-board">
      {PLAN_COLUMNS.map(col => {
        const items = plans.filter(p => (p.status || 'todo') === col.id);
        return (
          <section
            key={col.id}
            className={`plan-col ${col.id} ${overCol === col.id ? 'drop-over' : ''}`}
            onDragOver={(e) => { if (dragId) { e.preventDefault(); setOverCol(col.id); } }}
            onDragLeave={() => setOverCol(null)}
            onDrop={(e) => {
              e.preventDefault();
              const plan = plans.find(p => p.id === dragId);
              if (plan && (plan.status || 'todo') !== col.id) onMove(plan, col.id);
              setDragId(null);
              setOverCol(null);
            }}
          >
            <header className="plan-col-head">
              <span className={`plan-col-dot ${col.id}`} />
              <span>{col.label}</span>
              <span className="plan-col-count">{items.length}</span>
            </header>
            <div className="plan-col-list">
              {items.map(p => {
                const due = toDate(p.dueDate);
                const people = [...(p.assignee1 || []), ...(p.assignee2 || [])];
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="plan-card"
                    draggable
                    onDragStart={() => setDragId(p.id)}
                    onDragEnd={() => { setDragId(null); setOverCol(null); }}
                    onClick={() => onOpen(p)}
                  >
                    <span className="plan-card-title">{p.title || '제목 없음'}</span>
                    <span className="plan-card-meta">
                      <PeopleTags names={people} />
                      {due && <span className="plan-card-due">{formatDateShort(due)}</span>}
                      <NotionBadge record={p} />
                    </span>
                  </button>
                );
              })}
              <button type="button" className="plan-add" onClick={() => onCreate(col.id)}>+ 새 항목</button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
