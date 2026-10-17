import { useMemo, useState } from 'react';
import { STAGE_STATUS } from '../../utils/constants';
import { formatCurrency, formatDateShort } from '../../utils/formatters';
import PropertySpecs from './PropertySpecs';
import StageManager from './StageManager';
import { isScheduleDone } from '../schedule/Timeline';
import './StageBook.css';

const UNLINKED = '__unlinked__';

function toDate(val) {
  if (!val) return null;
  const d = val.toDate ? val.toDate() : new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function dayStart(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function periodText(start, end) {
  if (!start) return '기간 미정';
  if (!end || start.getTime() === end.getTime()) return formatDateShort(start);
  return `${formatDateShort(start)} ~ ${formatDateShort(end)}`;
}

/**
 * 단계별 기록: 임대차계약 → 설계 → 인허가 → … 순서로,
 * 각 단계에 연결된 일정·비용·서류·현장일지를 한 화면에 모아 보여줌
 */
export default function StageBook({
  branch,
  stages,
  schedules,
  costs,
  documents,
  dailyLogs,
  equipments,
  onAddStage,
  onUpdateStage,
  onDeleteStage,
  onToggleScheduleComplete,
  onEditSchedule,
  onEditCost,
  onAddSchedule,
  onAddCost,
  onAddDocument,
  onEditBranch,
}) {
  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => (a.order || 0) - (b.order || 0)),
    [stages]
  );

  // 단계별로 기록 묶기
  const groups = useMemo(() => {
    const stageIds = new Set(sortedStages.map(s => s.id));
    const keyOf = (item) => (item.stageId && stageIds.has(item.stageId) ? item.stageId : UNLINKED);
    const map = {};
    const ensure = (key) => {
      if (!map[key]) map[key] = { schedules: [], costs: [], documents: [] };
      return map[key];
    };
    sortedStages.forEach(s => ensure(s.id));

    schedules.forEach(s => {
      ensure(keyOf(s)).schedules.push({ ...s, start: toDate(s.startDate), end: toDate(s.endDate) || toDate(s.startDate) });
    });
    costs.forEach(c => ensure(keyOf(c)).costs.push({ ...c, when: toDate(c.date || c.createdAt) }));
    documents.forEach(d => ensure(keyOf(d)).documents.push({ ...d, when: toDate(d.createdAt) }));

    Object.values(map).forEach(g => {
      g.schedules.sort((a, b) => (a.start || 0) - (b.start || 0));
      g.costs.sort((a, b) => (a.when || 0) - (b.when || 0));
      g.documents.sort((a, b) => (a.when || 0) - (b.when || 0));
      g.costTotal = g.costs.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
      const starts = g.schedules.map(s => s.start).filter(Boolean);
      const ends = g.schedules.map(s => s.end).filter(Boolean);
      g.periodStart = starts.length ? new Date(Math.min(...starts)) : null;
      g.periodEnd = ends.length ? new Date(Math.max(...ends)) : null;
    });
    return map;
  }, [sortedStages, schedules, costs, documents]);

  const unlinked = groups[UNLINKED];
  const unlinkedCount = unlinked
    ? unlinked.schedules.length + unlinked.costs.length + unlinked.documents.length
    : 0;

  const defaultStageId = (
    sortedStages.find(s => s.status === 'progress') ||
    sortedStages.find(s => s.status !== 'complete') ||
    sortedStages[0]
  )?.id;
  const [selectedId, setSelectedId] = useState(null);
  const activeId = selectedId && (groups[selectedId] || selectedId === UNLINKED) ? selectedId : defaultStageId;

  if (sortedStages.length === 0) {
    return (
      <div className="stage-book">
        <div className="stage-book-intro">
          <h3>단계부터 만들어 주세요</h3>
          <p>임대차계약부터 오픈까지 단계를 만들면, 일정·비용·서류를 단계별로 모아 볼 수 있어요.</p>
        </div>
        <StageManager stages={stages} onAdd={onAddStage} onUpdate={onUpdateStage} onDelete={onDeleteStage} />
      </div>
    );
  }

  const stageIndex = sortedStages.findIndex(s => s.id === activeId);
  const stage = sortedStages[stageIndex];
  const group = groups[activeId] || { schedules: [], costs: [], documents: [], costTotal: 0 };
  const isUnlinked = activeId === UNLINKED;

  // 임대차·부지 조건은 계약 단계에서 보여줌 (이름으로 못 찾으면 첫 단계)
  const leaseStage = sortedStages.find(s => /임대|계약|토지|부지/.test(s.name)) || sortedStages[0];
  const showProperty = stage && stage.id === leaseStage.id;
  const showEquipment = stage && /장비/.test(stage.name);

  // 현장 일지는 단계와 직접 연결돼 있지 않아서, 단계 일정 기간에 쓴 일지를 모아 보여줌
  const stageLogs = (!isUnlinked && group.periodStart)
    ? dailyLogs
        .map(l => ({ ...l, when: toDate(l.date) }))
        .filter(l => l.when && dayStart(l.when) >= dayStart(group.periodStart) && dayStart(l.when) <= dayStart(group.periodEnd || group.periodStart))
        .sort((a, b) => a.when - b.when)
    : [];

  const checklist = stage?.checklist || [];
  const toggleCheck = (itemId) => {
    onUpdateStage(stage.id, {
      checklist: checklist.map(i => (i.id === itemId ? { ...i, done: !i.done } : i)),
    });
  };

  return (
    <div className="stage-book">
      {/* 단계 순서표 */}
      <ol className="stage-steps" aria-label="오픈 단계">
        {sortedStages.map((s, i) => {
          const g = groups[s.id];
          const count = g.schedules.length + g.costs.length + g.documents.length;
          return (
            <li key={s.id}>
              <button
                type="button"
                className={`stage-step ${s.status || 'waiting'} ${activeId === s.id ? 'selected' : ''}`}
                onClick={() => setSelectedId(s.id)}
              >
                <span className="stage-step-num">{s.status === 'complete' ? '✓' : i + 1}</span>
                <span className="stage-step-name">{s.name}</span>
                <span className="stage-step-meta">{count > 0 ? `기록 ${count}` : '기록 없음'}</span>
              </button>
            </li>
          );
        })}
        {unlinkedCount > 0 && (
          <li>
            <button
              type="button"
              className={`stage-step unlinked ${isUnlinked ? 'selected' : ''}`}
              onClick={() => setSelectedId(UNLINKED)}
            >
              <span className="stage-step-num">?</span>
              <span className="stage-step-name">단계 미지정</span>
              <span className="stage-step-meta">기록 {unlinkedCount}</span>
            </button>
          </li>
        )}
      </ol>

      {/* 선택한 단계 내용 */}
      <section className="stage-panel">
        <header className="stage-panel-header">
          <div>
            <div className="stage-panel-kicker">
              {isUnlinked ? '단계가 지정되지 않은 기록' : `${stageIndex + 1}단계 / 전체 ${sortedStages.length}단계`}
            </div>
            <h2 className="stage-panel-title">{isUnlinked ? '단계 미지정' : stage.name}</h2>
            {isUnlinked && (
              <p className="stage-panel-help">
                아래 기록은 어느 단계인지 정해지지 않았어요. 각 기록의 수정 화면에서 단계를 골라 주면 해당 단계로 옮겨져요.
              </p>
            )}
          </div>
          {!isUnlinked && (
            <label className="stage-status-field">
              <span>진행 상태</span>
              <select value={stage.status || 'waiting'} onChange={(e) => onUpdateStage(stage.id, { status: e.target.value })}>
                {Object.entries(STAGE_STATUS).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </label>
          )}
        </header>

        <dl className="stage-facts">
          <div>
            <dt>기간</dt>
            <dd>{periodText(group.periodStart, group.periodEnd)}</dd>
          </div>
          <div>
            <dt>쓴 비용</dt>
            <dd>{formatCurrency(group.costTotal || 0)}</dd>
          </div>
          <div>
            <dt>일정</dt>
            <dd>
              {group.schedules.filter(isScheduleDone).length} / {group.schedules.length} 완료
            </dd>
          </div>
          {!isUnlinked && (
            <div>
              <dt>체크리스트</dt>
              <dd>{checklist.filter(i => i.done).length} / {checklist.length}</dd>
            </div>
          )}
        </dl>

        {!isUnlinked && (
          <div className="stage-quick-add">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onAddSchedule(stage.id)}>+ 일정</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onAddCost(stage.id)}>+ 비용</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onAddDocument(stage.id)}>+ 서류·사진</button>
          </div>
        )}

        {/* 체크리스트 */}
        {!isUnlinked && (
          <StageSection title="할 일 체크리스트" count={checklist.length}>
            {checklist.length === 0 ? (
              <p className="stage-empty-line">체크리스트가 없어요. 아래 "단계 편집"에서 추가할 수 있어요.</p>
            ) : (
              <ul className="stage-checklist-list">
                {checklist.map(item => (
                  <li key={item.id}>
                    <label className={item.done ? 'done' : ''}>
                      <input type="checkbox" checked={!!item.done} onChange={() => toggleCheck(item.id)} />
                      <span>{item.text}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </StageSection>
        )}

        {/* 임대차·부지 조건 */}
        {showProperty && (
          <div className="stage-section">
            <PropertySpecs property={branch.property} onEdit={onEditBranch} />
          </div>
        )}

        {/* 일정 */}
        <StageSection title="일정" count={group.schedules.length}>
          {group.schedules.length === 0 ? (
            <p className="stage-empty-line">이 단계에 등록된 일정이 없어요.</p>
          ) : (
            <ul className="stage-record-list">
              {group.schedules.map(s => {
                const done = isScheduleDone(s);
                return (
                  <li key={s.id} className={done ? 'is-done' : ''}>
                    <button
                      type="button"
                      className={`schedule-done-btn ${done ? 'active' : ''}`}
                      onClick={() => onToggleScheduleComplete(s)}
                      title={done ? '완료 취소' : '완료로 표시'}
                    >
                      ✓
                    </button>
                    <button type="button" className="stage-record-main" onClick={() => onEditSchedule(s)}>
                      <span className="stage-record-title">{s.title}</span>
                      <span className="stage-record-sub">
                        {periodText(s.start, s.end)}
                        {s.assignee ? ` · ${s.assignee}` : ''}
                      </span>
                      {s.memo && <span className="stage-record-memo">{s.memo}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </StageSection>

        {/* 비용 */}
        <StageSection title="비용" count={group.costs.length} extra={group.costs.length > 0 ? `합계 ${formatCurrency(group.costTotal)}` : null}>
          {group.costs.length === 0 ? (
            <p className="stage-empty-line">이 단계에 등록된 비용이 없어요.</p>
          ) : (
            <ul className="stage-record-list">
              {group.costs.map(c => (
                <li key={c.id}>
                  <button type="button" className="stage-record-main" onClick={() => onEditCost(c)}>
                    <span className="stage-record-title">{c.title}</span>
                    <span className="stage-record-sub">
                      {c.when ? formatDateShort(c.when) : '날짜 없음'}
                      {c.vendor ? ` · ${c.vendor}` : ''}
                    </span>
                  </button>
                  <span className="stage-record-amount">{formatCurrency(Number(c.amount) || 0)}</span>
                </li>
              ))}
            </ul>
          )}
        </StageSection>

        {/* 서류·사진 */}
        <StageSection title="서류·사진" count={group.documents.length}>
          {group.documents.length === 0 ? (
            <p className="stage-empty-line">이 단계에 올린 서류나 사진이 없어요.</p>
          ) : (
            <ul className="stage-doc-grid">
              {group.documents.map(d => {
                const name = d.fileName || d.name || '파일';
                const isImage = d.fileType?.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(name);
                return (
                  <li key={d.id}>
                    <a href={d.fileUrl} target="_blank" rel="noreferrer" className="stage-doc-card">
                      {isImage && d.fileUrl ? (
                        <img src={d.fileUrl} alt={name} loading="lazy" />
                      ) : (
                        <span className="stage-doc-icon">📄</span>
                      )}
                      <span className="stage-doc-name">{name}</span>
                      {d.memo && <span className="stage-doc-memo">{d.memo}</span>}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </StageSection>

        {/* 장비 */}
        {showEquipment && (
          <StageSection title="장비" count={equipments.length}>
            {equipments.length === 0 ? (
              <p className="stage-empty-line">등록된 장비가 없어요. "장비/인허가" 탭에서 추가할 수 있어요.</p>
            ) : (
              <ul className="stage-record-list">
                {equipments.map(eq => (
                  <li key={eq.id}>
                    <div className="stage-record-main">
                      <span className="stage-record-title">
                        {eq.name}{eq.modelName ? ` (${eq.modelName})` : ''}{eq.quantity ? ` × ${eq.quantity}` : ''}
                      </span>
                      <span className="stage-record-sub">
                        {eq.installDate ? `설치 ${formatDateShort(toDate(eq.installDate))}` : eq.arrivalDate ? `입고 ${formatDateShort(toDate(eq.arrivalDate))}` : '일정 미정'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </StageSection>
        )}

        {/* 현장 일지 */}
        {!isUnlinked && (
          <StageSection title="이 기간의 현장 일지" count={stageLogs.length}>
            {stageLogs.length === 0 ? (
              <p className="stage-empty-line">
                {group.periodStart ? '이 단계 기간에 쓴 현장 일지가 없어요.' : '단계 일정을 넣으면 그 기간의 현장 일지가 여기에 모여요.'}
              </p>
            ) : (
              <ul className="stage-record-list">
                {stageLogs.map(l => (
                  <li key={l.id}>
                    <div className="stage-record-main">
                      <span className="stage-record-title">{l.summary || '내용 없음'}</span>
                      <span className="stage-record-sub">
                        {formatDateShort(l.when)}
                        {l.workersCount ? ` · ${l.workersCount}명 출역` : ''}
                        {l.author ? ` · ${l.author}` : ''}
                      </span>
                      {l.issues && <span className="stage-record-issue">이슈: {l.issues}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </StageSection>
        )}
      </section>

      {/* 단계 추가·삭제·이름 변경 */}
      <details className="stage-edit-details">
        <summary>단계 편집 (추가·삭제·체크리스트 관리)</summary>
        <StageManager stages={stages} onAdd={onAddStage} onUpdate={onUpdateStage} onDelete={onDeleteStage} />
      </details>

      {branch.description && (
        <div className="stage-branch-memo">
          <strong>지점 메모</strong>
          <p>{branch.description}</p>
        </div>
      )}
    </div>
  );
}

function StageSection({ title, count, extra, children }) {
  return (
    <div className="stage-section">
      <h3 className="stage-section-title">
        <span>{title}</span>
        {typeof count === 'number' && <span className="stage-section-count">{count}</span>}
        {extra && <span className="stage-section-extra">{extra}</span>}
      </h3>
      {children}
    </div>
  );
}
