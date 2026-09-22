import { useState } from 'react';
import NeonIcon from '../common/NeonIcon';
import PartnerForm from './PartnerForm';
import { formatCurrency } from '../../utils/formatters';
import { PARTNER_CATEGORIES, getPartnerCategory } from '../../constants/partnerCategories';
import './PartnerList.css';

export default function PartnerList({ partners, onAdd, onUpdate, onDelete }) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const filteredPartners = partners.filter(p => {
    const matchesCat = activeCategory === 'all' || p.category === activeCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      p.companyName?.toLowerCase().includes(q) ||
      p.managerName?.toLowerCase().includes(q) ||
      p.phone?.includes(q) ||
      p.memo?.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  const handleEdit = (partner) => {
    setEditingPartner(partner);
    setShowForm(true);
  };

  const handleCopyAccount = (partner) => {
    const text = `${partner.bankName} ${partner.accountNumber} (${partner.accountHolder})`;
    navigator.clipboard.writeText(text);
    setCopiedId(partner.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSubmit = async (data) => {
    if (editingPartner) {
      await onUpdate(editingPartner.id, data);
    } else {
      await onAdd(data);
    }
    setShowForm(false);
    setEditingPartner(null);
  };

  return (
    <div className="partner-section animate-fade-in">
      {/* 헤더 및 추가 버튼 */}
      <div className="partner-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <NeonIcon name="partner" color="coral" size="md" />
          <div>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800 }}>협력업체 & 공사 거래처 명부</h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
              시공 소장, 리프트/장비 업체, 관공서 주무관 등 전담 연락처를 한 곳에서 관리하고 즉시 통화합니다.
            </p>
          </div>
        </div>

        <button className="btn btn-primary" onClick={() => { setEditingPartner(null); setShowForm(true); }}>
          <span>+</span> 새 협력업체 등록
        </button>
      </div>

      {/* 필터 & 검색 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div className="partner-filter-bar">
          <button
            className={`partner-filter-btn ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            전체 ({partners.length})
          </button>
          {PARTNER_CATEGORIES.map(cat => {
            const count = partners.filter(p => p.category === cat.id).length;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                className={`partner-filter-btn ${isActive ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
                style={
                  isActive
                    ? {
                        background: cat.color,
                        borderColor: cat.color,
                        boxShadow: `0 0 12px ${cat.glow}`,
                        color: '#ffffff',
                      }
                    : undefined
                }
              >
                <span style={{ marginRight: 4 }}>{cat.icon}</span>
                {cat.shortLabel} ({count})
              </button>
            );
          })}
        </div>

        <div style={{ minWidth: 220, position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: 10, display: 'flex', pointerEvents: 'none' }}>
            <NeonIcon name="search" size="xs" color="cyan" badge={false} />
          </span>
          <input
            type="text"
            placeholder="업체명, 담당자, 연락처 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ fontSize: 12, padding: '6px 12px 6px 32px', width: '100%' }}
          />
        </div>
      </div>

      {/* 업체 카드 그리드 */}
      {filteredPartners.length > 0 ? (
        <div className="partner-grid stagger-children">
          {filteredPartners.map(partner => {
            const catCfg = getPartnerCategory(partner.category);
            return (
              <div
                key={partner.id}
                className="partner-card"
                style={{
                  '--partner-accent': catCfg.color,
                  borderTop: `2px solid ${catCfg.color}`,
                }}
              >
                <div className="partner-card-header">
                  <div>
                    <span
                      className="partner-category-badge"
                      style={{
                        background: catCfg.bg,
                        borderColor: catCfg.border,
                        color: catCfg.text,
                        boxShadow: `0 0 8px ${catCfg.glow}`,
                      }}
                    >
                      <span style={{ marginRight: 4 }}>{catCfg.icon}</span>
                      {catCfg.shortLabel}
                    </span>
                    <div className="partner-company-name">{partner.companyName}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn-ghost btn-sm" onClick={() => handleEdit(partner)} title="수정">
                      <NeonIcon name="edit" size="xs" badge={false} />
                    </button>
                    <button className="btn-ghost btn-sm" onClick={() => onDelete(partner.id)} title="삭제" style={{ color: 'var(--color-error)' }}>
                      <NeonIcon name="trash" size="xs" color="rose" badge={false} />
                    </button>
                  </div>
                </div>

                <div className="partner-manager-info" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <NeonIcon name="partner" size="xs" color="cyan" badge={false} />
                  <strong>{partner.managerName || '담당자 미정'}</strong>
                  {partner.position && <span style={{ color: 'var(--color-text-muted)' }}>({partner.position})</span>}
                </div>

                {/* 연락처 박스 (원클릭 전화걸기) */}
                <div className="partner-contact-box">
                  <div className="partner-contact-row">
                    <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <NeonIcon name="phone" size="xs" color="emerald" badge={false} />
                      <span>{partner.phone}</span>
                    </span>
                    <a href={`tel:${partner.phone}`} className="partner-call-btn" title="모바일 즉시 통화" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <NeonIcon name="phone" size="xs" color="emerald" badge={false} />
                      <span>전화걸기</span>
                    </a>
                  </div>
                  {partner.email && (
                    <div style={{ color: 'var(--color-text-muted)', marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <NeonIcon name="document" size="xs" color="blue" badge={false} />
                      <span>{partner.email}</span>
                    </div>
                  )}
                </div>

                {/* 계좌 정보 */}
                {(partner.bankName || partner.accountNumber) && (
                  <div className="partner-account-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <NeonIcon name="bank" size="xs" color="amber" badge={false} />
                      <span>{partner.bankName} {partner.accountNumber} ({partner.accountHolder})</span>
                    </span>
                    <button
                      className="btn-ghost btn-sm"
                      onClick={() => handleCopyAccount(partner)}
                      style={{ fontSize: 10, padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      {copiedId === partner.id ? (
                        <>
                          <NeonIcon name="check" size="xs" color="emerald" badge={false} />
                          <span>복사됨!</span>
                        </>
                      ) : (
                        '계좌 복사'
                      )}
                    </button>
                  </div>
                )}

                {/* 메모 */}
                {partner.memo && (
                  <div className="partner-memo-box">
                    {partner.memo}
                  </div>
                )}

                {/* 하단 계약금액 */}
                <div className="partner-card-footer">
                  <div className="partner-contract-amount">
                    계약/견적:{' '}
                    <strong style={{ color: partner.contractAmount ? '#f59e0b' : 'var(--color-text-muted)' }}>
                      {partner.contractAmount ? formatCurrency(partner.contractAmount) : '미정'}
                    </strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card-static" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
          <NeonIcon name="partner" color="coral" size="lg" style={{ margin: '0 auto var(--space-md)' }} />
          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', marginBottom: 4 }}>
            {searchQuery ? '검색된 협력업체가 없습니다.' : '등록된 협력업체가 없습니다.'}
          </div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-md)' }}>
            시공 소장, 리프트/장비 업체, 관공서 담당자를 등록하고 현장에서 바로 통화하세요.
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditingPartner(null); setShowForm(true); }}>
            <span>+</span> 첫 협력업체 등록하기
          </button>
        </div>
      )}

      {showForm && (
        <PartnerForm
          partner={editingPartner}
          onSubmit={handleSubmit}
          onClose={() => { setShowForm(false); setEditingPartner(null); }}
        />
      )}
    </div>
  );
}
