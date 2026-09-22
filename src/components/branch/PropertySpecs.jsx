import NeonIcon from '../common/NeonIcon';
import { formatCurrency, formatDate, getDDay } from '../../utils/formatters';

export default function PropertySpecs({ property, onEdit }) {
  const p = property || {};

  // 렌트프리 D-Day 계산
  const rentFreeDDay = p.rentFreeEnd ? getDDay(p.rentFreeEnd) : null;
  const isRentFreeOver = rentFreeDDay && rentFreeDDay.days < 0;

  return (
    <div className="card-static" style={{ marginBottom: 'var(--space-xl)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <NeonIcon name="property" color="cyan" size="sm" />
          <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 800 }}>부지 제원 & 임대차 계약 조건</h3>
        </div>

        {onEdit && (
          <button className="btn btn-secondary btn-sm" onClick={onEdit} style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <NeonIcon name="edit" size="xs" color="cyan" badge={false} />
            <span>부동산 제원 수정</span>
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-md)' }}>
        {/* 1. 건축/부지 제원 */}
        <div style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <NeonIcon name="design" size="xs" color="emerald" badge={false} />
            <span>건축 및 시설 제원</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--font-size-xs)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>대지 면적:</span>
              <strong style={{ color: 'var(--color-text-primary)' }}>{p.landArea ? `${p.landArea}㎡ (${Math.round(p.landArea * 0.3025)}평)` : '미입력'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>건물 층고:</span>
              <strong style={{ color: '#38bdf8' }}>{p.floorHeight ? `${p.floorHeight}m (리프트 높이)` : '미입력'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>용도지역:</span>
              <span>{p.zoning || '미입력'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>주차 대수:</span>
              <span>{p.parkingSpaces ? `${p.parkingSpaces}대` : '미입력'}</span>
            </div>
          </div>
        </div>

        {/* 2. 임대차 조건 */}
        <div style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <NeonIcon name="money" size="xs" color="amber" badge={false} />
            <span>임대차 계약 조건</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--font-size-xs)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>보증금:</span>
              <strong>{p.deposit ? formatCurrency(p.deposit) : '미입력'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>월 임대료:</span>
              <strong style={{ color: '#fbbf24' }}>{p.monthlyRent ? formatCurrency(p.monthlyRent) : '미입력'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>월 관리비:</span>
              <span>{p.maintenanceFee ? formatCurrency(p.maintenanceFee) : '0원'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>계약 만료:</span>
              <span>{p.leaseEnd ? formatDate(p.leaseEnd) : '미입력'}</span>
            </div>
          </div>
        </div>

        {/* 3. 렌트프리 (무상 공사 기간) */}
        <div style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 6 }}>
            ⏳ 렌트프리 (무상 공사 기간)
          </div>
          {p.rentFreeEnd ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'var(--font-size-xs)' }}>
              <div>
                {p.rentFreeStart ? formatDate(p.rentFreeStart) : ''} ~ {formatDate(p.rentFreeEnd)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span className={`badge ${isRentFreeOver ? 'badge-error' : 'badge-warning'}`}>
                  {rentFreeDDay ? rentFreeDDay.text : ''}
                </span>
                <span style={{ fontSize: 11, color: isRentFreeOver ? 'var(--color-error)' : '#10b981' }}>
                  {isRentFreeOver ? '렌트프리 종료 (월세 발생중)' : '무상 기간 내 오픈 필수'}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              설정된 렌트프리 기간이 없습니다.
            </div>
          )}

          {p.termsMemo && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-text-secondary)', borderTop: '1px dashed var(--color-surface-border)', paddingTop: 4 }}>
              특약: {p.termsMemo}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
