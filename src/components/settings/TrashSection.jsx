import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useBranches } from '../../hooks/useFirestore';
import { useCanDelete } from '../../hooks/useSettings';
import {
  listTrash, restoreTrash, purgeTrash, purgeOld, daysLeft, trashLabel, trashTitle, TRASH_DAYS,
} from '../../utils/trash';

const fmt = (v) => {
  const d = v?.toDate ? v.toDate() : new Date(v || 0);
  return isNaN(d.getTime()) || !d.getTime() ? '' : `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * 설정 → 휴지통: 지운 지점·기록을 30일 동안 보관, 되살리기 / (관리자) 완전히 지우기
 */
export default function TrashSection() {
  const { demoMode } = useAuth();
  const { branches, deletedBranches, restoreBranch, purgeBranch } = useBranches();
  const canDelete = useCanDelete();
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const key = branches.map(b => b.id).join('|');

  const load = async () => {
    let list = await listTrash(branches, demoMode);
    if (canDelete) list = await purgeOld(list, demoMode);
    setItems(list);
  };

  useEffect(() => { load(); }, [key, demoMode, canDelete]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (id, fn, done) => {
    setBusy(id);
    setMsg('');
    try {
      await fn();
      setMsg(done);
      await load();
    } catch (err) {
      setMsg(`실패했어요: ${err.message}`);
    } finally {
      setBusy('');
    }
  };

  const restore = (t) => run(t.id, () => restoreTrash(t, demoMode), `'${trashTitle(t.data)}'을(를) 되살렸어요.`);
  const purge = (t) => {
    if (!window.confirm(`'${trashTitle(t.data)}'을(를) 완전히 지울까요? 다시 되살릴 수 없어요.`)) return;
    run(t.id, () => purgeTrash(t, demoMode), '완전히 지웠어요.');
  };

  return (
    <section className="settings-card">
      <header className="settings-card-head">
        <div>
          <h2>휴지통</h2>
          <p className="settings-help">
            지운 지점과 기록은 여기에 {TRASH_DAYS}일 동안 보관돼요. 그 안에는 '되살리기'로 원래 자리에 돌려놓을 수 있어요.
            {TRASH_DAYS}일이 지나면 저절로 완전히 지워져요.{!demoMode && ' 노션에 보냈던 기록은 되살린 뒤 노션 연결 → \'안 보낸 것만 보내기\'로 다시 보내 주세요.'}
          </p>
        </div>
      </header>

      {!canDelete && <p className="settings-help">되살리기와 완전히 지우기는 관리자만 할 수 있어요. 되살려야 하면 관리자에게 부탁해 주세요.</p>}
      {msg && <p className="settings-help" role="status"><strong>{msg}</strong></p>}

      {deletedBranches.length > 0 && (
        <>
          <h3 className="trash-subtitle">지운 지점</h3>
          <ul className="trash-list">
            {deletedBranches.map(b => (
              <li key={b.id}>
                <span className="trash-kind">지점</span>
                <span className="trash-main">
                  <strong>{b.name}</strong>
                  <span className="trash-sub">{[fmt(b.deletedAt) && `${fmt(b.deletedAt)} 지움`, b.deletedBy].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="trash-actions">
                  {canDelete && (
                    <button type="button" className="btn btn-secondary btn-sm" disabled={busy === b.id}
                      onClick={() => run(b.id, () => restoreBranch(b.id), `'${b.name}' 지점을 되살렸어요.`)}>되살리기</button>
                  )}
                  {canDelete && (
                    <button type="button" className="btn btn-ghost btn-sm trash-purge" disabled={busy === b.id}
                      onClick={() => window.confirm(`'${b.name}' 지점을 완전히 지울까요? 다시 되살릴 수 없어요.`) && run(b.id, () => purgeBranch(b.id), '지점을 완전히 지웠어요.')}>완전히 지우기</button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="trash-subtitle">지운 기록</h3>
      {items === null ? (
        <p className="settings-help">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="settings-help">휴지통이 비어 있어요.</p>
      ) : (
        <ul className="trash-list">
          {items.map(t => (
            <li key={`${t.branchId}-${t.id}`}>
              <span className="trash-kind">{trashLabel(t.collection)}</span>
              <span className="trash-main">
                <strong>{trashTitle(t.data)}</strong>
                <span className="trash-sub">
                  {[t.branchName, fmt(t.deletedAt) && `${fmt(t.deletedAt)} 지움`, t.deletedBy, `${daysLeft(t)}일 뒤 완전히 지워짐`].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="trash-actions">
                {canDelete && <button type="button" className="btn btn-secondary btn-sm" disabled={busy === t.id} onClick={() => restore(t)}>되살리기</button>}
                {canDelete && (
                  <button type="button" className="btn btn-ghost btn-sm trash-purge" disabled={busy === t.id} onClick={() => purge(t)}>완전히 지우기</button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
