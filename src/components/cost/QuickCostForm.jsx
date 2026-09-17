import { useState } from 'react';
import { COST_CATEGORIES } from '../../utils/constants';
import ModalPortal from '../common/ModalPortal';

export default function QuickCostForm({ cost, stages, onSubmit, onClose }) {
  const isEdit = Boolean(cost);
  const [title, setTitle] = useState(cost?.title || '');
  const [amount, setAmount] = useState(cost?.amount ? String(cost.amount) : '');
  const [category, setCategory] = useState(cost?.category || 'etc');
  const [date, setDate] = useState(
    cost?.date
      ? (typeof cost.date === 'string' ? cost.date : new Date(cost.date).toISOString().split('T')[0])
      : new Date().toISOString().split('T')[0]
  );
  const [stageId, setStageId] = useState(cost?.stageId || '');
  const [memo, setMemo] = useState(cost?.memo || '');
  const [assignee, setAssignee] = useState(cost?.assignee || '');
  // 상대방 계좌 정보
  const [bankName, setBankName] = useState(cost?.bankName || '');
  const [accountNumber, setAccountNumber] = useState(cost?.accountNumber || '');
  const [accountHolder, setAccountHolder] = useState(cost?.accountHolder || '');
  const [showAccount, setShowAccount] = useState(Boolean(cost?.bankName || cost?.accountNumber));
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !amount) return;
    setLoading(true);
    try {
      await onSubmit({
        title: title.trim(),
        amount: Number(amount),
        category,
        date,
        stageId: stageId || null,
        assignee: assignee.trim(),
        memo: memo.trim(),
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountHolder: accountHolder.trim(),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatInputAmount = (val) => {
    return val.replace(/[^0-9]/g, '');
  };

  return (
    <ModalPortal onClose={onClose}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal" id="cost-form-modal">
        <div className="modal-header">
          <h2 className="modal-title">💰 {isEdit ? '비용 수정' : '비용 추가'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="cost-title">항목명 *</label>
              <input
                id="cost-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 토지 임대료, 설계비"
                required
                autoFocus
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="cost-amount">금액 (원) *</label>
                <input
                  id="cost-amount"
                  type="text"
                  inputMode="numeric"
                  value={amount ? Number(amount).toLocaleString() : ''}
                  onChange={(e) => setAmount(formatInputAmount(e.target.value))}
                  placeholder="0"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="cost-date">날짜</label>
                <input
                  id="cost-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="cost-category">카테고리</label>
                <select id="cost-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {COST_CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="cost-assignee">담당자</label>
                <input
                  id="cost-assignee"
                  type="text"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  placeholder="예: 김대리"
                />
              </div>
            </div>

            {stages.length > 0 && (
              <div className="form-group">
                <label htmlFor="cost-stage">연결 단계</label>
                <select id="cost-stage" value={stageId} onChange={(e) => setStageId(e.target.value)}>
                  <option value="">선택 안함</option>
                  {stages.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 상대방 계좌 정보 */}
            <div className="form-section-toggle">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowAccount(!showAccount)}
              >
                🏦 {showAccount ? '계좌 정보 숨기기 ▲' : '상대방 계좌 정보 입력 ▼'}
              </button>
            </div>

            {showAccount && (
              <div className="form-section-collapsible">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="cost-bank">은행명</label>
                    <input
                      id="cost-bank"
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="예: 국민은행"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="cost-account-holder">예금주</label>
                    <input
                      id="cost-account-holder"
                      type="text"
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value)}
                      placeholder="예: 홍길동"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="cost-account-number">계좌번호</label>
                  <input
                    id="cost-account-number"
                    type="text"
                    inputMode="numeric"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="예: 123-456-789012"
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="cost-memo">메모</label>
              <textarea
                id="cost-memo"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="메모를 입력하세요"
                rows={2}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !title.trim() || !amount}>
              {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : (isEdit ? '수정' : '추가')}
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}
