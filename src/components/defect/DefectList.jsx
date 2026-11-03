import { useState } from 'react';
import ModalPortal from '../common/ModalPortal';
import DateInput from '../common/DateInput';
import AttachmentPicker, { AttachmentChips } from '../common/AttachmentPicker';
import { formatCurrency, formatDateShort, formatNumberWithCommas, parseNumberFromCommas, toDateInputValue } from '../../utils/formatters';
import './DefectList.css';

export const DEFECT_STATUS = {
  open: { label: '접수', className: 'open' },
  doing: { label: '처리 중', className: 'doing' },
  done: { label: '완료', className: 'done' },
};

const today = () => toDateInputValue(new Date());
const daysSince = (ymd) => {
  if (!ymd) return null;
  const d = new Date(`${ymd}T00:00:00`);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((t - d) / 86400000);
};

/** 하자·A/S 한 건 작성·수정 */
function DefectForm({ defect, branchId, partners = [], equipments = [], onSave, onDelete, onClose }) {
  const [title, setTitle] = useState(defect?.title || '');
  const [location, setLocation] = useState(defect?.location || '');
  const [partner, setPartner] = useState(defect?.partner || '');
  const [reportedDate, setReportedDate] = useState(defect?.reportedDate || today());
  const [status, setStatus] = useState(defect?.status || 'open');
  const [doneDate, setDoneDate] = useState(defect?.doneDate || '');
  const [warranty, setWarranty] = useState(defect?.warranty || '');
  const [repairCost, setRepairCost] = useState(defect?.repairCost ? formatNumberWithCommas(defect.repairCost) : '');
  const [memo, setMemo] = useState(defect?.memo || '');
  const [files, setFiles] = useState(defect?.files || []);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        location: location.trim(),
        partner: partner.trim(),
        reportedDate: reportedDate || today(),
        status,
        doneDate: status === 'done' ? (doneDate || today()) : '',
        warranty,
        repairCost: parseNumberFromCommas(repairCost) || 0,
        memo: memo.trim(),
        files,
      });
    } finally {
      setSaving(false);
    }
  };

  const places = [...new Set([...equipments.map(e => e.name), '리프트', '출입문·셔터', '전기·조명', '배관·배수', '바닥', '지붕·누수', '간판'].filter(Boolean))];

  return (
    <ModalPortal onClose={onClose}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 560 }} role="dialog" aria-label="하자·A/S">
        <div className="modal-header">
          <h2 className="modal-title">{defect ? '하자·A/S 수정' : '하자·A/S 접수'}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="defect-title">무엇이 문제인가요? *</label>
              <input id="defect-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 2번 리프트 상승 시 소음, 셔터 모터 고장" required autoFocus />
            </div>
            <div className="defect-form-grid">
              <div className="form-group">
                <label htmlFor="defect-loc">장소·장비</label>
                <input id="defect-loc" list="defect-places" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="예: 2번 리프트" />
                <datalist id="defect-places">{places.map(p => <option key={p} value={p} />)}</datalist>
              </div>
              <div className="form-group">
                <label htmlFor="defect-partner">맡긴 업체</label>
                <input id="defect-partner" list="defect-partners" value={partner} onChange={(e) => setPartner(e.target.value)} placeholder="예: 대한리프트" />
                <datalist id="defect-partners">{partners.map(p => <option key={p.id} value={p.companyName} />)}</datalist>
              </div>
              <div className="form-group">
                <label>접수일</label>
                <DateInput value={reportedDate} onChange={setReportedDate} />
              </div>
              <div className="form-group">
                <label>보증 수리인가요?</label>
                <div className="seg-toggle" role="radiogroup" aria-label="보증 수리">
                  {[['yes', '보증(무상)'], ['no', '유상'], ['', '모름']].map(([v, l]) => (
                    <button key={v || 'unknown'} type="button" role="radio" aria-checked={warranty === v} className={warranty === v ? 'on' : ''} onClick={() => setWarranty(v)}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="form-group">
              <label>진행 상태</label>
              <div className="seg-toggle" role="radiogroup" aria-label="진행 상태">
                {Object.entries(DEFECT_STATUS).map(([v, s]) => (
                  <button key={v} type="button" role="radio" aria-checked={status === v} className={status === v ? 'on' : ''} onClick={() => setStatus(v)}>{s.label}</button>
                ))}
              </div>
            </div>
            {status === 'done' && (
              <div className="defect-form-grid">
                <div className="form-group">
                  <label>처리 완료일</label>
                  <DateInput value={doneDate || today()} onChange={setDoneDate} />
                </div>
                <div className="form-group">
                  <label htmlFor="defect-cost">수리 비용 (원)</label>
                  <input id="defect-cost" inputMode="numeric" value={repairCost} onChange={(e) => setRepairCost(formatNumberWithCommas(parseNumberFromCommas(e.target.value) || ''))} placeholder="보증이면 0" />
                </div>
              </div>
            )}
            <div className="form-group">
              <label htmlFor="defect-memo">처리 내용·메모</label>
              <textarea id="defect-memo" rows={3} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 업체 방문 점검 → 유압 호스 교체, 다음 점검 6개월 뒤" />
            </div>
            <div className="form-group">
              <AttachmentPicker files={files} onChange={setFiles} branchId={branchId} folder="defects" label="현장 사진·수리 내역서" />
            </div>
          </div>
          <div className="modal-footer">
            {defect && onDelete && (
              <button type="button" className="btn btn-ghost" style={{ color: 'var(--color-error)', marginRight: 'auto' }} onClick={() => onDelete(defect)}>지우기</button>
            )}
            <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !title.trim()}>{saving ? '저장 중…' : '저장'}</button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}

/**
 * 하자·A/S: 오픈 뒤 생긴 고장·하자의 접수 → 처리 중 → 완료 기록
 */
export default function DefectList({ defects = [], branchId, partners, equipments, onAdd, onUpdate, onDelete }) {
  const [editor, setEditor] = useState(null); // { defect } 수정, {} 새로
  const [showAll, setShowAll] = useState(false);
  const openList = defects.filter(d => d.status !== 'done');
  const shown = [...(showAll ? defects : openList)].sort((a, b) => String(b.reportedDate || '').localeCompare(String(a.reportedDate || '')));
  const totalCost = defects.reduce((n, d) => n + (Number(d.repairCost) || 0), 0);

  const save = async (data) => {
    if (editor?.defect) await onUpdate(editor.defect.id, data);
    else await onAdd(data);
    setEditor(null);
  };

  const remove = async (d) => {
    if (!onDelete) return;
    const ok = await onDelete(d);
    if (ok !== false) setEditor(null);
  };

  return (
    <div className="defects">
      <div className="tab-header">
        <div>
          <h3>하자·A/S</h3>
          <p className="text-secondary text-sm" style={{ marginTop: 4 }}>
            오픈 뒤 생긴 고장·하자를 접수하고, 처리될 때까지 챙겨요. 장비 보증기간 안이면 '보증(무상)'으로 표시해 두세요.
          </p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditor({})}>+ 하자 접수</button>
      </div>

      <div className="defects-bar">
        <span className="defects-count">처리 안 된 것 <strong>{openList.length}건</strong> · 전체 {defects.length}건{totalCost > 0 && ` · 수리 비용 ${formatCurrency(totalCost)}`}</span>
        <div className="seg-toggle" role="tablist" aria-label="보기">
          <button type="button" role="tab" aria-selected={!showAll} className={!showAll ? 'on' : ''} onClick={() => setShowAll(false)}>처리 안 된 것</button>
          <button type="button" role="tab" aria-selected={showAll} className={showAll ? 'on' : ''} onClick={() => setShowAll(true)}>전체</button>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="defects-empty">{defects.length ? '처리 안 된 하자가 없어요 👍' : "아직 접수된 하자가 없어요. 고장·하자가 생기면 '+ 하자 접수'로 남겨 두세요."}</p>
      ) : (
        <ul className="defect-list">
          {shown.map(d => {
            const st = DEFECT_STATUS[d.status] || DEFECT_STATUS.open;
            const age = d.status !== 'done' ? daysSince(d.reportedDate) : null;
            return (
              <li key={d.id}>
                <button type="button" className={`defect-card ${st.className}`} onClick={() => setEditor({ defect: d })}>
                  <span className={`defect-status ${st.className}`}>{st.label}</span>
                  <span className="defect-main">
                    <span className="defect-title">{d.title} <AttachmentChips files={d.files} /></span>
                    <span className="defect-sub">
                      {[d.location, d.partner, d.warranty === 'yes' ? '보증(무상)' : d.warranty === 'no' ? '유상' : '',
                        d.reportedDate && `접수 ${formatDateShort(d.reportedDate)}`,
                        d.status === 'done' && d.doneDate && `완료 ${formatDateShort(d.doneDate)}`,
                        d.repairCost ? formatCurrency(d.repairCost) : ''].filter(Boolean).join(' · ')}
                    </span>
                    {d.memo && <span className="defect-memo">{d.memo}</span>}
                  </span>
                  {age !== null && age >= 7 && <span className="defect-age">{age}일째</span>}
                </button>
                {d.status !== 'done' && (
                  <button type="button" className="btn btn-ghost btn-sm defect-quick" onClick={() => onUpdate(d.id, d.status === 'open' ? { status: 'doing' } : { status: 'done', doneDate: today() })}>
                    {d.status === 'open' ? '처리 시작 →' : '완료 ✓'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editor && (
        <DefectForm
          defect={editor.defect}
          branchId={branchId}
          partners={partners}
          equipments={equipments}
          onSave={save}
          onDelete={onDelete ? remove : null}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}
