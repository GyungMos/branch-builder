import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ModalPortal from '../common/ModalPortal';
import DateInput from '../common/DateInput';
import { useBranches } from '../../hooks/useFirestore';
import { useAuth } from '../../contexts/AuthContext';
import { loadBranchData, copyBranchSetup } from '../../utils/branchData';
import { syncBranchAll } from '../../utils/notionBranchSync';
import { toDateInputValue } from '../../utils/formatters';

/**
 * 이 지점처럼 새 지점 만들기: 단계·체크리스트·협력업체·장비·법정 항목·예산·일정을 골라서 복사
 * (비용·서류·사진·현장 일지·부지 정보는 지점마다 달라서 복사하지 않음)
 */
export default function CopyBranchModal({ source, onClose }) {
  const navigate = useNavigate();
  const { demoMode, user } = useAuth();
  const { addBranch, updateBranch } = useBranches();
  const [data, setData] = useState(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [opts, setOpts] = useState({
    stages: true, openTasks: true, partners: true, equipments: true, compliance: true, budget: false, schedules: false,
  });
  const [scheduleStart, setScheduleStart] = useState(toDateInputValue(new Date()));
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    loadBranchData(source.id, demoMode).then(d => { if (!cancelled) setData(d); });
    return () => { cancelled = true; };
  }, [source.id, demoMode]);

  const count = (key) => (data?.[key] || []).length;
  const options = [
    { key: 'stages', label: '단계와 체크리스트', note: '체크는 모두 해제된 상태로', n: count('stages') },
    { key: 'openTasks', label: '오픈 준비 스케줄 항목', note: '체크·날짜·파일은 비운 채로', n: count('openTasks') },
    { key: 'partners', label: '협력업체 연락처', n: count('partners') },
    { key: 'equipments', label: '장비 목록', note: '설치·검사 전 상태로', n: count('equipments') },
    { key: 'compliance', label: '법정 시설·인허가 항목', note: '모두 미확인 상태로', n: count('compliance') },
    { key: 'budget', label: '목표 예산', n: data?.budget?.totalBudget ? 1 : 0 },
    { key: 'schedules', label: '일정 (새 시작일 기준으로 옮김)', note: '모두 미완료로', n: count('schedules') },
  ];
  const validStart = /^\d{4}-\d{2}-\d{2}$/.test(scheduleStart);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim() || !data) return;
    if (opts.schedules && !validStart) { setError('일정 시작일을 YYYY-MM-DD 형식으로 입력해 주세요.'); return; }
    setWorking(true);
    setError('');
    try {
      const created = await addBranch({
        name: name.trim(),
        address: address.trim(),
        description: `${source.name}의 준비 자료를 복사해 만든 지점`,
      });
      const summary = await copyBranchSetup({
        source: data,
        targetBranchId: created.id,
        options: { ...opts, scheduleStart, stages: opts.stages || opts.schedules },
        demoMode,
        user,
      });
      setResult({ id: created.id, summary });
      // 새 지점 기록도 노션으로 (뒤에서 천천히, 실패해도 각 기록에 표시만 남음)
      if (!demoMode) {
        loadBranchData(created.id, demoMode).then(data =>
          syncBranchAll({ id: created.id, name: name.trim() }, data, { updateBranch }));
      }
    } catch (err) {
      console.error('지점 복사 실패:', err);
      setError('복사 중 오류가 발생했습니다: ' + (err.message || '다시 시도해 주세요.'));
    } finally {
      setWorking(false);
    }
  };

  return (
    <ModalPortal onClose={onClose}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">이 지점처럼 새 지점 만들기</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {result ? (
          <>
            <div className="modal-body">
              <p><strong>{name}</strong> 지점을 만들었어요.</p>
              <ul className="text-secondary text-sm" style={{ marginTop: 'var(--space-sm)', paddingLeft: '1.2em' }}>
                {result.summary.stages > 0 && <li>단계 {result.summary.stages}개</li>}
                {result.summary.openTasks > 0 && <li>오픈 준비 항목 {result.summary.openTasks}개</li>}
                {result.summary.partners > 0 && <li>협력업체 {result.summary.partners}곳</li>}
                {result.summary.equipments > 0 && <li>장비 {result.summary.equipments}개</li>}
                {result.summary.compliance > 0 && <li>법정 항목 {result.summary.compliance}개</li>}
                {result.summary.budget && <li>목표 예산</li>}
                {result.summary.schedules > 0 && <li>일정 {result.summary.schedules}개</li>}
              </ul>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={onClose}>닫기</button>
              <button className="btn btn-primary" onClick={() => { onClose(); navigate(`/branch/${result.id}`); }}>새 지점으로 이동</button>
            </div>
          </>
        ) : (
          <form onSubmit={handleCreate}>
            <div className="modal-body">
              <p className="text-secondary text-sm" style={{ marginBottom: 'var(--space-md)' }}>
                <strong>{source.name}</strong>의 준비 자료를 골라서 새 지점에 그대로 가져와요.
                비용·서류·사진·현장 일지·부지 정보는 지점마다 달라서 가져오지 않아요.
              </p>
              <div className="form-group">
                <label htmlFor="copy-name">새 지점 이름 *</label>
                <input id="copy-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 화성 봉담점" required autoFocus />
              </div>
              <div className="form-group">
                <label htmlFor="copy-address">주소</label>
                <input id="copy-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="나중에 입력해도 돼요" />
              </div>

              <fieldset className="form-group" style={{ border: 'none', padding: 0, margin: 0 }}>
                <legend style={{ fontWeight: 600, marginBottom: 6 }}>가져올 자료</legend>
                {!data ? (
                  <p className="text-secondary text-sm">불러오는 중…</p>
                ) : options.map(o => (
                  <label key={o.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', opacity: o.n ? 1 : 0.5 }}>
                    <input
                      type="checkbox"
                      checked={!!opts[o.key] && o.n > 0}
                      disabled={!o.n}
                      onChange={(e) => setOpts(prev => ({ ...prev, [o.key]: e.target.checked }))}
                    />
                    <span>
                      {o.label} {o.key !== 'budget' && <span className="text-secondary">({o.n})</span>}
                      {o.note && <span className="text-secondary text-sm"> · {o.note}</span>}
                    </span>
                  </label>
                ))}
              </fieldset>

              {opts.schedules && count('schedules') > 0 && (
                <div className="form-group">
                  <label htmlFor="copy-start">새 지점 일정 시작일</label>
                  <DateInput id="copy-start" value={scheduleStart} onChange={setScheduleStart} />
                  <p className="text-secondary text-sm" style={{ marginTop: 4 }}>
                    {source.name}의 첫 일정을 이 날짜로 옮기고, 나머지 일정도 같은 간격으로 배치해요. 단계와 함께 복사돼요.
                  </p>
                </div>
              )}

              {error && <p style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-sm)' }}>{error}</p>}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
              <button type="submit" className="btn btn-primary" disabled={!name.trim() || !data || working}>
                {working ? '만드는 중…' : '새 지점 만들기'}
              </button>
            </div>
          </form>
        )}
      </div>
    </ModalPortal>
  );
}
