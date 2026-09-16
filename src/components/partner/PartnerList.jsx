import { useState } from 'react';
import NeonIcon from '../common/NeonIcon';
import PartnerForm from './PartnerForm';
import { formatCurrency } from '../../utils/formatters';
import './PartnerList.css';

const CATEGORY_MAP = {
  construction: '건축/토목',
  facility: '전기/설비',
  equipment: '정비장비/리프트',
  interior: '간판/인테리어',
  safety: '소방/환경',
  admin: '인허가/관공서',
  etc: '기타',
};

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
          {Object.entries(CATEGORY_MAP).map(([key, label]) => {
            const count = partners.filter(p => p.category === key).length;
            return (
              <button
                key={key}
                className={`partner-filter-btn ${activeCategory === key ? 'active' : ''}`}
                onClick={() => setActiveCategory(key)}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>

        <div style={{ minWidth: 200 }}>
          <input
            type="text"
            placeholder="🔍 업체명, 담당자, 연락처 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ fontSize: 12, padding: '6px 12px', width: '100%' }}
          />
        </div>
      </div>

      {/* 업체 카드 그리드 */}
      {filteredPartners.length > 0 ? (
        <div className="partner-grid stagger-children">
          {filteredPartners.map(partner => (
            <div key={partner.id} className="partner-card">
              <div className="partner-card-header">
                <div>
                  <span className="partner-category-badge">{CATEGORY_MAP[partner.category] || '기타'}</span>
                  <div className="partner-company-name">{partner.companyName}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn-ghost btn-sm" onClick={() => handleEdit(partner)} title="수정">✏️</button>
                  <button className="btn-ghost btn-sm" onClick={() => onDelete(partner.id)} title="삭제" style={{ color: 'var(--color-error)' }}>🗑️</button>
                </div>
              </div>

              <div className="partner-manager-info">
                <span>👤</span>
                <strong>{partner.managerName || '담당자 미정'}</strong>
                {partner.position && <span style={{ color: 'var(--color-text-muted)' }}>({partner.position})</span>}
              </div>

              {/* 연락처 박스 (원클릭 전화걸기) */}
              <div className="partner-contact-box">
                <div className="partner-contact-row">
                  <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>📞 {partner.phone}</span>
                  <a href={`tel:${partner.phone}`} className="partner-call-btn" title="모바일 즉시 통화">
                    📞 전화걸기
                  </a>
                </div>
                {partner.email && (
                  <div style={{ color: 'var(--color-text-muted)', marginTop: 2 }}>
                    ✉️ {partner.email}
                  </div>
                )}
              </div>

              {/* 계좌 정보 */}
              {(partner.bankName || partner.accountNumber) && (
                <div className="partner-account-box">
                  <span>💳 {partner.bankName} {partner.accountNumber} ({partner.accountHolder})</span>
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => handleCopyAccount(partner)}
                    style={{ fontSize: 10, padding: '2px 6px' }}
                  >
                    {copiedId === partner.id ? '복사됨! ✅' : '계좌 복사'}
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
                  계약/견적: <strong>{partner.contractAmount ? formatCurrency(partner.contractAmount) : '미정'}</strong>
                </div>
              </div>
            </div>
          ))}
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
