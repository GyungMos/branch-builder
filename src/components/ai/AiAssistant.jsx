import { useState } from 'react';
import ModalPortal from '../common/ModalPortal';
import { askAssistant, todayInfo } from '../../utils/aiAssistant';
import './AiAssistant.css';

const MODES = [
  { id: 'haiku', label: '⚡ 빠른 모드', sub: 'Haiku 5.5 · 평소에' },
  { id: 'opus', label: '🧠 정밀 모드', sub: 'Opus 5.5 · 어려운 부탁' },
];

const KIND = {
  add_open_plan: { icon: '📋', label: '오픈 계획' },
  add_open_task: { icon: '✅', label: '오픈 준비' },
  add_schedule: { icon: '📅', label: '일정' },
  add_daily_log: { icon: '📝', label: '현장 일지' },
};

const STATUS_LABEL = { todo: '시작 전', doing: '진행 중', done: '완료' };
const WEATHER_LABEL = { sunny: '맑음', cloudy: '흐림', rain: '비', snow: '눈' };

const EXAMPLES = [
  "오픈 계획에 '간판 시안 확정' 추가해줘. 담당 김홍우, 다음 주 금요일까지",
  '오픈 준비에 공기압축기 설치, 타이어 탈착기 구입 추가해줘',
  '다음 주 월요일부터 금요일까지 마당 바닥 공구리 일정 넣어줘',
  '오늘 현장 일지: 외부 판넬 마무리, 인원 6명, 맑음',
];

const readMode = () => {
  try { return localStorage.getItem('bb_ai_model') === 'opus' ? 'opus' : 'haiku'; } catch { return 'haiku'; }
};

/** 제안 카드에서 고칠 수 있는 칸 (제목·날짜) */
function editableFields(kind) {
  if (kind === 'add_open_plan') return [['title', '제목'], ['due_date', '종료일']];
  if (kind === 'add_open_task') return [['title', '세부항목'], ['start_date', '완료일자'], ['end_date', '끝']];
  if (kind === 'add_schedule') return [['title', '일정'], ['start_date', '시작'], ['end_date', '끝']];
  return [['title', '제목'], ['date', '날짜']];
}

function detailText(kind, v) {
  const ppl = (a) => (a?.length ? a.join(', ') : '');
  const parts = {
    add_open_plan: [STATUS_LABEL[v.status], ppl(v.assignee1) && `담당 ${ppl(v.assignee1)}`, ppl(v.assignee2) && `담당2 ${ppl(v.assignee2)}`],
    add_open_task: [v.group && `그룹 ${v.group}`, v.category && `구분 ${v.category}`, v.done && '완료', ppl(v.assignee1) && `담당 ${ppl(v.assignee1)}`, ppl(v.assignee2) && `담당2 ${ppl(v.assignee2)}`, v.memo && `비고 ${v.memo}`],
    add_schedule: [v.stage && `단계 ${v.stage}`, v.assignee && `담당 ${v.assignee}`, v.memo && `메모 ${v.memo}`],
    add_daily_log: [WEATHER_LABEL[v.weather], v.workers_count ? `인원 ${v.workers_count}명` : '', v.stage && `단계 ${v.stage}`, v.equipment_used && `장비 ${v.equipment_used}`, v.issues && `이슈 ${v.issues}`],
  }[kind] || [];
  return parts.filter(Boolean).join(' · ');
}

/**
 * AI 비서: 말로 부탁하면 오픈 계획·오픈 준비·일정·현장 일지에 넣을 내용을 제안하고, 확인 후 추가
 * onSave(kind, input) → 저장 (지점 화면의 기존 저장 방식 사용)
 */
export default function AiAssistant({ branchName, people, groups, categories, stages, onSave, onClose }) {
  const [mode, setMode] = useState(readMode);
  const [message, setMessage] = useState('');
  const [lastMessage, setLastMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { reply, model, items: [{ id, kind, input, include, saved }] }
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const pickMode = (id) => {
    setMode(id);
    try { localStorage.setItem('bb_ai_model', id); } catch { /* 저장 공간 없음 */ }
  };

  const send = async (text = message, useMode = mode) => {
    const msg = text.trim();
    if (!msg || busy) return;
    setBusy(true);
    setError('');
    setSavedCount(0);
    try {
      const res = await askAssistant({
        message: msg,
        model: useMode,
        context: { branchName, people, groups, categories, stages, ...todayInfo() },
      });
      setLastMessage(msg);
      setResult({
        reply: res.reply || '',
        model: res.model || useMode,
        items: (res.proposals || []).map((p, i) => ({ id: `${Date.now()}-${i}`, kind: p.kind, input: p.input, include: true, saved: false })),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const update = (id, patch) => setResult(r => ({ ...r, items: r.items.map(it => (it.id === id ? { ...it, ...patch } : it)) }));
  const setField = (id, key, value) => setResult(r => ({ ...r, items: r.items.map(it => (it.id === id ? { ...it, input: { ...it.input, [key]: value } } : it)) }));

  const chosen = result?.items.filter(it => it.include && !it.saved) || [];

  const saveAll = async () => {
    if (!chosen.length) return;
    setSaving(true);
    setError('');
    let n = 0;
    try {
      for (const it of chosen) {
        await onSave(it.kind, it.input);
        update(it.id, { saved: true });
        n += 1;
      }
    } catch (err) {
      setError(`저장 중 문제가 생겼어요: ${err.message}`);
    } finally {
      setSaving(false);
      setSavedCount(c => c + n);
    }
  };

  return (
    <ModalPortal onClose={onClose}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal modal-lg ai-modal" role="dialog" aria-label="AI 비서">
        <div className="modal-header">
          <h2 className="modal-title">✨ AI 비서 <span className="ai-branch">{branchName}</span></h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">✕</button>
        </div>

        <div className="modal-body ai-body">
          <div className="ai-modes" role="radiogroup" aria-label="AI 모드">
            {MODES.map(m => (
              <button key={m.id} type="button" role="radio" aria-checked={mode === m.id}
                className={`ai-mode ${mode === m.id ? 'on' : ''}`} onClick={() => pickMode(m.id)}>
                <span className="ai-mode-label">{m.label}</span>
                <span className="ai-mode-sub">{m.sub}</span>
              </button>
            ))}
          </div>

          <div className="ai-input-box">
            <textarea
              className="ai-input"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } }}
              placeholder="예: 다음 주 월요일부터 금요일까지 마당 바닥 공구리 일정 넣어줘"
              aria-label="AI에게 부탁할 내용"
              autoFocus
            />
            <button type="button" className="btn btn-primary ai-send" disabled={busy || !message.trim()} onClick={() => send()}>
              {busy ? '정리하는 중…' : '보내기'}
            </button>
          </div>

          {!result && !busy && (
            <div className="ai-examples">
              <p className="ai-hint">이렇게 말해 보세요 (누르면 입력돼요). 휴대폰은 키보드의 🎤로 말해도 돼요.</p>
              {EXAMPLES.map(ex => (
                <button key={ex} type="button" className="ai-example" onClick={() => setMessage(ex)}>{ex}</button>
              ))}
            </div>
          )}

          {busy && <p className="ai-busy"><span className="spinner" /> {mode === 'opus' ? '정밀 모드로 꼼꼼히 정리하는 중…' : 'AI가 정리하는 중…'}</p>}
          {error && <p className="ai-error" role="alert">{error}</p>}

          {result && !busy && (
            <div className="ai-result">
              {result.reply && <p className="ai-reply">🤖 {result.reply}</p>}
              {result.items.length === 0 && !result.reply && <p className="ai-reply">🤖 넣을 내용을 찾지 못했어요. 조금 더 자세히 말해 주세요.</p>}

              {result.items.length > 0 && (
                <>
                  <p className="ai-hint">아래 내용으로 추가할까요? 제목과 날짜는 여기서 바로 고칠 수 있어요.</p>
                  <ul className="ai-cards">
                    {result.items.map(it => {
                      const k = KIND[it.kind] || { icon: '•', label: it.kind };
                      const body = it.kind === 'add_open_plan' ? it.input.body : it.kind === 'add_daily_log' ? it.input.summary : '';
                      return (
                        <li key={it.id} className={`ai-card ${it.saved ? 'saved' : ''} ${!it.include ? 'off' : ''}`}>
                          <div className="ai-card-head">
                            <label className="ai-card-check">
                              <input type="checkbox" checked={it.include} disabled={it.saved} onChange={(e) => update(it.id, { include: e.target.checked })} />
                              <span className="ai-kind">{k.icon} {k.label}</span>
                            </label>
                            {it.saved && <span className="ai-saved">✓ 추가함</span>}
                          </div>
                          <div className="ai-fields">
                            {editableFields(it.kind).map(([key, label]) => (
                              <label key={key} className={`ai-field ${key === 'title' ? 'wide' : ''}`}>
                                <span>{label}</span>
                                <input
                                  value={it.input[key] ?? ''}
                                  onChange={(e) => setField(it.id, key, e.target.value)}
                                  disabled={it.saved}
                                  placeholder={key === 'title' ? '' : 'YYYY-MM-DD'}
                                  inputMode={key === 'title' ? undefined : 'numeric'}
                                />
                              </label>
                            ))}
                          </div>
                          {detailText(it.kind, it.input) && <p className="ai-detail">{detailText(it.kind, it.input)}</p>}
                          {body && <p className="ai-body-preview">{body}</p>}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}

              <div className="ai-actions">
                {result.model !== 'opus' && (
                  <button type="button" className="btn btn-secondary btn-sm" disabled={busy}
                    onClick={() => { pickMode('opus'); send(lastMessage, 'opus'); }}>
                    🧠 정밀 모드로 다시 해보기
                  </button>
                )}
                <span className="ai-actions-spacer" />
                {savedCount > 0 && <span className="ai-saved-msg">{savedCount}개 추가했어요</span>}
                {result.items.length > 0 && (
                  <button type="button" className="btn btn-primary" disabled={saving || !chosen.length} onClick={saveAll}>
                    {saving ? '추가하는 중…' : `선택한 ${chosen.length}개 추가`}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
