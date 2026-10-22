import { useMemo, useState } from 'react';
import { COST_CATEGORIES } from '../../utils/constants';
import { formatCurrency, formatDate, toDateInputValue } from '../../utils/formatters';
import NeonIcon from '../common/NeonIcon';
import DateInput from '../common/DateInput';
import { isScheduledCost, sumScheduled, dueLabel, daysUntilDue } from '../../utils/costs';
import './CostList.css';

function exportToCSV(costs, totalCost) {
  const headers = ['항목명', '금액', '카테고리', '날짜', '지급 상태', '거래처', '담당자', '은행명', '예금주', '계좌번호', '메모'];
  const rows = costs.map(c => {
    const cat = COST_CATEGORIES.find(ct => ct.id === c.category);
    return [
      c.title,
      c.amount,
      cat?.label || '기타',
      c.date?.toDate ? c.date.toDate().toISOString().slice(0, 10) : (c.date || ''),
      isScheduledCost(c) ? '지급 예정' : '지급 완료',
      c.vendor || '',
      c.assignee || '',
      c.bankName || '',
      c.accountHolder || '',
      c.accountNumber || '',
      c.memo || '',
    ];
  });
  rows.push(['', '', '', '', '', '', '', '', '', '', '']);
  rows.push(['지급 완료 합계', totalCost, '', '', '', '', '', '', '', '', '']);
  rows.push(['지급 예정 합계', sumScheduled(costs), '', '', '', '', '', '', '', '', '']);

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

// 검색할 칸
const SEARCH_FIELDS = [
  { id: 'all', label: '전체' },
  { id: 'title', label: '항목명' },
  { id: 'vendor', label: '거래처' },
  { id: 'assignee', label: '담당자' },
  { id: 'category', label: '카테고리' },
  { id: 'memo', label: '메모' },
];

const categoryLabel = (c) => COST_CATEGORIES.find(ct => ct.id === c.category)?.label || '기타';

function fieldText(c, field) {
  const values = {
    title: c.title,
    vendor: [c.vendor, c.accountHolder].filter(Boolean).join(' '),
    assignee: c.assignee,
    category: categoryLabel(c),
    memo: c.memo,
  };
  if (field === 'all') return Object.values(values).join(' ');
  return values[field] || '';
}

const ymd = (d) => toDateInputValue(d);

/** 빠른 기간: 이번 달 · 지난 달 · 올해 */
function quickRange(kind) {
  const now = new Date();
  if (kind === 'thisMonth') return [ymd(new Date(now.getFullYear(), now.getMonth(), 1)), ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0))];
  if (kind === 'lastMonth') return [ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), ymd(new Date(now.getFullYear(), now.getMonth(), 0))];
  if (kind === 'thisYear') return [ymd(new Date(now.getFullYear(), 0, 1)), ymd(new Date(now.getFullYear(), 11, 31))];
  return ['', ''];
}

export default function CostList({ costs, totalCost, onEdit, onDelete, onMarkPaid }) {
  const [query, setQuery] = useState('');
  const [field, setField] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [payStatus, setPayStatus] = useState('all'); // all | paid | scheduled

  const validFrom = /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : '';
  const validTo = /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : '';
  const filtering = Boolean(query.trim() || validFrom || validTo || payStatus !== 'all');

  const filtered = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return costs.filter(c => {
      if (payStatus === 'paid' && isScheduledCost(c)) return false;
      if (payStatus === 'scheduled' && !isScheduledCost(c)) return false;
      const day = ymd(c.date);
      if (validFrom && (!day || day < validFrom)) return false;
      if (validTo && (!day || day > validTo)) return false;
      if (!words.length) return true;
      const text = String(fieldText(c, field)).toLowerCase();
      return words.every(w => text.includes(w));
    });
  }, [costs, query, field, validFrom, validTo, payStatus]);

  const filteredPaid = filtered.filter(c => !isScheduledCost(c)).reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const filteredScheduled = sumScheduled(filtered);
  const resetFilters = () => { setQuery(''); setField('all'); setFrom(''); setTo(''); setPayStatus('all'); };
  const setRange = (kind) => { const [f, t] = quickRange(kind); setFrom(f); setTo(t); };

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

  const scheduledCosts = costs.filter(isScheduledCost);
  const scheduledTotal = sumScheduled(costs);
  const categoryTotals = {};
  costs.filter(c => !isScheduledCost(c)).forEach(c => {
    const cat = c.category || 'etc';
    if (!categoryTotals[cat]) categoryTotals[cat] = 0;
    categoryTotals[cat] += c.amount || 0;
  });

  return (
    <div className="cost-list" id="cost-list">
      {/* 비용 요약 */}
      <div className="cost-summary card-static">
        <div className="cost-summary-header">
          <div>
            <h4>비용 요약 (지급 완료)</h4>
            {scheduledCosts.length > 0 && (
              <div className="cost-scheduled-total">지급 예정 {scheduledCosts.length}건 · {formatCurrency(scheduledTotal)} (합계에서 제외)</div>
            )}
          </div>
          <div className="cost-summary-actions">
            <span className="cost-total">{formatCurrency(totalCost)}</span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => (filtering ? exportToCSV(filtered, filteredPaid) : exportToCSV(costs, totalCost))}
              title={filtering ? '검색 결과만 엑셀(CSV)로 내보내기' : '엑셀(CSV) 내보내기'}
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

      {/* 검색: 거래처·담당자·카테고리 등 + 날짜 기간 */}
      <div className="cost-filter card-static" role="search" aria-label="비용 찾기">
        <div className="cost-filter-row">
          <select className="cost-filter-field" value={field} onChange={(e) => setField(e.target.value)} aria-label="찾을 칸">
            {SEARCH_FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
          <div className="cost-filter-search">
            <span className="cost-filter-icon" aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={field === 'vendor' ? '예: ○○건설' : field === 'assignee' ? '예: 김홍우' : field === 'category' ? '예: 설계, 공사' : '거래처·담당자·항목·카테고리·메모로 찾기'}
              aria-label="찾을 말"
            />
          </div>
          <div className="cost-filter-status" role="radiogroup" aria-label="지급 상태">
            {[['all', '전체'], ['paid', '지급 완료'], ['scheduled', '지급 예정']].map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={payStatus === id}
                className={`filter-pill ${payStatus === id ? 'on' : ''}`} onClick={() => setPayStatus(id)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="cost-filter-row">
          <span className="cost-filter-label">기간</span>
          <DateInput id="cost-from" value={from} onChange={setFrom} placeholder="시작일" className="cost-filter-date" />
          <span className="cost-filter-tilde">~</span>
          <DateInput id="cost-to" value={to} onChange={setTo} placeholder="끝날" className="cost-filter-date" />
          <div className="cost-filter-quick">
            <button type="button" className="filter-pill" onClick={() => setRange('thisMonth')}>이번 달</button>
            <button type="button" className="filter-pill" onClick={() => setRange('lastMonth')}>지난 달</button>
            <button type="button" className="filter-pill" onClick={() => setRange('thisYear')}>올해</button>
          </div>
          {filtering && <button type="button" className="btn btn-ghost btn-sm cost-filter-reset" onClick={resetFilters}>조건 지우기</button>}
        </div>
        {filtering && (
          <p className="cost-filter-result">
            찾은 비용 <strong>{filtered.length}</strong>건 · 지급 완료 <strong>{formatCurrency(filteredPaid)}</strong>
            {filteredScheduled > 0 && <> · 지급 예정 <strong>{formatCurrency(filteredScheduled)}</strong></>}
          </p>
        )}
      </div>

      {/* 비용 항목 목록 */}
      {filtered.length === 0 && <div className="cost-filter-empty">조건에 맞는 비용이 없어요.</div>}
      <div className="cost-items">
        {filtered.map(cost => {
          const category = COST_CATEGORIES.find(c => c.id === cost.category) || { label: '기타', iconName: 'etc', color: 'slate' };
          const hasAccount = cost.bankName || cost.accountNumber;
          return (
            <div key={cost.id} className={`cost-item card-static ${isScheduledCost(cost) ? 'is-scheduled' : ''}`} id={`cost-${cost.id}`}>
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
                  {cost.vendor && (
                    <span className="badge badge-neutral" title="거래처">🏢 {cost.vendor}</span>
                  )}
                  {cost.assignee && (
                    <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <NeonIcon name="partner" size="xs" color="violet" badge={false} />
                      <span>{cost.assignee}</span>
                    </span>
                  )}
                  {isScheduledCost(cost) && (
                    <span className={`cost-due-badge ${(daysUntilDue(cost) ?? 1) < 0 ? 'overdue' : ''}`}>{dueLabel(cost)}</span>
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
                  {isScheduledCost(cost) && onMarkPaid && (
                    <button className="btn btn-secondary btn-sm" onClick={() => onMarkPaid(cost)} title="오늘 날짜로 지급 완료 처리">
                      지급 완료 처리
                    </button>
                  )}
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
