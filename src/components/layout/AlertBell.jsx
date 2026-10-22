import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useAlerts } from '../../hooks/useAlerts';
import './AlertBell.css';

const TYPE_LABEL = { schedule: '일정', payment: '지급', task: '오픈 준비', plan: '오픈 계획' };

/**
 * 머리말 종 모양 알림: 기한 지난 일과 3일 안에 챙길 일
 */
export default function AlertBell() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { alerts, unseen, seen, markAllSeen, refresh } = useAlerts();
  const [open, setOpen] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const boxRef = useRef(null);
  const myName = user?.displayName || '';

  const close = () => {
    setOpen(false);
    markAllSeen();
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) close(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }); // 매번 최신 close 사용

  const list = mineOnly && myName ? alerts.filter(a => a.people.includes(myName)) : alerts;
  const overdue = list.filter(a => a.kind === 'overdue');
  const soon = list.filter(a => a.kind !== 'overdue');

  const go = (a) => {
    close();
    navigate(`/branch/${a.branchId}?tab=${a.tab}`);
  };

  const renderItem = (a) => (
    <li key={a.key}>
      <button type="button" className={`alert-item ${a.kind === 'overdue' ? 'overdue' : ''}`} onClick={() => go(a)}>
        {!seen.includes(a.key) && <span className="alert-new" aria-label="새 알림" />}
        <span className="alert-item-main">
          <span className="alert-item-title">{a.title}</span>
          <span className="alert-item-sub">{a.branchName} · {TYPE_LABEL[a.type]}{a.people.length ? ` · ${a.people.join(', ')}` : ''}</span>
        </span>
        <span className="alert-item-badge">{a.badge}</span>
      </button>
    </li>
  );

  return (
    <div className="alert-bell" ref={boxRef}>
      <button
        type="button"
        className="btn-ghost btn-icon alert-bell-btn"
        aria-label={`알림 ${unseen.length}개`}
        aria-expanded={open}
        title="알림 (기한 지난 일 · 3일 안에 챙길 일)"
        onClick={() => { if (open) close(); else { setOpen(true); refresh(); } }}
      >
        <span aria-hidden="true">🔔</span>
        {unseen.length > 0 && <span className="alert-count">{unseen.length > 99 ? '99+' : unseen.length}</span>}
      </button>

      {open && (
        <div className="alert-panel" role="dialog" aria-label="알림">
          <div className="alert-panel-head">
            <strong>알림</strong>
            {myName && (
              <label className="alert-mine">
                <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
                내 일만
              </label>
            )}
          </div>
          {list.length === 0 ? (
            <p className="alert-empty">기한이 지났거나 3일 안에 챙길 일이 없어요.</p>
          ) : (
            <div className="alert-panel-body">
              {overdue.length > 0 && (
                <>
                  <p className="alert-group-title overdue">기한 지남 {overdue.length}</p>
                  <ul className="alert-list">{overdue.map(renderItem)}</ul>
                </>
              )}
              {soon.length > 0 && (
                <>
                  <p className="alert-group-title">3일 안 {soon.length}</p>
                  <ul className="alert-list">{soon.map(renderItem)}</ul>
                </>
              )}
            </div>
          )}
          <p className="alert-foot">오픈 준비·오픈 계획·일정·지급 예정을 모아 보여 줘요. 완료로 바꾸면 사라져요.</p>
        </div>
      )}
    </div>
  );
}
