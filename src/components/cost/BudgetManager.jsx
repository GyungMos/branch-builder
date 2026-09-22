import { useState, useEffect } from 'react';
import NeonIcon from '../common/NeonIcon';
import ModalPortal from '../common/ModalPortal';
import { formatCurrency, formatNumberWithCommas, parseNumberFromCommas } from '../../utils/formatters';
import { COST_CATEGORIES } from '../../utils/constants';
import './BudgetManager.css';

export default function BudgetManager({ budget, totalCost, costs = [], onUpdateBudget }) {
  const [showModal, setShowModal] = useState(false);
  const [totalBudgetInput, setTotalBudgetInput] = useState(
    budget?.totalBudget ? formatNumberWithCommas(budget.totalBudget) : ''
  );
  const [catBudgets, setCatBudgets] = useState(budget?.categoryBudgets || {});

  useEffect(() => {
    if (budget?.totalBudget !== undefined) {
      setTotalBudgetInput(budget.totalBudget ? formatNumberWithCommas(budget.totalBudget) : '');
    }
    if (budget?.categoryBudgets) {
      setCatBudgets(budget.categoryBudgets);
    }
  }, [budget]);

  const totalBudget = Number(budget?.totalBudget) || 0;
  const usagePercent = totalBudget > 0 ? Math.round((totalCost / totalBudget) * 100) : 0;
  const remaining = totalBudget - totalCost;
  const isOver = totalBudget > 0 && remaining < 0;

  let barStatus = 'safe';
  if (usagePercent >= 100) barStatus = 'danger';
  else if (usagePercent >= 80) barStatus = 'warning';

  const handleSave = async (e) => {
    e.preventDefault();
    await onUpdateBudget({
      totalBudget: parseNumberFromCommas(totalBudgetInput),
      categoryBudgets: catBudgets,
    });
    setShowModal(false);
  };

  const handleTotalBudgetChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setTotalBudgetInput(raw ? Number(raw).toLocaleString('ko-KR') : '');
  };

  const handleCatChange = (catId, val) => {
    const raw = String(val).replace(/[^0-9]/g, '');
    setCatBudgets(prev => ({
      ...prev,
      [catId]: raw ? Number(raw) : 0,
    }));
  };

  // 카테고리별 실지출 계산
  const actualByCat = {};
  COST_CATEGORIES.forEach(c => { actualByCat[c.id] = 0; });
  costs.forEach(c => {
    const cat = c.category || 'etc';
    actualByCat[cat] = (actualByCat[cat] || 0) + (Number(c.amount) || 0);
  });

  return (
    <div className="budget-section">
      <div className="budget-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <NeonIcon name="money" color="amber" size="md" />
          <div>
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800 }}>목표 예산 vs 실집행 현황</h3>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
              오픈 목표 예산 한도를 설정하고 실시간 비용 초과 여부를 통제합니다.
            </p>
          </div>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <NeonIcon name="settings" size="xs" color="cyan" badge={false} />
          <span>목표 예산 설정</span>
        </button>
      </div>

      {totalBudget > 0 ? (
        <>
          {/* 핵심 KPI 3박스 */}
          <div className="budget-kpi-grid">
            <div className="budget-kpi-box">
              <span className="budget-kpi-title">총 목표 예산</span>
              <span className="budget-kpi-val">{formatCurrency(totalBudget)}</span>
            </div>
            <div className="budget-kpi-box">
              <span className="budget-kpi-title">현재 실집행 누적액</span>
              <span className="budget-kpi-val" style={{ color: isOver ? 'var(--color-error)' : 'var(--color-text-primary)' }}>
                {formatCurrency(totalCost)}
              </span>
            </div>
            <div className="budget-kpi-box">
              <span className="budget-kpi-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {isOver ? (
                  <>
                    <NeonIcon name="alert" size="xs" color="rose" badge={false} />
                    <span>예산 초과액</span>
                  </>
                ) : (
                  '잔여 가용 예산'
                )}
              </span>
              <span className="budget-kpi-val" style={{ color: isOver ? 'var(--color-error)' : '#10b981' }}>
                {isOver ? `+${formatCurrency(Math.abs(remaining))}` : formatCurrency(remaining)}
              </span>
            </div>
          </div>

          {/* 메인 집행률 게이지 */}
          <div className="budget-bar-container">
            <div className="budget-bar-header">
              <span>예산 집행률</span>
              <span style={{ color: barStatus === 'danger' ? 'var(--color-error)' : barStatus === 'warning' ? '#f59e0b' : '#10b981' }}>
                {usagePercent}% {isOver && '(예산 초과!)'}
              </span>
            </div>
            <div className="budget-bar-track">
              <div
                className={`budget-bar-fill ${barStatus}`}
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
          </div>

          {/* 카테고리별 예산 vs 실지출 비교 미니 카드 */}
          <div className="budget-categories-grid">
            {COST_CATEGORIES.map(cat => {
              const catBudget = Number(budget?.categoryBudgets?.[cat.id]) || 0;
              const catActual = actualByCat[cat.id] || 0;
              const catPct = catBudget > 0 ? Math.round((catActual / catBudget) * 100) : 0;
              const isCatOver = catBudget > 0 && catActual > catBudget;

              return (
                <div key={cat.id} className="budget-cat-item">
                  <div className="budget-cat-top">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <NeonIcon name={cat.iconName || 'budget'} color={cat.color || 'emerald'} size="xs" badge={true} />
                      <span style={{ fontWeight: 600 }}>{cat.label}</span>
                    </div>
                    <span style={{ fontWeight: 700, color: isCatOver ? 'var(--color-error)' : 'var(--color-text-secondary)' }}>
                      {formatCurrency(catActual)} {catBudget > 0 && `/ ${formatCurrency(catBudget)}`}
                    </span>
                  </div>
                  {catBudget > 0 && (
                    <div style={{ width: '100%', height: 4, background: 'var(--color-surface)', borderRadius: 2, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(catPct, 100)}%`,
                          background: isCatOver ? 'var(--color-error)' : '#10b981',
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: 'var(--space-md)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
          아직 목표 예산이 설정되지 않았습니다. 우측 <strong>[목표 예산 설정]</strong> 버튼을 눌러 예산을 입력해 보세요.
        </div>
      )}

      {/* 예산 설정 모달 */}
      {showModal && (
        <ModalPortal onClose={() => setShowModal(false)}>
          <div className="modal-backdrop" onClick={() => setShowModal(false)} />
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <NeonIcon name="money" color="amber" size="sm" />
                <h2 className="modal-title">목표 예산 설정</h2>
              </div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="total-budget">총 목표 예산 (원) *</label>
                  <input
                    id="total-budget"
                    type="text"
                    inputMode="numeric"
                    value={totalBudgetInput}
                    onChange={handleTotalBudgetChange}
                    placeholder="예: 300,000,000 (3억)"
                    required
                    className="tabular-nums"
                    style={{ fontSize: 16, fontWeight: 700 }}
                  />
                </div>

                <div style={{ marginTop: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 8, display: 'block' }}>
                    카테고리별 예산 한도 할당 (선택)
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {COST_CATEGORIES.map(cat => (
                      <div key={cat.id} style={{ display: 'grid', gridTemplateColumns: '135px 1fr', alignItems: 'center', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <NeonIcon name={cat.iconName || 'budget'} color={cat.color || 'emerald'} size="xs" badge={false} />
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{cat.label}</span>
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={catBudgets[cat.id] ? formatNumberWithCommas(catBudgets[cat.id]) : ''}
                          onChange={(e) => handleCatChange(cat.id, e.target.value)}
                          className="tabular-nums"
                          style={{ fontSize: 12, padding: '5px 8px' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>취소</button>
                <button type="submit" className="btn btn-primary">예산 저장</button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
