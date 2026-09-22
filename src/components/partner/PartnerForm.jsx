import { useState } from 'react';
import NeonIcon from '../common/NeonIcon';
import ModalPortal from '../common/ModalPortal';
import { formatNumberWithCommas, parseNumberFromCommas } from '../../utils/formatters';
import { PARTNER_CATEGORIES, getPartnerCategory } from '../../constants/partnerCategories';

export default function PartnerForm({ partner, onSubmit, onClose }) {
  const [category, setCategory] = useState(partner?.category || 'construction');
  const [companyName, setCompanyName] = useState(partner?.companyName || '');
  const [managerName, setManagerName] = useState(partner?.managerName || '');
  const [position, setPosition] = useState(partner?.position || '');
  const [phone, setPhone] = useState(partner?.phone || '');
  const [email, setEmail] = useState(partner?.email || '');
  const [contractAmount, setContractAmount] = useState(
    partner?.contractAmount ? formatNumberWithCommas(partner.contractAmount) : ''
  );
  const [bankName, setBankName] = useState(partner?.bankName || '');
  const [accountNumber, setAccountNumber] = useState(partner?.accountNumber || '');
  const [accountHolder, setAccountHolder] = useState(partner?.accountHolder || '');
  const [memo, setMemo] = useState(partner?.memo || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!companyName.trim() || !phone.trim()) return;

    setLoading(true);
    try {
      await onSubmit({
        category,
        companyName: companyName.trim(),
        managerName: managerName.trim(),
        position: position.trim(),
        phone: phone.trim(),
        email: email.trim(),
        contractAmount: parseNumberFromCommas(contractAmount),
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountHolder: accountHolder.trim(),
        memo: memo.trim(),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalPortal onClose={onClose}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal" id="partner-form-modal" style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <NeonIcon name="partner" color="coral" size="sm" />
            <h2 className="modal-title">{partner ? '협력업체 수정' : '새 협력업체 등록'}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>공종 구분 *</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {PARTNER_CATEGORIES.map(c => {
                  const isSelected = category === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setCategory(c.id)}
                      style={{
                        fontSize: 12,
                        padding: '6px 12px',
                        background: isSelected ? c.color : undefined,
                        borderColor: isSelected ? c.color : undefined,
                        boxShadow: isSelected ? `0 0 12px ${c.glow}` : undefined,
                        color: isSelected ? '#ffffff' : undefined,
                      }}
                    >
                      <span style={{ marginRight: 4 }}>{c.icon}</span>
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label htmlFor="p-company">업체명 *</label>
                <input
                  id="p-company"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="예: 현대리프트, 서초토목"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="p-manager">담당자 이름</label>
                <input
                  id="p-manager"
                  type="text"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  placeholder="예: 홍길동 소장"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label htmlFor="p-position">직책 / 담당분야</label>
                <input
                  id="p-position"
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="예: 현장소장, 영업팀장"
                />
              </div>

              <div className="form-group">
                <label htmlFor="p-phone">전화번호 *</label>
                <input
                  id="p-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label htmlFor="p-amount">계약 / 견적 금액 (원)</label>
                <input
                  id="p-amount"
                  type="text"
                  inputMode="numeric"
                  value={contractAmount}
                  onChange={(e) => setContractAmount(formatNumberWithCommas(e.target.value))}
                  placeholder="예: 25,000,000"
                />
              </div>

              <div className="form-group">
                <label htmlFor="p-email">이메일</label>
                <input
                  id="p-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="partner@example.com"
                />
              </div>
            </div>

            {/* 계좌 정보 */}
            <div style={{ background: 'var(--color-bg-secondary)', padding: 12, borderRadius: 8, marginTop: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <NeonIcon name="bank" size="xs" color="amber" badge={false} />
                <span>대금 지급 계좌 정보 (선택)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', gap: 8 }}>
                <input
                  type="text"
                  placeholder="은행명"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  style={{ fontSize: 12 }}
                />
                <input
                  type="text"
                  placeholder="계좌번호"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  style={{ fontSize: 12 }}
                />
                <input
                  type="text"
                  placeholder="예금주"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  style={{ fontSize: 12 }}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 12 }}>
              <label htmlFor="p-memo">업무 메모 / 특이사항</label>
              <textarea
                id="p-memo"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="예: 바닥 콘크리트 양생 후 리프트 앙카 작업 예정, 부가세 포함 견적 등"
                rows={2}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !companyName.trim() || !phone.trim()}>
              {loading ? '저장 중...' : (partner ? '수정 완료' : '업체 등록')}
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}
