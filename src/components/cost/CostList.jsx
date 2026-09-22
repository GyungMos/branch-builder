import { COST_CATEGORIES } from '../../utils/constants';
import { formatCurrency, formatDate } from '../../utils/formatters';
import NeonIcon from '../common/NeonIcon';
import './CostList.css';

function exportToCSV(costs, totalCost) {
  const headers = ['항목명', '금액', '카테고리', '날짜', '담당자', '은행명', '예금주', '계좌번호', '메모'];
  const rows = costs.map(c => {
    const cat = COST_CATEGORIES.find(ct => ct.id === c.category);
    return [
      c.title,
      c.amount,
      cat?.label || '기타',
      c.date || '',
      c.assignee || '',
      c.bankName || '',
      c.accountHolder || '',
      c.accountNumber || '',
      c.memo || '',
    ];
  });
  rows.push(['', '', '', '', '', '', '', '', '']);
  rows.push(['총합계', totalCost, '', '', '', '', '', '', '']);

  const BOM = '\uFEFF';
  const csvContent = BOM + [headers, ...rows].map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `비용내역_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function CostList({ costs, totalCost, onEdit, onDelete }) {
  if (costs.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <NeonIcon name="money" size="lg" color="amber" badge={true} />
        </div>
        <div className="empty-state-title">비용 내역이 없습니다</div>
        <div className="empty-state-desc">비용을 추가하면 항목별로 관리할 수 있습니다</div>
      </div>
    );
  }

  const categoryTotals = {};
  costs.forEach(c => {
    const cat = c.category || 'etc';
    if (!categoryTotals[cat]) categoryTotals[cat] = 0;
    categoryTotals[cat] += c.amount || 0;
  });

  return (
    <div className="cost-list" id="cost-list">
      {/* 비용 요약 */}
      <div className="cost-summary card-static">
        <div className="cost-summary-header">
          <h4>비용 요약</h4>
          <div className="cost-summary-actions">
            <span className="cost-total">{formatCurrency(totalCost)}</span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => exportToCSV(costs, totalCost)}
              title="엑셀(CSV) 내보내기"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <NeonIcon name="download" size="xs" color="cyan" badge={false} />
              <span>내보내기</span>
            </button>
          </div>
        </div>
        <div className="cost-categories-summary">
          {Object.entries(categoryTotals).map(([catId, amount]) => {
            const category = COST_CATEGORIES.find(c => c.id === catId) || { label: '기타', iconName: 'etc', color: 'slate' };
            const percentage = totalCost > 0 ? Math.round((amount / totalCost) * 100) : 0;
            return (
              <div key={catId} className="cost-category-row">
                <div className="cost-category-info" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <NeonIcon name={category.iconName || 'budget'} color={category.color || 'emerald'} size="xs" badge={true} />
                  <span style={{ fontWeight: 600 }}>{category.label}</span>
                </div>
                <div className="cost-category-amount">
                  <span>{formatCurrency(amount)}</span>
                  <span className="text-tertiary text-xs">{percentage}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 비용 항목 목록 */}
      <div className="cost-items">
        {costs.map(cost => {
          const category = COST_CATEGORIES.find(c => c.id === cost.category) || { label: '기타', iconName: 'etc', color: 'slate' };
          const hasAccount = cost.bankName || cost.accountNumber;
          return (
            <div key={cost.id} className="cost-item card-static" id={`cost-${cost.id}`}>
              <div className="cost-item-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <NeonIcon name={category.iconName || 'budget'} color={category.color || 'emerald'} size="sm" badge={true} />
              </div>
              <div className="cost-item-info">
                <div className="cost-item-title">{cost.title}</div>
                <div className="cost-item-meta">
                  <span className="badge badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <NeonIcon name={category.iconName || 'budget'} color={category.color || 'emerald'} size="xs" badge={false} />
                    {category.label}
                  </span>
                  {cost.assignee && (
                    <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <NeonIcon name="partner" size="xs" color="violet" badge={false} />
                      <span>{cost.assignee}</span>
                    </span>
                  )}
                  <span className="text-xs text-tertiary">
                    {cost.date ? formatDate(cost.date) : ''}
                  </span>
                </div>
                {hasAccount && (
                  <div className="cost-item-account" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <NeonIcon name="bank" size="xs" color="amber" badge={false} />
                    <span>{cost.bankName && `${cost.bankName} `}{cost.accountNumber}{cost.accountHolder && ` (${cost.accountHolder})`}</span>
                  </div>
                )}
                {cost.memo && <p className="cost-item-memo">{cost.memo}</p>}
              </div>
              <div className="cost-item-right">
                <div className="cost-item-amount">{formatCurrency(cost.amount)}</div>
                <div className="cost-item-actions">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => onEdit(cost)}
                    aria-label="수정"
                    title="수정"
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <NeonIcon name="edit" size="xs" color="cyan" badge={false} />
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => { if (window.confirm('이 비용을 삭제하시겠습니까?')) onDelete(cost.id); }}
                    aria-label="삭제"
                    title="삭제"
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <NeonIcon name="trash" size="xs" color="danger" badge={false} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
