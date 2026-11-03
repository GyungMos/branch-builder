import { useEffect, useState } from 'react';
import { groupByStage } from '../../utils/lessons';
import { formatDateShort } from '../../utils/formatters';
import ShortfallTitle from './ShortfallTitle';
import './Lessons.css';

const sourceText = (it, withBranch) => [withBranch && it.branchName, it.date ? formatDateShort(it.date) : it.sourceLabel].filter(Boolean).join(' · ');

/** 항목 하나: [적용했어요] 체크 + 어떻게 적용했는지 메모 (칸을 벗어나면 저장) */
function LessonItem({ item, checked, note, withBranch, onToggle, onSaveNote }) {
  const [draft, setDraft] = useState(note || '');
  const [open, setOpen] = useState(Boolean(note));
  useEffect(() => { setDraft(note || ''); }, [note]);

  const save = () => {
    if ((draft || '').trim() !== (note || '').trim()) onSaveNote(item.key, draft.trim());
  };

  return (
    <li className={`lessons-item ${checked ? 'checked' : ''}`}>
      <div className="lessons-item-main">
        <ShortfallTitle title={item.text} detail={item.detail} />
        <span className="lessons-src">{sourceText(item, withBranch)}</span>
      </div>
      <div className="lessons-apply">
        <label className="lessons-apply-check">
          <input type="checkbox" checked={checked} onChange={() => onToggle(item.key)} />
          <span>{checked ? '적용했어요' : '적용했나요?'}</span>
        </label>
        {!open && !note && (
          <button type="button" className="lessons-note-btn" onClick={() => setOpen(true)}>+ 적용 내용 적기</button>
        )}
      </div>
      {(open || note) && (
        <textarea
          className="lessons-note"
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          placeholder="어떻게 적용했는지 적어 두세요. 예: 설계 단계에서 정화조 위치를 미리 확인함"
          aria-label="적용 내용"
        />
      )}
    </li>
  );
}

/**
 * '부족했던 점' 메뉴
 * - 이전 지점에서 부족했던 점: 다른 지점들에서 모인 것
 * - 이 지점에서 나온 부족했던 점: 현장 일지 '부족했던 점' 칸 + 단계별 기록 메모에서 자동으로 모임
 * 항목마다 [적용했어요] 체크와 적용 내용 메모 (지점마다 따로 기억)
 */
export default function LessonsPanel({ previous, previousLoading, mine, checks = {}, notes = {}, stageOrder = [], currentStage, onToggleCheck, onSaveNote, onWriteLog }) {
  const [onlyOpen, setOnlyOpen] = useState(true);
  // 방금 체크한 항목은 바로 사라지지 않게 (이어서 적용 내용을 적을 수 있도록)
  const [justChecked, setJustChecked] = useState(() => new Set());
  const toggle = (key) => {
    if (!checks[key]) setJustChecked(prev => new Set(prev).add(key));
    onToggleCheck(key);
  };
  const openCount = previous.filter(it => !checks[it.key]).length;
  const shown = onlyOpen ? previous.filter(it => !checks[it.key] || justChecked.has(it.key)) : previous;
  const prevGroups = groupByStage(shown, stageOrder);
  const myGroups = groupByStage(mine, stageOrder);
  const myApplied = mine.filter(it => checks[it.key]).length;

  const renderItem = (it, withBranch) => (
    <LessonItem key={it.key} item={it} checked={Boolean(checks[it.key])} note={notes[it.key]} withBranch={withBranch}
      onToggle={toggle} onSaveNote={onSaveNote} />
  );

  return (
    <div className="lessons">
      <div className="tab-header lessons-head">
        <div>
          <h3>⚠ 부족했던 점</h3>
          <p className="lessons-help">현장 일지의 '부족했던 점' 칸과 단계별 기록의 '아쉬운 점·다음 지점 메모'에 적은 내용이 자동으로 모여요. 항목마다 실제로 적용했는지 체크하고, 어떻게 적용했는지 적어 둘 수 있어요.</p>
        </div>
        {onWriteLog && <button type="button" className="btn btn-primary btn-sm" onClick={onWriteLog}>+ 일지에 적기</button>}
      </div>

      <section className="lessons-section">
        <header className="lessons-section-head">
          <h4>이전 지점에서 부족했던 점</h4>
          <span className="lessons-count">{previous.length}개 · 아직 적용 안 함 {openCount}개</span>
          <span className="lessons-spacer" />
          <div className="seg-toggle" role="tablist" aria-label="보기">
            <button type="button" role="tab" aria-selected={onlyOpen} className={onlyOpen ? 'on' : ''} onClick={() => { setOnlyOpen(true); setJustChecked(new Set()); }}>적용 안 한 것만</button>
            <button type="button" role="tab" aria-selected={!onlyOpen} className={!onlyOpen ? 'on' : ''} onClick={() => setOnlyOpen(false)}>전체</button>
          </div>
        </header>

        {previousLoading ? (
          <p className="lessons-empty">불러오는 중…</p>
        ) : previous.length === 0 ? (
          <p className="lessons-empty">아직 다른 지점에서 모인 내용이 없어요.</p>
        ) : shown.length === 0 ? (
          <p className="lessons-empty">모두 적용했어요 👍 '전체'를 누르면 적용 내용을 볼 수 있어요.</p>
        ) : (
          prevGroups.map(g => (
            <div key={g.name} className={`lessons-group ${g.name === currentStage ? 'now' : ''}`}>
              <p className="lessons-group-title">{g.name}{g.name === currentStage && <span className="lessons-now">지금 단계</span>}</p>
              <ul className="lessons-list">{g.items.map(it => renderItem(it, true))}</ul>
            </div>
          ))
        )}
      </section>

      <section className="lessons-section">
        <header className="lessons-section-head">
          <h4>이 지점에서 나온 부족했던 점</h4>
          <span className="lessons-count">{mine.length}개 · 다시 적용 {myApplied}개</span>
        </header>
        {mine.length === 0 ? (
          <p className="lessons-empty">현장 일지를 쓸 때 '부족했던 점 · 미리 챙겼어야 할 것' 칸에 적으면 여기에 모여요.</p>
        ) : (
          myGroups.map(g => (
            <div key={g.name} className="lessons-group">
              <p className="lessons-group-title">{g.name}</p>
              <ul className="lessons-list">{g.items.map(it => renderItem(it, false))}</ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
