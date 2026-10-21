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
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

/** 본문 첫 줄을 카드 미리보기로 (# · - · 1. 같은 표시는 뺌) */
function bodyPreview(body = '') {
  const line = String(body).split('\n').map(l => l.replace(/^\s*(#{1,3}|[-*•]|\d+[.)]|\[[ xX]\])\s*/, '').trim()).find(Boolean);
  return line ? line.slice(0, 80) : '';
}

/**
 * 오픈 계획 보드 (노션 '구리남양주점 오픈 계획'과 같은 모양)
 * 카드를 다른 칸으로 끌어 놓거나, 카드를 눌러 세부 내용을 작성
 */
export default function OpenPlanBoard({ plans, onOpen, onCreate, onMove }) {
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="plan-board">
      {PLAN_COLUMNS.map(col => {
        const items = plans.filter(p => (p.status || 'todo') === col.id);
        return (
          <section
            key={col.id}
            className={`plan-col ${col.id} ${overCol === col.id ? 'drop-over' : ''}`}
            onDragOver={(e) => { if (dragId) { e.preventDefault(); setOverCol(col.id); } }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOverCol(null); }}
            onDrop={(e) => {
              e.preventDefault();
              const plan = plans.find(p => p.id === dragId);
              if (plan && (plan.status || 'todo') !== col.id) onMove(plan, col.id);
              setDragId(null);
              setOverCol(null);
            }}
          >
            <header className="plan-col-head">
              <span className={`status-pill ${col.id}`}><span className="status-dot" />{col.label}</span>
              <span className="plan-col-count">{items.length}</span>
            </header>

            <div className="plan-col-list">
              {items.map(p => {
                const due = toDate(p.dueDate);
                const overdue = due && col.id !== 'done' && due < today;
                const people = Array.from(new Set([...(p.assignee1 || []), ...(p.assignee2 || [])]));
                const preview = bodyPreview(p.body);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`plan-card ${dragId === p.id ? 'dragging' : ''}`}
                    draggable
                    onDragStart={(e) => { setDragId(p.id); e.dataTransfer.effectAllowed = 'move'; }}
                    onDragEnd={() => { setDragId(null); setOverCol(null); }}
                    onClick={() => onOpen(p)}
                  >
                    <span className="plan-card-title">{p.title || '제목 없음'}</span>
                    {preview && <span className="plan-card-preview">{preview}</span>}
                    {(people.length > 0 || due || p.notionPageId || p.notionError) && (
                      <span className="plan-card-foot">
                        {people.length > 0 && <PeopleTags names={people} compact />}
                        {people.length > 0 && <span className="plan-card-people">{people.join(', ')}</span>}
                        <span className="plan-card-spacer" />
                        {due && <span className={`plan-due ${overdue ? 'overdue' : ''}`}>{formatDateShort(due)}</span>}
                        <NotionBadge record={p} compact />
                      </span>
                    )}
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
