import { useEffect, useState } from 'react';
import ModalPortal from '../common/ModalPortal';
import { useAuth } from '../../contexts/AuthContext';
import { loadBranchData } from '../../utils/branchData';

/**
 * 다른 지점의 오픈 준비 스케줄 항목을 가져오기 (체크·날짜·파일은 비우고 그룹·구분·항목·담당자·비고만)
 */
export default function ImportTasksModal({ branches, currentBranchId, onImport, onClose }) {
  const { demoMode } = useAuth();
  const candidates = branches.filter(b => b.id !== currentBranchId);
  const [sourceId, setSourceId] = useState(candidates[0]?.id || '');
  const [source, setSource] = useState(null);
  const [keepPeople, setKeepPeople] = useState(true);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!sourceId) return undefined;
    let cancelled = false;
    setSource(null);
    loadBranchData(sourceId, demoMode, ['openTasks']).then(d => { if (!cancelled) setSource(d.openTasks || []); });
    return () => { cancelled = true; };
  }, [sourceId, demoMode]);

  const handleImport = async () => {
    if (!source?.length) return;
    setWorking(true);
    try {
      const items = source.map((t, i) => ({
        group: t.group || '',
        category: t.category || '',
        title: t.title || '',
        startDate: null,
        endDate: null,
        done: false,
        assignee1: keepPeople ? (t.assignee1 || []) : [],
        assignee2: keepPeople ? (t.assignee2 || []) : [],
        memo: t.memo || '',
        files: [],
        order: i,
      }));
      await onImport(items);
    } finally {
      setWorking(false);
    }
  };

  return (
    <ModalPortal onClose={onClose}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">다른 지점에서 가져오기</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {candidates.length === 0 ? (
            <p className="text-secondary">가져올 다른 지점이 없어요.</p>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="import-source">어느 지점 항목을 가져올까요?</label>
                <select id="import-source" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                  {candidates.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <p className="text-secondary text-sm">
                {source === null ? '불러오는 중…' : `항목 ${source.length}개를 가져와요. 완료 체크·날짜·파일은 비운 채로 들어와요.`}
              </p>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'var(--space-sm)' }}>
                <input type="checkbox" checked={keepPeople} onChange={(e) => setKeepPeople(e.target.checked)} />
                <span>담당자도 같이 가져오기</span>
              </label>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
          <button type="button" className="btn btn-primary" disabled={!source?.length || working} onClick={handleImport}>
            {working ? '가져오는 중…' : '가져오기'}
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}
