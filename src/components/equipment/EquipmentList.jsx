import { useState } from 'react';
import NeonIcon from '../common/NeonIcon';
import EquipmentForm from './EquipmentForm';
import { formatCurrency, formatDate } from '../../utils/formatters';
import './EquipmentList.css';

export default function EquipmentList({
  equipments,
  onAdd,
  onUpdate,
  onDelete,
  totalEquipmentCost,
  installedCount,
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingEquip, setEditingEquip] = useState(null);

  const handleEdit = (equip) => {
    setEditingEquip(equip);
    setShowForm(true);
  };

  const handleToggleInstalled = async (equip) => {
    await onUpdate(equip.id, { installed: !equip.installed });
  };

  const handleToggleTested = async (equip) => {
    await onUpdate(equip.id, { tested: !equip.tested });
  };

  const handleSubmit = async (data) => {
    if (editingEquip) {
      await onUpdate(editingEquip.id, data);
    } else {
      await onAdd(data);
    }
    setShowForm(false);
    setEditingEquip(null);
  };

  return (
    <div className="equipment-section animate-fade-in">
      {/* 상단 통계 카드 */}
      <div className="equipment-hero-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <NeonIcon name="equipment" color="violet" size="lg" />
          <div>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800 }}>정비 장비 & 리프트 설비 대장</h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
              리프트, 얼라인먼트, 콤프레셔 등 고가 장비의 발주·입고일 및 시운전 완료 상태를 관리합니다.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>총 설비 투자액</div>
            <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: '#c084fc' }}>
              {formatCurrency(totalEquipmentCost)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
              설치 완료 {installedCount} / 총 {equipments.length}대
            </div>
          </div>

          <button className="btn btn-primary" onClick={() => { setEditingEquip(null); setShowForm(true); }}>
            <span>+</span> 새 장비 등록
          </button>
        </div>
      </div>

      {/* 장비 그리드 */}
      {equipments.length > 0 ? (
        <div className="equipment-grid stagger-children">
          {equipments.map(equip => (
            <div key={equip.id} className={`equipment-card ${equip.installed ? 'is-installed' : ''}`}>
              <div className="equipment-top">
                <div>
                  <div className="equipment-name">{equip.name}</div>
                  <div className="equipment-model">
                    {equip.manufacturer && `${equip.manufacturer} · `}
                    {equip.modelNumber || '모델명 미입력'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn-ghost btn-sm" onClick={() => handleEdit(equip)} title="수정">✏️</button>
                  <button className="btn-ghost btn-sm" onClick={() => onDelete(equip.id)} title="삭제" style={{ color: 'var(--color-error)' }}>🗑️</button>
                </div>
              </div>

              {/* 스펙 및 발주 정보 */}
              <div className="equipment-specs-box">
                <div className="equipment-specs-row">
                  <span style={{ color: 'var(--color-text-muted)' }}>수량 및 금액</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {equip.quantity}대 · {formatCurrency(equip.totalPrice || (equip.unitPrice * equip.quantity))}
                  </span>
                </div>
                {equip.vendor && (
                  <div className="equipment-specs-row">
                    <span style={{ color: 'var(--color-text-muted)' }}>납품업체</span>
                    <span>{equip.vendor}</span>
                  </div>
                )}
                {equip.deliveryDate && (
                  <div className="equipment-specs-row">
                    <span style={{ color: 'var(--color-text-muted)' }}>입고/설치일</span>
                    <span style={{ color: '#c084fc', fontWeight: 600 }}>{formatDate(equip.deliveryDate)}</span>
                  </div>
                )}
                {equip.warrantyPeriod && (
                  <div className="equipment-specs-row">
                    <span style={{ color: 'var(--color-text-muted)' }}>A/S 보증</span>
                    <span>{equip.warrantyPeriod}</span>
                  </div>
                )}
              </div>

              {equip.memo && (
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', background: 'rgba(255,255,255,0.02)', padding: 8, borderRadius: 6, lineHeight: 1.4 }}>
                  💡 {equip.memo}
                </div>
              )}

              {/* 검수 체크바 */}
              <div className="equipment-checks-bar">
                <label className="equipment-check-item">
                  <input
                    type="checkbox"
                    checked={equip.installed || false}
                    onChange={() => handleToggleInstalled(equip)}
                  />
                  <span style={{ color: equip.installed ? '#10b981' : 'var(--color-text-muted)' }}>
                    {equip.installed ? '✅ 현장 설치 완료' : '설치 대기'}
                  </span>
                </label>

                <label className="equipment-check-item" style={{ marginLeft: 'auto' }}>
                  <input
                    type="checkbox"
                    checked={equip.tested || false}
                    onChange={() => handleToggleTested(equip)}
                  />
                  <span style={{ color: equip.tested ? '#06b6d4' : 'var(--color-text-muted)' }}>
                    {equip.tested ? '⚙️ 시운전 합격' : '시운전 미확인'}
                  </span>
                </label>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card-static" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
          <NeonIcon name="equipment" color="violet" size="lg" style={{ margin: '0 auto var(--space-md)' }} />
          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', marginBottom: 4 }}>
            등록된 정비 장비가 없습니다.
          </div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-md)' }}>
            2주식/4주식 리프트, 휠얼라인먼트, 콤프레셔 등 장비를 등록하고 입고·설치 일정을 챙기세요.
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditingEquip(null); setShowForm(true); }}>
            <span>+</span> 첫 장비 등록하기
          </button>
        </div>
      )}

      {showForm && (
        <EquipmentForm
          equipment={editingEquip}
          onSubmit={handleSubmit}
          onClose={() => { setShowForm(false); setEditingEquip(null); }}
        />
      )}
    </div>
  );
}
